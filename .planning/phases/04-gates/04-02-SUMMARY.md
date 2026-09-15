---
phase: 04-gates
plan: 02
subsystem: gates
tags: [gate-done, three-set-match, fnv1a, sha-prefix, tick-binding, vitest, goldens]

# Dependency graph
requires:
  - phase: 04-gates
    plan: 01
    provides: "gateReady, scoped, byFileLineRule, GateResult, acHash, downgradeMaintain, DONE_RULES (the empty seam), verified_hash/verified_commit, SnapshotInput.git"
  - phase: 02-core-model-and-loading
    provides: "Verification, EvidenceBlock, the duplicate-by-tag and load.result-invalid handling, fixtures and the golden harness"
  - phase: 03-lint
    provides: "lintSnapshot and the ticket-scoped findings Done includes at the level lint stamped"
provides:
  - "gateDone(snapshot, id) returning a GateResult: verdict, reasons by rule id, and the AC hash"
  - "packages/core/src/gate/done.ts — twelve checks plus the D-81 shaEqual/isSha pair"
  - "Twelve Done rule ids, all error on both profiles"
  - "One shared engine body, so gateReady and gateDone inherit the GATE-07 matrix from one downgradeMaintain call site"
  - "loadSnapshot now carries input.git onto the RepoSnapshot (D-78 was declared but never wired)"
  - "The gate-done fixture: nine tickets, seven verification records, a JUnit report, and thirteen goldens"
affects: [04-03, 04-04, 05-cli, 06-skills]

actuals:
  tokens: 29000
  tasks: 2
  commits: 0
  plan_head_before: 97a7977174efa56e1d98594355d15a46af50a8b9

tech-stack:
  added: []
  patterns:
    - "One shared gate body parameterised by gate name, rule table, and promotion list — a second copy is how a gate silently falls out of the GATE-07 matrix"
    - "Three-set comparison against the union, so `length === union.length` is membership equality and each set's gap is named against the union"
    - "Host facts ride on the CASES row and are spread onto the SnapshotInput after readFixture, because a fixture on disk cannot carry git"
    - "Each identity-layer fixture ticket is a copy of PASS differing in exactly one respect, so its golden isolates one reason"

key-files:
  created:
    - packages/core/src/gate/done.ts
    - packages/core/test/fixtures/gate-done/ (20 files)
    - packages/core/test/__golden__/gate-done.PASS.done.json
    - packages/core/test/__golden__/gate-done.PASS.ready.json
    - packages/core/test/__golden__/gate-done.SETS.done.json
    - packages/core/test/__golden__/gate-done.BLOCKED.done.json
    - packages/core/test/__golden__/gate-done.NOVERIF.done.json
    - packages/core/test/__golden__/gate-done.EMPTY.done.json
    - packages/core/test/__golden__/gate-done.STALE.done.json
    - packages/core/test/__golden__/gate-done.TICKS.done.json
    - packages/core/test/__golden__/gate-done.COMMIT.done.json
    - packages/core/test/__golden__/gate-done.REVIEW.done.json
    - packages/core/test/__golden__/gate-done.snapshot.json
    - packages/core/test/__golden__/gate-done.lint.json
    - packages/core/test/__golden__/verification-edges.A.done.json
  modified:
    - packages/core/src/gate/rules.ts
    - packages/core/src/gate/index.ts
    - packages/core/src/index.ts
    - packages/core/src/load/snapshot.ts
    - packages/core/test/gate.test.ts

key-decisions:
  - "loadSnapshot never copied input.git onto the snapshot; D-78 was type-only until this plan wired it, and every commit check read undefined until then"
  - "The D-89 hygiene promotion is a parameter of the shared body rather than a step above the shared call, because the lint list is built inside that body"
  - "The two git-variant cases (no git, six-character commit) are pinned by exact assertions rather than by two extra goldens the plan's file list never named"
  - "gate.tick-unbound names both missing keys in one finding, with subject-verb agreement, rather than one finding per absent key"
  - "The golden loop's describe is now `gate case <row.name>`, which is what the file's own documented regeneration command already assumed"

