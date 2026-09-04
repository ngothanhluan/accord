# accord

## What This Is

Accord is a team contract for AI-assisted software delivery: a conventional folder in each repository where BA, designer, developer, and QA record intent, EARS requirements, Gherkin acceptance criteria, and design references before an agent writes code, plus a CLI that checks that contract deterministically. It is an open-source personal project (MIT); the author's employer is the first user, not the owner.

## Core Value

An agent cannot start a story without captured intent and acceptance criteria, and cannot finish one without independent verification against them.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Folder convention with configurable root name, `product/`, `features/`, `tickets/`, `assets/`
- [ ] JSON schema for frontmatter of feature and ticket files
- [ ] Templates for feature file, ticket file, product files, prototype header
- [ ] `config.yml` with profile (`build` | `maintain`), tracker adapter (`none` default), design source, design-token path, role roster
- [ ] CLI `init` scaffolds the folder, config, templates, and skill files
- [ ] CLI `new ticket <id>` and `new feature <slug>`
- [ ] CLI `lint`: frontmatter schema, EARS line check, Gherkin parse, prototype token rule
- [ ] CLI `gate ready <id>` and `gate done <id>` with reasons and exit codes
- [ ] CLI `status` table across features and tickets
- [ ] Role skill files (BA interview, designer attach design, dev implement slice, QA verify, lead readiness review) for Claude Code, Cursor, Copilot, each starting with the CLI gate
- [ ] Independent reviewer workflow producing `verification.md` per ticket
- [ ] Tracker adapter `github-issues`
- [ ] Example repo demonstrating a maintain-profile ticket and a build-profile feature

### Out of Scope

- Hub server (multi-repo mirror, web UI, MCP write, conflict queue) — separate later repo; the convention must prove itself first
- Shortcut, Jira, Linear adapters — after `none` and `github-issues` are solid
- Live collaborative editing (CRDT) — the team edits through discrete agent calls, not simultaneous typing
- Committing images or screenshots — repo weight; prototypes are HTML text
- Ticket status, comments, estimates in git — the tracker remains source of truth

## Context

- Author is a .NET team lead at a small agency (roles BA/Designer/Dev/FE/QA/Lead/Coordinator, tickets in Shortcut, code on GitHub, projects delivered in 2 to 6 weeks then maintained). Built on personal time.
- Research (2026-09-04): no existing tool combines folder SSOT, multi-role workflow, deterministic gates, MCP editing, and conflict approval. Nearest: Backlog.md, BMad, OpenSpec, Decap CMS. A study of 20,574 agent sessions (arXiv 2605.29442) shows instruction-following failure (36%) outweighs underspecified instruction (15%), hence equal investment in the Done gate.
- Full design and decisions log: `docs/design.md`.

## Constraints

- **Tech stack**: CLI in TypeScript, distributed via npx — matches how AI-tool users install things; .NET reserved for the future hub
- **Compatibility**: skill files must work in Claude Code, Cursor, and Copilot without modification
- **Independence**: adapter `none` must be fully usable; nothing may require a tracker or Figma
- **Naming**: npm `accord` is held by an abandoned package; publish scoped unless the name is reclaimed
- **Attribution**: commits authored solely by the author

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Flat files: epic = feature file, story = ticket file | Mirrors trackers, trivial indexing | — Pending |
| Profiles `build` / `maintain` set gate strictness | Rule in config, not per-ticket judgement | — Pending |
| Every code-touching story, including bug fixes, needs ≥1 Gherkin scenario | Bug fixes are where QA most lacks criteria | — Pending |
| AC owned by BA only | Single owner of the contract | — Pending |
| Full CLI in v0.1, not templates only | Deterministic gates counter the dominant failure mode | — Pending |
| Hybrid tracker + git, batched doc PRs | Volume control without abandoning git | — Pending |

---
*Last updated: 2026-09-04 after initial brainstorm*
