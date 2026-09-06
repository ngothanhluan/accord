# Stack Research

**Domain:** Node/TypeScript CLI distributed via `npx` as a scoped package; lints Markdown+YAML spec files, runs deterministic gates, copies SKILL.md files; must run on Windows and POSIX
**Researched:** 2026-09-05
**Confidence:** HIGH for versions and engine floors (checked against the npm registry and official docs today); MEDIUM for the framework/library choices (opinion backed by verified behaviour, not by dogfooding)

Builds on sibling research: `@cucumber/gherkin` 42.x is settled (ARCHITECTURE.md); skills are plain SKILL.md copies; the CLI never spawns npm/npx; generated CI pins the package version (PITFALLS.md §11, §12).

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

No `fast-glob`, no `picocolors`, no `gray-matter`, no Markdown parser in v0.1 (reasons below). Runtime dependency count: 4 (commander, yaml, @cucumber/gherkin, ajv) plus their transitive `@cucumber/messages`, `fast-deep-equal`, `json-schema-traverse`, `fast-uri`, `require-from-string`.

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

**Why commander:** five commands, two of which have subcommands, and exit codes that CI and skills depend on. Commander's `program.exitOverride()` turns every exit into a thrown `CommanderError` with `exitCode`, and `configureOutput({ writeOut, writeErr })` redirects help/usage text, so `runCli(argv, { cwd, stdout, stderr })` returns `{ code, stdout, stderr }` without spawning a process. Zero dependencies; commander 15 went ESM-only, which matches the package. It is the library most contributors already know.

**Why not citty (0.2.2):** unjs-native and smaller, but `runMain` calls `process.exit` and error rendering is less controllable; you would wrap `runCommand` and reimplement usage errors to get exit code 2. No upside for five commands.

**Why not clipanion (4.0.0-rc.4):** the nicest exit-code model (`execute()` returns the code), but still a release candidate on the 4.x line, class-per-command style is unfamiliar to most contributors, and it brings `typanion`. Revisit only if command count grows past ~15.

**Exit-code contract (write into `docs/design.md` §7):**

| Code | Meaning |
|------|---------|
| 0 | Gate PASS / lint clean (warnings allowed) |
| 1 | Gate FAIL or lint errors; reasons printed; deterministic |
| 2 | Usage or environment error: bad args, no accord folder, unreadable config, schema file missing |

Commander's own usage errors default to exit code 1; in `runCli`, catch `CommanderError` and return 2 for `commander.*` error codes except `commander.helpDisplayed` / `commander.version` (return 0).

### 2. YAML: `yaml` 2.9 core schema with numerics kept as strings (confidence: HIGH, verified by running)

**Decision:** `yaml` 2.9.0. Parse frontmatter with:

```ts
import { parse, parseDocument, stringify } from 'yaml';
const stringNumerics = (tags) => tags.filter((t) => !/int|float/.test(t.tag));
const fm = parse(yamlText, { schema: 'core', customTags: stringNumerics });
```

**Measured behaviour on yaml 2.9.0 (Node 24):**

| Input | Default core schema | Core + `customTags` filter | YAML 1.1 (`version: '1.1'`) |
|-------|--------------------|----------------------------|-----------------------------|
| `2026-08-12` | `"2026-08-12"` (string) | string | `Date` object |
| `confirmed: no` | `"no"` | `"no"` | `false` |
| `id: 1e3` | `1000` | `"1e3"` | `1000` |
| `id: 0123` | `123` | `"0123"` | `83` (octal) |
| `0x1F` | `31` | `"0x1F"` | `31` |
| `b: true` / `n: ~` | boolean / null | boolean / null | boolean / null |

So the core schema alone fixes the date and Norway problems from PITFALLS.md §8, and the tag filter fixes ticket IDs that look numeric. Booleans and null still resolve, which is what `ui: true` and the tick map need. The `schema: 'json'` option is not usable: it throws `TAG_RESOLVE_FAILED` on any unquoted plain scalar, which BAs will write constantly.

