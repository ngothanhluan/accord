---
ticket: "BUG-LN-24"
commit: "3cf45078b27811c51cab420ed0b8b26517797aca"
reviewed_on: "2026-11-19"
---

## @ac-1 A plan edited after it passed the gate is refused with the build skill's way out

Result: pass

Evidence: Exists: packages/core/test/task.test.ts:63-73 holds the test `ac-1 a plan edited after it passed the gate is refused with the build skill way out`. Substantive: packages/core/src/gate/task.ts:20-24 returns the D-04 sentence word for word ("show the owner the diff of plan.md; if the owner made the change, accord-plan reviews it; otherwise restore plan.md with the owner's yes"), with no ticket id and no "accord gate plan". The test sets a wrong plan_hash, asserts verdict fail with that single reason, and asserts the joined reasons do not contain "accord gate plan". Wired: packages/cli/src/commands/task-done.ts:114 calls taskVerdict, and :128-132 prints the reasons verbatim and returns exit 1. Data flows: the reason comes from the plan.md hash comparison (plan.planHash vs plan.bodyHash) on the loaded snapshot, not a constant independent of the plan. The junit report node_modules/.cache/accord/junit.xml:7099 records the case with no failure. `grep "accord gate plan" packages/*/src` finds it only in the generated skill and agent text (D-05, out of scope), not in the refusal strings.

## @ac-2 A plan that never passed the gate sends the agent back to the plan stage

Result: pass

Evidence: Exists: packages/core/test/task.test.ts:75-82 holds `ac-2 a plan that never passed the gate is sent back to accord-plan`. Substantive: packages/core/src/gate/task.ts:19 returns "plan.md has no plan_hash: the plan stage has not finished; go back to accord-plan", which names accord-plan and not "accord gate plan". The test strips the plan_hash line, asserts the exact verdict, and asserts the phrase is absent. Wired and data flows: same caller path as ac-1 (packages/cli/src/commands/task-done.ts:114,128-132), driven by plan.planHash being undefined in the parsed plan. The junit report node_modules/.cache/accord/junit.xml:7101 records the case passed.

## @ac-3 A changed plan that accord-plan passes again is recorded as before

Result: pass

Evidence: Exists: packages/cli/test/lane-commands.test.ts:863 holds the renamed `ac-3 a passing gate plan writes plan_hash once and an edited plan that passes gate plan again is recorded done`. Substantive and data flows: it edits the plan and runs the real `task-done`, which exits 1 with "plan.md changed since its plan_hash was recorded" (:878). It then runs `gate plan` again, which exits 0. It then refreshes the report and runs `task-done`, which exits 0, and the ledger matches `- task 1 done <sha>` (:879-886). Wired: the test spawns the CLI commands against a real git repo, so the path is task-done.ts to taskVerdict to recordTaskDone. The junit report node_modules/.cache/accord/junit.xml:756 shows it passed, within the full suite run of 239 files, 3454 tests, exit 0, and no uncommitted changes in the worktree.
