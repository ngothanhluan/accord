# Review: ST-LN-61

## Round 1

1. Should — intent — docs/design.md:161 still says "The CLI ranks and caps every section", while the dashboard now prints every row.
2. Nice — quality — packages/cli/test/dashboard.test.ts: no test observes EPICS uncapped; re-adding `rows.slice(0, 20)` in `epicsSection` passes every test.

## Round 2

No findings

verdict: converged
