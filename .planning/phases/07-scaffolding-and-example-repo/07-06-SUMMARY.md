---
phase: 07-scaffolding-and-example-repo
plan: 06
subsystem: examples
tags: [examples, gates, vitest, intg-02, d-145, d-146, d-147]

# Dependency graph
requires:
  - phase: 07-scaffolding-and-example-repo
    plan: 04
    provides: "`deniedNames` / `DENIED` in `packages/core/test/helpers/denied.ts` — the one shipped-text name list this plan's example prose is scanned against"
  - phase: 07-scaffolding-and-example-repo
    plan: 02
    provides: "`accord init` writing the whole contract, which produced this example's skeleton (D-146)"
  - phase: 04-gates
    provides: "`gateReady`, `gateDone`, the rule tables, and `gate-done/PASS.md` as the known-good precedent this example is modelled on"
provides:
  - "`examples/build/` — a readable, hand-filled `profile: build` example that passes `gate ready` and `gate done` and carries no lint finding at all"
  - "`readDir(root: URL): SnapshotInput` on `packages/core/test/helpers/fixture.ts`; `readFixture` now calls it"
  - "`packages/core/test/examples.test.ts` — a one-row case table driving six cases, which 07-08 extends by one row with no new `it`"
affects: [07-08]

actuals:
  tokens: 4100   # chars/4 over the realized diff (~16,400 chars)
  tasks: 2
  commits: 0     # commits are forbidden in this project until the owner approves the diff

tech-stack:
  added: []
  patterns:
    - "the gate is the specification: an example is driven to green by supplying exactly what the findings name, one at a time, and never by moving a rule"
    - "a guard-the-guard case asserted before any gate case, so a deleted or emptied data directory fails on a nameable assertion rather than on an obscure downstream verdict"

key-files:
  created:
    - examples/build/accord/config.yml
    - examples/build/accord/product/glossary.md
    - examples/build/accord/product/business-rules.md
    - examples/build/accord/tickets/SIGNUP-1.md
    - examples/build/accord/tickets/SIGNUP-1/verification.md
    - examples/build/reports/junit.xml
    - examples/build/src/signup.ts
    - examples/build/test/signup.spec.ts
    - packages/core/test/examples.test.ts
  modified:
    - packages/core/test/helpers/fixture.ts

key-decisions:
  - "`ac_hash` and `verified_hash` are both `fnv1a64:6b9d74873ab9078e`, read off the gate's own report rather than authored — the loop the example exists to demonstrate"
  - "the example's `accord/` skeleton came from a real `node packages/cli/dist/cli.js init` run in a throwaway `git init` directory (D-146), and everything outside `accord/` that `init` wrote was deleted per A-20"
  - "no golden file for these cases: a golden pins the exact finding list and would be regenerated every time the example prose is improved"
  - "the example's supporting code is a real ten-line implementation rather than the fixtures' `export const login = true;` stub — an example is read, and its evidence has to point at something"

patterns-established:
  - "Pattern 1: `readDir(root: URL)` holds the walk; `readFixture(name)` is one line over it. Two base URLs, one key-normalisation rule"
  - "Pattern 2: the failure message of a verdict assertion carries the findings (`level rule file:line | reason`), so a RED names the rule rather than only `expected 'fail' to be 'pass'`"

requirements-completed: []   # INTG-02 stays open — 07-08 owns the tick (split_note)

