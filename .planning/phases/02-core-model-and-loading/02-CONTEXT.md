# Phase 2: Core Model and Loading - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Core turns a repository snapshot into typed tickets, scenarios, and verification records with correct line numbers, whatever the line endings, BOM, or operating system. It also gains the one write primitive later phases need: a frontmatter setter that round-trips comments. A minimal filesystem loader in `packages/cli` builds the snapshot input from a real repo so the core can be exercised end to end before Phase 5.

In scope: FMT-04, FMT-05, FMT-08, CORE-02, CORE-03, CORE-06. Not in scope: lint rules (Phase 3), gate evaluation and the AC hash algorithm (Phase 4), commander commands (Phase 5).

Decision numbering continues from Phase 1 (D-01 to D-27) so that `D-nn` references in code comments stay unambiguous across phases.

</domain>

<decisions>
## Implementation Decisions

### Snapshot input contract

- **D-28:** Core receives a flat, synchronous, serialisable input: `{ files: Record<string, string>; tree: string[] }`. `loadSnapshot(input) → RepoSnapshot` is a pure sync function. No reader interface, no Promise. — **Reversibility:** costly — the MCP host (Phase 8) and the CLI loader both build this shape, and every golden serialises it.
- **D-29:** Keys are paths relative to the repository root (`accord/tickets/X.md`, `src/styles/tokens.css`), forward slashes. Core normalises every incoming key: `\` becomes `/`, a leading `./` is stripped. A host that passes Windows-style keys gets byte-identical output. Core never rejects a key for its separator.
- **D-30:** `files` carries the text of everything under `accord/` plus the design tokens file named by `config.design.tokens` (when set). `tree` lists every path in the repository, content-free, for existence checks; Phase 2 only normalises and stores it, Phase 4 (GATE-04) reads it.
- **D-31:** `accord/config.yml` is inside `files`. `loadSnapshot` parses and validates it with the existing `validate('config', …)` and exposes `snapshot.config`; when it is missing or invalid, `snapshot.config` is `undefined` and the problem is a finding in `snapshot.errors`. The host decides that this means exit code 2.

### Broken files and validation boundary

- **D-32:** A ticket whose frontmatter cannot be used still has an entry in `snapshot.tickets`, keyed by the file stem (D-04: id equals file name). `ticket.frontmatter` is the typed object only when the document passes the schema; otherwise it is `undefined`. No partial object is kept. Cases: no `---` block or unterminated block; YAML syntax error; YAML that is not a map; schema failure (missing required key, unknown key, wrong type, enum, or pattern).
- **D-33:** Schema validation happens in the loader, not in Phase 3 lint. The JSON pointer from `validate()` is mapped to the YAML node (via `parseDocument`) to obtain the line. Line conventions: no frontmatter → line 1; YAML syntax error → the line `yaml` reports; non-map → line 2; schema error → the line of the offending key or value.
- **D-34:** `frontmatter.id` differing from the file name, and duplicate ids across files, are not loader concerns. The loader keeps `frontmatter.id` verbatim; Phase 3 lint compares it with the file name (case-sensitive, per Phase 1 discretion note).
- **D-35:** Body problems (Gherkin parse error, missing required heading, duplicate heading) never discard the frontmatter. The ticket keeps its frontmatter, `scenarios` is empty for a fence that failed to parse, and the error carries the Markdown line (parser line remapped through the fence offset).
- **D-36:** Only fenced `gherkin` blocks under `## Acceptance criteria` are acceptance criteria. Several fences under that heading are allowed; each is parsed separately and their scenarios are concatenated in document order. A `gherkin` fence under any other heading (for example `## Plan`) is ignored. This supersedes the ARCHITECTURE.md note "concatenate all fences".
- **D-37:** Files that do not match the convention are ignored silently (`tickets/notes.txt`, `tickets/<id>/plan.md`). One exception: `tickets/<id>/verification.md` whose `tickets/<id>.md` does not exist is an error finding (orphan). Only `tickets/*.md` are tickets; only `tickets/<id>/verification.md` is a verification record.
- **D-38:** A leading BOM is stripped and CRLF is normalised to LF before any splitting or parsing. Neither is ever reported. The loader accepts all three of LF, CRLF, BOM+CRLF and produces identical output.

### Body extraction rules

