# Phase 3: Lint - Research

**Researched:** 2026-09-14
**Domain:** Pure rule engine over `RepoSnapshot` (TypeScript, no new dependencies): EARS classification, Gherkin tag rules, prototype design-token allowlist, JUnit XML line scanner, hygiene and size rules, text and JSON rendering
**Confidence:** HIGH for the in-repo shapes and the three algorithms (all run this session); MEDIUM for the JUnit id shapes per runner (official docs and source); LOW only for policy lists marked `[ASSUMED]`

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Rule engine and result (CORE-04, CORE-05, LINT-01)

- **D-56:** `Finding` gains `level: 'error' | 'warning'`. `lint` exits 1 when any finding is an error; warnings never change the exit code. No `--strict` promotion in v0.1. — **Reversibility:** costly — the JSON is what CI scripts and the text renderer consume from Phase 5 on.
- **D-57:** Rules are data objects in one table: `{ id, level, appliesTo, check }` with a profile dimension, so the build/maintain matrix is readable off the code (CORE-04). In v0.1 no lint rule differs by profile: the token rule (LINT-04) and the size rules (LINT-07) are warnings on both `build` and `maintain`. Promotion later is a table edit (GATE-07 in Phase 4, GATE-12 in v2), not a structural change.
- **D-58:** `lintSnapshot` returns one list: every `snapshot.errors` entry (`load.*`) stamped `level: 'error'`, plus the `lint.*` findings, sorted by file, then line (line-less findings first), then rule id. LINT-01 (schema errors with path and line) and the parse-error part of LINT-03 are satisfied by surfacing the loader findings; lint never re-validates.
- **D-59:** Rule ids are `lint.<kebab-name>`, mirroring the existing `load.<name>` ids.
- **D-60:** Renderers live in core, colour-free: `renderText(result)` and the JSON form of the same object. Text is one line per finding, `file:line: level rule reason`, with `:line` omitted when the finding has no line, followed by a summary line `N errors, M warnings`. The CLI (Phase 5) wraps the text with `styleText`; MCP hosts, if any, return it verbatim. — **Reversibility:** costly — once CI logs and editor problem-matchers parse the line shape.

### EARS classifier (LINT-02)

- **D-61:** Each line in `ticket.requirements` (D-41) is classified against the six Mavin patterns: ubiquitous, event-driven (`WHEN`), state-driven (`WHILE`), unwanted behaviour (`IF … THEN`), optional feature (`WHERE`), and complex (combinations). Keywords and the subject phrase are case-insensitive and whitespace-collapsed. The verb must be `shall`; `should`, `must`, and `will` do not match.
- **D-62:** The subject is the literal `the system shall`. No named system (`the Invoice service shall`) and no configurable name; the phrase is also the delimiter between trigger and response inside Vietnamese prose, which a free noun phrase would blur.
- **D-63:** Keywords are English only. Content in any language, as fixture `LOGIN-1` shows (`WHEN người dùng gửi … the system SHALL mở …`). No Vietnamese keyword set.
- **D-64:** One `lint.ears-unclassified` warning per unmatched line at its Markdown line. The reason is a deterministic diagnosis: which keyword was found and which part is missing (for example `has WHEN but no 'the system shall'`, `has 'the system shall' but the line starts with prose and no keyword`). No nearest-pattern heuristic. Matched lines produce no finding.

### Token rule (LINT-04)

- **D-65:** `RepoSnapshot` gains `files: Record<string, string>` holding the raw text of only the files rules read raw: every `accord/assets/<id>/prototype.html`, the file named by `config.design.tokens`, and the file named by `config.tests.report`. Tickets, verification records, and `config.yml` are not in it (already parsed). Goldens include these entries. — **Reversibility:** costly — every fixture golden serialises the snapshot (D-54) and Phase 4 reads `files` for the report.
- **D-66:** Allowlist model, not blocklist: on colour and spacing properties the value must be `var(--name)` where `--name` is defined in the tokens file, or one of a fixed exemption list (`transparent`, `currentColor`, `inherit`, `0`, `1px`, `100%` as the starting set). Surfaces scanned: `<style>` blocks, `style=""` attributes, Tailwind arbitrary-value classes. The property list, the exemption list, Tailwind v4 `@theme` extraction, and the line-attribution method are the research questions for this phase. Finding `lint.token-hardcoded`, warning, never error in v0.1.
- **D-67:** When `design.tokens` is empty, the prototype header must carry a `Derived from:` line with at least one path, and each path must exist in `snapshot.tree` (the GATE-04 existence rule reused); otherwise `lint.prototype-derivation`, warning. When `design.tokens` is set but the file is absent from `files`, `lint.tokens-missing`, warning, on `accord/config.yml`, and the allowlist check is skipped for that snapshot.
- **D-68:** Every `assets/<id>/prototype.html` present in the snapshot is scanned, independent of the ticket's `ui` flag and of whether `tickets/<id>.md` exists. Findings attach to the prototype file with a line. No orphan-prototype finding (D-37 stands).

### Scenario test tag and verification notes (FMT-09, FMT-10)

- **D-69:** A scenario not tagged `@ui` carries exactly one `@test:<id>` tag. Lint: `lint.test-tag-missing` (warning; a ticket at Ready has no tests yet, GATE-08 blocks at Done), `lint.test-tag-duplicate` (error; more than one `@test:` on one scenario), `lint.test-tag-on-ui` (warning; `@ui` scenario carrying `@test:`). The scenario tag `@ui` is independent of the frontmatter `ui:` key. Tags are outside the AC hash (D-48), so the developer adds `@test:` after Ready without changing `ac_hash`.
- **D-70:** `## Verification notes` holds one `### @ac-n` block per ticked scenario. Lint: `lint.note-orphan` (warning; a block whose tag matches no scenario) and `lint.notes-not-last` (warning; the section exists but is not the last `##` section). Comparing notes with `verified` and checking note content is GATE-10 (Phase 4).
- **D-71:** `lint.heading-missing`, error, for the D-07 required headings by type: story and bug need `Intent`, `Requirements`, `Acceptance criteria`, `Open questions`, `Plan`; epic needs `Intent`, `Requirements`, `Open questions`. `## Verification notes` is never required by lint (it is written at Done). Heading order other than D-70 is not linted (D-07, D-39).

### Test report (FMT-11)

- **D-72:** `config.yml` gains optional `tests: { report: <repo-relative path> }` (schema update, `additionalProperties: false` kept). The CLI loader reads that file into `SnapshotInput.files` the way it reads the tokens file today; the core loader parses it with a line scanner over `<testcase>` and its `<failure>` / `<skipped>` / `<error>` children into `snapshot.tests: Record<string, 'passed' | 'failed' | 'skipped'>`. No XML dependency. Lint: `lint.report-missing` (warning, on `accord/config.yml`, when configured but absent) and `lint.test-id-unknown` (warning, when a report is present and a `@test:` id is not in it). How an id is formed from `classname` and `name` is a research question; `@test:auth.spec.ts#rejects-bad-password` from the re-aim note is the reference shape. Phase 4 joins `@test:` ids against `snapshot.tests` for GATE-08.

### Hygiene and plan tags (LINT-06, LINT-08)

- **D-73:** Sentinels are `TODO`, `TBD`, `FIXME` as uppercase whole words anywhere in the body, fences included, HTML comments excluded (template guidance lives in comments). Unfilled template placeholders count as sentinels: a step whose text is only `...`, an angle-bracket placeholder `<…>` outside HTML tags in a Markdown body, and the literal `TICKET-ID`. Finding `lint.sentinel`, warning, one per occurrence with line. Unchecked `- [ ]` under `## Open questions`: `lint.open-question`, warning, at the item line. `assumptions[].confirmed: false`: `lint.assumption-unconfirmed`, warning, with pointer. All three are warnings at lint because a `draft` ticket legitimately has them; GATE-01 blocks Ready.
- **D-74:** A plan step is each list item (`-`, `*`, `+`, `1.`) under `## Plan` after HTML-comment stripping. Its tags are every `@ac-n` anywhere in the item. `lint.plan-step-untagged` (warning, per untagged item, at its line); `lint.plan-tags-differ` (warning, one finding naming the tags missing from each side); `lint.plan-empty` (warning, when the ticket has scenarios and `## Plan` has no step). Equal sets produce nothing. Epics have no plan and are skipped.

### Claude's Discretion

- LINT-03 levels: missing `@ac-n`, duplicate `@ac-n` across scenarios, two `@ac-n` on one scenario, an empty step, and a `story`/`bug` with zero scenarios are errors, each with its own `lint.*` id (success criterion 3).
- LINT-05 orphan tick (`verified` names a tag with no scenario): warning.
- LINT-07 counting: intent lines are non-blank lines under `## Intent` after comment stripping; EARS count is `ticket.requirements.length`; scenario count is `ticket.scenarios.length`; thresholds 5 / 15 / 5 are constants, not config. Intent and EARS limits apply to epics too.
- `frontmatter.id` differing from the file stem (case-sensitive, D-34): error. Duplicate ids can only arise from case-different file names, so the same rule covers them.
- `tracker: {}`: warning (D-22).
- `LintResult` shape (`{ findings, errors, warnings }` or similar), sort tie-breaks, and whether identical findings from ajv's `if`/`then` at the same pointer are deduplicated (Phase 1 note).
- Module layout: `packages/core/src/lint/` with one file per rule group, `index.ts` exporting `lintSnapshot`, a `render/` folder for text; `load/junit.ts` for the report scanner.
- Whether the ticket templates gain an empty `## Verification notes` section and `@test:` guidance in the Gherkin comment, and whether `epic.md` stays without both.
- Fixture set: extend `valid-build` with `assets/LOGIN-1/prototype.html` and a real `tokens.css`; add lint fixtures for EARS shapes, sentinels, plan tags, notes, `@test:` variants, a JUnit report, and a no-tokens prototype.

### Deferred Ideas (OUT OF SCOPE)

- **MCP server no longer needed** — owner's view during this discussion, consistent with the solo re-aim note. ROADMAP Phase 8, REQUIREMENTS MCP-01..07, and milestone criterion 2 in PROJECT.md still carry it; removing it is a roadmap-level change to make with `/gsd-phase`, not a Phase 3 decision. Core purity stays because it is already enforced and costs nothing.
- **Vagueness-term lint** (`appropriate`, `reasonable`, `etc`) from PITFALLS §9 — after pilot data.
- **Vietnamese EARS keywords** and **named system subject** — rejected for v0.1 (D-62, D-63); revisit if BAs ask.
- **`--strict` promoting warnings to errors** — not in v0.1 (D-56).
- **Suppression comment (`<!-- accord-ignore -->`)** for the token rule — not until the rule proves noisy.
- **Token rule as error** — GATE-12 (v2). **Tailwind v3 JS config as a token source** — never evaluated; export a CSS file instead (PITFALLS §13).
- **Lint on heading order beyond D-70** — rejected (D-07).

