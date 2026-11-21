---
ticket: "BUG-LN-24"
commit: "8cc44e4839e546b1438758e1d78854cdd50fb0f8"
reviewed_on: "2026-11-21"
---

## @ac-1 A plan edited after it passed the gate is refused with the build skill's way out

Result: pass

Evidence: Exists: packages/core/test/task.test.ts:63-73 holds the test `ac-1 a plan edited after it passed the gate is refused with the build skill way out`, and its id matches the ticket's @test tag. Substantive: packages/core/src/gate/task.ts:20-24 returns the D-04 sentence word for word ("show the owner the diff of plan.md; if the owner made the change, accord-plan reviews it; otherwise restore plan.md with the owner's yes"), with no ticket id and no "accord gate plan"; the test sets a wrong plan_hash, asserts the verdict equals fail with that single reason, and asserts the joined reasons do not contain "accord gate plan". Wired: packages/cli/src/commands/task-done.ts calls taskVerdict (the verdict line before `const reasons = [...verdict.reasons, ...]`) and prints the reasons verbatim with exit 1. Data flows: the branch is taken by the comparison plan.planHash !== plan.bodyHash on the loaded snapshot, not a constant. Run at HEAD 8cc44e48: `npx vitest run test/task.test.ts` in packages/core, 10 passed; node_modules/.cache/accord/junit.xml (06:58, fresh) records the case with no failure. `grep "accord gate plan" packages/core/src packages/cli/src` matches only the generated skills.ts and agents.ts text, out of scope under D-05, not the refusal strings.

## @ac-2 A plan that never passed the gate sends the agent back to the plan stage

Result: pass

Evidence: Exists: packages/core/test/task.test.ts:75-82 holds `ac-2 a plan that never passed the gate is sent back to accord-plan`, matching the ticket's @test tag. Substantive: packages/core/src/gate/task.ts:19 returns "plan.md has no plan_hash: the plan stage has not finished; go back to accord-plan" (D-04), with no "accord gate plan"; the test strips the plan_hash line, asserts the exact single reason, and asserts the absence of "accord gate plan". Wired: the same task-done.ts call as ac-1 prints the reason with exit 1; the plan_hash check comes before the hash comparison in taskVerdict. Data flows: the branch is taken by plan.planHash === undefined parsed from the real plan.md. Run: packages/core `vitest run test/task.test.ts` 10 passed; junit.xml has the case with no failure.

## @ac-3 A changed plan that accord-plan passes again is recorded as before

Result: pass

Evidence: Exists: packages/cli/test/lane-commands.test.ts:863 is the renamed `ac-3 a passing gate plan writes plan_hash once and an edited plan that passes gate plan again is recorded done`, matching the ticket's @test tag. Substantive: it commits a plan, runs `gate plan` (exit 0, plan_hash written once, file unchanged on a second run), edits the plan, asserts task-done exits 1 containing "plan.md changed since its plan_hash was recorded", runs `gate plan` again (exit 0), writes a fresh passing report, then asserts task-done exits 0 and the ledger has `- task 1 done <sha>` (lines 875-885). Wired: it drives the real CLI through `run([...])`, so command, gate and taskVerdict are all exercised; the unchanged pass path in taskVerdict (packages/core/src/gate/task.ts:25 onward) is the one reached. Data flows: the real plan.md hash, the real report and the written ledger file are read back. Run: packages/cli `vitest run test/lane-commands.test.ts -t ac-3` passed (4 passed, 80 skipped by filter); junit.xml:104 records the case with no failure. Scope: the full suite was not run locally; the ledger's last Ruling sends it to CI on the pull request, and the two ticket test files pass at this commit.
