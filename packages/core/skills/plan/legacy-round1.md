---
kind: reference
---

# Round 1 of the plan critique of a ticket claimed under an older accord

Read this file only when `accord round <id> --plan` printed no `Critics:`
line at round 1: the ticket was claimed under an older accord, and step 1 of
`./critique.md` sent you here. Round 1 dispatches as below; every later
round, the record, the owner, convergence and the fix are those of
`./critique.md`, and the cap and stop are what `accord round <id> --plan`
prints for this ticket (five rounds and the stop from round 3).

Count the `## Task` sections of `plan.md` and judge from the ticket and the
plan whether the ticket touches auth, money, migration, or data deletion, or
the plan touches a path under `sensitive:` in `accord/config.yml`. Dispatch
in parallel, each in a fresh context, mode `plan`, with the paths of the
ticket and `plan.md`:

- one `accord-critic` with no named checks for a plan of one to three tasks;
- two critics for a plan of four or more tasks, one told to run only the
  first, second, third, fifth and seventh checks under `Mode plan:` and one
  only the fourth and sixth;
- one more critic, lens `security`, for a plan of any size whose ticket
  touches auth, money, migration, or data deletion, or whose plan touches a
  path under `sensitive:` in `accord/config.yml`, so at most three.

A critic running every check or the first group, and every `diff` critic,
checks the plan against every Decision and every Correction of the ticket.

Then merge and de-duplicate their findings into one round, numbered within
it, as step 1 of `./critique.md` says.
