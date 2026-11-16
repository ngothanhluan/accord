// ST-LN-56 D-08, D-10, D-16, D-17: the fix record of a review. A finding of a version 2 review record whose state is `fixed in <sha>` carries
// `checked: <place>, <place>…` (each place `<path>` or `<path>:<line>`, at least one), and the re-review's answer on the fixed finding's own line, `addressed: <path>:<line>` or
// `not addressed: <path>:<line>`: from the FIX_RECORD_FROM cut-off, in lane M and lane S alike. ONE rule (fixProblems) that `accord round` reads whole and gate.fix-places-missing and
// gate.fix-not-addressed read by kind. Pure: the host supplies the claim pin it read from git. No code runs at load but constants.
import { laneTicket, workOf } from '../gate/work.js';
import type { GateRule } from '../gate/rules.js';
import type { RepoSnapshot, RoundFinding } from '../model/snapshot.js';
import { hasLine, reReviewedFixFiles } from './evidence.js';
import { FIX_RECORD_FROM, claimPinBefore, claimPinError } from './pin.js';
import { factsOf, placedRounds, skipped } from './scope.js';
import type { Placed } from './scope.js';

/**
 * True when the fix record rules apply to the ticket: a lane ticket with a version 2 review record, not skipped (D-10: HEAD on the default branch, or the ticket done in the default ref's
 * records), whose claim pin is not before FIX_RECORD_FROM. A failed claim read is not before it (claimPinBefore fails closed), so the rules apply and the answer carries the git error.
 */
export function fixOn(snapshot: RepoSnapshot, id: string): boolean {
  const rec = workOf(snapshot, id)?.rounds;
  if (laneTicket(snapshot, id) === undefined || rec === undefined || rec.version !== 2 || skipped(snapshot, id)) return false;
  return !claimPinBefore(snapshot, id, FIX_RECORD_FROM);
}

/**
 * D-10: true when `f`, a finding of the round `at`, is a re-review finding outside the fix diff, and so goes to Deferred: the fix record rules apply (fixOn), the round is not the first of its
 * cycle, not headed `(added code round 1)` and not `(final review)` (those read more than a fix diff), `f` is a Must or Should that is not carried and has no `risk:` mark (a risk finding
 * blocks in every round and is never deferred, Phase 2 D-12), and it is located nowhere (`none`) or in a file the previous round's fix did not change.
 */
export function fixOutside(snapshot: RepoSnapshot, id: string, at: Placed, f: RoundFinding): boolean {
  return fixOn(snapshot, id) && outsideOf(snapshot, id, at, f);
}

/** fixOutside without the fixOn check, for a caller that has made it once. */
function outsideOf(snapshot: RepoSnapshot, id: string, at: Placed, f: RoundFinding): boolean {
  const facts = factsOf(snapshot, id);
  if (facts === undefined || 'error' in facts) return false;
  if (at.p < 2 || at.round.added === true || at.round.final === true) return false;
  if (f.severity === 'Nice' || f.carried !== undefined || f.risk !== undefined) return false;
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined) return false;
  // the fix diff the round re-reviews: an (added code round 1) round in between reviews merged code and does not replace it
  return f.file === undefined || !reReviewedFixFiles(id, placedRounds(rec), facts.ranges, at.j).has(f.file);
}

/** True when the outside-diff finding `f` of round `at` is written deferred with its `- review <r>.<n>[ cycle <k>]` line under ## Deferred in the ledger. */
const deferredWithLine = (snapshot: RepoSnapshot, id: string, at: Placed, f: RoundFinding): boolean => f.state === 'deferred' && hasLine(snapshot, id, at.p, f.n, at.cycle);

/** The sentence added to every problem when git failed reading the claim pin of `id`: the git error, and that the fix record rules apply because of it. */
const withNote = (snapshot: RepoSnapshot, id: string, reason: string): string => {
  const error = claimPinError(snapshot, id);
  return error === undefined ? reason : `${reason}; ${error}; the claim pin could not be read, so the fix record rules apply`;
};

const RANK: Record<RoundFinding['severity'], number> = { Nice: 0, Should: 1, Must: 2 };

/**
 * True when `round` (round 1 of the next cycle) reports the NOT ADDRESSED finding `f` again: a finding at least as severe, located in `f`'s file or in the file its
 * `not addressed:` answer names. `carried from` names a round of the same cycle only, so across a cycle the file and the severity are the match.
 */
const reportedAgain = (round: { findings: readonly RoundFinding[] }, f: RoundFinding): boolean =>
  round.findings.some((x) => RANK[x.severity] >= Math.max(RANK[f.severity], 1) && x.file !== undefined && (x.file === f.file || x.file === f.notAddressed?.file));