patterns-established:
  - "A gate rule that cannot evaluate emits a finding; nothing in gate/ reports itself skipped and nothing catches"
  - "tickStaleCommit and staleReview both guard on isSha before comparing, so one bad character produces one reason"
  - "Synthetic error rows are injected through snapshot.errors, which lintSnapshot stamps error, to observe the profile matrix on ids no fixture can distinguish"

requirements-completed: [GATE-02, GATE-03, GATE-11]

coverage:
  - id: D1
    description: "gateDone returns a GateResult built from the same scope filter, stamping, and sort as gateReady, and is pure by the two-call and structuredClone checks"
    requirement: GATE-02
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#is pure, deterministic, and already sorted (D-87, T-03-12)"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/gate-done.PASS.done.json (golden)"
        status: pass
    human_judgment: false
  - id: D2
    description: "One fixture ticket passes Done end to end with a real hash and a real commit binding, and also passes Ready"
    requirement: GATE-02
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#PASS goes through Done end to end with no error finding (the phase end-to-end proof)"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/gate-done.PASS.ready.json (golden)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The three-set match: one gate.tags-differ naming each set's gap in a fixed order, numerically sorted, with `nothing` where a set lacks none"
    requirement: GATE-02
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#SETS: one gate.tags-differ naming each set gap in the fixed order, \"nothing\" where none"
        status: pass
      - kind: unit
        ref: "packages/core/test/gate.test.ts#three equal sets raise nothing, and the order of verified changes no byte of the result"
        status: pass
    human_judgment: false
  - id: D4
    description: "Three empty sets never read as equal: gate.no-scenarios fires on any ticket type, including an epic"
    requirement: GATE-02
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#EMPTY: an epic with no tagged scenario fails on gate.no-scenarios, so three empty sets never agree"
        status: pass
    human_judgment: false
  - id: D5
    description: "Result: blocked and Result: fail fail Done; a missing or invalid Result: stays the loader's rule"
    requirement: GATE-02
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#BLOCKED: gate.result-not-pass names the tag and the recorded value, and fail reads the same way"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/verification-edges.A.done.json (golden)"
        status: pass
    human_judgment: false
  - id: D6
    description: "An acceptance-criteria edit after Ready fails Done on gate.ac-changed, naming both the recorded and the computed hash"
    requirement: GATE-03
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#STALE: an acceptance-criteria edit after Ready fails on ac-changed, and drags the tick with it"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/gate-done.STALE.done.json (golden)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A tick with no binding, a tick against another hash, and a tick against another commit each fail with their own reason"
    requirement: GATE-11
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#TICKS: verified with neither binding key is exactly one tick-unbound naming both"
        status: pass
      - kind: unit
        ref: "packages/core/test/gate.test.ts#COMMIT: a valid sha that is not the gated commit fails, naming both values"
        status: pass
    human_judgment: false
  - id: D8
    description: "The D-81 sha rule: 7-character prefix match, case-insensitive, symmetric, and never equal below 7 hex characters"
    requirement: GATE-11
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#shaEqual and isSha: the D-81 prefix rule, pinned in both directions (4 tests)"
        status: pass
    human_judgment: false
  - id: D9
    description: "A missing host commit fails Done rather than reporting the check skipped; a too-short one produces exactly one reason"
    requirement: GATE-11
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#a missing host commit fails Done rather than reporting the check skipped (D-80 reasoning)"
        status: pass
      - kind: unit
        ref: "packages/core/test/gate.test.ts#a too-short host commit is one sha-too-short and never also a mismatch (D-81)"
        status: pass
    human_judgment: false
  - id: D10
    description: "The maintain downgrade reaches Done from the same single call site Ready uses (GATE-07 as a matrix, not a Ready feature)"
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#the maintain downgrade reaches Done from the same call site Ready uses (GATE-07, D-88)"
        status: pass
    human_judgment: false

