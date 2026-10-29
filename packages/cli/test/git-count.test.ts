// ST-LN-63: tests that count the git processes accord itself starts, against the baseline in git-counts.before.json.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { CONFIG, LANE_S_BODY, laneTicket, PLAN, REPORT, junit } from '../../../test/helpers/lane.js';
import type { SnapshotInput } from '@accord-dev/accord-core';
import { gitDefaultRef, loadClaimView, loadFromFs } from '../src/load/fs.js';
import { countedSync, spawnLog } from './helpers/git-spawns.js';
import { counted, readGolden, runSample } from './helpers/runs.js';
import { checkItem, expectFewer, ITEMS } from './helpers/items.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, mergeMsg, run, writeFiles } from './helpers/repo.js';
import { buildSample, oneTicketFrom, prepareSamples, SAMPLE_BUILD_LIMIT, samples, TWENTY, TWENTY_BUILD_LIMIT } from './helpers/samples.js';
import type { Sample } from './helpers/samples.js';
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

type AfterList = NonNullable<SnapshotInput['afterVerify']>[string];

/** What fs.ts reads from `log -z --format=%x01%H%x00%P --name-only`: `\x01sha NUL parents NUL`, then `\n` + first path NUL and the others NUL-ended. */
function parseAfter(raw: string, remerged: boolean): AfterList {
  const tokens = raw.split('\0');
  const commits: AfterList = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!tokens[i].startsWith('\x01')) continue;
    const sha = tokens[i].slice(1);
    const parents = (tokens[i + 1] ?? '').split(' ').filter((p) => p !== '');
    const files: string[] = [];
    i += 2;
    if ((tokens[i] ?? '').startsWith('\n')) {
      files.push(tokens[i].slice(1));
      while (i + 1 < tokens.length && tokens[i + 1] !== '' && !tokens[i + 1].startsWith('\x01')) files.push(tokens[++i]);
    } else i -= 1;
    commits.push({ sha, parents, ...(parents.length > 1 && !remerged ? {} : { files }) });
  }
  return commits;
}

