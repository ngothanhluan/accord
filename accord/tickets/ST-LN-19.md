---
id: "ST-LN-19"                            # equals the file name: tickets/<id>.md
title: "The owner approves a compact view of the ticket that drops no fact"
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

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-19

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
- [ ] Raised at the ST-LN-5 intent yes (2026-10-18). After approving the verbatim Intent and criteria the owner said: "ok A. nhưng tôi thấy đưa hết nguyên file lên thế này rất khó đọc cho user. có cách nào tóm tắt mà vẫn ko thiếu dữ kiện ko? vẫn đầy đủ ý chính ấy". SHOW-1 made the intent and approach yes show the ticket verbatim, never summarised, because a summary the orchestrator writes can drop or soften a clause while `accord approve` hashes the file; SHOW-1 D-07 widened the approach yes to every approved section. Most of the bulk is repetition: in ST-LN-5 all four scenarios repeat one long Given and three repeat one When. Proposal to confirm at intent: `accord show` prints a deterministic compact view (a Given or When shared by the scenarios printed once, each scenario reduced to its title and its Then/And lines, verbatim), the agent adds one plain-language line under each scenario, the full file stays what `accord approve` hashes, and the intent and approach skills show that view instead of the raw file. Owner, on making this its own ticket rather than part of ST-LN-5: "A".

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
