// ST-LN-91 91p-ac-3, D-07, D-12, D-15, D-17, D-18: plan critique gets three rounds and stops after a round whose Must + Should count did not fall,
// for a ticket claimed from PLAN_CAP_FROM; a ticket claimed under 0.4.0 keeps five rounds and the stop from round 3 whatever pin its plan record began
// under. The cap reads the ticket's claim pin (claimPinBefore), never the record pin, which stays the Phase 2 grounds rule's.
import { expect, it } from 'vitest';
import { GROUNDS_V2_FROM, PLAN_CAP, PLAN_CAP_FROM, capRulesOf, cycleState, gatePlan, loadSnapshot, nextRound, recordProblems, roundText } from '../src/index.js';
import type { ClaimPin, RecordPin, RepoSnapshot } from '../src/index.js';
import { CONFIG, building } from '../../../test/helpers/lane.js';

const LEDGER = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
const HEAD = 'Round record: 1\n\n';
const at = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

/** One round of the record: a number is that many open Shoulds, 'must' one Must, 'nice' one Nice, 'none' the line `No findings`, a list its own lines. */
type Spec = number | 'must' | 'nice' | 'none' | string[];
const lines = (s: Spec): string[] =>
  s === 'none'
    ? ['No findings']
    : s === 'nice'
      ? ['1. Nice — a wording in task 1 — open']
      : s === 'must'
        ? ['1. Must — task 1 drops a header — open — rests on: ac-1']
        : typeof s === 'number'
          ? Array.from({ length: s }, (_, i) => `${i + 1}. Should — task ${i + 1} drops a header — open — rests on: ac-1`)
          : s;
const record = (...rounds: Spec[]): string => HEAD + rounds.map((s, i) => `## Round ${i + 1} (${i === 0 ? 'whole' : 'diff'})\n\n${lines(s).join('\n')}\n\n`).join('');
const verdict = (v = 'accepted-by-owner "the owner takes it as it is"'): string => `verdict: ${v}\n\n`;
const CLOSED = '## Closed\n\n';

