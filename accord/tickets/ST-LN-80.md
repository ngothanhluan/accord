---
id: "ST-LN-80"                            # equals the file name: tickets/<id>.md
title: "One approach-and-plan stage replaces the architect, with one critique loop that also checks every Decision and one owner approval"
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
Queued 2026-10-30, not approved; the intent interview replaces this:
- Source: accord/research/2026-10-30-harness-architecture.md section 1. Owner, 2026-10-30: "The critic mechanism repeats in the architect and the planner. Why not gather it in one place? No need for the architect any more. This cuts token use and is faster." (translated).
- Measured: architect plus approach critic are about 11% of a lane M ticket's tokens (planner plus plan critics about 41%); at the first approach approval the owner said a plain yes in 35 of 38 tickets and picked another option in 0; 15 of 26 re-approvals came from the plan stage.
- Against: the approach critic's Musts changed the approach in 112 of 117 cases; for 48 of 94 it is unclear the plan critic would catch them, mostly Decision breaks, since plan mode (packages/core/agents/critic.md, mode `plan`) does not check Decisions.
- Queued intent: drop accord-architect and the approach-mode critic; the planner writes `## Approach` with plan.md; the owner picks the option and answers direction questions before the full plan is written; plan critique also checks every Decision and Correction; the owner approves once after critique. The CLI gates that read `approved_hash` before plan (gate ready) change order, a public interface.
- Open for the interview: what replaces the impact analysis (the scout report of ST-LN-81 or the planner); whether lane-M tickets touching auth, money, migration or data deletion keep a separate direction critique; ST-LN-71 and ST-LN-13 change with this (overlap to settle).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-80

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
