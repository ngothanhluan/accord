// ST-LN-63: tests that count the git processes accord itself starts, against the baseline in git-counts.before.json.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { CONFIG, laneTicket, PLAN, REPORT, junit } from '../../../test/helpers/lane.js';
import { loadFromFs } from '../src/load/fs.js';
import { countedSync } from './helpers/git-spawns.js';
import { counted } from './helpers/runs.js';
import { checkItem, expectFewer, ITEMS } from './helpers/items.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, writeFiles } from './helpers/repo.js';
import { prepareSamples, SAMPLE_BUILD_LIMIT, samples } from './helpers/samples.js';
import type { Clone } from './helpers/worktree.js';
import { makeClone } from './helpers/worktree.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

beforeAll(() => prepareSamples(), SAMPLE_BUILD_LIMIT);
afterAll(() => {
  const { mixed, side } = samples();
  mixed.cleanup();
  side.cleanup();
});

const isAncestor = (a: string[]) => a[0] === 'merge-base' && a.includes('--is-ancestor');
const isLsTree = (a: string[]) => a.includes('ls-tree');
const isRecordsDiff = (a: string[]) => a[0] === 'diff' && ['--name-only', '-z', '--no-renames', 'HEAD'].every((f) => a.includes(f));
const history = (a: string[]) => isAncestor(a) || isLsTree(a) || isRecordsDiff(a);

type Finding = { rule: string; reason: string };
const rulesOf = (out: string): Finding[] => (JSON.parse(out) as { findings: Finding[] }).findings;
const planFor = (baseline: string, files = 'src/export.ts') => PLAN.replace('abc1234', baseline).replace('files: src/export.ts\nverify: export#escapes', `files: ${files}\nverify: export#escapes`);

// Six times the local time of this test (about 40 s of git work with the sample copy), at least.
const LIMIT = 600_000;

it('risk:complex-branching gate plan and gate done read baseline history for the gated ticket alone and the read commands read none', async () => {
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
      'src/export.ts': 'export const write = 1;\n',
      'accord/tickets/T-1.md': laneTicket('T-1'),
      'accord/tickets/T-2.md': laneTicket('T-2'),
      'accord/tickets/T-3.md': laneTicket('T-3'),
      'accord/tickets/T-4.md': laneTicket('T-4'),
    });
    const base = commitMsg(repo, 'base');
    // A commit on a side branch: a real commit that is not an ancestor of HEAD.
    const main = gitRun(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
    gitRun(repo, 'checkout', '-q', '-b', 'side');
    writeFiles(repo, { 'side.txt': 'side\n' });
    const orphan = commitMsg(repo, 'side');
    gitRun(repo, 'checkout', '-q', main);
    writeFiles(repo, {
      'accord/tickets/T-1/plan.md': planFor(base),
      'accord/tickets/T-2/plan.md': planFor(base, 'src/export.ts, src/missing.ts'),
      'accord/tickets/T-3/plan.md': planFor(orphan),
    });
    const recorded = commitMsg(repo, 'plans');
    // T-4's ticks were made against the commit before HEAD, and HEAD changes only T-4's own records.
    writeFiles(repo, { 'accord/tickets/T-4.md': laneTicket('T-4', { frontmatter: [`verified_commit: "${recorded}"`] }) });
    commitMsg(repo, 'T-4 ticks');

    const plan1 = await counted(['gate', 'plan', 'T-1', '--json'], repo);
    expect(rulesOf(plan1.out).filter((f) => f.rule === 'gate.task-file-unknown')).toEqual([]);
    expect(plan1.argv.filter(isAncestor)).toHaveLength(1);
    expect(plan1.argv.filter(isLsTree)).toHaveLength(1);

    const plan2 = await counted(['gate', 'plan', 'T-2', '--json'], repo);
    const missing = rulesOf(plan2.out).filter((f) => f.rule === 'gate.task-file-unknown');
    expect(missing).toHaveLength(1);
    expect(missing[0].reason).toContain('src/missing.ts');

    const plan3 = await counted(['gate', 'plan', 'T-3', '--json'], repo);
    expect(rulesOf(plan3.out).map((f) => f.rule)).toContain('gate.plan-baseline-unknown');

    const done = await counted(['gate', 'done', 'T-4', '--json'], repo);
    expect(rulesOf(done.out).map((f) => f.rule)).not.toContain('gate.tick-stale-commit');
    expect(done.argv.filter(isRecordsDiff)).toHaveLength(1);

    for (const argv of [['status'], ['lint'], ['dashboard'], ['show', 'T-1'], ['anchor', 'T-1']]) {
      const r = await counted(argv, repo);
      expect(r.argv.filter(history), argv.join(' ')).toEqual([]);
    }
  } finally {
    cleanup(repo);
  }
  await expectFewer('main status', history);
}, LIMIT);

/** `git commit -F <file> --cleanup=verbatim` with the given author and extra `-c` settings; returns the new HEAD sha. */
function commitAs(dir: string, text: string, email: string, config: string[] = []): string {
  const folder = mkdtempSync(join(tmpdir(), 'accord-msg-'));
  try {
    const file = join(folder, 'msg.txt');
    writeFileSync(file, text + '\n');
    gitRun(dir, 'add', '-A');
    gitRun(dir, '-c', `user.email=${email}`, '-c', 'user.name=head', '-c', 'commit.gpgsign=false', ...config.flatMap((c) => ['-c', c]), 'commit', '-q', '-F', file, '--cleanup=verbatim');
    return gitRun(dir, 'rev-parse', 'HEAD').trim();
  } finally {
    cleanup(folder);
  }
}