interface Opts {
  plan?: string;
  ledger?: string;
  lane?: string;
  config?: string;
  claim?: ClaimPin; // the host's claim fact; absent: no claim fact
  recordPin?: RecordPin; // the host's fact for the plan record's first round (the Phase 2 grounds rule)
}
function repo({ plan, ledger = LEDGER, lane, config = CONFIG, claim, recordPin }: Opts = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': config };
  building(files, 'T-1', lane === undefined ? undefined : { lane });
  files['accord/tickets/T-1/ledger.md'] = ledger;
  if (plan !== undefined) files['accord/tickets/T-1/plan-review.md'] = plan;
  let snapshot: RepoSnapshot = loadSnapshot({ files, tree: Object.keys(files) });
  if (claim !== undefined) snapshot = { ...snapshot, claimPins: { 'T-1': claim } };
  if (recordPin !== undefined) snapshot = { ...snapshot, recordPins: { 'T-1': { plan: recordPin } } };
  return snapshot;
}
const cut = { pin: PLAN_CAP_FROM };
const old = { pin: '0.4.0' };
const ask = (o: Opts) => nextRound(repo(o), 'T-1', 'plan');
const cycleOf = (s: RepoSnapshot, i = 0) => s.work!['T-1'].planRounds!.cycles[i];

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// The table: every shape of plan-review.md the stop reads (count flat, rising, falling; closed and open verdicts; No findings; owner drop; two cycles; the lanes) at both claim pins.
interface Row {
  id: string;
  rounds: Spec[];
  tail?: string; // text after the last round: a verdict line, a ## Closed heading, a further cycle
  claim?: ClaimPin | 'none';
  lane?: string;
  want: { kind: 'next' | 'stop' | 'refused'; round?: number; cycle?: number; cap?: number; text?: string[]; not?: string[] };
}
const NEXT3 = 'Round: 1 of 3\nCycle: 1\nCritics: plan checker\n';
const rows: Row[] = [
  { id: 'new-no-record', rounds: [], want: { kind: 'next', round: 1, cycle: 1, cap: 3, text: [NEXT3] } },
  { id: 'new-one-round-open', rounds: [2], want: { kind: 'next', round: 2, cap: 3, text: ['Round: 2 of 3\nCycle: 1\n'], not: ['Critics:'] } },
  {
    id: 'new-count-flat-2-2',
    rounds: [2, 2],
    want: {
      kind: 'stop',
      round: 2,
      cap: 3,
      text: [
        'stop: report to owner\nReason: round 2 of cycle 1 reports 2 Must and Should, not fewer than the 2 of round 1: the count did not fall, so the loop stops\n',
        'To accept the open findings: end plan-review.md with the line verdict: accepted-by-owner',
        'more plan critique rounds after round 2 of cycle 1',
      ],
    },
  },
  { id: 'new-count-flat-1-1', rounds: [1, 1], want: { kind: 'stop', round: 2, text: ['the count did not fall'] } },
  { id: 'new-count-rising-2-3', rounds: [2, 3], want: { kind: 'stop', round: 2, text: ['reports 3 Must and Should, not fewer than the 2 of round 1'] } },
  { id: 'new-count-rising-from-nice-0-1', rounds: ['nice', 1], want: { kind: 'stop', round: 2, text: ['reports 1 Must and Should, not fewer than the 0 of round 1'] } },
  { id: 'new-count-falling-3-1', rounds: [3, 1], want: { kind: 'next', round: 3, cap: 3, text: ['Round: 3 of 3\nCycle: 1\n'] } },
  { id: 'new-count-falling-must-1', rounds: [2, 'must'], want: { kind: 'next', round: 3, cap: 3 } },
  { id: 'new-count-must-flat', rounds: ['must', 'must'], want: { kind: 'stop', round: 2 } },
  { id: 'new-round-2-only-a-nice', rounds: [2, 'nice'], want: { kind: 'next', round: 3, cap: 3 } },
  { id: 'new-nice-is-not-counted', rounds: [['1. Should — task 1 drops a header — open — rests on: ac-1', '2. Should — task 2 drops a header — open — rests on: ac-1', '3. Nice — a wording — open', '4. Nice — another wording — open'], 2], want: { kind: 'stop', round: 2 } },
  { id: 'new-zero-flat-nice-nice', rounds: ['nice', 'nice'], want: { kind: 'next', round: 3, cap: 3 } },
  { id: 'new-round-3-one-should-stops', rounds: [3, 2, 1], want: { kind: 'stop', round: 3, cap: 3, text: ['Reason: round 3 of cycle 1 still reports a Should or a Must, and from round 3 such a round stops the loop\nReason: the cap of 3 rounds in cycle 1 is reached\n'] } },
  {
    id: 'new-round-3-no-findings-ends-the-loop',
    rounds: [3, 2, 'none'],
    want: { kind: 'refused', round: 3, cap: 3, text: ['refused: round 3 of cycle 1 reported no findings and the cap of 3 rounds is reached; the loop has ended: write the verdict'] },
  },
  { id: 'new-round-3-a-nice-at-the-cap', rounds: [3, 2, 'nice'], want: { kind: 'stop', round: 3, text: ['the cap of 3 rounds in cycle 1 is reached and no owner Ruling in the ledger allows more'] } },
  { id: 'new-round-4-written-past-the-cap', rounds: [3, 2, 'none', 1], want: { kind: 'stop', text: ['round 4 of cycle 1 ran without an owner Ruling allowing it: past the cap of 3 rounds'] } },
  { id: 'new-round-3-run-after-the-count-stop', rounds: [2, 2, 1], want: { kind: 'stop', text: ['round 3 of cycle 1 ran without an owner Ruling allowing it: after the stop at round 2'] } },
  {
    id: 'new-owner-takes-the-count-stop',
    rounds: [2, 2],
    tail: verdict(),
    want: { kind: 'refused', round: 2, cycle: 1, text: ['refused: plan-review.md ends cycle 1 with verdict: accepted-by-owner at line', 'the loop has ended'], not: ['stop: report to owner'] },
  },
  { id: 'new-verdict-converged-after-a-falling-round', rounds: [3, 1], tail: verdict('converged'), want: { kind: 'refused', round: 2, text: ['ends cycle 1 with verdict: converged'] } },
  { id: 'new-converged-over-a-count-stop-keeps-the-stop', rounds: [2, 2], tail: verdict('converged'), want: { kind: 'stop', round: 2, text: ['the count did not fall'] } },
  { id: 'new-unquoted-accept-keeps-the-stop', rounds: [2, 2], tail: 'verdict: accepted-by-owner\n\n', want: { kind: 'stop', round: 2 } },
  { id: 'new-closed-after-round-1-starts-cycle-2', rounds: ['none'], tail: verdict('converged') + CLOSED, want: { kind: 'next', round: 1, cycle: 2, cap: 3, text: [NEXT3.replace('Cycle: 1', 'Cycle: 2')] } },
  {
    id: 'new-cycle-2-count-starts-again',
    rounds: [2, 2],
    tail: verdict() + CLOSED + '## Round 1 (whole)\n\n1. Should — task 1 drops a header — open — rests on: ac-1\n\n',
    want: { kind: 'next', round: 2, cycle: 2, cap: 3, text: ['Round: 2 of 3\nCycle: 2\n'], not: ['Critics:'] },
  },
  {
    id: 'new-cycle-2-count-flat-stops',
    rounds: [2, 2],
    tail: verdict() + CLOSED + '## Round 1 (whole)\n\n1. Should — task 1 drops a header — open — rests on: ac-1\n\n## Round 2 (diff)\n\n1. Should — task 2 drops a header — open — rests on: ac-1\n\n',
    want: { kind: 'stop', round: 2, cycle: 2, text: ['round 2 of cycle 2 reports 1 Must and Should, not fewer than the 1 of round 1'] },
  },
  { id: 'new-lane-p-gets-the-plan-rules', rounds: [], lane: 'P', want: { kind: 'next', round: 1, cap: 3, text: [NEXT3] } },
  { id: 'new-lane-l-gets-the-plan-rules', rounds: [2, 2], lane: 'L', want: { kind: 'stop', round: 2 } },
  { id: 'new-lane-s-has-no-plan-critique', rounds: [], lane: 'S', want: { kind: 'refused', text: ['refused: lane S has no plan critique'] } },
  { id: 'new-failed-claim-read-gives-the-new-rules', rounds: [], claim: { error: 'git failed' }, want: { kind: 'next', round: 1, cap: 3, text: [NEXT3] } },

  // A ticket claimed under 0.4.0: five rounds, the stop from round 3, the 0.4.0 texts, no Critics line.
  { id: 'old-no-record', rounds: [], claim: old, want: { kind: 'next', round: 1, cap: 5, text: ['Round: 1 of 5\nCycle: 1\n'], not: ['Critics:'] } },
  { id: 'old-count-flat-2-2', rounds: [2, 2], claim: old, want: { kind: 'next', round: 3, cap: 5, text: ['Round: 3 of 5\nCycle: 1\n'], not: ['Critics:'] } },
  { id: 'old-count-rising-2-3', rounds: [2, 3], claim: old, want: { kind: 'next', round: 3, cap: 5 } },
  {
    id: 'old-round-3-one-should-stops',
    rounds: [2, 2, 1],
    claim: old,
    want: { kind: 'stop', round: 3, cap: 5, text: ['stop: report to owner\nReason: round 3 of cycle 1 still reports a Should or a Must, and from round 3 such a round stops the loop\n'], not: ['did not fall'] },
  },
  { id: 'old-round-4-after-a-nice-round-3', rounds: [2, 2, 'nice'], claim: old, want: { kind: 'next', round: 4, cap: 5 } },
  { id: 'old-five-nice-rounds-reach-the-cap', rounds: ['nice', 'nice', 'nice', 'nice', 'nice'], claim: old, want: { kind: 'stop', round: 5, cap: 5, text: ['Reason: the cap of 5 rounds in cycle 1 is reached and no owner Ruling in the ledger allows more\n'] } },
  { id: 'old-cycle-2-prints-no-critics', rounds: ['none'], tail: verdict('converged') + CLOSED, claim: old, want: { kind: 'next', round: 1, cycle: 2, cap: 5, text: ['Round: 1 of 5\nCycle: 2\n'], not: ['Critics:'] } },
  { id: 'old-lane-p', rounds: [2, 2], claim: old, lane: 'P', want: { kind: 'next', round: 3, cap: 5 } },
  { id: 'old-lane-s', rounds: [], claim: old, lane: 'S', want: { kind: 'refused', text: ['refused: lane S has no plan critique'] } },

  // No claim fact (no claim commit, no git): the working-tree pin decides, as it does for the approach cap; here it is the cut-off.
  { id: 'nofact-working-tree-pin-at-the-cut-off', rounds: [], claim: 'none', want: { kind: 'next', round: 1, cap: 3, text: [NEXT3] } },
];

