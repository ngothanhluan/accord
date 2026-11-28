// Phase 10 D-06 (as amended per slice 2026-11-28), D-15, 10-ac-4, 10-ac-30, 10-ac-31: on a sliced ticket the review budget counts the rounds of the slice in work only, the last slice's final review has its own fix and re-check
// outside it, and `accord gate done` reads the same counts as `accord round`. On real git: slice 1 on the claim branch, slice 2 on `slice/T-1/2` cut at its tip.
import { expect, it } from 'vitest';
import { cleanup, gitRun, run } from './helpers/repo.js';
import { must, should, shoulds, slicedReviewed } from './helpers/review-budget.js';

const NONE: string[] = [];
// slice 1: three rounds, the count falls and the last is clean
const SLICE_ONE = [{ lines: shoulds(2) }, { lines: shoulds(1) }, { lines: NONE }];
const verdict = '\nverdict: accepted-by-owner "ship it"\n';

const asked = async (repo: string): Promise<{ code: number; out: string }> => {
  const r = await run(['round', 'T-1'], repo);
  expect(r.err).toBe('');
  return { code: r.code, out: r.out };
};
interface Found { rule: string; reason: string }
const roundsGate = async (repo: string, ...flags: string[]): Promise<Found[]> => {
  const r = await run(['gate', 'done', 'T-1', ...flags, '--json'], repo);
  expect(r.code === 2, r.err).toBe(false);
  return (JSON.parse(r.out) as { findings: Found[] }).findings.filter((f) => f.rule === 'gate.review-rounds');
};

it('risk:regression slice 2 has its own budget: rounds 4 and 5 recorded, round 6 is its third and last (10-ac-4, D-06)', async () => {
  const repo = slicedReviewed('0.24.0', SLICE_ONE, [{ lines: shoulds(2) }, { lines: shoulds(1) }]);
  const stopped = slicedReviewed('0.24.0', SLICE_ONE, [{ lines: shoulds(2) }, { lines: shoulds(1) }, { lines: shoulds(1) }]);
  try {
    const next = await asked(repo);
    expect(next.code).toBe(0);
    expect(next.out).toContain('Round: 6 of 6\n');
    // round 6 recorded and still holding an open Should: the budget of the slice is used, and the count did not fall
    const stop = await asked(stopped);
    expect(stop.code).toBe(1);
    expect(stop.out.startsWith('stop: report to owner\n')).toBe(true);
    expect(stop.out).toContain('budget of 3 review rounds');
  } finally {
    cleanup(repo);
    cleanup(stopped);
  }
}, 180_000);

it('risk:regression on the last slice a final review (round 7) and its re-check (round 8) are outside slice 2\'s budget, and a Must still open after round 8 stops (10-ac-30, D-15)', async () => {
  const used = [{ lines: shoulds(2) }, { lines: shoulds(1) }, { lines: NONE }];
  const beforeFinal = slicedReviewed('0.24.0', SLICE_ONE, used);
  const final = slicedReviewed('0.24.0', SLICE_ONE, [...used, { final: true as const, lines: shoulds(1) }]);
  const open = slicedReviewed('0.24.0', SLICE_ONE, [...used, { final: true as const, lines: shoulds(1) }, { lines: [must(1)] }]);
  try {
    expect((await asked(beforeFinal)).out).toContain('Round: 7 of 8\n');
    const recheck = await asked(final);
    expect(recheck.code).toBe(0);
    expect(recheck.out).toContain('Round: 8 of 8\n');
    const stop = await asked(open);
    expect(stop.code).toBe(1);
    expect(stop.out.startsWith('stop: report to owner\n')).toBe(true);
    expect(stop.out).toContain("the final review's one fix and one re-check (D-15) are used");
  } finally {
    cleanup(beforeFinal);
    cleanup(final);
    cleanup(open);
  }
}, 180_000);

it('risk:regression no round of an earlier slice counts against the slice in work, and on slice 1 only its own rounds exist (10-ac-4, D-06)', async () => {
  const repo = slicedReviewed('0.24.0', SLICE_ONE, [{ lines: shoulds(2) }, { lines: shoulds(1) }]);
  try {
    gitRun(repo, 'switch', '-q', 't/T-1');
    // the claim branch's review.md holds rounds 1 to 3 only: the budget is used and clean, so the final review comes next
    const answer = await asked(repo);
    expect(answer.code).toBe(0);
    expect(answer.out).toContain('Round: 4 of 5\n');
  } finally {
    cleanup(repo);
  }
}, 180_000);

it('risk:regression a slice start git cannot read counts every round of the cycle and the answer says why (T-10-05)', async () => {
  const repo = slicedReviewed('0.24.0', SLICE_ONE, [{ lines: shoulds(2) }, { lines: shoulds(1) }]);
  try {
    // the branch slice 2 was cut from is gone: no start can be read for slice 2
    gitRun(repo, 'branch', '-D', 't/T-1');
    const answer = await asked(repo);
    expect(answer.code).toBe(1);
    expect(answer.out).toContain('past the budget of 3 review rounds (D-06)');
    expect(answer.out).toContain('git cannot say where slice 2 starts, so every review round of the cycle counts');
  } finally {
    cleanup(repo);
  }
}, 180_000);

it('risk:regression the Intent line on a slice budget stop names a finding first raised in the slice\'s first round, never one of round 1 (10-ac-31, D-15)', async () => {
  const repo = slicedReviewed(
    '0.24.0',
    [{ lines: [should(1)] }, { lines: NONE }, { lines: NONE }],
    [{ lines: [should(1)] }, { lines: [should(1, 'open', 'carried from 4.1'), should(2)] }],
  );
  try {
    const stop = await asked(repo);
    expect(stop.code).toBe(1);
    expect(stop.out.split('\n').filter((l) => l.startsWith('Intent:'))).toEqual(['Intent: 4.1 raised in round 4 and still open: they may be an intent problem (the criterion or the approach), not a code fix; ask the owner']);
  } finally {
    cleanup(repo);
  }
}, 180_000);

it('risk:regression accord gate done reads the same counts as accord round, with and without --slice (10-ac-4, D-06)', async () => {
  const ok = slicedReviewed('0.24.0', SLICE_ONE, [{ lines: shoulds(2) }, { lines: shoulds(1) }, { lines: NONE }], { tail: '\nverdict: converged\n' });
  const stopped = slicedReviewed('0.24.0', SLICE_ONE, [{ lines: shoulds(2) }, { lines: shoulds(1) }, { lines: shoulds(1) }]);
  const lifted = slicedReviewed('0.24.0', SLICE_ONE, [{ lines: shoulds(2) }, { lines: shoulds(1) }, { lines: shoulds(1) }], { tail: verdict });
  try {
    // slice 2's rounds 4 to 6 are within its budget: no finding, with the slice named and without it
    expect(await roundsGate(ok, '--slice', '2')).toEqual([]);
    expect(await roundsGate(ok)).toEqual([]);
    // the budget used with an open Should stops for the owner until the verdict lifts it
    const found = await roundsGate(stopped, '--slice', '2');
    expect(found).toHaveLength(1);
    expect(found[0].reason).toContain('round 6 of cycle 1');
    expect(await roundsGate(lifted, '--slice', '2')).toEqual([]);
    // slice 1 on its own branch: three rounds, the last clean
    gitRun(ok, 'switch', '-q', 't/T-1');
    expect(await roundsGate(ok, '--slice', '1')).toEqual([]);
  } finally {
    cleanup(ok);
    cleanup(stopped);
    cleanup(lifted);
  }
}, 240_000);
