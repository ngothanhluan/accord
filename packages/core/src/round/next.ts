// ST-LN-17: the next review or plan critique round, the cap, the stop from round 3 and the fix executor's model,
// all computed from the round records. Pure: the host supplies the records and the return-from-verify facts.
import { laneTicket, workOf } from '../gate/work.js';
import { headingKey, stripHtmlComments } from '../load/sections.js';
import { resolveStrictness } from '../config/strictness.js';
import { AGENT_DEFAULTS } from '../skills/agents.js';
import { answerProblems, answersClosed, notHeldWaiting, riskSet } from './answers.js';
import { fixDeferred, fixProblems } from './fix.js';
import { fixScopeProblems } from './fixscope.js';
import { groundsDeferred, groundsOn, groundsProblems } from './grounds.js';
import { lensAsks, lensDeferred, lensMarkProblems, lensProblems, lensWarns } from './lens.js';
import { APPROACH_CAP_FROM, CRITIC_ONCE_FROM, PLAN_CAP_FROM, REVIEW_BUDGET_FROM, claimPinBefore, claimPinError, claimPinNote } from './pin.js';
import { pendingAddedCode, scopeProblems } from './scope.js';
import { securityProblems } from './security.js';
import type { RepoSnapshot, RoundCycle, RoundFinding, RoundRecord, TicketWork } from '../model/snapshot.js';
import { deferredOf } from './evidence.js';

export const ROUND_CAP = 5;
export type RoundKind = 'review' | 'plan' | 'approach';
export interface Allowance { n: number; after: number; cycle: number }
export interface RoundAnswer {
  kind: 'next' | 'stop' | 'refused';
  ticket: string;
  record: RoundKind;
  laneS: boolean;
  cycle: number; // 1-based; the last cycle of the record
  round: number; // next: the round given; stop and refused: the latest recorded round (0 when none)
  cap: number; // ROUND_CAP, or the end of the furthest allowance of this cycle
  reasons: string[]; // stop and refused; empty on next
  findings?: { round: number; lines: string[] }[]; // stop: the stop round's finding lines, then the latest round's when it differs; refused past the approach cap: the findings still open
  blocking?: { round: number; lines: string[] }[]; // refused past the approach cap: the open risk: data-loss or risk: security findings, which block the approval (D-22)
  approach?: string[]; // stop on a lane M ticket: the ## Approach lines
  allowAfter?: number; // stop on a round run without being allowed: the round an owner allowance must follow (else `round`)
  model?: string;
  modelFor?: number; // the round `model` is for
  addedCode?: true; // next on a version 2 review record: a debug episode or a merge added code that no round has reviewed (ST-LN-57)
  reReview?: string[]; // next on a review record under the fix record rules: the fixes (`<r>.<n>[ cycle <k>]`) no re-review round has answered yet (ST-LN-56 D-17)
  checker?: true; // a plan `next` answer at round 1 whose cap rules are PLAN_CAP: the plan skill dispatches one plan checker (ST-LN-91 D-12)
  warn?: string[]; // review: `<r>.<n> lens <name>` of each open Must or Should a `warn` team lens made in the last cycle: listed for the verify report, never blocking (Phase 11 D-06)
  recheck?: string[]; // next, round 2 of the one-round rules (Phase 10 D-01): the `1.<n>` risk findings a fresh critic re-checks, and only those
  once?: true; // a plan stop under the one-round rules: no owner Ruling raises the cap, so the answer does not offer one
  intentHint?: string[]; // review budget stop (Phase 10 D-15 (b)): the `<r>.<n>` of each open Must or Should with no risk mark first raised in round `intentRound`: they may be an intent problem
  intentRound?: number; // the round `intentHint` names: the first round of the stretch the budget counts
  ask?: string[]; // review stop: `<r>.<n> lens <name>` of each open Must or Should an `ask` team lens made that the owner has not decided: the stop's own reason (Phase 11 D-06, Ruling R13)
}

/**
 * The cap rules of one record (ST-LN-91 D-02): `cap` rounds; `firstStop` the first round that can stop the loop (none: no stop of rounds);
 * `fall` the plan record's count stop (ST-LN-91 D-07): a round r >= 2 whose Must + Should count is above 0 and not below round r - 1's stops the loop; `allowances` whether an owner allowance Ruling raises the cap; `capStop` whether a
 * last round with findings at the cap is a stop (false: the cap is a refusal and `## Closed` is accepted).
 */
export interface CapRules { cap: number; firstStop?: number; fall: boolean; allowances: boolean; capStop: boolean }
/** The five-round loop with its stop from round 3: review always, plan, and an approach claimed before APPROACH_CAP_FROM. */
export const LEGACY_CAP: CapRules = { cap: ROUND_CAP, firstStop: 3, fall: false, allowances: true, capStop: true };
/** ST-LN-91 D-02: two approach rounds, no stop, no allowance. */
export const APPROACH_CAP: CapRules = { cap: 2, fall: false, allowances: false, capStop: false };
/**
 * Phase 10 D-01, 10-ac-3: one approach critique round, no stop, no allowance, for a ticket claimed at or after CRITIC_ONCE_FROM. `fall` is set for the rounds a team adds with `strictness.rounds.approach`, which
 * stop early when the Must + Should count does not fall.
 */
export const APPROACH_ONCE: CapRules = { cap: 1, fall: true, allowances: false, capStop: false };
/** Phase 10 D-01, 10-ac-3: one plan checker round (the security critic runs beside it in the same round), the same shape as APPROACH_ONCE. */
export const PLAN_ONCE: CapRules = { cap: 1, fall: true, allowances: false, capStop: false };
/** Phase 10 D-01: the one-round rules as the pin gives them, with no team cap: the only rules whose round 2 is a scoped re-check (a team's `{ ...rules, cap }` is another object). */
const isOnce = (rules: CapRules): boolean => rules === APPROACH_ONCE || rules === PLAN_ONCE;
/** Phase 10 D-01: the one-round rules or the same with a team's cap, which keep the count stop and give no allowance and no stop of their own at the cap. */
const isD01 = (rules: CapRules): boolean => rules.fall && !rules.allowances && !rules.capStop;

/**
 * Phase 10 D-01, T-10-01: the `n` of each finding `1.<n>` of the cycle's round 1 that is marked `risk: data-loss` or `risk: security` (its own mark, as `classify` reads it): the findings whose fix a scoped re-check
 * round covers. A finding the critic withdrew, or the owner dropped with `owner: "<words>"`, needs no re-check, and neither does one the planner answered `does not hold` (Phase 10 D-14): that answer is no fix, and the finding goes to the owner.
 */
export function recheckOf(cycle: RoundCycle | undefined): number[] {
  return (cycle?.rounds[0]?.findings ?? []).flatMap((f) => (f.risk !== undefined && f.n !== undefined && f.state !== 'withdrawn' && f.state !== 'owner' && f.state !== 'notHeld' ? [f.n] : []));
}

/** ST-LN-91 D-07, D-17: three plan critique rounds, the stop from round 3 beside the count stop, and the owner's allowance Rulings kept. */
export const PLAN_CAP: CapRules = { cap: 3, firstStop: 3, fall: true, allowances: true, capStop: true };

/**
 * Phase 10 D-06 (as amended per slice 2026-11-28), 10-ac-4: the review budget of a lane M ticket claimed at or after REVIEW_BUDGET_FROM: three review rounds (of the slice in work), the count stop from round 2 of them, and the owner's
 * allowance Rulings kept. There is no `firstStop`: the budget stop and the count stop replace the stop from round 3. A team's `strictness.rounds.review` replaces only `cap`.
 */
export const REVIEW_BUDGET: CapRules = { cap: 3, fall: true, allowances: true, capStop: true };
/** Phase 10 D-06: the review budget or the same with a team's cap: the only review rules that count the count stop and have no stop from round 3. */
const isBudget = (rules: CapRules, kind: RoundKind): boolean => kind === 'review' && rules.fall && rules.allowances && rules.capStop && rules.firstStop === undefined;

/**
 * The rules of the record `kind` of ticket `id`; the approach and plan records read the ticket's claim pin (D-15), never their own record pin.
 * ST-LN-50 D-07: a team's `strictness.rounds.<kind>` replaces only `cap` in whichever rules the pin picked; the stop rules, the allowances and the
 * cap-is-a-refusal behaviour keep their data, so the approval block (which reads `allowances` and `capStop`, never `cap`) is the same at every cap.
 * This is the one seam the cap is read through.
 */
