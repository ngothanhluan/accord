# Accord design

Living design document. Captures decisions from the initial brainstorm (2026-09-04) and the research behind them. It will be replaced by real specs once the CLI exists.

The workflow layer — lanes, owner approval, the plan gate, task records, review convergence, the traced-test policy, and re-anchoring after compaction — is specified in [specs/2026-10-12-workflow-layer-design.md](specs/2026-10-12-workflow-layer-design.md). Its contract applies to tickets that carry `lane:`; a ticket without it keeps every rule below.

## 1. Why this exists

Small delivery teams (BA, designer, developer, front-end, QA, team lead, coordinator) adopt AI coding agents and get two recurring failures: features that do not match the intent, and QA with no acceptance criteria to test against.

Existing agent harnesses are single-developer tools. They interview the developer, but the person holding the intent is the BA or the client. The gap is not another agent harness; it is a shared artifact contract between roles.

Research on where agent failures come from changes the design more than anything else. A study of 20,574 real coding-agent sessions (arXiv 2605.29442) reports:

| Failure mode | Share |
|---|---|
| Instruction-following failure (agent had a clear directive, did not comply) | 36% |
| Cannot determine | 27% |
| Underspecified instruction | 15% |
| Premature action (acted before gathering context) | 11% |

Underspecification is real but is not the largest cause. So Accord spends as much on the Done gate (independent verification against acceptance criteria) as on the Ready gate (capturing intent), and it makes the gates deterministic through a CLI rather than leaving them to prompts an agent can ignore.

No existing tool combines folder-as-source-of-truth, multi-role workflow, deterministic gates, MCP editing, and conflict approval in one place. Accord borrows established ideas where they fit: EARS for requirements, a proposal-then-archive lifecycle, a role roster, and branch-based editorial approval.

## 2. Folder convention

The root folder is always `accord/`. It is not configurable; a `.accord` pointer file may be added later as an additive change.

```
accord/
  config.yml                    # version pin, profile, tracker adapter, token path, roles, runtimes
  product/
    glossary.md                 # domain terms
    business-rules.md           # rules, thresholds, rounding, edge cases already decided
  tickets/<id>.md               # one file per epic, story, or bug
  tickets/<id>/verification.md  # review record, written by the fresh review context
  assets/<id>/prototype.html    # designer-owned
```

Flat files, not nested folders. Epics, stories, and bugs share one file type (`type: epic | story | bug`); a story or bug names its epic with `parent:`. An epic holds intent and requirements for its children and is linted but never gated. This mirrors every tracker's model and keeps indexing trivial.

Every ticket has YAML frontmatter validated against `ticket.schema.json`: `id`, `title`, `type`, `status` (`draft | open | archived`, document lifecycle only; work status stays in the tracker), optional `parent`, `tracker` (map keyed by adapter), `ui`, `design`, `assumptions`, `ac_hash`, `priority` (`high | medium | low`, absent means medium), and `verified` (always the last key). Unknown keys are errors, so tracker-owned data cannot leak into git; `priority` is the one such key accord reads, because the dashboard ranks by it.

The body has fixed headings in fixed order: `## Intent`, `## Requirements`, `## Acceptance criteria`, `## Open questions` (BA-owned), then `## Plan` and `## Verification notes` (developer-owned, last). Epics omit Acceptance criteria, Plan, and Verification notes.

`## Verification notes` holds one `### @ac-n` block per ticked scenario, each a line the developer writes themselves naming the logic that makes the scenario correct. It lives in the body rather than in frontmatter because it is the one field guaranteed to be free-form prose, and prose in YAML breaks the parse on the first colon.

Formats:
- Requirements in EARS: `WHEN <trigger> the system SHALL <response>` and its four sibling patterns. Lintable by regex.
- Acceptance criteria in Gherkin. QA reads it, the agent reads it, and it can be turned into test skeletons (Reqnroll for .NET, playwright-bdd for JS).
- Intent is prose, capped short: five lines covering why, for whom, success measure, and explicit non-goals.

Size discipline: intent about 5 lines, spec 5 to 15 EARS lines, 2 to 5 scenarios per story. If the spec is longer than the code, the spec is wrong.

No binary assets in the repo. Prototypes are HTML text. Screenshots are rendered on demand, never committed. Figma stays a link.

## 3. Profiles

`config.yml` declares `profile: build` or `profile: maintain`.

