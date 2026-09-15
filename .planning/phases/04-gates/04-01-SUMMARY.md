---
phase: 04-gates
plan: 01
subsystem: gates
tags: [fnv1a, rule-table, gherkin, ears, json-schema, vitest, goldens]

# Dependency graph
requires:
  - phase: 02-core-model-and-loading
    provides: RepoSnapshot, Ticket, ScenarioRef, the Finding shape, fixtures and the golden harness
  - phase: 03-lint
    provides: lintSnapshot, the RULES table shape, renderText, classifyEars, the ticket-section helpers
provides:
  - "gateReady(snapshot, id) returning a GateResult: verdict, reasons by rule id, and the AC hash"
  - "packages/core/src/gate/: hash.ts (FNV-1a 64), rules.ts (the gate table + the maintain downgrade), ready.ts (four checks), index.ts (the engine, scope filter, sort)"
  - "Four Ready rule ids: gate.ticket-unknown, gate.design-missing, gate.intent-empty, gate.ears-missing"
  - "renderText widened to accept anything carrying findings, so a GateResult prints with no adapter"
  - "The tick-binding contract: TicketFrontmatter.verified_hash / verified_commit, SnapshotInput.git / RepoSnapshot.git, the two schema properties, and the template guidance"
  - "Two gate fixtures (gate-ready, gate-maintain) with nine Ready goldens"
affects: [04-02-done-gate, 04-03, 04-04, 05-cli, 06-skills]

actuals:
  tokens: 32575
  tasks: 3
  commits: 0
  plan_head_before: 97a7977174efa56e1d98594355d15a46af50a8b9

tech-stack:
  added: []
  patterns:
    - "Gate rules as data, mirroring lint/rules.ts: {id, level, profiles, check}, with check taking (snapshot, id)"
    - "GateDraft omits `level` from the type, so a check cannot stamp its own level"
    - "The maintain downgrade is one exported list plus one function, called from exactly one place"
    - "Hand-written FNV-1a on TextEncoder + BigInt, keeping core isomorphic and the gates synchronous"

key-files:
  created:
    - packages/core/src/gate/hash.ts
    - packages/core/src/gate/rules.ts
    - packages/core/src/gate/ready.ts
    - packages/core/src/gate/index.ts
    - packages/core/test/hash.test.ts
    - packages/core/test/gate.test.ts
    - packages/core/test/fixtures/gate-ready/
    - packages/core/test/fixtures/gate-maintain/
  modified:
    - packages/core/src/lint/render.ts
    - packages/core/src/index.ts
    - packages/core/src/model/snapshot.ts
    - packages/core/schemas/ticket.schema.json
    - packages/core/templates/ticket-build.md
    - packages/core/templates/ticket-maintain.md
    - packages/core/src/generated/templates.ts
    - docs/design.md
    - packages/core/test/render.test.ts
    - packages/core/test/schemas.test.ts

key-decisions:
  - "renderText's parameter widened to `{ findings: Finding[] }` with the two counts derived inside — resolves the D-87 open question without adding derivable fields to the JSON contract Phase 5 publishes"
  - "The hash-input join separator is U+0000, which cannot occur in Markdown source, so the encoding is injective; this value is now a published contract (D-75 costly)"
  - "GATE-01's intent and EARS clauses are closed with gate.* rows, not lint.* rules promoted to error, so `accord lint` does not start exiting 1 on every half-written ticket"
  - "gateReady short-circuits an unknown id before calling lintSnapshot; the table alone already produces gate.ticket-unknown, so no level literal is duplicated"
  - "Object.hasOwn, never `in`, for every caller-supplied ticket id lookup (T-04-01)"

patterns-established:
  - "Gate case table in gate.test.ts is explicit rows, not a directory scan, because gate results are ticket-scoped"
  - "GATE-01 clause-to-rule-id map asserted in a test, so dropping a READY_RULES row fails a test rather than quietly re-opening the gate"
  - "Profile-matrix proof on synthetic Finding rows, because no v0.1 fixture can distinguish build from maintain on the downgraded ids"

requirements-completed: [GATE-01, GATE-06, GATE-07]

