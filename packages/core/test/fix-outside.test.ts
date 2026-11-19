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

it('risk:complex-branching a re-review finding outside the fix diff is deferred and starts no round (ST-LN-56 56-ac-2)', () => {
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

it('risk:complex-branching the outside-diff rule exempts what reads more than a fix diff and never defers a risk finding (ST-LN-56 56-ac-2)', () => {
  const at = (rounds: RoundSpec[], o: Partial<Build> = {}): string[] => gate(build({ rounds, ...o }), RULE);
  const one = (lines: string[]): RoundSpec[] => [{ lines: [FIXED] }, { lines }];
  // the baseline: an open Should outside the fix diff is refused, a Must the same; located `none` counts as outside
  expect(at(one([outside()]))).toHaveLength(1);
  expect(at(one(['Must 1 [patch]: x — src/z.ts:1 — open']))).toHaveLength(1);
  const nowhere = at(one(['Should 1 [patch]: x — none — open']));
  expect(nowhere).toHaveLength(1);
  expect(nowhere[0]).toContain('nowhere (none)');

  // a cycle's first round reads the whole change: a finding in round 1, and in the first round of a later cycle, is exempt
  expect(at([{ lines: [outside()] }])).toEqual([]);
  const twoCycles = build({ rounds: [], cycles: [[{ lines: [] }], [{ lines: [outside()] }]], ranges: [[], []] });
  expect(gate(twoCycles, RULE)).toEqual([]);
  // an (added code round 1) round and the (final review) read more than a fix diff
  expect(at([{ lines: [FIXED] }, { mark: 'added', lines: [outside()] }])).toEqual([]);
  expect(at([{ lines: [FIXED] }, { mark: 'final', lines: [outside()] }])).toEqual([]);
  // a carried finding and a Nice are exempt
  const carried = 'Should 1 [patch]: a cell is still wrong — src/z.ts:1 — open — carried from 1.1';
  expect(at([{ lines: ['Should 1 [patch]: a cell is wrong — src/z.ts:1 — open'] }, { lines: [carried] }])).toEqual([]);
  expect(at(one(['Nice 1 [patch]: a name — src/z.ts:1 — open']))).toEqual([]);
  // a finding in a file the previous round's fix changed is exempt
  expect(at(one(['Should 1 [patch]: x — src/a.ts:1 — open']))).toEqual([]);
  // a deferred or fixed finding is not left open
  expect(at(one(['Should 1 [patch]: x — src/z.ts:1 — fixed in abc1234 — checked: src/z.ts:1']))).toEqual([]);

  // a risk finding stays open and blocks in every round; it is never deferred by this rule
  const risk = 'Must 1 [patch]: the export leaks a token — src/z.ts:3 — open — risk: data-loss';
  const open = build({ rounds: [{ lines: [FIXED] }, { lines: [] }, { lines: [risk] }] });
  expect(gate(open, RULE)).toEqual([]);
  const cycle = open.work?.['T-1']?.rounds?.cycles[0];
  expect(blockingFindings(cycle!)).toEqual([{ round: 3, lines: [expect.stringContaining('risk: data-loss')] }]);
  // written deferred it is still refused by today's risk rule (Phase 2 D-12), under a 0.6.0 pin
  const deferred = build({
    rounds: [{ lines: [FIXED] }, { lines: [] }, { lines: [risk.replace('open', 'deferred')] }],
    ledger: LEDGER.replace('review 2.1', 'review 3.1'),
    pin: '0.6.0',
  });
  expect(gate(deferred, RULE)).toEqual([]);
  expect(gate(deferred, 'gate.finding-grounds').some((r) => r.includes('never deferred'))).toBe(true);
});

it('risk:complex-branching an added-code round between a fix and its re-review leaves the fix diff the re-review reads (ST-LN-56 56-ac-2)', () => {
  // round 1 fixes src/a.ts, a merge adds code, round 2 reviews it headed (added code round 1) and fixes src/b.ts, round 3 re-reviews both fixes
  const ranges = [[commit(['src/a.ts']), commit(['src/m.ts'], 'merge')], [commit(['src/b.ts'])], []];
  const added = 'Should 1 [patch]: the merge left a stale call — src/b.ts:2 — fixed in abc1234 — checked: src/b.ts:2 — addressed: src/b.ts:4';
  const third = (line: string): RepoSnapshot => build({ rounds: [{ lines: [FIXED] }, { lines: [added], mark: 'added' }, { lines: [line] }], ranges });
  const finding = (file: string): string => `Should 1 [patch]: the fix broke a row — ${file}:1 — open`;
  // a regression in round 1's fixed file, or in the added round's fixed file, is inside the fix diff round 3 reads, so it is not forced to Deferred
  expect(gate(third(finding('src/a.ts')), RULE)).toEqual([]);
  expect(gate(third(finding('src/b.ts')), RULE)).toEqual([]);
  // and the evidence rule reads the same fix diff: no test: or command: is asked of it
  expect(gate(third(finding('src/a.ts')), EVIDENCE)).toEqual([]);
  // a file no fix changed, and the merged file itself, are still outside
  expect(gate(third(finding('src/z.ts')), RULE)).toHaveLength(1);
  expect(gate(third(finding('src/m.ts')), RULE)).toHaveLength(1);
});

it('risk:regression before 0.6.0 the evidence rule answers as in Phase 2 (ST-LN-56 56-ac-2)', () => {
  // round 3's Should is outside round 2's fix (a.ts); round 1 and 2 hold nothing else
  const rounds = (line: string): RoundSpec[] => [{ lines: [] }, { lines: [] }, { lines: [line] }];
  const ranges = [[], [commit(['src/a.ts'])], []];
  const rule = (claim: ClaimPin, line: string, id: string): string[] => gate(build({ rounds: rounds(line), ranges, claim }), id);
  const bare = outside();
  const tested = outside('open', 'test: export#writes-csv');
  // 0.5.1: a test: or command: keeps it open with no finding; without it the evidence rule reports it, and the new rule says nothing
  expect(rule({ pin: '0.5.1' }, tested, EVIDENCE)).toEqual([]);
  expect(rule({ pin: '0.5.1' }, tested, RULE)).toEqual([]);
  expect(rule({ pin: '0.5.1' }, bare, EVIDENCE)).toHaveLength(1);
  expect(rule({ pin: '0.5.1' }, bare, RULE)).toEqual([]);
  // 0.6.0: exactly one reason per finding, the D-10 one, with or without evidence
  for (const line of [bare, tested]) {
    expect(rule({ pin: FIX_RECORD_FROM }, line, RULE), line).toHaveLength(1);
    expect(rule({ pin: FIX_RECORD_FROM }, line, EVIDENCE), line).toEqual([]);
  }
});
