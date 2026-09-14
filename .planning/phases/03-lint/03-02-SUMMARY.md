---
phase: 03-lint
plan: 02
subsystem: core-lint
tags: [lint, headings, sentinels, vague-wording, oversize, plan-tags, verification-notes, goldens, vitest]

# Dependency graph
requires:
  - phase: 03-lint
    provides: "03-01: `RULES` row shape, `Draft`, `lintSnapshot`, the golden loop in `test/lint.test.ts`"
  - phase: 02-core-model-and-loading
    provides: "`Ticket.sections`, `requirements`, `scenarios`; `headingKey`, `stripHtmlComments`, `LIST_MARKER` in `load/sections.ts`"
provides:
  - "Fifteen `Rule['check']` functions in `lint/ticket.ts`: headingMissing, trackerEmpty, tickOrphan, assumptionUnconfirmed, sentinel, openQuestion, vagueWording, intentOversize, requirementsOversize, scenariosOversize, planStepUntagged, planTagsDiffer, planEmpty, noteOrphan, notesNotLast"
  - "`RULES` has seventeen rows; `lint.heading-missing` is the only new error, the other fourteen are warnings, all on both profiles"
  - "`LIST_MARKER` exported from `load/sections.ts`"
  - "Fixture `lint-hygiene` (seven tickets) with its lint and snapshot goldens; eight Phase 2 lint goldens regenerated for `lint.heading-missing` and `lint.plan-empty`"
affects: [03-03, 03-04, 03-05, 03-06, 04-gates, 05-cli]

# Actuals (#2632) — chars/4 over the realized diff: ~9k ticket.ts growth, ~1.5k rules.ts, ~3.5k lint.test.ts,
# ~6k fixture tickets, ~21k two new goldens, ~10.6k of added rows in the eight regenerated goldens
actuals:
  tokens: 13000
  tasks: 2
  commits: 0
plan_head_before: f4cc8cc920ef165e7f71bed0dd023550f2c74a38

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Section-walk rule: `section(t, key)` by `headingKey`, `stripHtmlComments(section.lines)`, test each line, fall back to `section.line` for section-level findings"
    - "Type-dependent rules go through `typed(snapshot)`, a type-guard filter that narrows `frontmatter` so no non-null assertion is needed (Pitfall 9)"
    - "A rule family with one shape (`oversize`) is a small factory taking the display name, a count, a limit, and a unit; the reason names the D-07 heading, not the raw heading text"

key-files:
  created:
    - packages/core/test/fixtures/lint-hygiene/accord/config.yml
    - packages/core/test/fixtures/lint-hygiene/accord/tickets/HYGIENE.md
    - packages/core/test/fixtures/lint-hygiene/accord/tickets/SIZE.md
    - packages/core/test/fixtures/lint-hygiene/accord/tickets/HEADINGS.md
    - packages/core/test/fixtures/lint-hygiene/accord/tickets/EPIC.md
    - packages/core/test/fixtures/lint-hygiene/accord/tickets/NOTES.md
    - packages/core/test/fixtures/lint-hygiene/accord/tickets/PLAN-EMPTY.md
    - packages/core/test/fixtures/lint-hygiene/accord/tickets/CLEAN.md
    - packages/core/test/__golden__/lint-hygiene.lint.json
    - packages/core/test/__golden__/lint-hygiene.snapshot.json
  modified:
    - packages/core/src/lint/ticket.ts
    - packages/core/src/lint/rules.ts
    - packages/core/src/load/sections.ts
    - packages/core/test/lint.test.ts
    - packages/core/test/__golden__/frontmatter-errors.lint.json
    - packages/core/test/__golden__/body-edges.lint.json
    - packages/core/test/__golden__/gherkin-shapes.lint.json
    - packages/core/test/__golden__/no-config.lint.json
    - packages/core/test/__golden__/bad-config.lint.json
    - packages/core/test/__golden__/config-syntax.lint.json
    - packages/core/test/__golden__/valid-build.lint.json
    - packages/core/test/__golden__/verification-edges.lint.json

