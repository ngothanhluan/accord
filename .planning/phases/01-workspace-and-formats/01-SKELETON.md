# Walking Skeleton — accord

**Phase:** 1
**Generated:** 2026-09-05

## Capability Proven End-to-End

A developer runs `npm run check` on Windows or Ubuntu (and CI runs the same on both OSes for Node 22 and 24) and sees an invalid ticket frontmatter rejected with a path-bearing finding by the shared schema validator, reached through the CLI package that is built on the isomorphic core.

There is no database and no UI in this project. The "stack" is: npm workspace → pure core (`validate(schemaId, doc): Finding[]` over JSON Schema 2020-12 files) → Node host (`packages/cli`, bin `accord`) → test runner → CI matrix. "Deployment" is a green CI run on all four matrix legs.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Workspace manager | npm workspaces, listed **explicitly in build order** (`packages/core`, `packages/cli`, `packages/mcp`), one root `package-lock.json`; `cli` depends on `"@accord-dev/accord-core": "0.1.0"` (semver-linked, npm symlinks/junctions the sibling) | D-18. `packages/*` expands alphabetically and builds `cli` before `core` (RESEARCH Pitfall 5). No turbo/nx/lerna: three packages, one author. |
| Package names | Scope `@accord-dev`: `@accord-dev/accord` (bin `accord`), `@accord-dev/accord-core`, `@accord-dev/accord-mcp` (private) | D-17, **one-way** (the scope lands in every generated workflow and `config.yml` pin of adopting repos). Already user-decided; Phase 9 prerequisite: create the `accord-dev` npm org before publishing. |
| Language / typecheck | TypeScript 5.9.3 pinned; `tsconfig.base.json` (`module: nodenext`, `strict`, `verbatimModuleSyntax`, `resolveJsonModule`, `noEmit`); per-package `tsc -p`, **no project references** | typescript-eslint 8.69 peers `<6.1`; `tsc -b` demands `composite` + emit and fights tsdown over `dist/` (RESEARCH Pitfall 6). |
| Core purity guard | Two layers + one artifact check. Layer A: root `eslint.config.js`, `@typescript-eslint/no-restricted-imports` on `packages/core/src/**/*.ts` banning `node:*` and every bare built-in name. Layer B: `packages/core/tsconfig.json` has `"types": []` and includes only `src` + `schemas/*.json`. Artifact check: a test greps `packages/core/dist/index.js` for built-in imports. | CORE-01. Both layers verified to fail on `node:fs` and bare `path` (RESEARCH Pattern 4). tsdown `platform: 'neutral'` for core so a stray built-in is never silently externalised. |
| Core test typechecking | `packages/core/tsconfig.test.json` (`types: ["node"]`, includes `test`, `src`, `schemas/*.json`); root `typecheck` runs core, core-test, then cli | Guard tests (ESLint probe, `tsc` probe, dist grep, template drift) need `node:fs`/`node:child_process`. Under research's single core tsconfig they would fail typecheck. Shipped `src` stays pure; tests are not shipped. |
| Schema validation | ajv 8.20 `Ajv2020` (named export from `ajv/dist/2020.js`), `new Ajv2020({ allErrors: true })` with **default** strictness, behind `validate(schemaId, doc): Finding[]` in `src/validate/index.ts`; only `src/validate/ajv.ts` imports ajv (ESLint seam rule) | D-20. `strict: true` throws on the config schema's `if/then` (`strictRequired`, RESEARCH Pitfall 2). The seam lets `@cfworker/json-schema` or `ajv/dist/standalone` replace ajv if the MCP host spike shows `new Function` is blocked. |
| Schemas as data | `packages/core/schemas/{ticket,verification,config}.schema.json` are real files (humans, editors) imported with `with { type: 'json' }` (tsc, vitest, tsdown all inline/resolve them); exposed via `exports["./schemas/*"]` | D-19, D-27. `$id` uses the placeholder base `https://accord.dev/schemas/` until Phase 9 picks a stable URL (D-26). |
| Templates as data | `packages/core/templates/*.{md,html}` are real files; `scripts/gen-templates.mjs` emits a **committed** `src/generated/templates.ts` (`templates` const keyed by file name, BOM stripped, CRLF→LF); a drift test regenerates in memory and compares | D-27. `?raw` fails in tsdown 0.23 on Windows; tsdown's `.md` text loader fails in vitest (RESEARCH Pitfall 4). No `prebuild`/`pretest` regeneration: it would mask a stale committed file; the drift test is the signal. |
| Bundler | tsdown 0.23.0, ESM only, `fixedExtension: false` in both packages; core `platform: 'neutral'` + `dts: true`; cli `platform: 'node'`, entry `cli` with `#!/usr/bin/env node` preserved | `fixedExtension` defaults to `true` for `platform: 'node'` and emits `cli.mjs` while `bin` points at `cli.js` (RESEARCH Pitfall 1). |
| Test runner | vitest 5.0.0, root `vitest.config.ts` with `test.projects: ['packages/core', 'packages/cli']`, `pool: 'forks'`, `environment: 'node'`; `toMatchFileSnapshot` JSON goldens under `packages/core/test/__golden__/` | `test.workspace` was removed in Vitest 4; explicit project list skips the test-less `packages/mcp` stub. Goldens pin ajv's finding order (stable across runs). |
| Lint | ESLint 10.10.0 flat config + typescript-eslint 8.69.0 + `@eslint/js` + `globals` (for `scripts/**`, `test/**`, `*.mjs`); ignores `dist`, `node_modules`, `src/generated` | RESEARCH Code Example 5, verified green on clean code and red on the impure probe. |
| CI | One `.github/workflows/ci.yml`: `permissions: contents: read`; matrix `ubuntu-latest`/`windows-latest` × Node `22`/`24`, `fail-fast: false`; `actions/checkout@v7`, `actions/setup-node@v7` (`cache: npm`); steps `npm ci` → `npm run build` → `npm run lint` → `npm run typecheck` → `npm test` | OPS-02. Build before typecheck/test so `cli` resolves `core/dist/index.d.ts` (RESEARCH Pattern 2). Plain `npm` steps need no `shell:` override on PowerShell. |
| Line endings | `.gitattributes` `* text=auto eol=lf` (existing) + `**/test/fixtures/**/crlf-* -text` | Source is LF on every OS; Phase 2 CRLF fixtures are byte-preserved on Windows checkout. |
| Directory layout | Root: `package.json`, `package-lock.json`, `tsconfig.base.json`, `eslint.config.js`, `vitest.config.ts`, `.github/workflows/ci.yml`. `packages/core/`: `package.json`, `tsconfig.json`, `tsconfig.test.json`, `tsdown.config.ts`, `vitest.config.ts`, `schemas/`, `templates/`, `scripts/gen-templates.mjs`, `src/{index.ts, model/finding.ts, validate/{index.ts,ajv.ts}, generated/templates.ts}`, `test/`. `packages/cli/`: `package.json`, `tsconfig.json`, `tsdown.config.ts`, `vitest.config.ts`, `src/index.ts`, `test/`. `packages/mcp/package.json` only. | RESEARCH "Recommended Project Structure", adjusted for the test tsconfig. |
| Public core API (Phase 1) | `validate(schemaId: SchemaId, doc: unknown): Finding[]`, `schemaIds: readonly SchemaId[]`, `type SchemaId = 'ticket' \| 'verification' \| 'config'`, `interface Finding { path: string; rule: string; reason: string }`, `templates` const + `type TemplateName` | Phase 3 extends `Finding` with file/line; Phase 2 adds loaders on top; Phase 6 adds workflow definitions and the SKILL.md renderer to core (D-18). |
| Contract formats fixed here | Ticket frontmatter (D-01..D-05, D-21..D-23, D-25), `verification.md` frontmatter (D-09), `config.yml` (D-12, D-13, D-15, D-16), headings (D-07), folder convention (D-06, D-12) | These are the published contract; Phases 2–9 render over them and must not change them without a schema version bump. |