- **D-39:** Sections are located by `##` headings using the fence-aware line scanner (STACK Decision 4). Heading match is case-insensitive, whitespace-collapsed, and ignores trailing `#` characters; `## Acceptance Criteria ` matches `## Acceptance criteria`. The template casing is a display convention, not a rule.
- **D-40:** A required heading that appears twice is an error at the line of the second occurrence; the first section is used. Content is never merged and the last occurrence never wins.
- **D-41:** An EARS line is every non-blank line under `## Requirements` after removing HTML comments (single-line and multi-line) and fenced blocks, with a leading list marker (`-`, `*`, `+`, `1.`) stripped. Plain lines and bullets are both requirements. Each carries its Markdown line number. Classification is Phase 3.
- **D-42:** `verification.md` body: one block per `## @ac-n <name>` heading (matching is by tag; the name is for humans). `Result:` is required in each block and its value must be `pass`, `fail`, or `blocked`; a missing or other value is a loader error at that block's line. `Evidence:` is the text from after the label to the next `##` heading or end of file, trimmed; it may be empty. Evidence content is checked in Phase 4 (GATE-04).

### Tick write and scenario shape

- **D-43:** One generic write primitive, `setFrontmatterKey(text, key, value) → text`, implemented over `yaml`'s `parseDocument` so comments and unrelated formatting survive. It keeps `verified` as the last key (D-03) and inserts any new key before `verified` when `verified` exists. Phase 4 uses it for `ac_hash`, Phase 5 and 8 for `verified` and `status`. Output is LF, UTF-8, no BOM (FMT-08). — **Reversibility:** costly — three later phases call it.
- **D-44:** `verified` is written as a YAML block list, one tag per line; an empty list is written as `verified: []`. D-03's `[ac-1, ac-2]` was notation, not a serialisation rule; the block form follows PITFALLS §14 (append-only edits at a fixed location).
- **D-45:** Every string scalar that core writes is double-quoted, including the tags inside `verified` and `ac_hash`. Booleans and empty lists are written plain. This follows PITFALLS §8 so YAML 1.1 tools cannot misread a value.
- **D-46:** `ScenarioRef` carries `name`, `keyword` (normalised to `Scenario` or `Scenario Outline`), `line` (Markdown line of the `Scenario` keyword), `tags` (every tag on the scenario), `acTag` (the single tag matching `@ac-n`, or `undefined`), and `steps`: the step lines that form the AC identity (see D-47, D-48). Untagged scenarios are kept so Phase 3 can report them. Feature-level tags do not count as `acTag`. Extra tags such as `@smoke` are allowed and ignored. Two `@ac-n` tags on one scenario is a Phase 3 finding; the loader keeps the first as `acTag` and all in `tags`.
- **D-47:** `Background:` steps are prepended to every scenario's `steps` and are therefore part of the hash input. Editing a Background changes the meaning of every scenario and must make Done fail.
- **D-48:** The scenario name and Gherkin comments are not part of the hash input. `steps` holds keyword plus text for each step, doc strings, data tables, and the `Examples` table of a Scenario Outline, whitespace-collapsed. Phase 4 hashes `steps` and picks the algorithm (D-25); Phase 2 only guarantees the content is stable and complete.
- **D-49:** `Rule:` blocks are supported: scenarios nested under a Rule are collected like any other; the Rule name is ignored and not part of the hash.
- **D-50:** A `# language: xx` header at the top of a fence is honoured per fence using the parser's built-in dialects; the default is `en`. `ScenarioRef.keyword` is always the English name regardless of dialect. A Scenario Outline counts as one scenario in every dialect (FMT-04).

### Filesystem loader in the CLI package

- **D-51:** Phase 2 adds `packages/cli/src/load/fs.ts` that builds a `SnapshotInput` from a repository root. `tree` comes from `git ls-files --cached --others --exclude-standard` (tracked plus untracked-but-not-ignored, which matches what the GitHub API sees and keeps GATE-04 parity between CLI and MCP). `files` reads every file under `accord/` and the configured tokens file. `git` is spawned by name (`.exe` on Windows, never a `.cmd`); a repository without git available is a usage error (exit 2 in Phase 5). No hand-written ignore list, no `.gitignore` parsing.

### Finding shape

- **D-52:** One `Finding` type for load, lint, and gate: `{ file: string; line?: number; rule: string; reason: string; pointer?: string }`. Phase 1's `path` (a JSON pointer) is renamed to `pointer`; the four Phase 1 goldens and their tests are updated in this phase. `level` is added in Phase 3 with the rule table. — **Reversibility:** reversible now, costly after Phase 3 renders it to JSON for CI consumers.

