// ST-LN-91 mig-ac-1 and D-15 in core: a ticket at approach claimed under 0.4.0 answers as before at the discuss cut-off, for gate ready,
// `accord round --approach` and gate plan; the new rules read the claim pin, never the working-tree pin or the approach record's own pin.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { APPROACH_CAP_FROM, COMMIT_MESSAGE_FROM, DEFERRED_MARK_FROM, DISCUSS_FROM, FIX_RECORD_FROM, PLAN_CAP_FROM, PLAN_FORMAT_FROM, PLAN_GROUNDS_FROM, PLAN_LARGE_FROM, PLAN_MODEL_FROM, PLAN_WAVES_FROM, PRODUCT_TEXT_FROM, SECURITY_OFF_FROM, SECURITY_TRIGGER_FROM, SLOP_FROM, TASK_REPORT_FROM, TITLE_RULE_FROM, gatePlan, gateReady, loadSnapshot, nextRound, roundText } from '../src/index.js';
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

// Phase 4 (D-16): every rule it adds cuts off at one release, so one claim pin decides them all at once, the after: cycle rule
// (PLAN_WAVES_FROM) included (the unfinished-marker rules of plan 04-04 read no claim pin: owner decision 2026-11-16).
const PHASE4: Record<string, string> = { PLAN_MODEL_FROM, TASK_REPORT_FROM, FIX_RECORD_FROM, PLAN_WAVES_FROM };
const PHASE4_CUT: string[] = Object.values(PHASE4);
// Phase 5 (ST-LN-36 rel-ac-1): the security record rule cuts off at 0.7.0, the release that ships it; every Phase 5 cut-off added later joins this list.
const PHASE5: Record<string, string> = { SECURITY_TRIGGER_FROM };
const PHASE5_CUT: string[] = Object.values(PHASE5);
// Phase 7 (ST-LN-22 D-08b, ST-LN-28 D-17): the title rule of lint and gate ready, and the plan-large warning of gate plan, cut off at the release that ships them; every Phase 7 cut-off added later joins this list.
const PHASE7: Record<string, string> = { TITLE_RULE_FROM, PLAN_LARGE_FROM };
const PHASE7_CUT: string[] = Object.values(PHASE7);
// Phase 8.1 (D-06, D-07): the commit-message rule of task-done and gate done cuts off at the release that ships it; every Phase 8.1 cut-off added later joins this record (SLOP_FROM: the slop gate of 08.1-06).
const PHASE8_1: Record<string, string> = { COMMIT_MESSAGE_FROM, SLOP_FROM };
const PHASE8_1_CUT: string[] = Object.values(PHASE8_1);
// Phase 8.2 (D-04): the deferred-item mark check of `accord audit` judges only tickets claimed at or after the release that ships it; every Phase 8.2 cut-off added later joins this record.
const PHASE8_2: Record<string, string> = { DEFERRED_MARK_FROM };
const PHASE8_2_CUT: string[] = Object.values(PHASE8_2);
// Phase 8.5 (D-22, D-29): the new task-brief layout of `accord brief` and the executor-report refusal of `accord round` apply only to a ticket claimed at or after the release that ships them; every Phase 8.5 cut-off added later joins this record.
const PHASE8_5: Record<string, string> = { PRODUCT_TEXT_FROM };
const PHASE8_5_CUT: string[] = Object.values(PHASE8_5);
// Phase 08.8 (D-03): the security review that stays on the floor when the review stage is off applies only to a ticket claimed at or after the release that ships it; every Phase 08.8 cut-off added later joins this record.
const PHASE8_8: Record<string, string> = { SECURITY_OFF_FROM };
const PHASE8_8_CUT: string[] = Object.values(PHASE8_8);

it('risk:regression the 0.6.0 cut-off constants are one release (ST-LN-10 rel-ac-1)', () => {
  expect(PHASE4_CUT.length, 'the list names no constant').toBeGreaterThan(0);
  for (const v of PHASE4_CUT) expect(v).toBe('0.6.0');
});

