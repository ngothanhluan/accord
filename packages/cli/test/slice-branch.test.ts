// Phase 15 D-07, D-08, D-31: a sliced ticket's later slices are built on stacked branches `slice/<id>/<n>`; `accord worktree slice <id> <n>` opens one at the tip of the branch before it, the
// CLI records it, every reader that maps a branch to its ticket still finds the ticket, and the dashboard, push, sync and clean follow the newest slice. Real git in temporary sandboxes.
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { recordSlice } from '../src/load/slices.js';
import { CONFIG, discussFiles, laneTicket, PLAN as LANE_PLAN, ready } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, mergeMsg, run, writeFiles } from './helpers/repo.js';
import { claimWorktree, copy, doneOnRemote, has, lines, sha, useSandboxes, withAction } from './helpers/worktree.js';

// the clean cases use the shared sandboxes, whose helpers reset these two mocks after each test
vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs), cleanBudgetMs: vi.fn(real.cleanBudgetMs) };
});
useSandboxes([{}]);

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

// Phase 15 D-31, SC-2: the dashboard reads a sliced ticket from its newest slice branch. The sandboxes are the ones dashboard-merged.test.ts uses: main holds T-1 (ready, with its plan) and
// T-2 (ready, no plan), `origin/main` is faked at main's tip, and the viewer is the author of the claim.
type Json = Record<string, unknown>;
type Row = { id: string; stage?: string; tasksDone?: number };
const SECTIONS = ['mergedWaiting', 'yours', 'team', 'ready', 'upNext'] as const;
const dash = async (dir: string): Promise<Json> => {
  const r = await run(['dashboard', '--json', '--no-fetch'], dir);
  expect(r.code, r.err).toBe(0);
  return JSON.parse(r.out) as Json;
};
const rows = (d: Json, section: string): Row[] => (d[section] as { rows?: Row[] } | undefined)?.rows ?? [];
const ids = (d: Json, section: string): string[] => rows(d, section).map((r) => r.id);
const rowOf = (d: Json, id: string): Row | undefined => SECTIONS.flatMap((s) => rows(d, s)).find((r) => r.id === id);

function dashBase(): string {
  const repo = makeEmptyRepo();
  boxes.push(repo);
  gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  gitRun(repo, 'config', 'user.email', 'v@x.io');
  gitRun(repo, 'config', 'user.name', 'viewer');
  const files: Files = { 'accord/config.yml': CONFIG, ...discussFiles('T-1', 'T-2') };
  ready(files, 'T-1');
  files['accord/tickets/T-1/plan.md'] = LANE_PLAN;
  ready(files, 'T-2');
  writeFiles(repo, files);
  commitMsg(repo, 'add tickets');
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return repo;
}