coverage:
  - id: D1
    description: "gateReady returns a GateResult with verdict, reasons by rule id, and acHash; pure and deterministic"
    requirement: GATE-06
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#gate ready valid-build/LOGIN-1: pinned values"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/valid-build.LOGIN-1.ready.json (golden)"
        status: pass
    human_judgment: false
  - id: D2
    description: "acHash is FNV-1a 64 over the @ac-n tags and their steps, stable under reorder and under a new @test: tag"
    requirement: GATE-01
    verification:
      - kind: unit
        ref: "packages/core/test/hash.test.ts (8 tests, three published FNV-1a vectors cross-checked)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every GATE-01 clause is enforced by a rule the Ready path evaluates, including the two clauses no rule covered before"
    requirement: GATE-01
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#GATE-01: every clause is enforced by a rule the Ready path evaluates"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/gate-ready.THIN.ready.json (golden)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The build/maintain profile matrix ships as mechanism with inert data (downgradeMaintain, one call site)"
    requirement: GATE-07
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#the maintain downgrade is the whole GATE-07 matrix, applied from one call site (D-88)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The design-reference rule on both profiles: ui: false silent, maintain needs the prototype, build accepts either"
    requirement: GATE-01
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#gate ready gate-maintain: the design reference on profile maintain"
        status: pass
    human_judgment: false
  - id: D6
    description: "verified_hash and verified_commit exist in the type, the schema, and both shipped templates"
    verification:
      - kind: unit
        ref: "packages/core/test/schemas.test.ts#D-76: verified_hash and verified_commit are optional, lowercase-hashed, and at least 7 hex characters"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/ticket-build.verified-empty.md (golden)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Two rows added to the docs/design.md §5 Ready table so the table and READY_RULES name the same reasons"
    verification: []
    human_judgment: true
    rationale: "§5 is normative for the Ready checks and this is the only place in the plan where a shipped document gains content rather than code; the plan flags it for owner confirmation of the wording."

# Metrics
duration: 22min
completed: 2026-09-14
status: complete
---

# Phase 4 Plan 01: Ready Gate Summary

**`gateReady` runs a real fixture ticket through a gate rule table to a `GateResult` with an FNV-1a `ac_hash` and prints through the existing renderer with no adapter — plus the two GATE-01 clauses no rule enforced before, and the tick-binding frontmatter contract.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 3 of 3
- **Files created:** 31 (4 source, 2 test, 12 fixture files, 13 goldens)
- **Files modified:** 10
- **Tests:** 454 passing across 20 files (was 411 before this plan)

## Accomplishments

- `gateReady(snapshot, id)` composes `lintSnapshot`'s findings — filtered to the ticket's scope, three hygiene rules promoted to `error`, the maintain downgrade applied — with the gate rule table, and derives the verdict from the merged list alone. No flag, option, or config key can produce a `pass` while an error finding exists.
- `acHash` is hand-written FNV-1a 64-bit over `TextEncoder` and `BigInt`, keeping `packages/core/src/gate/` free of every Node built-in and keeping the gate functions synchronous. The implementation was cross-checked against the three published FNV-1a 64 vectors (`""`, `"a"`, `"foobar"`) before the `ac-1` vector was written into the test as a literal.
- **GATE-01's "intent" and "at least one EARS line" clauses had no enforcing rule before this plan.** A ticket with both headings present and both sections empty passed Ready. `gate.intent-empty` and `gate.ears-missing` close it, the `THIN` fixture proves it, and `docs/design.md` §5's Ready table — which omitted both — now lists them.
- `renderText` widened to `{ findings: Finding[] }` with the counts derived inside. Byte-identical output; every existing lint golden and render golden is unchanged.
- The tick-binding contract landed: `verified_hash` / `verified_commit` in `TicketFrontmatter` and `ticket.schema.json` (under the existing `additionalProperties: false`), `git?` on both `SnapshotInput` and `RepoSnapshot`, and commented guidance in both ticket templates.

## Verification

`npm run check` (build, lint, typecheck, full test suite) — **exit 0.**

```
Test Files  20 passed (20)
     Tests  454 passed (454)
```

Per-task gates also run green: `npm run lint`, `npm run typecheck`, and the scoped `hash`, `gate`, `render`, `lint`, `snapshot`, `schemas`, `templates`, `write` projects.

**No Phase 1–3 golden moved.** `git status --porcelain -- packages/core/test/__golden__` lists thirteen new goldens and exactly one modification, `ticket-build.verified-empty.md`, which Task 3 regenerated on purpose. Its diff is exactly the four added comment lines.

