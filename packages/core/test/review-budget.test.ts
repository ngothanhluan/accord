// Phase 10 D-06 (as amended per slice 2026-11-28), D-15, 10-ac-4, 10-ac-11: the review loop of a lane M ticket claimed at or after REVIEW_BUDGET_FROM has a budget of 3 rounds with a
// count-fall stop; a ticket claimed earlier keeps the five rounds and the stop from round 3 it was claimed under, and lanes S and R keep their caps. The cap reads the ticket's claim pin
// through claimPinBefore, and `strictness.rounds.review` replaces only `cap`.
import { expect, it } from 'vitest';
import { LEGACY_CAP, REVIEW_BUDGET, REVIEW_BUDGET_FROM, capRulesOf, fixModel, gateDone, loadSnapshot, nextRound, roundText } from '../src/index.js';
import type { ClaimPin, RepoSnapshot } from '../src/index.js';
import { CONFIG, LANE_S_BODY, P, done, laneTicket } from '../../../test/helpers/lane.js';
import { v2Review } from '../../../test/helpers/review-v2.js';

const RULINGS = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
const HEAD = 'Round record: 1\n\n';
const should = (n: number, state = 'open', ...marks: string[]): string => `Should ${n} [patch]: a comma is not quoted — src/export.ts:9 — ${state}${marks.map((m) => ' — ' + m).join('')}`;
const must = (n: number, state = 'open', ...marks: string[]): string => `Must ${n} [patch]: the export overwrites the old file — src/export.ts:3 — ${state}${marks.map((m) => ' — ' + m).join('')}`;
const NONE = 'No findings';
const shoulds = (k: number, state = 'open'): string[] => (k === 0 ? [NONE] : Array.from({ length: k }, (_, i) => should(i + 1, state)));
/** A version 1 review record: each round is its finding lines. */
const record = (...rounds: string[][]): string => HEAD + rounds.map((lines, i) => `## Round ${i + 1}\n\n${lines.join('\n')}\n\n`).join('');
/** A version 2 review record (heads, and the risk marks a version 1 review line does not read): each round is its finding lines. */
const v2 = (rounds: string[][], tail = ''): string => v2Review([rounds.map((lines) => ({ lines: lines[0] === NONE ? [] : lines }))], tail);
const allow = (n: number, after: number): string => `- Ruling: the owner allows ${n} more review rounds after round ${after} of cycle 1 — "one more" — cost if wrong: ${n} rounds\n`;

interface Opts {
  lane?: 'M' | 'S';
  claim?: ClaimPin;
  review?: string;
  ledger?: string;
  config?: string;
}
function repo({ lane = 'M', claim = { pin: REVIEW_BUDGET_FROM }, review, ledger = '', config = CONFIG }: Opts = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': config };
  if (lane === 'S') files[P('T-1')] = laneTicket('T-1', { lane: 'S', body: LANE_S_BODY });
  else done(files, 'T-1');
  files['accord/tickets/T-1/ledger.md'] = RULINGS + ledger;
  if (review !== undefined) files['accord/tickets/T-1/review.md'] = review;
  return { ...loadSnapshot({ files, tree: Object.keys(files) }), claimPins: { 'T-1': claim } };
}
const strict = (review: string): string => CONFIG + `strictness:\n  rounds:\n    review: "${review}"\n`;
const before = { pin: '0.23.1' };

it('risk:regression the review budget cut-off is 0.24.0 and its rules are three rounds with the count stop (10-ac-4, D-06)', () => {
  expect(REVIEW_BUDGET_FROM).toBe('0.24.0');
  expect(REVIEW_BUDGET).toEqual({ cap: 3, fall: true, allowances: true, capStop: true });
});

it('risk:regression capRulesOf gives the budget to a lane M claim at the cut-off and keeps five rounds for 0.23.1, lane S and a team cap only replaces the cap (10-ac-4, 10-ac-11, D-06)', () => {
  expect(capRulesOf(repo(), 'T-1', 'review')).toBe(REVIEW_BUDGET);
  expect(capRulesOf(repo({ claim: before }), 'T-1', 'review')).toBe(LEGACY_CAP);
  expect(capRulesOf(repo({ lane: 'S' }), 'T-1', 'review')).toBe(LEGACY_CAP);
  expect(capRulesOf(repo({ lane: 'S', claim: before }), 'T-1', 'review')).toBe(LEGACY_CAP);
  // a failed claim read fails closed to the new rules, as every claim-pin rule does
  expect(capRulesOf(repo({ claim: { error: 'git failed' } }), 'T-1', 'review')).toBe(REVIEW_BUDGET);
  // `strictness.rounds.review` replaces only the cap: the count stop stays
  expect(capRulesOf(repo({ config: strict('5') }), 'T-1', 'review')).toEqual({ ...REVIEW_BUDGET, cap: 5 });
  expect(capRulesOf(repo({ config: strict('5'), claim: before }), 'T-1', 'review')).toEqual({ ...LEGACY_CAP, cap: 5 });
});

