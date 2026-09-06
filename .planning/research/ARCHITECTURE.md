# Architecture Research

**Domain:** Spec-gate CLI over a Markdown+YAML folder convention, with generated agent skill files and a pluggable tracker adapter
**Researched:** 2026-09-04
**Confidence:** MEDIUM (library APIs verified by running them; runtime skill paths verified against official docs; internal structure is a recommendation, not an observed standard)

## Standard Architecture

There is no established reference architecture for "spec-gate CLI"; the closest relatives (Backlog.md, OpenSpec, markdownlint, cucumber-js) share one shape: **a loader turns files into an in-memory model, pure checkers turn the model into findings, and a thin CLI renders findings and maps them to exit codes.** Accord should follow that shape strictly, because its whole value is that `gate ready` gives the same deterministic answer on a laptop, in an agent session, and in CI.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLI layer (commander): argv → command → render → exit code           │
│  init | new | lint | gate ready | gate done | status | skills sync    │
├──────────────────────────────────────────────────────────────────────┤
│  Application layer (impure, thin)                                     │
│  ┌────────────┐ ┌────────────┐ ┌───────────────┐ ┌────────────────┐  │
│  │ Config     │ │ Loader     │ │ Scaffolder    │ │ Skill generator│  │
│  │ loader     │ │ fs→Snapshot│ │ templates→fs  │ │ canonical→dirs │  │
│  └─────┬──────┘ └─────┬──────┘ └───────────────┘ └────────────────┘  │
│        │              │                                               │
├────────┴──────────────┴───────────────────────────────────────────────┤
│  Core layer (pure functions over RepoSnapshot; no fs, no network)     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Schema   │ │ EARS     │ │ Gherkin  │ │ Prototype│ │ Gate engine│  │
│  │ validate │ │ linter   │ │ extract+ │ │ token    │ │ rules-as-  │  │
│  │ (Ajv)    │ │ (regex)  │ │ parse    │ │ linter   │ │ data       │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └─────┬──────┘  │
│                                                            │          │
│                              Findings[] / GateResult ◄─────┘          │
├──────────────────────────────────────────────────────────────────────┤
│  Tracker adapter (interface; `none` default, `github-issues`)         │
│  Only consulted by `status` and id normalisation; never by gates      │
├──────────────────────────────────────────────────────────────────────┤
│  File system: accord/config.yml, product/, features/, tickets/,       │
│  assets/<id>/prototype.html, tickets/<id>/verification.md (see §Done) │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Config loader | Find the accord root (walk up from cwd), parse `config.yml`, apply defaults, validate against a JSON schema, expose a typed `AccordConfig` | `yaml` + Ajv against `schemas/config.schema.json` |
| Document model | Typed records for `Feature`, `Ticket`, `ProductDoc`, `Verification`, plus `RepoSnapshot` (everything a rule may need, including "does `prototype.html` exist") | Plain TS interfaces; no classes, no methods |
| Loader | Read every file under the root once, split frontmatter from body, extract Gherkin fences, parse `verification.md`, record file existence; produce one immutable `RepoSnapshot` | `gray-matter` for frontmatter, `@cucumber/gherkin` for scenarios; `readdir` + `stat` |
| Schema validation | Validate frontmatter objects against shipped JSON schemas (`ticket.schema.json`, `feature.schema.json`) and return findings with JSON-pointer paths | Ajv compiled once per process; the same schema files are shipped so editors can use them |
| EARS linter | Check each line in a feature's `## Requirements` section against the five EARS patterns; return per-line findings | Five anchored regexes; case-insensitive on keywords, strict on `SHALL` |
| Gherkin extractor + parser | Pull ```` ```gherkin ```` fences from a ticket body, prepend a synthetic `Feature:` line if absent, parse, map parser line numbers back to the Markdown file, return `ScenarioRef[]` (name, keyword, line, step hash) | `Parser` + `AstBuilder` + `GherkinClassicTokenMatcher`; catch `Errors.CompositeParserException` and flatten `.errors[]` |
| Prototype token linter | For `ui: true` tickets: assert `assets/<id>/prototype.html` exists; if `design.tokens` path is configured, flag hard-coded colours/spacing; else require the derivation comment header | Regex over `<style>` and inline `style=` attributes; no CSS AST in v0.1 |
| Gate engine | Given `RepoSnapshot`, ticket id, gate name, profile, ui flag: select applicable rules from a rules table, run them, aggregate into `GateResult` | Pure function `evaluateGate(snapshot, gate, ticketId) → GateResult`; rules are data objects with `id`, `level`, `appliesTo`, `check` |
| Status reporter | For every feature/ticket compute gate state by calling the gate engine; render as table or JSON | Reuses the engine; never re-implements rules |
| Scaffolder | `init` and `new`: copy templates from the package, substitute placeholders, refuse to overwrite unless `--force` | Templates shipped in `templates/`; string substitution only, no template engine |
| Skill generator | Read canonical `accord/skills/<role>/SKILL.md`, write copies to the directories the enabled runtimes scan, insert a "generated, do not edit" marker after the frontmatter | Table of runtime → target dir; copy with optional frontmatter stripping |
| Tracker adapter | Normalise ticket ids/links for the configured tracker, optionally fetch remote status for `status --remote` | Interface + `none` + `github-issues` (GitHub REST via `fetch`) |
| CLI | Parse argv, load config + snapshot, call core, render, set exit code | `commander`; rendering separated from command logic so tests call commands in-process |

## Recommended Project Structure

```
src/
├── cli/                    # commander wiring only; one file per command
│   ├── index.ts            # program definition, global --json / --root flags
│   ├── gate.ts             # accord gate ready|done <id>
│   ├── lint.ts
│   ├── status.ts
│   ├── init.ts
│   ├── new.ts
│   ├── skills.ts           # accord skills sync (regenerate runtime copies)
│   └── render/             # text + JSON renderers for Findings/GateResult/StatusRow
├── config/
│   ├── load.ts             # find root, read config.yml, apply defaults
│   ├── defaults.ts
│   └── types.ts            # AccordConfig
├── model/
│   ├── types.ts            # Feature, Ticket, Verification, ScenarioRef, RepoSnapshot
│   └── findings.ts         # Finding, Level, GateResult
├── load/
│   ├── snapshot.ts         # fs → RepoSnapshot (the only place that reads spec files)
│   ├── frontmatter.ts      # gray-matter wrapper, CRLF normalisation
│   ├── gherkin.ts          # fence extraction + parse + line remap
│   └── verification.ts     # verification.md → Verification
├── lint/
│   ├── schema.ts           # Ajv against shipped schemas
│   ├── ears.ts
│   ├── gherkin.ts          # parse errors + "at least one scenario" shape checks
│   ├── prototype.ts        # token rule
│   ├── ticks.ts            # orphaned / stale QA ticks
│   └── index.ts            # lintSnapshot(snapshot, config) → Finding[]
├── gate/
│   ├── engine.ts           # evaluateGate(snapshot, config, gate, id) → GateResult
│   ├── rules/ready.ts      # rule objects
│   ├── rules/done.ts
│   └── rules/types.ts      # Rule interface, RuleContext
├── status/
│   └── report.ts           # StatusRow[] from snapshot via engine
├── scaffold/
│   ├── init.ts
│   └── new.ts
├── skills/
│   ├── targets.ts          # runtime → directory table
│   └── generate.ts
└── tracker/
    ├── adapter.ts          # interface
    ├── none.ts
    └── github-issues.ts
