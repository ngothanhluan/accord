# Plan review

## Round 1 (whole)
1. Should — The AC-1 test cannot fail on "neither command fetches": the sandbox is a full repository, so no lazy fetch can happen whether or not a new spawn sets `GIT_NO_LAZY_FETCH=1`; an executor omitting it on the new `cat-file --batch` or `git log -1 <ref>` still passes, and a blobless clone fetches on every dashboard run. Fix: a sandbox with a promisor remote (a `--filter=blob:none` clone of a source repository that is then deleted), asserting status and dashboard exit 0 with no fetch error on stderr; or state that this clause is checked by reading the code and have review check it (lens criteria) — fixed
2. Should — Task 3 lets a `plan`-stage row carry recorded tasks, but `nextRows` (`packages/core/src/status/rows.ts:111`) admits every `plan` row as not started, against its contract "have no task recorded" (`packages/cli/src/run.ts:206`, `rows.ts:106`); an approved, unclaimed ticket with task 1 recorded and a plan last committed as a round (or edited) shows in `accord next`, in READY with `[Pick up X]`, and counts as ready in `sessionLine`. Fix: require `tasksDone === 0` for both stages in `nextRows`, one assertion in Task 3's risk test, rows.ts in Task 3's `files:` (lens build) — fixed
3. Nice — Task 4's AC-3 test checks `anchor` only for steps 1, 2, 3 and 6, not for the staged (step 4) and untracked (step 5) cases, though anchor loads through a different path than status (lens criteria) — deferred
4. Nice — The plan never says where an overlaid row's lint `errors`/`warnings` come from; as written they come from the claim branch, while the Approach's Risks say the checkout (lens criteria) — deferred
5. Nice — Task 1 does not say what the overlay does when `currentBranch(root)` returns `undefined` (lens build) — deferred
6. Nice — Task 4's AC-3 test drives about 13 CLI runs with no explicit timeout against the 30 s default (`packages/cli/vitest.config.ts:5`); lane-commands uses 60_000 for about 8 runs (lens build) — deferred

## Round 2 (diff)
fixed: 1.1, 1.2
1. Nice — the no-fetch check's two `throws` assertions accept any non-zero exit, so on git older than 2.44 (no `--no-lazy-fetch`) a usage error (129) passes them; assert status 1 (lens diff) — deferred

## Closed

## Round 1 (whole)
1. Should — Task 6's new spec §5 Claim sentence names only `accord status` and `accord dashboard` as reading a claimed ticket from its branch, but after Task 7 (D-05) `accord show` does too, so the spec is out of date on the day it ships; Task 6's `covers:` also omits D-05. Fix: write "`accord status`, `accord dashboard` and `accord show`" and add D-05 to Task 6's `covers:` (lens criteria; lens build as a Nice) — fixed
2. Nice — The panel builds its own stage cell from `dashboard --json` (`packages/core/panel/view.js:55`) and its detail prints `Stage: ${t.stage}` (`view.js:157`), so it never shows the intent-interview pointer; AC-4, D-03 and the Intent's panel-layout non-goal keep it out of scope (lens criteria) — deferred
3. Nice — Task 5's AC-4 CLI test does not say T-2's row is in `upNext.rows` (nothing is claimed or ready), and the text output's action line `-> [Pick up T-1]  [New request]` also holds `T-1`; name the `upNext.rows` entry and the table row (lens build) — deferred
4. Nice — Task 5's core test asks for "an approved ticket at stage `plan`" without saying how to build one; adding `PLAN` without `planFacts` gives `build` (lens build) — deferred

## Round 2 (diff)
fixed: 1.1
No findings

## Closed
