---
id: "ST-LN-31"                            # equals the file name: tickets/<id>.md
title: "Re-evaluate how work is sorted into lanes, so a small change is not made a lane M ticket by default"
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
- Raised during ST-LN-30. Owner: "sao tôi thấy o có ticket nào lane S làm từ mấy hôm nay vậy? ngay cả ticket nay tôi nghĩ cũng là lane S thôi. sao bạn lại xếp vào lane M? lý do?", then "còn mở một ticket đánh giá lại cách sắp xếp lane đi."
- Today: lane S has no ticket (`packages/core/skills/accord/SKILL.md`, New request, S: done in the main session with one reviewer), and the ticket template's `lane:` allows only M, L, P, so anything queued for later becomes lane M by construction. Any one of five conditions lifts S to M (SKILL.md:70), and "new user-visible behaviour" or "more than about three files" catches most changes to the CLI, whose skill text is rendered into several copies. A lane only rises (SKILL.md:93), so a queued M ticket whose scope narrows at intent cannot drop to S. ST-LN-30 is the example: its fetch part alone is close to lane S; its Continue notice is not.
- To settle at intent: whether the lift conditions are too broad, and which; whether a queued ticket's lane is provisional until its intent is approved and may drop then; whether lane S gets a queued form (overlap with ST-LN-29, queue an idea mid-session); whether lane S work is recorded anywhere the benchmark can count; overlap with ST-LN-28 (lane L and P structure).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-31

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
