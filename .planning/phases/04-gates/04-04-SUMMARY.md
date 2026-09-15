---
phase: 04-gates
plan: 04
subsystem: testing
tags: [gate, junit, git, typescript, vitest, goldens]

# Dependency graph
requires:
  - phase: 04-gates/04-01
    provides: "the gate engine, the rule table shape, `SnapshotInput.git`, and the `gate-ready` fixture"
  - phase: 04-gates/04-02
    provides: "the Done table, the identity layer, the `gate-done` fixture and its JUnit report"
  - phase: 04-gates/04-03
    provides: "the Human layer (evidence, notes, `@ui`) and the `UINOTE` ticket"
provides:
  - "GATE-08 Machine layer: `gate.test-tag-missing`, `gate.tests-unconfigured`, `gate.report-missing`, `gate.test-unknown`, `gate.test-not-passed`, all error on both profiles"
  - "GATE-05 author warning: `gate.author-match` and `gate.author-skipped`, warnings that never change a verdict"
  - "`gitFacts` in the CLI loader — the only producer of `SnapshotInput.git` in v0.1"
  - "The `MACHINE` and `SOLO` tickets, the `gate-no-report` fixture, and seven new goldens"
affects: [05-cli, phase-verification]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff).
actuals:
  tokens: 14000
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Configuration-level suppression: one configuration reason replaces the per-item findings it makes meaningless (D-67 precedent, applied to D-80)"
    - "One guarded `execFileSync` site per test file, so a working directory cannot be forgotten on a later call"

key-files:
  created:
    - packages/core/test/fixtures/gate-done/accord/tickets/MACHINE.md
    - packages/core/test/fixtures/gate-done/accord/tickets/MACHINE/verification.md
    - packages/core/test/fixtures/gate-done/accord/tickets/SOLO.md
    - packages/core/test/fixtures/gate-done/accord/tickets/SOLO/verification.md
    - packages/core/test/fixtures/gate-no-report/accord/config.yml
    - packages/core/test/fixtures/gate-no-report/accord/tickets/GONE.md
    - packages/core/test/fixtures/gate-no-report/accord/tickets/GONE/verification.md
    - packages/core/test/fixtures/gate-no-report/src/auth/login.ts
    - packages/core/test/fixtures/gate-no-report/test/login.spec.ts
    - packages/core/test/__golden__/gate-done.MACHINE.done.json
    - packages/core/test/__golden__/gate-done.SOLO.done.json
    - packages/core/test/__golden__/gate-done.PASS.noauthors.done.json
    - packages/core/test/__golden__/gate-no-report.GONE.done.json
    - packages/core/test/__golden__/gate-ready.CLEAN.done.json
    - packages/core/test/__golden__/gate-no-report.snapshot.json
    - packages/core/test/__golden__/gate-no-report.lint.json
  modified:
    - packages/core/src/gate/done.ts
    - packages/core/src/gate/rules.ts
    - packages/core/test/gate.test.ts
    - packages/core/test/fixtures/gate-done/reports/junit.xml
    - packages/cli/src/load/fs.ts
    - packages/cli/test/load.test.ts
    - packages/core/test/__golden__/verification-edges.A.done.json
    - packages/core/test/__golden__/gate-done.snapshot.json
    - packages/core/test/__golden__/gate-done.lint.json

key-decisions:
  - "A `skipped` test fails Done exactly as a `failed` one does; the reason names the status verbatim so the two stay distinguishable without either being softened"
  - "Both configuration branches — no `tests` key at all, and a declared report absent from the snapshot — fail Done. Neither is reported skipped (D-80, extended)"
  - "`gate.test-unknown` and `gate.test-not-passed` are suppressed when the report is undeclared or absent; `gate.test-tag-missing` is not, because it is a property of the ticket"
  - "The identity compared is the git author email (`%ae`), lower-cased on both sides; one `git show -s` and one `git log --name-only -- accord/tickets` supply it"
  - "`loadFromFs` omits the `git` key entirely on an unborn HEAD, so the existing `valid-build` CLI golden comparison is byte-unchanged"
  - "The one sanctioned skipped form in the whole gate table is `gate.author-skipped`, and it is a warning either way, so it can never stand in for a failure"

patterns-established:
  - "Machine-layer suppression: a configuration problem yields one reason, never one per scenario — mirrors `tokensMissing` skipping the allowlist check under D-67"
  - "Guarded git wrapper in tests: a single `execFileSync('git'` site, handed out by a factory that throws unless the target is a throwaway sandbox under the OS temp directory"

