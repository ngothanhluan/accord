---
phase: 02-core-model-and-loading
plan: 04
subsystem: core-loader
tags: [gherkin, scenarios, dialects, golden, vitest]

requires:
  - phase: 02-core-model-and-loading
    provides: "02-01 extractScenarios, Fence, parseTicket fence routing (D-36), readFixture, per-fixture describe loop"
provides:
  - "gherkin.test.ts: 12 unit tests over extractScenarios pinning the steps normalisation contract (D-48), Outline, Background and Rule, line remap with and without a synthetic Feature line, tags, vi dialect, parse errors, determinism"
  - "gherkin-shapes fixture (config + 9 tickets) and golden: Outline, vi, Rule, parse error, tag variants, doc string and table, multi-fence, empty AC, unknown language, each with exact Markdown lines"
affects: [02-05, 02-07, phase-3-lint, phase-4-gates]

actuals:
  tokens: 7800
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Gherkin unit tests build a Fence inline with `fence(lines, open)` so the Markdown remap is asserted independently of the scanner"

key-files:
  created:
    - packages/core/test/gherkin.test.ts
    - packages/core/test/__golden__/gherkin-shapes.snapshot.json
    - packages/core/test/fixtures/gherkin-shapes/accord/config.yml
    - packages/core/test/fixtures/gherkin-shapes/accord/tickets/{OUTLINE,VI,RULE,PARSE-ERROR,TAGS,STEPS,MULTI,EMPTY-AC,BADLANG}.md
  modified: []

key-decisions:
  - "No change to load/gherkin.ts: the 02-01 implementation met every unit and fixture expectation, so the plan's `files_modified` entry for it is untouched"
  - "The steps format is now frozen by test: `keyword text`, doc strings as `\"\"\"content\"\"\"`, tables as `| a | b |` cells, Outline examples as one `Examples: ...` string, all whitespace collapsed"
  - "The Rule-name check is asserted on `scenarios`, not the whole ticket, because sections[].lines[] store the raw body verbatim"

patterns-established:
  - "Gherkin-shape fixtures: one ticket per shape, six-line frontmatter so body line 1 is Markdown line 7, expected lines written in the test before the golden exists"

requirements-completed: [FMT-04, CORE-03, CORE-06]

coverage:
  - id: D1
    description: "A Scenario Outline is one ScenarioRef with keyword Scenario Outline and an Examples string at the end of steps"
    requirement: FMT-04
    verification:
      - kind: unit
        ref: "packages/core/test/gherkin.test.ts#steps contract > a Scenario Outline is one ref"
        status: pass
      - kind: unit
        ref: "packages/core/test/gherkin.test.ts#gherkin-shapes fixture > OUTLINE"
        status: pass
    human_judgment: false
  - id: D2
    description: "A # language: vi fence yields English keyword values, Vietnamese step keywords, the keyword's Markdown line, and works without a feature line"
    requirement: FMT-04
    verification:
      - kind: unit
        ref: "packages/core/test/gherkin.test.ts#dialects (D-50)"
        status: pass
      - kind: unit
        ref: "packages/core/test/gherkin.test.ts#gherkin-shapes fixture > VI"
        status: pass
    human_judgment: false
  - id: D3
    description: "Feature and Rule Backgrounds are prepended in order; the Rule name is absent from scenarios"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "packages/core/test/gherkin.test.ts#steps contract > feature and rule Backgrounds"
        status: pass
      - kind: unit
        ref: "packages/core/test/gherkin.test.ts#gherkin-shapes fixture > RULE"
        status: pass
    human_judgment: false
  - id: D4
    description: "A parse error is load.gherkin-parse at the Markdown line of the offending fence line; frontmatter kept; scenarios empty for that fence"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "packages/core/test/gherkin.test.ts#parse errors (D-35)"
        status: pass
      - kind: unit
        ref: "packages/core/test/gherkin.test.ts#gherkin-shapes fixture > PARSE-ERROR, BADLANG, errors are exactly the two parse findings"
        status: pass
    human_judgment: false
  - id: D5
    description: "Untagged scenarios have no acTag and empty tags; the first @ac-n wins; feature tags never become scenario tags; a repeated @ac-1 is kept without a loader finding"
    requirement: FMT-04
    verification:
      - kind: unit
        ref: "packages/core/test/gherkin.test.ts#tags (D-46)"
        status: pass
      - kind: unit
        ref: "packages/core/test/gherkin.test.ts#gherkin-shapes fixture > TAGS"
        status: pass
    human_judgment: false
  - id: D6
    description: "Two fences under Acceptance criteria concatenate in document order; a fence without Feature: gets one prepended with lines still mapped; a Feature-only fence and a section with no fence yield scenarios [] and no finding"
    requirement: CORE-06
    verification:
      - kind: unit
        ref: "packages/core/test/gherkin.test.ts#Markdown line remap (D-35, D-36)"
        status: pass
      - kind: unit
        ref: "packages/core/test/gherkin.test.ts#gherkin-shapes fixture > MULTI, EMPTY-AC"
        status: pass
    human_judgment: false
  - id: D7
    description: "Extracting the same fence twice is JSON-identical and the fence is not mutated; a parser is created per call"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "packages/core/test/gherkin.test.ts#determinism (CORE-03)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-09-06
