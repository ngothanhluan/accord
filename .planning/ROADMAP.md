# Roadmap: accord

## Overview

Accord is a contract for AI-assisted delivery: a folder convention, deterministic gates, and role skills for four coding agents. The roadmap follows the dependency chain the research identified. Formats and the isomorphic core come first because every host renders over them. Lint and gates follow as pure functions over a snapshot. The CLI is the reference host and the skills wrap the CLI. The milestone closes only when the scoped package is on npm and one real ticket has passed Ready and Done on a coding agent.

The original roadmap carried a ninth deliverable, a remote MCP server, so that a non-technical BA could work tickets from a chat app. `.planning/notes/solo-reaim-and-three-layer-done.md` (2026-09-11) re-aimed accord from a team contract to a personal workflow set, which removed that deliverable's reason to exist; D-117 recorded the removal as owner action. Phase 8 is retained below as a tombstone rather than deleted, so that the references to it in the Phase 3 through 7 records stay true.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Workspace and Formats** - Monorepo with two-OS CI, core purity guard, JSON schemas, folder convention, and templates (completed 2026-09-06)
- [x] **Phase 2: Core Model and Loading** - Snapshot to typed tickets, scenarios, and verification with correct line numbers on any line ending or OS (completed 2026-09-13)
- [x] **Phase 3: Lint** - Rule engine as data; schema, EARS, Gherkin, token, tick, hygiene, and size findings rendered to text and JSON (completed 2026-09-14)
- [x] **Phase 4: Gates** - Ready and Done evaluated deterministically with AC hash, three-set match, evidence check, profile matrix, and exit codes (completed 2026-09-15)
- [x] **Phase 5: CLI Commands** - `new ticket`, `lint`, `gate`, `status` on Windows and POSIX with `--json`, version pin, and the `github-issues` adapter (completed 2026-09-15)
- [x] **Phase 6: Skills** - One workflow definition per role rendered to SKILL.md for all four runtimes, synced with marker and hash (completed 2026-09-17)
- [x] **Phase 7: Scaffolding and Example Repo** - `init` delivers the whole contract in one command; example repo passes both gates in both profiles (completed 2026-09-19)
- [~] **Phase 8: MCP Server** - REMOVED 2026-09-19 (D-117); the number is retained and not reused
- [ ] **Phase 9: Publish and Dogfood** - Scoped npm package via trusted publishing; one real ticket through Ready and Done

## Phase Details

### Phase 1: Workspace and Formats

**Goal**: The repository is a three-workspace monorepo with green CI on Ubuntu and Windows, the core cannot import Node built-ins, and the contract's file formats are fixed by schemas and templates.
**Depends on**: Nothing (first phase)
**Requirements**: OPS-01, OPS-02, CORE-01, FMT-01, FMT-02, FMT-03, FMT-06, FMT-07
**Research**: no (npm workspaces, ESLint, JSON Schema 2020-12 are standard patterns verified in STACK.md)
**Success Criteria** (what must be TRUE):

  1. CI runs on ubuntu-latest and windows-latest for Node 22 and 24 and is green on the first commit that contains code
  2. A ticket frontmatter document and a `config.yml` each validate against a checked-in JSON Schema 2020-12 file, and an invalid document produces a schema error naming the path
  3. The build fails when any file under `core` imports a `node:*` module
  4. Templates exist for build and maintain tickets, glossary, business rules, prototype header, and `verification.md`, and every template with frontmatter validates against its schema
  5. The folder convention is documented and reflected in the templates: fixed root `accord/` containing `product/`, `tickets/`, `assets/<id>/`, no `features/`, grouping by `parent:`, tracker links as a map keyed by adapter

