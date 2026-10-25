---
id: "ST-LN-59"                            # equals the file name: tickets/<id>.md
title: "The executor shows its test fails for the expected reason and re-reads its own diff before it reports done"
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
Queued 2026-10-25, not approved; the intent interview replaces this:
- Why (owner, 2026-10-25, to the main session's recommendation after auditing the superpowers and ponytail plugins against accord and Anthropic's skill authoring guide: "agreed. remember to save the research and have the related tickets reference it.").
- Today `accord-executor` shows its first test failing, but not why it fails: a test that fails on a typo or a missing import counts as red. It never re-reads its own diff before `DONE`, and warnings in its test output pass unremarked. Of 129 late review findings, 83 (64%) were caused by the previous fix (`accord/research/2026-10-25-review-convergence.md`).
- Queued intent, from superpowers 7.0.0 (`implementer-prompt.md` self-review, `test-driven-development` "Verify RED"): (1) the failing output the executor reports names the missing behaviour, not an error in the test itself; (2) before `DONE` the executor reads its diff against the brief (missing, extra, misread) and fixes what it finds; (3) a warning or stray output in the test run it reports is listed as a concern.
- Related: ST-LN-56 changes how the executor fixes findings; this one changes how it checks its own work, on first builds and fixes alike.
- Research: `accord/research/2026-10-25-plugin-audit.md` (evidence, not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-59

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
