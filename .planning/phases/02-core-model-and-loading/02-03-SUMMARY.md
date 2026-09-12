---
phase: 02-core-model-and-loading
plan: 03
subsystem: core-loader
tags: [sections, fences, ears, golden, vitest]

requires:
  - phase: 02-core-model-and-loading
    provides: "02-01 scan/headingKey/requirementLines/stripHtmlComments/duplicateHeadings/d07Key, parseTicket wiring, readFixture, per-fixture describe loop"
provides:
  - "sections.test.ts: 22 tests pinning the fence state machine, heading normalisation, comment stripping, EARS extraction, duplicate detection, and the body-edges fixture with exact lines"
  - "body-edges fixture (config + 6 tickets) and golden: fenced fakes, casing, duplicates, unterminated fence, tilde inside a backtick fence, no Requirements section"
  - "requirementLines drops a bullet whose text is only whitespace (D-41 hardening)"
affects: [02-04, 02-05, 02-07, phase-3-lint, phase-4-gates]

actuals:
  tokens: 7000
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Scanner unit tests build bodies inline with `[...].join('\\n')` and bodyOffset 0; fixture tests pin (heading, line) pairs and requirement (line, text) pairs"

key-files:
  created:
    - packages/core/test/sections.test.ts
    - packages/core/test/__golden__/body-edges.snapshot.json
    - packages/core/test/fixtures/body-edges/accord/config.yml
    - packages/core/test/fixtures/body-edges/accord/tickets/{DUP,CASE,FENCE,UNTERMINATED,TILDE,NOREQ}.md
  modified:
    - packages/core/src/load/sections.ts

key-decisions:
  - "requirementLines strips the list marker before the blank filter, so `-   ` (marker, whitespace only) is not a requirement; previously it survived as an empty-text entry"
  - "An unterminated fence is content to the end of the body with no finding (plan's flagged assumption, now pinned by UNTERMINATED.md)"

patterns-established:
  - "Adversarial-body fixtures: every expected line number is written in the test before the golden is generated; `-u` only with -t \"fixture <name>\""

requirements-completed: [FMT-05, FMT-04, CORE-06]

coverage:
  - id: D1
    description: "A heading or EARS line inside a backtick or tilde fence, terminated or not, is never a section or a requirement"
    requirement: FMT-05
    verification:
      - kind: unit
        ref: "packages/core/test/sections.test.ts#scan fences (STACK Decision 4)"
        status: pass
      - kind: unit
        ref: "packages/core/test/sections.test.ts#body-edges fixture > FENCE"
        status: pass
      - kind: unit
        ref: "packages/core/test/sections.test.ts#body-edges fixture > UNTERMINATED"
        status: pass
    human_judgment: false
  - id: D2
    description: "Heading match is case-insensitive, whitespace-collapsed, and ignores trailing #; raw heading text is preserved"
    requirement: CORE-06
    verification:
      - kind: unit
        ref: "packages/core/test/sections.test.ts#headingKey (D-39)"
        status: pass
      - kind: unit
        ref: "packages/core/test/sections.test.ts#body-edges fixture > CASE"
        status: pass
    human_judgment: false
  - id: D3
    description: "A second ## Requirements is load.heading-duplicate at its line; the first section is used and nothing is merged"
    requirement: CORE-06
    verification:
      - kind: unit
        ref: "packages/core/test/sections.test.ts#duplicateHeadings (D-40, D-42)"
        status: pass
      - kind: unit
        ref: "packages/core/test/sections.test.ts#body-edges fixture > DUP"
        status: pass
    human_judgment: false
  - id: D4
    description: "EARS lines are every non-blank line under ## Requirements after comments, fences, ### lines, and one list marker are removed, each with its Markdown line"
    requirement: FMT-05
    verification:
      - kind: unit
        ref: "packages/core/test/sections.test.ts#requirementLines (D-41, FMT-05)"
        status: pass
      - kind: unit
        ref: "packages/core/test/sections.test.ts#stripHtmlComments (D-41)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Only gherkin fences under ## Acceptance criteria produce scenarios; a fence under ## Plan is ignored; a ~~~ line inside a backtick gherkin fence is gherkin text"
    requirement: FMT-04
    verification:
      - kind: unit
        ref: "packages/core/test/sections.test.ts#body-edges fixture > FENCE"
        status: pass
      - kind: unit
        ref: "packages/core/test/sections.test.ts#body-edges fixture > TILDE"
        status: pass
    human_judgment: false
  - id: D6
    description: "A ticket with no ## Requirements has requirements [] and no loader finding"
    requirement: CORE-06
    verification:
      - kind: unit
        ref: "packages/core/test/sections.test.ts#body-edges fixture > NOREQ"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-06
status: complete
---

# Phase 2 Plan 03: Body Edge Cases Summary

**Fences, HTML comments, heading casing, duplicate headings, and fences under the wrong heading are each pinned by unit tests and the body-edges golden; the 02-01 scanner passed every expectation except a whitespace-only bullet, which now drops out of `requirementLines`.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-06T07:44:00Z
- **Completed:** 2026-09-06T07:52:00Z
- **Tasks:** 2
- **Files modified:** 10 (1 source file, 9 test files; staged, uncommitted)

## Accomplishments

