import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { cleanup, run } from './helpers/repo.js';

it('risk:data-loss run refuses the checkout and a folder outside the temp folder and accepts a folder that exists only under it', async () => {
  const checkout = fileURLToPath(new URL('../../../', import.meta.url));
  const refusal = 'refusing to run accord outside a temporary sandbox';
  await expect(run(['--version'], checkout)).rejects.toThrow(refusal);
  // An existing folder that is not the process cwd: a guard comparing only with process.cwd() accepts it.
  await expect(run(['--version'], join(checkout, 'packages'))).rejects.toThrow(refusal);
  await expect(run(['--version'], join(checkout, 'no-such-folder', 'sub'))).rejects.toThrow(refusal);
  await expect(run(['--version'], '')).rejects.toThrow(refusal);
  const tmp = mkdtempSync(join(tmpdir(), 'accord-guard-'));
  try {
    const ok = await run(['--version'], join(tmp, 'sub', 'deeper'));
    expect(ok.code).toBe(0);
  } finally {
    cleanup(tmp);
  }
});
