---
phase: 04-gates
verified: 2026-09-14T21:50:00Z
status: passed
score: 5/5 ROADMAP success criteria verified (11/11 requirements have enforcing code and a delete-detector)
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/04-gates/04-01-PLAN.md"
  - ".planning/phases/04-gates/04-01-SUMMARY.md"
  - ".planning/phases/04-gates/04-02-PLAN.md"
  - ".planning/phases/04-gates/04-02-SUMMARY.md"
  - ".planning/phases/04-gates/04-03-PLAN.md"
  - ".planning/phases/04-gates/04-03-SUMMARY.md"
  - ".planning/phases/04-gates/04-04-PLAN.md"
  - ".planning/phases/04-gates/04-04-SUMMARY.md"
  - ".planning/phases/04-gates/04-CONTEXT.md"
  - ".planning/phases/04-gates/04-PATTERNS.md"
  - ".planning/phases/04-gates/04-REVIEW.md"
  - "packages/cli/src/load/fs.ts"
  - "packages/core/schemas/ticket.schema.json"
  - "packages/core/src/gate/done.ts"
  - "packages/core/src/gate/hash.ts"
  - "packages/core/src/gate/index.ts"
  - "packages/core/src/gate/ready.ts"
  - "packages/core/src/gate/refs.ts"
  - "packages/core/src/gate/rules.ts"
  - "packages/core/src/index.ts"
  - "packages/core/src/lint/render.ts"
  - "packages/core/src/load/snapshot.ts"
  - "packages/core/src/model/snapshot.ts"
  - "packages/core/test/gate.test.ts"
