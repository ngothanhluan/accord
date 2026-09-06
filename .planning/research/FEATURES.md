# Feature Research

**Domain:** Team-level spec-and-gate tooling for AI-assisted delivery (folder convention + deterministic CLI gates + role skills across four agent runtimes)
**Researched:** 2026-09-04
**Confidence:** MEDIUM overall. Runtime skill-format findings come from first-party docs cross-checked against two or more sources each; the `classify-confidence` seam rates unverified web fetches LOW and Context7 MEDIUM, so tiers below are reported as the seam returns them, with the source type named so the reader can judge.

## Feature Landscape

### Table Stakes (Users Expect These)

Every nearest tool (Spec Kit, OpenSpec, BMad, Kiro, Backlog.md) ships these. Missing one makes Accord feel like a half-tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `init` scaffolds folder + config + templates in one command | Spec Kit `specify init`, OpenSpec `openspec init`, Backlog.md `backlog init`, BMad `npx bmad-method install` all do this; `npx` install is the norm | LOW | Idempotent; never overwrite user-edited files; print what was created |
| Skills installed into the runtime's native location by `init` | Spec Kit and OpenSpec both write slash commands/skills for 30+ agents on init; users expect `/accord-*` to appear without manual copying | MEDIUM | See "Skill format per runtime" below; this is now a copy, not a translation |
| `new ticket` / `new feature` from templates | Backlog.md `task create`, OpenSpec `/opsx:propose`, Kiro spec creation | LOW | Pre-fill frontmatter, `tracker_ids` from arg |
| Frontmatter schema validation with line-numbered errors | OpenSpec `validate`, Backlog.md CLI validation, gherkin-lint; agents ignore vague errors but obey precise ones | LOW | JSON Schema + a YAML parser; report path:line |
| Gherkin parse of AC blocks | Cucumber ecosystem sets the bar; QA teams know `.feature` errors | LOW | Use `@cucumber/gherkin` (official parser) rather than a hand regex |
| Gate commands with exit codes and reasons | OpenSpec `/opsx:verify`, Spec Kit `/speckit.analyze`, Kiro approval gates; CI needs non-zero exit | MEDIUM | `gate ready <id>`, `gate done <id>`; reasons are the product, not the PASS/FAIL |
| `status` overview table | Backlog.md `board`, OpenSpec `list`, Spec Kit checklists | LOW | Reads ticket frontmatter only (decision in PROJECT.md) |
| Profile/config file in the folder | Every tool has one (`.specify/`, `openspec/config`, `.kiro/`, `backlog/config.yml`) | LOW | `config.yml`; validate it too |
| Runs on Windows and POSIX | Author on Windows; Spec Kit had a long tail of Windows path bugs | MEDIUM | Path handling, line endings, no symlinks (Windows needs Developer Mode for symlinks) |
| Human-readable Markdown, no database | Backlog.md, OpenSpec, Spec Kit, Kiro: all plain files in git | LOW | Already decided |
| Agent instructions pointer (`AGENTS.md`/`CLAUDE.md` snippet) | Backlog.md injects guidelines into `AGENTS.md`; Copilot, Cursor, Codex all read `AGENTS.md` natively | LOW | Short pointer: "before touching a ticket, run `/accord-…`"; do not duplicate skill bodies |

### Differentiators (Competitive Advantage)

