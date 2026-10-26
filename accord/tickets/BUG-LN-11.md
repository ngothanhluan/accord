---
id: "BUG-LN-11"                            # equals the file name: tickets/<id>.md
title: "Ticket progress made in one worktree does not show on the dashboard in other worktrees or other clones"
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
For the owner running several sessions in parallel worktrees, and for teammates on other machines: plan, build and review commit on the claim branch but never push it (only claim and verify push), and the dashboard reads another worktree's ticket from the pushed branch, so ST-LN-44 showed build 0/37 everywhere except its own worktree, which showed 18/37.
Success: once a stage records progress (a build task, a written plan, a review round), the claim branch on origin holds it, so `accord dashboard` run in any other worktree or clone that has fetched shows the same stage and task count as the ticket's own worktree.
A failed push never stops the work; it is reported, and the next successful push carries every commit made since.
Not in scope: changing which ref the dashboard reads or who it shows as holder (D-02), a central state file (D-01), uncommitted changes in another worktree, and refreshing the panel on another session's commit (D-03).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-11

  @ac-1
  Scenario: A recorded build task reaches origin
    Given a lane M ticket at build whose claim branch is pushed
    When a build task is recorded with accord task-done
    Then before the next task starts, the claim branch on origin holds every commit of that task, its ledger line included
    And accord dashboard in a second clone that has fetched shows the same task count as the ticket's own worktree

  @ac-2
  Scenario: A written plan and each recorded review round reach origin
    Given a lane M ticket whose claim branch is pushed
    When the plan stage commits plan.md, and later the review stage records each review round
    Then before the stage takes its next step, the claim branch on origin holds every commit made so far, fix commits of the round included
    And accord dashboard in a second clone that has fetched shows the same stage as the ticket's own worktree

  @ac-3
  Scenario: A failed push does not stop the work
    Given a lane M ticket at build whose push fails for any reason, an unreachable remote or a rejected push alike
    When a build task is recorded
    Then the task stays recorded locally as today and the next task starts
    And a line says the push failed, why, and that the commits stay local until the next push
    And when the next task is recorded and its push succeeds, origin holds every commit made since
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Git refs stay the only shared state; no central state file is added — owner, after asking whether a central state file was needed and hearing it was not: "ok, create it" (translated from Vietnamese)
- D-02 Fix the root cause by pushing the claim branch while the ticket is worked, instead of making the dashboard read an unpushed local branch; the pushed-over-local rule of ST-LN-1 and BUG-LN-2 is unchanged — owner, choosing that direction: "stop, don't create a new ticket, rewrite this ticket and do it now" (translated from Vietnamese)
- D-03 The panel refreshing on another session's commit is out of scope; it waits until ST-LN-63 makes the dashboard faster, and ST-LN-3 D-06 (no timer) stands — same answer as D-02

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-26 (translated from Vietnamese): "Stop, don't create a new ticket; rewrite this ticket and do it now." — the scope moved from changing which ref the dashboard reads plus a panel refresh, to pushing the claim branch during plan, build and review.

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
