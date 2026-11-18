---
name: accord-new
description: Use when starting new work from a request. Proposes a lane for it, creates its ticket in its own worktree and follows the lane's route.
license: MIT
argument-hint: "<request>"
kind: skill
loads: [accord/ids.md, accord/lane.md, accord/lane-r.md, accord/lane-s.md, accord/worktree.md, review/security.md, shared/ask.md, shared/failure.md, shared/finish.md, shared/scout.md]
---

`/accord-new <request>` starts a New request, and `/accord <request>` loads this skill with the whole text. With no argument, ask the owner for the request in one question and run, claim, create and edit nothing.

First run the session check in `./worktree.md`. A failure reported in a ticket that has reached verify follows `./failure.md`.

## New request: `/accord-new <request>`

Propose a lane as `./lane.md` says, for every new request however small it looks; the owner may override. Check and save the scout's reply as `./scout.md` says.

| Lane | Example |
|---|---|
| S: small fix | bug, copy change, one flag |
| M: feature | one story |
| L: epic | 3 to 10 related stories |
| P: project | greenfield |
| R: research | a question to answer, ending in a research record |

- **S.** Run `accord new ticket <id> --lane S --worktree`; when config.yml has
  `people`, follow `./ids.md` and run it with `--type <story|bug>` and no id
  instead. Then follow `./lane-s.md` and `./security.md`. At step 6 of `./lane-s.md`, report the finish as `./finish.md` says.
- **M.** Run `accord new ticket <id> --lane M --worktree`; when config.yml has
  `people`, follow `./ids.md` and run `accord new ticket --type <story|bug>
  --lane M --worktree` with no id instead. It writes the ticket on its
  `branch` from `accord status --json`, commits it and pushes it; follow
  `./worktree.md`, and push it as that file says when the push fails.
- **R.** Run `accord new ticket <id> --lane R --worktree`; when config.yml has `people`, run it with
  `--type <story|bug>` and no id, as for M. Then follow `./lane-r.md`.
- **L and P.** Not built yet. Say so, and propose splitting the work into
  lane M tickets linked by `depends_on`.

## Rules

- Anything touching intent, a veto, an acceptance criterion, or a public
  interface stops the run and asks the owner. Every other decision on a
  ticket is a Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`.
  Read `./ask.md` before any question to the owner.
