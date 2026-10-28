---
name: accord
description: Use when starting any work in an accord repository, when seeing where work stands, or when continuing a ticket. Shows the dashboard, continues or picks up a ticket, and classifies a new request into a lane.
license: MIT
kind: skill
loads: [accord/ids.md, accord/lane.md, accord/lane-s.md, accord/upgrade.md, accord/worktree.md, shared/ask.md, shared/failure.md, shared/finish.md]
---

First run the session check in `./worktree.md`, except for `/accord upgrade`. A failure reported in a ticket that has reached verify follows `./failure.md`.

## Dashboard: `/accord` with no argument

1. Run `accord worktree clean`, then `accord dashboard`. It reads you from
   `git config user.email` and prints every section ranked, one
   count line, and the actions that apply. When it exits 2, show its message
   and stop.
2. Show both outputs verbatim in a code block. Never reorder, cut, merge, or
   add to it, and never build a section from `accord status --json`.
3. Offer the actions its last line names: Continue, Pick up, New request.

## A ticket named: `/accord pick-up <id>`, `/accord continue <id>`

An action applies only when the whole text after it is exactly one
ticket id, the id of a ticket in `accord/tickets/`, an id that
`accord status --json` lists with a `branch`, or for Continue a ticket
`accord worktree open <id> --continue` finds; with none,
`/accord continue ST-99` is a New request. Then run Pick up or
Continue below on that ticket, without showing the dashboard first. Continue on a ticket nobody has claimed
says so, offers Pick up, and never claims it. Any other text, but `upgrade`, starts a
New request whose text is the whole text after `/accord`: for
`/accord continue the refactor` it is `continue the refactor`, and
`/accord continue ST-2 now` is a new request too.

## Continue

1. Run `accord worktree open <id> --continue` unless it just ran; follow
   `./worktree.md`. The active ticket is its `branch` from
   `accord status --json`, read from git, never from memory.
2. Run `accord anchor`.
3. If `accord/tickets/<id>/debug.md` exists and its last `## ` heading is
   not `## Resolved`, load `accord-debug` and resume there.
4. Otherwise, when it prints `Lane: S`, follow `./lane-s.md`. Else load the stage skill
   for the stage it prints: `intent` →
   `accord-approach` at step 5, the owner's yes, when the ticket's
   `## Approach` is already written, otherwise `accord-intent`; `plan` →
   `accord-plan`, `build` → `accord-build`, `review` → `accord-review`,
   `verify` → `accord-verify`; `done` → `accord-verify` at step 6.
   Resume at the step the anchor names. Never re-run a task
   the ledger records.

## Pick up

Run `accord worktree open <id>`: it makes its `branch` from
`accord status --json` and commits `claim: <id>` on it. Follow
`./worktree.md`; it says when to push it (the pushed branch is the claim).

## New request: `/accord <request>`

Propose a lane as `./lane.md` says, for every new request however small it looks; the owner may override.

| Lane | Example |
|---|---|
| S: small fix | bug, copy change, one flag |
| M: feature | one story |
| L: epic | 3 to 10 related stories |
| P: project | greenfield |

- **S.** Run `accord new ticket <id> --lane S --worktree`; when config.yml has
  `people`, follow `./ids.md` and run it with `--type <story|bug>` and no id
  instead. Then follow `./lane-s.md`. At step 6 of `./lane-s.md`, report the finish as `./finish.md` says.
- **M.** Run `accord new ticket <id> --lane M --worktree`; when config.yml has
  `people`, follow `./ids.md` and run `accord new ticket --type <story|bug>
  --lane M --worktree` with no id instead. It writes the ticket on its
  `branch` from `accord status --json`, commits it and pushes it; follow
  `./worktree.md`, and push it as that file says when the push fails.
- **L and P.** Not built yet. Say so, and propose splitting the work into
  lane M tickets linked by `depends_on`.

## Upgrade: `/accord upgrade`

Follow `./upgrade.md`.

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