export function capRulesOf(snapshot: RepoSnapshot, id: string, kind: RoundKind): CapRules {
  const rules =
    kind === 'review'
      ? isLaneM(snapshot, id) && !claimPinBefore(snapshot, id, REVIEW_BUDGET_FROM) ? REVIEW_BUDGET : LEGACY_CAP
      : kind === 'approach'
        ? claimPinBefore(snapshot, id, APPROACH_CAP_FROM) ? LEGACY_CAP : claimPinBefore(snapshot, id, CRITIC_ONCE_FROM) ? APPROACH_CAP : APPROACH_ONCE
        : claimPinBefore(snapshot, id, PLAN_CAP_FROM) ? LEGACY_CAP : claimPinBefore(snapshot, id, CRITIC_ONCE_FROM) ? PLAN_CAP : PLAN_ONCE;
  const team = resolveStrictness(snapshot.config).rounds[kind];
  return team === undefined ? rules : { ...rules, cap: team };
}

const ALLOWANCE =
  /^Ruling: the owner allows ([1-9][0-9]*) more (review|plan critique|approach critique) rounds after round ([1-9][0-9]*) of cycle ([1-9][0-9]*) — ".*\S.*" — \S/;

const NOUN: Record<RoundKind, string> = { review: 'review', plan: 'plan critique', approach: 'approach critique' };
const FILE: Record<RoundKind, string> = { review: 'review.md', plan: 'plan-review.md', approach: 'approach-review.md' };

/** The owner allowance Rulings of the ledger for one record kind; a line that does not match grants nothing. */
export function allowancesOf(snapshot: RepoSnapshot, id: string, kind: RoundKind): Allowance[] {
  const want = NOUN[kind];
  const out: Allowance[] = [];
  for (const ruling of workOf(snapshot, id)?.ledger?.rulings ?? []) {
    const m = ALLOWANCE.exec(ruling);
    if (m === null || m[2] !== want) continue;
    const a = { n: Number(m[1]), after: Number(m[3]), cycle: Number(m[4]) };
    if (Number.isSafeInteger(a.n + a.after) && Number.isSafeInteger(a.cycle)) out.push(a);
  }
  return out;
}

/** ST-LN-91 D-07: the Must and Should finding lines of a round that the stop does not defer; Nice lines and deferred ones are not counted. */
export const roundCount = (round: { findings: RoundFinding[] }, deferred: ReadonlySet<RoundFinding> = new Set()): number =>
  round.findings.filter((f) => f.severity !== 'Nice' && !deferred.has(f)).length;

/**
 * What `cycleState` answers. `kindOf` and `denied` are set only for the review budget (Phase 10 D-06): which kind of stop round `s` is, and the words for a recorded round `p` that is not allowed.
 */
export interface CycleState {
  cap: number;
  allowed: (p: number) => boolean;
  stopAt: (q: number) => number | undefined;
  kindOf?: (s: number) => StopKind | undefined;
  denied?: (p: number) => string;
}
/** Phase 10 D-06: why a round of the review budget stops the loop: the count did not fall, the budget is used. */
export type StopKind = 'count' | 'cap' | 'final';

/**
 * Phase 10 D-06, 10-ac-4: the review budget of one cycle. A round of the stretch the budget counts stops the loop when it is the last round of the budget (round `rules.cap`) and still reports a Must or a Should, or when it is
 * round 2 or later of the budget and its Must + Should count is above 0 and not below the round before it (an equal count included); a later round that reports no findings clears a stop, as it does under LEGACY_CAP. The
 * rounds past the budget are not allowed unless an owner allowance Ruling allows them (`allowances`).
 * Phase 10 D-15, 10-ac-30: the first round headed `(final review)` and the one round after it (its re-check) are outside the budget: they are allowed whatever the budget has used while no stop is pending, the count stop never
 * fires on them, a Must or a Should still reported by the re-check is a stop of its own kind ('final'), and a later round needs an owner allowance Ruling. With no final review recorded, the round after a budget of
 * rounds that ended with no stop is allowed as the final review.
 */
function budgetState(cycle: RoundCycle, allowances: Allowance[], deferred: ReadonlySet<RoundFinding>, rules: CapRules, offset: number): CycleState {
  const rounds = cycle.rounds;
  const N = rounds.length;
  const o = Math.min(Math.max(offset, 0), N); // the rounds of earlier slices: they count against no budget of this slice
  const counted = (p: number): number => roundCount(rounds[p - 1], deferred);
  const end = o + rules.cap;
  const f0 = rounds.findIndex((r, i) => i >= o && r.final === true) + 1; // 0: no final review in the slice in work
  const f = f0 > 0 ? f0 : undefined;
  const kindOf = (s: number): StopKind | undefined => {
    if (s <= o || s > N || counted(s) === 0) return undefined;
    if (f !== undefined) {
      if (s === f || s > f + 1) return undefined; // the final review itself and any round past its re-check: no stop of their own
      if (s === f + 1) return 'final';
    }
    if (s >= o + 2 && counted(s) >= counted(s - 1)) return 'count';
    return s === end ? 'cap' : undefined;
  };
  const stopAt = (q: number): number | undefined => {
    const top = Math.min(q, N);
    for (let s = top; s > o; s--) {
      if (s < top && rounds[s].noFindings) return undefined; // round s + 1 reports no findings: it clears every stop up to s
      if (kindOf(s) !== undefined) return s;
    }
    return undefined;
  };
  const allowed = (p: number): boolean => {
    if (p <= o) return true;
    const s = stopAt(p - 1);
    const free = s === undefined && (f === undefined ? p <= end || (p === end + 1 && p > N) : p < f ? p <= end : p <= f + 1);
    return free || allowances.some((a) => a.after < p && p <= a.after + a.n && (s === undefined || s <= a.after));
  };
  const denied = (p: number): string => {
    const s = stopAt(p - 1);
    if (s !== undefined) return `after the stop at round ${s}`;
    return f !== undefined && p > f ? "past the final review's one fix and one re-check (D-15)" : `past the budget of ${rules.cap} review rounds (D-06)`;
  };
  const cap = f !== undefined ? f + 1 : N >= end && stopAt(N) === undefined ? end + 2 : end;
  return { cap: Math.max(cap, ...allowances.map((a) => a.after + a.n)), allowed, stopAt, kindOf, denied };
}

/** Phase 10 D-06, D-15: the rounds of the review budget among rounds 1 to `upTo` of a cycle: not the first final review and not the round after it. */
function budgetRoundsOf(cycle: RoundCycle | undefined, upTo: number, offset: number): number {
  const o = Math.min(Math.max(offset, 0), cycle?.rounds.length ?? 0);
  const f = (cycle?.rounds.findIndex((r, i) => i >= o && r.final === true) ?? -1) + 1;
  let n = 0;
  for (let p = o + 1; p <= upTo; p++) if (f === 0 || (p !== f && p !== f + 1)) n++;
  return n;
}

/**
 * Phase 10 D-06 (per slice): the rounds of cycle `c` (0-based) of the review record that lie before the slice in work, from the host's `sliceRounds` fact: the review round heads at or before the slice's start, taken in record order across
 * the cycles. 0 when the host gave none or could not read the start (every round of the cycle then counts).
 */
export function sliceOffset(snapshot: RepoSnapshot, id: string, rec: RoundRecord | undefined, c: number): number {
  const fact = Object.hasOwn(snapshot.sliceRounds ?? {}, id) ? snapshot.sliceRounds![id] : undefined;
  if (rec === undefined || fact === undefined || 'error' in fact) return 0;
  const earlier = rec.cycles.slice(0, c).reduce((n, cy) => n + cy.rounds.length, 0);
  return Math.min(Math.max(fact.before - earlier, 0), rec.cycles[c]?.rounds.length ?? 0);
}

/** Phase 10 D-06, T-10-05: the sentence a review answer adds when git could not say where the slice in work starts, so every round of the cycle counts; undefined when it was read or there is nothing to read. */
export function sliceNote(snapshot: RepoSnapshot, id: string): string | undefined {
  const fact = Object.hasOwn(snapshot.sliceRounds ?? {}, id) ? snapshot.sliceRounds![id] : undefined;
  return fact !== undefined && 'error' in fact ? fact.error : undefined;
}