templates/                  # shipped: config.yml, ticket.md, feature.md, product/*, prototype header, skills/<role>/SKILL.md
schemas/                    # shipped: ticket.schema.json, feature.schema.json, config.schema.json
test/
├── fixtures/               # one complete accord folder per scenario (see Testing)
└── *.test.ts
```

### Structure Rationale

- **`load/` is the only module that touches spec files on disk.** Everything under `lint/`, `gate/`, `status/` takes a `RepoSnapshot` and returns data. That is what makes golden tests trivial and keeps Windows/POSIX differences in one place (path separators, CRLF).
- **`gate/rules/` holds data, not control flow.** Adding the maintain-profile prototype rule is adding an object to a list, not editing an `if` tree. The `status` command and future hub reuse the same list.
- **`schemas/` and `templates/` are shipped package assets**, not TypeScript. The JSON schemas are a deliverable in their own right (PROJECT.md requirement), so validating with the same files avoids two sources of truth.
- **`cli/render/` is separate from command logic** so that `--json` output and text output come from the same result object, and tests assert on the object rather than on ANSI strings.

## Architectural Patterns

### Pattern 1: Rules as data, findings with reasons

**What:** Each gate rule is an object `{ id, gate, level, appliesTo(ctx), check(ctx) → Finding[] }`. The engine filters by `appliesTo` (profile, ui flag, gate), runs `check`, and folds findings into a `GateResult`. A `Finding` always carries `rule`, `level` (`block | warn | info`), `message`, and where possible `file` and `line`.
**When to use:** Always for gates and lint; this is the core of the product.
**Trade-offs:** Slightly more ceremony than inline `if`s; in exchange every rule is individually testable, listable (`accord gate --explain`), and the profile matrix in design.md §5 becomes a table you can read off the code.

**Example:**
```typescript
// gate/rules/types.ts
export type Level = 'block' | 'warn' | 'info';
export interface Finding { rule: string; level: Level; message: string; file?: string; line?: number }
export interface RuleContext { snapshot: RepoSnapshot; config: AccordConfig; ticket: Ticket }
export interface Rule {
  id: string;
  gate: 'ready' | 'done';
  appliesTo: (ctx: RuleContext) => boolean;
  check: (ctx: RuleContext) => Finding[];
}