// Release 0.6.0 (plan 04-17, D-16): the cut-offs name the release that ships them, and each rule reads its cut-off from the ticket's claim fact and
// `ruleset` through claimPinBefore, never from a date or a bare version literal.
const SRC_ROOTS = ['packages/core/src', 'packages/cli/src'];
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PIN_FILE = 'packages/core/src/round/pin.ts';
// ST-LN-36 rel-ac-1: every release a cut-off names. Phase 7's value is read from its constant, so the release PR that moves the constant moves this too.
const RELEASES = [...new Set(['0.6.0', '0.7.0', ...PHASE7_CUT, ...PHASE8_1_CUT, ...PHASE8_2_CUT, ...PHASE8_5_CUT, ...PHASE8_8_CUT])].filter((v) => typeof v === 'string');
const LITERAL = new RegExp('([\'"`])(?:' + RELEASES.map((v) => v.replaceAll('.', '\\.')).join('|') + ')\\1', 'g');
const PHASE_NAMES = [...Object.keys(PHASE4), ...Object.keys(PHASE5), ...Object.keys(PHASE7), ...Object.keys(PHASE8_1), ...Object.keys(PHASE8_2), ...Object.keys(PHASE8_5), ...Object.keys(PHASE8_8)];
const isComment = (line: string): boolean => /^(\/\/|\*|\/\*)/.test(line.trim());

/** True when index `at` of `line` sits between the parentheses of a `<fn>(` call on the same line. */
function insideCall(line: string, fn: string, at: number): boolean {
  const call = line.lastIndexOf(fn + '(', at);
  if (call < 0) return false;
  let depth = 0;
  for (let i = call + fn.length; i < at; i++) depth += line[i] === '(' ? 1 : line[i] === ')' ? -1 : 0;
  return depth > 0;
}

/**
 * Every index of `name` (a whole word) on `line` that does not sit between the parentheses of a `claimPinBefore(` call on the same line. ST-LN-22 D-08b: a Phase 7 cut-off may also sit inside a
 * `rulesetFrom(` call (lint reads the ticket's own ruleset there, having no claim fact); an earlier phase's cut-off may not.
 */
function outsideClaimPinBefore(line: string, name: string): number[] {
  const out: number[] = [];
  const calls = Object.hasOwn(PHASE7, name) ? ['claimPinBefore', 'rulesetFrom'] : ['claimPinBefore'];
  for (const m of line.matchAll(new RegExp(`\\b${name}\\b`, 'g'))) {
    if (!calls.some((fn) => insideCall(line, fn, m.index))) out.push(m.index);
  }
  return out;
}

/**
 * The lines of one source file that break rel-ac-1, as `<path>:<line>: <text>`: a code line that uses a Phase 4 cut-off outside a `claimPinBefore(` call
 * (its declaration in pin.ts and an import or re-export line excepted), and a code line that holds a whole string literal `0.6.0` in any quote style (the
 * declarations in pin.ts excepted). A line whose trimmed text starts with `//`, `*` or `/*` is a comment and compares nothing.
 */
