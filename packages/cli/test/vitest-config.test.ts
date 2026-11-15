import { availableParallelism } from 'node:os';
import { describe, expect, it } from 'vitest';
import config, { workers } from '../../../vitest.config.js';
import WeightedSequencer, { balance, DEFAULT_WEIGHT, key, WEIGHTS } from '../../../test/shard.js';

describe('vitest worker cap', () => {
  it('risk:resource defaults to half the CPUs, at least one', () => {
    expect(workers({}, 20)).toBe(10);
    expect(workers({}, 7)).toBe(3);
    expect(workers({}, 1)).toBe(1);
  });

  it('risk:resource ACCORD_TEST_WORKERS overrides the default', () => {
    expect(workers({ ACCORD_TEST_WORKERS: '4' }, 20)).toBe(4);
    expect(workers({ ACCORD_TEST_WORKERS: '32' }, 20)).toBe(32);
    expect(workers({ ACCORD_TEST_WORKERS: '' }, 20)).toBe(10);
  });

  it('risk:resource refuses a value that is not a positive whole number', () => {
    for (const value of ['0', '-2', '1.5', 'four', '50%']) {
      expect(() => workers({ ACCORD_TEST_WORKERS: value }, 20)).toThrow(/ACCORD_TEST_WORKERS/);
    }
  });

  it('risk:resource the root config caps the fork pool with it', () => {
    expect(config.test?.pool).toBe('forks');
    expect(config.test?.maxWorkers).toBe(workers(process.env, availableParallelism()));
  });

  it('risk:resource the root config takes the machine-wide run lock for the whole run', () => {
    expect(config.test?.globalSetup).toEqual(['./test/lock.ts']);
  });
});

describe('weighted shards', () => {
  const keys = Object.keys(WEIGHTS);

  it('risk:coverage every test file lands in exactly one shard, whatever the order the files arrive in', () => {
    const extra = ['packages/cli/test/new-one.test.ts', 'packages/core/test/new-two.test.ts'];
    for (const count of [1, 2, 5, 7]) {
      const shards = Array.from({ length: count }, (_, i) => balance([...keys, ...extra], i + 1, count));
      const reversed = Array.from({ length: count }, (_, i) => balance([...extra, ...keys].reverse(), i + 1, count));
      expect(reversed).toEqual(shards);
      const all = shards.flat();
      expect(all.length).toBe(keys.length + extra.length);
      expect(new Set(all)).toEqual(new Set([...keys, ...extra]));
    }
  });

  it('risk:resource splits by measured cost, so no shard holds much more than its share', () => {
    const total = keys.reduce((sum, k) => sum + WEIGHTS[k], 0);
    const heaviest = Math.max(...keys.map((k) => WEIGHTS[k]));
    for (const count of [4, 5, 6]) {
      for (let i = 1; i <= count; i++) {
        const sum = balance(keys, i, count).reduce((s, k) => s + WEIGHTS[k], 0);
        expect(sum).toBeLessThanOrEqual(total / count + heaviest);
      }
    }
  });

  it('risk:resource gives a file the table does not name the default weight', () => {
    expect(balance(['a', 'b'], 1, 2, { a: 100 })).toEqual(['a']);
    expect(balance(['a', 'b', 'c'], 2, 2, { a: DEFAULT_WEIGHT * 2 })).toEqual(['b', 'c']);
  });

  it('risk:coverage refuses a shard index outside 1..count', () => {
    for (const [i, n] of [[0, 3], [4, 3], [1, 0], [1.5, 3]]) expect(() => balance(keys, i, n)).toThrow(/not a shard/);
  });

  it('risk:coverage keys are repository-relative with forward slashes on every OS', () => {
    expect(key('/r', '/r/packages/cli/test/a.test.ts')).toBe('packages/cli/test/a.test.ts');
  });

  it('risk:coverage the root config shards with the weighted sequencer', () => {
    expect(config.test?.sequence?.sequencer).toBe(WeightedSequencer);
  });
});
