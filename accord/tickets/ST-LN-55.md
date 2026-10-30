---
id: "ST-LN-55"                            # equals the file name: tickets/<id>.md
title: "Finished work leaves no worktree, branch or folder behind"
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
Why: finished work is never fully cleaned. On 2026-10-30, 23 folders of removed worktrees, each holding only npm's workspace links, sat in `C:\Work`, two of them printed `removed` that same day; 15 were deleted by hand on 2026-10-25, and round 1 left 75 benchmark worktrees until removed by hand. The owner: "I think there needs to be a mechanism that cleans up the workflow completely when a ticket is finished, or when /accord is used".
For: everyone working tickets through accord, on Windows and POSIX, and the author running the benchmark.
Success: once a ticket is done on the default branch, no worktree folder, recorded worktree, or branch of it is left after its own session sees the merge or after any next session starts, with nobody typing a cleanup command; a folder holding a real file is kept and named, never deleted.
Not: never removes uncommitted work, a real file, or a commit reachable from nothing else; `gate done` gets no worktree check (D-07); parts (5) and (6) of the queued note leave for their own tickets (D-02).
Evidence: the queued note of 2026-10-25 is in this file's git history; research `accord/research/2026-10-25-review-convergence.md` (not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-55

  @ac-1
  Scenario: Clean removes a done ticket's worktree completely, and keeps and names one whose leftover holds a real file
    Given two done tickets whose worktrees git still lists, neither with uncommitted work
    And the first worktree's folder will hold only links and empty folders once git removes it
    And the second worktree's folder will also hold a real file, an entry that is neither a link nor a folder
    When accord worktree clean runs
    Then the first folder no longer exists, and clean prints "removed" with its path
    And the second folder and its real file still exist, and clean prints a line naming that folder and that file, and no "removed" line for it

  @ac-2
  Scenario: The session that worked a ticket cleans its own worktree once the ticket is done
    Given a session holds a ticket's worktree and has left it
    And the ticket's pull request is merged, so the ticket's file on origin's default branch says it is done
    When that session runs the cleanup its finish step names
    Then the ticket's worktree folder, its local branch and its branch on origin no longer exist
    And no hold on the ticket remains

  @ac-3
  Scenario: A session start cleans a done ticket's recorded worktree that git has forgotten
    Given accord recorded a worktree for a ticket when it created it
    And the ticket is done on the default branch, git no longer lists that worktree, and its folder holds only links and empty folders
    When a session starts, resumes or is cleared, in the main checkout or in any worktree of the repository
    Then that folder no longer exists, and the record no longer lists it

  @ac-4
  Scenario: Merged branches made outside a ticket are cleaned with their worktrees
    Given a branch named "backlog/x", "fix/x" or "release/x" that has a commit of its own, every commit of it is on the default branch, and its worktree has no uncommitted work
    And a branch named "backlog/y" with a commit the default branch lacks, and a branch named "backlog/z" with no commit of its own
    When accord worktree clean runs
    Then the merged branch, local and on origin, and its worktree folder no longer exist, wherever that folder was
    And "backlog/y" and "backlog/z" and their worktrees still exist

  @ac-5
  Scenario: The benchmark cleans its run worktrees once the round report is written
    Given a benchmark round whose run worktrees and "bench/" branches exist
    When the benchmark writes the round report
    Then no run worktree and no "bench/" branch remains, and no folder a run worktree left holds only links and empty folders
    And every run's commits are still reachable under "refs/keep/", and the benchmark's data folder is untouched
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The ticket covers: (A) clean really removes a worktree folder, deleting a leftover that holds only links and printing `removed` only once the folder is gone; (B) a done ticket's worktree and branch are cleaned right away; (C) `/accord` cleans everything finished, including old leftover folders git no longer knows; (D) each worktree is recorded when created and `gate done` fails while one is left; (E) merged non-ticket branches and agent worktrees (`backlog/`, `fix/`, `release/`, `.claude/worktrees/agent-*`) are cleaned too — owner, 2026-10-30: "I think there needs to be a mechanism that cleans up the workflow completely when a ticket is finished, or when /accord is used", then "ok, go with the proposal"
- D-03 A done ticket is cleaned at two moments: the session that worked it waits for its pull request to merge, then leaves the worktree and cleans it; and every session that starts runs the clean, whatever folder it opens in — owner, 2026-10-30: "ooA" (option a: both moments)
- D-04 A leftover folder is deleted only when it holds no real file, only links and empty folders; one holding a real file is kept, and clean prints a line naming the folder and the file — owner, 2026-10-30: "A"
- D-05 Part (1) stays in this ticket: the benchmark runs its clean right after it writes the round report, and accord's clean also recognises the benchmark's `bench/*` worktrees — owner, 2026-10-30: "A"
- D-06 The smallest version that still counts as done is (A) + (B) + (C); (D), (E) and part (1) may move to a later ticket if the plan shows the ticket is too big — owner, 2026-10-30: "go with the proposal"
- D-07 Part (D) means: each worktree accord creates (ticket or benchmark) is recorded when created, and clean, at session start and at `/accord`, checks that record and removes any entry of a done or dropped ticket still on disk, printing the ones it cannot; `gate done` gets no worktree check, because it runs before the pull request merges, while the ticket's worktree is still needed — owner, 2026-10-30: "A"
- D-02 Parts (5) `verify/ci.md` reading a merged pull request and (6) the no-Vietnamese test's gap leave this ticket for tickets of their own — owner, 2026-10-30: "ok, go with the proposal"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] Part (1), the benchmark removing its run worktrees after the round report: in this ticket or its own?
- [x] What starts the cleanup of a done ticket, given that it is done on the default branch only once its pull request is merged?

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
