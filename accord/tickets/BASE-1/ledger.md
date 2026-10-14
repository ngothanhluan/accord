# Ledger

## Tasks
- task 1 done a02fc8c6b484
- task 2 done 9ec5bf8579e6

## Rulings

- Ruling: (architect) the rule id is `gate.tests-baseline-missing` — `gate.plan-baseline-missing` is taken by plan.md's `baseline:` key — cost if wrong: a one-line rename across rules, tests, and spec.
- Ruling: (architect, planner) the warning's file is `accord/tests-baseline.txt`, so it sorts first and `lane-plan.test.ts:86,97` filter by rule — it names the missing thing — cost if wrong: two test edits point at the wrong rows.
- Ruling: (architect) no lint rule — `gatePlan` keeps only lint findings scoped to the ticket, so a repository-wide lint finding would never reach `gate plan` — cost if wrong: none.
- Ruling: (planner) the ledger Ruling for a created baseline is committed with `plan: <id> ready`, not with the baseline commit — D-09 keeps the baseline commit to that one file so it can be picked onto its own pull request — cost if wrong: one sentence in baseline.md.
- Ruling: (planner) spec edits are spread across the three tasks so every task keeps a test on its verify line — cost if wrong: none beyond ordering.
- Ruling: (planner) existing drift, byte-cap, and CLI cases are named in task prose as must-pass, not on verify lines — they carry no `risk:` and no marker — cost if wrong: less visible to the reviewer.
- Ruling: baseline tests at d364a6d: 1157 passed, 0 failed; `accord/tests-baseline.txt` already exists in this repository, so step 7 asks no baseline question — cost if wrong: none.

## Deferred

- Nice (plan critic round 3): a run that stops after the baseline commit and before its ledger Ruling never adds the Ruling on resume; step 8 fires only while the file is new — plan Task 3, baseline.md item 6.
- Nice (plan critic round 3): the stale check runs before the `wx` write, so in a repository with a commit an existing baseline plus a stale report reports "run the tests again" before "already exists" — plan Task 2.
