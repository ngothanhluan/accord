// Phase 10 D-14, D-15: the answers that close a finding without a fix. The planner's `does not hold: <path>:<line>` at approach and plan (D-14) closes a finding when that place exists in the working tree; `accepted risk: <why>` (D-15) when the
// ledger holds its Ruling; a review finding `ambiguous ac-<n>: built "<reading>"` (D-15 (a)) becomes a warning. None of the answers
// ever closes a finding marked data-loss or security (own mark or inherited as `classify` reads it): such a finding waits for the owner. Each answer is read from its cut-off through claimPinBefore; a ticket claimed earlier reads
// the segment as the open finding it was (10-ac-11). Pure: the host supplies the place facts (`places`), the ledger and the claim pin come with the snapshot.
import { workOf } from '../gate/work.js';
import type { RepoSnapshot, RoundCycle, RoundFinding, RoundRecord } from '../model/snapshot.js';
import type { RoundKind } from './next.js';
import { ACCEPTED_RISK_FROM, AMBIGUOUS_FROM, DOES_NOT_HOLD_FROM, claimPinBefore } from './pin.js';

/** One way a record's answer is wrong: the line it is about and what to do. */
export interface AnswerProblem {
  line: number;
  reason: string;
}

/** The key of the host's `places` fact: `<path>:<line>`, as the record writes the place. */
export const placeKey = (file: string, line: number): string => `${file}:${line}`;

/**
 * ST-LN-91 D-22, RR-CR-01: the findings of the cycle that are marked `risk: data-loss` or `risk: security`: the finding's own mark, a `carried from` / `repeats` finding whose source is risk-marked, and a finding a risk-marked
 * finding was `repeated as`, to any depth. A risk never drops out of a chain of repeats whose later line has no mark; the answers of this file never close one.
 */
export function riskSet(cycle: RoundCycle): Set<RoundFinding> {
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
  return risk;
}

const recordOf = (snapshot: RepoSnapshot, id: string, kind: RoundKind): RoundRecord | undefined => {
  const work = workOf(snapshot, id);
  return kind === 'review' ? work?.rounds : kind === 'plan' ? work?.planRounds : work?.approachRounds;
};

/** True when the place `file:line` is known to exist in the working tree, from the host's place fact; a place with no entry is not known to. */
function placeExists(snapshot: RepoSnapshot, id: string, file: string, line: number): boolean | undefined {
  const facts = Object.hasOwn(snapshot.places ?? {}, id) ? snapshot.places![id] : undefined;
  const key = placeKey(file, line);
  return facts !== undefined && Object.hasOwn(facts, key) ? facts[key] : undefined;
}

/** The `<round>.<n>` of finding `f` of round `p` of cycle `c` (0-based), with ` cycle <k>` from the second cycle on. */
const nameOf = (c: number, p: number, f: RoundFinding): string => `${p}.${f.n ?? '?'}${c >= 1 ? ` of cycle ${c + 1}` : ''}`;

/**
 * Phase 10 D-14, 10-ac-21: the findings of one cycle (0-based) of an approach or plan record that the planner answered `does not hold: <path>:<line>` with a place that exists in the working tree: they are closed, leave every count and
 * every stop, and are not listed as open. A finding marked data-loss or security (own or inherited) is never in it. Empty before DOES_NOT_HOLD_FROM and for a review record.
 */
export function notHeldClosed(snapshot: RepoSnapshot, id: string, kind: RoundKind, cycle: number): ReadonlySet<RoundFinding> {
  const out = new Set<RoundFinding>();
  const rec = kind === 'review' ? undefined : recordOf(snapshot, id, kind);
  const cyc = rec?.cycles[cycle];
  if (cyc === undefined || claimPinBefore(snapshot, id, DOES_NOT_HOLD_FROM)) return out;
  const risk = riskSet(cyc);
  for (const r of cyc.rounds) {
    for (const f of r.findings) if (f.state === 'notHeld' && f.notHeld !== undefined && !risk.has(f) && placeExists(snapshot, id, f.notHeld.file, f.notHeld.line) === true) out.add(f);
  }
  return out;
}

