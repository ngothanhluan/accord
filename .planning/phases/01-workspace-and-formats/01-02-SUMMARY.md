---
phase: 01-workspace-and-formats
plan: 02
subsystem: testing
tags: [eslint-api, tsc, vitest, purity-guard, tsdown, bundle]

# Dependency graph
requires:
  - phase: 01-workspace-and-formats (plan 01)
    provides: eslint.config.js purity + seam blocks, packages/core/tsconfig.json with `types: []`, tsconfig.test.json with `types: ["node"]`, built dist/index.{js,d.ts}, core package.json manifest
provides:
  - "`packages/core/test/purity.test.ts`: ESLint API probe (6 cases) proving layer A and the D-20 seam; tsc probe proving layer B (TS2307); static pins on `types: []`, no `@types/node`, and the fixture wiring"
  - "`packages/core/test/fixtures/purity/{tsconfig.json,probe.ts}`: committed impure fixture compiled through core's own guarded tsconfig, outside `src/`"
  - "`packages/core/test/bundle.test.ts`: dist has no built-in import, ajv stays external, d.ts exports the seam only, manifest shape (D-19), missing-build message proven against a temp dir"
affects: [01-03, 01-04, 01-05, phase-2-loaders, phase-8-mcp]

# Actuals (#2632) — chars/4 over the realized diff, same scale as the plan's estimate (28000).
actuals:
  tokens: 1800    # 7,133 chars across 4 new files
  tasks: 2
  commits: 0      # owner commits after review (no-commit policy)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard proofs live in tests: `new ESLint({ cwd: repoRoot }).lintText(code, { filePath })` with a virtual path under `packages/core/src/`, asserting on `ruleId`, never on message text"
    - "Compiler probes are committed fixtures with their own `tsconfig.json` extending the guarded config; tests spawn `process.execPath` + absolute `node_modules/typescript/bin/tsc`, never a `.cmd` shim"
    - "Tests that need a missing-file path use `mkdtempSync` under `tmpdir()`, never the real `dist/`"

key-files:
  created:
    - packages/core/test/purity.test.ts
    - packages/core/test/fixtures/purity/tsconfig.json
    - packages/core/test/fixtures/purity/probe.ts
    - packages/core/test/bundle.test.ts
  modified: []

key-decisions:
  - "The d.ts leak check inspects only `export` lines: tsdown emits a `//#region src/validate/ajv.d.ts` comment that names the seam file but exports nothing from ajv"

patterns-established:
  - "Purity is a red/green signal inside `npm test` (9 purity tests, 5 bundle tests), not a belief"
  - "Probe fixtures sit under `test/fixtures/<name>/` with their own tsconfig so parallel plans running lint/typecheck never see them"

requirements-completed: [CORE-01]

coverage:
  - id: D1
    description: "ESLint rejects `node:fs`, bare `path`, and `fs/promises` under `packages/core/src/` with rule `@typescript-eslint/no-restricted-imports`; clean code passes"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/test/purity.test.ts#layer A: ESLint rejects Node built-ins in core src"
        status: pass
    human_judgment: false
  - id: D2
    description: "ESLint rejects `ajv/dist/2020.js` outside `src/validate/ajv.ts` with base rule `no-restricted-imports` and exempts the seam file (D-20)"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/test/purity.test.ts#ajv outside the seam (D-20)"
        status: pass
      - kind: unit
        ref: "packages/core/test/purity.test.ts#ajv inside validate/ajv.ts is exempt"
        status: pass
    human_judgment: false
  - id: D3
    description: "`tsc -p packages/core/test/fixtures/purity` fails with TS2307 on `node:fs` because the fixture inherits core's `types: []`; fixture wiring and the absence of `@types/node` are pinned"
    requirement: CORE-01
    verification:
      - kind: integration
        ref: "packages/core/test/purity.test.ts#layer B: tsc rejects Node built-ins under core tsconfig"
        status: pass
    human_judgment: false
  - id: D4
    description: "Built `dist/index.js` has no `node:` or bare built-in import and keeps ajv external; `dist/index.d.ts` exports `validate`, `SchemaId`, `schemaIds`, `Finding` and nothing from ajv; `package.json` exports/files/name/version match D-19"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/test/bundle.test.ts#built core bundle"
        status: pass
    human_judgment: false
  - id: D5
    description: "A missing build fails with `run npm run build first`, proven against an empty temp dir without touching `packages/core/dist`"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/test/bundle.test.ts#names the missing build when dist is empty"
        status: pass
    human_judgment: false

# Metrics
duration: 2min
completed: 2026-09-06
status: complete
---

# Phase 1 Plan 02: Purity Guard Proof Summary