**Plans**: 5/5 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton (tracer): three workspaces, core `validate()` seam over the three schemas, CLI bin, vitest + ESLint wiring, first golden, CI matrix workflow

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Core purity guard proof: ESLint and tsc probes, built-bundle and manifest checks (CORE-01)
- [x] 01-03-PLAN.md — Schema acceptance goldens: config, verification, tracker map, and every D-01..D-05 / D-21..D-25 decision (FMT-02, FMT-03, FMT-06)
- [x] 01-04-PLAN.md — Seven templates, `gen-templates.mjs` codegen, committed generated module, `templates` export, drift test (FMT-07, FMT-01)
- [x] 01-05-PLAN.md — Documentation and requirement-text updates (REQUIREMENTS, PROJECT, ROADMAP, README, design.md §2–§5) plus the convention test (FMT-01)

### Phase 2: Core Model and Loading

**Goal**: Core turns any repository snapshot into typed tickets, verification records, and scenarios with correct line numbers, whatever the line endings, BOM, or operating system.
**Depends on**: Phase 1
**Requirements**: FMT-04, FMT-05, FMT-08, CORE-02, CORE-03, CORE-06
**Research**: no (`yaml` and `@cucumber/gherkin` behaviour verified by running in STACK.md)
**Success Criteria** (what must be TRUE):

  1. Loading a fixture ticket yields frontmatter where values like `1e3`, `007`, and dates stay strings, and comments survive a tick write round-trip
  2. Each scenario extracted from a fenced `gherkin` block reports its line number in the Markdown file, carries its `@ac-n` tag, and a Scenario Outline counts as one scenario
  3. EARS lines under `## Requirements` are extracted one per line, and text inside fenced blocks is never mistaken for a section or a requirement
  4. The same fixture saved as LF, CRLF, and BOM+CRLF produces byte-identical snapshot goldens on Ubuntu and Windows CI, including a fixture with Windows-style paths
  5. Every file core emits is LF and UTF-8 without BOM

**Plans**: 7/7 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Tracer: `loadSnapshot` over the `valid-build` fixture, one golden identical across LF/CRLF/BOM+CRLF/mixed/backslash keys; `Finding` rename (D-52); D-55 public API

**Wave 2** *(blocked on Wave 1 completion; all five run in parallel; each scopes golden creation to its own fixture with `-t "fixture <name>"`, and the whole core suite is checked at wave end)*

- [x] 02-02-PLAN.md — Frontmatter and `config.yml` error findings with exact lines (D-31..D-34), YAML typing boundaries (CORE-02)
- [x] 02-03-PLAN.md — Fence-aware section scanner and EARS extraction edges: fenced fakes, heading casing, duplicates, fences under other headings (D-36, D-39..D-41)
- [x] 02-04-PLAN.md — Gherkin shapes: Outline, `vi` dialect, Background, Rule, parse errors, tag variants, doc strings, multi-fence (D-35, D-46..D-50)
- [x] 02-05-PLAN.md — Verification records, orphan records, ignored files (D-37, D-42)
- [x] 02-07-PLAN.md — CLI filesystem loader over `git ls-files` with parity against the core golden (D-51)

**Wave 3** *(blocked on 02-02: the write primitive builds on the final `load/frontmatter.ts`)*

- [x] 02-06-PLAN.md — `setFrontmatterKey` tick-write primitive with Markdown goldens and load round trip (D-43..D-45, FMT-08)

### Phase 3: Lint

