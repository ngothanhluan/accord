# Phase 1: Workspace and Formats - Research

**Researched:** 2026-09-05
**Domain:** npm-workspaces TypeScript monorepo (tsdown, vitest 5, ESLint 10), JSON Schema 2020-12 via ajv 8, two-OS GitHub Actions CI, Markdown/YAML file formats
**Confidence:** HIGH — every load-bearing claim below was executed in a throwaway workspace on this machine (Node 24.14, npm 11.9, Windows 11) with the exact pinned versions; only the Windows-runner notes and a few design choices are `[ASSUMED]`

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Ticket frontmatter (schema `ticket.schema.json`)

- **D-01:** `type: epic | story | bug`. `epic` is a grouping container holding intent and EARS for its children; it is linted but never gated. `story` and `bug` are code-touching: they require at least one tagged scenario and go through Ready and Done. The word `feature` is replaced by `epic` everywhere (REQUIREMENTS, PROJECT.md, design.md). — **Reversibility:** costly — the enum is in the published schema and in every ticket file of every adopting repo.
- **D-02:** `status: draft | open | archived`. Document lifecycle only: `draft` blocks Ready, `open` lets gates evaluate, `archived` is excluded from `status` and gates. Work status (Backlog, In Progress, QA, Done) stays in the tracker. Gate results are never stored in the file.
- **D-03:** The tick field is `verified: [ac-1, ac-2]`: a list of `ac-n` tags, optional, always the last key in frontmatter (BA hunks far from dev hunks, PITFALLS 14). Its owner is the developer, as a human self-test checklist run on the dev environment before the card goes to QA. QA works outside the repo on Shortcut. The Done gate keeps the three-set match: scenario tags == evidence tags in `verification.md` == `verified`. — **Reversibility:** costly — field name is in the schema and in the Done gate contract.
- **D-04:** Full field set: `id` (required, equals the file name `tickets/<id>.md`), `title` (required), `type`, `status`, `parent` (optional id), `tracker` (optional map adapter name → string, e.g. `{ shortcut: "1234" }`), `ui` (boolean, default false), `design` (optional string, Figma URL; a prototype is inferred from `assets/<id>/prototype.html`), `assumptions` (optional list of `{ text, confirmed }`), `ac_hash` (optional string, written at Ready PASS), `verified`. Dropped: `owner`, `feature`, `qa`.
- **D-05:** Strict schema: `additionalProperties: false` at every level. A misspelt key is a schema error, and tracker-owned data such as sprint or priority cannot leak into git. All scalars that are not genuinely boolean are `type: string` (numerics stay strings per STACK.md Decision 2).

#### Ticket body and `verification.md`

- **D-06:** `verification.md` lives at `tickets/<id>/verification.md`. Loader rule: `tickets/<id>.md` is the ticket, `tickets/<id>/` holds its appendices, `assets/<id>/` is designer-owned only.
- **D-07:** Fixed English headings in fixed order: `## Intent`, `## Requirements`, `## Acceptance criteria`, `## Open questions`, `## Plan`. The first four are BA-owned; `## Plan` is dev-owned and last. An epic uses the same set without `## Acceptance criteria` and `## Plan`. Extra headings are allowed; lint reports only missing required ones. — **Reversibility:** costly — the Phase 2 fence-aware scanner and every template key on these exact strings.
- **D-08:** Two ticket templates, `ticket-build.md` and `ticket-maintain.md`, with identical structure and schema; they differ only in the guidance comments (Figma link wording for build, prototype wording for maintain). `new ticket` picks by `profile`.
- **D-09:** `verification.md` format: frontmatter `ticket`, `commit`, `reviewed_on` (no `reviewer` field; the git author is the proof), then one `## @ac-n <scenario name>` H2 per scenario, followed by a `Result: pass | fail | blocked` line and an `Evidence:` line whose free text may span several lines. The scenario name after the tag is for humans; matching is by tag. The evidence reference syntax for GATE-04 is decided in Phase 4.
- **D-10:** `product/glossary.md` and `product/business-rules.md` have no frontmatter; they are plain Markdown templates.
- **D-11:** Templates state the ownership rule in their guidance comments: BA-owned sections describe observable behaviour in business language and never name tables, endpoints, libraries, or screens; `## Plan` says "developer fills this in, BA leaves it empty".

#### `config.yml` (schema `config.schema.json`)

- **D-12:** The root folder is always `accord/`. Not configurable. FMT-01 drops "configurable"; design.md §2 drops "defaults to the project name". A `.accord` pointer file can be added later as an additive change. — **Reversibility:** reversible — adding configurability later breaks no existing repo.
- **D-13:** `roles` is a list of role ids. Valid values: `ba | dev | designer`. `ba` and `dev` are required; `designer` is optional. `qa` and `lead` are removed: QA works outside the repo, and the lead's readiness review is a step inside the BA skill. Default at `init`: `[ba, dev]`. The roster's only effect is which skills are rendered and copied; it never changes gate results.
- **D-14:** The reviewer is not a roster role. It is a `review.md` reference file inside the `accord-dev` skill. The dev skill's final step opens a fresh agent context (subagent in Claude Code, new chat in Cursor or Codex) and hands it `review.md`; only that fresh context writes `verification.md`; the agent that wrote the code never does. This is procedural, not tool-enforced, so the skill states it plainly. (Phase 6 concern, recorded here because it changes SKILL-01/06/07.)
- **D-15:** `design.source` is dropped; no rule reads it. Only `design.tokens` (path string, empty when the project has no tokens) remains.
- **D-16:** Shape:
  ```yaml
  accord: "0.1.0"            # version pin as a quoted string
  profile: build             # build | maintain
  tracker:
    adapter: none            # none | github-issues
    # repo: owner/name       # required only when adapter is github-issues (schema if/then)
  design:
    tokens: ""
  roles: [ba, dev]
  runtimes: [claude, codex, cursor, copilot]
  ```
  `runtimes` defaults to all four because they resolve to only two copy targets.

#### Package layout and naming

- **D-17:** npm scope `@accord-dev`. User-facing package `@accord-dev/accord` (bin `accord`), core `@accord-dev/accord-core`. Registry check on 2026-09-05: `@accord-dev/accord` is unpublished; whether an npm org or user named `accord-dev` already exists could not be verified by script. The author must create the org on npmjs.com before Phase 9; record this as a Phase 9 prerequisite. — **Reversibility:** one-way — the scope is written into every generated CI workflow and `config.yml` pin of every adopting repo.
- **D-18:** Three npm workspaces, not four: `packages/core` (model types, schema validator behind a narrow interface, `schemas/*.json`, `templates/*.md`, role workflow definitions, SKILL.md renderer), `packages/cli` (commander wiring, filesystem loader, bin), `packages/mcp` (private, deploy only). There is no separate `skills` package: its content is pure data that both hosts read, so it belongs with schemas and templates in core. OPS-01 changes from four to three.
- **D-19:** Schemas and templates stay as real files under `packages/core/` so humans and editors can read them, and are imported at build time (JSON import, `?raw` or equivalent for Markdown) so core needs no `fs` at runtime. Core exposes them via `exports` (`./schemas/*`).
- **D-20:** Schema validation sits behind a narrow interface, roughly `validate(schemaId, document) → Finding[]`, with ajv as the first implementation. Nothing outside that module imports ajv, so it can be swapped for `@cfworker/json-schema` if the MCP host spike shows ajv's `new Function` is blocked there. (Folded from the `mcp-host-spike` todo.)

### Claude's Discretion

- CI: one `ci.yml`, matrix `ubuntu-latest`/`windows-latest` × Node 22/24, `fail-fast: false`; jobs install, lint (ESLint including the purity rule), typecheck, test, build.
- Purity guard, two layers: ESLint `no-restricted-imports` in `packages/core` banning `node:*` and bare `fs`, `path`, `child_process`, `os`, `url`, `crypto`; plus a core `tsconfig` with `types: []` and no `@types/node`, so a `node:` import also fails typecheck.
- `id` pattern: `^[A-Za-z0-9][A-Za-z0-9._-]*$`; case-sensitive equality with the file name is a lint concern for Phase 3.
- `tracker` object uses `if/then` in the schema so `repo` is required only for `github-issues`.
- Exact wording of template guidance comments, prototype header comment, and `verification.md` template.

### Folded Todos

- **Spike: prove the core runs on the MCP host and commits through the GitHub API** (`.planning/todos/pending/mcp-host-spike.md`). Only its Phase 1 implication is folded: keep the schema validator behind a narrow interface (D-20). The spike itself stays scheduled after Phase 4.

### Requirement text updates (do in this phase)

| Item | Change |
|---|---|
| FMT-01 | Drop "configurable root name"; root is `accord/` |
| FMT-02 | Field set per D-04; `verified` replaces `qa.ticks`; `type` enum per D-01; `status` per D-02 |
| FMT-06 | Drop "design source"; roster values per D-13 |
| FMT-07 | Templates: `ticket-build.md`, `ticket-maintain.md`, `epic.md`, `glossary.md`, `business-rules.md`, prototype header, `verification.md` |
| OPS-01 | Three workspaces: `core`, `cli`, `mcp` |
| SKILL-01 | Three definitions: `ba`, `dev` (with `review.md`), `designer` |
| SKILL-06, SKILL-07 | Merge: the dev skill runs review in a fresh context; only that context writes `verification.md`; only the developer writes `verified` |
| GATE-02 | Third set is `verified`, owned by the developer |
| GATE-05 | Author-mismatch compares implementation and evidence only; developer ticking their own work is expected |
| PROJECT.md | Key Decisions rows on QA ticks and role count; "feature" → "epic" |
| README.md, `docs/design.md` §2, §4, §5 | Folder tree without `features/`; roles; `verified`; `tickets/<id>/verification.md` |

