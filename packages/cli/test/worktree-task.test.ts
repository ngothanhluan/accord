// ST-LN-92 92-ac-2, 92-ac-3, 92-ac-4 (D-03, D-06, D-16): `accord worktree task open|merge|clean` give each task of a wave its own worktree, bring it into the ticket branch
// linearly (rebase, then fast-forward), tell a conflict in a generated file from one in a hand-written file, and remove a task worktree only once the ticket branch holds
// its commits; `accord brief` names the folder the executor works in and puts its report there. Real git in temporary sandboxes. The CLI runs as 0.6.0 (cutoff-pin.test.ts's
// reason): task worktrees are for a ticket claimed from 0.6.0, and CONFIG pins the running version, so 0.6.0 too.
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { loadSnapshot, REPORT_CONTRACT, workOf } from '@accord-dev/accord-core';
import { WORK_DIR_RULE } from '../src/commands/brief.js';
import { cleanup, commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { CONFIG, junit, laneTicket, REPORT, writeReport } from '../../../test/helpers/lane.js';

// Every program the CLI starts, by name, while `spawned.on` is set: the conflict case asserts that only git ran.
// `oldGit` answers `git worktree list ... -z` as a git older than 2.36 does (an unknown switch), for the case that the task commands never need it.
const spawned = vi.hoisted(() => ({ on: false, files: [] as string[], oldGit: false }));
vi.mock('node:child_process', async (orig) => {
  const real = await orig<typeof import('node:child_process')>();
  const wrap = (name: string) => {
    const fn = (real as unknown as Record<string, (...a: unknown[]) => unknown>)[name];
    return function (this: unknown, file: unknown, ...rest: unknown[]) {
      if (spawned.on) spawned.files.push(String(file));
      const args = Array.isArray(rest[0]) ? (rest[0] as unknown[]).map(String) : [];
      if (spawned.oldGit && String(file) === 'git' && args.includes('worktree') && args.includes('list') && args.includes('-z')) {
        throw Object.assign(new Error('Command failed: git worktree list'), { status: 129, stderr: "error: unknown switch `z'\n" });
      }
      return fn.call(this, file, ...rest);
    };
  };
  return { ...real, execFileSync: wrap('execFileSync'), spawnSync: wrap('spawnSync'), execFile: wrap('execFile'), spawn: wrap('spawn'), execSync: wrap('execSync'), exec: wrap('exec') };
});
vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.6.0' } };
});

const HEAD = ['---', 'baseline: abc1234', '---', '', '# Plan', ''];
const task = (n: number, file: string, ac: number): string =>
  [`## Task ${n}: Step ${n}`, `covers: @ac-${ac}`, `files: ${file}`, `verify: ${ac === 1 ? 'export#writes-csv' : 'export#escapes-commas'} (@ac-${ac})`, 'after: none', `Change ${file}.`, ''].join('\n');
