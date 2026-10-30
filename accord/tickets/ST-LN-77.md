---
id: "ST-LN-77"                            # equals the file name: tickets/<id>.md
title: "The benchmark cleans its run worktrees once the round report is written"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-55"]
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
Queued 2026-10-30, not approved; the intent interview replaces this:
- Why: benchmark round 1 left 75 run worktrees and `bench/*` branches until removed by hand; `node scripts/benchmark.mjs --clean` exists but nothing runs it.
- Queued intent: once the benchmark writes a round report, no run worktree, `bench/` branch or link-only leftover folder remains, while every run's commits stay reachable under `refs/keep/` and the benchmark's data folder is untouched.
- Split from ST-LN-55 part (1) (its D-05, replaced by its D-10, owner "A", 2026-10-30), taking its former ac-5 below.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-77

  @ac-1
  Scenario: The round report leaves no run worktree behind
    Given a benchmark round whose run worktrees and "bench/" branches exist
    When the benchmark writes the round report
    Then no run worktree and no "bench/" branch remains, and no folder a run worktree left holds only links and empty folders
    And every run's commits are still reachable under "refs/keep/", and the benchmark's data folder is untouched
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [ ] The owner chooses: re-judging and rewriting the report read the run worktrees (scripts/benchmark.mjs ~:961, :1043, :1049), so an automatic clean right after the report ends re-judging; or the clean runs only on the owner's word.
- [ ] Overlay samples leave uncommitted files on purpose (scripts/benchmark.mjs ~:639, :715-719): snapshot the working tree, untracked files included, into a commit under `refs/keep/` before removal.
- [ ] `--force` removal loses uncommitted edits; detached-HEAD rows need their HEAD kept, not only branch tips.
- [ ] Ignored files (e.g. `*.log`) follow ST-LN-55's D-08 list.
- [ ] Branch deletes use `git update-ref -d` with the sha it checked, not `git branch -D` (accord/product/conventions.md).

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