/** One way the fix record is wrong: `rule` says which gate row names it (`places`: gate.fix-places-missing, `answer`: gate.fix-not-addressed, `outside`: gate.fix-outside-open). */
export interface FixProblem {
  line: number;
  reason: string;
  rule: 'places' | 'answer' | 'outside';
  /** Set on the problems only the verdict form adds: the fix (`<r>.<n>`, ` cycle <k>` from cycle 2) whose re-review round has not run yet. `accord round` lists these and refuses none of them. */
  awaiting?: string;
}

/**
 * The fix record rules, as problems in record line order, for each finding written `fixed in <sha>` (every severity and class: lane S lines have no class, and the grammar does not store it):
 * - places: no `checked:` mark (D-08);
 * - answer: once its re-review round exists (the next round of its cycle not headed `(added code round 1)`, else round 1 of the next cycle), the fixed finding carries one of `addressed:`
 *   and `not addressed:` (D-10, D-17; the grammar refuses both), a `not addressed:` finding is carried by a round of its cycle up to that re-review (`carried from <r>.<n>`) or, across a cycle, reported again (reportedAgain), and an
 *   answer sits only on a fixed finding;
 * - outside (D-10): a re-review finding outside the fix diff (fixOutside) that is not written deferred with its ledger line;
 * - answer, with `o.verdict`: no fixed finding in the record's last round, which no re-review has answered yet (D-17), whatever marks it carries, and no unanswered fix that only
 *   `(added code round 1)` rounds followed.
 * Each problem the verdict form adds carries `awaiting`. Gate done refuses them all; `accord round` refuses the others and prints the awaiting fixes on its `Re-review:` line, because the
 * round it is about to start may be their re-review. None when the rules do not apply to this ticket.
 */
