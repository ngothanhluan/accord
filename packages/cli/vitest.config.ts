import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Every test spawns git, which is slow on Windows hosts; the 5 s default fails runs that are only slow.
  test: { name: 'cli', include: ['test/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 30_000, setupFiles: ['test/setup.ts'] },
});