### Reviewed Todos (not folded)
- `mcp-host-spike.md` — not folded. Owner indicates the MCP server is no longer needed; close the todo when Phase 8 is removed from the roadmap.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-04 | Rules are data (id, gate, level, appliesTo, profile); the build/maintain matrix is one table | Rule table shape and the full rule catalogue (Architecture Pattern 1, "Rule catalogue") |
| CORE-05 | Every finding carries file, line, rule id, and reason; one result object renders to text and JSON | `Finding` + `level`, `LintResult`, `renderText` line shape, identity test (Pattern 4) |
| LINT-01 | Frontmatter schema errors with path and line | Already produced by the loader (`schema.*` findings with `pointer` and D-33 line, verified in `frontmatter-errors` golden); lint surfaces them stamped `error` (D-58); `schema.if` dedupe recommendation |
| LINT-02 | EARS classifier over the six Mavin templates; unclassifiable lines warn | Classifier algorithm, diagnosis strings, verified code (section "EARS classifier") |
| LINT-03 | Gherkin rules: parse error, missing or duplicate `@ac-n`, empty step, at least one scenario on code-touching tickets | `load.gherkin-parse` surfaced; `lint.ac-tag-*`, `lint.step-empty` (dialect-agnostic detection, verified), `lint.no-scenarios` |
| LINT-04 | Prototype design-token rule on `prototype.html`, warning-only | Property lists, exemption list, token extraction incl. Tailwind v4 `@theme`, three surfaces, offset-to-line attribution, verified code (section "Token rule") |
| LINT-05 | Orphaned tick warning when `verified` names a tag with no scenario | `lint.tick-orphan` with pointer `/verified/<i>` |
| LINT-06 | TODO sentinel, unchecked open question, unconfirmed assumption | `lint.sentinel` (word, placeholder, and `TICKET-ID` forms), `lint.open-question`, `lint.assumption-unconfirmed` |
| LINT-07 | Size warnings: intent > 5 lines, > 15 EARS lines, > 5 scenarios | Three `lint.*-oversize` rules over existing model fields |
| LINT-08 | Plan steps carry `@ac-n`; set difference named per side | `lint.plan-step-untagged`, `lint.plan-tags-differ`, `lint.plan-empty` over `## Plan` list items |
| FMT-09 | `@test:<id>` on non-`@ui` scenarios | Tag parsing verified on the installed parser; id formation per runner; `lint.test-tag-*` |
| FMT-10 | `## Verification notes` last, `### @ac-n` blocks | `lint.note-orphan`, `lint.notes-not-last`; block detection over `Section.lines` |
| FMT-11 | `tests.report` in `config.yml`; host adds the file; core scans it without XML | Schema edit (and the test that pins the key list), CLI loader change, `load/junit.ts` scanner verified against vitest, jest-junit, pytest, and Go shapes |
</phase_requirements>

## Summary

Phase 3 is almost entirely composition over Phase 2. `RepoSnapshot` already carries every field the rules need: `ticket.requirements` (EARS lines with Markdown line numbers), `ticket.scenarios` (tags, `acTag`, steps, line), `ticket.sections` (raw lines per `##` heading), `verifications`, `tree`, `config`, and `errors` (every `load.*` and `schema.*` finding with `file`, `line`, `pointer`). Only three new inputs enter the model: `snapshot.files` (prototype, tokens, report text), `snapshot.tests` (the scanned report), and `config.tests`. Every other rule is a small pure function over existing fields, so the phase's risk is concentrated in three algorithms, all of which were written and run against sample inputs this session: the EARS classifier (six patterns plus the `LOGIN-1` and `EPIC-1` fixture lines classify, ten diagnosis shapes fire), the JUnit scanner (vitest, pytest, gotestsum, jest-junit shapes including CRLF, multi-line attributes, `&gt;` entities, CDATA bodies containing fake tags, self-closing and empty test cases, duplicate ids), and the token scanner (`<style>` with a declaration split across lines, `style=""` in both quote styles, Tailwind arbitrary values with variants and opacity modifiers, `@theme` extraction with wildcard resets).

Two facts the planner must not miss. First, ROADMAP success criterion 7 (vague-wording warning) and the matching paragraph in `docs/design.md` §5 were added on 2026-09-14 by quick task 260914-dd3, one day after CONTEXT.md was gathered; CONTEXT.md's deferral covers a different word list (`appropriate`, `reasonable`, `etc` from PITFALLS §9), so criterion 7 is in scope as one more warning rule, `lint.vague-wording`. Second, `snapshot.files` must hold normalised text (BOM stripped, CRLF to LF), not raw bytes, or the existing five-variant golden test breaks the moment a prototype enters a fixture.

No package is installed in this phase. The XML, CSS, and Tailwind surfaces are handled by anchored regular expressions over normalised text with an offset-to-line table, matching STACK Decision 4's precedent.

**Primary recommendation:** Build `packages/core/src/lint/` as one rule table whose engine stamps `level`, merges `snapshot.errors`, sorts, and counts; implement the three algorithms exactly as the verified code below; store normalised text in `snapshot.files`; form `@test:` ids as `norm(classname)#norm(name)` with whitespace runs collapsed to `-`.

## Scope Note: Success Criterion 7 Post-dates CONTEXT.md

| Source | Date | Says |
|--------|------|------|
| `03-CONTEXT.md` Deferred Ideas | 2026-09-13 | "Vagueness-term lint (`appropriate`, `reasonable`, `etc`) from PITFALLS §9 — after pilot data" [VERIFIED: .planning/phases/03-lint/03-CONTEXT.md:147] |
| `.planning/ROADMAP.md` Phase 3 criterion 7 | 2026-09-14 (uncommitted, quick 260914-dd3) | Vague wording ("depends", "maybe", "probably", "mix of", "somewhere between", "not sure", "TBD") in `## Requirements`, `## Acceptance criteria`, or an answered `## Open questions` item warns with its line number and never errors [VERIFIED: git diff of .planning/ROADMAP.md, line "+  7. Vague wording ..."] |
| `docs/design.md` §5 | 2026-09-14 | "Lint also warns, and only warns, on vague wording in `## Requirements`, `## Acceptance criteria`, and answered `## Open questions` ... The words are a regex with false positives, so the finding never blocks Ready" [VERIFIED: docs/design.md §5, paragraph after the `ui: false` line; decisions log row dated 2026-09-14] |

**Recommendation:** treat criterion 7 as in scope. The two word lists differ, so no locked decision is contradicted. Add `lint.vague-wording` (warning) with exactly the seven phrases, case-insensitive, matched as whole words or phrases, over (a) `ticket.requirements` lines, (b) every comment-stripped line of the `Acceptance criteria` section (fence content included, since the scenarios are the AC), and (c) `- [x]` items under `Open questions`. One finding per line per rule. `TBD` will also trigger `lint.sentinel` when uppercase; accept the double report rather than add cross-rule dedupe (see Open Questions).

## Project Constraints (from CLAUDE.md)

| Directive | Effect on this phase |
|-----------|----------------------|
| Core is isomorphic: no `node:*` or bare built-in imports in `packages/core/src` (ESLint layer A and `types: []` tsconfig) [VERIFIED: eslint.config.js lines 5-9, 21-30; packages/core/tsconfig.json] | `lint/` and `load/junit.ts` use only string, RegExp, and array operations; the offset-to-line table is five lines of code, not `node:` anything |
| Only `src/validate/ajv.ts` may import ajv [VERIFIED: eslint.config.js lines 31-41] | lint never re-validates (D-58); the `schema.if` dedupe happens on the finding list, not by touching ajv |
| Nothing accord ships names another tool, plugin, harness, or planning system (README, design docs, templates, schemas, skill text) | Keep test-runner and agent-harness names out of `reason` strings, template text, and schema descriptions. `docs/design.md` already names CSS frameworks and BDD runners as user-side tooling, so a code comment naming a runner when explaining an id shape is consistent with the existing docs; user-visible strings should still say "the report" and "the tokens file" |
| Cross-platform: forward slashes in every stored or printed path; no `\` in `Finding.file` | Prototype keys come from `snapshot.files` (already normalised by `normaliseKey`); `Derived from:` paths are normalised before the `tree` lookup |
| No `git commit` until the owner approves | Plans end with the working tree dirty; `commit_docs: true` in config still does not override this project rule |
| No auto-fixing production code during audits; uncertain business logic is a finding for the owner | The Open Questions section lists every policy choice that is not covered by a locked decision |
| Simplicity first; propose before adding a dependency or a layer | Zero new packages; one new folder (`lint/`) plus one loader file (`load/junit.ts`) |
| Technology stack section: vitest 5 goldens via `toMatchFileSnapshot`, `pool: 'forks'`, path invariant test | Lint goldens follow the same `stableJson` + `toMatchFileSnapshot` pattern as `snapshot.test.ts` |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rule evaluation (`lintSnapshot`) | Core library (pure) | — | Same answer on CLI, CI, and any host; testable with fixtures only (ARCHITECTURE Anti-Pattern 1) |
| Reading `prototype.html`, tokens file, JUnit report from disk | CLI host (`packages/cli/src/load/fs.ts`) | MCP host (Phase 8, if kept) | Only hosts touch a filesystem; core receives text in `SnapshotInput.files` (D-28, D-30) |
| Normalising and storing raw file text (`snapshot.files`) | Core loader (`load/snapshot.ts`) | — | Goldens must be encoding-independent (D-38, D-54) |
| Scanning the JUnit report into `snapshot.tests` | Core loader (`load/junit.ts`) | — | It is input shaping, like Gherkin extraction; Phase 4 joins against it |
| Text rendering (`renderText`) | Core (`lint/render.ts`) | CLI adds colour with `styleText` (Phase 5) | D-60: identical content in both hosts |
| Exit code from `errors > 0` | CLI (Phase 5) | — | Core never exits or prints (ARCHITECTURE integration table) |
| Level/profile matrix | Core rule table | Phase 4 gate table reuses the shape | CORE-04: readable off the code |

## Standard Stack

### Core

No package is added. Everything below is already installed and verified by reading `packages/core/package.json` this session.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@cucumber/gherkin` | 42.0.1 [VERIFIED: packages/core/package.json:13 `"@cucumber/gherkin": "42.0.1"`; `node -e` printed `42.0.1`] | Already parses the AC fences; tag strings such as `@test:auth.spec.ts#rejects-bad-password` parse as one tag with no loader change [VERIFIED: probe run 2026-09-14 printed `["@ac-1","@test:auth.spec.ts#rejects-bad-password","@ui"]`] | Existing dependency |
| `yaml` | 2.9.0 [VERIFIED: packages/core/package.json:13] | No new use in lint; config parsing already done by the loader | Existing dependency |
| `ajv` | 8.20.0 [VERIFIED: packages/core/package.json:13] | Validates the extended `config.schema.json` (`tests.report`) through the existing seam | Existing dependency |
| ECMAScript `RegExp`, `String`, `Array` | Node 22.12+ target (`es2022`) [VERIFIED: tsconfig.base.json `"target": "es2022"`] | All three scanners; `String.prototype.matchAll` with `d`-less indices via `match.index` | Zero-dependency, isomorphic |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 5.0.0 [VERIFIED: package.json devDependencies] | Lint goldens and unit tests | Always; `npm test -- --project core <stem>` |
| tsdown | 0.23.0 | Bundles `src/index.ts`; the new `lint/` folder needs no config change because it is reached from `index.ts` [VERIFIED: packages/core/tsdown.config.ts `entry: { index: 'src/index.ts' }`] | `npm run build` before `bundle.test.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Regex scanner over `<testcase>` | `fast-xml-parser`, `sax` | A dependency for three attributes and three child names; D-72 forbids it |
| Regex over `<style>` / `style=""` | `postcss`, `css-tree` | A CSS AST for declarations the prototype template keeps trivial; PITFALLS §13 and D-66 chose the scanner |
| Embedded named-colour list | Skip named colours | `color: white` would pass silently; the list is a constant, not a dependency |
| Own offset-to-line table | `yaml`'s `LineCounter` | `LineCounter` is exported by `yaml` and would work, but importing a YAML utility into a CSS/HTML scanner reads oddly; the table is five lines |

**Installation:** none.

**Version verification:** performed by reading the manifests (no registry call is needed because nothing new is installed). `node --version` is v24.14.0, `npm --version` is 11.9.0, `git --version` is 2.55.0.windows.2 [VERIFIED: shell output 2026-09-14].

## Package Legitimacy Audit

No external package is installed in this phase. The Package Legitimacy Gate was therefore not run.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 SnapshotInput { files, tree }                       (host: CLI fs.ts today; reads accord/**, design.tokens, tests.report)
        │
        ▼
 loadSnapshot ──► config.yml ─► validate('config') ─► config (+ tests?)           ─┐
        │         tickets/*.md ─► frontmatter ─► scan ─► requirements, scenarios   │ existing (Phase 2)
        │         tickets/<id>/verification.md ─► blocks                            │
        │         [NEW] files: prototype.html*, tokens file, report  (normaliseText) │ D-65
        │         [NEW] tests: scanJUnit(files[config.tests.report])                │ D-72
        ▼                                                                           ┘
 RepoSnapshot { config, tickets, verifications, tree, errors, files, tests }
        │
        ▼
 lintSnapshot ──► for rule of RULES (data: id, level, profiles, check)
        │            ├─ ticket rules   (frontmatter, headings, EARS, gherkin tags, hygiene, sizes, plan, notes)
        │            ├─ snapshot rules (tokens-missing, report-missing)
        │            └─ prototype rules (token-hardcoded, prototype-derivation)  over snapshot.files
        │         stamp level from the table ─► merge snapshot.errors as level 'error' (drop schema.if)
        │         sort: file, line (absent first), rule, reason ─► count errors / warnings
        ▼
 LintResult { findings, errors, warnings }
        │
        ├──► JSON.stringify(result)          (CLI --json, Phase 5)
        └──► renderText(result)  "file:line: level rule reason" … "N errors, M warnings"  (CLI colours it, Phase 5)
```