- **build**: a new project, typically 2 to 6 weeks. In week zero the BA writes `product/` and one epic ticket per epic (5 to 10). Acceptance criteria are written per story just before it enters the sprint, not all up front.
- **maintain**: a delivered project receiving individual tickets. Epic tickets are optional. At handover, epic intent and requirements are folded into `product/business-rules.md` and the epics are set to `status: archived`.

Profiles decide what the gates require. The rule lives in config, not in someone's judgement per ticket.

## 4. Roles and ownership

The roster is `roles:` in `config.yml`: `ba` and `dev` are required, `designer` is optional. QA and lead are not roster roles: QA verifies on the dev environment and records results in the tracker; the lead's readiness review is a step inside the BA workflow. The roster only decides which skills are rendered; it never changes a gate result.

- **BA** owns intent, spec, and every acceptance scenario. Only the BA edits acceptance criteria. The lead's readiness review happens inside the BA workflow before Ready.
- **Designer** owns the design link or prototype.
- **Dev / FE** implements from spec, AC, design, and plan only. Never adds a requirement. A gap goes to `## Open questions` and work stops until the BA answers.
- **QA** (outside the repo) tests against the acceptance criteria on the dev environment after Done passes and records the result in the tracker; suggests missing scenarios to the BA, never by editing. AC is the test plan; there is no separate test plan artifact.

The reviewer is not a role. The dev workflow's last step opens a fresh agent context (a subagent in Claude Code, a new chat in Cursor or Codex) and hands it `review.md`; only that fresh context writes `tickets/<id>/verification.md`. The agent that wrote the code never does. This is procedural, not tool-enforced, so the skill states it plainly.

That context does two separable jobs and writes both into the same file. The `## @ac-n` blocks answer whether the change does what the acceptance criteria say. A `## Review` section answers whether what it does is sound — edge cases no scenario covers, business logic invented rather than specified, state and error handling, trust boundaries, reuse missed. Every review finding names a concrete failure: the input or state, and the wrong result that follows. A finding that cannot produce one was a preference and is dropped. The reviewer reports and never edits, since a reviewer that fixes has rejoined the work it was brought in to judge.

Two techniques are loaded by the role workflows rather than invoked as roles of their own: systematic debugging, loaded by `dev` for a `type: bug` ticket or any unexpected behaviour, and code review, loaded by the review context. A bug needs no debugging session file because the ticket is the session.

Role workflows ship as skill files (Claude Code, Cursor, Copilot, Codex) so every member gets the same workflow from their own AI subscription. Each skill starts by running the CLI gate and stops on failure.

Solo use is the same contract with one person. The four roles become four stages the developer and their agent pass through in order, not four people; the roster still decides which skills are rendered, and no gate result changes. Nothing in the gates reads who a person is, which is why the single-person case needs no separate mode.

## 5. Gates

**Ready** (a story may enter the sprint). Applies to every story that touches code, including small bug fixes.

| Check | Owner |
|---|---|
| `## Intent` is not empty: it says what the story is for, in business language | BA |
| `## Requirements` carries at least one EARS line | BA |
| At least one Gherkin scenario. A bug fix is written as Given the situation, When the action, Then the correct result | BA |
| `ui: true` and profile maintain: `prototype.html` exists and was generated from the project's existing styles | Dev or Designer |
| `ui: true` and profile build: a Figma link or a prototype exists | Designer |
| Unchecked `## Open questions` items or unconfirmed `assumptions:` entries block Ready | BA |

Prototype rule: if the repo has design tokens (CSS variables, Tailwind config, a design-system folder; the path is declared in config) the prototype may only use those tokens, and the linter flags hard-coded colours and spacing. If there are no tokens, the prototype must open with a comment listing the stylesheets it was derived from, so a reviewer can check.

Not every ticket has UI. `ui: false` skips the design checks in both profiles.

Lint also warns, and only warns, on vague wording in `## Requirements`, `## Acceptance criteria`, and answered `## Open questions`: "depends", "maybe", "probably", "mix of", "somewhere between", "not sure", "TBD". The words are a regex with false positives, so the finding never blocks Ready; the BA reads it and decides.

**Done** (a story may go to QA). Three layers, each defeating a different lie.

