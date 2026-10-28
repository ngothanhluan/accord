import { availableParallelism } from 'node:os';
import { describe, expect, it } from 'vitest';
import config, { workers } from '../../../vitest.config.js';

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