# Metrics
duration: 28min
completed: 2026-09-14
status: complete
---

# Phase 4 Plan 02: Done Gate Summary

**`gateDone` refuses a ticket unless the scenario tags, the evidence blocks, and `verified` are the same set, and unless those ticks were made against the acceptance criteria and the commit in front of it now — proved by one fixture ticket that goes through Done end to end with zero findings and eight siblings that each fail on exactly one reason.**

## Performance

- **Duration:** ~28 min
- **Tasks:** 2 of 2
- **Files created:** 34 (1 source, 20 fixture files, 13 goldens)
- **Files modified:** 5
- **Tests:** 508 passing across 20 files (was 454 after 04-01)

## Accomplishments

- `gateDone(snapshot, id)` exists and is exported from the barrel. It composes the twelve-row `DONE_RULES` table with every ticket-scoped lint finding at the level lint stamped — no hygiene promotion, no design rule, because Done does not re-run Ready.
- **`gateReady` and `gateDone` now share one engine body.** `downgradeMaintain` still has exactly one live call site, and it is inside that body, so GATE-07 is a property of the gate mechanism rather than of Ready alone. Behaviour 10 drives four synthetic `error` rows through `gateDone` on both profiles, which is the only way that placement is observable — every `MAINTAIN_DOWNGRADE` id is already a warning in the real lint table, so no fixture and no golden can catch a missing call.
- The three-set match (GATE-02) is one finding reading `scenarios lack …; evidence lacks …; verified lacks …`, mirroring `lint.plan-tags-differ`. Tag lists are sorted by the numeric part of the tag and rendered `nothing` when a set lacks none, so the reason text is identical on every host.
- The empty-set hole is closed by a dedicated `gate.no-scenarios` that fires on **any** ticket type. Without it an `epic` with no scenarios would pass Done vacuously, because three empty sets are trivially equal. `lint.no-scenarios` was not enough: it skips epics by design.
- The identity layer (GATE-03, GATE-11) is eight rules over three sources that must agree — the recorded `ac_hash`, the recorded `verified_hash` / `verified_commit`, and the review's own `commit:` — with the D-81 prefix rule pinned directly on `shaEqual` in both argument orders, because `ticket.schema.json`'s `minLength: 7` makes a too-short `verified_commit` impossible to build as a fixture.
- `gate-done/PASS` is the phase's end-to-end proof: `gateDone` returns `{ verdict: 'pass', findings: [] }` — not merely zero errors, zero findings — and the same ticket passes Ready.

## Verification

`npm run check` (build, lint, typecheck, full test suite) — **exit 0.**

```
Test Files  20 passed (20)
     Tests  508 passed (508)
```

Per-task gates also green: `npm run lint`, `npm run typecheck`, and the scoped `gate`, `lint`, `snapshot`, and `schemas` projects.

**No Phase 1–3 golden moved.** `git status --porcelain -- packages/core/test/__golden__` lists thirteen new goldens and exactly one modification, `ticket-build.verified-empty.md`, which 04-01 regenerated on purpose and this plan did not touch.

**Acceptance criteria, checked as written:**

