---
phase: 04-gates
plan: 03
subsystem: gates
tags: [gate-done, gate-04, gate-09, gate-10, references, verification-notes, vietnamese, vitest, goldens]

# Dependency graph
requires:
  - phase: 04-gates
    plan: 02
    provides: "gateDone, the shared engine body, DONE_RULES, the gate-done fixture with a real src/auth/login.ts and test/login.spec.ts in its tree, and gate-done/PASS passing end to end"
  - phase: 04-gates
    plan: 01
    provides: "GateRule, GateDraft, byFileLineRule, the READY/DONE tables and the GATE-07 matrix"
  - phase: 03-lint
    provides: "lint/tokens.ts's Derived-from resolution against snapshot.tree (D-67), the Set-from-a-template-literal allowlist idiom, and lint/ticket.ts's NOTE_BLOCK reader"
  - phase: 02-core-model-and-loading
    provides: "headingKey and stripHtmlComments, normaliseKey, Section.lines with 1-based lines, EvidenceBlock.evidence, ScenarioRef.name/steps"
provides:
  - "packages/core/src/gate/refs.ts — one extraction-and-resolution rule (D-82) serving both GATE-04 and GATE-10"
  - "candidates, resolves, unresolvedRefs, stripRefs, normalise, noteBlocks — the shared string layer"
  - "Five Done rule ids: gate.evidence-unresolved, gate.reference-unknown (warning), gate.note-missing, gate.note-unresolved, gate.note-pasted"
  - "Three fixture tickets in gate-done: EVIDENCE, NOTES, UINOTE, each with a verification record"
  - "packages/core/test/refs.test.ts — 36 pinned edges, including the two CONTEXT Vietnamese cases"
affects: [04-04, 05-cli, 06-skills]

actuals:
  tokens: 8000
  tasks: 2
  commits: 0
  plan_head_before: 97a7977174efa56e1d98594355d15a46af50a8b9

tech-stack:
  added: []
  patterns:
    - "One tokeniser, one resolver, used twice — the evidence rule and the note rule are two callers of the same four functions, so a change to the heuristic cannot make GATE-04 and GATE-10 disagree"
    - "The heuristic's edges live in a unit-test file, never in a golden: a golden shows what the rule said about a fixture, a unit test shows why"
    - "stripRefs resolves each distinct candidate once and then filters tokens against that set, which is what keeps a 200 kB evidence block linear"
    - "A rule that must never acquire a threshold says so in its header comment, so the next reader sees the prohibition before the code"

key-files:
  created:
    - packages/core/src/gate/refs.ts
    - packages/core/test/refs.test.ts
    - packages/core/test/fixtures/gate-done/accord/tickets/EVIDENCE.md
    - packages/core/test/fixtures/gate-done/accord/tickets/EVIDENCE/verification.md
    - packages/core/test/fixtures/gate-done/accord/tickets/NOTES.md
    - packages/core/test/fixtures/gate-done/accord/tickets/NOTES/verification.md
    - packages/core/test/fixtures/gate-done/accord/tickets/UINOTE.md
    - packages/core/test/fixtures/gate-done/accord/tickets/UINOTE/verification.md
    - packages/core/test/__golden__/gate-done.EVIDENCE.done.json
    - packages/core/test/__golden__/gate-done.NOTES.done.json
    - packages/core/test/__golden__/gate-done.UINOTE.done.json
  modified:
    - packages/core/src/gate/rules.ts
    - packages/core/test/gate.test.ts
    - packages/core/test/__golden__/verification-edges.A.done.json
    - packages/core/test/__golden__/gate-done.SETS.done.json
    - packages/core/test/__golden__/gate-done.snapshot.json

key-decisions:
  - "candidates() dedupes on the trimmed token, so a repeated typo is one warning and a repeated real path is one resolution — the count never depends on how often the prose repeats itself"
  - "stripRefs computes the resolving set once per text rather than calling resolves() per token; without it the 200 kB perf case is ~360M endsWith calls instead of ~20k"
  - "NOTES's third scenario carries @ui rather than a third @test: id, so the fixture needs no third JUnit case and earns no lint.test-tag-missing warning"
  - "gate-done/SETS gained gate.note-missing: it ticks @ac-3, which has no note block. Correct behaviour, but a golden the plan did not list"
  - "gate-done.lint.json did not move — the three new tickets are lint-clean, so the directory-scanning lint golden was already right"

