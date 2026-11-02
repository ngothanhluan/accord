---
id: "ST-LN-92"                            # equals the file name: tickets/<id>.md
title: "Build runs the tasks of one wave in parallel and the waves in order"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-91"]
research: ["accord/research/2026-11-02-critic-loop-practice.md"]
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
- Owner, 2026-11-02 (translated): "the planner must make tasks splittable to run in parallel: tasks that must follow an order run in sequence, tasks that can run in parallel run in parallel."
- Builds take about 45 min per task (ST-LN-17: 7 tasks in 5 h; ST-LN-13: 10 tasks in 12.5 h); parallel tasks were rejected on 2026-10-14 on a wrong 5-10 min gain estimate, for four obstacles: a shared report path, the HEAD-based stale check of task-done, `dist` per worktree, and merge conflicts. The test run lock (ST-LN-67) and the wait for free memory (ST-LN-73) also serialise test runs, so parallel executors may only queue behind them.
- Shape: ST-LN-91's plan gives each task its dependencies and files, and the CLI groups tasks into waves (no dependency and no shared file inside a wave); accord-build dispatches a wave's executors at once, each isolated (its own worktree or another way the interview chooses), records each with task-done, merges them in task order, and starts the next wave only when the wave is done.
- Measure before and after: per-task time split into executor, test run, lock or memory wait, and session checks (offered 2026-10-31 as a draft, held by the owner until build time came up again); the gain is reported on a real ticket.
- Not here: parallel tickets (lane L waves); executor model choice (ST-LN-89).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-92

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