- `sections.test.ts`: 16 unit tests over inline bodies (backtick and tilde fences, `~~~` inside a backtick fence, closer length rule, unterminated fence, column-0 headings, `bodyOffset`, single- and multi-line comment stripping, five list markers, `###` and fenced and blank lines, D-07 and `@ac-n` duplicate identity) plus 6 fixture tests with exact lines.
- `body-edges` fixture and golden: one `load.heading-duplicate` at `DUP.md:13`; `FENCE.md` yields exactly `WHEN one`..`WHEN five` at lines 16 to 20, three sections, one `ac-1` scenario; the `@ac-9` fence under `## Plan` contributes nothing (D-36); `UNTERMINATED.md` has one section and no finding; `CASE.md` matches `## INTENT`, `##   requirements`, `## Acceptance Criteria ##` with raw text kept; `TILDE.md` keeps its scenario; `NOREQ.md` is empty and clean.
- `requirementLines` hardening: the marker is stripped before the blank filter.

## Prepared Commits

Nothing was committed. Every file is staged; the owner reviews and commits.

1. `test(02-03): pin the fence-aware scanner, comment stripping, EARS extraction, and duplicate headings`
   - packages/core/test/sections.test.ts, packages/core/src/load/sections.ts
2. `test(02-03): body-edges fixture and golden for fenced fakes, casing, duplicates, and fences under other headings`
   - packages/core/test/sections.test.ts, packages/core/test/__golden__/body-edges.snapshot.json, packages/core/test/fixtures/body-edges/accord/config.yml, packages/core/test/fixtures/body-edges/accord/tickets/{DUP,CASE,FENCE,UNTERMINATED,TILDE,NOREQ}.md
3. `docs(02-03): complete body edge cases plan`
   - .planning/phases/02-core-model-and-loading/02-03-SUMMARY.md, .planning/STATE.md, .planning/ROADMAP.md

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scanner unit tests | uncommitted (owner review pending) | see Prepared Commit 1 |
| 2 | body-edges fixture and golden | uncommitted (owner review pending) | see Prepared Commit 2 |

## Verification

- `npm test -- --project core sections`: 22 passed, 0 failed.
- `npm test -- --project core snapshot -t "fixture (body-edges|valid-build)"`: 15 passed (16 skipped by the filter), no obsolete or mismatched golden.
- `npm run check` (build, lint, typecheck, vitest) exits 0: 9 test files, 135 tests, 0 failures.
- `git hash-object packages/core/test/__golden__/valid-build.snapshot.json` is `855db6c7` before and after; `-u` was run once, scoped with `-t "fixture body-edges"`.
- Golden checks: `errors` is exactly one object (`accord/tickets/DUP.md`, `load.heading-duplicate`, line 13); `FENCE.requirements` texts are `WHEN one`..`WHEN five`; no `requirements[].text` or `scenarios[]` entry contains `inside a fence` or `inside a comment` (the phrase appears once, inside `sections[].lines[].text`); no `\\` sequence in the golden.
- `git log -1` is still `48e56d7`.

## Decisions Made

- `requirementLines` now filters empty text after stripping the marker. The plan lists "a bullet whose text is only whitespace is dropped" as a contract expectation and the 02-01 code failed it; the rest of the scanner passed every unit and fixture expectation unchanged.
- The unterminated fence, duplicate extra headings, and `#`/`###` non-boundary assumptions from the plan's flagged table are pinned as written.

## Deviations from Plan

**1. [Rule 1 - Bug] Whitespace-only bullet survived as an empty requirement**
- **Found during:** Task 1
- **Issue:** the blank filter ran on the raw line (`-   ` trims to `-`), so the marker was stripped afterwards and an entry `{ text: '' }` reached `requirements`.
- **Fix:** strip the marker first, then drop empty text.
- **Files modified:** packages/core/src/load/sections.ts
- **Commit:** uncommitted (owner review pending)

This is the plan's own instruction ("Fix `load/sections.ts` for any failing expectation"), not an unrelated auto-fix. No dependency added; `package-lock.json` unchanged.

## Findings / Decisions for Owner

1. **Bare `-` with nothing after it.** `LIST_MARKER` requires whitespace after the marker, so a line that is exactly `-` (no trailing space) is kept as a requirement with text `-`. The plan only specifies the whitespace-after-marker case. Alternative: treat a lone marker as blank. One-regex change if you want it.
2. **Comment stripping leaves the surrounding whitespace.** `a <!-- x --> b` becomes `a  b` (two spaces); the plan says "leaving the surrounding text on the same line" and does not ask for collapsing. Pinned as-is; `requirementLines` trims the ends but not the middle.
3. **`##` alone (no text) is not a heading.** `HEADING` requires `##` followed by whitespace and text; a bare `##` line is an ordinary line of the enclosing section. Consistent with 02-01 Finding 6.
4. **Requirements checkboxes.** FMT-04, FMT-05, CORE-06 were already complete from 02-01; `requirements.mark-complete` reported `already_complete` for all three and wrote nothing.
5. **`state.update-progress` skipped** with "phase scope is unscoped, not complete"; STATE.md's Progress bar is unchanged. `state.advance-plan` moved the position to plan 4 of 7.

## Known Stubs

None.

## Threat Flags

None. T-02-09 is now pinned by FENCE and UNTERMINATED (hidden headings and requirements never reach the model); T-02-10 holds (single pass, no whole-body regex); T-02-SC holds (no package added).

## Issues Encountered

None.

## Next Phase Readiness

- 02-04 (gherkin error paths), 02-05 (verification), and 02-07 can add fixtures the same way; the wave-end `npm test -- --project core` currently reports 135 passing.
- Phase 3 lint can rely on `requirements[]` never containing empty text, fenced text, or commented text.

## Self-Check: PASSED

- Created files exist: `sections.test.ts`, `body-edges.snapshot.json`, `config.yml`, and the six tickets are present and staged (`git status --short` shows `A` for all ten paths including the modified `sections.ts`).
- Commits: none by design (owner commits); `git log -1` unchanged at `48e56d7`.

---
*Phase: 02-core-model-and-loading*
*Completed: 2026-09-06*