patterns-established:
  - "Object.hasOwn on snapshot.tests in both candidates() and resolves(); `in` would make a test id named toString read as known (T-04-17)"
  - "The segment-boundary suffix is written as p.endsWith('/' + key), never as a bare endsWith, so a partial filename cannot match (T-04-15)"
  - "normalise() touches case, punctuation, and whitespace and nothing else; no Unicode folding, no transliteration, no NFC/NFD pass"

requirements-completed: [GATE-04, GATE-09, GATE-10]

coverage:
  - id: R1
    description: "A reference candidate is a whitespace-delimited token, punctuation and a :line:col suffix stripped, that contains `/`, ends in a recognised extension, or is a key of snapshot.tests (D-82)"
    requirement: GATE-04
    verification:
      - kind: unit
        ref: "packages/core/test/refs.test.ts#candidates (D-82 extraction) — 8 tests"
        status: pass
    human_judgment: false
  - id: R2
    description: "`npm test -- login.spec.ts` yields exactly one candidate; npm, test, and -- are not candidates"
    requirement: GATE-04
    verification:
      - kind: unit
        ref: "packages/core/test/refs.test.ts#picks the file out of a command and ignores npm, test, and --"
        status: pass
    human_judgment: false
  - id: R3
    description: "Resolution is exact code-point equality against a tree path or a segment-boundary suffix of one; ogin.spec.ts and xtest/login.spec.ts do not resolve, login.spec.ts does (GATE-04 adjacency, T-04-15)"
    requirement: GATE-04
    verification:
      - kind: unit
        ref: "packages/core/test/refs.test.ts#resolves (D-82 segment-boundary resolution) — 9 tests"
        status: pass
    human_judgment: false
  - id: R4
    description: "An evidence block yielding no resolving candidate fails Done; a block with one resolving and one stray candidate passes and warns (GATE-04 empty, D-83)"
    requirement: GATE-04
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#EVIDENCE: a block citing nothing real fails; a mistyped path only warns (GATE-04, D-83)"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/gate-done.EVIDENCE.done.json (golden)"
        status: pass
    human_judgment: false
  - id: R5
    description: "gate.reference-unknown stays a warning and cannot substitute for gate.evidence-unresolved (D-83)"
    requirement: GATE-04
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#gate.reference-unknown can never stand in for gate.evidence-unresolved (D-83)"
        status: pass
    human_judgment: false
  - id: R6
    description: "Findings are emitted per block in block order and a repeated stray token raises one warning, not two (GATE-04 ordering)"
    requirement: GATE-04
    verification:
      - kind: unit
        ref: "packages/core/test/refs.test.ts#raises one entry for a token repeated twice (D-83)"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/verification-edges.A.done.json (golden: four blocks, four findings, engine-sorted)"
        status: pass
    human_judgment: false
  - id: R7
    description: "gateDone performs no I/O and holds no module-level state: interleaved Done and Ready calls return byte-identical stableJson and leave the snapshot deep-equal to a structuredClone (GATE-04 concurrency)"
    requirement: GATE-04
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#interleaved Done and Ready calls are byte-identical and leave the snapshot untouched"
        status: pass
    human_judgment: false
  - id: R8
    description: "GATE-10's \"symbol present in the snapshot\" is the D-82 rule and nothing else: a note whose only reference is an identifier fails gate.note-unresolved (D-84)"
    requirement: GATE-10
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#NOTES: one missing note, one pasted note, one note naming only an identifier (GATE-10)"
        status: pass
      - kind: unit
        ref: "packages/core/test/refs.test.ts#never accepts an identifier-shaped word (D-84)"
        status: pass
    human_judgment: false
  - id: R9
    description: "A ticked scenario with no ### @ac-n block fails gate.note-missing; an empty remainder fails gate.note-pasted (GATE-10 empty, D-85)"
    requirement: GATE-10
    verification:
      - kind: unit
        ref: "packages/core/test/__golden__/gate-done.NOTES.done.json (golden)"
        status: pass
    human_judgment: false
  - id: R10
    description: "Normalisation preserves Vietnamese diacritics, so trả and tra stay different words (GATE-10 encoding, D-85)"
    requirement: GATE-10
    verification:
      - kind: unit
        ref: "packages/core/test/refs.test.ts#lower-cases and keeps Vietnamese diacritics"
        status: pass
    human_judgment: false
  - id: R11
    description: "The note `src/auth/login.ts trả 401 trước khi hash` passes and the same scenario pasted back with a path appended fails, on the same scenario (D-85, CONTEXT specifics)"
    requirement: GATE-10
    verification:
      - kind: unit
        ref: "packages/core/test/refs.test.ts#the two CONTEXT Vietnamese cases (D-85) — 4 tests"
        status: pass
    human_judgment: false
  - id: R12
    description: "The outcome is decided by equality and substring alone: one character passes when it is not a substring and fails when it is, so length never enters the comparison (GATE-10 boundary)"
    requirement: GATE-10
    verification:
      - kind: unit
        ref: "packages/core/test/refs.test.ts#one character decides both ways, and length never enters it (GATE-10 boundary)"
        status: pass
    human_judgment: false
  - id: R13
    description: "A remainder equal to or a proper substring of the scenario text fails; a remainder containing the whole scenario plus further words passes (GATE-10 adjacency, D-85)"
    requirement: GATE-10
    verification:
      - kind: unit
        ref: "packages/core/test/refs.test.ts#a note that quotes the scenario and then explains passes (GATE-10 adjacency)"
        status: pass
    human_judgment: false
  - id: R14
    description: "Note findings are emitted one per ticked tag in numeric order, and a ticket with two failing notes produces two findings with distinct lines (GATE-10 ordering)"
    requirement: GATE-10
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#NOTES: one missing note, one pasted note, one note naming only an identifier (GATE-10)"
        status: pass
    human_judgment: false
  - id: R15
    description: "A @ui scenario is subject to exactly the same three note rules, with no stricter variant and no requirement that the note name a prototype (D-90, GATE-09)"
    requirement: GATE-09
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#UINOTE: a @ui scenario gets exactly the same note rule, no stricter variant (D-90, GATE-09)"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/gate-done.UINOTE.done.json (golden)"
        status: pass
    human_judgment: false
  - id: R16
    description: "gate-done/PASS still returns verdict pass with no error-level finding after the five rules land"
    requirement: GATE-04
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#PASS still goes through Done with no error finding after the Human layer lands"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/gate-done.PASS.done.json (golden: findings [], verdict pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-09-14
status: complete
---

