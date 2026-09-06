# Requirements: accord

**Defined:** 2026-09-05
**Core Value:** An agent cannot start a story without captured intent and acceptance criteria, and cannot finish one without independent verification against them.

## v1 Requirements

v1 is the v0.1 milestone: npm publish, MCP deployed, one real ticket through Ready and Done with a non-tech BA on a chat client.

### Formats

- [x] **FMT-01**: Folder convention with fixed root `accord/` containing `product/`, `tickets/`, `assets/<id>/`; no per-epic folder, grouping is `parent:`
- [x] **FMT-02**: Ticket frontmatter validated by a JSON Schema 2020-12 file with `additionalProperties: false`: `id`, `title`, `type` (`epic` | `story` | `bug`), `status` (`draft` | `open` | `archived`), optional `parent`, `tracker` map, `ui`, `design`, `assumptions`, `ac_hash`, `verified`
- [x] **FMT-03**: Tracker links are a map keyed by adapter name, e.g. `tracker: { github-issues: 42 }`
- [ ] **FMT-04**: Acceptance criteria are Gherkin in a fenced `gherkin` block; every scenario carries a unique `@ac-n` tag; a Scenario Outline counts as one scenario
- [ ] **FMT-05**: Requirements are EARS lines in a `## Requirements` section, one requirement per line
- [x] **FMT-06**: `config.yml` with pinned accord version, profile (`build` | `maintain`), tracker adapter (`none` default; `github-issues` requires `repo`), design-token path, role roster (`ba` and `dev` required, `designer` optional), runtimes; validated by its own schema
- [x] **FMT-07**: Templates: `ticket-build.md`, `ticket-maintain.md`, `epic.md`, `glossary.md`, `business-rules.md`, prototype header, `verification.md`
- [ ] **FMT-08**: All generated files are LF and UTF-8 without BOM; readers accept CRLF and BOM input

### Core

- [x] **CORE-01**: Pure core over an immutable `RepoSnapshot`; ESLint bans every `node:*` import inside core
- [ ] **CORE-02**: Frontmatter parsed with `yaml` core schema where numerics stay strings; round-trips comments on tick writes
- [ ] **CORE-03**: Gherkin blocks extracted with line numbers remapped to the Markdown file
- [ ] **CORE-04**: Rules are data (id, gate, level, appliesTo, profile); the build/maintain matrix is one table
- [ ] **CORE-05**: Every finding carries file, line, rule id, and reason; one result object renders to text and JSON
- [ ] **CORE-06**: Fixture repos and JSON goldens cover pass, fail, CRLF, BOM, and Windows path cases

### Lint

- [ ] **LINT-01**: Frontmatter schema errors with path and line
- [ ] **LINT-02**: EARS classifier over the six Mavin templates; unclassifiable lines warn
- [ ] **LINT-03**: Gherkin rules: parse error, missing or duplicate `@ac-n` tag, empty step, at least one scenario on code-touching tickets
- [ ] **LINT-04**: Prototype design-token rule on `prototype.html`, warning-only in v0.1
- [ ] **LINT-05**: Orphaned tick warning when `verified` names a tag with no scenario
- [ ] **LINT-06**: TODO sentinel, unchecked `## Open questions` item, and unconfirmed `assumptions:` entry are detected as findings
- [ ] **LINT-07**: Size warnings: intent over 5 lines, over 15 EARS lines, over 5 scenarios

### Gates

- [ ] **GATE-01**: `gate ready` passes only with valid frontmatter, intent, at least one EARS line, at least one tagged scenario, no LINT-06 findings, and a design reference when the profile requires it; records `ac_hash`
- [ ] **GATE-02**: `gate done` passes only when the scenario tag set, the evidence set in `verification.md`, and `verified` are equal
- [ ] **GATE-03**: `gate done` fails when the AC hash differs from the one recorded at Ready
- [ ] **GATE-04**: Each evidence line must reference a file, test, or command that exists in the snapshot
- [ ] **GATE-05**: Author-mismatch warning when implementation and evidence share a git author; the CLI host supplies authors, the MCP host reports the check as skipped (a developer ticking their own work is expected)
- [ ] **GATE-06**: Exit codes 0 pass, 1 fail, 2 config error; reasons listed by rule; no bypass flag
- [ ] **GATE-07**: Profile `maintain` downgrades token and size rules to warnings; `build` keeps them as configured

