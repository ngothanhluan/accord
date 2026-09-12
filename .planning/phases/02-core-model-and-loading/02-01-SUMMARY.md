---
phase: 02-core-model-and-loading
plan: 01
subsystem: core-loader
tags: [yaml, gherkin, ajv, snapshot, golden, vitest]

requires:
  - phase: 01-workspace-and-formats
    provides: validate() seam (D-20), three JSON schemas, ESLint purity guard, generated templates
provides:
  - "`loadSnapshot(input)` pure orchestrator over `{ files, tree }` (D-28..D-31, D-34, D-37)"
  - "RepoSnapshot model types (SnapshotInput, Ticket, ScenarioRef, Verification, EvidenceBlock, Section, Line, AccordConfig)"
  - "D-52 Finding `{ file, line?, rule, reason, pointer? }` and SchemaFinding; validate() returns SchemaFinding[]"
  - "Internal loaders: yaml.ts (D-33 pointer-to-line rule), frontmatter.ts, config.ts, sections.ts, gherkin.ts, verification.ts"
  - "valid-build fixture, its golden, readFixture/variants/stableJson helper, per-fixture `describe('fixture <name>')` loop"
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, phase-3-lint, phase-4-gates, phase-8-mcp]

actuals:
  tokens: 16628
  tasks: 3
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Decision citation in a leading comment of every new file (`// D-33 ...`)"
    - "Findings, never exceptions: every load/* parser returns `{ value, findings }`"
    - "Golden = stableJson(loadSnapshot(readFixture(name))) via toMatchFileSnapshot; `-t \"fixture <name>\"` scopes `-u`"
    - "Object spreads omit undefined optional keys so JSON and structuredClone agree"

key-files:
  created:
    - packages/core/src/model/snapshot.ts
    - packages/core/src/load/snapshot.ts
    - packages/core/src/load/yaml.ts
    - packages/core/src/load/frontmatter.ts
    - packages/core/src/load/config.ts
    - packages/core/src/load/sections.ts
    - packages/core/src/load/gherkin.ts
    - packages/core/src/load/verification.ts
    - packages/core/test/helpers/fixture.ts
    - packages/core/test/snapshot.test.ts
    - packages/core/test/__golden__/valid-build.snapshot.json
    - packages/core/test/fixtures/valid-build/ (8 files)
  modified:
    - packages/core/src/model/finding.ts
    - packages/core/src/validate/ajv.ts
    - packages/core/src/index.ts
    - packages/core/test/schemas.test.ts
    - packages/core/test/bundle.test.ts
    - packages/core/test/__golden__/{ticket,ticket.tracker,config,verification}.invalid.json
    - .gitattributes

key-decisions:
  - "stringNumerics is defined in load/yaml.ts and re-exported from load/frontmatter.ts to avoid a circular import between the two"
  - "Fence carries a `close` line (closing fence, or last body line when unterminated) so requirementLines can exclude fence ranges"
  - "scan() drops the phantom empty element after a trailing newline so the last section never gains a line past the file end"
  - "validate() adds `param` only for schema.additionalProperties and schema.required; other goldens changed only by the pointer rename"

patterns-established:
  - "Fixture describe naming: `describe('fixture ' + name)` plus `fixture <name>: pinned values`; reading happens in beforeAll, never at collection time"
  - "AST types for gherkin are derived with ReturnType<Parser<unknown>['parse']> so no messages-package name enters core"

requirements-completed: [CORE-02, CORE-03, CORE-06, FMT-04, FMT-05, FMT-08]