**Goal**: `lint` over a snapshot returns every format, EARS, Gherkin, token, tick, hygiene, and size finding with file, line, rule id, and reason, rendered as text or JSON from one result object.
**Depends on**: Phase 2
**Requirements**: CORE-04, CORE-05, LINT-01, LINT-02, LINT-03, LINT-04, LINT-05, LINT-06, LINT-07, LINT-08, FMT-09, FMT-10, FMT-11
**Research**: yes (token rule LINT-04 only: colour and spacing detection heuristics, Tailwind v4 `@theme` extraction; all other rules are standard patterns)
**Success Criteria** (what must be TRUE):

  1. A ticket with a schema violation produces a finding naming the JSON path and the line in the file
  2. Each of the six Mavin EARS templates classifies without a warning, and a line that matches none of them warns with its line number
  3. A Gherkin parse error, a missing or duplicate `@ac-n` tag, an empty step, and a code-touching ticket with zero scenarios each produce a finding with its own rule id
  4. A `prototype.html` using a colour or spacing value outside the token file warns and never errors, and a `verified` entry naming a tag with no scenario warns
  5. TODO sentinels, unchecked open questions, unconfirmed assumptions, and oversize intent, EARS, or scenario counts are reported, and the same result object renders to text and to JSON with identical content
  7. Vague wording ("depends", "maybe", "probably", "mix of", "somewhere between", "not sure", "TBD") in `## Requirements`, `## Acceptance criteria`, or an answered `## Open questions` item warns with its line number and never errors
  6. A ticket whose `## Plan` steps carry a tag set different from its scenario tag set warns and names the tags missing from each side; equal sets produce no finding, and an empty `## Plan` on a ticket with scenarios warns rather than errors

**Plans:** 6/6 plans complete

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Tracer: `Finding.level`, `RepoSnapshot.files`, rule table with two rules, `lintSnapshot`, `renderText`, golden loop and identity test

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Ticket rules: headings, sentinels, open questions, assumptions, ticks, vague wording, sizes, plan tags, verification notes; fixture `lint-hygiene`
- [x] 03-03-PLAN.md — Test report: `tests.report` schema key, CLI read with containment, `scanJUnit`, `snapshot.tests`, `load.report-invalid`; fixture `lint-report`
- [x] 03-04-PLAN.md — Templates: `## Verification notes` section and `@test:` guidance, `npm run gen`, heading pin

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-05-PLAN.md — EARS classifier and Gherkin rules: ac-tag, step-empty, no-scenarios, `@test:` duplicate/on-ui, unknown id, report-missing; fixtures `lint-ears`, `lint-gherkin`, `lint-missing-files`

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-06-PLAN.md — Token rule: `tokenNames`, `scanPrototype`, `Derived from:`, `tokens-missing`; fixtures `lint-tokens`, `lint-no-tokens`; `valid-build` prototype

### Phase 4: Gates

**Goal**: Ready and Done evaluate deterministically over a snapshot, list reasons by rule, apply the build/maintain matrix, and offer no bypass.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, GATE-06, GATE-07, GATE-08, GATE-09, GATE-10, GATE-11
**Research**: no (rules-as-data and three-set match are established shapes from ARCHITECTURE.md)
**Success Criteria** (what must be TRUE):

  1. `gate ready` passes a fixture only when frontmatter is valid, intent is present, at least one EARS line and one tagged scenario exist, no hygiene finding remains, and a design reference is present where the profile requires it; a pass records `ac_hash`
  2. `gate done` passes only when the scenario tag set, the evidence tag set in `verification.md`, and `verified` are equal, and a mismatch lists which tags are missing from which set; a `Result: blocked` block fails Done as `fail` does, and a `verification.md` whose `commit:` differs from the gated commit fails Done with a stale-review reason
  3. Editing the acceptance criteria after Ready makes `gate done` fail with an AC-changed reason until Ready is re-run
  4. An evidence line naming a file, test, or command absent from the snapshot fails Done; a `@test:<id>` test reported skipped in the JUnit report is not passed and fails Done; when the host supplies git authors, implementation, evidence, and tick by one author warn; when the host supplies none, the check reports as skipped
  5. Results carry exit codes 0, 1, or 2, the `maintain` profile downgrades token and size rules to warnings, and no flag or option bypasses a gate

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Tracer: `gateReady` end to end over `valid-build` through the gate rule table to a `GateResult` rendered by `renderText`; the Ready reasons on both profiles; the `git`, `verified_hash`, `verified_commit` frontmatter contract

**Wave 2** *(blocked on Wave 1)*