requirements-completed: [GATE-05, GATE-08]

coverage:
  - id: D1
    description: "A muted test fails Done exactly as a failing one does, and an id the report does not declare fails too"
    requirement: GATE-08
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#MACHINE: skipped and failed both fail, an unknown id fails, an untagged scenario fails"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/gate-done.MACHINE.done.json"
        status: pass
    human_judgment: false
  - id: D2
    description: "An undeclared or absent test report fails Done with one configuration reason rather than one per scenario, and never reports a skip"
    requirement: GATE-08
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#GONE: a declared report absent from the snapshot is one reason, not one per scenario (D-80)"
        status: pass
      - kind: unit
        ref: "packages/core/test/gate.test.ts#CLEAN: no tests key at all fails Done once, and never reports the check skipped (D-80)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A `@ui` scenario is exempt from the whole machine layer, and the `@test:` id lookup never folds case, walks the prototype chain, or guesses"
    requirement: GATE-08
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#UINOTE: a @ui scenario is exempt from the whole machine layer (GATE-09, D-90)"
        status: pass
      - kind: unit
        ref: "packages/core/test/gate.test.ts#the id lookup is exact code points: no case folding, no prototype chain, no whitespace guess"
        status: pass
    human_judgment: false
  - id: D4
    description: "The author warning fires when the review and the gated commit share an identity, and reports itself skipped when the host supplied neither — both as warnings that leave the verdict alone"
    requirement: GATE-05
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#SOLO: one warning naming the shared identity, and the verdict stays pass"
        status: pass
      - kind: unit
        ref: "packages/core/test/gate.test.ts#PASS.noauthors: a host that supplied no identity is one warning, not a silent pass"
        status: pass
    human_judgment: false
  - id: D5
    description: "The CLI loader supplies `git.commit` and `git.authors` from a real repository, with posix keys, and omits the key entirely when HEAD is unborn"
    requirement: GATE-05
    verification:
      - kind: integration
        ref: "packages/cli/test/load.test.ts#supplies git.commit and git.authors from a repository with one commit (D-78)"
        status: pass
      - kind: integration
        ref: "packages/cli/test/load.test.ts#omits git entirely when the repository has no commit, so the golden is byte-unchanged (D-54)"
        status: pass
    human_judgment: false

# Metrics
duration: 15 min
completed: 2026-09-14
status: complete
---

# Phase 4 Plan 04: The Machine Layer, the Author Warning, and the Host Git Facts Summary

**Done now reads the JUnit report rather than the developer's word for it — a muted test fails exactly as a broken one does, an undeclared or deleted report fails rather than skipping, and the CLI is the only producer of the commit and author identities GATE-05 compares.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 of 2
- **Files created:** 16
- **Files modified:** 9

## Accomplishments

- **Machine layer (GATE-08).** Five rules, all `error` on both profiles: `gate.test-tag-missing`, `gate.tests-unconfigured`, `gate.report-missing`, `gate.test-unknown`, `gate.test-not-passed`. The `MACHINE` ticket exercises all four failure shapes in one golden — a `skipped` case, a `failed` case, an id the report does not declare, and a scenario that carries no `@test:` tag at all — each finding on its own Scenario line.
- **Both D-80 branches closed.** `gate-no-report`/`GONE` proves that declaring `tests.report` and deleting the file fails with one `gate.report-missing` at `/tests/report` and no per-scenario noise; `gate-ready`/`CLEAN` run through Done proves that declaring nothing fails with one `gate.tests-unconfigured` at `/tests`, whose reason does not contain the word *skipped* anywhere in the golden.
- **`@ui` stays exempt.** `gate-done.UINOTE.done.json` contains zero `gate.test-` findings; the machine layer never reaches a `@ui` scenario.
- **Author warning (GATE-05).** `gate.author-match` and `gate.author-skipped`, both `warning` on both profiles. `SOLO` fires the match and still returns `verdict: 'pass'`; `PASS.noauthors` fires the skip; `PASS` under the full author record fires neither; `NOVERIF` fires neither, because `gate.verification-missing` already owns a missing review.
- **Host git facts.** `gitFacts` in `packages/cli/src/load/fs.ts` spawns `git` twice — `git show -s --format=%H%x00%ae HEAD` and one `git log --format=%x01%ae --name-only -- accord/tickets` — by name, with literal argument arrays, no shell, no package manager, no batch shim. Keys are posix-ised through the same `.split(sep).join('/')` step `accordFiles` uses. On an unborn HEAD the whole `git` key is omitted, so the pre-existing `valid-build` CLI golden comparison is byte-unchanged.
- **Phase 4 is green.** `npm run check` exits 0: both builds, eslint clean, all three `tsc` projects, 590 tests across 21 files (up from 556 at the end of 04-03).