const BODY = [...HEAD, task(1, 'src/a.ts', 1), task(2, 'src/b.ts', 1), task(3, 'src/c.ts', 2), task(4, 'src/d.ts', 2)].join('\n');
// the plan_hash a passing `accord gate plan` would write, so task-done reads the plan as checked
const PLAN_HASH = workOf(loadSnapshot({ files: { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1'), 'accord/tickets/T-1/plan.md': BODY }, tree: [] }), 'T-1')?.plan?.bodyHash;
const PLAN = BODY.replace('baseline: abc1234\n', `baseline: abc1234\nplan_hash: "${PLAN_HASH}"\n`);
const IDENTITY = [
  ['user.email', 'fixture@example.invalid'],
  ['user.name', 'fixture'],
  ['commit.gpgsign', 'false'],
];

interface Box {
  main: string;
  /** The ticket's worktree, on t/T-1: every task command runs here. */
  ticket: string;
  /** The commit the claim commit sits on. */
  base: string;
  task(n: number): string;
}
const boxes: string[] = [];
afterEach(() => {
  spawned.on = false;
  spawned.files = [];
  spawned.oldGit = false;
  for (const main of boxes.splice(0)) {
    const parent = dirname(main);
    for (const name of readdirSync(parent)) if (name.startsWith(basename(main) + '-')) cleanup(join(parent, name));
    cleanup(main);
  }
});

/**
 * A main checkout on main and the ticket's worktree `<main>-t-1` on t/T-1 holding its `claim: T-1` commit, made with config pinned `claimPin`; when that is not
 * the running version, a later commit pins it, as an upgrade would. `config` replaces CONFIG (its pin is set the same way).
 */
function sandbox(o: { claimPin?: string; config?: string; files?: Record<string, string>; space?: boolean } = {}): Box {
  const made = realpathSync.native(mkdtempSync(join(tmpdir(), o.space === true ? 'accord tt-' : 'accord-tt-')));
  gitRun(made, 'init', '-q', '-b', 'main');
  for (const [k, v] of IDENTITY) gitRun(made, 'config', k, v);
  const main = gitRun(made, 'rev-parse', '--show-toplevel').trim();
  boxes.push(main);
  const head = o.config ?? CONFIG;
  const claimConfig = o.claimPin === undefined ? head : head.replace(/accord: "[^"]*"/, `accord: "${o.claimPin}"`);
  writeFiles(main, {
    'accord/config.yml': claimConfig,
    '.gitignore': 'reports/\n',
    'accord/tickets/T-1.md': laneTicket('T-1'),
    'accord/tickets/T-1/plan.md': PLAN,
    'src/a.ts': 'a\n',
    'src/b.ts': 'b\n',
    'src/c.ts': 'c\n',
    'src/d.ts': 'd\n',
    ...o.files,
  });
  const base = commitMsg(main, 'base');
  const ticket = `${main}-t-1`;
  gitRun(main, 'worktree', 'add', '-q', '-b', 't/T-1', ticket, 'main');
  commitMsg(ticket, 'claim: T-1', undefined, true);
  if (claimConfig !== head) {
    writeFiles(ticket, { 'accord/config.yml': head });
    commitMsg(ticket, 'T-1 work');
  }
  return { main, ticket, base, task: (n) => `${main}-t-1+t${n}` };
}

const has = (dir: string, ref: string): boolean => {
  try {
    gitRun(dir, 'rev-parse', '--verify', '-q', ref);
    return true;
  } catch {
    return false;
  }
};
const head = (dir: string): string => gitRun(dir, 'rev-parse', 'HEAD').trim();
/** The ticket branch's first-parent history, newest first: subject and parent count of each commit. */
const history = (dir: string, n: number): { subject: string; parents: number }[] =>
  gitRun(dir, '-c', 'log.showSignature=false', 'log', '--no-show-signature', '--first-parent', '--format=%s%x09%P', '-' + n)
    .trim()
    .split('\n')
    .map((l) => {
      const [subject, parents] = l.split('\t');
      return { subject, parents: parents.split(' ').length };
    });
const change = (dir: string, file: string, text: string, subject: string): string => {
  writeFiles(dir, { [file]: text });
  return commitMsg(dir, subject);
};
/** Remove one loose object: a commit lost from the history, so `git log` cannot walk to it (cutoff-pin.test.ts). */
const dropObject = (repo: string, sha: string): void => {
  const file = join(repo, '.git', 'objects', sha.slice(0, 2), sha.slice(2));
  chmodSync(file, 0o666);
  rmSync(file, { force: true });
};

const open = (b: Box, n: number) => run(['worktree', 'task', 'open', 'T-1', String(n)], b.ticket);
const merge = (b: Box, n: number) => run(['worktree', 'task', 'merge', 'T-1', String(n)], b.ticket);
const clean = (b: Box, n: number) => run(['worktree', 'task', 'clean', 'T-1', String(n)], b.ticket);

it('risk:concurrency a task worktree is opened from the ticket branch, merged in task order and removed (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  const start = head(b.ticket);
  for (const n of [2, 3]) {
    const r = await open(b, n);
    expect(r.err).toBe('');
    expect(r.code).toBe(0);
    expect(r.out).toBe(`path: ${b.task(n)}\nbranch: accord-task/T-1/${n}\n`);
    expect(b.task(n).endsWith(`-t-1+t${n}`)).toBe(true);
    expect(r.out).not.toContain('\\');
    expect(head(b.task(n))).toBe(start);
    // run again: the same lines, nothing new
    const again = await open(b, n);
    expect(again.code).toBe(0);
    expect(again.out).toBe(r.out);
  }
  const c2 = change(b.task(2), 'src/b.ts', 'task 2\n', 'task 2');
  change(b.task(3), 'src/c.ts', 'task 3\n', 'task 3');

  const brief = await run(['brief', 'T-1', '2'], b.ticket);
  expect(brief.err).toBe('');
  expect(brief.code).toBe(0);
  expect(WORK_DIR_RULE).toContain('never merge, rebase or push');
  expect(brief.out).toContain(`Work dir: ${b.task(2)}\n${WORK_DIR_RULE}\nReport file: ${b.task(2)}/.accord-reports/T-1/task-2.md\n${REPORT_CONTRACT}`);
  writeReport(b.task(2), 'T-1', 2);
  expect(gitRun(b.task(2), 'status', '--porcelain')).toBe('');
  writeReport(b.task(3), 'T-1', 3);

  for (const n of [2, 3]) {
    const m = await merge(b, n);
    expect(m.err).toBe('');
    expect(m.code).toBe(0);
    expect(m.out).toMatch(new RegExp(`^merged: task ${n} at [0-9a-f]{12}\\n$`));
    expect(head(b.ticket).startsWith(m.out.trim().slice(-12))).toBe(true);
  }
  const h = history(b.ticket, 3);
  expect(h.map((c) => c.subject)).toEqual(['task 3', 'task 2', 'claim: T-1']);
  expect(h.every((c) => c.parents === 1)).toBe(true);
  expect(gitRun(b.ticket, 'rev-parse', 'HEAD~1').trim()).toBe(c2);

  for (const n of [2, 3]) {
    const c = await clean(b, n);
    expect(c.err).toBe('');
    expect(c.code).toBe(0);
    expect(c.out).toBe(`removed: ${b.task(n)}\n`);
    expect(existsSync(b.task(n))).toBe(false);
    expect(has(b.ticket, `refs/heads/accord-task/T-1/${n}`)).toBe(false);
  }
  expect(gitRun(b.ticket, 'worktree', 'list', '--porcelain')).not.toContain('accord-task/');
}, 120_000);

it('risk:data-loss clean refuses a task branch the ticket branch does not hold (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  expect((await open(b, 2)).code).toBe(0);
  const work = change(b.task(2), 'src/b.ts', 'task 2\n', 'task 2');
  const r = await clean(b, 2);
  expect(r.code).toBe(1);
  expect(r.out).toContain("task 2's branch holds commits the ticket branch lacks: run accord worktree task merge T-1 2 first");
  expect(existsSync(b.task(2))).toBe(true);
  expect(gitRun(b.ticket, 'rev-parse', 'refs/heads/accord-task/T-1/2').trim()).toBe(work);
  expect(readFileSync(join(b.task(2), 'src', 'b.ts'), 'utf8')).toBe('task 2\n');
}, 120_000);

it('risk:regression a ticket claimed before 0.6.0 gets no task worktree and no Work dir line, and a failed claim read gets both (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox({ claimPin: '0.5.1' });
  const refused = await open(b, 2);
  expect(refused.code).toBe(2);
  expect(refused.err).toContain('claimed before 0.6.0');
  expect(refused.out).toBe('');
  expect(existsSync(b.task(2))).toBe(false);
  expect(has(b.ticket, 'refs/heads/accord-task/T-1/2')).toBe(false);
  const brief = await run(['brief', 'T-1', '2'], b.ticket);
  expect(brief.code).toBe(0);
  expect(brief.out).not.toContain('Work dir:');
  expect(brief.out).not.toContain(WORK_DIR_RULE);
  expect(brief.out).not.toContain('Report file:');

  // the claim commit's parent lost: git cannot read the claim pin, so the new behaviour applies (fail closed)
  dropObject(b.main, b.base);
  const closed = await run(['brief', 'T-1', '2'], b.ticket);
  expect(closed.code).toBe(0);
  expect(closed.out).toContain(`Work dir: ${b.ticket}\n${WORK_DIR_RULE}\n`);
  const opened = await open(b, 2);
  expect(opened.err).toBe('');
  expect(opened.code).toBe(0);
  expect(opened.out.startsWith(`path: ${b.task(2)}\n`)).toBe(true);
}, 120_000);

it('risk:complex-branching a merge conflict only in generated files is told apart from one in a hand-written file (ST-LN-92 92-ac-4)', async () => {
  const b = sandbox({ config: CONFIG + 'generated:\n  - gen/\n', files: { 'gen/out.txt': 'gen\n', 'src/x.ts': 'x\n' } });
  for (const n of [1, 2, 3, 4]) expect((await open(b, n)).code).toBe(0);
  change(b.task(2), 'gen/out.txt', 'two\n', 'task 2');
  change(b.task(3), 'gen/out.txt', 'three\n', 'task 3');
  change(b.task(4), 'src/x.ts', 'four\n', 'task 4');
  writeFiles(b.task(1), { 'gen/out.txt': 'one\n' });
  change(b.task(1), 'src/x.ts', 'one\n', 'task 1');
  // the ticket branch changes the hand-written file after the task worktrees were cut, as an earlier task's merge would
  change(b.ticket, 'src/x.ts', 'ticket\n', 'ticket change');
  expect((await merge(b, 2)).code).toBe(0);

  // generated only; the CLI runs git and nothing else (the regenerate command is the build skill's, CONTEXT Ruling)
  spawned.files = [];
  spawned.on = true;
  const gen = await merge(b, 3);
  spawned.on = false;
  expect(gen.err).toBe('');
  expect(gen.code).toBe(1);
  expect(gen.out).toBe(`conflict: task 3 in ${b.task(3)}\ngenerated: gen/out.txt\n`);
  expect(spawned.files.length).toBeGreaterThan(0);
  expect([...new Set(spawned.files)]).toEqual(['git']);
  // still stopped: run again before the path is resolved, the same lines
  expect((await merge(b, 3)).out).toBe(gen.out);
  // resolved and added in the task worktree: run again, the rebase continues and the ticket branch moves on
  writeFiles(b.task(3), { 'gen/out.txt': 'two and three\n' });
  gitRun(b.task(3), 'add', 'gen/out.txt');
  const continued = await merge(b, 3);
  expect(continued.err).toBe('');
  expect(continued.code).toBe(0);
  expect(continued.out).toMatch(/^merged: task 3 at [0-9a-f]{12}\n$/);
  expect(gitRun(b.ticket, 'show', 'HEAD:gen/out.txt')).toBe('two and three\n');
  expect(history(b.ticket, 3).map((c) => c.subject)).toEqual(['task 3', 'task 2', 'ticket change']);

  // a hand-written file
  const hand = await merge(b, 4);
  expect(hand.code).toBe(1);
  expect(hand.out).toBe(`conflict: task 4 in ${b.task(4)}\nhand-written: src/x.ts\n`);
  // both
  const both = await merge(b, 1);
  expect(both.code).toBe(1);
  expect(both.out).toBe(`conflict: task 1 in ${b.task(1)}\ngenerated: gen/out.txt\nhand-written: src/x.ts\n`);
  // a stopped rebase is never cleaned away
  expect((await clean(b, 4)).code).toBe(1);
  expect(existsSync(b.task(4))).toBe(true);
  // task 4 is resolved and merged while task 1's rebase waits: task 1 continues, then is rebased onto the moved tip, where src/x.ts conflicts again
  writeFiles(b.task(4), { 'src/x.ts': 'ticket and four\n' });
  gitRun(b.task(4), 'add', 'src/x.ts');
  expect((await merge(b, 4)).code).toBe(0);
  writeFiles(b.task(1), { 'gen/out.txt': 'all\n', 'src/x.ts': 'ticket and one\n' });
  gitRun(b.task(1), 'add', 'gen/out.txt', 'src/x.ts');
  const moved = await merge(b, 1);
  expect(moved.code).toBe(1);
  expect(moved.out).toBe(`conflict: task 1 in ${b.task(1)}\nhand-written: src/x.ts\n`);
  writeFiles(b.task(1), { 'src/x.ts': 'ticket, four and one\n' });
  gitRun(b.task(1), 'add', 'src/x.ts');
  const last = await merge(b, 1);
  expect(last.err).toBe('');
  expect(last.code).toBe(0);
  expect(history(b.ticket, 5).map((c) => c.subject)).toEqual(['task 1', 'task 4', 'task 3', 'task 2', 'ticket change']);
  expect(history(b.ticket, 5).every((c) => c.parents === 1)).toBe(true);
  expect(gitRun(b.ticket, 'show', 'HEAD:src/x.ts')).toBe('ticket, four and one\n');
  expect(gitRun(b.ticket, 'show', 'HEAD:gen/out.txt')).toBe('all\n');
}, 180_000);

it('risk:regression accord waves names the live task worktrees (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  const before = await run(['waves', 'T-1'], b.ticket);
  expect(before.out).toBe('Parallel: 3\nWave 1: 1, 2, 3, 4\n');
  expect((await open(b, 2)).code).toBe(0);
  const r = await run(['waves', 'T-1'], b.ticket);
  expect(r.err).toBe('');
  expect(r.code).toBe(0);
  expect(r.out).toBe(`Parallel: 3\nWave 1: 1, 2, 3, 4\nTask 2 worktree: ${b.task(2)}\n`);
}, 120_000);

