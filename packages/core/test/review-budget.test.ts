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
type Spec = string[] | { final: string[] };
const v2 = (rounds: Spec[], tail = ''): string =>
  v2Review([rounds.map((r) => ('final' in r ? { lines: r.final[0] === NONE ? [] : r.final, mark: 'final' as const } : { lines: r[0] === NONE ? [] : r }))], tail);
const allow = (n: number, after: number): string => `- Ruling: the owner allows ${n} more review rounds after round ${after} of cycle 1 — "one more" — cost if wrong: ${n} rounds\n`;

interface Opts {
  lane?: 'M' | 'S';
  claim?: ClaimPin;
  review?: string;
  ledger?: string;
  config?: string;
}
const checked = 'checked: src/export.ts:9 — addressed: src/export.ts:9';
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

const NONE_ROUND = shoulds(0);
const fixedLine = (n: number, ...marks: string[]): string => should(n, 'fixed in abc1235 — ' + checked, ...marks);

it('risk:regression the final review and its one re-check are outside the budget: a re-check that answers its fix gives the verdict answer and no stop (10-ac-30, D-15)', () => {
  const answer = nextRound(repo({ review: v2([shoulds(1), NONE_ROUND, { final: [fixedLine(1)] }, NONE_ROUND]) }), 'T-1', 'review');
  expect(answer.kind).toBe('refused');
  expect(answer.round).toBe(4);
  expect(answer.reasons.join('\n')).toContain('reported no findings');
  expect(roundText(answer)).not.toContain('stop: report to owner');
});

it('risk:regression after a budget of three clean rounds the final review is allowed as a fourth, and its re-check as a fifth: Round 5 of 5 (10-ac-30, D-15)', () => {
  const used = [shoulds(2), shoulds(1), NONE_ROUND];
  // the final review is asked for after the budget: round 4 of 5
  expect(roundText(nextRound(repo({ review: v2(used) }), 'T-1', 'review'))).toBe('Round: 4 of 5\nCycle: 1\nFix executor model: sonnet\n');
  // recorded, its one re-check follows
  const reviewed = nextRound(repo({ review: v2([...used, { final: shoulds(1) }]) }), 'T-1', 'review');
  expect(reviewed).toMatchObject({ kind: 'next', round: 5, cap: 5 });
  expect(roundText(reviewed)).toContain('Round: 5 of 5\n');
  // a sixth round runs past the final review's one fix and one re-check, and no owner Ruling allows it
  const sixth = nextRound(repo({ review: v2([...used, { final: shoulds(1) }, shoulds(0), shoulds(0)]) }), 'T-1', 'review');
  expect(sixth.kind).toBe('stop');
  expect(sixth.reasons.join('\n')).toContain("past the final review's one fix and one re-check (D-15)");
  // an owner allowance Ruling allows it
  expect(nextRound(repo({ review: v2([...used, { final: shoulds(1) }, shoulds(1), shoulds(0)]), ledger: allow(1, 5) }), 'T-1', 'review').kind).not.toBe('next');
  expect(nextRound(repo({ review: v2([...used, { final: shoulds(1) }, shoulds(1)]), ledger: allow(1, 5) }), 'T-1', 'review')).toMatchObject({ kind: 'next', round: 6 });
  // an ordinary fourth round, not headed (final review), is past the budget
  const ordinary = nextRound(repo({ review: v2([...used, shoulds(0)]) }), 'T-1', 'review');
  expect(ordinary.reasons.join('\n')).toContain('past the budget of 3 review rounds (D-06)');
});

it('risk:regression a Must or Should still open after the re-check of the final review is a stop that names its one fix and one re-check as used (10-ac-30, D-15)', () => {
  const answer = nextRound(repo({ review: v2([shoulds(1), NONE_ROUND, { final: shoulds(1) }, shoulds(1)]) }), 'T-1', 'review');
  expect(answer.kind).toBe('stop');
  expect(answer.round).toBe(4);
  expect(answer.reasons.join('\n')).toContain("the final review's one fix and one re-check (D-15) are used");
  expect(roundText(answer)).toContain('stop: report to owner');
});