/** The cap, the allowed rounds and the stop of one cycle; the caller passes only that cycle's allowances. `deferred` (ST-LN-57 D-08) are findings that do not stop the loop. */
export function cycleState(
  cycle: RoundCycle,
  allowances: Allowance[],
  kind: RoundKind,
  deferred: ReadonlySet<RoundFinding> = new Set(),
  rules: CapRules = LEGACY_CAP,
  offset = 0,
): CycleState {
  if (isBudget(rules, kind)) return budgetState(cycle, allowances, deferred, rules, offset);
  const rounds = cycle.rounds;
  const accepted = cycle.verdicts.filter((v) => v.quoted);
  // Phase 10 D-01: under the one-round rules (no team cap) a round 1 that holds a risk finding allows a second round, the scoped re-check, and no third; the count stop is a team's, never the one-round rules'.
  const once = isOnce(rules);
  const capNow = once && recheckOf(cycle).length > 0 ? 2 : rules.cap;
  const counts = rules.fall && !once;
  const stopAt = (q: number): number | undefined => {
    const top = Math.min(q, rounds.length);
    // The lowest round any stop of the rules can fall on: `firstStop`, none for APPROACH_CAP (the walk never runs). The count stop (ST-LN-91 D-07)
    // lowers it to 2 when `rules.fall` is set, independent of firstStop; the stop from round 3 applies from firstStop only.
    const first = rules.firstStop ?? Infinity;
    const lowest = counts ? Math.min(first, 2) : first;
    for (let s = top; s >= lowest; s--) {
      if (s < top && rounds[s].noFindings) return undefined; // round s + 1 reports no findings: it clears every stop up to s
      const reported = s >= first && rounds[s - 1].findings.some((f) => f.severity !== 'Nice' && !deferred.has(f));
      const counted = roundCount(rounds[s - 1], deferred);
      const fell = counts && s >= 2 && counted > 0 && counted >= roundCount(rounds[s - 2], deferred);
      if (!reported && !fell) continue;
      if (kind !== 'review') {
        const to = top < rounds.length ? rounds[top].line : Infinity;
        if (accepted.some((v) => v.line > rounds[s - 1].line && v.line < to)) continue;
      }
      return s;
    }
    return undefined;
  };
  const allowed = (p: number): boolean => {
    const s = p === 1 ? undefined : stopAt(p - 1);
    return (
      (p <= capNow && s === undefined) ||
      (rules.allowances && allowances.some((a) => a.after < p && p <= a.after + a.n && (s === undefined || s <= a.after)))
    );
  };
  return { cap: rules.allowances ? Math.max(rules.cap, ...allowances.map((a) => a.after + a.n)) : capNow, allowed, stopAt };
}

/** The round a plan critique cycle stops at: the stop from round 3, else a last round with findings at the cap. */
export function planStopOf(
  cycle: RoundCycle,
  allowances: Allowance[],
  kind: 'plan' | 'approach' = 'plan',
  deferred: ReadonlySet<RoundFinding> = new Set(),
  rules: CapRules = LEGACY_CAP,
): number | undefined {
  const st = cycleState(cycle, allowances, kind, deferred, rules);
  const L = cycle.rounds.length;
  const stop = st.stopAt(L);
  // Phase 10 D-01 (Ruling): a plan whose one-round loop has ended (its cap, the re-check round included) with a data-loss or security finding still open is a stop for the owner, who accepts it with a verdict after the last round.
  if (stop === undefined && kind === 'plan' && isD01(rules) && L > 0 && L >= st.cap) {
    const lastRound = cycle.rounds[L - 1];
    return blockingFindings(cycle).length > 0 && !cycle.verdicts.some((v) => v.quoted && v.line > lastRound.line) ? L : undefined;
  }
  if (stop !== undefined || !rules.capStop || L === 0 || L < st.cap) return stop;
  const last = cycle.rounds[L - 1];
  const acceptedAfter = cycle.verdicts.some((v) => v.quoted && v.line > last.line);
  return last.findings.length > 0 && !acceptedAfter ? L : undefined;
}

const recordOf = (work: TicketWork | undefined, kind: RoundKind): RoundRecord | undefined =>
  kind === 'review' ? work?.rounds : kind === 'plan' ? work?.planRounds : work?.approachRounds;

/** How a finding counts for the approval: an ordinary open risk, a blocker, or a risk the owner closed with a drop. */
type Class = 'open' | 'blocking' | 'accepted';

/**
 * ST-LN-91 D-22, RR-CR-01: the class of each finding of the cycle that counts. A finding is risk-marked when its own line says
 * `risk: data-loss` or `risk: security`, or it carries (`repeats <r>.<n>:`) a risk-marked finding, or a risk-marked finding was
 * `repeated as` it: a risk never drops out of a chain of repeats whose later line has no mark.
 * A risk-marked finding of any severity blocks while it is open, unverified, deferred (a risk is never deferred) or repeated as a finding that is
 * not in a later round; it stops blocking only when fixed or withdrawn, repeated as a finding that exists (which carries the risk on), or
 * dropped with `owner: "<words>"` (then it is `accepted`: closed, and listed with the owner's words). An unmarked Must or Should is `open`
 * while open or unverified.
 */
function classify(cycle: RoundCycle, closed: ReadonlySet<RoundFinding> = new Set()): Map<RoundFinding, Class> {
  const at = (round: number, n: number): RoundFinding[] => cycle.rounds[round - 1]?.findings.filter((f) => f.n === n) ?? [];
  const risk = riskSet(cycle);
  const later = (f: RoundFinding, p: number): RoundFinding[] => (f.repeatedAs !== undefined && f.repeatedAs.round > p ? at(f.repeatedAs.round, f.repeatedAs.n) : []);
  const out = new Map<RoundFinding, Class>();
  cycle.rounds.forEach((r, i) => {
    for (const f of r.findings) {
      // Phase 10 D-14: a finding the planner answered `does not hold` reads open until an answer of round/answers.ts closes it (`closed`), and a risk finding is never closed by it: it stays blocking until the owner's words.
      const open = f.state === undefined || f.state === 'open' || f.state === 'notHeld';
      if (risk.has(f)) {
        if (open || f.state === 'deferred' || (f.state === 'repeated' && later(f, i + 1).length === 0)) out.set(f, 'blocking');
        else if (f.state === 'owner') out.set(f, 'accepted');
      } else if (f.severity !== 'Nice' && open && !closed.has(f)) {
        out.set(f, 'open');
      }
    }
  });
  return out;
}

/**
 * Phase 10 D-06, T-10-04: the open findings marked `risk: data-loss` or `risk: security` of the cycle (own mark or inherited, as `classify` reads it), each as `<round>.<n>` and its line. An owner's
 * `accepted-by-owner` verdict at the review budget's stop never lifts one: Done reads this list.
 */
export function openRisks(cycle: RoundCycle): { id: string; text: string }[] {
  const classes = classify(cycle);
  const out: { id: string; text: string }[] = [];
  cycle.rounds.forEach((r, i) => {
    for (const f of r.findings) if (classes.get(f) === 'blocking') out.push({ id: `${i + 1}.${f.n ?? '?'}`, text: f.text });
  });
  return out;
}

/**
 * Phase 10 D-15 (b), 10-ac-31: the `<r>.<n>` of each open Must or Should with no risk mark that was first raised in round `first` of the cycle: the finding itself, or one that carries it on (`carried from`, `repeats`)
 * or repeats it (`repeated as`), followed back to the round it started in. A risk-marked finding (own mark or inherited) is never named: it keeps its class and goes to the owner as a risk.
 */