### Recommended Project Structure

```
packages/core/src/
├── model/
│   ├── finding.ts          # + level: 'error' | 'warning' (D-56); Level type
│   └── snapshot.ts         # + files, tests on RepoSnapshot; + tests?: { report } on AccordConfig (D-65, D-72)
├── load/
│   ├── snapshot.ts         # + copy prototype/tokens/report into files (normalised); + tests = scanJUnit(...)
│   └── junit.ts            # scanJUnit(text) → Record<string, TestStatus>   (D-72, no XML dependency)
├── lint/
│   ├── index.ts            # lintSnapshot(snapshot) → LintResult: run table, stamp level, merge, sort, count (D-57, D-58)
│   ├── rules.ts            # RULES: Rule[] — the one table with id, level, profiles, check (CORE-04)
│   ├── ears.ts             # classifyEars(text) → { pattern } | { reason }  (D-61..D-64)
│   ├── ticket.ts           # frontmatter, headings, hygiene, vague wording, sizes, plan, notes rules
│   ├── gherkin.ts          # ac-tag-*, step-empty, no-scenarios, test-tag-*, test-id-unknown
│   ├── tokens.ts           # tokenNames(css), scanPrototype(html, known), derivedFrom(html)  (D-66..D-68)
│   └── render.ts           # renderText(result)  (D-60) — one function, so one file rather than a folder
└── index.ts                # + lintSnapshot, renderText, LintResult, Level
packages/core/schemas/config.schema.json   # + optional tests: { report }
packages/cli/src/load/fs.ts                # read tests.report like design.tokens (containment reused)
```

CONTEXT.md's discretion note suggests a `render/` folder; one renderer function does not justify a folder, so `lint/render.ts` is recommended. Either satisfies D-60.

### Pattern 1: Rule table with the engine stamping `level`

**What:** Rules are plain objects; `check` returns findings without `level`; the engine adds `level` from the table so the matrix lives in exactly one place. `profiles` is the CORE-04 profile dimension; in v0.1 every rule lists both profiles (D-57).
**When to use:** Every lint rule; Phase 4 reuses the shape with a `gate` column.

```typescript
// packages/core/src/lint/rules.ts — shape verified against ARCHITECTURE.md Pattern 1 and D-57 [VERIFIED: .planning/research/ARCHITECTURE.md:125-160]
import type { Finding } from '../model/finding.js';
import type { RepoSnapshot } from '../model/snapshot.js';

export type Level = 'error' | 'warning';
export type Draft = Omit<Finding, 'level'>;

export interface Rule {
  id: `lint.${string}`;                 // D-59
  level: Level;                         // D-56
  profiles: readonly ('build' | 'maintain')[]; // D-57: both, for every rule in v0.1
  check: (snapshot: RepoSnapshot) => Draft[];  // pure; reads snapshot only
}

/** Run one function per ticket that has usable frontmatter (D-32); rules needing `type` skip the rest. */
export const eachTicket = (snapshot: RepoSnapshot, f: (t: Ticket) => Draft[]): Draft[] =>
  Object.values(snapshot.tickets).flatMap(f);
```

```typescript
// packages/core/src/lint/index.ts
export interface LintResult { findings: Finding[]; errors: number; warnings: number }

export function lintSnapshot(snapshot: RepoSnapshot): LintResult {
  const profile = snapshot.config?.profile ?? 'build';
  const loaded = snapshot.errors
    .filter((f) => f.rule !== 'schema.if')                     // ajv's if/then echo; see Open Questions
    .map((f) => ({ ...f, level: 'error' as const }));           // D-58
  const linted = RULES.filter((r) => r.profiles.includes(profile))
    .flatMap((r) => r.check(snapshot).map((d) => ({ ...d, rule: r.id, level: r.level })));
  const findings = [...loaded, ...linted].sort(byFileLineRule);
  return { findings, errors: count(findings, 'error'), warnings: count(findings, 'warning') };
}

const byFileLineRule = (a: Finding, b: Finding) =>
  a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || a.rule.localeCompare(b.rule)
  || a.reason.localeCompare(b.reason) || (a.pointer ?? '').localeCompare(b.pointer ?? '');
```

Use a plain code-point comparison (`a < b ? -1 : a > b ? 1 : 0`) rather than `localeCompare` if the golden must be byte-identical across locales; `localeCompare` without a locale argument is host-dependent [ASSUMED: safer default; the Phase 2 goldens sort keys with `Object.keys().sort()`, which is code-point order].

### Pattern 2: Rules read the model, never re-scan text

Every body rule reads `ticket.sections` (`Section.lines` carry Markdown line numbers), `ticket.requirements`, and `ticket.scenarios`. The helpers already exported from `load/sections.ts` are the only text utilities a rule needs [VERIFIED: packages/core/src/load/sections.ts:13-15 `headingKey`, :17 `D07_KEYS`, :20-23 `d07Key`, :103-131 `stripHtmlComments`, :133 `LIST_MARKER = /^\s*(?:[-*+]|\d+\.)\s+/`]. `stripHtmlComments(lines)` keeps line numbers, which is what makes D-73's "comments excluded" one call.

Frontmatter-level rules have no line: the loader keeps the typed object only (`Ticket.frontmatter?: TicketFrontmatter`) [VERIFIED: packages/core/src/model/snapshot.ts:47], so `lint.tick-orphan`, `lint.assumption-unconfirmed`, `lint.id-mismatch`, and `lint.tracker-empty` carry a `pointer` and no `line`. D-60's "`:line` omitted when absent" covers them. Reasons must therefore be self-contained (name the tag or the index) because the text line does not print the pointer.

### Pattern 3: Offset-to-line table for multi-line surfaces

`<style>` declarations and JUnit attributes span lines. Scan the whole normalised text with a regex and convert `match.index` to a 1-based line through a precomputed array of line starts (binary search). HTML comments, `<script>` blocks, and CSS comments are blanked with spaces (newlines kept) before matching so offsets stay valid and comment text is never scanned. Verified in the token-scanner probe: a `padding:` on line 9 whose value `12px` sits on line 10 is reported at line 10; a `#123456` inside the header comment is never reported [VERIFIED: probe run 2026-09-14, "Tokens: all scanner checks pass"].

### Pattern 4: One result object, two renderings, one identity test

```typescript
// packages/core/src/lint/render.ts — D-60 shape
export function renderText(r: LintResult): string {
  const lines = r.findings.map((f) => `${f.file}${f.line === undefined ? '' : ':' + f.line}: ${f.level} ${f.rule} ${f.reason}`);
  return [...lines, `${r.errors} errors, ${r.warnings} warnings`].join('\n') + '\n';
}
```

The identity test (success criterion 5) parses each text line back with `/^(.+?)(?::(\d+))?: (error|warning) (\S+) (.*)$/` and asserts equality with `result.findings` on `file`, `line`, `level`, `rule`, `reason`, plus the summary counts. `pointer` is JSON-only by D-60's locked line shape. Keep the plural literal (`1 errors`) unless the owner asks otherwise; a singular special case adds a branch for no consumer.

### Anti-Patterns to Avoid

- **Storing raw text in `snapshot.files`:** the fixture helper derives CRLF, BOM+CRLF, and mixed-ending variants for every file value [VERIFIED: packages/core/test/helpers/fixture.ts:43-45] and asserts byte-identical goldens; raw text makes the golden differ per variant. Store `normaliseText(text)` [VERIFIED: packages/core/src/load/frontmatter.ts:12-14].
- **`\b` word boundaries around EARS keywords:** without the `u` flag, `\b` treats Vietnamese letters as non-word characters, so `\bthe` can match inside `ệthe`. Tokenise on whitespace instead (the verified classifier does).
- **Scanning before stripping comments:** the prototype header comment contains `Rule: use only colours and spacing ...` and template placeholders; ticket guidance comments contain `TODO`-like words and `- [ ]` examples. Strip first, keep line numbers.
- **A basename or fuzzy fallback for `@test:` ids:** "core never guesses" (PROJECT.md Key Decisions). Exact match after one documented normalisation.
- **Re-parsing frontmatter for line numbers:** the loader discarded the YAML document on purpose (D-32); frontmatter lint findings use `pointer`.

## Rule Catalogue

Every rule below is a row in `RULES`. Levels marked "locked" come from CONTEXT.md; "discretion" rows are the recommended choice under the discretion list. Prefix `load.`/`schema.` rows are surfaced, not produced, by lint.

