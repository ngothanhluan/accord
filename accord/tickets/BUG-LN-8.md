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
approved_hash: "fnv1a64:f30363f7e7dceba7"
ac_hash: "fnv1a64:e5df2e2d7cf3dcc5"
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

  @ac-1 @test:packages/cli/test/upgrade.test.ts#ac-1-upgrade-replaces-the-lint-and-gate-step-of-a-0.1.0-workflow-with-the-step-accord-init-writes-now
  Scenario: Upgrade refreshes the lint-and-gate step of an older install
    Given a repository whose workflow is the one accord init wrote at release 0.1.0, and whose config.yml pins 0.1.0
    When accord upgrade runs with a newer release
    Then the workflow on the upgrade branch holds one step named lint and gate
    And that step is byte for byte the step the newer release's accord init writes

  @ac-2 @test:packages/cli/test/upgrade.test.ts#ac-2-upgrade-replaces-only-the-lint-and-gate-step-and-keeps-every-other-line-of-the-workflow
  Scenario: Upgrade keeps every other line of the workflow
    Given a workflow with one step named lint and gate that has a hand edit inside it, plus a step and a job the team added, and comment lines after the step
    When accord upgrade runs
    Then the lint and gate step is replaced by the newer release's step and the hand edit is gone
    And every line outside that step is unchanged, except a version pin that today's upgrade already rewrites

  @ac-3 @test:packages/cli/test/upgrade.test.ts#ac-3-a-workflow-with-no-or-two-lint-and-gate-steps-is-only-repinned-and-upgrade-warns-on-stderr
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
Chosen: splice the step in core, located with yaml (architect option 1). A pure function beside `repinWorkflow` in packages/core/src/scaffold/repin.ts parses the workflow with `parseDocument`, counts the steps named `lint and gate` on `toJS()` (the Ruling's reading, so a `*alias` reuse counts twice), takes the step's source lines from the AST, from its `- ` line to the last line of its last value, and replaces them with the same span cut from `workflowYml(pkg.name, v)`, shifted to the old indent and in the file's line ending. It returns undefined unless both parses have no errors and the re-parsed document's `toJS()` equals the old one with only that step swapped for the fresh one (critic finding 1: the guard covers the whole file, not just the step); toJS runs inside try. upgrade.ts:64 refreshes, then repins; on undefined it repins only and, after the push, prints the warning to stderr; stdout's three lines are unchanged.
Rejected: option 2 (the same code plus a line in the `/accord upgrade` skill that shows the warning and copies it into the pull request body) — the Ruling already accepted a stderr-only warning; it remains open to the owner. Re-serialising the yaml document — rewrites quoting elsewhere, fails @ac-2. A regex on `- name: lint and gate` — misses a quoted name, against the Ruling.
Affected: packages/core/src/scaffold/repin.ts, packages/core/src/index.ts, packages/cli/src/commands/upgrade.ts, the header comment of packages/core/src/scaffold/workflow.ts (upgrade now depends on the step name), packages/cli/test/upgrade.test.ts, and one new fixture: the 0.1.0 workflow rendered from v0.1.0's workflow.ts.
Risks (critic, all Should, none breaks a Decision): (1) taken in the guard above; (2) one step that cannot be spliced (flow style, anchored) would get advice that cannot work, so it gets its own stderr line saying the step must be a block list item without an anchor, as init writes it; (3) "run accord upgrade again" fails once the upgrade pull request is merged (the pin is no longer older), so the warning also says to do it before merging: close that pull request, delete the branch, fix the step on the default branch, run upgrade again — otherwise the refresh waits for the next release; the warning is easy to miss under option 1.
Failure scenarios (overwrites user text): a hand edit inside the step is lost (D-01) — e.g. a `working-directory:` line; another step the team named `lint and gate` while renaming accord's is replaced (within the name Ruling); a broken splice outside the step (closed by the whole-document guard). Each is undone the same way: nothing reaches the default branch before the upgrade pull request merges; restore the lines from `<base>` on upgrade/<v>, or revert the workflow hunk after merging.
Tests, all in packages/cli/test/upgrade.test.ts at the command layer: @ac-1 compares the whole upgraded file to `workflowYml(name, v)` (critic finding 4, not spans cut by the code under test); @ac-2 a hand-edited step, an added step and job, and trailing comments; @ac-3 no step and two steps, asserting the file differs only in the pin and the stderr line.
