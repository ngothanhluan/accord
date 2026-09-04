# Accord design

Living design document. Captures decisions from the initial brainstorm (2026-09-04) and the research behind them. It will be replaced by real specs once the CLI exists.

## 1. Why this exists

Small delivery teams (BA, designer, developer, front-end, QA, team lead, coordinator) adopt AI coding agents and get two recurring failures: features that do not match the intent, and QA with no acceptance criteria to test against.

Existing harnesses (OMC, GSD, Spec Kit, OpenSpec, Kiro) are single-developer tools. They interview the developer, but the person holding the intent is the BA or the client. The gap is not another agent harness; it is a shared artifact contract between roles.

Research on where agent failures come from changes the design more than anything else. A study of 20,574 real coding-agent sessions (arXiv 2605.29442) reports:

| Failure mode | Share |
|---|---|
| Instruction-following failure (agent had a clear directive, did not comply) | 36% |
| Cannot determine | 27% |
| Underspecified instruction | 15% |
| Premature action (acted before gathering context) | 11% |

Underspecification is real but is not the largest cause. So Accord spends as much on the Done gate (independent verification against acceptance criteria) as on the Ready gate (capturing intent), and it makes the gates deterministic through a CLI rather than leaving them to prompts an agent can ignore.

Landscape check (2026-09): no tool combines folder-as-source-of-truth, multi-role workflow, deterministic gates, MCP editing, and conflict approval. Closest pieces: Backlog.md (folder + web UI + MCP, single repo), BMad (roles, no tooling), OpenSpec (proposal lifecycle), Decap CMS (branch-based editorial approval, for website content). Accord borrows EARS from Kiro, proposal-then-archive from OpenSpec, the role roster idea from BMad, and the editorial approval model from Decap.

## 2. Folder convention

The root folder name defaults to the project name, `accord/`, and is overridable in config.

```
accord/
  config.yml               # profile, tracker adapter, design source, token path, roles
  product/
    glossary.md            # domain terms
    business-rules.md      # rules, thresholds, rounding, edge cases already decided
  features/<slug>.md       # one file per epic: intent, EARS spec, design link, decisions
  tickets/<id>.md          # one file per story: Gherkin AC, short plan, ui flag
  assets/<id>/prototype.html
```

Flat files, not nested folders. An epic maps to a feature file, a story maps to a ticket file. This mirrors every tracker's model and keeps indexing trivial.

Every file has YAML frontmatter validated against a JSON schema (`status`, `owner`, `tracker_ids`, `ui`, `confirmed_by` on decisions).

Formats:
- Requirements in EARS: `WHEN <trigger> the system SHALL <response>` and its four sibling patterns. Lintable by regex.
- Acceptance criteria in Gherkin. QA reads it, the agent reads it, and it can be turned into test skeletons (Reqnroll for .NET, playwright-bdd for JS).
- Intent is prose, capped short: five lines covering why, for whom, success measure, and explicit non-goals.

Size discipline: intent about 5 lines, spec 5 to 15 EARS lines, 2 to 5 scenarios per story. If the spec is longer than the code, the spec is wrong.

No binary assets in the repo. Prototypes are HTML text. Screenshots are rendered on demand, never committed. Figma stays a link.

## 3. Profiles

`config.yml` declares `profile: build` or `profile: maintain`.

- **build**: a new project, typically 2 to 6 weeks. In week zero the BA writes `product/` and one feature file per epic (5 to 10). Acceptance criteria are written per story just before it enters the sprint, not all up front.
- **maintain**: a delivered project receiving individual tickets. Feature files are optional; an epic tagged `feature` re-enables them. At handover, feature specs are folded into `product/business-rules.md` and archived.

Profiles decide what the gates require. The rule lives in config, not in someone's judgement per ticket.

## 4. Roles and ownership

The roster is configurable. Default: BA, Designer, Dev, QA, Lead. Small teams merge roles.

- **BA** owns intent, spec, and every acceptance scenario. Only the BA edits acceptance criteria.
- **Designer** owns the design link or prototype.
- **Dev / FE** implements from spec, AC, design, and plan only. Never adds a requirement. A gap is written to decisions and work stops until confirmed.
- **QA** tests against AC and ticks scenarios. Suggests missing scenarios by commenting to the BA, never by editing. AC is the test plan; there is no separate test plan artifact.
- **Lead** may ask the BA directly and record the answer in decisions, confirming with the BA when needed. This is a human process; the tool does not gate on who wrote a decision.

Role workflows ship as skill files (Claude Code, Cursor, Copilot) so every member gets the same workflow from their own AI subscription. Each skill starts by running the CLI gate and stops on failure.

## 5. Gates

