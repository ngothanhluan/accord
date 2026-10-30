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
approved_hash: "fnv1a64:cdf3643d972ba15b"
ac_hash: "fnv1a64:76abdb527fec9764"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: finished work is never fully cleaned. On 2026-10-30, 23 folders of removed worktrees, each holding only npm's workspace links, sat in `C:\Work`, two of them printed `removed` that same day; 15 were deleted by hand on 2026-10-25, and round 1 left 75 benchmark worktrees until removed by hand. The owner: "I think there needs to be a mechanism that cleans up the workflow completely when a ticket is finished, or when /accord is used".
For: everyone working tickets through accord, on Windows and POSIX.
Success: once a ticket is done on the default branch, no worktree folder, recorded worktree, or branch of it is left after the next session starts, resumes or is cleared (once no live session holds it), with nobody typing a cleanup command; a folder holding a real file is kept and named, never deleted.
Not: never removes uncommitted work, a real file, or a commit reachable from nothing else; `gate done` gets no worktree check (D-07); parts (5) and (6) of the queued note leave for their own tickets (D-02), and so do merged non-ticket branches and the benchmark's own clean (D-10).
Evidence: the queued note of 2026-10-25 is in this file's git history; research `accord/research/2026-10-25-review-convergence.md` (not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-55

  @ac-1
  Scenario: Clean removes a done ticket's worktree completely, and keeps and names one that holds a file it may not delete
    Given two tickets that accord reads as done on origin's default branch, whose worktrees git still lists, neither with uncommitted work
    And the first worktree holds, besides its tracked files, only npm's workspace links and ignored paths that have a name from the config list ("node_modules", "dist", ".DS_Store", "Thumbs.db") as a path segment
    And the second worktree also holds an ignored file ".env", whose path has no name from that list
    When accord worktree clean runs
    Then the first folder no longer exists, and clean prints "removed" with its path
    And git still lists the second worktree, its folder and ".env" are unchanged, and clean prints a line naming that folder and ".env", and no "removed" line for it

  @ac-2
  Scenario: The next session start cleans a done ticket's worktree and branches, unless a live session holds it
    Given a ticket's pull request is merged, so that after a fetch accord reads the ticket as done on origin's default branch
    And its worktree, its local branch and its branch on origin still exist, and the session that held the worktree has ended
    And another done ticket's worktree is held by a session that still runs
    When a session starts, resumes or is cleared, in the main checkout or in a worktree other than those two
    Then the first ticket's worktree folder, its local branch, its branch on origin and its hold no longer exist, and that session shows the "removed" line
    And the second ticket's worktree still exists

  @ac-3
  Scenario: A session start cleans a done ticket's recorded worktree that git has forgotten
    Given accord recorded a worktree for a ticket when it created it
    And accord reads the ticket as done on origin's default branch, git no longer lists that worktree, and its folder holds only links and empty folders
    When a session starts, resumes or is cleared, in the main checkout or in any worktree of the repository
    Then that folder no longer exists, and the record no longer lists it
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The ticket covers: (A) clean really removes a worktree folder, deleting a leftover that holds only links and printing `removed` only once the folder is gone; (B) a done ticket's worktree and branch are cleaned right away; (C) `/accord` cleans everything finished, including old leftover folders git no longer knows; (D) each worktree is recorded when created and `gate done` fails while one is left (narrowed by D-07: no `gate done` check); (E) merged non-ticket branches and agent worktrees (`backlog/`, `fix/`, `release/`, `.claude/worktrees/agent-*`) are cleaned too — owner, 2026-10-30: "I think there needs to be a mechanism that cleans up the workflow completely when a ticket is finished, or when /accord is used", then "ok, go with the proposal"
- D-03 A done ticket is cleaned at two moments: the session that worked it waits for its pull request to merge, then leaves the worktree and cleans it; and every session that starts runs the clean, whatever folder it opens in — owner, 2026-10-30: "ooA" (option a: both moments)
- D-04 A leftover folder is deleted only when it holds no real file, only links and empty folders; one holding a real file is kept, and clean prints a line naming the folder and the file — owner, 2026-10-30: "A"
- D-05 Part (1) stays in this ticket: the benchmark runs its clean right after it writes the round report, and accord's clean also recognises the benchmark's `bench/*` worktrees — owner, 2026-10-30: "A"
- D-06 The smallest version that still counts as done is (A) + (B) + (C); (D), (E) and part (1) may move to a later ticket if the plan shows the ticket is too big — owner, 2026-10-30: "go with the proposal"
- D-07 Part (D) means: each worktree accord creates (ticket or benchmark; the benchmark part moves out with D-10) is recorded when created, and clean, at session start and at `/accord`, checks that record and removes any entry of a done or dropped ticket still on disk, printing the ones it cannot; `gate done` gets no worktree check, because it runs before the pull request merges, while the ticket's worktree is still needed — owner, 2026-10-30: "A"
- D-08 A file git ignores counts as a real file unless it sits in a folder named in a list in `config.yml`, by default `node_modules` and `dist`; a worktree holding any other ignored file is kept, and clean names the file — owner, 2026-10-30: "a" (asked after the approach critic showed `git worktree remove` deletes every ignored file before clean looks)
- D-09 No new flag: clean removes a worktree this session holds once its ticket is done on the default branch and the session no longer runs inside it; before done, the session's own held worktree is kept as today — owner, 2026-10-30: "a"
- D-10 The ticket keeps (A), (B), (C) and (D); (E) merged non-ticket branches and agent worktrees, and part (1) the benchmark's own clean (D-05), move to two new draft tickets, taking former ac-4 and ac-5 with them; this narrows D-01 and replaces D-05 — owner, 2026-10-30: "A" (asked after the second approach critique found seven Must findings, most in (E) and the benchmark)
- D-11 No session waits for a merge: a done ticket is cleaned at the next session start, resume or /clear in any folder of the repository, by a clean the hook runs in the foreground with a hook timeout long enough not to cut a removal short, and at `/accord`; its result shows in that session; a worktree a live session still holds is kept until that session ends. This replaces D-03's first moment and D-09 — owner, 2026-10-30: "a" (asked after the third approach critique found four Must findings, all in the merge wait and the background clean)
- D-12 The D-08 list holds file and folder names matched at any depth, and its default adds `.DS_Store` and `Thumbs.db`; `.claude/settings.local.json` is not in the default, so a worktree holding it is kept and the file named — owner, 2026-10-30: "a"
- D-02 Parts (5) `verify/ci.md` reading a merged pull request and (6) the no-Vietnamese test's gap leave this ticket for tickets of their own — owner, 2026-10-30: "ok, go with the proposal"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] Part (1), the benchmark removing its run worktrees after the round report: in this ticket or its own?
- [x] What starts the cleanup of a done ticket, given that it is done on the default branch only once its pull request is merged?

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: extend `accord worktree clean` in place, and have the session-start hook (startup, resume, clear) run it in the foreground after its usual output. Removal never uses `--force`. It checks ignored files against the `disposable:` list in config.yml (default `node_modules`, `dist`, `.DS_Store`, `Thumbs.db`), matching any segment of the path relative to the worktree root. After git unregisters a folder, clean deletes only links, files with a disposable segment, and then empty folders, bottom-up. It prints `removed` only once the folder is gone, and otherwise a `kept <folder>: <file>` line. Each worktree accord creates is recorded in `<git-common-dir>/accord/worktrees`, under the holds lock. This is the lightest option that covers ac-1 to ac-3, and it is the clean that `/accord` already runs.
Rejected: a session that waits for its merge and a background clean (critique round 3: four Musts; replaced by D-11); a `--left` flag (D-09, then D-11); a `gate done` worktree check (D-07).
Affected: `packages/cli/src/commands/worktree.ts` (removeWorktree, passGuards, cleanDone, cleanDropped, the record at the three creation sites); `hook.ts` (clean after session-start and session-resume output); `packages/core/src/scaffold/hooks.ts` (`timeout: 600` on both entries); `config.schema.json` and the config types (`disposable:`); skills `shared/finish.md` and `accord/worktree.md`, then `npm run gen`, build and skills sync; tests.
Risks. Critique round 4 found five Musts, each fixed in this option:
- (1) A detached-HEAD worktree is removed only when its HEAD is on the default ref or is a branch tip.
- (2) The hold guard also keeps a folder that any live hold names, and clean removes by path only a detached worktree, never one on another branch.
- (3) In a folder git no longer lists, clean scans first, and deletes only when everything is a link or an empty folder; otherwise it changes nothing and prints a kept line.
- (4) The ignored-file check passes `--untracked-files=normal`.
- (5) The hook clean has a time budget below the hook timeout: it starts no new removal or push once the budget is spent, prints that the rest waits for the next start, and its deletion push gets the fetch limit.
Shoulds kept as fixes:
- The walk never enters a listed worktree, a `.git` holder, the main checkout or an ancestor of these.
- A clean lock: a second concurrent clean skips with one line.
- The hook adds "tell the owner the lines above".
- The sibling sweep reads ticket ids from origin's default ref.
Known limit: a worktree with initialised submodules is kept, because git refuses it without `--force`.
Data-deletion scenarios, and how each is undone:
- A. A detached commit is lost (fix 1). Undo: `git fsck --lost-found` before gc.
- B. An ignored `.env` is deleted under `status.showUntrackedFiles=no` (fix 4). Not undoable, so a risk test pins the fix.
- C. A forgotten folder's modified `dist/index.js` is deleted before a note is found (fix 3). Not undoable, so a risk test pins the fix.
Tests:
- ac-1: CLI integration, `runCli worktree clean` in a temp repo with a bare origin and real junctions on Windows.
- ac-2: hook test, `hook session-start` with stdin JSON, a merged ticket and a live-hold fixture.
- ac-3: hook test, with a record entry and a folder git forgot.
- Risk tests: detached HEAD, `-uno`, a nested worktree, a tracked `dist` file in a forgotten folder, the time budget.