coverage:
  - id: D1
    description: "`examples/build/` holds one `profile: build` ticket, at the repository root under `examples/` (D-145)"
    requirement: INTG-02
    verification:
      - kind: other
        ref: "examples/build/accord/config.yml carries `profile: build`; examples/build/accord/tickets/SIGNUP-1.md is the one ticket"
        status: pass
      - kind: unit
        ref: "packages/core/test/examples.test.ts#was read, and holds a config and the ticket the table names"
        status: pass
    human_judgment: false
  - id: D2
    description: "`gateReady` and `gateDone` both return `verdict: 'pass'` for SIGNUP-1, with the git facts spread onto the SnapshotInput"
    requirement: INTG-02
    verification:
      - kind: unit
        ref: "packages/core/test/examples.test.ts#passes gate ready"
        status: pass
      - kind: unit
        ref: "packages/core/test/examples.test.ts#passes gate done"
        status: pass
      - kind: other
        ref: "a scratch driver over packages/core/dist/index.js: ready => pass, done => pass, zero findings on both"
        status: pass
    human_judgment: false
  - id: D3
    description: "`lintSnapshot` reports no error-level finding over the example (in fact no finding of any level)"
    requirement: INTG-02
    verification:
      - kind: unit
        ref: "packages/core/test/examples.test.ts#carries no error-level lint finding"
        status: pass
    human_judgment: false
  - id: D4
    description: "Changing a gate rule — or the ticket data a gate rule reads — turns this suite red locally, in the same `npm test` run that guards the fixtures (D-147 layer 1)"
    requirement: INTG-02
    verification:
      - kind: e2e
        ref: "perturbation run: one word added to an @ac-1 scenario step -> 1 failed | 5 passed, message naming gate.ac-changed and gate.tick-stale-hash with both hashes; reverted"
        status: pass
      - kind: e2e
        ref: "perturbation run: accord/config.yml moved aside -> 3 failed | 3 passed, the guard case failing first with `expected [ …(7) ] to include 'accord/config.yml'`; restored"
        status: pass
    human_judgment: true
    rationale: "The rule-side perturbation (tightening `isSha` in packages/core/src/gate/done.ts) was NOT run — see F-1. The two data-side perturbations prove the suite is wired to the real engine and that its failure output is readable, which is the mechanism D-147 layer 1 depends on, but they do not literally move a rule."
  - id: D5
    description: "The example prose is under the same shipped-text name scan as the rendered skill bodies (T-07-31b)"
    requirement: INTG-02
    verification:
      - kind: unit
        ref: "packages/core/test/examples.test.ts#names no other tool, plugin, harness, or planning system"
        status: pass
    human_judgment: false
  - id: D6
    description: "No stored or printed path in the example carries a backslash, and no file under examples/ carries a carriage return"
    requirement: INTG-02
    verification:
      - kind: unit
        ref: "packages/core/test/examples.test.ts#reports every path forward-slash, on any host (D-51)"
        status: pass
      - kind: e2e
        ref: "grep -rlU $'\\r' examples/ -> exit 1 (no match)"
        status: pass
    human_judgment: true
    rationale: "Windows-observed only, like every D-51 assertion in this repository — nothing is committed, so the POSIX CI leg has never run (WINDOWS.md entry 9)."

duration: 24min
completed: 2026-09-18
status: complete
---

# Phase 7 Plan 06: the build-profile example Summary

**`examples/build/` is a real, readable build-profile ticket — scaffolded by an actual `accord init` run, hand-filled as a BA would write it, and driven to `pass` on both gates with zero findings of any level — held there by a six-case vitest suite whose case table 07-08 extends by one row.**

## Performance

- **Duration:** ~24 min
- **Tasks:** 2 of 2
- **Files:** 9 created, 1 modified

## Task Completion

**No commits were made.** This project forbids `git commit` until the owner has reviewed the diff (global CLAUDE.md critical rule, restated as a hard override in the execution brief). HEAD is still `53e9df9`. Per-task completion is tracked here instead of in git history:

1. **Task 1: the build-profile example, scaffolded by `init` and filled in by hand** — complete. `npm run build` clean; `examples/build/accord/tickets` lists `SIGNUP-1.md` and `SIGNUP-1/`; the carriage-return scan over `examples/` finds nothing.
2. **Task 2: the vitest proof** — complete. `npx vitest run --project core examples` → 1 file, 6 tests, all passing; full suite green.

## Accomplishments

- **The skeleton is proof, not a copy (D-146).** `examples/build` was created empty, `git init -q`'d so `repoRoot` resolved there rather than to this repository, and `node packages/cli/dist/cli.js init` was run inside it — 28 `created` lines, exit 0. Per A-20 the `.github/`, `.claude/`, `.agents/`, `AGENTS.md` and `CLAUDE.md` output was then deleted, along with the nested `.git`, leaving the `accord/` folder the gates read. The example therefore is standing evidence that what `init` generates is a thing the gates accept.
- **The gate was the specification, and it was consulted rather than guessed at.** The hashes cannot be authored, so the ticket was written with `ac_hash: "PENDING"` and `verified_hash: "PENDING"` and the gate was run against it. It answered with one finding — `error schema.pattern accord/tickets/SIGNUP-1.md:11 | must match pattern "^fnv1a64:[0-9a-f]{16}$"` — and, on the same run, `acHash= fnv1a64:6b9d74873ab9078e`. Writing that value into both keys turned `ready` and `done` from `fail` to `pass` in one step. That two-run loop is the workflow the example exists to demonstrate, and 07-08 walks it again on unfamiliar ground.
- **Zero findings, not merely zero errors.** `lintSnapshot` over `examples/build` returns an empty finding list, and both gates return empty finding lists. An example that carried standing warnings would teach a reader that warnings are normal.
- **One walk, two entry points.** `readDir(root: URL)` now holds the directory walk in `packages/core/test/helpers/fixture.ts` and `readFixture(name)` is a single line over it. Every existing caller is untouched, and the whole `gate case` golden set still matches.
- **The suite is sensitive, and its failures are readable.** Two perturbation runs (§Sensitivity below) show a RED that names the rule and the offending value, rather than a bare `expected 'fail' to be 'pass'`.

