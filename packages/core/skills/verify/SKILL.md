---
name: accord-verify
description: Use when a lane M ticket's review.md ends with a verdict and the work needs verifying. Runs the full suite, has a fresh verifier write verification.md, builds the owner's report, and runs accord gate done once the owner has approved verified.
license: MIT
kind: skill
loads: [verify/ci.md, accord/ids.md, accord/worktree.md, shared/ask.md, shared/failure.md]
---

This stage checks the built work against the ticket and hands it to the
owner. You run it in the main session and orchestrate: the verifier
judges, the owner decides.

## Steps

1. Run `accord anchor`.

2. **Merge and suite.** First commit everything, `review.md` included, so
   the working tree is clean. Then run
   `accord worktree merge <id>`. It fetches, and when the ticket branch
   lacks commits of the remote's default branch it merges them with a
   merge commit, never a rebase. Show a line starting
   `fetch from origin failed` verbatim and go on. When it exits 2 (a
   conflict it aborted, a failed merge, or a refusal), show the message
   and stop. The owner resolves a conflict, or you do when the owner says
   so, and then this stage starts again. Start CI as `./ci.md`
   says, then run the `tests.full` command from `accord/config.yml` at the
   commit now checked out, so the report `tests.report` names is fresh:
   that commit is the one verified. Right after it, before the verifier,
   run `accord tests skipped` and keep what it prints.

3. **Verifier.** Dispatch `accord-verifier` in a fresh context with the
   path of `accord/tickets/<id>.md`. It writes
   `accord/tickets/<id>/verification.md` and nothing else.

4. **Report.** Wait for CI as `./ci.md` says first; a failed check goes to
   `./failure.md` instead of this report. Build the owner's report in chat
   from `verification.md`, the report `tests.report` names, and
   `accord/tickets/<id>/ledger.md`:
   - one line per criterion: pass or fail, with its evidence (the test and
     its output, or a screenshot for UI);
   - CI: each check's result, or CI not checked and why;
   - three to five "try this" steps that take the owner about two minutes;
   - every Ruling under the ledger's `## Rulings`, ordered by its
     cost if wrong, highest first;
   - the deferred items under the ledger's `## Deferred`;
   - what was not checked, including every criterion the verifier
     recorded as `blocked`, every check CI did not check, and every test
     `accord tests skipped` printed, by name, with the operating system it
     names;
   - slow tests: the slowest cases in the report, with their times.

5. **Owner.** Read `review.mode` in `accord/config.yml` (absent counts as
   `human`).
   - Under `review: outcome`, after the report, ask the owner one
     question with two choices, approve or not yet. The question names
     the criteria to tick, the commit verified, and the three values you
     will write. Only on an explicit approve, write `verified:` with those
     criteria, `verified_hash:` set to the current `ac_hash:`, and
     `verified_commit:` to the commit verified. Silence, an unclear
     answer, or a yes given before the report is not an approve: ask
     again. `## Verification notes` is not required.
   - Under `review: human` the 0.1.0 human layer stays: a person ticks
     `verified:` by hand, with the same two values, and writes
     `## Verification notes`. You never write any of them.
   - A `blocked` criterion: show the owner, who decides. A `fail` criterion,
     or a failure the owner names in answer, goes to `./failure.md`, never
     to `accord-build` directly; it is never ticked past.

6. Run `accord gate done <id>` and work from what it prints. Leave
   `verification.md` and the tick uncommitted until it passes;
   the notice that the review file has no author yet is expected and no
   reason to commit earlier. When it passes, read the ticket's
   `## Corrections` and the Rulings under the ledger's `## Rulings`. For
   each one you judge to hold across tickets, ask the owner whether it
   becomes a rule of this repository; on a yes, write it as one rule
   line in `accord/product/conventions.md`. Without the owner's yes,
   write nothing to `conventions.md`. Then commit only
   `accord/tickets/<id>.md`, `accord/tickets/<id>/verification.md` and,
   when a rule was written, `accord/product/conventions.md`; under
   `review: outcome` the commit message quotes the owner's answer.
   When both files are already committed and no rule was written,
   commit nothing. Then finish CI as `./ci.md` says.

7. Next: `/accord`, for the next ticket.

## Rules

- Every agent receives the ticket verbatim, by file path, never a summary.
- The main session orchestrates and never edits product code.
- Anything touching intent, a veto, an acceptance criterion, or a public
  interface stops the run and asks the owner. Every other decision is a
  Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`:
  `Ruling: <what> — <why> — <cost if wrong>`.
  Read `./ask.md` before any question to the owner.