it('risk:regression each task worktree keeps its own tests.report and executor report, and task-done reads each from the right checkout after the merge (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  const ledger = join(b.ticket, 'accord', 'tickets', 'T-1', 'ledger.md');
  for (const n of [2, 3]) expect((await open(b, n)).code).toBe(0);
  change(b.task(2), 'src/b.ts', 'task 2\n', 'task 2');
  change(b.task(3), 'src/c.ts', 'task 3\n', 'task 3');
  // each executor runs its tests in its own folder: one relative path, two files
  writeFiles(b.task(2), { [REPORT]: junit({ 'export#writes-csv': 'passed' }) });
  writeFiles(b.task(3), { [REPORT]: junit({ 'export#escapes-commas': 'passed' }) });
  writeReport(b.task(2), 'T-1', 2);
  writeReport(b.task(3), 'T-1', 3);
  expect(readFileSync(join(b.task(2), REPORT), 'utf8')).not.toBe(readFileSync(join(b.task(3), REPORT), 'utf8'));
  expect(readFileSync(join(b.task(2), '.accord-reports', 'T-1', 'task-2.md'), 'utf8')).not.toBe(readFileSync(join(b.task(3), '.accord-reports', 'T-1', 'task-3.md'), 'utf8'));
  expect(existsSync(join(b.ticket, REPORT))).toBe(false);
  expect(existsSync(join(b.ticket, '.accord-reports'))).toBe(false);

  expect((await merge(b, 2)).code).toBe(0);
  // a task folder's JUnit report is never read: the ticket checkout has none yet
  const none = await run(['task-done', 'T-1', '2'], b.ticket);
  expect(none.code).toBe(1);
  expect(existsSync(ledger)).toBe(false);
  // the build skill re-runs the task's tests in the ticket checkout after the merge
  const later = new Date(Date.now() + 5000);
  writeFiles(b.ticket, { [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }) });
  utimesSync(join(b.ticket, REPORT), later, later);
  const two = await run(['task-done', 'T-1', '2'], b.ticket);
  expect(two.out).toMatch(/^recorded task 2 done at /);
  expect(two.code).toBe(0);

  const moved = await merge(b, 3);
  expect(moved.code).toBe(0);
  expect(gitRun(b.ticket, 'rev-parse', 'HEAD~1').trim()).toBe(gitRun(b.ticket, 'rev-parse', 'refs/heads/accord-task/T-1/2').trim());
  // the report from before the rebase that moved task 3 is stale against the merged HEAD
  const earlier = new Date(Date.now() - 120_000);
  utimesSync(join(b.ticket, REPORT), earlier, earlier);
  const stale = await run(['task-done', 'T-1', '3'], b.ticket);
  expect(stale.code).toBe(1);
  expect(stale.out).toContain(`${REPORT} was written before the last commit`);
  // the merge above can outlast the first margin on a slow runner (Windows CI), so this report gets a fresh one
  const afterMerge = new Date(Date.now() + 5000);
  utimesSync(join(b.ticket, REPORT), afterMerge, afterMerge);
  const three = await run(['task-done', 'T-1', '3'], b.ticket);
  expect(three.out).toMatch(/^recorded task 3 done at /);
  expect(three.code).toBe(0);
  expect(readFileSync(ledger, 'utf8')).toMatch(/- task 2 done [0-9a-f]{12}\n- task 3 done [0-9a-f]{12}\n/);
}, 180_000);

