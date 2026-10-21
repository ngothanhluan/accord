# Plan review: ST-LN-8

## Round 1 (whole)
1. Should — ac-5's promotion commits accord/product/conventions.md with verification.md after the ticks; gitRecordsSince lists it and onlyOwnRecords (packages/core/src/gate/done.ts:202) accepts only the ticket's own file and folder, so gate.tick-stale-commit and gate.stale-review fail in CI on every ticket that promotes a rule — fixed
2. Should — the Intent's success needs this repository's accord/config.yml `commits: { trailers: forbid }` and a conventions.md that forbids trailers, but the plan gives neither text, no point before review, and no check — fixed
3. Should — build step 3 has no route for the new task-done refusal (a forbidden line in the main session's own commit, or exit 2 for a missing origin ref), so the main session improvises or sends an executor to fix a commit it did not make — fixed
4. Should — five test phrases in Tasks 4 and 5 end in a double-backtick span whose trailing space the planned text does not have, so the ac-1 and ac-5 tests fail against the plan's own wording — fixed
5. Nice — Task 3 carries literal byte order mark characters; spell each one as a JavaScript escape so the BOM cases survive a filter — deferred
6. Nice — Task 1's "Must not change" names every case in packages/core/test/schemas.test.ts while its Interface edits the key list at :146 — deferred

## Round 2 (diff)
1. Should — Task 2 changes onlyOwnRecords (D-08) but docs/design.md:199 and docs/specs/2026-10-12-workflow-layer-design.md:428 still say only the ticket's own file and folder count, and its files: line names neither, so a reader sees the engine break its spec and may revert the fix — open
2. Nice — Task 2's test bullet says "the existing case the existing own-records case at line 434" — deferred
