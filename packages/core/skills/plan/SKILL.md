---
name: accord-plan
description: Use when a lane M ticket has an approved approach and needs a plan. Has the planner write plan.md task by task, checks it with accord gate plan and the critic, and runs the full test suite on the baseline before build.
license: MIT
kind: skill
---

This stage turns the approved approach into tasks an executor can finish
one at a time. You run it in the main session. The owner does not need to
read the plan.

## Steps

1. Run `accord anchor`.

2. **Plan.** Run `git rev-parse HEAD`, read `review.mode` in
   `accord/config.yml` (absent counts as `human`), and dispatch
   `accord-planner` with the path of `accord/tickets/<id>.md`, that commit,
   and the mode. It writes `accord/tickets/<id>/plan.md` with frontmatter
   `baseline: <git rev-parse HEAD>` and one `## Task <n>: <title>` section
   per task. Each task carries a `covers:` line, a `files:` line, and a
   `verify:` line, then prose for the executor: the interface (consumes,
   produces) and the test written first. A task fits in about half an
   executor's context; the planner splits anything larger.

3. **Slices.** Under `review: human` the planner groups tasks into slices:
   each slice is one pull request covering a stated subset of the
   acceptance criteria, green on its own. Under `review: outcome` it is
   one branch, no slices.

4. **Gate.** Run `accord gate plan <id>` and fix what it prints, then run
   it again until it passes. On a pass it writes `plan_hash:` into
   `plan.md`. A plan changed after that, by a critic round or anything
   else, must pass `accord gate plan <id>` again before `accord task-done`
   records a task, so re-run the gate after every revision.

5. **Critique.** Dispatch `accord-critic` in a fresh context, mode `plan`,
   with the path of the ticket file and the path of `plan.md`. Have the
   planner fix every Must and every Should, then go back to step 4.

6. **Rounds.** At most three revision rounds. If Must or Should findings
   are still open after the third, stop and tell the owner what is still
   open, and show the revision with the fewest Must findings and the
   round it came from. Never continue on a failing plan.

7. **Baseline tests.** Before build, with the working tree at the
   `baseline:` commit, run the `tests.full` command from
   `accord/config.yml`. Show the owner every failing case; the owner
   decides whether it is fixed first or tracked as its own ticket. Never
   ignore a failing case on your own.

8. Next: `accord-build`.

## Rules

- Every agent receives the ticket verbatim, by file path, never a summary.
- Anything touching intent, a veto, an acceptance criterion, or a public
  interface stops the run and asks the owner. Every other decision is a
  Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`:
  `Ruling: <what> — <why> — <cost if wrong>`.
