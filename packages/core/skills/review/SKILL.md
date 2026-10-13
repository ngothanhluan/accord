---
name: accord-review
description: Use when every task of a lane M ticket has a ledger line and the work needs review. Dispatches reviewers on the review package, fixes patch findings through fresh executors until no Must or Should is left, runs one final reviewer, and records each round in review.md.
license: MIT
kind: skill
loads: [review/record.md]
---

This stage reviews the built work against the ticket until it converges.
You run it in the main session and orchestrate: reviewers find, executors
fix.

## Steps

1. Run `accord anchor`.

2. **Package.** Run `accord review-package <id>` into a file outside the
   working tree. It holds the commits, the stat, and the diff from the
   plan's `baseline:`, and lists under `## Undeclared files` every changed
   file no task's `files:` line names. The review unit is the ticket under
   `review: outcome` and each slice under `review: human` (pass `--base`
   the commit the slice starts from); review independent slices in
   parallel.

3. **Reviewers.** Choose by the unit's diff size and risk:
   - up to about 500 changed lines: one `accord-reviewer`, lens `both`;
   - about 500 to 1500: an `intent` and a `quality` reviewer, in parallel;
   - over about 1500: split by area times lens, plus one `integration`
     reviewer reading only the interfaces and links between areas;
   - auth, money, migration, or data deletion: add a `security` reviewer,
     at any size.

   Name the lens in each dispatch. Every reviewer gets the paths of the
   ticket file, the review package, and `accord/tickets/<id>/ledger.md`;
   the approach is the ticket's `## Approach`. The executor's report is
   context, never evidence.

4. **Classify.** Merge and de-duplicate the findings. Before fixing, mark
   each one `patch`, `plan-gap`, or `intent-gap`.
   - Fix every Must and Should marked `patch` through `accord-build`'s
     executor path: write a brief file outside the working tree holding
     the ticket file verbatim, then the findings to fix; dispatch a fresh
     `accord-executor` with its path; route its stops as `accord-build`
     does; run the `tests.affected` command over the files the fix
     touched. Then re-review only the fix diff, with one reviewer.
   - A plan gap goes back to `accord-plan`, where the critic runs again.
   - An intent gap stops the run and asks the owner.
   - Nice findings go to the ledger under `## Deferred`, not fixed.

5. **Converged** means zero Must and zero Should. If round 3 still finds
   a new Must, say whether it traces to the ticket or the plan; if it
   does, ask the owner before round 4.

6. **Cap.** At most five rounds. A round at or after
   `escalation.fix_round_tier_up` in `accord/config.yml` (default 4)
   dispatches a fresh executor one model tier above the executor's
   configured model, passed as `model` on the dispatch itself: `haiku`,
   then `sonnet`, then `opus`; `opus` stays `opus`. At the cap, stop and
   report the open findings to the owner; never report the work finished.

7. **Final review.** After convergence, one fresh `accord-final-reviewer`
   reads the whole review package once (over about 1500 changed lines,
   dispatch it with lens `integration`). If it finds a Must or Should:
   one fix, one re-review scoped to that fix, then stop.

8. **Record.** Write every round to `accord/tickets/<id>/review.md` as
   `./record.md` says, ending `verdict: converged`, or
   `verdict: accepted-by-owner` followed by the owner's sentence quoted.
   Commit it.

9. Next: `accord-verify`.

## Rules

- Every agent receives the ticket verbatim, by file path, never a summary:
  an executor gets it inside its brief.
- The main session orchestrates and never edits product code.
- Anything touching intent, a veto, an acceptance criterion, or a public
  interface stops the run and asks the owner. Every other decision is a
  Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`:
  `Ruling: <what> — <why> — <cost if wrong>`.
