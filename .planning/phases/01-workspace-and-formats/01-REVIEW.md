---
phase: 01-workspace-and-formats
reviewed: 2026-09-06T02:40:01Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - .gitattributes
  - .github/workflows/ci.yml
  - docs/design.md
  - eslint.config.js
  - package.json
  - packages/cli/package.json
  - packages/cli/src/index.ts
  - packages/cli/test/bin.test.ts
  - packages/cli/tsconfig.json
  - packages/cli/tsdown.config.ts
  - packages/cli/vitest.config.ts
  - packages/core/package.json
  - packages/core/schemas/config.schema.json
  - packages/core/schemas/ticket.schema.json
  - packages/core/schemas/verification.schema.json
  - packages/core/scripts/gen-templates.mjs
  - packages/core/src/generated/templates.ts
  - packages/core/src/index.ts
  - packages/core/src/model/finding.ts
  - packages/core/src/validate/ajv.ts
  - packages/core/src/validate/index.ts
  - packages/core/templates/business-rules.md
  - packages/core/templates/epic.md
  - packages/core/templates/glossary.md
  - packages/core/templates/prototype-header.html
  - packages/core/templates/ticket-build.md
  - packages/core/templates/ticket-maintain.md
  - packages/core/templates/verification.md
  - packages/core/test/__golden__/config.invalid.json
  - packages/core/test/__golden__/ticket.invalid.json
  - packages/core/test/__golden__/ticket.tracker.invalid.json
  - packages/core/test/__golden__/verification.invalid.json
  - packages/core/test/bundle.test.ts
  - packages/core/test/convention.test.ts
  - packages/core/test/fixtures/purity/probe.ts
  - packages/core/test/fixtures/purity/tsconfig.json
  - packages/core/test/purity.test.ts
  - packages/core/test/schemas.test.ts
  - packages/core/test/templates.test.ts
  - packages/core/tsconfig.json
  - packages/core/tsconfig.test.json
  - packages/core/tsdown.config.ts
  - packages/core/vitest.config.ts
  - packages/mcp/package.json
  - README.md
  - tsconfig.base.json
  - vitest.config.ts
findings:
  critical: 0
  warning: 6
  info: 10
  total: 16
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-09-06T02:40:01Z
**Depth:** standard
**Files Reviewed:** 47
**Status:** issues_found

## Summary

Working-tree review of the Phase 1 monorepo skeleton, purity guard, three JSON schemas, templates, and tests. Verified locally: `eslint .`, `tsc` (three projects), and `vitest run` (6 files, 64 tests) all pass; `actions/checkout@v7` and `actions/setup-node@v7` tags exist; the built core bundle imports only `ajv/dist/2020.js`. No blockers. Warnings are cross-platform id validity, schema gaps that accept invalid contract files, an incomplete purity list, a seam that throws an opaque TypeError, stale `features/` docs the convention test does not cover, and unpinned CI actions.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: id pattern accepts names that cannot be files on Windows
**File:** `packages/core/schemas/ticket.schema.json:9,13`, `packages/core/schemas/verification.schema.json:9`
**Issue:** `CON`, `PRN`, `AUX`, `NUL`, `COM1`..`COM9`, `LPT1`..`LPT9` pass (verified `id: "CON"` returns no findings) but `tickets/CON.md` cannot be created on Windows; a trailing `.` also passes, and Windows silently creates `tickets/a./` as `tickets/a/`, breaking the D-06 appendix rule.
**Fix:** `"pattern": "^(?![Cc][Oo][Nn]$|[Pp][Rr][Nn]$|[Aa][Uu][Xx]$|[Nn][Uu][Ll]$|[Cc][Oo][Mm][1-9]$|[Ll][Pp][Tt][1-9]$)[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?$"` in all three places, plus a test row for each.

### WR-02: reviewed_on accepts impossible dates
**File:** `packages/core/schemas/verification.schema.json:11`
**Issue:** `2026-13-45` validates (verified); the pattern only checks digit counts.
**Fix:** `"pattern": "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$"` and add the case to the verification golden.

### WR-03: purity layer A is a hand-written list that misses builtins and dynamic import
**File:** `eslint.config.js:5-9,26`
**Issue:** Verified through the ESLint API: `import vm from 'vm'`, `import { setTimeout } from 'timers/promises'`, and `await import('node:fs')` produce no lint error in `packages/core/src`. Layer B (`types: []`) and the bundle test still catch them, but the editor-visible layer is the one that claims completeness (CORE-01).
**Fix:** `import { builtinModules } from 'node:module'` and build `paths` from `builtinModules` (plus `fs/promises`, `timers/promises`, `stream/promises`, `path/posix`, `path/win32`); add a `no-restricted-syntax` selector for `ImportExpression > Literal[value=/^node:/]` if dynamic imports should also fail at lint time.

### WR-04: validate() throws an opaque TypeError on an unknown schema id
**File:** `packages/core/src/validate/ajv.ts:22`
**Issue:** `validate('nope', {})` throws `TypeError: v is not a function` (verified). The seam is the API the MCP host and JS callers hit without TypeScript narrowing.
**Fix:** `const v = validators[schemaId as SchemaId]; if (!v) throw new RangeError(\`unknown schema id '${String(schemaId)}'; expected ${schemaIds.join(', ')}\`);`