**Round-trip for QA tick writes:** `parseDocument(text, { customTags })`, `doc.setIn(['scenarios', key], true)`, `doc.toString({ lineWidth: 0 })`. Verified: leading comments, inline `# todo` comments, key order, and existing quoting all survive. Always write LF.

**Scaffold writes:** `stringify(obj, { defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' })` quotes every string value (`id: "1e3"`, `d: "2026-08-12"`, `s: "no"`) so a file written by `accord new` is unambiguous in any parser, including the hub's.

**gray-matter vs `yaml` + hand-rolled split: hand-rolled.** gray-matter 4.0.3 has had no release since 2019 (registry metadata last touched 2023-07) and depends on `js-yaml ^3.13` (YAML 1.1: the exact coercions in the right-hand column above) unless you inject an engine; it also brings `kind-of`, `section-matter`, `strip-bom-string`. The split Accord needs is ~10 lines and was verified on a BOM+CRLF input:

```ts
const norm = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const m = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(norm);
// m[1] = YAML, body = norm.slice(m[0].length), bodyLineOffset = count('\n' in m[0])
```

Keep the line offset so Gherkin parse errors can be reported at the ticket file's real line. ARCHITECTURE.md's `load/frontmatter.ts` should be described as "yaml wrapper, BOM/CRLF normalisation" rather than "gray-matter wrapper".

### 3. JSON Schema validation: ajv 8 over hand-written JSON files (confidence: MEDIUM)

**Decision:** author `schemas/ticket.schema.json`, `feature.schema.json`, `config.schema.json` by hand in draft 2020-12; validate with `Ajv2020` (`import Ajv2020 from 'ajv/dist/2020.js'`, `{ allErrors: true, strict: true }`); ship the files in the package; templates carry `# yaml-language-server: $schema=./schemas/ticket.schema.json` in the frontmatter comment so VS Code's YAML extension autocompletes.

**Why not zod 4.5 + `z.toJSONSchema()`:** PROJECT.md lists the JSON schema as a deliverable, and the hub is .NET, so the JSON file is the contract, not a build by-product. Generating it from zod makes TypeScript the source of truth that BAs and the hub cannot read, and `toJSONSchema` cannot represent refinements/transforms, so you drift into two truths. Hand-write the JSON; derive TS types with `json-schema-to-typescript` (dev-only) or by hand (three small interfaces).

**Why not @cfworker/json-schema 4.1.1:** its selling point is no `new Function` (CSP / Workers). A Node CLI does not care, and ajv's structured errors (`instancePath`, `keyword`, `params`) are richer for `Finding` messages.

**ajv caveats:** CJS package; the `ajv/dist/2020.js` path with explicit `.js` is required under `module: nodenext`. `strict: true` rejects unknown keywords, so either avoid `x-*` extension keys or register them. Do not enable `coerceTypes`; the whole point is to report a number where a string was expected.

### 4. Markdown: fence-aware line scanner, no CommonMark parser (confidence: MEDIUM)

