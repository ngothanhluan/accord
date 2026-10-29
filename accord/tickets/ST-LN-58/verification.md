---
ticket: "ST-LN-58"
commit: "b0d3298d539b97e5b566596bc6206e3cc86e719e"
reviewed_on: "2026-10-29"
---

## @ac-1 Every reference file of a rendered skill is named in its own SKILL.md

Result: pass

Evidence: Exists: packages/core/test/skills.test.ts:482-493 (ac-1) with the helper expectEveryReferenceNamed, run over ROSTERS (full and ba+dev) and both .claude/.agents dirs, asserting the five files are rendered. Substantive: the mentions are in packages/core/skills/accord/SKILL.md (`./finish.md`, lane S step), debug/SKILL.md (`./worktree.md` step 1, `./ids.md` step 7) and verify/SKILL.md (`./worktree.md` step 4, `./ids.md` step 5) (git diff origin/main...HEAD). Wired: the test renders through skillTargets. Data flows: `npx vitest run packages/core/test/skills.test.ts packages/core/test/stage-skills.test.ts` gave 78 passed, 0 failed.

## @ac-2 The check fails on a skill folder that holds a file its SKILL.md does not name

Result: pass

Evidence: packages/core/test/skills.test.ts:495-511 builds an in-memory folder `.claude/skills/accord-debug` with SKILL.md naming only `./failure.md` and a `worktree.md`. It asserts the thrown message holds the folder path and `worktree.md`, passes once the file is named, and reports a subfolder. It goes through the same helper as ac-1. The file passed in the run above.

## @ac-3 Each new mention says when to read the file

Result: pass

Evidence: packages/core/test/skills.test.ts:513-548 extracts the sentence around each of the five mentions and requires a named step or event ("step 6 of `./lane-s.md`", "When `./failure.md` runs `accord worktree open`", "at step 7", "at step 5") and no "when needed" wording. I read the same sentences in the git diff of the three SKILL.md files: they name those steps. The caps (5120 bytes, 120 lines) are asserted for every rendered SKILL.md in every roster. Test passed.

## @ac-4 A lane M ticket moved to lane S at intent is changed in place

Result: pass

Evidence: packages/core/test/stage-skills.test.ts:932 asserts, in every ids.md render of both rosters, the in-place move text. I read it in packages/core/skills/accord/ids.md (`## Moving to lane S`): refusal on an open question, `approved_hash`, or an approved_hash commit in the branch history; commit the records; set `lane: "S"`; replace Intent, Acceptance criteria, Open questions and Approach with Understood and Done when and Scope; keep Vetoes, Decisions, Corrections and other keys; commit, push, load accord at Continue step 2 in the same session. The test also asserts that no skill holds the drop, new-ticket or hand-off wording (`accord drop`, "moved from <id>", `Title:`/`Keys:`). The removal shows in the diffs of lane-s.md, worktree.md, accord/SKILL.md and intent/SKILL.md. The Rules line keeps "A lane never drops once its intent is approved". The test file passed. The .claude/skills copies are updated in the same commit.

## @ac-5 CI refuses a move to lane S only once intent was approved

Result: pass

Evidence: packages/cli/test/workflow-script.test.ts:730 runs both scripts (scaffold SCRIPT and .github/workflows/accord.yml through ownScript) over six real git histories. Pass cases: unapproved base, and absent at the base. Fail cases, each containing "its lane cannot drop after approval": approved at the base, approved only on the branch, empty-valued key, and approval on a merge side. A fail case must not reach `gate done`. The implementation is lane_dropped in packages/core/src/scaffold/workflow.ts and the matching hunk in .github/workflows/accord.yml: it reads the base, then each commit of `git rev-list "$BASE..HEAD"`, and fails closed on an unreadable read. I ran `npx vitest run packages/cli/test/workflow-script.test.ts -t "ac-5 both CI"` with ACCORD_BASH set to Git Bash: 1 passed (not skipped). Lint rule lint.dropped-approved is removed from packages/core/src/lint/rules.ts and dropped.ts (D-05 part 4).