it('risk:data-loss a task stopped after committing in its task worktree is merged, cleaned and re-briefed into the ticket worktree with its commits kept (ST-LN-92 92-ac-3)', async () => {
  const b = sandbox();
  for (const n of [2, 3, 4]) expect((await open(b, n)).code).toBe(0);
  // task 2's executor committed, then its tool refused a write; task 3 finished; task 4 committed nothing
  const work = change(b.task(2), 'src/b.ts', 'task 2\n', 'task 2');
  change(b.task(3), 'src/c.ts', 'task 3\n', 'task 3');
  const stopped = await clean(b, 2);
  expect(stopped.code).toBe(1);
  expect(existsSync(b.task(2))).toBe(true);
  expect((await run(['brief', 'T-1', '2'], b.ticket)).out).toContain(`Work dir: ${b.task(2)}\n`);

  expect((await merge(b, 3)).code).toBe(0);
  expect((await clean(b, 3)).code).toBe(0);
  const m = await merge(b, 2);
  expect(m.err).toBe('');
  expect(m.code).toBe(0);
  expect(m.out).toMatch(/^merged: task 2 at [0-9a-f]{12}\n$/);
  const h = history(b.ticket, 3);
  expect(h.map((c) => c.subject)).toEqual(['task 2', 'task 3', 'claim: T-1']);
  expect(h.every((c) => c.parents === 1)).toBe(true);
  // the same change as the commit the executor made
  expect(gitRun(b.ticket, 'diff', 'HEAD~1', 'HEAD', '--', 'src/b.ts')).toBe(gitRun(b.ticket, 'diff', work + '~1', work, '--', 'src/b.ts'));
  const c = await clean(b, 2);
  expect(c.code).toBe(0);
  expect(c.out).toBe(`removed: ${b.task(2)}\n`);
  expect(existsSync(b.task(2))).toBe(false);
  expect(has(b.ticket, 'refs/heads/accord-task/T-1/2')).toBe(false);
  const brief = await run(['brief', 'T-1', '2'], b.ticket);
  expect(brief.code).toBe(0);
  expect(brief.out).toContain(`Work dir: ${b.ticket}\n${WORK_DIR_RULE}\nReport file: ${b.ticket}/.accord-reports/T-1/task-2.md\n`);

  // no commit of its own: merge leaves the ticket branch where it was, and clean removes it
  const tip = head(b.ticket);
  const four = await merge(b, 4);
  expect(four.code).toBe(0);
  expect(head(b.ticket)).toBe(tip);
  const gone = await clean(b, 4);
  expect(gone.code).toBe(0);
  expect(gone.out).toBe(`removed: ${b.task(4)}\n`);
  expect(has(b.ticket, 'refs/heads/accord-task/T-1/4')).toBe(false);
}, 180_000);

