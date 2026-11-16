// ST-LN-56 56-ac-2 (D-10, D-17), the outside-diff half: from FIX_RECORD_FROM a re-review finding outside the fix diff goes to Deferred and starts no round; `accord round` and
// `accord gate done` refuse it left open (gate.fix-outside-open), in lane M and lane S, and a deferral with its ledger line leaves the stop.
import { expect, it } from 'vitest';
import { FIX_RECORD_FROM, blockingFindings, gateDone, nextRound } from '../src/index.js';
import type { ClaimPin, RangeCommit, RepoSnapshot } from '../src/index.js';
import { deferredFor } from '../src/round/next.js';
import { commit, facts, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';
import type { RoundSpec } from '../../../test/helpers/review-v2.js';

const RULE = 'gate.fix-outside-open';
const EVIDENCE = 'gate.finding-evidence';
// round 1's fix finding, fully recorded (places and the re-review's answer), so only the outside-diff rule has anything to say about round 2
const FIXED = 'Must 1 [patch]: the writer drops the header — src/a.ts:3 — fixed in abc1234 — checked: src/a.ts:3 — addressed: src/a.ts:5';
const outside = (state = 'open', ...marks: string[]): string => `Should 1 [patch]: a cell is wrong — src/z.ts:1 — ${state}${marks.map((m) => ' — ' + m).join('')}`;
const LEDGER = '\n## Deferred\n- review 2.1: a cell is wrong — failing case: the export of a two-row table drops the second row\n';

interface Build { rounds: RoundSpec[]; ranges?: RangeCommit[][]; claim?: ClaimPin; lane?: 'M' | 'S'; ledger?: string; pin?: string; cycles?: RoundSpec[][] }
const build = (o: Build): RepoSnapshot => {
  const snap = scopeSnapshot({
    ...(o.lane === undefined ? {} : { lane: o.lane }),
    review: v2Review(o.cycles ?? [o.rounds]),
    ...(o.ledger === undefined ? {} : { ledger: o.ledger }),
    facts: facts(o.ranges ?? o.rounds.map((_, i) => (i === 0 ? [commit(['src/a.ts'])] : [])), o.pin === undefined ? {} : { pin: o.pin }),
  });
  return { ...snap, claimPins: { 'T-1': o.claim ?? { pin: FIX_RECORD_FROM } } };
};
const gate = (snap: RepoSnapshot, rule: string): string[] => gateDone(snap, 'T-1').findings.filter((f) => f.rule === rule).map((f) => f.reason);

it('ac-2 a re-review finding outside the fix diff is deferred and starts no round (ST-LN-56 56-ac-2)', () => {
  const open = build({ rounds: [{ lines: [FIXED] }, { lines: [outside('open', 'test: export#writes-csv')] }] });
  const reasons = gate(open, RULE);
  expect(reasons).toHaveLength(1);
  expect(reasons[0]).toContain('round 2');
  expect(reasons[0]).toContain('finding 1');
  expect(reasons[0]).toContain('src/z.ts');
  expect(reasons[0]).toContain('Deferred');
  const refused = nextRound(open, 'T-1', 'review');
  expect(refused.kind).toBe('refused');
  expect(refused.reasons.join('\n')).toContain('finding 1');

  // written deferred with its ledger line: nothing is refused and the finding leaves the stop
  const deferred = build({ rounds: [{ lines: [FIXED] }, { lines: [outside('deferred')] }], ledger: LEDGER });
  expect(gate(deferred, RULE)).toEqual([]);
  expect(nextRound(deferred, 'T-1', 'review').kind).toBe('next');
  expect(deferredFor(deferred, 'T-1', 'review', 0).size).toBe(1);
  // without its line it is still refused
  expect(gate(build({ rounds: [{ lines: [FIXED] }, { lines: [outside('deferred')] }] }), RULE)).toHaveLength(1);

  // round 3: a deferred finding with its line starts no stop and no refusal, the loop goes on
  const three = (state: string, ledger?: string): RepoSnapshot =>
    build({ rounds: [{ lines: [FIXED] }, { lines: [] }, { lines: [outside(state)] }], ...(ledger === undefined ? {} : { ledger }) });
  const line3 = '\n## Deferred\n- review 3.1: a cell is wrong — failing case: the export of a two-row table drops the second row\n';
  const left = nextRound(three('deferred', line3), 'T-1', 'review');
  expect(left.kind).toBe('next');
  expect(left.round).toBe(4);
  expect(nextRound(three('open'), 'T-1', 'review').kind).toBe('refused');
});
