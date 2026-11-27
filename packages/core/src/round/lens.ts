// Phase 11 D-05, Ruling R9: the team lenses a review round's own package printed. A version 2 review round records `Lens: <name> ran` for each lens its package named; a round needs the line only for the
// lenses its own package printed (the first round of the record and each `(final review)`, Ruling R6 of plan 11-04), and the host recomputes that list from git and the lens files at the default branch
// (lensFacts), so the record's own lines never decide which lenses were required. ONE rule (lensProblems) that `accord round` reads whole and `accord gate done` reads from plan 11-07. Pure: the host
// supplies the fact and the claim pin. No code runs at load but constants.
import { stageOff } from '../gate/floor.js';
import type { GateRule } from '../gate/rules.js';
import { laneTicket, workOf } from '../gate/work.js';
import type { LensMode } from '../lens/spec.js';
import type { RepoSnapshot, RoundCycle, RoundFinding } from '../model/snapshot.js';
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

/**
 * gate.lens-unreviewed: each lens record problem of review.md (lensProblems, the function `accord round` reads), at the line it is about. The rule belongs to the review stage (STAGE_OF, Ruling R11 of plan
 * 11-07), so with the review stage off it is not run; lensOn is false for a lane S ticket, so it has no row in the lane S Done table.
 */
export const lensUnreviewed: GateRule['check'] = (snapshot, id) => {
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined) return [];
  return lensProblems(snapshot, id).map((p) => ({ file: rec.file, line: p.line, reason: p.reason }));
};

/** One finding a team lens made that the mark is honoured for: where it sits, the lens and what its `on_finding` says. */
export interface LensFinding {
  f: RoundFinding;
  /** The round of its cycle (1-based) and the cycle (1-based). */
  p: number;
  cycle: number;
  lens: string;
  mode: LensMode;
}

/** True when `f`, a finding of round `p` of `cycle`, is marked `risk:` or carries (`carried from <r>.<n>`, to any depth) a finding that is: a risk is never lowered by a lens (T-11-17). */
function riskOf(cycle: RoundCycle, p: number, f: RoundFinding): boolean {
  let at: RoundFinding = f;
  let round = p;
  for (let depth = 0; depth <= cycle.rounds.length; depth++) {
    if (at.risk !== undefined) return true;
    const c = at.carried;
    if (c === undefined || c.round >= round) return false;
    const next = cycle.rounds[c.round - 1]?.findings.find((x) => x.n === c.n);
    if (next === undefined) return false;
    at = next;
    round = c.round;
  }
  return false;
}

/**
 * Ruling R12 (finding to lens): the Must and Should findings of review.md whose `lens:` mark is honoured, in record order. A mark is honoured only when the lens record rule applies (lensOn), the host's lens
 * fact reads (no `error`, as many rounds as the record has), the finding's own round printed that lens, and the finding is no risk (`risk:` mark, own or carried): everything else reads as a built-in
 * finding, which blocks, the safe side. The fact says which lens each round printed, so the mark of a reviewer, or of a forged line, never decides it (T-11-18).
 */
export function lensFindings(snapshot: RepoSnapshot, id: string): LensFinding[] {
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined || !lensOn(snapshot, id)) return [];
  const fact = Object.hasOwn(snapshot.lensFacts ?? {}, id) ? snapshot.lensFacts![id] : undefined;
  if (fact === undefined || 'error' in fact) return [];
  const placed = placedRounds(rec);
  if (fact.rounds.length !== placed.length) return [];
  const out: LensFinding[] = [];
  for (const at of placed) {
    const printed = fact.rounds[at.j - 1].lenses;
    for (const f of at.round.findings) {
      if (f.lens === undefined || f.severity === 'Nice' || !printed.includes(f.lens) || riskOf(rec.cycles[at.cycle - 1], at.p, f)) continue;
      out.push({ f, p: at.p, cycle: at.cycle, lens: f.lens, mode: Object.hasOwn(fact.modes, f.lens) ? fact.modes[f.lens] : 'ask' });
    }
  }
  return out;
}

/**
 * The findings of one cycle (0-based) that leave the stop of the review loop because of their lens (D-06): the Must and Should findings of a `warn` lens, which never block, and those of an `ask` lens, which the loop
 * puts to the owner at its end (lensAsks) instead of stopping on them as they appear. A `block` lens's findings are not here: they stop the loop as a built-in finding does (Ruling R14). Never a risk finding.
 */
export function lensDeferred(snapshot: RepoSnapshot, id: string, cycle: number): ReadonlySet<RoundFinding> {
  return new Set(lensFindings(snapshot, id).filter((x) => x.cycle === cycle + 1 && x.mode !== 'block').map((x) => x.f));
}

const isOpen = (f: RoundFinding): boolean => f.state === undefined || f.state === 'open';

/** The `<r>.<n> lens <name>` of the open Must and Should findings of one cycle (0-based) that a `warn` lens made: listed in the verify report, never blocking. */
export function lensWarns(snapshot: RepoSnapshot, id: string, cycle: number): string[] {
  return lensFindings(snapshot, id)
    .filter((x) => x.cycle === cycle + 1 && x.mode === 'warn' && isOpen(x.f))
    .map((x) => `${x.p}.${x.f.n} lens ${x.lens}`);
}
