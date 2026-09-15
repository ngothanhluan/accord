---
phase: 05-cli-commands
plan: 02
subsystem: api
tags: [status, statusRows, purity, goldens, vitest, fnv1a64]

# Dependency graph
requires:
  - phase: 03-lint
    provides: "`lintSnapshot` and `LintResult` — the one repo-wide lint whose findings D-91 splits per ticket"
  - phase: 04-gates
    provides: "`scoped(findings, id)` (D-89), `acHash(scenarios)` (D-75), the `cmp` code-point idiom, and the omit-never-undefined spread (D-54)"
provides:
  - "`statusRows(snapshot): StatusRow[]` — the pure, sorted, flat per-ticket trace behind `accord status` (D-91, D-92)"
  - "`StatusRow` — the row shape the 05-04 ASCII table and the `--json` contract (D-98) both bind to"
  - "Five JSON goldens pinning statusRows over three real fixtures plus the archived and broken-frontmatter edge cases"
  - "An in-memory fixture-variant idiom for a case no fixture on disk carries, without moving any Phase 1-4 golden"
affects: [05-04, 05-05, 06-skills, 08-mcp]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff).
actuals:
  tokens: 4200
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One repo-wide `lintSnapshot` split per ticket by `scoped`, never N gate calls — the D-91 cost shape"
    - "A three-state derived column is `compare(recorded, current, match)`: `none` when nothing is recorded, the match word on exact equality, `stale` otherwise — data words, never display glyphs"
    - "A fixture variant that exists only for one case is spread onto the `SnapshotInput` in the test, not added to the shared fixture directory"

key-files:
  created:
    - packages/core/src/status/rows.ts
    - packages/core/test/status.test.ts
    - packages/core/test/__golden__/valid-build.status.json
    - packages/core/test/__golden__/gate-ready.status.json
    - packages/core/test/__golden__/gate-done.status.json
    - packages/core/test/__golden__/frontmatter-errors.status.json
    - packages/core/test/__golden__/archived.status.json
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "`ready` is `stale` when `ac_hash` is recorded but the ticket now has no `@ac-n` scenario at all (`acHash` returns undefined). The plan fixes only the present/equal/differ cases; `stale` is the reading that keeps a recorded-but-unmatchable hash visible instead of silently reading `none`. Flagged below"
  - "`ticksTagged` counts scenarios carrying an `acTag`, taken literally from the plan, not distinct tag values. Two scenarios both tagged `@ac-1` therefore count 2 — `lint.ac-tag-duplicate` is the rule that reports that, not this column"
  - "`cmp` is a local const in rows.ts, matching how `lint/index.ts` already keeps its own copy rather than importing the gate module's module-private one"
  - "`scoped` stays private: rows.ts is its only new consumer, and exporting it would widen the public surface for a helper whose scope semantics are internal"

patterns-established:
  - "Derived-column helper: `compare(recorded, current, match)` returns `'none' | match | 'stale'` and serves both `ready` and `ticksBinding`, so the two columns cannot drift apart"
  - "Golden test guard-the-guard: each case also asserts the sort invariant and that `JSON.stringify` of the rows contains no `null` and no `undefined` value, so a golden regenerated over a regression still fails"

requirements-completed: []

coverage:
  - id: D1
    description: "`statusRows(snapshot)` returns one row per ticket, sorted by parent then id with a code-point compare (D-92)"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/core/test/status.test.ts#places the parentless epic before its child (D-92)"
        status: pass
      - kind: unit
        ref: "packages/core/test/status.test.ts#is sorted by parent then id (D-92) and carries no undefined or null value (D-54)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every row carries its own error and warning counts, taken from exactly one repo-wide lintSnapshot call (D-91)"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/core/test/__golden__/frontmatter-errors.status.json (per-ticket counts 1/1/7/1/1/5/1/6/1 across nine broken tickets)"
        status: pass
      - kind: unit
        ref: "packages/core/test/status.test.ts#gives a ticket whose frontmatter failed the schema a row with its id, its errors, and no type key"
        status: pass
    human_judgment: false
  - id: D3
    description: "`ready` and `ticksBinding` are traces of what is written in the file — none / ok|bound / stale — and statusRows never calls gateReady or gateDone (D-91)"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/core/test/status.test.ts#reads ok/bound when the recorded hash equals the computed one"
        status: pass
      - kind: unit
        ref: "packages/core/test/status.test.ts#reads stale when the recorded hash differs"
        status: pass
      - kind: unit
        ref: "packages/core/test/status.test.ts#reads none for a verified_hash that was never written"
        status: pass
    human_judgment: false
  - id: D4
    description: "Archived tickets are returned, not filtered; filtering is the caller's job (D-93)"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/core/test/status.test.ts#keeps an archived ticket in the result; filtering is the caller (D-93)"
        status: pass
    human_judgment: false
  - id: D5
    description: "statusRows is pure — no node: import, two calls agree, the snapshot is untouched"
    requirement: CORE-01
    verification:
      - kind: unit
        ref: "packages/core/test/status.test.ts#is pure: two calls agree and the snapshot is untouched"
        status: pass
      - kind: integration
        ref: "npm run lint (eslint no-restricted-imports over packages/core/src) and npm run typecheck (core tsconfig types: [])"
        status: pass
    human_judgment: false
  - id: D6
    description: "Five goldens pin statusRows over valid-build, gate-ready, gate-done, frontmatter-errors, and the in-memory archived case"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/core/test/status.test.ts#matches its golden (five cases)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-15
