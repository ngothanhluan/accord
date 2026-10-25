---
id: "ST-LN-57"                            # equals the file name: tickets/<id>.md
title: "Review checks a fixed scope, and a late finding blocks only with evidence"
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
- Why (owner, 2026-10-25, after the main session proposed a five-ticket plan for review convergence: "ok, agreed"): 27 of ST-LN-14's late review findings were on code added mid-review by debug episodes, and 5 of the 7 Musts raised after round 2 across all records came from code added during review (debug fixes, a merge of main, post-verify rework), none from a defect missed earlier.
- Queued intent: (1) the review package is pinned to a base; code added by a debug episode or a merge gets its own round 1 and does not count as a late round; (2) a fix that changes a file no finding names needs a Ruling, as an undeclared plan file does; (3) from round 3, a new finding that is neither carried forward nor on lines the last fix changed blocks only with a failing test or a reproducing command, otherwise it goes to the ledger as Deferred (GSD #3304 evidence gate); a data-loss or security finding always blocks.
- Also queued: a Should rests on a ticket line or an in-scope failing case, else it is Nice. The 2026-10-25 measure found this demotes 18 of 50 late Shoulds, none judged a real defect, but 3 of them data-loss edge cases, hence the exception above.
- Related: ST-LN-17 counts the rounds; ST-LN-56 sets how a finding is stated and fixed.
- Research: `accord/research/2026-10-25-review-convergence.md` (evidence, not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-57

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
