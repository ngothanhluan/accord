// Phase 08.9 D-02 and D-03: the batched read of the drafts that backlog branches queue (gitQueuedBatched) against gitQueued, the per-branch read it replaces.
// withQueued, which accord audit, accord dashboard, accord deferred and accord pr share, calls the batched one. This file copies the few fixture lines it needs and imports nothing from another test file.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { laneTicket, P } from '../../../test/helpers/lane.js';
import { countedSync } from './helpers/git-spawns.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, mergeMsg, writeFiles } from './helpers/repo.js';
import { gitQueued, gitQueuedBatched } from '../src/load/fs.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const MAIN = 'refs/heads/main';

/** A sandbox on main holding one ticket M-1 and a note, in one commit. */
function sandbox(): string {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  gitRun(repo, 'config', 'user.email', 'a@x.io');
  gitRun(repo, 'config', 'user.name', 'a');
  writeFiles(repo, { [P('M-1')]: laneTicket('M-1'), 'note.txt': 'note\n' });
  commitMsg(repo, 'base');
  return repo;
}

/** A branch `name` cut from `from` (a branch name or a sha) with one commit writing `files`; the checkout goes back to main. */
function branch(repo: string, name: string, from: string, files: Record<string, string>): string {
  gitRun(repo, 'switch', '-q', '-c', name, from);
  writeFiles(repo, files);
  const sha = commitMsg(repo, `write on ${name}`);
  gitRun(repo, 'switch', '-q', 'main');
  return sha;
}

/** One fixture: what it builds, the ids `known` holds, the ids gitQueued must find (so a read that answered nothing everywhere fails), and how many tips are read by the per-tip diff. */
interface Fixture {
  name: string;
  build: (repo: string) => void;
  known?: string[];
  expected: string[];
  /** Git `diff` processes the batched read starts when it does not fall back to gitQueued (a tip with two or more merge bases, or none). */
  diffs: number;
}

const FIXTURES: Fixture[] = [
  {
    name: '(a) no backlog ref',
    build: () => undefined,
    expected: [],
    diffs: 0,
  },
  {
    name: '(b) one local backlog branch adding two drafts',
    build: (repo) => {
      branch(repo, 'backlog/one', 'main', { [P('Q-1')]: laneTicket('Q-1'), [P('Q-2')]: laneTicket('Q-2') });
    },
    expected: ['Q-1', 'Q-2'],
    diffs: 0,
  },
  {
    name: "(c) one name both local and as origin's remote-tracking ref: origin's copy wins",
    build: (repo) => {
      branch(repo, 'backlog/dup', 'main', { [P('L-1')]: laneTicket('L-1') });
      const theirs = branch(repo, 'scratch', 'main', { [P('O-1')]: laneTicket('O-1') });
      gitRun(repo, 'update-ref', 'refs/remotes/origin/backlog/dup', theirs);
      gitRun(repo, 'branch', '-q', '-D', 'scratch');
    },
    expected: ['O-1'],
    diffs: 0,
  },
  {
    name: '(d) one id queued by three branches with different texts: the first in code-point order wins',
    build: (repo) => {
      branch(repo, 'backlog/a', 'main', { [P('Q-1')]: laneTicket('Q-1') + 'from a\n', [P('Q-3')]: laneTicket('Q-3') });
      branch(repo, 'backlog/b', 'main', { [P('Q-1')]: laneTicket('Q-1') + 'from b\n', [P('Q-2')]: laneTicket('Q-2') });
      // an uppercase B sorts before a lowercase a by code point, not by locale
      branch(repo, 'backlog/B', 'main', { [P('Q-1')]: laneTicket('Q-1') + 'from B\n' });
    },
    expected: ['Q-1', 'Q-2', 'Q-3'],
    diffs: 0,
  },
  {
    name: '(e) drafts filtered out: a known id, an id main already has, an id of the wrong shape, a file in a subfolder, a file outside the folder',
    build: (repo) => {
      const base = gitRun(repo, 'rev-parse', 'main').trim();
      branch(repo, 'backlog/filters', base, {
        [P('K-1')]: laneTicket('K-1'),
        [P('ON-1')]: laneTicket('ON-1'),
        [P('-bad')]: laneTicket('-bad'),
        'accord/tickets/sub/S-1.md': laneTicket('S-1'),
        'accord/other/O-1.md': laneTicket('O-1'),
        [P('OK-1')]: laneTicket('OK-1'),
      });
      // main queues ON-1 meanwhile, so the branch adds it over the merge base and the default ref has it
      writeFiles(repo, { [P('ON-1')]: laneTicket('ON-1') + 'on main\n' });
      commitMsg(repo, 'ON-1 lands on main');
    },
    known: ['K-1'],
    expected: ['OK-1'],
    diffs: 0,
  },
  {
    name: '(f) a branch that adds a draft and deletes it, and one that adds a draft and edits it',
    build: (repo) => {
      gitRun(repo, 'switch', '-q', '-c', 'backlog/gone', 'main');
      writeFiles(repo, { [P('D-1')]: laneTicket('D-1'), [P('D-2')]: laneTicket('D-2') });
      commitMsg(repo, 'add D-1 and D-2');
      rmSync(join(repo, P('D-1')));
      commitMsg(repo, 'delete D-1');
      gitRun(repo, 'switch', '-q', '-c', 'backlog/edited', 'main');
      writeFiles(repo, { [P('E-1')]: laneTicket('E-1') });
      commitMsg(repo, 'add E-1');
      writeFiles(repo, { [P('E-1')]: laneTicket('E-1') + 'edited\n' });
      commitMsg(repo, 'edit E-1');
      gitRun(repo, 'switch', '-q', 'main');
    },
    expected: ['D-2', 'E-1'],
    diffs: 0,
  },
  {
    name: '(g) a branch that merged main once after its first commit while main moved on: two boundary commits, one an ancestor of the other',
    build: (repo) => {
      branch(repo, 'backlog/merged-main', 'main', { [P('G-1')]: laneTicket('G-1') });
      writeFiles(repo, { 'note.txt': 'main moved\n' });
      commitMsg(repo, 'main moves');
      gitRun(repo, 'switch', '-q', 'backlog/merged-main');
      mergeMsg(repo, 'main', 'merge main');
      writeFiles(repo, { [P('G-2')]: laneTicket('G-2') });
      commitMsg(repo, 'queue G-2 after the merge');
      gitRun(repo, 'switch', '-q', 'main');
      writeFiles(repo, { 'note.txt': 'main moves again\n' });
      commitMsg(repo, 'main moves again');
    },
    expected: ['G-1', 'G-2'],
    diffs: 0,
  },
  {
    name: '(h) a criss-cross: a branch with two merge bases with main',
    build: (repo) => {
      const base = gitRun(repo, 'rev-parse', 'main').trim();
      const b1 = branch(repo, 'backlog/cross', base, { [P('H-1')]: laneTicket('H-1') });
      writeFiles(repo, { 'note.txt': 'm1\n' });
      commitMsg(repo, 'm1 on main');
      const m1 = gitRun(repo, 'rev-parse', 'main').trim();
      gitRun(repo, 'switch', '-q', 'backlog/cross');
      mergeMsg(repo, m1, 'merge m1 into the branch');
      writeFiles(repo, { [P('H-2')]: laneTicket('H-2') });
      commitMsg(repo, 'queue H-2');
      gitRun(repo, 'switch', '-q', 'main');
      mergeMsg(repo, b1, 'merge b1 into main');
    },
    expected: ['H-2'],
    diffs: 1,
  },
  {
    name: "(i) beside (b)'s branch, a branch whose history shares no commit with main: today's answer for the whole set is nothing",
    build: (repo) => {
      branch(repo, 'backlog/one', 'main', { [P('Q-1')]: laneTicket('Q-1') });
      gitRun(repo, 'switch', '-q', '--orphan', 'backlog/orphan');
      gitRun(repo, 'rm', '-q', '-rf', '--ignore-unmatch', '.');
      writeFiles(repo, { [P('I-1')]: laneTicket('I-1') });
      commitMsg(repo, 'orphan');
      gitRun(repo, 'switch', '-q', 'main');
    },
    expected: [],
    // the batched read tries the orphan by the per-tip diff (one process, which fails), then gitQueued reads both branches (two more)
    diffs: 3,
  },
  {
    name: '(j) a backlog branch already merged into main, beside one that is not',
    build: (repo) => {
      branch(repo, 'backlog/shipped', 'main', { [P('J-1')]: laneTicket('J-1') });
      mergeMsg(repo, 'backlog/shipped', 'merge shipped');
      branch(repo, 'backlog/open', 'main', { [P('J-2')]: laneTicket('J-2') });
    },
    expected: ['J-2'],
    diffs: 0,
  },
];

