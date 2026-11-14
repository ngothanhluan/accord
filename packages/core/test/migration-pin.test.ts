// ST-LN-91 mig-ac-1 and D-15 in core: a ticket at approach claimed under 0.4.0 answers as before at the discuss cut-off, for gate ready,
// `accord round --approach` and gate plan; the new rules read the claim pin, never the working-tree pin or the approach record's own pin.
import { expect, it } from 'vitest';
import { APPROACH_CAP_FROM, DISCUSS_FROM, PLAN_CAP_FROM, PLAN_FORMAT_FROM, PLAN_GROUNDS_FROM, gatePlan, gateReady, loadSnapshot, nextRound, roundText } from '../src/index.js';
import type { ClaimPin, RecordPin, RepoSnapshot } from '../src/index.js';
import { building, CONFIG } from '../../../test/helpers/lane.js';

const HEAD = 'Round record: 1\n\n';
const round = (n: number, ...lines: string[]) => '## Round ' + n + '\n\n' + lines.join('\n') + '\n\n';
// Rounds 2 and 3 cite the ticket line they rest on, so the Phase 2 grounds rule never decides what these cases assert.
const APPROACH_REVIEW =
  HEAD +
  round(1, '1. Must — the option drops a header — fixed') +
  round(2, '1. Should — the cache can go stale — fixed — rests on: ac-1') +
  round(3, '1. Should — a risk has no undo — open — rests on: ac-1');
// A release moves CONFIG's pin, so every case names the pin it means.
const at = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

interface Pins {
  config: string; // the working-tree pin
  claim?: ClaimPin;
  record?: RecordPin; // the pin at the approach record's first round
  plan?: { pin?: string; basePin?: string };
}
/** A ticket at approach (Intent, criteria and an Approach draft written, three approach rounds recorded) under the given pins. */
function atApproach({ config, claim, record, plan }: Pins): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': config };
  building(files, 'T-1');
  files['accord/tickets/T-1/ledger.md'] = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
  files['accord/tickets/T-1/approach-review.md'] = APPROACH_REVIEW;
  const snapshot = loadSnapshot({ files, tree: Object.keys(files) });
  return {
    ...snapshot,
    ...(claim === undefined ? {} : { claimPins: { 'T-1': claim } }),
    ...(record === undefined ? {} : { recordPins: { 'T-1': { approach: record } } }),
    ...(plan === undefined ? {} : { planPins: { 'T-1': plan } }),
  };
}
const answers = (s: RepoSnapshot) => ({
  ready: gateReady(s, 'T-1').findings,
  plan: gatePlan(s, 'T-1').findings,
  round: nextRound(s, 'T-1', 'approach'),
});
const discussFindings = (s: RepoSnapshot) => gateReady(s, 'T-1').findings.filter((f) => f.rule.startsWith('gate.discuss-'));

it('risk:complex-branching a ticket at approach pinned before the cut-off passes gate ready, accord round --approach and gate plan as before (ST-LN-91 mig-ac-1)', () => {
  const old = { pin: '0.4.0' };
  // Every pin at 0.4.0: the rules as they were.
  const before = answers(atApproach({ config: at('0.4.0'), claim: old, record: old, plan: old }));
  // The working tree at the cut-off, the ticket's own history still at 0.4.0: the answers must not move.
  const after = answers(atApproach({ config: at(DISCUSS_FROM), claim: old, record: old, plan: old }));

  expect(after.ready).toEqual(before.ready);
  expect(after.plan).toEqual(before.plan);
  expect(after.round).toEqual(before.round);
  expect(roundText(after.round)).toBe(roundText(before.round));
  expect(after.ready.filter((f) => f.rule.startsWith('gate.discuss-'))).toEqual([]);

  // The older rules as they print: five rounds, and the stop from round 3.
  const text = roundText(after.round);
  expect(text.startsWith('stop: report to owner\n')).toBe(true);
  expect(text).toContain('from round 3 such a round stops the loop');
  expect(text).toContain('more approach critique rounds after round 3 of cycle 1');
  expect(text).not.toContain('Findings still open:');
  expect(after.round).toMatchObject({ kind: 'stop', round: 3 });
});

