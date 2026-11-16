// ST-LN-56 D-08, D-16: a review fix is recorded with the places the same claim or pattern was checked. A finding of a version 2 review record whose state is `fixed in <sha>` carries
// `checked: <place>, <place>…` (each place `<path>` or `<path>:<line>`, at least one), from the FIX_RECORD_FROM cut-off, in lane M and lane S alike; ONE rule, which gate.fix-places-missing
// reads (plan 04-08 adds `accord round`). Pure: the host supplies the claim pin it read from git. No code runs at load but constants.
import { laneTicket, workOf } from '../gate/work.js';
import type { GateRule } from '../gate/rules.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { FIX_RECORD_FROM, claimPinBefore, claimPinError } from './pin.js';
import { placedRounds, skipped } from './scope.js';

/**
 * True when the fix record rules apply to the ticket: a lane ticket with a version 2 review record, not skipped (D-10: HEAD on the default branch, or the ticket done in the default ref's
 * records), whose claim pin is not before FIX_RECORD_FROM. A failed claim read is not before it (claimPinBefore fails closed), so the rules apply and the answer carries the git error.
 */
export function fixOn(snapshot: RepoSnapshot, id: string): boolean {
  const rec = workOf(snapshot, id)?.rounds;
  if (laneTicket(snapshot, id) === undefined || rec === undefined || rec.version !== 2 || skipped(snapshot, id)) return false;
  return !claimPinBefore(snapshot, id, FIX_RECORD_FROM);
}

/** The sentence added to every problem when git failed reading the claim pin of `id`: the git error, and that the fix record rules apply because of it. */
const withNote = (snapshot: RepoSnapshot, id: string, reason: string): string => {
  const error = claimPinError(snapshot, id);
  return error === undefined ? reason : `${reason}; ${error}; the claim pin could not be read, so the fix record rules apply`;
};

/**
 * The places rule, as problems in record line order: each finding written `fixed in <sha>` with no `checked:` mark. Every severity and class is asked (lane S lines have no class, and the
 * grammar does not store it). None when the rules do not apply to this ticket.
 */
export function fixProblems(snapshot: RepoSnapshot, id: string): { line: number; reason: string }[] {
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined || !fixOn(snapshot, id)) return [];
  const out: { line: number; reason: string }[] = [];
  for (const at of placedRounds(rec)) {
    for (const f of at.round.findings) {
      if (f.state !== 'fixed' || f.checked !== undefined) continue;
      out.push({
        line: f.line,
        reason: withNote(
          snapshot,
          id,
          `round ${at.p} of cycle ${at.cycle}, finding ${f.n ?? 'at line ' + f.line} is fixed in a commit with no checked: mark listing every place the same claim or pattern was checked ` +
            '(checked: <path>[:<line>], <path>[:<line>]…, D-08)',
        ),
      });
    }
  }
  return out;
}

/** gate.fix-places-missing: a fixed finding of review.md with no checked: mark, from FIX_RECORD_FROM, in lane M and lane S. */
export const fixPlacesMissing: GateRule['check'] = (snapshot, id) => {
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined) return [];
  return fixProblems(snapshot, id).map((p) => ({ file: rec.file, line: p.line, reason: p.reason }));
};
