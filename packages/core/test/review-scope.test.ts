// ST-LN-57 Task 5: the review record held against git: the final review, the added code mark and the version cut-over.
import { expect, it } from 'vitest';
import { gateDone, pendingAddedCode, scopeProblems } from '../src/index.js';
import type { RangeCommit, RepoSnapshot, RoundFacts } from '../src/index.js';
import { H, commit, facts, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';
import type { RoundSpec } from '../../../test/helpers/review-v2.js';

const ALLOW_2 = '- Ruling: the owner allows 2 more review rounds after round 2 of cycle 1 — "go on" — cost if wrong: 2 rounds\n';
const plain = (n: number, marks: Record<number, 'added' | 'final'> = {}): RoundSpec[] =>
  Array.from({ length: n }, (_, i) => ({ lines: [], ...(marks[i + 1] === undefined ? {} : { mark: marks[i + 1] }) }));
const reasons = (snap: RepoSnapshot, id = 'T-1', rule = 'gate.review-scope'): string[] =>
  gateDone(snap, id).findings.filter((f) => f.rule === rule).map((f) => f.reason);
const empty = (n: number): RangeCommit[][] => Array.from({ length: n }, () => []);
const withRange = (n: number, at: number, ...commits: RangeCommit[]): RangeCommit[][] => empty(n).map((r, i) => (i === at ? commits : r));

it('risk:complex-branching a final review round stands once per stretch as its last round or the one before', () => {
  const four = (marks: Record<number, 'final'>, ledger?: string) => scopeSnapshot({ review: v2Review([plain(4, marks)]), ledger, facts: facts(empty(4)) });
  expect(reasons(four({ 3: 'final' }))).toEqual([]);
  expect(reasons(four({ 4: 'final' }))).toEqual([]);
  expect(reasons(four({ 2: 'final' })).join('\n')).toContain('once per stretch');
  expect(reasons(four({ 3: 'final', 4: 'final' })).join('\n')).toContain('once per stretch');
  expect(reasons(four({ 2: 'final' }, ALLOW_2))).toEqual([]);
  const laneS = scopeSnapshot({ id: 'S-1', lane: 'S', review: v2Review([plain(2, { 2: 'final' })]), facts: facts(empty(2)) });
  expect(reasons(laneS, 'S-1').join('\n')).toContain('lane S has no final review');
});

it('risk:complex-branching the added code mark is asked exactly where a debug episode or a merge added code', () => {
  const at = (ranges: RangeCommit[][], marks: Record<number, 'added' | 'final'> = {}, rounds = 4) =>
    reasons(scopeSnapshot({ review: v2Review([plain(rounds, marks)]), facts: facts(ranges) }));
  const merge = commit(['src/m.ts'], 'merge');

  // (a) a merge that changed code: round 3 reviews it and needs the mark
  expect(at(withRange(4, 1, merge)).join('\n')).toContain('its heading needs (added code round 1)');
  expect(at(withRange(4, 1, merge), { 3: 'added' })).toEqual([]);

  // (b) a clean merge, as one git lists it (no path) and as another git lists it (main's path)
  const clean = commit([], 'merge');
  expect(at(withRange(4, 1, clean))).toEqual([]);
  expect(at(withRange(4, 1, clean), { 3: 'added' })).toEqual([]);
  expect(at(withRange(4, 1, merge))).not.toEqual([]);
  expect(at(withRange(4, 1, merge), { 3: 'added' })).toEqual([]);

  // (c) an episode's code asks the mark; an episode that changed only the ticket's records does not ask it, and allows it
  expect(at(withRange(4, 1, commit(['src/e.ts'], 'episode'))).join('\n')).toContain('added code round 1');
  const records = commit(['accord/tickets/T-1/debug.md'], 'episode');
  expect(at(withRange(4, 1, records))).toEqual([]);
  expect(at(withRange(4, 1, records), { 3: 'added' })).toEqual([]);

  // (d) plain fix commits and the ticket's records: the mark is refused, no mark passes
  const fixes = [commit(['src/a.ts']), commit(['accord/tickets/T-1/review.md'])];
  expect(at(withRange(4, 1, ...fixes), { 3: 'added' }).join('\n')).toContain('remove the mark');
  expect(at(withRange(4, 1, ...fixes))).toEqual([]);

  // (e) a final review in between does not hide the merge from the next round
  expect(at(withRange(4, 1, merge), { 3: 'final' }).join('\n')).toContain('added code round 1');
  expect(at(withRange(4, 1, merge), { 3: 'final' })).toHaveLength(1);

  // (f) code added before the first round of a later cycle: that round passes marked and unmarked
  const cycles = (marks: Record<number, 'added'>) =>
    scopeSnapshot({ review: v2Review([plain(2), [{ lines: [], ...(marks[1] === undefined ? {} : { mark: 'added' as const }) }]]), facts: facts(withRange(3, 1, merge)) });
  expect(reasons(cycles({}))).toEqual([]);
  expect(reasons(cycles({ 1: 'added' }))).toEqual([]);

  // (g) added code after the last round that no round has reviewed
  expect(at(withRange(4, 3, merge)).join('\n')).toContain('no round has reviewed');
  expect(at(withRange(4, 3, clean))).toEqual([]);

  // a version 1 record under an allowing pin gets none of these
  const v1 = scopeSnapshot({
    review: 'Round record: 1\n\n## Round 1\n\nNo findings\n\n## Round 2\n\nNo findings\n\nverdict: converged\n',
    facts: { pin: '0.3.0', heads: [], ranges: [] },
  });
  expect(reasons(v1)).toEqual([]);
});

it('risk:security a version 1 record whose first round lowers the pin below the branch start is refused', () => {
  const v1 = 'Round record: 1\n\n## Round 1\n\nNo findings\n\nverdict: converged\n';
  const lowered: RoundFacts = { pin: '0.3.0', basePin: '0.3.1', heads: [{ high: H(1) }], ranges: [] };
  const why = reasons(scopeSnapshot({ review: v1, facts: lowered })).join('\n');
  expect(why).toContain('0.3.0');
  expect(why).toContain('0.3.1');
  expect(why).toContain('Round record: 2');
  expect(reasons(scopeSnapshot({ review: v1, facts: { ...lowered, basePin: '0.3.0' } }))).toEqual([]);
  expect(reasons(scopeSnapshot({ review: v1, facts: { pin: '0.3.0', heads: [{ high: H(1) }], ranges: [] } }))).toEqual([]);

  // a done ticket re-gated on another ticket's branch: no refusal, one warning
  const onDefault = scopeSnapshot({ review: v1, facts: lowered, doneOnDefault: true });
  expect(reasons(onDefault)).toEqual([]);
  expect(reasons(onDefault, 'T-1', 'gate.review-scope-skipped')).toHaveLength(1);
  expect(scopeProblems(onDefault, 'T-1')).toEqual([]);
  expect(pendingAddedCode(onDefault, 'T-1')).toBe(false);
});
