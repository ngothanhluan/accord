// Phase 08.8 plan 08 (D-15): the refusals of `accord worktree open` keep the reader in the same session, so they say in plain words what to ask.
// One case on purpose: the refusal is printed by the real command in a git sandbox, and this file stays the fastest cli file that can show it.
import { expect, it, vi } from 'vitest';
import { gitRun, run } from './helpers/repo.js';
import { copy, teammate, useSandboxes } from './helpers/worktree.js';

// the shared sandbox helper resets these two mocks after each case, as worktree-open.test.ts declares them
vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{ tickets: ['ST-9'] }]);

// Phase 08.8 D-15: a ticket claimed by someone else is refused in words, with no typed `/accord continue`.
it('risk:regression worktree open on a ticket claimed by someone else asks in plain words (D-15)', async () => {
  const c = copy({ tickets: ['ST-9'] });
  const o = teammate(c);
  gitRun(o, 'switch', '-q', '-c', 't/ST-9', 'main');
  gitRun(o, 'commit', '-q', '--allow-empty', '-m', 'claim: ST-9');
  gitRun(o, 'push', '-q', 'origin', 't/ST-9');
  c.git('fetch', '-q', 'origin');
  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('to work on it with them, ask to continue ST-9');
  expect(r.err).not.toContain('/accord continue');
});
