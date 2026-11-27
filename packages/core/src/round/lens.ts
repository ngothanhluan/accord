// Phase 11 D-05, Ruling R9: the team lenses a review round's own package printed. A version 2 review round records `Lens: <name> ran` for each lens its package named; a round needs the line only for the
// lenses its own package printed (the first round of the record and each `(final review)`, Ruling R6 of plan 11-04), and the host recomputes that list from git and the lens files at the default branch
// (lensFacts), so the record's own lines never decide which lenses were required. ONE rule (lensProblems) that `accord round` reads whole and `accord gate done` reads from plan 11-07. Pure: the host
// supplies the fact and the claim pin. No code runs at load but constants.
import { stageOff } from '../gate/floor.js';
import { laneTicket, workOf } from '../gate/work.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { LENSES_FROM, claimPinBefore } from './pin.js';
import { placedRounds, skipped } from './scope.js';

/** One way the lens record is wrong: the line it is about and what to do. */
export interface LensRecordProblem {
  line: number;
  reason: string;
}

/**
 * True when the lens record rule applies to the ticket: a lane M, L or P ticket with a version 2 review record, not skipped (HEAD on the default branch, or the ticket done in the default ref's records,
 * as every review scope rule), whose review stage is on and whose claim pin is not before LENSES_FROM. A failed claim read is not before it (claimPinBefore fails closed), so the rule applies.
 */
export function lensOn(snapshot: RepoSnapshot, id: string): boolean {
  const lane = laneTicket(snapshot, id)?.frontmatter?.lane;
  const rec = workOf(snapshot, id)?.rounds;
  if ((lane !== 'M' && lane !== 'L' && lane !== 'P') || rec === undefined || rec.version !== 2 || skipped(snapshot, id) || stageOff(snapshot, id, 'review')) return false;
  return !claimPinBefore(snapshot, id, LENSES_FROM);
}

const cannot = (why: string): LensRecordProblem[] => [{ line: 1, reason: `the team lenses cannot be checked: ${why}` }];

/**
 * The lens record problems of the review record, in record line order: a round whose package printed a lens and that records no `Lens: <name> ran` for it (no exemption for a `(final review)` round: it
 * printed its lenses, so it runs them), and a `Lens:` line that is not `Lens: <name> ran` with a lens name. None when the rule does not apply (lensOn) or the host supplied no fact; a fact with `error`, or one
 * whose rounds do not match the record's, is one problem (fail closed).
 */
export function lensProblems(snapshot: RepoSnapshot, id: string): LensRecordProblem[] {
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined || !lensOn(snapshot, id)) return [];
  const fact = Object.hasOwn(snapshot.lensFacts ?? {}, id) ? snapshot.lensFacts![id] : undefined;
  if (fact === undefined) return [];
  if ('error' in fact) return cannot(fact.error);
  const placed = placedRounds(rec);
  if (fact.rounds.length !== placed.length) {
    return cannot(`the host read the lenses of ${fact.rounds.length} rounds and review.md records ${placed.length}`);
  }
  const out: LensRecordProblem[] = [];
  for (const at of placed) {
    const where = `round ${at.p} of cycle ${at.cycle}`;
    for (const name of fact.rounds[at.j - 1].lenses) {
      if ((at.round.lenses ?? []).includes(name)) continue;
      const mode = Object.hasOwn(fact.modes, name) ? fact.modes[name] : 'ask';
      out.push({
        line: at.round.line,
        reason:
          `${where}: its review package named lens ${name} (on_finding ${mode}), and the round records no "Lens: ${name} ran"; ` +
          `to run it, dispatch accord-reviewer with lens ${name} on the package the command at the end of this line writes, then write "Lens: ${name} ran" in the round: ` +
          `accord review-package ${id} --lens ${name} --round ${at.j} --out lens-${name}-${at.j}.md`,
      });
    }
    for (const u of at.round.lensUnread ?? []) out.push({ line: u.line, reason: `${where}: "${u.text}" is not read; write "Lens: <name> ran" with the name of a lens its package printed` });
  }
  return out.sort((a, b) => a.line - b.line);
}
