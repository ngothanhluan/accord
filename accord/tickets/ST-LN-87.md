---
id: "ST-LN-87"                            # equals the file name: tickets/<id>.md
title: "Merged branches made outside a ticket are cleaned with their worktrees"
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
Why: `accord worktree clean` handles only ticket branches. Merged `backlog/`, `fix/` and `release/` branches and Claude Code agent worktrees (`.claude/worktrees/agent-*`, e.g. one on `backlog/split-worktree-test-2026-10-30`, removed by hand on 2026-11-01) stay until someone removes them by hand. Split from ST-LN-55 (its D-01 E, D-10); this was its ac-4.
For: everyone working through accord, on Windows and POSIX.
Success: a merged non-ticket branch and its worktree are gone after the next clean; a branch with work the default branch lacks is never touched.
Not: ticket branches (ST-LN-55 cleans them); the benchmark's run worktrees (ST-LN-88).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-87

  @ac-1
  Scenario: Clean removes a merged branch made outside a ticket, with its worktree, and keeps unmerged ones
    Given a branch named "backlog/x", "fix/x" or "release/x" that has a commit of its own, every commit of it is on the default branch, and its worktree has no uncommitted work
    And a branch named "backlog/y" with a commit the default branch lacks, and a branch named "backlog/z" with no commit of its own
    When accord worktree clean runs
    Then the merged branch, local and on origin, and its worktree folder no longer exist, wherever that folder was
    And "backlog/y" and "backlog/z" and their worktrees still exist
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [ ] What counts as "merged": fast-forward merges and agent branches merged locally must count; the "second parent of a merge on the first-parent chain" test misses them, and first-parent membership misreads a branch created at another branch's tip (ST-LN-55 approach critique, round 2).
- [ ] Are the local and origin tips judged separately, so a teammate's later commit on origin is never deleted?
- [ ] Which liveness guard covers non-ticket worktrees? Holds are keyed by ticket id; path holds in the same file break worksTicket and the prompt-expansion hook.
- [ ] Is any name the ticket branch templates recognise skipped (`branch: "fix/{id}"` is allowed)?
- [ ] Do `release/` branches belong, since they are often long-lived?

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