*Machine.* Every scenario not tagged `@ui` carries a `@test:<id>` tag naming the test that proves it. Done fails unless that test is reported passed in the JUnit XML report named by `tests.report` in `config.yml`; the host puts that file into the snapshot and core reads it with a line scanner. A free-text `Evidence:` line never satisfies a non-`@ui` scenario on its own, because an agent can write one without running anything. A `@ui` scenario is exempt and leans on the human layer instead — brittle end-to-end tests get muted, and a muted gate is a decorative gate. A test reported skipped is not passed: muting a test is the cheapest way past a gate, so a skipped `@test:<id>` fails Done exactly as a failed one does. A host with no report available reports the check skipped, as the author check does.

*Fresh context.* The dev workflow's final step opens a fresh agent context that produces `tickets/<id>/verification.md`, one `## @ac-n` block per scenario with `Result:` and `Evidence:`. The agent that wrote the code never writes this file. `Result: blocked` fails Done as `fail` does; a scenario that could not be verified is not verified. The file's `commit:` must equal the commit being gated, so a review of an older commit fails Done until the review is re-run.

*Human.* The developer runs the scenarios on the dev environment, ticks `verified: [ac-1, ...]`, and writes one line per scenario under `## Verification notes` naming the logic that makes it correct. The note must cite a file path or test id that exists in the snapshot (a symbol is never accepted: the gate holds no source text) and must not be the scenario text pasted back; there is no character-count floor, which would only invite padding. Each tick binds to the AC hash and the commit sha, so a tick never survives a change to either.

Done passes only when the scenario tag set, the evidence tag set, and `verified` are the same set, every required test passed, every tick carries a valid note, and the acceptance criteria hash still matches the one recorded at Ready. QA then tests on the dev environment and records the outcome in the tracker. This is the part that addresses the 36% failure mode.

What this cannot do: verify that the developer understood the code. No gate can. It verifies that a human touched the ticket, at the right version, in their own words, per scenario. Claiming more would be theatre.

## 6. Tracker and git: hybrid by durability

The tracker (Shortcut, GitHub Issues, Jira, Linear) remains the source of truth for status, comments, and estimates. Git holds what outlives the ticket: product docs, feature specs, acceptance criteria.

Repo weight is not a storage problem. Five hundred ticket files and a hundred prototypes are a few megabytes; only images are heavy, and images are banned. The real cost is noise: doc PRs mixed with code PRs, notifications, history. Controls:

- Edits made through tooling land on a working branch, one PR per day or per release, squash merged, `docs:` prefix.
- CI path filter: a PR touching only the accord folder does not build; it may auto-merge on BA approval.
- When a ticket is done, its final AC is snapshotted into `tickets/<id>.md` in the release commit so decisions remain searchable months later.

Adapter `none` must be fully usable. The first external users will be solo developers and two-person teams on GitHub Issues.

## 7. CLI

The 0.1.0 commands. The workflow layer's commands are listed in section 9.

TypeScript, distributed via npx, so it fits how AI-tool users already install things. The package name will likely be scoped, since `accord` on npm is held by an abandoned 2022 package.

```
accord init                 # create the folder, config, templates, skill files
accord new ticket [id]      # scaffold tickets/<id>.md; id assigned as <ST|BUG|EP>-<initials>-<n> under people, else required
accord new feature <slug>   # scaffold features/<slug>.md
accord lint                 # frontmatter schema, EARS, Gherkin, prototype token rule
accord gate ready <id>      # PASS or FAIL with reasons; exit code for CI and skills
accord gate done <id>       # checks verification.md and ticked scenarios
accord status               # table of features and tickets with gate state
accord dashboard            # ranked sections for the viewer; --json for the data
accord show <id>            # one lane ticket in full: row facts, Intent, each criterion and its state; --json for the data; --approval prints the approved sections for the owner's yes, criteria compacted
```

When `config.yml` holds `people` (email to initials), `new ticket` assigns the id and refuses a typed one; `legacy_ids` exempts existing tickets, and `lint.id-convention` and `lint.initials-duplicate` check the rest.

The `titles` key of `config.yml` holds the rule a ticket's title follows: `rule` (one line of guidance, default `English, in business language: what the reader gets, not how the code changes`), `max_length` (digits, default 80) and `language` (`english`, the default, refuses a letter outside A-Z and a-z, or `any`). `accord new ticket --title <t>` checks the title against it, writes nothing when it breaks the rule, and prints the rule line (`title rule: ...`) beside every title it is given, so the model reads the rule when it writes the title. The rule is also held at two gates, each only from the release that ships it (`TITLE_RULE_FROM`, never a date): `accord gate ready` refuses a title that breaks it with `gate.ticket-title` for a ticket whose claim pin is not before that release, and `accord lint` reports `lint.ticket-title` (pointer `/title`) for a ticket whose own `ruleset` is not before it. A ticket that exists when the rule ships has an older ruleset or none, so no existing ticket is judged. Both are errors a team may lower through `strictness.levels`; the checks are length, letters and the template's placeholder, never a model call.

