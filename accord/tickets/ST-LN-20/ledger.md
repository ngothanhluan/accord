# Ledger

## Rulings
- Ruling: a merged ticket branch is deleted locally even when its remote branch still exists — every commit on it is already on the remote main branch, so nothing is lost — cost if wrong: a team that keeps merged branches on the remote also loses the local copy, which `git switch` recreates from the remote.
- Ruling: an unmerged ticket branch is kept and not named; a merged one that cannot be deleted is kept and named with the reason — as ST-LN-7's D-11 does for worktrees, so in-flight tickets add no lines — cost if wrong: none known.
- Ruling: the fetch becomes `git fetch --prune origin`, which prunes every stale remote-tracking ref of `origin`, not only ticket refs — that is what D-01 names, and a ref whose remote branch is gone carries no commit of its own — cost if wrong: a non-ticket stale ref someone still read disappears from `git branch -r`.
- Ruling: `worktree clean` fetches whenever an `origin` remote exists, even with no ticket worktree or branch, replacing ST-LN-7's Ruling that it fetches and prints nothing with no ticket worktree — @ac-4's Given has no local branch — cost if wrong: one fetch per bare `/accord`, and offline a failure line every time.
- Ruling: prune with `git remote prune origin` only after a plain `git fetch origin` succeeded, never `git fetch --prune` — git prunes before the transfer, so a fetch that dies mid-transfer would have pruned (critic 2) — cost if wrong: one more git call.
- Ruling: the branch pass takes every local branch the ticket branch template matches, known ticket or not, read by full ref name — the session's checkout may predate the ticket file (critic 1), and a same-named tag would shorten the name (critic 4) — cost if wrong: none known.
- Ruling: the `deleted` line prints the full sha — it is what undoes a wrong deletion — cost if wrong: a longer line.
- Ruling: a merged branch kept because its worktree was kept is named as well, `kept <branch>: checked out in <path>` — D-02 — cost if wrong: two lines per kept worktree.
