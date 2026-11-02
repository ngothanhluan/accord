Round record: 1

## Round 1 (whole)
1. Must — ac-4 says approve refuses a `scout.md` that `accord scout check` fails, but `scout check` judges the working tree while approve judges the report's commit (approach Ruling), so Task 6's commit-mode test asserts a state where ac-4 read literally is not met, and the reverse; only the owner can settle it (reword ac-4 or drop commit mode) — fixed
2. Should — `shared/scout.md` step 1 writes the reply to `scout.md` once the ticket exists, while intent step 2 saves only when it does not exist, so the intent reply overwrites the lane report and its `## New files`, or has no place to be checked — fixed
3. Should — `shared/scout.md` step 4 writes and commits `scout.md` in the worktree before following `stop:`, but `worktree.md:51-53` forbids editing files there on `stop:`, and no task changes it — fixed
4. Should — Task 7's test requires a phrase that the plan's own text breaks across a line in `shared/scout.md`, and renderSkill never rewraps, so `toContain` fails; flatten whitespace for skill files too (and Task 8) — fixed
5. Should — the preamble forbids a printed backslash or a repeated pattern, but the failure text prints the Claim cell verbatim, which can hold both; give the rule for printing a claim — fixed
6. Nice — the approve refusal text offers `skipped:` as a plain bypass; name the condition (no scout ran, or the owner accepts) — deferred
7. Nice — the plan adds five risk tests where the ledger records two, and the Task 7 and 8 text checks restate the inserted sentences; record them or fold into the existing REQUIRED lists — deferred

## Round 2 (whole)
1. Should — `shared/scout.md` step 5 (a report saved at approach step 5) never says to commit and push it, so `scout.md` stays untracked: the report never reaches the branch, build step 6 later judges it on the working tree where its `## New files` are tracked, and worktree clean keeps the folder — fixed

## Round 3 (diff)
1. Nice — step 3 writes the owner's `skipped:` line into `scout.md` before step 5 copies the checked reply over it, so a new report the owner accepted loses the line and approve refuses once more; say the line goes into the copied `scout.md` after the copy — deferred

## Closed
