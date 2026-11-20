// Phase 8.2 D-03: `accord worktree clean --dry-run` prints the lines a real clean prints and deletes nothing, against real git in tmp sandboxes with a bare remote.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as limit from '../src/commands/fetch-limit.js';
import * as proc from '../src/load/proc.js';
import { laneTicket } from '../../../test/helpers/lane.js';
import { ALIVE, forget, gone, link, listing, recorded } from './helpers/done.js';
import { spawnLog } from './helpers/git-spawns.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { claimWorktree, copy, doneOnRemote, dropAndMerge, has, lines, LIVE, sha, ticketWorktree, useSandboxes, withAction, writeHolds } from './helpers/worktree.js';
import type { Clone } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs), cleanBudgetMs: vi.fn(real.cleanBudgetMs) };
});
vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

afterEach(() => {
  vi.mocked(limit.cleanBudgetMs).mockReset();
  spawnLog.on = false;
  spawnLog.after = undefined;
  spawnLog.fail = undefined;
  spawnLog.calls = [];
});

useSandboxes([{ tickets: ['ST-9'] }, { tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'] }]);

/** The directory accord keeps its holds, records and locks in. */
const accordDir = (c: Clone) => c.git('rev-parse', '--path-format=absolute', '--git-common-dir').trim() + '/accord';
const names = (dir: string) => (existsSync(dir) ? readdirSync(dir).sort() : []);

/** A git call that deletes, moves a ref, or prunes, by the arguments it carries; a `remote prune` is allowed only with `--dry-run`. */
const deleting = (a: string[]) =>
  a.includes('update-ref') || a.includes('push') || (a.includes('worktree') && (a.includes('remove') || a.includes('prune'))) || (a.includes('remote') && a.includes('prune') && !a.includes('--dry-run'));

/** Everything a dry run must leave as it found it. */
function state(c: Clone) {
  return {
    worktrees: c.git('worktree', 'list', '--porcelain'),
    heads: c.git('for-each-ref', 'refs/heads'),
    accord: names(accordDir(c)),
  };
}

it('risk:data-loss worktree clean --dry-run prints the lines a real clean prints for a done ticket and deletes nothing (8.2-ac-3)', async () => {
  const c = copy({ tickets: ['ST-9'] });
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  const before = state(c);

  const dry = await run(['worktree', 'clean', '--dry-run'], c.root, {});
  expect(dry.code).toBe(0);
  const dryLines = lines(dry.out);
  expect(dryLines).toContain(withAction(`removed ${c.sibling('ST-9')}`));
  expect(dryLines.some((l) => l.startsWith('deleted t/ST-9 (was '))).toBe(true);
  expect(dryLines.some((l) => l.startsWith('deleted origin/t/ST-9 (was '))).toBe(true);

  expect(state(c)).toEqual(before);
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(true);

  const real = await run(['worktree', 'clean'], c.root, {});
  expect(real.code).toBe(0);
  expect(dryLines).toEqual(lines(real.out));
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
  expect(has(c.remote, 'refs/heads/t/ST-9')).toBe(false);
});

it('risk:data-loss a dry clean spawns no git step that deletes or writes a lock (D-03)', async () => {
  const c = copy({ tickets: ['ST-9'] });
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  const dir = accordDir(c);
  let locked = false;
  spawnLog.after = () => {
    if (existsSync(dir + '/clean.lock') || existsSync(dir + '/holds.lock')) locked = true;
  };
  spawnLog.on = true;
  const dry = await run(['worktree', 'clean', '--dry-run'], c.root, {});
  spawnLog.on = false;
  expect(dry.code).toBe(0);
  expect(spawnLog.calls.filter(deleting)).toEqual([]);
  expect(spawnLog.calls.length).toBeGreaterThan(0);
  expect(locked).toBe(false);
  expect(names(dir)).not.toContain('clean.lock');
  expect(names(dir)).not.toContain('holds.lock');
});

it('risk:regression a dry clean refuses nothing a real clean accepts and the real clean keeps its own lock (D-03)', async () => {
  const c = copy({ tickets: ['ST-9'] });
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  const dir = accordDir(c);
  let locked = false;
  spawnLog.after = () => {
    if (existsSync(dir + '/clean.lock')) locked = true;
  };
  spawnLog.on = true;
  expect((await run(['worktree', 'clean'], c.root, {})).code).toBe(0);
  spawnLog.on = false;
  expect(locked).toBe(true);
  expect(names(dir)).not.toContain('clean.lock');
});

// ---- 08.2-03 Task 2: every phase of the clean --------------------------------------------------------------------------------------

const FIVE = ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'];
const text = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined);

/** What a dry run must also leave as it found it: every folder, the holds file and the records file. */
function everything(c: Clone, ids: string[]) {
  return {
    ...state(c),
    folders: Object.fromEntries(ids.map((id) => [id, existsSync(c.sibling(id))])),
    holds: text(accordDir(c) + '/holds'),
    records: text(accordDir(c) + '/worktrees'),
  };
}

/**
 * One repository holding every kind of leftover the clean handles: a done ticket's worktree (ST-9), a dropped ticket's worktree and branches (ST-10),
 * a done ticket's worktree that another session holds (ST-11), a recorded folder git has forgotten (ST-12), a worktree whose folder was deleted by
 * hand, a local backlog branch merged on the remote main, and a remote-tracking ref whose branch was deleted on the remote after the last fetch.
 */
async function rich() {
  const c = copy({ tickets: FIVE });
  ticketWorktree(c, 'ST-9');
  claimWorktree(c, 'ST-10', { 'accord/tickets/ST-10.md': laneTicket('ST-10'), 'src/a.ts': 'a\n' });
  ticketWorktree(c, 'ST-11');
  expect((await run(['worktree', 'open', 'ST-12'], c.root)).code).toBe(0);
  forget(c, 'ST-12');
  c.git('worktree', 'add', '-q', '-b', 'scratch/gone', c.sibling('gone'), 'origin/main');
  rmSync(c.sibling('gone'), { recursive: true, force: true });
  writeHolds(c, { 'ST-11': LIVE });
  vi.mocked(proc.processTable).mockReturnValue(ALIVE);
  c.git('switch', '-q', '-c', 'backlog/a', 'main');
  writeFiles(c.root, { 'backlog-a.txt': 'a\n' });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'backlog/a');
  c.git('push', '-q', 'origin', 'backlog/a');
  c.git('switch', '-q', 'main');
  const o = c.otherClone();
  gitRun(o, 'fetch', '-q', 'origin');
  gitRun(o, 'merge', '-q', '--no-ff', '-m', 'merge backlog/a', 'origin/backlog/a');
  gitRun(o, 'push', '-q', 'origin', 'main');
  doneOnRemote(c, ['ST-9', 'ST-11', 'ST-12']);
  await dropAndMerge(c, 'ST-10');
  c.git('branch', 'stale/x', 'main');
  c.git('push', '-q', 'origin', 'stale/x');
  gitRun(c.remote, 'branch', '-D', 'stale/x');
  return { c, stale: sha(c, 'refs/remotes/origin/stale/x') };
}

it('risk:data-loss a dry clean prints every line the real clean then prints on a sandbox holding every kind of leftover (D-03)', async () => {
  const { c, stale } = await rich();
  const before = everything(c, [...FIVE, 'gone']);
  const dry = await run(['worktree', 'clean', '--dry-run'], c.root, {});
  expect(dry.code).toBe(0);
  const dryLines = lines(dry.out);
  expect(dryLines).toContain(`pruned refs/remotes/origin/stale/x (was ${stale})`);
  expect(dryLines.some((l) => l.startsWith(`pruned ${c.sibling('gone')}: `))).toBe(true);
  expect(dryLines).toContain(withAction(`removed ${c.sibling('ST-9')}`));
  expect(dryLines).toContain(withAction(`removed ${c.sibling('ST-10')}`));
  expect(dryLines).toContain(withAction(`kept ${c.sibling('ST-11')}: held by another session`));
  expect(dryLines.some((l) => l.startsWith('deleted backlog/a: merged into origin/main (was '))).toBe(true);
  expect(dryLines.some((l) => l.startsWith('deleted origin/t/ST-10 (was '))).toBe(true);
  expect(everything(c, [...FIVE, 'gone'])).toEqual(before);
  expect(has(c.root, 'refs/remotes/origin/stale/x')).toBe(true);

  const real = await run(['worktree', 'clean'], c.root, {});
  expect(real.code).toBe(0);
  expect(dryLines).toEqual(lines(real.out));
  expect(has(c.root, 'refs/remotes/origin/stale/x')).toBe(false);
  expect(has(c.root, 'refs/heads/backlog/a')).toBe(false);
}, 180_000);

it('risk:data-loss a dry clean empties no forgotten folder in either outcome of its scan (D-03)', async () => {
  const c = copy({ tickets: FIVE });
  for (const id of ['ST-9', 'ST-11']) expect((await run(['worktree', 'open', id], c.root)).code).toBe(0);
  for (const id of ['ST-9', 'ST-11']) forget(c, id);
  writeFiles(c.sibling('ST-9'), { 'notes/keep.txt': 'kept\n' });
  mkdirSync(`${c.sibling('ST-11')}/a/b`, { recursive: true });
  link(`${c.root}/accord`, `${c.sibling('ST-11')}/node_modules/outside`);
  vi.mocked(proc.processTable).mockReturnValue(ALIVE);
  doneOnRemote(c, ['ST-9', 'ST-11']);
  const keep = listing(c.sibling('ST-9'));
  const sweep = listing(c.sibling('ST-11'));
  const records = recorded(c);

  const dry = await run(['worktree', 'clean', '--dry-run'], c.root, {});
  expect(dry.code).toBe(0);
  const dryLines = lines(dry.out);
  expect(dryLines).toContain(withAction(`kept ${c.sibling('ST-9')}: notes/keep.txt`));
  expect(dryLines).toContain(withAction(`removed ${c.sibling('ST-11')}`));
  expect(listing(c.sibling('ST-9'))).toEqual(keep);
  expect(listing(c.sibling('ST-11'))).toEqual(sweep);
  expect(sweep).toContain('a/b/');
  expect(sweep.some((l) => l.startsWith('node_modules/outside -> '))).toBe(true);
  expect(recorded(c)).toEqual(records);
  expect(existsSync(`${c.root}/accord/config.yml`)).toBe(true);

  const real = await run(['worktree', 'clean'], c.root, {});
  expect(real.code).toBe(0);
  expect(dryLines).toEqual(lines(real.out));
  expect(listing(c.sibling('ST-9'))).toEqual(keep);
  expect(gone(c.sibling('ST-11'))).toBe(true);
  expect(existsSync(`${c.root}/accord/config.yml`)).toBe(true);
}, 180_000);

it('risk:data-loss the rich dry clean runs no deleting git step (D-03)', async () => {
  const { c } = await rich();
  const dir = accordDir(c);
  let locked = false;
  spawnLog.after = () => {
    if (existsSync(dir + '/clean.lock') || existsSync(dir + '/holds.lock')) locked = true;
  };
  spawnLog.on = true;
  const dry = await run(['worktree', 'clean', '--dry-run'], c.root, {});
  spawnLog.on = false;
  expect(dry.code).toBe(0);
  expect(spawnLog.calls.filter(deleting)).toEqual([]);
  const prunes = spawnLog.calls.filter((a) => a.includes('remote') && a.includes('prune'));
  expect(prunes).toHaveLength(1);
  expect(prunes[0]).toContain('--dry-run');
  expect(locked).toBe(false);
}, 180_000);

it('risk:parsing the would-prune list is read in the C locale (D-03)', async () => {
  const c = copy({ tickets: ['ST-9'] });
  c.git('branch', 'stale/x', 'main');
  c.git('push', '-q', 'origin', 'stale/x');
  gitRun(c.remote, 'branch', '-D', 'stale/x');
  const at = sha(c, 'refs/remotes/origin/stale/x');
  const seenEnv: Array<string | undefined> = [];
  spawnLog.fail = (args, options) => {
    if (args.includes('remote') && args.includes('prune')) seenEnv.push((options as { env?: NodeJS.ProcessEnv } | undefined)?.env?.LC_ALL);
    return false;
  };
  spawnLog.on = true;
  const dry = await run(['worktree', 'clean', '--dry-run'], c.root, {});
  spawnLog.on = false;
  expect(dry.code).toBe(0);
  expect(seenEnv).toEqual(['C']);
  expect(lines(dry.out)).toContain(`pruned refs/remotes/origin/stale/x (was ${at})`);
  expect(has(c.root, 'refs/remotes/origin/stale/x')).toBe(true);
});

it('risk:data-loss a detached recorded worktree whose HEAD only a stale remote ref holds is kept as the real clean keeps it (D-03)', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12', 'ST-13'] });
  expect((await run(['worktree', 'open', 'ST-9'], c.root)).code).toBe(0);
  const w = c.sibling('ST-9');
  gitRun(w, 'switch', '-q', '--detach');
  writeFiles(w, { 'extra.txt': 'extra\n' });
  const head = commitMsg(w, 'extra');
  gitRun(w, 'push', '-q', 'origin', `${head}:refs/heads/scratch/e`);
  c.git('fetch', '-q', 'origin');
  gitRun(c.remote, 'branch', '-D', 'scratch/e');
  doneOnRemote(c, ['ST-9']);
  vi.mocked(proc.processTable).mockReturnValue(ALIVE);
  const before = everything(c, ['ST-9']);

  const dry = await run(['worktree', 'clean', '--dry-run'], c.root, {});
  expect(dry.code).toBe(0);
  const dryLines = lines(dry.out);
  expect(dryLines).toContain(withAction(`kept ${w}: its detached HEAD ${head} is on no branch`));
  expect(everything(c, ['ST-9'])).toEqual(before);

  const real = await run(['worktree', 'clean'], c.root, {});
  expect(dryLines).toEqual(lines(real.out));
  expect(existsSync(w)).toBe(true);
}, 180_000);
