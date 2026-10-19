---
ticket: "ST-LN-20"
commit: "db88484560e7caf3ec1a0d4ab3a8c58acdce1ee5"
reviewed_on: "2026-10-19"
---

## @ac-1 /accord with no argument deletes merged ticket branches, with or without a worktree, and names what it keeps

Result: pass

Evidence: Exists: packages/cli/test/worktree.test.ts:690-709 (ac-1 test) and the branch pass at packages/cli/src/commands/worktree.ts:403-426. Substantive: the pass lists refs/heads, keeps tickets matched by `ticketOfBranch`, judges `merge-base --is-ancestor <sha> <remote main>` (:411), prints `kept <b>: checked out in <path>` for any worktree including the root (:412-416), else `git branch -D` and `deleted <b> (was <sha>)` (:419-420); unmerged t/ST-11 hits `continue` with no output. Wired: `run.ts:204` calls `worktreeClean`; the worktree loop removes ST-10's worktree first (:379), and the branch pass re-lists worktrees (:404). Data flows: the test uses a real bare remote and clone, asserts the exact output lines with full shas, that ST-9 and ST-10 refs are gone, ST-11 and ST-12 remain, and "t/ST-11" is not in the output. `npx vitest run test/worktree.test.ts` in packages/cli: 37 passed.

## @ac-2 A merged branch whose remote branch was deleted on merge is deleted from whatever branch the session stands on

Result: pass

Evidence: Exists: packages/cli/test/worktree.test.ts:711-734. Substantive: the judgement is against `ref` from `gitDefaultRef` (worktree.ts:328, :411), never local main or HEAD. Wired: same path as ac-1 via `run.ts:204`. Data flows: the test sets the root on t/ST-20, removes the remote and the origin/t/ST-9 ref, and asserts in the setup that the tip is not an ancestor of local `main` or HEAD (:726-727). It then asserts the output is exactly `deleted t/ST-9 (was <sha>)`, the ref is gone, and main and the current branch are unchanged. The test passed in the run above.

## @ac-3 A local commit that is not on the remote main branch keeps its branch

Result: pass

Evidence: Exists: packages/cli/test/worktree.test.ts:736-750. Substantive: a tip with an extra commit fails the `--is-ancestor` check at worktree.ts:411 and takes `continue`, so there is no output and no delete. Wired: through `worktreeClean`, as in ac-1. Data flows: the test makes a real extra commit after the merge and asserts empty output and that `t/ST-9` still points at the extra sha. It passed.

## @ac-4 Stale remote-tracking refs are pruned, and a failed fetch prunes nothing

Result: pass

Evidence: Exists: packages/cli/test/worktree.test.ts:781-818. Substantive: worktree.ts:322-323 runs `git fetch --no-prune origin`, then `pruneStale` runs `git remote prune origin` (:298) only after the fetch succeeds, and names each removed ref with its sha (:304-308). A fetch failure throws before the prune and prints the one-line `fetch from origin failed, judging against the refs already in this clone: ...` (:325). Wired: `worktreeClean` is reached from `run.ts:204`, and the fetch happens whenever an origin remote exists (:320), including with no ticket worktree. Data flows: the good-fetch case asserts that `git branch -r` no longer lists origin/t/ST-9 or origin/backlog/notes (a non-ticket ref) and that the output names both with the sha. The failed-fetch case points origin at a missing URL and asserts that both refs remain, the failure line appears once, and the branch is still judged against the cached main. It passed.