key-decisions:
  - "Oversize reasons name the D-07 display heading (`## Intent`, `## Requirements`, `## Acceptance criteria`) rather than echoing the raw heading text, so `## INTENT` and `##   requirements` produce the same reason as the canonical spelling"
  - "`lint.sentinel` scans every `##` section of the body (Plan, Verification notes, and untracked sections included), per D-73 'anywhere in the body'; lines before the first `##` heading are not stored by the scanner and are not scanned"
  - "The 03-01 pinned valid-build test was updated from two to three warnings to include `lint.plan-empty` at line 50, as the plan's own golden delta requires"

patterns-established:
  - "Rule check helpers stay module-private in the group file; only the `Rule['check']` exports and the table row are public"
  - "Plan-scoped golden regeneration: `npm test -- --project core lint -u -t \"fixture <name>\"` one fixture at a time, then a per-rule and per-file count over the JSON to confirm the delta before running without `-u`"

requirements-completed: [LINT-05, LINT-06, LINT-07, LINT-08, FMT-10]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "`lint.heading-missing` (error, no line) per required D-07 heading absent for the ticket's type; untyped tickets get none"
    requirement: LINT-06
    verification:
      - kind: unit
        ref: "packages/core/test/lint.test.ts#fixture lint-hygiene: pinned lint values > HEADINGS: one error per required heading absent for a bug, with no line (D-71)"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/{frontmatter-errors,body-edges,gherkin-shapes,no-config,bad-config,config-syntax}.lint.json (10, 18, 35, 4, 4, 4 heading-missing rows)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`lint.sentinel` per word, placeholder, and `...` step outside HTML comments; `lint.open-question` per unchecked item; `lint.assumption-unconfirmed` by pointer; `lint.tick-orphan` by pointer; `lint.tracker-empty`"
    requirement: LINT-06
    verification:
      - kind: unit
        ref: "packages/core/test/lint.test.ts#fixture lint-hygiene: pinned lint values > HYGIENE: sentinels, vague wording, open question, orphan tick, unconfirmed assumption, empty tracker (LINT-05, LINT-06, D-73)"
        status: pass
    human_judgment: false
  - id: D3
    description: "`lint.vague-wording` once per line over requirement lines, acceptance-criteria lines, and answered open questions; `TBD` reports under both rules"
    requirement: LINT-06
    verification:
      - kind: unit
        ref: "packages/core/test/__golden__/lint-hygiene.lint.json (four vague-wording rows: TBD, maybe, probably, depends; TBD also a sentinel at line 19)"
        status: pass
    human_judgment: false
  - id: D4
    description: "`lint.intent-oversize`, `lint.requirements-oversize`, `lint.scenarios-oversize` at the heading line above 5, 15, 5; limits apply to epics"
    requirement: LINT-07
    verification:
      - kind: unit
        ref: "packages/core/test/lint.test.ts#fixture lint-hygiene: pinned lint values > SIZE and EPIC: oversize warnings at the heading line; limits apply to epics (LINT-07)"
        status: pass
    human_judgment: false
  - id: D5
    description: "`lint.plan-step-untagged` per untagged item, `lint.plan-tags-differ` naming each side's gap ascending by n, `lint.plan-empty` when scenarios exist and the plan has no item; equal sets and epics are silent"
    requirement: LINT-08
    verification:
      - kind: unit
        ref: "packages/core/test/lint.test.ts#fixture lint-hygiene: pinned lint values > HYGIENE, NOTES, PLAN-EMPTY, CLEAN: plan tags, notes placement, and a clean ticket (D-70, D-74)"
        status: pass
      - kind: unit
        ref: "packages/core/test/lint.test.ts#fixture valid-build: pinned lint values (plan-empty at line 50, warnings 3)"
        status: pass
    human_judgment: false
  - id: D6
    description: "`lint.note-orphan` per `### @ac-n` block matching no scenario; `lint.notes-not-last` when the section is not last; `### @AC-1` is not a block; a clean ticket yields zero findings"
    requirement: FMT-10
    verification:
      - kind: unit
        ref: "packages/core/test/__golden__/lint-hygiene.lint.json (NOTES.md: notes-not-last at 26, note-orphan at 30; no CLEAN.md row)"
        status: pass
    human_judgment: false
  - id: D7
    description: "`RULES` ids are unique, match `lint.<kebab>`, and every row applies to both profiles; no level literal outside `rules.ts`"
    requirement: LINT-05
    verification:
      - kind: unit
        ref: "packages/core/test/lint.test.ts#RULES table (CORE-04, D-57, D-59)"
        status: pass
      - kind: other
        ref: "grep -c \"level: '\" packages/core/src/lint/ticket.ts -> 0"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-09-14
