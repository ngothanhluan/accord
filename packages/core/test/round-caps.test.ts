// ST-LN-50 t2-ac-4, D-07: a team sets the round cap of each critic record (approach, plan, review) from 1 to 99 in `strictness.rounds`. The override replaces
// only `cap` in whichever rules the ticket's claim pin picked (LEGACY_CAP, APPROACH_CAP, PLAN_CAP) through the one seam `capRulesOf`; the stop rules, the
// allowances and the cap-is-a-refusal behaviour keep their data, and with no `strictness` key every cap is today's.
import { expect, it } from 'vitest';
import { APPROACH_CAP, APPROACH_CAP_FROM, LEGACY_CAP, PLAN_CAP, PLAN_CAP_FROM, PRESETS, approvalBlockers, approvalFindings, capRulesOf, cycleState, loadSnapshot, nextRound, planStopOf, resolveStrictness, roundText } from '../src/index.js';
import type { ClaimPin, RepoSnapshot, RoundKind } from '../src/index.js';
import { CONFIG, building } from '../../../test/helpers/lane.js';

const LEDGER = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
const HEAD = 'Round record: 1\n\n';
const strict = (rounds: Partial<Record<RoundKind, string>>): string =>
  CONFIG + 'strictness:\n  rounds:\n' + Object.entries(rounds).map(([k, v]) => `    ${k}: "${v}"\n`).join('');

/** One round of a plan record: a number is that many open Shoulds, 'nice' one Nice, 'none' the line `No findings`. */
type Spec = number | 'nice' | 'none';
const planLines = (s: Spec): string[] =>
  s === 'none'
    ? ['No findings']
    : s === 'nice'
      ? ['1. Nice — a wording in task 1 — open']
      : Array.from({ length: s }, (_, i) => `${i + 1}. Should — task ${i + 1} drops a header — open — rests on: ac-1`);
const planRecord = (...rounds: Spec[]): string => HEAD + rounds.map((s, i) => `## Round ${i + 1} (${i === 0 ? 'whole' : 'diff'})\n\n${planLines(s).join('\n')}\n\n`).join('');

/** An approach record: each round holds one open Should, or `No findings`. */
const approachRecord = (rounds: number, last: 'finding' | 'none' = 'finding'): string =>
  HEAD + Array.from({ length: rounds }, (_, i) => `## Round ${i + 1}\n\n${last === 'none' && i === rounds - 1 ? 'No findings' : `1. Should — the cache can go stale in round ${i + 1} — open`}\n\n`).join('');

/** A review record in the form round-next.test.ts reads: `shoulds[i]` open Shoulds in round i + 1, 0 for a Nice-only round. */
const reviewRecord = (...shoulds: number[]): string =>
  HEAD +
  shoulds
    .map((k, i) => {
      const lines = k === 0 ? ['Nice 1: a name could be shorter — src/export.ts:1 — deferred'] : Array.from({ length: k }, (_, j) => `Should ${j + 1} [patch]: a comma is not quoted — src/export.ts:9 — fixed in abc1235`);
      return `## Round ${i + 1}\n\n${lines.join('\n')}\n\n`;
    })
    .join('');

interface Opts {
  config?: string;
  claim?: ClaimPin;
  plan?: string;
  approach?: string;
  review?: string;
}
function repo({ config = CONFIG, claim, plan, approach, review }: Opts = {}): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': config };
  building(files, 'T-1');
  files['accord/tickets/T-1/ledger.md'] = LEDGER;
  if (plan !== undefined) files['accord/tickets/T-1/plan-review.md'] = plan;
  if (approach !== undefined) files['accord/tickets/T-1/approach-review.md'] = approach;
  if (review !== undefined) files['accord/tickets/T-1/review.md'] = review;
  const snapshot = loadSnapshot({ files, tree: Object.keys(files) });
  return { ...snapshot, claimPins: { 'T-1': claim ?? { pin: PLAN_CAP_FROM } } };
}
const cut = { pin: PLAN_CAP_FROM };
const old = { pin: '0.4.0' };

