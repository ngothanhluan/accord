---
id: "ST-LN-70"                            # equals the file name: tickets/<id>.md
title: "A change to a skill's wording runs against a benchmark baseline before it merges"
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
Queued 2026-10-29, not approved; the intent interview replaces this:
- Why (owner, 2026-10-29): "a change to a skill's wording runs against a benchmark baseline before it merges".
- Today a benchmark exists (`scripts/benchmark.mjs`, round 1 reported in `docs/benchmark/round-1.md`, from ST-LN-46), but nothing requires a change to a skill's or agent's wording under `packages/core/skills` or `packages/core/agents` to run against it, so a wording change can merge with no measured effect on how agents behave.
- Queued intent: a ticket that changes a skill's or agent's wording records a benchmark run of the changed wording against a baseline before it merges, and the owner sees the comparison in the verify report.
- Anthropic's skill authoring guide asks for evaluations with a baseline, tested on each model used. Research: `accord/research/2026-10-25-plugin-audit.md` §2 (the "Evaluations with a baseline, tested on each model used" row; evidence, not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-70

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
