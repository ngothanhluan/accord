# Review: ST-LN-67

## Round 1

1. Nice — packages/cli/test/test-lock.test.ts:164-166 — the stale-lock test collects the waiting lines and never asserts on them, so a change that printed the waiting line for a dead holder would still pass.
2. Nice — packages/cli/test/test-lock.test.ts:138,146 — the two-runs test relies on both children starting within the 1.5 s hold; under heavy load the second could start after the first released, never wait, and fail the `[0, 1]` assertion.

## Round 2

1. Nice — test/lock.ts:318-324, 249 — on a POSIX host with a shared sticky /tmp, a stale lock left by another OS user cannot be removed; `takeOver` rethrows EPERM/EACCES and the next run's globalSetup fails.

## Round 3

1. Nice — test/lock.ts:347 — a live process is never treated as stale however old the lock is, so a killed run's pid reused by an unrelated long-lived process makes later runs wait until the lock file the waiting line names is deleted; the ledger Ruling already accepts this cost.
2. Nice — packages/cli/test/vitest-config.test.ts:237-239 — the globalSetup assertion repeats the config literal; it still catches a deleted wiring and matches the sibling pool and maxWorkers test.

verdict: converged
