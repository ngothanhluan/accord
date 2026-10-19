---
ticket: "ST-LN-20"
commit: "53da83eeada06c83fb3e1e04d4d773a8418a96cd"
reviewed_on: "2026-10-19"
---

## @ac-1 /accord with no argument deletes merged ticket branches, with or without a worktree, and names what it keeps

Result: pass

Evidence: Exists: packages/cli/test/worktree.test.ts:690 (ac-1 test), branch pass in packages/cli/src/commands/worktree.ts:403-428. Substantive: the pass lists refs/heads, keeps only template-named branches whose tip passes `merge-base --is-ancestor` against the fetched remote main, prints `kept <b>: checked out in <path>` when any worktree (main included) holds it, else runs `git branch -D` and prints `deleted <b> (was <sha>)`; unmerged t/ST-11 is skipped silently. Wired: packages/cli/src/run.ts:204 routes `worktree clean` to `worktreeClean`. Data flows: ran `npx vitest run test/worktree.test.ts` in packages/cli, 37 of 37 passed; the test uses a real bare remote and clone, asserts t/ST-9 and t/ST-10 refs gone, t/ST-12 kept naming the root, t/ST-11 kept and absent from the output.

## @ac-2 A merged branch whose remote branch was deleted on merge is deleted from whatever branch the session stands on

Result: pass

Evidence: Exists: packages/cli/test/worktree.test.ts:711. Substantive: judgment uses `ref` from `gitDefaultRef` (packages/cli/src/commands/worktree.ts:411), never local main or HEAD, then `-D` (line 419). Wired: same `worktree clean` entry as ac-1. Data flows: the test asserts before the run that the tip is not an ancestor of local main or HEAD, that the remote branch and origin ref are gone, then that output is exactly `deleted t/ST-9 (was <sha>)`, the ref is gone, main is unchanged, and the session stays on t/ST-20. Passed in the 37-test run.

## @ac-3 A local commit that is not on the remote main branch keeps its branch

Result: pass

Evidence: Exists: packages/cli/test/worktree.test.ts:736. Substantive: the extra commit makes the tip fail `merge-base --is-ancestor` against the remote main, so the loop hits `continue` at worktree.ts:411 with no output. Wired: same entry. Data flows: the test asserts exit 0, empty output, and t/ST-9 still at the extra commit sha. Passed.

## @ac-4 Stale remote-tracking refs are pruned, and a failed fetch prunes nothing

Result: pass

Evidence: Exists: packages/cli/test/worktree.test.ts:781. Substantive: worktree.ts:322-325 runs `git fetch --no-prune origin`, and only on success `pruneStale` (`git remote prune origin`), which prints `pruned <ref> (was <sha>)`; the catch prints `fetch from origin failed, judging against the refs already in this clone: ...` and skips pruning. Wired: same entry; the fetch now runs whenever an origin remote exists. Data flows: the test shows that after a good fetch `git branch -r` lacks origin/t/ST-9 and origin/backlog/notes (a non-ticket ref) and the two pruned lines carry the real sha. With an unreachable remote, one failure line is printed, both refs remain, and the branch is judged against the stale origin/main. A further risk test covers `remote.origin.prune=true`. Passed in the 37-test run.
