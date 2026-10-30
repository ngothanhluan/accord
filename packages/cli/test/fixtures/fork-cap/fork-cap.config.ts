// ST-LN-73 risk:regression fixture, run by packages/cli/test/test-memory.test.ts: a vitest run shaped like the root one.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: process.env.ACCORD_FORK_CAP_CACHE,
  test: {
    pool: 'forks',
    maxWorkers: 3,
    globalSetup: ['./setup.ts'],
    projects: [
      { test: { name: 'a', pool: 'forks', include: ['a.check.ts'] } },
      { test: { name: 'b', pool: 'forks', include: ['b.check.ts', 'c.check.ts'] } },
    ],
  },
});
