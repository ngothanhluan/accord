# Plan review

## Round 1 (whole)
1. Must — a plain `git fetch origin` prunes before the transfer when `fetch.prune` or `remote.origin.prune` is set, so a fetch that dies mid-transfer has pruned, against @ac-4; fetch with `--no-prune` and add a `risk:data-loss` test that sets `remote.origin.prune=true` (both critics) — fixed, owner: "làm hết đi"
2. Should — `git remote prune origin` can drop the last copy of an unmerged branch deleted on the remote, with its reflog and no sha printed, so Approach scenario B ("no commit is lost") and ledger Ruling 3 are false and the Intent's "never loses a commit" is at stake; touches the Intent and D-04 (security critic) — fixed, owner: "làm hết đi"; settled by D-05
3. Nice — Task 1 step 1 puts the no-`origin` exit ahead of `worktrees()`, so a clone with no `origin` no longer prunes stale worktree records — fixed, owner: "làm hết đi"
4. Nice — after Task 1 alone, the ac-2 test cannot tell `git branch -D` from `-d`, since `origin/t/ST-9` is still in the clone; delete that ref in the ac-2 setup — fixed, owner: "làm hết đi"

## Round 2 (whole)
1. Nice — Task 1 step 2 cites "ledger Ruling 7" for fetching whenever `origin` exists; that is the 4th Ruling, the 7th is the full-sha `deleted` line — deferred
2. Nice — Task 2's prune-failure line says "stale remote refs are kept" while the ledger Ruling says `prune of origin failed: <git's first line>` and Task 2 still prints `pruned` lines after a part-way failure, so the two lines contradict each other — deferred

## Closed
Converged at round 2: no Must or Should open; gate plan passed; baseline suite 1337 passed (2026-10-19).
