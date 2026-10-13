# Ledger

## Tasks

## Rulings

- Ruling: a malformed `(@ac-n` marker is left to dogfood item 3's lint, not handled here — that ticket rejects any `@` in a verify id, which covers it — cost if wrong: until item 3 ships, a malformed marker fails at task-done as a missing report id instead of at gate plan.
- Ruling: the tag writer ships in Task 1 with the wiring, not in a later task — the planner's rule puts end-to-end wiring first, and each task-done then writes its own tag with no re-run — cost if wrong: Task 1 is larger; the orchestrator commits the ticket with the ledger before Task 4 writes that into the build skill.
- Ruling: Task 3 marks write/testtag.ts and its test `(new)` although Task 1 creates them — gate plan resolves paths against the baseline, and `(new)` stays relative to it — cost if wrong: none; the gate's own message asks for it.
