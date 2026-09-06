---
status: complete
phase: 01-workspace-and-formats
source: [01-VERIFICATION.md]
started: 2026-09-06T02:50:00Z
updated: 2026-09-06T04:38:21.383Z
---

## Current Test

[testing complete]

## Tests

### 1. Four CI matrix legs green after push
expected: All four `ci` legs green on the first push that contains code. Node 22 leg may need `node-version: 22.18` if tsdown's engine check fails.
result: pass
evidence: https://github.com/ngothanhluan/accord/actions/runs/34011310570 (commit b60d3f5; ubuntu/windows x node 22/24 all green, no node-version pin needed)

### 2. README.md and docs/design.md §2–§5 read correctly for a newcomer
expected: Folder tree renders; roles paragraph is coherent; the Done gate names `verified` and the fresh-context review; nothing still describes a per-epic folder, a QA-owned tick, or a Lead role.
result: pass
note: issue reported and fixed inline; see G-01-2 (resolved)
reported: "file design.md loại bỏ mấy thứ như omc, speckit đi. tôi ko muốn sự so sánh ở đây."
severity: minor
fix: applied inline at user request (docs/design.md §1: tool names removed from the harness paragraph and the landscape paragraph); objective checks (folder tree, no per-epic folder, no QA-owned tick, no Lead role, Done gate names verified + fresh context) passed

### 3. The seven templates under packages/core/templates/ read correctly
expected: Guidance comments make sense for a BA, designer, and developer; the sample glossary and business-rule entries are acceptable placeholders (rounding and 30-day values are illustrative only).
result: pass
note: issue reported and fixed inline; see G-01-3 (resolved)
reported: "ok làm đi (accepted two findings: verification.md leaked an internal Phase 4 note; epic.md parent comment read as if an epic belongs to an epic)"
severity: minor
fix: applied inline at user request; npm run gen re-run; 64 tests pass

### 4. Decide the MVP-mode discrepancy on Phase 1
expected: ROADMAP.md marks Phase 1 `Mode: mvp` but its goal is not a User Story. Either run `/gsd-mvp-phase 1` to record a User Story goal, or clear `Mode:` on this infrastructure phase. Verification was done against the five ROADMAP success criteria.
result: pass
decision: option 1, cleared `Mode: mvp` on Phase 1 only in ROADMAP.md (infrastructure phase, no User Story); later phases keep their Mode line and are revisited when planned

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-01-2
  truth: "docs/design.md reads correctly for a newcomer with no tool comparisons"
  status: resolved
  reason: "User reported: file design.md loại bỏ mấy thứ như omc, speckit đi. tôi ko muốn sự so sánh ở đây."
  severity: minor
  test: 2
  resolved_by: inline edit to docs/design.md §1 during UAT (2026-09-06)
  artifacts:
    - path: "docs/design.md"
      issue: "named OMC, GSD, Spec Kit, OpenSpec, Kiro, Backlog.md, BMad, Decap in §1"
  missing: []

- gap_id: G-01-3
  truth: "The seven templates read correctly for a BA, designer, and developer"
  status: resolved
  reason: "User accepted findings: verification.md carried an internal Phase 4 note; epic.md parent comment misleading on an epic"
  severity: minor
  test: 3
  resolved_by: inline edit to packages/core/templates/{verification.md,epic.md} during UAT (2026-09-06)
  artifacts:
    - path: "packages/core/templates/verification.md"
      issue: "internal project-phase note in a user-facing template"
    - path: "packages/core/templates/epic.md"
      issue: "parent comment described an epic as belonging to an epic"
  missing: []
