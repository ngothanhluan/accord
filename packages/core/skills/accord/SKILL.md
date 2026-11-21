---
name: accord
description: Use when starting any work in an accord repository, when seeing where work stands, when continuing a ticket, or when a lane M ticket sits at a stage (intent, approach, plan, build, review or verify). Shows the dashboard, continues or picks up a ticket, and routes a request by intent, whether a change, a question, a brainstorm, an idea to queue, research, an existing ticket or a review.
license: MIT
argument-hint: "[request]"
kind: skill
loads: [accord/comments.md, accord/continue.md, accord/ids.md, accord/intent-discuss.md, accord/intent-research.md, accord/intent.md, accord/lane-r.md, accord/lane-s.md, accord/lane.md, accord/new-epic.md, accord/new.md, accord/onboard.md, accord/pickup.md, accord/queue.md, accord/review-foreign.md, accord/review-security.md, accord/route.md, accord/worktree.md, shared/ask.md, shared/failure.md, shared/finish.md, shared/scout.md, shared/similar.md]
---

First run the session check in `./worktree.md` for the dashboard and for `/accord onboard`. Any other text after `/accord` that is not a typed form below follows `./route.md`, which says where the check runs. A failure reported in a ticket that has reached verify follows `./failure.md` by this route. A request to handle the comments on a ticket's pull request follows `./comments.md` by this route, without the session check. A request to review code or a pull request accord did not build follows `./review-foreign.md` by this route, without the session check.

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
says so, offers Pick up, and never claims it. `/accord upgrade` loads `accord-upgrade`, and `/accord onboard` follows the Onboard section below. Any other text, but `upgrade`, `onboard` or `queue` with text after it: follow `./route.md`
with the whole text after `/accord` (for
`/accord continue the refactor` it is `continue the refactor`, and
`/accord continue ST-2 now` is routed as text too); a change follows `./new.md`, and an epic, lane L, follows `./new-epic.md`.

## An idea to queue: `/accord queue <idea>`

`/accord queue <idea>` follows `./queue.md` with the whole text after `queue`, when any text follows `queue`; at its step that titles the draft it follows `./similar.md`. With nothing after `queue`, ask the owner for the idea in one question and write nothing. The session check does not run for a queued idea.

## A ticket at a stage

After `accord anchor` prints a ticket's lane and stage, read the file for them and go on at the step the anchor names. Read it again after every `/clear` or compaction, from `accord anchor` and never from memory:

- lane S: `./lane-s.md`.
- lane R: `./lane-r.md`.
- lane M, row `intent`: `./intent.md`, which names `./intent-discuss.md` at its step 9 and `./intent-research.md` at its steps 2 and 6.

A lane M stage with no row here runs its own command.

## A lane: `./continue.md` and the change route

A lane proposal follows `./lane.md` and its scout reply is checked as `./scout.md` says. Lane S follows `./lane-s.md` and `./review-security.md`. At step 6 of `./lane-s.md`, report the finish as `./finish.md` says. Lane R follows `./lane-r.md`.

## Onboard: `/accord onboard`

After `accord init` printed its `proposals:` line (`proposal:` lines to go through, or `proposals: 0`), or on `/accord onboard`, follow `./onboard.md`. It is not a New request, and the session check above runs first.

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
