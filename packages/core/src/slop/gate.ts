// Phase 8.1 D-15, D-17, 8.1-ac-13, 8.1-ac-14: `accord gate done` refuses a slop hit of the ticket's cumulative diff that is neither fixed (gone from the diff the host read) nor justified (named exactly
// by a `slop:<kind> <path>:<line> — <reason>` line in the last `## Round` of review.md), and fails closed: a team pattern that is not in force, or slop facts the host could not read, is a finding too,
// never a silent pass. Pure: the host supplies the hits (slopFacts, the list `accord review-package` prints under `## Slop`) and the record parse supplies the lines (review.slopJustified).
// A ticket claimed before SLOP_FROM is not judged.
import { laneTicket, workOf } from '../gate/work.js';
import type { GateRule } from '../gate/rules.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { SLOP_FROM, claimPinBefore } from '../round/pin.js';
import { skipped } from '../round/scope.js';
import { SLOP_FILE, slopSpec } from './spec.js';

/** Control and invisible characters of a path or an error from the host are written as `<U+XXXX>`, so a file name cannot reshape the line a reader is told to write. */
const visible = (text: string): string => text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, (ch) => '<U+' + (ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0') + '>');

/**
 * True when the slop rule applies to the ticket: a lane ticket with a version 2 review record that holds a round, not skipped (HEAD on the default branch, or the ticket done in the default
 * ref's records, as every review scope rule), whose claim pin is not before SLOP_FROM. A failed claim read is not before it (claimPinBefore fails closed), so the rule applies.
 */
export function slopOn(snapshot: RepoSnapshot, id: string): boolean {
  const rec = workOf(snapshot, id)?.rounds;
  if (laneTicket(snapshot, id) === undefined || rec === undefined || rec.version !== 2 || rec.cycles.every((c) => c.rounds.length === 0) || skipped(snapshot, id)) return false;
  return !claimPinBefore(snapshot, id, SLOP_FROM);
}

/**
 * gate.slop-unresolved. D-15, 8.1-ac-14: a team pattern line that is not in force (it does not compile, or the guard refuses it as slow, or it does not read) comes first, one finding per line, before
 * any hit is judged, because the hits were computed without that pattern; it is returned even when the host supplied no fact. Facts that could not be read are one finding quoting the error.
 * D-17, 8.1-ac-13: otherwise one finding per slop hit the last review round does not name, each with the exact line to write.
 */
export const slopUnresolved: GateRule['check'] = (snapshot, id) => {
  if (!slopOn(snapshot, id)) return [];
  const inactive = slopSpec(snapshot).problems.filter((p) => p.pattern === true);
  if (inactive.length > 0) {
    return inactive.map((p) => ({
      file: SLOP_FILE,
      line: p.line,
      reason: visible(`${SLOP_FILE}:${p.line}: ${p.reason}`) + '; the pattern is not in force, so the slop hits cannot be trusted: fix the line, then run accord lint',
    }));
  }
  const review = workOf(snapshot, id)?.review;
  const file = review?.file ?? `accord/tickets/${id}/review.md`;
  const fact = Object.hasOwn(snapshot.slopFacts ?? {}, id) ? snapshot.slopFacts![id] : undefined;
  if (fact === undefined) return [];
  if ('error' in fact) return [{ file, reason: `the slop hits of the ticket's diff cannot be read: ${visible(fact.error)}; fix that, then run accord gate done again` }];
  const named = review?.slopJustified ?? [];
  return fact.hits
    .filter((h) => !named.some((n) => n.kind === h.kind && n.path === h.path && n.line === h.line))
    .map((h) => {
      const hit = visible(`slop:${h.kind} ${h.path}:${h.line}`);
      return { file, reason: `${hit} is neither fixed nor justified; write "${hit} — <reason>" in the last ## Round of review.md (the path and line are those of the ticket's final diff, and the reason says why the code is right, in words), or fix it` };
    });
};
