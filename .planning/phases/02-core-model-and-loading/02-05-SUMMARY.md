---
phase: 02-core-model-and-loading
plan: 05
subsystem: core-loader
tags: [verification, evidence, snapshot, golden, vitest]

requires:
  - phase: 02-core-model-and-loading
    provides: "02-01 parseVerification, loadSnapshot classification, readFixture helper, per-fixture describe loop"
provides:
  - "verification-edges fixture: 3 tickets (one without frontmatter), 4 records (one invalid frontmatter, one orphan), 3 stray files"
  - "verification-edges golden pinning D-42 result/evidence shapes, D-32 and D-40 applied to records, D-37 orphan and silent ignore"
  - "verification.test.ts: 12 exact-line assertions over the fixture plus two inline parseVerification cases"
affects: [02-07, phase-3-lint, phase-4-gates]

actuals:
  tokens: 4483
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Edge fixtures are named by the decision they pin; the test loads the fixture once in beforeAll and filters errors by file and rule"

key-files:
  created:
    - packages/core/test/verification.test.ts
    - packages/core/test/__golden__/verification-edges.snapshot.json
    - packages/core/test/fixtures/verification-edges/ (12 files)
  modified: []

key-decisions:
  - "No change to load/verification.ts or load/snapshot.ts: every expectation in the plan held against the 02-01 code as written"
  - "Result: values are case-sensitive lowercase; PASS is load.result-invalid (plan's flagged assumption, pinned)"
  - "A Result: line after Evidence: still counts as the result and also stays inside the evidence text (plan's flagged assumption, pinned)"

patterns-established:
  - "Golden creation scoped with -t \"fixture <name>\" so sibling goldens are never rewritten; the tracer golden hash is checked before and after"

requirements-completed: [CORE-06]

coverage:
  - id: D1
    description: "Each @ac-n block yields one EvidenceBlock keyed by tag; missing, misspelt, or wrong-case Result: is load.result-invalid at the block or Result: line with result absent; evidence is comment-stripped, trimmed, possibly empty"
    requirement: CORE-06
    verification:
      - kind: unit
        ref: "packages/core/test/verification.test.ts#Result and Evidence edges on one record (D-42)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A duplicated @ac-1 heading is load.heading-duplicate at the second heading; the first block is kept; a non-tag heading is no block"
    requirement: CORE-06
    verification:
      - kind: unit
        ref: "packages/core/test/verification.test.ts#a non-tag heading is no block; a duplicated tag is load.heading-duplicate at the second heading (D-40)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A record with invalid frontmatter keeps its blocks, has frontmatter absent, and carries the schema finding at the offending line"
    requirement: CORE-06
    verification:
      - kind: unit
        ref: "packages/core/test/verification.test.ts#a record with invalid frontmatter keeps its blocks and has frontmatter absent (D-32)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Orphan record is exactly one load.verification-orphan with no line and is still loaded; a record for a broken ticket is not an orphan; stray files are in tree with no entry and no finding"
    requirement: CORE-06
    verification:
      - kind: unit
        ref: "packages/core/test/verification.test.ts#folder convention (D-37)"
        status: pass
      - kind: unit
        ref: "packages/core/test/snapshot.test.ts#fixture verification-edges > matches the golden"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-06
status: complete
---

# Phase 2 Plan 05: Verification Records and Folder Convention Summary

**Every `Result:`/`Evidence:` shape from D-42, a broken record frontmatter, a duplicated `@ac-n` block, an orphan record, and three stray files are pinned by one fixture, one golden, and 12 exact-line tests; the 02-01 loader needed no change.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-06T07:50:00Z
- **Completed:** 2026-09-06T07:56:37Z
- **Tasks:** 2
- **Files modified:** 14 (staged, uncommitted)

## Accomplishments

- `verification-edges` fixture: ticket A with a four-block record (valid pass with a comment inside the evidence, missing `Result:`, `Result: PASS`, `blocked` with no `Evidence:` label, a `## Notes` heading, a second `## @ac-1`), ticket B with a record whose `commit: xyz` fails the schema pattern, ticket C with no frontmatter but a valid record, an `ORPHAN` record, and `tickets/A/plan.md`, `tickets/notes.txt`, `assets/A/prototype.html`.
- Golden `verification-edges.snapshot.json`: six findings in file order (`heading-duplicate` 31, `result-invalid` 16 and 22, `schema.pattern` `/commit` 3, `frontmatter-missing` 1, `verification-orphan` with no line); `tickets` keys `A B C`; `verifications` keys `A B C ORPHAN`.
- `verification.test.ts`: 12 tests. Ten over the fixture, two over inline records (trailing blank lines trimmed; `Result:` after `Evidence:`).
- The tracer golden `valid-build.snapshot.json` hash is `855db6c7` before and after; `-u` was run once, scoped with `-t "fixture verification-edges"`.

## Prepared Commits

