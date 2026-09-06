---
phase: 01-workspace-and-formats
plan: 03
subsystem: testing
tags: [ajv, json-schema-2020-12, vitest, golden, toMatchFileSnapshot, config-yml, verification-md, tracker-map]

# Dependency graph
requires:
  - phase: 01-workspace-and-formats (plan 01)
    provides: "`validate(schemaId, doc): Finding[]`, the three schemas, `packages/core/test/schemas.test.ts` and the golden pattern (`toMatchFileSnapshot` on `JSON.stringify(Finding[])`)"
provides:
  - "`packages/core/test/schemas.test.ts` extended with five describe blocks: `config.schema.json` (7), `verification.schema.json` (3), `finding order is deterministic` (1), `ticket.schema.json tracker map (FMT-03)` (4), `ticket.schema.json decisions D-01..D-05, D-21..D-25` (7)"
  - "Golden `config.invalid.json`: 5 findings at `''`, `/tracker`, `/tracker`, `/roles/0`, `/roles` for the RESEARCH Code Example 9 probe"
  - "Golden `verification.invalid.json`: 3 findings at `''`, `/commit`, `/reviewed_on`"
  - "Golden `ticket.tracker.invalid.json`: 3 findings at `/tracker`, `/tracker/shortcut`, `/tracker/jira`"
  - "Executable proof of the no-credentials and no-tracker-data prohibitions (top-level config keys are exactly the six D-16 keys; `sprint`, `priority`, `owner`, `qa`, `feature` are rejected in ticket frontmatter)"
affects: [01-04, 01-05, phase-2-loaders, phase-3-lint, phase-5-cli]

# Actuals (#2632) — chars/4 over the realized diff, same scale as the plan's estimate (26000).
actuals:
  tokens: 2632    # 10,528 chars: 9,242 appended to schemas.test.ts + 1,286 across 3 goldens
  tasks: 2
  commits: 0      # owner commits after review (no-commit policy)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schema tests assert on `(path, rule)` pairs through a local `has(findings, path, rule)` helper, never on ajv message text; goldens are the only place messages are pinned"
    - "Schema shape pins (property lists, required lists, no credential-looking keys) import the JSON schema directly with `with { type: 'json' }`"
    - "Per-case documents are built by spreading a shared valid base (`minimal.config`, `base` ticket) so each test names only the field under test"

key-files:
  created:
    - packages/core/test/__golden__/config.invalid.json
    - packages/core/test/__golden__/verification.invalid.json
    - packages/core/test/__golden__/ticket.tracker.invalid.json
  modified:
    - packages/core/test/schemas.test.ts

key-decisions:
  - "The `schema.if` finding at `/tracker` (ajv's wrapper error for a failed `then`) is kept in the golden as observed; whether Phase 3 lint suppresses it as noise is left to the owner (see Findings)"

patterns-established:
  - "Every CONTEXT.md format decision (D-01..D-05, D-09, D-13, D-15, D-16, D-21..D-25) has a named assertion in `schemas.test.ts`; a schema edit that breaks a decision is a red test, not a review comment"

requirements-completed: [FMT-02, FMT-03, FMT-06]