| Check | Result |
|---|---|
| `grep -cE "'gate\.(no-scenarios\|tags-differ\|verification-missing\|result-not-pass)'" gate/rules.ts` | 4 |
| `grep -cE "'gate\.(commit-missing\|sha-too-short\|ac-hash-missing\|ac-changed\|tick-unbound\|tick-stale-hash\|tick-stale-commit\|stale-review)'" gate/rules.ts` | 8 |
| `grep -c '"level": "error"' gate-done.PASS.done.json` | 0 |
| `gate-done.PASS.ready.json` contains `"verdict": "pass"` | yes |
| `gate-done.SETS.done.json` contains `gate.tags-differ` and `nothing` | yes |
| `gate-done.EMPTY.done.json` contains `gate.no-scenarios` | yes |
| `gate-done.BLOCKED.done.json` contains `gate.result-not-pass` and `blocked` | yes |
| `verification-edges.A.done.json` contains `load.result-invalid` and `gate.result-not-pass` | yes |
| `gate-done.STALE.done.json` contains `gate.ac-changed` and `gate.tick-stale-hash` | yes |
| `gate-done.TICKS.done.json` contains `gate.tick-unbound`; `grep -c "gate.tick-stale"` | 1 / 0 |
| `gate-done.COMMIT.done.json` contains `gate.tick-stale-commit` | yes |
| `gate-done.REVIEW.done.json` contains `gate.stale-review` | yes |
| live `downgradeMaintain(` call sites in `gate/index.ts`, comments stripped | 1 |
| `grep -c "maintain downgrade reaches Done" gate.test.ts` | 1 |
| `git log -1 --format=%H` | `97a7977…`, unchanged |

## Files Created/Modified

**Created**

- `packages/core/src/gate/done.ts` — `isSha`, `shaEqual`, and twelve checks: `noScenarios`, `tagsDiffer`, `verificationMissing`, `resultNotPass`, `commitMissing`, `shaTooShort`, `acHashMissing`, `acChanged`, `tickUnbound`, `tickStaleHash`, `tickStaleCommit`, `staleReview`. Module-internal: `tagsOf`, `fmt`, `scenarioTags`, `evidenceTags`, `tickTags`, `computed`.
- `packages/core/test/fixtures/gate-done/` (20 files) — `config.yml` with `tests.report`, `reports/junit.xml` (two passing cases resolving to `test/login.spec.ts#ok1` and `#ok2`), real `src/auth/login.ts` and `test/login.spec.ts` so the tree genuinely holds them for 04-03's reference resolution, nine tickets (`PASS`, `SETS`, `BLOCKED`, `NOVERIF`, `EMPTY`, `STALE`, `TICKS`, `COMMIT`, `REVIEW`) and seven verification records.
- 13 goldens — ten `gate-done.*.json` gate results, `verification-edges.A.done.json`, and `gate-done.{snapshot,lint}.json` from the directory-scanning suites.

**Modified**

- `packages/core/src/gate/rules.ts` — `DONE_RULES` filled with twelve rows, all `error`, both profiles
- `packages/core/src/gate/index.ts` — the shared `run()` body; `gateReady` and `gateDone` are two three-line wrappers over it
- `packages/core/src/index.ts` — `gateDone` added to the value exports
- `packages/core/src/load/snapshot.ts` — `input.git` carried through (see Deviations)
- `packages/core/test/gate.test.ts` — the `git` field on `Case`, the shared `GIT` constant, eleven new case rows, and four new `describe` blocks; the 04-01 downgrade `describe` extended with behaviour 10

## Decisions Made

1. **`loadSnapshot` now carries `input.git`.** D-78 was declared on both types in 04-01 but nothing copied it, so `snapshot.git` was always `undefined`. One spread at the end of `loadSnapshot`, guarded so an absent `git` stays absent in the D-54 golden.
2. **The D-89 hygiene promotion is a parameter of the shared body**, not a step above the shared call. The lint list is built inside that body; applying the promotion outside would mean building it twice or returning it. `gateReady` passes `READY_PROMOTE`, `gateDone` passes `[]` — the promotion is still Ready's alone.
3. **`gate.tick-unbound` is one finding naming both missing keys**, not one per key. A tick with neither binding is one mistake, not two.
4. **`acChanged`, `tickStaleHash`, and `acHashMissing` all return `[]` when the computed hash is `undefined`** — that is the no-scenario case, and `gate.no-scenarios` already owns it. Without the guard a ticket with an `ac_hash` and no scenarios would produce a reason naming `undefined`.
5. **The golden loop's `describe` is now `gate case <row.name>`.** The file header already documents regeneration as `-t "<case name>"`, which never matched the old `gate <gate> <fixture>/<ticket>` name. It does now; `-t "gate case gate-done.TICKS.done"` was used to regenerate one golden during this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `SnapshotInput.git` was never carried onto `RepoSnapshot`**

