# Ledger

## Tasks

## Rulings

- Ruling: (architect) rule ids `gate.plan-verify-at` and `gate.plan-verify-comma` — they follow the `gate.plan-*` family and pass the id test — cost if wrong: one rename across rules, tests, and spec.
- Ruling: (architect) each finding carries the verify line's number, not the task heading's — it points at what to fix — cost if wrong: only the line number in the message changes.
- Ruling: (architect) a flagged chunk ending in a separator comma is named with that comma, as written (D-05) — cost if wrong: one character in the message.
- Ruling: (planner) fences come from running `scan` over one section's lines, not the whole body — a fence cannot cross a `## ` heading, so the result is the same and `PlanTask` gains no field — cost if wrong: comma-check findings could differ from what the parser reads on unusual fence layouts, which shows up in the risk test.
- Ruling: (planner) one extra test, `risk:parsing-the-comma-check-reads-the-first-verify-line-outside-a-fence` — it guards the reuse of the parser rule (fence skipped, list marker stripped, first match) and the line number — cost if wrong: one redundant test.
- Ruling: (planner) the finding messages are "...holds @, which splits its @test: tag; name the test and its path without @" and "...holds a comma, which splits it into two ids; name the test without a comma" — cost if wrong: message text and test strings change.
- Ruling: (planner) the spec §7 edit sits in Task 3, not with the code — cost if wrong: only which commit carries the doc change.
- Ruling: baseline tests at 9464130: 1163 passed, 0 failed; `accord/tests-baseline.txt` already exists, so step 7 asks no baseline question — cost if wrong: none.

## Deferred