`accord new ticket --queue --title <title> --note <line>` queues an idea from any session, a session that works a ticket included: it writes the draft as the only file of one commit on `backlog/<id in lower case>-<date>`, cut from origin's default branch in a temporary worktree, and pushes it, leaving the session's branch and working tree as they were. `queue.merge` in `config.yml` is `owner` (the default) or `at-once` and decides what the `/accord-queue <idea>` skill does with the pull request it opens: under `owner` it leaves the pull request for a person to merge, under `at-once` it merges it at once with the method `git.merge` names, never with admin rights. The commit subject is `commits.subjects.queue`, default `backlog: queue {id}`.

Why a CLI and not just templates and prompts: templates are suggestions and prompts are advice. Both can be ignored by an agent, which is the dominant failure mode. The CLI gives the same deterministic answer on a BA's laptop, inside an agent session, in CI, and later in the hub, from one implementation.

## 8. Out of scope for v0.1

- Hub server (multi-repo mirror, web UI, MCP write, conflict queue). Separate repo, later. Architecture notes for then: git is the database; one GitHub App with a single org-level webhook plus a periodic fetch; ETag on MCP writes for fast-fail conflicts; a human approval queue in a web UI, because MCP elicitation only reaches the connected user.
- Tracker adapters beyond `none` and `github-issues`. Shortcut is the first paid-tracker adapter because the author's team uses it.
- Live collaborative editing. CRDTs solve simultaneous typing; this team edits through discrete agent calls.

## 9. Workflow layer

The contract above says what must be true before and after a ticket. The workflow layer is how a coding agent gets there without drifting from the owner's intent. The full rules are in the [workflow layer spec](specs/2026-10-12-workflow-layer-design.md); this is the map.

**Entry point.** `/accord` with no argument runs `accord dashboard` and shows its output verbatim: YOURS, TEAM, READY, UP NEXT with the unclaimed open tickets that are not ready, EPICS with children done over all children, one count line, and the actions that apply. The CLI ranks every section; the model never reorders or adds to it. `/accord-new <request>` proposes a lane, says why, and starts the intent stage. `/accord-queue <idea>` notes an idea as a draft ticket on its own backlog branch without starting it.

**Routing.** `/accord <text>` routes the text by intent, in the main session, because the CLI cannot judge intent and accord never calls a model. The session says the route out loud ("I read this as a question and will answer it; say so if not"), takes the owner's override, and asks one short question when it is unsure, never defaulting silently; it never chooses a model. The routes are a change (`/accord-new`: lane S or M, a bug whose cause nobody has shown going to `accord-debug` before its approach), a question (answered from the code, with no ticket and no lane proposal), a brainstorm (a Socratic back-and-forth that ends by proposing build now, queue, research or nothing), an idea to queue (`/accord-queue`), research (lane R), a change, drop or merge of an existing ticket (an edit, or `accord drop <id> --reason`), and a review of code or a pull request accord did not build (read-only). A session that works a ticket runs all of them but a change to another ticket: the prompt-expansion hook lets the dashboard, free text, `/accord-queue` and `/accord-upgrade` through, the CLI guard behind it refuses a change, and both refuse `/accord-new`, `/accord-pickup` and a Continue of another ticket with a line ready to copy that opens a new session in the right folder. A session is never moved from one ticket to another.

**Lanes.** The size of the work decides how much each stage does; no lane skips a stage.

- **S, small fix.** Intent is a two-line write-back in chat, the main session does the work, one reviewer pass, and the affected tests must pass. It proceeds without waiting when the request has a concrete anchor and one plausible reading.
- **M, feature.** A ticket with `lane: M`, an owner-approved approach, a checked plan, one fresh executor per task, review to convergence, and an evidence report.
- **L and P** (epics and projects) come later.

Hidden complexity found mid-task lifts the lane; a lane never drops mid-task. A ticket without `lane:` keeps every 0.1.0 rule.

**Stages.** Each is a skill, callable directly or routed to by `/accord`, and each starts with `accord anchor`, which re-reads the ticket's Intent, Vetoes, Decisions, Corrections, and position from git rather than trusting memory.

