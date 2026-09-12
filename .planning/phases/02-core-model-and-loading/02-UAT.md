---
status: testing
phase: 02-core-model-and-loading
source: [02-VERIFICATION.md]
started: 2026-09-06T08:25:00Z
updated: 2026-09-06T08:25:00Z
---

## Current Test

number: 1
name: Ubuntu CI legs pass with committed goldens unchanged
expected: |
  After committing and pushing to `main`, the GitHub Actions run named `ci` is green on all four legs
  (ubuntu-latest/22, ubuntu-latest/24, windows-latest/22, windows-latest/24). In particular
  `packages/core/test/snapshot.test.ts` (five fixture goldens), `packages/core/test/write.test.ts`
  (three Markdown goldens), and `packages/cli/test/load.test.ts` (parity with `valid-build.snapshot.json`
  from a real `git ls-files` tree) pass on Ubuntu with the goldens unchanged (ROADMAP criterion 4, D-54).
awaiting: user response

## Tests

### 1. Ubuntu CI legs pass with committed goldens unchanged
expected: After committing and pushing to `main`, the `ci` run is green on ubuntu-latest/22 and /24 alongside both Windows legs; snapshot, write, and CLI parity goldens pass on Ubuntu unchanged (ROADMAP criterion 4, D-54).
result: [pending]

### 2. `git` absent from PATH raises UsageError
expected: On a shell where `git` is not on PATH, `loadFromFs(<any dir>)` throws `UsageError` with message `git is required but was not found on PATH` and `exitCode` 2, with no shell involved (ENOENT branch of `gitTree` in `packages/cli/src/load/fs.ts`).
result: [pending]

### 3. Resolve the MVP-mode record for Phase 2
expected: ROADMAP.md marks Phase 2 `Mode: mvp` but the goal is not in User Story form. Either record a User Story goal via `/gsd-mvp-phase 2`, or clear `Mode:` on the infrastructure phases. Same open item as Phase 1 human item 4.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
