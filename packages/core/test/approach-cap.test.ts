// ST-LN-91 91d-ac-2: the approach critic gets two rounds for a ticket claimed from APPROACH_CAP_FROM, and round 3 is refused with the
// findings still open. The cap reads the ticket's claim pin (D-15), never the approach record's own pin.
import { expect, it } from 'vitest';
import { APPROACH_CAP_FROM, blockingFindings, loadSnapshot, nextRound, openFindings, recordProblems, roundText } from '../src/index.js';
import type { ClaimPin, RepoSnapshot } from '../src/index.js';
import { CONFIG, building } from '../../../test/helpers/lane.js';

const LEDGER = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
const HEAD = 'Round record: 1\n\n';
const round = (n: number, ...lines: string[]) => '## Round ' + n + '\n\n' + lines.join('\n') + '\n\n';
const at = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

const R1_FIXED = '1. Must — the option drops a header — fixed';
const R1_OPEN = '2. Must — no rollback — unverified';
const R2_OPEN = '1. Should — the cache can go stale — open';

interface Opts {
  approach?: string;
  ledger?: string;
  lane?: string;
  config?: string;
  claim?: ClaimPin; // the host's claim fact; absent: no claim fact
}
function repo({ approach, ledger = LEDGER, lane, config = CONFIG, claim }: Opts = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': config };
  building(files, 'T-1', lane === undefined ? undefined : { lane });
  files['accord/tickets/T-1/ledger.md'] = ledger;
  if (approach !== undefined) files['accord/tickets/T-1/approach-review.md'] = approach;
  const snapshot = loadSnapshot({ files, tree: Object.keys(files) });
  return claim === undefined ? snapshot : { ...snapshot, claimPins: { 'T-1': claim } };
}
const cut = { pin: APPROACH_CAP_FROM };
const ask = (o: Opts) => nextRound(repo(o), 'T-1', 'approach');

it('risk:complex-branching the approach critic gets two rounds from the cut-off and round 3 is refused with the open findings (ST-LN-91 91d-ac-2)', () => {
  const none = ask({ claim: cut });
  expect(none).toMatchObject({ kind: 'next', round: 1, cycle: 1, cap: 2 });
  expect(roundText(none)).toBe('Round: 1 of 2\nCycle: 1\n');

  const one = HEAD + round(1, R1_FIXED, R1_OPEN);
  const second = ask({ claim: cut, approach: one });
  expect(second).toMatchObject({ kind: 'next', round: 2, cap: 2 });
  expect(roundText(second)).toBe('Round: 2 of 2\nCycle: 1\n');

  const two = one + round(2, R2_OPEN);
  const refused = ask({ claim: cut, approach: two });
  expect(refused).toMatchObject({ kind: 'refused', cap: 2, cycle: 1, round: 2 });
  const reason = refused.reasons.join('\n');
  expect(reason).toContain('cap of 2 approach critique rounds');
  expect(reason).toContain('## Approach');
  expect(refused.findings).toEqual([
    { round: 1, lines: [R1_OPEN] },
    { round: 2, lines: [R2_OPEN] },
  ]);

  const text = roundText(refused);
  expect(text.startsWith('refused:')).toBe(true);
  expect(text).toContain('Findings still open:');
  expect(text).toContain(R1_OPEN);
  expect(text).toContain(R2_OPEN);
  expect(text).not.toContain(R1_FIXED);
  expect(text).not.toContain('stop: report to owner');
  expect(text).not.toContain('To allow more rounds');

  // D-18: lane P gets the cap of two exactly as lane M does.
  expect(ask({ claim: cut, lane: 'P' })).toMatchObject({ kind: 'next', round: 1, cap: 2 });
});

it('risk:complex-branching with no claim fact the working-tree pin decides the approach cap, and a failed claim read gives two (ST-LN-91 91d-ac-2)', () => {
  expect(ask({ config: at('0.4.0') })).toMatchObject({ kind: 'next', round: 1, cap: 5 });
  expect(ask({ config: at(APPROACH_CAP_FROM) })).toMatchObject({ kind: 'next', round: 1, cap: 2 });
  expect(ask({ config: at('0.4.0'), claim: { error: 'git failed' } })).toMatchObject({ kind: 'next', round: 1, cap: 2 });
});

