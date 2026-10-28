# Plan review

## Round 1 (whole)
1. Must — @ac-3's go-on is not wired into plan step 8, build step 3 and build step 6: the failure line starts `push of`, which packages/core/skills/accord/worktree.md:34-35 tells the session to report and stop on, so a failed push in plan or build stops the work; the regression test pins go:false there — fixed
2. Should — Task 2's commit sentence lists the files to commit but leaves out packages/core/test/stage-skills.test.ts, so the risk:regression test can stay uncommitted — fixed

## Round 2 (whole)
1. Should — build step 3's "reword that commit yourself" can now rewrite a commit already pushed (intent, approach, plan and earlier ledger commits fall in task-done's trailer range, task-done.ts:58-62, fs.ts:841-857); every later `accord worktree push` is then rejected as non-fast-forward and the go-on bullet hides it, so origin stays at the plan commit through build — fixed
2. Should — the push runs under the fixed 30-second fetch limit (fetch-limit.ts:3), which also kills a local pre-push hook that takes longer, so for such a team no push ever succeeds; the limit is part of the approved Approach — fixed

## Round 3 (diff)
1. Should — a bare `--force-with-lease` checks origin against this clone's shared `refs/remotes/origin/<branch>`, which any fetch moves (`accord worktree open` in another session, worktree merge, new ticket, drop, or build step 3's own `git fetch origin`); after such a fetch a reword-and-lease-push silently replaces a teammate's commit on origin and prints `pushed:`; the plan's teammate case never fetches, so the test misses it — fixed

## Round 4 (diff)
No findings

## Closed
