---
phase: 03-lint
plan: 01
subsystem: core-lint
tags: [lint, rule-table, finding-level, snapshot-files, render-text, goldens, vitest]

# Dependency graph
requires:
  - phase: 02-core-model-and-loading
    provides: RepoSnapshot, Finding, loadSnapshot, normaliseText, the five-variant golden harness
provides:
  - "`Finding.level` (D-56), `Level`, `LoadFinding` (D-58) in `model/finding.ts`"
  - "`RepoSnapshot.files` (D-65) filled from `accord/assets/<id>/prototype.html` and `config.design.tokens`; `PROTOTYPE` and `normaliseKey` exported from `load/snapshot.ts`"
  - "`RULES` table with `Rule`, `Draft` (D-57) and two rows: `lint.id-mismatch` (error) and `lint.test-tag-missing` (warning)"
  - "`lintSnapshot` engine: loader findings stamped error, `schema.if` dropped, code-point sort, counts (D-58)"
  - "`renderText` (D-60) with the literal-plural summary line"
  - "Golden loop `test/lint.test.ts` over every fixture, `test/render.test.ts` identity contract, eight `*.lint.json` goldens, eight regenerated `*.snapshot.json` goldens"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 04-gates, 05-cli]

# Actuals (#2632) — chars/4 over the realized diff (21,491 chars of tracked diff + 26,152 chars of new files)
actuals:
  tokens: 11900
  tasks: 2
  commits: 0
plan_head_before: f4cc8cc920ef165e7f71bed0dd023550f2c74a38

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rule table row `{ id, level, profiles, check }`; the engine stamps `rule` and `level`, so a `lint.*` level literal lives only in `lint/rules.ts`"
    - "Rule groups export `Rule['check']` functions over `Object.values(snapshot.tickets)`; optional-spread for `line` and `pointer`"
    - "Sort comparator uses plain `<`/`>` code-point comparison, never `localeCompare`"
    - "Loader files type their findings `LoadFinding`; lint adds `level` at the merge step"

key-files:
  created:
    - packages/core/src/lint/index.ts
    - packages/core/src/lint/rules.ts
    - packages/core/src/lint/ticket.ts
    - packages/core/src/lint/gherkin.ts
    - packages/core/src/lint/render.ts
    - packages/core/test/lint.test.ts
    - packages/core/test/render.test.ts
    - packages/core/test/__golden__/valid-build.lint.json
    - packages/core/test/__golden__/frontmatter-errors.lint.json
  modified:
    - packages/core/src/model/finding.ts
    - packages/core/src/model/snapshot.ts
    - packages/core/src/load/snapshot.ts
    - packages/core/src/index.ts
    - packages/core/test/bundle.test.ts
    - packages/core/test/frontmatter.test.ts
    - packages/core/test/verification.test.ts

key-decisions:
  - "`RepoSnapshot.files` keeps the tokens file only when `config` is defined (schema-valid) and the normalised key exists in the input; an invalid config.yml therefore yields `files: {}` even if the tokens text was supplied"
  - "`RULES` is typed `readonly Rule[]` per the plan's interfaces block, not `as const`; the golden loop cross-checks ids against the table at runtime instead of deriving a `RuleId` union"
  - "Two pre-existing test helpers were retyped `LoadFinding[]` so the D-58 rename type-checks; no behaviour change"

patterns-established:
  - "Golden loop per fixture: `describe('fixture ' + name)`, reads in `beforeAll`, five variants byte-identical, `toMatchFileSnapshot('./__golden__/<name>.lint.json')`"
  - "Text round-trip identity: every `renderText` line parses back with `/^(.+?)(?::(\\d+))?: (error|warning) (\\S+) (.*)$/` to the finding's file, line, level, rule, reason"