**Both core purity layers (ESLint rule and `types: []`) and the D-20 ajv seam are now proven red on impure input and green on clean input by 14 vitest tests, and the built bundle, declarations, and manifest are checked on every `npm test`; `npm run check` is green on Windows with 24 tests.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-09-06T02:04:28Z
- **Completed:** 2026-09-06T02:06:35Z
- **Tasks:** 2
- **Files modified:** 4 (4 created, 0 modified)

## Accomplishments

- `purity.test.ts` drives the ESLint API against the real root flat config with virtual paths under `packages/core/src/`: `node:fs`, bare `path`, and `fs/promises` each yield exactly one `@typescript-eslint/no-restricted-imports` error; `ajv/dist/2020.js` under `src/model/` yields exactly one base `no-restricted-imports` error; the same snippet at `src/validate/ajv.ts` is exempt; clean code yields nothing.
- The tsc probe spawns `process.execPath` with the absolute `tsc` path against a committed fixture whose tsconfig extends core's guarded config; the captured stdout contains `TS2307` and `node:fs`. A second test pins the fixture's `extends`, `include`, and `node:fs` content so it cannot be quietly turned green.
- Static pins: `packages/core/tsconfig.json` has `types: []`; core's `package.json` has no `@types/node` in any dependency block.
- `bundle.test.ts` proves `dist/index.js` has no `node:` or bare built-in import and still references `ajv/dist/2020` (ajv external), `dist/index.d.ts` exports only the seam names, and the manifest carries the D-19 `exports`, `files`, `type`, name, and version, with all three schema files present.
- The missing-build path is proven against an `mkdtempSync` directory; nothing in the suite writes to `src/` or `dist/`.

## Task Commits

Per the repository owner's rule, nothing was committed. All changes are in the working tree for review.

1. **Task 1: Source-level guard proof (ESLint API probe and tsc probe)** - (uncommitted — awaiting owner review)
2. **Task 2: Artifact-level guard proof (bundle and manifest)** - (uncommitted — awaiting owner review)

**Plan metadata:** (uncommitted — awaiting owner review)

## Files Created/Modified

- `packages/core/test/purity.test.ts` - ESLint API probe (6 cases), tsc probe (60 s timeout), fixture-wiring pin, `types: []` and `@types/node` pins
- `packages/core/test/fixtures/purity/tsconfig.json` - `extends ../../../tsconfig.json`, `include: ["probe.ts"]`
- `packages/core/test/fixtures/purity/probe.ts` - the impure input (`import { readFileSync } from 'node:fs'`)
- `packages/core/test/bundle.test.ts` - `assertBuilt` helper, dist purity regexes, d.ts surface, manifest shape

## Verification Output

- `npm test -- --project core purity`: 9 passed, 0 failed.
- `node node_modules/typescript/bin/tsc -p packages/core/test/fixtures/purity`: exit 2, `probe.ts(1,30): error TS2307: Cannot find module 'node:fs'`.
- `npm run build && npm test -- --project core bundle`: 5 passed after the d.ts assertion fix below.
- `npm run check`: exit 0; 4 test files, 24 tests passed.
- `ls packages/core/src` contains no `probe` file; `git log -1` still `0d512c4`.

## Decisions Made

- The "no ajv in exported types" check looks only at lines starting with `export`. tsdown writes a `//#region src/validate/ajv.d.ts` comment into the d.ts, which is a file path and not part of the public type surface. A whole-file grep would fail on that comment for a bundle that is correct.

## Deviations from Plan

None - plan executed exactly as written. The conditional `ajv/**` fallback for case 4 did not trigger (the `ajv/*` pattern caught `ajv/dist/2020.js`, as 01-01 already found).

## Findings / open decisions

- **d.ts region comment.** First run of `bundle.test.ts` failed on `expect(dts).not.toMatch(/ajv/i)` because of tsdown's region comment. This was a too-strict test, not a leak; the bundle's exports are correct. The assertion was narrowed to export lines (see Decisions). If the owner prefers the strict whole-file check, tsdown's region comments would need to be disabled in `tsdown.config.ts`.
- **ESLint first-call latency.** The first `lintText` call takes about 1.3 s (config load and typescript-eslint parser init); later cases take under 15 ms. Well within vitest's default 5 s timeout, so no per-test timeout was added.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CORE-01 is now fully proven by tests in `npm test` and is marked complete; 01-01 was the only other plan declaring it.
- Ready for 01-03 (schema goldens), 01-04 (templates and `gen`), 01-05.
- Any future core file that imports a Node built-in or ajv outside the seam will break `npm run lint`, `npm run typecheck`, and, if it reaches the bundle, `npm test`.

---
*Phase: 01-workspace-and-formats*
*Completed: 2026-09-06*

## Self-Check: PASSED

All 4 test/fixture files and the SUMMARY exist on disk; `npm run check` exit 0 (24 tests); HEAD still `0d512c4` (no commit made).
