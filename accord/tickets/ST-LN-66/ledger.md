# Ledger: ST-LN-66

## Rulings

- Ruling: the variable is named `ACCORD_TEST_WORKERS` — the request names no variable, and the `ACCORD_` prefix keeps it apart from vitest's own `VITEST_*` names — cost if wrong: one rename in vitest.config.ts and its test.
- Ruling: the default is `max(1, floor(availableParallelism() / 2))`, 10 forks on a 20-thread host — "about half the CPUs" with at least one worker on a single-CPU runner — cost if wrong: runs a little slower or a little heavier than wanted.
- Ruling: an empty `ACCORD_TEST_WORKERS` counts as unset, and any other value that is not a positive whole number stops the run with an error naming the variable — a typo silently falling back to the default would hide that the cap was not applied — cost if wrong: a value like `50%` that vitest itself accepts is refused.
- Ruling: the cap lives only in the root vitest.config.ts — `maxWorkers` is a root option that applies to every project, so the two project configs and the CI workflow stay as they are — cost if wrong: none found; a run measured 10 forks at most by default and 3 with `ACCORD_TEST_WORKERS=3`.
- Ruling: the test imports `../../../vitest.config.js`, not `.ts` — `tsc -p packages/cli` refuses a `.ts` import path (TS5097), and vitest resolves `.js` to the `.ts` file — cost if wrong: none; typecheck and the test pass.
