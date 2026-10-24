---
id: "ST-LN-32"                            # equals the file name: tickets/<id>.md
title: "The owner approves a ticket from a short view of its main points, not the whole ticket pasted in chat"
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
Queued 2026-10-21, not approved; the intent interview replaces this:
- Raised during ST-LN-26, at its approach approval. Owner: "I find that showing the whole ticket description right now is not very effective, I need only the necessary things shown. like the main points and a short version. something brief and concise, with all the main points", then "ok open a ticket for that."
- Today: `accord-intent` step 9 and `accord-approach` step 5 paste `accord show <id> --approval` unchanged, which prints the whole Intent, every clause of every criterion, every Decision and the whole Approach; for ST-LN-26 that was several screens, with a plain-words line per criterion below it.
- Proposal to confirm at intent: the owner is shown a short view (purpose, one line per criterion, the decisions that matter, the risks kept) with the path of the full ticket; the yes still binds the full text through `approved_hash`, so the full text stays one step away and nothing approved is hidden.
- To settle at intent: whether the short view is printed by the CLI (deterministic, e.g. a `--brief` form of `accord show`) or written by the session (can drift from the text); whether it replaces the plain-words lines; whether the verify report to the owner gets the same treatment; overlap with ST-LN-12 (the verify report) and ST-LN-29 (queuing ideas mid-session, as this ticket was).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-32

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
