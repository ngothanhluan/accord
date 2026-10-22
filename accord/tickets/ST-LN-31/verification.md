---
ticket: "ST-LN-31"
commit: "941fc7e2619771c9aeaf2bb95621863fdf32b12e"
reviewed_on: "2026-10-22"
---

## @ac-1 A request is lifted from lane S to M only by the four conditions left

Result: pass

Evidence: Exists: packages/core/skills/accord/SKILL.md:70 holds the lift paragraph listing exactly four conditions (public interface or schema; auth, money or data deletion; more than one plausible reading; more than about five hand-written files, generated and rendered copies not counted). Test packages/core/test/stage-skills.test.ts:694 matches the @test tag. Substantive: it asserts the sentence appears once, that "user-visible" and "about three files" appear nowhere in the skill or lane-s.md. Wired: the test reads the rendered `.claude/skills/accord/SKILL.md` through the skill targets. Data flows: the text is the rendered output, not a constant. I ran `npx vitest run` on the three lane S test files: 48 passed. The caller's full suite had 0 failed.

## @ac-2 A lane S ticket is written and passes gate ready without acceptance criteria

Result: pass

Evidence: Exists: packages/core/templates/ticket-lane-s.md and packages/cli/test/lane-s.test.ts:9. Substantive: the test runs `new ticket S-1 --lane S` through runCli and checks that lane is S, a title exists, the only headings are "## Understood" and "## Done when", and there is no approved_hash. Lint has no error before and after filling. `gate ready` exits 1 with two gate.section-empty findings, one naming each section, and no gate.approval-missing. With one section filled it names only "## Done when". With both filled it exits 0 and writes ac_hash without approved_hash. Wired: all of this goes through the CLI commands. Data flows: the file contents it writes are what lint and gate read back. The test passed on my run.

## @ac-3 The dashboard lists a lane S ticket like any other ticket

Result: pass

Evidence: Exists: packages/cli/test/lane-s.test.ts:62. Substantive: it builds a ready lane S ticket (S-1) and a claimed one on branch t/S-2, then runs `dashboard --json` and the text output. S-1 appears in ready or upNext, S-2 in yours or team, and every row has lane "S". The text columns are `id, lane, title, stage, who, blocked by`, and the S-1 and S-2 rows read "S" in the lane column. Wired: the code is in packages/core/src/status/dashboard.ts and rows.ts, reached from the `dashboard` CLI command. Data flows: the lane is read from the ticket frontmatter into the row. The test passed on my run.

## @ac-4 Every lane S change is worked from its own lane S ticket

Result: pass

Evidence: Exists: packages/core/skills/accord/lane-s.md and the "S." bullet of packages/core/skills/accord/SKILL.md:73, which runs `accord new ticket <id> --lane S --worktree`. Pick up runs `accord worktree open <id>` (lane-s.md "Start"). The test is packages/core/test/stage-skills.test.ts:706. Substantive: lane-s.md covers all the points of the scenario. It works in the worktree and never in the main checkout. It fills Understood and Done when and passes `gate ready` before any change. It runs `tests.affected` over the changed files. For a bug it writes the reproducing test before the fix. Review runs in rounds with a fresh reviewer each, no final reviewer, and at most five rounds, then it stops and reports the open findings. It ends in a pull request, with no interview, approval, plan, executor or verify. The test checks about 30 phrases and their order, including the reviewer agent text. Wired: the SKILL.md Continue section points to `./lane-s.md` and `Lane: S`. The rendered copy .claude/skills/accord/lane-s.md is in the diff. Supporting code: `accord approve` refuses lane S, `gate done` is lane S specific, and review-package uses the fork-point base. The CLI risk tests for these passed. Data flows: this is a skill-text criterion, and the text is the rendered output. The test passed on my run.

## @ac-5 A queued lane M ticket that fits lane S drops to S at intent, and never after

Result: pass

Evidence: Exists: packages/core/test/lane-s.test.ts:125. The intent skill's "Lane S." rule and the "Moving to lane S" section of ids.md carry the drop procedure. The lint rule droppedApproved is in packages/core/src/lint/dropped.ts:15. Substantive: the skill text proposes the drop only when the ticket fits lane S, nothing depends on it, and the branch holds only its records. It drops "only on the owner's yes" via `accord drop <id> --reason "moved to lane S"`, and the work continues with `accord new ticket --lane S --worktree` under a new id. It says "From step 9 on, a lane never drops". The lane field is unchanged because the drop command only sets status and the Dropped section. Wired: the lint rule is registered in rules.ts and reached from `accord lint`. The test builds snapshots and asserts lint.dropped-approved is an error with approved_hash plus "moved to lane S", and absent without approved_hash or with another reason. Data flows: the lint reads real ticket frontmatter and sections. The test passed on my run.