// gate/rules/ready.ts
export const atLeastOneScenario: Rule = {
  id: 'ready/scenario-present', gate: 'ready',
  appliesTo: () => true,
  check: ({ ticket }) => ticket.scenarios.length > 0 ? [] :
    [{ rule: 'ready/scenario-present', level: 'block', file: ticket.path,
       message: 'Ticket has no Gherkin scenario. A bug fix is written as Given the situation, When the action, Then the correct result.' }],
};

export const prototypeExistsOnMaintain: Rule = {
  id: 'ready/prototype-maintain', gate: 'ready',
  appliesTo: ({ config, ticket }) => ticket.ui && config.profile === 'maintain',
  check: ({ snapshot, ticket }) => snapshot.assets.has(`${ticket.id}/prototype.html`) ? [] :
    [{ rule: 'ready/prototype-maintain', level: 'block', message: `assets/${ticket.id}/prototype.html is required for ui tickets on the maintain profile` }],
};

// gate/engine.ts
export function evaluateGate(snapshot: RepoSnapshot, config: AccordConfig, gate: 'ready' | 'done', id: string): GateResult {
  const ticket = snapshot.tickets.get(id);
  if (!ticket) return { gate, id, status: 'FAIL', findings: [{ rule: 'ticket-missing', level: 'block', message: `tickets/${id}.md not found` }] };
  const ctx = { snapshot, config, ticket };
  const findings = RULES.filter(r => r.gate === gate && r.appliesTo(ctx)).flatMap(r => r.check(ctx));
  return { gate, id, status: findings.some(f => f.level === 'block') ? 'FAIL' : 'PASS', findings };
}
```

Exit codes (CLI layer, not engine): `0` PASS, `1` FAIL (any `block` finding), `2` usage or config error (no accord root, invalid config.yml). Warnings never change the exit code; `--strict` promotes `warn` to `block` for CI if wanted later.

### Pattern 2: Snapshot-first loading

**What:** One `loadSnapshot(rootDir) → RepoSnapshot` call reads every spec file, parses frontmatter and Gherkin, reads each `verification.md`, and records asset existence. Commands then operate on the snapshot only.
**When to use:** All commands except `init`. Per-ticket commands (`gate ready <id>`) still load the whole folder; at the design's stated scale (hundreds of tickets, a few MB) this is milliseconds and removes a whole class of "works for one ticket, wrong in status" bugs.
**Trade-offs:** Slightly slower than lazy loading for a single ticket; irrelevant at this scale. Parse errors become findings on the snapshot (`snapshot.errors`), not exceptions, so one broken file does not hide the others.

**Example:**
```typescript
export interface RepoSnapshot {
  root: string;
  features: Map<string, Feature>;
  tickets: Map<string, Ticket>;
  verifications: Map<string, Verification>;   // keyed by ticket id
  assets: Set<string>;                          // relative paths under assets/
  errors: Finding[];                            // parse-level problems
}
export interface ScenarioRef { name: string; keyword: 'Scenario' | 'Scenario Outline'; line: number; stepsHash: string }
export interface Ticket { id: string; path: string; frontmatter: TicketFrontmatter; body: string; scenarios: ScenarioRef[] }
```

Gherkin lives in the ticket body as fenced blocks:

````markdown
## Acceptance criteria

```gherkin
Scenario: Login works
  Given a registered user
  When they submit valid credentials
  Then they land on the dashboard
