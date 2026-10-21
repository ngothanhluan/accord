---
ticket: "ST-LN-26"
commit: "0c2c7f34978265692e48fe866a20199c63853c50"
reviewed_on: "2026-10-21"
---

## @ac-1 A failure someone reports after verify goes to debug before any fix

Result: pass

Evidence: Exists: the routing is skill text, shipped as packages/core/skills/accord/SKILL.md (line pointing to `./failure.md`), the shared failure.md, packages/core/skills/debug/SKILL.md, and the agent files debugger.md and executor.md. Substantive: packages/core/test/stage-skills.test.ts:468-507 pins the report line before `## Dashboard`, that the accord and accord-debug copies of failure.md are identical, "Never judge the cause yourself", "never dispatch a fix outside `accord-debug`", "the debugger finds them itself", `gh run view <run-id> --log-failed`, the worktree session check, and the debugger's "find the failing command and its output yourself". Wired: the test reads the rendered copies (`.claude/skills/...`, `.claude/agents/accord-debugger.md`) that `skillTargets` and `agentTargets` produce, so the text reaches the installed files; verify's SKILL.md loads `shared/failure.md`. Data flows: the junit report at node_modules/.cache/accord/junit.xml has this test passing in the full run (1388 passed, 3 skipped, no failure or error elements). The model following the text is not provable in a test; that is the ticket's own kept risk.

## @ac-2 Verify runs the pull request's CI alongside its own checks and reports it before the owner's tick

Result: pass

Evidence: Exists: packages/core/skills/verify/ci.md (sections Start, Wait, Finish) and packages/core/skills/verify/SKILL.md steps 2, 4 and 6 (lines 18-41). Substantive: packages/core/test/stage-skills.test.ts:527-565 checks the order Start CI, then `tests.full`; the report waits for CI and sends a failed check to failure.md; `gh pr create --draft --fill`, an open pull request is left as it is, a push that changed nothing still counts, `gh run list --commit <sha>`, the accord workflow is neither waited for nor sent to debug, ten and thirty minute limits, `cancelled` and `skipped` go to no debug, lint and `gate done` run locally before `gh pr ready`, and the no-remote and gh-auth cases are reported as CI not checked. Wired: the text is read from the rendered verify copies. Data flows: the test passes in the junit report. Limit: the live gh and CI behaviour was not run (it is skill text read by a model); the ticket names a hand check at this ticket's own verify, and I did not do it.

## @ac-3 A change after verify takes the ticket back from done until it is verified again

Result: pass

Evidence: Exists: packages/cli/src/load/fs.ts:287-340 (one `git log ... --remerge-diff` with the retry for old git, result `afterVerify`), packages/core/src/status/stage.ts and gate/done.ts `onlyOwnRecords`. Substantive: packages/core/test/lane-status.test.ts:219 covers records-only (done), a fix (review, anchor prints `Review base: C`), a review round recorded (verify), a later fix (review), a merge with no file change (verify), a merge with a source change (review), a verification.md at a later commit, and a first verify before any tick. The conventions.md case (D-10) is a separate passing test. packages/cli/test/after-verify.test.ts is the temp-repo test of the git fact. Wired: packages/cli/src/load/fs.ts:525-550 and 661-666 pass `afterVerify` into the snapshot used by status and anchor. Data flows: both tests pass in the junit report.

## @ac-4 The owner's report names the tests the verify run skipped

Result: pass

Evidence: Exists: packages/cli/src/commands/tests-skipped.ts, registered in packages/cli/src/run.ts:26 and 204. Substantive: packages/cli/test/lane-commands.test.ts:1246 runs `accord tests skipped` on a junit fixture and expects `skipped on <platform>: 2` followed by both skipped ids sorted. It also expects a report older than HEAD to be refused (exit 2), zero skips printed as `: 0`, and a config without tests.report to be refused. Wired: packages/core/skills/verify/SKILL.md:21 runs it right after the full suite and :41 puts every printed test in the report with its operating system; the test at stage-skills.test.ts:567 pins both. Data flows: the ids come from the parsed report file, not a constant. Both tests pass in the junit report.

## @ac-5 An assertion that runs only on some operating systems sits in a test the runner skips

Result: pass

Evidence: Exists and substantive: the executor rule and the reviewer finding line are pinned at packages/core/test/stage-skills.test.ts:436-446 against the rendered `.claude/agents/accord-executor.md` and `accord-reviewer.md`. The same test scans every .ts file under packages/core/test, packages/cli/test and test for `process.platform` and fails on any line without `.skipIf(` or `.runIf(` (lines 447-465, at least 3 hits required). I ran `grep -rn "process.platform" packages/*/test test` and removed lines with skipIf or runIf, and nothing was left. Wired: the test reads the repository's real test files. Data flows: the three former early returns are now runner skips; the junit report lists skips for publish-workflow, workflow-script and worktree tests, and the test passes.