// Review round 1 (PR #198) findings 1 and 10: one worktree-list reader, with no `-z` (git 2.36+), so brief and task-done work on an older git; a folder with a space reads whole.
it('risk:regression the task commands, brief and waves read git worktree list without -z, in a folder with a space (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox({ space: true });
  expect(b.main).toContain(' ');
  spawned.oldGit = true;
  const opened = await open(b, 2);
  expect(opened.err).toBe('');
  expect(opened.code).toBe(0);
  change(b.task(2), 'src/b.ts', 'task 2\n', 'task 2');
  const brief = await run(['brief', 'T-1', '2'], b.ticket);
  expect(brief.err).toBe('');
  expect(brief.code).toBe(0);
  expect(brief.out).toContain(`Work dir: ${b.task(2)}\n`);
  expect((await run(['waves', 'T-1'], b.ticket)).out).toContain(`Task 2 worktree: ${b.task(2)}\n`);
  const m = await merge(b, 2);
  expect(m.err).toBe('');
  expect(m.code).toBe(0);
  const c = await clean(b, 2);
  expect(c.code).toBe(0);
  expect(c.out).toBe(`removed: ${b.task(2)}\n`);
}, 120_000);

// Review round 1 finding 2: a task worktree is its folder on accord-task/<id>/<n>, or detached only while a rebase of that branch is stopped there.
it('risk:data-loss a task worktree on a detached HEAD with no rebase of its branch stopped is neither merged nor cleaned (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  expect((await open(b, 2)).code).toBe(0);
  const start = head(b.ticket);
  gitRun(b.task(2), 'checkout', '-q', '--detach');
  const work = change(b.task(2), 'src/b.ts', 'task 2\n', 'task 2');
  const m = await merge(b, 2);
  expect(m.code).toBe(1);
  expect(m.out).toContain('detached HEAD');
  expect(m.out).toContain('accord-task/T-1/2');
  expect(m.out).not.toMatch(/^merged:/m);
  expect(head(b.ticket)).toBe(start);
  const c = await clean(b, 2);
  expect(c.code).toBe(1);
  expect(c.out).toContain('detached HEAD');
  expect(c.out).not.toContain('removed:');
  expect(existsSync(b.task(2))).toBe(true);
  expect(head(b.task(2))).toBe(work);
  expect(has(b.ticket, 'refs/heads/accord-task/T-1/2')).toBe(true);
}, 120_000);

// Review round 1 finding 4: the executor switched its task folder to another branch; clean and merge name it and change nothing.
it('risk:data-loss a task folder switched to another branch is neither merged nor cleaned, and nothing prints removed (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  expect((await open(b, 2)).code).toBe(0);
  const start = head(b.ticket);
  gitRun(b.task(2), 'switch', '-q', '-c', 'side');
  const work = change(b.task(2), 'src/b.ts', 'task 2\n', 'task 2');
  const c = await clean(b, 2);
  expect(c.code).toBe(1);
  expect(c.out).toContain(`${b.task(2)} is a worktree of side, not of accord-task/T-1/2`);
  expect(c.out).not.toContain('removed:');
  expect(existsSync(b.task(2))).toBe(true);
  expect(has(b.ticket, 'refs/heads/accord-task/T-1/2')).toBe(true);
  const m = await merge(b, 2);
  expect(m.code).toBe(1);
  expect(m.out).toContain(`${b.task(2)} is a worktree of side, not of accord-task/T-1/2`);
  expect(head(b.ticket)).toBe(start);
  expect(gitRun(b.task(2), 'rev-parse', 'refs/heads/side').trim()).toBe(work);
}, 120_000);

// Review round 1 finding 9 (defence in depth since round 2 finding 3 moved task folders to `+t<n>`): a ticket branch checked out at the task folder is never merged, cleaned or opened as the task's.
it("risk:data-loss another ticket's worktree at the task folder is never merged, cleaned or opened as the task's (ST-LN-92 92-ac-2)", async () => {
  const b = sandbox();
  gitRun(b.main, 'worktree', 'add', '-q', '-b', 't/T-1-T1', b.task(1), 'main');
  // a task branch left behind that the ticket branch holds: the old clean deleted it and printed the other ticket's folder as removed
  gitRun(b.ticket, 'branch', 'accord-task/T-1/1', 'HEAD');
  const start = head(b.ticket);
  const c = await clean(b, 1);
  expect(c.code).toBe(1);
  expect(c.out).toContain(`${b.task(1)} is a worktree of t/T-1-T1, not of accord-task/T-1/1`);
  expect(c.out).not.toContain('removed:');
  expect(has(b.ticket, 'refs/heads/accord-task/T-1/1')).toBe(true);
  const m = await merge(b, 1);
  expect(m.code).toBe(1);
  expect(m.out).toContain('t/T-1-T1');
  expect(head(b.ticket)).toBe(start);
  const o = await open(b, 1);
  expect(o.code).toBe(2);
  expect(o.err).toContain('t/T-1-T1');
  // that ticket's own rebase, stopped or not, detaches its HEAD: still not the task's
  gitRun(b.task(1), 'checkout', '-q', '--detach');
  expect((await clean(b, 1)).code).toBe(1);
  expect(existsSync(b.task(1))).toBe(true);
  expect(gitRun(b.task(1), 'rev-parse', 'refs/heads/t/T-1-T1').trim()).toBe(gitRun(b.main, 'rev-parse', 'main').trim());
}, 120_000);

