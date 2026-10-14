---
kind: reference
---

# The tests baseline

When `accord/config.yml` has no `tests.report`, skip this file: ask nothing.

When `accord/tests-baseline.txt` is absent, and only after the owner has decided every failing case at the baseline, as step 7 says, ask the owner before running `accord tests baseline`. The baseline then lists the failing cases too.

Show the number of test cases no scenario names, and up to five of them, read from the lines `accord lint` prints for them, never a hand count. The owner chooses one of: create it, do not create it, or stop. Not creating it is allowed: `accord gate plan` keeps asking on every run and nothing records the choice.

When `tests.full` wrote no report, stop and tell the owner; never write a report, and never run `accord tests baseline` against an old one.

When `accord tests baseline` refuses because the report is older than the last commit: if `git diff --stat <baseline> HEAD` shows no change outside `accord/`, run `tests.full` once more and retry once; otherwise stop and tell the owner.

On a yes, run `accord tests baseline` and commit `accord/tests-baseline.txt` in a commit of its own, holding that file alone, never with the `plan: <id> ready` commit of step 8, so it can be picked onto its own pull request. Then write into `accord/tickets/<id>/ledger.md`, under `## Rulings`:

`Ruling: accord/tests-baseline.txt created at the plan baseline on the owner's yes — no task's files: line names it, so review would otherwise list it as undeclared — cost if wrong: review reports it as Extra`

The ledger goes in the `plan: <id> ready` commit, so the baseline commit still holds that file alone. A resumed run that finds the file written but not committed does both at step 8: commit the file alone, then add the Ruling when the ledger lacks it, before the `plan: <id> ready` commit.

On a team, the file reaches the main branch in its own small pull request, holding that file alone, before other tickets plan. On a merge conflict in it, keep only the lines both sides hold, never the union: a dropped case then fails loudly at the gate instead of being exempted silently.

Never create the file in any other step, stage, or agent.