### Fixtures and goldens

- **D-53:** Fixtures are real `accord/` folders committed LF-only under `packages/core/test/fixtures/<name>/`. A test helper reads a fixture directory into a `SnapshotInput`. CRLF, BOM+CRLF, and backslash-key variants are derived in memory from the same LF source inside the test; no variant is committed. The `**/test/fixtures/**/crlf-* -text` line in `.gitattributes` is therefore unused and may be removed.
- **D-54:** One golden per fixture: the JSON of the whole `RepoSnapshot` (sorted keys, stable array order). The same golden must be byte-identical on Ubuntu and Windows CI and across the three encoding variants and the backslash variant (success criterion 4). Round-trip tests for `setFrontmatterKey` compare full file text against a golden Markdown file.

### Core public API

- **D-55:** `packages/core/src/index.ts` exports `loadSnapshot`, `setFrontmatterKey`, the model types (`SnapshotInput`, `RepoSnapshot`, `Ticket`, `TicketFrontmatter`, `ScenarioRef`, `Verification`, `Finding`, `AccordConfig`), and keeps the Phase 1 exports (`validate`, `schemaIds`, `templates`). Internal parsers (frontmatter split, section scanner, Gherkin extraction, verification parser) are not exported; Phase 3 lives inside core and imports them directly; tests import from `src/`.

### Claude's Discretion

- Internal module layout under `packages/core/src/` (suggested: `model/`, `load/frontmatter.ts`, `load/sections.ts`, `load/gherkin.ts`, `load/verification.ts`, `load/snapshot.ts`, `write/frontmatter.ts`), following ARCHITECTURE.md's shape with `features` removed.
- The `Section` model returned by the scanner: heading text, heading line, and raw lines with line numbers; how `### ` sub-headings inside a `##` section are treated (they belong to the enclosing section).
- Exact normalisation of `steps` text (whitespace collapsing, table cell trimming) as long as it is deterministic and documented in a test.
- How `ui` defaults to `false` in `TicketFrontmatter` (D-21: loader, not schema).
- `tree` and `files` key ordering in the golden (sorted).
- The fixture set: at minimum one valid build-profile ticket with two scenarios and a Background, one epic, one verification record, one broken-frontmatter ticket, one Gherkin parse error, one duplicate heading, one orphan verification, one `# language: vi` fence, one Scenario Outline, one multi-fence AC.
- Whether the CLI fs loader shells out through `execFile` or `spawnSync`; both spawn `git` by name only.

### Folded Todos

None. The `mcp-host-spike.md` todo matched this phase (score 0.6) but stays scheduled after Phase 4 (see Deferred).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product intent and requirements
- `.planning/PROJECT.md` — core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — FMT-04, FMT-05, FMT-08, CORE-02, CORE-03, CORE-06 are this phase's scope; CORE-05 and GATE-04 shape the `Finding` and `tree` decisions
- `.planning/ROADMAP.md` Phase 2 — goal and five success criteria
- `.planning/phases/01-workspace-and-formats/01-CONTEXT.md` — D-01 to D-27; D-03 (verified last), D-04 (id = file name), D-06 (folder rule), D-07 (headings), D-09 (verification format), D-19/D-27 (generated templates), D-20 (validator seam), D-21 (ui default in loader)
- `docs/design.md` §2 (folder and body layout), §5 (gates, three-set match)

### Architecture and stack
- `.planning/research/ARCHITECTURE.md` — Pattern 2 (snapshot-first loading), `RepoSnapshot`/`ScenarioRef` sketch, Gherkin extraction notes (classic token matcher, `CompositeParserException`), project structure; superseded where D-28 to D-55 differ (`features` removed, fences only under AC, input contract)
- `.planning/research/STACK.md` — Decision 2 (yaml core schema, `customTags` filter, `parseDocument` round-trip), Decision 4 (fence-aware scanner behind `sections()`), Decision 7 (vitest, goldens, two-OS matrix, path invariant)
- `.claude/CLAUDE.md` "Technology Stack" — same content as STACK.md, loaded every session

### Pitfalls that shape this phase
- `.planning/research/PITFALLS.md` §5 (tags as keys), §8 (YAML coercion, CRLF, BOM, quote on write), §10 (fenced AC, duplicate headings), §12 (Windows: spawn `.exe` only, `path.posix`), §14 (verified as block list, last key)

