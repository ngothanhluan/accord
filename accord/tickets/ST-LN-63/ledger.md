# Ledger: ST-LN-63

## Rulings
- Ruling: count git processes with a `vi.mock('node:child_process')` wrapper, not GIT_TRACE2 — it counts only accord's own spawns, which is what the change controls (D-09) — the counts will not match the Intent's trace numbers
- Ruling: the shared walk's positives are every claim tip plus every start, so whether it runs never depends on which tickets need it (planner, round 1) — two extra git processes per load in a repository with claims but no entries
- Ruling: Part 2 item tests are `risk:` tests, each testing a real risk of its item plus its own count assertion (planner, round 1) — the reviewer finds a risk kind loose
- Ruling: pick-up and `new ticket --worktree` reuse clean's last worktree list only when clean removed no worktree after reading it (planner, round 1) — a worktree added at the same moment makes `worktree add` fail with a git error; nothing is lost
- Ruling: skip the review-start and after-verify reads for a lane M/L/P ticket with an open task, and read a candidate's plan subject only for one with an open task — core reads them only in those states (stage.ts:73/91/94, gate/lane-s.ts:85), which keeps a ticket with a merge within D-10's two extra (planner, D-10 revision) — a future core rule reading them elsewhere would see nothing; the goldens check today's output
- Ruling: `verify-merged-before` also goes into MIXED (A-13) — it puts that state under the ac-2 goldens (planner, D-10 revision) — slightly longer sample build
- Ruling: one `ITEMS` table is shared by each item's risk test and the ac-3 test — D-11 reads ac-3's "each" per item (planner, D-10 revision) — each item's assertion runs twice per full run
- Ruling: Tasks 13–14 do not split their tests — keeps D-12's split rule to Task 15 (planner, D-10 revision) — if a cut needs a split, the executor stops with a plan gap
- Ruling: on a failed fetch, pick-up and `new ticket --worktree` finish the load from the tree, files and default branch read before the fetch — a failed fetch changes no ref (planner, round 2) — a fetch killed by its timeout after moving some refs shows claims and history read after the fetch, with the tree, files and default-branch template from before it
- Ruling: Tasks 7–14 renumbered to 8–15 when Task 6 was split (planner, round 2) — ledger lines citing task numbers go stale
- Ruling: the new tests of this plan (goldens, ac-1, ac-3 and the git-count risk tests) are kept even over 10 s; each is measured at build and its ceiling is written as a Decision the owner approves once at verify, with the Part 4 keeps — owner answered "A" (2026-10-29), keeping them as a guard against output changes and git-process regressions — every full run is about 3 to 5 minutes longer
- Ruling: Sample gets `shaOf(name)`, and samples.ts also exports `MIXED`, `SIDE`, `buildSample`, `Kind` and `TicketSpec` (executor, task 1) — a test needs a name-to-sha lookup — none, test-only exports
- Ruling: each sample ticket's code lives in its own `src/<id>.ts`, named on its plan's `files:` line, not a shared `src/export.ts` (executor, task 1) — done branches sharing one file would conflict in clean's merge-tree check and judge squash and rebased branches unsafe — if Task 2's goldens want `src/export.ts`, only the plan text changes
- Ruling: sample A-11 (done-extra) shows stage `review`, since its code commit after the verified commit is post-verify change, and A-12 (dropped) shows `intent`; the samples test asserts both (executor, task 1) — the samples test pins today's stages for those kinds
- Ruling: while another worktree's suite held the test-run lock, focused single-file runs used packages/cli as the vitest config; the final junit run used the root config (executor, task 1) — none for the result
- Ruling: `SAMPLE_BUILD_LIMIT` is 60 s (the MIXED and SIDE build takes about 2.9 s on Windows) and the samples test limit is 120 s (it takes about 6.4 s) (executor, task 1) — both are well over six times, as the plan requires
- Ruling: the ac-2 goldens test's own limit is 600 s; it takes about 75 to 97 s on Windows (executor, task 2) — none, the limit guards no stall; its ceiling goes to the owner at verify
- Ruling: a remote ref whose sha is not a fixture commit and whose refname is already taken in the copy is named `ref:remote:<refname>` (executor, task 2) — keeps two shas under one placeholder from collapsing — none, it never fired in the recorded runs

## Deferred
- plan-review 1.10 Nice — clean's merged set answers R later than today on a ref that may have moved; skip the set for R or re-read it when the ref changed
- plan-review 1.11 Nice — Task 15: core scaffold.test.ts must not read packages/cli/package.json; use a literal shaped like `PKG`
- plan-review 1.12 Nice — Task 8: its verify title names a hook case the test lacks
- plan-review 1.13 Nice — Task 1: `normalise` should name the forward-slash `realpathSync.native` form
- plan-review 1.14 Nice — Task 3: the `rev-parse --verify -q refs/heads/...` assertion also matches `defaultRefOf`'s local fallback before Task 9
- plan-review 2.5 Nice — `readsAfter` should be false when review.md has no verdict in `VERDICTS`, in any lane (2 unread processes for a merged ticket in review)
- plan-review 3.1 Nice — Deferred lines' task numbers were stale; corrected above
- plan-review 3.2 Nice — the failed-fetch Ruling's cost line was wrong; corrected above

## Tasks
- task 1 done d4a93ac435a0
- task 2 done 206756ddebce
