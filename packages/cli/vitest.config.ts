import { defineConfig } from 'vitest/config';

// Every test spawns git, which is slow on Windows hosts; the 5 s default fails runs that are only slow.
// Windows CI runners at times run git 5 times slower still: 37 s for a test that takes 7 s (BUG-LN-6).
const limit = process.platform === 'win32' ? 90_000 : 30_000;

export default defineConfig({
  test: { name: 'cli', include: ['test/**/*.test.ts'], testTimeout: limit, hookTimeout: limit },
});
