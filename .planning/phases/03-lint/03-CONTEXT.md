# Phase 3: Lint - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning

<domain>
## Phase Boundary

`lintSnapshot(snapshot)` is a pure function over the Phase 2 `RepoSnapshot` that returns every format, EARS, Gherkin, token, tick, hygiene, size, and plan-tag finding with file, line, rule id, level, and reason, and one result object that renders to text and to JSON with identical content. Rules are data in one table with a profile column. The phase also lands the three format additions settled on 2026-09-12: the `@test:<id>` scenario tag (FMT-09), the `## Verification notes` body section (FMT-10), and `tests.report` in `config.yml` with a JUnit XML line scanner in the loader (FMT-11).

In scope: CORE-04, CORE-05, LINT-01 to LINT-08, FMT-09, FMT-10, FMT-11. Not in scope: gate evaluation, the AC hash, and the three-set match (Phase 4); commander commands, colour, and exit codes as process behaviour (Phase 5); skill text (Phase 6).

Decision numbering continues from Phase 2 (D-01 to D-55).

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product intent and requirements
- `.planning/PROJECT.md` — core value, constraints, key decisions; "core never guesses" applies to every rule here
- `.planning/REQUIREMENTS.md` — CORE-04, CORE-05, LINT-01..08, FMT-09..11 are this phase; GATE-01, GATE-04, GATE-07, GATE-08, GATE-10 explain which lint warnings become gate errors
- `.planning/ROADMAP.md` Phase 3 — goal and six success criteria
- `.planning/notes/solo-reaim-and-three-layer-done.md` — D-A to D-D: `@test:` tag, JUnit report in the snapshot, note-by-reference, notes section in the body; the origin of FMT-09..11
- `.planning/phases/01-workspace-and-formats/01-CONTEXT.md` — D-07 (headings), D-22 (`tracker: {}`), D-34 via Phase 1 discretion (id case)
- `.planning/phases/02-core-model-and-loading/02-CONTEXT.md` — D-37 (ignored files), D-41 (requirement lines), D-46 to D-48 (ScenarioRef, tags outside the hash), D-52 (Finding), D-54 (goldens), D-55 (public API)
- `docs/design.md` §2 (formats, size discipline, Verification notes), §5 (prototype rule, Done layers)

### Architecture and stack
- `.planning/research/ARCHITECTURE.md` Pattern 1 (rules as data) and the matching table under "Matching and orphans" — the shape D-57 follows, with levels renamed per D-56
- `.planning/research/PITFALLS.md` §9 (EARS check that lies both ways), §13 (token rule that cries wolf) — both drove D-61 to D-68
- `.planning/research/STACK.md` Decision 4 (line scanner, no parser; extended to JUnit by D-72), Decision 5 (`styleText` stays in the CLI)
- `.claude/CLAUDE.md` "Technology Stack" — loaded every session

### Security carry-overs from Phase 2
- `.planning/phases/02-core-model-and-loading/02-SECURITY.md` R-02-04, R-02-05, R-02-07 — size limits and id case were accepted there on the promise that Phase 3 lint covers them

### Existing code this phase extends
- `packages/core/src/model/finding.ts` — add `level` (D-56)
- `packages/core/src/model/snapshot.ts` — add `files` and `tests` to `RepoSnapshot`, `tests` to `AccordConfig` (D-65, D-72)
- `packages/core/src/load/snapshot.ts` — keep the raw inputs, parse the report (D-65, D-72)
- `packages/core/src/load/sections.ts` — `scan`, `headingKey`, `stripHtmlComments`, `requirementLines`: every body rule reads through these
- `packages/core/src/load/gherkin.ts` — `ScenarioRef.tags` is where `@test:` and `@ui` are read
- `packages/core/schemas/config.schema.json` — `tests.report` (D-72)
- `packages/core/templates/ticket-build.md`, `ticket-maintain.md`, `prototype-header.html` — the `Derived from:` line D-67 checks; placeholders D-73 detects
- `packages/cli/src/load/fs.ts` — reads the tokens file today; must also read `tests.report` (D-72)
- `packages/core/test/fixtures/valid-build/` — has `src/styles/tokens.css` and `config.design.tokens` already

