---
id: "ST-LN-86"                            # equals the file name: tickets/<id>.md
title: "An agent researches outside libraries, APIs and versions the code cannot answer, and records what it finds as research"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-13", "ST-LN-80"]
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
Queued 2026-10-31, not approved; the intent interview replaces this:
- Source: split from ST-LN-13 by its D-01 (owner, 2026-10-30: "ok, as proposed"). ST-LN-13 (merged 2026-10-31, PR #148) built where research lives: `accord/research/` records with `Date:` and `Repository at <sha>`, the `research:` key, lint, the anchor's `## Research`, and the scout, architect, critic and planner reading the records. This ticket adds the agent that writes such records.
- Owner approved 2026-10-13: an `accord-researcher` agent runs when a ticket touches an outside library, API or version the code cannot answer, with source and date per fact; a library documentation tool first when installed, official docs second, web search third; shipped text describes the tool by function and never names it. Agents are rendered for Claude Code only and their `tools:` line is fixed; no per-repository config adds tools today.
- Waits for ST-LN-80 (owner, 2026-10-31: "Queue, wait for ST-LN-80", translated): the 2026-10-13 plan ran the researcher at the approach stage for the architect to read, and ST-LN-80 drops the architect and folds approach into plan, so the stage it runs at and who reads it are settled after ST-LN-80, not written here. Overlap to settle with ST-LN-83, whose candidate intents include a research request with no ticket: whether this agent serves that route too.
- Cost, from accord/research/2026-10-30-harness-architecture.md: quality > cost > speed (owner, 2026-10-30); multi-agent research used about 15x the tokens of one agent (section 3, Scout), so how many researchers run needs a reason.
- Open for the interview (owner, 2026-10-30): what it searches and along which aspects (proposed: API and behaviour at the pinned version; versions and compatibility; known issues; prior art), and how many run (proposed: none by default, one per question group or library, in parallel, each writing a record).
- Research: `accord/research/2026-10-30-research-records.md`, `accord/research/2026-10-30-harness-architecture.md` (evidence, not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-86

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