requirements-completed: [CORE-04, CORE-05, LINT-01, FMT-09]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "`Finding.level`, `Level`, `LoadFinding`; loader findings surface through lint as errors with pointer and line, `schema.if` dropped"
    requirement: LINT-01
    verification:
      - kind: unit
        ref: "packages/core/test/lint.test.ts#fixture frontmatter-errors: pinned lint values"
        status: pass
      - kind: unit
        ref: "packages/core/test/render.test.ts#drops schema.if and stamps every other loader finding error (D-58)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`RULES` table with two rows; every `lint.*` finding's rule and level come from the table"
    requirement: CORE-04
    verification:
      - kind: unit
        ref: "packages/core/test/lint.test.ts#every lint rule and level comes from the table; loader findings are errors; schema.if is dropped (D-57, D-58)"
        status: pass
      - kind: other
        ref: "grep -c \"level: '\" packages/core/src/lint/index.ts packages/core/src/lint/ticket.ts packages/core/src/lint/gherkin.ts -> 1, 0, 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "`lintSnapshot` returns `{ findings, errors, warnings }` sorted by code-point file, line-less-first line, rule, reason, pointer; pure and deterministic; identical findings both kept"
    requirement: CORE-05
    verification:
      - kind: unit
        ref: "packages/core/test/lint.test.ts#is sorted, deterministic, and leaves the snapshot untouched (D-58, T-03-12)"
        status: pass
      - kind: unit
        ref: "packages/core/test/render.test.ts#lintSnapshot edges (CORE-05)"
        status: pass
    human_judgment: false
  - id: D4
    description: "`renderText` emits the D-60 line shape and the literal-plural summary; text and JSON carry the same content"
    requirement: CORE-05
    verification:
      - kind: unit
        ref: "packages/core/test/render.test.ts#renderText (D-60)"
        status: pass
      - kind: unit
        ref: "packages/core/test/lint.test.ts#renderText parses back to the findings and ends with the summary line (D-60, CORE-05)"
        status: pass
    human_judgment: false
  - id: D5
    description: "`lint.test-tag-missing` warns at the Scenario line for scenarios without `@ui` or `@test:`; `lint.id-mismatch` errors at pointer `/id`"
    requirement: FMT-09
    verification:
      - kind: unit
        ref: "packages/core/test/lint.test.ts#fixture valid-build: pinned lint values"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/valid-build.lint.json"
        status: pass
    human_judgment: false
  - id: D6
    description: "`RepoSnapshot.files` holds normalised prototype and tokens text; the five encoding variants of every fixture load and lint identically; the built bundle exposes the lint surface without a Node built-in"
    requirement: CORE-05
    verification:
      - kind: unit
        ref: "packages/core/test/lint.test.ts#CRLF, BOM+CRLF, mixed endings, and backslash keys lint identically to LF (D-29, D-38, D-65)"
        status: pass
      - kind: unit
        ref: "packages/core/test/bundle.test.ts#declarations expose the seam"
        status: pass
      - kind: integration
        ref: "npm test -- --project cli load (loadFromFs matches the regenerated valid-build.snapshot.json)"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-09-14
status: complete
---

# Phase 3 Plan 01: Lint tracer slice Summary

**`lintSnapshot(loadSnapshot(input))` runs end-to-end: loader findings surface as errors, two table rules fire (`lint.id-mismatch`, `lint.test-tag-missing`), results sort deterministically, `renderText` prints the `file:line: level rule reason` shape, and every fixture has a lint golden identical across five encodings.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-14T04:41:17Z
- **Completed:** 2026-09-14T04:49:54Z
- **Tasks:** 2
- **Files modified:** 36 (15 created, 21 modified)

## Accomplishments

- `Finding` gained `level` (D-56); the loader now produces `LoadFinding` and lint stamps `error` at the merge step (D-58), so no snapshot golden changed except for the new `files` key.
- `RepoSnapshot.files` (D-65) holds the normalised text of every `accord/assets/<id>/prototype.html` and of the `config.design.tokens` file; `PROTOTYPE` and `normaliseKey` are exported for plans 03-05 and 03-06.
- `RULES` (D-57) is one array of `{ id, level, profiles, check }` rows; the engine stamps `rule` and `level`, and a grep proves no other `lint.*` level literal exists.
- `lintSnapshot` drops `schema.if` (Pitfall 4), sorts by code-point comparison (A8), counts, and never mutates its argument (T-03-12).
- `renderText` (D-60) emits one line per finding and the literal-plural summary (owner decision on Open Question 7).
- Golden loop over all eight fixtures with the table cross-check, text round-trip, sort and determinism assertions; pinned values for `valid-build` (two warnings at lines 37 and 42, `files` holds only the tokens file) and `frontmatter-errors` (`lint.id-mismatch` at `/id`, no line; `schema.required` with pointer and line; no `schema.if`).
- Barrel exports `lintSnapshot`, `renderText`, `LintResult`, `Level`, `LoadFinding`; `RULES` stays private; the bundle test pins the surface and `dist/index.js` still imports no Node built-in.

## Task Commits

Per the owner's rule, nothing was committed or staged; every change sits in the working tree for review.

1. **Task 1: End-to-end lint tracer** - `uncommitted` (feat)
2. **Task 2: Text/JSON identity contract and bundle surface** - `uncommitted` (test)

**Plan metadata:** `uncommitted` (docs)

## Files Created/Modified

Created:
- `packages/core/src/lint/index.ts` - `LintResult`, `lintSnapshot` (merge, sort, count)
- `packages/core/src/lint/rules.ts` - `Draft`, `Rule`, `RULES` (two rows)
- `packages/core/src/lint/ticket.ts` - `idMismatch` (D-34)
- `packages/core/src/lint/gherkin.ts` - `testTagMissing` (D-69)
- `packages/core/src/lint/render.ts` - `renderText` (D-60)
- `packages/core/test/lint.test.ts` - golden loop and pinned values
- `packages/core/test/render.test.ts` - six behaviours across seven tests
- `packages/core/test/__golden__/*.lint.json` - eight lint goldens