**Ready** (a story may enter the sprint). Applies to every story that touches code, including small bug fixes.

| Check | Owner |
|---|---|
| At least one Gherkin scenario. A bug fix is written as Given the situation, When the action, Then the correct result | BA |
| `ui: true` and profile maintain: `prototype.html` exists and was generated from the project's existing styles | Dev or Designer |
| `ui: true` and profile build: a Figma link or a prototype exists | Designer |
| Decisions without `confirmed_by`: warning, not a block | Lead |

Prototype rule: if the repo has design tokens (CSS variables, Tailwind config, a design-system folder; the path is declared in config) the prototype may only use those tokens, and the linter flags hard-coded colours and spacing. If there are no tokens, the prototype must open with a comment listing the stylesheets it was derived from, so a reviewer can check.

Not every ticket has UI. `ui: false` skips the design checks in both profiles.

**Done** (a story may reach QA passed). An independent reviewer agent, not the one that wrote the code, produces `verification.md` mapping each scenario to evidence. QA ticks each scenario. An unticked scenario blocks. This is the part that addresses the 36% failure mode.

## 6. Tracker and git: hybrid by durability

The tracker (Shortcut, GitHub Issues, Jira, Linear) remains the source of truth for status, comments, and estimates. Git holds what outlives the ticket: product docs, feature specs, acceptance criteria.

Repo weight is not a storage problem. Five hundred ticket files and a hundred prototypes are a few megabytes; only images are heavy, and images are banned. The real cost is noise: doc PRs mixed with code PRs, notifications, history. Controls:

- Edits made through tooling land on a working branch, one PR per day or per release, squash merged, `docs:` prefix.
- CI path filter: a PR touching only the accord folder does not build; it may auto-merge on BA approval.
- When a ticket is done, its final AC is snapshotted into `tickets/<id>.md` in the release commit so decisions remain searchable months later.

Adapter `none` must be fully usable. The first external users will be solo developers and two-person teams on GitHub Issues.

## 7. CLI

TypeScript, distributed via npx, so it fits how AI-tool users already install things. The package name will likely be scoped, since `accord` on npm is held by an abandoned 2022 package.

```
accord init                 # create the folder, config, templates, skill files
accord new ticket <id>      # scaffold tickets/<id>.md from the template
accord new feature <slug>   # scaffold features/<slug>.md
accord lint                 # frontmatter schema, EARS, Gherkin, prototype token rule
accord gate ready <id>      # PASS or FAIL with reasons; exit code for CI and skills
accord gate done <id>       # checks verification.md and ticked scenarios
accord status               # table of features and tickets with gate state
```

Why a CLI and not just templates and prompts: templates are suggestions and prompts are advice. Both can be ignored by an agent, which is the dominant failure mode. The CLI gives the same deterministic answer on a BA's laptop, inside an agent session, in CI, and later in the hub, from one implementation.

## 8. Out of scope for v0.1

- Hub server (multi-repo mirror, web UI, MCP write, conflict queue). Separate repo, later. Architecture notes for then: git is the database; one GitHub App with a single org-level webhook plus a periodic fetch; ETag on MCP writes for fast-fail conflicts; a human approval queue in a web UI, because MCP elicitation only reaches the connected user.
- Tracker adapters beyond `none` and `github-issues`. Shortcut is the first paid-tracker adapter because the author's team uses it.
- Live collaborative editing. CRDTs solve simultaneous typing; this team edits through discrete agent calls.

## 9. Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-09-04 | Name `accord`, folder defaults to project name | Agreement between roles is the core idea |
| 2026-09-04 | MIT | Adoption over control |
| 2026-09-04 | Flat files, epic = feature file, story = ticket file | Mirrors trackers, easy indexing |
| 2026-09-04 | Profiles `build` and `maintain` decide gate strictness | Rule in config, not in per-ticket judgement |
| 2026-09-04 | Every code-touching story, including bug fixes, needs one scenario | Bug fixes are where QA most often lacks criteria |
| 2026-09-04 | AC owned by BA only; QA tests and comments | Single owner of the contract |
| 2026-09-04 | Figma optional in both profiles; prototype required for UI tickets on maintain | Not every ticket has UI; old projects have no Figma |
| 2026-09-04 | Prototype must follow design tokens when present, else derive from existing CSS | Keeps prototypes honest to the real product |
| 2026-09-04 | Tracker stays source of truth for status; git for durable docs; batched PRs | Volume control without abandoning git |
| 2026-09-04 | Full CLI (init, new, lint, gate, status) in v0.1, TypeScript | Deterministic gates counter the instruction-following failure mode |
| 2026-09-04 | Docs in English | Public project |
| 2026-09-04 | Hub is a separate later repo | Convention must prove itself first |