coverage:
  - id: D1
    description: "config.yml: the D-16 default and its variants validate; `github-issues` without `repo` yields `schema.required` at `/tracker`; an undeclared key yields `schema.additionalProperties` at `''`; `roles: [ba]` yields `schema.contains` at `/roles`; `repo` shape, `design` shape, roles enum/duplicates, and the semver pin are checked by path"
    requirement: FMT-06
    verification:
      - kind: unit
        ref: "packages/core/test/schemas.test.ts#config.schema.json"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/config.invalid.json"
        status: pass
    human_judgment: false
  - id: D2
    description: "config.yml top-level properties and required list are exactly `accord, profile, tracker, design, roles, runtimes`; no property name matches key/token/secret/password"
    requirement: FMT-06
    verification:
      - kind: unit
        ref: "packages/core/test/schemas.test.ts#top-level properties are exactly the six D-16 keys"
        status: pass
    human_judgment: false
  - id: D3
    description: "verification.md frontmatter: short and full SHA accepted; bad commit, bad date, extra `reviewer` named at `''`, `/commit`, `/reviewed_on`; properties are exactly `ticket, commit, reviewed_on` (D-09)"
    requirement: FMT-02
    verification:
      - kind: unit
        ref: "packages/core/test/schemas.test.ts#verification.schema.json"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/verification.invalid.json"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ticket `tracker` map: adapter-keyed string values validate, `{}` validates (D-22), capitalised key / numeric value / empty value are named at `/tracker`, `/tracker/shortcut`, `/tracker/jira`; keys are case-sensitive ASCII kebab and `minLength` counts code points (`'é'` accepted)"
    requirement: FMT-03
    verification:
      - kind: unit
        ref: "packages/core/test/schemas.test.ts#ticket.schema.json tracker map (FMT-03)"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/ticket.tracker.invalid.json"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ticket decisions: type/status enums (D-01, D-02) with all 9 valid combinations; type and status required, ui optional (D-21); design on epic and https-only (D-23); ac_hash non-empty string (D-25); verified tag pattern, uniqueness, type (D-03); dropped and tracker-owned keys rejected, assumptions shape (D-04, D-05); id/parent pattern"
    requirement: FMT-02
    verification:
      - kind: unit
        ref: "packages/core/test/schemas.test.ts#ticket.schema.json decisions D-01..D-05, D-21..D-25"
        status: pass
    human_judgment: false
  - id: D6
    description: "Finding order is deterministic: two consecutive `validate('config', probe)` runs serialise identically, and all three goldens re-matched on a second run"
    requirement: FMT-06
    verification:
      - kind: unit
        ref: "packages/core/test/schemas.test.ts#finding order is deterministic"
        status: pass
    human_judgment: false

# Metrics
duration: 2min
completed: 2026-09-06
status: complete
---

# Phase 1 Plan 03: Schema Acceptance Goldens Summary

**All three schema contracts (ticket, verification, config) are now pinned as 22 new vitest assertions and three JSON goldens: every CONTEXT.md format decision and the FMT-03 tracker-map edges (empty, case, code-point length, ordering) fail with a JSON-pointer path when violated; `npm run check` is green on Windows with 46 tests.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-09-06T02:10:16Z
- **Completed:** 2026-09-06T02:12:05Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `config.schema.json` block: the RESEARCH Code Example 9 probe produced exactly the five predicted findings in the predicted order (`''` additionalProperties, `/tracker` required `'repo'`, `/tracker` if, `/roles/0` const, `/roles` contains). `repo` shape, `design` extra key and missing `tokens`, roles enum/contains/uniqueItems, and the `accord` semver pin are each asserted by `(path, rule)`.
- The six-key pin imports the schema JSON directly: `properties` and `required` both equal `['accord', 'profile', 'tracker', 'design', 'roles', 'runtimes']` and no key matches `/key|token|secret|password/i`.
- `verification.schema.json` block: 7-hex and 40-hex commits pass; the bad document yields findings at `''`, `/commit`, `/reviewed_on`; `properties` is exactly `['ticket', 'commit', 'reviewed_on']` so `reviewer` can never be a field (D-09).
- Tracker map block: `{ shortcut: '1234' }`, `{ 'github-issues': '42' }`, the two-entry map, and `{}` all validate; `{ Shortcut: '1234', shortcut: 1234, jira: '' }` yields `/tracker` additionalProperties, `/tracker/shortcut` type, `/tracker/jira` minLength; `SHORTCUT` and `short_cut` are rejected, `a1-b2` and the one-code-point value `'é'` are accepted.
- Decisions block: 3 x 3 type/status combinations valid; `feature` and `todo` rejected by enum; `type`/`status` required and `ui` optional; `design` accepted on an epic and rejected without `https://`; `ac_hash` empty/numeric rejected; `verified` pattern, uniqueness, and type; `owner`, `qa`, `feature`, `sprint`, `priority` all rejected at `''`; `assumptions` item shape; `id`/`parent` pattern.
- Ordering: two consecutive runs on the config probe serialise identically, and all three goldens re-matched on the second test run.

## Task Commits

Per the repository owner's rule, nothing was committed. All changes are in the working tree for review.

1. **Task 1: config.yml and verification.md acceptance goldens** - (uncommitted — awaiting owner review)
2. **Task 2: Ticket edges — tracker map (FMT-03) and the D-21..D-25 decisions** - (uncommitted — awaiting owner review)