// Review round 1 finding 5: a task recorded but not cleaned (a compaction between task-done and clean) is still named, so the build skill cleans it.
it('risk:regression accord waves names a recorded task whose worktree is still there (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  for (const n of [2, 3]) expect((await open(b, n)).code).toBe(0);
  writeFiles(b.ticket, { 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 2 done abc1234\n' });
  const r = await run(['waves', 'T-1'], b.ticket);
  expect(r.err).toBe('');
  expect(r.code).toBe(0);
  expect(r.out).toBe(`Parallel: 3\nWave 1: 1, 3, 4\nTask 2 worktree: ${b.task(2)} (recorded: clean it)\nTask 3 worktree: ${b.task(3)}\n`);
  writeFiles(b.ticket, { 'accord/tickets/T-1/ledger.md': '## Tasks\n' + [1, 2, 3, 4].map((n) => `- task ${n} done abc1234\n`).join('') });
  const all = await run(['waves', 'T-1'], b.ticket);
  expect(all.out).toBe(`Parallel: 3\nNo task left to build\nTask 2 worktree: ${b.task(2)} (recorded: clean it)\nTask 3 worktree: ${b.task(3)} (recorded: clean it)\n`);
}, 120_000);

// Review round 1 finding 8: the Work dir a brief names is a checkout of the ticket branch or of the task's own branch, never the main checkout or another task's folder.
it('risk:data-loss brief refuses to name a Work dir that is not on the ticket branch or the task branch (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  const onMain = await run(['brief', 'T-1', '2'], b.main);
  expect(onMain.code).toBe(2);
  expect(onMain.out).toBe('');
  expect(onMain.err).toContain(`run it in ${b.ticket}`);
  expect(existsSync(join(b.main, '.accord-reports'))).toBe(false);
  expect((await open(b, 3)).code).toBe(0);
  const other = await run(['brief', 'T-1', '2'], b.task(3));
  expect(other.code).toBe(2);
  expect(other.out).toBe('');
  expect(other.err).toContain(`run it in ${b.ticket}`);
  const own = await run(['brief', 'T-1', '3'], b.task(3));
  expect(own.err).toBe('');
  expect(own.code).toBe(0);
  expect(own.out).toContain(`Work dir: ${b.task(3)}\n`);
  const here = await run(['brief', 'T-1', '2'], b.ticket);
  expect(here.code).toBe(0);
  expect(here.out).toContain(`Work dir: ${b.ticket}\n`);
}, 120_000);

// Review round 2 finding 7: a ticket branch that exists only on origin still exists: brief in the main checkout refuses.
it('risk:data-loss brief refuses the main checkout when the ticket branch exists only on origin (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  const tip = head(b.ticket);
  gitRun(b.main, 'worktree', 'remove', '--force', b.ticket);
  gitRun(b.main, 'update-ref', 'refs/remotes/origin/t/T-1', tip);
  gitRun(b.main, 'branch', '-q', '-D', 't/T-1');
  const r = await run(['brief', 'T-1', '2'], b.main);
  expect(r.code).toBe(2);
  expect(r.out).toBe('');
  expect(r.err).toContain('no worktree holds that branch - open it with accord worktree open T-1');
  expect(existsSync(join(b.main, '.accord-reports'))).toBe(false);
}, 120_000);

// Review round 1 finding 7: build.regenerate is repository text like git.sync; the merge prints it to run only once accord trust allowed it, bound to the task folder's files.
it('risk:security a generated-only conflict prints the regenerate command only when accord trust allowed it (ST-LN-92 92-ac-4)', async () => {
  const b = sandbox({
    config: CONFIG + 'generated:\n  - gen/\nbuild:\n  regenerate: node scripts/regen.mjs\n',
    files: { 'gen/out.txt': 'gen\n', 'scripts/regen.mjs': '// regen\n', 'src/x.ts': 'x\n' },
  });
  for (const n of [2, 3, 4]) expect((await open(b, n)).code).toBe(0);
  change(b.task(2), 'gen/out.txt', 'two\n', 'task 2');
  change(b.task(3), 'gen/out.txt', 'three\n', 'task 3');
  change(b.task(4), 'src/x.ts', 'four\n', 'task 4');
  change(b.ticket, 'src/x.ts', 'ticket\n', 'ticket change');
  expect((await merge(b, 2)).code).toBe(0);

  const refused = await merge(b, 3);
  expect(refused.code).toBe(1);
  expect(refused.out.startsWith(`conflict: task 3 in ${b.task(3)}\ngenerated: gen/out.txt\nregenerate refused: build.regenerate "node scripts/regen.mjs" has not been allowed`)).toBe(true);
  expect(refused.out).toContain('accord trust');
  expect(refused.out).not.toMatch(/^regenerate: /m);

  const shown = await run(['trust'], b.ticket);
  expect(shown.code).toBe(0);
  const digest = /build\.regenerate@([0-9a-f]{16})/.exec(shown.out)?.[1];
  expect(digest).toBeDefined();
  const allowed = await run(['trust', `build.regenerate@${digest}`], b.ticket);
  expect(allowed.err).toBe('');
  expect(allowed.code).toBe(0);
  const printed = await merge(b, 3);
  expect(printed.code).toBe(1);
  expect(printed.out).toBe(`conflict: task 3 in ${b.task(3)}\ngenerated: gen/out.txt\nregenerate: node scripts/regen.mjs\n`);

  // round 2 finding 5: the binding is read in the ticket checkout, where the owner allowed it; the script changed there is not the allowed content, so refused again
  change(b.ticket, 'scripts/regen.mjs', '// changed\n', 'regen changed');
  const changed = await merge(b, 3);
  expect(changed.out).toContain('regenerate refused: build.regenerate "node scripts/regen.mjs"');
  expect(changed.out).not.toMatch(/^regenerate: /m);
  // a hand-written conflict prints no regenerate line at all
  const hand = await merge(b, 4);
  expect(hand.out).toBe(`conflict: task 4 in ${b.task(4)}\nhand-written: src/x.ts\n`);
}, 180_000);

