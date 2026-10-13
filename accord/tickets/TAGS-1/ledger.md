# Ledger

## Tasks
- task 1 done 415134636d5f
- task 2 done 1bcd7b09e483
- task 3 done 68e6e38fed4b
- task 4 done 04075ee4e588

## Rulings

- Ruling: a malformed `(@ac-n` marker is left to dogfood item 3's lint, not handled here — that ticket rejects any `@` in a verify id, which covers it — cost if wrong: until item 3 ships, a malformed marker fails at task-done as a missing report id instead of at gate plan.
- Ruling: the tag writer ships in Task 1 with the wiring, not in a later task — the planner's rule puts end-to-end wiring first, and each task-done then writes its own tag with no re-run — cost if wrong: Task 1 is larger; the orchestrator commits the ticket with the ledger before Task 4 writes that into the build skill.
- Ruling: Task 3 marks write/testtag.ts and its test `(new)` although Task 1 creates them — gate plan resolves paths against the baseline, and `(new)` stays relative to it — cost if wrong: none; the gate's own message asks for it.
- Ruling: plan step 6's "at most three revision rounds" counts revisions, so round 3's findings get a third revision and one more critic round — the same reading STALE-1 used (dogfood item 9), and both open findings are local test-text defects — cost if wrong: one critic round more than the skill intended.
- Ruling: task-done reaches the plan's maps through `workOf(ctx.snapshot, id)?.plan`, the accessor taskVerdict already uses — the brief did not name one — cost if wrong: one line to swap. (executor, task 1)
- Ruling: the shared PLAN fixture's plan_hash becomes fnv1a64:061c24200fe9bbf9 — it follows from adding the markers, and work.test.ts checks it — cost if wrong: a one-line edit. (executor, task 2)
- Ruling: lane-commands.test.ts `atBaseline` strips plan_hash before writing the plan — MAPPED_PLAN now equals PLAN, so gate plan would write nothing and the next commit would be empty — cost if wrong: Task 1's tests go red on that empty commit. (executor, task 2)
- Ruling: on a recorded task whose verdict fails, task-done writes no tags and prints the already-recorded line as before — the brief's Interface — cost if wrong: none stated; review checks the order against the report's own description. (executor, task 3)
- Ruling: the build skill names "a verify: id marked (@ac-n)" in one clause — the brief's sync test requires the build copy to contain "(@ac-" — cost if wrong: one clause to trim. (executor, task 4)
- Ruling: a re-run of task-done on a recorded task with a tag left to fill, whose mapped test failed or is missing, exits 1 naming the test and the scenario and writes nothing; with no tag left to fill it keeps "already recorded" and exit 0 — the owner's reading of D-05, "Từ chối rõ ràng" — cost if wrong: one branch to revert.

## Deferred

- Nice (review round 1): a tag conflict on an already-recorded task prints "task N of ID is not done:" although the ledger records it done; the reason line still names @ac-n, U and T — packages/cli/src/commands/task-done.ts:57-59,64-66.
