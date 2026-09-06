# Phase 1: Workspace and Formats - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The repository becomes a three-workspace monorepo (`core`, `cli`, `mcp`) with green CI on Ubuntu and Windows for Node 22 and 24, a two-layer guard that stops `core` from importing Node built-ins, JSON Schema 2020-12 files for ticket frontmatter, `verification.md` frontmatter, and `config.yml`, the folder convention, and the template set. No parsing, lint, gate, or CLI command logic is built here; Phase 2 onwards consumes these formats.

Several requirement texts change as a result of this discussion (listed under "Requirement text updates" below). Updating REQUIREMENTS.md, PROJECT.md, README.md, and `docs/design.md` §2/§4/§5 to match is part of this phase (success criterion 5: "the folder convention is documented").

</domain>

<decisions>
## Implementation Decisions

### Ticket frontmatter (schema `ticket.schema.json`)

- **D-01:** `type: epic | story | bug`. `epic` is a grouping container holding intent and EARS for its children; it is linted but never gated. `story` and `bug` are code-touching: they require at least one tagged scenario and go through Ready and Done. The word `feature` is replaced by `epic` everywhere (REQUIREMENTS, PROJECT.md, design.md). — **Reversibility:** costly — the enum is in the published schema and in every ticket file of every adopting repo.
- **D-02:** `status: draft | open | archived`. Document lifecycle only: `draft` blocks Ready, `open` lets gates evaluate, `archived` is excluded from `status` and gates. Work status (Backlog, In Progress, QA, Done) stays in the tracker. Gate results are never stored in the file.
- **D-03:** The tick field is `verified: [ac-1, ac-2]`: a list of `ac-n` tags, optional, always the last key in frontmatter (BA hunks far from dev hunks, PITFALLS 14). Its owner is the developer, as a human self-test checklist run on the dev environment before the card goes to QA. QA works outside the repo on Shortcut. The Done gate keeps the three-set match: scenario tags == evidence tags in `verification.md` == `verified`. — **Reversibility:** costly — field name is in the schema and in the Done gate contract.
- **D-04:** Full field set: `id` (required, equals the file name `tickets/<id>.md`), `title` (required), `type`, `status`, `parent` (optional id), `tracker` (optional map adapter name → string, e.g. `{ shortcut: "1234" }`), `ui` (boolean, default false), `design` (optional string, Figma URL; a prototype is inferred from `assets/<id>/prototype.html`), `assumptions` (optional list of `{ text, confirmed }`), `ac_hash` (optional string, written at Ready PASS), `verified`. Dropped: `owner`, `feature`, `qa`.
- **D-05:** Strict schema: `additionalProperties: false` at every level. A misspelt key is a schema error, and tracker-owned data such as sprint or priority cannot leak into git. All scalars that are not genuinely boolean are `type: string` (numerics stay strings per STACK.md Decision 2).

### Ticket body and `verification.md`

- **D-06:** `verification.md` lives at `tickets/<id>/verification.md`. Loader rule: `tickets/<id>.md` is the ticket, `tickets/<id>/` holds its appendices, `assets/<id>/` is designer-owned only.
- **D-07:** Fixed English headings in fixed order: `## Intent`, `## Requirements`, `## Acceptance criteria`, `## Open questions`, `## Plan`. The first four are BA-owned; `## Plan` is dev-owned and last. An epic uses the same set without `## Acceptance criteria` and `## Plan`. Extra headings are allowed; lint reports only missing required ones. — **Reversibility:** costly — the Phase 2 fence-aware scanner and every template key on these exact strings.
- **D-08:** Two ticket templates, `ticket-build.md` and `ticket-maintain.md`, with identical structure and schema; they differ only in the guidance comments (Figma link wording for build, prototype wording for maintain). `new ticket` picks by `profile`.
- **D-09:** `verification.md` format: frontmatter `ticket`, `commit`, `reviewed_on` (no `reviewer` field; the git author is the proof), then one `## @ac-n <scenario name>` H2 per scenario, followed by a `Result: pass | fail | blocked` line and an `Evidence:` line whose free text may span several lines. The scenario name after the tag is for humans; matching is by tag. The evidence reference syntax for GATE-04 is decided in Phase 4.
- **D-10:** `product/glossary.md` and `product/business-rules.md` have no frontmatter; they are plain Markdown templates.
- **D-11:** Templates state the ownership rule in their guidance comments: BA-owned sections describe observable behaviour in business language and never name tables, endpoints, libraries, or screens; `## Plan` says "developer fills this in, BA leaves it empty".

