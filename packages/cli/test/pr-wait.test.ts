// Phase 15 plan 06 (D-22, D-21): `accord pr wait <id>` follows a ticket's pull request with `gh` and no model. `gh` is intercepted as in tracker-status.test.ts: a recorded argv array,
// never a spawn, so no case reaches GitHub and the author's real login is never read. `git` stays real, in tmp sandboxes.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, makeLaneRepo, run } from './helpers/repo.js';

/** What the fake `gh` answers: a string is stdout, an Error is a failed call. Set per case. */
const gh = vi.hoisted(() => ({
  calls: [] as { args: string[]; opts: unknown }[],
  answer: ((_args: string[]) => '') as (args: string[]) => string | Error,
}));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFileSync: (file: string, args: string[], opts: unknown) => {
      if (file !== 'gh') return (actual.execFileSync as unknown as (...a: unknown[]) => unknown)(file, args, opts);
      gh.calls.push({ args, opts });
      const out = gh.answer(args);
      if (out instanceof Error) throw out;
      return out;
    },
  };
});

const dirs: string[] = [];
beforeEach(() => {
  gh.calls.length = 0;
  gh.answer = () => '';
});
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

function sandbox(): string {
  const repo = makeLaneRepo();
  dirs.push(repo);
  return repo;
}

const lastLine = (out: string): string => out.trimEnd().split('\n').at(-1) ?? '';

it('risk:regression accord pr wait reports a merged pull request as its last line and exits 0 (D-22)', async () => {
  const repo = sandbox();
  gh.answer = (args) => {
    if (args[0] === 'api' && args[1] === 'user') return 'me\n';
    if (args[0] === 'pr' && args[1] === 'list') return JSON.stringify([{ number: 7, state: 'MERGED', url: 'https://github.com/o/r/pull/7' }]);
    if (args[0] === 'pr' && args[1] === 'view') return JSON.stringify({ number: 7, state: 'MERGED', mergedAt: '2026-11-25T14:40:16Z', url: 'https://github.com/o/r/pull/7' });
    return '';
  };
  const r = await run(['pr', 'wait', 'T-1'], repo);
  expect(r.code, r.out + r.err).toBe(0);
  expect(lastLine(r.out)).toBe('pr-wait: merged #7');
  // argv arrays that name only the read verbs, never a shell
  const verbs = new Set(gh.calls.map((c) => c.args[0]));
  expect([...verbs].every((v) => v === 'pr' || v === 'api')).toBe(true);
  expect(gh.calls.map((c) => c.args.join(' ')).some((a) => /^pr list .*--head t\/T-1/.test(a))).toBe(true);
  for (const c of gh.calls) expect(JSON.stringify(c.opts)).not.toMatch(/"shell":\s*true/);
});
