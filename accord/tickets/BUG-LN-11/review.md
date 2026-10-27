# Review

## Round 1

Should 1 [patch]: the go-on rule for a failed `accord worktree push` was missing from plan step 8 and build steps 3 and 6, living only in worktree.md, which accord-plan and accord-build do not load (intent and quality lenses) — packages/core/skills/plan/SKILL.md:79, packages/core/skills/build/SKILL.md:49 — fixed in 5f022d8
Should 2 [patch]: commits with a forbidden line reached origin unchecked, so the only remedy was a reword plus a force-with-lease push (security lens) — packages/cli/src/commands/worktree.ts:544 — fixed in dcf5d67
Nice 3 [patch]: after a forbidden-line reword a plain push says "until the next push" but never succeeds; the lease instruction is only in worktree.md (security lens) — packages/cli/src/commands/worktree.ts:553 — deferred