it('risk:complex-branching a team round cap replaces the cap and keeps the rules (ST-LN-50 t2-ac-4)', () => {
  // under PLAN_CAP: cap 1, the count stop, the allowances and the cap stop stay
  const plan1 = capRulesOf(repo({ config: strict({ plan: '1' }), claim: cut }), 'T-1', 'plan');
  expect(plan1).toEqual({ ...PLAN_CAP, cap: 1 });
  expect(plan1).toMatchObject({ fall: true, allowances: true, capStop: true });
  // a ticket claimed before PLAN_CAP_FROM keeps LEGACY_CAP's data with the team's cap
  expect(capRulesOf(repo({ config: strict({ plan: '1' }), claim: old }), 'T-1', 'plan')).toEqual({ ...LEGACY_CAP, cap: 1 });
  // the approach record: APPROACH_CAP's no-allowance, no-stop refusal stays; a ticket claimed earlier keeps LEGACY_CAP
  expect(capRulesOf(repo({ config: strict({ approach: '9' }), claim: { pin: APPROACH_CAP_FROM } }), 'T-1', 'approach')).toEqual({ ...APPROACH_CAP, cap: 9 });
  expect(capRulesOf(repo({ config: strict({ approach: '9' }), claim: old }), 'T-1', 'approach')).toEqual({ ...LEGACY_CAP, cap: 9 });
  // the review record is LEGACY_CAP always
  expect(capRulesOf(repo({ config: strict({ review: '2' }), claim: cut }), 'T-1', 'review')).toEqual({ ...LEGACY_CAP, cap: 2 });
  // one key sets one record only
  const only = repo({ config: strict({ plan: '1' }), claim: cut });
  expect(capRulesOf(only, 'T-1', 'approach')).toEqual(APPROACH_CAP);
  expect(capRulesOf(only, 'T-1', 'review')).toEqual(LEGACY_CAP);
});

it('risk:regression with no strictness key every cap is today\'s (ST-LN-50 t2-ac-4)', () => {
  for (const claim of [cut, old]) {
    const none = repo({ claim });
    expect(capRulesOf(none, 'T-1', 'plan')).toEqual(claim === cut ? PLAN_CAP : LEGACY_CAP);
    expect(capRulesOf(none, 'T-1', 'approach')).toEqual(claim === cut ? APPROACH_CAP : LEGACY_CAP);
    expect(capRulesOf(none, 'T-1', 'review')).toEqual(LEGACY_CAP);
  }
  expect(resolveStrictness(undefined)).toEqual({ rounds: {} });
  expect(resolveStrictness(repo().config)).toEqual({ rounds: {} });
  expect(PRESETS).toEqual({ build: { rounds: {} }, maintain: { rounds: {} } });
  // an empty `strictness:` map, or a `rounds:` with no key, changes nothing either
  expect(capRulesOf(repo({ config: CONFIG + 'strictness:\n  rounds: {}\n', claim: cut }), 'T-1', 'plan')).toEqual(PLAN_CAP);
});

it('risk:complex-branching resolveStrictness reads each team key as a number and ignores what is no round cap (ST-LN-50 t2-ac-4)', () => {
  const config = repo({ config: strict({ approach: '1', plan: '42', review: '99' }) }).config;
  expect(resolveStrictness(config)).toEqual({ rounds: { approach: 1, plan: 42, review: 99 } });
  // a value outside 1..99 never reaches the seam as a cap (the schema refuses it; a hand-built config is read defensively)
  const raw = { ...config!, strictness: { rounds: { approach: '0', plan: '100', review: 'two' } } } as unknown as Parameters<typeof resolveStrictness>[0];
  expect(resolveStrictness(raw)).toEqual({ rounds: {} });
});

