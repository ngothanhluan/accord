---
id: "BUG-LN-8"                            # equals the file name: tickets/<id>.md
title: "accord upgrade leaves the old lint-and-gate script in repositories that ran accord init"
type: "bug" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["BUG-LN-4"]
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
For teams that ran `accord init` on an earlier release: `accord upgrade` changes only the version pin in `.github/workflows/accord.yml`, so the lint-and-gate script stays as it was at init, and fixes such as BUG-LN-3's and BUG-LN-4's never reach them (BUG-LN-4 D-03 left this to its own ticket).
Success: after `accord upgrade`, the workflow's one step named `lint and gate` is exactly the step the new release's `accord init` writes, and every other line of the file is unchanged apart from the version pin; the upgrade pull request shows any hand edit inside that step being replaced.
A workflow with no such step, or more than one, is still repinned as today, and upgrade prints a line saying the script was not refreshed and how to fix it.
Not in scope: creating the workflow when it is absent (unchanged: nothing is written), refreshing anything outside that step, and keeping hand edits inside it (D-01).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-8

  @ac-1
  Scenario: Upgrade refreshes the lint-and-gate step of an older install
    Given a repository whose workflow is the one accord init wrote at release 0.1.0, and whose config.yml pins 0.1.0
    When accord upgrade runs with a newer release
    Then the workflow on the upgrade branch holds one step named lint and gate
    And that step is byte for byte the step the newer release's accord init writes

  @ac-2
  Scenario: Upgrade keeps every other line of the workflow
    Given a workflow with one step named lint and gate that has a hand edit inside it, plus a step and a job the team added, and comment lines after the step
    When accord upgrade runs
    Then the lint and gate step is replaced by the newer release's step and the hand edit is gone
    And every line outside that step is unchanged, except a version pin that today's upgrade already rewrites

  @ac-3
  Scenario: A workflow without exactly one lint and gate step is only repinned
    Given a workflow with no step named lint and gate, and another with two such steps
    When accord upgrade runs on each
    Then the upgrade succeeds and the workflow differs from before only in its version pin
    And upgrade prints a warning to stderr naming the workflow file, saying the lint-and-gate script was not refreshed, and saying to leave exactly one step named lint and gate and run accord upgrade again
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Upgrade replaces only the step named `lint and gate` and always overwrites it; other steps and jobs are kept; a hand edit inside that step is lost and shows in the upgrade pull request's diff — owner chose option (a): "A"
- D-02 Smallest version: a workflow without exactly one such step keeps today's repin, and upgrade goes on and prints a line saying the script was not refreshed and how to fix it, instead of refusing — owner chose option (a): "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
