---
status: testing
phase: 01-workspace-and-formats
source: [01-VERIFICATION.md]
started: 2026-09-06T02:50:00Z
updated: 2026-09-06T02:50:00Z
---

## Current Test

number: 1
name: Four CI matrix legs green after push
expected: |
  After committing and pushing to `main`, the GitHub Actions run named `ci` shows all four legs green: ubuntu-latest/22, ubuntu-latest/24, windows-latest/22, windows-latest/24. If a Node 22 leg fails on tsdown's engine check (^22.18), set that leg's `node-version` to `22.18`.
awaiting: user response

## Tests

### 1. Four CI matrix legs green after push
expected: All four `ci` legs green on the first push that contains code. Node 22 leg may need `node-version: 22.18` if tsdown's engine check fails.
result: [pending]

### 2. README.md and docs/design.md §2–§5 read correctly for a newcomer
expected: Folder tree renders; roles paragraph is coherent; the Done gate names `verified` and the fresh-context review; nothing still describes a per-epic folder, a QA-owned tick, or a Lead role.
result: [pending]

### 3. The seven templates under packages/core/templates/ read correctly
expected: Guidance comments make sense for a BA, designer, and developer; the sample glossary and business-rule entries are acceptable placeholders (rounding and 30-day values are illustrative only).
result: [pending]

### 4. Decide the MVP-mode discrepancy on Phase 1
expected: ROADMAP.md marks Phase 1 `Mode: mvp` but its goal is not a User Story. Either run `/gsd-mvp-phase 1` to record a User Story goal, or clear `Mode:` on this infrastructure phase. Verification was done against the five ROADMAP success criteria.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
