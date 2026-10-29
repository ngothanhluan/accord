// ST-LN-63 D-05: one count assertion per Part 2 item, each against its own recorded count at the baseline.
import { expect } from 'vitest';
import { readGolden, runSample } from './runs.js';

/** A Part 2 item: the run keys it touches and a predicate over one git argument array that matches its calls and the command it adds. */
export type Item = { item: string; keys: string[]; p: (args: string[]) => boolean };

/** Each Part 2 task appends its entries to this array literal. */
export const ITEMS: Item[] = [
  {
    item: 'HEAD author',
    keys: ['main worktree open A-1'],
    p: (a) => a.includes('show') && a.includes('-s') && a.includes('--format=%H%x00%ae') && a.includes('HEAD'),
  },
  {
    item: 'claim tips',
    keys: ['main status', 'main worktree open A-1'],
    p: (a) => a[0] === 'rev-parse' && a.includes('--verify') && a.some((x) => x.startsWith('refs/heads/')),
  },
  {
    item: 'current branch',
    keys: ['wt-A-7 anchor', 'wt-A-7 worktree merge A-7'],
    p: (a) => a[0] === 'symbolic-ref' && a.includes('--short') && a.includes('HEAD'),
  },
  {
    item: 'review commit',
    keys: ['wt-S-1 gate done S-1 --json'],
    p: (a) => a.includes('log') && a.includes('-G') && a.includes('^## Round '),
  },
];

/**
 * `before` is the number of arrays in `git-counts.before.json[key]` that `p` matches; `after` the same over `argv` when given,
 * else over a fresh `runSample([key])`. The item shows fewer git processes than the baseline did.
 */
export async function expectFewer(key: string, p: (args: string[]) => boolean, argv?: string[][]): Promise<void> {
  const before = readGolden<Record<string, string[][]>>('git-counts.before.json')[key]?.filter(p).length ?? 0;
  expect(before, `${key}: the baseline started no git process this item touches`).toBeGreaterThan(0);
  const calls = argv ?? (await runSample([key]))[key]?.argv;
  expect(calls, `${key}: no run`).toBeDefined();
  const after = calls!.filter(p).length;
  expect(after, `${key}: ${after} git processes after, ${before} before`).toBeLessThan(before);
}

/** Runs the item's count assertion on each of its keys. */
export async function checkItem(entry: Item): Promise<void> {
  for (const key of entry.keys) await expectFewer(key, entry.p);
}