const closed = (opt = 'B') => `## Closed option ${opt}: the owner's no\n\n`;
const allowance = (n: number, after: number) =>
  `${LEDGER}- Ruling: the owner allows ${n} more approach critique rounds after round ${after} of cycle 1 — "one more" — cost if wrong: one more round\n`;
const cycleOf = (s: RepoSnapshot) => s.work!['T-1'].approachRounds!.cycles[0];

it("risk:complex-branching the owner's no after round 2 closes the capped approach cycle (ST-LN-91 91d-ac-2)", () => {
  const two = HEAD + round(1, R1_FIXED, R1_OPEN) + round(2, R2_OPEN);
  const snapshot = repo({ claim: cut, approach: two + closed() });
  expect(recordProblems(snapshot, 'T-1', 'approach')).toEqual([]);
  expect(nextRound(snapshot, 'T-1', 'approach')).toMatchObject({ kind: 'next', cycle: 2, round: 1, cap: 2 });
});

it('risk:data-loss an open data-loss or security finding after approach round 2 blocks the approval and is not listed as a risk (ST-LN-91 D-22)', () => {
  const SEC = '1. Must — tokens are written to the log — unverified — risk: security';
  const LOSS = '2. Must — the export overwrites the old file — open — risk: data-loss';
  const approach = HEAD + round(1, SEC) + round(2, R2_OPEN, LOSS);
  const snapshot = repo({ claim: cut, approach });
  const refused = nextRound(snapshot, 'T-1', 'approach');
  expect(refused).toMatchObject({ kind: 'refused', cap: 2 });
  const reason = refused.reasons.join('\n');
  expect(reason).toContain('blocks the approval');
  expect(reason).toContain('## Closed');
  expect(refused.blocking).toEqual([
    { round: 1, lines: [SEC] },
    { round: 2, lines: [LOSS] },
  ]);
  expect(refused.findings).toEqual([{ round: 2, lines: [R2_OPEN] }]);

  const text = roundText(refused);
  const idx = (s: string) => text.indexOf(s);
  const blocking = idx('Blocking findings:');
  const open = idx('Findings still open:');
  expect(idx('refused:')).toBe(0);
  expect(blocking).toBeGreaterThan(idx('refused:'));
  expect(open).toBeGreaterThan(blocking);
  const head = text.slice(blocking, open);
  expect(head).toContain('Round 1:\n' + SEC);
  expect(head).toContain('Round 2:\n' + LOSS);
  const tail = text.slice(open);
  expect(tail).toContain('Round 2:\n' + R2_OPEN);
  expect(tail).not.toContain(SEC);
  expect(tail).not.toContain(LOSS);
  expect(text).not.toContain('stop: report to owner');

  expect(openFindings(cycleOf(snapshot))).toEqual([{ round: 2, lines: [R2_OPEN] }]);
  expect(blockingFindings(cycleOf(snapshot))).toEqual([
    { round: 1, lines: [SEC] },
    { round: 2, lines: [LOSS] },
  ]);

  // Fixed, the two risk findings no longer block: the refusal is the plain one of the capped cycle.
  const fixed = HEAD + round(1, SEC.replace('unverified', 'fixed')) + round(2, R2_OPEN, LOSS.replace('open', 'fixed'));
  const plain = nextRound(repo({ claim: cut, approach: fixed }), 'T-1', 'approach');
  expect(plain.kind).toBe('refused');
  expect(plain.blocking ?? []).toEqual([]);
  expect(roundText(plain)).not.toContain('Blocking findings:');
  expect(plain.reasons.join('\n')).not.toContain('blocks the approval');
  expect(plain.reasons.join('\n')).toContain('cap of 2 approach critique rounds');

  // The owner's no with a Correction closes the blocked cycle and starts a new one.
  const closedText = repo({ claim: cut, approach: approach + closed() });
  expect(recordProblems(closedText, 'T-1', 'approach')).toEqual([]);
  expect(nextRound(closedText, 'T-1', 'approach')).toMatchObject({ kind: 'next', cycle: 2, round: 1, cap: 2 });
});

