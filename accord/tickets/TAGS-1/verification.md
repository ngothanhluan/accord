---
ticket: "TAGS-1"
commit: "aa6263162222be22493e5d69f95a9b0985187095"
reviewed_on: "2026-10-13"
---

## @ac-1 task-done writes the tag of the scenario a verify entry proves

Result: pass

Evidence: Exists: test "ac-1 task-done writes the tag..." in packages/cli/test/lane-commands.test.ts; writer in packages/core/src/write/testtag.ts. Substantive: writeTestTags inserts ` @test:T` right after the `@ac-n` token. Wired: task-done.ts calls writeTestTags and then writeFileSync on the ticket. The maps come from parsePlan in load/work.ts, which reads the `(@ac-n)` marker. Data flows: the test asserts the file line `  @ac-1 @test:export#writes-csv`, and that the approved_hash, ac_hash and status stage are unchanged. The JUnit report at HEAD has this test with no failure. The report has 0 failures and 0 skips overall.

## @ac-2 gate plan fails when a scenario has no test mapped to it anywhere in the plan

Result: pass

Evidence: Exists: test in packages/core/test/lane-plan.test.ts. Substantive: testUnmapped in gate/plan.ts emits one reason per non-@ui scenario that has no map. Wired: registered in gate/rules.ts as gate.plan-test-unmapped, level error, profiles build and maintain. Data flows: the test asserts exact reasons for @ac-2 and @ac-3, built from maps parsed out of the plan text. It passes in the JUnit report.

## @ac-3 gate plan fails when a scenario is mapped more than once

Result: pass

Evidence: Exists: test in lane-plan.test.ts. Substantive: testRepeated groups maps by scenario and lists every test id, repeats included. Wired: gate.plan-test-repeated in rules.ts. Data flows: the test covers different tasks (`export#writes-csv, export#escapes-commas`) and the same id twice (`export#writes-csv, export#writes-csv`). It passes in the JUnit report.

## @ac-4 an unmapped verify id and an unmapped ui scenario need no tag

Result: pass

Evidence: Exists: test in packages/cli/test/lane-commands.test.ts. Substantive and data flows: the ticket makes @ac-2 @ui, and task 2's verify id has no marker. The atBaseline helper asserts that `gate plan` exits 0. The test then runs task-done for task 2 and asserts exit 0, a ledger line `task 2 done`, and the ticket text byte-identical. Wired: the same task-done and gate rules as @ac-1. The risk test also confirms that a map onto a @ui scenario fails (mapInvalid). It passes in the JUnit report.

## @ac-5 task-done never overwrites a different test tag

Result: pass

Evidence: Exists: test in lane-commands.test.ts. Substantive: in writeTestTags, an existing `@test:` tag that differs from T goes to `conflicts`. Wired: task-done.ts calls `refuse` on conflicts, returns 1, and does so before the ticket and ledger writes. Data flows: the test asserts exit 1, output containing `@ac-1`, `export#old-name` and `export#writes-csv`, the ticket text unchanged, and no ledger file. It passes in the JUnit report.
