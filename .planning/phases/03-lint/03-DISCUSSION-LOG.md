# Phase 3: Lint - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-13
**Phase:** 03-lint
**Areas discussed:** Rule table, levels and render; EARS classifier; Token rule policy; New formats and hygiene

---

## Rule table, levels and render

| Option | Description | Selected |
|--------|-------------|----------|
| `error` / `warning` | Two levels; lint exits 1 on error | ✓ |
| `block` / `warn` / `info` | ARCHITECTURE draft; `info` for non-error findings | |

| Option | Description | Selected |
|--------|-------------|----------|
| Size rule warning on both profiles | Table keeps a profile column; promotion later is a table edit | ✓ |
| build = error, maintain = warning | Real matrix from day one | |

| Option | Description | Selected |
|--------|-------------|----------|
| Merge `load.*` (level error) with `lint.*`, sort file/line | One list, one object | ✓ |
| Separate; host concatenates | Clear loader/lint boundary | |

| Option | Description | Selected |
|--------|-------------|----------|
| `file:line: level rule reason` + summary line | Compact compiler style, clickable, grep-able | ✓ |
| Grouped by file (eslint stylish) | Compact when one file has many findings | |

**User's choice:** the recommended option in all four.
**Notes:** Renderer lives in core without colour; the CLI colours with `styleText`.

---

## EARS classifier

| Option | Description | Selected |
|--------|-------------|----------|
| Case-insensitive keywords; verb must be `shall` | Structure judged, not casing | ✓ |
| Uppercase keywords required | One canonical form | |

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed literal `the system shall` | Stable delimiter inside Vietnamese prose | ✓ |
| `the <name> shall` | Named systems allowed | |

| Option | Description | Selected |
|--------|-------------|----------|
| English keywords only | Matches template and fixture | ✓ |
| Add a Vietnamese keyword set | Pure Vietnamese lines | |

| Option | Description | Selected |
|--------|-------------|----------|
| Reason names the missing part deterministically | No nearest-pattern heuristic | ✓ |
| Generic reason | One fixed string | |

**User's choice:** the recommended option in all four.

---

## Token rule policy

| Option | Description | Selected |
|--------|-------------|----------|
| `RepoSnapshot.files` holds only files rules read raw | Prototype, tokens, report; tickets excluded | ✓ |
| Typed fields per input | `prototypes`, `tokens`, `testReport` | |
| Keep all `input.files` | Goldens duplicate ticket text | |

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist per colour/spacing property | `var(--token)` or fixed exemption | ✓ |
| Blocklist regex | `#hex`, `rgb(`, `\d+px` anywhere | |

| Option | Description | Selected |
|--------|-------------|----------|
| Check `Derived from:` and that each path exists in tree | GATE-04 rule reused | ✓ |
| Check `Derived from:` only | No tree lookup | |
| Skip the rule without tokens | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Scan every `prototype.html` present | Independent of `ui:` | ✓ |
| Only when ticket `ui: true` | | |

**User's choice:** the recommended option in all four.
**Notes:** `lint.tokens-missing` warning on `config.yml` when configured but absent was offered as a default and not objected to.

---

## New formats and hygiene

| Option | Description | Selected |
|--------|-------------|----------|
| `@test:` missing = warning, duplicate = error, `@ui`+`@test` = warning | Done gate blocks missing tags | ✓ |
| All error | Every post-Ready ticket fails lint | |

| Option | Description | Selected |
|--------|-------------|----------|
| Note orphan warning + section must be last | `verified` vs notes left to GATE-10 | ✓ |
| Orphan only | No order check | |

| Option | Description | Selected |
|--------|-------------|----------|
| JUnit scanner in Phase 3, in the loader | `snapshot.tests`, `lint.test-id-unknown`, `lint.report-missing` | ✓ |
| Phase 4 | Config key and file only in Phase 3 | |

| Option | Description | Selected |
|--------|-------------|----------|
| `TODO`/`TBD`/`FIXME` + template placeholders | Uppercase whole word, fences included, comments excluded | ✓ |
| `TODO` only | | |

**User's choice:** the recommended option in all four.
**Notes:** `lint.heading-missing` (error, D-07 headings by type) and the plan-step definition (list item, tag anywhere, untagged item warns) were offered as defaults and not objected to.

---

## Claude's Discretion

LINT-03 levels, LINT-05 level, LINT-07 counting, id-mismatch level, `tracker: {}` level, `LintResult` shape and sort tie-breaks, ajv duplicate-finding dedupe, module layout, template additions for `## Verification notes` and `@test:`, fixture set.

## Deferred Ideas

MCP server removal (roadmap-level, per owner: "mcp đâu có cần làm nữa?"); vagueness-term lint; Vietnamese EARS keywords; named system subject; `--strict`; suppression comment; token rule as error (GATE-12); Tailwind v3 JS config; heading order beyond the notes section.