status: complete
---

# Phase 2 Plan 04: Gherkin Shapes Summary

**Every Gherkin shape the team will write (Outline, `vi` dialect, Background, Rule, doc strings and tables, tag variants, two fences, empty AC, parse error, unknown language) is pinned by unit tests and the gherkin-shapes golden with exact Markdown lines; the 02-01 `extractScenarios` passed every expectation without a code change.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-06T07:46:00Z
- **Completed:** 2026-09-06T07:52:00Z
- **Tasks:** 2
- **Files modified:** 12 created (staged, uncommitted), 0 source files changed

## Accomplishments

- `gherkin.test.ts`: 12 unit tests over `extractScenarios` with an inline `fence(lines, open)` helper, plus 10 fixture tests. The `steps` normalisation contract is written literally: `Given a thing`, `When a doc string """hello world"""`, `Then a table | x | y | | 1 | 2 |`, and `Examples: | a | | 1 | | 2 |` for an Outline.
- `gherkin-shapes` fixture and golden: OUTLINE (line 13, one `Scenario Outline`), VI (lines 17 and 22, `Cho`/`Khi`/`Thì` steps, Background first in both), RULE (line 21, `Given fb`, `Given rb`, `Given s`), PARSE-ERROR (finding at line 15, frontmatter kept), TAGS (lines 13, 17, 21, 25; `acTag` null, `ac-1`, `ac-3`, `ac-1`; no `@feature-tag` in any `tags`), STEPS (line 13, contract holds through `loadSnapshot`), MULTI (lines 13 and 19, third Feature-only fence adds nothing), EMPTY-AC (`[]`, no finding), BADLANG (finding at line 10, `Language not supported: xx`).
- The golden's `errors` array is exactly two `load.gherkin-parse` findings (BADLANG, PARSE-ERROR).

## Prepared Commits

Nothing was committed. Every file is staged; the owner reviews and commits.

1. `test(02-04): pin the steps contract, line remap, tags, vi dialect, and parse errors of extractScenarios`
   - packages/core/test/gherkin.test.ts
2. `test(02-04): gherkin-shapes fixture and golden for Outline, vi, Rule, tags, doc strings, multi-fence, empty AC, and parse errors`
   - packages/core/test/gherkin.test.ts, packages/core/test/__golden__/gherkin-shapes.snapshot.json, packages/core/test/fixtures/gherkin-shapes/accord/config.yml, packages/core/test/fixtures/gherkin-shapes/accord/tickets/{OUTLINE,VI,RULE,PARSE-ERROR,TAGS,STEPS,MULTI,EMPTY-AC,BADLANG}.md
3. `docs(02-04): complete gherkin shapes plan`
   - .planning/phases/02-core-model-and-loading/02-04-SUMMARY.md, .planning/STATE.md, .planning/ROADMAP.md

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Steps contract, line remap, determinism unit tests | uncommitted (owner review pending) | see Prepared Commit 1 |
| 2 | gherkin-shapes fixture and golden | uncommitted (owner review pending) | see Prepared Commit 2 |