it('risk:complex-branching an allowance Ruling grants no approach round 3 from the cut-off (ST-LN-91 91d-ac-2)', () => {
  const two = HEAD + round(1, R1_FIXED, R1_OPEN) + round(2, R2_OPEN);
  const refused = nextRound(repo({ claim: cut, approach: two, ledger: allowance(1, 2) }), 'T-1', 'approach');
  expect(refused).toMatchObject({ kind: 'refused', cap: 2 });
  expect(roundText(refused)).not.toContain('To allow more rounds');

  // A third round already written in the record is reported as run past the cap.
  const three = two + round(3, '1. Should — a wording — open');
  for (const ledger of [LEDGER, allowance(1, 2)]) {
    const past = nextRound(repo({ claim: cut, approach: three, ledger }), 'T-1', 'approach');
    expect(past.kind).toBe('refused');
    expect(past.reasons.join('\n')).toContain('past the cap of 2');
  }
});

it('risk:regression a ticket claimed under 0.4.0 keeps five approach rounds and its stop (ST-LN-91 91d-ac-2)', () => {
  const old = { pin: '0.4.0' };
  const three = HEAD + round(1, R1_FIXED) + round(2, '1. Should — a risk has no undo — fixed') + round(3, R2_OPEN);
  const stop = nextRound(repo({ claim: old, approach: three }), 'T-1', 'approach');
  expect(stop).toMatchObject({ kind: 'stop', cap: 5 });
  expect(stop.reasons.join('\n')).toContain('from round 3 such a round stops the loop');
  expect(roundText(stop)).toContain('To allow more rounds');

  const one = nextRound(repo({ claim: old, approach: HEAD + round(1, R1_FIXED) }), 'T-1', 'approach');
  expect(roundText(one)).toBe('Round: 2 of 5\nCycle: 1\n');

  // A claim pin lowered below the base pin is not an old claim: the cap of two holds.
  expect(ask({ claim: { pin: '0.4.0', basePin: APPROACH_CAP_FROM } })).toMatchObject({ kind: 'next', round: 1, cap: 2 });
});

it('risk:complex-branching the claim pin, not the record pin, decides the approach cap (ST-LN-91 D-15)', () => {
  const old = { pin: '0.4.0' };
  // (a) claimed under 0.4.0, the working tree already at the cut-off, no record yet.
  expect(roundText(ask({ claim: old, config: at(APPROACH_CAP_FROM) }))).toBe('Round: 1 of 5\nCycle: 1\n');

  // (c) claimed under 0.4.0, the record begun after the upgrade: still five rounds and the stop at round 3.
  const grounded = (text: string): string => text + ' — rests on: ac-1';
  const begun = (...rounds: string[]): Opts => ({ claim: old, config: at(APPROACH_CAP_FROM), approach: HEAD + rounds.join('') });
  const withRecordPin = (o: Opts, pin: string): RepoSnapshot => ({ ...repo(o), recordPins: { 'T-1': { approach: { pin } } } });
  const r1 = round(1, '1. Must — the option drops a header — fixed');
  const r2 = round(2, grounded('1. Should — a risk has no undo — fixed'));
  expect(roundText(nextRound(withRecordPin(begun(r1), APPROACH_CAP_FROM), 'T-1', 'approach'))).toBe('Round: 2 of 5\nCycle: 1\n');
  const r3 = round(3, grounded('1. Should — the cache can go stale — open'));
  const stop = nextRound(withRecordPin(begun(r1, r2, r3), APPROACH_CAP_FROM), 'T-1', 'approach');
  expect(stop).toMatchObject({ kind: 'stop', cap: 5 });
  expect(stop.reasons.join('\n')).toContain('from round 3 such a round stops the loop');

  // (b) claimed at the cut-off, the record begun under 0.4.0: two rounds.
  expect(nextRound(withRecordPin({ claim: cut }, '0.4.0'), 'T-1', 'approach')).toMatchObject({ kind: 'next', round: 1, cap: 2 });
});
