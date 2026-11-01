---
id: "ST-LN-88"                            # equals the file name: tickets/<id>.md
title: "The benchmark cleans its run worktrees once the round report is written"
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
Why: benchmark round 1 left 75 run worktrees and `bench/*` branches until they were removed by hand; `node scripts/benchmark.mjs --clean` exists but nothing runs it. Split from ST-LN-55 (its D-05, D-10); this was its ac-5.
For: whoever runs the accord benchmark.
Success: once a round report is written, no run worktree or `bench/` branch is left, and every run's commits stay reachable.
Not: ticket worktrees (ST-LN-55) or other non-ticket branches (ST-LN-87).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-88

  @ac-1
  Scenario: The benchmark removes its run worktrees and branches after the round report and keeps their commits
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
- [ ] Clean right after the report, or only on the owner's word? Re-judging and rewriting the report read the run worktrees (benchmark.mjs ~:961, :1043, :1049), so an automatic clean ends re-judging.
- [ ] Overlay samples leave uncommitted files on purpose (benchmark.mjs ~:639, :715-719): snapshot the working tree, untracked files included, into a commit under refs/keep before removal?
- [ ] `--force` removal loses uncommitted edits, and detached-HEAD rows need their HEAD kept, not only branch tips.
- [ ] Do ignored files (e.g. `*.log`) follow ST-LN-55's `disposable:` list?
- [ ] Branches are deleted with `update-ref -d <checked sha>`, never `git branch -D` (conventions.md).

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