- [x] 04-02-PLAN.md — Done vertical slice: the three-set match, `Result: blocked`, the stale-review commit, the AC-hash staleness, the tick binding, and the D-81 sha comparison

**Wave 3** *(blocked on Wave 2)*

- [x] 04-03-PLAN.md — The Human layer: one shared reference extraction and segment-boundary resolution rule, the per-block evidence check, and the three verification-note rules including the `@ui` case

**Wave 4** *(blocked on Wave 3)*

- [x] 04-04-PLAN.md — The Machine layer: the JUnit join with skipped failing as failed does, both unconfigured-report branches, the author-mismatch warning, and the CLI as the only producer of the host git facts

### Phase 5: CLI Commands

**Goal**: A developer or CI runs lint, gates, status, and new ticket from a terminal on Windows or POSIX, with JSON output, version pinning, and optional tracker enrichment.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: CLI-04, CLI-05, CLI-06, CLI-07, INTG-01
**Research**: no (commander 15, tsdown, and `fetch` against the GitHub REST API verified in STACK.md)
**Success Criteria** (what must be TRUE):

  1. `accord new ticket <id>` creates a ticket from the active profile's template with `@ac-1` tag scaffolding and refuses to overwrite an existing ticket
  2. `accord lint`, `accord gate ready <id>`, `accord gate done <id>`, and `accord status` print an ASCII table or reasons, and with `--json` print the same result object; exit codes follow the 0/1/2 contract
  3. Running the CLI against a `config.yml` pinned to a different accord version exits 2 with a message naming both versions
  4. A spawn test of the built binary passes on Ubuntu and Windows CI, and the CLI never spawns `npm`, `npx`, or any `.cmd`
  5. With tracker `github-issues` configured, `status` shows issue title, state, and labels using a token from `gh auth token` or `GITHUB_TOKEN`, and every gate returns the same result with or without the token

**Plans**: 6/6 plans executed

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Tracer: `accord lint` end to end — commander spine, `git rev-parse` root resolution, the shared preflight, `renderText` with `styleText`, `--json` verbatim, the 0/1/2 exit map, the `config.yml` version pin, and the CLI-07 spawn allowlist
- [x] 05-02-PLAN.md — Core `statusRows`: the pure, sorted `StatusRow[]` behind `status`, costing one repo-wide lint, with goldens

**Wave 2** *(blocked on Wave 1)*

- [x] 05-03-PLAN.md — `gate ready <id>` and `gate done <id>` end to end, plus the one write the project performs: `ac_hash` into the ticket file, with its rerun no-op and its exit-2 write-failure path

**Wave 3** *(blocked on Wave 2)*

- [x] 05-04-PLAN.md — `accord status`: the ASCII `padEnd` table, the archived filter with its hidden count, `--json` verbatim, and the ASCII-only and no-backslash invariants

**Wave 4** *(blocked on Wave 3)*

- [x] 05-05-PLAN.md — `accord new ticket <id> --type`: template selection by profile, id substitution, the overwrite refusal, and the id-pattern rejection
- [x] 05-06-PLAN.md — The read-only `github-issues` adapter: token lookup, parallel per-issue GET, soft degradation, and the test proving every gate is blind to the tracker

### Phase 6: Skills