### WR-05: design.md §7 still documents the retired features/ folder
**File:** `docs/design.md:112,116,133`
**Issue:** `accord new feature <slug>   # scaffold features/<slug>.md`, `status # table of features and tickets`, and the decision-log row "epic = feature file" contradict D-01 (feature replaced by epic everywhere) and §2. `convention.test.ts:52,66` only assert `features/` is absent from README and §2, so this slipped through.
**Fix:** Replace line 112 with `accord new ticket <id> --type epic|story|bug`, reword 116 and 133, and change the test to `expect(design).not.toMatch(legacyFolder)` over the whole document.

### WR-06: CI actions referenced by mutable tags, no job timeout
**File:** `.github/workflows/ci.yml:17-18`
**Issue:** `actions/checkout@v7` and `actions/setup-node@v7` float; a compromised tag runs arbitrary code on every push and PR. No `timeout-minutes`, so a hung Windows runner burns the 6-hour default.
**Fix:** Pin both to full commit SHAs with a `# v7.x.y` trailing comment and add `timeout-minutes: 15` under `check:`.

## Info

### IN-01: title and design accept degenerate values
**File:** `packages/core/schemas/ticket.schema.json:10,20`
**Issue:** `title: "   "` and `design: "https://"` both validate (verified).
**Fix:** `"pattern": "\\S"` on `title`; `"pattern": "^https://[^\\s/]+"` on `design`.

### IN-02: ajv derivative errors leak into findings
**File:** `packages/core/src/validate/ajv.ts:24`, `packages/core/test/__golden__/config.invalid.json:13-21`
**Issue:** `contains` emits a per-item `/roles/0 schema.const` and `if/then` emits a second `/tracker schema.if` for the same defect; `roles: []` yields two identical `schema.contains` findings. The golden bakes this noise in, so Phase 3 output will show two or three findings per user mistake.
**Fix:** In the seam, drop errors whose `keyword` is `if` or whose `schemaPath` passes through `/contains/`, then dedupe on `(path, rule, reason)`; regenerate the golden.

### IN-03: files lists a README that does not exist
**File:** `packages/core/package.json:11`, `packages/cli/package.json:7`
**Issue:** Neither package directory has a `README.md`; npm publishes without one and warns.
**Fix:** Add a short package README or drop the entry until Phase 9.

### IN-04: unused runtime dependency in core
**File:** `packages/core/package.json:13`
**Issue:** `@cucumber/gherkin` has no importer in this phase; it still ships as a dependency of the published core.
**Fix:** Add it in the phase that imports it.

### IN-05: version literal duplicated in tests
**File:** `packages/core/test/bundle.test.ts:61`, `packages/cli/test/bin.test.ts:20,26`
**Issue:** `0.1.0` is hard-coded three times; every version bump breaks three tests that are not about the version.
**Fix:** Read `version` from the respective `package.json` and compare against that.

### IN-06: cli typecheck depends on a prior core build
**File:** `packages/cli/tsconfig.json:4`, `packages/core/package.json:7`
**Issue:** `tsc -p packages/cli` resolves `@accord-dev/accord-core` through `exports["."].types = ./dist/index.d.ts`, so `npm run typecheck` on a fresh clone fails with TS2307 until `npm run build` has run; CI ordering hides it.
**Fix:** Either document the order in the root `check` script comment or add `"paths": { "@accord-dev/accord-core": ["../core/src/index.ts"] }` to the cli tsconfig.

### IN-07: accord version pattern rejects semver build metadata
**File:** `packages/core/schemas/config.schema.json:9`
**Issue:** `0.1.0+build.1` fails (verified). Harmless if the pin is always an npm-published version.
**Fix:** Append `(\\+[0-9A-Za-z.-]+)?` if build metadata should be allowed; otherwise leave and note the restriction in the schema `description`.

### IN-08: build template and design.md disagree on the Ready design check
**File:** `packages/core/templates/ticket-build.md` Intent comment, `docs/design.md:84`
**Issue:** Template says Ready "requires a Figma link in `design:`"; design.md §5 says "a Figma link or a prototype exists".
**Fix:** Align the wording before Phase 4 implements the gate.

### IN-09: generated core source is fully excluded from lint
**File:** `eslint.config.js:13`
**Issue:** `**/src/generated/**` skips the purity block too, so layer A never inspects a shipped core file; layer B and the bundle test still cover it.
**Fix:** Move the ignore into a style-only block, or keep the purity block's `files` glob unignored for `src/generated`.

### IN-10: commit pattern rejects SHA-256 object names
**File:** `packages/core/schemas/verification.schema.json:10`
**Issue:** `^[0-9a-f]{7,40}$` rejects the 64-hex names of SHA-256 repositories (verified).
**Fix:** `{7,64}` costs nothing; add if such repos are in scope.

---

_Reviewed: 2026-09-06T02:40:01Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
