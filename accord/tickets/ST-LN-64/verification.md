---
ticket: "ST-LN-64"
commit: "3abece11c6ad9f21eccdf9ac1a09fe9318815d38"
reviewed_on: "2026-10-29"
---

## @ac-1 The brief prints the task's affected test command as the only one to run

Result: pass

Evidence: Exists: packages/cli/src/commands/brief.ts:21-36 (testBlock) and the test at packages/cli/test/lane-commands.test.ts:1314. Substantive: files: paths are deduplicated in order (:24), each verify: prefix is appended only when it is a repository file or already on files: and not listed (:25-29), and every {files} is replaced via split/join with the paths joined by single spaces (:32). The line `ONLY` follows the command. Wired: `brief()` calls testBlock at brief.ts:57 and writes it to stdout. The test drives it through `run(['brief','T-1','2'])`, which is runCli. Data flows: the test builds a fixture config and plan, and expects the exact output `vitest related --run src/export.ts src/csv.ts test/csv.test.ts test/export.test.ts`. The paths come from the plan, not from constants. This matches the AC order, and src/csv.ts is not repeated. The JUnit report (not rerun) lists the testcase in the full run at HEAD, which had 0 failures.

## @ac-2 Without tests.affected the brief prints tests.full and says why

Result: pass

Evidence: Exists and substantive: brief.ts:34 prints `Test command: <tests.full>`, then ONLY, then FULL_WHY ("tests.full is printed because accord/config.yml has no tests.affected."). Wired: the same testBlock call at brief.ts:57. Data flows: `ctx.snapshot.config.tests.full` comes from config.yml. The test at lane-commands.test.ts:1340 writes only a full key and asserts the exact tail with code 0. The JUnit report lists it in the full run at HEAD, which had 0 failures.

## @ac-3 Without either command the brief says no test command is configured

Result: pass

Evidence: Exists and substantive: brief.ts:35 returns NO_COMMAND ("No test command is configured: accord/config.yml has no tests.affected and no tests.full."), and the function returns 0 at :58. Wired: brief.ts:57. Data flows: the test at lane-commands.test.ts:1356 uses a repo with no tests config, runs tasks 1 and 2, expects code 0, the NO_COMMAND tail, and no "Test command:". The risk:parsing test at :1371 also covers an empty path list and an empty affected value. The JUnit report lists these in the full run at HEAD, which had 0 failures.

## @ac-4 The executor's agent text forbids the full suite

Result: pass

Evidence: Exists and substantive: packages/core/agents/executor.md:16 and the committed .claude/agents/accord-executor.md:18 both hold the bullet. It says to run only the test command the brief prints, never to run `tests.full` on its own, that `tests.full` belongs to the plan's baseline run and to verify, and that it runs only when the brief prints it as the task's command. It also covers a brief that prints no command. I read both with grep. Wired: the test at packages/core/test/agents.test.ts:227 checks the core text, the agentTargets render for claude, codex, cursor and copilot, and the committed copy. It checks six phrases against each. Data flows: the rendered copies come from agentTargets over the real agents data. The JUnit report lists the test in the full run at HEAD, which had 0 failures.
