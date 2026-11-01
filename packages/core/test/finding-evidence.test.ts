// ST-LN-57 Task 7: ac-2 (a new finding from round 3 outside the last fix's files needs evidence), ac-3 (code added by a
// debug episode or a merge starts its own round 1 for that rule) and D-08 (a deferred finding leaves ST-LN-17's stop).
import { expect, it } from 'vitest';
import { gateDone, nextRound, roundText } from '../src/index.js';
import type { RangeCommit, RepoSnapshot } from '../src/index.js';
import { commit, facts, scopeSnapshot, v2Review } from '../../../test/helpers/review-v2.js';
import type { RoundSpec } from '../../../test/helpers/review-v2.js';

const RULE = 'gate.finding-evidence';
const evidence = (snap: RepoSnapshot): string[] => gateDone(snap, 'T-1').findings.filter((f) => f.rule === RULE).map((f) => f.reason);
const ruleCount = (snap: RepoSnapshot, rule: string): number => gateDone(snap, 'T-1').findings.filter((f) => f.rule === rule).length;
const line = (severity: 'Must' | 'Should' | 'Nice', n: number, where: string, state = 'open', ...marks: string[]): string =>
  `${severity} ${n} [patch]: x — ${where} — ${state}${marks.map((m) => ' — ' + m).join('')}`;
const allow = (n: number, after: number): string => `- Ruling: the owner allows ${n} more review rounds after round ${after} of cycle 1 — "go on" — cost if wrong: ${n} rounds\n`;
const none = (n: number): RangeCommit[][] => Array.from({ length: n }, () => []);

it('ac-2 from round 3 a new finding outside the last fix files blocks only with evidence', () => {
  // round 2's fix: a.ts, c.ts (with records), and a records-only commit; round 3 is the first round that asks evidence
  const ranges = [[], [commit(['src/a.ts']), commit(['src/c.ts', 'accord/tickets/T-1/ledger.md']), commit(['accord/tickets/T-1/ledger.md'])], []];
  const three = (round3: string[], o: { round2?: string[]; ledger?: string; tail?: string } = {}): RepoSnapshot =>
    scopeSnapshot({
      review: v2Review([[{ lines: [] }, { lines: o.round2 ?? [] }, { lines: round3 }]], o.tail),
      ledger: o.ledger,
      facts: facts(ranges),
    });
  const outside = line('Must', 1, 'src/b.ts:1');

  const failing = evidence(three([outside]));
  expect(failing).toHaveLength(1);
  expect(failing[0]).toContain('round 3');
  expect(failing[0]).toContain('finding 1');
  expect(failing[0]).toContain('src/b.ts');

  // a failing test, a reproducing command, data loss or security, or a carried finding
  for (const mark of ['test: export#writes-csv', 'command: npm test', 'risk: data-loss', 'risk: security']) {
    expect(evidence(three([line('Must', 1, 'src/b.ts:1', 'open', mark)])), mark).toEqual([]);
  }
  expect(evidence(three([line('Must', 1, 'src/b.ts:1', 'open', 'carried from 2.1')], { round2: [line('Nice', 1, 'src/q.ts:1', 'fixed in abc1234')] })), 'carried').toEqual([]);

  // a Should is asked the same; a Nice is not
  expect(evidence(three([line('Should', 1, 'src/b.ts:1')]))).toHaveLength(1);
  expect(evidence(three([line('Nice', 1, 'src/b.ts:1')]))).toEqual([]);

  // a file the last fix changed (also in a commit that changes code and records) is not new
  expect(evidence(three([line('Must', 1, 'src/a.ts:1')]))).toEqual([]);
  expect(evidence(three([line('Must', 1, 'src/c.ts:1')]))).toEqual([]);
  // a file only a records-only commit changed is not a fix file
  expect(evidence(three([line('Must', 1, 'accord/tickets/T-1/ledger.md:1')]))).toHaveLength(1);

  // a finding that gives no file takes the count and is asked
  const nowhere = evidence(three([line('Must', 1, 'none')]));
  expect(nowhere).toHaveLength(1);
  expect(nowhere[0]).toContain('nowhere (none)');

  // deferred: only with its Deferred line, naming the round and the number
  const deferred = line('Must', 1, 'src/b.ts:1', 'deferred');
  expect(evidence(three([deferred], { ledger: '\n## Deferred\n- review 3.1: x\n' }))).toEqual([]);
  expect(evidence(three([deferred]))).toHaveLength(1);
  expect(evidence(three([deferred], { ledger: '\n## Deferred\n- review 3.2: x\n' }))).toHaveLength(1);
  expect(evidence(three([deferred], { ledger: '\n## Deferred\n- review 3.1 cycle 2: x\n' }))).toHaveLength(1);

  // round 2 asks nothing
  const two = scopeSnapshot({ review: v2Review([[{ lines: [] }, { lines: [outside] }]]), facts: facts([[], []]) });
  expect(evidence(two)).toEqual([]);

  // D-08: a deferred finding with its line leaves the stop, so the loop goes on and gate done has no stop to report
  const only = [deferred, line('Nice', 2, 'src/b.ts:2')];
  const left = three(only, { ledger: '\n## Deferred\n- review 3.1: x\n' });
  const next = nextRound(left, 'T-1', 'review');
  expect(next.kind).toBe('next');
  expect(next.round).toBe(4);
  expect(ruleCount(three(only, { ledger: '\n## Deferred\n- review 3.1: x\n', tail: '\nverdict: converged\n' }), 'gate.review-rounds')).toBe(0);
  // without its line it still stops, and the verdict does not lift it
  expect(nextRound(three(only), 'T-1', 'review').kind).toBe('stop');
  expect(ruleCount(three(only, { tail: '\nverdict: converged\n' }), 'gate.review-rounds')).toBe(1);
  // a Must with a test or command is not deferred: the stop stays at round 3
  const kept = nextRound(three([line('Must', 1, 'src/b.ts:1', 'open', 'test: export#writes-csv')]), 'T-1', 'review');
  expect(kept.kind).toBe('stop');
  expect(kept.round).toBe(3);
});

