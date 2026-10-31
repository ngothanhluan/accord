# Review

## Round 1

Should 1 [patch]: finish.md promises a removal at the next /clear, but the finishing session's own worktree is kept until that session ends — packages/core/skills/shared/finish.md:20-22 — fixed in 69313de8
Should 2 [patch]: worktree.md says every kept line names a file to move or delete, and never names the `note <id>:` lines; an agent may tell the owner to delete real work — packages/core/skills/accord/worktree.md:43-45 — fixed in 69313de8
Should 3 [patch]: a hook clean of another repository after a failed fetch judges with the launch checkout's `disposable` list and can delete an ignored file that repository does not list — packages/cli/src/commands/hook.ts:67-76 — fixed in 26bfdfd3
Nice 4 [patch]: the test helper `gone` re-implements leftover.ts `isGone` — packages/cli/test/helpers/done.ts:14 — deferred
Nice 5 [patch]: the unlink-then-rmdir link fallback is written twice — packages/cli/src/commands/leftover.ts:107-116 — deferred
Nice 6 [patch]: a test named `risk:regression` pins no past bug — packages/cli/test/worktree-clean.test.ts:771 — deferred
Nice 7 [patch]: cleanForgotten leaves the deleted folder's dead hold in the holds file — packages/cli/src/commands/worktree.ts:1138-1165 — deferred
Nice 8 [patch]: the holds snapshot is read once per clean while a clean may run about 300 s — packages/cli/src/commands/worktree.ts:923-949 — deferred
Nice 9 [patch]: file names are printed raw in kept lines and hook output; a newline forges a line — packages/cli/src/commands/worktree.ts:871 — deferred
Nice 10 [patch]: design.md and the READMEs still describe the old clean trigger — docs/design.md:201 — deferred

## Round 2

Should 1 [patch]: kept lines for a nested repository and for an edit git status hides look like a file to move or delete, so an agent may offer to delete a repository with unpushed commits — packages/cli/src/commands/worktree.ts:349 — fixed in 40eb0477
Should 2 [patch]: the hook cleans another repository without that repository's version pin check — packages/cli/src/commands/hook.ts:74-85 — fixed in 40eb0477

## Round 3

Should 1 [patch]: after the merge of origin/main (e8a1f846), the research-record kept line from ST-LN-13 is not among worktree.md's reasons where nothing is deleted, so an agent may offer to delete or move the research record the check protects — packages/core/skills/accord/worktree.md:43-48 — fixed in 433d47e9

verdict: converged