| Rule id | Level | Where the finding lands | Fires when | Source |
|---------|-------|-------------------------|------------|--------|
| `load.*`, `schema.*` (surfaced) | error | as loaded (file, line, pointer) | every `snapshot.errors` entry except `schema.if` | D-58; ids verified: `load.config-missing` [VERIFIED: packages/core/src/load/snapshot.ts:74], `load.verification-orphan` [:100], `load.heading-duplicate` [sections.ts:92], `load.frontmatter-missing` [frontmatter.ts:46], `load.yaml-syntax` [yaml.ts:27], `load.yaml-not-map` [yaml.ts:34], `load.gherkin-parse` [gherkin.ts:95], `load.result-invalid` [verification.ts:36], `schema.<keyword>` [ajv.ts:35] |
| `lint.id-mismatch` | error (discretion) | ticket file, pointer `/id` | `frontmatter.id !== ticket.id` (case-sensitive) | D-34; fixture `frontmatter-errors/MISMATCH.md` has `id: OTHER` [VERIFIED: fixture lines 1-6] |
| `lint.tracker-empty` | warning (discretion) | ticket file, pointer `/tracker` | `tracker` is `{}` | D-22 |
| `lint.heading-missing` | error | ticket file, no line | a required D-07 heading (by `frontmatter.type`) has no section; skip when `frontmatter` is undefined | D-71; keys `intent`, `requirements`, `acceptance criteria`, `open questions`, `plan` [VERIFIED: sections.ts:17] |
| `lint.ears-unclassified` | warning | ticket file, requirement line | `classifyEars(text)` returns a reason | D-61..D-64 |
| `lint.ac-tag-missing` | error (discretion) | scenario line | `acTag === undefined` | LINT-03; `TAGS` fixture scenario "Không thẻ" at line 13 has `tags: []` [VERIFIED: gherkin-shapes golden] |
| `lint.ac-tag-multiple` | error (discretion) | scenario line | more than one tag matches `/^@ac-[1-9][0-9]*$/` [VERIFIED: gherkin.ts:16] | D-46; `TAGS` "Hai thẻ" carries `@ac-1 @ac-2 @smoke` |
| `lint.ac-tag-duplicate` | error (discretion) | line of the second scenario | same `acTag` on two scenarios of one ticket | LINT-03; `TAGS` "Trùng thẻ" repeats `@ac-1` at line 25 |
| `lint.step-empty` | error (discretion) | scenario line; reason names the step index and keyword | a `steps` entry containing no space (keyword only), or `steps.length === 0` | LINT-03; see "Empty steps" below |
| `lint.no-scenarios` | error (discretion) | AC heading line, else ticket file | `type` is `story` or `bug` and `scenarios.length === 0` | LINT-03; fires alongside `load.gherkin-parse` on `PARSE-ERROR` (see Open Questions) |
| `lint.test-tag-missing` | warning | scenario line | no `@ui` tag and no tag starting `@test:` | D-69 |
| `lint.test-tag-duplicate` | error | scenario line | two or more `@test:` tags | D-69 |
| `lint.test-tag-on-ui` | warning | scenario line | `@ui` present and any `@test:` | D-69 |
| `lint.test-id-unknown` | warning | scenario line | `snapshot.tests` is present (report loaded) and the id after `@test:` is not a key | D-72 |
| `lint.report-missing` | warning | `accord/config.yml`, pointer `/tests/report` | `config.tests?.report` set and the key is absent from `snapshot.files` | D-72 |
| `lint.tick-orphan` | warning | ticket file, pointer `/verified/<i>` | `verified[i]` not in `scenarios.map(s => s.acTag)` | LINT-05 |
| `lint.note-orphan` | warning | the `### @ac-n` line | a block under `Verification notes` whose tag matches no scenario | D-70 |
| `lint.notes-not-last` | warning | the section heading line | `Verification notes` section exists and is not `sections.at(-1)` | D-70 |
| `lint.sentinel` | warning | body line | `TODO`/`TBD`/`FIXME` uppercase whole word outside HTML comments (fences included); a Gherkin step whose text is only `...`; `<placeholder text>`; the literal `TICKET-ID` | D-73 |
| `lint.open-question` | warning | item line | `- [ ]` item under `Open questions` after comment stripping | D-73 |
| `lint.assumption-unconfirmed` | warning | ticket file, pointer `/assumptions/<i>/confirmed` | `assumptions[i].confirmed === false` | D-73 |
| `lint.vague-wording` | warning | body line | one of the seven phrases in a requirement line, an AC-section line, or a `- [x]` open-questions item | ROADMAP criterion 7, design.md §5 (2026-09-14) |
| `lint.intent-oversize` | warning | `Intent` heading line | more than 5 non-blank comment-stripped lines under `Intent` | LINT-07 (applies to epics) |
| `lint.requirements-oversize` | warning | `Requirements` heading line | `requirements.length > 15` | LINT-07 (applies to epics) |
| `lint.scenarios-oversize` | warning | `Acceptance criteria` heading line | `scenarios.length > 5` | LINT-07 |
| `lint.plan-step-untagged` | warning | item line | a `Plan` list item with no `@ac-n` | D-74; story/bug only |
| `lint.plan-tags-differ` | warning | `Plan` heading line | plan tag set ≠ scenario tag set; reason `plan lacks @ac-2; scenarios lack @ac-9` | D-74 |
| `lint.plan-empty` | warning | `Plan` heading line | `scenarios.length > 0` and zero list items; only when the section exists (a missing section is `lint.heading-missing`) | D-74 |
| `lint.token-hardcoded` | warning | prototype file, line of the offending token | literal colour or spacing, or `var(--x)` with `--x` not in the tokens file, on a listed property or utility | D-66, D-68 |
| `lint.tokens-missing` | warning | `accord/config.yml`, pointer `/design/tokens` | `design.tokens` non-empty and the key absent from `snapshot.files` | D-67; token check skipped for the snapshot |
| `lint.prototype-derivation` | warning | prototype file, `Derived from:` line or line 1 | `design.tokens` empty and the header lacks a `Derived from:` path, or a listed path is not in `snapshot.tree` | D-67 |

Snapshot-wide facts the rules rely on: `RepoSnapshot` today is `{ config?, tickets, verifications, tree, errors }` [VERIFIED: packages/core/src/model/snapshot.ts:83-89, verbatim: `config?: AccordConfig; tickets: Record<string, Ticket>; verifications: Record<string, Verification>; tree: string[]; errors: Finding[];`]; `Finding` today is `{ file: string; line?: number; rule: string; reason: string; pointer?: string }` [VERIFIED: packages/core/src/model/finding.ts:2-8]; `ScenarioRef` is `{ name, keyword: 'Scenario' | 'Scenario Outline', line, tags: string[], acTag?: string, steps: string[] }` [VERIFIED: snapshot.ts:21-28]; `AccordConfig` is `{ accord, profile: 'build' | 'maintain', tracker: { adapter: 'none' | 'github-issues'; repo? }, design: { tokens: string }, roles, runtimes }` [VERIFIED: snapshot.ts:74-81].

### Empty steps (LINT-03) — verified parser behaviour

The parser silently accepts a keyword with no text and silently drops a keyword without its trailing space [VERIFIED: probe run 2026-09-14]:

```
trailing space : [ '["Given ",""]', '["When ","x"]' ]   ← empty step kept
no space       : [ '["When ","x"]' ]                    ← "Given" line became description text and vanished
bullet         : [ '["* ",""]' ]
vi Cho alone   : [ '["Cho ",""]' ]
no steps       : []
```

`stepText` collapses `keyword + text`, so an empty step is exactly a `steps` entry with no whitespace (`"Given"`, `"Cho"`, `"*"`) [VERIFIED: packages/core/src/load/gherkin.ts:23-28 builds `collapse(parts.join(' '))` from `[step.keyword.trim(), step.text]`]. That test is dialect-agnostic and needs no keyword list. A scenario whose `steps` is empty is the degenerate case; report it under the same rule id with reason `scenario has no steps`. Steps carry no line of their own, so the finding sits on `ScenarioRef.line` and the reason names the step position.

The placeholder step `Given ...` from the template [VERIFIED: packages/core/templates/ticket-build.md:41-43] is the `steps` entry `"Given ..."`: match `/^\S+ \.\.\.$/` for D-73's "step whose text is only `...`".

## EARS Classifier (D-61 to D-64)

### Grammar

Mavin's generic form is "While <optional precondition>, when <optional trigger>, the <system name> shall <system response>" with zero-or-many preconditions, zero-or-one trigger, one system, one-or-many responses; the six patterns are ubiquitous (no keyword), state-driven (`While`), event-driven (`When`), optional feature (`Where`), unwanted behaviour (`If ..., then`), and complex (combinations) [CITED: https://alistairmavin.com/ears/].

Decisions applied: subject is the literal `the system shall` (D-62); keywords English, content any language (D-63); case-insensitive and whitespace-collapsed (D-61); `should`/`must`/`will` do not match (D-61).

Algorithm (each step deterministic, no heuristics):

1. Remove commas, semicolons, and full stops that end a token; collapse whitespace; split on spaces; compare upper-cased tokens.
2. Locate the token triple `THE SYSTEM SHALL`. Absent: if `THE SYSTEM <should|must|will|can|may>` is present, diagnose the verb; else diagnose "has <first keyword> but no 'the system shall'" or "no EARS keyword and no 'the system shall'".
3. Nothing after the triple: "no response after it". Nothing before it: `ubiquitous`.
4. The prefix must start with a keyword (else "starts with prose and no keyword"). Split the prefix into clauses at each keyword; a keyword twice is a diagnosis; a clause with zero words is a diagnosis naming the missing part (state / trigger / condition / feature).
5. `IF` requires `THEN` as the last keyword before the subject; `THEN` without `IF` is a diagnosis.
6. One clause: the pattern of that keyword. Two or more: `complex`.

Ordering of `WHILE` / `WHEN` / `WHERE` clauses is not enforced; Mavin's complex examples put `While` before `When`, but PITFALLS §9 warns that a linter demanding a fixed order makes BAs "rewrite requirements into unnatural forms" [VERIFIED: .planning/research/PITFALLS.md "Pitfall 9"]. Treat the order-agnostic choice as `[ASSUMED]` policy (A1).

### Diagnosis strings (D-64)

| Situation | Reason text |
|-----------|-------------|
| keyword present, subject absent | `has WHEN but no 'the system shall'` (first keyword found) |
| no keyword, no subject | `no EARS keyword and no 'the system shall'` |
| wrong verb | `has 'the system must' but the verb must be 'shall'` |
| nothing after the subject | `has 'the system shall' but no response after it` |
| prose before the first keyword | `has 'the system shall' but the line starts with prose and no keyword` |
| keyword repeated | `has WHEN twice` |
| clause empty | `has WHEN but no trigger before 'the system shall'` (WHILE: state, IF: condition, WHERE: feature) |
| `IF` without `THEN` | `has IF but no THEN before 'the system shall'` |
| `THEN` without `IF` | `has THEN but no IF` |
| `THEN` not last | `THEN must come last before 'the system shall'` |

### Verified code

```typescript
// Source: probe run 2026-09-14 (scratchpad/probe.mjs); 11 positive and 9 negative assertions passed,
// including the LOGIN-1 and EPIC-1 fixture lines. Port to TypeScript verbatim.
const KEYWORDS = ['WHILE', 'WHEN', 'IF', 'THEN', 'WHERE'];
const tokens = (line: string) =>
  line.replace(/[,;.]+(\s|$)/g, ' ').replace(/\s+/g, ' ').trim().split(' ');

export function classifyEars(text: string): { pattern: string } | { reason: string } {
  const t = tokens(text);
  const up = t.map((w) => w.toUpperCase());
  let subj = -1;
  for (let i = 0; i + 2 < up.length; i++) if (up[i] === 'THE' && up[i + 1] === 'SYSTEM' && up[i + 2] === 'SHALL') { subj = i; break; }
  const kw = up.find((w) => KEYWORDS.includes(w));
  if (subj < 0) {
    for (let i = 0; i + 2 < up.length; i++) {
      if (up[i] === 'THE' && up[i + 1] === 'SYSTEM' && ['SHOULD', 'MUST', 'WILL', 'CAN', 'MAY'].includes(up[i + 2])) {
        return { reason: `has 'the system ${t[i + 2]}' but the verb must be 'shall'` };
      }
    }
    return { reason: kw ? `has ${kw} but no 'the system shall'` : `no EARS keyword and no 'the system shall'` };
  }
  if (subj + 3 >= up.length) return { reason: "has 'the system shall' but no response after it" };
  const pre = up.slice(0, subj);
  if (pre.length === 0) return { pattern: 'ubiquitous' };
  if (!KEYWORDS.includes(pre[0])) return { reason: "has 'the system shall' but the line starts with prose and no keyword" };
  const clauses: { kw: string; words: number }[] = [];
  for (const w of pre) {
    if (KEYWORDS.includes(w)) {
      if (clauses.some((c) => c.kw === w)) return { reason: `has ${w} twice` };
      clauses.push({ kw: w, words: 0 });
    } else clauses[clauses.length - 1].words++;
  }
  const part: Record<string, string> = { WHILE: 'state', WHEN: 'trigger', IF: 'condition', WHERE: 'feature' };
  const names: Record<string, string> = { WHILE: 'state-driven', WHEN: 'event-driven', IF: 'unwanted-behaviour', WHERE: 'optional-feature' };
  for (const c of clauses) if (c.kw !== 'THEN' && c.words === 0) return { reason: `has ${c.kw} but no ${part[c.kw]} before 'the system shall'` };
  const hasIf = clauses.some((c) => c.kw === 'IF'), hasThen = clauses.some((c) => c.kw === 'THEN');
  if (hasIf && !hasThen) return { reason: "has IF but no THEN before 'the system shall'" };
  if (hasThen && !hasIf) return { reason: 'has THEN but no IF' };
  if (hasThen && clauses[clauses.length - 1].kw !== 'THEN') return { reason: "THEN must come last before 'the system shall'" };
  const main = clauses.filter((c) => c.kw !== 'THEN');
  return { pattern: main.length === 1 ? names[main[0].kw] : 'complex' };
}
```

Lines proven to classify (no finding): `The system shall log every request.` (ubiquitous); `WHEN the user submits the form, the system SHALL save the data` (event-driven); `While the aircraft is on ground, the system shall disable reverse thrust` (state-driven); `IF the password is wrong THEN the system SHALL show an error` (unwanted-behaviour); `Where the premium feature is enabled, the system shall show the export button` (optional-feature); `While the user is signed in, when the session expires, the system shall redirect to login` (complex); the three fixture lines from `valid-build` [VERIFIED: probe run 2026-09-14].