```
````

The extractor concatenates all `gherkin` fences, prepends `Feature: <ticket id>` if the first fence lacks one, parses with the classic token matcher, and remaps `location.line` back to the Markdown file. This was verified: `parser.parse(text).feature.children[].scenario` yields `name`, `keyword`, and `location.line`; invalid input throws `Errors.CompositeParserException` whose `.errors[]` carry `.location`. (`GherkinInMarkdownTokenMatcher` also exists and parses `## Scenario:` headings with `* Given` bullets, but that format is unfamiliar to QA and renders without highlighting; fenced blocks are the better contract.)

### Pattern 3: One canonical skill file, copied to runtime directories

**What:** The five role skills live once, in `accord/skills/<name>/SKILL.md`, following the Agent Skills spec (`name` must equal the directory name; `name` and `description` required). `accord init` and `accord skills sync` copy each skill directory into the directories the enabled runtimes scan.
**When to use:** Always; this is the PROJECT.md decision, and research confirms it is now simpler than assumed.

Verified scan paths (official docs, fetched 2026-09-04):

| Runtime | Project-level directories scanned |
|---------|-----------------------------------|
| Claude Code | `.claude/skills/` only |
| Codex CLI | `.agents/skills/` only (explicitly not `.claude/skills`) |
| Cursor | `.agents/skills/`, `.cursor/skills/`, plus `.claude/skills/` and `.codex/skills/` for compatibility |
| GitHub Copilot | `.github/skills/`, `.claude/skills/`, `.agents/skills/` |

**Implication:** with all four runtimes enabled the generator writes exactly two copies, `.claude/skills/accord-<role>/` and `.agents/skills/accord-<role>/`. With only Claude and Cursor enabled, one copy. The "wrapper" concept in PROJECT.md reduces to a copy plus a marker line; there is no per-runtime format to maintain.

**Trade-offs:** Copies can drift if someone edits a generated file; mitigate with a marker after the frontmatter (`<!-- generated by accord from accord/skills/…; run accord skills sync -->`) and a `lint` rule that diffs copies against the canonical source. Frontmatter must start at line 1 (Claude Code ignores it otherwise), so the marker goes after the closing `---`. Claude-only fields (`disable-model-invocation`, `context`, `allowed-tools`) are also honoured by Cursor; Codex and Copilot document only `name`, `description`, `license`. Keep canonical frontmatter to spec fields plus `disable-model-invocation`, and strip anything non-standard when writing to `.agents/skills/`. Do not use symlinks (Windows).

**Example:**
```typescript
// skills/targets.ts
export const RUNTIME_TARGETS: Record<Runtime, string> = {
  claude: '.claude/skills',
  codex: '.agents/skills',
  cursor: '.agents/skills',     // also reads .claude/skills; .agents chosen so codex+cursor share one copy
  copilot: '.agents/skills',    // also reads .claude/skills and .github/skills
};
export function targetDirs(runtimes: Runtime[]): string[] { return [...new Set(runtimes.map(r => RUNTIME_TARGETS[r]))]; }
```