it('risk:regression the count-fall stop never fires on the final review or its re-check (10-ac-30, D-15)', () => {
  // a final review with two Should after a round with one: no stop, its re-check is asked
  const answer = nextRound(repo({ review: v2([shoulds(2), shoulds(1), { final: shoulds(2) }]) }), 'T-1', 'review');
  expect(answer).toMatchObject({ kind: 'next', round: 4, cap: 4 });
  // the same two rounds without the mark stop on the count
  expect(nextRound(repo({ review: v2([shoulds(2), shoulds(1), shoulds(2)]) }), 'T-1', 'review').kind).toBe('stop');
  // a ticket claimed under 0.23.1 counts the final review as a round of the five
  expect(nextRound(repo({ claim: before, review: v2([shoulds(2), shoulds(1), { final: shoulds(2) }]) }), 'T-1', 'review').kind).toBe('stop');
});

it('risk:regression a budget stop names the round-1 findings still open as a possible intent problem, once, and only for findings with no risk mark (10-ac-31, D-15)', () => {
  const rounds = (risk: string[]): Spec[] => [
    [fixedLine(1), should(2, 'open', ...risk)],
    [should(1)],
    [should(1, 'open', 'carried from 1.2')],
  ];
  const stop = nextRound(repo({ review: v2(rounds([])) }), 'T-1', 'review');
  expect(stop.kind).toBe('stop');
  expect(stop.intentHint).toEqual(['1.2']);
  const text = roundText(stop);
  expect(text.split('\n').filter((l) => l.startsWith('Intent:'))).toEqual(['Intent: 1.2 raised in round 1 and still open: they may be an intent problem (the criterion or the approach), not a code fix; ask the owner']);
  // the findings keep their class: they are still listed as the open findings of the stop
  expect(text).toContain('Findings of round 3:');
  // marked data-loss or security, 1.2 and its carry are a risk: no Intent line
  for (const kind of ['data-loss', 'security']) {
    const risky = nextRound(repo({ review: v2(rounds([`risk: ${kind}`])) }), 'T-1', 'review');
    expect(risky.kind).toBe('stop');
    expect(risky.intentHint).toBeUndefined();
    expect(roundText(risky)).not.toContain('Intent:');
  }
  // a stop at the final review's re-check is not a budget stop: no Intent line
  const final = nextRound(repo({ review: v2([[should(1)], NONE_ROUND, { final: [should(1, 'open', 'carried from 1.1')] }, [should(1, 'open', 'carried from 3.1')]]) }), 'T-1', 'review');
  expect(final.kind).toBe('stop');
  expect(final.intentHint).toBeUndefined();
});

const sliced = (snapshot: RepoSnapshot, fact: { before: number } | { error: string }): RepoSnapshot => ({ ...snapshot, sliceRounds: { 'T-1': fact } });

it('risk:regression the budget counts the rounds after the slice start, an unreadable start counts every round and says why, and fixModel counts the slice only (10-ac-4, D-06, T-10-05)', () => {
  const five = v2([shoulds(3), shoulds(2), [NONE], shoulds(2), shoulds(1)]);
  // slice 2 started after round 3: rounds 4 and 5 are its first two, round 6 its third
  const answer = nextRound(sliced(repo({ review: five }), { before: 3 }), 'T-1', 'review');
  expect(answer).toMatchObject({ kind: 'next', round: 6, cap: 6 });
  expect(answer.reasons).toEqual([]);
  // the same record with no fact: every round counts, and round 4 is past the budget of three
  expect(nextRound(repo({ review: five }), 'T-1', 'review').kind).toBe('stop');
  // a start git could not read: the same, and the answer says why
  const failed = nextRound(sliced(repo({ review: five }), { error: 'git cannot say where slice 2 starts, so every review round of the cycle counts' }), 'T-1', 'review');
  expect(failed.kind).toBe('stop');
  expect(failed.reasons.join('\n')).toContain('git cannot say where slice 2 starts');
  // the tier-up counts the slice's rounds: round 5 is the second of slice 2, so the default tier of 4 is not reached
  expect(fixModel(sliced(repo({ review: five }), { before: 3 }), 'T-1', 5)).toEqual({ model: 'sonnet' });
  // a fact larger than the record leaves nothing before the stretch
  expect(nextRound(sliced(repo({ review: v2([shoulds(2)]) }), { before: 9 }), 'T-1', 'review')).toMatchObject({ kind: 'next', round: 2, cap: 4 });
});
