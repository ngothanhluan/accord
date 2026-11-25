// Phase 15 D-07, D-08, D-31: a sliced ticket's later slices are built on stacked branches `slice/<id>/<n>`; `accord worktree slice <id> <n>` opens one at the tip of the branch before it, the
// CLI records it, every reader that maps a branch to its ticket still finds the ticket, and the dashboard, push, sync and clean follow the newest slice. Real git in temporary sandboxes.
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';

const IDENTITY = [
  ['user.email', 'fixture@example.invalid'],
  ['user.name', 'fixture'],
  ['commit.gpgsign', 'false'],
];

const task = (n: number, file: string, ac: number): string =>
  [`## Task ${n}: Step ${n}`, `covers: @ac-${ac}`, `files: ${file}`, `verify: ${ac === 1 ? 'export#writes-csv' : 'export#escapes-commas'} (@ac-${ac})`, 'after: none', `Change ${file}.`, ''].join('\n');
const SLICES = ['## Slice 1: Export', 'tasks: 1', 'covers: @ac-1', '', '## Slice 2: Escape', 'tasks: 2', 'covers: @ac-2', '', '## Slice 3: Docs', 'tasks: 3', 'covers: @ac-2', ''].join('\n');
const PLAN = ['---', 'baseline: abc1234', '---', '', '# Plan', '', task(1, 'src/a.ts', 1), task(2, 'src/b.ts', 2), task(3, 'src/c.ts', 2), SLICES].join('\n');

interface Box {
  /** The main checkout, on main. */
  main: string;
  /** The ticket's worktree `<main>-st-9`, on t/ST-9 holding its `claim: ST-9` commit and one commit of slice 1's work. */
  wt: string;
  /** The bare origin, holding main only. */
  remote: string;
  /** The tip of t/ST-9 when the sandbox was made. */
  tip: string;
}
const boxes: string[] = [];
afterEach(() => {
  for (const main of boxes.splice(0)) {
    const parent = dirname(main);
    for (const name of readdirSync(parent)) if (name.startsWith(basename(main) + '-')) cleanup(join(parent, name));
    cleanup(main);
  }
});

/** A main checkout with a bare origin, ticket ST-9 and its plan of three slices, and the ticket's worktree on t/ST-9; `plan` replaces the plan text. */
function sandbox(o: { plan?: string; files?: Record<string, string> } = {}): Box {
  const remote = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-sl-remote-')));
  gitRun(remote, 'init', '--bare', '-q', '-b', 'main');
  boxes.push(remote);
  const made = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-sl-')));
  gitRun(made, 'init', '-q', '-b', 'main');
  for (const [k, v] of IDENTITY) gitRun(made, 'config', k, v);
  const main = gitRun(made, 'rev-parse', '--show-toplevel').trim();
  boxes.push(main);
  writeFiles(main, {
    'accord/config.yml': CONFIG,
    '.gitignore': 'reports/\n',
    'accord/tickets/ST-9.md': laneTicket('ST-9'),
    'accord/tickets/ST-9/plan.md': o.plan ?? PLAN,
    'src/a.ts': 'a\n',
    ...o.files,
  });
  commitMsg(main, 'base');
  gitRun(main, 'remote', 'add', 'origin', remote);
  gitRun(main, 'push', '-q', '-u', 'origin', 'main');
  gitRun(main, 'remote', 'set-head', 'origin', 'main');
  const wt = `${main}-st-9`;
  gitRun(main, 'worktree', 'add', '-q', '-b', 't/ST-9', wt, 'main');
  commitMsg(wt, 'claim: ST-9', undefined, true);
  writeFiles(wt, { 'src/a.ts': 'a1\n' });
  const tip = commitMsg(wt, 'slice 1 work');
  return { main, wt, remote, tip };
}

const slices = (box: Box): string => {
  const file = join(box.main, '.git', 'accord', 'slices');
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};
const branchIn = (dir: string): string => gitRun(dir, 'branch', '--show-current').trim();
const exists = (dir: string, ref: string): boolean => {
  try {
    gitRun(dir, 'rev-parse', '--verify', '-q', ref);
    return true;
  } catch {
    return false;
  }
};