## Task Commits

**None.** This project forbids commits (user global CLAUDE.md critical rule; project memory `accord-solo-no-prs`). Every change from this plan, and from 04-01 through 04-03, is left uncommitted in the working tree for the author to review. `git rev-parse HEAD` is `97a7977174efa56e1d98594355d15a46af50a8b9` — the same value it held before this plan started — and `git diff --cached --quiet` exits 0, so nothing was committed and nothing was staged. The `commits: 0` in the frontmatter is therefore a correct reading of an intentional no-commit policy, not an uncommitted-work warning.

## Files Created/Modified

**Core — the rules**
- `packages/core/src/gate/done.ts` — added the Machine layer (`testTagMissing`, `testsUnconfigured`, `reportMissing`, `testUnknown`, `testNotPassed`, with the module-private `machineScenarios`/`reportPath`/`reportLoaded`/`testIds` helpers) and the GATE-05 layer (`authorMatch`, `authorSkipped`, with the module-private `authorsOf`).
- `packages/core/src/gate/rules.ts` — seven new `DONE_RULES` rows: five `error`, two `warning`, all on both profiles.

**Core — the fixtures**
- `packages/core/test/fixtures/gate-done/reports/junit.xml` — two more `<testcase>` entries in the same `<testsuite>`, deriving to `test/login.spec.ts#skip1` (a `<skipped/>` child) and `test/login.spec.ts#fail1` (a `<failure>` child). The two passing cases are untouched, so `PASS` keeps passing.
- `.../gate-done/accord/tickets/MACHINE.md` + `MACHINE/verification.md` — a fully bound `story` whose four scenarios are the four machine failure shapes; everything outside the machine layer is clean, so the golden isolates exactly those reasons.
- `.../gate-done/accord/tickets/SOLO.md` + `SOLO/verification.md` — a fully bound, otherwise clean copy of `PASS`, so its only finding is the author warning.
- `packages/core/test/fixtures/gate-no-report/**` — `config.yml` declaring `tests.report: reports/gone.xml` with no `reports/` directory on disk, the `GONE` ticket and its review, and real `src/auth/login.ts` / `test/login.spec.ts` so the evidence and note references resolve.

**Core — the tests and goldens**
- `packages/core/test/gate.test.ts` — the populated `GIT.authors` record, five new case rows, and two new `describe` blocks (the Machine layer, the author check) covering all six pinned behaviours plus the two table assertions.
- New goldens: `gate-done.MACHINE.done.json`, `gate-done.SOLO.done.json`, `gate-done.PASS.noauthors.done.json`, `gate-no-report.GONE.done.json`, `gate-ready.CLEAN.done.json`, `gate-no-report.snapshot.json`, `gate-no-report.lint.json`.
- Regenerated: `verification-edges.A.done.json` (its config declares no `tests:` key, so it gains one `gate.tests-unconfigured` and two `gate.test-tag-missing` — exactly what the plan predicted), plus `gate-done.snapshot.json` and `gate-done.lint.json` for the new tickets and report cases.

**CLI**
- `packages/cli/src/load/fs.ts` — `gitFacts(root)` and the spread into `loadFromFs`'s return value.
- `packages/cli/test/load.test.ts` — the guarded `gitIn(tmp)` wrapper (now the single `execFileSync('git'` site in the file), `makeCommittedRepo()`, and the two new assertions.

## Golden delta audit

Every golden that moved, and why:

| Golden | Moved because | Owned by |
|---|---|---|
| `gate-done.MACHINE.done.json` | new | Task 1 |
| `gate-no-report.GONE.done.json` | new | Task 1 |
| `gate-ready.CLEAN.done.json` | new | Task 1 |
| `gate-no-report.{snapshot,lint}.json` | new fixture | Task 1 |
| `verification-edges.A.done.json` | gained `gate.tests-unconfigured` + two `gate.test-tag-missing` | Task 1 |
| `gate-done.{snapshot,lint}.json` | `MACHINE` (Task 1) and `SOLO` (Task 2) tickets, two new report cases | Tasks 1 and 2 |
| `gate-done.SOLO.done.json` | new | Task 2 |
| `gate-done.PASS.noauthors.done.json` | new | Task 2 |