- **Found during:** Task 2, first run of the identity-layer tests
- **Issue:** 04-01 added `git?: { commit, authors }` to both `SnapshotInput` and `RepoSnapshot` (D-78) and to the snapshot-model comments, but no line in `packages/core/src/load/snapshot.ts` copied the value across. Every `snapshot.git?.commit` read `undefined`, so `gate.commit-missing` fired on the `PASS` ticket even though the case row supplied a valid 40-character commit, and `gate.sha-too-short`, `gate.tick-stale-commit`, and `gate.stale-review` could never fire at all. Five tests failed and six goldens were briefly written with the wrong content before the cause was found.
- **Fix:** one guarded spread at the end of `loadSnapshot`, matching the existing `tests` precedent:
  `...(input.git === undefined ? {} : { git: input.git }),`
- **Files modified:** `packages/core/src/load/snapshot.ts`
- **Verification:** all affected goldens regenerated afterwards; `gate-done.snapshot.json` is unaffected because the snapshot suite reads fixtures without `git`. Full suite green.
- **Note for the author:** this is a gap in 04-01's uncommitted work, not a fault in its plan — 04-01 landed the *contract* and this plan is the first consumer. Worth a glance in review, since it means D-78 was untested until now.

**2. [Rule 1 — Reason text] `gate.tick-unbound` had no subject-verb agreement**

- **Found during:** Task 2 golden review
- **Issue:** the reason read `verified_hash and verified_commit is not recorded`.
- **Fix:** `${missing.length > 1 ? 'are' : 'is'}`. Test and golden updated in the same step.

### Scope deviations (stated, not auto-fixed)

**3. Two case rows became inline assertions instead of two goldens.** The plan's Task 2 action text asks for "two rows reusing the `PASS` ticket with a different `git`" in `CASES`, which would produce two goldens; the plan's `files_modified` frontmatter names neither. Both behaviours — `gate.commit-missing` with no `git` at all, and `gate.sha-too-short` with `git.commit: 'abc123'` — are pinned by exact assertions inside the identity-layer `describe`, including the negative assertions that no check reports itself skipped and that a too-short value produces no second mismatch finding. Same regression protection, two fewer files. Flag if you want the goldens.

**4. Task 1 behaviour Test 7 asked for a Task 2 rule.** It specifies `gate.ac-hash-missing` on `NOVERIF`, but that rule is introduced by Task 2. Task 1's `NOVERIF` assertion covers `gate.verification-missing`; the full two-rule assertion lives in the Task 2 `describe` and is also visible in `gate-done.NOVERIF.done.json`.

**5. Task 2 behaviour Test 8 (verified order) is covered once, in Task 1.** Task 1 behaviour 4 already performs the in-test frontmatter edit that reverses `verified` and asserts a byte-identical `stableJson`. It was not duplicated.

---

**Total deviations:** 2 auto-fixed (1 blocking gap, 1 reason text), 3 scope statements.
**Impact on plan:** none on scope or on any requirement. Every `must_haves` truth is asserted.

## Prohibitions — verified

| Prohibition | Result |
|---|---|
| No `git commit`, `git push`, `git tag`; no attribution trailer | **Held.** `git log -1 --format=%H` is `97a7977174efa56e1d98594355d15a46af50a8b9`, unchanged from before execution. No `git add`, `git stash`, or `git reset` was run. Working tree left dirty. |
| No gate function writes `ac_hash`, `verified_hash`, or `verified_commit` | **Held.** `grep -rn 'writeFile\|setFrontmatterKey' packages/core/src/gate/` returns nothing; every check returns drafts only. |
| No flag, option, env var, or config key skips a Done check or forces a pass | **Held.** `gateDone`'s only inputs are the snapshot and the ticket id; `verdict` is one expression over `findings`. A missing `git.commit` raises `gate.commit-missing` rather than reporting skipped, asserted directly. |
| The three-set comparison is never softened | **Held.** Exact string set equality against the union; no subset test, no case folding, no tolerance. |
| No check swallows an error and returns an empty draft list | **Held.** No `try` anywhere under `packages/core/src/gate/`. |
| No per-tick storage shape; `verified` stays a flat string array | **Held.** `TicketFrontmatter.verified` and `ticket.schema.json` are untouched by this plan. T-04-07 stays accepted under D-76. |
| `.planning/STATE.md` and `.planning/ROADMAP.md` untouched | **Held.** Both were already modified before this plan started and were not written by this executor. |

