---
id: "ST-LN-90"                            # equals the file name: tickets/<id>.md
title: "Benchmark round 2 re-checks the planner's effort on opus, for the direction pass and the plan, or shows it needs a new architecture"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-46"]
research: ["accord/research/2026-11-02-benchmark-per-agent.md", "accord/research/2026-11-03-backlog-review.md"]
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
Queued 2026-11-02, not approved; the intent interview replaces this:
- Source: split from ST-LN-46 when round 2 went per agent. Owner, 2026-11-02 (translated): "Planner is certainly opus, only re-check the effort level, or a new architecture is needed." The intent queued before the split is in accord/research/2026-11-02-benchmark-per-agent.md.
- Question: the planner's effort on opus. Today opus high, as the shipped default (packages/core/src/skills/agents.ts:18, ST-LN-80 D-06) and in this repository (accord/config.yml; owner 2026-10-25 "High now", after ST-LN-44's first plan at medium took 5 Must and 14 Should). Round 1: no effort held all 5 samples (low 3, medium 4, high 3); the queued plan was medium, high and xhigh, since high cost about the same as medium (2.2 against 2.3 median minutes, similar tokens). Owner, 2026-10-23: "I wonder why the planner is only medium?", chose to measure before any change ("A").
- Since ST-LN-80 (done) the planner also drafts the Approach in a direction pass in place of the architect, so the samples cover the direction pass and the plan. Round 1's architect (opus high) held 2/5 at medium, 1/5 at high, 3/5 at xhigh with wrong facts at every effort, so effort was not the cause; the queued fix compares the current prompt with one that takes facts only from a scout report with file:line, which ST-LN-81's saved scout.md now provides. ST-LN-80 expected round 2 to measure tokens and plan rounds before and after its fold; that falls here.
- Scoring, from round 1's misses: three of five were `accord gate plan` failing on `gate.plan-deferral` for "later" used as an adjective, which the real plan stage fixes in one gate revision but the benchmark scores on the first write; report a gate failure on wording apart from Must found in the plan, judge each run more than once (high 3 and high 4 were judge noise as much as effort), and either say "later" is forbidden in every sense in the prompt or stop the rule matching "a later <noun>".
- Fix-round samples: ST-LN-48's plan took four critic rounds (round 2 Must: Task 11 put after review by applying round 1's fix word for word; round 3 Should 3.2 the same misorder), and ST-LN-44's first plan took 5 Must and 14 Should (`verify: check:` ids are not junit cases and `accord task-done` refuses them, packages/core/src/gate/task.ts:27-33; ac tests recorded before the run whose files they read; tasks reading executor reports nothing stores). Run them with and without a self-check line: check every step against the order of the build, review and verify skills; every `verify:` id is a junit case that passes when its task is recorded; tests read only committed files; `accord gate plan` could reject a `check:` id. Report which runs catch the findings.
- "Or a new architecture": a GSD-style planner prompt is tried only if the planner still misses after the effort arms; owner, 2026-10-25: "why does the planner keep getting sent back by the critic, when gsd-plan does very well?". Uses the harness of ST-LN-46. Not here: the critic's model or effort (no ticket until the owner discusses it).
- Backlog review 2026-11-03: proposed to wait for ST-LN-91, which changes what the planner writes, so the effort is not measured on a planner about to change (record F2).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-90

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
