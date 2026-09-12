# accord

## What This Is

Accord is a contract for AI-assisted software delivery: a conventional folder in each repository where intent, EARS requirements, Gherkin acceptance criteria, and design references are recorded before an agent writes code, plus a CLI and a remote MCP server that check that contract deterministically, plus the role workflows that carry a ticket from intent to verified. The four roles — BA, designer, developer, reviewer — are four people on a team and four stages for one person working alone; no gate reads who anyone is, so the solo case needs no separate mode. Technical members work through Claude Code, Cursor, Codex, or Copilot; non-technical members work through the AI chat app they already pay for, connected to the same MCP server. It is an open-source personal project (MIT); the author's employer is the first user, not the owner.

## Core Value

accord is the development workflow and the gate that checks it, in one package. An agent cannot start a story without captured intent and acceptance criteria, and cannot finish one without independent verification against them; the workflows that carry a ticket between those two gates ship alongside the gate, so process and check never drift apart.

It replaces a general planning system rather than sitting on top of one. It needs fewer moving parts to do so: a system whose every safety net is another agent reviewing the last must keep adding reviewers, while a deterministic gate absorbs that job once. Four role workflows and two techniques, not thirty agents.

## Milestone: v0.1

v0.1 is done when all three hold:

1. A scoped package is published on npm and installable with `npx`.
2. The MCP server is deployed and reachable from at least one non-technical chat client.
3. One real project at the author's employer runs `accord init`, and at least one real ticket passes a Ready gate and a Done gate, with the BA working through a chat client over MCP and the developer working through a coding agent with the shipped skill.

Publishing without dogfooding, or dogfooding from a local build, does not close the milestone.

## Requirements

### Validated

- ✓ JSON schema for ticket frontmatter (plus `config.yml` and `verification.md` schemas, JSON Schema 2020-12, ajv) — Phase 1
- ✓ Templates for ticket file (build, maintain, epic), product files (glossary, business rules), prototype header, and `verification.md` — Phase 1
- ✓ Core purity: the build fails when `core` imports a `node:*` module — Phase 1
- ✓ CI green on ubuntu-latest and windows-latest for Node 22 and 24 from the first code commit — Phase 1

### Active

**Folder and formats**
- [ ] Folder convention with fixed root `accord/`, `product/`, `tickets/`, `assets/<id>/`; a story or bug names its epic with `parent:`
- [ ] `config.yml` with pinned accord version, profile (`build` | `maintain`), tracker adapter (`none` default), design-token path, role roster, enabled runtimes

**Core**
- [ ] Pure core over a repository snapshot: parse, lint, Ready gate, Done gate, status; no filesystem or network access outside loaders, so the same code runs in Node and in the MCP host

**CLI**
- [ ] `init` scaffolds the folder, config, templates, skill files, and a CI workflow
- [ ] `new ticket <id>`
- [ ] `lint`: frontmatter schema, EARS line check, Gherkin parse, prototype token rule, orphaned `verified` tick warning
- [ ] `gate ready <id>` and `gate done <id>` with reasons and exit codes 0 pass / 1 fail / 2 config error
- [ ] `status` table across tickets
- [ ] Runs on Windows and POSIX; never spawns npm or npx

**Done gate mechanics**
- [ ] The dev workflow's final step opens a fresh agent context that writes `tickets/<id>/verification.md` mapping every scenario to evidence
- [ ] The developer records a per-scenario self-test tick in `verified:` (last frontmatter key); QA verifies on the dev environment and records the result in the tracker; the ticket body (AC) stays BA-only
- [ ] `gate done` passes only when the Gherkin scenario set, the evidence set in `verification.md`, and `verified` all match
- [ ] AC hash recorded at Ready; Done fails if the AC changed since