for (const cap of [1, 2, 9]) {
  const cfg = strict({ plan: String(cap) });

  it(`risk:complex-branching the plan critique counts, stops and refuses exactly at a cap of ${cap} (ST-LN-50 t2-ac-4)`, () => {
    // round 1 is given as "of cap"
    const first = nextRound(repo({ config: cfg, claim: cut }), 'T-1', 'plan');
    expect(first).toMatchObject({ kind: 'next', round: 1, cap });
    expect(roundText(first)).toBe(`Round: 1 of ${cap}\nCycle: 1\nCritics: plan checker\n`);

    // the rounds before the cap are given: falling counts, then Nice-only rounds, which stop nothing
    const before: Spec[] = [2, 1, ...Array.from({ length: Math.max(0, cap - 3) }, () => 'nice' as const)].slice(0, cap - 1);
    const record = before.length === 0 ? undefined : planRecord(...before);
    if (record !== undefined) {
      expect(nextRound(repo({ config: cfg, claim: cut, plan: record }), 'T-1', 'plan')).toMatchObject({ kind: 'next', round: cap, cap });
    }

    // a round at the cap that still holds findings stops the cycle; the next round is a stop, never `next`
    const atCap: Spec[] = cap === 1 ? [2] : [...before, cap === 2 ? 1 : 'nice'];
    const stopped = nextRound(repo({ config: cfg, claim: cut, plan: planRecord(...atCap) }), 'T-1', 'plan');
    expect(stopped.kind).toBe('stop');
    expect(stopped.cap).toBe(cap);
    expect(stopped.reasons.join('\n')).toContain(`the cap of ${cap} rounds in cycle 1 is reached`);
    expect(roundText(stopped)).toContain('stop: report to owner');

    // a round run past the cap without an owner Ruling is a stop that names the cap
    const past = nextRound(repo({ config: cfg, claim: cut, plan: planRecord(...atCap, 'nice') }), 'T-1', 'plan');
    expect(past.kind).toBe('stop');
    expect(past.reasons.join('\n')).toContain(`past the cap of ${cap} rounds`);
  });

  it(`risk:complex-branching the approach critique refuses round ${cap + 1} at a cap of ${cap} (ST-LN-50 t2-ac-4)`, () => {
    const cfgA = strict({ approach: String(cap) });
    const claim = { pin: APPROACH_CAP_FROM };
    expect(nextRound(repo({ config: cfgA, claim }), 'T-1', 'approach')).toMatchObject({ kind: 'next', round: 1, cap });
    if (cap > 1) {
      expect(nextRound(repo({ config: cfgA, claim, approach: approachRecord(cap - 1) }), 'T-1', 'approach')).toMatchObject({ kind: 'next', round: cap, cap });
    }
    // the cap is a refusal here, as it is at the default: no stop, no allowance
    const refused = nextRound(repo({ config: cfgA, claim, approach: approachRecord(cap) }), 'T-1', 'approach');
    expect(refused).toMatchObject({ kind: 'refused', cap, round: cap });
    expect(refused.reasons.join('\n')).toContain(`cap of ${cap} approach critique rounds`);
    // a round written past the cap is refused too
    const ran = nextRound(repo({ config: cfgA, claim, approach: approachRecord(cap + 1) }), 'T-1', 'approach');
    expect(ran.kind).toBe('refused');
    expect(ran.reasons.join('\n')).toContain(`ran past the cap of ${cap} approach critique rounds`);
  });

  it(`risk:complex-branching the review loop stops at a cap of ${cap} (ST-LN-50 t2-ac-4)`, () => {
    const cfgR = strict({ review: String(cap) });
    expect(nextRound(repo({ config: cfgR }), 'T-1', 'review')).toMatchObject({ kind: 'next', round: 1, cap });
    // Nice-only rounds stop nothing, so the cap is what ends the loop; a cap of 9 gives rounds 1..9
    const rounds = (n: number) => reviewRecord(...Array.from({ length: n }, () => 0));
    if (cap > 1) expect(nextRound(repo({ config: cfgR, review: rounds(cap - 1) }), 'T-1', 'review')).toMatchObject({ kind: 'next', round: cap, cap });
    const stopped = nextRound(repo({ config: cfgR, review: rounds(cap) }), 'T-1', 'review');
    expect(stopped.kind).toBe('stop');
    expect(stopped.cap).toBe(cap);
    expect(stopped.reasons.join('\n')).toContain(`the cap of ${cap} rounds in cycle 1 is reached`);
    // a round run past the cap without an owner Ruling is a stop naming the cap
    const past = nextRound(repo({ config: cfgR, review: rounds(cap + 1) }), 'T-1', 'review');
    expect(past.kind).toBe('stop');
    expect(past.reasons.join('\n')).toContain(`past the cap of ${cap} rounds`);
  });
}

it('risk:complex-branching a cap of 1 makes round 1 the last round: round 2 is refused or stopped, never run (ST-LN-50 t2-ac-4)', () => {
  for (const [kind, o] of [
    ['plan', { config: strict({ plan: '1' }), claim: cut, plan: planRecord(2) }],
    ['approach', { config: strict({ approach: '1' }), claim: { pin: APPROACH_CAP_FROM }, approach: approachRecord(1) }],
    ['review', { config: strict({ review: '1' }), review: reviewRecord(1) }],
  ] as [RoundKind, Opts][]) {
    const answer = nextRound(repo(o), 'T-1', kind);
    expect(answer.kind, kind).not.toBe('next');
    expect(['stop', 'refused'], kind).toContain(answer.kind);
    expect(answer.cap, kind).toBe(1);
  }
});