### `config.yml` (schema `config.schema.json`)

- **D-12:** The root folder is always `accord/`. Not configurable. FMT-01 drops "configurable"; design.md §2 drops "defaults to the project name". A `.accord` pointer file can be added later as an additive change. — **Reversibility:** reversible — adding configurability later breaks no existing repo.
- **D-13:** `roles` is a list of role ids. Valid values: `ba | dev | designer`. `ba` and `dev` are required; `designer` is optional. `qa` and `lead` are removed: QA works outside the repo, and the lead's readiness review is a step inside the BA skill. Default at `init`: `[ba, dev]`. The roster's only effect is which skills are rendered and copied; it never changes gate results.
- **D-14:** The reviewer is not a roster role. It is a `review.md` reference file inside the `accord-dev` skill. The dev skill's final step opens a fresh agent context (subagent in Claude Code, new chat in Cursor or Codex) and hands it `review.md`; only that fresh context writes `verification.md`; the agent that wrote the code never does. This is procedural, not tool-enforced, so the skill states it plainly. (Phase 6 concern, recorded here because it changes SKILL-01/06/07.)
- **D-15:** `design.source` is dropped; no rule reads it. Only `design.tokens` (path string, empty when the project has no tokens) remains.
- **D-16:** Shape:
  ```yaml
  accord: "0.1.0"            # version pin as a quoted string
  profile: build             # build | maintain
  tracker:
    adapter: none            # none | github-issues
    # repo: owner/name       # required only when adapter is github-issues (schema if/then)
  design:
    tokens: ""
  roles: [ba, dev]
  runtimes: [claude, codex, cursor, copilot]
  ```
  `runtimes` defaults to all four because they resolve to only two copy targets.

### Package layout and naming

- **D-17:** npm scope `@accord-dev`. User-facing package `@accord-dev/accord` (bin `accord`), core `@accord-dev/accord-core`. Registry check on 2026-09-05: `@accord-dev/accord` is unpublished; whether an npm org or user named `accord-dev` already exists could not be verified by script. The author must create the org on npmjs.com before Phase 9; record this as a Phase 9 prerequisite. — **Reversibility:** one-way — the scope is written into every generated CI workflow and `config.yml` pin of every adopting repo.
- **D-18:** Three npm workspaces, not four: `packages/core` (model types, schema validator behind a narrow interface, `schemas/*.json`, `templates/*.md`, role workflow definitions, SKILL.md renderer), `packages/cli` (commander wiring, filesystem loader, bin), `packages/mcp` (private, deploy only). There is no separate `skills` package: its content is pure data that both hosts read, so it belongs with schemas and templates in core. OPS-01 changes from four to three.
- **D-19:** Schemas and templates stay as real files under `packages/core/` so humans and editors can read them, and are imported at build time (JSON import, `?raw` or equivalent for Markdown) so core needs no `fs` at runtime. Core exposes them via `exports` (`./schemas/*`).
- **D-20:** Schema validation sits behind a narrow interface, roughly `validate(schemaId, document) → Finding[]`, with ajv as the first implementation. Nothing outside that module imports ajv, so it can be swapped for `@cfworker/json-schema` if the MCP host spike shows ajv's `new Function` is blocked there. (Folded from the `mcp-host-spike` todo.)

