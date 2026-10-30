import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

// Each fork spawns git and the CLI; vitest's default of CPUs-1 forks ran a 32 GB host out of memory with two
// sessions testing at once. ACCORD_TEST_WORKERS sets the cap, otherwise half the CPUs; once the run holds the lock,
// test/lock.ts lowers it to the forks the free memory allows, except on macOS (ST-LN-73).
export function workers(env: NodeJS.ProcessEnv, cpus: number): number {
  const value = env.ACCORD_TEST_WORKERS;
  if (value === undefined || value === '') return Math.max(1, Math.floor(cpus / 2));
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`ACCORD_TEST_WORKERS must be a positive whole number, got "${value}"`);
  return Number(value);
}

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    maxWorkers: workers(process.env, availableParallelism()),
    // ST-LN-67: the cap is per run; this lock lets one run at a time hold the machine.
    globalSetup: ['./test/lock.ts'],
    // Explicit list, not 'packages/*': the test-less packages/mcp stub is never a project.
    projects: ['packages/core', 'packages/cli'],
  },
});