## Token Rule (D-66 to D-68)

### Token extraction from the tokens file

Tailwind v4 declares design tokens as CSS custom properties inside `@theme { }`; every theme variable is also emitted as a regular CSS variable on `:root`, so `var(--color-primary)` is valid at runtime [CITED: https://github.com/tailwindlabs/tailwindcss.com/blob/main/src/docs/theme.mdx via Context7]. Namespaces relevant here are `--color-*` (all colour utilities such as `bg-red-500`, `text-sky-300`) and `--spacing-*` (spacing and sizing utilities such as `px-4`) [CITED: same page, namespace table]. `@theme inline` and `@theme static` change emission, not names [CITED: theme.mdx, colors.mdx]. `--*: initial` or `--color-*: initial` resets a namespace and declares nothing [CITED: tailwindcss-v4-alpha blog via Context7]. Spacing utilities are derived from the single `--spacing` base (`.mt-8 { margin-top: calc(var(--spacing) * 8) }`) [CITED: tailwindcss-v4 blog via Context7].

Extraction rule (works for plain `:root { --x: ... }`, `@theme`, `@theme inline`, `[data-theme]` blocks alike): every `--name` immediately followed by `:` at any nesting, after CSS comments are removed; skip names containing `*` and values equal to `initial`.

```typescript
// Source: probe run 2026-09-14 — extracted exactly ['--acme-canvas','--color-canvas','--color-primary','--spacing']
// from a file mixing @theme, @theme inline, :root, [data-theme], --*: initial, and a commented-out token.
export function tokenNames(css: string): Set<string> {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const names = new Set<string>();
  for (const m of text.matchAll(/(?:^|[\s;{])(--[A-Za-z0-9_-]+)\s*:\s*([^;}]*)/g)) {
    if (m[1].includes('*') || m[2].trim() === 'initial') continue;
    names.add(m[1]);
  }
  return names;
}
```

Known limitation: a project that keeps Tailwind's default theme (no `--*: initial`) has tokens like `--color-red-500` that live in the framework's own stylesheet, not in the project's tokens file; a prototype writing `var(--color-red-500)` gets `lint.token-hardcoded` "unknown token". Warning-only in v0.1; the fix on the user side is to declare the tokens the prototype may use in the tokens file (see Open Questions).

### Property lists

Colour properties (declaration surfaces) `[ASSUMED list; each property exists per MDN]`: `color`, `background`, `background-color`, `background-image`, `border`, `border-color`, `border-top`, `border-right`, `border-bottom`, `border-left`, `border-top-color`, `border-right-color`, `border-bottom-color`, `border-left-color`, `border-block`, `border-inline`, `border-block-color`, `border-inline-color`, `outline`, `outline-color`, `fill`, `stroke`, `text-decoration`, `text-decoration-color`, `caret-color`, `accent-color`, `box-shadow`, `text-shadow`, `column-rule`, `column-rule-color`.

Spacing properties `[ASSUMED list]`: `margin` and its `-top/-right/-bottom/-left/-block/-inline/-block-start/-block-end/-inline-start/-inline-end` longhands, `padding` and the same longhands, `gap`, `row-gap`, `column-gap`, `inset` and its logical longhands, `top`, `right`, `bottom`, `left`.

Deliberately excluded: `width`, `height`, `font-size`, `line-height`, `border-radius`, `border-width` (sizing and typography are not "spacing"; a `2px` border width on a colour property is ignored because only colour literals count there). This mirrors the reference tool's approach of listing properties by name or `/color$/` regex with variables and functions ignored by default [CITED: https://github.com/AndyOGo/stylelint-declaration-strict-value].

### Value classification

- `var(--name[, fallback])`: `--name` must be in the token set; the fallback is blanked and never scanned (PITFALLS §13 names hex fallbacks as a false-positive source).
- Exemptions, case-insensitive: `transparent`, `currentColor`, `inherit`, `0`, `1px`, `100%` (the locked starting set). No additions are needed: keywords such as `solid`, `auto`, `none`, `initial`, `unset` are neither colour nor length literals and pass by construction.
- Colour literal: `#rgb` to `#rrggbbaa`; a call to `rgb`, `rgba`, `hsl`, `hsla`, `hwb`, `lab`, `lch`, `oklab`, `oklch`, `color`, `color-mix`, `light-dark`, `device-cmyk`, `contrast-color` [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value]; a CSS named colour (embed the CSS Color Level 4 named-colour table as a constant; `[ASSUMED]` that the full table rather than a subset is wanted); a gradient function containing any of the above.
- Spacing literal (spacing properties only): a number with a length unit from the MDN `<length>` list (`px`, `em`, `rem`, `ex`, `rex`, `cap`, `rcap`, `ch`, `rch`, `ic`, `ric`, `lh`, `rlh`, `vw`, `vh`, `vmin`, `vmax`, `vb`, `vi`, the `sv*`/`lv*`/`dv*` variants, `cqw`, `cqh`, `cqi`, `cqb`, `cqmin`, `cqmax`, `cm`, `mm`, `Q`, `in`, `pt`, `pc`) or `%`, or unitless `0` [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/length].
- Custom-property declarations inside the prototype (`--x: #fff`) are skipped as declarations; any use `var(--x)` is then "unknown token" because `--x` is not in the tokens file, so smuggling literals through local variables is caught at the use site.

### Surfaces and line attribution

1. Normalise (BOM, CRLF). Build the line-start table.
2. Blank HTML comments and `<script>` blocks (keep newlines). Read the `Derived from:` header from the first comment before blanking (D-67).
3. `<style ...> ... </style>` blocks: blank `/* */` comments, then match `prop\s*:\s*value` up to `;`, `{`, or `}`; the finding line is the line of the offending token's offset.
4. `style="..."` and `style='...'` attributes: same declaration matcher over the attribute value.
5. Tailwind arbitrary values: split the text into whitespace/quote-delimited tokens and test each with one anchored regex for `variant:...util-[value]`, `util-(--var)`, and an optional `/NN` opacity modifier. Underscores in the bracket become spaces [CITED: adding-custom-styles.mdx via Context7]; `util-(--var)` is v4's replacement for v3's `util-[--var]` [CITED: upgrade-guide.mdx via Context7]; `/50` is the opacity modifier [CITED: colors.mdx via Context7]. Colour utility prefixes: `bg`, `text`, `border` (+`-t/-r/-b/-l/-x/-y/-s/-e`), `outline`, `ring`, `ring-offset`, `shadow`, `inset-shadow`, `fill`, `stroke`, `accent`, `caret`, `decoration`, `divide`, `placeholder`, `from`, `via`, `to`; spacing prefixes: `p/px/py/pt/pr/pb/pl/ps/pe`, `m/mx/my/mt/mr/mb/ml/ms/me` (negative `-m*` included), `gap/gap-x/gap-y`, `space-x/space-y`, `inset/inset-x/inset-y`, `top/right/bottom/left/start/end` `[ASSUMED lists; the namespace-to-utility mapping is CITED]`. A `text-[14px]` is font-size and is not flagged because on a colour utility only colour literals count (verified).
6. Arbitrary properties `[color:#fff]` `[ASSUMED syntax]`: treat `[prop:value]` tokens as a declaration; cheap to add, optional.

### Verified code

```typescript
// Source: probe run 2026-09-14. The sample prototype produced exactly these eight findings, in this order:
// 10 padding: hard-coded spacing 12px (declaration split across lines 9-10)
// 11 background: hard-coded colour #fff (the commented-out `border: 1px solid #000` on the same line was ignored)
// 12 border: unknown token var(--nope)
// 17 color: hard-coded colour white (style="" attribute)
// 18 padding: hard-coded spacing 2rem (style='' attribute spanning two lines)
// 16 class bg-[#fff]: hard-coded colour #fff
// 16 class p-[13px]: hard-coded spacing 13px
// 16 class hover:bg-[oklch(60%_0.15_50)]/50: hard-coded colour oklch(60% 0.15 50)
// Not flagged, as intended: var(--color-primary), var(--color-primary, #fff), `1px solid var(--color-primary)`,
// `0 auto`, calc(var(--space-2) * 2), transparent, CurrentColor, mt-[var(--space-2)], bg-(--color-primary),
// text-[14px], w-[13px], the header comment, and the <script> block.
export function offending(prop: string, value: string, known: Set<string>): { token: string; why: string }[] {
  const out: { token: string; why: string }[] = [];
  const stripped = value.replace(/var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,[^)]*)?\)/g, (_, name: string) => {
    if (!known.has(name)) out.push({ token: `var(${name})`, why: 'unknown token' });
    return ' ';
  });
  const kind = COLOR_PROPS.has(prop) ? 'color' : SPACING_PROPS.has(prop) ? 'spacing' : undefined;
  if (!kind) return out;
  const parts: string[] = [];                       // split on whitespace/commas outside parentheses
  let depth = 0, cur = '';
  for (const ch of stripped) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && /[\s,]/.test(ch)) { if (cur) parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) parts.push(cur);
  for (const p of parts) {
    if (EXEMPT.has(p.toLowerCase()) || p === '!important') continue;
    if (isColor(p)) out.push({ token: p, why: 'hard-coded colour' });
    else if (kind === 'spacing' && isLength(p)) out.push({ token: p, why: 'hard-coded spacing' });
    else if (kind === 'color' && /^(?:linear|radial|conic)-gradient\(/i.test(p) && /#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(/i.test(p)) out.push({ token: p, why: 'hard-coded colour' });
  }
  return out;
}

export function scanPrototype(html: string, known: Set<string>): { line: number; reason: string }[] {
  const text = html.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const lineAt = (off: number) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; } return lo + 1; };
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  const body = text.replace(/<!--[\s\S]*?-->/g, blank).replace(/<script\b[\s\S]*?<\/script>/gi, blank);
  const findings: { line: number; reason: string }[] = [];
  const decls = (css: string, base: number) => {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, blank);
    for (const d of clean.matchAll(/([A-Za-z-]+)\s*:\s*([^;{}]+)/g)) {
      const prop = d[1].toLowerCase();
      if (prop.startsWith('--')) continue;
      for (const o of offending(prop, d[2].trim(), known)) {
        const at = base + d.index + d[0].indexOf(o.token.startsWith('var(') ? 'var(' : o.token);
        findings.push({ line: lineAt(at), reason: `${prop}: ${o.why} ${o.token}` });
      }
    }
  };
  for (const s of body.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) decls(s[1], s.index + s[0].indexOf(s[1]));
  for (const a of body.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) decls(a[1] ?? a[2], a.index + a[0].indexOf(a[1] ?? a[2]));
  const CLASS = /^((?:[a-z-]+:)*(-?[a-z][a-z-]*?)-(?:\[([^\]]+)\]|\(([^)]+)\))(?:\/\d+)?)$/;
  for (const tok of body.matchAll(/[^\s"'=<>]+/g)) {           // one anchored regex per token: linear
    const c = CLASS.exec(tok[0]);
    if (!c) continue;
    const util = c[2].replace(/^-/, '');
    const kind = COLOR_UTIL.has(util) ? 'color' : SPACING_UTIL.has(util) ? 'spacing' : undefined;
    if (!kind) continue;
    const value = (c[3] ?? `var(${c[4]})`).replace(/_/g, ' ');
    for (const o of offending(kind === 'color' ? 'color' : 'margin', value, known)) findings.push({ line: lineAt(tok.index), reason: `class ${c[1]}: ${o.why} ${o.token}` });
  }
  return findings;
}
```

Order the findings by line before returning (the probe returns declaration findings before class findings; the engine's sort handles it, but sorting here keeps unit tests readable).

### `Derived from:` header (D-67)

The shipped header is an HTML comment whose third line is `Derived from: <list the stylesheets or token files this prototype was built from, one per line>` [VERIFIED: packages/core/templates/prototype-header.html:1-6]. Parse: take the first `<!-- ... -->` in the file; find the line matching `/^\s*Derived from:\s*(.*)$/i`; collect the remainder of that line and every following comment line until a line matching `/^\s*[A-Za-z][A-Za-z ]*:/` (the next header key such as `Rule:` or `Owner:`) or the comment end; each non-empty entry, with a leading `- ` stripped, backslashes turned to `/`, and a leading `./` removed, is a path; an entry wrapped in `<...>` is the placeholder and counts as none. Each path must be a member of `snapshot.tree` (exact string; `tree` is sorted with forward slashes [VERIFIED: packages/core/src/load/snapshot.ts:65]). `[ASSUMED parsing policy A4]`. Finding at the `Derived from:` line, or line 1 when the line is missing.

## Test Report (D-72, FMT-09, FMT-11)

### How each runner fills `classname` and `name`

| Runner (default reporter settings) | `classname` | `name` | Skipped | Failed |
|---|---|---|---|---|
| vitest `junit` reporter | relative file path (`classnameTemplate` default) | full title with ancestor describes joined by `' > '` (`titleTemplate` default; `>` is written `&gt;`) | self-closing `<skipped/>` for `skip` and `todo` | `<failure message type>` with XML-escaped body, no CDATA | [CITED: https://github.com/vitest-dev/vitest/blob/main/docs/guide/reporters.md via Context7; https://raw.githubusercontent.com/vitest-dev/vitest/main/packages/vitest/src/node/reporters/junit.ts] |
| jest-junit | `{classname} {title}` = describes and title space-joined (same as `name`) | same | `<skipped/>` for pending/todo | `<failure>` with messages as body | [CITED: https://github.com/jest-community/jest-junit README and utils/buildJsonResults.js] |
| pytest (`junit_family` default `xunit2`) | node path with `/` replaced by `.` and `.py` stripped, joined to class names with `.` (`tests.test_auth.TestLogin`) | function name plus parametrize id (`test_bad[1]`); no `file`/`line` attributes under xunit2 | `<skipped type="pytest.skip" message="...">text</skipped>` | `<failure message="...">longrepr</failure>` | [CITED: https://raw.githubusercontent.com/pytest-dev/pytest/main/src/_pytest/junitxml.py] |
| gotestsum `--junitfile` | package import path (`full` default; `short`/`relative` options) | full test name including subtests (`TestParent/Sub`) | `<skipped message="..."/>` | `<failure message="Failed" type="">output</failure>` | [CITED: https://github.com/gotestyourself/gotestsum README and internal/junitxml/report.go] |
| go-junit-report v2 | package name | `TestFoo/bar` | `<skipped message="Skipped">` | `<failure message="Failed">` with CDATA body | [CITED: https://raw.githubusercontent.com/jstemmer/go-junit-report/master/junit/junit.go] |

There is no official JUnit XML specification; the common structure is `testsuites > testsuite > testcase(name, classname, time[, file, line, assertions])` with children `skipped(message)`, `failure(message, type)`, `error(message, type)`, `system-out`, `system-err`; a passing case is self-closing or empty; bodies may be CDATA; the `testsuites` root may be omitted; test suites may nest [CITED: https://github.com/testmoapp/junitxml].

### Id formation (recommendation)

`id = norm(classname) + '#' + norm(name)`, or `norm(name)` alone when `classname` is absent or empty, where `norm` trims and replaces every whitespace run with `-`. Matching is exact and case-sensitive after `norm` on the report side only; the tag is already whitespace-free because a tag containing a space is a Gherkin parse error [VERIFIED: probe run 2026-09-14, `Parser errors:` on `@test:has space`]. All of these parse as single tags on the installed parser [VERIFIED: probe run 2026-09-14]:

```
@test:test/auth.spec.ts#auth->-rejects-bad-password
@test:tests.test_auth.TestLogin#test_bad[1]
@test:github.com/org/repo/pkg#TestLogin/bad_password
```

The reference shape `@test:auth.spec.ts#rejects-bad-password` is what a vitest project emits with a file-name `classnameTemplate` and `titleTemplate: '{title}'`; with the defaults it is `test/auth.spec.ts#auth->-rejects-bad-password`. Neither is guessed by core: the developer copies the id the report contains. `[ASSUMED policy A2: the `#` join and whitespace-to-hyphen rule are the recommended normalisation; no locked decision fixes them]`

Duplicate ids (retries, parametrised repeats, jest-junit's identical classname/name): keep the worst status, `failed` over `skipped` over `passed`, so a muted or flaky rerun never upgrades a result (design.md §5: "a test reported skipped is not passed").

### Scanner (verified)

```typescript
// packages/core/src/load/junit.ts — Source: probe run 2026-09-14; vitest (CRLF, &gt;, multi-line attributes,
// <skipped/>, empty <testcase></testcase>), pytest (self-closing pass, <skipped type>, <error>), gotestsum
// (CDATA containing a fake </testcase>), and jest-junit (single quotes, duplicate ids, name-only) all scanned correctly.
export type TestStatus = 'passed' | 'failed' | 'skipped';
const ENT: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const unescapeXml = (s: string) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (_, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e]);
const attr = (attrs: string, name: string) => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs);
  return m ? unescapeXml(m[1] ?? m[2]) : undefined;
};
const norm = (s: string) => s.trim().replace(/\s+/g, '-');
const RANK: Record<TestStatus, number> = { failed: 2, skipped: 1, passed: 0 };

export function scanJUnit(text: string): Record<string, TestStatus> {
  const xml = text.replace(/^﻿/, '').replace(/\r\n/g, '\n')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const out: Record<string, TestStatus> = {};
  const re = /<testcase\b([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const name = attr(m[1], 'name') ?? '';
    const cls = attr(m[1], 'classname');
    let status: TestStatus = 'passed';
    if (m[2] !== '/') {
      const end = xml.indexOf('</testcase>', re.lastIndex);
      const body = xml.slice(re.lastIndex, end < 0 ? undefined : end);
      if (/<(failure|error)\b/.test(body)) status = 'failed';
      else if (/<skipped\b/.test(body)) status = 'skipped';
      if (end >= 0) re.lastIndex = end;
    }
    const id = cls === undefined || cls === '' ? norm(name) : `${norm(cls)}#${norm(name)}`;
    if (!(id in out) || RANK[status] > RANK[out[id]]) out[id] = status;
  }
  return out;
}
```

`[^>]*` inside `<testcase ...>` is safe because every emitter above escapes `>` in attribute values (vitest writes `&gt;`; pytest's XML writer escapes attributes). Recommend a loader finding `load.report-invalid` (error, on the report file, line 1) when the text contains none of `<testsuites`, `<testsuite`, `<testcase`, so a garbage file yields one finding rather than one `lint.test-id-unknown` per scenario `[ASSUMED policy A3]`.

### Schema and loader changes

- `config.schema.json`: add `"tests": { "type": "object", "additionalProperties": false, "required": ["report"], "properties": { "report": { "type": "string", "minLength": 1 } } }`; `required` stays the six keys; the root already has `"additionalProperties": false` [VERIFIED: packages/core/schemas/config.schema.json:6-7, verbatim `"additionalProperties": false, "required": ["accord", "profile", "tracker", "design", "roles", "runtimes"]`].
- **A Phase 1 test pins the key list:** `expect(Object.keys(configSchema.properties)).toEqual(keys)` with the six keys, and `expect(configSchema.required).toEqual(keys)` [VERIFIED: packages/core/test/schemas.test.ts:127-134]. The properties assertion must become the seven keys; the `required` assertion stays. The same block asserts no key matches `/key|token|secret|password/i`; `tests` passes.
- `AccordConfig` gains `tests?: { report: string }`.
- `loadSnapshot`: after `config` is known, copy into `snapshot.files` every key matching `/^accord\/assets\/([^/]+)\/prototype\.html$/`, plus the normalised `config.design.tokens` and `config.tests.report` keys when present, as `normaliseText(value)`; `snapshot.tests = scanJUnit(files[report])` when the report is present, else the property is absent (so `lint.test-id-unknown` knows "no report" from "empty report").
- CLI `loadFromFs`: generalise `tokensPath` to `containedPath(root, rel)` and read both files; the existing containment logic (`relative(root, abs)` must not be empty, start with `..`, or be absolute) is T-02-20's control and must cover the report too [VERIFIED: packages/cli/src/load/fs.ts:52-60, 62-69].
- `cli/test/load.test.ts:51-68` and `core/test/snapshot.test.ts:64-76` enumerate the exact `valid-build` file and tree lists; adding a prototype or report to that fixture changes both lists.

## Verification Notes and Templates (FMT-10)

`### @ac-n` blocks live inside the `Verification notes` section's `lines` because `scan` attaches `###` lines to the enclosing `##` section [VERIFIED: packages/core/src/load/sections.ts:28-31 doc comment and :66-72]. Detect blocks with `/^###\s+@(ac-[1-9][0-9]*)\b/` over the comment-stripped section lines; the same tag regex the verification loader uses is `BLOCK = /^@(ac-[1-9][0-9]*)\b\s*(.*)$/` [VERIFIED: packages/core/src/load/verification.ts:7]. `lint.notes-not-last` compares the section's index with `sections.length - 1`.