### Pattern 4: Tracker adapter as a narrow, optional interface

**What:** The adapter answers two questions in v0.1: "what does this id look like / link to" and, optionally, "what is the remote status". Gates never call it. `none` is the complete default; it accepts any id string.
**When to use:** From the start, so that `github-issues` is an addition, not a refactor.

**Example:**
```typescript
export interface TrackerAdapter {
  readonly name: 'none' | 'github-issues';
  /** Normalise user input ("42", "#42", full URL) to the canonical id used in tickets/<id>.md; null if malformed. */
  normaliseId(input: string): string | null;
  /** Link shown in status output; undefined for `none`. */
  url?(id: string): string;
  /** Remote status for `status --remote`; adapters without network return undefined. */
  fetchStatus?(id: string): Promise<{ title: string; state: string } | undefined>;
}
export const none: TrackerAdapter = { name: 'none', normaliseId: s => (/^[A-Za-z0-9._-]+$/.test(s) ? s : null) };
```

Design.md §6 keeps status, comments, and estimates in the tracker, so the adapter is read-only in v0.1. Writing (creating issues from `new ticket`) is a later addition behind the same interface.

## Data Flow

### Request Flow

```
argv
  ↓ cli/  (commander)
findRoot(cwd) → loadConfig(root)          config/   (impure)
  ↓
loadSnapshot(root, config)                load/     (impure, single pass)
  ↓ RepoSnapshot
lintSnapshot(snapshot, config)   → Finding[]         lint/   (pure)
evaluateGate(snapshot, config, gate, id) → GateResult  gate/   (pure)
statusReport(snapshot, config)   → StatusRow[]       status/ (pure; calls evaluateGate per ticket)
  ↓
render(result, { json })  → stdout        cli/render/
exitCode(result)          → process.exit
```

`init`, `new`, and `skills sync` are the write path: `templates/` → string substitution → `fs.writeFile` under the root, with an existence check before each write.

### Key Data Flows

1. **`gate ready <id>`:** snapshot → ticket → rules with `gate === 'ready'` filtered by `config.profile` and `ticket.frontmatter.ui` → findings → PASS/FAIL + reasons → exit 0/1.
2. **`gate done <id>`:** snapshot → ticket scenarios (set S), `verification.md` evidence (set E), frontmatter ticks (set T) → three-way set comparison → findings for every missing or orphaned name → PASS only when S = E = T, all evidence results are `pass`, and there are no orphans.
3. **`lint`:** snapshot → every lint module over every document → findings sorted by file and line → exit 1 if any `block`.
4. **`status`:** snapshot → for each ticket run both gates → row `{ id, feature, ui, ready, done, warnings }` → table. Reads ticket files only, per the PROJECT.md decision; `verification.md` is consulted through the done gate, not rendered.
5. **`skills sync`:** `accord/skills/*/SKILL.md` → target dirs for `config.runtimes` → copies with marker.

### Done gate: the three sets

**Ticket frontmatter (owned by BA except `qa`)**

```yaml
---
id: SC-1234
title: Users can log in with email
feature: authentication          # optional on maintain profile
status: in-progress               # doc lifecycle only; tracker remains source of truth for workflow state
owner: ba
ui: true
tracker: { github-issues: 42 }   # map keyed by adapter name; empty for `none`
qa:                               # QA edits this block only
  ticks:
    "Login works":
      by: jane.qa
      on: 2026-09-04
    "Wrong password shows error":
      by: jane.qa
      on: 2026-09-04
---
```

`qa.ticks` is a map keyed by exact scenario name. A map (not a list) makes orphan detection a key-set difference and makes duplicate ticks impossible in YAML. Names containing `:` or `#` must be quoted; the ticket template shows a quoted example.

**`verification.md` (owned by the reviewer agent)** at `accord/tickets/<id>/verification.md`. Keeping it beside the ticket under a per-id directory keeps `tickets/` flat for the loader (`<id>.md` is the ticket; `<id>/` holds attachments) and avoids a naming collision with a ticket named `verification`.

