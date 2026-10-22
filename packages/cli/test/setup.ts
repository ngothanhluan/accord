// ST-LN-25: no test reaches the real registry or the real per-machine cache.
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, vi } from 'vitest';

vi.mock('../src/commands/registry.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/registry.js')>();
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  return {
    ...real,
    requestLatest: vi.fn(async () => undefined),
    cachePath: vi.fn(() => join(tmpdir(), 'accord-registry-' + process.pid + '.json')),
  };
});

afterAll(() => {
  rmSync(join(tmpdir(), 'accord-registry-' + process.pid + '.json'), { force: true });
});