/** Today's per-ticket pipeline, run by the test itself outside any counted call: the review start, the `rev-list` filter, the `log`. */
function oracleAfter(root: string, def: string, id: string, start: string | undefined, tips: string[]): AfterList | undefined {
  let commit = start;
  if (commit === undefined) {
    try {
      const sha = gitRun(root, '-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '--format=%H', ...tips, '--', `accord/tickets/${id}/review.md`).trim();
      commit = /^[0-9a-f]{40}$/.test(sha) ? sha : undefined;
    } catch {
      commit = undefined;
    }
  }
  if (commit === undefined) return undefined;
  const wanted = commit.toLowerCase();
  const listed = gitRun(root, 'rev-list', '--ignore-missing', commit, '^' + def, '--').split('\n').filter((l) => l !== '');
  if (!listed.some((sha) => sha.startsWith(wanted))) return undefined;
  const args = [
    '-c', 'core.quotePath=false', '-c', 'log.showSignature=false', 'log', '--no-show-signature', '-z', '--topo-order', '--reverse', '--format=%x01%H%x00%P', '--name-only', '--no-renames',
    '--remerge-diff', ...tips, '^' + commit, '^' + def, '--',
  ];
  return parseAfter(gitRun(root, ...args), true);
}

let walked: { c: Clone; expected: Record<string, AfterList>; tips: Record<string, string[]> } | undefined;

beforeAll(() => {
  const ids = ['W-1', 'W-2', 'W-3', 'W-4', 'W-5', 'W-6', 'W-7'];
  const c = makeClone({ tickets: ids });
  c.git('config', 'gc.auto', '0');
  c.git('config', 'maintenance.auto', 'false');
  const base = c.git('rev-parse', 'HEAD').trim();
  const commitOn = (files: Record<string, string>, text: string) => {
    writeFiles(c.root, files);
    return commitMsg(c.root, text);
  };
  const open = (id: string) => c.git('switch', '-q', '-c', 't/' + id, base);
  const publish = (id: string) => {
    c.git('push', '-q', 'origin', 't/' + id);
    c.git('switch', '-q', 'main');
  };
  // W-1: straight after its start commit, the local branch one commit ahead of the pushed one.
  open('W-1');
  const start1 = commitOn({ 'src/W-1.ts': '1\n' }, 'work W-1');
  commitOn({ 'accord/tickets/W-1/ledger.md': '## Tasks\n' }, 'tick W-1');
  c.git('push', '-q', 'origin', 't/W-1');
  commitOn({ 'src/W-1b.ts': '2\n' }, 'ahead W-1');
  c.git('switch', '-q', 'main');
  // W-2: the review round, then work, then main merged into the branch; W-3: main merged, then the review round.
  open('W-2');
  commitOn({ 'accord/tickets/W-2/review.md': '## Round 1\n' }, 'review W-2');
  commitOn({ 'src/W-2.ts': '1\n' }, 'work W-2');
  c.git('switch', '-q', 'main');
  // Main moves on, and holds W-6's review round.
  const moved = commitOn({ 'src/main-x.ts': 'x\n', 'accord/tickets/W-6/review.md': '## Round 1\n' }, 'main moves');
  c.git('push', '-q', 'origin', 'main');
  c.git('switch', '-q', 't/W-2');
  mergeMsg(c.root, 'origin/main', 'merge main into W-2');
  publish('W-2');
  open('W-3');
  commitOn({ 'src/W-3.ts': '1\n' }, 'work W-3');
  mergeMsg(c.root, 'origin/main', 'merge main into W-3');
  commitOn({ 'accord/tickets/W-3/review.md': '## Round 1\n' }, 'review W-3');
  commitOn({ 'src/W-3b.ts': '2\n' }, 'tick W-3');
  publish('W-3');
  // W-4: its start commit is on main. W-5: its start commit is on a branch its tip does not contain.
  open('W-4');
  commitOn({ 'src/W-4.ts': '1\n' }, 'work W-4');
  publish('W-4');
  c.git('switch', '-q', '-c', 'side-d', base);
  const off = commitOn({ 'src/side-d.ts': 'd\n' }, 'side branch commit');
  c.git('switch', '-q', 'main');
  open('W-5');
  commitOn({ 'src/W-5.ts': '1\n' }, 'work W-5');
  commitOn({ 'src/W-5b.ts': '2\n' }, 'more W-5');
  publish('W-5');
  // W-6: every tip is on main. W-7: a lane M ticket with an open task and a merge after its start.
  c.git('branch', 't/W-6', moved);
  c.git('push', '-q', 'origin', 't/W-6');
  open('W-7');
  const start7 = commitOn({ 'src/W-7.ts': '1\n' }, 'work W-7');
  mergeMsg(c.root, 'origin/main', 'merge main into W-7');
  publish('W-7');
  writeFiles(c.root, {
    'accord/tickets/W-1.md': laneTicket('W-1', { frontmatter: [`verified_commit: "${start1}"`] }),
    'accord/tickets/W-2/review.md': '## Round 1\n',
    'accord/tickets/W-3/review.md': '## Round 1\n',
    'accord/tickets/W-4.md': laneTicket('W-4', { frontmatter: [`verified_commit: "${moved}"`] }),
    'accord/tickets/W-5.md': laneTicket('W-5', { frontmatter: [`verified_commit: "${off}"`] }),
    'accord/tickets/W-7.md': laneTicket('W-7', { frontmatter: [`verified_commit: "${start7}"`] }),
    'accord/tickets/W-7/plan.md': PLAN,
    'accord/tickets/W-7/ledger.md': '## Tasks\n- task 1 done abc1234\n',
  });
  commitMsg(c.root, 'record the start commits and the review rounds');
  const def = gitDefaultRef(c.root) as string;
  const starts: Record<string, string | undefined> = { 'W-1': start1, 'W-4': moved, 'W-5': off };
  const expected: Record<string, AfterList> = {};
  const tips: Record<string, string[]> = {};
  // W-7 is not read: its plan has an open task, so core never reads its afterVerify.
  for (const id of ['W-1', 'W-2', 'W-3', 'W-4', 'W-5', 'W-6']) {
    tips[id] = ['refs/remotes/origin/t/' + id, 'refs/heads/t/' + id];
    const list = oracleAfter(c.root, def, id, starts[id], tips[id]);
    if (list !== undefined) expected[id] = list;
  }
  walked = { c, expected, tips };
}, 180_000);

afterAll(() => walked?.c.cleanupAll());

const isStdin = (a: string[]) => a.includes('log') && a.includes('--stdin');
const isTopo = (a: string[]) => a.includes('log') && a.includes('--topo-order') && a.includes('--reverse');
const isReviewStart = (a: string[]) => a.includes('log') && a.includes('-1') && a.includes('--format=%H') && (a[a.length - 1] ?? '').endsWith('/review.md');
const isRevList = (a: string[]) => a.includes('rev-list') && a.includes('--ignore-missing');
const afterReads = (a: string[]) => isTopo(a) || isReviewStart(a) || isRevList(a) || isStdin(a);

it('risk:complex-branching the shared walk gives each ticket what its own git log gives straight merged or unresolvable', async () => {
  const { c, expected, tips } = walked as NonNullable<typeof walked>;
  // Not every ticket has an entry: the start on main, the tips on main and the open task have none.
  expect(Object.keys(expected).sort()).toEqual(['W-1', 'W-2', 'W-3', 'W-5']);
  expect(expected['W-2'].some((x) => x.parents.length > 1)).toBe(true);
  expect(expected['W-3'].some((x) => x.parents.length > 1)).toBe(false);

  const a = countedSync(() => loadFromFs(c.root, { stage: true }));
  expect(a.value.afterVerify).toEqual(expected);
  expect(a.argv.filter(isStdin)).toHaveLength(1);
  const reviews = a.argv.filter(isReviewStart);
  expect(reviews).toHaveLength(1);
  expect(reviews[0]).toEqual(expect.arrayContaining(tips['W-2']));
  const topo = a.argv.filter(isTopo);
  expect(topo).toHaveLength(2);
  expect(topo.some((x) => tips['W-2'].every((t) => x.includes(t)))).toBe(true);
  expect(topo.some((x) => tips['W-5'].every((t) => x.includes(t)))).toBe(true);
  expect(a.argv.filter(isRevList)).toEqual([]);

  // The walk fails: every ticket is read by today's calls and the answers are the same.
  spawnLog.fail = (args) => args.includes('--stdin');
  let b: { value: SnapshotInput; argv: string[][] };
  try {
    b = countedSync(() => loadFromFs(c.root, { stage: true }));
  } finally {
    spawnLog.fail = undefined;
  }
  expect(b.value.afterVerify).toEqual(expected);
  const stdinAt = b.argv.findIndex(isStdin);
  expect(stdinAt).toBeGreaterThanOrEqual(0);
  expect(b.argv.findIndex(isRevList)).toBeGreaterThan(stdinAt);
  expect(b.argv.findIndex(isTopo)).toBeGreaterThan(stdinAt);
  expect(b.argv.filter(isReviewStart).length).toBeGreaterThanOrEqual(3);
  expect(b.argv.filter(isRevList)).toHaveLength(1);
  expect(b.argv.filter(isTopo)).toHaveLength(4);

  await expectFewer('wt-A-7 anchor', afterReads);
  await expectFewer('main lint', afterReads);
}, LIMIT);

let viewed: { root: string; cleanup: () => void } | undefined;

beforeAll(() => {
  const s = buildSample([
    { id: 'C-1', kind: 'build-missing-file' },
    { id: 'C-2', kind: 'build-missing-file' },
    { id: 'C-3', kind: 'verify-merged' },
    { id: 'C-4', kind: 'verify-merged-before' },
    { id: 'C-5', kind: 'build-missing-file' },
  ]);
  const { root } = s;
  // Main moves on once more; C-2 then merges it after its plan commit, and C-5 adds its review round and merges it after that.
  gitRun(root, 'switch', '-q', 'main');
  writeFiles(root, { 'main/claim-view.txt': 'main moves again\n' });
  commitMsg(root, 'main: change for the claim view');
  gitRun(root, 'switch', '-q', 't/C-2');
  mergeMsg(root, 'main', "Merge branch 'main' into t/C-2");
  gitRun(root, 'switch', '-q', 't/C-5');
  writeFiles(root, { 'accord/tickets/C-5/review.md': '## Round 1\nverdict: converged\n' });
  commitMsg(root, 'review: C-5 converged');
  mergeMsg(root, 'main', "Merge branch 'main' into t/C-5");
  gitRun(root, 'push', '-q', 'origin', 'main', 't/C-2', 't/C-5');
  gitRun(root, 'switch', '-q', 'main');
  gitRun(root, 'reset', '-q', '--hard');
  viewed = { root, cleanup: () => s.cleanup() };
}, SAMPLE_BUILD_LIMIT);

afterAll(() => viewed?.cleanup());

const isSubject = (a: string[]) => a.includes('log') && a.includes('-1') && a.includes('--format=%s');
const mentions = (id: string) => (a: string[]) => a.some((x) => x.includes('t/' + id) || x.includes(`tickets/${id}/`));

it('risk:complex-branching the claim view reads plan subjects and review starts from the shared walk and leaves each merge to at most two git reads', async () => {
  const { root } = viewed as NonNullable<typeof viewed>;
  const r = await counted(['status', '--json'], root);
  expect(r.code).toBe(0);
  const stages = Object.fromEntries((JSON.parse(r.out) as { id: string; stage: string }[]).map((row) => [row.id, row.stage]));
  expect(stages).toMatchObject({ 'C-1': 'build', 'C-2': 'build', 'C-3': 'verify', 'C-4': 'verify', 'C-5': 'build' });
  const own = (id: string) => ({
    subject: r.argv.filter(isSubject).filter(mentions(id)).length,
    review: r.argv.filter(isReviewStart).filter(mentions(id)).length,
    after: r.argv.filter(isTopo).filter(mentions(id)).length,
  });
  // (a) a straight branch, (b) a merge after the plan commit, (c) a merge after the review, (d) a merge before it, (e) an open task with a merge after the review.
  expect(own('C-1')).toEqual({ subject: 0, review: 0, after: 0 });
  expect(own('C-2')).toEqual({ subject: 1, review: 0, after: 0 });
  expect(own('C-3')).toEqual({ subject: 0, review: 1, after: 1 });
  expect(own('C-4')).toEqual({ subject: 0, review: 0, after: 0 });
  expect(own('C-5')).toEqual({ subject: 1, review: 0, after: 0 });

  const { value } = countedSync(() => loadClaimView(root));
  for (const id of ['C-1', 'C-2', 'C-5']) {
    const ref = gitRun(root, 'for-each-ref', '--format=%(refname)', `refs/remotes/origin/t/${id}`).trim();
    const want = gitRun(root, '-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '--format=%s', ref, '--', `accord/tickets/${id}/plan.md`).replace(/\r?\n$/, '');
    expect(want, id).toBe(`plan: ${id} ready`);
    expect(value.view.planFacts?.[id], id).toEqual({ subject: want, clean: true });
  }
  await expectFewer('main status', (a) => isSubject(a) || a.includes('--stdin'));
}, LIMIT);

let twenty: { sample: Sample; ones: Record<'B-6' | 'B-7', Sample> } | undefined;

beforeAll(() => {
  const sample = buildSample(TWENTY);
  twenty = { sample, ones: { 'B-6': oneTicketFrom(sample, 'B-6'), 'B-7': oneTicketFrom(sample, 'B-7') } };
}, TWENTY_BUILD_LIMIT);

afterAll(() => {
  twenty?.ones['B-6'].cleanup();
  twenty?.ones['B-7'].cleanup();
  twenty?.sample.cleanup();
});

// About 14 to 19 s locally on Windows; this is over thirty times that, since the limit guards no stall.
const AC1_LIMIT = 600_000;

it('ac-1 a read command starts as many git processes with 20 tickets as with 1', async () => {
  const { sample, ones } = twenty as NonNullable<typeof twenty>;
  expect(sample.withMerge).toEqual(['B-6', 'B-8', 'B-17', 'B-19']);
  const stages = async (root: string) => {
    const r = await run(['status', '--json'], root);
    return Object.fromEntries((JSON.parse(r.out) as { id: string; stage: string }[]).map((row) => [row.id, row.stage]));
  };
  const stagesOfTwenty = await stages(sample.root);
  const twentyCounts = new Map<string, number>();
  for (const id of ['B-6', 'B-7'] as const) {
    const one = ones[id];
    // D-09: the one-ticket repository holds the same branch with the same history, a merge commit included.
    expect(one.withMerge).toEqual(id === 'B-6' ? ['B-6'] : []);
    for (const root of [sample.root, one.root]) {
      expect(gitRun(root, 'rev-parse', `refs/remotes/origin/t/${id}`).trim(), `${root}: the local and the remote branch of ${id}`).toBe(gitRun(root, 'rev-parse', `refs/heads/t/${id}`).trim());
    }
    expect(gitRun(one.root, 'rev-parse', `refs/heads/t/${id}`).trim()).toBe(gitRun(sample.root, 'rev-parse', `refs/heads/t/${id}`).trim());
    expect(stagesOfTwenty[id], `${id} in the 20-ticket repository`).toBeDefined();
    expect((await stages(one.root))[id], `${id} in its one-ticket repository`).toBe(stagesOfTwenty[id]);
    const parents = gitRun(one.root, 'rev-list', '--min-parents=2', `refs/heads/t/${id}`, '^refs/heads/main').split('\n').filter((l) => l !== '');
    expect(parents.length > 0, `${id}: a merge commit on its branch`).toBe(id === 'B-6');

    const others = sample.withMerge.filter((x) => x !== id);
    for (const argv of [['status'], ['anchor', id], ['lint'], ['dashboard'], ['show', id]]) {
      const key = argv.join(' ');
      let many = twentyCounts.get(key);
      if (many === undefined) {
        const r = await counted(argv, sample.root);
        expect(r.code, `${key} in the 20-ticket repository: ${r.err}`).not.toBe(2);
        many = r.argv.length;
        twentyCounts.set(key, many);
        // The shared walk ran: a failed walk sends every ticket to its own reads, which would make the bound pass or fail for the wrong reason.
        if (key === 'status') expect(r.argv.some(isStdin), 'status in the 20-ticket repository reads the commits after each start with one shared walk').toBe(true);
      }
      const r1 = await counted(argv, one.root);
      expect(r1.code, `${key} in the one-ticket repository of ${id}: ${r1.err}`).not.toBe(2);
      const bound = r1.argv.length + 2 * others.length;
      expect(many, `${key} (one ticket ${id}, merge: ${one.withMerge.length > 0}): ${many} git processes with 20 tickets, ${r1.argv.length} with 1, bound ${bound}`).toBeLessThanOrEqual(bound);
      process.stdout.write(`ac-1 ${id} ${key}: 20 tickets ${many}, 1 ticket ${r1.argv.length}, bound ${bound}\n`);
    }
  }
}, AC1_LIMIT);

const isBranchRead = (a: string[]) => a[0] === 'symbolic-ref' && a.includes('--short') && a.includes('HEAD');
const isReviewLog = (a: string[]) => a.includes('log') && a.includes('-G') && a.includes('^## Round ');

it('risk:complex-branching anchor hook and worktree merge read the current branch once detached or unreadable included', async () => {
  const { mixed } = samples();
  const copy = mixed.copy();
  try {
    const wt = copy.worktree('A-7');
    const branchReads = (argv: string[][]) => argv.filter(isBranchRead);

    const onBranch = await counted(['anchor'], wt);
    expect(onBranch.code).toBe(0);
    expect(onBranch.out).toContain('A-7');
    expect(branchReads(onBranch.argv)).toHaveLength(1);

    // The hook reads the branch for the anchor, the record and the hold; the session-resume path asks for all three.
    const resumed = await counted(['hook', 'session-resume'], wt);
    expect(resumed.code).toBe(0);
    expect(resumed.out).toContain('A-7');
    expect(branchReads(resumed.argv)).toHaveLength(1);

    // The branch is unreadable: the same stderr line and exit 0 as before, from the one read.
    spawnLog.fail = isBranchRead;
    let unreadable: Awaited<ReturnType<typeof counted>>;
    try {
      unreadable = await counted(['anchor'], wt);
    } finally {
      spawnLog.fail = undefined;
    }
    expect(unreadable.code).toBe(0);
    expect(unreadable.out).toBe('');
    expect(unreadable.err).toBe('could not read the current branch; nothing to anchor\n');
    expect(branchReads(unreadable.argv)).toHaveLength(1);

    // worktree merge from another checkout refuses as it did, from the one read.
    const other = await counted(['worktree', 'merge', 'A-7'], copy.root);
    expect(other.code).toBe(2);
    expect(other.err).toContain('is merged on its branch t/A-7, and this checkout is on main');
    expect(branchReads(other.argv)).toHaveLength(1);

    // A detached HEAD says nothing and exits 0.
    gitRun(wt, 'switch', '-q', '--detach');
    const detached = await counted(['anchor'], wt);
    expect(detached.code).toBe(0);
    expect(detached.out).toBe('');
    expect(detached.err).toBe('');
    expect(branchReads(detached.argv)).toHaveLength(1);
    const detachedMerge = await counted(['worktree', 'merge', 'A-7'], wt);
    expect(detachedMerge.code).toBe(2);
    expect(detachedMerge.err).toContain('a detached HEAD');
    expect(branchReads(detachedMerge.argv)).toHaveLength(1);
  } finally {
    spawnLog.fail = undefined;
    copy.cleanup();
  }
  await checkItem(item('current branch'));
}, LIMIT);

it('risk:complex-branching lane S gate done reads the review commit once and fails closed without one', async () => {
  const key = 'wt-S-1 gate done S-1 --json';
  const got = (await runSample([key]))[key];
  const want = readGolden<Record<string, { code: number; out: string; err: string }>>('goldens.json')[key];
  expect(got.code).toBe(want.code);
  expect(got.out).toBe(want.out);
  expect(got.err).toBe(want.err);
  expect(got.argv.filter(isReviewLog)).toHaveLength(1);

  // A lane S ticket whose review.md holds no `## Round ` commit: Done fails, from one review log and no show of a review commit.
  const repo = makeEmptyRepo();
  try {
    writeFiles(repo, { 'accord/config.yml': CONFIG, 'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }) });
    commitMsg(repo, 'base');
    const r = await counted(['gate', 'done', 'S-1', '--json'], repo);
    expect(r.code).toBe(1);
    expect(r.argv.filter(isReviewLog)).toHaveLength(1);
    expect(r.argv.filter(isShow)).toEqual([]);
  } finally {
    cleanup(repo);
  }
  await checkItem(item('review commit'));
}, LIMIT);
