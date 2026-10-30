---
id: "ST-LN-72"                            # equals the file name: tickets/<id>.md
title: "The planner, verifier and debugger write their file step by step, so a stalled run loses no work and a re-run resumes from it"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-17"]
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
- Why (owner, 2026-10-30, translated from Vietnamese): "my aim is that when the planner runs, each task it has planned is written down, so no information is lost". ST-LN-17's planner stalled for 600 s on 2026-10-30 and left nothing on disk; today packages/core/agents/planner.md, verifier.md and debugger.md say only which file each agent writes (planner.md:10, verifier.md:11, debugger.md:11), not when, so a run can hold all its work until the end.
- Queued intent: accord-planner, accord-verifier and accord-debugger write their file's skeleton first and add each section (a plan task, a criterion's verdict, a hypothesis or episode part) as soon as it is done; a re-run after a stall reads what is on disk and resumes from it instead of starting over.
- Does not cover: the approach critique's detail limit, diff mode and round cap, which the owner chose in the same message ("ok A+B", ST-LN-17 D-10) and which are queued as ST-LN-71.
- Open for the interview: how the stage skills (packages/core/skills/plan, verify, debug) tell a resumable partial file from a finished one, and that `accord gate plan` never passes a partial plan.md; a debugger dispatched on one hypothesis in a parallel round writes nothing today (debugger.md:44) and stays that way.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-72

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
