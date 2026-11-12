// ST-LN-91 91d-ac-2: the approach critic gets two rounds for a ticket claimed from APPROACH_CAP_FROM, and round 3 is refused with the
// findings still open. The cap reads the ticket's claim pin (D-15), never the approach record's own pin.
import { expect, it } from 'vitest';
import { APPROACH_CAP_FROM, approvalBlockers, blockingFindings, loadSnapshot, nextRound, openFindings, recordProblems, roundText } from '../src/index.js';
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

it('risk:complex-branching withdrawn, repeated and owner-dropped findings are not open and block nothing (ST-LN-91 CR-01)', () => {
  // The three closing states critique.md tells the session to write, on Must and Should lines, risk-marked or not.
  const WITHDRAWN = '1. Must — a withdrawn one — withdrawn';
  const DROPPED = '2. Should — the owner dropped it — owner: "drop it"';
  const REPEATED = '3. Must — a repeated one — repeated as 2.1';
  const SEC_WITHDRAWN = '4. Must — a withdrawn token leak — withdrawn — risk: security';
  const LOSS_DROPPED = '5. Must — an overwrite the owner accepted — owner: "accepted" — risk: data-loss';
  const LOSS_REPEATED = '6. Must — a repeated overwrite — repeated as 2.2 — risk: data-loss';
  const REPEAT = '1. Must — repeats 1.3: a repeated one — open';
  const approach = HEAD + round(1, WITHDRAWN, DROPPED, REPEATED, SEC_WITHDRAWN, LOSS_DROPPED, LOSS_REPEATED) + round(2, REPEAT);
  const snapshot = repo({ claim: cut, approach });

  // Only the open finding of round 2 is open: once, not under round 1 as well.
  expect(openFindings(cycleOf(snapshot))).toEqual([{ round: 2, lines: [REPEAT] }]);
  expect(blockingFindings(cycleOf(snapshot))).toEqual([]);

  const refused = nextRound(snapshot, 'T-1', 'approach');
  expect(refused).toMatchObject({ kind: 'refused', cap: 2 });
  expect(refused.findings).toEqual([{ round: 2, lines: [REPEAT] }]);
  expect(refused.blocking ?? []).toEqual([]);
  const text = roundText(refused);
  expect(text).not.toContain('Blocking findings:');
  expect(refused.reasons.join('\n')).not.toContain('blocks the approval');
  for (const closed of [WITHDRAWN, DROPPED, REPEATED, SEC_WITHDRAWN, LOSS_DROPPED, LOSS_REPEATED]) expect(text, closed).not.toContain(closed);

  // The states that stay open still count: open, unverified, and a line with no state.
  const stays = HEAD + round(1, '1. Must — one — open', '2. Should — two — unverified: no citation', '3. Must — three — open — risk: security') + round(2, R2_OPEN);
  const open = repo({ claim: cut, approach: stays });
  expect(openFindings(cycleOf(open)).flatMap((r) => r.lines)).toEqual([
    '1. Must — one — open',
    '2. Should — two — unverified: no citation',
    R2_OPEN,
  ]);
  expect(blockingFindings(cycleOf(open))).toEqual([{ round: 1, lines: ['3. Must — three — open — risk: security'] }]);
});