**Plan metadata:** (uncommitted — awaiting owner review)

## Files Created/Modified

- `packages/core/test/schemas.test.ts` - extended from 6 to 28 tests; adds `has()` helper, `configProbe`, `base` ticket and `ticket()` helper, five describe blocks; imports `config.schema.json` and `verification.schema.json` for shape pins
- `packages/core/test/__golden__/config.invalid.json` - 5 findings for the Code Example 9 probe
- `packages/core/test/__golden__/verification.invalid.json` - 3 findings (`''`, `/commit`, `/reviewed_on`)
- `packages/core/test/__golden__/ticket.tracker.invalid.json` - 3 findings (`/tracker`, `/tracker/shortcut`, `/tracker/jira`)

## Verification Output

- Task 1 `npm test -- --project core schemas`: 17 passed, 2 snapshots written; re-run 17 passed, 0 written, 0 obsolete.
- Task 2 `npm test -- --project core schemas`: 28 passed, 1 snapshot written.
- Acceptance-string grep on `schemas.test.ts`: all 19 required literals present.
- `npm run check`: exit 0; 4 test files, 46 tests passed (24 from plans 01-01/01-02 + 22 new).
- `git log -1 --format=%H` before and after: `0d512c4ea602816ff1cda1c5ffd31ca719ac1a0a` (no commit).

## Decisions Made

- Kept ajv's `schema.if` finding at `/tracker` in `config.invalid.json` rather than filtering it in `validate()`. The plan predicted it and it is what ajv emits; removing it is a Phase 3 presentation question, not a schema question.
- The D-21 "omit type / omit status" cases build the documents explicitly from `base`'s fields instead of rest-destructuring, because ESLint's `no-unused-vars` rejected the discarded bindings (see Issues Encountered).

## Deviations from Plan

None - plan executed exactly as written. Every predicted finding count, path, and rule matched on the first run; no schema or implementation file was touched.

## Findings / open decisions

- **`schema.if` is a duplicate signal.** For `tracker: { adapter: 'github-issues' }` without `repo`, ajv reports both `schema.required` (`must have required property 'repo'`) and `schema.if` (`must match "then" schema`) at `/tracker`. The second carries no information the first does not. Options for Phase 3 lint output: (a) show both as pinned now, (b) drop `schema.if`/`schema.then` findings in the reporter, (c) drop them inside `validate()`. Used (a); the owner decides.
- **FMT-06 pin semantics (carried from the plan's flagged assumptions).** The `accord` value is checked for semver shape only. Whether the CLI requires an exact match or a range against its own version is Phase 5 (CLI-06), not decided here.
- **Tracker key pattern assumes lowercase kebab adapter names** (`^[a-z][a-z0-9-]*$`, RESEARCH A5). `shortcut`, `github-issues`, `jira`, `linear` fit; an adapter with a capital or underscore in its name would need a schema change.
- **Golden order for the tracker map.** ajv emitted `/tracker` additionalProperties before the `patternProperties` children (`/tracker/shortcut`, `/tracker/jira`). The acceptance criterion asked only for the path set, so the order is pinned by the golden but not by a decision.

## Issues Encountered

- First `npm run check` failed lint with two `@typescript-eslint/no-unused-vars` errors on `_t`/`_s` in my own D-21 test (rest-destructuring to drop a key). Fixed inside the test by constructing `{ id, title, status }` and `{ id, title, type }` explicitly; second `npm run check` exit 0. Test-only; no production code changed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FMT-02, FMT-03, FMT-06 are declared by this plan and 01-01; both have summaries, so they are marked complete if no later plan in this phase also declares them.
- Ready for 01-04 (templates and `gen`) and 01-05. Templates with frontmatter can reuse `validate()` and the `has()` assertion style from this file.
- Phase 2 loaders inherit a pinned finding order; Phase 3 lint should decide the `schema.if` question above before designing its report format.

---
*Phase: 01-workspace-and-formats*
*Completed: 2026-09-06*

## Self-Check: PASSED

All 4 test/golden files and the SUMMARY exist on disk; `npm run check` exit 0 (46 tests); HEAD still `0d512c4` (no commit made). FMT-03 marked complete; FMT-02 and FMT-06 stay open until 01-05 finishes.