for (const r of rows) {
  it(`risk:complex-branching plan critique ${r.id} (ST-LN-91 91p-ac-3)`, () => {
    const claim = r.claim === 'none' ? undefined : r.claim ?? cut;
    const plan = r.rounds.length === 0 && r.tail === undefined ? undefined : record(...r.rounds) + (r.tail ?? '');
    const a = ask({ plan, claim, lane: r.lane, ...(r.claim === 'none' ? { config: at(PLAN_CAP_FROM) } : {}) });
    expect(a.kind, JSON.stringify(a)).toBe(r.want.kind);
    for (const k of ['round', 'cycle', 'cap'] as const) if (r.want[k] !== undefined) expect(a[k], k).toBe(r.want[k]);
    const text = roundText(a);
    for (const t of r.want.text ?? []) expect(text, t).toContain(t);
    for (const t of r.want.not ?? []) expect(text, t).not.toContain(t);
    if (r.want.kind === 'next') expect(text.startsWith('Round: ')).toBe(true);
    if (r.want.kind === 'stop') expect(text.startsWith('stop: report to owner\n')).toBe(true);
  });
}

it('risk:complex-branching a next answer prints exactly the lines the pin gives, with the Critics line only at round 1 under the new rules (ST-LN-91 D-12)', () => {
  // The new rules: three lines at round 1, two later.
  expect(roundText(ask({ claim: cut }))).toBe('Round: 1 of 3\nCycle: 1\nCritics: plan checker\n');
  expect(roundText(ask({ claim: cut, plan: record(2) }))).toBe('Round: 2 of 3\nCycle: 1\n');
  expect(ask({ claim: cut })).toMatchObject({ kind: 'next', checker: true });
  expect(ask({ claim: cut, plan: record(2) }).checker).toBeUndefined();

  // 0.4.0: the 0.4.0 text in every cycle.
  expect(roundText(ask({ claim: old }))).toBe('Round: 1 of 5\nCycle: 1\n');
  expect(ask({ claim: old }).checker).toBeUndefined();
  const second = record('none') + verdict('converged') + CLOSED;
  expect(roundText(ask({ claim: old, plan: second }))).toBe('Round: 1 of 5\nCycle: 2\n');
  expect(roundText(ask({ claim: cut, plan: second }))).toBe('Round: 1 of 3\nCycle: 2\nCritics: plan checker\n');

  // No claim fact: the working-tree pin.
  expect(roundText(ask({ config: at('0.4.0') }))).toBe('Round: 1 of 5\nCycle: 1\n');
  expect(roundText(ask({ config: at(PLAN_CAP_FROM) }))).toBe('Round: 1 of 3\nCycle: 1\nCritics: plan checker\n');

  // Another record kind never prints it.
  const approach = nextRound(repo({ claim: cut }), 'T-1', 'approach');
  expect(approach.checker).toBeUndefined();
  expect(roundText(approach)).not.toContain('Critics:');
  expect(roundText(nextRound(repo({ claim: cut }), 'T-1', 'review'))).not.toContain('Critics:');
});

