---
id: "BUG-LN-17"                            # equals the file name: tickets/<id>.md
title: "Two cli tests that pass alone time out under the full suite, so a baseline run fails on a test the ticket never touched"
type: "bug" # story | bug. An epic uses its own template
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
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Queued 2026-10-30, not approved; the intent interview replaces this:
- Why: two tests pass when run alone but fail on their own time limit inside a full run, so a ticket's baseline or verify run goes red on a test it never touched. (1) From ST-LN-17's baseline run at 6288bed (2026-10-30): packages/cli/test/lane-commands.test.ts:819 "a directory token passes when it exists at baseline and fails when it does not" failed on its 30 s timeout (:833); the file took 481 s of a 1059 s run, and the test passed when run alone. (2) From ST-LN-58's baseline run at a4cec8f (2026-10-28): packages/cli/test/worktree-push.test.ts:95 "ac-2 each stage change before build pushed with accord worktree push shows the same stage in another clone" timed out at its 120 s limit (:138) in a 27-minute full run on a machine short of memory; the whole file (5 tests) passed alone in 72 s.
- Both were first sent to ST-LN-63 part 4: (2) by the owner ("a", 2026-10-28, PR #121, never merged), (1) by the owner ("Split it into a ticket, go on", 2026-10-30). ST-LN-63 was already in build, with an approved intent whose ac-4 names exactly four tests, so on 2026-10-30 the owner chose a ticket of their own for both instead ("New draft ticket").
- Queued intent: each test passes inside the owner's full run within its own limit, whether through a cut on the command side or on the test side, as ST-LN-44 did.
- Open for the interview: whether raising a limit counts as a fix (conventions.md asks a time bound to be wide enough for the full suite and below the stall it guards); whether one full run is enough to call each test fixed, since each failed in one run only; whether to measure again once ST-LN-63, which cuts the git processes per command, has merged.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-17

  @ac-1
  Scenario: <observable outcome>
    Given ...
    When ...
    Then ...
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
