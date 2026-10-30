# Review: ST-LN-73

## Round 1

Nice 1 [patch]: `gb()` rounds to one decimal, so with 4.96 GB free the wait line reads "5 GB free, 5 GB needed" while the run still waits — test/lock.ts:717 — deferred

## Round 2

Nice 1 [patch]: the header comment says a CI runner never waits, but CI's `npm test` now waits for free memory too — test/lock.ts:3 — deferred
Nice 2 [patch]: `setup` copies `acquire`'s default writer and poll instead of sharing one default — test/lock.ts:170 — deferred

verdict: converged
