// Phase 8.5 D-19, R-6, R-10: `accord round` refuses a fixed finding whose `checked:` places no executor fix report lists. The refusal is the fourth FixProblem kind, built only when the
// host supplied the `fixReports` fact, so the three gate rows and `accord gate done` never see it.
import { expect, it } from 'vitest';
import { FIX_RECORD_FROM, PRODUCT_TEXT_FROM, fixProblems, gateDone } from '../src/index.js';
import type { FixReport, RepoSnapshot } from '../src/index.js';
import { claimedUnder, facts, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';

const FIXED = 'Must 1 [patch]: the writer drops the header — src/a.ts:3 — fixed in abc1234 — checked: src/a.ts:3';

const snap = (lines: string[], reports?: Record<string, readonly FixReport[]>, second = false): RepoSnapshot => {
  const cycle = [{ lines }, ...(second ? [{ lines: ['No findings'] }] : [])];
  const base = claimedUnder(scopeSnapshot({ review: v2Review([cycle]), facts: facts(cycle.map(() => [])) }), PRODUCT_TEXT_FROM);
  return reports === undefined ? base : { ...base, fixReports: reports };
};
const report = (...lines: [string, string[]][]): FixReport => ({ file: 'fix-1.md', places: lines.map(([n, places]) => ({ n, places })) });
const reportProblems = (s: RepoSnapshot) => fixProblems(s, 'T-1').filter((p) => p.rule === 'report');

it('risk:regression a fixed finding whose checked places no fix report lists is a report problem only when the host read the reports (D-19 R-6)', () => {
  expect(FIX_RECORD_FROM).toBe('0.6.0');
  // the fact absent: the host did not read reports (gate done, CI, a ticket claimed before the cut-off), so there is no report problem
  expect(reportProblems(snap([FIXED]))).toEqual([]);

  // the fact present with no report: one problem at the finding's line naming the round, the finding, the places and the command
  const none = reportProblems(snap([FIXED], { 'T-1': [] }));
  expect(none).toHaveLength(1);
  expect(none[0].reason).toContain('round 1 of cycle 1');
  expect(none[0].reason).toContain('finding 1');
  expect(none[0].reason).toContain('src/a.ts:3');
  expect(none[0].reason).toContain('accord brief T-1 --fix');
  expect(none[0].awaiting).toBeUndefined();

  // a report line for the finding's number, or `<round>.<n>`, with the same places, covers it
  expect(reportProblems(snap([FIXED], { 'T-1': [report(['1', ['src/a.ts:3']])] }))).toEqual([]);
  expect(reportProblems(snap([FIXED], { 'T-1': [report(['1.1', ['src/a.ts:3']])] }))).toEqual([]);

  // a report line for finding 2 does not cover finding 1; a line whose places differ does not cover it either
  expect(reportProblems(snap([FIXED], { 'T-1': [report(['2', ['src/a.ts:3']])] }))).toHaveLength(1);
  expect(reportProblems(snap([FIXED], { 'T-1': [report(['1', ['src/a.ts:4']])] }))).toHaveLength(1);
  expect(reportProblems(snap([FIXED], { 'T-1': [report(['1', ['src/a.ts:3', 'src/b.ts']])] }))).toHaveLength(1);
  // another round's number does not cover this finding
  expect(reportProblems(snap([FIXED], { 'T-1': [report(['2.1', ['src/a.ts:3']])] }))).toHaveLength(1);

  // an open finding and a fixed finding with no checked mark are no report problem (the places rule names the second)
  expect(reportProblems(snap(['Must 1 [patch]: x — src/a.ts:3 — open'], { 'T-1': [] }))).toEqual([]);
  expect(reportProblems(snap(['Must 1 [patch]: x — src/a.ts:3 — fixed in abc1234'], { 'T-1': [] }))).toEqual([]);
  // a ticket the fact does not name is not judged
  expect(reportProblems(snap([FIXED], { 'T-2': [] }))).toEqual([]);
});

it('risk:parsing report places compare as sets, ignoring order, spaces, backticks and backslashes (D-19 R-6)', () => {
  const two = 'Must 1 [patch]: x — src/a.ts:3 — fixed in abc1234 — checked: src/a.ts:3, `src/b c.ts`:9, src/d.ts';
  const reports = (places: string[]): Record<string, readonly FixReport[]> => ({ 'T-1': [report(['1', places])] });
  expect(reportProblems(snap([two], reports(['src/d.ts', 'src/a.ts:3', 'src/b c.ts:9'])))).toEqual([]);
  expect(reportProblems(snap([two], reports([' src/d.ts ', '`src/a.ts`:3', '`src/b c.ts`:9'])))).toEqual([]);
  expect(reportProblems(snap([two], reports(['src\\d.ts', 'src\\a.ts:3', 'src\\b c.ts:9'])))).toEqual([]);
  // a missing place, an extra place and a repeated place with another missing are not the same set
  expect(reportProblems(snap([two], reports(['src/a.ts:3', 'src/d.ts'])))).toHaveLength(1);
  expect(reportProblems(snap([two], reports(['src/a.ts:3', 'src/d.ts', 'src/b c.ts:9', 'src/e.ts'])))).toHaveLength(1);
  expect(reportProblems(snap([two], reports(['src/a.ts:3', 'src/a.ts:3', 'src/d.ts'])))).toHaveLength(1);
  // any one of several reports may hold the line
  expect(reportProblems(snap([two], { 'T-1': [report(['1', ['src/zzz.ts']]), report(['1', ['src/a.ts:3', 'src/b c.ts:9', 'src/d.ts']])] }))).toEqual([]);
});

it('risk:regression the gate rows never see the report problem (D-19 R-10)', () => {
  // round 1 fixed, round 2 follows with no answer: the answer rule has a problem to report, so the comparison is not empty
  const lines = [FIXED, 'Should 2 [patch]: a cell is wrong — src/b.ts:1 — fixed in abc1234'];
  const rows = (s: RepoSnapshot): { rule: string; reason: string }[] =>
    gateDone(s, 'T-1')
      .findings.filter((f) => ['gate.fix-places-missing', 'gate.fix-not-addressed', 'gate.fix-outside-open'].includes(f.rule))
      .map((f) => ({ rule: f.rule, reason: f.reason }));
  const without = rows(snap(lines, undefined, true));
  expect(without.length).toBeGreaterThan(0);
  const withFact = snap(lines, { 'T-1': [] }, true);
  expect(rows(withFact)).toEqual(without);
  expect(gateDone(withFact, 'T-1').findings.some((f) => f.reason.includes('accord brief'))).toBe(false);
});
