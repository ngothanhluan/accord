---
name: accord-pickup
description: Use when taking up a ticket by its id. Claims the ticket on its own branch in its own worktree and pushes the claim.
license: MIT
argument-hint: "<ticket id>"
kind: skill
loads: [accord/ids.md, accord/worktree.md, shared/ask.md, shared/failure.md]
---

`/accord-pickup <id>` claims one ticket, and the accord skill loads this skill with that id when a person types the older form of the command. With no argument, ask the owner for the ticket id in one question and run, claim, create and edit nothing.

Pick up applies only when the whole text after it is exactly one
ticket id, the id of a ticket in `accord/tickets/`, or an id that
`accord status --json` lists with a `branch`. Any other text is a new request: load `accord-new` with the whole text.

## Pick up

Run `accord worktree open <id>`: it makes its `branch` from
`accord status --json` and commits the claim on it, with the subject of `commits.subjects.claim`. Follow
`./worktree.md`; it says when to push it (the pushed branch is the claim).

## Rules

- Anything touching intent, a veto, an acceptance criterion, or a public
  interface stops the run and asks the owner. Every other decision on a
  ticket is a Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`.
  Read `./ask.md` before any question to the owner.
- `./worktree.md` points to `./failure.md` and `./ids.md`; neither applies to Pick up.