Nothing in the surveyed set does these. They map directly onto the Core Value (cannot start without intent + AC; cannot finish without independent verification).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Deterministic Done gate: scenario set = evidence set = ticked set | Addresses the 36% instruction-following failure mode; no surveyed tool checks a separate reviewer artifact against QA confirmation | MEDIUM | Three-way set equality on scenario names; mismatches listed by name |
| Separation of duties (builder agent / reviewer agent / QA human) | BMad has role agents but a single operator; Backlog.md has review checkpoints but one actor; Kiro gates are self-approval | MEDIUM | Reviewer skill must refuse to run in the same session that implemented (best effort: prompt instruction + `verification.md` authorship convention) |
| Multi-role skills from one subscription each | BMad simulates roles with one developer; Accord gives the real BA, QA, designer their own workflow in their own tool | MEDIUM | One SKILL.md per role, installed for four runtimes |
| EARS line lint | Kiro uses EARS but does not lint it; Spec Kit has an open feature request (#1356); no npm EARS linter exists | LOW | Regex per pattern; see "EARS lint" section |
| Prototype design-token rule | No spec tool checks prototypes at all | MEDIUM | See "Design-token check" section |
| `build` / `maintain` profiles changing gate strictness | OpenSpec has "profiles" for command sets only; Kiro has feature vs bugfix specs but not team-phase profiles | LOW | Config switch read by `gate` |
| Bug fixes require a scenario | Kiro `bugfix.md` captures current/expected/unchanged; nobody gates on it | LOW | Falls out of the Ready gate |
| `verification.md` as durable evidence in git | Spec Kit/OpenSpec archive specs; none keep a per-story evidence record | LOW | Template + gate check |
| Tracker stays SSOT for status; git holds durable docs | Backlog.md puts status in git (churn); Accord's hybrid avoids doc-PR noise | LOW | `tracker_ids` link only; no status sync |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Web UI / Kanban board | Backlog.md's most visible feature | Duplicates the tracker; becomes a second SSOT; hub-scale work | `status` table now; hub repo later |
| MCP server for editing | Backlog.md, Kiro, Tessl expose MCP | Write path needs conflict handling (ETag, approval queue); doubles surface area for v0.1 | Skills call the CLI via shell; MCP read-only at most, and only after the convention is proven |
| Full task/plan generation (`/plan`, `/tasks`, `/implement`) | Spec Kit and OpenSpec make this the centre | Turns Accord into another single-dev harness; roles already own their harness (OMC, GSD, Kiro) | Ticket file holds a "short plan" field; implementation stays in the developer's harness |
| Role agents with personas | BMad's 12+ agents are its identity | Persona prompts drift, are runtime-specific, and are ignored under load; the study shows compliance, not personality, is the gap | Five procedural SKILL.md files that begin with a CLI gate |
| Hand-written per-runtime wrappers (`.mdc`, `.instructions.md`, `.prompt.md`) | Historically needed | Cursor, Copilot and Codex now read `SKILL.md` natively; wrappers only add drift | Copy the same SKILL.md into the native skills directories (see below) |
| Status / comments / estimates in frontmatter | Backlog.md does it | Tracker already holds them; git churn and merge conflicts | `tracker_ids` link; tracker adapter reads |
| Committing screenshots or Figma exports | Designers ask for it | Repo weight; stale within a sprint | HTML prototype + Figma link |
| Full gherkin-lint / stylelint dependency tree | "Just use the existing linter" | gherkin-lint has 30+ style rules a BA does not care about; stylelint pulls PostCSS plus plugins for a single check | `@cucumber/gherkin` parser + 5 rules; a small PostCSS-free token scanner |
| Live collaborative editing | Teams expect Google-Docs feel | CRDT complexity; edits happen through discrete agent calls | Batched doc PRs (Decap-style branch + PR) |
| Auto-tick scenarios from test results | Sounds like "closing the loop" | Removes the human QA confirmation that the Done gate depends on; agents would self-certify | Reviewer writes evidence; QA ticks; CI can only fail, never tick |

## Skill format per runtime (verified 2026-09-04)

This decides "one SKILL.md or four wrappers". Answer: **one SKILL.md, copied to two directories**. No `.mdc`, `.instructions.md`, or `.prompt.md` wrappers are required.

| Runtime | Native Agent Skills (SKILL.md)? | Project skill directories read | Rule/instruction file (still supported) | Source (date) | Seam tier |
|---------|----------------------------------|--------------------------------|------------------------------------------|---------------|-----------|
| Claude Code | Yes; the standard's origin. `.claude/commands/*.md` merged into skills; skill wins on name clash | `.claude/skills/<name>/SKILL.md`, nested `.claude/skills/` in subdirs, `~/.claude/skills/`. Doc does **not** list `.agents/skills/` | `CLAUDE.md` | https://code.claude.com/docs/en/skills (current) | LOW (webfetch, first-party) |
| Cursor | Yes, since 2.4 (2026-01-22) | `.agents/skills/`, `.cursor/skills/`, plus compatibility `.claude/skills/`, `.codex/skills/` and `~` equivalents | `.cursor/rules/*.mdc` (`description`, `globs`, `alwaysApply`); `AGENTS.md`; `/migrate-to-skills` converts rules and commands to skills | https://cursor.com/docs/skills, https://cursor.com/docs/rules, https://cursor.com/changelog/2-4 | MEDIUM (Context7 + webfetch agree) |
| GitHub Copilot | Yes. Preview 2025-12-18; code review GA 2026-07-29. Surfaces: cloud agent, code review, CLI, app, VS Code + JetBrains agent mode | `.github/skills/`, `.claude/skills/`, `.agents/skills/`; user: `~/.copilot/skills`, `~/.claude/skills`, `~/.agents/skills` | `.github/copilot-instructions.md`; `.github/instructions/*.instructions.md` (`applyTo`, `excludeAgent`); `AGENTS.md`; `.github/prompts/*.prompt.md` still works in VS Code but "agents running on the Agent Host don't use prompt files" and VS Code offers migration to skills | https://docs.github.com/en/copilot/concepts/agents/about-agent-skills, https://code.visualstudio.com/docs/copilot/customization/agent-skills, https://code.visualstudio.com/docs/copilot/customization/prompt-files, https://github.blog/changelog/2025-12-18-github-copilot-now-supports-agent-skills/, https://github.blog/changelog/2026-07-29-copilot-code-review-agent-skills-and-mcp-now-generally-available/ | LOW (webfetch, first-party, 5 sources agree) |
| OpenAI Codex | Yes. Invoke with `$skill-name` or implicit | `.agents/skills/` scanned from cwd up to repo root; `~/.agents/skills`; `/etc/codex/skills`; bundled. Does **not** passively read `.claude/skills/`. Codex 0.147.0 (2026-08-07) can `/import` Cursor-managed skills (active import, not scanning) | `AGENTS.md` (`~/.codex/AGENTS.md`, then `AGENTS.override.md`/`AGENTS.md` from git root to cwd, 32 KiB cap `project_doc_max_bytes`) | https://developers.openai.com/codex/skills (redirects to learn.chatgpt.com/docs/build-skills), https://developers.openai.com/codex/guides/agents-md, Context7 `/llmstxt/learn_chatgpt_llms-full_txt` | MEDIUM (Context7 + websearch agree) |
| Standard | agentskills.io spec, released open by Anthropic 2025-12-18. Adopter list includes all four above plus Gemini CLI, Kiro, OpenCode, Roo, Goose, Junie, Amp, Factory | — | — | https://agentskills.io/specification, https://agentskills.io/ | LOW (webfetch, first-party) |

**Spec frontmatter (portable subset):** `name` (1-64 chars, `a-z0-9-`, must equal directory name), `description` (1-1024), optional `license`, `compatibility`, `metadata`, `allowed-tools` (experimental). Body: Markdown, keep under 500 lines; `scripts/`, `references/`, `assets/` optional. Claude Code documents that claude.ai upload rejects non-spec keys ("Unexpected key(s) in SKILL.md frontmatter") while Claude Code itself accepts its extensions (`disable-model-invocation`, `user-invocable`, `paths`, `context: fork`, `allowed-tools`, `hooks`). Cursor and VS Code document `disable-model-invocation` too; Codex's handling of unknown keys is not documented.

**Implication for Accord `init`:**

1. Canonical source: `accord/skills/<role>/SKILL.md` (spec-only frontmatter).
2. `init` copies each to `.claude/skills/accord-<role>/SKILL.md` (Claude Code, also read by Cursor and Copilot) and `.agents/skills/accord-<role>/SKILL.md` (Codex, Cursor, Copilot). Two copies cover all four runtimes. Symlinks are not an option on Windows without Developer Mode.
3. Mark copies with a `metadata: { accord-generated: "true", accord-version: "x" }` block and a body comment so `init --force` can regenerate them and `lint` can warn on drift (compare hash to canonical).
4. `runtimes:` in config becomes a list of directories to emit into, defaulting to both; a user with only Claude Code can drop `.agents/`.
5. Optional, not required: a one-paragraph pointer in `AGENTS.md` / `CLAUDE.md` / `.github/copilot-instructions.md` ("run `/accord-status` before starting"). These are the only per-runtime files, and they are pointers, not workflows.
6. Skill bodies must reference the CLI by `npx @scope/accord …`, never by a runtime-specific variable such as `${CLAUDE_SKILL_DIR}`, so the same body works in all four.

## EARS lint, Gherkin lint, and the design-token check

### EARS (Mavin, RE'09)

Templates and rules (Wikipedia, alistairmavin.com; tier LOW/websearch, but the patterns are stable since 2009):

| Pattern | Template |
|---------|----------|
| Ubiquitous | `The <system> shall <response>` |
| Event-driven | `When <trigger>, the <system> shall <response>` |
| State-driven | `While <state>, the <system> shall <response>` |
| Unwanted behaviour | `If <trigger>, then the <system> shall <response>` |
| Optional feature | `Where <feature>, the <system> shall <response>` |
| Complex | `While <state>, when <trigger>, the <system> shall <response>` |

Rules a linter can enforce with regex: zero or more preconditions, zero or one trigger, exactly one system name, one or more responses, clauses in the fixed order While → When/If → the system shall, mandatory `shall`. No published npm EARS linter exists (searched 2026-09-04); Spec Kit has an open request (github/spec-kit#1356); Kiro writes EARS in `requirements.md` but does not lint it. Accord's checks per spec line: (1) starts with one of the five keywords or `The`; (2) contains exactly one `shall`; (3) no `should`/`must`/`will`/`may` as the modal; (4) `If` must be followed by `then`; (5) keyword order when combined; (6) optional warning for vague adjectives (fast, easy, appropriate). Complexity LOW.

### Gherkin

Use `@cucumber/gherkin` to parse; it is the reference parser and gives AST positions. gherkin-lint's rule catalogue (README, tier LOW/webfetch) shows what the ecosystem checks; Accord should adopt only the five that matter for AC quality: `no-files-without-scenarios` (≥1 scenario), `no-unnamed-scenarios`, `no-dupe-scenario-names` (scenario names are the join key for the Done gate), `keywords-in-logical-order` (Given/When/Then), `only-one-when`. Skip formatting rules (indentation, trailing spaces, tags). Complexity LOW.

### Design-token check on `prototype.html`

What existing tools check (tier LOW/websearch, multiple sources agree):

- Stylelint core: `color-no-hex`, `color-named`, `declaration-property-value-allowed-list`.
- `stylelint-declaration-strict-value` (`scale-unlimited/declaration-strict-value`): for listed properties (or regex like `/color$/`) the value must be a variable (`var(--x)`, `$sass`, `@less`), with `ignoreValues` for `inherit`/`transparent` and `expandShorthand` for `border`/`margin`.
- Mozilla `no-base-design-tokens`, Shopify Polaris `custom-property-disallowed-list`: forbid raw palette tokens, allow semantic ones.
- Tailwind: `eslint-plugin-tailwindcss` `no-arbitrary-value` flags bracket classes `text-[#ff0000]`, `p-[13px]`; v4 plugin needs `cssConfigPath` pointing at the `.css` config.

In practice for Accord (complexity MEDIUM):

1. `config.yml` `design.tokens: path/to/tokens.css` (or a Tailwind v4 `.css` / v3 `tailwind.config.*`).
2. Load the token file; collect declared `--custom-property` names (regex `--[a-z0-9-]+\s*:`); for Tailwind v4 collect `@theme` variables; for v3 read `theme.colors`/`theme.spacing` keys.
3. Scan `prototype.html`: `<style>` blocks, `style=""` attributes, and `class=""` attributes.
4. Flag: literal colours (`#hex`, `rgb()`, `hsl()`, CSS named colours) on any `*color*`, `background`, `border*`, `fill`, `stroke` property; literal `px`/`rem`/`em` on `margin*`, `padding*`, `gap`, `font-size`, `border-radius` unless inside `var()`; `var(--x)` where `--x` is not declared in the token file; Tailwind arbitrary-value classes `-[…]` when Tailwind detected.
5. No token path configured: require the file to start with `<!-- accord: derived-from: path/one.css, path/two.css -->` and warn if any listed file does not exist.
6. Keep it dependency-light: a tokenizer over declarations is enough; avoid pulling stylelint + PostCSS for one rule. Report as `lint` warnings in `build`, errors in `maintain` (profile decides).

## GitHub Issues adapter (read-only, v0.1)

| Capability | Needed in v0.1? | How |
|-----------|-----------------|-----|
| Resolve `tracker_ids: [123]` ↔ issue | Yes | `gh issue view 123 --json number,title,state,labels,url -R owner/repo` |
| Pull title/labels into `new ticket` | Yes | Same call at scaffold time; write `title:` and `labels:` into frontmatter |
| Show issue state in `status` | Nice | Batched `gh issue list --json` once per run; cache in memory |
| Warn when issue closed but ticket not `done` | Nice | `state == closed` and frontmatter status ≠ done |
| Write anything back | No | Tracker stays SSOT; write path is hub scope |

**Transport decision:** `gh` CLI first, REST fallback, no GitHub App.

- `gh` (verified locally: v2.88.1, 2026-03-12): `gh issue view` exposes `assignees, author, body, closed, closedAt, closedByPullRequestsReferences, comments, createdAt, id, isPinned, labels, milestone, number, projectCards, projectItems, reactionGroups, state, stateReason, title, updatedAt, url`. Reuses the user's existing login, works on private repos, 5,000 req/hr per user. Every Accord user on GitHub already has it. Detect with `gh auth status`.
- REST `GET /repos/{owner}/{repo}/issues/{n}` (docs.github.com): unauthenticated works for public repos (60/hr), `GITHUB_TOKEN` gives 5,000/hr; 301 transferred, 404 no access, 410 deleted. Use in CI where `gh` may be absent; only needs `fetch`.
- GitHub App: installation tokens authenticate as the app, not the user; needs a private key and app registration. Right for the later hub webhook, wrong for a laptop CLI.
- Adapter must degrade: no `gh`, no token, offline → `WARN tracker unavailable`, gates still evaluate local files. Adapter `none` remains fully usable (constraint in PROJECT.md).

## Feature Dependencies

```
[config.yml + schema]
    └──requires──> [folder scaffold (init)]
[lint: frontmatter] ──requires──> [JSON schema]
[lint: EARS] ──requires──> [feature template with spec block]
[lint: Gherkin] ──requires──> [ticket template with AC block] + [@cucumber/gherkin]
[lint: token rule] ──requires──> [config design.tokens] + [prototype header convention]
[gate ready] ──requires──> [lint: Gherkin] + [lint: token rule] + [profile switch]
[gate done] ──requires──> [verification.md template] + [frontmatter tick schema] + [lint: Gherkin]
[status] ──requires──> [gate ready] + [gate done]  (reuses evaluators)
[role SKILL.md files] ──requires──> [gate ready] + [gate done]  (each skill opens with a gate call)
[init writes skills] ──requires──> [role SKILL.md files] + [runtimes config]
[reviewer skill] ──requires──> [verification.md template]
[github-issues adapter] ──enhances──> [new ticket] + [status]
[github-issues adapter] ──requires──> [config tracker section]
[drift check on generated skills] ──enhances──> [init writes skills]
[MCP write] ──conflicts──> [tracker as SSOT] + [batched doc PRs]  (deferred to hub)
```

### Dependency Notes

- **Gates require lint:** a gate is lint plus profile rules plus set comparison; build the lint evaluators as library functions first and reuse them.
- **Skills require gates:** skill bodies are thin and start with `npx accord gate …`; they cannot be tested until the gate exits correctly.
- **Init writes skills requires the runtime finding above:** two target directories, verbatim copies; no template engine needed.
- **Adapter enhances, never gates:** nothing in Ready/Done may depend on the tracker (offline and `none` must pass).

## MVP Definition

### Launch With (v1 = v0.1 milestone)

- [ ] `init` (folder, `config.yml`, templates, skill copies into `.claude/skills/` and `.agents/skills/`) — nothing else is usable without it
- [ ] `new ticket` / `new feature` — first thing a BA does
- [ ] `lint` with frontmatter schema, EARS, Gherkin, token rule, orphan-tick warning — the deterministic core
- [ ] `gate ready` / `gate done` with reasons and exit codes — the Core Value
- [ ] `status` — the only view the lead needs
- [ ] Five role skills + reviewer skill, spec-only frontmatter — needed for the dogfood criterion
- [ ] `github-issues` adapter via `gh` (view title/labels/state) — listed in PROJECT.md; small once `gh` is the transport
- [ ] Windows + POSIX CI matrix — author is on Windows, team is mixed

### Add After Validation (v1.x)

- [ ] Drift check for generated skills (`lint` compares copy hash to canonical) — when a second runtime user edits a copy
- [ ] REST fallback for the adapter — when the first CI-only user appears
- [ ] `disable-model-invocation: true` on gate skills once Codex's unknown-key behaviour is verified — prevents agents self-invoking QA/reviewer skills
- [ ] Gherkin → test skeleton export (Reqnroll, playwright-bdd) — when a team asks; the parser already exists
- [ ] Tailwind v3 config parsing — when a project without CSS variables shows up

### Future Consideration (v2+)

- [ ] Hub (multi-repo mirror, web UI, MCP write, approval queue) — separate repo per design
- [ ] Shortcut / Jira / Linear adapters — after `none` and `github-issues` are solid
- [ ] Decap-style branch-per-edit doc PRs automated by the CLI — needs the hub's GitHub App

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `gate ready` / `gate done` | HIGH | MEDIUM | P1 |
| `lint` (schema, EARS, Gherkin) | HIGH | LOW | P1 |
| `init` with native skill install | HIGH | LOW | P1 |
| Role SKILL.md × 6 | HIGH | MEDIUM | P1 |
| `status` | MEDIUM | LOW | P1 |
| Token rule | MEDIUM | MEDIUM | P1 (maintain profile depends on it) |
| `github-issues` via `gh` | MEDIUM | LOW | P1 |
| Generated-skill drift check | MEDIUM | LOW | P2 |
| REST adapter fallback | LOW | LOW | P2 |
| Test skeleton export | MEDIUM | MEDIUM | P3 |
| Web UI / MCP write | HIGH (perceived) | HIGH | P3 / hub |

## Competitor Feature Analysis

| Feature | Spec Kit 1.0 | OpenSpec | BMad v6 | Kiro | Backlog.md | Decap CMS | Accord |
|---------|--------------|----------|---------|------|------------|-----------|--------|
| Install | `specify init` (Python) | `openspec init` (npm) | `npx bmad-method install` | IDE built-in | `backlog init` (npm) | site config | `npx accord init` |
| Artifacts | `specs/NNN/spec.md, plan.md, tasks.md` + constitution | `openspec/specs` + `changes/<n>/proposal.md, design.md, tasks.md` with ADDED/MODIFIED/REMOVED deltas | PRD, architecture, epics, story files | `requirements.md` (EARS), `design.md`, `tasks.md` | one Markdown task per file, AC checkboxes, DoD | Markdown entries | `product/`, `features/<slug>.md` (EARS), `tickets/<id>.md` (Gherkin), `verification.md` |
| Requirement syntax | free prose | `SHALL` + `#### Scenario:` WHEN/THEN | free prose | EARS (unlinted) | free prose + checkboxes | n/a | EARS linted + Gherkin parsed |
| Validation | `/speckit.analyze`, `/speckit.checklist` (LLM) | `openspec validate` (structure), `/opsx:verify` (LLM) | none (prompts) | phase approvals (human click) | CLI schema | n/a | deterministic `lint` + `gate` with exit codes |
| Roles | single dev | single dev | 12+ persona agents, one operator | single dev | single dev | editor / reviewer / publisher | BA, Designer, Dev, QA, Lead as separate humans with own skills |
| Independent verification | no | no | QA agent (same operator) | no | review checkpoints (same actor) | reviewer approves PR | reviewer agent writes evidence; QA human ticks; gate compares |
| Agent runtimes | 30+ via generated commands/skills | 30+ | multi-host | Kiro only | Claude, Codex, Gemini, Kiro via MCP/AGENTS.md | n/a | Claude Code, Cursor, Copilot, Codex via native SKILL.md |
| Tracker link | `/speckit.taskstoissues` (write) | none | none | none | is the tracker | git branch per entry | read-only `tracker_ids` ↔ issue |
| UI checks | none | none | UX agent (prose) | none | none | n/a | prototype token rule |
| 2026 entrants | Tessl (`.tessl/` tiles, spec registry), specs.md (AI-DLC bolts), GSD (npx meta-prompting) — all single-dev harnesses; none add role separation or deterministic gates | | | | | | |

## Sources

Runtime skill formats (first-party):
- https://agentskills.io/specification and https://agentskills.io/ (spec, adopter list)
- https://code.claude.com/docs/en/skills (Claude Code: locations, frontmatter, commands merged into skills)
- https://cursor.com/docs/skills, https://cursor.com/docs/rules, https://cursor.com/changelog/2-4 (2026-01-22)
- https://docs.github.com/en/copilot/concepts/agents/about-agent-skills; https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions; https://code.visualstudio.com/docs/copilot/customization/agent-skills; https://code.visualstudio.com/docs/copilot/customization/prompt-files; https://github.blog/changelog/2025-12-18-github-copilot-now-supports-agent-skills/; https://github.blog/changelog/2026-07-29-copilot-code-review-agent-skills-and-mcp-now-generally-available/
- https://developers.openai.com/codex/skills (→ learn.chatgpt.com/docs/build-skills); https://developers.openai.com/codex/guides/agents-md; Context7 `/llmstxt/learn_chatgpt_llms-full_txt`; https://www.digitalapplied.com/blog/codex-cli-cross-harness-skill-portability-lock-in (Codex 0.147.0 import, 2026-08-10, secondary)

Competitors:
- https://github.com/github/spec-kit; https://github.com/Fission-AI/OpenSpec; https://github.com/bmad-code-org/BMAD-METHOD; https://kiro.dev/docs/specs/; https://github.com/MrLesk/Backlog.md; https://decapcms.org/docs/editorial-workflows/
- https://www.marktechpost.com/2026/05/08/9-best-ai-tools-for-spec-driven-development-in-2026-kiro-bmad-gsd-and-more-compare/ (2026-05-08); https://specs.md/compare/overview

Linting:
- https://en.wikipedia.org/wiki/Easy_Approach_to_Requirements_Syntax; https://alistairmavin.com/ears/; https://github.com/github/spec-kit/issues/1356
- https://github.com/gherkin-lint/gherkin-lint (rule catalogue); `@cucumber/gherkin` on npm
- https://github.com/AndyOGo/stylelint-declaration-strict-value; https://stylelint.io/user-guide/rules/color-named/; https://firefox-source-docs.mozilla.org/code-quality/lint/linters/stylelint-plugin-mozilla/rules/no-base-design-tokens.html; https://polaris.shopify.com/tools/stylelint-polaris/rules; https://github.com/francoismassart/eslint-plugin-tailwindcss

Tracker:
- Local `gh issue view --help` (gh 2.88.1, 2026-03-12); https://docs.github.com/en/rest/issues/issues; https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api; https://github.com/cli/cli/issues/13433

---
*Feature research for: team spec-and-gate tooling (Accord)*
*Researched: 2026-09-04*