/**
 * Phase 10 D-14, 10-ac-21: each `does not hold` answer of the approach or plan record that accord refuses, in line order: one that names no readable place (`<path>:<line>`), and one whose place the host found missing from the working
 * tree. None before DOES_NOT_HOLD_FROM, where the segment is an open finding as it was at b4477211 (10-ac-11).
 */
export function notHeldProblems(snapshot: RepoSnapshot, id: string, kind: RoundKind): AnswerProblem[] {
  const rec = kind === 'review' ? undefined : recordOf(snapshot, id, kind);
  if (rec === undefined || claimPinBefore(snapshot, id, DOES_NOT_HOLD_FROM)) return [];
  const out: AnswerProblem[] = [];
  rec.cycles.forEach((cycle, c) => {
    cycle.rounds.forEach((round, i) => {
      for (const f of round.findings) {
        if (f.state !== 'notHeld') continue;
        const name = `finding ${nameOf(c, i + 1, f)}`;
        if (f.notHeld === undefined) {
          out.push({ line: f.line, reason: `${name} answers does not hold with no place accord can read: write it as does not hold: <path>:<line>, a path inside the working tree and the line the finding is wrong about: "${f.text}"` });
        } else if (placeExists(snapshot, id, f.notHeld.file, f.notHeld.line) === false) {
          out.push({
            line: f.line,
            reason: `${name} answers does not hold: ${placeKey(f.notHeld.file, f.notHeld.line)}, and that place does not exist in the working tree (a relative path inside it with no .., no link, a regular file with at least ${f.notHeld.line} lines): "${f.text}"`,
          });
        }
      }
    });
  });
  return out;
}

/**
 * Phase 10 D-14: the `<round>.<n>` of each finding of the cycle (0-based) the planner answered `does not hold` that is marked data-loss or security (own or inherited) and still open: the answer never closes it, so it waits for the owner,
 * whose `owner: "<words>"` closes it as it does any risk finding. Empty before DOES_NOT_HOLD_FROM.
 */
export function notHeldWaiting(snapshot: RepoSnapshot, id: string, kind: RoundKind, cycle: number): string[] {
  const rec = kind === 'review' ? undefined : recordOf(snapshot, id, kind);
  const cyc = rec?.cycles[cycle];
  if (cyc === undefined || claimPinBefore(snapshot, id, DOES_NOT_HOLD_FROM)) return [];
  const risk = riskSet(cyc);
  return cyc.rounds.flatMap((r, i) => r.findings.filter((f) => f.state === 'notHeld' && risk.has(f)).map((f) => `${i + 1}.${f.n ?? '?'}`));
}

// Phase 10 D-15: `Ruling: accepted risk — <approach|plan|review> <r>.<n>[ cycle <k>]: <why> — <failing case>`, read from the ledger's rulings; no cycle part is cycle 1.
const ACCEPTED_RULING = /^Ruling: accepted risk — (approach|plan|review) ([1-9][0-9]*)\.([1-9][0-9]*)(?: cycle ([1-9][0-9]*))?: (\S.*?) — (\S.*)$/;

/** True when the ledger holds the Ruling for finding `p`.`n` of cycle `cycle` (1-based) of the record `kind`. */
function hasRuling(snapshot: RepoSnapshot, id: string, kind: RoundKind, p: number, n: number, cycle: number): boolean {
  return (workOf(snapshot, id)?.ledger?.rulings ?? []).some((ruling) => {
    const m = ACCEPTED_RULING.exec(ruling);
    return m !== null && m[1] === kind && Number(m[2]) === p && Number(m[3]) === n && (m[4] === undefined ? 1 : Number(m[4])) === cycle;
  });
}