### Planning-time decisions (resolved 2026-09-05 from RESEARCH.md open questions)

- **D-21:** `type` and `status` are required keys in ticket frontmatter alongside `id` and `title`. `ui` stays optional; its default `false` is applied by the loader, not the schema.
- **D-22:** `tracker` may be an empty object `{}`; Phase 3 lint may warn.
- **D-23:** `design` is allowed on all ticket types, including `epic`; gates decide relevance.
- **D-24:** `packages/mcp` in Phase 1 is a `package.json` only (private, depends on core, no `src/`, no scripts) so `--workspaces --if-present` skips it. Phase 8 fills it.
- **D-25:** `ac_hash` is `type: string, minLength: 1` now; Phase 4 tightens the pattern when it picks the hash algorithm. (Research recommendation applied.)
- **D-26:** Schema `$id` uses a placeholder base URI for now; the real stable URL is a Phase 9 prerequisite alongside the npm org. (Research recommendation applied; not blocking.)
- **D-27:** D-19's "`?raw` or equivalent" resolves to a generator script (`scripts/gen-templates.mjs`) that emits a committed `src/generated/templates.ts`, guarded by a drift test; JSON schemas are imported with `with { type: 'json' }`. Research showed rolldown/tsdown 0.23 and vitest do not share a working `?raw` path for `.md` files.

### Claude's Discretion

- CI: one `ci.yml`, matrix `ubuntu-latest`/`windows-latest` × Node 22/24, `fail-fast: false`; jobs install, lint (ESLint including the purity rule), typecheck, test, build.
- Purity guard, two layers: ESLint `no-restricted-imports` in `packages/core` banning `node:*` and bare `fs`, `path`, `child_process`, `os`, `url`, `crypto`; plus a core `tsconfig` with `types: []` and no `@types/node`, so a `node:` import also fails typecheck.
- `id` pattern: `^[A-Za-z0-9][A-Za-z0-9._-]*$`; case-sensitive equality with the file name is a lint concern for Phase 3.
- `tracker` object uses `if/then` in the schema so `repo` is required only for `github-issues`.
- Exact wording of template guidance comments, prototype header comment, and `verification.md` template.

### Folded Todos

- **Spike: prove the core runs on the MCP host and commits through the GitHub API** (`.planning/todos/pending/mcp-host-spike.md`). Only its Phase 1 implication is folded: keep the schema validator behind a narrow interface (D-20). The spike itself stays scheduled after Phase 4.

### Requirement text updates (do in this phase)

| Item | Change |
|---|---|
| FMT-01 | Drop "configurable root name"; root is `accord/` |
| FMT-02 | Field set per D-04; `verified` replaces `qa.ticks`; `type` enum per D-01; `status` per D-02 |
| FMT-06 | Drop "design source"; roster values per D-13 |
| FMT-07 | Templates: `ticket-build.md`, `ticket-maintain.md`, `epic.md`, `glossary.md`, `business-rules.md`, prototype header, `verification.md` |
| OPS-01 | Three workspaces: `core`, `cli`, `mcp` |
| SKILL-01 | Three definitions: `ba`, `dev` (with `review.md`), `designer` |
| SKILL-06, SKILL-07 | Merge: the dev skill runs review in a fresh context; only that context writes `verification.md`; only the developer writes `verified` |
| GATE-02 | Third set is `verified`, owned by the developer |
| GATE-05 | Author-mismatch compares implementation and evidence only; developer ticking their own work is expected |
| PROJECT.md | Key Decisions rows on QA ticks and role count; "feature" → "epic" |
| README.md, `docs/design.md` §2, §4, §5 | Folder tree without `features/`; roles; `verified`; `tickets/<id>/verification.md` |

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product intent and requirements
- `.planning/PROJECT.md` — core value, constraints, key decisions (several rows change per this context)
- `.planning/REQUIREMENTS.md` — FMT-01/02/03/06/07, CORE-01, OPS-01/02 are this phase's scope; text updates listed above
- `docs/design.md` §2 (folder), §3 (profiles), §4 (roles), §5 (gates) — original reasoning; §2 and §4 are superseded where this context differs