# Phase 4 Plan 03: The Human Layer of Done Summary

**One extraction-and-resolution rule now serves both GATE-04 and GATE-10 — evidence that names no file, test, or command in the snapshot fails Done, a note that is the scenario pasted back fails Done, a mistyped path only warns, and a `@ui` scenario gets exactly the same note rule as any other.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 of 2
- **Files created:** 11 (1 source, 1 test, 6 fixture files, 3 goldens)
- **Files modified:** 5 (2 source/test, 3 goldens regenerated)
- **Tests:** 556 passing across 21 files (was 508 across 20 after 04-02)

## Accomplishments

- **`packages/core/src/gate/refs.ts` is one rule, used twice.** `candidates` → `resolves` → `unresolvedRefs` / `stripRefs` → `normalise` is the whole string layer; the evidence rule and the three note rules are four short callers of it. D-84's "GATE-10's symbol check is the GATE-04 rule" is therefore a fact about the code, not a comment: there is no second path that could drift.
- **The extraction picks a file out of a command.** `npm test -- login.spec.ts` yields exactly `['login.spec.ts']` — `npm` has no slash, no recognised extension, and is not a test id; `--` survives punctuation trimming as `--` and fails the same three tests. That is the `valid-build` line 04-CONTEXT named as the reference case.
- **Resolution is a segment-boundary suffix match, never a bare `endsWith`.** `login.spec.ts` resolves against `test/login.spec.ts`; `ogin.spec.ts` and `xtest/login.spec.ts` do not. Comparison is exact code-point equality, so `Test/login.spec.ts` fails — a case-insensitive rule would pass on the author's Windows machine and fail on the CI runner, which is the worse failure.
- **Both CONTEXT Vietnamese cases behave as the owner specified.** `src/auth/login.ts trả 401 trước khi hash` leaves the remainder `trả 401 trước khi hash`, which is not a substring of the scenario, and passes. The same scenario's name and steps pasted back with ` src/auth/login.ts` appended leaves a remainder equal to the scenario text, and fails. Diacritics are never folded: `normalise('Trả')` is `trả` and is asserted **not** to be `tra`.
- **No numeric knob exists anywhere in the note path.** The decision is `remainder === '' || scenarioText.includes(remainder)`. One test proves the point directly: the single character `z` passes and the single character `h` fails, on the same note and the same scenario, so length demonstrably plays no part.
- **`gate.reference-unknown` is the only warning on the Done table.** A writer who cited real evidence and mistyped one path still passes GATE-04; the golden shows the error on `@ac-1` and the warning on `@ac-2`, on different lines, so neither can be mistaken for the other.
- **`gate-done/PASS` still returns `{ verdict: 'pass', findings: [] }`** — the regression contract held with no change to the fixture. Its notes already named `src/auth/login.ts` in prose of their own, which is exactly what 04-02 built them to prove.