**Nothing else moved.** In particular `gate-no-report.GONE.done.json` and `verification-edges.A.done.json` came back byte-identical after Task 2 — vitest reported no update for either — which is the check that `GIT.authors` covers every review path outside `gate-done` that a git-carrying row drives. `grep -c "gate.author"` prints 0 on both, and on `gate-done.PASS.done.json`. `grep -c '"level": "error"'` prints 0 on `gate-done.PASS.done.json`.

## Decisions Made

- **GONE's evidence cites file paths, not test ids.** A verbatim copy of `PASS` would have cited `test/login.spec.ts#ok1`, but `gate-no-report` loads no report, so `snapshot.tests` is absent and a bare test id resolves to nothing. That would have added two `gate.evidence-unresolved` errors and two `gate.reference-unknown` warnings to a golden whose whole purpose is to isolate `gate.report-missing`. The evidence now names `test/login.spec.ts` and `src/auth/login.ts`, which resolve against the tree.
- **`GIT.authors` enumerates every review path literally.** Not built from a template literal over an id list, because the plan's acceptance criteria grep for the literal strings `accord/tickets/A/verification.md` and `accord/tickets/GONE/verification.md` — and more importantly, an explicit list is what makes a missing fixture visible when the next phase adds a ticket.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Narrowed the 04-02 "no check reports itself skipped" assertion**
- **Found during:** Task 2 (the author checks)
- **Issue:** `packages/core/test/gate.test.ts`, in the 04-02 describe `gate done gate-done: the identity layer`, asserted `expect(noGit.findings.some((f) => f.rule.endsWith('-skipped'))).toBe(false)`. `gate.author-skipped` is by design the one rule in the table with a skipped form, so that assertion failed the moment Task 2's rows landed. Expected `false`, received `true`.
- **Fix:** Narrowed the assertion to name the one sanctioned exception and pin its level, rather than deleting it: it now asserts the skipped-rule set is exactly `[['gate.author-skipped', 'warning']]`. The invariant it was written to protect — that no check can report itself skipped *in place of failing* — is preserved and made sharper, because a warning cannot change a verdict.
- **Files modified:** `packages/core/test/gate.test.ts`
- **Verification:** `npm test -- --project core gate` reports 117 passed, 0 failed; `gate-done.PASS.done.json` still carries zero `error`-level findings.
- **Committed in:** n/a — no commits in this project.

**2. [Rule 3 - Blocking] Reworded three comments that the acceptance greps count**
- **Found during:** Task 2 (the final `npm run check`)
- **Issue:** Two acceptance criteria count literal tokens across the whole file rather than across code only. `grep -cE "shell:\s*true|'npx'|'npm'|\.cmd" packages/cli/src/load/fs.ts` printed `1` and `grep -c "cwd: tmp" packages/cli/test/load.test.ts` printed `2` — in both cases because a doc comment *described* the prohibition using the prohibited token.
- **Fix:** Reworded the `gitFacts` header comment ("never a Windows batch shim, never a package manager, and never through a shell") and the `gitIn` header comment ("the working directory is therefore pinned once, here"). No behaviour changed; the prohibitions themselves are unaltered.
- **Files modified:** `packages/cli/src/load/fs.ts`, `packages/cli/test/load.test.ts`
- **Verification:** the two greps now print `0` and `1` respectively.
- **Committed in:** n/a.

**3. [Rule 3 - Blocking] eslint `no-useless-assignment` on the `git log` fallback**
- **Found during:** Task 2 (`npm run check`)
- **Issue:** `let log = ''` followed by an unconditional assignment inside `try` triggered `no-useless-assignment` at `packages/cli/src/load/fs.ts:85`.
- **Fix:** Declared `let log: string` and assigned in both the `try` and the `catch`.
- **Files modified:** `packages/cli/src/load/fs.ts`
- **Verification:** `npm run lint` clean.
- **Committed in:** n/a.

### Recorded discrepancies (no code change)

