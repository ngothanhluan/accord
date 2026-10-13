---
name: accord-verify
description: Use when a lane M ticket's review.md ends with a verdict and the work needs verifying. Runs the full suite, has a fresh verifier write verification.md, builds the owner's report, and runs accord gate done once the owner has ticked verified.
license: MIT
kind: skill
---

This stage checks the built work against the ticket and hands it to the
owner. You run it in the main session and orchestrate: the verifier
judges, the owner decides.

## Steps

1. Run `accord anchor`.

2. **Suite.** First commit everything, `review.md` included, so the
   working tree is clean: that commit is the one verified. Run the
   `tests.full` command from `accord/config.yml` at it, so the report
   `tests.report` names is fresh.

3. **Verifier.** Dispatch `accord-verifier` in a fresh context with the
   path of `accord/tickets/<id>.md`. It writes
   `accord/tickets/<id>/verification.md` and nothing else.

4. **Report.** Build the owner's report in chat from `verification.md`,
   the report `tests.report` names, and `accord/tickets/<id>/ledger.md`:
   - one line per criterion: pass or fail, with its evidence (the test and
     its output, or a screenshot for UI);
   - three to five "try this" steps that take the owner about two minutes;
   - every Ruling under the ledger's `## Rulings`, ordered by its
     cost if wrong, highest first;
   - the deferred items under the ledger's `## Deferred`;
   - what was not checked, including every criterion the verifier
     recorded as `blocked`;
   - slow tests: the slowest cases in the report, with their times.

5. **Owner.** Read `review.mode` in `accord/config.yml` (absent counts as
   `human`).
   - Under `review: outcome` the owner reads the report, tries the steps,
     and ticks `verified:` in the ticket, with `verified_hash:` set to the
     current `ac_hash:` and `verified_commit:` to the commit verified.
     `## Verification notes` is not required.
   - Under `review: human` the 0.1.0 human layer stays: a person ticks
     `verified:` the same way and writes `## Verification notes`, and a
     person reviews each slice's pull request.
   - Never tick `verified:` for the owner, and never write
     `verified_hash:` or `verified_commit:`.
   - A `fail` or `blocked` criterion: show the owner. A failing criterion
     goes back to `accord-build` as a fix, or the owner decides; it is
     never ticked past.

6. Run `accord gate done <id>` and work from what it prints. Leave
   `verification.md` and the owner's tick uncommitted until it passes;
   the notice that the review file has no author yet is expected and no
   reason to commit earlier. When it passes, commit only
   `accord/tickets/<id>.md` and `accord/tickets/<id>/verification.md`.

7. Next: `/accord`, for the next ticket.

## Rules

- Every agent receives the ticket verbatim, by file path, never a summary.
- The main session orchestrates and never edits product code.
- Anything touching intent, a veto, an acceptance criterion, or a public
  interface stops the run and asks the owner. Every other decision is a
  Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`:
  `Ruling: <what> — <why> — <cost if wrong>`.