it('risk:regression slice 2 opens stacked on the claim branch, is recorded, and still names its ticket (D-31, D-07)', async () => {
  const box = sandbox();
  const r = await run(['worktree', 'slice', 'ST-9', '2'], box.wt);
  expect(r.err).toBe('');
  expect(r.code).toBe(0);
  expect(r.out).toBe('branch: slice/ST-9/2\nbase: t/ST-9\n');
  expect(branchIn(box.wt)).toBe('slice/ST-9/2');
  expect(gitRun(box.wt, 'rev-parse', 'slice/ST-9/2').trim()).toBe(box.tip);
  expect(slices(box)).toBe(`ST-9 2 ${box.tip}\n`);
  // D-31: the slice branch names its ticket for the readers that map a branch to a ticket
  const anchor = await run(['anchor'], box.wt);
  expect(anchor.out).toContain('# Anchor: ST-9 ');
  // a slice 3 is cut at slice 2's tip, from the slice 2 worktree, not from the claim branch
  writeFiles(box.wt, { 'src/b.ts': 'b\n' });
  const second = commitMsg(box.wt, 'slice 2 work');
  const third = await run(['worktree', 'slice', 'ST-9', '3'], box.wt);
  expect(third.out).toBe('branch: slice/ST-9/3\nbase: slice/ST-9/2\n');
  expect(gitRun(box.wt, 'rev-parse', 'slice/ST-9/3').trim()).toBe(second);
  expect(slices(box)).toBe(`ST-9 2 ${box.tip}\nST-9 3 ${second}\n`);
}, 120_000);

it('risk:regression running slice again prints the same two lines and changes nothing (D-31)', async () => {
  const box = sandbox();
  const first = await run(['worktree', 'slice', 'ST-9', '2'], box.wt);
  const before = [slices(box), gitRun(box.wt, 'rev-parse', 'HEAD').trim(), gitRun(box.wt, 'branch', '--list').trim()];
  const again = await run(['worktree', 'slice', 'ST-9', '2'], box.wt);
  expect(again.code).toBe(0);
  expect(again.out).toBe(first.out);
  expect([slices(box), gitRun(box.wt, 'rev-parse', 'HEAD').trim(), gitRun(box.wt, 'branch', '--list').trim()]).toEqual(before);
  // from the claim branch again (the worktree was moved back by hand), the existing slice branch is switched to, not cut a second time
  gitRun(box.wt, 'switch', '-q', 't/ST-9');
  const back = await run(['worktree', 'slice', 'ST-9', '2'], box.wt);
  expect(back.out).toBe(first.out);
  expect(branchIn(box.wt)).toBe('slice/ST-9/2');
  expect(slices(box)).toBe(before[0]);
}, 120_000);

it.each([
  ['1', 'slice 1 is the claim branch'],
  ['4', 'has 3 slices'],
  ['3', 'open it first with accord worktree slice ST-9 2'],
  ['02', 'not a slice number'],
  ['100', 'not a slice number'],
])('risk:regression slice %s is refused with exit 2 and nothing is created (D-31)', async (n, reason) => {
  const box = sandbox();
  const r = await run(['worktree', 'slice', 'ST-9', n], box.wt);
  expect(r.code).toBe(2);
  expect(r.err).toContain(reason);
  expect(branchIn(box.wt)).toBe('t/ST-9');
  expect(gitRun(box.wt, 'branch', '--list', 'slice/*').trim()).toBe('');
  expect(slices(box)).toBe('');
}, 120_000);

it('risk:data-loss slice is refused on a dirty working tree and creates nothing (D-31)', async () => {
  const box = sandbox();
  writeFiles(box.wt, { 'src/a.ts': 'edited, not committed\n' });
  const r = await run(['worktree', 'slice', 'ST-9', '2'], box.wt);
  expect(r.code).toBe(2);
  expect(r.err).toContain('uncommitted changes');
  expect(branchIn(box.wt)).toBe('t/ST-9');
  expect(gitRun(box.wt, 'branch', '--list', 'slice/*').trim()).toBe('');
  expect(readFileSync(join(box.wt, 'src', 'a.ts'), 'utf8').replace(/\r\n/g, '\n')).toBe('edited, not committed\n');
  expect(slices(box)).toBe('');
}, 120_000);

it('risk:security slice is refused for an invalid id, a ticket the plan does not slice and a checkout that is not the ticket\'s (T-15-31)', async () => {
  const box = sandbox({ plan: PLAN.replace(/## Slice[\s\S]*$/, '') });
  const bad = await run(['worktree', 'slice', 'ST-9;rm', '2'], box.wt);
  expect(bad.code).toBe(2);
  expect(bad.err).toContain('not a valid ticket id');
  const unsliced = await run(['worktree', 'slice', 'ST-9', '2'], box.wt);
  expect(unsliced.code).toBe(2);
  expect(unsliced.err).toContain('no ## Slice section');
  const elsewhere = await run(['worktree', 'slice', 'ST-9', '2'], box.main);
  expect(elsewhere.code).toBe(2);
  expect(gitRun(box.main, 'branch', '--list', 'slice/*').trim()).toBe('');
  expect(exists(box.main, 'refs/heads/slice/ST-9/2')).toBe(false);
}, 120_000);
