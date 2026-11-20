// Phase 8.2 D-03: `accord worktree clean --dry-run` prints the lines a real clean prints and deletes nothing, against real git in tmp sandboxes with a bare remote.
import { existsSync, readdirSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import * as limit from '../src/commands/fetch-limit.js';
import { spawnLog } from './helpers/git-spawns.js';
import { run } from './helpers/repo.js';
import { copy, doneOnRemote, has, lines, ticketWorktree, useSandboxes, withAction } from './helpers/worktree.js';
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

useSandboxes([{ tickets: ['ST-9'] }]);

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