coverage:
  - id: D1
    description: "loadSnapshot returns a typed RepoSnapshot for the valid-build fixture with no errors, sorted tree, parsed config"
    requirement: CORE-06
    verification:
      - kind: unit
        ref: "packages/core/test/snapshot.test.ts#fixture valid-build: pinned values > loads without errors and stores the sorted tree"
        status: pass
    human_judgment: false
  - id: D2
    description: "Numerics and dates in frontmatter stay strings (1234, 1e3, 1234567, 2026-09-01)"
    requirement: CORE-02
    verification:
      - kind: unit
        ref: "packages/core/test/snapshot.test.ts#numerics and dates stay strings (CORE-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Scenarios carry Markdown line, @ac-n tag, English keyword, and Background steps"
    requirement: CORE-03
    verification:
      - kind: unit
        ref: "packages/core/test/snapshot.test.ts#scenarios carry Markdown lines, tags, and Background steps"
        status: pass
    human_judgment: false
  - id: D4
    description: "EARS lines extracted one per line with list markers stripped and comments removed"
    requirement: FMT-05
    verification:
      - kind: unit
        ref: "packages/core/test/snapshot.test.ts#EARS lines keep their line and lose the list marker"
        status: pass
    human_judgment: false
  - id: D5
    description: "LF, CRLF, BOM+CRLF, mixed endings, and backslash keys produce byte-identical JSON; no backslash in paths; input not mutated"
    requirement: FMT-08
    verification:
      - kind: unit
        ref: "packages/core/test/snapshot.test.ts#fixture valid-build > CRLF, BOM+CRLF, mixed endings, and backslash keys load identically"
        status: pass
      - kind: unit
        ref: "packages/core/test/snapshot.test.ts#fixture valid-build > matches the golden"
        status: pass
    human_judgment: false
  - id: D6
    description: "Built dist exposes loadSnapshot and model types; no ajv, yaml, or gherkin type leaks; both parsers stay external"
    verification:
      - kind: unit
        ref: "packages/core/test/bundle.test.ts#declarations expose the seam"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-09-06
status: complete
---

# Phase 2 Plan 01: Snapshot Loader Tracer Summary

**`loadSnapshot` turns a flat `{ files, tree }` snapshot into typed tickets, line-numbered scenarios, and verification blocks, with one golden that is byte-identical across LF, CRLF, BOM+CRLF, mixed endings, and backslash keys.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-06T07:27:00Z
- **Completed:** 2026-09-06T07:36:12Z
- **Tasks:** 3
- **Files modified:** 29 (staged, uncommitted)

## Accomplishments

- D-52 `Finding` shape and `SchemaFinding`; `validate()` returns `SchemaFinding[]` with `param` for unknown and missing keys; the four Phase 1 goldens carry `pointer`.
- Seven loader modules wired end to end: key normalisation, frontmatter split with the D-33 pointer-to-line rule, config, fence-aware section scanner, EARS extraction, Gherkin extraction with Background/Rule/Outline handling and line remapping, verification blocks.
- `valid-build` fixture (Vietnamese content, English headings, Background, two tagged scenarios, epic, verification record) and its golden; the golden pins ROADMAP criteria 1 to 4.
- Public API (D-55) exports `loadSnapshot` and the model types; the built declaration file leaks no ajv, yaml, or gherkin type.

## Prepared Commits

Nothing was committed. Every file is staged; the owner reviews and commits.

1. `feat(02-01): D-52 Finding shape, RepoSnapshot model, validate() returns SchemaFinding[]`
   - packages/core/src/model/finding.ts, packages/core/src/model/snapshot.ts, packages/core/src/validate/ajv.ts, packages/core/src/index.ts, packages/core/test/schemas.test.ts, packages/core/test/__golden__/ticket.invalid.json, packages/core/test/__golden__/ticket.tracker.invalid.json, packages/core/test/__golden__/config.invalid.json, packages/core/test/__golden__/verification.invalid.json