it('risk:complex-branching the claim pin, not the record pin, decides the plan cap and the Critics line (ST-LN-91 D-15)', () => {
  const lines3 = (s: RepoSnapshot): string[] => roundText(nextRound(s, 'T-1', 'plan')).split('\n').filter((l) => /^(Round|Cycle|Critics):/.test(l));

  // (a) claimed under 0.4.0, the working-tree pin upgraded, no plan-review.md
  expect(roundText(ask({ claim: old, config: at(PLAN_CAP_FROM) }))).toBe('Round: 1 of 5\nCycle: 1\n');

  // (c) claimed under 0.4.0, the plan critique begun after the upgrade (record pin at the cut-off): five rounds, no count stop, no Critics line
  // The record pin asks round 2 for grounds, so round 2's two Shoulds rest on ac-1; the assertions read the cap, the stop and the lines only.
  const grounded2 = [1, 2].map((n) => `${n}. Should — task ${n} drops a header — open — rests on: ac-1`);
  const flat = record(2, grounded2);
  const c = repo({ claim: old, config: at(PLAN_CAP_FROM), plan: flat, recordPin: { pin: PLAN_CAP_FROM } });
  expect(nextRound(c, 'T-1', 'plan')).toMatchObject({ kind: 'next', round: 3, cap: 5 });
  expect(capRulesOf(c, 'T-1', 'plan')).toMatchObject({ cap: 5, fall: false });
  const closed = repo({ claim: old, config: at(PLAN_CAP_FROM), plan: flat + verdict() + CLOSED, recordPin: { pin: PLAN_CAP_FROM } });
  expect(lines3(closed)).toEqual(['Round: 1 of 5', 'Cycle: 2']);

  // (b) claimed at the cut-off, the plan record begun under 0.4.0: three rounds, the Critics line
  const b = repo({ claim: cut, config: CONFIG, recordPin: old });
  expect(lines3(b)).toEqual(['Round: 1 of 3', 'Cycle: 1', 'Critics: plan checker']);
  const bFlat = repo({ claim: cut, plan: flat, recordPin: old });
  expect(nextRound(bFlat, 'T-1', 'plan')).toMatchObject({ kind: 'stop', round: 2 });
  expect(capRulesOf(bFlat, 'T-1', 'plan')).toBe(PLAN_CAP);

  // A claim pin lowered on the branch below the default branch's pin, and a failed claim read, give the new rules.
  expect(capRulesOf(repo({ claim: { pin: '0.4.0', basePin: PLAN_CAP_FROM } }), 'T-1', 'plan')).toBe(PLAN_CAP);
  expect(capRulesOf(repo({ claim: { error: 'git failed' } }), 'T-1', 'plan')).toBe(PLAN_CAP);
  // A pin that is not a plain release gives the new rules too (claimPinBefore fails closed).
  for (const pin of ['main', '0.4.1-rc.1', '', '1.0']) expect(capRulesOf(repo({ claim: { pin } }), 'T-1', 'plan'), pin).toBe(PLAN_CAP);
  expect(capRulesOf(repo({ claim: { pin: '0.3.9' } }), 'T-1', 'plan').cap).toBe(5);
});