### Deferred Ideas (OUT OF SCOPE)

- **Ticket dependencies / epic roadmap:** a `depends_on: [id]` field plus ordering semantics in `status` or a gate, so developers do not overlap. New capability; own phase. For v0.1 the epic's `## Plan` holds ordering in prose and Shortcut keeps story relationships.
- **Generated status or index file for fast MCP reads:** rejected. Computed state stored in git is a stale cache and a merge-conflict magnet (ARCHITECTURE anti-pattern 2). If the MCP host spike shows folder fetch is slow, cache by commit SHA server-side instead.
- **Lint that flags technical vocabulary in BA-owned sections:** high false-positive risk; consider after pilot data.
- **Extra JS helper files in adopting repos (GSD-style):** not needed; the CLI in the npm package is the deterministic tool the skills call.

#### Reviewed Todos (not folded)
- `mcp-host-spike.md` body (bundling core for a serverless host, GitHub API commit test, folder fetch timing) stays scheduled after Phase 4; only D-20 was taken from it.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (after this phase's text updates) | Research Support |
|----|-------------|------------------|
| OPS-01 | Monorepo with npm workspaces: `core`, `cli`, `mcp` | Pattern 1 (workspace linking, explicit workspace order), Pattern 2 (build-before-typecheck), Code Examples 1–4; verified in spike |
| OPS-02 | CI on Ubuntu and Windows for Node 22 and 24 from the first commit | Pattern 6 + Code Example 10 (`ci.yml`), Environment Availability, Pitfall 9 |
| CORE-01 | Pure core over an immutable `RepoSnapshot`; ESLint bans every `node:*` import inside core | Pattern 4 (two-layer purity guard), Code Examples 3 and 5; both layers verified to fail on `node:fs` and bare `path` |
| FMT-01 | Folder convention: fixed root `accord/` containing `product/`, `tickets/`, `assets/<id>/`; no `features/`; grouping by `parent:` | Folder convention section; templates reflect it; doc updates listed in User Constraints |
| FMT-02 | Ticket frontmatter validated by a JSON Schema 2020-12 file with the D-04 field set | Code Example 7 (`ticket.schema.json`, compiled and exercised under ajv), Pattern 5 (validator interface), Pitfall 3 (template placeholders) |
| FMT-03 | Tracker links are a map keyed by adapter name | `tracker` as `patternProperties` + `additionalProperties: false` in Code Example 7 (satisfies D-05 while staying a map) |
| FMT-06 | `config.yml` with pinned version, profile, tracker adapter, token path, roles, runtimes; own schema | Code Example 6 (`config.schema.json` with `if/then`), Pitfall 2 (ajv `strictRequired`), golden output in Validation Architecture |
| FMT-07 | Templates: `ticket-build.md`, `ticket-maintain.md`, `epic.md`, `glossary.md`, `business-rules.md`, prototype header, `verification.md` | Pattern 3 (template codegen), file inventory, Code Example 9 (template validation test), Code Example 8 (`verification.schema.json`) |
</phase_requirements>

## Summary

Phase 1 is scaffolding plus formats, and nearly every question the planner asked has a verified answer because I built the workspace end to end in a scratchpad with the pinned versions. The layout works exactly as CONTEXT.md describes: three npm workspaces linked by ordinary semver ranges (npm has no `workspace:` protocol and needs none), one `tsconfig.base.json` with per-package `tsconfig.json` files typechecked by `tsc -p` (not project references, which demand `composite` + emit and buy nothing here), one `tsdown.config.ts` per package, a root `vitest.config.ts` with `test.projects: ['packages/*']`, and one ESLint flat config at the root.

Four findings change what the planner would otherwise write. (1) tsdown/rolldown 0.23 does **not** support the `?raw` import query — on Windows it literally tries to open `ticket-build.md?raw` — and while `loader: { '.md': 'text' }` makes tsdown inline Markdown, vitest cannot parse the same import; so D-19's "or equivalent" must be a 20-line prebuild codegen script (`templates/*.md` → `src/generated/templates.ts`) that behaves identically in tsc, vitest, and tsdown. JSON schemas need no such step: `import schema from '../schemas/x.json' with { type: 'json' }` inlines in tsdown and resolves in vitest and tsc. (2) tsdown emits `dist/cli.mjs` by default for `platform: 'node'` (`fixedExtension` defaults to `platform === 'node'`); set `fixedExtension: false` or point `bin` at `.mjs`. (3) ajv's `strict: true` enables `strictRequired`, which throws on D-16's `then: { required: ["repo"] }`; use ajv's defaults (`strictRequired: false`, `strictSchema: true`) with `allErrors: true`. (4) Under `module: nodenext`, `import Ajv2020 from 'ajv/dist/2020.js'` is "not constructable"; the named export `import { Ajv2020 } from 'ajv/dist/2020.js'` works in tsc, tsdown, and at runtime in Node ESM.

The purity guard is solid: with `"types": []` in `packages/core/tsconfig.json`, `import 'node:fs'` and bare `import 'path'` both fail with TS2307 even though `@types/node` is hoisted to the root `node_modules`, and none of ajv 8.20, yaml 2.9, or `@cucumber/gherkin` 42 carries a `/// <reference types="node" />` that would smuggle it back in. The ESLint layer catches the same two imports with a different error, so a violation fails both `lint` and `typecheck` in CI.

**Primary recommendation:** Build the workspace exactly as in Code Examples 1–5 and 10, generate templates with the codegen script (Pattern 3), keep ajv behind `validate(schemaId, doc): Finding[]` with default strictness, and land the three schemas from Code Examples 6–8 plus the templates with a single vitest project whose goldens capture the `instancePath`-bearing error lists.

## Project Constraints (from CLAUDE.md)

Directives extracted from `C:/Work/accord/.claude/CLAUDE.md` and the user's global `~/.claude/CLAUDE.md`; the planner must honour them as locked decisions.

| Directive | Source | Consequence for Phase 1 plans |
|---|---|---|
| NEVER `git commit` or push until the user explicitly approves | global CLAUDE.md | Every plan's commit step is "stage and stop"; STATE/ROADMAP updates stay in the working tree |
| No AI attribution in commits or PRs | global + project ("Attribution: commits authored solely by the author") | No `Co-Authored-By` trailers, no "Generated with" lines |
| Simplicity first; minimum code; no single-use abstractions | global CLAUDE.md | No project references, no changesets, no turbo/nx; `mcp` workspace is a stub `package.json` only |
| Uncertain business logic is a finding, not an assumption | global CLAUDE.md | Open Questions 1–4 below must be surfaced to the user before the schemas are locked |
| Documents for the user are HTML artifacts; `.planning/**` stays Markdown | global CLAUDE.md | RESEARCH/PLAN files remain Markdown |
| Isomorphic core: no `node:fs` / `node:child_process` outside loaders; MCP host has no filesystem | project CLAUDE.md | CORE-01 two-layer guard; templates/schemas imported at build time |
| No API keys; accord never calls a model | project CLAUDE.md | Nothing in Phase 1 touches this; keep it out of `config.yml` |
| Cross-platform: CLI runs on Windows and POSIX | project CLAUDE.md | Two-OS CI matrix; `path.posix` in any test that prints paths; `.gitattributes` LF |
| Naming: publish scoped (`@accord-dev/*` per D-17) | project CLAUDE.md | Package names in Code Examples 1–2 |
| Technology Stack table: TypeScript 5.9.3 pinned (not 7.x), Node `>=22.12.0`, commander 15, yaml 2.9, ajv 8.20, tsdown 0.23, vitest 5, eslint 10.10 + typescript-eslint 8.69 | project CLAUDE.md | Reused verbatim; versions re-confirmed on the registry today |
| "What NOT to use" table: no gray-matter, js-yaml, picocolors, cli-table3, `__dirname`, `path.join` for stored paths, TypeScript 7, Node 20, zod as schema source, Markdown parser in v0.1 | project CLAUDE.md | Test-only frontmatter split uses the 10-line regex + `yaml`, not gray-matter |
| GSD workflow enforcement: file edits happen through GSD commands | project CLAUDE.md | Execution via `/gsd-execute-phase` |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema validation (`validate(schemaId, doc)`) | Core library (`packages/core`) | — | Same JSON file and same function must run in the CLI host and the MCP host; pure function over a parsed object |
| Schemas and templates as data | Core library (files under `packages/core/{schemas,templates}`) | Build step (`packages/core/scripts/gen-templates.mjs`) | Humans and editors read the files; the build inlines them so core needs no `fs` at runtime |
| Frontmatter split + YAML parse (Phase 1: test-only) | Test code in `packages/core/test` | Core loader in Phase 2 | Phase 1 has no parser; a 10-line split validates templates in tests without committing to an API |
| Filesystem, `process`, `node:` APIs | CLI host (`packages/cli`) | MCP host later | Only hosts touch I/O; enforced by ESLint + `types: []` |
| Build and typecheck orchestration | Repo root (`package.json` scripts) | Per-package `tsdown.config.ts` / `tsconfig.json` | Root fans out; packages own their entries |
| CI matrix | `.github/workflows/ci.yml` | — | OPS-02; two OS × two Node versions |
| Folder convention documentation | `README.md`, `docs/design.md`, templates | REQUIREMENTS/PROJECT text updates | Success criterion 5 |

## Standard Stack

All versions re-checked against the npm registry on 2026-09-05 with `npm view`; behaviour verified by running in the spike unless tagged otherwise. STACK.md Decision 8 (single package) is superseded by D-18.

### Core (runtime dependencies of `packages/core`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ajv | 8.20.0 | JSON Schema 2020-12 validation behind `validate()` | `instancePath` maps to `Finding.path`; `Ajv2020` named export; CJS but bundles/imports cleanly from ESM `[VERIFIED: spike run]` |
| yaml | 2.9.0 | Frontmatter parse (test-only in Phase 1; core loader in Phase 2) | Core schema + `customTags` filter keeps `1e3`, `0123`, dates, `no` as strings `[VERIFIED: spike run, matches STACK.md Decision 2]` |
| @cucumber/gherkin | 42.0.1 | Declared now so the dependency set is fixed; used from Phase 2 | Settled by ARCHITECTURE.md; no `@types/node` reference in its `.d.ts` `[VERIFIED: grep of installed d.ts]` |

### CLI (runtime dependencies of `packages/cli`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @accord-dev/accord-core | `0.1.0` (workspace-linked) | Core API | npm symlinks the sibling workspace when the range matches `[VERIFIED: spike install]` |
| commander | 15.0.0 | Arg parsing (Phase 5; declare now) | ESM-only, Node >= 22.12 floor `[CITED: CLAUDE.md stack table]` |

### Development (root `devDependencies`)
| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| typescript | 5.9.3 | Typecheck (`tsc -p`), `dts` for tsdown | Pin; latest tag is 7.0.2 but typescript-eslint peers `<6.1.0` `[VERIFIED: npm view]` |
| tsdown | 0.23.0 | Bundle each package; `dts: true` for core | Engines `^22.18 \|\| ^24.11 \|\| >=26` — use Node 24 for local builds; CI matrix Node 22 = 22.x latest which is >= 22.18 `[VERIFIED: npm view engines]` |
| vitest | 5.0.0 | Tests, `projects`, `toMatchFileSnapshot` | Engines `^22.12 \|\| ^24 \|\| >=26` `[VERIFIED: npm view]` |
| eslint | 10.10.0 | Flat config, purity rule | Engines `^20.19 \|\| ^22.13 \|\| >=24` `[VERIFIED: npm view]` |
| typescript-eslint | 8.69.0 | `tseslint.config`, `@typescript-eslint/no-restricted-imports` | Peers eslint `^8.57 \|\| ^9 \|\| ^10`, typescript `>=4.8.4 <6.1` `[VERIFIED: npm view]` |
| @eslint/js | 10.0.1 | `js.configs.recommended` | `[VERIFIED: npm view]` |
| globals | 17.12.0 | `globals.node` for `.mjs` scripts and tests under `js.configs.recommended` | Without it `no-undef` flags `console`/`URL` in `scripts/*.mjs` `[VERIFIED: spike run]` |
| @types/node | 24.13.3 (pin to the 24 line) | Types for `packages/cli` and test files only | Latest tag is 26.4.1; pin the major to the CI floor's upper LTS. Must NOT appear in `packages/core/tsconfig.json` `types` `[VERIFIED: npm view]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Codegen script for templates | tsdown `loader: { '.md': 'text' }` | Works in tsdown only; vitest/Vite fails to parse a plain `.md` import (`RolldownError: Parse failure`) `[VERIFIED: spike run]` — would need a Vite plugin for tests, two mechanisms for one thing |
| Codegen script for templates | `?raw` query | Unsupported by rolldown 0.23; `UNLOADABLE_DEPENDENCY ... os error 123` on Windows `[VERIFIED: spike run]` |
| Per-package `tsc -p` | TypeScript project references (`tsc -b`) | Requires `composite: true` and emit on core (TS6306/TS6310) `[VERIFIED: spike run]`; conflicts with tsdown owning `dist/` |
| Build core before typechecking cli | `exports` `development` condition → `src/index.ts` + `customConditions` | Removes the build-first ordering but adds a resolution mode that differs between tsc, vitest, and Node; revisit if the dev loop hurts `[ASSUMED]` |
| ajv defaults | `strict: true` | Turns on `strictRequired`, which throws on `if/then` `required` (ajv #1950) `[VERIFIED: spike run]` `[CITED: github.com/ajv-validator/ajv/issues/1950]` |
| ajv runtime compile | `ajv/dist/standalone` precompiled validators | Removes `new Function` for CSP hosts; defer until the MCP host spike proves it necessary (D-20 keeps the door open) |
| `globals` package | Hand-written `languageOptions.globals` | Fewer deps but a list to maintain; `globals` is the ESLint-documented route |

**Installation** (root):
```bash
npm install -D typescript@5.9.3 tsdown@0.23.0 vitest@5.0.0 eslint@10.10.0 typescript-eslint@8.69.0 @eslint/js@10.0.1 globals@17.12.0 @types/node@24.13.3
npm install -w packages/core ajv@8.20.0 yaml@2.9.0 @cucumber/gherkin@42.0.1
npm install -w packages/cli commander@15.0.0 @accord-dev/accord-core@0.1.0
```
`npm install <sibling> -w <pkg>` detects the workspace and symlinks it `[CITED: docs.npmjs.com/cli/v11/using-npm/workspaces]`. Commit the root `package-lock.json`; there is only one.

## Package Legitimacy Audit

Seam: `gsd-tools query package-legitimacy check --ecosystem npm ...` (2026-09-05). The seam's `too-new` signal keys on the **latest publish date**, not package age; every `SUS` below is a decade-old, >5M-downloads/week package that shipped a release in the last week. I am recording the raw verdict and overriding to Approved with the reason stated; no `checkpoint:human-verify` is warranted for these.

| Package | Registry | Latest publish | Downloads/wk | Source Repo | Seam verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| typescript | npm | 2026-07-08 | 273M | github.com/microsoft/TypeScript | OK | Approved |
| tsdown | npm | 2026-09-03 | 5.7M | github.com/rolldown/tsdown | SUS (too-new) | Approved — latest-release artifact; already in CLAUDE.md stack |
| vitest | npm | 2026-09-03 | 100M | github.com/vitest-dev/vitest | SUS (too-new) | Approved — same |
| eslint | npm | 2026-09-04 | 159M | github.com/eslint/eslint | SUS (too-new) | Approved — same |
| typescript-eslint | npm | 2026-08-31 | 87M | github.com/typescript-eslint/typescript-eslint | SUS (too-new) | Approved — same |
| @eslint/js | npm | 2026-02-06 | 143M | github.com/eslint/eslint | OK | Approved |
| ajv | npm | 2026-04-24 | 378M | github.com/ajv-validator/ajv | OK | Approved |
| yaml | npm | 2026-05-11 | 202M | github.com/eemeli/yaml | OK | Approved |
| @cucumber/gherkin | npm | 2026-08-05 | 6.6M | github.com/cucumber/gherkin | OK | Approved |
| commander | npm | 2026-05-29 | 508M | github.com/tj/commander.js | OK | Approved |
| @types/node | npm | 2026-09-01 | 430M | github.com/DefinitelyTyped/DefinitelyTyped | SUS (too-new) | Approved — DefinitelyTyped publishes daily |
| globals | npm | 2026-09-01 | 269M | github.com/sindresorhus/globals | SUS (too-new) | Approved — same artifact |
| ajv-formats | npm | 2024-03-30 | 129M | github.com/ajv-validator/ajv-formats | OK | Not needed — schemas use `pattern`, no `format:` |

No package has a `postinstall` script (seam `postinstall: null` for all). **Packages removed due to [SLOP] verdict:** none. **Packages flagged as suspicious [SUS] after review:** none.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌──────────────────────── repo root ────────────────────────┐
                     │ package.json (workspaces, fan-out scripts)  package-lock  │
                     │ tsconfig.base.json  eslint.config.js  vitest.config.ts    │
                     │ .github/workflows/ci.yml  .gitattributes                  │
                     └─────────────┬────────────────────┬────────────────────────┘
                                   │                    │
        ┌──────────────────────────▼──────────┐   ┌─────▼──────────────────────────┐   ┌──────────────────┐
        │ packages/core  @accord-dev/accord-core│   │ packages/cli  @accord-dev/accord │   │ packages/mcp     │
        │                                      │   │ bin: dist/cli.js (shebang)       │   │ private stub     │
        │ schemas/*.json ──┐ (JSON import,      │   │ depends "@accord-dev/accord-core"│   │ depends on core  │
        │                  │  with {type:json}) │   │   ← npm symlink (node_modules/   │   └──────────────────┘
        │ templates/*.md ─►│ scripts/gen-       │   │      @accord-dev/accord-core →   │
        │ templates/*.html │ templates.mjs      │   │      ../../packages/core)        │
        │                  ▼                    │   │                                  │
        │ src/generated/templates.ts (committed)│   │ src/index.ts (Phase 5 fills in)  │
        │ src/validate/ajv.ts  ← only ajv import│   │ types: ["node"] allowed here     │
        │ src/validate/index.ts validate(id,doc)│   └──────────────┬───────────────────┘
        │ src/index.ts  (public API)            │                  │ tsc -p after core build
        │ tsconfig: types: []  ← guard layer B  │                  │ (resolves exports.types →
        │ eslint no-restricted-imports ← layer A│                  │  core/dist/index.d.ts)
        └──────────────┬───────────────────────┘                  │
                       │ tsdown (platform neutral, dts, ESM)       │ tsdown (platform node, fixedExtension:false)
                       ▼                                           ▼
             dist/index.js + index.d.ts                    dist/cli.js  (#!/usr/bin/env node)
             (ajv/yaml/gherkin external; md+json inlined; zero node: imports)

  CI (ubuntu, windows) × (22, 24):  npm ci → build → lint → typecheck → test
                                     ▲ build first so cli typecheck/tests see core/dist/index.d.ts
```

### Recommended Project Structure

```
accord/                                  # repo root
├── package.json                         # private, workspaces listed EXPLICITLY in build order
├── package-lock.json
├── tsconfig.base.json                   # shared compilerOptions, noEmit
├── eslint.config.js                     # flat config incl. core purity rule
├── vitest.config.ts                     # test.projects: ['packages/*'], pool: 'forks'
├── .gitattributes                       # existing + `test/fixtures/**/crlf-* -text`
├── .github/workflows/ci.yml
├── packages/
│   ├── core/
│   │   ├── package.json                 # @accord-dev/accord-core; exports ".", "./schemas/*", "./package.json"
│   │   ├── tsconfig.json                # extends base; types: []; include src, test, schemas/*.json
│   │   ├── tsdown.config.ts             # entry index; platform neutral; dts; fixedExtension false
│   │   ├── vitest.config.ts             # name: 'core'
│   │   ├── schemas/
│   │   │   ├── ticket.schema.json
│   │   │   ├── verification.schema.json
│   │   │   └── config.schema.json
│   │   ├── templates/
│   │   │   ├── ticket-build.md
│   │   │   ├── ticket-maintain.md
│   │   │   ├── epic.md
│   │   │   ├── glossary.md
│   │   │   ├── business-rules.md
│   │   │   ├── prototype-header.html
│   │   │   └── verification.md
│   │   ├── scripts/gen-templates.mjs    # node script, outside src/, may use node:fs
│   │   ├── src/
│   │   │   ├── index.ts                 # public API: validate, schemas, templates, types
│   │   │   ├── generated/templates.ts   # committed; drift test regenerates and compares
│   │   │   ├── schemas.ts               # JSON imports, `schemaIds` union
│   │   │   ├── model/finding.ts         # Finding type (path, rule, reason) — Phase 3 extends
│   │   │   └── validate/
│   │   │       ├── index.ts             # validate(schemaId, doc): Finding[]  (the D-20 seam)
│   │   │       └── ajv.ts               # only file that imports ajv
│   │   └── test/
│   │       ├── schemas.test.ts          # goldens for valid/invalid docs per schema
│   │       ├── templates.test.ts        # every template with frontmatter validates; drift check
│   │       ├── purity.test.ts           # dist/index.js has no node:/fs/path imports
│   │       └── __golden__/*.json
│   ├── cli/
│   │   ├── package.json                 # @accord-dev/accord; bin accord → dist/cli.js
│   │   ├── tsconfig.json                # extends base; types: ["node"]
│   │   ├── tsdown.config.ts             # entry cli; platform node; fixedExtension false
│   │   ├── vitest.config.ts             # name: 'cli'
│   │   ├── src/index.ts                 # shebang + placeholder that imports core (proves linking)
│   │   └── test/bin.test.ts             # dist/cli.js starts with '#!'; spawn via process.execPath
│   └── mcp/
│       └── package.json                 # private: true; depends on core; nothing else in Phase 1
├── README.md, docs/design.md            # updated per User Constraints table
└── .planning/                           # REQUIREMENTS/PROJECT text updates
```

### Folder convention the templates must reflect (FMT-01, success criterion 5)

```
accord/                          # fixed root (D-12)
  config.yml                     # D-16 shape; validated by config.schema.json
  product/
    glossary.md                  # no frontmatter (D-10)
    business-rules.md            # no frontmatter (D-10)
  tickets/
    <id>.md                      # ticket; frontmatter per ticket.schema.json; type epic|story|bug
    <id>/verification.md         # appendix, written by the fresh review context (D-06, D-09)
  assets/<id>/prototype.html     # designer-owned; opens with the prototype header comment
```
Grouping is `parent: <epic-id>` in frontmatter; no `features/` folder.

### Pattern 1: npm workspaces with explicit order and semver linking

**What:** Root `package.json` lists workspaces **explicitly in dependency order**, and `packages/cli` depends on `"@accord-dev/accord-core": "0.1.0"`.
**Why explicit order:** `npm run build --workspaces` runs in the order of the `workspaces` array; `"packages/*"` expands alphabetically, so `cli` ran before `core` in the spike (`@accord-dev/accord -> @accord-dev/accord-core -> @accord-dev/accord-mcp`) `[VERIFIED: spike run]`. Build order only matters for `typecheck`/`test` of cli (they resolve `core/dist/index.d.ts`), but listing explicitly costs nothing and removes the surprise.
**Linking:** With the version spec `"0.1.0"`, `npm install` created `node_modules/@accord-dev/accord-core -> ../../packages/core` `[VERIFIED: spike install]`; npm prefers the local workspace whenever the range is satisfied `[CITED: github.com/npm/cli workspaces/arborist/docs/workspace.md]`. Keep the two `version` fields in lockstep (a version bump script is Phase 9's problem; note it in STATE).
**Hoisting side-effect:** ajv 8 lands in `packages/core/node_modules/ajv` because ESLint pulls ajv 6 into the root `node_modules/ajv` `[VERIFIED: spike]`. Harmless, but any grep or script that assumes `node_modules/ajv` at the root reads the wrong ajv.

### Pattern 2: Typecheck per package after building core

**What:** `tsconfig.base.json` holds shared options with `noEmit: true`; each package's `tsconfig.json` extends it; root `typecheck` runs `tsc -p packages/core && tsc -p packages/cli`. Core's `tsdown` build (`dts: true`) must run first so `packages/cli` resolves `@accord-dev/accord-core` through `exports["."].types → ./dist/index.d.ts` `[VERIFIED: tsc -p packages/cli failed with TS2307 before the core build, passed after]`.
**Why not project references:** `tsc -b` with `references` requires the referenced project to have `composite: true` and to emit (errors TS6306, TS6310) `[VERIFIED: spike run]`. That means a second declaration output alongside tsdown's, or letting `tsc` own `dist/`. Not worth it for two packages.
**CI order:** `npm ci → npm run build → npm run lint → npm run typecheck → npm test`.

### Pattern 3: Templates via committed codegen; schemas via JSON import

**What:** `packages/core/scripts/gen-templates.mjs` reads `templates/*.{md,html}`, normalises BOM/CRLF, and writes `src/generated/templates.ts` exporting `templates` as a `const` object keyed by file name. The generated file is committed; a test regenerates into memory and asserts equality (drift guard). Schemas are imported directly: `import ticketSchema from '../schemas/ticket.schema.json' with { type: 'json' }`.
**Evidence:** tsc, tsdown (`md inlined: 1`, `json inlined: 2`, `node builtins in bundle: 0`, `.d.ts` emitted), vitest (2 tests passed), and the built CLI all agreed on this route `[VERIFIED: spike run]`. `?raw` failed in tsdown; `loader` text worked in tsdown but not vitest (see Alternatives).
**Root script:** `"gen": "node packages/core/scripts/gen-templates.mjs"`; `prebuild` and `pretest` call it so a stale generated file cannot reach CI green, and the drift test guarantees the committed copy matches.
**ESLint:** ignore `**/src/generated/**`; give `scripts/**` and `test/**` `globals.node`.

### Pattern 4: Two-layer purity guard (CORE-01)

**Layer A — ESLint.** `@typescript-eslint/no-restricted-imports` scoped to `packages/core/src/**/*.ts` with `paths` for every bare built-in name and `patterns: [{ group: ['node:*'] }]`. Verified output on a dirty file: `'node:fs' import is restricted from being used by a pattern` and `'path' import is restricted from being used` `[VERIFIED: spike run]`. Config shape from the typescript-eslint rule docs `[CITED: typescript-eslint.io/rules/no-restricted-imports]`.
**Layer B — tsconfig.** `packages/core/tsconfig.json` sets `"types": []`. TypeScript's own docs: with `types` specified, "only packages listed will be included in the global scope" `[CITED: typescriptlang.org/tsconfig/types]`. Effect verified: `import { readFileSync } from 'node:fs'` → TS2307; `import path from 'path'` → TS2307; hoisted `node_modules/@types/node` did not leak `[VERIFIED: spike run]`. The only way it leaks is a dependency `.d.ts` with `/// <reference types="node" />`; ajv 8.20, yaml 2.9, @cucumber/gherkin 42 and @cucumber/messages have none `[VERIFIED: grep of installed d.ts]`. Add a test that greps `packages/core/dist/index.js` for `from "node:` / `from "fs"` / `from "path"` as a third, cheap check on the bundle (Success criterion 3 says "the build fails"; make `build` run `lint` + `typecheck` + this test).
**tsdown:** `platform: 'neutral'` for core so a stray built-in is not silently resolved as external Node `[CITED: tsdown docs/options/platform.md]`.

### Pattern 5: Validator behind a narrow seam (D-20)

**What:** `src/validate/index.ts` exports `validate(schemaId: SchemaId, doc: unknown): Finding[]` and re-exports nothing from ajv. `src/validate/ajv.ts` owns `new Ajv2020({ allErrors: true })`, compiles all three schemas once at module load, and maps `ErrorObject` → `Finding` (`path: e.instancePath`, `rule: 'schema.' + e.keyword`, `reason: e.message`). ESLint `no-restricted-imports` with `paths: [{ name: 'ajv' }]` + `patterns: ['ajv/*']` applied to `packages/core/src/**` except `src/validate/ajv.ts` keeps the seam honest.
**ajv facts:** named export `Ajv2020` exists (`export declare class Ajv2020`; `exports.Ajv2020 = Ajv2020; module.exports = exports = Ajv2020`) `[VERIFIED: ajv/dist/2020.d.ts:3, 2020.js:37-38]`; default strictness is `strictSchema: true, strictTypes: 'log', strictRequired: false` `[CITED: ajv docs/strict-mode.md — "By default this option is disabled"]`; `compile()` uses `new Function` `[VERIFIED: ajv/dist/compile/index.js:89]`; `ajv/dist/standalone` can precompile to plain JS if a CSP host blocks it `[CITED: ajv.js.org/standalone]`.
**Error order** (for golden stability): ajv emits errors in schema-evaluation order — `additionalProperties` at `""` first, then nested paths; identical across two runs `[VERIFIED: spike goldens stable on re-run]`.

### Pattern 6: One CI workflow, matrix, build-first

`actions/checkout@v7` and `actions/setup-node@v7` are the current majors (v7.0.1 released 2026-07-20 and v7.0.0 released 2026-07-14 respectively) `[VERIFIED: gh api releases/latest]`. `cache: npm` hashes the root `package-lock.json` by default; `cache-dependency-path` is only for non-root lockfiles `[CITED: github.com/actions/setup-node/docs/advanced-usage.md]`. See Code Example 10.

### Anti-Patterns to Avoid
- **`?raw` imports anywhere in `packages/core/src`:** fail the tsdown build on Windows with a misleading OS error `[VERIFIED]`.
- **`strict: true` on the ajv constructor:** breaks D-16's `if/then` at compile time, before any document is validated `[VERIFIED]`.
- **`import Ajv2020 from 'ajv/dist/2020.js'` (default import):** TS2351 under `nodenext` `[VERIFIED]`.
- **`"workspaces": ["packages/*"]` with a build that depends on order:** alphabetical, cli first `[VERIFIED]`.
- **`{{id}}`-style tokens in template frontmatter:** `id: "{{id}}"` fails the `id` pattern, so "every template validates against its schema" cannot hold `[VERIFIED: ticket schema probe]`. Use valid literal placeholders (`id: "TICKET-ID"`, `title: "Short title"`); `new ticket` (Phase 5) sets the id by key with `yaml`'s `parseDocument().setIn`, not by token replacement.
- **Writing schema files through shell heredocs/sed:** this session's Bash layer collapsed `\\d` to `\d`, producing invalid JSON; write schema files with the file-write tool and add `JSON.parse` of every schema to the test suite.
- **`types: ["node"]` in `tsconfig.base.json`:** would re-admit `@types/node` into core; put it only in `packages/cli/tsconfig.json` and in core's test config if tests need it (they should not — vitest globals come from `vitest`, not `@types/node`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema evaluation | A recursive object checker | ajv 8 (`Ajv2020`) behind `validate()` | `if/then`, `contains`, `uniqueItems`, `patternProperties`, error paths — and the same file must drive editor autocomplete and future hosts |
| YAML frontmatter parse | Regex key/value splitter | `yaml` 2.9 `parse(text, { schema: 'core', customTags })` | Norway problem, dates, `1e3`; STACK Decision 2 verified again today |
| Terminal colour / tables | (not in Phase 1) | — | — |
| Workspace task orchestration | turbo / nx / lerna | `npm run <script> -w <pkg>` sequences in root scripts | Three packages, one author; the ordering problem is solved by listing workspaces |
| Declaration bundling | Hand-maintained `.d.ts` | tsdown `dts: true` (rolldown-plugin-dts) | Verified output includes the `Finding` interface and `validate` signature |
| Frontmatter split in Phase 1 tests | A Markdown parser | The 10-line BOM/CRLF-normalising regex from STACK.md Decision 2 | Verified on `\uFEFF---\r\n...`; becomes `load/frontmatter.ts` in Phase 2 |

**Key insight:** every "custom" thing in this phase is a 20-line script (codegen, split, error mapping); everything with edge cases (schema semantics, YAML typing, declaration bundling) is delegated to a verified library.

## Runtime State Inventory

Phase 1 renames `feature` → `epic`, `qa.ticks` → `verified`, and drops `features/` in docs only; there is no published package, no adopting repo, no database, and no service. Answered explicitly per category:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore exists; verified by repo listing (`.git`, `.planning`, `docs`, `README.md`, `LICENSE` only) | none |
| Live service config | None — no CI workflow, no npm package, no MCP deployment yet | none |
| OS-registered state | None — no installed CLI, no scheduled tasks | none |
| Secrets/env vars | None — no `.env`, no CI secrets; trusted publishing is Phase 9 | none |
| Build artifacts | None — no `node_modules`, `dist`, or lockfile committed yet | none |

## Common Pitfalls

### Pitfall 1: tsdown emits `.mjs` and the `bin` points at `.js`
**What goes wrong:** `bin: ./dist/cli.js` but the file is `dist/cli.mjs`; `npx accord` fails with MODULE_NOT_FOUND.
**Why:** `fixedExtension` "Defaults to `true` if platform is set to `node`" `[VERIFIED: tsdown types d.mts:1205-1212]`; the spike produced `dist/cli.mjs` until `fixedExtension: false` was set.
**Avoid:** `fixedExtension: false` in both tsdown configs (package is `"type": "module"`, so `.js` is ESM). A test asserts `dist/cli.js` exists and starts with `#!`.

### Pitfall 2: ajv strict mode rejects the config schema at compile time
**What goes wrong:** `Error: strict mode: required property "repo" is not defined at ".../properties/tracker/then" (strictRequired)` — thrown when the module loads, so every command dies, not just config validation.
**Why:** `strict: true` sets `strictRequired: true`; ajv does not see `repo` defined in the parent `properties` from inside `then` (known limitation, ajv #1950).
**Avoid:** `new Ajv2020({ allErrors: true })` — defaults keep `strictSchema` on and `strictRequired` off `[VERIFIED + CITED]`. Add a test that compiles all three schemas (any strict-mode violation becomes a red test, not a runtime crash).

### Pitfall 3: Templates cannot validate if they contain placeholder tokens
**What goes wrong:** Success criterion 4 fails for `ticket-build.md` if its frontmatter has `id: "{{id}}"` (pattern) or `title: ""` (minLength).
**Avoid:** Placeholders that are themselves valid values; record the convention in the template's guidance comment. `new ticket` overwrites by key.

### Pitfall 4: `?raw` and plain `.md` imports behave differently per tool
**What goes wrong:** Build passes locally with tsdown's `loader` but `vitest` fails with `RolldownError: Parse failure`, or the reverse with `?raw`.
**Avoid:** Codegen (Pattern 3). Never import non-TS/JSON files from `src/`.

### Pitfall 5: `npm run build --workspaces` builds cli before core
**What goes wrong:** Passes anyway for `build` (core is external to cli's bundle) but `typecheck`/`test` for cli fail with TS2307 on a clean checkout.
**Avoid:** Explicit workspace order in root `package.json` and explicit `-w` sequencing in `typecheck`/`test` scripts; CI runs `build` before `typecheck` and `test`.

### Pitfall 6: Project references demand `composite`
**What goes wrong:** `tsc -b` errors TS6306/TS6310 as soon as `packages/cli/tsconfig.json` has `references`.
**Avoid:** No `references`; per-package `tsc -p` (Pattern 2).

### Pitfall 7: `no-undef` on `.mjs` scripts and test files
**What goes wrong:** `js.configs.recommended` flags `console`, `URL`, `process` in `scripts/gen-templates.mjs` `[VERIFIED]`.
**Avoid:** A config block `{ files: ['**/*.{js,mjs,cjs}', '**/scripts/**', '**/test/**'], languageOptions: { globals: globals.node } }`.

### Pitfall 8: JSON Schema `pattern` escaping
**What goes wrong:** `"pattern": "^\d+"` is invalid JSON (`invalid escape`); `"^\\d+"` is required. Tools that pass strings through a shell can silently halve the backslashes (happened in this session).
**Avoid:** Write schema files with the file-write tool; `JSON.parse` each schema in a test; prefer `[0-9]` over `\\d` where readability allows (the verified `verification.schema.json` uses `[0-9]`).

### Pitfall 9: Windows runner specifics
- npm creates directory **junctions** (not symlinks) for workspace links on Windows; Node resolution follows them fine and the spike ran on Windows, but tools that `realpath` may see the target path `[VERIFIED: local Windows install]` `[CITED: github.com/npm/cli/issues/5189]`.
- `git checkout` of very deep paths can hit MAX_PATH; not an issue for this repo (no deep committed paths) but if it ever appears, `git config --system core.longpaths true` on the Windows job `[ASSUMED]`.
- The default shell on `windows-latest` is PowerShell; keep `run:` steps to plain `npm ...` commands so no `&&`/quoting differences matter. If a step needs shell syntax, add `shell: bash` `[ASSUMED]`.
- `.gitattributes` `* text=auto eol=lf` is already in place; add `test/fixtures/**/crlf-* -text` now (harmless before Phase 2).

### Pitfall 10: `yaml` `customTags` typing
**What goes wrong:** The STACK.md one-liner `(tags) => tags.filter((t) => !/int|float/.test(t.tag))` fails `tsc` because `Tags` may contain string ids (`Property 'tag' does not exist on type '"null"'`) `[VERIFIED]`.
**Avoid:** `tags.filter((t) => !/int|float/.test(typeof t === 'string' ? t : t.tag))` — typechecks and still yields `{"id":"1e3","n":"0123","b":true}` `[VERIFIED]`.

## Code Examples

All snippets below were executed in the spike unless marked `(draft)`.

### 1. Root `package.json`
```json
{
  "name": "accord-monorepo",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "workspaces": ["packages/core", "packages/cli", "packages/mcp"],
  "scripts": {
    "gen": "node packages/core/scripts/gen-templates.mjs",
    "prebuild": "npm run gen",
    "build": "npm run build -w packages/core && npm run build -w packages/cli",
    "lint": "eslint .",
    "typecheck": "tsc -p packages/core && tsc -p packages/cli",
    "pretest": "npm run gen",
    "test": "vitest run",
    "check": "npm run build && npm run lint && npm run typecheck && npm test"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@types/node": "24.13.3",
    "eslint": "10.10.0",
    "globals": "17.12.0",
    "tsdown": "0.23.0",
    "typescript": "5.9.3",
    "typescript-eslint": "8.69.0",
    "vitest": "5.0.0"
  }
}
```

### 2. Package manifests
```json
// packages/core/package.json
{
  "name": "@accord-dev/accord-core",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./schemas/*": "./schemas/*",
    "./package.json": "./package.json"
  },
  "files": ["dist", "schemas", "templates", "README.md"],
  "scripts": { "build": "tsdown" },
  "dependencies": { "@cucumber/gherkin": "42.0.1", "ajv": "8.20.0", "yaml": "2.9.0" }
}
```
```json
// packages/cli/package.json
{
  "name": "@accord-dev/accord",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "bin": { "accord": "./dist/cli.js" },
  "files": ["dist", "README.md"],
  "engines": { "node": ">=22.12.0" },
  "scripts": { "build": "tsdown" },
  "dependencies": { "@accord-dev/accord-core": "0.1.0", "commander": "15.0.0" }
}
```
```json
// packages/mcp/package.json
{ "name": "@accord-dev/accord-mcp", "version": "0.1.0", "private": true, "type": "module",
  "dependencies": { "@accord-dev/accord-core": "0.1.0" } }
```

### 3. TypeScript configs
```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "noEmit": true
  }
}
```
```json
// packages/core/tsconfig.json  — guard layer B
{ "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": [] },
  "include": ["src", "test", "schemas/*.json"] }
```
```json
// packages/cli/tsconfig.json
{ "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test"] }
```

### 4. tsdown configs
```ts
// packages/core/tsdown.config.ts
import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  platform: 'neutral',
  dts: true,
  fixedExtension: false,
});
```
```ts
// packages/cli/tsdown.config.ts
import { defineConfig } from 'tsdown';
export default defineConfig({
  entry: { cli: 'src/index.ts' },   // first line of src/index.ts is `#!/usr/bin/env node`
  format: ['esm'],
  platform: 'node',
  dts: false,
  fixedExtension: false,            // emit dist/cli.js, not cli.mjs
});
```
Verified log: `Granting execute permission to dist\cli.js`; `head -1 dist/cli.js` → `#!/usr/bin/env node`; bundle keeps `import { templates, validate } from "@accord-dev/accord-core"` external.

### 5. ESLint flat config — guard layer A
```js
// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const nodeBuiltins = ['fs', 'fs/promises', 'path', 'child_process', 'os', 'url', 'crypto', 'process',
  'util', 'stream', 'events', 'buffer', 'module', 'worker_threads', 'net', 'http', 'https', 'tty',
  'readline', 'zlib', 'assert'];
const purity = 'core is isomorphic: no Node built-ins (CORE-01)';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/src/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{js,mjs,cjs}', '**/scripts/**', '**/test/**'], languageOptions: { globals: globals.node } },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: nodeBuiltins.map((name) => ({ name, message: purity })),
        patterns: [{ group: ['node:*'], message: purity }],
      }],
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    ignores: ['packages/core/src/validate/ajv.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: 'ajv', message: 'import ajv only in src/validate/ajv.ts (D-20)' }], patterns: ['ajv/*'] }],
    },
  },
);
```
(The first two blocks and the purity block ran green on clean code and red on a `node:fs` + `path` import; the ajv-seam block is a `(draft)` addition using the same rule shape.)

### 6. `config.schema.json` (compiled and exercised)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://accord.dev/schemas/config.schema.json",
  "title": "accord config.yml",
  "type": "object",
  "additionalProperties": false,
  "required": ["accord", "profile", "tracker", "design", "roles", "runtimes"],
  "properties": {
    "accord": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z.-]+)?$" },
    "profile": { "type": "string", "enum": ["build", "maintain"] },
    "tracker": {
      "type": "object",
      "additionalProperties": false,
      "required": ["adapter"],
      "properties": {
        "adapter": { "type": "string", "enum": ["none", "github-issues"] },
        "repo": { "type": "string", "pattern": "^[^/\\s]+/[^/\\s]+$" }
      },
      "if": { "properties": { "adapter": { "const": "github-issues" } }, "required": ["adapter"] },
      "then": { "required": ["repo"] }
    },
    "design": {
      "type": "object", "additionalProperties": false, "required": ["tokens"],
      "properties": { "tokens": { "type": "string" } }
    },
    "roles": {
      "type": "array", "uniqueItems": true,
      "items": { "type": "string", "enum": ["ba", "dev", "designer"] },
      "allOf": [{ "contains": { "const": "ba" } }, { "contains": { "const": "dev" } }]
    },
    "runtimes": {
      "type": "array", "uniqueItems": true, "minItems": 1,
      "items": { "type": "string", "enum": ["claude", "codex", "cursor", "copilot"] }
    }
  }
}
```
Verified: D-16 default document is VALID; `{adapter: github-issues}` without `repo` → `/tracker required 'repo'`; extra key `sprint` → `"" additionalProperties`; `roles: [ba]` → `/roles contains`. (`$id` host is a placeholder; see Open Question 5.)

### 7. `ticket.schema.json` (compiled and exercised; `required` set is Open Question 1)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://accord.dev/schemas/ticket.schema.json",
  "title": "accord ticket frontmatter (tickets/<id>.md)",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "title", "type", "status"],
  "properties": {
    "id": { "type": "string", "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]*$" },
    "title": { "type": "string", "minLength": 1 },
    "type": { "type": "string", "enum": ["epic", "story", "bug"] },
    "status": { "type": "string", "enum": ["draft", "open", "archived"] },
    "parent": { "type": "string", "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]*$" },
    "tracker": {
      "type": "object",
      "patternProperties": { "^[a-z][a-z0-9-]*$": { "type": "string", "minLength": 1 } },
      "additionalProperties": false
    },
    "ui": { "type": "boolean" },
    "design": { "type": "string", "pattern": "^https://" },
    "assumptions": {
      "type": "array",
      "items": { "type": "object", "additionalProperties": false, "required": ["text", "confirmed"],
        "properties": { "text": { "type": "string", "minLength": 1 }, "confirmed": { "type": "boolean" } } }
    },
    "ac_hash": { "type": "string", "minLength": 1 },
    "verified": { "type": "array", "uniqueItems": true, "items": { "type": "string", "pattern": "^ac-[1-9][0-9]*$" } }
  }
}
```
Verified: `{id:"TICKET-ID", title:"Short title", type:"story", status:"draft"}` VALID; full D-04 document VALID; a document with `owner`, `type: feature`, `status: todo`, `tracker: {Shortcut: 1234}`, `verified: [ac-1, ac-1, x]` produced 8 findings at `""`, `/id`, `/title`, `/type`, `/status`, `/tracker`, `/verified/2`, `/verified`.