status: complete
---

# Phase 5 Plan 2: Core `statusRows` Summary

**`accord status` now has its data half: one pure core function turning a RepoSnapshot into the flat, parent-then-id sorted `StatusRow[]`, costing exactly one repo-wide lint and pinned by five JSON goldens.**

## Performance

- **Duration:** 12 min
- **Tasks:** 2 of 2
- **Files created:** 7
- **Files modified:** 1

## Accomplishments

- `packages/core/src/status/rows.ts` — `StatusRow` and `statusRows`, 60 lines, no Node built-in, no `gateReady`/`gateDone`, one `lintSnapshot` call for the whole repository split per ticket by the existing `scoped` helper.
- The two derived columns share one `compare(recorded, current, match)` helper, so `ready` (`none | ok | stale`) and `ticksBinding` (`none | bound | stale`) cannot drift apart. They carry data words, not glyphs — the 05-04 renderer decides what an empty cell looks like.
- `statusRows` and the `StatusRow` type are on the D-55 public barrel; `scoped` deliberately is not.
- `packages/core/test/status.test.ts` — 19 tests: five golden cases, a sort-and-no-undefined invariant per case, pinned values over `valid-build` and `gate-done`, a purity check, and the two edge cases a golden cannot express.
- The archived case is built in memory by spreading one extra ticket onto the `valid-build` `SnapshotInput`. No file was added under `packages/core/test/fixtures/`, so no Phase 1-4 golden moved.

## Task Commits

**Nothing was committed — project policy (CLAUDE.md: leave changes uncommitted for owner review).** `HEAD` is still `97a7977`.

1. **Task 1: statusRows — the pure per-ticket trace** — uncommitted (project policy)
2. **Task 2: status goldens over the existing fixtures plus the two constructed edge cases** — uncommitted (project policy)

**Plan metadata:** uncommitted (project policy)

## Files Created/Modified

- `packages/core/src/status/rows.ts` — `StatusRow` interface and the pure `statusRows(snapshot)` transform (new)
- `packages/core/src/index.ts` — barrel re-export of `statusRows` and `StatusRow`, header comment updated (modified)
- `packages/core/test/status.test.ts` — the case table, the golden loop, the pinned-value blocks, and the two edge cases (new)
- `packages/core/test/__golden__/valid-build.status.json` — 2 rows: `EPIC-1` then `LOGIN-1` (new)
- `packages/core/test/__golden__/gate-ready.status.json` — 6 rows (new)
- `packages/core/test/__golden__/gate-done.status.json` — 14 rows covering every `ok`/`stale`/`none` combination that exists on disk (new)
- `packages/core/test/__golden__/frontmatter-errors.status.json` — 9 rows, six of them with no `type` and no `status` key (new)
- `packages/core/test/__golden__/archived.status.json` — 3 rows, the third `status: archived` (new)

## Verification

Run from `C:/Work/accord`, all four green:

| Command | Result |
|---------|--------|
| `npm run build` | pass — core 101.83 kB + d.ts, cli 8.03 kB |
| `npm run lint` | pass — no output, no `no-restricted-imports` violation under `packages/core/src` |
| `npm run typecheck` | pass — core, core test, cli |
| `npm test` | **25 files / 632 tests passed**, 0 failed |

Baseline entering this plan was 24 files / 613 tests. The delta is exactly `status.test.ts` (+1 file, +19 tests); no pre-existing test changed state and no pre-existing failure was observed.

Goldens are stable across runs: the `-u` generation run and the subsequent plain `npm test` both passed with zero snapshots written on the second pass. `git status packages/core/test/__golden__/` shows the five new `*.status.json` files as untracked and **no modification to any pre-existing golden** (the one ` M` entry there, `ticket-build.verified-empty.md`, was already modified in the working tree before this plan started).

## Decisions Made

1. **`ready` is `stale`, not `none`, when `ac_hash` is recorded but `acHash(scenarios)` is `undefined`.** The plan's behavior block fixes three cases: absent (`none`), equal (`ok`), differs (`stale`). It does not name the case where a hash was recorded and the ticket has since lost every `@ac-n` tag. `stale` was chosen because it is literally true (the recorded hash no longer matches the criteria) and because reading `none` would erase a recorded hash from the display. See Findings.
2. **`ticksTagged` counts scenarios, not distinct tag values.** Taken verbatim from the plan (`the number of scenarios carrying an acTag`). A ticket with two `@ac-1` scenarios reports 2; `lint.ac-tag-duplicate` is the rule that reports that as a defect, and a status column should not quietly deduplicate what lint is shouting about.
3. **A local `cmp` const rather than importing the gate module's.** `packages/core/src/lint/index.ts` already keeps its own copy of the same three-character comparator; `cmp` is not exported from `gate/index.ts`, and exporting it to save one line would be a wider change than the duplication it removes.
4. **`scoped` stays private.** Plan instruction, followed: the barrel header comment now names it as staying private alongside the rule tables.

