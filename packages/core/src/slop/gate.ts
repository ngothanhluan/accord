// Phase 8.1 D-17, 8.1-ac-13: `accord gate done` refuses a slop hit of the ticket's cumulative diff that is neither fixed (gone from the diff the host read) nor justified (named exactly by a
// `slop:<kind> <path>:<line> — <reason>` line in the last `## Round` of review.md). Pure: the host supplies the hits (slopFacts, the list `accord review-package` prints under `## Slop`)
// and the record parse supplies the lines (review.slopJustified). A ticket claimed before SLOP_FROM is not judged.
import { laneTicket, workOf } from '../gate/work.js';
import type { GateRule } from '../gate/rules.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { SLOP_FROM, claimPinBefore } from '../round/pin.js';
import { skipped } from '../round/scope.js';

/** Control and invisible characters of a path from the branch are written as `<U+XXXX>`, so a file name cannot reshape the line a reader is told to write. */
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

/** gate.slop-unresolved: one finding per slop hit the last review round does not name, each with the exact line to write. */
export const slopUnresolved: GateRule['check'] = (snapshot, id) => {
  if (!slopOn(snapshot, id)) return [];
  const fact = Object.hasOwn(snapshot.slopFacts ?? {}, id) ? snapshot.slopFacts![id] : undefined;
  if (fact === undefined || 'error' in fact) return [];
  const review = workOf(snapshot, id)?.review;
  const file = review?.file ?? `accord/tickets/${id}/review.md`;
  const named = review?.slopJustified ?? [];
  return fact.hits
    .filter((h) => !named.some((n) => n.kind === h.kind && n.path === h.path && n.line === h.line))
    .map((h) => {
      const hit = visible(`slop:${h.kind} ${h.path}:${h.line}`);
      return { file, reason: `${hit} is neither fixed nor justified; write "${hit} — <reason>" in the last ## Round of review.md, or fix it` };
    });
};
