---
ticket: "ST-LN-58"
commit: "9846495b5a1932545ddbf58b64f8b9124943cf9e"
reviewed_on: "2026-10-29"
---

## @ac-1 Every reference file of a rendered skill is named in its own SKILL.md

Result: pass

Evidence: Exists: packages/core/test/skills.test.ts (ac-1, helper expectEveryReferenceNamed over both rosters and both runtime dirs). Substantive: mentions are `./finish.md` in packages/core/skills/accord/SKILL.md, `./worktree.md` and `./ids.md` in debug/SKILL.md and verify/SKILL.md; the helper rejects subfolders and any file not named as `./name`. Wired: the test renders through skillTargets. Data flows: `npx vitest run packages/core/test/skills.test.ts packages/core/test/stage-skills.test.ts` at 9846495 gave 80 passed, 0 failed.

## @ac-2 The check fails on a skill folder that holds a file its SKILL.md does not name

Result: pass

Evidence: the ac-2 test in packages/core/test/skills.test.ts builds an in-memory `.claude/skills/accord-debug` folder with an unnamed `worktree.md`, runs the same helper as ac-1, and asserts the message holds the folder path and file name. It passed in the run above.

## @ac-3 Each new mention says when to read the file

Result: pass

Evidence: the ac-3 test in packages/core/test/skills.test.ts extracts the five sentences and requires a named step or event and no "when needed" wording; it also asserts MAX_SKILL_BYTES = 5120 and the 120-line cap on every rendered SKILL.md (rendered .claude/skills/accord-verify/SKILL.md is 5110 bytes, 71 lines; the 5143-byte source includes unrendered placeholders). The merge after the earlier verification changed accord/SKILL.md and approach/SKILL.md (git diff b0d3298 HEAD); the test still passes with these. Test passed.

## @ac-4 A lane M ticket moved to lane S at intent is changed in place

Result: pass

Evidence: the ac-4 test in packages/core/test/stage-skills.test.ts asserts the in-place move text in every ids.md render and the absence of drop, new-ticket and hand-off wording; it passed. I grepped `accord drop` in packages/core/skills: the only hits are packages/core/skills/accord/ids.md:41 and packages/core/skills/verify/ci.md:84, which concern dropping a ticket for other reasons, not a lane S move. The in-place move text is in packages/core/skills/accord/ids.md `## Moving to lane S`. The merge diff to lane-s.md and approach/SKILL.md adds only depends_on wording, not a hand-off.

## @ac-5 CI refuses a move to lane S only once intent was approved

Result: pass

Evidence: `npx vitest run packages/cli/test/workflow-script.test.ts -t ac-5` (ACCORD_BASH set to Git Bash) passed. Test at packages/cli/test/workflow-script.test.ts:730-769 runs both SCRIPT (accord init's) and ownScript() (.github/workflows/accord.yml) over six cases: pass with base unapproved, pass with the file absent at the base, fail approved at the base, fail approved only on the branch, fail with an empty-key value, fail with the approval on a merged side. Failures must exit 1 with "its lane cannot drop after approval". Both scripts use `git rev-list "$BASE..HEAD"` (.github/workflows/accord.yml:133, packages/core/src/scaffold/workflow.ts:177) and print the message at :185 and :229. Risk tests at :771 and :781 also cover unreadable frontmatter and off-line values. `dropped-approved` no longer appears in packages/*/src.
