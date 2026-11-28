// Phase 10 D-06 (as amended per slice 2026-11-28), T-10-05: which review rounds lie before the slice in work. The review budget of a sliced ticket counts the rounds of the slice in work only, so the host reads where that slice
// starts (`sliceStart`, as `accord anchor` prints it) and counts the review round heads of review.md that are at or before it, one `git merge-base --is-ancestor` per head (the heads come from the parsed record, so the count is bounded
// by the rounds, and each is a single argument that `isSha` has checked). Rounds are taken in record order and counted as a prefix: the first head that is not at or before the start ends the count, so a head git cannot place is a
// round that counts (fail closed: more rounds count, never fewer). A start git cannot read is `{ error }`, and every round of the cycle counts. A ticket with no slices, a claim before REVIEW_BUDGET_FROM, a lane S or R ticket, a
// record that is not version 2 (it has no heads) and a slice of another repository read nothing and spawn no git. Nothing here writes.
import { execFileSync } from 'node:child_process';
import { claimPinBefore, isSha, REVIEW_BUDGET_FROM, workOf } from '@accord-dev/accord-core';
import type { RepoSnapshot } from '@accord-dev/accord-core';
import { sliceStart } from './slice-size.js';

const GIT = { encoding: 'utf8' as const, stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 };

/** True when `head` is `start` or an ancestor of it; only `git merge-base --is-ancestor` exit 0 means yes, anything else (exit 1, an unknown commit, a failure) is no. */
function atOrBefore(root: string, head: string, start: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', head, start], { cwd: root, ...GIT });
    return true;
  } catch {
    return false;
  }
}

/**
 * `snapshot` with `sliceRounds[id]` set for slice `slice` (the slice in work, as `currentSlice` or `--slice` names it; undefined when the checkout works no slice), or `snapshot` itself when nothing applies to the ticket.
 * Core reads the fact through `sliceOffset` and `sliceNote`.
 */
export function withSliceRounds(root: string, snapshot: RepoSnapshot, id: string, slice: number | undefined): RepoSnapshot {
  if (slice === undefined || !Object.hasOwn(snapshot.tickets, id)) return snapshot;
  const lane = snapshot.tickets[id].frontmatter?.lane;
  if (lane === undefined || lane === 'S' || lane === 'R') return snapshot;
  const work = workOf(snapshot, id);
  const slices = work?.plan?.slices ?? [];
  const rec = work?.rounds;
  if (slices.length === 0 || rec === undefined || rec.version !== 2 || claimPinBefore(snapshot, id, REVIEW_BUDGET_FROM)) return snapshot;
  // a slice of another repository is built in that repository's clone, where this repository's round heads are not
  if (slices.find((s) => s.n === slice)?.repo !== undefined) return snapshot;
  const heads = rec.cycles.flatMap((c) => c.rounds.map((r) => r.head));
  if (heads.length === 0) return snapshot;
  const start = sliceStart(root, snapshot, id, slice, { scan: false, store: false });
  if (start === undefined) return { ...snapshot, sliceRounds: { ...snapshot.sliceRounds, [id]: { error: `git cannot say where slice ${slice} starts, so every review round of the cycle counts` } } };
  const first = heads.findIndex((h) => h === undefined || !isSha(h) || !atOrBefore(root, h, start));
  const fact = { before: first === -1 ? heads.length : first };
  return { ...snapshot, sliceRounds: { ...snapshot.sliceRounds, [id]: fact } };
}