## The example, file by file

| Path | What it is |
|---|---|
| `accord/config.yml` | `init`'s output verbatim, plus the `tests:` block a `@test:`-tagged scenario needs. `profile: build`, `design.tokens: ""` (D-134 as amended), `accord: "0.1.0"` (A-22). |
| `accord/product/glossary.md` | Three terms the ticket then uses verbatim: visitor, account, workspace. |
| `accord/product/business-rules.md` | Three rules, one carrying a `Rejected:` line — the D-116 convention, shown rather than described. The ten-character password floor lives here, so the ticket can cite it instead of restating it. |
| `accord/tickets/SIGNUP-1.md` | `type: story`, `ui: false`, two `@ac-n` scenarios each carrying a `@test:` tag, a `## Plan` with one step per criterion, a `## Verification notes` block per ticked criterion, both hashes, `verified_commit: "1234567"`. |
| `accord/tickets/SIGNUP-1/verification.md` | `commit: 1234567`, a `## @ac-n` section per criterion, each `Result: pass` with an `Evidence:` line resolving to a real test id and a real file. |
| `reports/junit.xml` | Two passing cases whose ids are exactly the two `@test:` tags. |
| `src/signup.ts`, `test/signup.spec.ts` | The code the evidence points at: a ten-line account store that lowercases the address, and two tests over it. |

## Sensitivity (D-147 layer 1)

Two perturbations were made, run, and reverted:

| Perturbation | Result |
|---|---|
| one word added to an `@ac-1` scenario step | `1 failed \| 5 passed`; message: `error gate.ac-changed … ac_hash records fnv1a64:6b9d74873ab9078e, they hash to fnv1a64:528934c32d6ffa3b now` plus `error gate.tick-stale-hash …` |
| `accord/config.yml` moved out of the example | `3 failed \| 3 passed`; the guard case failed first with `expected [ …(7) ] to include 'accord/config.yml'` — the INTG-02 missing/empty edge landing on a nameable assertion rather than on `gate.ticket-unknown` |

Both were restored; `examples/` is byte-identical to its pre-perturbation state and the suite is green.

## Verification Results

Run from the repository root after all changes:

| Command | Result |
|---|---|
| `npm run build` | clean |
| `npm run lint` | clean (eslint covers `examples/**/*.ts` — no ignore entry was added) |
| `npm run typecheck` | clean (all three projects) |
| `npm test` | **35 files, 861 tests, all passing** (was 34 files, 855 tests) |
| `npx vitest run --project core examples` | 1 file, 6 tests, all passing |
| `grep -rlU $'\r' examples/` | exit 1 — no carriage return anywhere under `examples/` |

