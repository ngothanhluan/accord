---
id: "ST-LN-30"                            # equals the file name: tickets/<id>.md
title: "Work starts from the latest main: a new ticket branch is cut after a fetch, and a ticket branch behind main is noticed"
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
Why: Pick up and `new ticket --worktree` cut the branch from `origin/main` as last fetched, and nothing merges main back before verify, so a ticket can be built and verified on code that is no longer what it will merge into. Owner: "trước khi bắt đầu làm ticket nào đó phải đảm bảm là code luôn latest."
For whom: whoever picks up, creates, continues or verifies a lane M ticket through `/accord`, alone or on a team.
Success: a new ticket branch starts at the remote's latest default branch; verify runs on the ticket merged with the latest default branch; Continue says when the branch has fallen behind.
Not this ticket: no rebase; no merge before review has ended; no second review after the merge; a failed fetch never blocks; the dashboard (ST-LN-16), lane S and the main checkout are left alone.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-30

  @ac-1
  Scenario Outline: A new ticket branch starts at the remote's latest default branch
    Given the remote's default branch, the one accord resolves today (origin/HEAD, else main, else master), has a commit this clone has not fetched
    When I run "<command>"
    Then the ticket branch starts at that commit

    Examples:
      | command                                   |
      | accord worktree open <id>                 |
      | accord new ticket <id> --lane M --worktree |

  @ac-2
  Scenario: Continue says when the ticket branch is behind the default branch
    Given a claimed ticket whose branch lacks 2 commits that are on the remote's default branch, not yet fetched
    When I run "accord worktree open <id> --continue"
    Then it prints that the branch is 2 commits behind the default branch and names the command that merges it, such as "git merge origin/main"
    And the ticket branch is unchanged

  @ac-3
  Scenario: Verify runs on the ticket merged with the latest default branch
    Given a ticket whose review.md ends with a verdict and whose branch lacks a commit on the remote's default branch
    When the verify stage of /accord starts
    Then the ticket branch gains a merge commit whose parents are its previous head and that commit, with no rebase
    And the full test suite and the verification run on that merge commit

  @ac-4
  Scenario: A merge conflict leaves the branch as it was and stops verify
    Given a ticket whose review.md ends with a verdict, and the ticket branch and the remote's default branch change the same line of one file
    When the verify stage of /accord starts
    Then the merge is aborted, and the branch head and the working tree are as they were before it
    And the conflicting file is named, and verify stops; nothing is stored, and the next start of verify tries the merge again

  @ac-5
  Scenario: A failed fetch is reported and the work goes on
    Given the remote cannot be reached
    When I pick up a ticket, create a lane M ticket with --worktree, continue a ticket, or start its verify
    Then one line says the fetch failed
    And the work goes on with the refs already in the clone
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The ticket stays lane M with three parts: Pick up and `new ticket --worktree` fetch origin before cutting the branch; Continue says when the ticket branch is behind the default branch; the dashboard (ST-LN-16) is left alone, and so was the merge before verify (ST-LN-11) until D-05 moved it here. Lane S fetching and the main checkout's staleness are out of scope — "A." (to the options: A keep M with parts 1, 2, 5; B split part 1 off as lane S; C drop the ticket and do it all as lane S)
- D-02 Continue fetches origin first, with the same prompt-off fetch as Pick up, then compares; when the ticket branch is behind it prints one line with the count and `git merge origin/main`; a failed fetch prints one line and the comparison uses the refs already in the clone — "A" (to the options: A fetch first, then compare; B compare against the refs already in the clone, no network)
- D-03 On a merge conflict the merge is aborted so the branch is as it was, the conflicting files are listed, and the work stops until the conflict is resolved by the owner, or by the session when the owner says so — "A" (to the options: A abort, list the files and stop; B the session resolves the conflict itself and goes on)
- D-04 `origin/main` is merged into the ticket branch once, after review and before verify (a merge commit, never a rebase), so verify runs on the merged result and review is not repeated; Pick up starts from the latest main, and Continue during any earlier stage fetches and reports a branch behind without merging — "tôi nghĩ là B." (after the corrections of 2026-10-21 and the trade-offs; to the options: A merge at the end of every stage; B merge once, after review and before verify)
- D-05 This ticket owns the merge before verify; the matching line leaves ST-LN-11's queued notes, which keep `tests.full`, the two-job CI matrix and the Node floor — "A" (to the options: A this ticket does the merge before verify and ST-LN-11 drops it; B the merge stays with ST-LN-11)
- D-06 A failed fetch, at Pick up, `new ticket --worktree`, Continue or before verify, prints one line and the work goes on with the refs already in the clone — "A" (to the options: A one line and go on everywhere; B stop verify until a fetch succeeds; C stop everywhere)
- D-07 The smallest version that still counts as done is the fetch before a new branch, the merge before verify and the conflict stop; the Continue notice could go — "đồng ý" (to the proposal: parts 1, 3 and 4 are the core, part 2 only tells the owner mid-ticket)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-21, to the question "when Continue says the ticket branch is behind main, does the session show the line and carry on (A), or stop and ask whether to merge now (B)?": "ko dc. trước khi bắt đầu làm ticket nào đó phải đảm bảm là code luôn latest."
- 2026-10-21, to the question "a merge after review or verify has finished: A merge at every stage, then a fresh reviewer and verify again; B merge at every stage, keep the review, verify again; C merge only before review, ST-LN-11 merges before verify": "tôi nghĩ là ko cần làm vậy. merge ở cuối stage là dc."
- 2026-10-21, after answering "B" (merge once, after review and before verify) to "A merge at the end of every stage; B merge once, after review and before verify": "khoang đã tôi nghĩ là A, nhưng cái này có trade off gì?"

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
