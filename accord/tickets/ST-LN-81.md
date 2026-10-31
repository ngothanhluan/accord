---
id: "ST-LN-81"                            # equals the file name: tickets/<id>.md
title: "The scout's facts are checked where they decide something and saved in the ticket, so no later agent searches again"
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
- Source: accord/research/2026-10-30-harness-architecture.md section 3, Scout. Owner, 2026-10-30: "Today the scout runs as just one agent. Is it missing things? Is it performative? Does it need a routing layer that decides how many scouts, which model and effort?" (translated).
- Measured: recall of changed files 0.94 for tickets touching 5 or fewer existing files, 0.60 above 5; about 49 of 125 missed files are wiring (index.ts exports, CLI registration, README text restating a rule); errors are false "only" / "none" / completeness claims, not wrong locations (2 of 873 cited lines bad); 62 of 63 reports hedge "not opened"; the architect re-opened 65% of the scout's files; 45 of 63 reports exceed the 30-line cap; about 10 of 19 recent tickets show no lane scout. The scout is about 1% of subagent tokens.
- Queued intent: the scout prompt carries a wiring checklist, every "only" or "none" claim names the pattern and folders searched, and a file the caller names is opened; the CLI computes the lane lift conditions (file count, code areas, sensitive matches) from the scout's file list with the gate/scope.ts rules; the report is saved under accord/tickets/<id>/ with its commit and the next agent reads it.
- Not here: a routing layer for scout count, model or effort (no evidence it pays; model and effort go to ST-LN-46).
- Open for the interview: whether lint checks that a saved report's citations still resolve; how the dashboard or gate shows a skipped scout.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-81

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
