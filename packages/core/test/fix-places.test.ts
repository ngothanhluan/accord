// ST-LN-56 56-ac-1 (D-08, D-16): the finding grammar reads the marks `checked:`, `addressed:` and `not addressed:`, and a fix recorded as `fixed in <sha>` without the places it
// checked is refused at gate done from the 0.6.0 cut-off, in lane M and in lane S, naming the round and the finding.
import { expect, it } from 'vitest';
import { FIX_RECORD_FROM, fixProblems, gateDone, parseRounds } from '../src/index.js';
import type { ClaimPin, RepoSnapshot } from '../src/index.js';
import { facts, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';

const REVIEW = 'accord/tickets/T-1/review.md';
const RULE = 'gate.fix-places-missing';
const review = (text: string) => parseRounds(REVIEW, text, 'review');
const one = (line: string) => review('Round record: 2\n\n## Round 1 head abc1234\n\nNice 9: z — none — open\n' + line + '\n');
const FIXED = 'Must 2 [patch]: the writer drops the header — src/a.ts:3 — fixed in abc1234';

it('risk:parsing a review finding reads checked:, addressed: and not addressed: marks and keeps every other mark as before (ST-LN-56 56-ac-1)', () => {
  const at = (line: string) => {
    const r = one(line);
    expect(r.unreadable, line).toEqual([]);
    return r.cycles[0].rounds[0].findings[1];
  };
  expect(at(FIXED + ' — checked: src/a.ts:3, src/b.ts, src/c.ts:40')).toMatchObject({ state: 'fixed', checked: ['src/a.ts:3', 'src/b.ts', 'src/c.ts:40'] });
  expect(at(FIXED + ' — checked: src/a.ts')).toMatchObject({ checked: ['src/a.ts'] });
  expect(at(FIXED + ' — checked: `src/b c.ts`:9, src/d.ts')).toMatchObject({ checked: ['src/b c.ts:9', 'src/d.ts'] });
  expect(at(FIXED + ' — addressed: src/a.ts:5')).toMatchObject({ state: 'fixed', addressed: { file: 'src/a.ts', line: 5 } });
  expect(at(FIXED + ' — not addressed: src/a.ts:5')).toMatchObject({ state: 'fixed', notAddressed: { file: 'src/a.ts', line: 5 } });
  // the new marks sit among the old ones, in any order
  expect(at(FIXED + ' — checked: src/a.ts, src/b.ts:2 — risk: security — addressed: src/a.ts:5')).toMatchObject({
    risk: 'security',
    checked: ['src/a.ts', 'src/b.ts:2'],
    addressed: { file: 'src/a.ts', line: 5 },
  });
  // every other mark reads as before
  expect(at('Must 2: x — src/a.ts — open — test: export#writes-csv — risk: security')).toMatchObject({ test: 'export#writes-csv', risk: 'security' });
  expect(at(FIXED).checked).toBeUndefined();

  // an empty list, a repeated mark, a place with a non-numeric or a zero line, an address with no line and a contradiction are a record problem, as an unread mark is today
  for (const bad of [
    FIXED + ' — checked:',
    FIXED + ' — checked: ',
    FIXED + ' — checked: ,',
    FIXED + ' — checked: src/a.ts, ',
    FIXED + ' — checked: src/a.ts — checked: src/b.ts',
    FIXED + ' — checked: src/a.ts:abc',
    FIXED + ' — checked: src/a.ts:0',
    FIXED + ' — checked: two words',
    FIXED + ' — addressed: src/a.ts',
    FIXED + ' — addressed: src/a.ts:x',
    FIXED + ' — not addressed: src/a.ts',
    FIXED + ' — addressed: src/a.ts:5 — addressed: src/a.ts:6',
    FIXED + ' — addressed: src/a.ts:5 — not addressed: src/a.ts:5',
  ]) {
    const d = one(bad);
    expect(d.unreadable, bad).toHaveLength(1);
    expect(d.unreadable[0].reason, bad).toContain(bad.trim());
  }
});

const withPin = (snap: RepoSnapshot, claim: ClaimPin | undefined): RepoSnapshot => (claim === undefined ? snap : { ...snap, claimPins: { 'T-1': claim } });
const build = (o: { lane?: 'M' | 'S'; lines: string[]; claim?: ClaimPin; doneOnDefault?: true }): RepoSnapshot =>
  withPin(
    scopeSnapshot({
      ...(o.lane === undefined ? {} : { lane: o.lane }),
      review: v2Review([[{ lines: o.lines }]]),
      facts: facts([[]]),
      ...(o.doneOnDefault === undefined ? {} : { doneOnDefault: true as const }),
    }),
    o.claim,
  );
const reasons = (snap: RepoSnapshot): string[] => gateDone(snap, 'T-1').findings.filter((f) => f.rule === RULE).map((f) => f.reason);
const finding1 = 'Should 1 [patch]: a cell is wrong — src/b.ts:1 — open';
const places = ' — checked: src/a.ts:3, src/b.ts';

it('ac-1 a fix recorded without the places it checked is refused at gate done, naming the finding, in lane M and lane S (ST-LN-56 56-ac-1)', () => {
  expect(FIX_RECORD_FROM).toBe('0.6.0');
  for (const lane of ['M', 'S'] as const) {
    const claim = { pin: FIX_RECORD_FROM };
    const refused = reasons(build({ lane, lines: [finding1, FIXED], claim }));
    expect(refused, lane).toHaveLength(1);
    expect(refused[0], lane).toContain('round 1');
    expect(refused[0], lane).toContain('finding 2');
    expect(refused[0], lane).toContain('checked:');
    // with the mark, or with no fixed finding, nothing is refused
    expect(reasons(build({ lane, lines: [finding1, FIXED + places], claim })), lane).toEqual([]);
    expect(reasons(build({ lane, lines: [finding1], claim })), lane).toEqual([]);
  }
  // each fixed finding is judged alone, and every severity is asked
  const two = reasons(
    build({ lines: ['Nice 1: n — src/a.ts:1 — fixed in abc1234', FIXED, 'Should 3: s — src/a.ts:1 — fixed in abc1234' + places], claim: { pin: FIX_RECORD_FROM } }),
  );
  expect(two).toHaveLength(2);
  expect(two[0]).toContain('finding 1');
  expect(two[1]).toContain('finding 2');
  expect(fixProblems(build({ lines: [FIXED], claim: { pin: FIX_RECORD_FROM } }), 'T-1')).toHaveLength(1);
});

it('risk:regression a ticket claimed before 0.6.0, a version 1 record and a ticket done on the default branch answer as before (ST-LN-56 56-ac-1)', () => {
  expect(reasons(build({ lines: [FIXED], claim: { pin: '0.5.1' } }))).toEqual([]);
  expect(reasons(build({ lane: 'S', lines: [FIXED], claim: { pin: '0.5.1' } }))).toEqual([]);
  expect(fixProblems(build({ lines: [FIXED], claim: { pin: '0.5.1' } }), 'T-1')).toEqual([]);
  // the claim fact's ruleset is what the branch first held
  expect(reasons(build({ lines: [FIXED], claim: { pin: '0.6.0', ruleset: '0.5.1' } }))).toEqual([]);
  // a done ticket on the default branch is not re-judged (D-10)
  expect(reasons(build({ lines: [FIXED], claim: { pin: FIX_RECORD_FROM }, doneOnDefault: true }))).toEqual([]);
  // a version 1 record has no `fixed in <sha>` line
  const v1 = scopeSnapshot({ review: 'Round record: 1\n\n## Round 1\n\nMust 1: x — src/a.ts — fixed in abc1234\n\nverdict: converged\n', facts: facts([[]]) });
  expect(reasons({ ...v1, claimPins: { 'T-1': { pin: FIX_RECORD_FROM } } })).toEqual([]);
});

it('risk:regression a failed claim read applies the places rule with the git-error note (ST-LN-56 56-ac-1)', () => {
  const failed = reasons(build({ lines: [FIXED], claim: { error: 'fatal: bad object deadbeef' } }));
  expect(failed).toHaveLength(1);
  expect(failed[0]).toContain('finding 2');
  expect(failed[0]).toContain('fatal: bad object deadbeef');
  expect(failed[0]).toContain('claim pin could not be read');
  expect(reasons(build({ lines: [FIXED + places], claim: { error: 'fatal: bad object deadbeef' } }))).toEqual([]);
  // no claim fact at all: the working-tree pin decides, as every Phase 4 rule reads it
  expect(Array.isArray(reasons(build({ lines: [FIXED] })))).toBe(true);
});