## Verification

- `npm test -- --project core gherkin`: 22 passed, 0 failed.
- `npm test -- --project core snapshot -t "fixture (gherkin-shapes|valid-build)"`: 15 passed (20 skipped by the filter), no obsolete or mismatched golden.
- `npm run check` (build, lint, typecheck, vitest) exits 0: 10 test files, 161 tests, 0 failures.
- `git hash-object packages/core/test/__golden__/valid-build.snapshot.json` is `855db6c7` before and after; `-u` was run once, scoped with `-t "fixture gherkin-shapes"`.
- `grep -c 'new Parser('` on gherkin.ts prints 1 (inside `extractScenarios`); `grep -c '^const parser'` prints 0.
- Golden checks: every acceptance criterion in the plan holds except the whole-golden `Thanh toán` grep (see Findings 1). The golden contains no `\\` sequence; its three single backslashes are the JSON escapes of `"` inside the doc-string wrapper and the raw `"""` body lines.
- `git log -1` is still `48e56d7`.

## Decisions Made

- No change to `load/gherkin.ts`. The plan allowed edits only for failing expectations; none failed.
- The VI Outline's examples string uses the English marker `Examples:` (the loader's constant), not `Dữ liệu:`. This matches D-50's rule that `keyword` is always English and keeps `steps` dialect-independent for the Phase 4 hash. Pinned in the VI fixture test.
- The Rule-name absence is asserted on `scenarios` only (see Findings 1).

## Deviations from Plan

None. Plan executed as written; no auto-fixes, no dependency changes, `package-lock.json` unchanged.

## Findings / Decisions for Owner

1. **`Thanh toán` appears once in the golden.** The plan's acceptance criterion says the string must not appear anywhere in the golden, but `sections[].lines[]` store every raw body line verbatim (02-01 model), so `Rule: Thanh toán` is present as section text at line 15. It is absent from `scenarios`, which is what D-49 governs. Same situation 02-03 recorded for its `inside a fence` phrase. The test asserts on `scenarios`; no model change made.
2. **Parse-error reason wording.** The parser's message for a stray line lists every token it would have accepted: `expected: #EOF, #TableRow, #DocStringSeparator, #StepLine, #TagLine, #ExamplesLine, #ScenarioLine, #RuleLine, #Comment, #Empty, got 'Đây là dòng sai'`. Pinned as-is in the golden. Alternative: shorten to `unexpected line 'Đây là dòng sai'` in `extractScenarios`. Phase 3 or Phase 5 can decide the CLI wording.
3. **Examples marker in `vi` steps.** `Dữ liệu:` becomes `Examples:` in `steps` (decision above). If you prefer the dialect keyword preserved, it is a one-line change in `scenarioRef` plus a golden update, but it would make `ac_hash` dialect-dependent.
4. **Requirements checkboxes.** FMT-04, CORE-03, CORE-06 were already marked complete by 02-01; this plan's `requirements.mark-complete` is a no-op re-run. Same note as 02-01 Finding 3.

## Known Stubs

None.

## Threat Flags

None. T-02-11 is pinned by TAGS (untagged scenarios carry no invented id; identity is the written `@ac-n`); T-02-12 by RULE, OUTLINE, STEPS (Background, Examples, doc strings, and tables are all inside `steps`); T-02-SC holds (no package added).

## Issues Encountered

None.

## Next Phase Readiness

- 02-05 and 02-07 add fixtures the same way; the wave-end `npm test -- --project core` currently reports 161 passing.
- Phase 3 lint can rely on `scenarios[]` carrying `acTag` only when the BA wrote it, and on duplicate `@ac-n` tags reaching it untouched.
- Phase 4 hashes `steps` as frozen here; any change to the format in `gherkin.ts` must be treated as a breaking change to `ac_hash`.

## Self-Check: PASSED

- Created files exist: `gherkin.test.ts`, `gherkin-shapes.snapshot.json`, `config.yml`, and the nine tickets are present and staged (`git status --short` shows `A` for all twelve paths).
- Commits: none by design (owner commits); `git log -1` unchanged at `48e56d7`.

---
*Phase: 02-core-model-and-loading*
*Completed: 2026-09-06*
