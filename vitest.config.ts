import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    // Explicit list, not 'packages/*': the test-less packages/mcp stub is never a project.
    projects: ['packages/core', 'packages/cli'],
  },
});