**Decision:** a ~60-line scanner that tracks fence state (```` ``` ```` or `~~~`, >= 3 chars, closing fence of at least the same length, info string captured) and recognises ATX headings at column 0 only while outside a fence. It returns `Section[]` (heading text, level, body range) and `Fence[]` (info, content, start line). Duplicate H2 names are a lint error.

**Why this satisfies PITFALLS.md §10:** the two failure cases named there (heading inside a fence; duplicate `## Acceptance criteria`) are both fence-state and heading-count problems, which the scanner handles. The template is Accord's own, so the lint rule can say "sections are `## ` ATX headings at column 0; AC is one fenced ```` ```gherkin ```` block" and reject setext headings, indented code, and HTML blocks explicitly rather than parsing them.

**Why not remark / micromark 4.0.2 / markdown-it:** remark brings `unified` + mdast utilities (~25 packages) and then you walk positions anyway; micromark yields events, so you write the same state machine over events instead of lines. Both cost more than the scanner for a fixed template.

**Revisit trigger:** dogfooding shows BAs pasting Markdown the scanner misreads. Then swap in `mdast-util-from-markdown` behind the same `sections()` interface in `src/load/`.

### 5. Terminal output: `util.styleText` + hand-rolled ASCII table (confidence: HIGH for styleText behaviour, MEDIUM for the table choice)

**Decision:** colour via `styleText(format, text)` from `node:util`; the `status` table via `padEnd` with ASCII `-` and `|`; no picocolors, no cli-table3.

**Why `styleText` over picocolors 1.1.1:** reading picocolors' source, `isColorSupported` is `!NO_COLOR && (FORCE_COLOR || --color || platform === 'win32' || (isTTY && TERM !== 'dumb') || CI)`. On Windows it colours unconditionally, and it colours under `CI=true`, regardless of `isTTY`. Accord's text output is piped into agents (skills run `accord gate ready <id>` and read stdout) and into CI logs, so on the author's own platform every piped run would carry ANSI codes. `styleText` (stable since 22.13; NO_COLOR/FORCE_COLOR/isTTY handling since 22.8) with `validateStream: true` checks `process.stdout.isTTY` and the env correctly on both platforms. Zero dependencies. Avoid the `'none'` format (22.17+ only). Never style on the `--json` path; render JSON from the same result object.

**Why not cli-table3 / table:** Unicode box drawing renders as garbage in legacy conhost and some log viewers (PITFALLS.md §12) and they pull `string-width`/`@colors/colors`. `status` has five fixed columns (id, title, ui, ready, done); width `process.stdout.columns ?? 80`, truncate title with `...`. Strip ANSI before measuring width, or style after padding.

**Why not chalk 5:** no functional gain; larger; same detection caveats as picocolors.

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

**Decision:** one package `@<scope>/accord` with `src/core/` (model, load, lint, gate, status; pure, no `cli/` imports) and `src/cli/` (commander wiring, render). tsdown emits `dist/index.js` + `.d.ts` (core) and `dist/cli.js` (bin). ESLint enforces the boundary.

**Why not `packages/core` + `packages/cli` now:** the hub is out of scope and lives in another repo. A workspace adds a second `package.json`, publish ordering (core before cli), `workspace:*` handling, and changesets config, for zero consumers of core today. The `exports` map already exposes core at `.`, so the hub can `import { evaluateGate } from '@<scope>/accord'` without a split. The boundary that matters (purity) is enforced by lint either way.

**Split trigger:** the hub needs a core version the CLI is not ready to ship, or core needs a dependency the CLI should not carry. The move is mechanical because the boundary already exists in `src/`.

## Installation

```bash
# Runtime
npm install commander@15 yaml@2 @cucumber/gherkin@42 ajv@8

# Dev
npm install -D typescript@5.9 tsdown vitest @types/node@22 eslint typescript-eslint
```

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

**If the hub needs core before v0.2:**
- Import `@<scope>/accord` (core is exported at `.`); do not split the repo.
- Because the `exports` map already isolates core from the bin.

**If BAs report the linter misreads their Markdown:**
- Replace the scanner with `mdast-util-from-markdown` behind the same `sections()` interface.
- Because the interface is the contract; the parser is an implementation detail.

**If a schema field must genuinely be numeric later (e.g. `estimate`):**
- Keep the `customTags` filter and declare the field `type: string` with a `pattern`, or parse that one field in code.
- Because one parse mode for all frontmatter is simpler than per-file schemas, and the hub must apply the same rule.

**If `engines` rises to `>=22.17`:**
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

---
*Stack research for: spec-gate CLI over Markdown+YAML, npx-distributed, Windows+POSIX*
*Researched: 2026-09-05*