### Todo reviewed
- `.planning/todos/pending/mcp-host-spike.md` — not folded; see Deferred

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Finding` (D-52) and the loader's `load.*` findings: lint adds `level` and reuses the type unchanged otherwise.
- Section scanner (`scan`, `headingKey`, `stripHtmlComments`, `requirementLines`): heading lookup, comment stripping, and fence awareness are done; LINT-06, LINT-07, LINT-08, and FMT-10 rules read `ticket.sections` and never re-scan text.
- `ScenarioRef.tags` keeps every tag raw; `@test:` and `@ui` need no loader change (verified against `@cucumber/gherkin` 42 in the re-aim note).
- `snapshot.tree` gives the existence check for D-67 paths.
- Golden harness (`toMatchFileSnapshot` of the whole snapshot, three encoding variants derived in memory) extends to lint results as-is.
- CLI loader already reads a configured extra file (tokens) into `files`; the report is the same pattern.

### Established Patterns
- Rule ids are dotted with a source prefix (`load.*`); lint follows (`lint.*`).
- Findings carry the Markdown line remapped through fence offsets; lint findings on Gherkin use `ScenarioRef.line`, on EARS use `Line.line`.
- Decisions are cited in code comments by number.
- Core purity guard and `types: []` tsconfig: any `node:` import in `lint/` fails lint and typecheck.

### Integration Points
- Phase 4 gates reuse the rule table shape (D-57) and read `snapshot.tests` (D-72) and `snapshot.files` for the report.
- Phase 5 `lint --json` serialises the D-58 result and colours the D-60 text.
- Phase 6 skills start with `accord lint`; the rule ids in reasons are what the skill text will quote.

</code_context>

<specifics>
## Specific Ideas

- Fixture `LOGIN-1` is the EARS reference: English keywords around Vietnamese prose, list markers stripped by D-41. Both its lines must classify (event-driven, unwanted behaviour).
- The text line shape is modelled on compact compiler output so an editor's problem matcher can click through: `accord/tickets/LOGIN-1.md:12: warning lint.ears-unclassified has WHEN but no 'the system shall'`.
- The `@test:` id example to design around: `@test:auth.spec.ts#rejects-bad-password`.

</specifics>

<deferred>
## Deferred Ideas

- **MCP server no longer needed** — owner's view during this discussion, consistent with the solo re-aim note. ROADMAP Phase 8, REQUIREMENTS MCP-01..07, and milestone criterion 2 in PROJECT.md still carry it; removing it is a roadmap-level change to make with `/gsd-phase`, not a Phase 3 decision. Core purity stays because it is already enforced and costs nothing.
- **Vagueness-term lint** (`appropriate`, `reasonable`, `etc`) from PITFALLS §9 — after pilot data.
- **Vietnamese EARS keywords** and **named system subject** — rejected for v0.1 (D-62, D-63); revisit if BAs ask.
- **`--strict` promoting warnings to errors** — not in v0.1 (D-56).
- **Suppression comment (`<!-- accord-ignore -->`)** for the token rule — not until the rule proves noisy.
- **Token rule as error** — GATE-12 (v2). **Tailwind v3 JS config as a token source** — never evaluated; export a CSS file instead (PITFALLS §13).
- **Lint on heading order beyond D-70** — rejected (D-07).

### Reviewed Todos (not folded)
- `mcp-host-spike.md` — not folded. Owner indicates the MCP server is no longer needed; close the todo when Phase 8 is removed from the roadmap.

</deferred>

---

*Phase: 03-lint*
*Context gathered: 2026-09-13*