```markdown
---
ticket: SC-1234
reviewer: claude-code           # free text; git author is the real proof
commit: 3f2a9c1
reviewed_on: 2026-09-04
---
## Scenario: Login works
Result: pass
Evidence: `AuthTests.Login_with_valid_credentials_lands_on_dashboard` green in `dotnet test` run at commit 3f2a9c1; manual check of redirect.

## Scenario: Wrong password shows error
Result: pass
Evidence: `AuthTests.Login_with_wrong_password_shows_error`; screenshot rendered on demand, not committed.
```

Parser: each `## Scenario: <name>` H2 opens an entry; the first `Result:` line after it (`pass | fail | blocked`) and the free text under it form the evidence. Headings are readable by humans and trivially parseable; no YAML lists of prose.

**Matching and orphans.** Normalise names by trimming and collapsing internal whitespace; compare case-sensitively (a case-only mismatch produces a `warn` naming both spellings). Then:

| Condition | Finding | Level |
|-----------|---------|-------|
| `s ∈ S`, `s ∉ E` | scenario has no evidence entry | block |
| `s ∈ S`, `s ∉ T` | scenario not ticked by QA | block |
| `e ∈ E`, `e ∉ S` | orphaned evidence (scenario renamed or removed) | block on `gate done`, warn on `lint` |
| `t ∈ T`, `t ∉ S` | orphaned QA tick | block on `gate done`, warn on `lint` |
| `Result` is not `pass` | evidence records failure | block |
| `verification.md` missing | no independent review | block |
| tick `stepsHash` (optional) ≠ current `stepsHash` | scenario text changed after QA ticked | warn |

The last row is cheap insurance: the loader already hashes normalised step text per scenario; if the QA skill records `hash` alongside `by`/`on`, a BA editing steps after sign-off surfaces as a stale tick. Recommended for v0.1 as a warning only; promote to block once the workflow proves it is not noisy.

Scenario Outlines count as one scenario keyed by the outline name (examples are not expanded) in v0.1.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 repo, ≤500 tickets | Whole-folder snapshot per command; no caching. This is v0.1. |
| 1 repo, thousands of tickets | Archive done tickets to `tickets/archive/` (excluded from snapshot) before optimising anything; design.md already plans folding specs into `business-rules.md` at handover. |
| Many repos (the hub) | The hub is a separate repo that imports `load/`, `lint/`, `gate/` as a library. Keeping core pure now is what makes that import possible. Publish the package with a `lib` entry alongside the `bin`. |

### Scaling Priorities

1. **First bottleneck:** Gherkin parsing cost per command if tickets grow into the thousands. Fix: load only `tickets/` needed for per-ticket gates, or cache by mtime. Not before it is measured.
2. **Second bottleneck:** `status --remote` against tracker APIs. Fix: batch requests in the adapter; unrelated to the core.

## Anti-Patterns

### Anti-Pattern 1: Rules that read the file system

**What people do:** `check()` calls `fs.existsSync` for `prototype.html` or reads `verification.md` itself.
**Why it's wrong:** Rules become untestable without fixtures on disk, behave differently on Windows paths, and the hub cannot reuse them.
**Do this instead:** The loader records asset existence and parsed verifications in the snapshot; rules only inspect the snapshot.

### Anti-Pattern 2: Gate state stored in frontmatter

**What people do:** Write `ready: true` into the ticket when the gate passes.
**Why it's wrong:** It is a cache that goes stale the moment a scenario is edited, and an agent can set it by hand, which is the exact failure mode the gate exists to prevent.
**Do this instead:** Gate state is always computed. Only inputs (scenarios, evidence, ticks) are stored.

### Anti-Pattern 3: Per-runtime skill templates

**What people do:** Maintain `skills/claude/…`, `skills/cursor/…`, each slightly different.
**Why it's wrong:** All four runtimes read the same `SKILL.md` standard; the only variation is the directory. Four templates guarantee drift.
**Do this instead:** One canonical skill per role; a directory table; copy with marker; lint rule to detect edited copies.