`.planning/REQUIREMENTS.md` is unmodified by this plan. No file was added under `packages/core/test/__golden__/` by this plan (the two `wrong-plan.*.json` files in `git status` are 07-05's). `examples/maintain/` does not exist. `.github/workflows/ci.yml` is untouched.

## Deviations from Plan

**1. [Rule 3 — blocked action] The rule-side sensitivity perturbation was not run.** The plan's D-147 layer-1 claim is "changing a gate rule turns the examples suite red". The natural demonstration — temporarily tightening `isSha` in `packages/core/src/gate/done.ts` from `>= 7` to `>= 8`, so `verified_commit: "1234567"` trips `gate.sha-too-short` — was attempted and **denied by the sandbox** as an edit to a security-relevant test path. It was not retried or worked around: the project's own rule 2 ("no auto-fixing production code during audits/testing") points the same way, and `packages/core/src/gate/**` is unchanged (`git diff --stat` over it is empty). Two data-side perturbations were run instead, and the claim is recorded at its true strength in D4's `human_judgment` rationale. See F-1.

**2. [documentation] The plan's `readDir` call was written with three `../` segments, not four.** The plan said "`readDir(new URL('../../../../examples/' + row.dir + '/', import.meta.url))` — confirm the number of `../` segments against the file's own location before running". From `packages/core/test/examples.test.ts`, three segments reach the repository root (`test/` → `core/` → `packages/`). Confirmed as the plan instructed; the guard-the-guard case is what would have caught a wrong count.

**3. [scope] The example's supporting code is a real implementation, not the fixtures' stub.** `gate-done/src/auth/login.ts` is `export const login = true;` — enough for a path to resolve, which is all a fixture needs. An example is read, so `src/signup.ts` is a working ten-line account store and `test/signup.spec.ts` holds the two tests the report names. No alternative was plausible here: evidence pointing at `export const signup = true;` would teach the opposite of what the ticket claims.

**4. [scope] The two product documents were filled in rather than left as `init` wrote them.** They are in the plan's `files_modified` list, so this is within scope, but worth naming: `init`'s glossary ships `- **Sample term** — …`, which as an *example* would read as unfinished work. They now carry the terms and rules the ticket actually cites. No lint rule forced this — product documents are outside ticket scope, so their content never reaches a gate verdict.

## Findings

**F-1 (blocked, needs the owner's call) — the D-147 layer-1 claim is proven one direction short.**
The suite is demonstrably wired to the real gate engine and goes red when the *data* moves under a rule. It has not been shown to go red when a *rule* moves, because that demonstration requires temporarily editing `packages/core/src/gate/done.ts`, which the sandbox denied. The two directions are not equivalent: a test could in principle pass a stale snapshot and still fail on data changes. *Expected:* a temporary `isSha` tightening produces `error gate.sha-too-short … "1234567" is not a commit sha; at least 8 hexadecimal characters are needed`. *Actual:* not run. If you want it run, it is one `sed`, one `vitest` invocation, and one revert — say so and it will be done under your eye. 07-08's CI job (D-147 layer 2) does not close this either; it exercises the same engine from the other side.

**F-2 (carried, still open, unchanged by this plan) — the shipped ticket templates name a design tool.**
07-04 raised it; the owner has not ruled. This plan did **not** carry that name into `examples/build/` and did **not** edit the templates. The example's ticket is `ui: false`, so no design reference was needed at all and no placeholder was required either — the question never arose in the example's text. The `deniedNames` case over `examples/build` returns `[]`, so whichever way F-2 is ruled, the example is already on the right side of it.

**F-3 (business logic, decided by me, alternatives recorded) — the domain choices in the example.**
The plan specifies the *shape* of the ticket and nothing about its content, so every sentence below was chosen rather than derived. None of them affects any gate or lint rule; they affect only what a reader learns the format from.

| Choice | What was chosen | The alternative |
|---|---|---|
| The story | Self-service sign-up with an email address | Sign-*in*, which is what `gate-done/PASS.md` uses; a different story keeps the example from reading as a translation of the fixture |
| Password floor | at least ten characters, stated once in `business-rules.md` and cited by the ticket | state it in the ticket's requirements; rejected because it would teach the opposite of what `business-rules.md` is for |
| Case handling | two addresses differing only in letter case are one address | leave it unspecified; rejected because it is exactly the kind of edge a BA is supposed to have decided before an agent starts |
| Criteria count | two scenarios (the free address, the taken address) | a third for the too-short password; rejected — the limit is five and two is enough to show a set, and every extra scenario is another `@test:` tag to keep honest |
| `reviewed_on` | `2026-09-18` | no rule reads it; any date parses |
| Evidence shape | a test id plus one clause of prose per block | the test id alone; both pass `gate.evidence-unresolved`, but the bare id reads like a machine wrote it |

**F-4 (informational) — the `git status --porcelain` check the plan implies is unreachable in this tree.**
Any "the working tree is clean for these paths" claim cannot be made here: Phase 6 and plans 07-01..07-05 are all uncommitted by design. The narrower claim this plan can and does make: **this plan touched only** `examples/**`, `packages/core/test/helpers/fixture.ts`, `packages/core/test/examples.test.ts`, and the three `.planning/` files below. 07-03 and 07-04 handled the same situation the same way.

## Known Stubs

None. Every file under `examples/build/` is finished content; `src/signup.ts` and `test/signup.spec.ts` are small but complete and do what the evidence says they do.

## Threat Flags

None. This plan adds no dependency, no network surface, no filesystem write path, and no schema. `readDir` reads a directory named by a source literal in a test file (T-07-30, accepted).

## State Updates

- `.planning/STATE.md` — position to plan 7 of 8, session and activity lines, one metric row, and one decision line.
- `.planning/ROADMAP.md` — Phase 7 plan count to 6/8, the 07-06 row ticked.
- `.planning/REQUIREMENTS.md` — **unchanged**. INTG-02 is 07-08's tick (the plan's `split_note`).

## Self-Check: PASSED

Every file claimed above exists on disk:

- `examples/build/accord/config.yml`, `accord/product/glossary.md`, `accord/product/business-rules.md`, `accord/tickets/SIGNUP-1.md`, `accord/tickets/SIGNUP-1/verification.md`, `reports/junit.xml`, `src/signup.ts`, `test/signup.spec.ts` — all present, 8 files, confirmed by `find examples/build -type f`.
- `packages/core/test/examples.test.ts` — present; `packages/core/test/helpers/fixture.ts` — modified, exports `readDir` and `readFixture`.
- `.planning/phases/07-scaffolding-and-example-repo/07-06-SUMMARY.md` — this file.

No commit hashes are claimed, because no commit was made. `npm test` is green at the moment of writing: 35 files, 861 tests, 0 failures.