function cutOffOffences(text: string, path: string): string[] {
  const out: string[] = [];
  const names = PHASE_NAMES;
  text.split(/\r?\n/).forEach((line, i) => {
    if (isComment(line)) return;
    const where = `${path}:${i + 1}: ${line.trim()}`;
    const declaration = path === PIN_FILE && names.some((n) => new RegExp(`^export const ${n} = '\\d+\\.\\d+\\.\\d+';$`).test(line.trim()));
    if (declaration) return;
    const importOrExport = /^(import|export)\s.*\bfrom\s+['"]/.test(line.trim());
    if (!importOrExport && names.some((n) => outsideClaimPinBefore(line, n).length > 0)) out.push(where);
    else if (LITERAL.test(line)) out.push(where);
    LITERAL.lastIndex = 0;
  });
  return out;
}

/** The `.ts` files below `dir` (repository-relative, `/` separated); packages/core/src/generated/ is skipped by name: rendered prose, not comparisons. */
function sources(dir: string): string[] {
  return readdirSync(join(REPO_ROOT, dir), { recursive: true, encoding: 'utf8' })
    .map((p) => `${dir}/${p.replace(/\\/g, '/')}`)
    .filter((p) => p.endsWith('.ts') && !p.startsWith('packages/core/src/generated/'))
    .sort();
}

// Release 0.7.0 (plan 05-13): the CLI is no longer 0.6.0, so a Phase 4 cut-off is compared with '0.6.0' only; the release it names is history now.
it('risk:regression every Phase 4 cut-off stays at 0.6.0 (rel-ac-1)', () => {
  expect(Object.keys(PHASE4).sort()).toEqual(['FIX_RECORD_FROM', 'PLAN_MODEL_FROM', 'PLAN_WAVES_FROM', 'TASK_REPORT_FROM']);
  for (const [name, v] of Object.entries(PHASE4)) expect(v, name).toBe('0.6.0');
});

// Release 0.7.1: the CLI is no longer 0.7.0, so a Phase 5 cut-off is compared with '0.7.0' only; the 0.7.1 fixes need no cut-off of their own.
it('risk:regression every Phase 5 cut-off stays at 0.7.0 (rel-ac-1)', () => {
  expect(Object.keys(PHASE5), 'the list names no constant').toEqual(['SECURITY_TRIGGER_FROM']);
  for (const [name, v] of Object.entries(PHASE5)) expect(v, name).toBe('0.7.0');
});

// Release 0.8.0 ships Phase 7: its cut-offs name this release and the CLI that ships them.
it('risk:regression every Phase 7 cut-off is 0.8.0, the release that ships it (rel-ac-1)', () => {
  expect(Object.keys(PHASE7).sort(), 'the list names no constant').toEqual(['PLAN_LARGE_FROM', 'TITLE_RULE_FROM']);
  for (const [name, v] of Object.entries(PHASE7)) expect(v, name).toBe('0.8.0');
});

// Release 0.9.0 ships Phase 8.1: its cut-offs name this release, and each is read only through claimPinBefore (the scan of the Phase 4 test above covers every name in PHASE_NAMES).
it('risk:regression every Phase 8.1 cut-off is 0.9.0 the release that ships it and is read only through claimPinBefore (D-07)', () => {
  expect(Object.keys(PHASE8_1).sort(), 'the list names no constant').toEqual(['COMMIT_MESSAGE_FROM', 'SLOP_FROM']);
  for (const [name, v] of Object.entries(PHASE8_1)) expect(v, name).toBe('0.9.0');
  expect(PHASE8_1_CUT).toContain(COMMIT_MESSAGE_FROM);
  expect(PHASE8_1_CUT).toContain(SLOP_FROM);
  // a bare release literal and a Phase 8.1 constant outside the claim read are caught; the claim read is not
  expect(cutOffOffences('  if (claimPinBefore(s, id, COMMIT_MESSAGE_FROM)) return [];', 'packages/core/src/x.ts')).toEqual([]);
  expect(cutOffOffences('  if (pinBefore(COMMIT_MESSAGE_FROM, pin)) return [];', 'packages/core/src/x.ts')).toHaveLength(1);
  expect(cutOffOffences('  if (claimPinBefore(snapshot, id, SLOP_FROM)) return snapshot;', 'packages/cli/src/x.ts')).toEqual([]);
  expect(cutOffOffences('  if (pinBefore(SLOP_FROM, pin)) return snapshot;', 'packages/cli/src/x.ts')).toHaveLength(1);
});

// Phase 8.2 D-04: the deferred-mark cut-off is the next minor after 0.9.1, read only through claimPinBefore (the scan of the Phase 4 test above covers every name in PHASE_NAMES).
it('risk:regression the Phase 8.2 cut-off is 0.10.0 and is read only through claimPinBefore (D-04)', () => {
  expect(Object.keys(PHASE8_2), 'the record holds exactly one constant').toEqual(['DEFERRED_MARK_FROM']);
  expect(DEFERRED_MARK_FROM).toBe('0.10.0');
  expect(PHASE8_2_CUT).toEqual(['0.10.0']);
  // a cut-off read outside the claim read is caught; the claim read is not
  expect(cutOffOffences('  if (claimPinBefore(judged, id, DEFERRED_MARK_FROM)) skipped++;', 'packages/cli/src/x.ts')).toEqual([]);
  expect(cutOffOffences('  if (pinBefore(DEFERRED_MARK_FROM, pin)) skipped++;', 'packages/cli/src/x.ts')).toHaveLength(1);
  expect(cutOffOffences("  if (claimPinBefore(judged, id, '0.10.0')) skipped++;", 'packages/cli/src/x.ts')).toHaveLength(1);
});

// Phase 8.5 D-22, D-29: the cut-off of the new task-brief layout is the next minor after 0.12.2, read only through claimPinBefore (the scan of the Phase 4 test above covers every name in PHASE_NAMES).
it('risk:regression the Phase 8.5 cut-off is 0.13.0 and is read only through claimPinBefore (8.5-ac-6 D-22 R-8)', () => {
  expect(Object.keys(PHASE8_5), 'the record holds exactly one constant').toEqual(['PRODUCT_TEXT_FROM']);
  expect(PRODUCT_TEXT_FROM).toBe('0.13.0');
  expect(PHASE8_5_CUT).toEqual(['0.13.0']);
  // a cut-off read outside the claim read is caught; the claim read is not
  expect(cutOffOffences('  if (claimPinBefore(claimed, id, PRODUCT_TEXT_FROM)) return legacy();', 'packages/cli/src/x.ts')).toEqual([]);
  expect(cutOffOffences('  if (pinBefore(PRODUCT_TEXT_FROM, pin)) return legacy();', 'packages/cli/src/x.ts')).toHaveLength(1);
  expect(cutOffOffences("  if (claimPinBefore(s, id, '0.13.0')) return legacy();", 'packages/cli/src/x.ts')).toHaveLength(1);
});

// Phase 08.8 D-03: the cut-off of the security review that stays on the floor with the review stage off is the next minor after 0.15.0, read only through claimPinBefore (the scan of the Phase 4 test above covers every name in PHASE_NAMES).
it('risk:regression the Phase 08.8 cut-off is 0.16.0 and is read only through claimPinBefore (D-03)', () => {
  expect(Object.keys(PHASE8_8), 'the record holds exactly one constant').toEqual(['SECURITY_OFF_FROM']);
  expect(SECURITY_OFF_FROM).toBe('0.16.0');
  expect(PHASE8_8_CUT).toEqual(['0.16.0']);
  // a cut-off read outside the claim read is caught; the claim read is not
  expect(cutOffOffences('  if (claimPinBefore(snapshot, id, SECURITY_OFF_FROM)) return [];', 'packages/core/src/x.ts')).toEqual([]);
  expect(cutOffOffences('  if (pinBefore(SECURITY_OFF_FROM, pin)) return [];', 'packages/core/src/x.ts')).toHaveLength(1);
  expect(cutOffOffences("  if (claimPinBefore(snapshot, id, '0.16.0')) return [];", 'packages/core/src/x.ts')).toHaveLength(1);
});

// Release 0.9.1 is a patch of Phase 8.1: the CLI is no longer 0.9.0, so the Phase 8.1 cut-offs stay at 0.9.0, and the 0.9.1 fixes (the commit-message length bound, the unscanned slop hits, the audit and conventions-write hardening) have no cut-off of their own.
it('risk:regression release 0.9.1 adds no cut-off constant: the Phase 8.1 ones stay at 0.9.0 and none names 0.9.1', () => {
  const exported = [...readFileSync(join(REPO_ROOT, PIN_FILE), 'utf8').matchAll(/^export const (\w+_FROM) = '([^']+)';/gm)].map((m) => ({ name: m[1], value: m[2] }));
  expect(exported.filter((e) => e.value === '0.9.1').map((e) => e.name), 'no cut-off names 0.9.1').toEqual([]);
  for (const [name, v] of Object.entries(PHASE8_1)) expect(v, name).toBe('0.9.0');
});

// Release 0.8.1 ships Phase 8: the CLI is no longer 0.8.0, so a Phase 7 cut-off is compared with '0.8.0' only, and the 0.8.1 rules (the security-file refusals, D-07 and D-10) have no cut-off of their own.
it('risk:regression release 0.8.1 adds no cut-off constant: pin.ts holds the Phase 4, 5 and 7 ones and the older ones, none at 0.8.1 (8-ac-13)', () => {
  const exported = [...readFileSync(join(REPO_ROOT, PIN_FILE), 'utf8').matchAll(/^export const (\w+_FROM) = '([^']+)';/gm)].map((m) => ({ name: m[1], value: m[2] }));
  const known = [...Object.keys(PHASE4), ...Object.keys(PHASE5), ...Object.keys(PHASE7), ...Object.keys(PHASE8_1), ...Object.keys(PHASE8_2), ...Object.keys(PHASE8_5), ...Object.keys(PHASE8_8), 'RECORD_V2_FROM', 'PLAN_SIZE_FROM', 'GROUNDS_V2_FROM', 'DISCUSS_FROM', 'APPROACH_CAP_FROM', 'PLAN_FORMAT_FROM', 'PLAN_CAP_FROM', 'PLAN_GROUNDS_FROM', 'RULESET_FROM'];
  expect(exported.map((e) => e.name).sort(), 'a new cut-off constant needs its own release test').toEqual([...known].sort());
  expect(exported.filter((e) => e.value === '0.8.1').map((e) => e.name), 'no cut-off names 0.8.1').toEqual([]);
});

it('risk:regression every Phase 4 cut-off is read through claimPinBefore (rel-ac-1)', () => {
  // The scan catches a literal comparison, and leaves prose holding the version inside a longer string alone.
  expect(cutOffOffences("  return pinBefore('0.6.0', pin);", 'packages/core/src/x.ts')).toEqual(["packages/core/src/x.ts:1: return pinBefore('0.6.0', pin);"]);
  expect(cutOffOffences('  if (claimPinBefore(s, id, `0.6.0`)) return;', 'packages/cli/src/x.ts')).toHaveLength(1);
  expect(cutOffOffences('  throw new UsageError(`T-1 was claimed before 0.6.0, so it is built one task at a time`);', 'packages/cli/src/x.ts')).toEqual([]);
  expect(cutOffOffences("  // pinBefore('0.6.0', pin) in a comment compares nothing", 'packages/core/src/x.ts')).toEqual([]);
  // A cut-off used outside the claim read is caught; inside it, and on an import line, it is not.
  expect(cutOffOffences('  if (pinBefore(PLAN_MODEL_FROM, pin)) return;', 'packages/core/src/x.ts')).toHaveLength(1);
  expect(cutOffOffences('  if (claimPinBefore(withPins(root, s, id), id, PLAN_WAVES_FROM)) return;', 'packages/cli/src/x.ts')).toEqual([]);
  expect(cutOffOffences("import { claimPinBefore, TASK_REPORT_FROM } from './pin.js';", 'packages/cli/src/x.ts')).toEqual([]);

  const files = SRC_ROOTS.flatMap(sources);
  expect(files).toContain(PIN_FILE);
  // ST-LN-36 rel-ac-1: the scan reads the gate done path, the loader's pin gate and the `accord round` path, so a use there outside claimPinBefore( or a bare 0.7.0 fails it
  for (const f of ['packages/core/src/round/security.ts', 'packages/cli/src/commands/brief.ts', 'packages/cli/src/commands/gate.ts', 'packages/cli/src/load/security-facts.ts', 'packages/core/src/round/next.ts', 'packages/cli/src/commands/round.ts', 'packages/cli/src/load/fix-reports.ts']) {
    expect(files, f).toContain(f);
  }
  expect(files.some((f) => f.startsWith('packages/core/src/generated/'))).toBe(false);
  const offences = files.flatMap((f) => cutOffOffences(readFileSync(join(REPO_ROOT, f), 'utf8'), f));
  expect(offences).toEqual([]);

  // The guard that the pattern finds them: pin.ts's code lines hold one whole literal per cut-off, and nothing else does.
  const pinLiterals = readFileSync(join(REPO_ROOT, PIN_FILE), 'utf8')
    .split(/\r?\n/)
    .filter((line) => !isComment(line))
    .flatMap((line) => [...line.matchAll(LITERAL)]);
  expect(pinLiterals).toHaveLength(PHASE4_CUT.length + PHASE5_CUT.length + PHASE7_CUT.length + PHASE8_1_CUT.length + PHASE8_2_CUT.length + PHASE8_5_CUT.length + PHASE8_8_CUT.length);
  // Every use of the cut-offs in source sits inside a claimPinBefore( call: at least one per constant, so the scan is not empty.
  const uses = files.flatMap((f) => readFileSync(join(REPO_ROOT, f), 'utf8').split(/\r?\n/).filter((line) => !isComment(line) && line.includes('claimPinBefore(')));
  for (const name of PHASE_NAMES) expect(uses.some((line) => new RegExp(`\\b${name}\\b`).test(line)), name).toBe(true);
});

it('risk:regression the 0.7.0 cut-off constants are one release and read only through claimPinBefore (ST-LN-36 rel-ac-1)', () => {
  expect(Object.keys(PHASE5), 'the list names no constant').toEqual(['SECURITY_TRIGGER_FROM']);
  expect(PHASE5_CUT.length).toBeGreaterThan(0);
  for (const v of PHASE5_CUT) expect(v).toBe('0.7.0');
  // a bare 0.7.0, a Phase 5 constant outside the claim read, and a Phase 4 constant too are caught; the claim read, an import and a comment are not
  expect(cutOffOffences("  return pinBefore('0.7.0', pin);", 'packages/core/src/x.ts')).toEqual(["packages/core/src/x.ts:1: return pinBefore('0.7.0', pin);"]);
  expect(cutOffOffences('  if (pinBefore(SECURITY_TRIGGER_FROM, pin)) return;', 'packages/core/src/x.ts')).toHaveLength(1);
  expect(cutOffOffences('  if (claimPinBefore(snapshot, id, SECURITY_TRIGGER_FROM)) return snapshot;', 'packages/cli/src/x.ts')).toEqual([]);
  expect(cutOffOffences("import { claimPinBefore, SECURITY_TRIGGER_FROM } from '@accord-dev/accord-core';", 'packages/cli/src/x.ts')).toEqual([]);
  expect(cutOffOffences("  // pinBefore('0.7.0', pin) in a comment compares nothing", 'packages/core/src/x.ts')).toEqual([]);
  // the loader decides on the same claim read as the rule, before any git read (Orchestrator Ruling, route a)
  const loader = readFileSync(join(REPO_ROOT, 'packages/cli/src/load/security-facts.ts'), 'utf8').split(/\r?\n/);
  expect(loader.some((line) => !isComment(line) && line.includes('claimPinBefore(snapshot, id, SECURITY_TRIGGER_FROM)'))).toBe(true);
});

it('risk:regression the title cut-off is read only through claimPinBefore (ST-LN-22 D-08b)', () => {
  expect(Object.keys(PHASE7), 'the list names no constant').toEqual(['TITLE_RULE_FROM', 'PLAN_LARGE_FROM']);
  // the value is a plain release, and one the running accord has not passed yet or is: never a range
  for (const v of PHASE7_CUT) expect(v).toMatch(/^\d+\.\d+\.0$/);
  const value = TITLE_RULE_FROM;
  // a bare literal of the cut-off and the constant outside the claim read are caught; the claim read, an import and a comment are not
  expect(cutOffOffences(`  return pinBefore('${value}', pin);`, 'packages/core/src/x.ts')).toHaveLength(1);
  expect(cutOffOffences('  if (pinBefore(TITLE_RULE_FROM, pin)) return;', 'packages/core/src/x.ts')).toHaveLength(1);
  expect(cutOffOffences('  if (!claimPinBefore(snapshot, id, TITLE_RULE_FROM)) return [];', 'packages/core/src/gate/x.ts')).toEqual([]);
  expect(cutOffOffences("import { claimPinBefore, TITLE_RULE_FROM } from '../round/pin.js';", 'packages/core/src/gate/x.ts')).toEqual([]);
  expect(cutOffOffences('  // TITLE_RULE_FROM in a comment compares nothing', 'packages/core/src/x.ts')).toEqual([]);
  expect(cutOffOffences(`export const TITLE_RULE_FROM = '${value}';`, 'packages/core/src/round/pin.ts')).toEqual([]);
  // gate ready decides on the same claim read as every other cut-off
  const ready = readFileSync(join(REPO_ROOT, 'packages/core/src/gate/ready.ts'), 'utf8').split(/\r?\n/);
  expect(ready.some((line) => !isComment(line) && line.includes('claimPinBefore(snapshot, id, TITLE_RULE_FROM)'))).toBe(true);
});

it('risk:regression the title cut-off is read only through claimPinBefore or rulesetFrom (ST-LN-22 D-08b)', () => {
  // lint has no claim fact, so it reads the ticket's own ruleset through rulesetFrom( ; a Phase 7 cut-off inside that call is allowed as inside claimPinBefore(
  expect(cutOffOffences('  .filter((t) => rulesetFrom(t, TITLE_RULE_FROM))', 'packages/core/src/lint/x.ts')).toEqual([]);
  expect(cutOffOffences('  if (rulesetFrom(t, TITLE_RULE_FROM) && titleProblem(t.title, c)) return [];', 'packages/core/src/lint/x.ts')).toEqual([]);
  // outside both calls it is still an offence, and so is an earlier cut-off inside rulesetFrom( (that call is for the Phase 7 cut-offs only)
  expect(cutOffOffences('  if (TITLE_RULE_FROM > pin) return;', 'packages/core/src/lint/x.ts')).toHaveLength(1);
  expect(cutOffOffences('  if (rulesetFrom(t, 1)) return pinBefore(TITLE_RULE_FROM, pin);', 'packages/core/src/lint/x.ts')).toHaveLength(1);
  expect(cutOffOffences('  .filter((t) => rulesetFrom(t, SECURITY_TRIGGER_FROM))', 'packages/core/src/lint/x.ts')).toHaveLength(1);
  // lint.ticket-title reads the cut-off through rulesetFrom( and nothing else
  const lint = readFileSync(join(REPO_ROOT, 'packages/core/src/lint/ticket.ts'), 'utf8').split(/\r?\n/);
  expect(lint.some((line) => !isComment(line) && line.includes('rulesetFrom(t, TITLE_RULE_FROM)'))).toBe(true);
  expect(lint.filter((line) => !isComment(line) && line.includes('TITLE_RULE_FROM') && !/^import\s/.test(line.trim()) && !line.includes('rulesetFrom(t, TITLE_RULE_FROM)'))).toEqual([]);
});

it('risk:regression the plan-large cut-off is read only through claimPinBefore (ST-LN-28 7-ac-9)', () => {
  expect(typeof PLAN_LARGE_FROM).toBe('string');
  // the same release as the title rule: both ship in the one release that carries Phase 7
  expect(PLAN_LARGE_FROM).toBe(TITLE_RULE_FROM);
  expect(PHASE7_CUT).toContain(PLAN_LARGE_FROM);
  // a bare literal of the cut-off and the constant outside the claim read are caught; the claim read, an import, its declaration and a comment are not
  expect(cutOffOffences(`  return pinBefore('${PLAN_LARGE_FROM}', pin);`, 'packages/core/src/x.ts')).toHaveLength(1);
  expect(cutOffOffences('  if (pinBefore(PLAN_LARGE_FROM, pin)) return [];', 'packages/core/src/gate/plan.ts')).toHaveLength(1);
  expect(cutOffOffences('  if (claimPinBefore(snapshot, id, PLAN_LARGE_FROM)) return [];', 'packages/core/src/gate/plan.ts')).toEqual([]);
  expect(cutOffOffences("import { claimPinBefore, PLAN_LARGE_FROM } from '../round/pin.js';", 'packages/core/src/gate/plan.ts')).toEqual([]);
  expect(cutOffOffences(`export const PLAN_LARGE_FROM = '${PLAN_LARGE_FROM}';`, 'packages/core/src/round/pin.ts')).toEqual([]);
  expect(cutOffOffences('  // PLAN_LARGE_FROM in a comment compares nothing', 'packages/core/src/x.ts')).toEqual([]);
  // gate plan decides on the claim read, and no other code line of plan.ts holds the constant
  const plan = readFileSync(join(REPO_ROOT, 'packages/core/src/gate/plan.ts'), 'utf8').split(/\r?\n/);
  expect(plan.some((line) => !isComment(line) && line.includes('claimPinBefore(snapshot, id, PLAN_LARGE_FROM)'))).toBe(true);
  expect(plan.filter((line) => !isComment(line) && line.includes('PLAN_LARGE_FROM') && !/^import\s/.test(line.trim()) && !line.includes('claimPinBefore(snapshot, id, PLAN_LARGE_FROM)'))).toEqual([]);
});