### Anti-Pattern 4: Gates depending on the tracker

**What people do:** `gate done` checks that the GitHub issue is closed.
**Why it's wrong:** Breaks the `none` adapter, breaks offline CI, and mixes workflow status (tracker-owned) with contract satisfaction (git-owned).
**Do this instead:** Gates read only the folder. Trackers are consulted only by `status --remote`.

### Anti-Pattern 5: Regex Gherkin

**What people do:** Match `^\s*Scenario:` lines instead of parsing.
**Why it's wrong:** Misses `Scenario Outline`, `Rule:` blocks, doc strings, and language dialects; gives no step text for hashing; reports no useful error locations.
**Do this instead:** `@cucumber/gherkin` (verified 42.0.1) is the reference parser, small, and yields names, keywords, lines, and located errors. EARS, by contrast, is a five-pattern line grammar and regex is the correct tool there.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub Issues | `tracker/github-issues.ts` via REST with `fetch` and a token from env (`GITHUB_TOKEN`) | Read-only in v0.1 (`status --remote`); id normalisation accepts `42`, `#42`, issue URLs |
| Agent runtimes | File-system contract only: skill directories listed above | No API calls; verify the directory table again when a runtime ships a change |
| CI | Exit codes; `--json` for machine consumption | `lint` and `gate` are the CI surface; path-filtered per design.md §6 |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `cli/` ↔ core (`lint/`, `gate/`, `status/`) | Direct function calls with plain objects | CLI owns rendering and exit codes; core never prints or exits |
| `load/` ↔ core | `RepoSnapshot` value | Core never imports `fs`; enforce with an ESLint `no-restricted-imports` rule on `src/lint`, `src/gate`, `src/status` |
| `config/` ↔ everything | `AccordConfig` value passed explicitly | No global config singleton; tests construct configs inline |
| `skills/` ↔ `scaffold/` | `init` calls `generateSkills` after scaffolding | Same function backs `accord skills sync` |
| `tracker/` ↔ `status/` | Optional async enrichment | Gate engine has no import path to `tracker/` |

## Suggested Build Order

Ordered so that a real ticket can pass `gate ready` through a published-quality CLI before anything else exists.

| Step | Delivers | Depends on | Vertical-slice check |
|------|----------|------------|----------------------|
| 1 | Package skeleton, `config/`, `model/`, `load/` (frontmatter + Gherkin extraction), `schemas/`, `lint` with schema + Gherkin parse rules | — | `accord lint` reports schema and parse errors on a hand-made folder |
| 2 | `gate/` engine + ready rules (scenario present, ui/profile matrix minus token linting), CLI rendering, exit codes | 1 | `accord gate ready <id>` PASS/FAIL with reasons on a fixture |
| 3 | `scaffold/`: `init`, `new ticket`, `new feature`, templates | 1 | `accord init` on a fresh repo, then `new ticket`, then `gate ready` fails with the right reason, then passes after AC is written — the first dogfood loop |
| 4 | EARS linter, orphan-tick lint | 1 | `lint` complete except prototype rule |
| 5 | `verification.md` loader, done rules, `gate done` | 2 | A ticket goes ready → reviewed → ticked → `gate done` PASS; orphan and missing cases fail |
| 6 | `status/` | 2, 5 | Table across fixtures matches golden output |
| 7 | Canonical skills (5 roles) + generator + `skills sync`; `init` wires it | 3 | Skills appear in Claude Code and Codex from the two copies; each skill's first step runs the gate |
| 8 | Prototype token linter | 2 | ui ticket on maintain profile blocks without `prototype.html`; hard-coded colours flagged when tokens path is set |
| 9 | `tracker/` interface + `none` (from step 1) + `github-issues`; `status --remote` | 6 | `none` behaviour unchanged; GitHub ids normalise and link |
| 10 | Example repo, npm publish (scoped), dogfood on the employer project | all | Milestone criteria in PROJECT.md |

