---
kind: reference
---

`/accord` follows this file with the whole text once `./route.md` reads a request as a change or as research, and it starts a New request.

First run the session check in `./worktree.md`. A failure reported in a ticket that has reached verify follows `./failure.md`. When the request reads as another route of `./route.md` (a question, a brainstorm, a queued idea as `./queue.md` says, a review of code accord did not build, which loads `accord-review-pr`), say so and follow that route instead of proposing a lane.

## New request

Propose a lane as `./lane.md` says, for every new request however small it looks; the owner may override. Check and save the scout's reply as `./scout.md` says.

| Lane | Example |
|---|---|
| S: small fix | bug, copy change, one flag |
| M: feature | one story |
| L: epic | 3 to 10 related stories |
| P: project | greenfield |
| R: research | a question to answer, ending in a research record |

- **S.** Run `accord new ticket <id> --lane S --worktree --title "<title>"` as `./similar.md` says; when config.yml has
  `people`, follow `./ids.md` and run it with `--type <story|bug>` and no id
  instead. Then follow `./lane-s.md` and `./review-security.md`. At step 6 of `./lane-s.md`, report the finish as `./finish.md` says.
- **M.** Run `accord new ticket <id> --lane M --worktree --title "<title>"` as `./similar.md` says; when config.yml has
  `people`, follow `./ids.md` and run `accord new ticket --type <story|bug>
  --lane M --worktree --title "<title>"` with no id instead. It writes the ticket on its
  `branch` from `accord status --json`, commits it and pushes it; follow
  `./worktree.md`, and push it as that file says when the push fails.
- **R.** Run `accord new ticket <id> --lane R --worktree --title "<title>"` as `./similar.md` says; when config.yml has `people`, run it with
  `--type <story|bug>` and no id, as for M. Then follow `./lane-r.md`.
- **L and P.** L follows `./new-epic.md`. P is not built yet: say so, and propose
  an epic instead.

## Rules

- Anything touching intent, a veto, an acceptance criterion, or a public
  interface stops the run and asks the owner. Every other decision on a
  ticket is a Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`.
  Read `./ask.md` before any question to the owner.
- Never dispatch the researcher from this skill, at the lane step or on any lane's route: an outside library, API or version the
  request names is looked up once per library at the discuss step of `./intent.md`, after the ticket exists.