## Verification

`npm run check` (build, lint, typecheck, full test suite) — **exit 0.**

```
Test Files  21 passed (21)
     Tests  556 passed (556)
```

Per-task gates also green: `npm run lint`, `npm run typecheck`, `npm test -- --project core refs` (36 passing, 0 failures), `gate` (94), `lint` and `snapshot` (193 together).

**Acceptance criteria, checked as written:**

| Check | Result |
|---|---|
| `refs.ts` exports `candidates`, `resolves`, `stripRefs`, `normalise`, `noteBlocks` | 5 |
| `grep -cE "^import .*'node:" refs.ts` | 0 |
| `grep -c "Object.hasOwn" refs.ts` / `grep -cE "\bin snapshot\.tests\b"` | 9 / 0 |
| `refs.test.ts` contains `npm test -- login.spec.ts`, `trả 401 trước khi hash`, `ogin.spec.ts` | yes / yes / yes |
| `npm test -- --project core refs` | 36 passed, 0 failed |
| `grep -cE "'gate\.(evidence-unresolved\|reference-unknown\|note-missing\|note-unresolved\|note-pasted)'" rules.ts` | 5 |
| `grep -c "id: 'gate.reference-unknown', level: 'warning'" rules.ts` | 1 |
| `gate-done.EVIDENCE.done.json` contains `gate.evidence-unresolved` and `src/nope.ts` | yes |
| `gate-done.NOTES.done.json` contains `gate.note-missing`, `gate.note-unresolved`, `gate.note-pasted` | yes |
| `gate-done.UINOTE.done.json` contains `gate.note-pasted`; `grep -c "gate.note-missing"` | yes / 0 |
| `grep -c '"level": "error"' gate-done.PASS.done.json` | 0 (the file has no findings at all) |
| `grep -cE "id: 'gate\.[a-z-]*ui" rules.ts` | 0 |
| `npm test -- --project core gate` | 0 failures |
| `git log -1 --format=%H` | `97a7977…`, unchanged |

## Files Created/Modified

**Created**

- `packages/core/src/gate/refs.ts` — `candidates`, `resolves`, `unresolvedRefs`, `stripRefs`, `normalise`, `noteBlocks`, and the five checks `evidenceUnresolved`, `referenceUnknown`, `noteMissing`, `noteUnresolved`, `notePasted`. Module-internal: `EXT`, `PUNCT`, `POSITION`, `NOTE_BLOCK`, `token`, `shaped`, `ticked`, `cites`.
- `packages/core/test/refs.test.ts` — 36 tests in seven describes: extraction, resolution, `unresolvedRefs`, `stripRefs`, `normalise`, `noteBlocks`, the two CONTEXT Vietnamese cases, and the linear-time bound.
- Six fixture files: `EVIDENCE.md` + `EVIDENCE/verification.md` (one block citing prose only, one citing `test/login.spec.ts` plus `src/nope.ts`), `NOTES.md` + `NOTES/verification.md` (no `### @ac-1`, `@ac-2` pasted back, `@ac-3` a bare identifier), `UINOTE.md` + `UINOTE/verification.md` (two `@ui` scenarios, one honest note and one pasted back).
- Three goldens: `gate-done.{EVIDENCE,NOTES,UINOTE}.done.json`.

**Modified**

- `packages/core/src/gate/rules.ts` — five rows on `DONE_RULES`, one of them a warning.
- `packages/core/test/gate.test.ts` — three `CASES` rows and a six-test `describe` for the Human layer.
- `packages/core/test/__golden__/verification-edges.A.done.json` — gained four `gate.evidence-unresolved`, one per block (see below).
- `packages/core/test/__golden__/gate-done.SETS.done.json` — gained one `gate.note-missing` (see Deviations).
- `packages/core/test/__golden__/gate-done.snapshot.json` — the three new fixture tickets.

