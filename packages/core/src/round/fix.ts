// ST-LN-56 D-08, D-10, D-16, D-17: the fix record of a review. A finding of a version 2 review record whose state is `fixed in <sha>` carries
// `checked: <place>, <place>…` (each place `<path>` or `<path>:<line>`, at least one), and the re-review's answer on the fixed finding's own line, `addressed: <path>:<line>` or
// `not addressed: <path>:<line>`: from the FIX_RECORD_FROM cut-off, in lane M and lane S alike. ONE rule (fixProblems) that `accord round` reads whole and gate.fix-places-missing and
// gate.fix-not-addressed read by kind. Pure: the host supplies the claim pin it read from git. No code runs at load but constants.
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

/** One way the fix record is wrong: `rule` says which gate row names it (`places`: gate.fix-places-missing, `answer`: gate.fix-not-addressed). */
export interface FixProblem { line: number; reason: string; rule: 'places' | 'answer' }

/**
 * The fix record rules, as problems in record line order, for each finding written `fixed in <sha>` (every severity and class: lane S lines have no class, and the grammar does not store it):
 * - places: no `checked:` mark (D-08);
 * - answer: a round another round of its cycle followed must carry exactly one of `addressed:` and `not addressed:` on the fixed finding (D-10), a `not addressed:` finding is carried by the
 *   next round (`carried from <r>.<n>`), and an answer sits only on a fixed finding;
 * - answer, with `o.verdict`: no fixed finding in the record's last round, which no re-review has answered yet (D-17), whatever marks it carries.
 * `accord round` asks without `verdict` (the last round's fixes are the ones the round it is about to start re-reviews); gate done asks with it. None when the rules do not apply to this ticket.
 */
export function fixProblems(snapshot: RepoSnapshot, id: string, o: { verdict?: boolean } = {}): FixProblem[] {
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined || !fixOn(snapshot, id)) return [];
  const out: FixProblem[] = [];
  const add = (line: number, rule: FixProblem['rule'], reason: string): number => out.push({ line, rule, reason: withNote(snapshot, id, reason) });
  const placed = placedRounds(rec);
  const lastRound = placed[placed.length - 1]?.round;
  for (const at of placed) {
    const where = `round ${at.p} of cycle ${at.cycle}`;
    const followedBy = rec.cycles[at.cycle - 1].rounds[at.p]; // the next round of the same cycle
    for (const f of at.round.findings) {
      const which = `finding ${f.n ?? 'at line ' + f.line}`;
      const answered = f.addressed !== undefined || f.notAddressed !== undefined;
      if (f.state !== 'fixed') {
        if (answered) add(f.line, 'answer', `${where}, ${which} carries an addressed: or not addressed: mark and is not fixed in a commit: the re-review answers a fix only`);
        continue;
      }
      if (f.checked === undefined) {
        add(
          f.line,
          'places',
          `${where}, ${which} is fixed in a commit with no checked: mark listing every place the same claim or pattern was checked (checked: <path>[:<line>], <path>[:<line>]…, D-08)`,
        );
      }
      if (f.addressed !== undefined && f.notAddressed !== undefined) {
        add(f.line, 'answer', `${where}, ${which} is marked both addressed: and not addressed:: the re-review gives one answer`);
      } else if (followedBy !== undefined && !answered) {
        add(
          f.line,
          'answer',
          `${where}, ${which} is fixed in a commit and round ${at.p + 1} followed with no addressed: or not addressed: mark on it: the re-review's answer is recorded on the fixed finding's own line ` +
            '(addressed: <path>:<line> or not addressed: <path>:<line>, D-10, D-17)',
        );
      } else if (followedBy !== undefined && f.notAddressed !== undefined && !followedBy.findings.some((x) => x.carried?.round === at.p && x.carried.n === f.n)) {
        add(
          f.line,
          'answer',
          `${where}, ${which} is marked not addressed: and round ${at.p + 1} holds no finding "carried from ${at.p}.${f.n ?? '<n>'}": the next round carries a finding that was not addressed (D-10)`,
        );
      }
      if (o.verdict === true && at.round === lastRound) {
        add(
          f.line,
          'answer',
          `${where}, ${which} is fixed in a commit after the last review round: every fix round gets a re-review that answers it before the verdict (D-17)`,
        );
      }
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

/** gate.fix-places-missing: a fixed finding of review.md with no checked: mark, from FIX_RECORD_FROM, in lane M and lane S. */
export const fixPlacesMissing: GateRule['check'] = (snapshot, id) => {
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined) return [];
  return fixProblems(snapshot, id)
    .filter((p) => p.rule === 'places')
    .map((p) => ({ file: rec.file, line: p.line, reason: p.reason }));
};

/** gate.fix-not-addressed: a fix no re-review answered with `addressed:`, a `not addressed:` finding nothing carried, a misplaced answer, or the last round's fix, from FIX_RECORD_FROM, in lane M and lane S. */
export const fixNotAddressed: GateRule['check'] = (snapshot, id) => {
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined) return [];
  return fixProblems(snapshot, id, { verdict: true })
    .filter((p) => p.rule === 'answer')
    .map((p) => ({ file: rec.file, line: p.line, reason: p.reason }));
};