it('risk:complex-branching a deferred finding does not count and a risk finding always does (ST-LN-91 91p-ac-3)', () => {
  const pin = { pin: GROUNDS_V2_FROM };
  const CASE = 'a header written twice';
  const deferredLine = (n: number): string => `plan 2.${n}: task ${n} drops a header — failing case: ${CASE}`;
  const ledger = (...d: string[]): string => LEDGER + (d.length === 0 ? '' : '\n## Deferred\n' + d.map((x) => '- ' + x + '\n').join(''));
  const grounded = (n: number): string => `${n}. Should — task ${n} drops a header — open — rests on: ac-1`;
  const deferred = (n: number): string => `${n}. Should — task ${n} drops a header — deferred`;
  const o = (round2: string[], ...d: string[]): Opts => ({ claim: cut, recordPin: pin, ledger: ledger(...d), plan: record(2, round2) });

  // Two Shoulds in round 2 against two in round 1 stop the loop; with one of them deferred with its line and failing case the count is 1 and falls.
  const both = ask(o([grounded(1), grounded(2)]));
  expect(both).toMatchObject({ kind: 'stop', round: 2 });
  const one = ask(o([grounded(1), deferred(2)], deferredLine(2)));
  expect(one).toMatchObject({ kind: 'next', round: 3, cap: 3 });
  expect(recordProblems(repo(o([grounded(1), deferred(2)], deferredLine(2))), 'T-1', 'plan')).toEqual([]);
  // Both deferred: count 0.
  expect(ask(o([deferred(1), deferred(2)], deferredLine(1), deferredLine(2)))).toMatchObject({ kind: 'next', round: 3 });
  // Deferred without its failing case: refused by the grounds rule, never a way to lower the count.
  const bare = ask(o([grounded(1), deferred(2)], `plan 2.2: task 2 drops a header`));
  expect(bare.kind).toBe('refused');
  expect(bare.reasons.join('\n')).toContain('rests on');

  // A risk finding is never deferred and counts: written deferred it is refused; written open it counts toward the stop.
  const o1 = (round2: string[], ...d: string[]): Opts => ({ claim: cut, recordPin: pin, ledger: ledger(...d), plan: record(1, round2) });
  const risky = ask(o1([`1. Should — task 1 leaks a token — open — risk: security`, deferred(2)], deferredLine(2)));
  expect(risky).toMatchObject({ kind: 'stop', round: 2 });
  expect(risky.reasons.join('\n')).toContain('reports 1 Must and Should, not fewer than the 1 of round 1');
  // The same round with the risk finding replaced by a deferred one counts 0 and the loop goes on: the risk finding is what counted.
  expect(ask(o1([deferred(1), deferred(2)], deferredLine(1), deferredLine(2)))).toMatchObject({ kind: 'next', round: 3 });
  const loss = ask(o([`1. Should — task 1 overwrites a file — deferred — risk: data-loss`, grounded(2)], deferredLine(1)));
  expect(loss.kind).toBe('refused');
  expect(loss.reasons.join('\n')).toContain('never deferred');
  // A lone data-loss finding in round 2 against one finding in round 1 stops the loop at once.
  const lone = ask({ claim: cut, recordPin: pin, plan: record(1, [`1. Must — task 1 overwrites a file — open — risk: data-loss`]) });
  expect(lone).toMatchObject({ kind: 'stop', round: 2 });
  // Deferred findings do not lower the count under a ticket claimed under 0.4.0 either: it has no count stop at all.
  expect(ask({ ...o([grounded(1), grounded(2)]), claim: old })).toMatchObject({ kind: 'next', round: 3, cap: 5 });
});

