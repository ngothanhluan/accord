---
id: "ST-LN-22"                            # equals the file name: tickets/<id>.md
title: "A new request is checked against existing tickets, and the related ones' decisions reach the scout and the critic"
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
Queued 2026-10-18, not approved; the intent interview replaces this:
- Found during ST-LN-21: `/accord <request>` proposes a lane and creates a ticket at once; nothing reads the existing tickets, open, done, or dropped, so a request that repeats a queued ticket or work already done becomes a new ticket unless someone happens to remember. Checks so far were by hand (the owner asking which tickets could be merged on 2026-10-18; a scout question added to ST-LN-21 by choice).
- Owner asked: "vậy làm sao Biết là chúng ta đang ko làm một việc bị lặp lại?", then chose "Cau 2. A" (queue a ticket now, intent later). Proposal to confirm at intent: before the lane, the CLI prints candidate tickets matched by title and Intent, so the step cannot be skipped by recall; the agent asks the owner to continue an existing ticket, merge into it, or create a new one linked to it. Also covers the panel's New request button, which submits `/accord <text>`.
- Added 2026-10-18 at the owner's "A": the same search also finds the related tickets, and their Decisions and Vetoes go to the scout at intent and to the critic at approach, which today checks only the current ticket's. Why: the code shows what the system does, not why or what the owner forbade; a finished ticket's Decisions are read by no later step, so a new ticket can break one unnoticed (rewriting ask.md in ST-LN-5 nearly dropped "the recommended option carries its reason" until the owner caught it, now D-08). Not needed at build or review, or for lane S. Rules that hold project-wide go to the conventions file ST-LN-8 adds.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-22

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
- D-01 Finding the related tickets and passing their Decisions and Vetoes to the scout and the critic is part of this ticket, not a separate one, since one search serves both the duplicate check and the related decisions — "A" (2026-10-18, to "Gộp vào ST-LN-22")

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
