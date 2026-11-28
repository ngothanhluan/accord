---
name: accord
description: Use when starting any work in an accord repository, when seeing where work stands, when continuing a ticket, or when a lane M ticket sits at a stage (intent, approach, plan, build, review or verify). Shows the dashboard, continues or picks up a ticket, and routes a request by intent, whether a change, a question, a brainstorm, an idea to queue, research, an existing ticket or a review.
license: MIT
argument-hint: "[request]"
kind: skill
loads: [accord/approach-approval.md, accord/approach-critique.md, accord/approach-ui.md, accord/approach.md, accord/build-no-plan.md, accord/build-waves.md, accord/build.md, accord/continue.md, accord/epic-dependency.md, accord/ids.md, accord/intent-discuss.md, accord/intent-research.md, accord/intent.md, accord/lane-r.md, accord/lane-s.md, accord/lane.md, accord/new-epic.md, accord/new.md, accord/pickup.md, accord/plan-baseline.md, accord/plan-critique.md, accord/plan-legacy-round1.md, accord/plan-slices.md, accord/plan-summary.md, accord/plan.md, accord/queue.md, accord/repos.md, accord/review-lenses.md, accord/review-record.md, accord/review-security.md, accord/review.md, accord/route.md, accord/slices.md, accord/verify-ci.md, accord/verify-deferred.md, accord/verify-ui.md, accord/verify-writer.md, accord/verify.md, accord/worktree.md, shared/ask.md, shared/direction.md, shared/failure.md, shared/finish.md, shared/pr-wait.md, shared/prototype.md, shared/resume.md, shared/scout.md, shared/similar.md]
---

First run the session check in `./worktree.md` before the dashboard. `./route.md` says where the check runs for any other text. A failure reported in a ticket that has reached verify follows `./failure.md` by this route.

## Dashboard: `/accord` with no argument

1. Run `accord worktree clean`, then `accord dashboard`. It reads you from
   `git config user.email` and prints every section ranked, one
   count line, and the actions that apply. When it exits 2, show its message
   and stop.
2. Show both outputs verbatim in a code block. Never reorder, cut, merge, or
   add to it, and never build a section from `accord status --json`.
3. Offer the commands its last line names.

## A ticket named: `/accord pick-up <id>`, `/accord continue <id>`

An action applies only when the whole text after it is exactly one
ticket id, the id of a ticket in `accord/tickets/`, an id that
`accord status --json` lists with a `branch`, or for Continue a ticket
`accord worktree open <id> --continue` finds; with none,
`/accord continue ST-99` follows `./route.md` like any other text. At either typed form, follow `./pickup.md` for Pick up, or `./continue.md` for
Continue, with that id, without showing the dashboard first. `/accord continue` or `/accord pick-up` with no id asks the owner for the ticket id in one question and runs, claims, creates and edits nothing. Continue on a ticket nobody has claimed
says so, offers Pick up, and never claims it. Any other text, but `queue` with text after it: follow `./route.md`
with the whole text after `/accord` (for
`/accord continue the refactor` it is `continue the refactor`, and
`/accord continue ST-2 now` is routed as text too); text in any words that asks to work on a ticket reaches Continue or Pick up through its route there; a change follows `./new.md`, and an epic, lane L, follows `./new-epic.md`.

## An idea to queue: `/accord queue <idea>`

`/accord queue <idea>` follows `./queue.md` with the whole text after `queue`, when any text follows `queue`; at its step that titles the draft it follows `./similar.md`. With nothing after `queue`, ask the owner for the idea in one question and write nothing. The session check does not run for a queued idea.

## A ticket at a stage

After `accord anchor` prints a ticket's lane and stage, read the file for them and go on at the step the anchor names. Read it again after every `/clear` or compaction, from `accord anchor` and never from memory:

- lane S: `./lane-s.md`.
- lane R: `./lane-r.md`.
- lane M, row `intent`: `./intent.md`, which names `./intent-discuss.md` at its step 8 and `./intent-research.md` at its steps 2 and 6.
- lane M, row `approach`: `./approach.md`, which names `./approach-ui.md` at its step 2 (and through it `./direction.md` and `./prototype.md`), `./approach-critique.md` at its step 3 and, for the owner's yes, `./approach-approval.md` at its step 5. The anchor prints `intent` for a ticket still at approach: it takes this row at step 5 when its `## Approach` holds a `- Rejected:` line, at step 3 when it holds only the draft of step 2.
- lane M, row `plan`: `./plan.md`, which names `./plan-critique.md` at its steps 1, 5 and 6, `./plan-legacy-round1.md` at its step 5 for a 0.4.0 round 1, and `./plan-baseline.md` at its steps 7 and 8, `./plan-slices.md` at its step 3 and `./plan-summary.md` at its step 8.
- lane M, row `build`: `./build.md`, which names `./build-waves.md` at its step 2, `./build-no-plan.md` at its step 1 for a task with no plan, `./epic-dependency.md` at its step 4 for a story of an epic blocked on a sibling story's code and `./slices.md` at its step 8 for a plan with slices and `./repos.md` at its step 8 for another repository.
- lane M, row `review`: `./review.md`, which names `./review-record.md` at its steps 4, 5, 6 and 8, `./review-security.md` at its step 3 for a security reviewer and `./review-lenses.md` at its step 3 for team lenses.
- lane M, rows `verify` and `done`: `./verify.md`, which names `./verify-ci.md` at its steps 2, 4 and 6, `./verify-writer.md` at its step 3, `./verify-deferred.md` at its step 4 and `./verify-ui.md` at its steps 2, 4, 5 and 6; `done` goes on at step 6.

An `Unfinished:` line at the plan or verify stage follows `./resume.md`, as `./plan.md` step 1 and `./verify.md` step 3 say.

## A lane: `./continue.md` and the change route

A lane proposal follows `./lane.md` and its scout reply is checked as `./scout.md` says. Lane S follows `./lane-s.md` and `./review-security.md`. At step 6 of `./lane-s.md`, report the finish as `./finish.md` says; after that report, wait on the pull request as `./pr-wait.md` says. Lane R follows `./lane-r.md`.

## Rules

- A lane only rises, except that the intent interview may move a lane M ticket whose intent is not approved
  to lane S in place, as `./ids.md` says. Complexity found mid-task lifts the lane: stop, say so,
  and re-enter at the new lane's first incomplete stage. A lane never drops once its intent is approved.
- A ticket without `lane:` follows the 0.1.0 contract. Offer to add `lane: M`
  and the lane headings; do it only on a yes.
- In lane M the main session orchestrates and never edits product code.
- Anything touching intent, a veto, an acceptance criterion, or a public
  interface stops the run and asks the owner. Every other decision on a
  ticket is a Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`.
  Read `./ask.md` before any question to the owner.
