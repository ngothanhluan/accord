---
id: "ST-LN-44"                            # equals the file name: tickets/<id>.md
title: "No test in a full run takes more than 10 s, and every criterion keeps a test that proves it"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# The epic this ticket belongs to.
# parent: "EPIC-ID"
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Optional design reference URL.
# design: "https://example.com/design/..."
# Written by `accord approve` after the owner says yes; never edit by hand.
# approved_hash:
# Written by `gate ready`; never edit by hand.
# ac_hash:
# Self-test ticks, e.g. [ac-1, ac-2]. Always the last key.
# verified: []
# The AC hash and the commit the ticks were made against.
# verified_hash:
# verified_commit:
approved_hash: "fnv1a64:00e6ab13dfabaf56"
ac_hash: "fnv1a64:5759120c1df0e673"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: the full suite takes about 19 minutes on the owner's Windows machine, and its slowest tests time out under load and have blocked verify (BUG-LN-4, ST-LN-48).
For whom: whoever runs the full suite at plan and verify, the owner today and any team on accord.
Success: a full run on the same machine has no test over 10 s, apart from tests the owner chose to keep, each with its reason.
Every one of the 75 tests over 10 s is handled; a criterion of another ticket keeps exactly one test that proves it.
Not: a target for total suite time, tests under 10 s, or changing what any ticket's criterion asks.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-44

  @ac-1
  Scenario: A full run has no test over 10 s apart from the approved keeps
    Given the table of the 75 tests over 10 s that the owner approved at the approach
    When the full suite runs once on the same machine as the 2026-10-24 baseline
    Then no test in that run's whole junit report takes more than 10 s, inside or outside the table
    And the only exceptions are the tests the table keeps with a reason

  @ac-2
  Scenario: A criterion whose test was replaced is still proved by exactly one test
    Given a test that proved an acceptance criterion of another ticket and was replaced by a cheaper one
    When accord lint runs on the repository, unchanged by this ticket, and the full suite runs
    Then that ticket's @test tag names the new test and lint reports no error
    And the new test passes in the full run, and no other test carries that @test tag

  @ac-3
  Scenario: Only the tests the table removes are gone
    Given the tests of the full run before this ticket and after it, each named by its file and its title
    When the two lists are compared
    Then every file and title that is gone is one the table marks as removed, merged, or moved
    And every test marked merged or moved has the file and title it went to written in the table

  @ac-4
  Scenario: A test made faster still checks what it checked before
    Given a test the table marks as faster, merged, or moved
    When its new body is compared with its old body
    Then every assertion the old body made has a matching assertion in the new place
    And a check of CLI output or exit code that the new place drops is made by another CLI test the table names
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The ticket has four parts: make the slow tests named in the Intent cheaper without losing what they check; remove the slow tests the owner judges not worth keeping, each listed for the owner's approval; sweep the whole suite for other slow tests; measure before and after from the junit durations the run already writes — "approved" (owner, 2026-10-25, to these four parts, which also drop the title's "still cover what they cover today" for removed tests)
- D-02 A test is in scope when it takes more than 10 s in a full run (75 tests, 2,125 of 3,375 test-seconds in the local full run of 2026-10-24) — "A" (owner, 2026-10-25, choosing over 10 s against over 30 s and over 5 s)
- D-03 Done means a full run on the same machine has no test over 10 s: each of the 75 is under 10 s, removed with the owner's approval, or kept with a reason the owner accepted, written in the ticket; total suite time is not a criterion — "A" (owner, 2026-10-25, choosing this against halving the full-suite time and against both)
- D-04 A test that proves an acceptance criterion of another ticket is never removed without a replacement: it is replaced by a cheaper test that proves the same criterion, and that ticket's `@test:` tag is moved to the new test — "A" (owner, 2026-10-25, choosing this against leaving such tests alone and against removing them)
- D-05 The owner approves the action for every one of the 75 tests once, at the approach stage, as one table (faster, merged, moved to core, removed, or kept with a reason); build only carries the table out — "A" (owner, 2026-10-25, choosing this against approving each test at build and against approving only removals and keeps)
- D-06 There is no smaller version: all 75 tests are handled in this ticket, none deferred — "handle it thoroughly" (owner, 2026-10-25, asked for the smallest version that still counts as done)
- D-07 The criteria read as follows: ac-1 checks every test in one full run's whole report, not only the 75; ac-2 needs no change to accord lint, and "the only test" means the only one carrying that @test tag; ac-3 names a test by file and title, and the table gives the file and title a test went to; ac-4 needs a matching assertion for every old one, and a CLI output or exit-code check dropped by a move is made by another CLI test the table names — "ok, agreed" (owner, 2026-10-25, to these four readings after the audit)
- D-08 The ST-LN-19 ac-1 test (show-approval.test.ts, 292 s) stays one tagged test: it rebuilds every real ticket from core approvalView and checks each ticket's load findings, and runs `accord show <id> --approval` once on one real ticket for the command path; it is not kept at 292 s — "A" (owner, 2026-10-25, choosing this against keeping the test as it is with a reason)
- D-09 The ticket also cuts the git processes each accord command starts (product code, same behaviour and output), so the criterion tests whose scenario needs several real command runs can get under 10 s instead of being kept with a reason; the cut is sized and measured before the table is approved — "ok A" (owner, 2026-10-25, choosing this against keeping about 14 criterion tests over 10 s with a reason and against running the full suite with fewer workers)
- D-10 The git cut of D-09 is only this: the plan-baseline ancestry, baseline files, and paths changed since a recorded commit are computed only when `gate plan` or `gate done` runs, and only for the gated ticket, since no other command reads them; the deeper cut (one-process default ref, claim tips, HEAD author, one `--merged` query, duplicate calls, light preflight) is queued as its own ticket; criterion tests still over 10 s are cut on the test side or kept with a reason in the table — "A" (owner, 2026-10-25, choosing this against also building the deeper cut here, about 120 lines that leave most criterion tests over 10 s, and against dropping the cut, which leaves the ST-LN-19 real-repo `show` run at 23 s)
- D-11 D-09 and D-10 are withdrawn: this ticket changes no product code; the gate-only git cut and the deeper cut are queued together as their own ticket — the critic found the ST-LN-19 ac-1 test runs `show` in an empty sandbox (about 4 s a run), not in the real repository, so D-08 alone brings it under 10 s and the cut no longer serves this ticket's criteria — "A" (owner, 2026-10-25, choosing this against keeping the gate-only cut here so daily commands get faster sooner)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: the per-test table accord/tickets/ST-LN-44/table.md (sha256 6ed26baa7b8a7b0726fa62f02a0076095716ca1a117026f4884b937c75ba9c10), one row per test in measurements.md (113): 39 faster, 35 moved (split into `risk:` tests), 29 kept with a reason and a ceiling (21 criterion tests, 7 benchmark tests, #50), 10 unchanged, none merged or removed. Build only carries it out (D-05); test code only, no product or script code (D-11).
Levers, all on the test side: per-file clone templates copied with `git remote set-url` (H1), one-spawn helper clones (H2), setup by git or file writes (H3), splits (H4), batched ref reads (H5), no auto-gc (H6), no origin in hold-only tests (H7), a temp-folder guard on the test `run()` helper (H8), core-ready hashes, async workflow-script runs, D-08 for show-approval.
Rejected: shared templates without a per-test table (the owner approves every test once, D-05); the product git cut (moved to its own ticket, D-11); a benchmark row filter in scripts/benchmark.mjs (it crashed rows, broke the per-verifier check, and added a 20-40 s test); a byte-identity check for BUG-LN-3 ac-4 (it drops per-case assertions, against ac-4 as D-07 reads it).
Affected: packages/cli/test/** (worktree, drop, hook, lane-s, after-verify, status, show, dashboard, upgrade, gate, trailers, benchmark-worktree, workflow-script, show-approval and others in the table), packages/cli/test/helpers/repo.ts and worktree.ts, core tests for D-08; accord/tests-baseline.txt where a baseline title moves.
Risks (critic, four rounds; every Must closed):
- Estimates are unmeasured and full runs swing 2-3x: rule 3 lists every row over 5 s at the measuring run, and any unkept row over 10 s at verify, for the owner before ac-1 is judged; a late keep edits table.md, changes this hash and needs a new `accord approve`.
- Data deletion A, a copy sharing the template's remote, so a clean deletes branches there and a "kept" test reads the wrong remote: each clone copy asserts its origin fetch and push URLs are its own and differ from the template's.
- Data deletion B, a split that separates branches one clean judges, hiding a cross-branch guard: #5 (with ST-10), block f, #50, #56, #72, #92, #93 stay multi-branch; #105 keeps a real drop then clean.
- Data deletion C, a copy with an unset path running `accord worktree clean` in the real checkout, deleting real worktrees and branches: H8 makes `run()` refuse any cwd outside the temp folder; recovery otherwise is reflog and GitHub's branch restore.
- 21 criterion tests stay over 10 s (kept with a reason), more than the ~14 named at D-09.
Tests: ac-1 by one full run with ACCORD_BASH set to Git Bash, its junit read whole against table.md; ac-2 by `accord lint` and each @test tag naming one passing test (no row moves a tag); ac-3 by the before/after file+title lists against the table's removed/merged/moved rows; ac-4 by the per-row assertion map in table.md, checked at review and verify.