Template additions (discretion): append an empty `## Verification notes` section with a guidance comment to `ticket-build.md` and `ticket-maintain.md`, and add `@test:<id>` guidance to the Gherkin comment; leave `epic.md` unchanged. Consequences the planner must schedule: `npm run gen` regenerates `src/generated/templates.ts` (the drift test fails otherwise) [VERIFIED: packages/core/scripts/gen-templates.mjs; test/templates.test.ts:125-133]; `templates.test.ts:70-75` pins the heading list to the five D-07 headings and must gain `## Verification notes`; `templates.test.ts:77-86` requires build and maintain to differ only inside HTML comments; the write goldens under `test/__golden__/ticket-build.verified-empty.md` are derived from the template and must be regenerated.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Heading lookup, comment stripping, list markers | A second Markdown scanner in `lint/` | `headingKey`, `d07Key`, `stripHtmlComments`, `LIST_MARKER` from `load/sections.ts` | Already fence-aware and line-preserving; two scanners drift |
| BOM/CRLF handling for `files` | Inline `replace` calls per rule | `normaliseText` from `load/frontmatter.ts` | One definition of D-38 |
| `@ac-n` recognition | A new regex | `/^@ac-[1-9][0-9]*$/` (gherkin.ts) and `/^ac-[1-9][0-9]*$/` (ticket.schema.json `verified` items) | Same tag grammar everywhere |
| XML DOM for the report | `fast-xml-parser`, `sax`, `xmldom` | `scanJUnit` above | D-72; three attributes and three child names |
| CSS AST for prototypes | `postcss`, `css-tree` | `scanPrototype` above | D-66 and PITFALLS §13 chose a scanner |
| Tailwind class parsing | A utility-name resolver | Two prefix sets plus one anchored regex | Only arbitrary values are in scope |
| Named colours | Ad-hoc `white|black|red` | The CSS Color Level 4 table as a constant | Deterministic; a partial list lies |
| Line numbers from offsets | `yaml`'s `LineCounter` | A five-line line-start table | No cross-domain import into the CSS/HTML scanner |

**Key insight:** every "parser" this phase needs is a tokenizer over a format accord itself controls (its templates) or that emitters escape conservatively (JUnit attributes); regex scanners are the precedent set by STACK Decision 4 and cost no dependency.

## Runtime State Inventory

Not applicable: this phase renames nothing and migrates no stored data. No collection names, service configuration, OS registrations, secrets, or build artifacts carry a string this phase changes (verified by the scope: new files under `packages/core/src/lint/`, one loader file, one schema key, template text).

## Common Pitfalls

### Pitfall 1: Raw text in `snapshot.files` breaks the five-variant golden
**What goes wrong:** the CRLF and BOM+CRLF variants of a fixture produce a different golden than LF.
**Why it happens:** `variants()` rewrites every file value, including prototype, tokens, and report text [VERIFIED: packages/core/test/helpers/fixture.ts:40-50].
**How to avoid:** store `normaliseText(text)`; scanners then never see `\r`.
**Warning signs:** the "load identically to LF" test fails only for fixtures with a prototype.

