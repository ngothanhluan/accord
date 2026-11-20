// Phase 8.1 G3a (D-08, D-09): `accord audit` prints facts and gaps from files only, spends no model call and exits 0 whatever it finds.
import { afterEach, expect, it } from 'vitest';
import { cleanup, makeEmptyRepo, run } from './helpers/repo.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

it('risk:complex-branching accord audit lists an empty conventions file as a gap and exits 0 (8.1-ac-8)', async () => {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  const init = await run(['init'], repo);
  expect(init.code, init.out + init.err).toBe(0);

  const r = await run(['audit'], repo);
  expect(r.code, r.out + r.err).toBe(0);
  const lines = r.out.split('\n').filter((l) => l !== '');
  expect(lines.some((l) => l.startsWith('gap: conventions-empty:') && l.includes('/accord-audit')), r.out).toBe(true);
  expect(lines.some((l) => l.startsWith('fact: conventions:')), r.out).toBe(true);
  expect(lines.at(-1)).toMatch(/^gaps: \d+$/);
});
