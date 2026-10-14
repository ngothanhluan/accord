---
ticket: "BASE-1"
commit: "34eda7e7571e8a00936df2dbc4ff800debe98b5e"
reviewed_on: "2026-10-14"
---

## @ac-1 gate plan warns while the tests baseline is absent

Result: pass

Evidence: Exists: rule `gate.tests-baseline-missing` (level warning) registered at packages/core/src/gate/rules.ts; check `testsBaselineMissing` at packages/core/src/gate/plan.ts returns a finding only for a lane ticket with `tests.report` key present and `snapshot.testsBaseline` undefined. Substantive: the reason text says "ask the owner ... whether to run accord tests baseline", not an order. Wired: it is in the PLAN_RULES list that `gate plan` runs; the CLI test packages/cli/test/lane-commands.test.ts runs `gate plan` and sees exit 0 with the rule id in the output. Data flows: the test in packages/core/test/lane-plan.test.ts ("ac-1 ...") builds a snapshot, filters findings by rule, and asserts one warning, the file path, the reason text, and verdict pass. I ran the ac- tests with vitest: 3 files, 10 passed.

## @ac-2 gate plan is silent once the tests baseline exists

Result: pass

Evidence: the same check in packages/core/src/gate/plan.ts returns [] when `testsBaseline !== undefined`; the test "ac-2" adds `accord/tests-baseline.txt` with empty content to the snapshot and asserts no findings for the rule. It passed in my vitest run. It is wired through the same rule list as @ac-1, and the input is the loaded snapshot.

## @ac-3 gate plan is silent when no report is configured

Result: pass

Evidence: the check in packages/core/src/gate/plan.ts returns [] when `config.tests.report === undefined`. Test "ac-3" in packages/core/test/lane-plan.test.ts strips the `tests:` block from the config and asserts no findings for the rule; it passed. Wiring and data flow are the same as @ac-1.

## @ac-4 the plan skill asks the owner before creating the baseline

Result: pass

Evidence: Exists and substantive: packages/core/skills/plan/SKILL.md step 7 "Baseline tests" points to its baseline.md when `tests.report` is set and the file is absent. packages/core/skills/plan/baseline.md says to ask the owner before running `accord tests baseline` when the file is absent, and to ask only after the owner has decided every failing case. It says to commit in a commit of its own on a yes. It also says that when `tests.full` wrote no report, the skill must stop and tell the owner. Wired: the rendered copies exist in git and match their sources packages/core/skills/plan/SKILL.md and packages/core/skills/plan/baseline.md apart from the generated header. Data flows: the test "ac-4" in packages/core/test/stage-skills.test.ts reads the rendered output (`files` from the render), slices step 7, and asserts each phrase and their order. It passed.

## @ac-5 tests baseline refuses a report older than the last commit

Result: pass

Evidence: Exists and substantive: packages/cli/src/commands/tests-baseline.ts calls the exported `staleReport` from task-done.ts (git `%ct` of HEAD against the report mtime) when a commit exists. A stale report throws `UsageError`, which exits 2 with "was written before the last commit; run the tests again". The write happens after the check, so no file is created. Wired: the `tests baseline` command runs `testsBaseline`. Data flows: the test "ac-5" in packages/cli/test/lane-commands.test.ts commits, sets the report mtime to an old date, runs `tests baseline`, and asserts code 2, stderr containing "run the tests again", and no baseline file. It passed. A sibling test shows a fresh report writes the file (exit 0).
