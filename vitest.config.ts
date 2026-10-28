import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

// Each fork spawns git and the CLI; vitest's default of CPUs-1 forks ran a 32 GB host out of memory with two
// sessions testing at once. ACCORD_TEST_WORKERS sets the count; the default is half the CPUs.
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
    // Explicit list, not 'packages/*': the test-less packages/mcp stub is never a project.
    projects: ['packages/core', 'packages/cli'],
  },
});
