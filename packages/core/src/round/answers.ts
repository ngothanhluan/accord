// Phase 10 D-14, D-15: the answers that close a finding without a fix. The planner's `does not hold: <path>:<line>` at approach and plan (D-14) closes a finding when that place exists in the working tree. None of the answers
// ever closes a finding marked data-loss or security (own mark or inherited as `classify` reads it): such a finding waits for the owner. Each answer is read from its cut-off through claimPinBefore; a ticket claimed earlier reads
// the segment as the open finding it was (10-ac-11). Pure: the host supplies the place facts (`places`), the ledger and the claim pin come with the snapshot.
import { workOf } from '../gate/work.js';
import type { RepoSnapshot, RoundCycle, RoundFinding, RoundRecord } from '../model/snapshot.js';
import type { RoundKind } from './next.js';
import { DOES_NOT_HOLD_FROM, claimPinBefore } from './pin.js';

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

/** The findings of one cycle (0-based) that an answer of this file closes without a fix: they leave every count and stop, as the deferred ones do (deferredFor) and are not listed as open. */
export const answersClosed = (snapshot: RepoSnapshot, id: string, kind: RoundKind, cycle: number): ReadonlySet<RoundFinding> => notHeldClosed(snapshot, id, kind, cycle);

/** Every answer problem of the record (`accord round` and the gates refuse on each), in line order. */
export const answerProblems = (snapshot: RepoSnapshot, id: string, kind: RoundKind): AnswerProblem[] => notHeldProblems(snapshot, id, kind).sort((a, b) => a.line - b.line);