it('risk:complex-branching cycleState and planStopOf read the replaced cap (ST-LN-50 t2-ac-4)', () => {
  for (const cap of [1, 2, 9]) {
    const snap = repo({ config: strict({ plan: String(cap) }), claim: cut, plan: planRecord(2, 1) });
    const rules = capRulesOf(snap, 'T-1', 'plan');
    const cycle = snap.work!['T-1'].planRounds!.cycles[0];
    const state = cycleState(cycle, [], 'plan', new Set(), rules);
    expect(state.cap).toBe(cap);
    expect(state.allowed(cap)).toBe(true);
    expect(state.allowed(cap + 1)).toBe(false);
    // two rounds are recorded with findings: a cap of 2 or less ends the cycle at the cap, a cap of 9 leaves it open
    expect(planStopOf(cycle, [], 'plan', new Set(), rules)).toBe(cap <= 2 ? 2 : undefined);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// D-07 "an open security or data-loss finding still blocks approval at every setting" (carried Phase 2 D-12, Phase 3 D-22): the block reads the rule kind (`allowances`,
// `capStop`), never `cap`, so it holds at caps 1, 2, 9 and with none.
const LOSS = '1. Must — the export overwrites the old file — open — risk: data-loss';
const SEC = '1. Must — tokens are written to the log — unverified — risk: security';
const OPEN = '2. Should — the cache can go stale — open';
const approachClaim = { pin: APPROACH_CAP_FROM };

/** An approach record of `rounds` rounds whose last round holds `finding` beside an ordinary Should; earlier rounds hold only the Should. */
const withRisk = (rounds: number, finding: string): string =>
  HEAD + Array.from({ length: rounds }, (_, i) => `## Round ${i + 1}\n\n${i === rounds - 1 ? finding + '\n' : ''}${OPEN}\n\n`).join('');

for (const [kind, finding] of [['data-loss', LOSS], ['security', SEC]] as const) {
  it(`risk:security the risk block holds at every round cap for an open ${kind} finding (ST-LN-50 t2-ac-4)`, () => {
    for (const cap of [undefined, 1, 2, 9]) {
      const config = cap === undefined ? CONFIG : strict({ approach: String(cap) });
      const at = cap ?? 2; // the cap's last round: the record ended there
      for (const rounds of [Math.min(at, 3), at, at + 1]) {
        if (rounds < 1) continue;
        const snapshot = repo({ config, claim: approachClaim, approach: withRisk(rounds, finding) });
        const label = `cap ${cap ?? 'default'}, ${rounds} rounds`;
        // the approval lists the finding as blocking, and as nothing else
        expect(approvalFindings(snapshot, 'T-1').blocking, label).toEqual([{ round: rounds, lines: [finding] }]);
        expect(approvalBlockers(snapshot, 'T-1'), label).toEqual([{ round: rounds, lines: [finding] }]);
        expect(approvalFindings(snapshot, 'T-1').risks.flatMap((r) => r.lines), label).not.toContain(finding);
      }
      // at the cap the critic is refused, and the refusal says the finding blocks the approval
      const refused = nextRound(repo({ config, claim: approachClaim, approach: withRisk(at, finding) }), 'T-1', 'approach');
      expect(refused.kind, `cap ${cap ?? 'default'}`).toBe('refused');
      expect(refused.reasons.join('\n'), `cap ${cap ?? 'default'}`).toContain('blocks the approval');
      expect(refused.blocking, `cap ${cap ?? 'default'}`).toEqual([{ round: at, lines: [finding] }]);
      // fixed, it blocks nothing at any cap
      const fixed = repo({ config, claim: approachClaim, approach: withRisk(at, finding.replace(/ — (open|unverified) — /, ' — fixed — ')) });
      expect(approvalFindings(fixed, 'T-1').blocking, `cap ${cap ?? 'default'}`).toEqual([]);
    }
  });
}

it('risk:security a round cap above the rounds run never lets an open risk finding stand unblocked at a cap of 9 (ST-LN-50 t2-ac-4)', () => {
  // the loop is still open at 9 (round 3 of 9): the finding blocks the approval all the same
  const snapshot = repo({ config: strict({ approach: '9' }), claim: approachClaim, approach: withRisk(3, LOSS) });
  expect(nextRound(snapshot, 'T-1', 'approach')).toMatchObject({ kind: 'next', round: 4, cap: 9 });
  expect(approvalBlockers(snapshot, 'T-1')).toEqual([{ round: 3, lines: [LOSS] }]);
});