## Files Created/Modified

**Created**
- `packages/core/src/gate/hash.ts` — `hashInput` (the D-77 join) and `acHash` (FNV-1a 64, `fnv1a64:<16 hex>`)
- `packages/core/src/gate/rules.ts` — `GateDraft`, `GateRule`, `READY_RULES` (4 rows), `DONE_RULES` (empty, the 04-02 seam), `READY_PROMOTE`, `MAINTAIN_DOWNGRADE`, `downgradeMaintain`
- `packages/core/src/gate/ready.ts` — `ticketUnknown`, `designMissing`, `intentEmpty`, `earsMissing`
- `packages/core/src/gate/index.ts` — `GateResult`, `gateReady`, `scoped`, `byFileLineRule`
- `packages/core/test/hash.test.ts` — 8 tests: the join, the pinned vectors, UTF-8, stability
- `packages/core/test/gate.test.ts` — 37 tests: the 9-row case table, the pinned blocks, the GATE-01 clause map, the downgrade unit test, the table test
- `packages/core/test/fixtures/gate-ready/` — `CLEAN`, `HYGIENE`, `NOUI`, `UINOREF`, `SCHEMA`, `THIN`
- `packages/core/test/fixtures/gate-maintain/` — `UIPROTO` (with prototype), `UILINK` (design URL only), `src/base.css`
- 13 goldens: 9 `*.ready.json`, plus `gate-ready.{snapshot,lint}.json` and `gate-maintain.{snapshot,lint}.json`

**Modified**
- `packages/core/src/lint/render.ts` — parameter widened, counts derived
- `packages/core/src/index.ts` — `gateReady` value export, `GateResult` type export; the rule tables stay private
- `packages/core/src/model/snapshot.ts` — `verified_hash`, `verified_commit`, `git?` on both snapshot types
- `packages/core/schemas/ticket.schema.json` — the two new properties
- `packages/core/templates/ticket-build.md`, `ticket-maintain.md`, `src/generated/templates.ts` — tick-binding guidance
- `docs/design.md` — two rows added to the §5 Ready table
- `packages/core/test/render.test.ts` — one object literal dropped two now-excess properties
- `packages/core/test/schemas.test.ts` — the D-76 case

## Decisions Made

1. **The hash-input separator is `U+0000`** (the plan left it open; it is now a published contract). It cannot occur in Markdown source, so the encoding is injective — a step whose text is literally `ac-2` cannot collide with a tag field. Overturn this before the first real ticket records an `ac_hash`, not after.
2. **`gateReady` short-circuits an unknown id before calling `lintSnapshot`.** The rule table alone already yields `gate.ticket-unknown` (every other check is silent without a ticket), so the plan's "stamp the draft from its row" is satisfied without duplicating a level literal outside the table.
3. **`Object.hasOwn`, never `in`,** for every caller-supplied id lookup. `in` answers true for `toString`, which would let a crafted id read a prototype property (T-04-01).
4. **Template guidance is four commented lines, not two.** The plan asked for "two commented guidance lines"; the template's own convention is a prose line above each commented key (as it already does for `ac_hash` and `verified`), so the shape is two prose lines plus two `# verified_*:` key lines. No frontmatter key is introduced and the D-04 key-order test is untouched.
5. **`gate-maintain/src/base.css` was added** so `UIPROTO`'s prototype header can name a `Derived from:` path that exists in the fixture, keeping `lint.prototype-derivation` silent. The plan called for this file implicitly ("naming a path that exists in the fixture") without listing it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Literal NUL bytes written into two source files**
- **Found during:** Task 3 (final path/purity audit)
- **Issue:** `packages/core/src/gate/hash.ts` and `packages/core/test/hash.test.ts` each contained a real `U+0000` byte where the source text should have held the six-character escape ` `. `grep` reported both as binary files; `.gitattributes` `* text=auto` could have classified them binary and skipped EOL normalisation, and diffs and editors mangle NUL in source.
- **Fix:** Replaced the literal byte with the escape sequence in both files. Behaviour is identical — TypeScript reads `' '` as the same one-character string — so no golden, no `ac_hash`, and no test expectation changed.
- **Files modified:** `packages/core/src/gate/hash.ts`, `packages/core/test/hash.test.ts`
- **Verification:** `python` byte count reports 0 NUL and 0 CR in both files; `npm run check` re-run after the fix, exit 0, 454 tests passing, no golden moved.