- **The plan's author-record count is off by three.** Task 2's action text says `GIT.authors` should cover "the eight remaining `gate-done` ones". There are eleven review files on disk in `gate-done` besides `SOLO` (`BLOCKED`, `COMMIT`, `EVIDENCE`, `MACHINE`, `NOTES`, `PASS`, `REVIEW`, `SETS`, `STALE`, `TICKS`, `UINOTE`) — the count predates `MACHINE`, which Task 1 adds. All eleven are keyed to `reviewer@example.test`, per the plan's governing rule ("every verification file on disk in every fixture a `GIT`-carrying row drives"). The expected golden delta is unaffected and came out exactly as the plan predicted.
- **`gate-no-report`/`GONE` does not exercise `gate.test-tag-missing`.** The plan's Test 3 says the result "still carries `gate.test-tag-missing` for any untagged non-`@ui` scenario", but its own action text specifies both of GONE's scenarios carry `@test:` tags, so that clause is vacuous for this fixture. The truth it protects — that the ticket-level rule survives a configuration failure — is proved instead by `gate-ready`/`CLEAN` (one `gate.tests-unconfigured` **and** one `gate.test-tag-missing`, asserted explicitly) and by `verification-edges`/`A` (one `gate.tests-unconfigured` and two `gate.test-tag-missing` in its golden). No fixture change was made; adding a third scenario to `GONE` would have been scope the plan did not ask for.

---

**Total deviations:** 3 auto-fixed (3 blocking), 2 discrepancies recorded without a code change.
**Impact on plan:** None on scope or behaviour. One pre-existing assertion was narrowed to admit the exception this plan's own requirement creates; the other two were mechanical (a comment wording collision with a grep-based criterion, and a lint rule).

## Issues Encountered

None beyond the deviations above. The regression contract held throughout: `gate-done`/`PASS` returns zero `error`-level findings and `verdict: 'pass'` after both tasks, and no pre-existing test or golden failed for a reason this plan did not own.

## Verification — actual result

`npm run check` from `C:/Work/accord`, exit code **0**:

```
> build     tsdown x2 (core: dist/index.js 99.81 kB + dist/index.d.ts 14.45 kB; cli: dist/cli.js 0.43 kB)  ✔
> lint      eslint .                                                                                        ✔ (no output)
> typecheck tsc -p packages/core && tsc -p packages/core/tsconfig.test.json && tsc -p packages/cli           ✔
> test      vitest run — Test Files 21 passed (21), Tests 590 passed (590)                                   ✔
```

Repository git state before and after the full suite: `git rev-parse HEAD` = `97a7977174efa56e1d98594355d15a46af50a8b9` both times; `git diff --cached --quiet` exits 0; `git status --porcelain` is non-empty (71 entries — the uncommitted work of plans 04-01 through 04-04). The Task 2 structural guards pass: exactly one `execFileSync('git'` site in the comment-stripped `packages/cli/test/load.test.ts`, at least one `cwd: tmp`, exactly one `show-toplevel` assertion.

## Known Stubs

None. No placeholder, empty-value, or TODO path was introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 4 is complete.** Every one of GATE-01 to GATE-11 now has at least one rule id, one fixture, and one golden; ROADMAP criterion 4 is proved end to end by `MACHINE` (the skipped and failed cases), `gate-no-report`/`GONE` and `gate-ready`/`CLEAN` (the two configuration branches), `SOLO` (the author match), and `PASS.noauthors` (the skipped author check).
- **For Phase 5 (CLI):** `gateReady`/`gateDone` return `GateResult`, which renders through the existing `renderText` unchanged; `loadFromFs` now supplies `git` when the repository has a commit. Exit codes and commander surfaces are Phase 5's work — this phase added no process surface.
- **Open item carried forward:** GATE-05 fires by construction on nearly every honest solo ticket (D-79, accepted by the owner). GATE-13 — the author check through the GitHub commits API — is what would make the warning discriminate; revisit together.
- **Blocker for the author:** all work in `.planning/phases/04-gates/` and both packages is uncommitted. Review the diff before anything else consumes it.

---
*Phase: 04-gates*
*Completed: 2026-09-14*

## Self-Check: PASSED

- All 16 created files and the SUMMARY exist on disk (`[ -f ]` on each).
- Commit-hash verification is not applicable: this project forbids commits, so no commit was made by design. `git rev-parse HEAD` is unchanged at `97a7977174efa56e1d98594355d15a46af50a8b9` and `git diff --cached --quiet` exits 0.
- Every `<acceptance_criteria>` item from both tasks was executed and passed; the two that read `at least 1` and the counts `5`, `2`, `1`, `0` are recorded in the Verification section above.
- `npm run check` re-run after the last edit: exit 0, 590 tests passed across 21 files.