export function intentOf(cycle: RoundCycle, first: number): string[] {
  const classes = classify(cycle);
  const at = (round: number, n: number): RoundFinding[] => cycle.rounds[round - 1]?.findings.filter((f) => f.n === n) ?? [];
  // the earliest round and number a finding of round `r` comes from: every earlier link, `carried from` and the finding a `repeated as` names, is followed
  const origin = (f: RoundFinding, r: number): { round: number; n: number | undefined } => {
    let best = { round: r, n: f.n };
    const consider = (link: { round: number; n: number | undefined }): void => {
      if (link.round < best.round) best = link;
    };
    if (f.carried !== undefined && f.carried.round < r) for (const g of at(f.carried.round, f.carried.n)) consider(origin(g, f.carried.round));
    cycle.rounds.forEach((round, i) => {
      if (i + 1 >= r) return;
      for (const g of round.findings) if (g.state === 'repeated' && g.repeatedAs?.round === r && g.repeatedAs.n === f.n) consider(origin(g, i + 1));
    });
    return best;
  };
  const named = new Set<number>();
  cycle.rounds.forEach((round, i) => {
    for (const f of round.findings) {
      if (classes.get(f) !== 'open') continue;
      const o = origin(f, i + 1);
      if (o.round === first && o.n !== undefined) named.add(o.n);
    }
  });
  return [...named].sort((a, b) => a - b).map((n) => `${first}.${n}`);
}

/** The finding lines of each round of the cycle whose class passes `keep`. */
function linesOf(cycle: RoundCycle, keep: (c: Class | undefined) => boolean, closed?: ReadonlySet<RoundFinding>): { round: number; lines: string[] }[] {
  const classes = classify(cycle, closed);
  const out: { round: number; lines: string[] }[] = [];
  cycle.rounds.forEach((r, i) => {
    const lines = r.findings.filter((f) => keep(classes.get(f))).map((f) => f.text);
    if (lines.length > 0) out.push({ round: i + 1, lines });
  });
  return out;
}

/** ST-LN-91 D-02: per round of the cycle, the Must and Should findings still open that carry no `risk:` mark: the risks the approval lists. */
export function openFindings(cycle: RoundCycle, closed?: ReadonlySet<RoundFinding>): { round: number; lines: string[] }[] {
  return linesOf(cycle, (c) => c === 'open', closed);
}

/** ST-LN-91 D-22: the open findings marked `risk: data-loss` or `risk: security`, own mark or inherited through a repeat: they block the approval and are never listed as risks. */
export function blockingFindings(cycle: RoundCycle): { round: number; lines: string[] }[] {
  return linesOf(cycle, (c) => c === 'blocking');
}

/** ST-LN-91 D-22: the approval is held to the capped rules: the ticket's claim pin is at or after APPROACH_CAP_FROM and it is no lane S ticket (which has no approval). */
const approvalBlocks = (snapshot: RepoSnapshot, id: string): boolean => {
  const rules = capRulesOf(snapshot, id, 'approach');
  return !rules.allowances && !rules.capStop && laneTicket(snapshot, id)?.frontmatter?.lane !== 'S';
};

/**
 * ST-LN-91 D-22, RR-WR-01: what `accord show --approval --short` lists and `accord approve` refuses on, from the last approach cycle. `blocking`: the open
 * risk findings, on a ticket whose claim pin is at or after APPROACH_CAP_FROM (a ticket claimed under an older accord keeps its five rounds and its
 * approve, D-12, and a lane S ticket has no approval; both get none). `risks`: the open findings with no risk mark, the risk findings the owner
 * dropped (closed, listed with the owner's words), and on the older rules also the open risk findings, which then block nothing.
 */
export function approvalFindings(snapshot: RepoSnapshot, id: string): { risks: { round: number; lines: string[] }[]; blocking: { round: number; lines: string[] }[] } {
  const rec = workOf(snapshot, id)?.approachRounds;
  if (rec === undefined) return { risks: [], blocking: [] };
  const cycle = rec.cycles[rec.cycles.length - 1];
  const blocks = approvalBlocks(snapshot, id);
  const closed = answersClosed(snapshot, id, 'approach', rec.cycles.length - 1);
  return {
    risks: linesOf(cycle, (c) => c === 'open' || c === 'accepted' || (!blocks && c === 'blocking'), closed),
    blocking: blocks ? blockingFindings(cycle) : [],
  };
}

/**
 * Phase 10 D-14, T-10-08: the `<round>.<n>` of each finding of the last approach cycle that the planner answered `does not hold` and that is marked data-loss or security: it blocks the approval and waits for the owner, whose
 * `owner: "<words>"` closes it. Empty for a ticket on the older approval rules, which block nothing.
 */
export function approvalWaiting(snapshot: RepoSnapshot, id: string): string[] {
  const rec = workOf(snapshot, id)?.approachRounds;
  return rec === undefined || !approvalBlocks(snapshot, id) ? [] : notHeldWaiting(snapshot, id, 'approach', rec.cycles.length - 1);
}

/**
 * ST-LN-91 D-22: the open `risk: data-loss` and `risk: security` approach findings of the last approach cycle, per round, for a ticket on the capped rules:
 * `accord approve` refuses while any is open. The owner's no (`## Closed`) opens a cycle that holds none.
 */
export function approvalBlockers(snapshot: RepoSnapshot, id: string): { round: number; lines: string[] }[] {
  return approvalFindings(snapshot, id).blocking;
}

/**
 * ST-LN-91 CR-01: the record problems of the approach record that stop the approval, on the capped rules only (a ticket claimed under an older accord, and a lane
 * S ticket, are asked nothing: their old records keep the forms they were written in, and `accord approve` read no record before 0.4.1). The same
 * reasons `accord round --approach` refuses with, in line order: a line accord cannot read, a `risk:` mark it cannot read, a round with no finding.
 */
export function approvalProblems(snapshot: RepoSnapshot, id: string): string[] {
  if (workOf(snapshot, id)?.approachRounds === undefined || !approvalBlocks(snapshot, id)) return [];
  return recordProblems(snapshot, id, 'approach').map((p) => p.reason);
}

const ofCycle =(all: Allowance[], index: number): Allowance[] => all.filter((a) => a.cycle === index + 1);

/**
 * The findings of one cycle (0-based) that leave the stop: a review record's evidence deferrals (ST-LN-57 D-08) and re-review findings outside the fix diff written
 * deferred with their ledger line (ST-LN-56 D-10), the findings of a team lens that does not block (Phase 11 D-06) and, for every record kind, the ungrounded findings deferred with their failing case (ST-LN-91 D-12), and the findings an answer closes without a fix: the planner's `does not hold` with a place that exists (Phase 10 D-14, round/answers.ts).
 */
export const deferredFor = (snapshot: RepoSnapshot, id: string, kind: RoundKind, cycle: number): ReadonlySet<RoundFinding> =>
  new Set([
    ...(kind === 'review' ? deferredOf(snapshot, id, cycle) : []),
    ...(kind === 'review' ? fixDeferred(snapshot, id, cycle) : []),
    ...(kind === 'review' ? lensDeferred(snapshot, id, cycle) : []),
    ...answersClosed(snapshot, id, kind, cycle),
    ...groundsDeferred(snapshot, id, kind, cycle),
  ]);