2. `feat(02-01): loadSnapshot tracer over the valid-build fixture, one golden across five encodings`
   - packages/core/src/load/yaml.ts, frontmatter.ts, config.ts, sections.ts, gherkin.ts, verification.ts, snapshot.ts, packages/core/src/index.ts, packages/core/test/helpers/fixture.ts, packages/core/test/snapshot.test.ts, packages/core/test/__golden__/valid-build.snapshot.json, packages/core/test/fixtures/valid-build/** (8 files)
3. `test(02-01): bundle proof of the Phase 2 API; drop the unused CRLF fixture attribute`
   - packages/core/test/bundle.test.ts, .gitattributes
4. `docs(02-01): complete snapshot loader tracer plan`
   - .planning/phases/02-core-model-and-loading/02-01-SUMMARY.md, .planning/STATE.md, .planning/ROADMAP.md, .planning/REQUIREMENTS.md

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Interface contract (D-52, model, validator seam) | uncommitted (owner review pending) | see Prepared Commit 1 |
| 2 | Tracer: loadSnapshot over valid-build | uncommitted (owner review pending) | see Prepared Commit 2 |
| 3 | Bundle proof, .gitattributes | uncommitted (owner review pending) | see Prepared Commit 3 |

## Verification

`npm run check` (build, lint, typecheck, vitest) exits 0: 7 test files, 75 tests, 0 failures. `git log -1` is still `48e56d7`.

Plan acceptance greps all hold, with one reading note under Findings (backslash count).

## Decisions Made

- `stringNumerics` lives in `load/yaml.ts` and is re-exported from `load/frontmatter.ts`; the plan placed it in frontmatter.ts, but yaml.ts needs it and frontmatter.ts imports yaml.ts, so this avoids an import cycle.
- `Fence` has a `close` line in addition to `info`, `open`, `content`; `requirementLines` needs the range to drop fenced lines.
- `scan()` removes the empty element that `split('\n')` produces after a trailing newline, so `Plan` ends at line 51 and not at a phantom line 52.
- The tracer feedback gate (task 2 is `type="tracer"`): `human_verify_mode` is `end-of-phase` and the verify step is automated only, so the verify was re-run (green) and execution continued without a checkpoint.

## Deviations from Plan

None beyond the three decisions above, which are implementation details the plan left to discretion. No dependency added; `package.json` and `package-lock.json` are unchanged.

## Findings / Decisions for Owner

1. **Golden backslash count.** The plan's criterion is zero occurrences of `\\` (two backslashes). The golden has zero. It does contain one single backslash: the JSON escape of the newline inside the evidence string, which the plan's own expected value (`"npm test -- login.spec.ts\ntest/login.spec.ts covers the happy path"`) requires. A `grep -c -F '\'` therefore prints 1. No path contains a backslash; the test asserts the two-character sequence is absent.
2. **Phase 1 goldens changed beyond the rename.** Entries for `schema.additionalProperties` and `schema.required` now carry `param` (`"sprint"`, `"repo"`, and so on) as the plan specified. Every other entry changed only `path` to `pointer`.
3. **Requirements marked complete on a tracer.** The executor protocol marks the plan's `requirements` (CORE-02, CORE-03, CORE-06, FMT-04, FMT-05, FMT-08) complete in REQUIREMENTS.md. Plans 02-02 to 02-07 add the error paths for the same requirements. If you prefer the checkboxes to flip only at wave end, revert that part of REQUIREMENTS.md.
4. **`Result:` value is trimmed.** `Result: pass ` (trailing space) is accepted as `pass`. The plan says the value is `pass|fail|blocked`; trailing whitespace is treated as noise. Alternative: exact match only. 02-05 can pin whichever you prefer.
5. **D-33 root `schema.required` line** is the first YAML line (Markdown line 2, config.yml line 1), as the plan's flagged assumption states. 02-02 pins it.
6. **Line 1 `## ` heading in scan.** A heading is recognised only with `##` followed by whitespace at column 0; `##` alone or `###` never starts a section. A `## ` heading before the frontmatter is impossible because the frontmatter regex is anchored at the file start.

## Known Stubs

None. Every module implements its D-nn contract; only the error fixtures are deferred to 02-02 to 02-05 as the plan states.

## Threat Flags

None. No new network, file, or auth surface; core still reads only the `SnapshotInput` it is given. T-02-SC holds: no package added.

## Issues Encountered

- `grep -rn "node:"` matched a parameter named `node` followed by a type annotation in yaml.ts; the parameter was renamed so the literal acceptance grep prints 0.
- gherkin's `TableRow` types are readonly; the local `Row` type was made readonly to match without naming the messages package.

## Next Phase Readiness

- Wave 2 plans (02-02 to 02-05, 02-07) can build against `load/*` exports and add fixtures with `npm test -- --project core snapshot -u -t "fixture <name>"`.
- 02-06 (`setFrontmatterKey`) builds on `load/frontmatter.ts` as it stands.

## Self-Check: PASSED

- Created files exist: all 12 created paths listed under key-files are present on disk (verified with the staged file list, 29 entries).
- Commits: none by design (owner commits); `git log -1` unchanged at `48e56d7`.

---
*Phase: 02-core-model-and-loading*
*Completed: 2026-09-06*
