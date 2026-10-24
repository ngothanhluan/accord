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
approved_hash: "fnv1a64:7411261b310dbcf8"
ac_hash: "fnv1a64:b158d41854a33ce6"
verified_hash: "fnv1a64:b158d41854a33ce6"
verified_commit: "9febb6a779b4056bd5a1fec5e6b1b4240608c058"
verified: [ac-1, ac-2, ac-3, ac-4, ac-5]
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: Pick up and `new ticket --worktree` cut the branch from `origin/main` as last fetched, and nothing merges main back before verify, so a ticket can be built and verified on code that is no longer what it will merge into. Owner: "before starting work on any ticket, we must make sure the code is always the latest."
For whom: whoever picks up, creates, continues or verifies a lane M ticket through `/accord`, alone or on a team.
Success: a new ticket branch starts at the remote's latest default branch; verify runs on the ticket merged with the latest default branch; Continue says when the branch has fallen behind.
Not this ticket: no rebase; no merge before review has ended; no second review after the merge; a failed fetch never blocks; the dashboard (ST-LN-16), lane S and the main checkout are left alone.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-30

  @ac-1 @test:packages/cli/test/worktree.test.ts#ac-1-pick-up-and-a-new-worktree-ticket-cut-the-ticket-branch-from-a-main-commit-this-clone-had-not-fetched
  Scenario Outline: A new ticket branch starts at the remote's latest default branch
    Given the remote's default branch, the one accord resolves today (origin/HEAD, else main, else master), has a commit this clone has not fetched
    When I run "<command>"
    Then the ticket branch is cut from that commit: the first commit accord makes on it (the claim, or the new ticket file) has that commit as its parent

    Examples:
      | command                                   |
      | accord worktree open <id>                 |
      | accord new ticket <id> --lane M --worktree |

  @ac-2 @test:packages/cli/test/worktree.test.ts#ac-2-continue-says-the-ticket-branch-is-2-commits-behind-the-remote-main-and-leaves-the-branch-unchanged
  Scenario: Continue says when the ticket branch is behind the default branch
    Given a claimed ticket whose branch lacks 2 commits that are on the remote's default branch, not yet fetched
    When I run "accord worktree open <id> --continue"
    Then it prints that the branch is 2 commits behind the default branch and names the merge command built from the default branch accord resolved, "git merge origin/main" when that branch is main
    And the ticket branch is unchanged

  @ac-3 @test:packages/cli/test/worktree.test.ts#ac-3-worktree-merge-at-verify-gives-the-ticket-branch-a-merge-commit-of-its-head-and-the-fetched-main-commit
  Scenario: Verify runs on the ticket merged with the latest default branch
    Given a ticket whose review.md ends with a verdict and whose branch lacks a commit on the remote's default branch, not yet fetched
    When the verify stage of /accord starts
    Then the ticket branch gains a merge commit whose first parent is its previous head and whose second parent is that commit, with no rebase
    And the full test suite and the verification run on that merge commit

  @ac-4 @test:packages/cli/test/worktree.test.ts#ac-4-a-merge-conflict-is-aborted-names-the-file-exits-2-and-the-next-merge-tries-again
  Scenario: A merge conflict leaves the branch as it was and stops verify
    Given a ticket whose review.md ends with a verdict, and the ticket branch and the remote's default branch change the same line of one file
    When the verify stage of /accord starts
    Then the merge is aborted, and the branch head and the working tree are as they were before it
    And the conflicting file is named, and verify stops
    And no merge commit and no merge in progress are left, nothing marks verify as blocked, and the next start of verify tries the merge again

  @ac-5 @test:packages/cli/test/worktree.test.ts#ac-5-a-failed-or-silent-fetch-is-one-accord-line-at-pick-up-new-ticket-continue-and-merge-and-the-work-goes-on
  Scenario: A failed fetch is reported and the work goes on
    Given the remote cannot be reached, or does not answer within the fetch's time limit
    When I pick up a ticket, create a lane M ticket with --worktree, continue a ticket, or start its verify
    Then exactly one line, accord's own, says the fetch failed and either quotes git's first error line, as `accord worktree clean` does today, or, when the time limit ran out, says the remote did not answer within that limit and names the limit in seconds
    And the work goes on with the refs already in the clone
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The ticket stays lane M with three parts: Pick up and `new ticket --worktree` fetch origin before cutting the branch; Continue says when the ticket branch is behind the default branch; the dashboard (ST-LN-16) is left alone, and so was the merge before verify (ST-LN-11) until D-05 moved it here. Lane S fetching and the main checkout's staleness are out of scope — "A." (to the options: A keep M with parts 1, 2, 5; B split part 1 off as lane S; C drop the ticket and do it all as lane S)
- D-02 Continue fetches origin first, with the same prompt-off fetch as Pick up, then compares; when the ticket branch is behind it prints one line with the count and `git merge origin/main`; a failed fetch prints one line and the comparison uses the refs already in the clone — "A" (to the options: A fetch first, then compare; B compare against the refs already in the clone, no network)
- D-03 On a merge conflict the merge is aborted so the branch is as it was, the conflicting files are listed, and the work stops until the conflict is resolved by the owner, or by the session when the owner says so — "A" (to the options: A abort, list the files and stop; B the session resolves the conflict itself and goes on)
- D-04 `origin/main` is merged into the ticket branch once, after review and before verify (a merge commit, never a rebase), so verify runs on the merged result and review is not repeated; Pick up starts from the latest main, and Continue during any earlier stage fetches and reports a branch behind without merging — "I think it is B." (after the corrections of 2026-10-21 and the trade-offs; to the options: A merge at the end of every stage; B merge once, after review and before verify)
- D-05 This ticket owns the merge before verify; the matching line leaves ST-LN-11's queued notes, which keep `tests.full`, the two-job CI matrix and the Node floor — "A" (to the options: A this ticket does the merge before verify and ST-LN-11 drops it; B the merge stays with ST-LN-11)
- D-06 A failed fetch, at Pick up, `new ticket --worktree`, Continue or before verify, prints one line and the work goes on with the refs already in the clone — "A" (to the options: A one line and go on everywhere; B stop verify until a fetch succeeds; C stop everywhere)
- D-07 The smallest version that still counts as done is the fetch before a new branch, the merge before verify and the conflict stop; the Continue notice could go — "agreed" (to the proposal: parts 1, 3 and 4 are the core, part 2 only tells the owner mid-ticket)
- D-08 The fetch has a time limit, about 30 seconds, the exact figure chosen at the approach; a fetch that runs past it counts as a failed fetch under D-06 — "A" (to the options: A a time limit, past it the fetch counts as failed; B no limit, wait for git's own error as `worktree clean` does today)
- D-09 The merge before verify is a new public command, `accord worktree merge <id>`, which the verify stage runs: it fetches, merges with a merge commit, refuses unless the ticket's stage is verify, and on a conflict aborts, names the files and exits 2 so the session shows the message and stops — "A" (to the options: A a new command the verify step calls; B fold the merge into `worktree open --continue` at the verify stage; C skill text only, the session runs git fetch and git merge itself)
- D-10 When the fetch runs past its time limit, git has printed no error line, so the one line says the remote did not answer within the limit, "no answer within 30 seconds"; ac-5 says so — "A" (to the options: A reword ac-5 to quote git's first error line or, past the limit, say there was no answer within it; B keep the wording and quote whatever git printed before it was stopped; C add git's own stall settings so git reports "too slow" itself)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-21, to the question "when Continue says the ticket branch is behind main, does the session show the line and carry on (A), or stop and ask whether to merge now (B)?": "not ok. before starting work on any ticket, we must make sure the code is always the latest."
- 2026-10-21, to the question "a merge after review or verify has finished: A merge at every stage, then a fresh reviewer and verify again; B merge at every stage, keep the review, verify again; C merge only before review, ST-LN-11 merges before verify": "I think there is no need to do that. merging at the end of a stage is fine."
- 2026-10-21, after answering "B" (merge once, after review and before verify) to "A merge at the end of every stage; B merge once, after review and before verify": "wait, I think it is A, but what trade off does this have?"

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: one fetch helper in `packages/cli/src/commands/worktree.ts` wraps the prompt-off fetch with a 30 s `execFileSync` timeout (D-08) and prints accord's one line on failure (D-06, D-10). Pick up and `new ticket --worktree` call it before any ref or the snapshot is read, then cut the branch from the resolved default ref; Continue calls it, then prints the behind count and `git merge <ref>` without touching the branch (D-02). A new `accord worktree merge <id>` (D-09) refuses outside the ticket's branch, on tracked changes, or unless the stage is verify, then fetches and runs `git merge --no-ff --no-edit --no-overwrite-ignore`; on failure it names the conflicted files, aborts when MERGE_HEAD exists, and exits 2 (D-03). Verify step 2 runs it after its commit and before `tests.full`. Why: the only option where every criterion has an in-process test and the tool, not the session, holds "merge only after review" (D-04).
Rejected: the same without the stage guard, since D-04 would rest on the session's memory; adding git's low-speed settings, since they bound neither a hung connect nor ssh, so the timer stays; folding the merge into Continue (D-09 B), since verify usually starts from review without a Continue; skill text only (D-09 C), since it cannot print accord's line, enforce the limit, or be tested in-process.
Affected: `worktree.ts` (fetch helper, `worktreeOpen`, `newTicketWorktree`, new `worktreeMerge`); a small module holding the limit; `run.ts` registers the subcommand; `skills/verify/SKILL.md` step 2 and `skills/accord/worktree.md` (the fetch-failed and behind lines, shown verbatim, work goes on) with the generated copies; `README.md` and `packages/cli/README.md`. `worktree clean`, `gitDefaultRef`, `gate done` and `gate plan` stay as they are: the merge keeps the baseline on its first parent and verify ticks the merge commit.
Risks, from the critic and the architect, each settled by a Ruling in the ledger:
- Should: on Windows a kill at 30 s can leave a stale ref lock, after which every fetch fails with one line; the timeout test must prove on windows-latest that the call returns on time.
- Should: a slow fetch still downloading at 30 s counts as failed, as D-08 chose.
- Should: after the merge, `review-package` without `--base` lists main's merged files as undeclared; only a fix after verify that goes back through review sees it, so it goes to a follow-up ticket.
- Should (settled): fetching after the claim check could let two people claim one ticket; an ignored local file could be overwritten; a non-conflict merge failure could be reported as a conflict; a changed version pin could stop verify silently; the limit could not be mocked inside its own module; `worktree clean` keeps no limit.
- Nice: an offline `/accord` can wait on two fetches, the second at most 30 s; existing exact-output tests of `--continue` gain the behind line and must be updated.
Tests: ac-1 to ac-5 are in-process `run()` tests against real git in `packages/cli/test/worktree.test.ts`, with a second clone pushing commits this clone has not fetched; ac-1 covers both Examples rows; ac-5 covers an unreachable remote at each of the four points and a hanging remote under a mocked short limit. That the suite and the verification run on the merge commit is the order of verify step 2, held by a `risk:regression` text test in `packages/core/test/stage-skills.test.ts`.
