---
id: "ST-LN-95"                            # equals the file name: tickets/<id>.md
title: "Workflow metrics are measured the same way on every release, so a workflow change is judged against a baseline"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
research: ["accord/research/2026-11-03-backlog-review.md"]
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
Queued 2026-11-03, not approved; the intent interview replaces this:
- Why: the figures that drive ST-LN-91 (rounds per stage, findings per round, weighted tokens and minutes per critic run) were measured once, by a script left in a session scratchpad (accord/research/2026-11-02-critic-loop-practice.md section 1: `bk46/scripts/count.mjs`), so no one can show whether ST-LN-91, ST-LN-56 or ST-LN-93 lowered them.
- Proposal to confirm at intent: a repo-internal script (beside scripts/benchmark.mjs) reads every `approach-review.md`, `plan-review.md` and `review.md` and, where transcripts exist, their critic and planner runs, and writes a dated report of rounds, findings by round and severity, and weighted tokens; it is run on every release and before and after a workflow change.
- Not here: a shipped command (transcripts are Claude Code's format); a token budget per ticket (backlog-review M2).
- Research: `accord/research/2026-11-03-backlog-review.md` M7 (evidence, not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-95

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