status: complete
---

# Phase 3 Plan 02: Ticket hygiene, size, plan-tag, and verification-notes rules Summary

**Fifteen table-driven rules over the Phase 2 ticket model: required headings by type, sentinels and placeholders outside HTML comments, open questions, unconfirmed assumptions, orphan ticks, empty tracker, vague wording, three oversize limits, plan-tag set comparison, and verification-notes placement, pinned by a seven-ticket fixture whose clean ticket yields zero findings.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-14T04:54:48Z
- **Completed:** 2026-09-14T05:00:21Z
- **Tasks:** 2
- **Files modified:** 22 (10 created, 12 modified)

## Accomplishments

- `lint/ticket.ts` holds all fifteen checks; every body rule reads `ticket.sections`, `ticket.requirements`, or `ticket.scenarios` through `headingKey`, `stripHtmlComments`, and the newly exported `LIST_MARKER`. No rule re-scans text with its own heading or fence parser.
- `RULES` has seventeen rows. `lint.heading-missing` is an error; the other fourteen new rows are warnings; every row is on both profiles. `grep -c "level: '"` on `ticket.ts` prints 0.
- The `lint-hygiene` fixture pins each rule: `HYGIENE.md` (16 findings across nine rules), `SIZE.md` (three oversize warnings at lines 8, 18, 36), `HEADINGS.md` (three heading errors, no line), `EPIC.md` (intent oversize only), `NOTES.md` (notes-not-last at 26, note-orphan at 30), `PLAN-EMPTY.md` (plan-empty at 26), `CLEAN.md` (nothing). The golden has `errors: 3`, `warnings: 23`, and is identical across the five encoding variants.
- Eight Phase 2 lint goldens regenerated one at a time; each delta was counted per rule and per file before accepting: heading-missing 10 / 18 / 35 / 4 / 4 / 4 in `frontmatter-errors`, `body-edges`, `gherkin-shapes`, `no-config`, `bad-config`, `config-syntax`; plan-empty 1 / 2 / 1 / 0 in `valid-build` (line 50), `verification-edges` (A at 31, B at 26), `body-edges` (FENCE at 32), `gherkin-shapes`. No other row changed.
- `npm run check` (build, lint, typecheck, 260 tests in 15 files) is green on Windows.

## Task Commits

Per the owner's rule, nothing was committed or staged; every change sits in the working tree for review.

1. **Task 1: Headings, hygiene, vague wording, and size rules** - `uncommitted` (feat)
2. **Task 2: Plan-tag and verification-notes rules** - `uncommitted` (feat)

**Plan metadata:** `uncommitted` (docs)

## Files Created/Modified

Created:
- `packages/core/test/fixtures/lint-hygiene/accord/config.yml` - valid-build config with `design.tokens: ""`
- `packages/core/test/fixtures/lint-hygiene/accord/tickets/{HYGIENE,SIZE,HEADINGS,EPIC,NOTES,PLAN-EMPTY,CLEAN}.md` - one ticket per rule family plus the reference-clean ticket
- `packages/core/test/__golden__/lint-hygiene.lint.json`, `lint-hygiene.snapshot.json`

Modified:
- `packages/core/src/lint/ticket.ts` - fifteen exported checks, private constants and helpers (`section`, `stripped`, `typed`, `oversize`, `planItems`, `missing`)
- `packages/core/src/lint/rules.ts` - fifteen rows appended
- `packages/core/src/load/sections.ts` - `export` on `LIST_MARKER`
- `packages/core/test/lint.test.ts` - `fixture lint-hygiene: pinned lint values` (four tests), `RULES table` (one test), valid-build pinned test updated for `lint.plan-empty`
- Eight `*.lint.json` goldens regenerated with the deltas listed above

## Decisions Made

