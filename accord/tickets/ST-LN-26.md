---
id: "ST-LN-26"                            # equals the file name: tickets/<id>.md
title: "A failure found after verify is routed to a fix and verified again"
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
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: ST-LN-20's PR #42 went red on ubuntu after verify passed on Windows: the POSIX-only half of a test returned early on Windows and counted as passed, nothing in accord read CI, and the main session judged the cause itself and fixed it with only a Ruling; `accord-debug` is reached only from build.
For whom: anyone working a lane M ticket whose work fails after verify, in CI or on another operating system.
Success: every failure found after verify reaches a root cause through `accord-debug`, its fix is reviewed and verified again before the ticket shows done, the owner sees the pull request's CI result before ticking, and the owner's report names every test the verify run skipped.
Not this ticket: a failure found after the ticket's pull request is merged (that is a new bug ticket); an automatic check in `accord lint` for tests that return early on an operating system (D-05); CI that is not GitHub Actions on a GitHub pull request (reported as not checked).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-26

  @ac-1
  Scenario: A failure someone reports after verify goes to debug before any fix
    Given ticket X has reached verify or done and its pull request is not merged
    And a session works X after "/accord continue X"
    When the owner reports a failure in X's work, with or without the failing command and its output
    Then the session opens a debug episode for X and a fresh debugger writes the root cause with evidence before any fix is made
    And the debugger finds the failing command and its output itself when the report does not give them
    And the session itself neither judges the cause nor dispatches a fix outside the debug stage

  @ac-2
  Scenario: Verify waits for the pull request's CI before the owner's report
    Given verify for ticket X has written verification.md
    And X's repository has a GitHub remote and the gh command works
    When verify continues
    Then X's branch is pushed and a pull request for it is opened when none is open, and it is not merged
    And the owner's report is shown only after the checks that push started have appeared and every one has finished, and it gives each check's result
    And when a check failed, the failure goes to a debug episode as in @ac-1 instead of to the owner's tick
    And a check that was cancelled or skipped is reported by name as CI not checked, and goes to no debug episode
    And when there is no GitHub remote or gh does not work, the owner's report says CI was not checked and why

  @ac-3
  Scenario: A change after verify takes the ticket back from done until it is verified again
    Given ticket X was verified at commit C
    When a commit after C changes a file outside X's ticket file and X's ticket folder
    Then the stage is never done until X is verified again at a commit that holds that change
    And after a fix of a failure found after verify, the stage is review until a review round of the changes made after C is recorded in review.md, then verify
    And after a merge from the main branch that holds no other change, the stage is verify

  @ac-4
  Scenario: The owner's report names the tests the verify run skipped
    Given the full test run during verify had tests that the test runner reports as skipped
    When the owner's report is shown
    Then it lists every one of them by name under what was not checked, with the operating system the run was on

  @ac-5
  Scenario: An assertion that runs only on some operating systems sits in a test the runner skips
    Given an assertion that should run only on some operating systems
    When an executor writes it or a reviewer reviews a change that holds it
    Then the executor puts it in a test of its own that is skipped through the test runner's own skip on the other operating systems, never behind an early return or a branch on the operating system inside a test
    And a reviewer reports an early return or a branch on the operating system that leaves an assertion unrun as a finding
    And no test in this repository leaves an assertion unrun on an operating system except through the test runner's own skip
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 A failure found after verify enters accord two ways: a person brings it to a session working the ticket, and verify itself watches the pull request's CI when GitHub is available; without GitHub the CI part is reported as not checked — "A"
- D-02 Every failure found after verify goes through `accord-debug`: a fresh debugger finds the root cause before an executor fixes it; the main session never judges the cause itself — "A"
- D-03 The fix of a failure found after verify gets its own review round on its diff, under review's existing rules, and then the whole ticket is verified again — "A"
- D-04 The ticket has four parts: route a failure found after verify, require verifying again with the stage never showing done on stale ticks, name the tests the verify run skipped, and make operating-system-only tests real skips — "xác nhận"
- D-05 The smallest version that counts as done: parts one to three in full; part four is a written rule for executors and reviewers, a reviewer finding for a test that returns early on the operating system, and this repository's early returns turned into real skips; no automatic check in `accord lint` — "A"
- D-06 Verify pushes the branch and opens the pull request when none is open, waits for every check to finish, and only then gives the owner's report; merging still waits for the owner — "A"
- D-07 The auditor's six readings, as the owner accepted them: any failure report opens debug and the debugger fetches the command and output itself; verify waits for the push's checks to appear before waiting for them to finish; only a failed check goes to debug, a cancelled or skipped one is reported as not checked; any commit outside the ticket's own records takes the ticket back from done, a fix through review then verify, a merge from main through verify only; skipped means what the test runner reports as skipped; every assertion that runs only on some operating systems sits in its own test skipped by the runner, early return and if/else alike — "đồng ý"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
