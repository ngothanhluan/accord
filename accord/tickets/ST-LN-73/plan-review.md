# Plan review: ST-LN-73

## Round 1 (whole)

1. Must — D-06 sets both the memory per fork and the memory kept free from the measured peak, but the plan's RESERVE comes from a judgement ("Windows turns sluggish below about 2-3 GB free") and the CI fit, not from the measurement; a ledger Ruling cannot override a Decision — open, owner: "A" (D-09: 4 GB, set from the measurement and the 2026-10-30 stop)
2. Must — ac-5's Given and D-04 call for a recorded macOS vm_stat sample, and Task 2 commits a hand-written one under a Ruling; a question touching a criterion goes to the owner — owner: "A" (D-08 drops macOS and ac-5, after "I only develop accord on Windows.")
3. Should — the approach requires checking that the reserve plus one fork fits what a 16 GB CI runner has free after the build; no CI figure is recorded and no task checks it, so a runner with less than 4.6 GB free would wait until GitHub's 360-minute limit — open, owner: the ticket's own pull request CI on ubuntu-latest and windows-latest is checked at verify, instead of a one-off CI run
4. Nice — the risk:regression test never kills its spawned vitest on timeout, so a regression leaves an orphan that later takes the real lock — deferred
5. Nice — Task 1 step 2 calls `read()` without defining it, while test/lock.ts:34 already has a module-level `read(file)` — deferred
6. Nice — Task 2 marks test-memory.test.ts "(new)" though Task 1 creates it (the gate requires "(new)" relative to the baseline), and PER_FORK and RESERVE are exported for consumers that never import them — deferred