---

**Total deviations:** 1 auto-fixed (1 bug). Two file-level additions beyond the plan's `files_modified` list are recorded under Decisions 4 and 5 rather than as deviations: both are the plan's own instructions taken literally.
**Impact on plan:** None on scope. The NUL fix was necessary for correctness of the source files on disk; it changed no behaviour.

## Prohibitions — verified

| Prohibition | Result |
|---|---|
| No `git commit`, `git push`, `git tag`, no attribution trailer | **Held.** `git log -1 --format=%H` is `97a7977`, unchanged from before execution. Working tree left dirty. |
| No flag/option/env/config key skips a rule or forces a pass | **Held.** `gateReady`'s only inputs are the snapshot and the ticket id. |
| No check swallows an error and returns an empty draft list | **Held.** No `try`/`catch` anywhere under `packages/core/src/gate/`. |
| `verdict` derived from `findings` alone | **Held.** One expression, `findings.some((f) => f.level === 'error')`, asserted per golden case. |
| No `level` literal for a `gate.*` id outside the tables | **Held.** `GateDraft` omits `level`; the table test asserts every id and level comes from a row. |
| The maintain downgrade is data in one table, one call site | **Held.** `grep -vE '^\s*(//\|\*\|/\*)' gate/index.ts \| grep -cF 'downgradeMaintain('` prints 1. |
| GATE-12 stays deferred | **Held.** All four `MAINTAIN_DOWNGRADE` ids are still `warning` in the lint table; a test asserts it. |
| No shipped rule id, reason, or comment names a design tool or planning system | **Held for everything this plan wrote.** See Issues below for a pre-existing exception found in the templates. |

## Issues Encountered

**Pre-existing, out of scope, not fixed:** the shipped ticket templates already name a design vendor — `packages/core/templates/ticket-build.md` line 13 (`# design: "https://www.figma.com/..."`) and line 32 (`Ready then requires a Figma link in design:`), with the same lines in `ticket-maintain.md`, and `docs/design.md` §5's existing Ready row reads "a Figma link or a prototype". `.claude/CLAUDE.md`'s "No other tools named" constraint covers templates and design docs. This predates Phase 4 and no task in this plan touched those lines, so under the executor's scope boundary it is reported rather than fixed. The two rows this plan *added* to §5 and the two template lines it added name no vendor, and the `gate-maintain` fixture ticket is called `UILINK`, not after a vendor.

## Known Stubs

- `packages/core/src/gate/rules.ts` — `DONE_RULES` is an empty `readonly GateRule[]`. This is the plan's specified seam for 04-02, not an unfinished path: `gateDone` does not exist yet, nothing reads the table, and the table test already covers it. It does not block this plan's goal.

## User Setup Required

None.

## Next Phase Readiness

- **Ready for 04-02.** `scoped`, `byFileLineRule`, `GateResult`, `downgradeMaintain`, and `acHash` are all exported from their modules for the Done gate to reuse. The plan's note stands: 04-02 Task 1 should lift the `gateReady` body into a shared function so `downgradeMaintain` keeps exactly one call site.
- `DONE_RULES` is declared and empty; `docs/design.md` §5's Done layers are unchanged and still the normative source.
- `SnapshotInput.git` is declared but nothing produces it yet — `packages/cli/src/load/fs.ts` is Phase 5's job (D-78).
- **Owner confirmation wanted** on the two `docs/design.md` §5 rows (coverage D7) and on the `U+0000` separator, which becomes immutable the moment a real ticket records an `ac_hash`.

---
*Phase: 04-gates*
*Completed: 2026-09-14*

## Self-Check: PASSED

- All 31 claimed files verified present on disk (`[ -f ]` per path).
- `commits: 0` is deliberate and matches the orchestrator's absolute no-commit instruction and the project's `accord-solo-no-prs` rule; `plan_head_before` and the current `HEAD` are both `97a7977174efa56e1d98594355d15a46af50a8b9`. All work is uncommitted in the working tree.
- `.planning/STATE.md` and `.planning/ROADMAP.md` were not modified by this executor.