| Stage | Skill | Ends with |
|---|---|---|
| intent | `accord-intent` | a ticket with Intent, two to five criteria, and Vetoes; ambiguity scored down to 0.2 or less |
| approach | `accord-approach` | a brief of about 15 lines; the owner's yes runs `accord approve`, which writes `approved_hash` |
| plan | `accord-plan` | `tickets/<id>/plan.md`; `accord gate plan` passes and writes `plan_hash:` |
| build | `accord-build` | one ledger line per task, written by `accord task-done` |
| review | `accord-review` | `tickets/<id>/review.md` ending in `verdict: converged` |
| verify | `accord-verify` | `tickets/<id>/verification.md`, the owner's report, and `accord gate done` |

`accord-debug` finds a root cause before any fix, ranks competing hypotheses before testing one, and returns to the stage it interrupted.

**Agents.** Work that must not grade itself runs in fresh agent contexts, installed for the `claude` runtime at `.claude/agents/accord-<role>.md`: `scout`, `auditor`, `critic`, `planner`, `executor`, `reviewer`, `final-reviewer`, `verifier`, `debugger`, and `researcher`. Every agent receives the ticket verbatim, never a summary; an executor gets it inside `accord brief <id> <task>` and never sees chat history. Every agent but the researcher declares its tools; the researcher declares none and withholds every write-capable built-in tool instead (`disallowedTools`: Edit, Write, NotebookEdit, Bash, PowerShell, Monitor, EnterWorktree, ExitWorktree, Artifact, ShareOnboardingGuide, RemoteTrigger, CronCreate, SendMessage, TaskStop, and the agent-dispatch tool, `Agent` and its earlier name `Task`), so it is read-only, it inherits the web tools and any installed library documentation tool, and it is the only agent with web tools. It does not run by default: only the intent stage's discuss step dispatches it, once per library, when a gray area or the ticket turns on an outside library, API or version that the code cannot answer. It writes no file; the discuss step's session writes its reply as the one record per library under `accord/research/`, as `intent/research.md`'s `## Outside sources` says, with a source and the date read for every fact. Agent files render for the `claude` runtime only, so this is a declared parity exception: in a runtime with no `accord-researcher` agent the discuss step tells the session to look the library up itself with its own tools under the same section and to write the record the same way, with no fresh context until backlog 999.11. What stays open, as the owner accepted on 2026-11-18: the researcher keeps the inherited MCP tools (a library documentation tool reaches it only through them), so a write through a write-capable MCP tool is not prevented, and a file it leaves is caught only at review, by the review package's `## Undeclared files` section, once a commit holds it; the agent-dispatch tool is withheld. The executor has Read, Write, Edit, Bash, Grep and Glob and no Skill, MCP or web tool: it reads installed library docs and source through Read and Bash, and when it needs something from outside the repository it stops and returns `NEEDS_CONTEXT` with a question naming what it needs and why, instead of guessing. `accord-build` step 4 and its Rules route that stop as they already route any `NEEDS_CONTEXT`: a question that touches intent, a veto, a criterion or a public interface goes to the owner, and otherwise the main session, which keeps the host's web, MCP and skill tools, decides how to answer it as a Ruling before a fresh executor gets the answer. A new package is still a `BLOCKED` that goes to the owner. Agent files are rendered for the `claude` runtime only.

**Routing.** `models:` in `config.yml` sets each agent's model and effort; an absent entry falls back to the default in the table below, which is `AGENT_DEFAULTS` in `packages/core/src/skills/agents.ts`. `reviewer.final` routes the final reviewer. From the fix round `escalation.fix_round_tier_up` names (default 4), the executor is dispatched one tier higher, in the order `haiku`, `sonnet`, `opus`. `accord skills sync` renders these values into each agent's frontmatter.