/** Every reason the record cannot be read as it stands, in line order. */
export function recordProblems(snapshot: RepoSnapshot, id: string, kind: RoundKind): { line: number; reason: string }[] {
  const work = workOf(snapshot, id);
  const rec: RoundRecord | undefined = recordOf(work, kind);
  if (rec === undefined) return [];
  const out = [...rec.unreadable];
  const all = allowancesOf(snapshot, id, kind);
  const rules = capRulesOf(snapshot, id, kind);
  const add = (line: number, reason: string) => out.push({ line, reason: `line ${line}: ${reason}` });
  // ST-LN-91 rounds 5 and 6 (structural reading): a risk slot (a segment after the finding's text, or a `rests on` line of the critic's block, whose key is `risk`, `risks` or `rests on` and whose value is a
  // security or data-loss kind written some way) whose value does not
  // parse, where marks count: the approach record on the capped rules, a plan record on the grounds rule. Every cycle is held to it, as an unreadable line is: a problem in an older cycle stops
  // the approval as well (IN-01). Words in the finding's text, a note, a reason or the owner's words are prose and never reach this list.
  const marksCount = kind === 'approach' ? !rules.allowances && !rules.capStop : kind === 'plan' && groundsOn(snapshot, id, 'plan');
  if (marksCount) {
    for (const cycle of rec.cycles) {
      for (const round of cycle.rounds) {
        for (const u of round.markUnread ?? []) {
          // BUG-LN-22 WR-02: a readable mark on the line under its finding is misplaced, not unreadable: the problem says where it goes.
          if (u.lazy === true) {
            add(u.line, `a mark not under its finding ("${u.text}"): write it on the finding line as " — risk: data-loss" or " — risk: security", or indent it under the finding as "rests on: risk: security"`);
            continue;
          }
          add(u.line, `a mark accord cannot read ("${u.text}"); a risk is written exactly as " — risk: data-loss" or " — risk: security" after the finding's text, or as "rests on: risk: security" on a line indented under the finding, never in backticks or quotes, with another hyphen or with another word for the kind`);
        }
      }
    }
  }
  // Phase 10 D-01, T-10-01: under the one-round rules (no team cap) a round 2 is the re-check of the risk findings of round 1, and only of those. A finding of it that carries no risk mark of its own and repeats none of them
  // (`repeats 1.<n>:` or `carried from 1.<n>`) is refused by name, so a re-check cannot carry an ordinary second round past D-01. Every cycle is held to it, as an unreadable line is.
  if (kind !== 'review' && isOnce(rules)) {
    rec.cycles.forEach((cycle, c) => {
      const listed = recheckOf(cycle);
      for (const f of cycle.rounds[1]?.findings ?? []) {
        if (listed.length === 0 || f.risk !== undefined || (f.carried?.round === 1 && listed.includes(f.carried.n))) continue;
        const named = listed.map((n) => `1.${n}`).join(', ');
        add(f.line, `finding ${f.n === undefined ? '' : `2.${f.n} `}of round 2${rec.cycles.length > 1 ? ` of cycle ${c + 1}` : ''} carries no risk mark and repeats none of ${named}: a re-check round covers only the risk findings it names (D-01), so it is taken out of the record: "${f.text}"`);
      }
    });
  }
  // Phase 10 D-14, 10-ac-21: a `does not hold` answer with no readable place, or whose place the host found missing, is refused with its line; every cycle is held to it.
  for (const p of answerProblems(snapshot, id, kind)) add(p.line, p.reason);
  // Phase 11 D-06, Ruling R12: a `lens:` mark that names a built-in lens, a lens with no file, or a lens the finding's own round did not print is refused with its line, by `accord round` and `gate done` alike.
  if (kind === 'review') for (const p of lensMarkProblems(snapshot, id)) add(p.line, p.reason);
  rec.cycles.forEach((cycle, i) => {
    if (kind === 'review' && i >= 1) {
      const before = rec.cycles[i - 1];
      if (cycle.marker !== undefined && snapshot.returnFacts?.[id]?.[cycle.marker] !== true) {
        add(cycle.line, `## Return from verify ${cycle.marker} names a commit accord cannot confirm: it must be an ancestor of HEAD at which review.md ended with its verdict`);
      }
      if (before.rounds.length === 0) {
        add(cycle.line, 'a return from verify with no round before it');
      } else if (before.verdicts.length === 0) {
        add(cycle.line, `cycle ${i} has no verdict: line before ## Return from verify`);
      } else {
        const stop = cycleState(before, ofCycle(all, i - 1), kind, deferredFor(snapshot, id, kind, i - 1), rules, kind === 'review' ? sliceOffset(snapshot, id, rec, i - 1) : 0).stopAt(before.rounds.length);
        const last = before.verdicts[before.verdicts.length - 1];
        if (stop !== undefined && !(last.value === 'accepted-by-owner' && last.quoted)) {
          add(cycle.line, `## Return from verify follows the stop at round ${stop} of cycle ${i}, which the owner did not accept with verdict: accepted-by-owner "<sentence>"`);
        }
      }
    }
    if (kind !== 'review' && cycle.closed !== undefined) {
      // An approach on the capped rules has no stop: round 3 is a refusal and `## Closed` stays open to the owner's no (ST-LN-91 D-22); the one-round rules' count stop belongs to a team's extra rounds and does not change that.
      const stop = kind === 'approach' && !rules.allowances && !rules.capStop ? undefined : planStopOf(cycle, ofCycle(all, i), kind, deferredFor(snapshot, id, kind, i), rules);
      if (stop !== undefined) {
        add(cycle.closed, `## Closed while the stop at round ${stop} holds; the owner accepts with verdict: accepted-by-owner "<sentence>" after that round, or a round that reports no findings clears it`);
      }
    }
  });
  return out.sort((a, b) => a.line - b.line);
}

const FAMILY = /^claude-(?:[a-z0-9.]+-)*?(haiku|sonnet|opus)(?:-|$)/i;
const TIERS = ['haiku', 'sonnet', 'opus'] as const;

/** The model family of an executor model name, or undefined when it names none. */
export function modelFamily(model: string): 'haiku' | 'sonnet' | 'opus' | undefined {
  const lower = model.toLowerCase();
  if ((TIERS as readonly string[]).includes(lower)) return lower as 'haiku' | 'sonnet' | 'opus';
  const m = FAMILY.exec(model);
  return m === null ? undefined : (m[1].toLowerCase() as 'haiku' | 'sonnet' | 'opus');
}

/** A lane ticket with review rounds and fix executors: any lane but S and, ST-LN-94 D-10, R (a research ticket has neither). */
const isLaneM = (snapshot: RepoSnapshot, id: string): boolean => {
  const t = laneTicket(snapshot, id);
  return t !== undefined && t.frontmatter?.lane !== 'S' && t.frontmatter?.lane !== 'R';
};

/** The model of the executor that fixes round `round`'s findings (default: the latest recorded round). */
export function fixModel(snapshot: RepoSnapshot, id: string, round?: number): { model: string } | { refused: string } | undefined {
  if (!isLaneM(snapshot, id)) return undefined;
  const rec = workOf(snapshot, id)?.rounds;
  const r = round ?? rec?.cycles[rec.cycles.length - 1].rounds.length ?? 0;
  if (r === 0) return undefined;
  const configured = Number(snapshot.config?.escalation?.fix_round_tier_up ?? '4');
  const tier = Number.isInteger(configured) && configured > 0 ? configured : 4;
  // Phase 10 D-06, D-15: under the review budget the tier-up counts the rounds of the budget, not the final review or its re-check, so it tiers up only past a raised budget (strictness.rounds.review).
  const rules = capRulesOf(snapshot, id, 'review');
  const budget = isBudget(rules, 'review');
  const counted = (c: RoundCycle | undefined, i: number, upTo: number): number => (budget ? Math.min(budgetRoundsOf(c, upTo, sliceOffset(snapshot, id, rec, i)), rules.cap) : upTo);
  const last = (rec?.cycles.length ?? 1) - 1;
  const raised = counted(rec?.cycles[last], last, r) >= tier || (rec?.cycles ?? []).some((c, i) => counted(c, i, c.rounds.length) >= tier);
  const base = snapshot.config?.models?.executor?.model ?? AGENT_DEFAULTS.executor.model;
  const family = modelFamily(base);
  if (!raised) return { model: family ?? base };
  if (family === undefined) {
    return { refused: `the executor model "${base}" in accord/config.yml (models.executor.model) cannot be tiered up; set it to haiku, sonnet or opus` };
  }
  return { model: TIERS[Math.min(TIERS.indexOf(family) + 1, TIERS.length - 1)] };
}

function approachOf(snapshot: RepoSnapshot, id: string): string[] {
  const section = snapshot.tickets[id]?.sections.find((s) => headingKey(s.heading) === 'approach');
  if (section === undefined) return [];
  const lines = stripHtmlComments(section.lines).map((l) => l.text);
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  return lines;
}

const scopeReason = (p: { line?: number; reason: string }): string => (p.line === undefined ? p.reason : `line ${p.line}: ${p.reason}`);

/**
 * The decision for the next round of review.md or plan-review.md; a review answer of any kind lists the open findings of a `warn` team lens (Phase 11 D-06), which never block, so the verify report can name
 * them even once the loop has ended.
 */
export function nextRound(snapshot: RepoSnapshot, id: string, kind: RoundKind): RoundAnswer {
  const answer = nextRoundOf(snapshot, id, kind);
  const rec = kind === 'review' ? workOf(snapshot, id)?.rounds : undefined;
  const warn = rec === undefined ? [] : lensWarns(snapshot, id, rec.cycles.length - 1);
  return warn.length === 0 ? answer : { ...answer, warn };
}