**Goal**: Each role has one workflow definition complete enough to replace a general planning system, plus the shared techniques those workflows load, rendered to SKILL.md files that Claude Code, Cursor, Copilot, and Codex all read and kept in sync with a generated marker and hash.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-05, SKILL-06, SKILL-07, SKILL-08, SKILL-09, SKILL-12, CLI-08
**Research**: light (re-verify the four runtimes' skill directories and Codex's handling of non-spec frontmatter keys at planning time; runtimes have moved three times in eighteen months)
**Success Criteria** (what must be TRUE):

  1. Three definitions (`ba`, `dev` with `review.md`, `designer`) render to `SKILL.md` files whose frontmatter contains only the six Agent Skills spec fields
  2. `accord skills sync` writes each rendered skill to `.claude/skills/accord-<role>/` and `.agents/skills/accord-<role>/` with a generated marker and content hash, and a second run is a no-op
  3. Every rendered skill begins with a lint or gate command, none restates a rule the CLI enforces, and a test fails if a skill names a CLI command that does not exist
  4. The BA skill keeps the ticket `draft` and stops before Ready while open questions, unconfirmed assumptions, or TODO markers remain; the dev skill's review step runs in a fresh context and writes only `verification.md`; only the developer writes `verified`
  5. Two techniques render alongside the roles and are loaded by them, not invoked as roles: systematic debugging (dev workflow, `type: bug` or any unexpected behaviour) and code review (review context, appended to `verification.md` under `## Review`). The definitions live in `packages/core/skills/`
  6. The workflows carry the work a general planning system would: the BA skill covers project and epic setup in `build` profile, the dev skill covers planning into `## Plan` and implementation, the review context covers code review, and `accord status` plus the ticket covers resume — no session or handoff file exists anywhere
  7. The dev skill reviews `## Plan` against intent and acceptance criteria in a fresh context before implementing, reading no code and editing only `## Plan`, and a fixture whose plan targets the wrong layer or the wrong order comes back changed

**Scope note**: this is the heaviest phase in the project. Rendering is mechanical; writing four workflows good enough to replace a mature planning system is not. Plan it as content work with a rendering step, not the reverse.

**Plans**: 8/8 executed — 4 build plans plus 4 gap-closure plans (06-07 and 06-08 close the
G-1/G-2/G-3 gaps 06-VERIFICATION.md raised against the first gap-closure round). Criterion 3's second clause failed
its manual read: three sentences in the BA skill restate a rule the CLI enforces, so SKILL-04 stays
open. The owner upheld that verdict and deferred the prose fix to Phase 7 (06-06-SUMMARY CF-1), then
accepted it formally as a verification override on 2026-09-17, which is what let the phase close at 7/7
with SKILL-04 still unticked.

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Tracer: the whole pipe on the thinnest content — `designer` plus the `prototype.md` it loads, through `gen-skills.mjs`, the committed generated module, `renderSkill`/`skillTargets`/`contentHash`, and `accord skills sync` into both target directories, with a second run that is a byte- and write-call-level no-op; plus the invariants every later definition inherits (SKILL-01, SKILL-02, SKILL-03, SKILL-04, CLI-08)

**Wave 2** *(blocked on Wave 1)*

- [x] 06-02-PLAN.md — The `dev` slice: the workflow, the fresh-context review brief, the two techniques graduating out of `docs/skills/`, the graduation commit that replaces this repository's hand-maintained copies in the same change, and the wrong-plan fixture (SKILL-01, SKILL-06, SKILL-07, SKILL-09, SKILL-12)

**Wave 3** *(blocked on Wave 2; both run in parallel — 06-03 touches only `packages/cli`, 06-04 only `packages/core`)*

- [x] 06-03-PLAN.md — The guards: the SKILL-08 command scanner over the commander registry, the three sync states the tracer did not exercise, the orphan report, the pin refusal, and `skills sync` inside the Windows printed-path invariant (SKILL-04, SKILL-08, CLI-08)
- [x] 06-04-PLAN.md — The `ba` slice: one definition with the profile branch, the setup and per-story briefs, the fresh-context readiness review, the rejected-alternatives convention in `business-rules.md`, and the full roster synced (SKILL-01, SKILL-05)

**Gap closure — Wave 1** *(from 06-VERIFICATION.md; runs under `/gsd-execute-phase 06 --gaps-only`)*

- [x] 06-05-PLAN.md — The three verification gaps: the orphan scan widened to every directory the `DIRS` table can produce, the two rendered step 2s made followable from the brief alone plus the regression that would have caught the leak, and REQUIREMENTS.md corrected to match what shipped (CLI-08, SKILL-09)

