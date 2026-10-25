---
id: "ST-LN-56"                            # equals the file name: tickets/<id>.md
title: "A review finding names the property that must hold, and its fix makes it hold everywhere without opening a new finding"
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
Queued 2026-10-25, not approved; the intent interview replaces this:
- Why (owner, 2026-10-25, after the main session proposed a five-ticket plan for review convergence: "ok, agreed"): of 129 findings raised in round 3 or later across the 23 review and plan-review records with three or more rounds, 83 (64%) were caused by the previous round's fix, often in chains (ST-LN-26 plan-review 3.2, then 4.1, 5.1 and 6.1).
- Queued intent: (1) a critic or reviewer finding states the property that must hold and its evidence; a fix it names is an example, never binding (GSD #3771: planners applied fix hints literally, each attempt costing a round); (2) the executor makes the property hold at every place the same claim or pattern appears and lists the places it checked; (3) executor.md "Fix small bugs and blockers you meet on the way" becomes: fix only what the current change caused, and log anything else as Deferred; (4) after each finding's fix the affected tests run, and a red fix is reverted and the executor stops; (5) a fix that would cross a Veto or Decision returns a conflict instead of a workaround.
- Merged from ST-LN-52: lane-s.md step 4 and accord-review tell the fixer to search for every other place the same claim or pattern appears and fix them all, listing them in review.md, and the next reviewer checks the whole class is gone. ST-LN-51 took 5 review rounds; the "nothing needs installing" claim was reported in rounds 3, 4 and 5 because each fix touched only the flagged spot.
- Touches the critic, reviewer, final-reviewer, planner and executor agents and the plan and review skills, in all four runtimes. Related: ST-LN-17 counts the rounds; ST-LN-57 fixes the review scope.
- Research: `accord/research/2026-10-25-review-convergence.md` (evidence, not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-56

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