// Phase 08.9 D-03: ten fixtures; the batched read gives, entry for entry and in the same order, what gitQueued gives for the same repository.
it('risk:regression gitQueuedBatched answers every set of backlog branches as gitQueued does (D-03)', () => {
  for (const fixture of FIXTURES) {
    const repo = sandbox();
    fixture.build(repo);
    const known = (id: string): boolean => fixture.known?.includes(id) === true;
    const want = gitQueued(repo, MAIN, known);
    expect(Object.keys(want).sort(), `${fixture.name}: what gitQueued finds`).toEqual(fixture.expected);
    const got = gitQueuedBatched(repo, MAIN, known);
    expect(Object.entries(got), fixture.name).toEqual(Object.entries(want));
    const read = countedSync(() => gitQueuedBatched(repo, MAIN, known));
    expect(read.argv.filter((a) => a[0] === 'diff').length, `${fixture.name}: tips read by the per-tip diff`).toBe(fixture.diffs);
  }
});

/** The git verb of one argument list: the first word that is neither a flag nor the value of `-c`. */
function verbOf(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-c') i++;
    else if (!argv[i].startsWith('-')) return argv[i];
  }
  return '?';
}

// Phase 08.9 D-02: twelve live backlog branches cost the batched read the same git processes as two, and none of them is a per-branch diff.
it('risk:resource gitQueuedBatched reads any number of backlog branches with the same git processes (D-02)', () => {
  const reads = (count: number): { verbs: string[]; found: number } => {
    const repo = sandbox();
    for (let i = 1; i <= count; i++) branch(repo, `backlog/q-${i}`, 'main', { [P(`Q-${i}`)]: laneTicket(`Q-${i}`) });
    const read = countedSync(() => gitQueuedBatched(repo, MAIN, () => false));
    return { verbs: read.argv.map(verbOf), found: Object.keys(read.value).length };
  };
  const few = reads(2);
  const many = reads(12);
  expect(few.found).toBe(2);
  expect(many.found).toBe(12);
  expect(many.verbs.length, `${many.verbs.join(' ')} with 12 branches, ${few.verbs.join(' ')} with 2`).toBe(few.verbs.length);
  expect(many.verbs).toEqual(few.verbs);
  expect(many.verbs).not.toContain('diff');
  for (const verb of ['for-each-ref', 'ls-tree', 'rev-list', 'diff-tree', 'cat-file']) expect(many.verbs.filter((v) => v === verb).length, verb).toBeLessThanOrEqual(1);
});