## Stack Touched in Phase 1

- [x] Project scaffold — npm workspaces, TypeScript, tsdown, vitest, ESLint, root scripts (`build`, `lint`, `typecheck`, `test`, `check`, `gen`)
- [x] "Routing" — the CLI bin `packages/cli/dist/cli.js` runs under `process.execPath`, prints `accord 0.1.0` and the schema ids exported by core (proves the package boundary, ESM, shebang)
- [x] "Data" — one real read: JSON schemas and Markdown templates imported at build time; one real write: `scripts/gen-templates.mjs` emits `src/generated/templates.ts`
- [x] "Interaction" — `validate('ticket', invalidDoc)` returns path-bearing findings, pinned by a golden; `validate('config', defaultDoc)` returns `[]`
- [x] Deployment — `.github/workflows/ci.yml` runs `npm run check`'s steps on ubuntu-latest and windows-latest × Node 22/24 (green after the author's first push)

## Out of Scope (Deferred to Later Slices)

- Frontmatter/Markdown loading, fence-aware section scanner, Gherkin extraction, CRLF/BOM fixtures, the Vietnamese sample ticket fixture (Phase 2, CORE-02/03/06, FMT-04/05/08)
- Lint rules as data, EARS classifier, token rule, `Finding.file`/`Finding.line` (Phase 3)
- Gates, `ac_hash` algorithm and pattern tightening, evidence reference syntax (Phase 4)
- commander wiring, `new ticket` (which sets `id` by key with `yaml` `parseDocument().setIn`, not token replacement), `lint`/`gate`/`status`, version-pin check, `github-issues` adapter (Phase 5)
- Workflow definitions, `review.md`, SKILL.md renderer, `skills sync` (Phase 6)
- `accord init` scaffolding, generated CI workflow for adopting repos, example repo (Phase 7)
- `packages/mcp` source, hosting, OAuth, GitHub-API loader, ajv-on-host spike (Phase 8; the `validate` seam is the Phase 1 hook)
- npm org `accord-dev`, stable schema `$id` URL, SHA-pinned actions, trusted publishing, per-package README/LICENSE (Phase 9)
- Ticket dependencies (`depends_on`), generated index files, technical-vocabulary lint, extra helper files in adopting repos (CONTEXT Deferred Ideas)
- Configurable root folder (D-12: a `.accord` pointer file may be added later as an additive change)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: a fixture repository snapshot loads into typed tickets, scenarios, and verification records with correct line numbers on LF, CRLF, and BOM input
- Phase 3: `lint` over a snapshot returns every finding with file, line, rule id, reason; text and JSON renderers over one result object
- Phase 4: `gate ready` and `gate done` evaluate deterministically with the three-set match, AC hash, and exit codes
- Phase 5: `accord new ticket`, `lint`, `gate`, `status` run from a terminal on Windows and POSIX with `--json`
- Phase 6: one workflow definition per role (`ba`, `dev` with `review.md`, `designer`) renders to SKILL.md and syncs into `.claude/skills/` and `.agents/skills/`
- Phase 7: `accord init` delivers the whole contract in one command; the example repo passes both gates in both profiles
- Phase 8: the MCP server runs the same core over the GitHub API from a chat client
- Phase 9: the scoped package is published via trusted publishing; one real employer ticket passes Ready and Done
