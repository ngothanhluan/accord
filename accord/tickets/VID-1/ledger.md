# Ledger

## Tasks
- task 1 done 80908e67edf1
- task 2 done 56cb13124f75
- task 3 done 7f22d7ea14cd

## Rulings

- Ruling: (architect) rule ids `gate.plan-verify-at` and `gate.plan-verify-comma` — they follow the `gate.plan-*` family and pass the id test — cost if wrong: one rename across rules, tests, and spec.
- Ruling: (architect) each finding carries the verify line's number, not the task heading's — it points at what to fix — cost if wrong: only the line number in the message changes.
- Ruling: (architect) a flagged chunk ending in a separator comma is named with that comma, as written (D-05) — cost if wrong: one character in the message.
- Ruling: (planner) fences come from running `scan` over one section's lines, not the whole body — a fence cannot cross a `## ` heading, so the result is the same and `PlanTask` gains no field — cost if wrong: comma-check findings could differ from what the parser reads on unusual fence layouts, which shows up in the risk test.
- Ruling: (planner) one extra test, `risk:parsing-the-comma-check-reads-the-first-verify-line-outside-a-fence` — it guards the reuse of the parser rule (fence skipped, list marker stripped, first match) and the line number — cost if wrong: one redundant test.
- Ruling: (planner) the finding messages are "...holds @, which splits its @test: tag; name the test and its path without @" and "...holds a comma, which splits it into two ids; name the test without a comma" — cost if wrong: message text and test strings change.
- Ruling: (planner) the spec §7 edit sits in Task 3, not with the code — cost if wrong: only which commit carries the doc change.
- Ruling: baseline tests at 9464130: 1163 passed, 0 failed; `accord/tests-baseline.txt` already exists, so step 7 asks no baseline question — cost if wrong: none.
- Ruling: (planner) the file check in the CLI tests matches a line of rendered `out` that starts with `accord/tickets/T-1/plan.md:` and contains the rule id — the CLI tests only see text output, and the renderer's `file[:line]:` prefix is established — cost if wrong: three assertions change if the prefix changes.
- Ruling: (planner) ac-4's positive control sits inside the ac-4 test, not in a separate risk test — it makes ac-4 observe the rule id, and a separate test would repeat ac-3 at the core layer — cost if wrong: ac-4 asserts absence and one presence.
- Ruling: (executor, task 3) the executor bullet's first source line is longer than the wrapped lines around it — the D-06 sentence must sit whole on one source line for the verbatim test — cost if wrong: cosmetic only.
- Ruling: title set from the template placeholder to "Gate plan rejects verify ids holding an at sign or a comma", found by the final review — `approved_hash` covers sections only, not the title, so no new approval is needed — cost if wrong: one frontmatter line.

## Deferred

- Nice (plan critic round 1): `verify: a#x (@ac-1),b#y` names `(@ac-1),b#y` with "name the test without a comma", when the fix is a space after the separating comma; rejecting it follows D-01, the advice misleads.
- Nice (plan critic round 1): nothing fails when `skills sync` is skipped after gen and build; the committed `.claude/agents` copies would lack the D-06 sentence while ac-5 reads the in-memory render.
- Nice (plan critic round 2): a mistyped marker such as `(@ac-01)` stays a verify id and gets the at-sign error telling the planner to rename a test, when the fix is the marker; rejecting it follows D-03, the advice misleads.
- Nice (review round 1): `verifyAt` in `packages/core/src/gate/plan.ts` calls `fieldLines(task.lines)` once per flagged id inside the map; it could be hoisted, same result.
- Nice (review round 1): `verifyComma` sits out of alphabetical order in the import list of `packages/core/src/gate/rules.ts`.
