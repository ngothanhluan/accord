---
id: "ST-LN-49"                            # equals the file name: tickets/<id>.md
title: "Each /accord action is its own command, so a person sees what to type"
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
Queued 2026-10-24, not approved; the intent interview replaces this:
- Owner, 2026-10-24: "I see the /accord command is missing hints. Either split it into separate commands or add hints, but I think it should be split into separate commands."
- Today one `/accord` skill carries the dashboard (no argument), `pick-up <id>`, `continue <id>`, `upgrade` and `<request>`; nothing in the command list tells a person which of these exist or what argument each takes.
- Owner leans to separate commands (for example dashboard, pick-up, continue, new request, upgrade) over argument hints on the one command; the interview settles the names, whether `/accord <request>` stays, and how the dashboard's action line names them.
- Must hold the Compatibility constraint: the same commands in Claude Code, Cursor, Copilot and Codex, one definition each, rendered; the hooks, the pane's buttons and the docs that say `/accord …` move with it.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-49

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