`packages/core/test/__golden__/gate-done.lint.json` was **not** modified: the three new tickets are lint-clean, so the directory-scanning lint golden was already correct. The plan listed it as expected to move; it did not need to.

## Decisions Made

1. **`stripRefs` resolves each distinct candidate once, then filters tokens against that set.** The naive form — call `resolves()` per whitespace token — is ~360M `endsWith` calls on the plan's 200 kB / 5 000-path case and blows the 2 s bound. Resolving the deduped candidate list first makes it ~20k. Same answer, one `Set`.
2. **`candidates()` dedupes on the trimmed token.** A repeated typo raises one warning and a repeated real path resolves once, so no count in the output depends on how often the prose repeats itself.
3. **`noteBlocks` joins a block's lines with `\n` and trims.** The join character is invisible to every consumer (`candidates` splits on `/\s+/`, `normalise` collapses whitespace), so the more faithful representation was chosen.
4. **`NOTES`'s third scenario carries `@ui`, not a third `@test:` id.** The fixture needs a scenario whose note is a bare identifier; giving it `@ui` means no third JUnit `<testcase>` (which would have moved `gate-done.snapshot.json` further and touched a file the plan did not list) and no `lint.test-tag-missing` warning cluttering the golden.
5. **`verification-edges/A` earns four `gate.evidence-unresolved`, not two.** Blocks `@ac-1` (`dòng một / dòng hai / dòng ba`) and `@ac-2` (`chạy npm test`) cite nothing; `@ac-3` and `@ac-4` have no `Evidence:` line at all, so their evidence is the empty string, which cites nothing by the same rule. The plan anticipated "the reference-rule findings the fixture's Vietnamese evidence now earns" — this is that, and the empty-block case is D-83's own wording ("the whole block must contain at least one resolving reference").

## Deviations from Plan

### Auto-fixed Issues

None. No bug, missing critical functionality, or blocking issue was found; both tasks ran as written.

### Scope deviations (stated, not auto-fixed)

**1. `gate-done.SETS.done.json` moved, and the plan's file list does not name it.**

- **Found during:** Task 2, first golden regeneration.
- **What happened:** `SETS` ticks `ac-1` and `ac-3` while its `## Verification notes` has blocks for `ac-1` and `ac-2`. `gate.note-missing` therefore fires on `@ac-3`. That is the rule working correctly on a fixture built for a different reason, not a false positive — a tick with no note is exactly what GATE-10 refuses.
- **Action:** golden regenerated, one finding added; `gate.tags-differ` and `lint.tick-orphan` on that fixture are unchanged.
- **Flag if you disagree:** the alternative is to add a `### @ac-3` block to `SETS.md` so its golden keeps isolating one reason. I left the fixture alone because the extra finding is true.

**2. `gate-done.lint.json` did not move.** The plan asked for it to be refreshed for the three new tickets; they produce no lint finding, so there was nothing to refresh. No action taken and none needed.

**3. The plan's Task 1 behaviour 8 asked for "under 2 s"; the case runs in well under that** with the candidate-set optimisation in Decision 1. The assertion is kept at the plan's 2 s rather than tightened, so a slow CI runner does not turn a performance characteristic into a flake.

---

**Total deviations:** 0 auto-fixed, 3 scope statements.
**Impact on plan:** none on scope or on any requirement. Every `must_haves` truth is asserted.

## Prohibitions — verified