// Review round 2 findings 5 and 6: a root-level script covers every tracked file outside accord/, the conflicted ones included, so the binding is read in the clean ticket
// checkout, not in the task folder mid-rebase; and its allow lives where an older accord (0.5.1), which drops a kind it does not know when it rewrites its record, never writes.
it('risk:security a root-level regenerate script allowed in the ticket checkout is printed mid-rebase, and an older accord rewriting its record keeps the allow (ST-LN-92 92-ac-4)', async () => {
  const b = sandbox({
    config: CONFIG + 'generated:\n  - gen/\nbuild:\n  regenerate: node regen.mjs\n',
    files: { 'gen/out.txt': 'gen\n', 'regen.mjs': '// regen\n' },
  });
  for (const n of [2, 3]) expect((await open(b, n)).code).toBe(0);
  change(b.task(2), 'gen/out.txt', 'two\n', 'task 2');
  change(b.task(3), 'gen/out.txt', 'three\n', 'task 3');
  expect((await merge(b, 2)).code).toBe(0);
  const shown = await run(['trust'], b.ticket);
  expect(shown.out).toContain('build.regenerate "node regen.mjs"');
  const digest = /build\.regenerate@([0-9a-f]{16})/.exec(shown.out)?.[1];
  expect((await run(['trust', `build.regenerate@${digest}`], b.ticket)).code).toBe(0);
  const printed = await merge(b, 3);
  expect(printed.code).toBe(1);
  expect(printed.out).toBe(`conflict: task 3 in ${b.task(3)}\ngenerated: gen/out.txt\nregenerate: node regen.mjs\n`);

  // what 0.5.1 does to accord-trust.json: on its next allow or revoke it writes back only the kinds it knows, and its revoke-all removes the file
  const common = join(b.main, '.git');
  const record = join(common, 'accord-trust.json');
  if (existsSync(record)) {
    const text = JSON.parse(readFileSync(record, 'utf8')) as { version: number; allows: { kind: string }[] };
    writeFiles(common, { 'accord-trust.json': JSON.stringify({ version: 2, allows: text.allows.filter((a) => a.kind === 'tracker.command' || a.kind === 'git.sync') }, null, 2) + '\n' });
  }
  expect((await merge(b, 3)).out).toBe(printed.out);
  rmSync(record, { force: true });
  expect((await merge(b, 3)).out).toBe(printed.out);
  // accord trust --revoke still withdraws it
  expect((await run(['trust', '--revoke'], b.ticket)).out).toContain('build.regenerate');
  expect((await merge(b, 3)).out).toContain('regenerate refused:');
}, 180_000);

// Review round 2 finding 4: the task branch checked out in a folder other than the task's: clean names that folder and deletes nothing.
it('risk:data-loss clean refuses while another worktree holds the task branch (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  gitRun(b.ticket, 'branch', 'accord-task/T-1/2', 'HEAD');
  const elsewhere = `${b.main}-elsewhere`;
  gitRun(b.main, 'worktree', 'add', '-q', elsewhere, 'accord-task/T-1/2');
  const c = await clean(b, 2);
  expect(c.code).toBe(1);
  expect(c.out).toContain(`accord-task/T-1/2 is checked out in ${elsewhere}`);
  expect(c.out).not.toMatch(/^(removed|deleted):/m);
  expect(has(b.ticket, 'refs/heads/accord-task/T-1/2')).toBe(true);
  expect(existsSync(elsewhere)).toBe(true);
}, 120_000);

