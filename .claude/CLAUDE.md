<!-- GSD:project-start source:PROJECT.md -->

## Project

**accord**

Accord is a team contract for AI-assisted software delivery: a conventional folder in each repository where BA, designer, developer, and QA record intent, EARS requirements, Gherkin acceptance criteria, and design references before an agent writes code, plus a CLI and a remote MCP server that check that contract deterministically. Technical members work through Claude Code, Cursor, Codex, or Copilot; non-technical members work through the AI chat app they already pay for, connected to the same MCP server. It is an open-source personal project (MIT); the author's employer is the first user, not the owner.

**Core Value:** An agent cannot start a story without captured intent and acceptance criteria, and cannot finish one without independent verification against them.

### Constraints

- **Tech stack**: TypeScript monorepo — `core` (pure), `cli`, `mcp`; skill definitions live in `core` as data; distributed via npx — matches how AI-tool users install things
- **Isomorphic core**: core must not import `node:fs` or `node:child_process` outside loaders — the MCP host has no filesystem
- **No API keys**: accord never calls a model itself — team members have subscriptions, not keys
- **Compatibility**: skill workflows must produce identical behaviour in Claude Code, Cursor, Copilot, and Codex — one definition per role, rendered
- **Cross-platform**: CLI must run on Windows and POSIX — author develops on Windows; teams are mixed
- **Independence**: adapter `none` must be fully usable; nothing may require a tracker or Figma
- **Naming**: npm `accord` is held by an abandoned package; publish scoped unless the name is reclaimed
- **No other tools named**: nothing accord ships names another tool, plugin, harness, or planning system — not README, design docs, templates, schemas, or workflow and technique text under `docs/skills/`, which renders into the SKILL.md files users receive. Provenance for adapted material goes in the commit message. Positioning stands on its own, comparisons date quickly, and a reader meeting the name of something they do not have learns nothing
- **Attribution**: commits authored solely by the author

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | `engines: ">=22.12.0"`; CI on 22 and 24 | Runtime | Node 20 reached EOL 2026-04-30. commander 15 and vitest 5 both require 22.12+, so 22 is the floor whether we like it or not. 22 is in maintenance until 2027-04-30; 24 is active LTS; 26 becomes LTS in Oct 2026. |
| TypeScript | 5.9.3 (pin, not 7.x) | Language | typescript-eslint 8.69 peers on `typescript <6.1`; TypeScript 7 (native port) is out but the lint toolchain has not caught up. tsdown accepts 5/6/7 so nothing is lost. Revisit when typescript-eslint supports 7. |
| commander | 15.0.0 | Arg parsing for `init`, `new`, `lint`, `gate`, `status` | ESM-only, zero deps, `exitOverride()` + `configureOutput()` make `runCli(argv)` testable in-process; nested subcommands (`new ticket`, `gate ready`) are first-class. |
| yaml | 2.9.0 | `config.yml` and frontmatter | YAML 1.2 core schema: dates and `no`/`yes` stay strings with no configuration; a one-line `customTags` filter keeps numerics as strings too; `parseDocument` round-trips comments for tick writes. Verified by running (see Decision 2). |
| @cucumber/gherkin | 42.0.1 | Parse fenced Gherkin AC | Settled by architecture research. It depends directly on `@cucumber/messages >=34 <35`; nothing extra to install. |
| ajv | 8.20.0 | Validate frontmatter and config against shipped `schemas/*.json` | The same JSON file validates in the CLI, drives editor autocomplete, and is readable by the future .NET hub. Error objects carry `instancePath`, which maps straight onto `Finding.path`. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:util` `styleText` | built-in (stable since Node 22.13) | Terminal colour | Always; zero deps; respects `NO_COLOR`, `NODE_DISABLE_COLORS`, `FORCE_COLOR`, and `isTTY` via `validateStream` (default true). |
| `node:fs` `readdir` | built-in | Enumerate `features/*.md`, `tickets/*.md`, `assets/<id>/` | Always; the folder is flat by design, so no glob library. `readdir(dir, { recursive: true })` covers the design-token path scan. |
| ajv-formats | 3.0.1 | `date`, `uri` formats in schemas | Only if a schema declares `format:`; prefer `pattern` for dates so the schema stays self-contained for non-ajv consumers. |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| tsdown | 0.23.0 | Bundle `dist/cli.js` (bin) and `dist/index.js` (core, with `.d.ts`) | Rolldown-based successor to tsup. Dev-only, so its `^22.18 || ^24.11` engine floor does not affect users; use Node 24 locally and in CI build jobs. |
| vitest | 5.0.0 | Unit + golden tests | `toMatchFileSnapshot` (async, `await` required) for JSON goldens; `vitest -u` regenerates. |
| eslint + typescript-eslint | 10.10.0 + 8.69.0 | Core-purity guard | `no-restricted-imports` blocks `node:fs`/`node:path` outside `src/load/` and `src/scaffold/`, and blocks `src/cli/**` from `src/core/**`. |
| GitHub Actions | `ubuntu-latest` + `windows-latest` x Node 22 + 24 | CI and publish | Trusted publishing (OIDC) needs npm >= 11.5.1 and Node >= 22.14 on the publish runner; use `actions/setup-node` with `node-version: 24` there. |
| changesets | 2.x | Versioning | Defer; `npm version` by hand is enough with one author. |

## Decisions

### 1. CLI framework: commander 15 (confidence: MEDIUM)

| Code | Meaning |
|------|---------|
| 0 | Gate PASS / lint clean (warnings allowed) |
| 1 | Gate FAIL or lint errors; reasons printed; deterministic |
| 2 | Usage or environment error: bad args, no accord folder, unreadable config, schema file missing |

### 2. YAML: `yaml` 2.9 core schema with numerics kept as strings (confidence: HIGH, verified by running)

| Input | Default core schema | Core + `customTags` filter | YAML 1.1 (`version: '1.1'`) |
|-------|--------------------|----------------------------|-----------------------------|
| `2026-08-12` | `"2026-08-12"` (string) | string | `Date` object |
| `confirmed: no` | `"no"` | `"no"` | `false` |
| `id: 1e3` | `1000` | `"1e3"` | `1000` |
| `id: 0123` | `123` | `"0123"` | `83` (octal) |
| `0x1F` | `31` | `"0x1F"` | `31` |
| `b: true` / `n: ~` | boolean / null | boolean / null | boolean / null |

### 3. JSON Schema validation: ajv 8 over hand-written JSON files (confidence: MEDIUM)

### 4. Markdown: fence-aware line scanner, no CommonMark parser (confidence: MEDIUM)

### 5. Terminal output: `util.styleText` + hand-rolled ASCII table (confidence: HIGH for styleText behaviour, MEDIUM for the table choice)

### 6. Build and publish (confidence: HIGH for facts, MEDIUM for choices)

| Item | Decision | Rationale |
|------|----------|-----------|
| Bundler | tsdown 0.23.0, `entry: { cli: 'src/cli/index.ts', index: 'src/core/index.ts' }`, `format: ['esm']`, `platform: 'node'`, `dts: true` | tsup 8.5.1 still publishes (Nov 2025) but is in maintenance; tsdown is its designated successor with the same config shape. `dts` needs `typescript` as a dev dep. |
| Shebang | First line of `src/cli/index.ts` is `#!/usr/bin/env node`; tsdown preserves it. Verify in a test that `dist/cli.js` starts with `#!`. | The shebang is only read on POSIX; on Windows npm generates `accord.cmd` / `accord.ps1` shims from the `bin` name. |
| Module format | ESM only, `"type": "module"` | Node >= 22.12 has unflagged `require(esm)`, so a CJS host can still load core. commander 15 is ESM-only anyway. |
| Minimum Node | `"engines": { "node": ">=22.12.0" }` | Floor set by commander 15 and vitest 5; Node 20 is EOL. Trusted publishing needs 22.14+ on the publish runner only. |
| `bin` | `"bin": { "accord": "./dist/cli.js" }` | Single bin, unscoped command name even though the package is scoped. |
| `files` | `["dist", "templates", "schemas", "README.md", "LICENSE"]` | Templates/schemas are runtime assets; resolve them with `new URL('../templates/', import.meta.url)`, never `__dirname`. |
| `exports` | `{ ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }, "./schemas/*": "./schemas/*", "./package.json": "./package.json" }` | Core API for the hub; schemas importable by editor tooling; own version readable for the pin check. |
| Publishing | npm trusted publishing (OIDC) from GitHub Actions: `permissions: { id-token: write, contents: read }`, `actions/setup-node@v4` with `node-version: 24` and `registry-url`, `npm install -g npm@latest`, `npm publish --access public`. Provenance is generated automatically for a public repo + public package under trusted publishing; no token, no `--provenance` flag needed. | Requires npm >= 11.5.1 and Node >= 22.14 on the runner (docs.npmjs.com). Scoped packages default to restricted, so `--access public` is mandatory on the first publish. Configure the trusted publisher on npmjs.com (workflow filename must match) after the first manual publish, or do the first publish with a granular token then switch. |
| Version pin | `init` writes `.github/workflows/accord.yml` with `npx --yes @<scope>/accord@<version>` using the CLI's own `package.json` version, and writes the same version into `config.yml`; `lint`/`gate` warn (build profile) or fail (maintain) on mismatch. | PITFALLS.md §11. The CLI itself never spawns npm/npx (§12). |
| `.gitattributes` | `* text=auto eol=lf` plus `test/fixtures/**/crlf-* -text` | Source is LF on every OS; CRLF fixtures are byte-preserved on Windows checkout. |
| Package name | `@<scope>/accord` | `accord` on npm is held by an abandoned package. |

### 7. Tests: vitest 5, fixture repos, JSON goldens, two-OS matrix (confidence: HIGH for API, MEDIUM for approach)

- **Runner:** vitest 5.0.0, `test.environment: 'node'`, `pool: 'forks'` (forks isolate `process.chdir`-style state and are the safer choice on Windows).
- **Goldens:** `await expect(result).toMatchFileSnapshot('test/__golden__/<fixture>.<command>.json')` on the structured `GateResult` / `Finding[]` / `StatusRow[]`, never on ANSI text. `vitest -u` regenerates. A handful of text-render tests run with `NO_COLOR=1`.
- **In-process runner:** `runCli(argv, { cwd, stdout, stderr })`; commander `exitOverride` + `configureOutput` make it possible. `cwd` is passed explicitly into `load/`, never read from `process.cwd()` in core.
- **One real spawn:** `execFile(process.execPath, ['dist/cli.js', 'status'], { cwd: tmp })`. Spawning `node` by absolute path sidesteps the `.cmd` EINVAL problem entirely; never spawn `accord.cmd` or `npx`.
- **Write-path tests:** copy a fixture into `fs.mkdtemp`, run `init` / `new`, compare a sorted directory listing plus file contents to a golden; re-run and assert the "already exists" refusal.
- **Path invariant:** a test asserts no `\` appears in any `Finding.path` or `status` output on Windows (`path.posix` everywhere in core).
- **CI:** `strategy.matrix: { os: [ubuntu-latest, windows-latest], node: [22, 24] }`, `fail-fast: false`; rely on `.gitattributes` (not `core.autocrlf`) so local Windows clones behave like the runner.

### 8. Single package with two entry points, not a monorepo (confidence: MEDIUM)

## Installation

# Runtime

# Dev

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| commander 15 | clipanion 4 | Command count > 15, or you want `execute()` to return the exit code and are fine with an rc release |
| commander 15 | citty 0.2 | Already in the unjs ecosystem and accept `process.exit` in `runMain` |
| yaml + 10-line split | gray-matter | Never for new code; locks you to js-yaml 3 / YAML 1.1 semantics |
| ajv (hand-written JSON) | zod 4 `toJSONSchema` | TypeScript-first project where the JSON schema is a by-product, not a deliverable |
| ajv | @cfworker/json-schema | Running under CSP / Cloudflare Workers where `new Function` is banned |
| fence scanner | mdast-util-from-markdown | Template loosens to allow arbitrary Markdown structure |
| `util.styleText` | picocolors | Must support Node < 22.13 |
| `padEnd` table | cli-table3 | Need wrapping cells or column spans and accept Unicode borders |
| tsdown | tsup | An existing tsup config you do not want to migrate |
| `fs.readdir` | `fs.promises.glob` | Folder stops being flat; stable since Node 22.17, so raise `engines` first |
| single package | pnpm workspace | Hub repo consumes core at a different cadence than the CLI |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| gray-matter | js-yaml 3 (YAML 1.1 date/boolean coercion), no release since 2019, CRLF handling issues | `yaml` 2.9 + hand-rolled split |
| js-yaml | YAML 1.1 by default (Norway problem, dates become `Date`) | `yaml` |
| `yaml` with `schema: 'json'` | Throws on any unquoted plain scalar; BAs write those constantly | core schema + `customTags` filter |
| picocolors / chalk | picocolors colours unconditionally on win32 and under `CI`; chalk adds size for nothing | `node:util` `styleText` |
| cli-table3 / table | Unicode box drawing breaks legacy Windows consoles; extra deps | ASCII `padEnd` table |
| `child_process.spawn('npx' \| 'npm')` | EINVAL on Windows since Node 20.12.2 without `shell: true`; never needed | Read own `package.json` version; spawn only `node` (by `process.execPath`) or `.exe` binaries if ever required |
| `__dirname` for templates | Undefined in ESM | `new URL('../templates/x', import.meta.url)` + `fileURLToPath` |
| `path.join` for stored or printed paths | Backslashes on Windows leak into files and break POSIX teammates | `path.posix.join` |
| TypeScript 7.x | typescript-eslint 8.69 peers on `<6.1` | TypeScript 5.9.3 until the lint toolchain supports 7 |
| Node 20 in `engines` | EOL 2026-04-30; commander 15 and vitest 5 refuse it | `>=22.12.0` |
| zod as the schema source | JSON output is lossy for refinements; the BA-facing contract should be JSON | Hand-written JSON Schema 2020-12 |
| A Markdown parser in v0.1 | 25+ transitive packages to answer two questions the scanner answers | Fence-aware scanner behind a `sections()` interface |

## Stack Patterns by Variant

- Import `@<scope>/accord` (core is exported at `.`); do not split the repo.
- Because the `exports` map already isolates core from the bin.
- Replace the scanner with `mdast-util-from-markdown` behind the same `sections()` interface.
- Because the interface is the contract; the parser is an implementation detail.
- Keep the `customTags` filter and declare the field `type: string` with a `pattern`, or parse that one field in code.
- Because one parse mode for all frontmatter is simpler than per-file schemas, and the hub must apply the same rule.
- Replace `readdir` walks with `fs.promises.glob` and drop nothing else.
- Because glob is stable from 22.17 and the folder stays flat regardless.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| commander 15.0.0 | Node >= 22.12.0, ESM only | Sets the runtime floor; `--no-*` default semantics changed in 15 (only matters if you define paired positive/negative flags) |
| vitest 5.0.0 | Node ^22.12 \|\| ^24 \|\| >=26 | Dev-only |
| tsdown 0.23.0 | Node ^22.18 \|\| ^24.11 \|\| >=26; TypeScript ^5 \|\| ^6 \|\| ^7 | Dev-only; use Node 24 for builds |
| typescript-eslint 8.69.0 | TypeScript >=4.8.4 <6.1; ESLint ^8.57 \|\| ^9 \|\| ^10 | Blocks TypeScript 7 for now |
| ajv 8.20.0 | TypeScript 5.9 `nodenext` | CJS; import `ajv/dist/2020.js` with the `.js` suffix |
| @cucumber/gherkin 42.0.1 | @cucumber/messages >=34 <35 | Direct dependency, installed automatically |
| yaml 2.9.0 | Node >= 14.6, ESM+CJS dual | No native deps |
| `util.styleText` | Node >= 22.13 (stable), env/isTTY handling >= 22.8 | Avoid `'none'` format (22.17+) |
| `fs.promises.glob` | Node >= 22.17 (stable) | Not used in v0.1 |
| npm trusted publishing | npm >= 11.5.1, Node >= 22.14 on the runner | Publish job only |

## Sources

- npm registry (`npm view`, 2026-09-05): commander 15.0.0 (engines >=22.12.0), commander 14.0.2 (>=20), yaml 2.9.0, ajv 8.20.0, tsdown 0.23.0 (engines ^22.18 || ^24.11 || >=26; peers typescript ^5 || ^6 || ^7), vitest 5.0.0 (engines ^22.12 || ^24 || >=26), typescript 7.0.2 latest / 5.9.3 latest 5.x, typescript-eslint 8.69.0 (peer typescript <6.1), eslint 10.10.0, picocolors 1.1.1, gray-matter 4.0.3 (deps js-yaml ^3.13.1), @cucumber/gherkin 42.0.1 (deps @cucumber/messages >=34 <35), zod 4.5.4, @cfworker/json-schema 4.1.1, citty 0.2.2, clipanion 4.0.0-rc.4, micromark 4.0.2, tsup 8.5.1, ajv-formats 3.0.1 — HIGH
- Local execution of yaml 2.9.0 on Node 24.14 (core vs 1.1 vs json schema coercion table, `customTags` filter, `parseDocument` round-trip with comments, `stringify` quoting, BOM+CRLF split) — HIGH
- picocolors 1.1.1 source (`isColorSupported` expression) — HIGH
- Node.js v22.x `doc/api/util.md` via GitHub raw: `styleText` added 20.12/21.7, env+isTTY handling 22.8, stable 22.13, `'none'` 22.17; `validateStream`/`stream` options — HIGH
- Node.js v22.x `doc/api/fs.md` via GitHub raw: `fsPromises.glob` added 22.0, stable 22.17 — HIGH
- endoflife.date/nodejs: Node 20 EOL 2026-04-30; 22 maintenance to 2027-04-30; 24 active LTS to 2026-10-20; 26 released 2026-05-05 — MEDIUM (aggregator, consistent with Node release policy)
- docs.npmjs.com/trusted-publishers: npm >= 11.5.1, Node >= 22.14, `id-token: write`, automatic provenance for public repo + package — HIGH
- Context7 `/tj/commander.js`: `exitOverride`, `configureOutput`, 15.0.0 breaking changes (ESM-only, Node 22.12, `--no-*`) — HIGH
- Context7 `/vitest-dev/vitest`: `toMatchFileSnapshot` signature (async), `-u` to update, engines — HIGH
- Context7 `/rolldown/tsdown`: multi-entry object config, `format`, `platform: 'node'`, `dts` — HIGH
- Internal: `C:/Work/accord/.planning/research/ARCHITECTURE.md` (project structure, testing), `C:/Work/accord/.planning/research/PITFALLS.md` §8, §10, §11, §12, `C:/Work/accord/docs/design.md` §2, §7, `C:/Work/accord/.planning/PROJECT.md`

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
