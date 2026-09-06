---
phase: 01-workspace-and-formats
verified: 2026-09-06T02:45:00Z
status: human_needed
score: 41/43 must-haves verified
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "CORE-01 first clause: pure core over an immutable `RepoSnapshot`"
    addressed_in: "Phase 2"
    evidence: "Phase 2 goal: 'Core turns any repository snapshot into typed tickets, verification records, and scenarios'; requirements CORE-02, CORE-03, CORE-06. Phase 1 delivers the second clause (ESLint bans every `node:*` import) only."
human_verification:
  - test: "After the owner commits and pushes to `main`, open the GitHub Actions run named `ci` and check the four matrix legs: ubuntu-latest/22, ubuntu-latest/24, windows-latest/22, windows-latest/24."
    expected: "All four legs green on the first push that contains code (success criterion 1). If a Node 22 leg fails on tsdown's engine check (^22.18), set that leg's `node-version` to `22.18` (RESEARCH A1)."
    why_human: "No commit or push is allowed in this repo by AI; CI cannot run until the owner pushes. Locally `npm run check` is green on Windows only; the POSIX half of plan 01-01 truth 1 and the `npm ci` step from a clean checkout have not been exercised."
  - test: "Read README.md and docs/design.md §2 to §5 on GitHub as a newcomer (BA, designer, developer, QA)."
    expected: "The folder tree renders; the roles paragraph is coherent; the Done gate names `verified` and the fresh-context review; nothing still describes a per-epic folder, a QA-owned tick, or a Lead role."
    why_human: "The convention test pins phrases, not prose quality or rendering (plan 01-05 coverage item D5, human_judgment: true)."
  - test: "Read the seven files under `packages/core/templates/` once."
    expected: "Guidance comments read correctly for a BA, designer, and developer; the two sample glossary and business-rule entries are acceptable placeholders (the rounding and 30-day values are illustrative, not project rules)."
    why_human: "Wording is Claude's discretion per CONTEXT.md; tests pin only the D-11 phrases, headings, and key order (plan 01-04 coverage item D6, human_judgment: true)."
  - test: "Decide how to resolve the MVP-mode discrepancy: ROADMAP.md marks Phase 1 `Mode: mvp`, but the goal is not in User Story form (`gsd_run query user-story.validate` returns valid: false with three errors)."
    expected: "Either run `/gsd-mvp-phase 1` to record a User Story goal, or clear `Mode:` on Phase 1 since the phase is infrastructure, not a user-facing slice. This report verified against the five ROADMAP success criteria, which is the non-MVP procedure."
    why_human: "The verifier procedure says to refuse MVP-mode verification against a non-story goal; the team lead asked for goal-backward verification against the roadmap criteria instead. Owner decides which record stands."
---

# Phase 1: Workspace and Formats Verification Report

**Phase Goal:** The repository is a three-workspace monorepo with green CI on Ubuntu and Windows, the core cannot import Node built-ins, and the contract's file formats are fixed by schemas and templates.
**Verified:** 2026-09-06T02:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