| `models:` key | Agent | Default | Why |
|---|---|---|---|
| `scout` | `accord-scout` | haiku, low | Returns facts with file and line, high-volume structured reading where GSD's adaptive profile uses haiku; ST-LN-46's benchmark chose no other arm. |
| `auditor` | `accord-auditor` | opus, high | Finds two readings per criterion; benchmark round 1: low missed Musts on 2 of 5 samples, high found 5 and 2 more Musts than medium, reading a median of 27,565 cached tokens a run, the same as at medium. This repository has run it at high since ST-LN-47 (2026-10-23); the owner chose high as the shipped default on 2026-11-16, and ST-LN-85 raised it from medium on 2026-11-18. |
| `critic` | `accord-critic` | opus, high | Argues against the approach and the plan, where reasoning quality matters most (GSD adaptive: opus for planning); the owner kept it at opus high on 2026-10-25. |
| `planner` | `accord-planner` | opus, high | Drafts the approach and writes plan.md, GSD adaptive's opus role; at medium ST-LN-44's first plan took 5 Must and 14 Should (owner 2026-10-25). |
| `executor` | `accord-executor` | sonnet, high | Builds one task from a brief that spells it out, GSD adaptive's sonnet role; high on the owner's word that medium left more defects for review to catch (2026-10-25), not on a measurement: benchmark round 1 held all 5 samples at low, medium and high, and high read a median of 1,114,624 cached tokens a run against 987,765 at medium, about 13% more. This repository has run it at high since 2026-10-25; the owner chose high as the shipped default on 2026-11-16, and ST-LN-85 raised it from medium on 2026-11-18. |
| `reviewer` | `accord-reviewer` | sonnet, high | Reviews through one lens against a review package, GSD adaptive's sonnet verification role; high is the 2026-10-12 design's starting value, not measured since. |
| `reviewer.final` | `accord-final-reviewer` | opus, high | The last review before verify, where a missed defect costs most; the 2026-10-12 design's starting value, not measured since. |
| `verifier` | `accord-verifier` | sonnet, medium | Checks each criterion against evidence it runs, GSD adaptive's sonnet verifier; medium is the 2026-10-12 design's starting value, not measured since. |
| `debugger` | `accord-debugger` | opus, high | Ranks competing hypotheses for a root cause, where GSD adaptive uses opus. |
| `researcher` | `accord-researcher` | sonnet, high | Looks up outside libraries and returns facts with a source and a date each, the only agent with web tools; sonnet as GSD adaptive's researchers (D-18); high because a wrong sourced fact misleads every later stage, not measured. |

A team overrides any default in `config.yml` under `models:`, one entry per key of the first column. `model` is required; an entry without `effort` keeps the default effort, field by field. An entry wins over a later change of a default, and `accord skills sync` (which `accord upgrade` runs) renders the result into each agent's frontmatter. The defaults were set without a new benchmark: they follow GSD's `adaptive` role split and the evidence shown in the table, benchmark round 1 for the auditor included. A benchmark is reopened only if rounds, findings per round or weighted tokens on real tickets get worse against `docs/benchmark/metrics-v0.4.0.md`.

```yaml
models:
  executor: { model: opus }                  # its effort stays at the default, high
  verifier: { model: sonnet, effort: high }
escalation:
  fix_round_tier_up: 4
```

**Tests.** During build the orchestrator runs `tests.affected`, a command template in `config.yml` with `{files}` replaced by the task's files, then `accord task-done`. The CLI never runs a test command: `task-done` reads only the report `tests.report` names, and refuses one written before the current commit. So the `tests.affected` template must write that report, or every `task-done` refuses it as stale. `tests.full` runs on the plan's baseline before build and again at Done, and writes the same report.

**Done gate.** For a lane ticket `accord gate done` adds the review verdict, a ledger line per task, the approval, no failed case, and no untraced case to the 0.1.0 checks. Its commit match also accepts a later commit when every file changed since the recorded one is the ticket's own record (`accord/tickets/<id>.md` or a file under `accord/tickets/<id>/`) or `accord/product/conventions.md` (ST-LN-8 D-08), so committing the records does not make them stale.

**Hooks.** `init` and `skills sync` write three hooks into `.claude/settings.json`, each one command with no shell syntax, `npx --yes <package>@<version> hook <event>`: `session-start` on startup prints the ruleset and a one-line summary; `session-resume` on resume, clear, and compact prints the ruleset and `accord anchor`; `subagent-start` gives every `accord-*` agent the ruleset. Every other setting and hook in the file is kept. The ruleset is one short shipped text: ask about intent, never guess it; record corrections verbatim; scope is impact; the lightest change that fully works; evidence before claims; one test per criterion; end each reply with what was skipped.

## 10. Decisions log

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
| 2026-09-14 | `Result: blocked` fails Done; a skipped `@test:<id>` is not passed; `verification.md` `commit:` must match the gated commit | Unverified is not verified; muted tests and stale reviews are the cheap ways past a gate |
| 2026-09-14 | Vague-wording lint is warning-only, never blocks Ready | Regex has false positives; the BA decides |
