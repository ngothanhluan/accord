---
ticket: "ST-LN-20"
commit: "70caf28bc41e360bb59e248011f400d295b33238"
reviewed_on: "2026-10-19"
---

## @ac-1 /accord with no argument deletes merged ticket branches, with or without a worktree, and names what it keeps

Result: pass

Evidence: Exists: test `ac-1 bare accord deletes merged ticket branches...` at packages/cli/test/worktree.test.ts:690-709 (name slug matches the ticket tag). Substantive: packages/cli/src/commands/worktree.ts:403-426 walks refs/heads, filters by the ticket branch template, judges `merge-base --is-ancestor <sha> <remote main ref>` (411), keeps with `kept <b>: checked out in <path>` (414) when any listed worktree, main one included, holds it, else `git branch -D` and `deleted <b> (was <sha>)` (419-420); an unmerged branch hits `continue` with no line. Wired: bare /accord skill step 1 runs `accord worktree clean` (packages/core/src/generated/skills.ts:3); packages/cli/src/run.ts:201-204 calls `worktreeClean`. Data flows: the test uses a real bare remote and clone, no mocks, and asserts the exact output set (t/ST-9 and t/ST-10 deleted with shas, t/ST-12 kept naming the root, t/ST-11 absent from output and still present). junit.xml at node_modules/.cache/accord/junit.xml shows the testcase present with no `<failure>` (0 in the file).

## @ac-2 A merged branch whose remote branch was deleted on merge is deleted from whatever branch the session stands on

Result: pass

Evidence: Exists: test at packages/cli/test/worktree.test.ts:711-734. Substantive: the judging ref is the fetched remote main from `gitDefaultRef` (worktree.ts:411), not local main or HEAD, and the delete uses `-D` (419) so a pruned upstream does not refuse it. Wired: same path as @ac-1 (run.ts:204 -> worktreeClean). Data flows: the test sets up the real case, asserting the upstream config is still set, the remote-tracking ref is gone, and the tip is not an ancestor of local `main` or HEAD (t/ST-20); then asserts the output is exactly `deleted t/ST-9 (was <sha>)`, the branch is gone, main is unmoved and the session branch is still t/ST-20. The test passed in junit.xml.

## @ac-3 A local commit that is not on the remote main branch keeps its branch

Result: pass

Evidence: Exists: test at packages/cli/test/worktree.test.ts:736-747. Substantive: a tip that fails `merge-base --is-ancestor` reaches `continue` at worktree.ts:411 before any write or delete, so the branch is neither deleted nor named. Wired: same entry as @ac-1. Data flows: the test makes a real commit after the merge on t/ST-9, runs `worktree clean`, and asserts empty output and that t/ST-9 still points at the extra commit. The test passed in junit.xml.

## @ac-4 Stale remote-tracking refs are pruned, and a failed fetch prunes nothing

Result: pass

Evidence: Exists: test at packages/cli/test/worktree.test.ts:781-815. Substantive: worktree.ts:322-323 runs `git fetch --no-prune origin`, then `pruneStale` (294-309) runs `git remote prune origin` only after that fetch succeeded; it names each removed ref as `pruned <ref> (was <sha>)`. A fetch failure is caught (324-327), prints one line `fetch from origin failed, judging against the refs already in this clone: ...`, and the prune is skipped. Wired: same entry as @ac-1; the fetch now runs whenever an `origin` remote exists (worktree.ts:321). Data flows: against a real bare remote, the good run removes `origin/t/ST-9` and the non-template `origin/backlog/notes` (`git branch -r`) and prints the two pruned lines with the real sha; the failed run points origin at a missing path, prints exactly the failure line plus the branch judgement against the old ref, and both remote-tracking refs remain. The test passed in junit.xml (66 files, 1346 tests, 0 failures per the report).