it('risk:complex-branching the claim pin keeps a ticket claimed under 0.4.0 on the old discuss and approach rules (ST-LN-91 D-15)', () => {
  // Claimed under 0.4.0, upgraded since, its approach record begun after the upgrade: the claim pin alone decides the discuss rule and the cap.
  const old = atApproach({ config: at(DISCUSS_FROM), claim: { pin: '0.4.0' }, record: { pin: APPROACH_CAP_FROM }, plan: { pin: '0.4.0' } });
  expect(discussFindings(old)).toEqual([]);
  const stop = nextRound(old, 'T-1', 'approach');
  expect(stop).toMatchObject({ kind: 'stop', round: 3 });
  expect(roundText(stop)).toContain('from round 3 such a round stops the loop');
  expect(roundText(stop)).not.toContain('of 2');
  // Round 3 is not refused past a cap of two: the cap is five.
  expect(roundText(stop)).not.toContain('past the cap of 2');

  // The same ticket claimed at the cut-off: the discuss record is asked for and the approach critic gets two rounds.
  const fresh = atApproach({ config: at(DISCUSS_FROM), claim: { pin: DISCUSS_FROM }, record: { pin: APPROACH_CAP_FROM }, plan: { pin: '0.4.0' } });
  const missing = discussFindings(fresh).filter((f) => f.rule === 'gate.discuss-missing');
  expect(missing).toHaveLength(1);
  const capped = nextRound(fresh, 'T-1', 'approach');
  expect(capped).toMatchObject({ kind: 'refused', cap: 2 });
  expect(roundText(capped)).toContain('cap of 2 approach critique rounds');
  expect(capped.kind).not.toBe('stop');
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Plan 03-12: mig-ac-1 for gate plan and accord round --plan, and D-15 across every Phase 3 rule.
const VERSION = (v: string): number[] => v.split('.').map(Number);
// The greatest cut-off of the five Phase 3 rules, so the cases keep their meaning when one constant moves.
const CUT = [DISCUSS_FROM, APPROACH_CAP_FROM, PLAN_FORMAT_FROM, PLAN_CAP_FROM, PLAN_GROUNDS_FROM].reduce((a, b) => {
  const [x, y] = [VERSION(a), VERSION(b)];
  return x[0] !== y[0] ? (x[0] > y[0] ? a : b) : x[1] !== y[1] ? (x[1] > y[1] ? a : b) : x[2] >= y[2] ? a : b;
});
const FORMAT_RULES = ['gate.task-after-missing', 'gate.task-after-unknown', 'gate.task-code-block', 'gate.task-too-long'];

/**
 * A plan written under 0.4.0: no `after:` lines, a ts block and a task of 130 non-blank lines (3 task lines, 2 fence lines, 125 code lines).
 * `unknownAfter` adds the one `after:` line that names a task the plan does not hold, so gate.task-after-unknown has something to say.
 */
const planText = (unknownAfter = false, prose: string[] = []): string =>
  [
    '---',
    'baseline: abc1234',
    '---',
    '',
    '# Plan',
    '',
    '## Task 1: Writer csv mode',
    'covers: @ac-1, D-01',
    'files: src/export.ts',
    'verify: export#writes-csv (@ac-1)',
    '```ts',
    ...Array.from({ length: 125 }, (_, i) => `const row${i} = ${i};`),
    '```',
    '',
    '## Task 2: Escaping',
    'covers: @ac-2',
    'files: src/export.ts',
    'verify: export#escapes-commas (@ac-2)',
    ...(unknownAfter ? ['after: 9'] : []),
    ...prose,
    'Quote cells that contain a comma.',
    '',
  ].join('\n');
const shoulds = (k: number, grounded = false): string[] => Array.from({ length: k }, (_, i) => `${i + 1}. Should — task ${i + 1} drops a header — open${grounded ? ' — rests on: ac-1' : ''}`);
const planRound = (n: number, lines: string[]): string => `## Round ${n} (${n === 1 ? 'whole' : 'diff'})\n\n${lines.join('\n')}\n\n`;
const CLOSED = 'verdict: converged\n\n## Closed\n\n';

interface PlanPins {
  config: string;
  claim?: ClaimPin;
  planBase?: { pin?: string; basePin?: string }; // the pin at the plan's baseline commit
  planRecord?: RecordPin; // the pin at the plan record's first round
  approachRecord?: RecordPin;
  plan?: string; // plan-review.md
  approach?: string; // approach-review.md
  unknownAfter?: boolean;
  prose?: string[]; // extra lines of task 2, above its prose
}
/** A lane M ticket with no discuss.md, the 130-line plan, and the given records and pins. */
function planned(p: PlanPins): RepoSnapshot {
  const files: Record<string, string> = { 'accord/config.yml': p.config };
  building(files, 'T-1');
  files['accord/tickets/T-1/plan.md'] = planText(p.unknownAfter, p.prose);
  files['accord/tickets/T-1/ledger.md'] = '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n';
  if (p.plan !== undefined) files['accord/tickets/T-1/plan-review.md'] = p.plan;
  if (p.approach !== undefined) files['accord/tickets/T-1/approach-review.md'] = p.approach;
  const snapshot = loadSnapshot({ files, tree: Object.keys(files) });
  return {
    ...snapshot,
    ...(p.claim === undefined ? {} : { claimPins: { 'T-1': p.claim } }),
    ...(p.planBase === undefined ? {} : { planPins: { 'T-1': p.planBase } }),
    ...(p.planRecord === undefined && p.approachRecord === undefined
      ? {}
      : { recordPins: { 'T-1': { ...(p.planRecord === undefined ? {} : { plan: p.planRecord }), ...(p.approachRecord === undefined ? {} : { approach: p.approachRecord }) } } }),
  };
}
const planFindings = (s: RepoSnapshot) => gatePlan(s, 'T-1').findings;
const ids = (s: RepoSnapshot, rules: string[]): string[] => [...new Set(planFindings(s).map((f) => f.rule).filter((r) => rules.includes(r)))].sort();
const planLines = (s: RepoSnapshot): string => roundText(nextRound(s, 'T-1', 'plan'));
const approachLines = (s: RepoSnapshot): string => roundText(nextRound(s, 'T-1', 'approach'));

it('risk:complex-branching a plan written and critiqued under 0.4.0 passes gate plan and accord round --plan as before (ST-LN-91 mig-ac-1)', () => {
  const old = { pin: '0.4.0' };
  // Two rounds of two Shoulds each: the 0.4.0 rules ask for round 3 of 5 and have no count stop; grounds are not asked (the record is under 0.4.0).
  const open = (config: string): PlanPins => ({
    config,
    claim: old,
    planBase: old,
    planRecord: old,
    plan: 'Round record: 1\n\n' + planRound(1, shoulds(2)) + planRound(2, shoulds(2)),
  });
  const before = planned(open(at('0.4.0')));
  const after = planned(open(at(PLAN_FORMAT_FROM)));

  expect(planFindings(after)).toEqual(planFindings(before));
  expect(planLines(after)).toBe(planLines(before));
  expect(planLines(after)).toBe('Round: 3 of 5\nCycle: 1\n');
  expect(nextRound(after, 'T-1', 'plan')).toMatchObject({ kind: 'next', round: 3, cap: 5 });
  // The plan has no after: line, a ts fence and a 130-line task, and none of the format rules says so under 0.4.0.
  expect(ids(after, FORMAT_RULES)).toEqual([]);
  expect(ids(after, ['gate.plan-rounds'])).toEqual([]);

  // The record closed after a `No findings` round: the next cycle starts at round 1 of 5 with no Critics line, the 0.4.0 round-1 split.
  const closed = (config: string): RepoSnapshot =>
    planned({ ...open(config), plan: 'Round record: 1\n\n' + planRound(1, shoulds(2)) + planRound(2, ['No findings']) + CLOSED });
  expect(planLines(closed(at(PLAN_FORMAT_FROM)))).toBe('Round: 1 of 5\nCycle: 2\n');
  expect(planLines(closed(at(PLAN_FORMAT_FROM)))).toBe(planLines(closed(at('0.4.0'))));
  expect(nextRound(closed(at(PLAN_FORMAT_FROM)), 'T-1', 'plan').checker).toBeUndefined();
  expect(planFindings(closed(at(PLAN_FORMAT_FROM)))).toEqual(planFindings(closed(at('0.4.0'))));
});

it('risk:complex-branching the claim pin decides every Phase 3 rule at once (ST-LN-91 D-15)', () => {
  const config = at(CUT);
  const old = { pin: '0.4.0' };
  const cut = { pin: CUT };
  const phase3 = (s: RepoSnapshot): string[] => [...ids(s, FORMAT_RULES), ...gateReady(s, 'T-1').findings.map((f) => f.rule).filter((r) => r.startsWith('gate.discuss-'))].sort();

  // (a) claimed under 0.4.0, the working tree at the cut-off, no approach-review.md and no plan-review.md: every rule off.
  const a = planned({ config, claim: old, unknownAfter: true });
  expect(phase3(a)).toEqual([]);
  expect(approachLines(a).startsWith('Round: 1 of 5')).toBe(true);
  expect(planLines(a)).toBe('Round: 1 of 5\nCycle: 1\n');

  // (b) the same ticket claimed at the cut-off: every rule on.
  const b = planned({ config, claim: cut, unknownAfter: true });
  expect(gateReady(b, 'T-1').findings.map((f) => f.rule)).toContain('gate.discuss-missing');
  expect(ids(b, FORMAT_RULES)).toEqual([...FORMAT_RULES].sort());
  expect(approachLines(b).startsWith('Round: 1 of 2')).toBe(true);
  expect(planLines(b)).toBe('Round: 1 of 3\nCycle: 1\nCritics: plan checker\n');

  // (c) claimed under 0.4.0, the approach record begun under 0.4.0, the plan written and critiqued after the upgrade (its baseline and record round 1 at the cut-off):
  // the claim pin alone decides. The plan record's round-1 Shoulds carry no `rests on:` line: read from the record pin they would be refused (D-19).
  const approach = 'Round record: 1\n\n' + planRound(1, ['1. Must — the option drops a header — fixed']);
  const planRecord = 'Round record: 1\n\n' + planRound(1, shoulds(2)) + planRound(2, ['No findings']) + CLOSED;
  const c = planned({ config, claim: old, planBase: cut, planRecord: cut, approachRecord: old, approach, plan: planRecord, unknownAfter: true });
  expect(phase3(c)).toEqual([]);
  expect(approachLines(c).startsWith('Round: 2 of 5')).toBe(true);
  expect(planLines(c)).toBe('Round: 1 of 5\nCycle: 2\n');
  expect(nextRound(c, 'T-1', 'plan')).toMatchObject({ kind: 'next', round: 1, cycle: 2 });
  expect(nextRound(c, 'T-1', 'plan').checker).toBeUndefined();
  // The contrast of (c): the same record under a claim at the cut-off is asked for grounds from round 1.
  const late = planned({ config, claim: cut, planBase: cut, planRecord: cut, approachRecord: cut, approach, plan: planRecord, unknownAfter: true });
  expect(nextRound(late, 'T-1', 'plan').kind).toBe('refused');
  expect(roundText(nextRound(late, 'T-1', 'plan'))).toContain('from round 1 a Must or Should');
});

it('risk:regression a prose line starting after: that defers work is refused at every claim pin exactly as origin/main b057d135 refused it (ST-LN-91 mig-ac-1, CR-01)', () => {
  // RECORDED: gatePlan of origin/main b057d135 (its own core build) on these snapshots, `gate.plan-deferral` findings only. The PR is never compared with itself here.
  const plan = (line: number, word: string) => [
    { file: 'accord/tickets/T-1/plan.md', line, reason: `task 2 defers work: "${word}"`, rule: 'gate.plan-deferral', level: 'error' },
  ];
  const RECORDED: [string, string[], ReturnType<typeof plan>][] = [
    ['a full stop after the word', ['after: the parser lands, wire it later.'], plan(143, 'later')],
    ['the words for now', ['after: the writer lands we keep the flag for now'], plan(143, 'for now')],
    ['a second after: line', ['after: none', 'after: the parser lands, wire it later.'], plan(144, 'later')],
  ];
  const deferrals = (s: RepoSnapshot) => planFindings(s).filter((f) => f.rule === 'gate.plan-deferral');
  for (const [name, prose, recorded] of RECORDED) {
    for (const claim of [{ pin: '0.4.0' }, { pin: CUT }]) {
      const s = planned({ config: at(CUT), claim, prose });
      expect(deferrals(s), `${name} at claim ${claim.pin}`).toEqual(recorded);
    }
  }
});

it('risk:regression the five Phase 3 cut-offs are one release, so one claim pin decides every Phase 3 rule at once (ST-LN-91 D-15, IN-01)', () => {
  // D-15 says a ticket is wholly old or wholly new. The constants are kept apart, one per rule, to read well; this test is what stops one of them moving alone.
  const cutoffs = { DISCUSS_FROM, APPROACH_CAP_FROM, PLAN_FORMAT_FROM, PLAN_CAP_FROM, PLAN_GROUNDS_FROM };
  expect(new Set(Object.values(cutoffs)).size, JSON.stringify(cutoffs)).toBe(1);
  expect(CUT).toBe(DISCUSS_FROM);
});
