---
ticket: "BUG-LN-11"
commit: "aff2aecd9dfd5ffe4595eba7d908c2809a76dcff"
reviewed_on: "2026-10-28"
---

## @ac-1 A recorded build task reaches origin

Result: pass

Evidence: Exists: packages/cli/src/commands/worktree.ts:543-570 defines worktreePush, and packages/cli/test/worktree-push.test.ts:60 holds the ac-1 test, whose name matches the ticket's @test slug. Substantive: worktreePush runs `git push origin refs/heads/<branch>:refs/heads/<branch>` through gitNoPrompt and prints `pushed: <branch>`. Wired: packages/cli/src/run.ts:253-259 registers `worktree push <id>`. packages/core/skills/build/SKILL.md:23 (step 3, after task-done, the ticket and ledger commit) says to run `accord worktree push <id>` before the next dispatch. The rendered copy .claude/skills/accord-build/SKILL.md:22 and packages/core/src/generated/skills.ts carry the same line. The risk:regression test packages/core/test/stage-skills.test.ts:839 checks the order in every runtime copy. Data flows: I ran `npx vitest run test/worktree-push.test.ts` in packages/cli, and all 5 tests passed. The ac-1 test runs task-done, commits, and runs the push. The other clone then showed tasksDone 0 before the push, and after the push and a fetch its dashboard --json row equalled the own worktree's (build, 1 of 2). origin's ref equalled the tip commit. Limit: the push is made by the main session following the skill text, and no test observes that timing. The ticket's Approach names this as an accepted risk.

## @ac-2 Each stage change before build reaches origin

Result: pass

Evidence: Exists: the ac-2 test is at packages/cli/test/worktree-push.test.ts:95. Substantive: same worktreePush. The diff adds the push clause to the intent step 9 (packages/core/skills/intent/SKILL.md:62), approach step 5 (packages/core/skills/approach/SKILL.md:62) and plan step 8 (packages/core/skills/plan/SKILL.md:75). Each is "run `accord worktree push <id>`; go on even if it fails". Review is untouched, as D-04 requires, and stage-skills.test.ts:875 asserts that review never pushes. Wired: the rendered copies .claude/skills/accord-{intent,approach,plan}/SKILL.md contain the clause (grep confirmed). Data flows: the ac-2 test (passed in my run) pushes after the intent commit, the approach commit and the `plan: ST-9 ready` commit. After each push and fetch, the other clone's row equals the own worktree's. Before each push the other clone shows the older stage (intent, then plan). The three stages observed are intent, plan and build.

## @ac-3 A failed push does not stop the work

Result: pass

Evidence: Exists: the ac-3 test is at packages/cli/test/worktree-push.test.ts:140. Substantive: worktree.ts:547-569 catches a push error and prints `push of <branch> failed; its commits stay local until the next push` followed by git's stderr. It returns 0, so the exit code is 0. The skill clause and packages/core/skills/accord/worktree.md say to show the line and go on without stopping or asking the owner, which stage-skills.test.ts:850-855 checks. Wired: it is the same registered command and the same skill steps as ac-1 and ac-2. Data flows: in the test run, an unreachable remote gave exit 0, an empty stderr, the failure line, and git's "does not appear to be a git repository". The local commits stayed and origin was unchanged. After the remote was repaired, the next push left origin at the local tip, and the earlier commits were ancestors of it. The rejected (behind) push gave exit 0, the failure line and "[rejected]". After a merge, the next push succeeded and carried the earlier commit. The extra risk tests (force-with-lease on a reword, and the trailer-forbid refusal) also passed, 5 of 5.