it('risk:complex-branching the stop of a round counts only that cycle, and stopAt sees the count stop from round 2 under PLAN_CAP only (ST-LN-91 91p-ac-3)', () => {
  const s = repo({ claim: cut, plan: record(2, 2, 'none') });
  const cycle = cycleOf(s);
  const st = cycleState(cycle, [], 'plan', new Set(), PLAN_CAP);
  expect(st.stopAt(1)).toBeUndefined();
  expect(st.stopAt(2)).toBe(2);
  // Round 3 reports no findings: it clears the stop of round 2, as it clears a stop from round 3 today.
  expect(st.stopAt(3)).toBeUndefined();
  // Without the count rule (the five-round rules) round 2 is no stop.
  expect(cycleState(cycle, [], 'plan', new Set(), capRulesOf(repo({ claim: old }), 'T-1', 'plan')).stopAt(2)).toBeUndefined();
  // An owner verdict after the stop round skips it.
  const accepted = repo({ claim: cut, plan: record(2, 2) + verdict() });
  expect(cycleState(cycleOf(accepted), [], 'plan', new Set(), PLAN_CAP).stopAt(2)).toBeUndefined();
});

it('risk:complex-branching an owner allowance Ruling still grants plan rounds under the cap of three (ST-LN-91 D-17)', () => {
  const allow = (n: number, after: number): string => `${LEDGER}- Ruling: the owner allows ${n} more plan critique rounds after round ${after} of cycle 1 — "one more" — cost if wrong: one more round\n`;
  // The count stop at round 2: an allowance after round 2 gives round 3.
  expect(ask({ claim: cut, plan: record(2, 2), ledger: allow(1, 2) })).toMatchObject({ kind: 'next', round: 3, cap: 3 });
  // The cap: an allowance after round 3 gives round 4 of 4.
  const third = record(3, 2, 1);
  expect(ask({ claim: cut, plan: third, ledger: allow(1, 3) })).toMatchObject({ kind: 'next', round: 4, cap: 4 });
  expect(roundText(ask({ claim: cut, plan: third, ledger: allow(1, 3) }))).toBe('Round: 4 of 4\nCycle: 1\n');
  // No allowance, no fourth round: round 4 written without one is refused as past the cap.
  const four = ask({ claim: cut, plan: record(3, 2, 1, 1) });
  expect(four.kind).toBe('stop');
  expect(four.reasons.join('\n')).toContain('past the cap of 3 rounds');
  // The allowance after round 3 does not lift a count stop at round 2 that no verdict has ended.
  expect(ask({ claim: cut, plan: record(2, 2), ledger: allow(1, 3) }).kind).toBe('stop');
  // A line that is not an allowance grants nothing.
  expect(ask({ claim: cut, plan: record(2, 2), ledger: LEDGER + '- Ruling: the owner allows one more round\n' }).kind).toBe('stop');
});

