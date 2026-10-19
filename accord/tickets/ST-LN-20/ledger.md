# Ledger

## Rulings
- Ruling: a merged ticket branch is deleted locally even when its remote branch still exists — every commit on it is already on the remote main branch, so nothing is lost — cost if wrong: a team that keeps merged branches on the remote also loses the local copy, which `git switch` recreates from the remote.
- Ruling: an unmerged ticket branch is kept and not named; a merged one that cannot be deleted is kept and named with the reason — as ST-LN-7's D-11 does for worktrees, so in-flight tickets add no lines — cost if wrong: none known.
- Ruling: the fetch becomes `git fetch --prune origin`, which prunes every stale remote-tracking ref of `origin`, not only ticket refs — that is what D-01 names, and a ref whose remote branch is gone carries no commit of its own — cost if wrong: a non-ticket stale ref someone still read disappears from `git branch -r`.
