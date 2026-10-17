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
