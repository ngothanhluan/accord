// CI splits the Windows suite into shards (`vitest run --shard=<i>/<n>`, .github/workflows/windows.yml). vitest's own
// split gives every shard the same number of files, picked by a hash of the path, and the cost per file on Windows
// ranges from under a second to seven minutes: with 5 shards one shard got three times the work of another. This
// sequencer splits by measured cost instead, so every shard ends at about the same time.
//
// The weights in shard-weights.json are seconds per file from one unsharded run on windows-latest, Node 24, two
// forks (run 43691050801). They only steer the balance: a file missing from the table gets DEFAULT_WEIGHT, a key
// naming a deleted file is ignored, and every file still lands in exactly one shard. Refresh the table when a
// Windows shard runs much longer than the others.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { TestSpecification } from 'vitest/node';
import { BaseSequencer } from 'vitest/node';

/** Seconds assumed for a test file the table does not name; above the median, since new files tend to spawn git. */
export const DEFAULT_WEIGHT = 10;

export const WEIGHTS: Readonly<Record<string, number>> = JSON.parse(
  readFileSync(new URL('./shard-weights.json', import.meta.url), 'utf8'),
) as Record<string, number>;

/**
 * Splits `keys` into `count` groups of about equal total weight (longest first, each to the lightest group) and
 * returns group `index` (1-based). Deterministic for the same keys in any order, so the shards of one run, each
 * computing its own group, together hold every key exactly once.
 */
export function balance(keys: readonly string[], index: number, count: number, weights: Readonly<Record<string, number>> = WEIGHTS): string[] {
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(index) || index < 1 || index > count) {
    throw new Error(`shard ${index}/${count} is not a shard: index must be 1..count`);
  }
  const weight = (key: string) => weights[key] ?? DEFAULT_WEIGHT;
  const ordered = [...new Set(keys)].sort((a, b) => weight(b) - weight(a) || (a < b ? -1 : a > b ? 1 : 0));
  const groups = Array.from({ length: count }, () => ({ total: 0, keys: [] as string[] }));
  for (const key of ordered) {
    // The lightest group; on a tie the lowest index, so the result does not depend on anything but the keys.
    let lightest = groups[0];
    for (const group of groups) if (group.total < lightest.total) lightest = group;
    lightest.total += weight(key);
    lightest.keys.push(key);
  }
  return groups[index - 1].keys;
}

/** The repository-relative, forward-slash path vitest reports for a test file, the key of shard-weights.json. */
export function key(root: string, moduleId: string): string {
  return relative(root, moduleId).split('\\').join('/');
}

export default class WeightedSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { root, shard } = this.ctx.config;
    if (!shard) return files;
    const keep = new Set(balance(files.map((file) => key(root, file.moduleId)), shard.index, shard.count));
    return files.filter((file) => keep.has(key(root, file.moduleId)));
  }
}
