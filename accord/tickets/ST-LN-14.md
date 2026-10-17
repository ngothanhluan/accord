---
id: "ST-LN-14"                            # equals the file name: tickets/<id>.md
title: "Benchmark which model and effort each agent role needs"
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
Queued 2026-10-17, not approved; the intent interview replaces this:
- Phase 3 benchmark: a script (not shipped) reads Claude Code subagent transcripts and git to compare agent runs by model, effort, outcome, tokens and time; it answers whether the executor model matters per risk kind.
- Run before 2026-11-11, when the 30-day transcript retention drops the first dogfood runs.
- Owner, 2026-10-17, after the main session forgot the review tier-up (BUG-LN-3 round 4 executor dispatched on sonnet, not opus): "làm sao để ko thể nào quên chuyện này? tôi nghĩ phần benchmark phải đánh giá thật kỹ mới dc." So the benchmark also scores process compliance from the transcripts: each dispatch against the skill rules (model tier at `escalation.fix_round_tier_up`, the five-round cap, a fresh agent per brief, the ticket copied byte for byte into a brief, commits without trailers), with that missed tier-up as a known case it must find.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-14

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