## Deviations from Plan

None to production code or to the plan's instructions.

One fixture-authoring adjustment inside Task 2: the first draft of the in-memory archived ticket omitted `## Open questions`, which `lint.heading-missing` reports as an error, so the first generated `archived.status.json` showed `errors: 1` on the `OLD-1` row. The heading was added and the golden regenerated so the row reads `errors: 0` — the golden now pins "an archived ticket appears in the result", which is what the case exists to test, rather than an incidental lint error in test data.

## Findings / assumptions needing a decision

These are the two the plan itself flagged, now implemented, plus one it did not name. All three are recorded because they are business-logic readings the plan does not fix, and none should be treated as settled by the fact that a golden now pins it.

1. **A ticket whose frontmatter failed the schema produces a row with `id`, `ui: false`, its counts, and no `type` and no `status` key.** Implemented as the plan's `planning_notes` proposed. Pinned by `frontmatter-errors.status.json`, where six of nine rows have neither key. The alternative — dropping broken tickets from `status` entirely — was rejected on the plan's own reasoning: the row is how the user learns the ticket is broken. **Owner decision wanted:** is a keyless row acceptable in the 05-04 ASCII table, or should those cells render a distinct marker so a broken ticket is not mistaken for a sparse one?

2. **Parentless tickets sort before every grouped child.** `cmp(a.parent ?? '', b.parent ?? '') || cmp(a.id, b.id)`, exactly as the plan specifies. D-92 fixes the axis but not this tie-break, so in `valid-build` the epic `EPIC-1` (no parent) comes before `LOGIN-1` (parent `EPIC-1`). This happens to read well when epic ids sort near their children's `parent` values, and reads badly otherwise: an epic whose id sorts late still appears in the parentless block at the top, far from its own children. **Owner decision wanted:** is "all orphans first, then groups" the intended shape, or should an epic sort into its own group (for example by keying on `parent ?? id`)? The second is a one-expression change and would move three of the five goldens.

3. **`ready: 'stale'` when a hash is recorded and the ticket now has no tagged scenario** (decision 1 above). Not covered by any D-number and not exercised by any fixture on disk, so no golden pins it today. **Owner decision wanted:** confirm `stale`, or prefer a fourth word for "recorded, but there is nothing to compare against".

4. **`ui` defaults to `false` for a ticket with no valid frontmatter.** `fm?.ui ?? false` mirrors the D-21 loader default, so a broken ticket reports `ui: false` rather than omitting the column. The field is non-optional in `StatusRow` (the plan specifies `ui: boolean`, not `ui?`), so there was no omit-it option. Low stakes, recorded for completeness.

## Issues Encountered

None. Every check passed on its first run; the only rework was the fixture heading described under Deviations.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

`statusRows` is the complete data half of ROADMAP Phase 5 criterion 2's `status` clause. What remains for `status`:

- **05-04** builds the printing half: the ASCII `padEnd` table over `StatusRow[]`, the `—` glyph for every `none` column, the D-93 `--all` flag plus the hidden-count summary line, the empty-repository one-liner, and `--json` printing the bare array (D-98).
- **05-05/05-06** add the `github-issues` enrichment; `StatusRow.tracker` is already the adapter-keyed map that adapter reads (`{ shortcut: '1234', jira: '1e3' }` in the `valid-build` golden shows the shape).
- **Phase 8**'s MCP host gets `statusRows` from the public barrel with no second implementation, which is the reason it lives in core rather than in the CLI.

`CLI-05` is deliberately **not** ticked: it closes when `accord status` prints, which is 05-04.

## Self-Check

- [x] `packages/core/src/status/rows.ts` — FOUND
- [x] `packages/core/src/index.ts` re-exports `statusRows` and `StatusRow` — FOUND
- [x] `packages/core/test/status.test.ts` — FOUND
- [x] `packages/core/test/__golden__/valid-build.status.json` — FOUND
- [x] `packages/core/test/__golden__/gate-ready.status.json` — FOUND
- [x] `packages/core/test/__golden__/gate-done.status.json` — FOUND
- [x] `packages/core/test/__golden__/frontmatter-errors.status.json` — FOUND
- [x] `packages/core/test/__golden__/archived.status.json` — FOUND
- [x] `git rev-parse HEAD` returns `97a7977174efa56e1d98594355d15a46af50a8b9` — nothing committed
- [x] No commit hashes claimed anywhere in this summary

## Self-Check: PASSED

---
*Phase: 05-cli-commands*
*Completed: 2026-09-15*