function nextRoundOf(snapshot: RepoSnapshot, id: string, kind: RoundKind): RoundAnswer {
  const laneS = laneTicket(snapshot, id)?.frontmatter?.lane === 'S';
  const rules = capRulesOf(snapshot, id, kind);
  const base: RoundAnswer = { kind: 'refused', ticket: id, record: kind, laneS, cycle: 1, round: 0, cap: rules.cap, reasons: [] };
  // ST-LN-91 WR-01, RR-IN-03: a failed read of the claim pin gives the capped rules (fail closed); a refusal the cap rules give (past the cap, an ended
  // loop, a blocked approval) says why; a refusal about the record or the ticket does not.
  // WR-04: a plan answer says it too, in its own words, on every answer that applies the new plan rules: the next round, a stop, and a refusal.
  // Phase 10 D-06, T-10-05: for a review answer the same slot says that git could not read where the slice in work starts, so every round of the cycle counts.
  const claimError = kind === 'approach' ? claimPinError(snapshot, id) : kind === 'plan' ? claimPinNote(snapshot, id) : sliceNote(snapshot, id);
  const refuse = (...reasons: string[]): RoundAnswer => ({ ...base, reasons });
  const refuseCap = (...reasons: string[]): RoundAnswer => refuse(...reasons, ...(claimError === undefined ? [] : [claimError]));
  if (laneTicket(snapshot, id) === undefined) return refuse(`${id} is not a lane ticket`);
  if (kind !== 'review' && laneS) return refuse(`lane S has no ${NOUN[kind]}`);
  // ST-LN-94 D-10: a research ticket has no rounds of any kind; it ends in a record under accord/research/.
  if (laneTicket(snapshot, id)?.frontmatter?.lane === 'R') return refuse(`lane R has no ${kind === 'review' ? 'review rounds' : NOUN[kind]}`);
  const lane = isLaneM(snapshot, id);
  const file = FILE[kind];
  const rec = recordOf(workOf(snapshot, id), kind);
  let awaiting: string[] = []; // the fixes whose re-review round has not run yet (set below, read by `next`)

  const next = (round: number, cycle: number, cap: number): RoundAnswer => {
    const answer: RoundAnswer = { ...base, kind: 'next', cycle, round, cap, ...((kind === 'plan' || kind === 'review') && claimError !== undefined ? { reasons: [claimError] } : {}) };
    if (kind === 'review' && lane) {
      const m = fixModel(snapshot, id, round);
      if (m !== undefined && 'refused' in m) return refuse(m.refused);
      if (m !== undefined) {
        answer.model = m.model;
        answer.modelFor = round;
      }
    }
    if (kind === 'review' && pendingAddedCode(snapshot, id)) answer.addedCode = true;
    if (awaiting.length > 0) answer.reReview = awaiting;
    // ST-LN-91 D-12: round 1 under the new plan rules names its critic; under LEGACY_CAP nothing is added to the 0.4.0 output.
    if (kind === 'plan' && round === 1 && rules.fall) answer.checker = true;
    // Phase 10 D-01: round 2 of the one-round rules is the scoped re-check of the risk findings of round 1.
    if (isOnce(rules) && round === 2) {
      const listed = recheckOf(rec?.cycles[cycle - 1]);
      if (listed.length > 0) answer.recheck = listed.map((n) => `1.${n}`);
    }
    return answer;
  };

  if (rec === undefined || (!rec.versioned && rec.cycles.every((c) => c.rounds.length === 0))) return next(1, 1, rules.cap);
  if (!rec.versioned) {
    // ST-LN-57: a record the version cut-over refuses, or whose facts git could not give, says so before the missing version line.
    const scope = kind === 'review' ? scopeProblems(snapshot, id) : [];
    if (scope.length > 0) return refuse(...scope.map(scopeReason));
    return refuse(`${file} has no record version line; add the line "Round record: 1" above its first ## heading and ask again: its rounds count as cycle 1`);
  }
  const problems = recordProblems(snapshot, id, kind);
  // Round 2 review WR-02, round 3 IN-03: a plan record problem names a failed claim read, as gate plan names it on every plan finding. Not every such problem
  // depends on the claim pin (a mark no rule reads is refused under a readable claim too); the note then names a cause that changes nothing, which is accepted.
  if (problems.length > 0) return (kind === 'plan' ? refuseCap : refuse)(...problems.map((p) => p.reason));
  const scope = kind === 'review' ? scopeProblems(snapshot, id) : [];
  if (scope.length > 0) return refuse(...scope.map(scopeReason));
  // ST-LN-91 D-11: from the cut-off pin a Must or Should of round 2 or later cites a ticket line, test, command or risk tag; D-19: for a plan record of a ticket
  // claimed at the plan cut-off, from round 1.
  const grounds = groundsOn(snapshot, id, kind) ? groundsProblems(snapshot, id, kind) : [];
  // Round 2 review IN-01: the grounds rule reads the record's pin; only a plan's grounds rule from round 1 is decided by the claim pin.
  if (grounds.length > 0) return (kind === 'plan' ? refuseCap : refuse)(...grounds.map(scopeReason));
  // ST-LN-56 D-08, D-10: from the fix record cut-off a fix recorded `fixed in <sha>` lists the places it checked, and a fix a later round followed carries the re-review's answer,
  // before the next review round. A fix whose re-review round has not run yet (the last round's, or one only added-code rounds followed) is refused at gate done, not here: the round
  // about to start may be that re-review, so it is listed on the `Re-review:` line, which also tells a session about to write the verdict to run that round first (D-17).
  const allFixes = kind === 'review' ? fixProblems(snapshot, id, { verdict: true }) : [];
  const fixes = allFixes.filter((p) => p.awaiting === undefined);
  if (fixes.length > 0) return refuse(...fixes.map(scopeReason));
  // ST-LN-36 D-05, D-10: a round whose package had security triggers needs its security review, and a round with none records `Security: no pattern matched`, before the next round
  // is asked for: the one rule (securityProblems) gate done reads, with its own cut-off and its own pin read.
  const security = kind === 'review' ? securityProblems(snapshot, id) : [];
  if (security.length > 0) return refuse(...security.map(scopeReason));
  // Phase 11 D-05: a round whose package printed a team lens needs `Lens: <name> ran` before the next round is asked for: the one rule (lensProblems) `accord gate done` reads from plan 11-07.
  const lenses = kind === 'review' ? lensProblems(snapshot, id) : [];
  if (lenses.length > 0) return refuse(...lenses.map(scopeReason));
  awaiting = [...new Set(allFixes.flatMap((p) => (p.awaiting === undefined ? [] : [p.awaiting])))];

  const k = rec.cycles.length;
  const cyc = rec.cycles[k - 1];
  const L = cyc.rounds.length;
  const all = allowancesOf(snapshot, id, kind);
  // Phase 10 D-06 (per slice): the rounds of earlier slices count against no budget of the slice in work; a start git could not read is said on every answer and counts every round.
  const off = kind === 'review' ? sliceOffset(snapshot, id, rec, k - 1) : 0;
  const st = cycleState(cyc, ofCycle(all, k - 1), kind, deferredFor(snapshot, id, kind, k - 1), rules, off);
  const stopOf = (q: number) =>
    kind === 'review' ? st.stopAt(q) : kind === 'approach' && !rules.allowances && !rules.capStop ? undefined : planStopOf(cyc, ofCycle(all, k - 1), kind, deferredFor(snapshot, id, kind, k - 1), rules);
  // ST-LN-91 D-02: at the approach cap round 3 is a refusal, not a stop: no allowance lifts it and `## Closed` stays open to the owner's no.
  const capped = !rules.allowances && !rules.capStop && kind === 'approach';
  // Phase 10 D-01: the one-round rules (APPROACH_ONCE, or the same with a team's cap): the words a refusal uses for the cap it is past. A cap of the older rules reads as it always did.
  const d01 = isD01(rules);
  const d01Plan = d01 && kind === 'plan';
  const capWords = (): string =>
    !d01
      ? `the cap of ${st.cap} approach critique rounds`
      : isOnce(rules)
        ? `the one ${NOUN[kind]} round${st.cap > 1 ? ' and its one re-check' : ''} of D-01 (more rounds only from strictness.rounds.${kind} in accord/config.yml)`
        : `the cap of ${st.cap} ${NOUN[kind]} rounds that strictness.rounds.${kind} sets`;
  const unlisted = (): Pick<RoundAnswer, 'findings' | 'blocking'> => ({ findings: openFindings(cyc, answersClosed(snapshot, id, kind, k - 1)), blocking: blockingFindings(cyc) });
  // ST-LN-91 D-22: an ended capped loop (a verdict, a round with no findings, round 3 asked) still refuses the approval while a data-loss or
  // security finding is open; the owner's no with a Correction appends ## Closed and starts a new cycle.
  const blockedRefusal = (lead: string): RoundAnswer | undefined => {
    const left = unlisted();
    if (left.blocking!.length === 0) return undefined;
    // Phase 10 D-14, T-10-08: a risk finding the planner answered `does not hold` is never closed by the place; the refusal names it as the owner's to decide.
    const waiting = notHeldWaiting(snapshot, id, kind, k - 1);
    const waits = waiting.length === 0 ? '' : `; the planner answered ${waiting.join(', ')} does not hold, which never closes a data-loss or security finding: it waits for the owner, whose owner: "<the owner's words>" on that finding closes it`;
    if (d01Plan) {
      // Phase 10 D-01 (Ruling): a plan has no approval to block; a data-loss or security finding still open when the one-round loop has ended stops it for the owner, who accepts it with a verdict after the last round.
      if (cyc.verdicts.some((v) => v.quoted && v.line > cyc.rounds[L - 1].line)) return undefined;
      return stop([`${lead}; a finding marked risk: data-loss or risk: security is still open${waits}`], L, { findings: left.blocking, once: true });
    }
    if (!capped) return undefined;
    const reason = `${lead}; a finding marked risk: data-loss or risk: security is still open, and it blocks the approval: the owner cannot say yes to this approach; the owner's no with a Correction appends ## Closed and starts a new cycle of ${st.cap} rounds${waits}`;
    return { ...refuseCap(reason), cycle: k, round: L, cap: st.cap, ...left };
  };
  const textsOf = (n: number) => ({ round: n, lines: cyc.rounds[n - 1].findings.map((f) => f.text) });
  const findingsFor = (s: number) => (L === s ? [textsOf(s)] : [textsOf(s), textsOf(L)]);
  // ST-LN-91 D-07: the count stop's reason for round `s`.
  const countReason = (s: number): string => {
    const deferred = deferredFor(snapshot, id, kind, k - 1);
    return `round ${s} of cycle ${k} reports ${roundCount(cyc.rounds[s - 1], deferred)} Must and Should, not fewer than the ${roundCount(cyc.rounds[s - 2], deferred)} of round ${s - 1}: the count did not fall, so the loop stops`;
  };
  // ST-LN-56 D-17: a stop names the fixes still waiting for their re-review, as a second reason, so no stop that names them is the cap-only stop that lets the verdict be written.
  const pending =
    awaiting.length === 0
      ? []
      : [`the fixes ${awaiting.join(', ')} still wait for their re-review (D-17): no verdict before a round not headed (added code round 1) answers them; past the cap that round needs the owner's Ruling allowing it`];
  const stop = (reasons: string[], s: number, extra: Partial<RoundAnswer> = {}): RoundAnswer => ({
    ...base,
    kind: 'stop',
    cycle: k,
    round: L,
    cap: st.cap,
    reasons: [...reasons, ...pending, ...(claimError === undefined ? [] : [claimError])],
    ...(awaiting.length === 0 ? {} : { reReview: awaiting }),
    findings: findingsFor(s),
    ...(lane ? { approach: approachOf(snapshot, id) } : {}),
    ...extra,
  });

  // Phase 10 D-06, D-15 (b), T-10-04: a review budget stop lists the open data-loss and security findings an owner's verdict cannot lift, and, for the count stop and the budget used (never the final review's), the round-1 findings
  // that may be an intent problem.
  const budgetExtra = (s: number): Partial<RoundAnswer> => {
    const why = st.kindOf?.(s);
    if (why === undefined) return {};
    const risks = blockingFindings(cyc);
    const hint = why === 'final' ? [] : intentOf(cyc, off + 1);
    return { ...(risks.length === 0 ? {} : { blocking: risks }), ...(hint.length === 0 ? {} : { intentHint: hint, intentRound: off + 1 }) };
  };

  // A round run without being allowed: whatever verdict follows, a skipped stop stays visible.
  for (let p = 2; p <= L; p++) {
    if (st.allowed(p)) continue;
    const past = p > st.cap;
    if ((capped || d01Plan) && past) {
      const reason = `round ${p} of cycle ${k} ran past ${capWords()}, which no Ruling raises`;
      return blockedRefusal(reason) ?? { ...refuseCap(reason), cycle: k, round: L, cap: st.cap, ...unlisted() };
    }
    const s = past && st.denied === undefined ? p - 1 : (st.stopAt(p - 1) ?? p - 1);
    // Phase 10 D-01: an approach round a team's cap allows, run after a round whose count did not fall, is refused: the approach loop has no stop, only the refusal.
    if (capped && d01) {
      const reason = `${countReason(s)} (D-01), and round ${p} of cycle ${k} ran after it`;
      return blockedRefusal(reason) ?? { ...refuseCap(reason), cycle: k, round: L, cap: st.cap, ...unlisted() };
    }
    const why = st.denied !== undefined ? st.denied(p) : past ? `past the cap of ${st.cap} rounds` : `after the stop at round ${s}`;
    return stop([`round ${p} of cycle ${k} ran without an owner Ruling allowing it: ${why}`], s, { allowAfter: p - 1, ...(d01Plan ? { once: true } : {}), ...budgetExtra(s) });
  }

  const verdict = cyc.verdicts[cyc.verdicts.length - 1];
  if (verdict !== undefined && (L === 0 || verdict.line > cyc.rounds[L - 1].line)) {
    const accepted = verdict.value === 'accepted-by-owner' && verdict.quoted;
    if (accepted || stopOf(L) === undefined) {
      const blocked = blockedRefusal(`${file} ends cycle ${k} with verdict: ${verdict.value} at line ${verdict.line}`);
      if (blocked !== undefined) return blocked;
      const tail =
        kind === 'review'
          ? '; a new cycle starts with a ## Return from verify <sha> line'
          : kind === 'plan'
            ? '; the loop has ended: the plan skill goes on to its baseline tests and appends ## Closed when it finishes, which starts the next cycle'
            : '; the loop has ended: the approach stage (approach.md) goes on to write ## Approach in full and ask the owner, and a round on another option follows a ## Closed line, which starts the next cycle';
      return { ...refuseCap(`${file} ends cycle ${k} with verdict: ${verdict.value} at line ${verdict.line}${tail}`), cycle: k, round: L, cap: st.cap };
    }
  }

  // Phase 11 D-06, Ruling R13: the open Must and Should findings of the cycle are only those of an `ask` team lens, no fix waits for its re-review: the end of the review loop. No executor is sent for them;
  // each is put to the owner, who fixes it, defers it with a `## Deferred` line or accepts it (the forms Done reads). Any other open Must or Should goes on as before, and so does a risk finding.
  if (kind === 'review' && awaiting.length === 0) {
    const asks = lensAsks(snapshot, id, k - 1);
    const leave = deferredFor(snapshot, id, kind, k - 1);
    const others = cyc.rounds.some((r) => r.findings.some((f) => f.severity !== 'Nice' && (f.state === undefined || f.state === 'open') && !leave.has(f)));
    if (asks.length > 0 && !others) {
      const names = [...new Set(asks.map((a) => a.lens))];
      const rounds = [...new Set(asks.map((a) => a.p))].map((round) => ({ round, lines: asks.filter((a) => a.p === round).map((a) => a.f.text) }));
      return stop(
        [`the open findings of this cycle are lens ${names.join(', ')}'s, which asks the owner (on_finding: ask): put each to the owner`],
        L,
        { findings: rounds, ask: asks.map((a) => `${a.p}.${a.f.n} lens ${a.lens}`) },
      );
    }
  }

  const p = L + 1;
  if (st.allowed(p)) {
    // ST-LN-91 D-14: from the cut-off pin the planner's fix stays in the tasks the open findings name, unless the owner's Ruling allows more.
    const fixed = kind === 'plan' ? fixScopeProblems(snapshot, id) : [];
    if (fixed.length > 0) return { ...refuse(...fixed.map(scopeReason)), cycle: k, round: L, cap: st.cap };
    return next(p, k, st.cap);
  }
  if (L > 0 && cyc.rounds[L - 1].noFindings) {
    const blocked = blockedRefusal(`round ${L} of cycle ${k} reported no findings and the cap of ${st.cap} rounds is reached`);
    if (blocked !== undefined) return blocked;
    // D-17: a fix still waits for its re-review, so the loop has not ended: the owner decides on one more round
    if (awaiting.length > 0) return stop([`round ${L} of cycle ${k} reported no findings and the cap of ${st.cap} rounds is reached`], L);
    return { ...refuseCap(`round ${L} of cycle ${k} reported no findings and the cap of ${st.cap} rounds is reached; the loop has ended: write the verdict`), cycle: k, round: L, cap: st.cap };
  }
  const counted = st.stopAt(L);
  if (capped || (d01Plan && counted === undefined)) {
    // ST-LN-91 D-22: an open data-loss or security finding is no risk to approve with.
    // Phase 10 D-01: an approach round a team's cap would allow, but for the count that did not fall, is refused for that reason and not as past the cap.
    const lead =
      capped && d01 && p <= st.cap && counted !== undefined ? `${countReason(counted)} (D-01)` : `round ${p} of cycle ${k} is past ${capWords()}, which no Ruling raises`;
    const blocked = blockedRefusal(lead);
    if (blocked !== undefined) return blocked;
    return {
      ...refuseCap(
        `${lead}; ${capped ? 'the loop has ended: write the findings still open into ## Approach as risks, and the owner decides at the approval' : 'the loop has ended: a finding still open goes to the plan approval as it stands'}`,
      ),
      cycle: k,
      round: L,
      cap: st.cap,
      ...unlisted(),
    };
  }
  const s = counted;
  if (s !== undefined) {
    // ST-LN-91 D-07: a stop below the first stop round is the count stop.
    const budgetKind = st.kindOf?.(s);
    const byCount = rules.fall && s < (rules.firstStop ?? Infinity);
    // Phase 10 D-06: a review budget stop is the count stop or the budget used, and says so; its reason is not followed by the legacy cap sentence.
    const reasons = [
      budgetKind === 'count' || (budgetKind === undefined && byCount)
        ? countReason(s)
        : budgetKind === 'cap'
          ? `round ${s} of cycle ${k} still reports a Should or a Must, and the budget of ${rules.cap} review rounds (D-06) is used: a further round needs the owner`
          : budgetKind === 'final'
            ? `round ${s} of cycle ${k}, the re-check of the final review, still reports a Should or a Must: the final review's one fix and one re-check (D-15) are used`
            : `round ${s} of cycle ${k} still reports a Should or a Must, and from round 3 such a round stops the loop`,
    ];
    if (st.kindOf === undefined && L >= st.cap) reasons.push(`the cap of ${st.cap} rounds in cycle ${k} is reached`);
    const m = kind === 'review' && lane && L < st.cap ? fixModel(snapshot, id, L) : undefined;
    return stop(reasons, s, { ...(m !== undefined && 'model' in m ? { model: m.model, modelFor: L } : {}), ...(d01Plan ? { once: true } : {}), ...budgetExtra(s) });
  }
  return stop([`the cap of ${st.cap} rounds in cycle ${k} is reached and no owner Ruling in the ledger allows more`], L);
}

