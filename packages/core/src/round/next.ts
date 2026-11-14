// ST-LN-17: the next review or plan critique round, the cap, the stop from round 3 and the fix executor's model,
// all computed from the round records. Pure: the host supplies the records and the return-from-verify facts.
import { laneTicket, workOf } from '../gate/work.js';
import { headingKey, stripHtmlComments } from '../load/sections.js';
import { AGENT_DEFAULTS } from '../skills/agents.js';
import { fixScopeProblems } from './fixscope.js';
import { groundsDeferred, groundsOn, groundsProblems } from './grounds.js';
import { APPROACH_CAP_FROM, PLAN_CAP_FROM, claimPinBefore, claimPinError, claimPinNote } from './pin.js';
import { pendingAddedCode, scopeProblems } from './scope.js';
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
  checker?: true; // a plan `next` answer at round 1 whose cap rules are PLAN_CAP: the plan skill dispatches one plan checker (ST-LN-91 D-12)
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

/** ST-LN-91 D-07, D-17: three plan critique rounds, the stop from round 3 beside the count stop, and the owner's allowance Rulings kept. */
export const PLAN_CAP: CapRules = { cap: 3, firstStop: 3, fall: true, allowances: true, capStop: true };

/** The rules of the record `kind` of ticket `id`; the approach and plan records read the ticket's claim pin (D-15), never their own record pin. */
export function capRulesOf(snapshot: RepoSnapshot, id: string, kind: RoundKind): CapRules {
  if (kind === 'review') return LEGACY_CAP;
  if (kind === 'approach') return claimPinBefore(snapshot, id, APPROACH_CAP_FROM) ? LEGACY_CAP : APPROACH_CAP;
  return claimPinBefore(snapshot, id, PLAN_CAP_FROM) ? LEGACY_CAP : PLAN_CAP;
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

/** The cap, the allowed rounds and the stop of one cycle; the caller passes only that cycle's allowances. `deferred` (ST-LN-57 D-08) are findings that do not stop the loop. */
export function cycleState(
  cycle: RoundCycle,
  allowances: Allowance[],
  kind: RoundKind,
  deferred: ReadonlySet<RoundFinding> = new Set(),
  rules: CapRules = LEGACY_CAP,
): {
  cap: number;
  allowed: (p: number) => boolean;
  stopAt: (q: number) => number | undefined;
} {
  const rounds = cycle.rounds;
  const accepted = cycle.verdicts.filter((v) => v.quoted);
  const stopAt = (q: number): number | undefined => {
    const top = Math.min(q, rounds.length);
    // The lowest round any stop of the rules can fall on: `firstStop`, none for APPROACH_CAP (the walk never runs). The count stop (ST-LN-91 D-07)
    // lowers it to 2 when `rules.fall` is set, independent of firstStop; the stop from round 3 applies from firstStop only.
    const first = rules.firstStop ?? Infinity;
    const lowest = rules.fall ? Math.min(first, 2) : first;
    for (let s = top; s >= lowest; s--) {
      if (s < top && rounds[s].noFindings) return undefined; // round s + 1 reports no findings: it clears every stop up to s
      const reported = s >= first && rounds[s - 1].findings.some((f) => f.severity !== 'Nice' && !deferred.has(f));
      const counted = roundCount(rounds[s - 1], deferred);
      const fell = rules.fall && s >= 2 && counted > 0 && counted >= roundCount(rounds[s - 2], deferred);
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
      (p <= rules.cap && s === undefined) ||
      (rules.allowances && allowances.some((a) => a.after < p && p <= a.after + a.n && (s === undefined || s <= a.after)))
    );
  };
  return { cap: rules.allowances ? Math.max(rules.cap, ...allowances.map((a) => a.after + a.n)) : rules.cap, allowed, stopAt };
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
function classify(cycle: RoundCycle): Map<RoundFinding, Class> {
  const at = (round: number, n: number): RoundFinding[] => cycle.rounds[round - 1]?.findings.filter((f) => f.n === n) ?? [];
  const risk = new Set<RoundFinding>();
  for (const r of cycle.rounds) for (const f of r.findings) if (f.risk !== undefined) risk.add(f);
  const later = (f: RoundFinding, p: number): RoundFinding[] => (f.repeatedAs !== undefined && f.repeatedAs.round > p ? at(f.repeatedAs.round, f.repeatedAs.n) : []);
  for (let again = true; again; ) {
    again = false;
    cycle.rounds.forEach((r, i) => {
      for (const f of r.findings) {
        const inherit = (from: RoundFinding[], to: RoundFinding[]) => {
          if (!from.some((x) => risk.has(x))) return;
          for (const x of to) if (!risk.has(x)) { risk.add(x); again = true; }
        };
        if (f.carried !== undefined && f.carried.round < i + 1) inherit(at(f.carried.round, f.carried.n), [f]);
        if (f.state === 'repeated') inherit([f], later(f, i + 1));
      }
    });
  }
  const out = new Map<RoundFinding, Class>();
  cycle.rounds.forEach((r, i) => {
    for (const f of r.findings) {
      const open = f.state === undefined || f.state === 'open';
      if (risk.has(f)) {
        if (open || f.state === 'deferred' || (f.state === 'repeated' && later(f, i + 1).length === 0)) out.set(f, 'blocking');
        else if (f.state === 'owner') out.set(f, 'accepted');
      } else if (f.severity !== 'Nice' && open) {
        out.set(f, 'open');
      }
    }
  });
  return out;
}

/** The finding lines of each round of the cycle whose class passes `keep`. */
function linesOf(cycle: RoundCycle, keep: (c: Class | undefined) => boolean): { round: number; lines: string[] }[] {
  const classes = classify(cycle);
  const out: { round: number; lines: string[] }[] = [];
  cycle.rounds.forEach((r, i) => {
    const lines = r.findings.filter((f) => keep(classes.get(f))).map((f) => f.text);
    if (lines.length > 0) out.push({ round: i + 1, lines });
  });
  return out;
}

/** ST-LN-91 D-02: per round of the cycle, the Must and Should findings still open that carry no `risk:` mark: the risks the approval lists. */
export function openFindings(cycle: RoundCycle): { round: number; lines: string[] }[] {
  return linesOf(cycle, (c) => c === 'open');
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
  return {
    risks: linesOf(cycle, (c) => c === 'open' || c === 'accepted' || (!blocks && c === 'blocking')),
    blocking: blocks ? blockingFindings(cycle) : [],
  };
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
 * The findings of one cycle (0-based) that leave the stop: a review record's evidence deferrals (ST-LN-57 D-08) and, for every record
 * kind, the ungrounded findings deferred with their failing case (ST-LN-91 D-12).
 */
export const deferredFor = (snapshot: RepoSnapshot, id: string, kind: RoundKind, cycle: number): ReadonlySet<RoundFinding> =>
  new Set([...(kind === 'review' ? deferredOf(snapshot, id, cycle) : []), ...groundsDeferred(snapshot, id, kind, cycle)]);

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
          add(u.line, `a mark accord cannot read ("${u.text}"); a risk is written exactly as " — risk: data-loss" or " — risk: security" after the finding's text, or as "rests on: risk: security" on a line indented under the finding, never in backticks or quotes, with another hyphen or with another word for the kind`);
        }
      }
    }
  }
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
        const stop = cycleState(before, ofCycle(all, i - 1), kind, deferredFor(snapshot, id, kind, i - 1), rules).stopAt(before.rounds.length);
        const last = before.verdicts[before.verdicts.length - 1];
        if (stop !== undefined && !(last.value === 'accepted-by-owner' && last.quoted)) {
          add(cycle.line, `## Return from verify follows the stop at round ${stop} of cycle ${i}, which the owner did not accept with verdict: accepted-by-owner "<sentence>"`);
        }
      }
    }
    if (kind !== 'review' && cycle.closed !== undefined) {
      const stop = planStopOf(cycle, ofCycle(all, i), kind, deferredFor(snapshot, id, kind, i), rules);
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
  const raised = r >= tier || (rec?.cycles ?? []).some((c) => c.rounds.length >= tier);
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

/** The decision for the next round of review.md or plan-review.md. */
export function nextRound(snapshot: RepoSnapshot, id: string, kind: RoundKind): RoundAnswer {
  const laneS = laneTicket(snapshot, id)?.frontmatter?.lane === 'S';
  const rules = capRulesOf(snapshot, id, kind);
  const base: RoundAnswer = { kind: 'refused', ticket: id, record: kind, laneS, cycle: 1, round: 0, cap: rules.cap, reasons: [] };
  // ST-LN-91 WR-01, RR-IN-03: a failed read of the claim pin gives the capped rules (fail closed); a refusal the cap rules give (past the cap, an ended
  // loop, a blocked approval) says why; a refusal about the record or the ticket does not.
  // WR-04: a plan answer says it too, in its own words, on every answer that applies the new plan rules: the next round, a stop, and a refusal.
  const claimError = kind === 'approach' ? claimPinError(snapshot, id) : kind === 'plan' ? claimPinNote(snapshot, id) : undefined;
  const refuse = (...reasons: string[]): RoundAnswer => ({ ...base, reasons });
  const refuseCap = (...reasons: string[]): RoundAnswer => refuse(...reasons, ...(claimError === undefined ? [] : [claimError]));
  if (laneTicket(snapshot, id) === undefined) return refuse(`${id} is not a lane ticket`);
  if (kind !== 'review' && laneS) return refuse(`lane S has no ${NOUN[kind]}`);
  // ST-LN-94 D-10: a research ticket has no rounds of any kind; it ends in a record under accord/research/.
  if (laneTicket(snapshot, id)?.frontmatter?.lane === 'R') return refuse(`lane R has no ${kind === 'review' ? 'review rounds' : NOUN[kind]}`);
  const lane = isLaneM(snapshot, id);
  const file = FILE[kind];
  const rec = recordOf(workOf(snapshot, id), kind);

  const next = (round: number, cycle: number, cap: number): RoundAnswer => {
    const answer: RoundAnswer = { ...base, kind: 'next', cycle, round, cap, ...(kind === 'plan' && claimError !== undefined ? { reasons: [claimError] } : {}) };
    if (kind === 'review' && lane) {
      const m = fixModel(snapshot, id, round);
      if (m !== undefined && 'refused' in m) return refuse(m.refused);
      if (m !== undefined) {
        answer.model = m.model;
        answer.modelFor = round;
      }
    }
    if (kind === 'review' && pendingAddedCode(snapshot, id)) answer.addedCode = true;
    // ST-LN-91 D-12: round 1 under the new plan rules names its critic; under LEGACY_CAP nothing is added to the 0.4.0 output.
    if (kind === 'plan' && round === 1 && rules.fall) answer.checker = true;
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

  const k = rec.cycles.length;
  const cyc = rec.cycles[k - 1];
  const L = cyc.rounds.length;
  const all = allowancesOf(snapshot, id, kind);
  const st = cycleState(cyc, ofCycle(all, k - 1), kind, deferredFor(snapshot, id, kind, k - 1), rules);
  const stopOf = (q: number) =>
    kind !== 'review' ? planStopOf(cyc, ofCycle(all, k - 1), kind, deferredFor(snapshot, id, kind, k - 1), rules) : st.stopAt(q);
  // ST-LN-91 D-02: at the approach cap round 3 is a refusal, not a stop: no allowance lifts it and `## Closed` stays open to the owner's no.
  const capped = !rules.allowances && !rules.capStop;
  const unlisted = (): Pick<RoundAnswer, 'findings' | 'blocking'> => ({ findings: openFindings(cyc), blocking: blockingFindings(cyc) });
  // ST-LN-91 D-22: an ended capped loop (a verdict, a round with no findings, round 3 asked) still refuses the approval while a data-loss or
  // security finding is open; the owner's no with a Correction appends ## Closed and starts a new cycle.
  const blockedRefusal = (lead: string): RoundAnswer | undefined => {
    const left = unlisted();
    if (!capped || left.blocking!.length === 0) return undefined;
    const reason = `${lead}; a finding marked risk: data-loss or risk: security is still open, and it blocks the approval: the owner cannot say yes to this approach; the owner's no with a Correction appends ## Closed and starts a new cycle of ${st.cap} rounds`;
    return { ...refuseCap(reason), cycle: k, round: L, cap: st.cap, ...left };
  };
  const textsOf = (n: number) => ({ round: n, lines: cyc.rounds[n - 1].findings.map((f) => f.text) });
  const findingsFor = (s: number) => (L === s ? [textsOf(s)] : [textsOf(s), textsOf(L)]);
  const stop = (reasons: string[], s: number, extra: Partial<RoundAnswer> = {}): RoundAnswer => ({
    ...base,
    kind: 'stop',
    cycle: k,
    round: L,
    cap: st.cap,
    reasons: [...reasons, ...(claimError === undefined ? [] : [claimError])],
    findings: findingsFor(s),
    ...(lane ? { approach: approachOf(snapshot, id) } : {}),
    ...extra,
  });

  // A round run without being allowed: whatever verdict follows, a skipped stop stays visible.
  for (let p = 2; p <= L; p++) {
    if (st.allowed(p)) continue;
    const past = p > st.cap;
    if (capped && past) {
      const reason = `round ${p} of cycle ${k} ran past the cap of ${st.cap} approach critique rounds, which no Ruling raises`;
      return blockedRefusal(reason) ?? { ...refuseCap(reason), cycle: k, round: L, cap: st.cap, ...unlisted() };
    }
    const s = past ? p - 1 : (st.stopAt(p - 1) ?? p - 1);
    const why = past ? `past the cap of ${st.cap} rounds` : `after the stop at round ${s}`;
    return stop([`round ${p} of cycle ${k} ran without an owner Ruling allowing it: ${why}`], s, { allowAfter: p - 1 });
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
            : '; the loop has ended: accord-approach goes on to write ## Approach in full and ask the owner, and a round on another option follows a ## Closed line, which starts the next cycle';
      return { ...refuseCap(`${file} ends cycle ${k} with verdict: ${verdict.value} at line ${verdict.line}${tail}`), cycle: k, round: L, cap: st.cap };
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
    return { ...refuseCap(`round ${L} of cycle ${k} reported no findings and the cap of ${st.cap} rounds is reached; the loop has ended: write the verdict`), cycle: k, round: L, cap: st.cap };
  }
  if (capped) {
    // ST-LN-91 D-22: an open data-loss or security finding is no risk to approve with.
    const lead = `round ${p} of cycle ${k} is past the cap of ${st.cap} approach critique rounds, which no Ruling raises`;
    const blocked = blockedRefusal(lead);
    if (blocked !== undefined) return blocked;
    return {
      ...refuseCap(`${lead}; the loop has ended: write the findings still open into ## Approach as risks, and the owner decides at the approval`),
      cycle: k,
      round: L,
      cap: st.cap,
      ...unlisted(),
    };
  }
  const s = st.stopAt(L);
  if (s !== undefined) {
    // ST-LN-91 D-07: a stop below the first stop round is the count stop.
    const byCount = rules.fall && s < (rules.firstStop ?? Infinity);
    const deferred = deferredFor(snapshot, id, kind, k - 1);
    const reasons = [
      byCount
        ? `round ${s} of cycle ${k} reports ${roundCount(cyc.rounds[s - 1], deferred)} Must and Should, not fewer than the ${roundCount(cyc.rounds[s - 2], deferred)} of round ${s - 1}: the count did not fall, so the loop stops`
        : `round ${s} of cycle ${k} still reports a Should or a Must, and from round 3 such a round stops the loop`,
    ];
    if (L >= st.cap) reasons.push(`the cap of ${st.cap} rounds in cycle ${k} is reached`);
    const m = kind === 'review' && lane && L < st.cap ? fixModel(snapshot, id, L) : undefined;
    return stop(reasons, s, m !== undefined && 'model' in m ? { model: m.model, modelFor: L } : {});
  }
  return stop([`the cap of ${st.cap} rounds in cycle ${k} is reached and no owner Ruling in the ledger allows more`], L);
}

/** The text `accord round` prints. */
export function roundText(answer: RoundAnswer): string {
  if (answer.kind === 'next') {
    return (
      `Round: ${answer.round} of ${answer.cap}\nCycle: ${answer.cycle}\n` +
      (answer.checker === true ? 'Critics: plan checker\n' : '') +
      (answer.addedCode === true ? `Added code: head round ${answer.round} as ## Round ${answer.round} head <sha> (added code round 1)\n` : '') +
      (answer.model === undefined ? '' : `Fix executor model: ${answer.model}\n`) +
      answer.reasons.map((r) => `Note: ${r}\n`).join('')
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
    return out.join('');
  }
  const file = FILE[answer.record];
  const noun = NOUN[answer.record];
  const out = ['stop: report to owner'];
  for (const r of answer.reasons) out.push(`Reason: ${r}`);
  for (const f of answer.findings ?? []) out.push(`Findings of round ${f.round}:`, ...f.lines);
  if (answer.approach !== undefined) out.push('Approach:', ...answer.approach);
  out.push(
    answer.laneS
      ? 'Ask the owner whether to change course: in lane S the change of course is the lift to lane M (lane-s.md).'
      : answer.record === 'approach'
        ? "Ask the owner whether to change course: weigh the other options of the planner's direction report against going on."
        : 'Ask the owner whether to change course: weigh the options the Approach above rejected or held in reserve against going on.',
    `To accept the open findings: end ${file} with the line verdict: accepted-by-owner "<the owner's sentence>"`,
    `To allow more rounds: add under ## Rulings in the ledger: Ruling: the owner allows <n> more ${noun} rounds after round ${answer.allowAfter ?? answer.round} of cycle ${answer.cycle} — "<the owner's sentence>" — <cost if wrong>`,
  );
  if (!answer.laneS && answer.record === 'approach') {
    out.push('To change course: write that Ruling with <n> the rounds the owner gives the other option, then write that option into ## Approach and critique it through accord-approach');
  } else if (!answer.laneS) {
    out.push(`To change course: write that Ruling with <n> the rounds the owner gives the reworked ${answer.record === 'review' ? 'code' : 'plan'}, then re-plan through accord-plan`);
  }
  if (answer.model !== undefined) {
    out.push(`Fix executor model for round ${answer.modelFor}'s findings, if the owner allows more rounds: ${answer.model}`);
  }
  return out.join('\n') + '\n';
}