covered_digest: "v1:sha256:e90b5dc98b4d930b45cbf78ff1458e33c4f1862ccb93228f0b770f64a2ad1200"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "ROADMAP SC2 — `gate done` passes only when the scenario tag set, the evidence tag set, and `verified` are equal (CR-01: an unknown id passed Done with an empty finding list)"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "ROADMAP SC5 clause 1 — results carry exit codes 0, 1, or 2"
    addressed_in: "Phase 5"
    evidence: >-
      04-CONTEXT.md line 11 scopes this out explicitly ("Not in scope: commander commands, colour,
      and exit codes as process behaviour (Phase 5)") and line 147 ("Phase 5 wraps GateResult in exit
      codes 0/1/2"). ROADMAP Phase 5 success criterion 2: "exit codes follow the 0/1/2 contract".
  - truth: "GATE-06 exit-2 branch — an unreadable, unparseable, or schema-invalid `accord/config.yml` is a config error (WR-02)"
    addressed_in: "Phase 5"
    evidence: >-
      04-01-PLAN.md line 433 records this as a chosen decision, not an oversight: "Core does not model
      the config-error branch. `gateReady` still runs when `snapshot.config` is undefined, defaulting
      the profile to `build`, exactly as `lintSnapshot` does ... Phase 5 already loads the snapshot and
      can branch on `snapshot.config === undefined` for exit 2". Re-probed: all three broken shapes
      (file absent, YAML unparseable, `profile: nonsense`) converge on `config === undefined`, which is
      exactly the condition that decision names. ROADMAP Phase 5 SC2 owns the exit-code contract.
  - truth: "The `ac_hash` write at Ready (D-86)"
    addressed_in: "Phase 5"
    evidence: "04-CONTEXT.md line 147: 'Phase 5 ... performs the ac_hash write from D-86'"
open_decisions: # Owner-accepted, reproduced, NOT covered by any later roadmap phase
  - item: "WR-01 — no Unicode normalisation form is applied before comparison"
    severity: "fail-open; flips a Done verdict"
    reproduction: >-
      NFD-encoding only the `## Verification notes` section of `gate-done/UINOTE.md` — a change that
      renders identically and touches no scenario — makes `gate.note-pasted` stop firing entirely:
      `gateDone` goes from `fail` (one error) to `pass` with zero findings. Root cause confirmed: no
      `.normalize(` call exists anywhere under `packages/core/src`, and `refs.ts` `normalise()`
      lowercases and strips punctuation but does not unify composition form.
    status: "open by owner decision; no later phase addresses it"
    note: >-
      Does not fail any of the five ROADMAP success criteria and does not violate the 04-03 prohibition,
      which forbids *folding* diacritics (a different axis the code correctly honours). Recorded here
      rather than as a gap for that reason — but the owner's deferral was taken against the weaker
      description "no normalisation form is applied", and the reproduction above is materially stronger.
---

# Phase 4: Gates Verification Report

**Phase Goal:** Ready and Done evaluate deterministically over a snapshot, list reasons by rule, apply the build/maintain matrix, and offer no bypass.
**Verified:** 2026-09-14T21:35:00Z · **Re-verified after CR-01 fix:** 2026-09-14T21:50:00Z
**Status:** passed
**Re-verification:** Yes — narrow, after gap closure. Only SC2 (and through it GATE-02 and GATE-06) was re-judged; the four criteria that passed on the first run stand on that run's mutation testing and were not re-derived.

## Method

Nothing from this phase is committed (`HEAD` is `97a7977`, which predates it), so every judgement
below is from files on disk plus execution, never from git history and never from SUMMARY claims.
Behaviour was exercised by importing the built bundle `packages/core/dist/index.js` directly
(fresh: no source file under `packages/core/src` or `packages/cli/src` is newer than the bundle)
and driving `gateReady` / `gateDone` over the real fixtures with mutations applied in memory.

## Re-verification Note — CR-01 closed

**The fix.** `gate.ticket-unknown` is now a single `TICKET_UNKNOWN` const in `rules.ts` (line 51)
referenced by *both* `READY_RULES` and `DONE_RULES`, not a second literal copy. `index.ts` `run()`
carries a corrected comment. `gate.test.ts` gained two assertions.

**How it was re-proved — by execution, not by reading the diff.** Driving the rebuilt
`packages/core/dist/index.js`:

| Probe | Before | After |
|-------|--------|-------|
| `gateDone(gate-done, 'NOPE')` | `{verdict:"pass", findings:[]}` | `{verdict:"fail", findings:[gate.ticket-unknown@error]}`, reason `no ticket NOPE in the snapshot`, no `acHash` key |
| `gateReady(gate-done, 'NOPE')` | `fail` | `fail` — unchanged |
| `gateDone` on `'pass'`, `'PASS '`, `' PASS'`, `''` (near misses) | not probed | all `fail` with the one row — the guard is exact-match, not fuzzy |
| `gateDone` on `'toString'`, `'constructor'`, `'__proto__'` | not probed | all `fail` — `Object.hasOwn`, so the prototype chain cannot forge a known ticket |
| Determinism | — | three consecutive calls byte-identical |

**Delete-sensitivity — tested, not assumed.** `TICKET_UNKNOWN` was removed from `DONE_RULES`, the
named tests run, and the file restored **byte-for-byte** (sha256
`9e4b6c45…f43222` before and after; `git status --porcelain` and `HEAD` identical; index clean).
Results:

| Test | With the row removed | Verdict |
|------|---------------------|---------|
| `gate done: gate.ticket-unknown is the whole result…` (the `it.each` case) | **FAILS** — `AssertionError: expected 'pass' to be 'fail'` at `gate.test.ts:182` | ✓ A genuine delete-detector, and it reproduces CR-01's exact symptom |
| `gate ready: …` (the sibling case) | passes | ✓ correct — Ready never had the hole |
| `a rule both tables carry is the same row object` | **still passes** | ⚠️ **Not** an absence-detector. Its `if (shared !== undefined)` guard simply skips when the row is gone |
| `every id is gate.<kebab-name> and unique within its table` | still passes | ⚠️ Same — a table-shape check, not a presence check |

So the honest reading: **one** test guards the row's presence (the `it.each` `done` case), and it
does so properly. The reference-identity test guards a *different* failure — divergence by copy —
and it does that properly too: re-adding `gate.ticket-unknown` to `DONE_RULES` as a duplicated
object literal instead of the shared const makes it fail with
`expected {…} to be {…} // Object.is equality … Compared values have no visual difference`. That is
exactly the drift it was written for. Neither test is decorative; they cover adjacent holes rather
than the same one.

**Nothing new introduced.** `npm run check` exits 0 — 21 files, **592 tests** (was 590), lint clean
(including the core-purity `no-restricted-imports` guard), typecheck clean. All 73 golden files are
byte-identical before and after the run (sha256 set compared), and every gate golden's mtime
predates the fix. All 20 known tickets across `gate-done` and `gate-ready` return exactly the
findings recorded on the first verification run — `PASS` pass, `SOLO` pass + `gate.author-match`,
`SETS` `gate.tags-differ`, `BLOCKED` `gate.result-not-pass`, `REVIEW` `gate.stale-review`, `STALE`
`gate.ac-changed`+`gate.tick-stale-hash`, `CLEAN`/`NOUI` pass, `THIN`/`HYGIENE`/`SCHEMA`/`UINOREF`
fail — so the fix moved the unknown-id path and nothing else. `HEAD` is still `97a7977`, the index
is clean, and the working tree is byte-identical to how it was found.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `gate ready` passes a fixture only when frontmatter is valid, intent is present, at least one EARS line and one tagged scenario exist, no hygiene finding remains, and a design reference is present where the profile requires it; a pass records `ac_hash` | ✓ VERIFIED | Executed over `gate-ready`: `CLEAN` -> pass + `acHash=fnv1a64:8613b1c0604c6a56`; `THIN` -> fail (`gate.intent-empty`, `gate.ears-missing`); `HYGIENE` -> fail (`lint.sentinel`, `lint.open-question`, `lint.assumption-unconfirmed` all at **error**, `lint.vague-wording` left at warning); `SCHEMA` -> fail (`schema.required`); `UINOREF` -> fail (`gate.design-missing`); `NOUI` -> pass. `acHash` present on fail as well as pass. Profile split confirmed on `gate-maintain`: `UIPROTO` (prototype) pass, `UILINK` (design URL only) fail. Caveat: WR-02 below. |
| 2 | `gate done` passes only when the three tag sets are equal; a mismatch lists which tags are missing from which set; `Result: blocked` fails as `fail` does; a `verification.md` whose `commit:` differs from the gated commit fails with a stale-review reason | ✓ **VERIFIED** (was ✗ FAILED — CR-01 now fixed) | The three named mechanisms were verified on the first run and are unmoved: `SETS` -> one `gate.tags-differ` reading exactly `scenarios lack @ac-3; evidence lacks @ac-2 @ac-3; verified lacks @ac-2`; `BLOCKED` -> `gate.result-not-pass` naming `blocked`, same shape with `fail`; host commit changed -> `gate.stale-review` naming both shas. The **"only when"** is now closed: `gateDone(snapshot,'NOPE')` -> `{verdict:"fail", findings:[gate.ticket-unknown]}`, re-proved by execution against the rebuilt bundle, with the fix shown delete-sensitive (see Re-verification Note). |
| 3 | Editing the acceptance criteria after Ready makes `gate done` fail with an AC-changed reason until Ready is re-run | ✓ VERIFIED | Appended one word to a `Then` step of `gate-done/PASS` (a ticket that passes Done cleanly): verdict flips to `fail` with `gate.ac-changed` (naming recorded `fnv1a64:0e84e174c4cdc76b` vs computed `fnv1a64:9759ccdd125d88a6`) **and** `gate.tick-stale-hash`. Control: adding an unrelated `@smoke` tag leaves the hash untouched and the verdict `pass`, so the hash keys on the criteria and not on the file. |
| 4 | An evidence line naming a file/test/command absent from the snapshot fails Done; a `@test:<id>` reported skipped is not passed and fails Done; when the host supplies git authors, implementation/evidence/tick by one author warn; when the host supplies none, the check reports as skipped | ✓ VERIFIED | Evidence rewritten to `src/does-not-exist.ts` -> `gate.evidence-unresolved` (error) + `gate.reference-unknown` (warning); emptied block -> `gate.evidence-unresolved`. Report patched so `#ok1` carries `<skipped/>` -> `gate.test-not-passed ... is recorded **skipped** ...; Done passes on passed alone` (error); the same with `<failure/>` reads `failed` — the two stay distinguishable. Author: `SOLO` -> one `gate.author-match` warning, verdict stays `pass`; `authors:{}` -> one `gate.author-skipped` warning and no error. |
| 5 | Results carry exit codes 0/1/2; the `maintain` profile downgrades token and size rules to warnings; no flag or option bypasses a gate | ✓ VERIFIED (in-scope clauses; exit codes deferred to Phase 5) | Maintain matrix: `downgradeMaintain` is called from exactly one site in the shared `run()` body, so Done inherits it; `gate.test.ts` injects four synthetic **error** rows (one per `MAINTAIN_DOWNGRADE` id) through `gateDone` and asserts they come back `warning` on `maintain` and stay `error` on `build`, with a control id unchanged. No-bypass clause: `gateReady`/`gateDone` take `(snapshot, id)` and nothing else; re-grepped after the fix — no `process.env`, `argv`, or option read appears anywhere under `src/gate/`. The one bypass that did exist was not a flag but the unknown-id hole, and it is now closed. Exit codes are **deferred to Phase 5** by 04-CONTEXT (see `deferred`). |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Exit codes 0/1/2 as process behaviour | Phase 5 | 04-CONTEXT lines 11 and 147; ROADMAP Phase 5 SC2 |
| 2 | Exit-2 branch for an unreadable/unparseable/schema-invalid `config.yml` (WR-02) | Phase 5 | 04-01-PLAN line 433 records the decision; ROADMAP Phase 5 SC2 |
| 3 | The `ac_hash` write at Ready (D-86) | Phase 5 | 04-CONTEXT line 147 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/gate/hash.ts` | `acHash` + the D-77 join | ✓ VERIFIED | 37 lines; hand-written FNV-1a on `TextEncoder`/`BigInt`, masked and zero-padded; no `node:` import |
| `packages/core/src/gate/rules.ts` | `GateDraft`, `GateRule`, `READY_RULES`, `DONE_RULES`, `READY_PROMOTE`, `MAINTAIN_DOWNGRADE`, `downgradeMaintain` | ✓ VERIFIED (was ⚠️ INCOMPLETE) | All present. `gate.ticket-unknown` is now one `TICKET_UNKNOWN` const (line 51) referenced by both tables, so a level or profile edit cannot reach one gate and miss the other |
| `packages/core/src/gate/ready.ts` | `designMissing`, `ticketUnknown`, `intentEmpty`, `earsMissing` | ✓ VERIFIED | 67 lines; all four exported and wired into `READY_RULES` |
| `packages/core/src/gate/done.ts` | 19 checks + `isSha`/`shaEqual` | ✓ VERIFIED | 367 lines; every name the plans declare is exported and has a `DONE_RULES` row |
| `packages/core/src/gate/refs.ts` | `candidates`, `resolves`, `unresolvedRefs`, `stripRefs`, `normalise`, `noteBlocks` + 5 checks | ✓ VERIFIED | 226 lines; segment-boundary suffix match via `'/' + key`; no diacritic folding (confirmed: no `.normalize(` anywhere in `src`, which is also WR-01's root cause) |
| `packages/core/src/gate/index.ts` | `GateResult`, `gateReady`, `gateDone`, scope filter, sort | ✓ VERIFIED | 93 lines; one shared `run()` body; the `known` short-circuit comment now states the invariant correctly |
| `packages/cli/src/load/fs.ts` | `gitFacts` feeding `SnapshotInput.git` | ✓ VERIFIED | `gitFacts` spawns `git` by name with a literal arg array, `cwd: root`, no shell, no `.cmd`; omits the `git` key when there is no commit. (The plan's `contains: "git.authors"` literal does not appear — it described a doc comment, not an API; the capability is present.) |
| `packages/core/test/hash.test.ts` | ≥40 lines | ✓ VERIFIED | 79 lines |
| `packages/core/test/gate.test.ts` | ≥60 lines | ✓ VERIFIED | 846 lines; +2 tests since the fix (592 total, was 590) |
| `packages/core/test/refs.test.ts` | ≥60 lines | ✓ VERIFIED | 237 lines |
| 15 `__golden__/gate-*.json` files | pinned results | ✓ VERIFIED | All present; each declared `contains` pattern found; all 73 goldens byte-identical across the re-verification run |
| `packages/core/schemas/ticket.schema.json` | `verified_hash`, `verified_commit` patterns | ✓ VERIFIED | Lines 34-35 carry `^fnv1a64:[0-9a-f]{16}$` and `^[0-9a-fA-F]+$` + `minLength: 7` |
| `docs/design.md` §5 | Ready table rows for Intent and EARS | ✓ VERIFIED | Both rows present. §5's Done prose is stale — see IN-02 below |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| `gate/index.ts` | `lint/index.ts` | `gateReady` calls `lintSnapshot` and filters by ticket scope rather than re-running rules | ✓ WIRED (`lintSnapshot(snapshot)` inside `run()`; `scoped()` filters by the three id-derived prefixes with string comparison, never a regex) |
| `gate/index.ts` | `gate/hash.ts` | `acHash` over the ticket's tagged scenarios, on pass and fail alike | ✓ WIRED (`acHash` computed whenever `known`, independent of verdict — confirmed: all six `gate-ready` results carry an `acHash`, four of them failing) |
| `lint/render.ts` | `gate/index.ts` | `renderText` takes anything carrying `findings` | ✓ WIRED (pinned byte-identical text test; a `GateResult` and a `LintResult` with the same findings render the same) |
| `gate/done.ts` | `model/snapshot.ts` | `verifications[id].blocks`, `frontmatter.verified*`, `git.commit` | ✓ WIRED (`verification-edges/A` returns exactly the four distinct tags the loader kept) |
| `gate/refs.ts` | `model/snapshot.ts` | `snapshot.tree` / `snapshot.tests` resolution | ✓ WIRED |
| `gate/done.ts` | `model/snapshot.ts` | `snapshot.tests`, `config.tests.report`, `git.authors` | ✓ WIRED |
| `cli/src/load/fs.ts` | `model/snapshot.ts` | `loadFromFs` is the only producer of `git.commit`/`git.authors` in v0.1 | ✓ WIRED |
| `gate/index.ts` | `DONE_RULES` for an unknown id | `TICKET_UNKNOWN` is on both tables as one shared object; `run()` evaluates it before the `known` short-circuit can empty the list | ✓ **WIRED** (was ✗ NOT_WIRED — the blocker) |
| `gate/index.ts` | repo-level load findings (`load.config-missing`, `load.yaml-syntax`, `schema.enum` on `config.yml`) | `scoped()` keeps only the ticket's own file, folder, and assets | ⚠️ **INTENTIONALLY NOT WIRED** — `accord/config.yml` is repo-level, so an `error`-level config finding that `lint` reports is dropped from every gate result. This is WR-02's exact mechanism and is the deferred Phase 5 branch |

### Data-Flow Trace (Level 4)

| Value | Source | Flows | Status |
|-------|--------|-------|--------|
| `GateResult.findings` | `lintSnapshot(snapshot)` + each rule's `check(snapshot,id)` | Yes — mutating a fixture moves the findings | ✓ FLOWING |
| `GateResult.verdict` | derived in one expression from `findings.some(level==='error')` | Yes — no separate boolean or counter exists | ✓ FLOWING |
| `GateResult.acHash` | `acHash(snapshot.tickets[id].scenarios)` | Yes — editing a step moves it; adding a non-`@ac-n` tag does not; absent entirely for an unknown id | ✓ FLOWING |
| `snapshot.tests[id]` | JUnit scan of `config.tests.report` | Yes — patching the XML flips `passed`->`skipped` and the finding follows | ✓ FLOWING |
| `snapshot.git` | `gitFacts()` in the CLI loader | Yes — the only producer; core reads it, never invents it | ✓ FLOWING |
| `GateResult.findings` on Done for an absent ticket | `TICKET_UNKNOWN.check` on both tables | Yes — one `error` row, deterministic across repeated calls | ✓ **FLOWING** (was ✗ DISCONNECTED) |

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|-----------|---------|--------|--------|
| Full suite green | `npm run check` (build + lint + typecheck + test) | exit 0; 21 files, **592 tests**, all passed | ✓ PASS |
| Lint (incl. core-purity `no-restricted-imports`) | `eslint .` | exit 0, no output | ✓ PASS |
| Typecheck (core, core tests, cli) | `tsc` x3 | exit 0 | ✓ PASS |
| The suite cannot commit or stage the author's tree | `git rev-parse HEAD` + `git diff --cached --quiet` + `git status --porcelain` before/after | `97a7977…` unchanged; index clean; status byte-identical | ✓ PASS |
| Goldens unmoved by the fix | sha256 of all 73 `__golden__` files before/after | no diff | ✓ PASS |
| Ready on a complete vs. incomplete ticket | driven over `gate-ready` fixtures | see SC1 row | ✓ PASS |
| **Done on an unknown id** | `gateDone(gate-done, 'NOPE')` | `{verdict:"fail", findings:[gate.ticket-unknown@error]}` | ✓ **PASS** (was ✗ FAIL) |
| Done on near-miss / prototype ids | `'pass'`, `'PASS '`, `' PASS'`, `''`, `'toString'`, `'constructor'`, `'__proto__'` | all `fail` with the one row | ✓ PASS |
| Delete-sensitivity of the new test | row removed from `DONE_RULES`, named test run, file restored byte-for-byte | test fails: `expected 'pass' to be 'fail'` | ✓ PASS |
| Reference-identity test catches a duplicated literal | second literal row added, named test run, file restored | test fails on `Object.is` with "no visual difference" | ✓ PASS |
| Regression sweep over every known ticket | all 20 ids across both fixtures | findings identical to the first verification run | ✓ PASS |
| AC edit after Ready | one-word step edit on `PASS` | `gate.ac-changed` + `gate.tick-stale-hash` | ✓ PASS |
| Evidence naming an absent file | `Evidence: src/does-not-exist.ts` | `gate.evidence-unresolved` (error) | ✓ PASS |
| Skipped test | `<skipped/>` on `#ok1` | `gate.test-not-passed` naming `skipped` | ✓ PASS |
| No `tests.report` key | key deleted from `config.yml` | `gate.tests-unconfigured` at `/tests`, not "skipped" | ✓ PASS |
| Report declared but absent | report file removed | `gate.report-missing` at `/tests/report` | ✓ PASS |
| No git facts at all | `git` omitted | `gate.commit-missing` (error) + `gate.author-skipped` (warning) | ✓ PASS |
| Debt markers in phase source | grep `TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER` over `src/gate/`, `cli/src/load/fs.ts`, touched core files | none | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exists in this repository and no plan declares one. Probe execution: **SKIPPED (no probe scripts in this project)**. The behavioural spot-checks above serve the same role and were run in this process.

### Plan Prohibitions

Re-checked after the fix, since a change to the rule table is exactly the kind of edit that can quietly break one.

| Prohibition (plan) | Status | Evidence |
|--------------------|--------|----------|
| No `git commit`/`push`/`tag`; tree left dirty (04-01/02/03/04) | ✓ HOLDS | `HEAD` `97a7977` unchanged, index clean, `git status --porcelain` byte-identical before and after the whole re-verification |
| No flag, option, env var, or config key skips a rule or forces `pass` (04-01, 04-02) | ✓ HOLDS | No `process.env`, `argv`, `options.`, or `opts.` anywhere under `src/gate/`; both entry points are `(snapshot, id)` |
| No check swallows an internal error and returns an empty draft list (04-01) | ✓ HOLDS | This is CR-01's class. The empty-list-reads-as-pass path is now closed by `TICKET_UNKNOWN` on both tables |
| No gate function writes `ac_hash`/`verified_hash`/`verified_commit` (04-02) | ✓ HOLDS | No `writeFile`, no `setFrontmatterKey`, no `fs.` under `src/gate/`; the only `verified_hash` mention is a read in `done.ts:174` |
| Diacritics never folded, normalised away, or transliterated (04-03, D-85) | ✓ HOLDS | No `.normalize(` call exists anywhere under `packages/core/src`. Note that honouring this prohibition as written is precisely what leaves WR-01 open — see below |
| No length threshold, similarity percentage, or word-count floor in the note path (04-03) | ✓ HOLDS | The only `.length` in `refs.ts` is a punctuation-trim bound inside `token()` (line 31), not a comparison against the note |
| A check never reports itself skipped merely because its input is absent (04-04) | ✓ HOLDS | `gate.tests-unconfigured` / `gate.report-missing` fire at error; only GATE-05, a warning either way, has a skipped form |

### Requirements Coverage

All eleven GATE ids are claimed across the four plans (04-01: GATE-01, 06, 07 · 04-02: GATE-02, 03, 11 · 04-03: GATE-04, 09, 10 · 04-04: GATE-05, 08). **No orphans** — REQUIREMENTS.md maps exactly GATE-01..GATE-11 to Phase 4 and every one is claimed by a plan.

The "delete-detector" column answers the question asked: would a test go red if the enforcing code were removed?

| Requirement | Plan | Enforcing code | Delete-detector test | Status |
|-------------|------|----------------|----------------------|--------|
| GATE-01 Ready preconditions + `ac_hash` | 04-01 | `READY_RULES` + `ready.ts` (4 checks) + `READY_PROMOTE` | Yes — the `GATE01` clause table asserts the named `gate.*` ids **are exactly** `READY_RULES`, so dropping a row fails; plus `THIN`/`UINOREF`/`HYGIENE`/`SCHEMA` fixture assertions | ✓ SATISFIED |
| GATE-02 three-set equality | 04-02 | `tagsDiffer`, `noScenarios`, **`TICKET_UNKNOWN` on `DONE_RULES`** | Yes — `SETS` pins the reason string verbatim; `EMPTY` pins `gate.no-scenarios`; `PASS` pins the clean case; and the `it.each` `done` case pins the unknown-id guard, **proved red by removing the row** | ✓ **SATISFIED** (was ⚠️ vacuously bypassable) |
| GATE-03 AC hash differs from Ready | 04-02 | `acHashMissing`, `acChanged` | Yes — `STALE` pins both hash values; `NOVERIF` pins `gate.ac-hash-missing` | ✓ SATISFIED |
| GATE-04 evidence references something real | 04-03 | `evidenceUnresolved`, `referenceUnknown` + `refs.ts` resolution | Yes — `EVIDENCE` asserts error vs warning and that the warning cannot stand in for the error; `refs.test.ts` (237 lines) pins extraction, segment-boundary resolution, and stripping | ✓ SATISFIED |
| GATE-05 author-mismatch warning / skipped | 04-04 | `authorMatch`, `authorSkipped` | Yes — `SOLO` (match, verdict stays pass), `PASS.noauthors` (skipped), `NOVERIF` (neither), case-folding test, and a level assertion pinning both rows at `warning` | ✓ SATISFIED |
| GATE-06 exit codes, reasons by rule, no bypass | 04-01 | `Finding.rule` on every emission; `(snapshot,id)` signature with no other input; `TICKET_UNKNOWN` shared across both tables | Yes for the in-scope clauses — `every machine rule is an error on both profiles` pins the levels; the `it.each` unknown-id case pins the one bypass that existed; the reference-identity test stops the two tables drifting apart again | ✓ **SATISFIED** for "reasons by rule" and "no bypass"; exit codes deferred to Phase 5 (was ⚠️ PARTIAL) |
| GATE-07 `maintain` downgrades token and size rules | 04-01 | `MAINTAIN_DOWNGRADE` + `downgradeMaintain`, one call site in `run()` | Yes — synthetic error rows injected through `gateDone` on both profiles; a control id proves the list is respected, not blanket-applied | ✓ SATISFIED |
| GATE-08 `@test:` join against the JUnit report | 04-04 | `testTagMissing`, `testsUnconfigured`, `reportMissing`, `testUnknown`, `testNotPassed` | Yes — `MACHINE` pins skipped+failed+unknown+missing-tag with four distinct lines; `GONE` and `CLEAN` pin the two configuration branches; the id-lookup test pins case, prototype-chain and whitespace behaviour | ✓ SATISFIED |
| GATE-09 `@ui` exempt from GATE-08, held to GATE-10 | 04-03/04-04 | `machineScenarios` filter; no `@ui` branch in the note rules | Yes — `UINOTE` asserts no `gate.test-*` finding at all, and asserts `DONE_RULES.filter(id.includes('ui'))` is empty so no stricter variant can be added unnoticed | ✓ SATISFIED |
| GATE-10 human note per ticked scenario | 04-03 | `noteMissing`, `noteUnresolved`, `notePasted` | Yes — `NOTES` pins all three with distinct lines; `refs.test.ts` pins the two Vietnamese cases and the no-length-threshold property. **No test pins the rule against a re-encoded note** — see WR-01 | ✓ SATISFIED (with WR-01 open against `notePasted`) |
| GATE-11 tick bound to AC hash and commit | 04-02 | `tickUnbound`, `tickStaleHash`, `tickStaleCommit`, `shaEqual`/`isSha` | Yes — `TICKS`, `COMMIT`, `STALE`, plus `shaEqual` unit tests pinning the 7-char prefix rule in both argument orders and the seventh-character difference | ✓ SATISFIED |

**Requirement ticks in REQUIREMENTS.md remain unticked and the traceability table still reads "Pending" for all eleven.** With GATE-02 and GATE-06 now closed, applying the eleven ticks is the natural next step — it was correctly withheld while CR-01 was open.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/core/src/gate/rules.ts` | 51, 59, 68 | ~~Asymmetric rule table~~ | ✓ **RESOLVED** | One `TICKET_UNKNOWN` const on both tables; re-proved by execution and by deletion |
| `packages/core/src/gate/index.ts` | 62-70 | ~~`known === false` produces an empty finding list~~ | ✓ **RESOLVED** | `gated` is computed before the `known` short-circuit, so the row always lands; comment corrected |
| — | — | Debt markers (`TODO`/`FIXME`/`TBD`/`XXX`/`HACK`/`PLACEHOLDER`) in phase source | none found | ℹ️ Info | Clean, re-checked after the fix |
| — | — | Stub returns, empty handlers, hardcoded empty data feeding output | none found | ℹ️ Info | Every `return []` under `src/gate/` is a guarded "this check does not apply", each with a named rule owning the case it defers to |

### Review Warnings — Disposition

The code review (04-REVIEW.md) raised 7 warnings. WR-01 and WR-02 were re-probed in this round at the
owner's request; the rest are unchanged from the first run.

| ID | Finding | Reproduced here | Direction | Disposition |
|----|---------|-----------------|-----------|-------------|
| WR-01 | No Unicode normalisation form (NFC/NFD) is applied | **Yes — and worse than first recorded.** NFD-encoding *only* the `## Verification notes` section of `gate-done/UINOTE.md` (renders identically, scenarios untouched, so no `ac-changed`) makes `gate.note-pasted` stop firing: `fail` with one error becomes **`pass` with zero findings**. Root cause pinned: no `.normalize(` anywhere in `packages/core/src` | **Fail-open, and it flips a Done verdict** | **OPEN by owner decision.** Compatible with `passed` — see the judgement below — but recorded in `open_decisions` with the reproduction, because no later roadmap phase addresses it and the deferral was taken against a weaker description |
| WR-02 | `gateReady` reports `pass` when `config.yml` is missing or unparseable on a `maintain` repo | **Yes, and the mechanism is now exact.** All three shapes — file absent (`load.config-missing`), YAML unparseable (`load.yaml-syntax` x4), and `profile: nonsense` (`schema.enum`) — emit an **error-level** finding that `lintSnapshot` reports, and all three leave `config === undefined` so the profile resolves to `build`. The gate drops the finding because `scoped()` keeps only the ticket's own paths and `accord/config.yml` is repo-level. `gate-maintain/UILINK` therefore passes Ready in all three | Fail-open at the gate; caught by `lint` | **DEFERRED to Phase 5, legitimately.** Correcting my first report: this is **not** implicit — 04-01-PLAN.md line 433 records it as a chosen decision naming `snapshot.config === undefined` as Phase 5's exit-2 branch, and all three shapes hit exactly that condition |
| WR-03 | Four `in` membership tests in `load/snapshot.ts` where `Object.hasOwn` is used elsewhere | No | Crash on an adversarial config path | Fix — the codebase already treats this as a rule (`gate/` uses `Object.hasOwn` throughout with a comment explaining why) |
| WR-04 | `TypeError` when host-supplied `git` omits `authors` | **Yes** (first run) — `TypeError: Cannot convert undefined or null to object` | Crash, not a silent pass, so the 04-01 prohibition holds | Fix — the MCP host supplies these facts and is not bound by the TypeScript type |
| WR-05 | `gitFacts` loses non-ASCII ticket paths (git quotes them by default) | No | GATE-05 silently stops firing on Vietnamese-named paths | Fix — this project's own fixtures are Vietnamese |
| WR-06 | No `maxBuffer` on either `execFileSync`; 1 MiB default | No | GATE-05 off, or a large repo misreported as "not a git repository" | Fix or defer with a note |
| WR-07 | Done binds to `HEAD`, so uncommitted changes to reviewed code pass | No | Fail-open | Likely a recorded-decision item rather than a v0.1 fix |

Info-level items worth carrying forward: **IN-02** — `docs/design.md` §5 still reads "A host with no
report available reports the check skipped, as the author check does", which is exactly the behaviour
D-80 reversed in this phase (the code now emits `gate.tests-unconfigured` / `gate.report-missing` at
error, confirmed by probe). The design doc is the contract's prose; leaving it contradicting the code
is how the reversal gets undone later. **IN-03** — `downgradeMaintain`'s doc comment claims it applies
to "the whole profile matrix" in the shared body, but it is applied only to the lint findings, never to
`gated`. Functionally correct today (all four `MAINTAIN_DOWNGRADE` ids are lint ids) but the comment
overstates the guarantee, which is precisely the guarantee GATE-12 will lean on.

### Is deferring WR-01 and WR-02 compatible with `passed`?

Asked directly, answered directly.

**WR-02: yes, cleanly.** I was wrong on the first run to call it "implicit rather than recorded".
04-01-PLAN.md line 433 records it as a deliberate decision, naming the exact condition
(`snapshot.config === undefined`) that Phase 5 will branch on for exit 2, and my probe confirms all
three broken-config shapes land on that condition. Core detects every one of them at `error` level and
`accord lint` reports them; only the gate's ticket-scope filter drops them, and that filter is itself a
deliberate design (T-04-01: scope by string, never by a regex built from the id). The residual exposure
is a host that calls `gateReady` directly without ever calling `lint` — real for the Phase 8 MCP server,
but Phase 5 lands first and owns the branch. This is a deferral with an owner, a mechanism, and a date.

**WR-01: yes, but only just, and the record should not be allowed to understate it.** It fails no
success criterion — none of the five mentions notes — and it violates no prohibition: 04-03 forbids
*folding* diacritics, which is a different axis, and the code honours that prohibition exactly.
Honest tickets are unaffected, because nobody re-encodes a file by accident. On the decision tree this
is not a gap and not a human-verification item: I reproduced it precisely, so nothing is uncertain.

What I will not soften is the shape of it. A one-section re-encoding that renders identically to a
human reviewer turns a ticket that correctly fails Done into a clean pass with **zero** findings. That
is the same species of failure as CR-01 — Done passing when it should not — reached through a different
door, in a project whose stated core value is that an agent "cannot finish a story without independent
verification". Unlike WR-02 it has no later phase to land in, so deferring it means it is scheduled
nowhere. And the owner's decision to defer was taken against the review's characterisation ("no
NFC/NFD normalisation is applied"), which reads like a tidiness issue; the reproduction above shows a
verdict flip. **The status stays `passed` — that is the owner's call to make and the criteria do not
cover it — but the item deserves a named follow-up and a second look at the decision now that the
consequence is concrete, not a footnote in a warnings table.**

### Process Finding — MVP mode

ROADMAP marks this phase `Mode: mvp`, but its goal is a capability statement, not a User Story
("As a ..., I want to ..., so that ..."). Under MVP-mode rules I would refuse to verify and ask for a
proper User Story goal. I did not refuse, because the phase carries five explicit Success Criteria
that are a complete and testable contract, and refusing would have delivered nothing. Verification
above is goal-backward against those criteria. Phases 5, 6 and 7 carry the same mismatch, so this is a
roadmap-wide labelling question rather than a Phase 4 defect — worth settling once.

### Summary

The phase goal is achieved. Ready and Done evaluate deterministically over a snapshot, list their
reasons by rule, apply the build/maintain matrix from one call site, and now offer no bypass.

Everything the phase set out to do is genuinely built and genuinely tested. The Ready table, the
three-set match, the AC-hash staleness chain, the evidence resolver, the note rules, the JUnit join,
the author warning and the profile matrix all behave as the plans claim when driven against real
fixtures with real mutations — each checked by changing an input and watching the finding move, not by
reading a SUMMARY. The test suite is not decorative: the assertions pin reason strings verbatim, pin
rule levels against the tables, and in several places assert *set equality* between a requirement's
clauses and the rule table, so deleting a row goes red rather than quiet.

CR-01 — the one gap — is closed, and closed at the root rather than at the symptom. `gate.ticket-unknown`
is not a second row copied onto `DONE_RULES`; it is one object both tables reference, so the next level
or profile edit cannot reach one gate and miss the other, and a third gate cannot be added without it.
The fix carries two guards that cover adjacent failures: a behavioural test that goes red with the exact
CR-01 symptom when the row is deleted, and a reference-identity test that goes red if someone re-adds it
as a duplicate literal. I verified both by deletion and by duplication, restoring the file byte-for-byte
each time. The suite grew 590 -> 592, no golden moved, and all twenty known tickets return exactly the
findings recorded before the fix.

What remains open is two owner-accepted items. WR-02 has a home: Phase 5 owns the config-error branch,
the decision is recorded in the plan, and core already detects all three broken shapes at error level.
WR-01 has no home, and its reproduction is stronger than its description — re-encoding one section of a
ticket file, invisibly, disables `gate.note-pasted` and turns a failing Done into a clean pass. Neither
blocks this phase. The second one should not be left to be rediscovered.

---

_Verified: 2026-09-14T21:35:00Z · re-verified 2026-09-14T21:50:00Z_
_Verifier: Claude (gsd-verifier)_