### 8. `verification.schema.json` (compiled and exercised)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://accord.dev/schemas/verification.schema.json",
  "title": "accord verification.md frontmatter (tickets/<id>/verification.md)",
  "type": "object",
  "additionalProperties": false,
  "required": ["ticket", "commit", "reviewed_on"],
  "properties": {
    "ticket": { "type": "string", "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]*$" },
    "commit": { "type": "string", "pattern": "^[0-9a-f]{7,40}$" },
    "reviewed_on": { "type": "string", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" }
  }
}
```
Verified: valid sample passes; `commit: g`, `reviewed_on: 2026-9-5`, extra `reviewer` → findings at `""`, `/commit`, `/reviewed_on`.

### 9. Validator seam, codegen script, and tests
```ts
// packages/core/src/validate/ajv.ts — the ONLY file that imports ajv
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv/dist/2020.js';
import ticketSchema from '../../schemas/ticket.schema.json' with { type: 'json' };
import verificationSchema from '../../schemas/verification.schema.json' with { type: 'json' };
import configSchema from '../../schemas/config.schema.json' with { type: 'json' };
import type { Finding } from '../model/finding.js';

const ajv = new Ajv2020({ allErrors: true });            // defaults: strictSchema on, strictRequired off
const validators = {
  ticket: ajv.compile(ticketSchema),
  verification: ajv.compile(verificationSchema),
  config: ajv.compile(configSchema),
} as const;
export type SchemaId = keyof typeof validators;

