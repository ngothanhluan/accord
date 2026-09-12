# Roadmap: accord

## Overview

Accord is a team contract for AI-assisted delivery: a folder convention, deterministic gates, role skills for four coding agents, and a remote MCP server for chat clients. The roadmap follows the dependency chain the research identified. Formats and the isomorphic core come first because every host renders over them. Lint and gates follow as pure functions over a snapshot. The CLI is the reference host, the skills wrap the CLI, and the MCP server reuses core and the skill definitions with a GitHub-API loader. The milestone closes only when the scoped package is on npm and one real employer ticket has passed Ready and Done with the BA on a chat client and the developer on a coding agent.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Workspace and Formats** - Monorepo with two-OS CI, core purity guard, JSON schemas, folder convention, and templates (completed 2026-09-06)
- [ ] **Phase 2: Core Model and Loading** - Snapshot to typed tickets, scenarios, and verification with correct line numbers on any line ending or OS
- [ ] **Phase 3: Lint** - Rule engine as data; schema, EARS, Gherkin, token, tick, hygiene, and size findings rendered to text and JSON
- [ ] **Phase 4: Gates** - Ready and Done evaluated deterministically with AC hash, three-set match, evidence check, profile matrix, and exit codes
- [ ] **Phase 5: CLI Commands** - `new ticket`, `lint`, `gate`, `status` on Windows and POSIX with `--json`, version pin, and the `github-issues` adapter
- [ ] **Phase 6: Skills** - One workflow definition per role rendered to SKILL.md for all four runtimes, synced with marker and hash
- [ ] **Phase 7: Scaffolding and Example Repo** - `init` delivers the whole contract in one command; example repo passes both gates in both profiles
- [ ] **Phase 8: MCP Server** - Stateless Streamable HTTP server over the GitHub API with GitHub OAuth, deployed and verified from two chat clients
- [ ] **Phase 9: Publish and Dogfood** - Scoped npm package via trusted publishing; one real employer ticket through Ready and Done

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
**Mode:** mvp
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
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: CORE-04, CORE-05, LINT-01, LINT-02, LINT-03, LINT-04, LINT-05, LINT-06, LINT-07, LINT-08, FMT-09, FMT-10, FMT-11
**Research**: yes (token rule LINT-04 only: colour and spacing detection heuristics, Tailwind v4 `@theme` extraction; all other rules are standard patterns)
**Success Criteria** (what must be TRUE):

  1. A ticket with a schema violation produces a finding naming the JSON path and the line in the file
  2. Each of the six Mavin EARS templates classifies without a warning, and a line that matches none of them warns with its line number
  3. A Gherkin parse error, a missing or duplicate `@ac-n` tag, an empty step, and a code-touching ticket with zero scenarios each produce a finding with its own rule id
  4. A `prototype.html` using a colour or spacing value outside the token file warns and never errors, and a `verified` entry naming a tag with no scenario warns
  5. TODO sentinels, unchecked open questions, unconfirmed assumptions, and oversize intent, EARS, or scenario counts are reported, and the same result object renders to text and to JSON with identical content
  6. A ticket whose `## Plan` steps carry a tag set different from its scenario tag set warns and names the tags missing from each side; equal sets produce no finding, and an empty `## Plan` on a ticket with scenarios warns rather than errors

**Plans**: TBD

### Phase 4: Gates

**Goal**: Ready and Done evaluate deterministically over a snapshot, list reasons by rule, apply the build/maintain matrix, and offer no bypass.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, GATE-06, GATE-07, GATE-08, GATE-09, GATE-10, GATE-11
**Research**: no (rules-as-data and three-set match are established shapes from ARCHITECTURE.md)
**Success Criteria** (what must be TRUE):

  1. `gate ready` passes a fixture only when frontmatter is valid, intent is present, at least one EARS line and one tagged scenario exist, no hygiene finding remains, and a design reference is present where the profile requires it; a pass records `ac_hash`
  2. `gate done` passes only when the scenario tag set, the evidence tag set in `verification.md`, and `verified` are equal, and a mismatch lists which tags are missing from which set
  3. Editing the acceptance criteria after Ready makes `gate done` fail with an AC-changed reason until Ready is re-run
  4. An evidence line naming a file, test, or command absent from the snapshot fails Done; when the host supplies git authors, implementation, evidence, and tick by one author warn; when the host supplies none, the check reports as skipped
  5. Results carry exit codes 0, 1, or 2, the `maintain` profile downgrades token and size rules to warnings, and no flag or option bypasses a gate

**Plans**: TBD

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

