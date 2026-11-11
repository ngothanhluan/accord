# Round 2 replica: the plan critic after the ST-LN-91 changes

This measures round 2 of the plan critic on three replicated merged tickets after the ST-LN-91 changes, not a whole ticket's life: approach rounds, the other plan rounds, build and review are not replayed. Old figures come from the tickets' records and the backed-up transcripts of the original round-2 runs; new figures come from one re-run each with the new critic prompt and rules, on the same plan text at the same base commit.

Old Must + Should (record) is what the ticket's plan-review.md recorded for round 2; (reply) counts the original critic's own reply. New would block counts the new reply's Musts and Shoulds that carry a ticket line, a risk tag, a test or a command, which the new rule blocks on; New would defer counts those that carry none, which it defers. Weighted tokens use the study weights (fresh 1, cache write 1.25, cache read 0.1, output 5), rounded per run before any sum; peak is the largest single message context.

| Ticket | Old Must + Should (record) | Old Must + Should (reply) | New Must + Should | New would block | New would defer | Old weighted k | New weighted k | Old peak k | New peak k |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ST-LN-8 | 1 | 1 | 1 | 1 | 0 | 242k | 304k | 75k | 77k |
| ST-LN-13 | 1 | 1 | 0 | 0 | 0 | 305k | 234k | 89k | 75k |
| ST-LN-48 | 3 | 3 | 1 | 1 | 0 | 489k | 728k | 102k | 138k |
| Total | 5 | 5 | 2 | 2 | 0 | 1036k | 1266k | - | - |

Fewer findings than the baseline: yes (2 against 5)
Fewer weighted tokens than the baseline: no (1266k against 1036k)
