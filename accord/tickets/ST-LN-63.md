---
id: "ST-LN-63"                            # equals the file name: tickets/<id>.md
title: "Each accord command starts as few git processes as it needs"
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
approved_hash: "fnv1a64:cdce944d465504a0"
ac_hash: "fnv1a64:77be5312b7078294"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: every accord command starts 135-151 git processes and takes about 20 s in this repository (GIT_TRACE2_EVENT, 2026-10-25: `status` 150 / 21 s, `anchor` 137 / 19.5 s, `lint` 135 / 21 s, `dashboard` 151 / 21 s, `show` 150 / 23 s); 128 of `status`'s 150 compute plan-baseline ancestry, baseline files and paths changed since each recorded commit for every ticket (`loadParts`, packages/cli/src/load/fs.ts), which only `gate plan` and `gate done` read, for the gated ticket only (core gate/plan.ts, gate/done.ts); queued by ST-LN-44 D-11 ("queued together as their own ticket"), the architect's sizing and risk tests are in ST-LN-44's session record and ledger.
For: everyone who runs accord, by hand or through an agent, and every full test run. Part 1: compute that history only in `gate plan` / `gate done`, for the gated ticket. Part 2: one-process default ref, claim tips from the existing listing, HEAD author folded into the existing `cat-file`, one `--merged` query in clean instead of a merge-base per branch, the duplicate `currentBranch` / `reviewCommit` / `get-url` / `worktree list` / ssh-config calls, and a light preflight before the fetch in pick-up and `new ticket --worktree`. Part 4, cut on the command side or the test side as ST-LN-44 did: packages/cli/test/branch-fact.test.ts "risk:complex-branching gate done reads the branch diff from the merge base ignoring whitespace and pins the scope at the first commit that records ac_hash" (51.2 s) and "risk:parsing gate done reads added call lines and package json maps from the branch diff" (32.3 s), packages/cli/test/lane-s.test.ts "risk:complex-branching the review package lists the out-of-scope files and interface signs gate done would name" (22.8 s), all three from ST-LN-44's merged full run, a loaded run about 1.35 times slower than its measuring run ("ok", 2026-10-27), and packages/cli/test/upgrade.test.ts "ac-2 upgrade replaces only the lint and gate step and keeps every other line of the workflow" (107.8 s, failed the cli's 90 s limit at packages/cli/vitest.config.ts:8 in BUG-LN-13's baseline run at 85b3158, one run only, "A", 2026-10-28).
Success: the read commands start as many git processes with 20 tickets as with 1, apart from at most two per ticket with a merge on its branch (D-02, D-08, D-10, D-11); the worktree commands start fewer than today (D-05); goldens recorded first match byte for byte (D-04); the four Part 4 tests are under 10 s or kept (D-03); nothing deferred (D-06).
Not: the benchmark sample filter in scripts/benchmark.mjs (part 3: its own ticket, D-01; it must avoid the crash at :859-862 and keep the once-per-verifier check), wall-clock targets, any change to stdout, stderr, exit code or JSON on a repository whose objects are intact, or dropping `safeTip`'s re-check (the data-loss guard).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-63

  @ac-1
  Scenario: A read command starts as many git processes with 20 tickets as with 1
    Given a repository with 20 tickets at several stages, with claims, recorded plan baselines and verify commits, at least one of them with a merge commit on its branch after review, at least one with a merge commit on its branch before review, and at least one at verify or done without one, and two repositories each holding only one of those tickets, one whose branch holds a merge commit and one whose branch holds none, its file and its branch copied with the same history
    When each of `status`, `anchor`, `lint`, `dashboard` and `show` runs in the 20-ticket repository and in each one-ticket repository, `anchor` and `show` on that one ticket
    Then each command starts as many git processes itself in the 20-ticket repository as in the one-ticket repository, plus in total at most two more for each of the other 19 tickets whose branch holds a merge commit

  @ac-2
  Scenario: Every command prints what it printed before the change
    Given goldens recorded before any product change, of the stdout, stderr, exit code and JSON of `status`, `anchor`, `lint`, `dashboard`, `show`, `gate plan`, `gate done`, pick-up, clean, `worktree merge` and `new ticket --worktree` on the sample repositories
    When the same commands run on the same repositories after the change
    Then every output matches its golden byte for byte, after only the temporary folder paths and commit shas that differ between runs are replaced by fixed placeholders

  @ac-3
  Scenario: Each worktree command starts fewer git processes than before the change
    Given the number of git processes that pick-up, clean, `worktree merge` and `new ticket --worktree` started on a sample repository before any product change
    When each runs on the same repository after the change
    Then each starts fewer git processes than its recorded number
    And clean removes and keeps exactly the branches it removed and kept before the change, a squash-merged or rebased branch included

  @ac-4
  Scenario: The four slow tests are under 10 s or kept with an approved ceiling
    Given the two branch-fact tests, the lane S review-package test and the upgrade ac-2 test named in Part 4 of the Intent
    When a full run completes on the owner's machine
    Then each of the four takes under 10 s in that run's junit report, or is kept with a reason and a ceiling the owner approved, written in this ticket, and takes no longer than that ceiling in the report
    And the upgrade ac-2 test passes within the cli's test limit of 90 s on Windows at packages/cli/vitest.config.ts, which is not raised
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The ticket holds parts 1, 2 and 4; part 3 (the benchmark sample filter) moves to its own draft ticket — "A"
- D-02 Success for parts 1 and 2 is measured by counting git processes: the read commands `status`, `anchor`, `lint`, `dashboard` and `show` start the same number of git processes on a repository with 1 ticket as on one with 20, checked by a test, not by wall-clock time — "A" (owner, 2026-10-29, choosing this against a fixed ceiling per command and against a time limit)
- D-03 Part 4 is done when each of the four named tests (the two branch-fact tests, the lane S review-package test and the upgrade ac-2 test) runs under 10 s in a full run on the owner's machine, or is kept with a reason and a ceiling the owner approves, as ST-LN-44 did; the upgrade ac-2 test at least no longer fails the cli's 90 s limit — "A" (owner, 2026-10-29, choosing this against under 10 s with no keep and against fixing only the upgrade test)
- D-04 "Same output" is proven by goldens recorded before any product change: the full stdout, stderr, exit code and JSON of `status`, `anchor`, `lint`, `dashboard`, `show`, `gate plan` and `gate done` on a few sample repositories (tickets at several stages, claims, worktrees), which must match byte for byte after the change — "A" (owner, 2026-10-29, choosing this against relying on today's tests and against goldens for the read commands only)
- D-05 The worktree commands are in scope: each part 2 item has a test that counts the git processes of the command it touches (pick-up, clean, `worktree merge`, `new ticket --worktree`) and shows fewer than today, and those commands' messages get goldens as in D-04 — "A" (owner, 2026-10-29, choosing this against keeping part 2 to the read commands and queuing the worktree items as their own ticket)
- D-06 There is no smaller version: parts 1, 2 and 4 are done in full in this ticket, none deferred — "A" (owner, 2026-10-29, asked for the smallest version that still counts as done, choosing this against part 1 plus the upgrade test only)
- D-07 The criteria read as follows after the audit: ac-1's one-ticket repository holds one of the 20 tickets at the same stage, and `anchor` and `show` run on it; ac-2 replaces only temporary folder paths and commit shas that differ between runs before the byte comparison; ac-3's clean keeps today's rule, content checks for squash-merged or rebased branches included, and a `--merged` query is only a shortcut; ac-4's ceilings are written in the ticket and read from the full run's junit report, and the 90 s limit is not raised — "ok" (owner, 2026-10-29, to these four readings)
- D-08 A ticket whose branch holds a merge commit after review (every ticket at verify or done, since `worktree merge` and Continue merge main into it) keeps its own `git log` for its stage, so it may cost more git processes; tickets with a straight history share one read; ac-1 allows the extra per such ticket that D-10 sets — "B" (owner, 2026-10-29, at the approach, choosing this against rebuilding git's commit order for merged histories in accord, which keeps ac-1 strict but risks a wrong stage)
- D-09 ac-1 reads as follows after the second audit: the one-ticket repository copies that ticket's branch with its history, a merge commit included; the extra allowed is counted from the other tickets that actually hold a merge commit after review, not from their stage, and the 20-ticket repository holds both kinds; only the git processes accord itself starts are counted, not those git starts on its own — proposed at the approach, approved with the owner's yes to the approach
- D-10 accord never follows a merge itself: a ticket whose branch holds a merge commit after review leaves both of its reads to git, finding its review commit and reading its history after review, so it costs at most two more git processes, and ac-1 allows two extra per such ticket — "B" (owner, 2026-10-29, at the plan, choosing this against following a merge's first parent in accord, which keeps one extra but may name a different commit than git in rare cases)
- D-11 The criteria read as follows after the third audit: ac-1's allowance covers every ticket whose branch holds a merge commit, before or after review, since D-10 leaves every merge to git, and the 20-ticket repository holds one of each; ac-1's bound is one total per command, count with 20 tickets at most count with 1 plus two times the number of the other tickets with a merge; ac-1 runs twice, once with a one-ticket repository whose branch holds a merge commit and once with one whose branch holds none; ac-3's "each" is each Part 2 item against its own recorded count, as D-05 says; ac-3's sample holds both a squash-merged and a rebased branch; ac-4's "on Windows" is the owner's full run on the owner's machine, read from its junit report, with no separate CI check — "A" (owner, 2026-10-29, to these six readings)
- D-12 The criteria read as follows after the fourth audit: in each of ac-1's two comparisons, `anchor` and `show` in the 20-ticket repository run on the same ticket the one-ticket repository holds; ac-3's per-item counts cover the Part 2 items that touch the four worktree commands, and the three per-ticket reads the Approach adds are proven by ac-1; the light preflight goes into both pick-up and `new ticket --worktree`, as the Intent says, and plain `new ticket` keeps its full read; ac-4 holds every part split off from one of the four tests to under 10 s or an approved ceiling, not only the part that keeps the original name — "A" (owner, 2026-10-29, to these four readings)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: thread facts already read, plus batched reads, with no new layer. Task 1, before any product change, records the goldens and per-item git counts at the baseline. Part 1: `loadParts` stops computing `ancestors`, `baselineFiles` and `recordsSince`; `gate plan` / `gate done` (packages/cli/src/commands/gate.ts) attach them as host facts for the gated ticket only, so core is unchanged. Part 2, item by item as the Intent lists, plus three per-ticket reads ac-1 needs: `gitAfterVerify` and `reviewStartOf` share one `git log` walk for straight histories, while a ticket with a merge after review keeps its own calls, at most two (D-08, D-10), as does any ticket when the shared walk fails, so a failure never drops more than today; `loadClaimView`'s per-ticket plan-subject `git log` (fs.ts:668-686) is batched too. Part 4: measure each test first, then cut on the command or the test side; the upgrade ac-2 test keeps its CRLF case end to end and moves the plain and indent cases to core tests of the workflow rewrite.
Rejected: one git runner with a per-command memo for all ~43 call sites (a memo stale after a fetch, prune or worktree change silently changes output, and no criterion asks for it); lazy getters on the snapshot (core would call the host, against the pure-core constraint); a `history` load flag (it would still load every ticket's history where the gate needs one); rebuilding git's commit order for merged histories (D-08).
Affected: packages/cli/src/load/fs.ts, commands/gate.ts, worktree.ts, new-ticket.ts, anchor.ts, hook.ts, run.ts, upgrade.ts, drop.ts, review-package.ts; new packages/cli/test/git-count.test.ts and goldens.test.ts with their golden files; the four Part 4 test files; core tests for the workflow rewrite.
Risks (critic, approach review; Musts first, each kept as a requirement):
- Must: clean's one `--merged` set is keyed by commit sha, not branch name, and a miss falls through to `safeTip`'s content checks; the re-read tip after the guards is never answered from the set.
- Must: D-05's count is per Part 2 item, not per command: each item has its own count assertion, so skipping one item cannot hide behind another's saving.
- Should: goldens and counts are read with readFileSync and fail when absent, so `vitest -u` or a renamed test cannot rewrite them; shas map to the fixture commit's name, not to first-appearance numbers.
- Should: the worktree list stays a fresh read before every branch deletion in clean (worktree.ts:705, 819, 924); the default ref is read again after clean's prune; the light preflight applies to pick-up and `new ticket --worktree`, not to plain `new ticket`, which needs the claims to avoid reusing an id (D-12).
- Should: the read-command goldens also run from inside a linked worktree on a ticket branch and include a lane S `gate done`; a split Part 4 test keeps its original name on one part so ac-4 can find it in the junit report, and every split-off part is held to the same limit (D-12).
- Nice: the HEAD author read from the commit object falls back to `%ae` when the commit has an `encoding` header; a plain (non-symbolic) origin/HEAD falls back as `symbolic-ref -q` does today.
- Data deletion (clean), each undone from the sha clean prints in its "deleted … (was …)" line before gc prunes (two weeks by default): A, a commit landing during the guards is deleted by a name-keyed set — prevented by the sha key, undone by `git branch t/X <sha>` and `git push origin <sha>:refs/heads/t/X`; B, a worktree opened during the fetch on a done branch loses its branch if the list is passed along — prevented by the fresh read, undone by `git branch t/X <sha>`, its files stay on disk; C, a default ref cached before the prune judges against a retired branch — prevented by the re-read after prune, undone by recreating both branches from the printed shas.
Tests: ac-1 and ac-3 at cli integration, counting `git` spawns through a `vi.mock('node:child_process')` wrapper during `run()` (accord's own spawns, not git's children as GIT_TRACE2 counts), against git-counts.before.json from Task 1; ac-2 at cli integration, goldens from Task 1, whose commit touches no packages/*/src; ac-4 from the junit report of the owner's full run at verify, a keep over 10 s asked of the owner.