### Existing code this phase extends
- `packages/core/src/validate/index.ts` — `validate(schemaId, doc)` seam used by D-33
- `packages/core/src/model/finding.ts` — the type D-52 replaces
- `packages/core/schemas/ticket.schema.json`, `verification.schema.json`, `config.schema.json` — the frontmatter contracts
- `packages/core/templates/ticket-build.md`, `verification.md` — the layouts the scanner must read, including the multi-line HTML guidance comments (D-41)
- `packages/core/test/schemas.test.ts` and `test/__golden__/*.json` — Phase 1 goldens to update for D-52

### Todo reviewed
- `.planning/todos/pending/mcp-host-spike.md` — not folded; stays after Phase 4

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `validate(schemaId, doc) → Finding[]` with ajv behind the D-20 seam; the loader calls it for ticket, verification, and config frontmatter.
- `templates` generated module (D-27) and `scripts/gen-templates.mjs`: the pattern for build-time assets without `fs` in core; the ticket templates double as the first fixture source.
- ESLint purity guard (`node:*` and bare built-ins banned in `packages/core/src`) and `tsconfig` with `types: []`: any accidental `fs` use in the loader fails lint and typecheck.
- `.gitattributes` `* text=auto eol=lf`: fixture folders are LF on every clone.
- Dependencies already declared in `packages/core/package.json`: `yaml` 2.9.0, `@cucumber/gherkin` 42.0.1, `ajv` 8.20.0.

### Established Patterns
- Goldens are `toMatchFileSnapshot` of `JSON.stringify(result, null, 2)` on structured objects, never on text; `vitest -u` regenerates.
- Decisions are cited in code comments by number (`D-20 seam`), hence the continued numbering in this phase.
- CLI entry (`packages/cli/src/index.ts`) is a placeholder; Phase 2 adds `src/load/fs.ts` beside it without touching commander.
- Repo-level scripts: `npm run gen`, `build`, `lint`, `typecheck`, `test`, `check`.

### Integration Points
- Phase 3 lint consumes `RepoSnapshot` (`tickets`, `verifications`, `errors`, `config`) and `Finding` (adds `level`).
- Phase 4 hashes `ScenarioRef.steps` and checks evidence references against `tree`; it writes `ac_hash` through `setFrontmatterKey`.
- Phase 5 wires `packages/cli/src/load/fs.ts` into commander commands.
- Phase 8 builds `SnapshotInput` from the GitHub tree and contents API; D-28 to D-30 are the contract it must satisfy.

</code_context>

<specifics>
## Specific Ideas

- The author's team writes ticket content in Vietnamese under English headings; D-50 lets a BA write `# language: vi` and use `Kịch bản` / `Cho` / `Khi` / `Thì`. A `vi` fixture is expected.
- The Phase 1 sample ticket (Vietnamese content, English headings, two EARS lines, two tagged scenarios, one checked open question, empty `## Plan`) is the basis for the primary valid fixture; add a `Background:` to it so D-47 is covered.
- `tree` parity between `git ls-files` and the GitHub API is the reason git is used rather than a directory walk: the same evidence line must pass or fail identically from the CLI and from chat.

</specifics>

<deferred>
## Deferred Ideas

- **Case-sensitive `id` vs file-name check and duplicate-id detection** — Phase 3 lint (per Phase 1 discretion note; D-34).
- **Two `@ac-n` tags on one scenario, missing tag, duplicate tag across scenarios** — Phase 3 LINT-03; the loader only records the data.
- **Evidence reference syntax and existence check** — Phase 4 GATE-04 over `tree`.
- **AC hash algorithm and `ac_hash` pattern** — Phase 4 (D-25).
- **Lint on heading casing** — rejected; D-39 makes casing irrelevant.
- **Warning on stray files under `accord/`** — rejected for v0.1 (D-37); revisit if pilots show misnamed tickets.
- **Partial frontmatter object for `status` display of broken tickets** — rejected (D-32); `status` shows the file as invalid with its findings.

### Reviewed Todos (not folded)
- `mcp-host-spike.md` — bundling core for a serverless host, GitHub API commit test, folder fetch timing. Stays scheduled after Phase 4. Phase 2 only ensures the input contract (D-28 to D-30) is something that host can build.

</deferred>

---

*Phase: 02-core-model-and-loading*
*Context gathered: 2026-09-06*
