---
id: "ST-LN-93"                            # equals the file name: tickets/<id>.md
title: "A plan stays within the size its intent expects, and a measurement runs its smallest experiment first"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
research: ["accord/research/2026-11-03-backlog-review.md"]
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
Queued 2026-11-03, not approved; the intent interview replaces this:
- Source: owner, ST-LN-46 Corrections, 2026-11-02 (translated): "good grief, my friend. it's only running a benchmark, isn't it? the same prompt run on 2 models at 3 different efforts, that's all?" then "the problem is how to stop you over-engineering like this? you have done this many times." No ticket or rule addresses it today; the approach skill says "lightest first" (packages/core/skills/approach/SKILL.md:9, :19), which is recall, not a check.
- Proposal to confirm at intent: the Intent records an expected size (tasks, or changed lines); `accord gate plan` refuses a plan over a set multiple of it unless the owner says yes, recorded as a Ruling; every plan task names the criterion it serves, and a task that serves none is refused; a ticket that measures something runs one arm on one sample first and shows the owner before widening.
- Related: ST-LN-91 (its plan checker could carry the per-task criterion rule), ST-LN-84 (the Correction as a conventions line), ST-LN-28 (when a ticket is too big for lane M).
- Research: `accord/research/2026-11-03-backlog-review.md` M1 (evidence, not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-93

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