Nothing was committed. Every file is staged; the owner reviews and commits.

1. `test(02-05): pin D-42 Result and Evidence edges and a broken record frontmatter`
   - packages/core/test/verification.test.ts, packages/core/test/fixtures/verification-edges/accord/config.yml, packages/core/test/fixtures/verification-edges/accord/tickets/A.md, packages/core/test/fixtures/verification-edges/accord/tickets/A/verification.md, packages/core/test/fixtures/verification-edges/accord/tickets/B.md, packages/core/test/fixtures/verification-edges/accord/tickets/B/verification.md
2. `test(02-05): pin D-37 orphan, broken-ticket owner, and ignored files with the verification-edges golden`
   - packages/core/test/verification.test.ts, packages/core/test/__golden__/verification-edges.snapshot.json, packages/core/test/fixtures/verification-edges/accord/tickets/C.md, packages/core/test/fixtures/verification-edges/accord/tickets/C/verification.md, packages/core/test/fixtures/verification-edges/accord/tickets/ORPHAN/verification.md, packages/core/test/fixtures/verification-edges/accord/tickets/A/plan.md, packages/core/test/fixtures/verification-edges/accord/tickets/notes.txt, packages/core/test/fixtures/verification-edges/accord/assets/A/prototype.html
3. `docs(02-05): complete verification records and folder convention plan`
   - .planning/phases/02-core-model-and-loading/02-05-SUMMARY.md, .planning/STATE.md, .planning/ROADMAP.md, .planning/REQUIREMENTS.md

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Result and Evidence edges, invalid record frontmatter | uncommitted (owner review pending) | see Prepared Commit 1 |
| 2 | Orphans, broken-ticket owners, ignored files, golden | uncommitted (owner review pending) | see Prepared Commit 2 |

## Verification

- `npm test -- --project core verification`: 12 passed, 0 failed.
- `npm test -- --project core snapshot -t "fixture (verification-edges|valid-build)"`: 15 passed, 24 skipped, no obsolete or mismatched golden.
- `npm run check` (build, lint, typecheck, vitest): exit 0, 11 test files, 177 tests, 0 failures.
- `git log -1 --format=%H` is `48e56d7` before and after; `git hash-object` of the tracer golden is `855db6c7` before and after.

## Decisions Made

- The two source modules named in `files_modified` (`load/verification.ts`, `load/snapshot.ts`) were left untouched. The plan said "fix where expectations fail"; nothing failed, so no edit was made. Simplicity-first: no speculative hardening.
- The `Result: pass ` trailing-space acceptance recorded in 02-01 Finding 4 is unchanged; the plan does not ask for exact match and the PATTERNS regex also tolerates trailing whitespace.

## Deviations from Plan

None. Plan executed as written; no auto-fixes, no dependency changes, `package-lock.json` unchanged.

## Findings / Decisions for Owner

1. **`Result:` after `Evidence:` is double-counted by design.** With `Evidence: a` then `Result: pass`, `result` is `pass` and `evidence` is `a\nResult: pass`. This is the plan's flagged assumption and is now pinned by a test. Alternative: stop evidence at the next `Result:` line. One-line change in `parseVerification` plus the test.
2. **A `Result:` line that is not the first line after the heading.** `lines.find` takes the first `Result:` line anywhere in the block; a second `Result:` line in the same block is silently ignored (it would land in the evidence only if it follows `Evidence:`). Not covered by the plan; noted so Phase 3 can decide whether two `Result:` lines deserve a lint.
3. **Findings are in file order, then discovery order within a file.** For record A the golden lists `heading-duplicate` (line 31) before the two `result-invalid` findings (16, 22), because `duplicateHeadings` runs before the block loop. Consistent with tickets (02-03). Sorting by line within a file would be a small change in `parseVerification` if the CLI output should read top-down.
4. **Requirements checkbox.** CORE-06 was already marked complete by 02-01; this plan's `requirements.mark-complete` is a no-op re-run, as 02-02 to 02-04 also noted.

## Known Stubs

None.

## Threat Flags

None. No new surface; T-02-14 (`result-invalid`, `verification-orphan`, `result` absent rather than guessed) and T-02-16 (`<!-- bỏ qua -->` stripped from evidence) are pinned by the golden. T-02-SC holds: no package added.

## Issues Encountered

None.

## Next Phase Readiness

- 02-07 can run against the current tree; all 11 test files pass together.
- Phase 3 lint can rely on `verifications[id].blocks[].result` being absent whenever `load.result-invalid` was raised, and on stray files never appearing in `errors`.

## Self-Check: PASSED

- Created files exist: `verification.test.ts`, `verification-edges.snapshot.json`, and all 12 fixture files are in `git status` as staged additions.
- Commits: none by design (owner commits); `git log -1` unchanged at `48e56d7`.

---
*Phase: 02-core-model-and-loading*
*Completed: 2026-09-06*
