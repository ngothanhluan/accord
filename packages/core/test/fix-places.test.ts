// ST-LN-56 56-ac-1 (D-08, D-16): the finding grammar reads the marks `checked:`, `addressed:` and `not addressed:`, and a fix recorded as `fixed in <sha>` without the places it
// checked is refused at gate done from the 0.6.0 cut-off, in lane M and in lane S, naming the round and the finding.
import { expect, it } from 'vitest';
import { FIX_RECORD_FROM, blockingFindings, fixProblems, gateDone, nextRound, parseRounds } from '../src/index.js';
import type { ClaimPin, RepoSnapshot } from '../src/index.js';
import { commit, facts, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';

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
    // a placeholder names no place, alone or in a list, in any letter case, with a line or in backticks
    FIXED + ' — checked: none',
    FIXED + ' — checked: None',
    FIXED + ' — checked: n/a',
    FIXED + ' — checked: -',
    FIXED + ' — checked: TBD',
    FIXED + ' — checked: <path>',
    FIXED + ' — checked: <path>:<line>',
    FIXED + ' — checked: src/a.ts, none',
    FIXED + ' — checked: `none`',
    FIXED + ' — checked: tbd:3',
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
      review: v2Review([[{ lines: o.lines }]], o.doneOnDefault === undefined ? '' : '\nverdict: converged\n'),
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

// ST-LN-56 56-ac-1, the round half (plan 04-08 Task 1): `accord round` refuses the next review round while a fixed finding has no places-checked mark.
it('ac-1 accord round refuses the review round for a fix recorded without the places it checked (ST-LN-56 56-ac-1)', () => {
  const claim = { pin: FIX_RECORD_FROM };
  const refused = nextRound(build({ lines: [finding1, FIXED], claim }), 'T-1', 'review');
  expect(refused.kind).toBe('refused');
  const text = refused.reasons.join('\n');
  expect(text).toContain('round 1');
  expect(text).toContain('finding 2');
  expect(text).toContain('checked:');
  // with the mark the round is asked for, and a ticket claimed before 0.6.0 is answered as before
  expect(nextRound(build({ lines: [finding1, FIXED + places], claim }), 'T-1', 'review').kind).toBe('next');
  expect(nextRound(build({ lines: [finding1, FIXED], claim: { pin: '0.5.1' } }), 'T-1', 'review').kind).toBe('next');
});

// ST-LN-56 56-ac-2 (D-10, D-17), plan 04-08 Task 2: a fixed finding closes only on the re-review's `addressed:` mark.
const ANSWER = 'gate.fix-not-addressed';
const FIXC = FIXED + places; // finding 2 of its round, fixed with its places
const ADDRESSED = ' — addressed: src/a.ts:5';
const NOT_ADDRESSED = ' — not addressed: src/a.ts:5';
const CARRY = 'Must 1 [patch]: the writer still drops the header — src/a.ts:3 — open — carried from 1.2';
const buildN = (rounds: string[][], claim: ClaimPin | undefined = { pin: FIX_RECORD_FROM }, lane?: 'M' | 'S'): RepoSnapshot =>
  withPin(
    scopeSnapshot({
      ...(lane === undefined ? {} : { lane }),
      review: v2Review([rounds.map((lines) => ({ lines }))]),
      facts: facts(rounds.map(() => [])),
    }),
    claim,
  );
const answers = (snap: RepoSnapshot): string[] => gateDone(snap, 'T-1').findings.filter((f) => f.rule === ANSWER).map((f) => f.reason);
const next = (snap: RepoSnapshot) => nextRound(snap, 'T-1', 'review');
const refusal = (snap: RepoSnapshot): string => {
  const a = next(snap);
  expect(a.kind).toBe('refused');
  return a.reasons.join('\n');
};

it('ac-2 a fixed finding closes only on the re-review\'s addressed: mark (ST-LN-56 56-ac-2)', () => {
  for (const lane of [undefined, 'S'] as const) {
    const at = (rounds: string[][], claim?: ClaimPin | undefined) => buildN(rounds, claim ?? { pin: FIX_RECORD_FROM }, lane);
    // a round followed by another with no answer on the fixed finding: gate done and accord round both refuse, naming it
    const missing = at([[FIXC], []]);
    expect(answers(missing), String(lane)).toHaveLength(1);
    expect(answers(missing)[0], String(lane)).toContain('round 1');
    expect(answers(missing)[0], String(lane)).toContain('finding 2');
    expect(answers(missing)[0], String(lane)).toContain('addressed:');
    expect(refusal(missing), String(lane)).toContain('finding 2');

    // `addressed:` closes it
    const closed = at([[FIXC + ADDRESSED], []]);
    expect(answers(closed), String(lane)).toEqual([]);
    expect(next(closed).kind, String(lane)).toBe('next');

    // `not addressed:` must be carried by the next round
    const carried = at([[FIXC + NOT_ADDRESSED], [CARRY]]);
    expect(answers(carried), String(lane)).toEqual([]);
    expect(next(carried).kind, String(lane)).toBe('next');
    const dropped = at([[FIXC + NOT_ADDRESSED], []]);
    expect(answers(dropped), String(lane)).toHaveLength(1);
    expect(answers(dropped)[0], String(lane)).toContain('carried from 1.2');
    expect(refusal(dropped), String(lane)).toContain('carried from 1.2');

    // both marks on one line, and an answer on a finding that is not fixed in a commit
    expect(refusal(at([[FIXC + ADDRESSED + NOT_ADDRESSED], []])), String(lane)).toContain('addressed');
    const misplaced = at([['Must 1 [patch]: x — src/a.ts:3 — open' + ADDRESSED]]);
    expect(answers(misplaced), String(lane)).toHaveLength(1);
    expect(answers(misplaced)[0], String(lane)).toContain('not fixed');
    expect(refusal(misplaced), String(lane)).toContain('finding 1');

    // the last round's fix has had no re-review: gate done refuses it (D-17), accord round does not, whatever the fix carries
    for (const line of [FIXC, FIXC + ADDRESSED]) {
      const last = at([[line]]);
      expect(answers(last), String(lane)).toHaveLength(1);
      expect(answers(last)[0], String(lane)).toContain('D-17');
      expect(answers(last)[0], String(lane)).toContain('round 1');
      expect(next(last).kind, String(lane)).toBe('next');
    }
    // a final round with no fixed finding is not asked for an answer
    expect(answers(at([[FIXC + ADDRESSED], [CARRY]])), String(lane)).toEqual([]);

    // the cut-off: before 0.6.0, and for a claim fact whose ruleset is older, nothing is asked
    for (const claim of [{ pin: '0.5.1' }, { pin: '0.6.0', ruleset: '0.5.1' }]) {
      const old = at([[FIXC], []], claim);
      expect(answers(old), String(lane)).toEqual([]);
      expect(next(old).kind, String(lane)).toBe('next');
    }
  }
});

it('risk:complex-branching the last round of an earlier cycle needs its answer from the next cycle\'s round 1 (ST-LN-56 56-ac-2, D-17)', () => {
  // cycle 1 ends on a fixed finding, the verdict is written, verify returns and cycle 2 opens: its round 1 is that fix's re-review
  const cycles = (one: string[], two?: string[][]): RepoSnapshot =>
    withPin(
      scopeSnapshot({ review: v2Review([[{ lines: one }], ...(two === undefined ? [] : [two.map((lines) => ({ lines }))])]), facts: facts([[], ...(two ?? []).map(() => [])]) }),
      { pin: FIX_RECORD_FROM },
    );
  const unanswered = cycles([FIXC], [[]]);
  expect(answers(unanswered)).toHaveLength(1);
  expect(answers(unanswered)[0]).toContain('round 1 of cycle 1');
  expect(answers(unanswered)[0]).toContain('finding 2');
  expect(answers(unanswered)[0]).toContain('round 1 of cycle 2');
  expect(refusal(unanswered)).toContain('round 1 of cycle 1');
  // the answer written from cycle 2's round 1 closes it; NOT ADDRESSED is reported again by that round, which reads the whole work, so no carry across a cycle is asked
  expect(answers(cycles([FIXC + ADDRESSED], [[]]))).toEqual([]);
  expect(next(cycles([FIXC + ADDRESSED], [[]])).kind).toBe('next');
  expect(answers(cycles([FIXC + NOT_ADDRESSED], [['Must 1 [patch]: the writer still drops the header — src/a.ts:3 — open']]))).toEqual([]);
  // cycle 2 not started yet: accord round is not refused (its round 1 is the re-review), gate done is (the record's last round is the fix)
  const between = cycles([FIXC]);
  expect(answers(between)).toHaveLength(1);
});

it('risk:complex-branching an (added code round 1) round between a fix and its re-review does not ask for the answer, the re-review round after it does (ST-LN-56 56-ac-2, D-17)', () => {
  // round 1 is fixed, a merge adds code, round 2 reviews it headed (added code round 1), round 3 is the re-review of round 1's fix
  const withAdded = (rounds: { lines: string[]; mark?: 'added' }[]): RepoSnapshot =>
    withPin(
      scopeSnapshot({
        review: v2Review([rounds]),
        facts: facts(rounds.map((_, i) => (i === 0 ? [commit(['src/a.ts']), commit(['src/m.ts'], 'merge')] : []))),
      }),
      { pin: FIX_RECORD_FROM },
    );
  // only the added-code round has followed: accord round asks for the re-review round, not for an answer the added-code reviewer was never asked
  const added = withAdded([{ lines: [FIXC] }, { lines: [], mark: 'added' }]);
  expect(next(added).reasons ?? []).toEqual([]);
  expect(next(added).kind).toBe('next');
  // the re-review round after it: its answer is asked, and given closes it
  const unanswered = withAdded([{ lines: [FIXC] }, { lines: [], mark: 'added' }, { lines: [] }]);
  expect(answers(unanswered)).toHaveLength(1);
  expect(answers(unanswered)[0]).toContain('round 3 followed');
  expect(refusal(unanswered)).toContain('round 3 followed');
  expect(answers(withAdded([{ lines: [FIXC + ADDRESSED] }, { lines: [], mark: 'added' }, { lines: [] }]))).toEqual([]);
  // a NOT ADDRESSED finding is carried by the added-code round or by the re-review round
  expect(answers(withAdded([{ lines: [FIXC + NOT_ADDRESSED] }, { lines: [], mark: 'added' }, { lines: [CARRY] }]))).toEqual([]);
  expect(answers(withAdded([{ lines: [FIXC + NOT_ADDRESSED] }, { lines: [CARRY], mark: 'added' }, { lines: [] }]))).toEqual([]);
  expect(answers(withAdded([{ lines: [FIXC + NOT_ADDRESSED] }, { lines: [], mark: 'added' }, { lines: [] }]))).toHaveLength(1);
  // at the verdict a fix only an added-code round followed still needs its answer (D-17)
  expect(answers(added)).toHaveLength(1);
  expect(answers(added)[0]).toContain('D-17');
  expect(answers(withAdded([{ lines: [FIXC + ADDRESSED] }, { lines: [], mark: 'added' }]))).toEqual([]);
});

it('risk:security an open risk finding still blocks whatever marks it carries (ST-LN-56 56-ac-2)', () => {
  const risk = 'Must 1 [patch]: the export leaks a token — src/a.ts:3 — open — risk: security';
  for (const marks of ['', ADDRESSED, ' — checked: src/a.ts:3']) {
    const snap = buildN([[], [], [risk + marks]]);
    const cycle = snap.work?.['T-1']?.rounds?.cycles[0];
    expect(blockingFindings(cycle!), marks).toEqual([{ round: 3, lines: [expect.stringContaining('risk: security')] }]);
    // the stop and gate done: the round of an open risk finding still stops the loop for the owner, and a new mark closes nothing
    expect(gateDone(snap, 'T-1').findings.some((f) => f.rule === 'gate.review-rounds' && f.reason.includes('still reports')), marks).toBe(true);
  }
});