it('risk:security an open risk finding still blocks when round 2 reports no findings or a verdict ends the loop (ST-LN-91 D-22)', () => {
  const SEC = '1. Must — tokens are written to the log — open — risk: security';
  const blocked = (approach: string) => {
    const refused = nextRound(repo({ claim: cut, approach }), 'T-1', 'approach');
    expect(refused.kind).toBe('refused');
    expect(refused.blocking).toEqual([{ round: 1, lines: [SEC] }]);
    expect(refused.reasons.join('\n')).toContain('blocks the approval');
    expect(roundText(refused)).toContain('Blocking findings:\nRound 1:\n' + SEC);
    return refused;
  };
  // (a) round 2 is a diff round that lists nothing: the loop has ended, and the finding stays open.
  const none = HEAD + round(1, SEC) + round(2, 'No findings');
  blocked(none);
  // (b) any verdict line after round 2, quoted or not, accepted or not.
  for (const verdict of ['verdict: accepted-by-owner "fine"', 'verdict: accepted-by-owner', 'verdict: converged']) {
    blocked(HEAD + round(1, SEC) + round(2, R2_OPEN) + verdict + '\n');
    blocked(none + verdict + '\n');
  }
  // (c) with the finding fixed, the ended loop is the plain ended loop again.
  const fixed = HEAD + round(1, SEC.replace('open', 'fixed')) + round(2, 'No findings');
  const ended = nextRound(repo({ claim: cut, approach: fixed }), 'T-1', 'approach');
  expect(ended.kind).toBe('refused');
  expect(ended.blocking ?? []).toEqual([]);
  expect(ended.reasons.join('\n')).not.toContain('blocks the approval');
  // (d) a ticket claimed under 0.4.0 keeps the old loop: the verdict ends it with no blocking check.
  const old = nextRound(repo({ claim: { pin: '0.4.0' }, approach: HEAD + round(1, SEC) + round(2, R2_OPEN) + 'verdict: converged\n' }), 'T-1', 'approach');
  expect(old.blocking ?? []).toEqual([]);
});

it('risk:security approvalBlockers lists the open risk findings of the last approach cycle on the capped rules only (ST-LN-91 D-22)', () => {
  const SEC = '1. Must — tokens are written to the log — open — risk: security';
  const approach = HEAD + round(1, SEC) + round(2, R2_OPEN);
  expect(approvalBlockers(repo({ claim: cut, approach }), 'T-1')).toEqual([{ round: 1, lines: [SEC] }]);
  // Round 1 alone already blocks: the owner is not asked to say yes over it.
  expect(approvalBlockers(repo({ claim: cut, approach: HEAD + round(1, SEC) }), 'T-1')).toEqual([{ round: 1, lines: [SEC] }]);
  // The owner's no opens a new cycle, which holds nothing.
  expect(approvalBlockers(repo({ claim: cut, approach: approach + closed() }), 'T-1')).toEqual([]);
  expect(approvalBlockers(repo({ claim: cut, approach: HEAD + round(1, SEC.replace('open', 'fixed')) }), 'T-1')).toEqual([]);
  // No record, a lane S ticket with no approach record, and a ticket claimed under 0.4.0 (five rounds, D-12): nothing blocks.
  expect(approvalBlockers(repo({ claim: cut }), 'T-1')).toEqual([]);
  expect(approvalBlockers(repo({ claim: { pin: '0.4.0' }, approach }), 'T-1')).toEqual([]);
  expect(approvalBlockers(repo({ claim: cut, approach }), 'T-404')).toEqual([]);
});

it('risk:complex-branching a failed claim read is named in the refusal that follows from the cap of two (ST-LN-91 WR-01)', () => {
  const error = 'git failed reading the claim pin of T-1: unable to read the index';
  const five = HEAD + [1, 2, 3, 4, 5].map((n) => round(n, '1. Nice — a wording — deferred')).join('');
  const refused = nextRound(repo({ claim: { error }, approach: five }), 'T-1', 'approach');
  expect(refused.kind).toBe('refused');
  const reason = refused.reasons.join('\n');
  expect(reason).toContain('past the cap of 2');
  expect(reason).toContain(error);
  expect(roundText(refused)).toContain('refused: ' + error);
  // A readable fact adds no such line.
  const plain = nextRound(repo({ claim: cut, approach: five }), 'T-1', 'approach');
  expect(plain.reasons.join('\n')).not.toContain('git failed');
  // A next round is no refusal and says nothing of git.
  expect(roundText(nextRound(repo({ claim: { error } }), 'T-1', 'approach'))).toBe('Round: 1 of 2\nCycle: 1\n');
});