**Gap closure — Wave 2** *(blocked on 06-05)*

- [x] 06-06-PLAN.md — The two carried human-verification items: the wrong-plan fixture through the plan review, and the eleven-file rule-mention read that closes SKILL-04 (SKILL-04)

**Gap closure round 2 — Wave 1** *(from 06-VERIFICATION.md gaps G-1, G-2, G-3 and advisory NF-02; runs under `/gsd-execute-phase 06 --gaps-only`. Wave numbers restart per gap round, as they did for 06-05/06-06. G-0 / SKILL-04 is deliberately absent — owner-deferred to Phase 7, WINDOWS.md entry 6)*

- [x] 06-07-PLAN.md — The orphan scan stops at a link instead of routing through it: a per-component `lstat` guard on the scan set 06-05 widened, the junction case beside the two existing write cases, and the printed-output invariant narrowed to the text accord composes (CLI-08)

**Gap closure round 2 — Wave 2** *(blocked on 06-07 — both plans run in one working tree and 06-08 regenerates `packages/core/dist/`, which 06-07's CLI suite loads)*

- [x] 06-08-PLAN.md — The two rendered step 2s made accurate as well as reachable: `review.md` shows the column-0 shape the parser anchors on, `prototype.md` drops the lint promise the rule table does not keep, and `gate done`'s real behaviour on an empty evidence block is pinned by a test (SKILL-06, SKILL-09)

### Phase 7: Scaffolding and Example Repo

**Goal**: A team runs one command in an empty repository and receives the whole contract: folder, config, templates, skills, agent pointers, and CI. An example repo proves both profiles pass both gates.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: CLI-01, CLI-02, CLI-03, INTG-02, SKILL-04 (Phase 6 carry-over, pulled in by D-148)
**Research**: no (GitHub Actions workflow emission and idempotent scaffolding are standard patterns)
**Success Criteria** (what must be TRUE):

  1. `accord init` in an empty repo creates the root folder, `config.yml` with the pinned version, templates, and skill copies in both paths, prints every created path, and a second run changes nothing and never overwrites a human-authored file (skill copies under `.claude/skills/**` and `.agents/skills/**` are accord-owned rendered output: a hand edit there is overwritten and reported as `overwrote local edits`)
  2. The generated GitHub Actions workflow runs `lint` and `gate done` on touched tickets and reports a job result on docs-only and no-ticket diffs
  3. `AGENTS.md` and `CLAUDE.md` receive a short pointer to the accord skills without a copy of any skill body, created when missing and appended when present
  4. The example repo holds one maintain-profile ticket and one build-profile ticket, and both pass `gate ready` and `gate done` in that repo's CI

**Plans**: 15/15 plans executed — 8 executed, plus 3 gap-closure plans from the first 07-VERIFICATION.md pass and 1 of the 4 from the second; 3 pending

Plans:
**Wave 1**

- [x] 07-01-PLAN.md — tracer: `accord init` end to end writing one artifact, registered before `lint` (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-05-PLAN.md — SKILL-04: a guard that fails when a skill restates a rule the CLI enforces, plus the prose fix (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 07-02-PLAN.md — CLI-01: product templates and skill copies join `init`; the write loop is shared with `skills sync` (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 07-03-PLAN.md — CLI-02: the generated `pull_request` workflow that lints and gates touched tickets (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 07-04-PLAN.md — CLI-03: the `AGENTS.md` / `CLAUDE.md` pointer, plus the shipped-text name scan widened to every surface (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 07-07-PLAN.md — CLI-02: the emitted workflow's script body executed against four real diff shapes (wave 5)
- [x] 07-06-PLAN.md — INTG-02: the build-profile example passing both gates locally (wave 6)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 07-08-PLAN.md — INTG-02: the maintain-profile example, the examples CI job, and the tick (wave 7)

**Gap closure** *(from 07-VERIFICATION.md; the eight plans above stand as executed)*

- [x] 07-09-PLAN.md — gap 1 tracer: every refusal before the first byte, and a partial run that prints what it wrote (wave 1)
- [x] 07-10-PLAN.md — gap 2: the commented `tests:` block in the config `init` generates (wave 2)
- [x] 07-11-PLAN.md — gap 3: the shipped ticket templates name no tool, and the name scan reaches them (wave 3; serialised after 07-10 because it deliberately reddens the tree to prove the scan fails)

**Gap closure, second round** *(from 07-VERIFICATION.md 2026-09-18T20:20Z — two blockers plus all four warnings, per owner ruling GAP-SCOPE. Serialised end to end: every plan runs `npm run gen` or `npm run build`, which mutate shared build outputs, so two in one wave would race)*

- [x] 07-12-PLAN.md — gap 1 tracer: the pointer append keeps every byte, plus GC-WR-01 and GC-WR-02 in the same two CLI files (wave 1)
- [x] 07-13-PLAN.md — gap 2c: the shipped templates offer a tracker key accord actually ships (wave 2)
- [x] 07-14-PLAN.md — gap 2a/2b: one denied list at the repository root, and the scan that reaches the published bundle (wave 3; the scan is written red against the pre-reword bundle, then the JSDoc is reworded)
- [x] 07-15-PLAN.md — GC-WR-03 and GC-WR-04: the `tests:` instruction names both halves of its edit, and the assertion reading it anchors on both sides (wave 4)

**Cross-cutting constraints:**

- The example skeleton was produced by running the built `accord init`, so the example is standing proof that what `init` generates is a thing the gates accept (D-146)

### Phase 8: MCP Server — REMOVED

**Status**: removed 2026-09-19. The number is retained and is not reused.

**What it was**: a stateless Streamable HTTP MCP server over the GitHub API with GitHub OAuth, so that a non-technical team member in claude.ai or a tools-only chat client could work the same tickets through the same gates, every write landing as a commit authored by that person. Its requirements were MCP-01 through MCP-07, now Out of Scope in REQUIREMENTS.md.

**Why it was removed**: `.planning/notes/solo-reaim-and-three-layer-done.md` (2026-09-11) re-aimed accord from a team contract to a personal workflow set for the author. The four roles became four stages one person passes through, which left the server with no user — it existed to put accord inside the chat subscription of someone who does not use a coding agent. `03-CONTEXT.md:146`, `04-CONTEXT.md:172`, and `05-CONTEXT.md:165` each carried the decision forward while declining to act on it, because removal is a roadmap-level change. `06-CONTEXT.md` recorded it as **D-117** with the residue named and an owner action attached. This is that action, executed.

**What was not removed**: the `packages/mcp` workspace (OPS-01, shipped in Phase 1) stays as an empty workspace; the core purity guard stays, because isomorphic core is a discipline worth keeping on its own terms; and GATE-05 and GATE-08 keep their "a host that cannot supply this reports it as skipped" clauses, which are already shipped and host-agnostic.

**Reversal cost if the team-contract aim returns**: the requirements text is preserved in REQUIREMENTS.md under Out of Scope and the research questions in `.planning/research/questions.md` are untouched, so reinstating means restoring a phase section, not redoing the analysis.

### Phase 9: Publish and Dogfood

**Goal**: v0.1 is installable with `npx` from npm, and one real ticket passes Ready and Done with the author on a coding agent with the shipped skill.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: OPS-03, OPS-04
**Research**: no (npm trusted publishing documented in STACK.md; the rest is measurement)
**Success Criteria** (what must be TRUE):

  1. The scoped package is published from GitHub Actions via npm trusted publishing with `engines` at Node 22.12 or later, and `npx --yes <scope>/accord --version` works on a clean machine
  2. `accord init` from the published package runs on a real project's repository and the generated CI workflow is green — **NOT MET**: the workflow ran on pull request 1 and failed before reaching a gate (FINDING F-6). Rewording this criterion is open; the facts changed materially from what the 09-08 option (a) ruling assumed
  3. One real ticket reaches Ready and reaches Done on a coding agent, with a fresh-context review's `verification.md` and the developer's `verified` ticks
  4. The time from `new ticket` to Ready is recorded for that ticket, and the token rule is checked against the pilot's real stylesheet before any promotion to error

**Plans**: 9/11 plans executed

Plans:
**Wave 1** *(four parallel plans; no file overlap between them)*

- [x] 09-01-PLAN.md — Tracer: the publishable artifact — core private, the dependency moved to `devDependencies`, `deps.alwaysBundle`, proved by installing the packed tarball (D-150, D-164)
- [x] 09-02-PLAN.md — The emitted CI workflow checks out the pull request's head sha (D-162)
- [x] 09-03-PLAN.md — `packages/cli/README.md` generated from the root README, with a drift test (D-156 defect 1)
- [x] 09-04-PLAN.md — `.github/workflows/publish.yml` and a test that executes its version-check body (D-149, D-152)

**Wave 2** *(blocked on 09-01: never publish a manifest that 404s)*

- [x] 09-05-PLAN.md — npm scope confirmed (owner), the `0.0.0` bootstrap published and installable, the trusted publisher configured (D-151) — **token revocation OUTSTANDING**, see 09-VERIFICATION.md section 7

**Wave 3** *(blocked on Waves 1-2; everything green on `main` first)*

- [x] 09-06-PLAN.md — `@accord-dev/accord@0.1.0` published from run 35581268150 over OIDC with a SLSA provenance attestation, and installable by `npx` on a bare runner (D-157 step 1) — criterion 1 is met

**Wave 4** *(blocked on 09-06: the dogfood runs the published package, never a local build)*

- [x] 09-07-PLAN.md — `accord init` from the published package on branch `readme-1`; `accord/config.yml` byte-identical, the generated `accord.yml` carries the D-162 `ref:` (D-132, D-130) — scaffold committed as `8570852`

**Wave 5**

- [x] 09-08-PLAN.md — `README-1` at Ready in 6 minutes wall-clock, `ac_hash fnv1a64:565100d5d96d1415` (D-156, D-159); criterion 2 ruled option (a) — the check goes red and the reason is the finding

**Wave 6**

- [x] 09-09-PLAN.md — The README rewritten and reviewed by a context that did not write it (D-158); pull request 1 opened, the one D-155 allows, not merged. **Done NOT reached**, for four recorded reasons, and the `accord` check failed on a fifth nobody predicted — FINDING F-6, `npx --yes <pkg>@<version>` runs the workspace rather than the registry when the two match. See 09-VERIFICATION.md sections 3 and 4

**Wave 7**

- [ ] 09-10-PLAN.md — The token measurement in a scratch worktree of `C:/Work/SimplT` (D-153, D-154, D-161, D-163)

**Wave 8**

- [ ] 09-11-PLAN.md — The 40-file `0.1.1` sweep and the second publish (D-157 step 3)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 9. Phase 8 was removed (D-117) and its number is retained rather than reused.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Workspace and Formats | 5/5 | Complete    | 2026-09-06 |
| 2. Core Model and Loading | 7/7 | Complete    | 2026-09-13 |
| 3. Lint | 6/6 | Complete    | 2026-09-14 |
| 4. Gates | 4/4 | Complete    | 2026-09-15 |
| 5. CLI Commands | 6/6 | Complete    | 2026-09-15 |
| 6. Skills | 8/8 | Complete    | 2026-09-17 |
| 7. Scaffolding and Example Repo | 15/15 | Complete    | 2026-09-19 |
| 8. MCP Server | - | Removed | 2026-09-19 |
| 9. Publish and Dogfood | 4/11 | In Progress|  |

---
*Roadmap created: 2026-09-05*