| Prohibition | Result |
|---|---|
| No `git commit`, `git push`, `git tag`; no attribution trailer | **Held.** `git log -1 --format=%H` is `97a7977174efa56e1d98594355d15a46af50a8b9`, unchanged. No `git add`, `git stash`, `git reset`, or `git clean` was run; `git diff --cached` lists nothing. Working tree left dirty. |
| The note rule is never softened by a length threshold, similarity percentage, or word-count minimum | **Held.** `notePasted` is `remainder !== '' && !text.includes(remainder)`. `.length` appears exactly once in the whole file, at `token`'s index walk (`let b = raw.length`), and never in a comparison; the only other arithmetic is `ticked`'s numeric tag sort and `shaped`'s last-dot index. Nothing on the note path measures anything. |
| Diacritics are never folded, normalised away, or transliterated | **Held.** `normalise` calls `toLowerCase`, two `replace`s over `\p{P}`/`\p{S}` and `\s+`, and `trim`. No `normalize()`, no NFC/NFD pass, no character map. Asserted directly: `normalise('Trả')` is `trả` and is asserted **not** to equal `tra`. |
| No identifier-shaped token is accepted as a resolving reference | **Held.** `shaped()` requires a `/`, a recognised extension, or an own key of `snapshot.tests`. `candidates('AuthService hashPassword')` is `[]`, and `NOTES`'s `@ac-3` note fails `gate.note-unresolved`. |
| No source file is loaded into `snapshot.files` to make symbol checking possible | **Held.** Nothing in this plan touches `load/snapshot.ts` or the `files` record. D-84 stays as decided. |
| A non-resolving reference never silently downgrades an evidence failure | **Held.** `gate.evidence-unresolved` is `error`, `gate.reference-unknown` is `warning`, the two checks read the block independently, and a test asserts both levels off the table plus that every finding on the warning's block is a warning. |
| No `@ui`-specific note rule, exemption, or relaxation | **Held.** `grep -cE "id: 'gate\.[a-z-]*ui" rules.ts` is 0, asserted in-suite as `DONE_RULES.filter((row) => row.id.includes('ui'))` being empty. `UINOTE`'s two `@ui` scenarios get the same three note rules: one passes, one fails `gate.note-pasted`. |
| `.planning/STATE.md` and `.planning/ROADMAP.md` untouched | **Held.** Neither was written by this executor. |

## Issues Encountered

**No test or golden failed unexpectedly.** Both goldens that moved (`verification-edges.A`, `gate-done.SETS`) moved for a reason inspected and recorded above. Every other pre-existing golden was re-verified by a clean `vitest run` with no `-u` as part of `npm run check`.

**`gate-done` fixture goldens are still uncommitted work from 04-01 and 04-02**, so "the golden moved" was established by reading content, not by diffing against a committed baseline. Same caveat 04-02 recorded.

**Carried forward, still out of scope:** the shipped ticket templates and `docs/design.md` §5 name a design vendor, against `.claude/CLAUDE.md`'s "No other tools named" constraint. No task in this plan touched those lines. Nothing this plan wrote names a tool, plugin, harness, or planning system — rule ids, reason strings, fixture ticket names, and comments were checked.

## Known Stubs

None.

## Threat Flags

None. Every file this plan created is a pure string-rule module, a test, a fixture, or a golden. The candidate tokeniser is the one new untrusted-input surface, and it is covered by the plan's own register: T-04-13 (traversal), T-04-15 (partial-filename suffix), T-04-16 (large input), and T-04-17 (`Object.prototype` member as a test id) each have a pinned test in `refs.test.ts`. T-04-14 (a note padded with a short generic remainder) remains **accepted**, as GATE-10 decided: the gate verifies a human wrote something of their own, not that they understood the code.

## User Setup Required

None.

## Next Phase Readiness

- **Ready for 04-04.** `refs.ts` is self-contained and 04-04's GATE-05 author check and GATE-08 test join touch none of it. `gate-done/PASS` still passes Done with zero findings, which is the regression signal 04-04 should keep watching.
- `gate-done` now carries twelve tickets. `EVIDENCE`, `NOTES`, and `UINOTE` are fully bound (`ac_hash`, `verified`, `verified_hash`, `verified_commit`, a matching review `commit:`), so each golden isolates exactly the Human-layer reason it was built for and nothing from the identity layer leaks in.
- **Owner confirmation wanted** on three things: (1) the `SETS` golden gaining `gate.note-missing` — keep the true finding, or add a `### @ac-3` block so that fixture keeps isolating one reason; (2) the `EXT` set, which is Claude's discretion under D-74 and sits in one `Set` in `refs.ts`; (3) the five reason strings, which Phase 6 skill text will quote verbatim — in particular `note "@ac-n" adds nothing beyond the scenario text and its references`, which is what a developer will read when their note is rejected.

---
*Phase: 04-gates*
*Completed: 2026-09-14*

## Self-Check: PASSED

- All twelve claimed files verified present on disk (`[ -f ]` per path).
- `commits: 0` is deliberate and matches the orchestrator's absolute no-commit instruction and the project's `accord-solo-no-prs` rule. `plan_head_before` and the current `HEAD` are both `97a7977174efa56e1d98594355d15a46af50a8b9`; the index is empty. All work is uncommitted in the working tree.
- `.planning/STATE.md` and `.planning/ROADMAP.md` were **not** written by this executor. Both already carried uncommitted changes before this plan started; their diffs are the orchestrator's.
- `npm run check` re-run after the last source edit: exit 0, 556 tests passing across 21 files.