**Plans**: TBD

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
  5. Two techniques render alongside the roles and are loaded by them, not invoked as roles: systematic debugging (dev workflow, `type: bug` or any unexpected behaviour) and code review (review context, appended to `verification.md` under `## Review`). Drafts live in `docs/skills/`
  6. The workflows carry the work a general planning system would: the BA skill covers project and epic setup in `build` profile, the dev skill covers planning into `## Plan` and implementation, the review context covers code review, and `accord status` plus the ticket covers resume — no session or handoff file exists anywhere
  7. The dev skill reviews `## Plan` against intent and acceptance criteria in a fresh context before implementing, reading no code and editing only `## Plan`, and a fixture whose plan targets the wrong layer or the wrong order comes back changed

**Scope note**: this is the heaviest phase in the project. Rendering is mechanical; writing four workflows good enough to replace a mature planning system is not. Plan it as content work with a rendering step, not the reverse.

**Plans**: TBD

### Phase 7: Scaffolding and Example Repo

**Goal**: A team runs one command in an empty repository and receives the whole contract: folder, config, templates, skills, agent pointers, and CI. An example repo proves both profiles pass both gates.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: CLI-01, CLI-02, CLI-03, INTG-02
**Research**: no (GitHub Actions workflow emission and idempotent scaffolding are standard patterns)
**Success Criteria** (what must be TRUE):

  1. `accord init` in an empty repo creates the root folder, `config.yml` with the pinned version, templates, and skill copies in both paths, prints every created path, and a second run changes nothing and never overwrites an edited file
  2. The generated GitHub Actions workflow runs `lint` and `gate done` on touched tickets and reports a job result on docs-only and no-ticket diffs
  3. `AGENTS.md` and `CLAUDE.md` receive a short pointer to the accord skills without a copy of any skill body, created when missing and appended when present
  4. The example repo holds one maintain-profile ticket and one build-profile ticket, and both pass `gate ready` and `gate done` in that repo's CI

**Plans**: TBD

### Phase 8: MCP Server

**Goal**: A non-technical team member in claude.ai or a tools-only chat client works the same tickets through the same gates, and every write lands as a commit authored by that person.
**Mode:** mvp
**Depends on**: Phase 6 (needs the workflow definitions and the gate engine; can run in parallel with Phase 7)
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07
**Research**: yes (hosting choice and whether `ajv`, `yaml`, `@cucumber/gherkin` run there; GitHub OAuth App vs GitHub App user-to-server tokens for a stateless server; REST contents vs GraphQL `createCommitOnBranch`; fetching the whole folder per gate call within rate limits; MCP SDK Streamable HTTP and OAuth server API)
**Success Criteria** (what must be TRUE):

  1. A user connects the server from a chat client, signs in with GitHub, and a ticket saved from chat appears in the repository as a commit authored by the signed-in user
  2. `get_workflow` for a role returns the same steps as that role's rendered `SKILL.md`, and clients that support prompts are offered the workflow as a prompt as well
  3. `list_tickets`, `get_ticket`, `lint`, `gate_ready`, `gate_done`, and `status` return the same result objects as the CLI over a snapshot built from the GitHub API with no clone and no database
  4. `save_ticket` refuses a write when the file changed since it was read and tells the user to re-read
  5. The server runs on a serverless host and the tool set is verified from claude.ai and from one tools-only client (ChatGPT developer mode or Codex CLI)

**Plans**: TBD

### Phase 9: Publish and Dogfood

**Goal**: v0.1 is installable with `npx` from npm, and one real employer ticket passes Ready and Done with the BA on a chat client over MCP and the developer on a coding agent with the shipped skill.
**Mode:** mvp
**Depends on**: Phase 7, Phase 8
**Requirements**: OPS-03, OPS-04
**Research**: no (npm trusted publishing documented in STACK.md; the rest is measurement)
**Success Criteria** (what must be TRUE):

  1. The scoped package is published from GitHub Actions via npm trusted publishing with `engines` at Node 22.12 or later, and `npx --yes <scope>/accord --version` works on a clean machine
  2. `accord init` from the published package runs on the employer project's repository and the generated CI workflow is green
  3. One real ticket reaches Ready with the BA working in a chat client over the deployed MCP server, and reaches Done with the developer on a coding agent, a fresh-context review's `verification.md`, and the developer's `verified` ticks
  4. The time from `new ticket` to Ready is recorded for that ticket, and the token rule is checked against the pilot's real stylesheet before any promotion to error

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Phases 7 and 8 both depend only on Phase 6 and may run in parallel.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Workspace and Formats | 5/5 | Complete    | 2026-09-06 |
| 2. Core Model and Loading | 7/7 | In Progress|  |
| 3. Lint | 0/TBD | Not started | - |
| 4. Gates | 0/TBD | Not started | - |
| 5. CLI Commands | 0/TBD | Not started | - |
| 6. Skills | 0/TBD | Not started | - |
| 7. Scaffolding and Example Repo | 0/TBD | Not started | - |
| 8. MCP Server | 0/TBD | Not started | - |
| 9. Publish and Dogfood | 0/TBD | Not started | - |

---
*Roadmap created: 2026-09-05*