/** One accepted risk that is closed: the finding, where it sits (round `p`, number `n`, cycle `cycle`, 1-based) and its reason. */
export interface Accepted {
  f: RoundFinding;
  record: RoundKind;
  p: number;
  n: number;
  cycle: number;
  why: string;
}

/**
 * Phase 10 D-15, 10-ac-29: the findings of one cycle (0-based) of the record `kind` that are answered `accepted risk: <why>`, whose ledger Ruling exists and that carry no data-loss or security mark (own or inherited): they are closed.
 * Empty before ACCEPTED_RISK_FROM.
 */
export function acceptedOf(snapshot: RepoSnapshot, id: string, kind: RoundKind, cycle: number): Accepted[] {
  const cyc = recordOf(snapshot, id, kind)?.cycles[cycle];
  if (cyc === undefined || claimPinBefore(snapshot, id, ACCEPTED_RISK_FROM)) return [];
  const risk = riskSet(cyc);
  const out: Accepted[] = [];
  cyc.rounds.forEach((round, i) => {
    for (const f of round.findings) {
      if (f.state === 'accepted' && f.why !== undefined && f.n !== undefined && !risk.has(f) && hasRuling(snapshot, id, kind, i + 1, f.n, cycle + 1)) {
        out.push({ f, record: kind, p: i + 1, n: f.n, cycle: cycle + 1, why: f.why });
      }
    }
  });
  return out;
}

/** `<record> <r>.<n>[ cycle <k>]: <why>` of each closed accepted risk of the last cycle of the ticket's approach, plan and review records: the `accepted:` lines of every `accord round` answer, for the verify report. */
export function acceptedLines(snapshot: RepoSnapshot, id: string): string[] {
  return (['approach', 'plan', 'review'] as const).flatMap((kind) => {
    const rec = recordOf(snapshot, id, kind);
    return rec === undefined ? [] : acceptedOf(snapshot, id, kind, rec.cycles.length - 1).map((a) => `${kind} ${a.p}.${a.n}${a.cycle >= 2 ? ` cycle ${a.cycle}` : ''}: ${a.why}`);
  });
}

/** True when `f` rests on a Decision (`rests on: D-<nn>`), which settles the reading of its criterion. */
const restsOnDecision = (f: RoundFinding): boolean => f.restsOn?.kind === 'decision' || (f.restsOnAlso ?? []).some((r) => r.kind === 'decision');

/**
 * Phase 10 D-15 (a), 10-ac-31: the findings of one cycle (0-based) of the review record that are answered `ambiguous ac-<n>: built "<reading>"`, carry no data-loss or security mark (own or inherited) and rest on no Decision: each opens no
 * fix round and is no open finding. Empty before AMBIGUOUS_FROM.
 */
function ambiguousOf(snapshot: RepoSnapshot, id: string, cycle: number): { f: RoundFinding; p: number }[] {
  const cyc = recordOf(snapshot, id, 'review')?.cycles[cycle];
  if (cyc === undefined || claimPinBefore(snapshot, id, AMBIGUOUS_FROM)) return [];
  const risk = riskSet(cyc);
  return cyc.rounds.flatMap((round, i) => round.findings.filter((f) => f.state === 'ambiguous' && f.ambiguous !== undefined && !risk.has(f) && !restsOnDecision(f)).map((f) => ({ f, p: i + 1 })));
}

/** `<r>.<n> ambiguous ac-<n>, built "<reading>"` of each ambiguous-criterion finding of the review record's cycle (0-based) that is closed: the `warn:` lines for the verify report, which never block. */
export function ambiguousWarns(snapshot: RepoSnapshot, id: string, cycle: number): string[] {
  return ambiguousOf(snapshot, id, cycle).map(({ f, p }) => `${p}.${f.n ?? '?'} ambiguous ac-${f.ambiguous!.ac}, built "${f.ambiguous!.reading}"`);
}

