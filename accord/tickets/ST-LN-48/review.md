# Review

## Round 1

Should 1 [patch]: the @ac-1 check's NFC reading and NUL-byte skip were tested nowhere — packages/cli/test/no-vietnamese.test.ts:19-20 — fixed in be1d626
Should 2 [patch]: a ticket whose fingerprint stopped matching dropped out of the ac-3 comparison silently — packages/core/test/stage-baseline.test.ts:43-47 — fixed in be1d626
Should 3 [patch]: the ac-3 test's header did not say what base-stages.json pins, how to regenerate it, or when fingerprints.json is retaken — packages/core/test/stage-baseline.test.ts:1 — fixed in be1d626
Should 4 [patch]: ST-LN-4 D-04's option rendered "ask you" where the Decision names the owner — accord/tickets/ST-LN-4.md:109 — fixed in 2b6e861
Nice 5 [patch]: owner misspellings "sessino" and "peermission" kept in English quotes; they were English in the source, not translated (ledger Ruling) — accord/tickets/ST-LN-27.md:89, accord/tickets/ST-LN-25.md:116 — deferred
Nice 6 [patch]: ST-LN-44 and ST-LN-46 are compared against efdf4fb only by the step 5 status diff — packages/core/test/fixtures/st-ln-48/fingerprints.json — deferred
Nice 7 [patch]: renamed ids traced by `@test:` or carrying `risk:` need no baseline line — accord/tests-baseline.txt:328 — deferred
Nice 8 [patch]: helper functions exported from test files though nothing imports them — packages/core/test/stage-baseline.test.ts:8 — deferred
Nice 9 [patch]: a comment still names Vietnamese letters as its example — packages/core/src/lint/ears.ts:4 — deferred
Nice 10 [patch]: two option labels read better reworded — accord/tickets/BUG-LN-2.md:85, accord/tickets/ST-LN-25.md:105 — deferred

## Round 2 (final review)

Should 1 [patch]: the strict compared count added in round 1 would turn main's suite red whenever a fingerprinted ticket's records change on purpose after merge — packages/core/test/stage-baseline.test.ts:46 — fixed in af7b6b4
Should 2 [patch]: the test pins today's stage logic and gave a later reader no way out when that logic changes on purpose — packages/core/test/stage-baseline.test.ts:1 — fixed in af7b6b4

verdict: converged