### Pitfall 2: `\b` around keywords in Vietnamese prose
**What goes wrong:** `/\bthe system shall\b/i` matches inside words adjacent to non-ASCII letters, or misses them.
**Why it happens:** `\b` is ASCII-only without the `u` flag; `ệ` counts as a non-word character.
**How to avoid:** tokenise on whitespace and compare tokens (the verified classifier).

### Pitfall 3: Comment text scanned as content
**What goes wrong:** the template's guidance comments contain `- [ ]`, `TODO`-like words, `TICKET-ID`, and `<placeholder>` text; the prototype header contains `Rule: use only colours ...` and `<list the stylesheets ...>`.
**How to avoid:** every body rule runs on `stripHtmlComments(section.lines)`; the prototype scanner blanks comments after reading the `Derived from:` header.

### Pitfall 4: `schema.if` doubles every `tracker.repo` error
**What goes wrong:** ajv reports `schema.required` at `/tracker` and `schema.if` ("must match \"then\" schema") at the same pointer [VERIFIED: packages/core/test/__golden__/config.invalid.json entries 2-3].
**How to avoid:** drop `schema.if` at the merge step; the `required` finding is the actionable one. Leave `validate()` and its golden untouched.

### Pitfall 5: Adding `tests` to the config schema without touching the pinning test
**What goes wrong:** `schemas.test.ts` "top-level properties are exactly the six D-16 keys" fails.
**How to avoid:** update the properties expectation to seven keys in the same task as the schema edit; `required` stays six.

### Pitfall 6: vitest and jest-junit ids contain spaces and `>`
**What goes wrong:** a developer pastes `auth > rejects bad password` into a tag and gets `load.gherkin-parse`.
**How to avoid:** document `norm` (whitespace runs become `-`) in the `lint.test-id-unknown` reason: `@test:<id> not found in <report path>; ids are classname#name with spaces as '-'`.

### Pitfall 7: A skipped or retried test upgrading to passed
**What goes wrong:** the last occurrence of a duplicated id wins.
**How to avoid:** rank `failed > skipped > passed` when merging duplicates (verified in the probe).

### Pitfall 8: CDATA bodies containing tags
**What goes wrong:** a Go failure body includes `<testcase name="fake"/>` from the test's own output.
**How to avoid:** blank CDATA sections before matching (verified in the probe).

### Pitfall 9: Rules that need `frontmatter.type` on a ticket without frontmatter
**What goes wrong:** `lint.heading-missing`, `lint.no-scenarios`, and plan rules throw or misreport on `frontmatter === undefined` (schema failure, D-32).
**How to avoid:** skip type-dependent rules when `frontmatter` is undefined; the loader already reported why.

### Pitfall 10: Quadratic class scanning on long attribute runs
**What goes wrong:** an unanchored regex with `[a-z-]*?` over the whole document backtracks per start position.
**How to avoid:** split into tokens first and apply one anchored regex per token (the verified form).

### Pitfall 11: Extending `valid-build` silently breaks two enumerating tests
**What goes wrong:** `snapshot.test.ts:64-73` and `cli/test/load.test.ts:51-68` list the exact tree and file keys.
**How to avoid:** the plan that adds `assets/LOGIN-1/prototype.html` or a report to `valid-build` updates both lists and regenerates the golden with `npm test -- --project core snapshot -u -t "fixture valid-build"`.

### Pitfall 12: Vague-wording and sentinel both firing on `TBD`
**What goes wrong:** one line yields two warnings.
**How to avoid:** accept it (two rules, two ids, both true) or drop `TBD` from the vague list; decide once (Open Questions).

## Code Examples

The three verified algorithms are inline above (EARS, token scanner, JUnit scanner). Two more idioms the rules share:

### Plan step tags (D-74)

```typescript
// list items after comment stripping; tags anywhere in the item; equal sets produce nothing
const AC = /@ac-[1-9][0-9]*/g;
export function planFindings(t: Ticket): Draft[] {
  if (t.frontmatter?.type === 'epic' || t.frontmatter === undefined) return [];
  const plan = t.sections.find((s) => headingKey(s.heading) === 'plan');
  if (!plan) return [];                                  // lint.heading-missing covers the absence
  const items = stripHtmlComments(plan.lines).filter((l) => LIST_MARKER.test(l.text));
  const out: Draft[] = [];
  const planTags = new Set<string>();
  for (const l of items) {
    const tags = l.text.match(AC) ?? [];
    if (tags.length === 0) out.push({ file: t.file, line: l.line, rule: 'lint.plan-step-untagged', reason: 'plan step carries no @ac-n tag' });
    for (const tag of tags) planTags.add(tag);
  }
  const scenarioTags = new Set(t.scenarios.flatMap((s) => (s.acTag ? ['@' + s.acTag] : [])));
  if (items.length === 0 && t.scenarios.length > 0) {
    out.push({ file: t.file, line: plan.line, rule: 'lint.plan-empty', reason: 'ticket has scenarios but ## Plan has no step' });
    return out;
  }
  const missingFromPlan = [...scenarioTags].filter((x) => !planTags.has(x));
  const missingFromScenarios = [...planTags].filter((x) => !scenarioTags.has(x));
  if (missingFromPlan.length || missingFromScenarios.length) {
    out.push({ file: t.file, line: plan.line, rule: 'lint.plan-tags-differ',
      reason: `plan lacks ${missingFromPlan.join(' ') || 'nothing'}; scenarios lack ${missingFromScenarios.join(' ') || 'nothing'}` });
  }
  return out;
}
```

### Sentinels and open questions (D-73)

```typescript
const WORD = /(?:^|[^A-Za-z0-9_])(TODO|TBD|FIXME|TICKET-ID)(?![A-Za-z0-9_])/g;   // uppercase whole words, case-sensitive
const PLACEHOLDER = /<[a-z][a-z]* [^<>="/]+>/g;   // "<observable outcome>", not "<br>", not "<a href="x">", not Outline "<a>"
const OPEN = /^\s*[-*+]\s+\[ \]/;                // unchecked item
const DONE = /^\s*[-*+]\s+\[[xX]\]/;             // answered item (vague-wording scope)
```

Apply `WORD` and `PLACEHOLDER` to every comment-stripped line of every section (fences included per D-73); apply `OPEN` only to the `Open questions` section. The `...` step form is detected on `ScenarioRef.steps` (`/^\S+ \.\.\.$/`) and reported at the scenario line.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 `bg-[--var]` shorthand | v4 `bg-(--var)`; `[--var]` is now an ordinary arbitrary value | Tailwind v4.0 [CITED: upgrade-guide.mdx via Context7] | Scanner accepts `(--x)`; `[--x]` is treated as a literal and passes because it is neither colour nor length |
| Tailwind v3 JS config as the token source | v4 CSS-first `@theme` | Tailwind v4.0 | Tokens are CSS custom properties; no JS evaluation (PITFALLS §13, Deferred) |
| pytest `xunit1` (`file`, `line` attributes) | `xunit2` default | pytest 6 [CITED: junitxml.py default `xunit2`] | Scanner reads only `classname` and `name` |
| ARCHITECTURE draft levels `block | warn | info` | `error | warning` | D-56 (2026-09-13) | Two levels; exit code from `errors > 0` |

**Deprecated/outdated:** the ARCHITECTURE.md `lint/schema.ts` module (schema validation moved into the loader, D-33) and its "nearest pattern suggested" EARS note (rejected by D-64).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `WHILE` / `WHEN` / `WHERE` clauses may appear in any order; only `THEN` must be last | EARS classifier | Lines Mavin would call mis-ordered classify as `complex` instead of warning; low, warning-level rule |
| A2 | `@test:` id is `norm(classname)#norm(name)` with whitespace runs as `-`; `norm(name)` alone when `classname` is empty | Test report | Confirmed by the owner 2026-09-14 (Open Question 5); no longer an assumption |
| A3 | `load.report-invalid` (error) when the report has no `testsuites`/`testsuite`/`testcase` tag | Test report | Without it a garbage report yields one warning per scenario |
| A4 | `Derived from:` path list ends at the next `Key:` line or the comment end; `<...>` counts as no path | Token rule | A header written differently gets `lint.prototype-derivation`; warning-level |
| A5 | Colour and spacing property lists and the Tailwind prefix sets as listed | Token rule | A property or utility outside the list is never flagged (a miss, never a false positive); extend the constant |
| A6 | Full CSS named-colour table embedded as a constant | Token rule | Omitting it lets `color: white` pass |
| A7 | Duplicate report ids resolve to the worst status (`failed` > `skipped` > `passed`) | Test report | The alternative (last wins) can turn a failed retry into passed |
| A8 | Sorting with code-point comparison, tie-breaks rule, reason, pointer | Rule engine | `localeCompare` without a locale can reorder goldens per host |
| A9 | `lint.vague-wording` is in scope (criterion 7) with the seven phrases, case-insensitive, whole-word | Scope note | If the owner meant it for a later phase, one rule and one fixture are removed |
| A10 | Arbitrary-property classes `[color:#fff]` are scanned as declarations | Token rule | Optional; a miss if omitted |
| A11 | Lint runs on `status: archived` and `status: draft` tickets alike | Rule engine | Archived legacy tickets may spam warnings; D-02 excludes archived from status and gates only |

## Open Questions (RESOLVED)

All seven were resolved by the owner on 2026-09-14. The plans cite these as owner decisions, not planner assumptions.

1. **Is ROADMAP criterion 7 (vague wording) in scope for Phase 3?**
   - What we know: added 2026-09-14 to ROADMAP and design.md §5 after CONTEXT.md; CONTEXT.md defers a different word list.
   - What's unclear: whether the owner intended CONTEXT.md to be updated too.
   - Recommendation: in scope as `lint.vague-wording` (warning); the planner adds a plan for it and notes the CONTEXT.md gap.
   - **RESOLVED (owner, 2026-09-14):** in scope as `lint.vague-wording`, warning. Planned in 03-02.

2. **`TBD` reported twice (sentinel and vague wording)?**
   - Recommendation: accept both; different rule ids, both true; no cross-rule dedupe code.
   - **RESOLVED (owner, 2026-09-14):** reported twice, `lint.sentinel` and `lint.vague-wording`; no cross-rule dedupe.

3. **`lint.no-scenarios` alongside `load.gherkin-parse` on the same ticket?**
   - What we know: `PARSE-ERROR` yields `scenarios: []` plus one parse finding [VERIFIED: gherkin-shapes golden].
   - Recommendation: emit both; both are true and each has its own id (criterion 3).
   - **RESOLVED (owner, 2026-09-14):** both are emitted on the same ticket.

4. **Archived tickets:** lint everything (A11) or skip `archived`? Recommendation: lint everything; D-02 names only `status` and gates.
   - **RESOLVED (owner, 2026-09-14):** archived tickets are linted like any other; nothing exempts `status: archived`.

5. **`@test:` id normalisation (A2):** confirm the `#` join and `-` for whitespace before fixtures are written; this string shape is what developers will type from Phase 4 on.
   - **RESOLVED (owner, 2026-09-14):** the id is `norm(classname)#norm(name)`, whitespace runs become `-`, exact match, no basename fallback. Fixtures and reason strings in 03-03 and 03-05 use this shape.

6. **Tailwind default-theme tokens:** a prototype using `var(--color-red-500)` under a default theme warns "unknown token". Recommendation: accept in v0.1 (warning-only; the prototype should use project tokens); note in the `tokens-missing`/`token-hardcoded` reason that tokens are read from the configured file only.
   - **RESOLVED (owner, 2026-09-14):** a default-theme token not in the configured tokens file warns as unknown token; the reason text says tokens are read from the configured file only.

7. **Renderer plural:** `1 errors, 0 warnings` literal per D-60, or singularise? Recommendation: literal.
   - **RESOLVED (owner, 2026-09-14):** the literal `N errors, M warnings` per D-60, no singularisation.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests, build | ✓ | v24.14.0 | — |
