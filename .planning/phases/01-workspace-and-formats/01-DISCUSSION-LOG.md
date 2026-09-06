# Phase 1: Workspace and Formats - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-05
**Phase:** 1-workspace-and-formats
**Areas discussed:** Ticket frontmatter fields and enums, Ticket body layout and verification.md location, config.yml shape, Package layout and npm naming

---

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| Fold the constraint, keep the spike after Phase 4 | Validator behind a narrow interface so ajv can be swapped | ✓ |
| Do not fold | Leave the todo untouched | |

**User's choice:** Fold the constraint only.

---

## Ticket frontmatter: fields and enums

### `type` enum

| Option | Description | Selected |
|--------|-------------|----------|
| `feature \| story \| bug`, feature not gated | Container plus two code-touching types | ✓ (renamed) |
| `story \| bug` only | Grouping by `parent:` alone | |
| Add `chore \| spike \| docs` exempt types | Types that pass Ready without scenarios | |

**User's choice:** Option 1, with `feature` renamed to `epic`.
**Notes:** User asked how feature differs from story; explained container vs deliverable slice and that gating the container would force Gherkin at week zero on the build profile.

### `status` enum

| Option | Description | Selected |
|--------|-------------|----------|
| `draft \| open \| archived` | Document lifecycle only | ✓ |
| `draft \| open` | Archive by moving files | |
| Mirror tracker columns | Duplicates Shortcut state | |

**User's choice:** Option 1.
**Notes:** User asked how this relates to their Shortcut workflow; explained work status (tracker) vs document status (file) and that gate results are never stored.

### Tick field shape and owner

| Option | Description | Selected |
|--------|-------------|----------|
| List of tags | `ticks: [ac-1, ac-2]`, git author is the proof | ✓ (shape) |
| Map tag → `{by, on}` | Self-contained, survives squash | |
| List of objects with tested commit | Records the build QA tested | |

Follow-up on owner after the user said QA works on Shortcut, not in the repo:

| Option | Description | Selected |
|--------|-------------|----------|
| Keep mandatory QA ticks | Original three-party design | |
| Drop ticks entirely | Done = scenarios == reviewer evidence | |
| Ticks required by roster | Three sets when `qa` in roster, else two | |

User reframed: at the git layer everything is dev's; the dev self-tests and ticks. Field name options:

| Option | Description | Selected |
|--------|-------------|----------|
| `verified:` role-neutral | Human confirmation that each scenario was exercised | ✓ |
| `self_test:` | Explicit about the dev's intent | |
| Keep `qa.ticks` | Misleading once dev fills it | |

**User's choice:** `verified: [ac-n]`, developer-owned self-test checklist; three-set match kept.

### Schema strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Strict, `additionalProperties: false` | Typos are schema errors | ✓ |
| Open with warning | Unknown keys tolerated | |
| Strict plus free `meta:` bag | Extension point | |

**User's choice:** Option 1.
**Notes:** User asked why there is no work description in frontmatter; explained metadata (frontmatter) vs content (body) with a full sample ticket.

---

## Ticket body layout and verification.md location

### verification.md location

| Option | Description | Selected |
|--------|-------------|----------|
| `tickets/<id>/verification.md` | Contract and evidence side by side | ✓ |
| `assets/<id>/verification.md` | One per-id directory | |
| `tickets/<id>.verification.md` | No subdirectories | |

**User's choice:** Option 1.

### Body headings

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed headings, fixed order | Intent, Requirements, Acceptance criteria, Open questions, Plan | ✓ |
| Only Requirements and AC fixed | Rest free | |
| Free-form, keyword detection | Scanner guesses | |

**User's choice:** Option 1; extra headings allowed.
**Notes:** User raised three side questions: epic roadmap/dependencies (deferred), an index or status file for MCP (rejected, computed state must not be stored), and whether accord needs JS helper files like GSD (no, the CLI is that tool).

### build vs maintain templates

| Option | Description | Selected |
|--------|-------------|----------|
| One structure, different guidance comments | Two files, same headings and schema | ✓ |
| Two structures | maintain drops Intent | |
| Single template | No profile distinction | |

**User's choice:** Option 1.

### verification.md format

| Option | Description | Selected |
|--------|-------------|----------|
| H2 per tag with `Result:` and `Evidence:` lines | Readable on GitHub, trivial to parse | ✓ |
| All in YAML frontmatter | Schema-validated but prose in YAML | |
| Markdown table | Compact, breaks on multi-line evidence | |

**User's choice:** Option 1. Product docs without frontmatter accepted as Claude's discretion.

---

## config.yml shape

### roles

User asked what each role does and which are redundant. Presented a per-role table (writes, runs, medium) and an assessment: lead duplicates BA, designer is thin but useful for non-technical designers, reviewer is an agent not a roster role.

| Option | Description | Selected |
|--------|-------------|----------|
| Drop lead; default `[ba, dev]` | | ✓ (modified) |
| Drop lead; default `[ba, designer, dev]` | | |
| Keep lead with its own skill | As REQUIREMENTS currently says | |

**User's choice:** Merge reviewer into the dev skill; drop QA and lead. Roles `ba`, `dev` required, `designer` optional.
**Notes:** Recorded the condition that merging is by file, not by context: the dev skill hands `review.md` to a fresh agent.

### Root discovery

| Option | Description | Selected |
|--------|-------------|----------|
| `.accord` pointer file at repo root | Deterministic rename support | |
| Scan subdirectories for `config.yml` | No extra file, ambiguous | |
| Fixed `accord/` | Simplest | ✓ |

**User's choice:** Option 3; asked whether I objected. No objection: simpler everywhere, negligible collision risk, additive to change later.

### design.source

| Option | Description | Selected |
|--------|-------------|----------|
| Drop it, keep `design.tokens` | No rule reads it | ✓ |
| Keep as documentation | Dead key | |
| Give it a lint rule | Overlaps GATE-01 | |

**User's choice:** Option 1.
**Notes:** User added the rule that BA never involves or suggests anything technical; captured for templates (Phase 1) and the BA skill (Phase 6); automatic lint deferred.

---

## Package layout and npm naming

### npm scope

| Option | Description | Selected |
|--------|-------------|----------|
| Project org scope | `@accord-dev/accord` | ✓ |
| Personal username scope | `@ngothanhluan/accord` | chosen first, then replaced |
| Employer scope | | |

**User's choice:** `@accord-dev`. Registry shows the package name free; org ownership unverified by script.

### Workspaces

| Option | Description | Selected |
|--------|-------------|----------|
| Four packages per OPS-01 | core, cli, skills, mcp | |
| Three workspaces | core (with schemas, templates, role definitions), cli, mcp | ✓ |
| Single package, two entries | STACK.md Decision 8 | |

**User's choice:** Option 2.

---

## Claude's Discretion

- CI workflow shape and job list
- Two-layer purity guard (ESLint plus core tsconfig without `@types/node`)
- `id` pattern, `tracker` `if/then`, `runtimes` default of all four
- Template guidance wording, prototype header, `verification.md` template text
- `product/*.md` without frontmatter

## Deferred Ideas

- `depends_on` between tickets / epic roadmap ordering
- Generated index or status file for MCP (rejected)
- Technical-vocabulary lint on BA sections
- GSD-style helper JS files in adopting repos (not needed)