// Review round 2 finding 3: task folders are `<ticket folder>+t<n>`, a name no ticket id gives, so ticket T-1-T1's worktree `<main>-t-1-t1` and task 1 of T-1 never meet.
it("risk:data-loss task 1 of T-1 and ticket T-1-T1 get different folders (ST-LN-92 92-ac-2)", async () => {
  const b = sandbox();
  const other = `${b.main}-t-1-t1`;
  gitRun(b.main, 'worktree', 'add', '-q', '-b', 't/T-1-T1', other, 'main');
  const o = await open(b, 1);
  expect(o.err).toBe('');
  expect(o.code).toBe(0);
  expect(o.out).toBe(`path: ${b.main}-t-1+t1\nbranch: accord-task/T-1/1\n`);
  expect((await clean(b, 1)).out).toBe(`removed: ${b.main}-t-1+t1\n`);
  expect(existsSync(other)).toBe(true);
  expect(gitRun(other, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('t/T-1-T1');
}, 120_000);

// Review round 2 findings 2 and 9: a task folder holding work off its task branch, or one git cannot read, is named by accord waves for the owner, and nothing crashes.
it('risk:data-loss accord waves names a task folder off its task branch or unreadable, and brief and waves never crash on it (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  for (const n of [2, 3, 4]) expect((await open(b, n)).code).toBe(0);
  gitRun(b.task(2), 'switch', '-q', '-c', 'side');
  gitRun(b.task(3), 'checkout', '-q', '--detach');
  const sha = head(b.task(3)).slice(0, 12);
  gitRun(b.task(4), 'checkout', '-q', '--detach');
  chmodSync(join(b.task(4), '.git'), 0o666);
  rmSync(join(b.task(4), '.git'), { force: true });
  writeFiles(b.task(4), { '.git': 'gitdir: ' + join(b.main, 'nowhere') + '\n' });
  const r = await run(['waves', 'T-1'], b.ticket);
  expect(r.err).toBe('');
  expect(r.code).toBe(0);
  const lines = r.out.split('\n');
  expect(lines).toContain(`Task 2 worktree: ${b.task(2)} (side): not on its task branch — owner`);
  expect(lines).toContain(`Task 3 worktree: ${b.task(3)} (detached ${sha}): not on its task branch — owner`);
  expect(lines.find((l) => l.startsWith(`Task 4 worktree: ${b.task(4)} (unreadable: `))).toMatch(/\): not on its task branch — owner$/);
  // round 3 finding 4: brief and task-done refuse such a task (exit 2, the folder and its state named) instead of falling back to the ticket checkout
  const brief = await run(['brief', 'T-1', '4'], b.ticket);
  expect(brief.code).toBe(2);
  expect(brief.out).toBe('');
  expect(brief.err).toContain(`${b.task(4)} cannot be read by git`);
  for (const argv of [['brief', 'T-1', '2'], ['task-done', 'T-1', '2']]) {
    const r2 = await run(argv, b.ticket);
    expect(r2.code, argv.join(' ')).toBe(2);
    expect(r2.err, argv.join(' ')).toContain(`${b.task(2)} is a worktree of side, not of accord-task/T-1/2`);
    expect(r2.err, argv.join(' ')).toContain(`accord ${argv[0]} T-1 2`);
  }
  expect(existsSync(join(b.ticket, 'accord', 'tickets', 'T-1', 'ledger.md'))).toBe(false);
  expect(existsSync(join(b.ticket, '.accord-reports'))).toBe(false);
  // round 3 finding 9: a task folder whose number is not in the plan is named too
  const five = `${b.main}-t-1+t5`;
  gitRun(b.ticket, 'worktree', 'add', '-q', '-b', 'side5', five, 'HEAD');
  const six = `${b.main}-t-1+t6`;
  gitRun(b.ticket, 'worktree', 'add', '-q', '-b', 'accord-task/T-1/6', six, 'HEAD');
  const all = (await run(['waves', 'T-1'], b.ticket)).out.split('\n');
  expect(all).toContain(`Task 5 worktree: ${five} (side5) (not in the plan) — owner`);
  expect(all).toContain(`Task 6 worktree: ${six} (not in the plan) — owner`);
}, 120_000);

// Review round 3 finding 6: the help names the task folder as it is made.
it('risk:regression accord worktree task open --help names the <ticket folder>+t<n> folder (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  const h = await run(['worktree', 'task', 'open', '--help'], b.ticket);
  expect(h.out + h.err).toContain('<id>+t<n>');
  expect(h.out + h.err).not.toContain('-t<n>');
}, 60_000);

// Review round 3 finding 2: a task folder deleted by hand (git lists it as prunable) never blocks clean: the stale record is pruned, the branch deleted only when the
// ticket branch holds its tip, and each step printed.
it('risk:data-loss clean prunes a task folder deleted by hand and deletes its branch only when the ticket branch holds it (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  for (const n of [2, 3]) expect((await open(b, n)).code).toBe(0);
  const work = change(b.task(3), 'src/c.ts', 'task 3\n', 'task 3');
  for (const n of [2, 3]) cleanup(b.task(n));
  expect(gitRun(b.ticket, 'worktree', 'list', '--porcelain')).toContain('prunable');
  const c2 = await clean(b, 2);
  expect(c2.code).toBe(0);
  expect(c2.out).toContain(`pruned ${b.task(2)}`);
  expect(c2.out).toContain('deleted: branch accord-task/T-1/2');
  expect(c2.out).not.toContain('is checked out in');
  expect(has(b.ticket, 'refs/heads/accord-task/T-1/2')).toBe(false);
  const c3 = await clean(b, 3);
  expect(c3.code).toBe(1);
  expect(c3.out).toContain("task 3's branch holds commits the ticket branch lacks");
  expect(gitRun(b.ticket, 'rev-parse', 'refs/heads/accord-task/T-1/3').trim()).toBe(work);
  expect(gitRun(b.ticket, 'worktree', 'list', '--porcelain')).not.toContain('prunable');
}, 120_000);

// Review round 3 finding 1: the regenerate command runs in the task folder, so a task commit that changed a file its trust cover holds makes it refused, naming
// that file; only the conflicted paths are left out of the comparison.
it('risk:security a task that changed the allowed regenerate script gets regenerate refused, naming the file (ST-LN-92 92-ac-4)', async () => {
  const b = sandbox({
    config: CONFIG + 'generated:\n  - gen/\nbuild:\n  regenerate: node tools/regen.mjs\n',
    files: { 'gen/out.txt': 'gen\n', 'tools/regen.mjs': '// regen\n' },
  });
  for (const n of [2, 3]) expect((await open(b, n)).code).toBe(0);
  change(b.task(2), 'gen/out.txt', 'two\n', 'task 2');
  change(b.task(3), 'tools/regen.mjs', '// changed by task 3\n', 'task 3 script');
  change(b.task(3), 'gen/out.txt', 'three\n', 'task 3');
  expect((await merge(b, 2)).code).toBe(0);
  const shown = await run(['trust'], b.ticket);
  const digest = /build\.regenerate@([0-9a-f]{16})/.exec(shown.out)?.[1];
  expect((await run(['trust', `build.regenerate@${digest}`], b.ticket)).code).toBe(0);
  const m = await merge(b, 3);
  expect(m.code).toBe(1);
  expect(m.out.startsWith(`conflict: task 3 in ${b.task(3)}\ngenerated: gen/out.txt\nregenerate refused: `)).toBe(true);
  expect(m.out).toContain('tools/regen.mjs');
  expect(m.out).not.toMatch(/^regenerate: /m);
}, 180_000);