/** The claim branch t/T-1 with its first task done, then slice/T-1/2 on it with the second task done too; the checkout ends on main. */
function slicedTicket(repo: string): void {
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  writeFiles(repo, { 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n' });
  commitMsg(repo, 'build: T-1 task 1');
  gitRun(repo, 'switch', '-q', '-c', 'slice/T-1/2');
  writeFiles(repo, { 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n' });
  commitMsg(repo, 'build: T-1 task 2');
  gitRun(repo, 'switch', '-q', 'main');
}

it('risk:regression the dashboard shows a sliced ticket from its newest slice branch, never as a claim of its own (D-31, SC-2)', async () => {
  const repo = dashBase();
  slicedTicket(repo);
  const d = await dash(repo);
  expect(ids(d, 'yours')).toEqual(['T-1']);
  expect(rowOf(d, 'T-1')).toMatchObject({ tasksDone: 2 });
  expect(ids(d, 'ready')).toEqual(['T-2']);
  // the claim branch alone would read one task: the slice branch is what is newer
  gitRun(repo, 'branch', '-D', 'slice/T-1/2');
  expect(rowOf(await dash(repo), 'T-1')).toMatchObject({ tasksDone: 1 });
}, 120_000);

it('risk:complex-branching a ticket whose claim branch merged while slice 2 is unmerged stays in yours, not in mergedWaiting (D-31, D-29)', async () => {
  const repo = dashBase();
  slicedTicket(repo);
  mergeMsg(repo, 't/T-1', 'Merge pull request #1 from t/T-1');
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  const d = await dash(repo);
  expect(ids(d, 'mergedWaiting')).toEqual([]);
  expect(ids(d, 'yours')).toEqual(['T-1']);
  expect(rowOf(d, 'T-1')).toMatchObject({ tasksDone: 2 });
  // once the last slice merges too, the ticket waits for verify
  mergeMsg(repo, 'slice/T-1/2', 'Merge pull request #2 from slice/T-1/2');
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  const after = await dash(repo);
  expect(ids(after, 'mergedWaiting')).toEqual(['T-1']);
  expect(ids(after, 'yours')).toEqual([]);
}, 120_000);

it('risk:complex-branching a claim branch that merged while the plan has tasks nobody built (slice 2 not cut yet) stays in yours, not in mergedWaiting (A-WR-01, C-WR-01)', async () => {
  const repo = dashBase();
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  writeFiles(repo, { 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n' });
  commitMsg(repo, 'build: T-1 task 1');
  gitRun(repo, 'switch', '-q', 'main');
  mergeMsg(repo, 't/T-1', 'Merge pull request #1 from t/T-1');
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  const d = await dash(repo);
  expect(ids(d, 'mergedWaiting')).toEqual([]);
  expect(ids(d, 'yours')).toEqual(['T-1']);
  expect(rowOf(d, 'T-1')).toMatchObject({ tasksDone: 1 });
  expect(['review', 'verify']).not.toContain(rowOf(d, 'T-1')?.stage);
}, 120_000);

it('risk:security a slice branch of an id that is no ticket, or of a ticket nobody claimed, is ignored by the dashboard (D-31, T-15-33)', async () => {
  const repo = dashBase();
  gitRun(repo, 'branch', 'slice/X-1/2', 'main');
  gitRun(repo, 'branch', 'slice/T-2/2', 'main');
  gitRun(repo, 'update-ref', 'refs/remotes/origin/slice/T-2/3', 'main');
  const d = await dash(repo);
  expect(rowOf(d, 'X-1')).toBeUndefined();
  expect(ids(d, 'ready').sort()).toEqual(['T-1', 'T-2']);
  for (const section of ['yours', 'team', 'mergedWaiting']) expect(ids(d, section), section).toEqual([]);
}, 120_000);

const REF = 'progress:\n  push: ref\n';
const originRef = (box: Box, ref: string): string | undefined => {
  try {
    return gitRun(box.remote, 'rev-parse', '--verify', '-q', ref).trim();
  } catch {
    return undefined;
  }
};

it('risk:regression on a slice branch worktree push --branch pushes the slice branch, and the progress ref mirrors it (D-31)', async () => {
  const box = sandbox({ files: { 'accord/config.yml': CONFIG + REF } });
  gitRun(box.wt, 'push', '-q', '-u', 'origin', 't/ST-9');
  expect((await run(['worktree', 'slice', 'ST-9', '2'], box.wt)).code).toBe(0);
  writeFiles(box.wt, { 'src/b.ts': 'b\n' });
  const second = commitMsg(box.wt, 'slice 2 work');
  expect(await run(['worktree', 'push', 'ST-9', '--branch'], box.wt)).toEqual({ code: 0, out: 'pushed: slice/ST-9/2\n', err: '' });
  expect(originRef(box, 'refs/heads/slice/ST-9/2')).toBe(second);
  expect(originRef(box, 'refs/heads/t/ST-9')).toBe(box.tip);
  expect(originRef(box, 'refs/accord/ST-9')).toBeUndefined();
  expect(await run(['worktree', 'push', 'ST-9'], box.wt)).toEqual({ code: 0, out: 'pushed: refs/accord/ST-9\n', err: '' });
  expect(originRef(box, 'refs/accord/ST-9')).toBe(second);
  expect(originRef(box, 'refs/heads/t/ST-9')).toBe(box.tip);
}, 120_000);

// Phase 15 D-08, R11: review changes slice 1 after slice 2 was cut; `worktree sync` merges the change forward, by a merge commit, whatever git.merge says.
/** A commit on t/ST-9 made from a throwaway worktree, as review's fix is; the slice worktree stays on its slice branch. Returns the commit. */
function fixOnClaim(box: Box, file: string, text: string): string {
  const dir = `${box.main}-st-9-fix`;
  gitRun(box.main, 'worktree', 'add', '-q', dir, 't/ST-9');
  writeFiles(dir, { [file]: text });
  const fix = commitMsg(dir, 'review fix');
  gitRun(box.main, 'worktree', 'remove', dir);
  return fix;
}
const parentsOfHead = (dir: string): string[] => gitRun(dir, 'rev-list', '--parents', '-n', '1', 'HEAD').trim().split(' ').slice(1);

it('risk:regression sync on a slice branch merges the unmerged previous slice, even under git.merge rebase, and rewrites nothing (D-08, R11)', async () => {
  const box = sandbox({ files: { 'accord/config.yml': CONFIG + 'git:\n  merge: rebase\n' } });
  expect((await run(['worktree', 'slice', 'ST-9', '2'], box.wt)).code).toBe(0);
  writeFiles(box.wt, { 'src/b.ts': 'b\n' });
  const own = commitMsg(box.wt, 'slice 2 work');
  const fix = fixOnClaim(box, 'src/fix.ts', 'fix\n');
  const r = await run(['worktree', 'sync', 'ST-9'], box.wt);
  expect(r.err).toBe('');
  expect(r.code).toBe(0);
  expect(r.out).toContain('merged: 1 commit of t/ST-9 into slice/ST-9/2');
  // a merge commit whose first parent is slice 2's old tip: no commit of slice 2 was rewritten
  expect(parentsOfHead(box.wt)).toEqual([own, fix]);
  expect(readFileSync(join(box.wt, 'src', 'fix.ts'), 'utf8').replace(/\r\n/g, '\n')).toBe('fix\n');
  expect(branchIn(box.wt)).toBe('slice/ST-9/2');
  // nothing left to take in: the second run changes nothing
  const head = gitRun(box.wt, 'rev-parse', 'HEAD').trim();
  expect((await run(['worktree', 'sync', 'ST-9'], box.wt)).code).toBe(0);
  expect(gitRun(box.wt, 'rev-parse', 'HEAD').trim()).toBe(head);
}, 120_000);

it('risk:regression sync on a slice branch merges the default branch once the previous slice is merged into it (D-08)', async () => {
  const box = sandbox();
  expect((await run(['worktree', 'slice', 'ST-9', '2'], box.wt)).code).toBe(0);
  writeFiles(box.wt, { 'src/b.ts': 'b\n' });
  const own = commitMsg(box.wt, 'slice 2 work');
  // main moves, then the host merges slice 1's pull request
  writeFiles(box.main, { 'm.txt': 'm\n' });
  commitMsg(box.main, 'main moves');
  mergeMsg(box.main, 't/ST-9', 'Merge pull request #1 from t/ST-9');
  gitRun(box.main, 'push', '-q', 'origin', 'main');
  const mainTip = gitRun(box.main, 'rev-parse', 'HEAD').trim();
  const r = await run(['worktree', 'sync', 'ST-9'], box.wt);
  expect(r.err).toBe('');
  expect(r.code).toBe(0);
  expect(r.out).toContain('of origin/main into slice/ST-9/2');
  expect(parentsOfHead(box.wt)).toEqual([own, mainTip]);
  expect(existsSync(join(box.wt, 'm.txt'))).toBe(true);
}, 120_000);

it('risk:regression a conflicting sync on a slice branch is aborted, named with exit 2, and leaves the branch as it was (D-08)', async () => {
  const box = sandbox();
  expect((await run(['worktree', 'slice', 'ST-9', '2'], box.wt)).code).toBe(0);
  writeFiles(box.wt, { 'src/a.ts': 'slice two\n' });
  const own = commitMsg(box.wt, 'slice 2 edits a');
  fixOnClaim(box, 'src/a.ts', 'review fix\n');
  const r = await run(['worktree', 'sync', 'ST-9'], box.wt);
  expect(r.code).toBe(2);
  expect(r.err).toContain('conflict in src/a.ts');
  expect(gitRun(box.wt, 'rev-parse', 'HEAD').trim()).toBe(own);
  expect(gitRun(box.wt, 'status', '--porcelain', '--untracked-files=no').trim()).toBe('');
  expect(exists(box.wt, 'MERGE_HEAD')).toBe(false);
  // an uncommitted change is refused before anything is merged
  writeFiles(box.wt, { 'src/a.ts': 'edited\n' });
  const dirty = await run(['worktree', 'sync', 'ST-9'], box.wt);
  expect(dirty.code).toBe(2);
  expect(dirty.err).toContain('uncommitted changes');
}, 120_000);

// Phase 15 D-31, T-15-32: clean removes a done ticket's slice branches, local and on origin, and their record lines, under the guards the claim branch has.
/** ST-9 claimed in its worktree on a slice branch `slice/ST-9/2`, with `slice/ST-9/3` beside it, both pushed and recorded. */
function slicedClone() {
  const c = copy();
  const tip = claimWorktree(c, 'ST-9');
  c.git('branch', 'slice/ST-9/2', 't/ST-9');
  c.git('branch', 'slice/ST-9/3', 't/ST-9');
  c.git('push', '-q', 'origin', 'slice/ST-9/2', 'slice/ST-9/3');
  gitRun(c.sibling('ST-9'), 'switch', '-q', 'slice/ST-9/2');
  recordSlice(c.root, 'ST-9', 2, tip);
  recordSlice(c.root, 'ST-9', 3, tip);
  return { c, tip };
}
const recordOf = (c: { root: string }): string => (existsSync(`${c.root}/.git/accord/slices`) ? readFileSync(`${c.root}/.git/accord/slices`, 'utf8') : '');

it('risk:data-loss clean deletes the slice branches of a done ticket, local and origin, with their record lines (D-31)', async () => {
  const { c, tip } = slicedClone();
  doneOnRemote(c, ['ST-9']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const out = lines(r.out);
  for (const b of ['slice/ST-9/2', 'slice/ST-9/3']) {
    expect(out).toContain(withAction(`deleted ${b} (was ${tip})`));
    expect(out).toContain(withAction(`deleted origin/${b} (was ${tip})`));
    expect(has(c.root, `refs/heads/${b}`), b).toBe(false);
    expect(has(c.remote, `refs/heads/${b}`), b).toBe(false);
  }
  expect(out).toContain(withAction(`removed ${c.sibling('ST-9')}`));
  expect(recordOf(c)).toBe('');
}, 120_000);

it('risk:data-loss clean keeps a slice branch holding commits the default branch lacks, with today\'s unsafe-tip line and its record line (T-15-32)', async () => {
  const { c, tip } = slicedClone();
  c.git('switch', '-q', 'slice/ST-9/3');
  writeFiles(c.root, { 'slice-three.txt': 'unmerged work\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'slice 3 work');
  const work = sha(c, 'HEAD');
  c.git('switch', '-q', 'main');
  doneOnRemote(c, ['ST-9']);
  const r = await run(['worktree', 'clean'], c.root);
  expect(r.code).toBe(0);
  const out = lines(r.out);
  expect(out.some((l) => l.startsWith('kept slice/ST-9/3: it has commits after its verified commit'))).toBe(true);
  expect(has(c.root, 'refs/heads/slice/ST-9/3')).toBe(true);
  expect(sha(c, 'refs/heads/slice/ST-9/3')).toBe(work);
  expect(out).toContain(withAction(`deleted slice/ST-9/2 (was ${tip})`));
  expect(has(c.root, 'refs/heads/slice/ST-9/2')).toBe(false);
  expect(recordOf(c)).toBe(`ST-9 3 ${tip}\n`);
}, 120_000);

it('risk:data-loss clean --dry-run lists the slice deletions and deletes nothing (D-31)', async () => {
  const { c, tip } = slicedClone();
  doneOnRemote(c, ['ST-9']);
  const before = recordOf(c);
  const r = await run(['worktree', 'clean', '--dry-run'], c.root);
  expect(r.code).toBe(0);
  expect(lines(r.out)).toContain(withAction(`deleted slice/ST-9/2 (was ${tip})`));
  expect(lines(r.out)).toContain(withAction(`deleted slice/ST-9/3 (was ${tip})`));
  for (const b of ['slice/ST-9/2', 'slice/ST-9/3']) {
    expect(has(c.root, `refs/heads/${b}`), b).toBe(true);
    expect(has(c.remote, `refs/heads/${b}`), b).toBe(true);
  }
  expect(recordOf(c)).toBe(before);
}, 120_000);
