// ST-LN-92 92-ac-2, 92-ac-3, 92-ac-4 (D-03, D-06, D-16): `accord worktree task open|merge|clean` give each task of a wave its own worktree, bring it into the ticket branch
// linearly (rebase, then fast-forward), tell a conflict in a generated file from one in a hand-written file, and remove a task worktree only once the ticket branch holds
// its commits; `accord brief` names the folder the executor works in and puts its report there. Real git in temporary sandboxes. The CLI runs as 0.6.0 (cutoff-pin.test.ts's
// reason): task worktrees are for a ticket claimed from 0.6.0, and CONFIG pins the running version, so 0.6.0 too.
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { REPORT_CONTRACT } from '@accord-dev/accord-core';
import { WORK_DIR_RULE } from '../src/commands/brief.js';
import { cleanup, commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket, writeReport } from '../../../test/helpers/lane.js';

// Every program the CLI starts, by name, while `spawned.on` is set: the conflict case asserts that only git ran.
const spawned = vi.hoisted(() => ({ on: false, files: [] as string[] }));
vi.mock('node:child_process', async (orig) => {
  const real = await orig<typeof import('node:child_process')>();
  const wrap = (name: string) => {
    const fn = (real as unknown as Record<string, (...a: unknown[]) => unknown>)[name];
    return function (this: unknown, file: unknown, ...rest: unknown[]) {
      if (spawned.on) spawned.files.push(String(file));
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
const PLAN = [...HEAD, task(1, 'src/a.ts', 1), task(2, 'src/b.ts', 1), task(3, 'src/c.ts', 2), task(4, 'src/d.ts', 2)].join('\n');
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
function sandbox(o: { claimPin?: string; config?: string; files?: Record<string, string> } = {}): Box {
  const made = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-tt-')));
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
  return { main, ticket, base, task: (n) => `${main}-t-1-t${n}` };
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

it('ac-2 a task worktree is opened from the ticket branch, merged in task order and removed (ST-LN-92 92-ac-2)', async () => {
  const b = sandbox();
  const start = head(b.ticket);
  for (const n of [2, 3]) {
    const r = await open(b, n);
    expect(r.err).toBe('');
    expect(r.code).toBe(0);
    expect(r.out).toBe(`path: ${b.task(n)}\nbranch: accord-task/T-1/${n}\n`);
    expect(b.task(n).endsWith(`-t-1-t${n}`)).toBe(true);
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
