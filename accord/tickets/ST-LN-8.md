---
id: "ST-LN-8"                            # equals the file name: tickets/<id>.md
title: "The executor brief carries the repository conventions, and the executor stays out of accord/ and adds no commit trailer"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
priority: high
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
Queued 2026-10-17, not approved; the intent interview replaces this:
- Dogfood findings 33 and 34: a `verify:` id matches the full JUnit test name; the executor never runs `accord task-done` and never edits `accord/`.
- Adds `accord/product/conventions.md` (engineering rules, one per line, with `Rejected:` lines) that `accord brief` appends to every brief; planner and executor read `accord/product/`.
- Verify offers to promote a Ruling or Correction that holds across tickets into conventions.md.
- Merged from ST-LN-9 (owner, 2026-10-18, after the main session proposed merging tickets that touch the same code: "ok gộp đi"): both say what an executor is told and may do.
- Every build executor in BUG-LN-2 added a Co-Authored-By trailer, against the repository rule that commits are authored by the owner alone; the main session fixed each by amending before push.
- Executor (and every agent that commits) instructions forbid trailers of any kind; a check catches one before push.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-8

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
