---
name: accord
description: Use when starting any work in an accord repository, when seeing where work stands, or when continuing a ticket. Shows the dashboard, continues or picks up a ticket, and classifies a new request into a lane.
license: MIT
argument-hint: "[request]"
kind: skill
loads: [accord/comments.md, accord/ids.md, accord/onboard.md, accord/review-foreign.md, accord/worktree.md, shared/ask.md, shared/failure.md]
---

First run the session check in `./worktree.md`, except for `/accord upgrade`. A failure reported in a ticket that has reached verify follows `./failure.md`. A request to handle the comments on a ticket's pull request follows `./comments.md`, without the session check. A request to review code or a pull request accord did not build follows `./review-foreign.md`, without the session check.

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
`/accord continue ST-99` is a New request. Then load `accord-pickup` for Pick up, or `accord-continue` for
Continue, with that id, without showing the dashboard first. Continue on a ticket nobody has claimed
says so, offers Pick up, and never claims it. `/accord upgrade` loads `accord-upgrade`, and `/accord onboard` follows the Onboard section below. Any other text, but `upgrade` or `onboard`, starts a
New request: load `accord-new` with the whole text after `/accord`: for
`/accord continue the refactor` it is `continue the refactor`, and
`/accord continue ST-2 now` is a new request too.

## Onboard: `/accord onboard`

After `accord init` printed `proposal:` lines, or on `/accord onboard`, follow `./onboard.md`. It is not a New request, and the session check above runs first.

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