### Architecture and stack
- `.planning/research/ARCHITECTURE.md` — layer shape, `RepoSnapshot`, rules-as-data, "Done gate: the three sets", testing architecture, skill copy targets
- `.planning/research/STACK.md` — versions and verified library behaviour; Decision 2 (YAML core schema, numerics as strings), Decision 6 (build, `exports`, `files`), Decision 7 (tests, two-OS matrix). Decision 8 (single package) is superseded by D-18
- `.claude/CLAUDE.md` "Technology Stack" section — same content as STACK.md, loaded every session

### Pitfalls that shape the formats
- `.planning/research/PITFALLS.md` §5 (tag keys), §8 (YAML coercion, CRLF, BOM), §12 (Windows), §14 (BA/dev collision in one file: tick placement, plan placement)

### Todo folded
- `.planning/todos/pending/mcp-host-spike.md` — origin of D-20

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Greenfield: no source code exists. Present: `.gitattributes` (`* text=auto eol=lf`, images binary), `.gitignore` (node_modules, dist, logs, .env, .omc), MIT `LICENSE`, `README.md`, `docs/design.md`.
- `.gitattributes` still needs the `test/fixtures/**/crlf-* -text` line from STACK.md Decision 6 when CRLF fixtures arrive (Phase 2); harmless to add now.

### Established Patterns
- LF-only source on every OS is already enforced by `.gitattributes`.
- `README.md` and `docs/design.md` still describe a `features/` folder and three runtimes; both are out of date relative to PROJECT.md and this context.

### Integration Points
- None yet. Phase 2 loaders will consume `schemas/*.json` and the heading contract (D-07); Phase 5 `new ticket` consumes the two ticket templates (D-08); Phase 6 renders skills from definitions living in `packages/core` (D-18).

</code_context>

<specifics>
## Specific Ideas

- The author's team: Shortcut for tracking, GitHub for code, roles BA / Designer / Dev / QA / Lead. At the git layer only BA (via MCP) and dev (via coding agent) touch files; QA verifies on the dev environment and records results in Shortcut. Gate Done PASS is the condition for moving a card to QA, not for closing it.
- Sample ticket used during discussion (Vietnamese content, English headings) is a good basis for a fixture: frontmatter per D-04, `## Intent` two lines, two EARS lines, two tagged scenarios, one checked open question, empty `## Plan`.
- The BA must never write technical solutions; if an interviewee proposes one, the BA records the desired behaviour instead (BA skill rule for Phase 6).

</specifics>

<deferred>
## Deferred Ideas

- **Ticket dependencies / epic roadmap:** a `depends_on: [id]` field plus ordering semantics in `status` or a gate, so developers do not overlap. New capability; own phase. For v0.1 the epic's `## Plan` holds ordering in prose and Shortcut keeps story relationships.
- **Generated status or index file for fast MCP reads:** rejected. Computed state stored in git is a stale cache and a merge-conflict magnet (ARCHITECTURE anti-pattern 2). If the MCP host spike shows folder fetch is slow, cache by commit SHA server-side instead.
- **Lint that flags technical vocabulary in BA-owned sections:** high false-positive risk; consider after pilot data.
- **Extra JS helper files in adopting repos (GSD-style):** not needed; the CLI in the npm package is the deterministic tool the skills call.

### Reviewed Todos (not folded)
- `mcp-host-spike.md` body (bundling core for a serverless host, GitHub API commit test, folder fetch timing) stays scheduled after Phase 4; only D-20 was taken from it.

</deferred>

---

*Phase: 01-workspace-and-formats*
*Context gathered: 2026-09-05*