## Issues Encountered

**Carried forward from 04-01, still out of scope:** the shipped ticket templates and `docs/design.md` §5 name a design vendor (`.claude/CLAUDE.md`'s "No other tools named" constraint). No task in this plan touched those lines. Nothing this plan wrote names a tool, plugin, or planning system — rule ids, reasons, fixture ticket names, and comments were checked.

**Six goldens were written with wrong content mid-run** while the `input.git` gap was undiagnosed, then regenerated. Their final content was reviewed as text (reproduced below in part) rather than as a diff against a committed baseline, because nothing in `packages/core/src/gate/` or `test/__golden__/gate-*` is committed yet. All nine `gate-ready` / `gate-maintain` / `valid-build` Ready goldens were re-verified by a clean `vitest run --project core gate` with no `-u`.

## Known Stubs

None. `DONE_RULES` is no longer the empty seam 04-01 left; `GIT.authors` is `{}` by the plan's own instruction, which 04-04 fills — that is a declared seam, not a stub, and no check reads it yet.

## Threat Flags

None. Every file this plan created is a pure rule module, a test fixture, or a golden. No network surface, no auth path, no file access, and no schema change at a trust boundary.

## User Setup Required

None.

## Next Phase Readiness

- **Ready for 04-03 and 04-04.** `gate-done/PASS` passes Done with zero findings and must stay that way: its `## Verification notes` blocks already name `src/auth/login.ts` in Vietnamese text that is not the scenario pasted back (D-85), its evidence lines cite `test/login.spec.ts#ok1` / `#ok2`, and the fixture tree really holds `src/auth/login.ts` and `test/login.spec.ts`, so 04-03's D-82 reference resolution has something to resolve against.
- `GIT.authors` is `{}` and the `git` spread mechanism is in place, so 04-04's GATE-05 author check needs only to fill the record on the `CASES` row.
- `gate.tests-unconfigured` (D-80) and the GATE-08 join are **not** in this plan; `gate-done/config.yml` already declares `tests.report` so those rules land on a fixture that satisfies them.
- **Owner confirmation wanted** on two things: the `loadSnapshot` `git` carry-through (deviation 1 — it is a one-line fix to 04-01's uncommitted work), and the GATE-02 reason wording `scenarios lack …; evidence lacks …; verified lacks …`, which 04-CONTEXT left to Claude's discretion and which will appear verbatim in Phase 6 skill text.

---
*Phase: 04-gates*
*Completed: 2026-09-14*

## Self-Check: PASSED

- All claimed files verified present on disk (`[ -f ]` per path); the `gate-done` fixture holds exactly the 20 files listed.
- `commits: 0` is deliberate and matches the orchestrator's absolute no-commit instruction and the project's `accord-solo-no-prs` rule. `plan_head_before` and the current `HEAD` are both `97a7977174efa56e1d98594355d15a46af50a8b9`; the index is empty (`git diff --cached` lists nothing). All work is uncommitted in the working tree.
- `.planning/STATE.md` and `.planning/ROADMAP.md` were **not** written by this executor. Both already carried uncommitted changes before this plan started (they appear as `M` in the session's opening `git status`); their diffs are the orchestrator's, not this plan's.
- `npm run check` re-run after the last edit: exit 0, 508 tests passing across 20 files.