/** The `warn:` lines of an answer, each ending in a newline (Phase 11 D-06). */
const lensLines = (answer: RoundAnswer): string[] => [
  ...(answer.warn ?? []).map((w) => `warn: ${w}: listed in the verify report, never blocks\n`),
  ...(answer.ask ?? []).map((a) => `ask: ${a}: the owner decides: fix, defer with a ## Deferred line, or accept with verdict: accepted-by-owner\n`),
];

/** The text `accord round` prints. */
export function roundText(answer: RoundAnswer): string {
  if (answer.kind === 'next') {
    return (
      `Round: ${answer.round} of ${answer.cap}\nCycle: ${answer.cycle}\n` +
      (answer.checker === true ? 'Critics: plan checker\n' : '') +
      (answer.recheck === undefined ? '' : `Re-check: ${answer.recheck.join(', ')}: a fresh critic re-checks only these fixes (D-01)\n`) +
      (answer.addedCode === true ? `Added code: head round ${answer.round} as ## Round ${answer.round} head <sha> (added code round 1)\n` : '') +
      (answer.reReview === undefined
        ? ''
        : `Re-review: ${answer.reReview.join(', ')}: a round not headed (added code round 1) re-checks these fixes and answers each; no verdict before it does (D-17)\n`) +
      (answer.model === undefined ? '' : `Fix executor model: ${answer.model}\n`) +
      answer.reasons.map((r) => `Note: ${r}\n`).join('') +
      lensLines(answer).join('')
    );
  }
  if (answer.kind === 'refused') {
    const out = answer.reasons.map((r) => `refused: ${r}\n`);
    if (answer.blocking !== undefined && answer.blocking.length > 0) {
      out.push('Blocking findings:\n');
      for (const f of answer.blocking) out.push(`Round ${f.round}:\n`, ...f.lines.map((l) => l + '\n'));
    }
    if (answer.findings !== undefined) {
      out.push(answer.findings.length === 0 ? 'Findings still open: none\n' : 'Findings still open:\n');
      for (const f of answer.findings) out.push(`Round ${f.round}:\n`, ...f.lines.map((l) => l + '\n'));
    }
    out.push(...lensLines(answer));
    return out.join('');
  }
  const file = FILE[answer.record];
  const noun = NOUN[answer.record];
  const out = ['stop: report to owner'];
  for (const r of answer.reasons) out.push(`Reason: ${r}`);
  if (answer.reReview !== undefined) {
    out.push(`Re-review: ${answer.reReview.join(', ')}: no verdict before a round not headed (added code round 1) answers these fixes (D-17); past the cap, only after the owner's Ruling below allows that round`);
  }
  for (const f of answer.findings ?? []) out.push(`Findings of round ${f.round}:`, ...f.lines);
  if (answer.intentHint !== undefined && answer.intentHint.length > 0) {
    out.push(`Intent: ${answer.intentHint.join(', ')} raised in round ${answer.intentRound ?? 1} and still open: they may be an intent problem (the criterion or the approach), not a code fix; ask the owner`);
  }
  if (answer.blocking !== undefined && answer.blocking.length > 0) {
    out.push('Risk findings still open (data-loss or security): verdict: accepted-by-owner does not lift them at this stop; only a fix in a round an owner Ruling allows does:');
    for (const f of answer.blocking) out.push(`Round ${f.round}:`, ...f.lines);
  }
  if (answer.approach !== undefined) out.push('Approach:', ...answer.approach);
  out.push(...lensLines(answer).map((l) => l.trimEnd()));
  out.push(
    answer.laneS
      ? 'Ask the owner whether to change course: in lane S the change of course is the lift to lane M (lane-s.md).'
      : answer.record === 'approach'
        ? "Ask the owner whether to change course: weigh the other options of the planner's direction report against going on."
        : 'Ask the owner whether to change course: weigh the options the Approach above rejected or held in reserve against going on.',
    `To accept the open findings: end ${file} with the line verdict: accepted-by-owner "<the owner's sentence>"` +
      (answer.reReview === undefined ? '' : ' (it answers no fix still waiting for its re-review: allow that round instead)'),
    answer.once === true
      ? `More rounds come only from strictness.rounds.${answer.record} in accord/config.yml (D-01): no Ruling in the ledger raises the cap`
      : `To allow more rounds: add under ## Rulings in the ledger: Ruling: the owner allows <n> more ${noun} rounds after round ${answer.allowAfter ?? answer.round} of cycle ${answer.cycle} — "<the owner's sentence>" — <cost if wrong>`,
  );
  if (answer.once === true) {
    // Phase 10 D-01: the change of course below is written through a Ruling that raises the cap, which the one-round rules do not take.
  } else if (!answer.laneS && answer.record === 'approach') {
    out.push('To change course: write that Ruling with <n> the rounds the owner gives the other option, then write that option into ## Approach and critique it through the approach stage (approach.md)');
  } else if (!answer.laneS) {
    out.push(`To change course: write that Ruling with <n> the rounds the owner gives the reworked ${answer.record === 'review' ? 'code' : 'plan'}, then re-plan through the plan stage (plan.md)`);
  }
  if (answer.model !== undefined) {
    out.push(`Fix executor model for round ${answer.modelFor}'s findings, if the owner allows more rounds: ${answer.model}`);
  }
  return out.join('\n') + '\n';
}
