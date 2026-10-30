import { appendFileSync } from 'node:fs';
import { test } from 'vitest';

test('holds a fork', async () => {
  appendFileSync(String(process.env.ACCORD_FORK_CAP_LOG), String(process.env.VITEST_POOL_ID) + '\n');
  await new Promise((r) => setTimeout(r, 1000));
});
