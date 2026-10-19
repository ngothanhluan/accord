# Plan review

## Round 1 (whole)
1. Must — a plain `git fetch origin` prunes before the transfer when `fetch.prune` or `remote.origin.prune` is set, so a fetch that dies mid-transfer has pruned, against @ac-4; fetch with `--no-prune` and add a `risk:data-loss` test that sets `remote.origin.prune=true` (both critics) — open, owner: "làm hết đi"
2. Should — `git remote prune origin` can drop the last copy of an unmerged branch deleted on the remote, with its reflog and no sha printed, so Approach scenario B ("no commit is lost") and ledger Ruling 3 are false and the Intent's "never loses a commit" is at stake; touches the Intent and D-04 (security critic) — open, owner: "làm hết đi"; settled by D-05
3. Nice — Task 1 step 1 puts the no-`origin` exit ahead of `worktrees()`, so a clone with no `origin` no longer prunes stale worktree records — open, owner: "làm hết đi"
4. Nice — after Task 1 alone, the ac-2 test cannot tell `git branch -D` from `-d`, since `origin/t/ST-9` is still in the clone; delete that ref in the ac-2 setup — open, owner: "làm hết đi"
