// Phase 08.9 D-02 and D-08: the git processes the offline dry clean of `accord audit` starts per surviving branch. Its facts are read once per clean
// (the owner's snapshot-once ruling of 2026-11-24), so twelve branches start as many as two; the per-branch read, run on the same sandboxes, grows.
import { PassThrough } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { loadSnapshot } from '@accord-dev/accord-core';
import { worktreeClean } from '../src/commands/worktree.js';
import * as limit from '../src/commands/fetch-limit.js';
import { loadFromFs } from '../src/load/fs.js';
import * as proc from '../src/load/proc.js';
import { readCleanFacts } from '../src/load/clean-facts.js';
import type { CleanFacts } from '../src/load/clean-facts.js';
import type { CommandContext } from '../src/run.js';
import { countedSync, spawnLog } from './helpers/git-spawns.js';
import { copy, useSandboxes } from './helpers/worktree.js';
import type { Clone } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs), cleanBudgetMs: vi.fn(real.cleanBudgetMs) };
});
vi.mock('../src/load/clean-facts.js', async (orig) => {
  const real = await orig<typeof import('../src/load/clean-facts.js')>();
  return { ...real, readCleanFacts: vi.fn(real.readCleanFacts) };
});
vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));

afterEach(() => {
  vi.mocked(limit.cleanBudgetMs).mockReset();
  spawnLog.on = false;
  spawnLog.after = undefined;
  spawnLog.fail = undefined;
  spawnLog.calls = [];
});

useSandboxes([{ tickets: ['ST-9'] }]);

/** The git verb of one argument list: the first word that is neither a flag nor the value of `-c`. */
function verbOf(argv: string[]): string {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-c') i++;
    else if (!argv[i].startsWith('-')) return argv[i];
  }
  return '?';
}

const histogram = (all: string[][]): string => {
  const counts = new Map<string, number>();
  for (const argv of all) counts.set(verbOf(argv), (counts.get(verbOf(argv)) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([verb, n]) => `${verb}=${n}`).join(' ');
};

const isRefsTable = (a: string[]) => a[0] === 'for-each-ref' && a.some((x) => x.includes('objecttype'));

/** The git argument lists one offline dry clean starts; `perBranch` has the facts lookup answer nothing, so every read is today's per-branch read. */
function spawns(c: Clone, perBranch: boolean): string[][] {
  const ctx = { root: c.root, snapshot: loadSnapshot(loadFromFs(c.root)), stdout: new PassThrough(), stderr: new PassThrough(), env: {} } as CommandContext;
  vi.mocked(readCleanFacts).mockClear();
  if (perBranch) vi.mocked(readCleanFacts).mockReturnValueOnce(undefined as unknown as CleanFacts);
  return countedSync(() => worktreeClean(ctx, { fetched: 'ok', dry: 'offline' })).argv;
}

/** Commits made with `commit-tree` and refs with `update-ref` only, so the clone needs no push and the clean (offline) sees them as they are. */
function commitOn(c: Clone, message: string, ...parents: string[]): string {
  return c.git('commit-tree', c.git('rev-parse', 'origin/main^{tree}').trim(), ...parents.flatMap((p) => ['-p', p]), '-m', message).trim();
}

/** `count` teammates' live claim branches on origin only, and `count` local backlog branches that one merge commit on origin's main holds. */
function claimAndBacklog(count: number): Clone {
  const c = copy({ tickets: ['ST-9'] });
  vi.mocked(proc.processTable).mockReturnValue([]);
  const main = c.git('rev-parse', 'origin/main').trim();
  const tips: string[] = [];
  for (let i = 1; i <= count; i++) {
    c.git('update-ref', `refs/remotes/origin/t/ZZ-${i}`, commitOn(c, `claim: ZZ-${i}`, main));
    const tip = commitOn(c, `backlog ${i}`, main);
    tips.push(tip);
    c.git('update-ref', `refs/heads/backlog/p89-${i}`, tip);
  }
  c.git('update-ref', 'refs/remotes/origin/main', commitOn(c, 'merge the backlog branches', main, ...tips));
  return c;
}

// Phase 08.9 D-02 and D-08: the facts of the offline dry clean are read once, so no read grows with the branches.
it('risk:resource the offline dry clean starts as many git processes for twelve live claim and merged backlog branches as for two (D-02 D-08)', () => {
  const few = claimAndBacklog(2);
  const many = claimAndBacklog(12);
  const batchedFew = spawns(few, false);
  const batchedMany = spawns(many, false);
  const singleFew = spawns(few, true);
  const singleMany = spawns(many, true);
  const say = `batched ${batchedMany.length} (${histogram(batchedMany)}) with 12, ${batchedFew.length} (${histogram(batchedFew)}) with 2; per-branch ${singleMany.length} (${histogram(singleMany)}) with 12, ${singleFew.length} (${histogram(singleFew)}) with 2`;
  expect(histogram(batchedMany), say).toBe(histogram(batchedFew));
  expect(batchedMany.length, say).toBe(batchedFew.length);
  expect(batchedFew.filter(isRefsTable), say).toHaveLength(1);
  expect(batchedMany.filter(isRefsTable), say).toHaveLength(1);
  expect(singleMany.length - singleFew.length, say).toBeGreaterThan(batchedMany.length - batchedFew.length);
}, 180_000);