it('ac-3 code added by a debug episode or a merge starts its own round 1 for the evidence rule', () => {
  const ledger = allow(1, 3) + allow(1, 4);
  const held = [line('Must', 1, 'src/q.ts:1', 'open', 'test: t#x')];
  const merge = commit(['src/m.ts'], 'merge');
  const rounds: RoundSpec[] = [
    { lines: [] },
    { lines: [] },
    { lines: held },
    { lines: held },
    { lines: [line('Should', 1, 'src/m.ts:1'), line('Must', 2, 'src/z.ts:1')], mark: 'added' },
  ];
  const five = scopeSnapshot({ review: v2Review([rounds]), ledger, facts: facts([[], [], [], [merge], []]) });
  const named = evidence(five);
  expect(named).toHaveLength(1);
  expect(named[0]).toContain('round 5 of cycle 1, finding 2');
  // ST-LN-17 still counts it as the ticket's round 5
  expect(roundText(nextRound(five, 'T-1', 'review'))).toContain('round 5 of cycle 1');

  // rounds 6 and 7: the added code's own round 3 is the ticket's round 7
  const more: RoundSpec[] = [...rounds, { lines: [line('Should', 1, 'src/m.ts:1')] }, { lines: [line('Must', 1, 'src/m.ts:2')] }];
  const seven = scopeSnapshot({
    review: v2Review([more]),
    ledger: ledger + allow(1, 5) + allow(1, 6),
    facts: facts([[], [], [], [merge], [], [commit(['src/other.ts'])], []]),
  });
  const later = evidence(seven);
  expect(later.some((r) => r.includes('round 6 of cycle 1'))).toBe(false);
  expect(later.some((r) => r.includes('round 7 of cycle 1, finding 1'))).toBe(true);
  expect(later.some((r) => r.includes('round 5 of cycle 1, finding 2'))).toBe(true);
});

it('risk:complex-branching the final review is left out of the evidence count', () => {
  // rounds 1, 2 (final review), 3: round 3 is the second round that counts
  const middle = scopeSnapshot({
    review: v2Review([[{ lines: [] }, { lines: [], mark: 'final' }, { lines: [line('Must', 1, 'src/b.ts:1')] }]]),
    facts: facts(none(3)),
  });
  expect(evidence(middle)).toEqual([]);

  // a final review round asks neither a test nor a command, whatever its position
  const last = scopeSnapshot({
    review: v2Review([[{ lines: [] }, { lines: [] }, { lines: [] }, { lines: [line('Must', 1, 'src/b.ts:1')], mark: 'final' }]]),
    facts: facts(none(4)),
  });
  expect(evidence(last)).toEqual([]);

  // the same Must in a plain round 4 is asked
  const plain = scopeSnapshot({
    review: v2Review([[{ lines: [] }, { lines: [] }, { lines: [] }, { lines: [line('Must', 1, 'src/b.ts:1')] }]]),
    facts: facts(none(4)),
  });
  expect(evidence(plain)).toHaveLength(1);
});
