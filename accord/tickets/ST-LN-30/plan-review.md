# Plan review: ST-LN-30

## Round 1 (whole)
1. Should — Task 3 step 6 and Task 4 merge the short name `origin/main` while step 5 checks the full `refs/remotes/origin/main`; a tag or local branch named `origin/main` (a fetched tag, or a stray `git checkout -b origin/main`) wins the short-name lookup, so an unreviewed commit is merged or main's commits are silently missed; pass the full ref to `git merge` and keep the short name for printed lines (security lens) — fixed
2. Should — one `/accord continue` on a ticket at verify fetches twice (Continue, then `worktree merge` in verify step 2), so offline the owner sees two fetch-failed lines for one action and can wait 60 s, not 30; neither the plan nor the ledger says whether ac-5's "exactly one line" counts per command (criteria lens) — owner: "A" (to the options: A count "exactly one line" per accord command, by a Ruling; B Continue skips its fetch at verify, narrowing ac-2)
3. Nice — Task 4's pin test does not assert the error is `checkPin`'s message alone, not wrapped as a failed merge ("is as it was") (build lens) — deferred
4. Nice — Task 3's ac-4 test reads `shared.txt` without `'utf8'`, so `toBe('ST-9\n')` compares a Buffer (build lens) — deferred

## Round 2 (diff)
fixed: 1.1
No findings

## Closed