**Role workflows**
- [ ] One canonical workflow definition per role (BA interview including the readiness review, designer attach design, dev implement slice then fresh-context review), kept as data inside the accord folder
- [ ] Each definition renders to a `SKILL.md` and to the text returned by the MCP `get_workflow` tool, so agent and chat users follow the same steps
- [ ] `init` copies each `SKILL.md` into `.claude/skills/` and `.agents/skills/`, which covers Claude Code, Cursor, Copilot, and Codex; copies are marked generated
- [ ] BA workflow blocks Ready while open questions, unconfirmed assumptions, or TODO markers remain

**MCP server**
- [ ] Stateless remote MCP server (Streamable HTTP) sharing the core package
- [ ] GitHub OAuth; commits are authored by the signed-in user
- [ ] Reads and writes ticket files through the GitHub API, no clone on the server
- [ ] Tools: get workflow for a role, list tickets, get ticket, save ticket, lint, gate ready, gate done, status
- [ ] Role workflow shipped as a tool result, not only as an MCP prompt: ChatGPT, Codex CLI, and Copilot expose MCP tools only; prompts are offered additionally where the client supports them (claude.ai, Claude Code, Cursor, VS Code)
- [ ] Deployable to a serverless host with no database

**Integration and proof**
- [ ] Tracker adapter `github-issues`
- [ ] Example repo demonstrating a maintain-profile ticket and a build-profile ticket

### Out of Scope

- Self-built chat or web UI — the model only ever runs inside the user's own AI tool; accord never holds an API key
- Server-side state or database — git is the single source of truth; every host is a git client over the same core
- Shortcut, Jira, Linear adapters — after `none` and `github-issues` are solid; revisit if dogfooding needs Shortcut
- A separate per-epic folder — epic and story are the same file type; grouping is `parent:`
- Live collaborative editing (CRDT) — the team edits through discrete agent calls, not simultaneous typing
- Committing images or screenshots — repo weight; prototypes are HTML text
- Ticket status, comments, estimates in git — the tracker remains source of truth for those
- Hand-maintained skill files per runtime — one definition per role, rendered; drift is otherwise inevitable

## Context

- Author is a .NET team lead at a small agency (roles BA/Designer/Dev/FE/QA/Lead/Coordinator, tickets in Shortcut, code on GitHub, projects delivered in 2 to 6 weeks then maintained). Built on personal time. Develops on Windows. The author is the first user; a non-technical BA at the employer is the second.
- Team members hold individual Claude, ChatGPT/Codex, or Copilot subscriptions, not API keys. A subscription cannot power a third-party app, so the model must run in the user's own tool and accord must meet it there through skills (coding agents) and a remote MCP server (chat apps). See `.planning/notes/non-tech-frontend.md` for the options rejected.
- Research (2026-09-04): no existing tool combines folder SSOT, multi-role workflow, deterministic gates, and MCP editing. Nearest: Backlog.md, BMad, OpenSpec, Decap CMS. A study of 20,574 agent sessions (arXiv 2605.29442) shows instruction-following failure (36%) outweighs underspecified instruction (15%), hence equal investment in the Done gate.
- Research (2026-09-04): all four coding runtimes read the Agent Skills `SKILL.md` format; Claude Code reads `.claude/skills/`, Codex reads `.agents/skills/`, Cursor and Copilot read both. Output must be LF-only.
- The Done gate's separation of duties: builder agent, reviewer agent, and QA human are three parties. Evidence (reviewer) and confirmation (QA) live in different files with different owners so an agent cannot pre-tick. Git commit author is the real proof of who ticked, which is why the MCP server must commit as the signed-in user, not as a bot.
- Research (2026-09-05, researcher-cited official docs): Anthropic forbids routing Pro/Max credentials through third-party apps, so the no-key constraint is grounded. Remote MCP with OAuth: claude.ai custom connectors on every plan incl. Free, tools + prompts + resources; ChatGPT developer mode on Plus/Pro, web only, tools only; Codex CLI via `codex mcp login`, tools only; Claude Code, Cursor, VS Code Copilot Chat support tools + prompts; Copilot coding agent and github.com chat do not support OAuth remote MCP. Unverified: ChatGPT sign-in for third-party apps, Codex cloud MCP. Sources in `.planning/research/questions.md`.
- Full design and decisions log: `docs/design.md`.