export function validate(schemaId: SchemaId, doc: unknown): Finding[] {
  const v = validators[schemaId];
  if (v(doc)) return [];
  return (v.errors ?? []).map((e: ErrorObject) => ({
    path: e.instancePath,                 // '' = document root, '/tracker', '/verified/2'
    rule: `schema.${e.keyword}`,
    reason: e.message ?? e.keyword,
  }));
}
```
```js
// packages/core/scripts/gen-templates.mjs  (outside src/, Node script)
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = `${root}templates/`;
const files = readdirSync(dir).filter((f) => /\.(md|html)$/.test(f)).sort();
const body = files.map((f) => {
  const text = readFileSync(dir + f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  return `  ${JSON.stringify(f)}: ${JSON.stringify(text)},`;
}).join('\n');
mkdirSync(`${root}src/generated`, { recursive: true });
writeFileSync(`${root}src/generated/templates.ts`,
  `// Generated by scripts/gen-templates.mjs from templates/*. Do not edit.\nexport const templates = {\n${body}\n} as const;\nexport type TemplateName = keyof typeof templates;\n`, 'utf8');
console.log(`generated ${files.length} templates`);
```
```ts
// packages/core/test/templates.test.ts — template frontmatter validates (success criterion 4)
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { Tags } from 'yaml';
import { templates, validate } from '../src/index.js';

const stringNumerics = (tags: Tags) => tags.filter((t) => !/int|float/.test(typeof t === 'string' ? t : t.tag));
function frontmatter(md: string): unknown | null {
  const norm = md.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(norm);
  return m ? parse(m[1], { schema: 'core', customTags: stringNumerics }) : null;
}
const withSchema = { 'ticket-build.md': 'ticket', 'ticket-maintain.md': 'ticket', 'epic.md': 'ticket', 'verification.md': 'verification' } as const;

describe('templates', () => {
  for (const [name, schemaId] of Object.entries(withSchema)) {
    it(`${name} frontmatter validates against ${schemaId}.schema.json`, () => {
      const fm = frontmatter(templates[name as keyof typeof templates]);
      expect(fm).not.toBeNull();
      expect(validate(schemaId, fm)).toEqual([]);
    });
  }
  it('glossary.md and business-rules.md have no frontmatter', () => {
    expect(frontmatter(templates['glossary.md'])).toBeNull();
    expect(frontmatter(templates['business-rules.md'])).toBeNull();
  });
});
```
```ts
// packages/core/test/schemas.test.ts — goldens name the failing path (success criterion 2)
it('invalid config produces findings naming the path', async () => {
  const bad = { accord: '0.1.0', profile: 'build', tracker: { adapter: 'github-issues' }, design: { tokens: '' }, roles: ['ba'], runtimes: ['claude'], sprint: 3 };
  await expect(JSON.stringify(validate('config', bad), null, 2)).toMatchFileSnapshot('./__golden__/config.invalid.json');
});
```
Golden produced by the spike (stable across two runs):
```json
[
  { "path": "", "rule": "schema.additionalProperties", "reason": "must NOT have additional properties" },
  { "path": "/tracker", "rule": "schema.required", "reason": "must have required property 'repo'" },
  { "path": "/tracker", "rule": "schema.if", "reason": "must match \"then\" schema" },
  { "path": "/roles/0", "rule": "schema.const", "reason": "must be equal to constant" },
  { "path": "/roles", "rule": "schema.contains", "reason": "must contain at least 1 valid item(s)" }
]
```
```ts
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', pool: 'forks', projects: ['packages/*'] } });
// packages/core/vitest.config.ts
export default defineConfig({ test: { name: 'core', include: ['test/**/*.test.ts'] } });
```
`test.workspace` and `vitest.workspace.*` were removed in Vitest 4; `test.projects` is the replacement `[CITED: vitest resolveConfig.ts + docs/guide/projects.md]`; the config above ran 2/2 green with reporter prefix `|core|` `[VERIFIED]`.

### 10. `.github/workflows/ci.yml` (draft — structure follows the verified local sequence)
```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request:
jobs:
  check:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [22, 24]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```
Notes: `setup-node` with `node-version: 22` resolves the latest 22.x (>= 22.18, which tsdown's engines require) `[ASSUMED: setup-node semver resolution; matches its documented behaviour]`. No `shell:` override needed because every step is a plain `npm` command.

### 11. Template skeletons (draft — wording is Claude's discretion; structure is locked)
```markdown
<!-- templates/ticket-build.md -->
---
id: "TICKET-ID"
title: "Short title in business language"
type: story
status: draft
# parent: "EPIC-ID"
# tracker: { shortcut: "1234" }
ui: false
# design: "https://www.figma.com/..."
# assumptions:
#   - { text: "...", confirmed: false }
---

## Intent
<!-- BA. Why, for whom, how success is measured, explicit non-goals. About five lines. Observable behaviour only: no tables, endpoints, libraries, or screens. -->

## Requirements
<!-- BA. One EARS line per requirement. -->

## Acceptance criteria
<!-- BA. One fenced gherkin block; every scenario tagged @ac-n. -->
```gherkin
Feature: TICKET-ID

  @ac-1
  Scenario: <observable outcome>
    Given ...
    When ...
    Then ...
```

## Open questions
<!-- BA. `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Plan
<!-- Developer fills this in. BA leaves it empty. -->
```
`ticket-maintain.md`: identical, guidance comment under `ui` says "for `ui: true` a prototype at `assets/<id>/prototype.html` derived from the existing styles is required". `epic.md`: `type: epic`, no `## Acceptance criteria`, no `## Plan`. `verification.md` template: frontmatter `ticket`, `commit`, `reviewed_on` with valid placeholders (`"TICKET-ID"`, `"0000000"`, `"2026-01-01"`), then one `## @ac-1 <scenario name>` block with `Result:` and `Evidence:` lines. `prototype-header.html`: an HTML comment block listing the stylesheets the prototype was derived from (design.md §5), followed by `<!doctype html>`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `vitest.workspace.ts` / `test.workspace` | `test.projects` in root config | Vitest 4 (removed) | Root config only; per-package configs optional |
| tsup | tsdown (rolldown) | 2025 | Same config shape; `fixedExtension` default differs from tsup |
| `actions/setup-node@v4` (in STACK.md) | `@v7` (ESM migration, 2026-07-14) | July 2026 | Use v7 in new workflows; v4 still works but is two majors back |
| `actions/checkout@v4` | `@v7.0.1` | July 2026 | Same |
| TypeScript `types` default "all visible @types" | Docs now state default `[]` for TS >= 6.0 | TS 6.0 | On 5.9.3 the old default applies, so `types: []` in core is still required |
| `import Ajv from 'ajv'` default import (CJS interop) | Named `Ajv2020` under `nodenext` | ajv 8.13+ named exports | Avoids TS2351 |

**Deprecated/outdated in this repo's earlier research:** STACK.md Decision 8 (single package) — superseded by D-18; ARCHITECTURE.md "gray-matter wrapper" — replaced by the `yaml` split; design.md `features/` folder, `qa.ticks`, five-role roster — replaced per CONTEXT.md.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `setup-node` `node-version: 22` resolves to a 22.x >= 22.18 so tsdown's engine check passes on the Node 22 job | Code Example 10 | tsdown refuses to run on the 22 matrix leg; fix is `node-version: 22.18` or `>=22.18` |
| A2 | Windows runner needs no `core.longpaths` for this repo's paths | Pitfall 9 | Checkout fails on Windows; add `git config --system core.longpaths true` step |
| A3 | Plain `npm` steps behave identically under PowerShell and bash | Pitfall 9 / Code Example 10 | A step with shell syntax breaks on Windows; add `shell: bash` |
| A4 | `design` pattern `^https://` is an acceptable check for a Figma URL | Code Example 7 | Too strict/loose; trivially adjustable, schema-only |
| A5 | `tracker` key pattern `^[a-z][a-z0-9-]*$` covers all adapter names (`github-issues`, `shortcut`, `jira`, `linear`) | Code Example 7 | An adapter with a different name style is rejected; schema-only change |
| A6 | `commit` in `verification.md` is an abbreviated-or-full lowercase git SHA (`^[0-9a-f]{7,40}$`) | Code Example 8 | Phase 4 may want a different reference; schema-only change |
| A7 | Committing `src/generated/templates.ts` (plus drift test) is preferable to gitignoring it | Pattern 3 | Either works; the committed form keeps `tsc`/editors green on a fresh clone without running `gen` |
| A8 | The `development` export-condition alternative is not needed in Phase 1 | Alternatives | Slower inner loop when editing core while testing cli; revisit in Phase 5 |

## Open Questions (RESOLVED)

These were business/format decisions not fixed by CONTEXT.md at research time; per the user's CLAUDE.md rule they needed a user decision before the schemas were locked. All six were resolved on 2026-09-05 and recorded in CONTEXT.md as D-21..D-26; each item below ends with the decision that closes it.

1. **Are `type` and `status` required in ticket frontmatter?** D-04 marks only `id` and `title` as required and lists `parent`, `tracker`, `design`, `assumptions`, `ac_hash`, `verified` as optional; `type`, `status`, `ui` are unlabelled. Recommendation: `type` and `status` required (templates always write them; a missing `type` makes "code-touching" undecidable), `ui` optional with the documented default `false` (schemas do not apply defaults; the loader will). RESOLVED: D-21
2. **`ac_hash` shape.** Phase 4 chooses the hash algorithm. Recommendation: `type: string, minLength: 1` now; tighten to a hex pattern in Phase 4 (additive in the schema's semver sense only if it stays a string). RESOLVED: D-25
3. **May `tracker` be an empty object `{}`?** Current draft allows it. Recommendation: allow (a BA can add the key before the id is known); Phase 3 lint may warn. RESOLVED: D-22
4. **`design` on epics.** D-04 says `design` is a Figma URL; nothing says whether epics may carry it. Recommendation: allow on all types now; gates decide relevance. RESOLVED: D-23
5. **`$id` base URI for the schemas.** `https://accord.dev/...` is a placeholder; ajv only uses it as a key, but editors' `$schema` autocompletion and future hosts will want a real, stable URL. Recommendation: `https://raw.githubusercontent.com/<owner>/accord/main/packages/core/schemas/<name>.schema.json` or the eventual docs domain; decide before Phase 9. RESOLVED: D-26
6. **`packages/mcp` in Phase 1.** D-18 makes it a workspace now. Recommendation: `package.json` only (private, depends on core), no `src/`, no scripts, so `--workspaces --if-present` skips it; Phase 8 fills it. RESOLVED: D-24

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v24.14.0 (>= tsdown's 24.11 floor) | — |
| npm | workspaces, `npm ci` | ✓ | 11.9.0 | — |
| git | repo, `.gitattributes` | ✓ | 2.55.0.windows.2 | — |
| gh CLI | optional (release lookups only) | ✓ | 2.88.1 | not needed by any plan |
| GitHub Actions runners | OPS-02 | ✓ (hosted) | ubuntu-latest, windows-latest | — |
| Internet / npm registry | install | ✓ (verified by the spike install, 164 packages in 46 s) | — | — |

**Missing dependencies with no fallback:** none. **Missing dependencies with fallback:** none.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 5.0.0 (`pool: 'forks'`, `environment: 'node'`, `projects: ['packages/*']`) |
| Config file | `vitest.config.ts` (root) + `packages/*/vitest.config.ts` — none exist yet → Wave 0 |
| Quick run command | `npx vitest run --project core` |
| Full suite command | `npm run check` (= build → lint → typecheck → test) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | Three workspaces link; `npm ci` + `npm run build` succeed; cli bundle imports core by package name | smoke | `npm ci && npm run build && node -e "import('@accord-dev/accord-core').then(m=>console.log(Object.keys(m)))"` (run from `packages/cli`) | ❌ Wave 0 (`packages/cli/test/link.test.ts`) |
| OPS-02 | CI matrix green on both OS × both Node | CI | `.github/workflows/ci.yml`; failing signal = red check on the first code commit | ❌ Wave 0 |
| CORE-01 (a) | ESLint rejects `node:*` and bare built-ins in `packages/core/src` | unit (fixture lint) | `npx eslint --no-ignore packages/core/test/fixtures/impure.ts.txt` is awkward; instead a test runs `ESLint` API on an in-memory string and asserts 2 errors | ❌ Wave 0 (`packages/core/test/purity.test.ts`) |
| CORE-01 (b) | `tsc` rejects the same imports (`types: []`) | unit | test writes a temp `.ts` under `packages/core/src/__tmp__`, runs `tsc -p packages/core --noEmit`, asserts TS2307, deletes the file; or simpler: assert `packages/core/tsconfig.json` has `types: []` and no `@types/node` in core's deps | ❌ Wave 0 (same file) |
| CORE-01 (c) | Built `dist/index.js` has no `node:`/`fs`/`path` import | unit (post-build) | `npx vitest run --project core -t "bundle is pure"` | ❌ Wave 0 (same file) |
| FMT-01 | Folder convention documented and reflected in templates | manual + unit | grep test: no template or README mentions `features/`; templates mention `accord/`, `product/`, `tickets/`, `assets/<id>/` | ❌ Wave 0 (`packages/core/test/convention.test.ts`) |
| FMT-02 | Valid ticket passes; invalid ticket yields path-bearing findings (golden) | unit | `npx vitest run --project core -t ticket` | ❌ Wave 0 (`packages/core/test/schemas.test.ts` + `__golden__/ticket.invalid.json`) |
| FMT-03 | `tracker` map accepts `{ shortcut: "1234" }`, rejects `{ Shortcut: 1234 }` | unit | same file, `-t tracker` | ❌ Wave 0 |
| FMT-06 | Default `config.yml` passes; `github-issues` without `repo` fails at `/tracker`; extra key fails at `""` | unit | `npx vitest run --project core -t config` | ❌ Wave 0 (`__golden__/config.invalid.json` — content already known, see Code Example 9) |
| FMT-07 | All 7 templates exist; every template with frontmatter validates; glossary/business-rules have none; generated file matches sources | unit | `npx vitest run --project core -t templates` | ❌ Wave 0 (`packages/core/test/templates.test.ts`) |
| Success criterion 4 (schemas parse) | Each `schemas/*.json` is valid JSON and compiles under ajv strict-schema defaults | unit | `-t "schemas compile"` | ❌ Wave 0 |
| bin | `packages/cli/dist/cli.js` exists, starts with `#!`, runs under `process.execPath` | smoke | `npx vitest run --project cli` | ❌ Wave 0 (`packages/cli/test/bin.test.ts`) |

**Failing signals:** vitest prints `FAIL |core| test/<file>.test.ts > <name>` and exits 1; `toMatchFileSnapshot` diff shows the changed finding list; ESLint prints `✖ N problems` and exits 1; `tsc -p` prints `error TS2307` and exits 2; CI shows the matrix leg red.

### Sampling Rate
- **Per task commit:** `npx vitest run --project core` (< 5 s in the spike) plus `npm run lint`.
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green locally on Windows, then CI green on all four matrix legs before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `vitest.config.ts`, `packages/core/vitest.config.ts`, `packages/cli/vitest.config.ts`
- [ ] `packages/core/test/schemas.test.ts` — FMT-02, FMT-03, FMT-06, "schemas compile"
- [ ] `packages/core/test/templates.test.ts` — FMT-07, criterion 4, drift check
- [ ] `packages/core/test/purity.test.ts` — CORE-01 (a)(b)(c)
- [ ] `packages/core/test/convention.test.ts` — FMT-01
- [ ] `packages/cli/test/bin.test.ts`, `packages/cli/test/link.test.ts` — OPS-01, shebang
- [ ] `packages/core/test/__golden__/` — created by the first `vitest run`; review before committing
- [ ] Framework install: root `npm install -D ...` from the Installation block

## Security Domain

`security_enforcement` is enabled (ASVS level 1). Phase 1 ships no network, auth, or user input at runtime; the relevant surface is supply chain and schema strictness.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | JSON Schema 2020-12 via ajv with `additionalProperties: false` everywhere (D-05); all non-boolean scalars `type: string`; `pattern` bounds on ids, SHAs, dates; `yaml` core schema so no implicit typing |
| V6 Cryptography | no (Phase 4's `ac_hash` will) | — |
| V14 Configuration / supply chain | yes | Exact-pinned versions (no `^`), single committed `package-lock.json`, `npm ci` in CI, no `postinstall` scripts in any dependency (audited above), Actions pinned to major tags (pin to SHAs in Phase 9 alongside trusted publishing) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Dependency confusion / slopsquatting on the new `@accord-dev` scope | Spoofing | Author creates the npm org before Phase 9 (D-17); until then nothing resolves `@accord-dev/*` from the registry because workspaces link locally |
| ReDoS via schema `pattern` on attacker-controlled frontmatter | DoS | Patterns above are anchored, linear, no nested quantifiers; ajv's `unicodeRegExp` default `true` |
| ajv `new Function` on untrusted **schemas** | Tampering | Only the three shipped schemas are compiled, never user-supplied ones; the `validate(schemaId, ...)` seam takes an id, not a schema object |
| Prototype pollution through YAML keys like `__proto__` | Tampering | `yaml` 2.x returns plain objects; `additionalProperties: false` rejects unknown keys before any merge; Phase 2 loader should still `Object.create(null)`-guard if it ever spreads frontmatter |
| CI workflow tampering via mutable action tags | Tampering | Major tags for now; SHA pins + `permissions: contents: read` at workflow level (add the `permissions` block in Phase 1; it is one line) |

## Sources

### Primary (HIGH confidence — executed or read from installed packages/official docs this session)
- Scratchpad workspace spike (Node 24.14.0, npm 11.9.0, Windows 11): npm workspace linking and order; `types: []` vs hoisted `@types/node`; ESLint purity rule; tsdown `?raw` failure, `loader` text success, vitest `.md` parse failure, codegen success; `fixedExtension` behaviour and shebang; ajv named export, `strictRequired` throw, error `instancePath` ordering and golden stability; vitest `projects` + `toMatchFileSnapshot`; yaml `customTags` typing; all three schemas compiled and exercised
- Installed sources: `ajv/dist/2020.d.ts:3,9`, `ajv/dist/2020.js:37-38`, `ajv/dist/compile/index.js:89`, `tsdown/dist/types-*.d.mts:1205-1214` (`fixedExtension` doc), `tsdown/dist/options-*.mjs:316` (`RE_SHEBANG`)
- npm registry via `npm view` (2026-09-05): versions, engines, peers for every package in Standard Stack
- `gh api` GitHub releases: actions/setup-node v7.0.0 (2026-07-14), actions/checkout v7.0.1 (2026-07-20)
- Context7 `/npm/cli` (workspaces docs, arborist workspace.md), `/typescript-eslint/typescript-eslint` (flat config, `no-restricted-imports` options), `/ajv-validator/ajv` and `/websites/ajv_js` (2020 import, ErrorObject, strict options, standalone), `/vitest-dev/vitest` (`projects`, `workspace` removal, `pool: forks`)
- Official docs fetched: typescriptlang.org/tsconfig/types; github.com/actions/setup-node/docs/advanced-usage.md; docs.npmjs.com/cli/v11/using-npm/workspaces; ajv docs/strict-mode.md (via gh api raw); tsdown docs/options/dts.md and platform.md (via gh api raw)
- Internal: `01-CONTEXT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `research/STACK.md`, `research/ARCHITECTURE.md`, `research/PITFALLS.md` §5/§8/§12/§14, `docs/design.md` §2/§4/§5, `.claude/CLAUDE.md`

### Secondary (MEDIUM confidence — web search cross-checked with an issue tracker)
- github.com/ajv-validator/ajv/issues/1950 and /1571 (`strictRequired` with `if/then`/`oneOf`) — consistent with the reproduced error
- github.com/npm/cli/issues/5189 (junctions on Windows) — consistent with local behaviour

### Tertiary (LOW confidence — not verified this session)
- Windows runner `core.longpaths` and PowerShell-vs-bash step behaviour (Assumptions A2, A3)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version re-checked on the registry today and installed together without conflicts
- Architecture: HIGH — full chain (install → gen → tsc → eslint → tsdown → vitest → run built CLI) executed; the only untested artifact is `ci.yml` itself, which is a transcription of that chain
- Pitfalls: HIGH for the eight reproduced ones; MEDIUM/LOW for the Windows-runner notes
- Schemas: HIGH that they compile and behave as shown; the `required` set and a few patterns await user confirmation (Open Questions 1–5)

**Research date:** 2026-09-05
**Valid until:** 2026-10-05 for tooling (tsdown moves fast; re-check `fixedExtension` and `loader` behaviour if bumping); schemas and layout are stable
