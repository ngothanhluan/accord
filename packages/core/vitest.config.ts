import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Same budget as the cli project: a project config does not inherit the root one.
  test: { name: 'core', include: ['test/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 30_000 },
});
