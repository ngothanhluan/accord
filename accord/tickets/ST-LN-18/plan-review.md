# Plan review

## Round 1 (whole)
1. Should — Task 1's @ac-1 text check can be read as "exactly one line in the UP NEXT block contains ST-AN-1", but the ST-AN-2 row also prints ST-AN-1 in its `blocked by` column (`packages/cli/src/render/dashboard.ts:29`), so a test copying the EPICS `toHaveLength(1)` idiom (`dashboard.test.ts:267`) stays red after the correct change; say "some line starts with `  ST-AN-1`" (and `  ST-AN-2`) — fixed
2. Nice — the ST-LN-2 ledger pointer does not name D-06's "a section that does not apply is absent from the JSON", which no longer holds for `upNext` — deferred

## Round 2 (diff)
No findings

## Closed