it('risk:complex-branching the plan rules are for a plan record only: review and approach keep their own caps (ST-LN-91 D-07)', () => {
  expect(capRulesOf(repo({ claim: cut }), 'T-1', 'review')).toMatchObject({ cap: 5, fall: false });
  expect(capRulesOf(repo({ claim: cut }), 'T-1', 'approach')).toMatchObject({ cap: 2, fall: false });
  expect(PLAN_CAP).toEqual({ cap: 3, firstStop: 3, fall: true, allowances: true, capStop: true });
  // The version cut-off sits beside the other cut-offs.
  expect(PLAN_CAP_FROM).toBe('0.4.1');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// gate plan reads the same stops from the same rules (gate.plan-rounds), and names what stopped the loop.
const gateRounds = (o: Opts): string[] =>
  gatePlan(repo(o), 'T-1')
    .findings.filter((f) => f.rule === 'gate.plan-rounds')
    .map((f) => f.reason);
const allow = (n: number, after: number): string => `${LEDGER}- Ruling: the owner allows ${n} more plan critique rounds after round ${after} of cycle 1 — "one more" — cost if wrong: ${n} rounds\n`;

it('risk:complex-branching gate plan reports the count stop and a round past the cap of three (ST-LN-91 91p-ac-3)', () => {
  // A record stopped by the count at round 2 with no verdict: the finding names the count and both numbers.
  const stopped = gateRounds({ claim: cut, plan: record(2, 2) });
  expect(stopped).toHaveLength(1);
  expect(stopped[0]).toContain('round 2 of plan critique cycle 1 stops the loop for the owner');
  expect(stopped[0]).toContain('the count did not fall: 2 Must and Should against 2 in round 1');
  expect(stopped[0]).toContain('verdict: accepted-by-owner');

  // The owner's verdict after the stop ends it.
  expect(gateRounds({ claim: cut, plan: record(2, 2) + verdict() })).toEqual([]);
  // A falling count is no stop.
  expect(gateRounds({ claim: cut, plan: record(3, 1) })).toEqual([]);

  // A round 3 with a finding stops from round 3 and at the cap of three, and says so.
  const third = gateRounds({ claim: cut, plan: record(3, 2, 1) });
  expect(third).toHaveLength(1);
  expect(third[0]).toContain('a Should or a Must from round 3');
  expect(third[0]).toContain('the cap of 3 rounds');

  // A fourth round with no allowance ran past the cap of three.
  const fourth = gateRounds({ claim: cut, plan: record(3, 2, 1, 'none') });
  expect(fourth.join('\n')).toContain('round 4 of cycle 1 ran without an owner Ruling allowing it: past the cap of 3 rounds');
  // With the owner's allowance Ruling the fourth round passes.
  expect(gateRounds({ claim: cut, plan: record(3, 2, 1, 'none') + verdict('converged'), ledger: allow(1, 3) })).toEqual([]);
  expect(gateRounds({ claim: cut, plan: record(3, 2, 1, 'none'), ledger: allow(1, 3) })).toEqual([]);
  // A round run after the count stop, with no allowance, is named.
  expect(gateRounds({ claim: cut, plan: record(2, 2, 1) }).join('\n')).toContain('round 3 of cycle 1 ran without an owner Ruling allowing it: after the stop at round 2');
  // A data-loss finding is no way round the count: it counts, and a stop for it is a stop.
  const pin = { pin: GROUNDS_V2_FROM };
  expect(gateRounds({ claim: cut, recordPin: pin, plan: record(1, ['1. Must — task 1 overwrites a file — open — risk: data-loss']) })).toHaveLength(1);
});

it('risk:regression a ticket claimed under 0.4.0 keeps five plan rounds and the stop from round 3 at gate plan (ST-LN-91 91p-ac-3)', () => {
  // Equal counts in rounds 1 and 2 are no stop, also when the plan critique began after the upgrade (D-15).
  expect(gateRounds({ claim: old, plan: record(2, 2) })).toEqual([]);
  const grounded2 = [1, 2].map((n) => `${n}. Should — task ${n} drops a header — open — rests on: ac-1`);
  expect(gateRounds({ claim: old, config: at(PLAN_CAP_FROM), recordPin: { pin: PLAN_CAP_FROM }, plan: record(2, grounded2) })).toEqual([]);
  // The stop from round 3 and its text are the 0.4.0 ones.
  const three = gateRounds({ claim: old, plan: record(2, 2, 1) });
  expect(three).toHaveLength(1);
  expect(three[0]).toContain('(a Should or a Must from round 3, or the cap of 5 rounds)');
  expect(three[0]).not.toContain('did not fall');
  // Four rounds with findings are fine under five.
  expect(gateRounds({ claim: old, plan: record('nice', 'nice', 'nice', 'nice') })).toEqual([]);
  // The claim pin lowered on the branch gives the new rules.
  expect(gateRounds({ claim: { pin: '0.4.0', basePin: PLAN_CAP_FROM }, plan: record(2, 2) })).toHaveLength(1);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// ST-LN-91 WR-04: a failed read of the claim pin gives the new plan rules (fail closed), and every plan answer that applies them says why, as the approach answers do.
it('risk:security a failed claim-pin read names the git error in accord round --plan and in gate plan (ST-LN-91 WR-04)', () => {
  const GIT = 'git failed reading the claim pin of T-1: bad object';
  const claim = { error: GIT };
  const says = (text: string): void => {
    expect(text).toContain(GIT);
    expect(text).toContain('the claim pin could not be read');
  };

  // The next round: the cap of three and the plan checker, with the reason.
  const first = roundText(ask({ claim }));
  expect(first).toContain('Round: 1 of 3');
  expect(first).toContain('Critics: plan checker');
  says(first);
  // The count stop and the stop at the cap.
  const counted = roundText(ask({ claim, plan: record(2, 2) }));
  expect(counted.startsWith('stop: report to owner\n')).toBe(true);
  says(counted);
  says(roundText(ask({ claim, plan: record(3, 2, 1) })));
  // A round run past the cap, and one run after a stop.
  says(roundText(ask({ claim, plan: record(3, 2, 1, 'none') })));
  says(roundText(ask({ claim, plan: record(2, 2, 1) })));
  // The round-1 grounds refusal: asked because the new rules apply.
  const bare = ask({ claim, plan: HEAD + '## Round 1 (whole)\n\n1. Should — task 1 drops a header — open\n\n' });
  expect(bare.kind).toBe('refused');
  says(roundText(bare));
  // A plan record with a verdict: the loop has ended.
  says(roundText(ask({ claim, plan: record(2, 2) + verdict() })));

  // Without the failed read nothing is added, to a claim at either pin.
  for (const c of [cut, old]) {
    for (const plan of [undefined, record(2, 2), record(3, 2, 1)]) expect(roundText(ask({ claim: c, plan })), JSON.stringify(c)).not.toContain('claim pin could not be read');
  }
  // The answer is the same as for the working claim at the cut-off, plus the reason.
  const plain = roundText(ask({ claim: cut, plan: record(2, 2) }));
  expect(counted.startsWith(plain.split('\n')[0])).toBe(true);
  expect(counted.split('\n').filter((l) => !l.includes('claim pin could not be read'))).toEqual(plain.split('\n'));

  // gate plan: the stop finding names the error too.
  const rounds = gateRounds({ claim, plan: record(2, 2) });
  expect(rounds).toHaveLength(1);
  says(rounds[0]);
  expect(gateRounds({ claim: cut, plan: record(2, 2) })[0]).not.toContain('could not be read');
});
