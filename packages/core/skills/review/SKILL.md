---
name: accord-review
description: Use when every task of a lane M ticket has a ledger line and the work needs review. Dispatches reviewers on the review package, fixes patch findings through fresh executors until no Must is open and every Should is fixed, runs one final reviewer, and records each round in review.md.
license: MIT
kind: skill
loads: [review/record.md, shared/ask.md]
---

This stage reviews the built work against the ticket until it converges.
You run it in the main session and orchestrate: reviewers find, executors
fix.

## Steps

1. Run `accord anchor`.

2. **Package.** Run `accord review-package <id>` into a file outside the
   working tree. It holds the commits, the stat, and the diff from the
   plan's `baseline:`, and lists under `## Undeclared files` every changed
   file no task's `files:` line names. The review unit is the whole
   ticket, whatever `review.mode` in `accord/config.yml` says.

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
     executor path. Note the HEAD sha. Write a brief file outside the
     working tree: copy the ticket file byte for byte (never retype it),
     then append the findings to fix. Dispatch a fresh `accord-executor`
     with its path, and route its stops as `accord-build` does.
   - When it reports, run the `tests.affected` command over the files the
     fix touched, or `tests.full` when `tests.affected` is not configured or
     finds no test file. If it fails, dispatch a fresh executor with the same
     brief plus the failing output, in the same round.
   - Copy every Ruling in its report, and each file outside the plan you
     accept as a Ruling naming the file and its reason, into
     `accord/tickets/<id>/ledger.md` under `## Rulings`; commit the ledger.
   - When the round reported a Must, re-review only the fix diff:
     `accord review-package <id> --base <the noted sha>` into a file
     outside the working tree, one reviewer, lens `both`. When it reported
     only Should findings, no reviewer is dispatched again for that fix:
     that command passing checks it.
   - A plan gap goes back to `accord-plan` as a re-plan, where the critic
     runs again.
   - An intent gap stops the run and asks the owner.
   - Nice findings go to the ledger under `## Deferred`, not fixed.

5. **Converged** means no Must is open and every Should is fixed with that
   command passing. If round 3 still finds
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
   dispatch it with lens `integration`). If it finds a Must:
   one fix and one scoped re-review, as in step 4. If it finds only Should
   findings, fix them and run that command as in step 4, with no
   re-review. If a Must is still
   open after that, stop and ask the owner.

8. **Record.** Write every round to `accord/tickets/<id>/review.md` as
   `./record.md` says, ending `verdict: converged`, or, when the owner
   accepts any stop with findings still open, `verdict: accepted-by-owner`
   followed by the owner's sentence quoted.
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
  Read `./ask.md` before any question to the owner.