### CLI

- [ ] **CLI-01**: `init` scaffolds folder, config, templates, and skill copies; idempotent; never overwrites edited files; prints what it created
- [ ] **CLI-02**: `init` writes a CI workflow that runs `lint` and `gate done` on touched tickets and always reports a job result
- [ ] **CLI-03**: `init` adds a short pointer to `AGENTS.md` and `CLAUDE.md` without duplicating skill bodies
- [ ] **CLI-04**: `new ticket <id>` from the profile's template with tag scaffolding
- [ ] **CLI-05**: `lint`, `gate ready <id>`, `gate done <id>`, `status` with `--json`
- [ ] **CLI-06**: CLI refuses to run when its version differs from the pin in `config.yml`
- [ ] **CLI-07**: Runs on Windows and POSIX; never spawns `npm`, `npx`, or any `.cmd`
- [ ] **CLI-08**: `skills sync` regenerates skill copies with a generated marker and content hash

### Skills

- [ ] **SKILL-01**: One workflow definition per role as data: `ba`, `dev` (with a `review.md` reference for the fresh-context review step), `designer`
- [ ] **SKILL-02**: Renderer produces `SKILL.md` with only the six spec frontmatter fields
- [ ] **SKILL-03**: Copies land in `.claude/skills/accord-<role>/` and `.agents/skills/accord-<role>/`, which cover Claude Code, Cursor, Copilot, and Codex
- [ ] **SKILL-04**: Every skill begins with a lint or gate call and never restates a rule the CLI enforces
- [ ] **SKILL-05**: BA workflow interviews until no open questions remain, writes intent, EARS, Gherkin, glossary, and business rules, and marks the ticket `draft` until then
- [ ] **SKILL-06**: The dev workflow's final step runs the review in a fresh agent context that writes only `verification.md`; the context that wrote the code never writes it
- [ ] **SKILL-07**: Only the developer writes `verified` in frontmatter, as a self-test checklist run on the dev environment before the card goes to QA
- [ ] **SKILL-08**: A test asserts every CLI command named in a skill exists

### MCP server

- [ ] **MCP-01**: Stateless Streamable HTTP server built on the core package
- [ ] **MCP-02**: GitHub OAuth; every commit is authored by the signed-in user
- [ ] **MCP-03**: Snapshot built from the GitHub API and files written through it; no clone, no database
- [ ] **MCP-04**: Tools: `get_workflow`, `list_tickets`, `get_ticket`, `save_ticket`, `lint`, `gate_ready`, `gate_done`, `status`
- [ ] **MCP-05**: `get_workflow` returns the same steps the SKILL.md renders; prompts offered additionally where the client supports them
- [ ] **MCP-06**: `save_ticket` rejects a write when the file changed since it was read
- [ ] **MCP-07**: Deployed to a serverless host and verified from claude.ai and from one tools-only client

### Integration and proof

- [ ] **INTG-01**: `github-issues` adapter is read-only (title, state, labels) over REST `fetch` with a token from `gh auth token` or `GITHUB_TOKEN`; gates never consult it
- [ ] **INTG-02**: Example repo with one maintain-profile ticket and one build-profile ticket passing both gates

### Delivery

- [x] **OPS-01**: Monorepo with npm workspaces: `core`, `cli`, `mcp`
- [x] **OPS-02**: CI on Ubuntu and Windows for Node 22 and 24 from the first commit
- [ ] **OPS-03**: Scoped package published via npm trusted publishing; `engines` at Node 22.12 or later
- [ ] **OPS-04**: One real employer ticket passes Ready and Done with the BA on a chat client over MCP and the developer on a coding agent; time from `new ticket` to Ready recorded

## v2 Requirements

### Adapters and sync

- **INTG-03**: Shortcut adapter, read-only first
- **INTG-04**: Bidirectional sync of ticket body to tracker description

### Skills and gates

- **SKILL-09**: `lint` detects drift between skill copies and their definition
- **SKILL-10**: `disable-model-invocation` on gate skills once Codex's handling of unknown frontmatter keys is verified
- **GATE-08**: Token rule promoted from warning to error in `build` profile after pilot data
- **GATE-09**: Author check in MCP via the GitHub commits API