## Constraints

- **Tech stack**: TypeScript monorepo — `core` (pure), `cli`, `mcp`; skill definitions live in `core` as data; distributed via npx — matches how AI-tool users install things
- **Isomorphic core**: core must not import `node:fs` or `node:child_process` outside loaders — the MCP host has no filesystem
- **No API keys**: accord never calls a model itself — team members have subscriptions, not keys
- **Compatibility**: skill workflows must produce identical behaviour in Claude Code, Cursor, Copilot, and Codex — one definition per role, rendered
- **Cross-platform**: CLI must run on Windows and POSIX — author develops on Windows; teams are mixed
- **Independence**: adapter `none` must be fully usable; nothing may require a tracker or Figma
- **Naming**: npm `accord` is held by an abandoned package; publish scoped unless the name is reclaimed
- **Attribution**: commits authored solely by the author

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Epic, story, and bug are one file type (`type:`); `parent:` groups | Mirrors trackers; one schema, one folder | ✓ Phase 1: `ticket.schema.json` enforces the `type` enum, `parent` optional on every type |
| Profiles `build` / `maintain` set gate strictness | Rule in config, not per-ticket judgement | — Pending |
| Every code-touching story, including bug fixes, needs ≥1 Gherkin scenario | Bug fixes are where QA most lacks criteria | — Pending |
| AC owned by BA only | Single owner of the contract | — Pending |
| Full CLI in v0.1, not templates only | Deterministic gates counter the dominant failure mode | — Pending |
| Hybrid tracker + git, batched doc PRs | Volume control without abandoning git | — Pending |
| Developer self-test ticks (`verified`) live in ticket frontmatter; evidence in `tickets/<id>/verification.md` written by a fresh review context; QA records in the tracker | Evidence and confirmation in separate files with separate owners; git author is the proof; QA works where the team already works | — Pending |
| One workflow definition per role, rendered to SKILL.md and MCP prompt | 4 runtimes × 3 roles hand-written would drift; chat and agent users must follow identical steps | — Pending |
| `init` copies SKILL.md into `.claude/skills/` and `.agents/skills/` | Verified: those two paths cover all four runtimes; no per-runtime wrappers needed | — Pending |
| Codex added as fourth target runtime | Team members use it | — Pending |
| Git is the only source of truth; no server-side state | Every host is a git client over the same core; hub as a separate product dropped | — Pending |
| Remote MCP server is the non-tech frontend | Members have chat subscriptions, not API keys; accord goes into their tool instead of hosting a model | — Pending |
| No API keys anywhere in accord | Subscriptions cannot power a third-party app; avoids cost and secret handling | — Pending |
| Monorepo `core` / `cli` / `mcp` | Core must run in Node and in the MCP host; one repo keeps them in lockstep; skill definitions are data both hosts read, so they live in core | ✓ Phase 1: `core` and `cli` workspaces live with a purity guard; `mcp` added in Phase 8 |
| Public docs name no other tools or harnesses | Positioning stands on its own; comparisons date quickly and invite argument | ✓ Phase 1 UAT (2026-09-06): README and design.md rewritten without tool names |
| Templates carry no project-internal notes | A BA or developer using a template must not see accord phase numbers or planning references | ✓ Phase 1 UAT: `verification.md` and `epic.md` guidance cleaned |
| v0.1 = npm publish + MCP deployed + one real ticket through both gates with a non-tech BA on a chat client | Publishing alone proves nothing; the non-tech path is the risky one | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-06 after Phase 1 transition (schemas, templates, purity guard, and two-OS CI validated)*