- Oversize reasons use the display heading name so the reason is stable across heading case and spacing variants.
- `sentinel` scans all sections rather than only the D-07 ones, matching D-73's "anywhere in the body".
- `planStepUntagged` tests items with `matchAll` on the shared global `AC` regex to avoid `lastIndex` state between calls.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the 03-01 pinned valid-build test for the planned `lint.plan-empty` finding**
- **Found during:** Task 2 (regenerating `valid-build.lint.json`)
- **Issue:** The 03-01 test `has no errors and warns once per scenario without a @test: tag` pinned `warnings` at 2 and the exact finding list; the plan's own delta adds `lint.plan-empty` at line 50, so the old pin failed.
- **Fix:** Pinned `warnings` at 3 and appended the plan-empty row to the expected list; renamed the test to say so.
- **Files modified:** `packages/core/test/lint.test.ts` (in the plan's file list)
- **Verification:** the Task 2 gate and `npm run check` pass
- **Committed in:** uncommitted (owner rule)

---

**Total deviations:** 1 auto-fixed (1 bug in a stale pin)
**Impact on plan:** None; the change is the plan's stated golden delta reflected in the pinned test.

## Issues Encountered

None.

## Prohibitions (must_haves) — verification

| Statement | Result |
|---|---|
| No `git commit`, `git push`, `git tag`; no attribution trailer | Verified: HEAD is still `f4cc8cc920ef165e7f71bed0dd023550f2c74a38`; `git diff --cached` is empty |
| No rule re-scans ticket text with its own heading or fence parser | Verified by review: `ticket.ts` imports `headingKey`, `stripHtmlComments`, `LIST_MARKER` and reads `t.sections`, `t.requirements`, `t.scenarios` only |
| No `lint.*` level literal in `ticket.ts` | Verified: `grep -c "level: '" packages/core/src/lint/ticket.ts` prints 0 |
| Nothing under `packages/core/src/` imports a `node:` module outside `load/` and `scaffold/` | Verified by grep (0 files) and the ESLint purity guard |
| No package added | Verified: `package.json` and `package-lock.json` untouched |
| No other tool, plugin, harness, or planning system named in shipped files | Verified by review of `ticket.ts`, `rules.ts`, `sections.ts`, and the seven fixture tickets |

## Open questions for the owner

None blocking. Two readings the plan left implicit, chosen as its tests imply:

1. **Oversize reason text.** The plan writes `## Intent has N lines` literally, so the reason uses the D-07 display name even when the ticket's heading is `## INTENT`. Alternative: echo the raw heading. Change `oversize` in `ticket.ts` if the raw text is preferred.
2. **Sentinel scope.** D-73 says "anywhere in the body", so `## Plan`, `## Verification notes`, and untracked sections are scanned too. Alternative: scan only the five D-07 sections. No fixture exercises the difference.

The plan's `flagged_assumptions` table (first-phrase-per-line vague wording, `- [x]`/`- [X]` as answered, exclusive limits at 5/15/5, nested plan items count, ascending tag order, duplicate note blocks not linted) stands as written.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 03-05 and 03-06 append rows the same way; the `RULES table` test does not pin the row count.
- Sibling plans 03-03 and 03-04 own their own goldens; none of the eight regenerated here overlaps with theirs.
- Phase 4 (`gate ready`) can consume `lint.heading-missing`, `lint.sentinel`, `lint.open-question`, `lint.assumption-unconfirmed`, and the plan-tag rules as its blocking inputs.

## Self-Check: PASSED

- Created files verified on disk: seven fixture tickets, `config.yml`, `lint-hygiene.lint.json`, `lint-hygiene.snapshot.json` (all FOUND).
- Modified files verified by grep: `export const LIST_MARKER` in `sections.ts`; `export const planTagsDiffer` in `ticket.ts`; 17 `lint.` rows in `rules.ts`; `plan lacks nothing; scenarios lack @ac-2` and `lint.plan-tags-differ` in the golden; no `CLEAN.md` row in the golden.
- Commit-hash check skipped by owner rule (nothing committed by design); `git log -1` equals `plan_head_before`.

---
*Phase: 03-lint*
*Completed: 2026-09-14*
