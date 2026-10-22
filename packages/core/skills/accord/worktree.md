---
kind: reference
---

# Working a ticket in its own worktree

Only a session rooted in a ticket's worktree works that ticket, so no session ever switches tickets.

A session that follows an `enter:` line moves into the ticket's worktree and works only that ticket from then on.

For Continue, `accord worktree open <id> --continue` also finds a ticket whose file is only on its claim
branch, here or on `origin`. When it exits 2 with a line starting `not a ticket:`, the text is a New
request. A line starting `not claimed:` means nobody has claimed the ticket: say so, offer Pick up, and
never claim it.

When Pick up's `accord worktree open <id>` exits 2 with a line starting `claimed:`, another person
holds the claim: push nothing, show the message and stop. Offer `/accord continue <id>` only when the
owner means to work on the ticket with them. When `accord worktree open <id>` did not refuse with `claimed:`, push the claim with
`git push -u origin <branch>` before anything else, even when a setup command failed.

What `accord worktree open <id>` and `accord new ticket --worktree` print:

- A line `pruned <path>: <reason>`: git dropped its record of a worktree whose folder is gone; show the
  line verbatim and go on with the other lines.
- A line starting `fetch from origin failed`: the fetch before the work failed, or the remote did not
  answer in time. Show the line verbatim and go on with the other lines; the work goes on with the refs
  already in this clone.
- A line starting `behind:` (Continue only): the ticket branch lacks commits that are on the remote's
  default branch. Show the line verbatim and go on. Never merge here: `accord-verify` runs
  `accord worktree merge <id>` once, after review.
- A line `stop:`: show the two lines after it verbatim, the worktree's path and the line to type in a
  session opened in that folder, then stop. Never change directory into the worktree, never edit a file
  there except the people entry below and, in a lane S ticket, its `title:`, the carried `Keys:` frontmatter lines, its `## Understood` and `## Done when` lines and the commit and push of that ticket file, and never start the next stage from this session.
- `enter: <path>` (printed instead of `stop:` when this session can move into the worktree): this session
  moves into the worktree. First, when Pick up made the claim, push it with `git push -u origin <branch>`
  as above, and carry any people entry as below; then call EnterWorktree with `path` set to `<path>`, and
  go on at Continue step 2 (`accord anchor`) without asking. From then on every command, path and edit is
  in the worktree. When EnterWorktree fails, show `<path>`, say "type `/accord continue <id>` to retry, or
  close this session and open one in that folder", and stop, editing nothing.
- `held: <id> by this session`: this session holds the ticket; go on with the next step.
- `not held:`: this tool does not refuse a second session yet; say so in one line and go on with the
  next step.
- Exit 2 naming the session that holds the ticket: show the message and stop, editing nothing.
- Exit 2 naming a setup command: show the message and stop. The worktree is kept; once the owner fixes
  the command, they type `/accord continue <id>` again in this same session and follow the `enter:` or
  `stop:` line it prints. The run that prints `enter:` has already run every setup command again; after a
  `stop:` line, `/accord continue <id>` in a session opened there runs every setup command again.
- Exit 2 starting `this session works`: this session works another ticket; show the message and stop,
  editing nothing.
- Any other exit 2: show the message and stop.

Setup commands can take minutes: run these commands with the longest timeout your tool allows.

When `./ids.md` had you add an entry under `people` before `accord new ticket --worktree`, carry it to the
worktree before you stop or move into it: add the same entry to `<path>/accord/config.yml`, run
`git -C "<path>" commit -m "people: <email>" -- accord/config.yml` and
`git -C "<path>" push -u origin <branch>`, then remove that entry, and only that entry, from
`accord/config.yml` here, leaving every other line of the file as it is.

When `accord new ticket --worktree` says the push failed, it prints no `stop:` line: carry any people
entry as above, run the push it names, and once it succeeds, run `accord worktree open <id> --continue`
and follow the `stop:` or `enter:` line it prints. When that push fails again, show git's message and stop.

`accord worktree clean` runs only from `/accord` with no argument, never from Pick up or Continue. At the
dashboard its lines are shown verbatim with the dashboard's.

## Session check

Run it before the dashboard and before every New request, in every lane, also a New request picked from the
dashboard; never before Pick up or Continue on a named ticket. Run `accord worktree check`.

- Exit 0: go on.
- Exit 2 with a message that starts `this session works`: this session works the ticket it names. Show the
  message. For the dashboard, go on with it, and offer only Continue on that ticket. For a New request, stop:
  write, create, claim and edit nothing, except a New request that reports a failure in a ticket that has
  reached verify: follow `./failure.md`.
- Any other exit 2: show the message. For the dashboard, go on with it; for a New request, stop, editing
  nothing.