All evidence below was taken from the working tree at HEAD `0d512c4` (nothing committed, per the owner's rule). SUMMARY.md claims were treated as hypotheses and checked against files and command output.

## Independent command results

`npm run check` run by the verifier (full log in the verifier's scratchpad):

```
> check
> npm run build && npm run lint && npm run typecheck && npm test
tsdown: dist\index.js 13.03 kB, dist\index.d.ts 9.14 kB (core); dist\cli.js 0.43 kB (cli)
eslint . -> no output
tsc -p packages/core && tsc -p packages/core/tsconfig.test.json && tsc -p packages/cli -> no output
vitest run v5.0.0
 Test Files  6 passed (6)
      Tests  64 passed (64)
EXIT=0
```

Direct purity probes, outside vitest:

```
node node_modules/typescript/bin/tsc -p packages/core/test/fixtures/purity
  probe.ts(1,30): error TS2307: Cannot find module 'node:fs' ...   exit=2
eslint --stdin --stdin-filename packages/core/src/__probe_a__.ts   (import 'node:fs')
  -> @typescript-eslint/no-restricted-imports : severity 2
eslint --stdin ... packages/core/src/__probe_b__.ts                (import 'path')
  -> @typescript-eslint/no-restricted-imports : severity 2
eslint --stdin ... packages/core/src/model/__probe_c__.ts          (import 'ajv/dist/2020.js')
  -> no-restricted-imports : severity 2
eslint --stdin ... packages/core/src/__probe_d__.ts                (export const ok = 1)
  -> 0 messages
```

Built artifacts:

```
head -1 packages/cli/dist/cli.js            -> #!/usr/bin/env node
node packages/cli/dist/cli.js               -> accord 0.1.0 / schemas: ticket, verification, config / validate('ticket', {}) -> 4 findings
node packages/cli/dist/cli.js --version     -> 0.1.0
grep -c 'node:' packages/core/dist/index.js -> 0 ; no bare fs/path/child_process/os/url/crypto import
grep -c 'ajv/dist/2020' dist/index.js       -> 1 (ajv stays external)
dist/index.d.ts exports: schemaIds, validate(schemaId: SchemaId, doc: unknown): Finding[], templates, types Finding/SchemaId/TemplateName
```

Template and drift check (verifier script over `dist/index.js` + `yaml`): seven on-disk files equal the seven `templates` export keys with zero drift; `ticket-build.md`, `ticket-maintain.md`, `epic.md` frontmatter validate to `[]` against `ticket`; `verification.md` validates to `[]` against `verification`; `glossary.md`, `business-rules.md`, `prototype-header.html` have no frontmatter; build and maintain have byte-identical frontmatter and identical bodies once HTML comments are stripped; no template contains the legacy per-epic folder name; all seven files are LF with no BOM.

GitHub action tags: `git ls-remote --tags` shows `refs/tags/v7` for both `actions/checkout` and `actions/setup-node`.

## Goal Achievement

### Observable Truths

Roadmap success criteria (the contract):

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| SC1 | CI runs on ubuntu-latest and windows-latest for Node 22 and 24 and is green on the first commit that contains code | ? UNCERTAIN | `.github/workflows/ci.yml` has `os: [ubuntu-latest, windows-latest]`, `node: [22, 24]`, `fail-fast: false`, `permissions: contents: read`, steps `npm ci`, `build`, `lint`, `typecheck`, `test`; both `v7` action tags exist. Green legs need the owner's push (human item 1). |
| SC2 | A ticket frontmatter document and a `config.yml` each validate against a checked-in JSON Schema 2020-12 file, and an invalid document produces a schema error naming the path | ✓ VERIFIED | Three schemas under `packages/core/schemas/` declare `$schema` 2020-12 and parse as JSON. Goldens pin path-bearing findings: `ticket.invalid.json` (8 findings at `''`, `/id`, `/title`, `/type`, `/status`, `/tracker`, `/verified/2`, `/verified`), `config.invalid.json` (5 findings at `''`, `/tracker`, `/tracker`, `/roles/0`, `/roles`), `verification.invalid.json` (3), `ticket.tracker.invalid.json` (3). CLI run shows `validate('ticket', {}) -> 4 findings`. |
| SC3 | The build fails when any file under `core` imports a `node:*` module | ✓ VERIFIED | Direct probes above: tsc exits 2 with TS2307 on `node:fs` under core's `types: []`; ESLint reports severity-2 errors for `node:fs` and bare `path` under `packages/core/src/**`. Both layers also proven inside `npm test` by `purity.test.ts` (9 tests) and `bundle.test.ts` (5 tests). |
| SC4 | Templates exist for build and maintain tickets, glossary, business rules, prototype header, and `verification.md`, and every template with frontmatter validates against its schema | ✓ VERIFIED | `ls packages/core/templates` lists exactly the seven files; the verifier's own script validated the four frontmatter-bearing templates to `[]`; `templates.test.ts` (13 tests) pins the same. |
| SC5 | The folder convention is documented and reflected in the templates: fixed root `accord/` containing `product/`, `tickets/`, `assets/<id>/`, no `features/`, grouping by `parent:`, tracker links as a map keyed by adapter | ✓ VERIFIED | README.md "What it is" bullet names `accord/`, `product/`, `tickets/<id>.md`, `tickets/<id>/verification.md`, `assets/<id>/`, `parent:`, `tracker: { shortcut: "1234" }`; legacy folder count 0. design.md §2 line 3: "The root folder is always `accord/`. It is not configurable". Templates reference `tickets/<id>.md`, `tickets/<id>/verification.md`, `assets/<id>/prototype.html`, `product/glossary.md`; `ticket.schema.json` `tracker` is `patternProperties ^[a-z][a-z0-9-]*$` + `additionalProperties: false`. `convention.test.ts` (5 tests) pins the docs. |

Plan 01-01 truths:

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `npm install` links three workspaces and `npm run build && npm run typecheck` exits 0 on Windows and POSIX | ? UNCERTAIN | Windows: verified (`npm run check` exit 0; `node_modules/@accord-dev/` links `accord`, `accord-core`, `accord-mcp`; single root `package-lock.json`, none under `packages/*`; workspaces `["packages/core", "packages/cli", "packages/mcp"]`). POSIX half is CI-only, folded into human item 1. |
| 2 | `node packages/cli/dist/cli.js` runs under `process.execPath`, first line is the shebang, prints `accord 0.1.0` then schema ids | ✓ VERIFIED | Command output above; `bin.test.ts` spawns `process.execPath` only. |
| 3 | `validate('ticket', doc)` returns `[]` for a valid D-04 document and path-bearing findings for an invalid one | ✓ VERIFIED | `ajv.ts` maps `instancePath` → `path`; golden `ticket.invalid.json` names `/type`, `/tracker`, `/verified/2`; `schemas.test.ts` line 30 and 44. |
| 4 | `validate('config', defaultDoc)` and `validate('verification', minimal)` return `[]` | ✓ VERIFIED | `schemas.test.ts` line 21 (one `it` per schema id) and line 92, 144; verifier's template check validated the shipped `verification.md` frontmatter to `[]`. |
| 5 | Ticket `tracker` is a map keyed by adapter name with string values | ✓ VERIFIED | `ticket.schema.json` lines 16 to 20; golden `ticket.tracker.invalid.json`. |
| 6 | `packages/core/tsconfig.json` has `types: []`, includes only `src` and `schemas/*.json`; core `package.json` has no `@types/node` | ✓ VERIFIED | File contents read directly; `grep -c '@types/node' packages/core/package.json` is 0. |
| 7 | Only `validate/ajv.ts` imports ajv; `src/index.ts` re-exports `validate`, `schemaIds`, `SchemaId`, `Finding` | ✓ VERIFIED | `grep -rl 'ajv/dist' packages/core/src` → only `ajv.ts` (other hits are comments); `index.ts` has the three lines plus the 01-04 `templates` lines. |
| 8 | `ci.yml` runs the five npm steps on the 2×2 matrix with `fail-fast: false` and `permissions: contents: read` | ✓ VERIFIED | File read; no `shell:` key, no `secrets.` reference. |
| 9 | `validate(schemaId, {})` returns one `schema.required` finding per missing key at `''` and never throws; `validate('ticket', null)` returns one `schema.type` finding | ✓ VERIFIED | `schemas.test.ts` line 59; CLI prints 4 findings for `{}`. |

Plan 01-02 truths:

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A core file importing `node:fs` or bare `path` is rejected by ESLint (layer A) and by tsc with TS2307 (layer B) | ✓ VERIFIED | Direct probes above (both layers red on impure input). |
| 2 | Both `node:`-prefixed and bare specifiers (`node:fs`, `fs`, `fs/promises`, `path`) are rejected | ✓ VERIFIED | `eslint.config.js` `paths` list includes `fs`, `fs/promises`, `path`; `patterns: node:*`; `purity.test.ts` cases 1 to 3; verifier probes for `node:fs` and `path`. |
| 3 | A core file other than `validate/ajv.ts` importing `ajv` or `ajv/*` is rejected by base `no-restricted-imports` | ✓ VERIFIED | Verifier probe under `src/model/` → `no-restricted-imports`; `purity.test.ts` exempt case for `validate/ajv.ts`. |
| 4 | Built `dist/index.js` has no built-in import; `dist/index.d.ts` declares `validate` and `Finding` | ✓ VERIFIED | grep results above; `bundle.test.ts`. |
| 5 | Core `package.json` has no `@types/node`; core tsconfig `types: []` | ✓ VERIFIED | As plan 01-01 truth 6. |
| 6 | The tsc probe compiles a committed fixture through its own tsconfig extending core's; the test writes nothing into `src/` | ✓ VERIFIED | Fixture `tsconfig.json` is `{ extends: ../../../tsconfig.json, include: [probe.ts] }`; `writeFileSync` count in `purity.test.ts` is 0; `ls packages/core/src` shows no probe file. |

Plan 01-03 truths:

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | D-16 default config validates; `github-issues` without `repo` → `schema.required` at `/tracker`; undeclared key → `schema.additionalProperties` at `''`; `roles: [ba]` → `schema.contains` at `/roles` | ✓ VERIFIED | Golden `config.invalid.json` content matches exactly; `schemas.test.ts` lines 92 to 141. |
| 2 | `design` accepts only `{ tokens }`; `design.source` rejected at `/design` | ✓ VERIFIED | `config.schema.json` `design` block `additionalProperties: false`; test line 114 with literal `source: 'figma'`. |
| 3 | Tracker map: valid adapter-keyed strings pass; capitalised key, numeric value, empty value each yield a finding under `/tracker` | ✓ VERIFIED | Golden `ticket.tracker.invalid.json` paths `/tracker`, `/tracker/shortcut`, `/tracker/jira`. |
| 4 | `tracker: {}` is valid (D-22) | ✓ VERIFIED | Test line 183; schema has no `minProperties`. |
| 5 | Keys matched case-sensitively against ASCII kebab; `minLength` counts code points (`'é'` accepted) | ✓ VERIFIED | Test line 194 contains `'é'`, `SHORTCUT`, `short_cut`. |
| 6 | verification frontmatter with `commit: 'g'`, `reviewed_on: '2026-9-5'`, extra `reviewer` yields findings at `''`, `/commit`, `/reviewed_on` | ✓ VERIFIED | Golden `verification.invalid.json` content. |
| 7 | `design` accepted on epic; `ui` optional; `ac_hash: ''` rejected; `verified` pattern and uniqueness; `type: feature`, `status: todo`, `owner` rejected | ✓ VERIFIED | Tests lines 204 to 249; all 20 acceptance literals present in the file (verifier grep, each count ≥ 1). |
| 8 | Finding order is deterministic across runs; goldens pin it | ✓ VERIFIED | Test line 161; goldens re-matched in the verifier's `npm test` run. |

Plan 01-04 truths:

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Seven template files exist | ✓ VERIFIED | `ls` shows exactly the seven names. |
| 2 | Three ticket templates validate against `ticket`; `verification.md` against `verification`; glossary and business-rules have no frontmatter | ✓ VERIFIED | Verifier script output above. |
| 3 | Build and maintain have byte-identical frontmatter and identical bodies outside HTML comments; differ in Figma vs prototype wording | ✓ VERIFIED | Verifier script: frontmatter identical true, bodies identical true, build mentions Figma, maintain contains `assets/<id>/prototype.html`. |
| 4 | Every ticket template starts with `id`, `title`, `type`, `status` and ends with the commented `verified` key; `epic.md` has `type: epic` and omits AC and Plan | ✓ VERIFIED | Build and maintain: first four keys `id,title,type,status`, last line `# verified: []`. `epic.md` ends with the `assumptions` comment and has no `verified` line: this matches the plan body (Task 1: "no `ac_hash`/`verified` lines" for epic, 9 keys) and D-01 (epic is never gated), and `templates.test.ts` line 5 pins it. The truth's "every ticket template" wording is broader than the plan's own action; see Anti-Patterns (info). |
| 5 | BA-owned sections carry the D-11 ownership guidance; `## Plan` says the developer fills it in | ✓ VERIFIED | Phrases present in all three ticket templates (`never name tables, endpoints, libraries, or screens`; `Developer fills this in. BA leaves it empty.`). |
| 6 | `verification.md` template has D-09 frontmatter, one `## @ac-1 <scenario name>` block with `Result:` and `Evidence:`; guidance says only the fresh review context writes it | ✓ VERIFIED | File content read; keys `ticket, commit, reviewed_on`. |
| 7 | `templates` exported from core as a const keyed by file name equal to on-disk files (BOM stripped, LF); a drift test fails on an unregenerated change | ✓ VERIFIED | `index.ts` exports `templates` and `TemplateName`; verifier drift count 0; `templates.test.ts` compares each on-disk file with `toBe` and a `run npm run gen` message. |
| 8 | No template mentions a per-epic folder; templates reference the `accord/` layout paths | ✓ VERIFIED | Verifier script: legacy folder false; paths present. |

Plan 01-05 truths:

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | README.md and design.md §2 describe the fixed root `accord/` layout, no per-epic folder, `parent:` grouping, tracker map | ✓ VERIFIED | Grep counts: README `accord/` 1, `tickets/<id>/verification.md` 2, `parent:` 1, `tracker:` 1, legacy folder 0; design §2 to §5 legacy folder 0, `overridable` 0. |
| 2 | REQUIREMENTS.md texts for FMT-01, FMT-02, FMT-06, FMT-07, OPS-01, SKILL-01, SKILL-06, SKILL-07, GATE-02, GATE-05, LINT-05 read per CONTEXT.md | ✓ VERIFIED | Lines 12, 13, 17, 18, 89, 90 read; `qa.ticks` 0, `design source` 0, `configurable` 0, `Six definitions` 0, `review.md` 1. |
| 3 | PROJECT.md says three workspaces, `epic`, developer `verified` ticks, three roles | ✓ VERIFIED | `` `core` / `cli` / `mcp` `` 1, `epic` 3, `verified` 6, `3 roles` 1, `qa.ticks` 0, `QA tick` 0. |
| 4 | design.md §4 lists `ba`, `dev`, `designer`; reviewer is the dev skill's fresh-context `review.md` step that alone writes `verification.md` | ✓ VERIFIED | design.md line 72 states this verbatim; `Lead**` bullet count 0. |
| 5 | design.md §5 Done describes the three-set match | ✓ VERIFIED | `convention.test.ts` and grep (`verified` 2 in §2 to §5). |
| 6 | ROADMAP Phase 1 goal says three-workspace; criterion 5 says fixed root; no criterion names the retired tick key, six definitions, or a QA skill | ✓ VERIFIED | `three-workspace monorepo` 1, `fixed root` 1, `qa.ticks` 0, `Six definitions` 0. |
| 7 | The convention test asserts the truths above and runs in `npm test` | ✓ VERIFIED | `convention.test.ts` (81 lines, 5 tests) in the 64-test run. |

**Score:** 41/43 truths verified (0 present, behavior-unverified; 2 uncertain, both the CI-on-push half of the goal)

### Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | CORE-01 first clause "pure core over an immutable `RepoSnapshot`" | Phase 2 | Phase 2 goal: "Core turns any repository snapshot into typed tickets, verification records, and scenarios"; CORE-02, CORE-03, CORE-06. No `RepoSnapshot` symbol exists yet, and none was planned for Phase 1. |

### Required Artifacts

`gsd_run query verify.artifacts` on all five plans: 32/32 passed (11 + 4 + 4 + 8 + 5). Level 2 to 4 checks by the verifier:

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `package.json` | root workspace manifest | ✓ VERIFIED | Exact workspaces string, scripts `gen`, `build`, `lint`, `typecheck`, `test`, `check`; no `prebuild`/`pretest`; exact pins. |
| `packages/core/src/validate/index.ts` | D-20 seam | ✓ VERIFIED | Re-exports `validate`, `schemaIds`, `SchemaId` from `./ajv.js`; consumed by `index.ts`. |
| `packages/core/src/validate/ajv.ts` | only ajv import | ✓ VERIFIED | `new Ajv2020({ allErrors: true })`, no `strict: true`; JSON imports with `with { type: 'json' }`; compiles three schemas once. |
| `packages/core/src/model/finding.ts` | `Finding` | ✓ VERIFIED | Interface with `path`, `rule`, `reason`; appears in `dist/index.d.ts`. |
| `packages/core/schemas/*.schema.json` | three contracts | ✓ VERIFIED | Parse as JSON; `additionalProperties: false` at every object level; enums, patterns, `if/then`, `contains` as specified in CONTEXT D-01..D-05, D-09, D-13, D-15, D-16, D-21, D-23, D-25. |
| `packages/cli/src/index.ts` | shebang bin | ✓ VERIFIED | First line shebang; imports `@accord-dev/accord-core`; built output runs. |
| `packages/core/test/schemas.test.ts` | schema tests | ✓ VERIFIED | 255 lines, 28 tests across 7 describes. |
| `packages/cli/test/bin.test.ts` | shebang + spawn | ✓ VERIFIED | 28 lines, 4 tests; `process.execPath` only. |
| `.github/workflows/ci.yml` | 2×2 matrix | ✓ VERIFIED | Content read; wired to root scripts. |
| `packages/core/test/purity.test.ts` | guard proof | ✓ VERIFIED | 99 lines, 9 tests; ESLint API + tsc spawn; no writes. |
| `packages/core/test/fixtures/purity/{tsconfig.json,probe.ts}` | committed impure fixture | ✓ VERIFIED | Content as specified; tsc on it exits 2. |
| `packages/core/test/bundle.test.ts` | artifact proof | ✓ VERIFIED | 70 lines, 5 tests; reads `../dist/`, temp dir via `mkdtempSync`. |
| `packages/core/test/__golden__/*.json` | four goldens | ✓ VERIFIED | Contents listed above; paths match plan predictions. |
| `packages/core/templates/*` (7) | templates | ✓ VERIFIED | Content read; schema-valid frontmatter; LF, no BOM. |
| `packages/core/scripts/gen-templates.mjs` | codegen | ✓ VERIFIED | 21 lines; sorted read, BOM strip, CRLF→LF, writes `src/generated/templates.ts`. |
| `packages/core/src/generated/templates.ts` | committed generated module | ✓ VERIFIED | Header comment, seven keys in sorted order, `as const`, `TemplateName`; zero drift vs disk. |
| `packages/core/test/templates.test.ts` | template tests | ✓ VERIFIED | 142 lines, 13 tests. |
| `README.md`, `docs/design.md` | documented convention | ✓ VERIFIED | Grep counts above. |
| `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md` | text updates | ✓ VERIFIED | Grep counts above. |
| `packages/core/test/convention.test.ts` | doc grep test | ✓ VERIFIED | 81 lines, 5 tests. |

### Key Link Verification

`gsd_run query verify.key-links` on all five plans: 17/17 verified (5 + 4 + 2 + 4 + 2). Spot-checked by hand:

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `packages/cli/src/index.ts` | `packages/core/src/index.ts` | `@accord-dev/accord-core` import | WIRED | Built CLI prints core's `schemaIds`; workspace junction present. |
| `packages/core/src/validate/ajv.ts` | `schemas/*.schema.json` | JSON import attributes | WIRED | Three imports; schemas inlined in `dist/index.js`. |
| `packages/core/src/index.ts` | `validate/index.ts`, `generated/templates.ts` | re-exports | WIRED | Both symbols in `dist/index.d.ts`. |
| `package.json` | `packages/core/scripts/gen-templates.mjs` | `gen` script | WIRED | Script line present. |
| `.github/workflows/ci.yml` | `package.json` | five `run:` steps | WIRED | Same sequence as `check`. |
| `purity.test.ts` | `eslint.config.js` | `new ESLint({ cwd: repoRoot })` | WIRED | Rule ids asserted match the two config blocks. |
| `fixtures/purity/tsconfig.json` | `packages/core/tsconfig.json` | `extends` | WIRED | tsc exit 2 with TS2307 proves `types: []` inherited. |
| `convention.test.ts` | `README.md`, `docs/design.md` | `readFileSync` | WIRED | Phrases asserted are present in both files. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `packages/cli/dist/cli.js` | `schemaIds`, `validate('ticket', {})` | core bundle → ajv validators compiled from real schema JSON | Yes (prints 3 ids, 4 findings) | ✓ FLOWING |
| `validate()` | `Finding[]` | `v.errors` from ajv, mapped `instancePath`/`keyword`/`message` | Yes (goldens) | ✓ FLOWING |
| `templates` export | seven strings | `gen-templates.mjs` from on-disk templates | Yes (drift 0; `## Acceptance criteria` present in bundle) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full check sequence | `npm run check` | exit 0; 6 files, 64 tests | ✓ PASS |
| Bin runs under node | `node packages/cli/dist/cli.js` | `accord 0.1.0` + schema ids + 4 findings | ✓ PASS |
| Shebang preserved | `head -1 packages/cli/dist/cli.js` | `#!/usr/bin/env node` | ✓ PASS |
| Layer B red | `node node_modules/typescript/bin/tsc -p packages/core/test/fixtures/purity` | exit 2, TS2307 `node:fs` | ✓ PASS |
| Layer A red (3 impure, 1 clean) | `eslint --stdin --stdin-filename packages/core/src/...` | rule ids as listed above | ✓ PASS |
| Bundle pure | `grep -c 'node:' packages/core/dist/index.js` | 0 | ✓ PASS |
| Template frontmatter valid, no drift | verifier node script over `dist/index.js` | all `[]`; drift 0 | ✓ PASS |
| Action tags exist | `git ls-remote --tags` | `v7` present for both actions | ✓ PASS |
| CI green on 4 legs | GitHub Actions | not runnable before push | ? SKIP (human) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist and no plan declares probe scripts. Step 7c: not applicable.

### Requirements Coverage

Plan frontmatter declares: 01-01 [OPS-01, OPS-02, CORE-01, FMT-02, FMT-03, FMT-06]; 01-02 [CORE-01]; 01-03 [FMT-02, FMT-03, FMT-06]; 01-04 [FMT-07, FMT-01]; 01-05 [FMT-01, OPS-01, FMT-02, FMT-06, FMT-07]. ROADMAP Phase 1 lists the same eight IDs; REQUIREMENTS.md maps all eight to Phase 1 and no others. No orphaned requirement.

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| OPS-01 | 01-01, 01-05 | Monorepo with npm workspaces: `core`, `cli`, `mcp` | ✓ SATISFIED | Three workspaces linked; single lockfile; explicit build order; docs updated. |
| OPS-02 | 01-01 | CI on Ubuntu and Windows for Node 22 and 24 from the first commit | ? NEEDS HUMAN | Workflow correct and wired; legs run only after the owner's push (human item 1). |
| CORE-01 | 01-01, 01-02 | Pure core over an immutable `RepoSnapshot`; ESLint bans every `node:*` import inside core | ✓ SATISFIED (Phase 1 clause) | ESLint + `types: []` layers proven red; bundle pure. `RepoSnapshot` clause deferred to Phase 2 (see Deferred Items). REQUIREMENTS.md already ticks CORE-01 "Complete"; see Gaps Summary note. |
| FMT-01 | 01-04, 01-05 | Folder convention with fixed root `accord/` | ✓ SATISFIED | Docs, templates, and convention test agree. |
| FMT-02 | 01-01, 01-03, 01-05 | Ticket frontmatter JSON Schema with `additionalProperties: false` and the D-04 field set | ✓ SATISFIED | `ticket.schema.json` + 28 schema tests + goldens. |
| FMT-03 | 01-01, 01-03 | Tracker links as a map keyed by adapter name | ✓ SATISFIED | `patternProperties` map; tracker golden. Note: the REQUIREMENTS example `tracker: { github-issues: 42 }` relies on the Phase 2 loader keeping numerics as strings (STACK Decision 2); the schema itself accepts only string values. |
| FMT-06 | 01-01, 01-03, 01-05 | `config.yml` shape validated by its own schema | ✓ SATISFIED | `config.schema.json`; six-key pin; `if/then` for `repo`. |
| FMT-07 | 01-04, 01-05 | Seven templates | ✓ SATISFIED | Files present, schema-valid, exported. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `packages/cli/src/index.ts` | 2 | comment "Phase 1 placeholder entry ... Phase 5 replaces it with commander" | ℹ️ Info | Intentional and plan-declared; the entry is fully functional for Phase 1's contract and tested by `bin.test.ts`. |
| `01-04-PLAN.md` must_haves truth 4 vs Task 1 action | — | truth says "every ticket template ... ends with the commented `verified` key"; Task 1 says `epic.md` has no `ac_hash`/`verified` lines | ℹ️ Info | Plan-internal wording conflict, not a code defect. Code follows the more specific action and D-01; `templates.test.ts` pins epic keys as the story set minus `ac_hash` and `verified`. |
| `.planning/ROADMAP.md` | 103 | Phase 4 criterion 4 still says "implementation, evidence, and tick by one author warn" | ⚠️ Warning (docs) | Contradicts the updated GATE-05 text (implementation and evidence only). Plan 01-05 deliberately left it; reword when Phase 4 is discussed. |
| `.planning/REQUIREMENTS.md` | 23, 141 | CORE-01 ticked Complete although its `RepoSnapshot` clause is a Phase 2 deliverable | ℹ️ Info | Traceability is slightly early; Phase 2 verification should re-confirm CORE-01. |

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or `PLACEHOLDER` markers in any file this phase created or modified. No `test.skip`, `.only`, or `.todo`. No `console.log` in core `src`. No `?raw` imports and no bundler loader.

### Human Verification Required

#### 1. CI matrix on GitHub

**Test:** After the owner commits and pushes to `main`, open the Actions run named `ci`.
**Expected:** ubuntu-latest/22, ubuntu-latest/24, windows-latest/22, windows-latest/24 all green (success criterion 1). If a Node 22 leg fails tsdown's `^22.18` engine check, pin that leg to `22.18`.
**Why human:** No AI commit or push in this repo; `npm ci` from a clean checkout and the POSIX build have not run.

#### 2. README.md and docs/design.md read-through

**Test:** Read both documents rendered on GitHub as a BA, designer, developer, and QA.
**Expected:** Tree renders; roles and gates read coherently; no stale vocabulary.
**Why human:** Prose quality and rendering are not grep-checkable (plan 01-05 D5).

#### 3. Template wording

**Test:** Read the seven files under `packages/core/templates/`.
**Expected:** Guidance reads correctly for each role; sample glossary and business-rule entries are acceptable as placeholders.
**Why human:** Wording was Claude's discretion; tests pin only phrases and structure (plan 01-04 D6).

#### 4. MVP-mode record

**Test:** Decide whether Phase 1 keeps `Mode: mvp`.
**Expected:** Either a User Story goal via `/gsd-mvp-phase 1`, or the mode cleared for this infrastructure phase.
**Why human:** `user-story.validate` returns `valid: false`; this report used the roadmap success criteria instead of the MVP User Flow Coverage procedure.

### Open findings collected from the five summaries

Surfaced here so the owner sees them in one place before committing. None blocks the phase goal.

- 01-01: the `|core|`/`|cli|` reporter prefixes appear only under `--reporter=verbose` or a TTY (cosmetic). Phase 9 prerequisites: create the `accord-dev` npm org (D-17); replace the placeholder schema `$id` base `https://accord.dev/schemas/` (D-26).
- 01-02: the d.ts "no ajv leak" assertion inspects `export` lines only because tsdown writes a `//#region src/validate/ajv.d.ts` comment. First `lintText` call takes about 1.3 s.
- 01-03: ajv emits `schema.if` alongside `schema.required` at `/tracker` for a missing `repo` (duplicate signal; Phase 3 decides whether to hide it). `accord` pin is shape-checked only; exact-vs-range is Phase 5 (CLI-06). Tracker key pattern assumes lowercase kebab adapter names.
- 01-04: guidance for the four required keys is a trailing `#` comment on the key line (the plan asked for both full guidance lines and "first four lines are the keys"); the epic Intent note wording was Claude's; sample glossary and business-rule values are illustrative; angle-bracket placeholders in bodies are human-readable and not replaced by `new ticket`.
- 01-05: ROADMAP Phase 4 criterion 4 wording (above); Phase 1 criterion 5 keeps "no `features/`" as an exclusion; `Last updated` lines use 2026-09-06; README "Not a database" bullet is a factual correction beyond the CONTEXT table; PROJECT.md's diff against HEAD includes the owner's earlier pre-phase edits.

### Gaps Summary

No gaps. Every artifact exists, is substantive, and is wired; both purity layers were proven red by the verifier's own probes; all four frontmatter-bearing templates validate; the drift check is zero; `npm run check` exits 0 with 64 tests on Windows. The only unverified truth is the goal's "green CI on Ubuntu and Windows" clause, which cannot run until the owner pushes, so the status is `human_needed` rather than `passed`. One requirement clause (CORE-01 `RepoSnapshot`) belongs to Phase 2 and is recorded as deferred, not as a gap.

---

_Verified: 2026-09-06T02:45:00Z_
_Verifier: Claude (gsd-verifier)_
