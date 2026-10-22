---
id: "ST-LN-40"                            # equals the file name: tickets/<id>.md
title: "A team on an existing codebase gets a draft of its conventions from the code"
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
Queued 2026-10-22, not approved; the intent interview replaces this:
- Audit item 4: "Thêm lệnh tự rút convention từ code có sẵn (giống /discover-standards của Agent OS), để team đang làm dự án cũ bắt đầu dùng được ngay." Owner, 2026-10-22, to the proposal in chat: "ok queue hết di".
- Today `accord/product/conventions.md` is written by hand; nothing drafts it, and the executor brief carries it (ST-LN-8).
- Proposal to confirm at intent: a skill step, not a CLI command, since accord never calls a model. Agents read the code and draft each convention with its evidence (file and line, how many places follow it, the counterexamples); the owner accepts or rejects line by line, and nothing is written without a yes.
- Risk: an accidental pattern in old code becomes a rule; the counterexamples are what let the owner see it.
- To settle at intent: where it runs (`accord init`, `/accord` when the file is missing, or its own action); whether it also drafts `business-rules.md` and `glossary.md`.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-40

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