Modified:
- `packages/core/src/model/finding.ts` - `Level`, `Finding.level`, `LoadFinding`
- `packages/core/src/model/snapshot.ts` - `errors: LoadFinding[]`, `files`
- `packages/core/src/load/snapshot.ts` - `PROTOTYPE`, exported `normaliseKey`, fills `files`
- `packages/core/src/load/{config,frontmatter,yaml,sections,gherkin,verification}.ts` - `Finding` to `LoadFinding` type annotations only
- `packages/core/src/index.ts` - barrel exports
- `packages/core/test/bundle.test.ts` - five names added to the seam list
- `packages/core/test/frontmatter.test.ts`, `packages/core/test/verification.test.ts` - helper parameter types `LoadFinding[]`
- `packages/core/test/__golden__/*.snapshot.json` - eight goldens regenerated; diff is the `files` key only (reviewed with `git diff`)

## Decisions Made

- `files` includes the tokens file only when `config` is defined and the normalised key is present in the input, exactly as the plan states; with an invalid `config.yml` the tokens text is not kept.
- `RULES` is `readonly Rule[]` (plan interfaces block) rather than the `as const` idiom the pattern map suggested; the runtime cross-check in the golden loop gives the same guarantee without a derived union.
- Reasons echo only ids, tag text, and scenario names (T-03-05).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Retyped two test helpers from `Finding[]` to `LoadFinding[]`**
- **Found during:** Task 1 (first `npm run typecheck` after the D-58 rename)
- **Issue:** `test/frontmatter.test.ts` (`has`, `forFile`) and `test/verification.test.ts` (`where`) accept `snap.errors`, which is now `LoadFinding[]`; 30 TS2345 errors blocked the plan's verify command. Neither file is in the plan's file list.
- **Fix:** Type-only rename in the two helpers and their imports; no assertion changed.
- **Files modified:** `packages/core/test/frontmatter.test.ts`, `packages/core/test/verification.test.ts`
- **Verification:** `npm run typecheck` exit 0; both files' tests pass in `npm run check`
- **Committed in:** uncommitted (owner rule)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for the plan's own verify gate; no behaviour or scope change.

## TDD Note (Task 2, `tdd="true"`)

`render.test.ts` was written before any Task 2 code change and run first. It passed on that first run (7 tests) because Task 1, the tracer, had already built `render.ts` and `index.ts` as the plan prescribes. No assertion-level RED was observable and none was expected; the plan's own action says to fix the implementation only if a behaviour fails, and none did. `workflow.tdd_mode` is `false`, so no gate commit sequence applies, and the owner rule forbids commits regardless.

## Prohibitions (must_haves) — verification

| Statement | Result |
|---|---|
| No `git commit`, `git push`, `git tag`; no attribution trailer | Verified: HEAD is still `f4cc8cc920ef165e7f71bed0dd023550f2c74a38`; `git diff --cached` is empty |
| Nothing under `src/lint/` imports `node:`, a bare built-in, `ajv`, or `yaml` | Verified by grep: only relative `./` and `../model/` imports; `npm run lint` purity guard exit 0; `grep -c "node:" dist/index.js` is 0 |
| No package added; `package-lock.json` untouched | Verified: `git diff --stat -- package-lock.json package.json packages/core/package.json` is empty |
| No other tool, plugin, harness, or planning system named in shipped core source | Verified by review of the five new source files and the edited model, loader, and barrel comments |
| A `lint.*` level literal appears only in `rules.ts` | Verified: `grep -c "level: '"` gives `index.ts` 1 (the D-58 error stamp), `ticket.ts` 0, `gherkin.ts` 0 |

## Issues Encountered

None beyond the deviation above.

## Open questions for the owner

None. Every value used comes from the plan, CONTEXT.md D-56 to D-60, D-65, D-69, or the owner's resolutions of RESEARCH Open Questions 4 and 7. The plan's `flagged_assumptions` table (schema.if drop, code-point sort, `LoadFinding` in the loader) stands as written.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 03-02 to 03-06 can add rows to `RULES` and `Rule['check']` functions to the group files; `Draft`, `Rule`, `PROTOTYPE`, `normaliseKey`, and `normaliseText` are in place.
- Regenerating one lint golden: `npm test -- --project core lint -u -t "fixture <name>"`.
- `npm run check` is green on Windows (15 files, 246 tests) before Wave 2 starts.

## Self-Check: PASSED

- Created files verified on disk: `src/lint/{index,rules,ticket,gherkin,render}.ts`, `test/lint.test.ts`, `test/render.test.ts`, eight `__golden__/*.lint.json` (all FOUND).
- Modified files verified on disk with the expected content (grep): `model/finding.ts`, `model/snapshot.ts`, `load/snapshot.ts`, `src/index.ts`, `test/bundle.test.ts`.
- Commit-hash check skipped by owner rule (nothing committed by design); `git log -1` equals `plan_head_before`.

---
*Phase: 03-lint*
*Completed: 2026-09-14*
