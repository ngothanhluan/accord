# Ledger

## Rulings
- Ruling: a merged ticket branch is deleted locally even when its remote branch still exists — every commit on it is already on the remote main branch, so nothing is lost — cost if wrong: a team that keeps merged branches on the remote also loses the local copy, which `git switch` recreates from the remote.
- Ruling: an unmerged ticket branch is kept and not named; a merged one that cannot be deleted is kept and named with the reason — as ST-LN-7's D-11 does for worktrees, so in-flight tickets add no lines — cost if wrong: none known.
- Ruling: the prune covers every stale remote-tracking ref of `origin`, not only ticket refs — that is what D-01 names; a pruned ref can hold the last copy of an unmerged branch deleted on the remote (plan review 1.2), so each is named with its sha (D-05) — cost if wrong: a non-ticket stale ref someone still read disappears from `git branch -r`, restorable from the printed sha.
- Ruling: `worktree clean` fetches whenever an `origin` remote exists, even with no ticket worktree or branch, replacing ST-LN-7's Ruling that it fetches and prints nothing with no ticket worktree — @ac-4's Given has no local branch — cost if wrong: one fetch per bare `/accord`, and offline a failure line every time.
- Ruling: prune with `git remote prune origin` only after `git fetch --no-prune origin` succeeded, never `git fetch --prune` (D-05) — git prunes before the transfer, so a fetch that dies mid-transfer would have pruned (critic 2) — cost if wrong: one more git call.
- Ruling: the branch pass takes every local branch the ticket branch template matches, known ticket or not, read by full ref name — the session's checkout may predate the ticket file (critic 1), and a same-named tag would shorten the name (critic 4) — cost if wrong: none known.
- Ruling: the `deleted` line prints the full sha — it is what undoes a wrong deletion — cost if wrong: a longer line.
- Ruling: a merged branch kept because its worktree was kept is named as well, `kept <branch>: checked out in <path>` — D-02 — cost if wrong: two lines per kept worktree.
- Ruling: a `git remote prune origin` that fails after a successful fetch prints `prune of origin failed: <git's first line>`, still names each ref it did remove with its sha (D-05), and the command goes on — the Approach leaves this case unhandled, and it must not end the command — cost if wrong: one more line wording to change.
- Ruling: branch lines come after the worktree lines, in git's ref-name order (so `t/ST-10` comes before `t/ST-9`) — this is `for-each-ref`'s own order — cost if wrong: tests that compare exact order would need re-sorting.
- Ruling: six existing tests change, not the Approach's nine (ac-5, failed fetch, data-loss, remove fails, the pruned-folder test, stale holds lock); the three ssh `risk:security` tests check only the exit code and the recorder log — cost if wrong: one more test to update during execution.
- Ruling: the pruned-folder test's last check flips from "`t/ST-9` still exists" to "`t/ST-9` is deleted" — ST-LN-7's D-01 left branches to this ticket — cost if wrong: none known.
- Ruling: the `pruned` line names the full ref name (`refs/remotes/origin/t/ST-9`), not the short one — the same reasoning as reading branches by full name, so a same-named tag cannot make it ambiguous — cost if wrong: longer lines and test strings to reword.
- Ruling: the before/after listing and the `pruned` lines run whether the prune succeeds or fails — Approach scenario B says a prune that fails part-way names what it removed — cost if wrong: none known.
- Ruling: the `--no-prune` flag and the test that locks it both go in Task 2, next to the prune, not in Task 1 — the test needs the `pruned` line to see the difference — cost if wrong: between Task 1 and Task 2 on the branch, a clone with a prune setting still prunes during the fetch.
- Ruling: pruneStale runs inside the fetch's try block — its own try/catch handles a prune failure, so only a fetch failure reaches the fetch-failure line — cost if wrong: none.
- Ruling: the failing-prune test forces the failure with a `.git/refs/remotes/origin/t/ST-9.lock` file, which makes `git remote prune origin` exit non-zero — a real git failure, no mock — cost if wrong: a git version that ignores the lock would pass the test without exercising the failure.

## Deferred
- Plan round 2.1 (Nice): Task 1 step 2 cites "ledger Ruling 7" for fetching whenever `origin` exists; it is the 4th Ruling.
- Plan round 2.2 (Nice): the prune-failure line in Task 2 says "stale remote refs are kept", which contradicts the `pruned` lines printed after a part-way failure; the ledger Ruling's `prune of origin failed: <git's first line>` is the wording to build.
- Review round 1.2 (Nice): when the remote's main branch is deleted and HEAD moved, `git remote prune origin` leaves `refs/remotes/origin/HEAD` dangling, `for-each-ref` skips it, and a false `pruned refs/remotes/origin/HEAD (was <sha>)` line prints; no data is lost and the branch pass then finds no remote main and deletes nothing.
- Review round 1.3 (Nice): `pruneStale` runs inside the fetch's `try`, so a `for-each-ref refs/remotes/origin` failure after a good fetch prints the fetch-failure line and drops the `pruned` lines.
- Final review 2 (Nice): the test `risk:data-loss a failed prune says only that the prune failed and still names each ref it removed` never reaches a part-way prune, since git 2.56 removes its refs in one transaction and a lock makes it remove none; rename it to what it proves or drop that half of the title.

## Tasks
- task 1 done 76af86feda5d
- task 2 done 238898dd66d1