/** The findings of one cycle (0-based) that an answer of this file closes without a fix: they leave every count and stop, as the deferred ones do (deferredFor) and are not listed as open. */
export const answersClosed = (snapshot: RepoSnapshot, id: string, kind: RoundKind, cycle: number): ReadonlySet<RoundFinding> =>
  new Set([
    ...notHeldClosed(snapshot, id, kind, cycle),
    ...acceptedOf(snapshot, id, kind, cycle).map((a) => a.f),
    ...(kind === 'review' ? ambiguousOf(snapshot, id, cycle).map((a) => a.f) : []),
  ]);

const RISK_NEVER = 'is marked risk: data-loss or risk: security, or carries a finding that is';

/**
 * Phase 10 D-15, 10-ac-29, 10-ac-31, T-10-09, T-10-10: each `accepted risk` and `ambiguous` answer of the record that accord refuses, in line order. An accepted risk with no reason, with no ledger Ruling, or on a finding marked data-loss or
 * security (own or inherited); an ambiguous answer on such a finding or on one that rests on a Decision. None before the answer's cut-off, where it is an open finding (approach, plan) or a line accord cannot read (review).
 */
function acceptedProblems(snapshot: RepoSnapshot, id: string, kind: RoundKind): AnswerProblem[] {
  const rec = recordOf(snapshot, id, kind);
  const acceptedOn = !claimPinBefore(snapshot, id, ACCEPTED_RISK_FROM);
  const ambiguousOn = kind === 'review' && !claimPinBefore(snapshot, id, AMBIGUOUS_FROM);
  if (rec === undefined || (!acceptedOn && !ambiguousOn)) return [];
  const out: AnswerProblem[] = [];
  rec.cycles.forEach((cycle, c) => {
    const risk = riskSet(cycle);
    cycle.rounds.forEach((round, i) => {
      for (const f of round.findings) {
        const name = `finding ${nameOf(c, i + 1, f)}`;
        if (acceptedOn && f.state === 'accepted') {
          if (f.why === undefined) {
            out.push({ line: f.line, reason: `${name} answers accepted risk with no reason: write it as accepted risk: <why>: "${f.text}"` });
          } else if (risk.has(f)) {
            out.push({ line: f.line, reason: `${name} ${RISK_NEVER}: an accepted risk is never taken for a data-loss or security finding; fix it, or the owner decides it: "${f.text}"` });
          } else if (f.n !== undefined && !hasRuling(snapshot, id, kind, i + 1, f.n, c + 1)) {
            const at = `${i + 1}.${f.n}${c >= 1 ? ` cycle ${c + 1}` : ''}`;
            out.push({ line: f.line, reason: `${name} answers accepted risk: ${f.why}, and the ledger holds no Ruling for it: add under ## Rulings in the ledger: Ruling: accepted risk — ${kind} ${at}: <why> — <failing case>` });
          }
        } else if (ambiguousOn && f.state === 'ambiguous') {
          if (risk.has(f)) {
            out.push({ line: f.line, reason: `${name} ${RISK_NEVER}: an ambiguous-criterion answer is never taken for a data-loss or security finding; fix it, or the owner decides it: "${f.text}"` });
          } else if (restsOnDecision(f)) {
            out.push({ line: f.line, reason: `${name} rests on ${f.restsOn?.kind === 'decision' ? f.restsOn.ref : 'a Decision'}: a Decision settles the reading, so the criterion is not ambiguous; fix the finding or write it deferred: "${f.text}"` });
          }
        }
      }
    });
  });
  return out;
}

/** Every answer problem of the record (`accord round` and the gates refuse on each), in line order. */
export const answerProblems = (snapshot: RepoSnapshot, id: string, kind: RoundKind): AnswerProblem[] =>
  [...notHeldProblems(snapshot, id, kind), ...acceptedProblems(snapshot, id, kind)].sort((a, b) => a.line - b.line);