it('risk:regression a budget stop before a fourth round: three rounds whose count falls still stop at the budget and name it (10-ac-4, D-06)', () => {
  const answer = nextRound(repo({ review: record(shoulds(3), shoulds(2), shoulds(1)) }), 'T-1', 'review');
  expect(answer.kind).toBe('stop');
  expect(answer.round).toBe(3);
  expect(answer.reasons.join('\n')).toContain('budget of 3 review rounds');
  expect(answer.reasons.join('\n')).toContain('D-06');
  const text = roundText(answer);
  expect(text.startsWith('stop: report to owner\n')).toBe(true);
  expect(text).toContain(should(1));
});

it('risk:regression a round whose Must + Should count did not fall from the round before stops the loop, an equal count included (10-ac-4, D-06)', () => {
  const equal = nextRound(repo({ review: record(shoulds(2), shoulds(2)) }), 'T-1', 'review');
  expect(equal.kind).toBe('stop');
  expect(equal.reasons.join('\n')).toContain('the count did not fall');
  expect(roundText(equal)).toContain('stop: report to owner');
  const falling = nextRound(repo({ review: record(shoulds(2), shoulds(1)) }), 'T-1', 'review');
  expect(falling).toMatchObject({ kind: 'next', round: 3, cap: 3 });
  expect(roundText(falling)).toBe('Round: 3 of 3\nCycle: 1\nFix executor model: sonnet\n');
});

it('risk:regression a ticket claimed under 0.23.1 keeps the cap of 5 with the stop from round 3 (10-ac-11)', () => {
  // round 3 clean: today's answer
  expect(roundText(nextRound(repo({ claim: before, review: record(shoulds(3, 'fixed in abc1235'), shoulds(2, 'fixed in abc1235'), shoulds(0)) }), 'T-1', 'review'))).toBe('Round: 4 of 5\nCycle: 1\nFix executor model: opus\n');
  // round 3 still reports a Should: today's stop, its wording unchanged
  const stop = nextRound(repo({ claim: before, review: record(shoulds(3), shoulds(2), shoulds(1)) }), 'T-1', 'review');
  expect(stop.kind).toBe('stop');
  expect(stop.reasons).toEqual(['round 3 of cycle 1 still reports a Should or a Must, and from round 3 such a round stops the loop']);
});

it('risk:regression fixModel tiers up only past a raised budget: round 4 of a team cap of 5, never inside the budget of 3 (10-ac-4, D-06)', () => {
  const four = record(shoulds(3, 'fixed in abc1235'), shoulds(2, 'fixed in abc1235'), shoulds(1, 'fixed in abc1235'), shoulds(0));
  const raised = repo({ config: strict('5'), review: four });
  expect(fixModel(raised, 'T-1', 4)).toEqual({ model: 'opus' });
  expect(fixModel(repo({ config: strict('5'), review: record(shoulds(3), shoulds(2), shoulds(1)) }), 'T-1', 3)).toEqual({ model: 'sonnet' });
  // the default budget never reaches round 4 of its own
  expect(fixModel(repo({ review: record(shoulds(1), shoulds(0)) }), 'T-1', 2)).toEqual({ model: 'sonnet' });
  // a ticket claimed under 0.23.1 tiers up at round 4 as before
  expect(fixModel(repo({ claim: before, review: four }), 'T-1', 4)).toEqual({ model: 'opus' });
});

it('risk:security an accepted-by-owner verdict at the budget stop lifts an ordinary finding but never an open data-loss or security one (10-ac-4, D-06, T-10-04)', () => {
  const rule = (snap: RepoSnapshot): string[] => gateDone(snap, 'T-1').findings.filter((f) => f.rule === 'gate.review-rounds').map((f) => f.reason);
  const verdict = 'verdict: accepted-by-owner "ship it with the comma issue open"\n';
  // no risk mark: the owner's words lift the stop
  const ordinary = repo({ review: v2([shoulds(3), shoulds(2), shoulds(1)], verdict) });
  expect(rule(ordinary)).toEqual([]);
  expect(rule(repo({ review: v2([shoulds(3), shoulds(2), shoulds(1)]) }))).toHaveLength(1);
  // an open security finding in the cycle stays refused after the verdict, and the refusal names it and the Ruling form accord round prints
  for (const kind of ['security', 'data-loss']) {
    const risky = repo({ review: v2([shoulds(3), [should(1), must(2, 'open', `risk: ${kind}`)], shoulds(1)], verdict) });
    const refused = rule(risky);
    expect(refused, kind).toHaveLength(1);
    expect(refused[0], kind).toContain(`risk: ${kind}`);
    expect(refused[0], kind).toContain('2.2');
    expect(refused[0], kind).toContain('Ruling: the owner allows');
    // it is fixed in a round an owner allowance Ruling allows: a fourth round that reports nothing clears the stop and the finding
    const fixedFinding = repo({
      review: v2([shoulds(3), [should(1), must(2, 'fixed in abc1235 — checked: src/export.ts:3 — addressed: src/export.ts:3', `risk: ${kind}`)], shoulds(1), shoulds(0)], verdict),
      ledger: allow(1, 3),
    });
    expect(rule(fixedFinding), kind).toEqual([]);
  }
  // a ticket claimed under 0.23.1 is held to nothing new
  const older = repo({ claim: before, review: v2([shoulds(3), [should(1), must(2, 'open', 'risk: security')], shoulds(1)], verdict) });
  expect(rule(older)).toEqual([]);
});
