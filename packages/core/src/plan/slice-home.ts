// Phase 08.9.3 D-08, D-11, D-14: where slice n of a ticket lives, said once. The slice order is the deploy order (D-08); the claim branch holds the FIRST slice of this repository, whatever its number; a later
// slice of this repository is `slice/<id>/<n>` stacked on the previous slice of this repository; a slice of another repository is `slice/<id>/<n>` in that repository's clone (D-11), cut from its
// `baseline_<name>` when it is the first slice there and from the previous slice of that repository after. Every reader of a ticket's slices (anchor, `gate done --slice auto`, a slice's start, range and size,
// `worktree sync`) asks `sliceHome`, so "slice 1 is the claim branch" is written nowhere else (Pitfall 7). A plan with no `repo:` line gives exactly the Phase 15 answers.
// Ruling R11 (slice in work): on a branch of this repository the slice in work is the lowest of that branch's own slice and the other-repository slices worked from it whose `covers:` criteria are not all in
// `verified:`; the ticks already say which slice is finished, so no state is kept for it.
// Pure: no node module, no git. The host maps these names to refs and runs git in the repository a slice belongs to.
import { SAFE_ID } from '../audit/hygiene.js';
import type { PlanSlice } from '../model/snapshot.js';

/** The two things a slice's place depends on: its number and its repository (absent: this repository). */
type Placed = Pick<PlanSlice, 'n' | 'repo'>;

export interface SliceHome {
  n: number;
  repo?: string; // the repository of another clone; absent for this repository
  branch: string; // the claim branch for the first slice of this repository, else `slice/<id>/<n>`
  claim: boolean; // true for the first slice of this repository
  previous?: { n: number; repo?: string; branch: string }; // the previous slice of the SAME repository; absent for the first slice of a repository (it starts at the baseline)
}

/** `slice/<id>/<n>` for an id that passes SAFE_ID and a whole number from 1 to 99; undefined for anything else, so no branch name is built from other text (T-15-31). */
export function sliceBranchName(id: string, n: number): string | undefined {
  return SAFE_ID.test(id) && Number.isInteger(n) && n >= 1 && n <= 99 ? `slice/${id}/${n}` : undefined;
}

/** The lowest number among the slices of this repository (no `repo:`): the slice the claim branch holds. Undefined when every slice is built elsewhere. */
export function firstMainSlice(slices: readonly Placed[]): number | undefined {
  const own = slices.filter((s) => s.repo === undefined).map((s) => s.n);
  return own.length === 0 ? undefined : Math.min(...own);
}

/** Where slice `n` lives, or undefined when the plan has no such slice or the id could not name a branch. `claim` is the ticket's claim branch. */
export function sliceHome(slices: readonly Placed[], n: number, ticket: { id: string; claim: string }): SliceHome | undefined {
  const own = slices.find((s) => s.n === n);
  if (own === undefined) return undefined;
  const first = firstMainSlice(slices);
  const nameOf = (s: Placed): string | undefined => (s.repo === undefined && s.n === first ? ticket.claim : sliceBranchName(ticket.id, s.n));
  const branch = nameOf(own);
  if (branch === undefined) return undefined;
  const before = slices.filter((s) => s.n < n && s.repo === own.repo).sort((a, b) => b.n - a.n)[0];
  const beforeName = before === undefined ? undefined : nameOf(before);
  if (before !== undefined && beforeName === undefined) return undefined;
  const claim = own.repo === undefined && n === first;
  return {
    n,
    ...(own.repo === undefined ? {} : { repo: own.repo }),
    branch,
    claim,
    ...(before === undefined || beforeName === undefined ? {} : { previous: { n: before.n, ...(before.repo === undefined ? {} : { repo: before.repo }), branch: beforeName } }),
  };
}

const AC_TOKEN = /^@(ac-[1-9][0-9]*)$/;

/**
 * The slice a session on this repository's branch of slice `branchSlice` is working (Ruling R11): the lowest of that slice and the other-repository slices worked from its branch whose `covers:` criteria are not
 * all in `verified`. The other-repository slices worked from a branch are those between it and this repository's next slice, and, for the first slice of this repository (the claim branch), those below it too.
 * A slice whose `covers:` line names no criterion is never finished. With everything verified, or a branch of another repository, the answer is `branchSlice`.
 */
export function sliceInWork(slices: readonly Pick<PlanSlice, 'n' | 'repo' | 'covers'>[], branchSlice: number, verified: readonly string[]): number {
  const own = slices.find((s) => s.n === branchSlice);
  if (own === undefined || own.repo !== undefined) return branchSlice;
  const next = slices.filter((s) => s.repo === undefined && s.n > branchSlice).map((s) => s.n).sort((a, b) => a - b)[0];
  const first = firstMainSlice(slices) === branchSlice;
  const worked = slices.filter((s) => s.repo !== undefined && ((first && s.n < branchSlice) || (s.n > branchSlice && (next === undefined || s.n < next))));
  const finished = (s: Pick<PlanSlice, 'covers'>): boolean => {
    const tags = s.covers.flatMap((t) => AC_TOKEN.exec(t)?.[1] ?? []);
    return tags.length > 0 && tags.every((t) => verified.includes(t));
  };
  return [own, ...worked].sort((a, b) => a.n - b.n).find((s) => !finished(s))?.n ?? branchSlice;
}
