---
id: "ST-LN-24"                            # equals the file name: tickets/<id>.md
title: "Two tickets in flight that will edit the same file are flagged before they collide"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-7"]
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

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-24

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
- D-01 Split from ST-LN-7: detecting that two tickets worked in parallel will edit the same files is its own lane M ticket, depending on ST-LN-7; blocking between tickets already exists through `depends_on` and `blockedBy` — "Ticket mới phụ thuộc ST-LN-7 (Khuyên)" (2026-10-18, asked in the ST-LN-7 intent session)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [ ] Scope from ST-LN-7 intent (2026-10-18). The owner asked, choosing the CLI-enforced Continue guard: "và chúng ta có detect ticket nào block ticket nào, hoặc ko bị overlap lẫn nhau khi làm song song ko?" Blocking exists: `depends_on` yields `blockedBy` (packages/core/src/status/rows.ts:89) and a blocked ticket is kept out of READY (rows.ts:113). Overlap is detected nowhere. Sources at hand: each plan task's `files` line in plan.md, and the diff of each `t/*` branch against the main branch. Proposal to confirm at intent: warn when two open tickets' plans or branch diffs touch the same file, at plan and on the dashboard.

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