const isShow = (a: string[]) => a.includes('show');
const item = (name: string) =>
  ITEMS.find((i) => i.item === name) ??
  (() => {
    throw new Error('no such item: ' + name);
  })();

it('risk:parsing the head author comes from the commit object and from git show when the commit names an encoding', async () => {
  const repos: string[] = [];
  try {
    const seed = () => {
      const repo = makeEmptyRepo();
      repos.push(repo);
      writeFiles(repo, { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1') });
      return repo;
    };
    const expected = (repo: string, sha: string, email: string) => ({
      commit: sha,
      authors: { 'accord/tickets/T-1.md': email, [sha]: gitRun(repo, 'show', '-s', '--format=%ae', 'HEAD').trim() },
    });

    const plain = seed();
    const plainSha = commitAs(plain, 'plain', 'plain.author@example.test');
    const a = countedSync(() => loadFromFs(plain));
    expect(a.value.git).toEqual(expected(plain, plainSha, 'plain.author@example.test'));
    expect(a.argv.some((x) => x.includes('cat-file') && x.includes('--batch'))).toBe(true);
    expect(a.argv.filter(isShow)).toEqual([]);

    const encoded = seed();
    const encodedSha = commitAs(encoded, 'encoded', 'encoded.author@example.test', ['i18n.commitEncoding=ISO-8859-1']);
    expect(gitRun(encoded, 'cat-file', '-p', 'HEAD')).toContain('\nencoding ISO-8859-1\n');
    const b = countedSync(() => loadFromFs(encoded));
    expect(b.value.git).toEqual(expected(encoded, encodedSha, 'encoded.author@example.test'));
    expect(b.argv.filter(isShow)).toHaveLength(1);

    const unborn = seed();
    const c = countedSync(() => loadFromFs(unborn));
    expect(c.value.git).toBeUndefined();
    expect(Object.hasOwn(c.value, 'git')).toBe(false);

    await checkItem(item('HEAD author'));
  } finally {
    repos.forEach(cleanup);
  }
}, LIMIT);

let claimed: { c: Clone; shas: Record<string, string[]> } | undefined;

beforeAll(() => {
  const c = makeClone({ tickets: ['A-1', 'A-2', 'A-3', 'A-4'] });
  c.git('config', 'gc.auto', '0');
  c.git('config', 'maintenance.auto', 'false');
  writeFiles(c.root, { 'accord/config.yml': CONFIG + 'branch: "feature/{id}"\n' });
  commitMsg(c.root, 'branch template');
  c.git('push', '-q', 'origin', 'main');
  const starts: Record<string, string> = {};
  const ticks: Record<string, string> = {};
  const branch = (id: string, name: string) => {
    c.git('switch', '-q', '-c', name, 'main');
    writeFiles(c.root, { [`src/${id}.ts`]: id + '\n' });
    starts[id] = commitMsg(c.root, 'work ' + id);
    writeFiles(c.root, { [`accord/tickets/${id}/ledger.md`]: '## Tasks\n' });
    ticks[id] = commitMsg(c.root, 'tick ' + id);
    c.git('push', '-q', 'origin', name);
  };
  branch('A-1', 't/A-1');
  branch('A-2', 't/A-2');
  branch('A-3', 't/A-3');
  branch('A-4', 'feature/A-4');
  // A-2's local branch is one own-records commit ahead of its pushed one.
  c.git('switch', '-q', 't/A-2');
  writeFiles(c.root, { 'accord/tickets/A-2/ledger.md': '## Tasks\n- task 1 done abc1234\n' });
  const ahead = commitMsg(c.root, 'ahead');
  c.git('switch', '-q', 'main');
  // A-3 keeps only its remote-tracking branch.
  c.git('update-ref', '-d', 'refs/heads/t/A-3', ticks['A-3']);
  const files: Record<string, string> = {};
  for (const id of Object.keys(starts)) files[`accord/tickets/${id}.md`] = laneTicket(id, { frontmatter: [`verified_commit: "${starts[id]}"`] });
  writeFiles(c.root, files);
  commitMsg(c.root, 'record the start commits');
  claimed = { c, shas: { 'A-1': [ticks['A-1']], 'A-2': [ticks['A-2'], ahead], 'A-3': [ticks['A-3']], 'A-4': [ticks['A-4']] } };
}, 180_000);

afterAll(() => claimed?.c.cleanupAll());

it('risk:complex-branching a claim tip adds the local branch only when the claim listing holds it', async () => {
  const { c, shas } = claimed as NonNullable<typeof claimed>;
  const { value, argv } = countedSync(() => loadFromFs(c.root));
  const got = Object.fromEntries(Object.entries(value.afterVerify ?? {}).map(([id, list]) => [id, list.map((x) => x.sha)]));
  expect(got).toEqual(shas);
  expect(argv.some((a) => a[0] === 'for-each-ref')).toBe(true);
  expect(argv.filter((a) => a[0] === 'rev-parse' && a.some((x) => x.startsWith('refs/heads/t/') || x.startsWith('refs/heads/feature/')))).toEqual([]);
  await checkItem(item('claim tips'));
}, LIMIT);
