---
name: accord-plan
description: Use when a lane M ticket has an approved approach and needs a plan. Has the planner write plan.md task by task, checks it with accord gate plan and the critic, and runs the full test suite on the baseline before build.
license: MIT
kind: skill
loads: [plan/baseline.md, plan/critique.md, shared/ask.md]
---

This stage turns the approved approach into tasks an executor can finish
one at a time. You run it in the main session.

## Steps

1. Run `accord anchor`. When `plan.md` exists but the last commit that
   touched it is not `plan: <id> ready`, or `git status --porcelain` on
   `plan.md` prints anything, resume at step 4, counting rounds from the
   `plan: <id> round` commits in `git log` since the last
   `plan: <id> ready`, if any, and reading `plan-review.md` as `./critique.md` says.

2. **Plan.** Run `git rev-parse HEAD` (lifted from lane S: the fork point in its
   ledger Ruling), read `review.mode` in
   `accord/config.yml` (absent counts as `human`), and dispatch
   `accord-planner` with the path of `accord/tickets/<id>.md`, that commit,
   and the mode. It writes `accord/tickets/<id>/plan.md` with frontmatter
   `baseline: <that commit>` and one `## Task <n>: <title>` section
   per task. Each task carries a `covers:` line, a `files:` line, and a
   `verify:` line, then prose for the executor: the interface (consumes,
   produces) and the test written first. A task fits in about half an
   executor's context; the planner splits anything larger. Only the first
   plan sets `baseline:`. In `verify:`, write `(@ac-n)` after the id of the
   test that proves scenario `@ac-n`.

   **Re-plan**, entered from a change of course or a review plan gap:
   dispatch the planner with the ticket path, the `baseline:` already in
   `plan.md`, the mode, the paths of `plan.md` and the ledger, and the
   change note or plan gap. `baseline:` never changes; every task with a
   ledger line keeps its text and number; each new or changed task is
   numbered after the highest existing number; `(new)` stays relative to
   the baseline. Steps 4 to 6 run as usual, step 7 does not re-run the
   baseline tests, and step 8 commits again.

3. **Slices.** Under `review: human` the planner groups tasks into slices:
   each slice is one pull request covering a stated subset of the
   acceptance criteria, green on its own. The planner writes each slice
   into `plan.md`: the tasks it holds and the criteria it covers. Under
   `review: outcome` it is one branch, no slices.

4. **Gate.** Run `accord gate plan <id>` and fix what it prints, then run
   it again until it passes. On a pass it writes `plan_hash:` into
   `plan.md`. A plan changed after that, by a critic round or anything
   else, must pass `accord gate plan <id>` again before `accord task-done`
   records a task, so re-run the gate after every revision. A question it asks about the tests
   baseline is answered at step 7; never create `accord/tests-baseline.txt` earlier. A gate
   failure you cannot fix counts as an open finding in step 6.

5. **Critique.** Run the loop in `./critique.md`: how many `accord-critic` agents
   read, and what, which findings `accord-planner` fixes, and when the loop ends.

6. **Rounds.** At most three revision rounds. If a Must or Should in
   `plan-review.md` is still `open` or `unverified`, or `accord gate plan <id>` still fails, after the third, stop and tell the owner what is still
   open, and show the revision with the fewest Must findings: its round
   and its commit, read from `git log` since the last `plan: <id> ready`,
   if any. Never continue on
   a failing plan.

7. **Baseline tests.** Before the first build commit, run the
   `tests.full` command from `accord/config.yml` at the current HEAD, and
   only while `git diff --stat <baseline> HEAD` shows no change outside
   `accord/`. Never check out, stash, reset, or clean to reach the
   baseline. If product code has changed since the baseline, ask the
   owner. Show the owner every failing case; the owner decides whether it
   is fixed first or tracked as its own ticket. Never ignore a failing
   case on your own. When `tests.report` is set and
   `accord/tests-baseline.txt` is absent, follow `./baseline.md`.

8. **Finish.** If `git status` shows `accord/tests-baseline.txt` new, commit it
   alone first and add its Ruling if absent, per `./baseline.md`. Append a `## Closed` line to `plan-review.md`. Commit `plan.md` and `plan-review.md`, with the ledger if it changed, with the
   subject `plan: <id> ready`. That commit marks the plan finished;
   `accord-build` checks for it. Then run `accord worktree push <id>`.

9. Next: `accord-build`.

## Rules

- Every agent receives the ticket verbatim, by file path, never a summary.
- Anything touching intent, a veto, an acceptance criterion, or a public
  interface stops the run and asks the owner. Every other decision is a
  Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`:
  `Ruling: <what> — <why> — <cost if wrong>`.
  Read `./ask.md` before any question to the owner.