Steps 1–3 are the slice PROJECT.md's milestone needs; step 5 completes the core value. Steps 7 and 9 are the ones most likely to need phase-specific research (runtime directory changes; GitHub auth). Step 8 is the only step with an unproven algorithm (colour/spacing detection heuristics) and should be scoped as a warning-first rule.

## Testing Architecture

- **Fixture repos.** `test/fixtures/<case>/accord/…` each a complete accord folder: `minimal-build`, `minimal-maintain`, `ui-ticket-no-prototype`, `done-all-match`, `done-orphan-tick`, `done-missing-evidence`, `gherkin-parse-error`, `ears-violations`, `skills-drift`. Fixtures are the executable version of design.md §5.
- **Golden results.** For each fixture and command, assert the structured result (`GateResult` / `Finding[]` / `StatusRow[]`) against a checked-in JSON file using Vitest's `toMatchFileSnapshot` (verified: async, plain-file golden, `--update` to regenerate). Assert text rendering in a handful of cases only, since JSON is the contract.
- **In-process command runner.** `runCli(argv, { cwd, stdout, stderr }) → { code, stdout }` so tests never spawn Node; one smoke test spawns the built `bin` on both platforms in CI (GitHub Actions matrix `windows-latest`, `ubuntu-latest`).
- **Write-path tests.** `init` and `new` run against a temp copy of a fixture; assert the resulting tree against a golden directory listing and file contents, then re-run to assert the "already exists" refusal.
- **Skill copies.** After `skills sync`, byte-compare each copy (minus marker) to canonical; optionally run the `skills-ref validate` reference tool from agentskills.io in CI to catch frontmatter drift.
- **Normalisation rules under test.** CRLF fixtures committed with `.gitattributes` `-text` so Windows checkout does not alter them; loader must produce identical snapshots for LF and CRLF inputs.
- **Core purity guard.** ESLint `no-restricted-imports` for `fs`, `path` reads, and `tracker/` inside `src/lint`, `src/gate`, `src/status`.

## Sources

- Agent Skills specification (frontmatter fields, name constraints, directory layout) — https://agentskills.io/specification — MEDIUM (official spec, fetched directly)
- Claude Code skills docs (scans `.claude/skills/` only; extension fields; frontmatter must start at line 1) — https://code.claude.com/docs/en/skills — MEDIUM (official docs, fetched directly)
- Codex skills docs (scans `.agents/skills`, not `.claude/skills`; `$skill-name` invocation) — https://learn.chatgpt.com/docs/build-skills (redirect from developers.openai.com/codex/skills) — MEDIUM (official docs, fetched directly)
- Cursor skills docs (scans `.agents/skills`, `.cursor/skills`, compat `.claude/skills`, `.codex/skills`) — https://cursor.com/docs/context/skills — MEDIUM (official docs, fetched directly)
- GitHub Copilot skills docs (scans `.github/skills`, `.claude/skills`, `.agents/skills`) — https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills — MEDIUM (official docs, fetched directly)
- GitHub changelog: Copilot supports Agent Skills — https://github.blog/changelog/2025-12-18-github-copilot-now-supports-agent-skills/ — LOW (web search summary)
- `@cucumber/gherkin` README via Context7 and local execution of 42.0.1 (Parser/AstBuilder API, `Errors.CompositeParserException`, `GherkinInMarkdownTokenMatcher`) — https://github.com/cucumber/gherkin — MEDIUM (verified by running)
- `gray-matter` README via Context7 (4.0.3; `matter()`, `matter.stringify`) — https://github.com/jonschlinkert/gray-matter — MEDIUM
- Vitest snapshot guide (`toMatchFileSnapshot`) — https://vitest.dev/guide/snapshot.html — LOW (web search; API name confirmed in docs excerpt)
- Internal: `C:/Work/accord/docs/design.md` §2, §5, §6, §7 and `C:/Work/accord/.planning/PROJECT.md` (requirements and decisions the structure must satisfy)

---
*Architecture research for: spec-gate CLI over a Markdown+YAML folder convention*
*Researched: 2026-09-04*