export function fixProblems(snapshot: RepoSnapshot, id: string, o: { verdict?: boolean } = {}): FixProblem[] {
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined || !fixOn(snapshot, id)) return [];
  const out: FixProblem[] = [];
  const add = (line: number, rule: FixProblem['rule'], reason: string, awaiting?: string): number =>
    out.push({ line, rule, reason: withNote(snapshot, id, reason), ...(awaiting === undefined ? {} : { awaiting }) });
  const placed = placedRounds(rec);
  const lastRound = placed[placed.length - 1]?.round;
  for (const at of placed) {
    const where = `round ${at.p} of cycle ${at.cycle}`;
    // The round that re-reviews this round's fix: the next round of its cycle not headed (added code round 1), or, when none is, round 1 of the next cycle a `## Return from verify`
    // opened (D-17: that cycle's verdict was written without one, and round 1 reads the whole work). An added-code round reviews the merged code; its reviewer may answer too, so its
    // answer counts, but nothing is asked of it. A NOT ADDRESSED finding is carried within a cycle, by a round up to the re-review; across a cycle, round 1 reports it again (reportedAgain).
    const later = rec.cycles[at.cycle - 1].rounds.slice(at.p);
    const k = later.findIndex((r) => r.added !== true);
    const reReview = k >= 0 ? later[k] : rec.cycles[at.cycle]?.rounds[0];
    const reName = k >= 0 ? `round ${at.p + k + 1}` : `round 1 of cycle ${at.cycle + 1}`;
    const carriers = k >= 0 ? later.slice(0, k + 1) : later;
    const carryAsked = carriers.length > 0 && (k >= 0 || (o.verdict === true && rec.cycles[at.cycle] === undefined));
    for (const f of at.round.findings) {
      const which = `finding ${f.n ?? 'at line ' + f.line}`;
      const fixId = `${at.p}.${f.n ?? '<n>'}${at.cycle >= 2 ? ' cycle ' + at.cycle : ''}`;
      const answered = f.addressed !== undefined || f.notAddressed !== undefined;
      if ((f.state === undefined || f.state === 'open' || f.state === 'deferred') && !deferredWithLine(snapshot, id, at, f) && outsideOf(snapshot, id, at, f)) {
        const cycle = at.cycle >= 2 ? ` cycle ${at.cycle}` : '';
        const located = f.file ?? 'nowhere (none)';
        add(
          f.line,
          'outside',
          `${where}, ${which} is outside the fix diff (${located}): a re-review finding outside the fix diff goes to Deferred and starts no round (D-10); ` +
            `write it deferred and add - review ${at.p}.${f.n ?? '<n>'}${cycle}: <finding> — failing case: <case> under ## Deferred in the ledger`,
        );
      }
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
      // both marks on one line never reach here: the finding grammar refuses that line as a record problem (record.ts)
      if (reReview !== undefined && !answered) {
        add(
          f.line,
          'answer',
          `${where}, ${which} is fixed in a commit and ${reName} followed with no addressed: or not addressed: mark on it: the re-review's answer is recorded on the fixed finding's own line ` +
            '(addressed: <path>:<line> or not addressed: <path>:<line>, D-10, D-17)',
        );
      } else if (reReview === undefined && o.verdict === true && (at.round === lastRound || !answered)) {
        // the record's last round, whatever marks it carries, or a fix only (added code round 1) rounds followed and none answered
        add(
          f.line,
          'answer',
          at.round === lastRound
            ? `${where}, ${which} is fixed in a commit after the last review round: every fix round gets a re-review that answers it before the verdict (D-17)`
            : `${where}, ${which} is fixed in a commit and only (added code round 1) rounds followed it, which are not asked for the answer: ` +
                'run a re-review round given this finding and record its answer before the verdict (D-17)',
          fixId,
        );
      }
      const carried = carriers.some((r) => r.findings.some((x) => x.carried?.round === at.p && x.carried.n === f.n));
      const crossNext = k < 0 ? rec.cycles[at.cycle]?.rounds[0] : undefined;
      if (f.notAddressed !== undefined && crossNext !== undefined && !carried && !reportedAgain(crossNext, f)) {
        const files = [...new Set([f.file, f.notAddressed.file].filter((p) => p !== undefined))].join(' or ');
        add(
          f.line,
          'answer',
          `${where}, ${which} is marked not addressed: and round 1 of cycle ${at.cycle + 1} reports no ${f.severity === 'Must' ? 'Must' : 'Must or Should'} in ${files} again: ` +
            "round 1 of the next cycle reports a NOT ADDRESSED finding of a cycle's last round as its own open finding, in the same file and at least as severe (D-10)",
        );
      } else if (f.notAddressed !== undefined && carryAsked && !carried) {
        add(
          f.line,
          'answer',
          `${where}, ${which} is marked not addressed: and no round from round ${at.p + 1} to round ${at.p + carriers.length} holds a finding "carried from ${at.p}.${f.n ?? '<n>'}": ` +
            'a later round of the cycle carries a finding that was not addressed (D-10)',
          k < 0 ? fixId : undefined, // only added-code rounds so far: the re-review round to come may still carry it
        );
      }
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

/**
 * One gate row: the problems of `rule` in the verdict form of fixProblems, as findings on review.md. The three rows take that form from the gate run's `once`, so a gate done computes
 * it once; the verdict form only adds `answer` problems, so `places` and `outside` read the same from it.
 */
const fixRow =
  (rule: FixProblem['rule']): GateRule['check'] =>
  (snapshot, id, once) => {
    const rec = workOf(snapshot, id)?.rounds;
    if (rec === undefined) return [];
    const compute = (): FixProblem[] => fixProblems(snapshot, id, { verdict: true });
    return (once === undefined ? compute() : once('fixProblems', compute))
      .filter((p) => p.rule === rule)
      .map((p) => ({ file: rec.file, line: p.line, reason: p.reason }));
  };

/** gate.fix-places-missing: a fixed finding of review.md with no checked: mark, from FIX_RECORD_FROM, in lane M and lane S. */
export const fixPlacesMissing: GateRule['check'] = fixRow('places');

/** gate.fix-not-addressed: a fix no re-review answered with `addressed:`, a `not addressed:` finding nothing carried, a misplaced answer, or the last round's fix, from FIX_RECORD_FROM, in lane M and lane S. */
export const fixNotAddressed: GateRule['check'] = fixRow('answer');

/** gate.fix-outside-open: a re-review finding outside the fix diff left open or deferred with no ledger line, from FIX_RECORD_FROM, in lane M and lane S (D-10). */
export const fixOutsideOpen: GateRule['check'] = fixRow('outside');

/** D-10: the findings of one cycle (0-based) that are outside the fix diff and written deferred with their ledger line; they leave the stop and start no round. */
export function fixDeferred(snapshot: RepoSnapshot, id: string, cycle: number): ReadonlySet<RoundFinding> {
  const out = new Set<RoundFinding>();
  if (!fixOn(snapshot, id)) return out;
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined) return out;
  for (const at of placedRounds(rec)) {
    if (at.cycle !== cycle + 1) continue;
    for (const f of at.round.findings) if (deferredWithLine(snapshot, id, at, f) && outsideOf(snapshot, id, at, f)) out.add(f);
  }
  return out;
}
