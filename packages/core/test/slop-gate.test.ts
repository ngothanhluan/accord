// Phase 8.1 G4b (D-17, 8.1-ac-13): `accord gate done` refuses a slop hit of the ticket's cumulative diff that is neither fixed (gone from the diff) nor justified by a
// `slop:<kind> <path>:<line> — <reason>` line in the last `## Round` of review.md. The host supplies the hits (slopFacts); the rule judges them against the record.
import { expect, it } from 'vitest';
import { gateDone, LOCKED, OVERRIDABLE, SLOP_FROM, SLOP_OK, STAGE_OF, workOf } from '../src/index.js';
import type { RepoSnapshot, SlopHit } from '../src/index.js';
import { claimedUnder, facts, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';
import type { RoundSpec } from '../../../test/helpers/review-v2.js';

const RULE = 'gate.slop-unresolved';
const HIT: SlopHit = { kind: 'empty-catch', path: 'src/a.ts', line: 3, label: 'an empty catch block' };
const LINE = 'slop:empty-catch src/a.ts:3 — the error is logged by the caller';

/** A lane M review snapshot with `cycles`, claimed under `pin`; `fact` is what the host read from git (absent: no facts). */
function build(cycles: RoundSpec[][], fact?: { hits: SlopHit[]; unread: number } | { error: string }, pin: string = SLOP_FROM): RepoSnapshot {
  const count = cycles.flat().length;
  const snap = claimedUnder(scopeSnapshot({ review: v2Review(cycles), facts: facts(Array.from({ length: count }, () => [])) }), pin);
  return (fact === undefined ? snap : { ...snap, slopFacts: { 'T-1': fact } }) as RepoSnapshot;
}
const found = (snap: RepoSnapshot) => gateDone(snap, 'T-1').findings.filter((f) => f.rule === RULE);
const lastRound = (...lines: string[]): RoundSpec[][] => [[{ lines: [] }, { lines }]];

it('risk:parsing the justification is read from the last review round only and must name kind path and line exactly (D-17)', () => {
  const read = (...lines: string[]) => workOf(scopeSnapshot({ review: v2Review(lastRound(...lines)) }), 'T-1')?.review?.slopJustified;
  const want = [{ kind: 'empty-catch', path: 'src/a.ts', line: 3, reason: 'reason' }];
  // with a list marker or without one: the loop strips the marker, and SLOP_OK takes one itself
  expect(read('slop:empty-catch src/a.ts:3 — reason')).toEqual(want);
  expect(read('- slop:empty-catch src/a.ts:3 — reason')).toEqual(want);
  expect(read('1. slop:empty-catch src/a.ts:3 — reason')).toEqual(want);
  expect(read('* slop:empty-catch src/a.ts:3 — reason', '+ slop:empty-catch src/a.ts:3 — reason')).toHaveLength(2);
  expect(SLOP_OK.exec('- slop:empty-catch src/a.ts:3 — reason')?.slice(1)).toEqual(['empty-catch', 'src/a.ts', '3', 'reason']);
  expect(SLOP_OK.exec('slop:empty-catch src/a.ts:3 — reason')?.[3]).toBe('3');
  // a path holding a colon and spaces is everything up to the last ":<line> — "
  expect(SLOP_OK.exec('slop:new-dependency my dir/a:b.ts:12 — reason')?.slice(1)).toEqual(['new-dependency', 'my dir/a:b.ts', '12', 'reason']);
  // no reason, no line number, a line number of zero and a path-less line are not read
  expect(read('slop:empty-catch src/a.ts:3')).toBeUndefined();
  expect(read('slop:empty-catch src/a.ts:3 — ')).toBeUndefined();
  expect(read('slop:empty-catch src/a.ts — reason')).toBeUndefined();
  expect(read('slop:empty-catch src/a.ts:0 — reason')).toBeUndefined();
  expect(read('Slop: empty-catch src/a.ts:3 — reason')).toBeUndefined();
  // an earlier round is not read: only the last `## Round` counts
  const early = workOf(scopeSnapshot({ review: v2Review([[{ lines: [LINE] }, { lines: [] }]]) }), 'T-1')?.review?.slopJustified;
  expect(early).toBeUndefined();
});

it('risk:complex-branching the slop gate refuses an unresolved hit with the exact line to write and passes once the last round names it (8.1-ac-13)', () => {
  const hits = { hits: [HIT], unread: 0 };
  const refused = found(build(lastRound(), hits));
  expect(refused).toHaveLength(1);
  expect(refused[0]).toMatchObject({ level: 'error', file: 'accord/tickets/T-1/review.md' });
  expect(refused[0].reason).toContain('slop:empty-catch src/a.ts:3 is neither fixed nor justified');
  expect(refused[0].reason).toContain('"slop:empty-catch src/a.ts:3 — <reason>"');
  expect(refused[0].reason).toContain('last ## Round of review.md');
  // each form of the line resolves the hit
  for (const marker of ['', '- ', '1. ']) expect(found(build(lastRound(marker + LINE), hits)), marker).toEqual([]);
  // a line of another number, another kind or another path does not
  for (const wrong of ['slop:empty-catch src/a.ts:4 — r', 'slop:any-type src/a.ts:3 — r', 'slop:empty-catch src/b.ts:3 — r']) {
    expect(found(build(lastRound(wrong), hits)), wrong).toHaveLength(1);
  }
  // the line in an earlier round does not
  expect(found(build([[{ lines: [LINE] }, { lines: [] }]], hits))).toHaveLength(1);
  // one finding per unresolved hit, in the hits' order; a hit that is gone needs no line (the host lists only what the diff still holds)
  const two = { hits: [HIT, { kind: 'any-type', path: 'src/b.ts', line: 9, label: 'any' }], unread: 0 };
  expect(found(build(lastRound(LINE), two)).map((f) => f.reason)).toEqual([expect.stringContaining('slop:any-type src/b.ts:9')]);
  expect(found(build(lastRound(), { hits: [], unread: 0 }))).toEqual([]);
});

it('risk:regression the slop gate reads no fact for a ticket the host did not load and leaves with the review stage (D-17)', () => {
  // no fact for the ticket (claimed before SLOP_FROM, no record, no git): nothing to judge
  expect(found(build(lastRound(), undefined))).toEqual([]);
  // the rule leaves with the review stage, as gate.security-unreviewed does, and is not on the locked floor
  expect(STAGE_OF[RULE]).toBe('review');
  expect(STAGE_OF['gate.security-unreviewed']).toBe('review');
  expect(LOCKED).not.toContain(RULE);
  expect(OVERRIDABLE).not.toContain(RULE);
});