### Views

- **VIEW-01**: Read-only static dashboard over the GitHub API showing ticket and gate status
- **VIEW-02**: Gherkin to test-skeleton export (Reqnroll, playwright-bdd)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Self-built chat or web editing UI | Accord never holds an API key; the model runs only in the user's own tool |
| Server-side state or database | Git is the single source of truth; every host is a git client over the same core |
| `features/` folder | Feature and ticket are one unit of work; grouping is `parent:` |
| Status, comments, estimates in git | Tracker remains source of truth for those; git churn |
| Auto-ticking from test results | Removes the human QA confirmation the Done gate depends on |
| Full plan or task generation | Roles already own their harness; the ticket holds a short plan only |
| Role personas | Compliance, not personality, is the gap; procedural skills instead |
| Hand-written per-runtime wrappers | All four runtimes read `SKILL.md`; wrappers only add drift |
| Live collaborative editing | Edits happen through discrete agent calls |
| Committing screenshots or Figma exports | Repo weight; HTML prototype plus Figma link instead |
| Jira, Linear adapters | After `none` and `github-issues`; Shortcut first if any |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FMT-01 | Phase 1 | Complete |
| FMT-02 | Phase 1 | Complete |
| FMT-03 | Phase 1 | Complete |
| FMT-04 | Phase 2 | Pending |
| FMT-05 | Phase 2 | Pending |
| FMT-06 | Phase 1 | Complete |
| FMT-07 | Phase 1 | Complete |
| FMT-08 | Phase 2 | Pending |
| CORE-01 | Phase 1 | Complete |
| CORE-02 | Phase 2 | Pending |
| CORE-03 | Phase 2 | Pending |
| CORE-04 | Phase 3 | Pending |
| CORE-05 | Phase 3 | Pending |
| CORE-06 | Phase 2 | Pending |
| LINT-01 | Phase 3 | Pending |
| LINT-02 | Phase 3 | Pending |
| LINT-03 | Phase 3 | Pending |
| LINT-04 | Phase 3 | Pending |
| LINT-05 | Phase 3 | Pending |
| LINT-06 | Phase 3 | Pending |
| LINT-07 | Phase 3 | Pending |
| GATE-01 | Phase 4 | Pending |
| GATE-02 | Phase 4 | Pending |
| GATE-03 | Phase 4 | Pending |
| GATE-04 | Phase 4 | Pending |
| GATE-05 | Phase 4 | Pending |
| GATE-06 | Phase 4 | Pending |
| GATE-07 | Phase 4 | Pending |
| CLI-01 | Phase 7 | Pending |
| CLI-02 | Phase 7 | Pending |
| CLI-03 | Phase 7 | Pending |
| CLI-04 | Phase 5 | Pending |
| CLI-05 | Phase 5 | Pending |
| CLI-06 | Phase 5 | Pending |
| CLI-07 | Phase 5 | Pending |
| CLI-08 | Phase 6 | Pending |
| SKILL-01 | Phase 6 | Pending |
| SKILL-02 | Phase 6 | Pending |
| SKILL-03 | Phase 6 | Pending |
| SKILL-04 | Phase 6 | Pending |
| SKILL-05 | Phase 6 | Pending |
| SKILL-06 | Phase 6 | Pending |
| SKILL-07 | Phase 6 | Pending |
| SKILL-08 | Phase 6 | Pending |
| MCP-01 | Phase 8 | Pending |
| MCP-02 | Phase 8 | Pending |
| MCP-03 | Phase 8 | Pending |
| MCP-04 | Phase 8 | Pending |
| MCP-05 | Phase 8 | Pending |
| MCP-06 | Phase 8 | Pending |
| MCP-07 | Phase 8 | Pending |
| INTG-01 | Phase 5 | Pending |
| INTG-02 | Phase 7 | Pending |
| OPS-01 | Phase 1 | Complete |
| OPS-02 | Phase 1 | Complete |
| OPS-03 | Phase 9 | Pending |
| OPS-04 | Phase 9 | Pending |

**Coverage:**

- v1 requirements: 57 total
- Mapped to phases: 57
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-05*
*Last updated: 2026-09-05 after roadmap creation (traceability populated)*
*Last updated: 2026-09-06 after Phase 1 planning (CONTEXT text updates applied)*