| npm | workspaces, `npm test` | ✓ | 11.9.0 | — |
| git | CLI loader tests (`git init`, `ls-files`) | ✓ | 2.55.0.windows.2 | — |
| vitest | goldens | ✓ | 5.0.0 (`npm test -- --project core sections`: 22 passed in 4.78 s) [VERIFIED: run 2026-09-14] | — |
| CI matrix | ubuntu/windows × Node 22/24 | ✓ | `.github/workflows/ci.yml` [VERIFIED] | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 5.0.0, `pool: 'forks'`, `environment: 'node'`, projects `core` and `cli` [VERIFIED: vitest.config.ts] |
| Config file | `vitest.config.ts`, `packages/core/vitest.config.ts`, `packages/cli/vitest.config.ts` |
| Quick run command | `npm test -- --project core <stem>` (e.g. `lint`, `ears`, `tokens`, `junit`, `render`); golden regeneration `npm test -- --project core lint -u -t "fixture <name>"` |
| Full suite command | `npm run check` (= `npm run build && npm run lint && npm run typecheck && npm test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-04 | `RULES` has one row per id; every row lists both profiles; `level` on each finding equals its row | unit | `npm test -- --project core lint` | ❌ Wave 0: `packages/core/test/lint.test.ts` |
| CORE-05 | `renderText` lines parse back to `findings` (file, line, level, rule, reason); counts match | unit | `npm test -- --project core render` | ❌ Wave 0: `packages/core/test/render.test.ts` |
| LINT-01 | `frontmatter-errors` lint golden shows `schema.*` findings with `pointer` and `line`, level `error`; no `schema.if` | golden | `npm test -- --project core lint -t "fixture frontmatter-errors"` | ❌ Wave 0: golden loop over fixtures in `lint.test.ts`, `__golden__/<fixture>.lint.json` |
| LINT-02 | six patterns classify; each diagnosis string fires once; fixture lines from `valid-build` produce no finding | unit + golden | `npm test -- --project core ears` and `-t "fixture lint-ears"` | ❌ Wave 0: `ears.test.ts`, fixture `lint-ears` |
| LINT-03 | `TAGS`, `PARSE-ERROR`, `EMPTY-AC` (gherkin-shapes) and a new empty-step fixture each yield their rule id | golden | `npm test -- --project core lint -t "fixture (gherkin-shapes\|lint-gherkin)"` | ❌ Wave 0: fixture `lint-gherkin` (empty step, bare keyword, `@test:` variants) |
| LINT-04 | probe prototype yields the eight findings; token-clean prototype yields none; `tokens-missing` and `prototype-derivation` cases | unit + golden | `npm test -- --project core tokens` and `-t "fixture (lint-tokens\|lint-no-tokens\|valid-build)"` | ❌ Wave 0: `tokens.test.ts`, fixtures `lint-tokens`, `lint-no-tokens`, `valid-build` extension |
| LINT-05 | `verified: [ac-9]` yields `lint.tick-orphan` with pointer `/verified/0` | golden | `-t "fixture lint-hygiene"` | ❌ Wave 0: fixture `lint-hygiene` |
| LINT-06 | sentinels (word, `...` step, `<placeholder>`, `TICKET-ID`), `- [ ]`, unconfirmed assumption; comment text ignored | golden | same | ❌ Wave 0 |
| LINT-07 | 6 intent lines, 16 EARS lines, 6 scenarios each warn at the heading line; epic sizes | golden | same | ❌ Wave 0 |
| LINT-08 | untagged step, differing sets with both sides named, empty plan on a scenario ticket, equal sets silent | golden | same | ❌ Wave 0 |
| FMT-09 | missing/duplicate/on-ui `@test:` tags; `@test:` parsed as one tag | golden + unit | `-t "fixture lint-gherkin"`, `gherkin` | ❌ Wave 0 |
| FMT-10 | `### @ac-9` orphan; notes section not last; last section silent | golden | `-t "fixture lint-hygiene"` | ❌ Wave 0 |
| FMT-11 | `scanJUnit` on the four runner shapes; `snapshot.tests` in the lint-report golden; `lint.report-missing`; `load.report-invalid`; CLI reads the report and refuses a path outside the root | unit + golden + integration | `npm test -- --project core junit`, `-t "fixture lint-report"`, `npm run build && npm test -- --project cli load` | ❌ Wave 0: `junit.test.ts`, fixture `lint-report`, `cli/test/load.test.ts` cases |
| D-65 | five encoding variants of a fixture with a prototype and report load identically | golden (existing loop) | `npm test -- --project core snapshot` | ✅ loop exists; new fixtures join it automatically |
| Schema | `tests.report` accepted; unknown `tests.x` rejected; seven property keys | unit | `npm test -- --project core schemas` | ✅ file exists; expectations change |
| Templates | headings incl. `## Verification notes`; drift test after `npm run gen` | unit | `npm test -- --project core templates` | ✅ file exists; expectations change |
| Bundle | `lintSnapshot`, `renderText`, `LintResult` in `dist/index.d.ts`; no `node:` import | unit (post-build) | `npm run build && npm test -- --project core bundle` | ✅ extend the names list |

### Sampling Rate
- **Per task:** the plan's scoped `npm test -- --project core <stem>` plus `lint -t "fixture <name>"` so `-u` never touches a sibling golden; `npm run lint && npm run typecheck` when a `src/` file changes (purity guard).
- **Per wave merge:** `npm test -- --project core` green, then `npm test` (both projects).
- **Phase gate:** `npm run check` green locally on Windows, CI green on all four legs after the owner pushes; no commits by agents.

### Wave 0 Gaps
- [ ] `packages/core/test/lint.test.ts` — golden loop mirroring `snapshot.test.ts` (`describe('fixture <name>')`, `stableJson(lintSnapshot(loadSnapshot(...)))` to `__golden__/<name>.lint.json`, five-variant identity) — covers CORE-04, LINT-01, and every fixture-driven requirement
- [ ] `packages/core/test/ears.test.ts` — classifier table test (six patterns, ten diagnoses) — LINT-02
- [ ] `packages/core/test/tokens.test.ts` — `tokenNames`, `offending`, `scanPrototype` on the probe inputs — LINT-04
- [ ] `packages/core/test/junit.test.ts` — the four runner samples, CRLF, CDATA, duplicates — FMT-11
- [ ] `packages/core/test/render.test.ts` — text/JSON identity — CORE-05
- [ ] Fixtures: `lint-ears`, `lint-gherkin`, `lint-hygiene`, `lint-tokens`, `lint-no-tokens`, `lint-report`; `valid-build` gains `accord/assets/LOGIN-1/prototype.html` (token-clean) and, if the owner wants the reference tag in the reference fixture, `@test:` tags plus `tests.report` and a `reports/junit.xml`
- [ ] Framework install: none

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Untrusted repo text (prototype, tokens, report, tickets) meets anchored, linear regexes over normalised text; no `eval`, no `new Function`, no JS/CSS evaluation (PITFALLS §13); `tests.report` path contained to the repo root by the existing `relative(root, abs)` check (T-02-20) |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `tests.report: ../../secrets.xml` pulls a file outside the repo into the snapshot | Information disclosure | Same containment as `design.tokens` (`fs.ts:52-60`); a contained-path unit test for the report mirrors `load.test.ts:98` |
| Hand-written "all passed" JUnit report committed to the repo | Tampering (bypass of GATE-08) | Out of lint's scope; Phase 4 and CI design (the report is produced by the CI job, not read from the tree) own it; record as an accepted risk carried to Phase 4 |
| Pathological input (megabyte prototype or report) | Denial of service | Single-pass regexes with lazy fixed-terminator quantifiers; per-token anchored class regex; no nested unbounded quantifiers; document the O(n) property in a comment |
| Regex over attribute values containing a raw `>` | Tampering (misparse) | Emitters escape `>` as `&gt;` in attributes; a misparse only makes an id unknown (warning), never "passed" |
| Reason strings echoing file content | Information disclosure | Reasons echo token names, tag names, and test ids only, shown to the author of the file (R-02-01 precedent) |
| Prototype declares its own `:root` variables to bypass the token rule | Tampering | Use sites of local variables are "unknown token"; only the tokens file defines the allowlist |
| Supply chain | Tampering | No package added; `package-lock.json` untouched in this phase (T-02-SC pattern) |

## Sources

### Primary (HIGH confidence)
- Local execution, 2026-09-14: `scratchpad/probe.mjs` (EARS classifier 20 assertions, JUnit scanner 4 samples, token scanner 16 value cases plus an 8-finding prototype) — all pass; `@cucumber/gherkin` 42.0.1 tag and empty-step probes via `node -e`; `npm test -- --project core sections` (22 passed)
- In-repo reads (paths and lines cited inline): `packages/core/src/model/{finding,snapshot}.ts`, `src/load/{snapshot,sections,gherkin,frontmatter,yaml,verification,config}.ts`, `src/validate/ajv.ts`, `schemas/config.schema.json`, `schemas/ticket.schema.json`, `templates/*`, `test/helpers/fixture.ts`, `test/{snapshot,schemas,templates,bundle,purity}.test.ts`, `test/__golden__/{config.invalid,frontmatter-errors.snapshot,gherkin-shapes.snapshot}.json`, `packages/cli/src/load/fs.ts`, `packages/cli/test/load.test.ts`, `eslint.config.js`, `vitest.config.ts`, `.planning/**` (CONTEXT, REQUIREMENTS, ROADMAP diff, PITFALLS, ARCHITECTURE, STACK, 02-SECURITY, 02-VALIDATION, quick 260914-dd3), `docs/design.md`

### Secondary (MEDIUM confidence — official docs and source via Context7 / direct fetch)
- Context7 `/tailwindlabs/tailwindcss.com`: theme.mdx (namespaces, `@theme static`, `--*: initial`), colors.mdx (`@theme inline`, opacity modifier), functions-and-directives.mdx (`--spacing()`), adding-custom-styles.mdx (arbitrary values, underscores), upgrade-guide.mdx (`(--var)` shorthand), v4 and v4-alpha blog posts (`--spacing` base, namespace reset)
- Context7 `/vitest-dev/vitest` docs/guide/reporters.md and `packages/vitest/src/node/reporters/junit.ts` (defaults, `' > '`, `<skipped/>`, escaping)
- Context7 `/pytest-dev/pytest` and `src/_pytest/junitxml.py` (`mangle_test_address`, xunit2 default, skipped/failure elements)
- https://github.com/jest-community/jest-junit (README templates) and `utils/buildJsonResults.js`
- https://github.com/gotestyourself/gotestsum (README `--junitfile-*`) and `internal/junitxml/report.go`
- https://raw.githubusercontent.com/jstemmer/go-junit-report/master/junit/junit.go
- https://github.com/testmoapp/junitxml (community JUnit XML structure)
- https://alistairmavin.com/ears/ (six patterns, generic form)
- https://developer.mozilla.org/en-US/docs/Web/CSS/color_value, https://developer.mozilla.org/en-US/docs/Web/CSS/length
- https://github.com/AndyOGo/stylelint-declaration-strict-value (allowlist model reference)

### Tertiary (LOW confidence)
- None used; every `[ASSUMED]` item is a policy choice listed in the Assumptions Log, not a factual claim from an unverified source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions read from manifests and confirmed by running
- Architecture: HIGH — every model field and helper cited by file and line; rule table shape matches D-57 and the ARCHITECTURE draft
- Algorithms (EARS, JUnit, tokens): HIGH — executed against representative inputs this session; the TypeScript in this file is the executed code with types added
- Runner id shapes: MEDIUM — official docs and source read this session, not executed against real reporter output
- Policy lists (properties, prefixes, normalisation): LOW/ASSUMED — deliberate choices for the owner to confirm at discuss or plan time

**Research date:** 2026-09-14
**Valid until:** 2026-10-14 (stable domain; Tailwind and reporter defaults change slowly)
