// Phase 11 D-05, Ruling R9: the team lenses each recorded review round's own package printed, recomputed from git and the lens files at the default branch (readLensFiles, the reader the package used),
// for `accord round` and, from plan 11-07, `accord gate done`; and the range each round's package read, which `accord review-package --lens <name> --round <k>` resolves through the same function
// (lensRoundRanges), so the package, the rule and the dispatch the rule prints never disagree. A round's package printed lenses only for the first round of the record and each `(final review)` round (Ruling
// R6 of plan 11-04). Every git failure is an `error` fact, which the rule reports (fail closed); nothing here writes.
import { lensesFor, lensOn, parseLens, workOf } from '@accord-dev/accord-core';
import type { LensFacts, LensFile, LensMode, RepoSnapshot } from '@accord-dev/accord-core';
import { currentBranch, defaultRefOf, UsageError } from './fs.js';
import { readLensFiles } from './lens-files.js';
import { packageDiff, why } from './package-diff.js';
import { securityRoundRanges } from './security-facts.js';
import { sliceStart } from './slice-size.js';
import { sliceOfBranch } from './slices.js';
import { whyGit } from './round-facts.js';

/** One recorded round's lens range: `base` and `head` as the round's package read them (a full sha for the head), and whether that package printed team lenses at all. */
export interface LensRange {
  base: string;
  head: string;
  lenses: boolean;
}

/**
 * The start of the slice this checkout is on when it is on `slice/<id>/<n>` of this ticket, as `accord review-package` reads it for a round-1 package; undefined on any other branch and when git cannot say,
 * in which case the package falls back to the round-one base, and so does this.
 */
function sliceAt(root: string, snapshot: RepoSnapshot, id: string): string | undefined {
  const name = currentBranch(root);
  const slice = name === undefined ? undefined : sliceOfBranch(name);
  return slice === undefined || slice.id !== id ? undefined : sliceStart(root, snapshot, id, slice.n);
}

/**
 * Ruling R9: the package range of each recorded round of `id`, in record order (cycles flattened, so entry k - 1 is the k-th `## Round` section of review.md in file order), and whether that package printed
 * lenses. Round 1 (the first round of the record) is the package from where the slice in work starts when the checkout is on `slice/<id>/<n>`, else from the round-one base; a `(final review)` round is the
 * package of `--base`, which only the plan's baseline can be (the round-one base), so it reads the whole ticket; every other round re-checks fixes and names no lens. The heads are the rounds' own, resolved
 * by securityRoundRanges. Holds no pin gate; a round with no head, a head git cannot resolve, or no base for round 1 is an `error`.
 */
export function lensRoundRanges(root: string, snapshot: RepoSnapshot, id: string): { error: string } | { rounds: LensRange[] } {
  const ranges = securityRoundRanges(root, snapshot, id);
  if ('error' in ranges) return ranges;
  if (ranges.rounds.length === 0) return { rounds: [] };
  const first = ranges.rounds[0].base;
  const slice = ranges.rounds[0].final ? undefined : sliceAt(root, snapshot, id);
  return {
    rounds: ranges.rounds.map((r, k) => {
      if (r.final) return { base: first, head: r.head, lenses: true };
      if (k === 0) return { base: slice ?? first, head: r.head, lenses: true };
      return { base: r.base, head: r.head, lenses: false };
    }),
  };
}

/** One recorded round's range and the lenses its package printed: `printed` is empty for a round whose package names none (`lenses` false) and for a repository with no lens file. */
export interface LensPackage extends LensRange {
  printed: string[];
}

/** What the lens reading of a ticket's rounds holds: each round's package, the lens files as parsed (name order of the default branch's tree) and the note the package prints when it read the checkout. */
export interface LensRounds {
  rounds: LensPackage[];
  lenses: LensFile[];
  note?: 'no-default-ref';
}

/**
 * Ruling R9: the lenses each recorded round's own package printed, from the lens files at the default branch (readLensFiles) and each lens-printing round's changed paths (packageDiff, the function the package
 * reads from) through lensesFor, the one matcher. With no lens file nothing else is read (`rounds` is empty). An `error` for a round the ranges cannot read or a git failure; nothing here writes.
 */
export function lensRoundPackages(root: string, snapshot: RepoSnapshot, id: string): { error: string } | LensRounds {
  try {
    const def = defaultRefOf(root);
    const read = readLensFiles(root, def);
    const lane = snapshot.tickets[id]?.frontmatter?.lane;
    const parsed = read.lenses.map((l) => parseLens(l.path, l.text));
    if (parsed.length === 0) return { rounds: [], lenses: [], ...(read.note === undefined ? {} : { note: read.note }) }; // no lens file: nothing was printed, and no range or git read is needed
    const ranges = lensRoundRanges(root, snapshot, id);
    if ('error' in ranges) return ranges;
    const rounds = ranges.rounds.map((r, k): LensPackage => {
      if (!r.lenses) return { ...r, printed: [] };
      let pkg;
      try {
        pkg = packageDiff(root, { base: r.base, head: r.head, def, allowPlainLog: false });
      } catch (e) {
        throw new Error(`git failed reading the package of review round ${k + 1}: ${e instanceof UsageError ? e.message : why(e)}`, { cause: e });
      }
      return { ...r, printed: lensesFor(parsed, { lane, changed: pkg.changed, others: [] }).map((l) => l.name) };
    });
    return { rounds, lenses: parsed, ...(read.note === undefined ? {} : { note: read.note }) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'git failed reading the team lenses: ' + whyGit(e) };
  }
}

function factsFor(root: string, snapshot: RepoSnapshot, id: string): LensFacts | undefined {
  const read = lensRoundPackages(root, snapshot, id);
  if ('error' in read) return read;
  if (read.lenses.length === 0) return undefined; // no lens file at the default branch (or none in the checkout): no package printed a lens, and nothing is asked
  const modes: Record<string, LensMode> = {};
  for (const l of read.lenses) modes[l.name] = l.mode;
  return { rounds: read.rounds.map((r) => ({ head: r.head, lenses: r.printed })), modes, ...(read.note === undefined ? {} : { note: read.note }) };
}

/**
 * `snapshot` with lensFacts[id] set; `snapshot` itself when the ticket is no lane M, L or P ticket, has no git, no version 2 review record with a round, its review checks skipped (HEAD on the default branch, or the
 * ticket done there), its review stage off (all of it lensOn), a claim pin before LENSES_FROM, or no lens file to read: each decided on the snapshot, before the first git call, so a ticket claimed before the cut-off starts no
 * git read for it. The claim fact is the one the caller already loaded; this never calls withClaimPins. A failed claim read is false in claimPinBefore (fail closed), so the facts are read and the rule applies.
 * Ruling R11: the lenses are matched against this repository's changed paths; a `<name>:<path>` entry that names another repository is not matched here (the package's `## Repository <name>` section is the
 * only place those paths are read, and they are not tied to a round's head).
 */
export function withLensFacts(root: string, snapshot: RepoSnapshot, id: string): RepoSnapshot {
  const rec = workOf(snapshot, id)?.rounds;
  if (rec === undefined || rec.cycles.every((c) => c.rounds.length === 0) || snapshot.git === undefined) return snapshot;
  if (!lensOn(snapshot, id)) return snapshot;
  const fact = factsFor(root, snapshot, id);
  return fact === undefined ? snapshot : { ...snapshot, lensFacts: { ...snapshot.lensFacts, [id]: fact } };
}
