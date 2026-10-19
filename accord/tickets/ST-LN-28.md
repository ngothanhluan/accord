---
id: "ST-LN-28"                            # equals the file name: tickets/<id>.md
title: "Epics and projects keep their state across their tickets"
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
Queued 2026-10-19, not approved; the intent interview replaces this:
- Raised during ST-LN-27: how does accord keep state in sync across the tickets of an epic or a project? Owner, citing GSD's STATE.md that records every phase: "thấy khá hay", then "về epic/project structure thì cần một discuss".
- Today: lane L and P are "Not built yet" in the /accord skill; an epic has a template (`epic-lane.md`) whose Vetoes and Decisions bind its stories, and stories point at it with `parent:`; each ticket's deferred items, Rulings and lessons stay in its own `ledger.md` and are never gathered across tickets; a ticket's stage is derived from git, never stored.
- To discuss at intent: the epic and project structure and flow, and what carries from one story to the next (deferred items, Rulings, lessons, progress). A single shared state file conflicts on parallel branches, so state should stay derived from git. Deciding each deferred item at verify is already ST-LN-12; settle its overlap with this ticket.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-28

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
