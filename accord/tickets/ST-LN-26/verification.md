---
ticket: "ST-LN-26"
commit: "556971edf607c3dfa7dc18e6797ccc5964a0dd1d"
reviewed_on: "2026-10-21"
---

## @ac-1 A failure someone reports after verify goes to debug before any fix

Result: pass

Evidence: Exists: the routing is skill text in packages/core/skills/accord/SKILL.md (pointer to `./failure.md`), the shared failure.md, packages/core/skills/debug/SKILL.md, and the agent files debugger.md and executor.md. Substantive: packages/core/test/stage-skills.test.ts:468 pins the report line before `## Dashboard`, identical failure.md copies, "Never judge the cause yourself", "never dispatch a fix outside `accord-debug`", the debugger finding the failing command and output itself, and `gh run view <run-id> --log-failed`. Wired: the test reads the rendered copies (`.claude/skills/...`, `.claude/agents/accord-debugger.md`) that the skill and agent targets produce, so the text reaches installed files; verify loads the shared failure.md. Data flows: node_modules/.cache/accord/junit.xml (failures="0" errors="0", 1393 tests) holds the passing testcase "ac-1 a failure reported after verify goes to the debug stage before any fix"; the console output shows 1390 passed, 3 skipped. A model following the text is not provable in a test; that is the ticket's own kept risk.

## @ac-2 Verify runs the pull request's CI alongside its own checks and reports it before the owner's tick

Result: pass

Evidence: Exists: packages/core/skills/verify/ci.md and packages/core/skills/verify/SKILL.md steps 2, 4 and 6. Substantive: packages/core/test/stage-skills.test.ts:527 checks the order Start CI before `tests.full`, the report waiting for CI, a failed check going to failure.md, `gh pr create --draft --fill`, an open pull request left alone, a no-change push reusing results, `gh run list --commit <sha>`, the accord workflow neither waited for nor sent to debug, the ten and thirty minute limits, cancelled/skipped going to no debug, local lint and `gate done` before `gh pr ready`, and the no-remote and gh-auth cases reported as CI not checked. Wired: the text is read from the rendered verify copies. Data flows: the testcase passes in the junit report. Limit: live gh and CI behaviour was not run (skill text read by a model); the ticket's hand check at its own verify was not done by me.

## @ac-3 A change after verify takes the ticket back from done until it is verified again

Result: pass

Evidence: Exists: packages/cli/src/load/fs.ts:329-340 (`gitAfterVerify`, one `git log` with `--remerge-diff` and the retry for old git), packages/core/src/status/stage.ts, and gate/done.ts `onlyOwnRecords`. Since the earlier verification, `git diff 0c2c7f3 HEAD` on fs.ts and review-package.ts shows only the added `-c log.showSignature=false` and `--no-show-signature` flags (fs.ts:78, 94, 332, 376, 632, 698) and a `gitLog` helper in review-package.ts; the log arguments and the parsing are unchanged, so behaviour is the same for unsigned history and a signed HEAD no longer alters the output. Substantive: packages/core/test/lane-status.test.ts:219 covers records-only (done), a fix (review, anchor base), a recorded review round (verify), a later fix (review), a merge with no file change (verify), a merge with a source change (review), a later verification.md, and a first verify; the conventions.md case (D-10) has its own test; packages/cli/test/after-verify.test.ts is the temp-repo test of the git fact, and packages/cli/test/load.test.ts gained a signature test. Wired: fs.ts passes `afterVerify` into the snapshot used by status and anchor. Data flows: all of these pass in the junit report (0 failures).

## @ac-4 The owner's report names the tests the verify run skipped

Result: pass

Evidence: Exists: packages/cli/src/commands/tests-skipped.ts, imported at packages/cli/src/run.ts:26 and called at :204. Substantive: packages/cli/test/lane-commands.test.ts "ac-4 tests skipped prints every case the report records as skipped with the operating system" runs the command on a junit fixture and expects the platform line, both skipped ids sorted, refusal of a report older than HEAD (exit 2), `: 0` for none, and refusal without tests.report; it passes in the junit report. Wired: verify SKILL.md runs it right after the full suite and puts every printed test in the report with its operating system; stage-skills.test.ts pins both. Data flows: the ids come from the parsed report file. The current junit report itself records 3 skipped cases (publish-workflow, workflow-script, worktree), matching the console's "3 skipped".

## @ac-5 An assertion that runs only on some operating systems sits in a test the runner skips

Result: pass

Evidence: Exists and substantive: packages/core/test/stage-skills.test.ts:436 pins the executor rule and the reviewer finding line against the rendered `.claude/agents/accord-executor.md` and `accord-reviewer.md`, and scans every .ts file under packages/core/test, packages/cli/test and test for `process.platform`, failing on any line without `.skipIf(` or `.runIf(`. I ran a grep for `process.platform` over packages/*/test and test, excluding lines with skipIf or runIf: nothing was left. Wired: the test reads the repository's real test files. Data flows: the former early returns are runner skips; the junit report lists them as skipped (publish-workflow, workflow-script, worktree testcases) and the ac-5 testcase passes.
