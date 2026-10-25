---
id: "ST-LN-60"                            # equals the file name: tickets/<id>.md
title: "A teammate's review comments on a ticket's pull request are checked and routed like review findings"
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
- Why (owner, 2026-10-25, to the main session's recommendation after auditing the superpowers and ponytail plugins against accord and Anthropic's skill authoring guide: "agreed. remember to save the research and have the related tickets reference it.").
- Today no accord skill says what to do with comments a person leaves on a ticket's pull request (searched `packages/core`, no match), though accord targets teams where the reviewer is another person.
- Queued intent, from superpowers 7.0.0 `receiving-code-review`: (1) each comment is checked against the code before anything changes; (2) when any comment is unclear, ask about it before fixing any, since comments may be related; (3) a comment that conflicts with a Veto, Decision or Correction goes to the owner; (4) the rest are classified patch, plan-gap or intent-gap as review findings are, fixed through a fresh executor, and recorded; (5) the answer goes in the comment's own thread.
- Open at intent: which stage owns this after verify (a new review round, as `failure.md` gives a failure), and whether a comment from the owner is a Correction.
- Research: `accord/research/2026-10-25-plugin-audit.md` (evidence, not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-60

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
