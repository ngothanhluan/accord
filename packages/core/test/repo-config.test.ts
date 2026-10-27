// ST-LN-62 Task 8: this repository's own sensitive and generated lists, as the owner approved them.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { loadConfig } from '../src/load/config.js';

it('risk:parsing this repository config validates and holds the sensitive and generated lists the owner approved', () => {
  const text = readFileSync(new URL('../../../accord/config.yml', import.meta.url), 'utf8');
  const { config, findings } = loadConfig('accord/config.yml', text);
  expect(findings).toEqual([]);
  expect(config?.sensitive).toEqual({
    interface: [
      'packages/cli/src/run.ts',
      'packages/core/schemas/',
      'packages/core/src/index.ts',
      'packages/core/package.json',
      'packages/cli/package.json',
    ],
    'data-deletion': ['packages/cli/src/commands/drop.ts', 'packages/cli/src/commands/worktree.ts'],
  });
  expect(config?.generated).toEqual(['packages/core/src/generated/', 'packages/cli/README.md']);
});
