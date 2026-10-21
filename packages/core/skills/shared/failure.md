---
kind: reference
---

# A failure found after verify

A failure is found after verify when ticket <id> has reached verify
(`accord anchor` prints `verify` or `done`, or the ticket has
a `verified_commit:` or an `accord/tickets/<id>/verification.md`, so a
ticket back at `review` for an earlier fix counts), its pull request is
not merged (`gh pr view <branch> --json state` does not print `MERGED`),
and either
someone reports a failure in its work, with or without the failing
command and its output, or verify finds a failed check on that pull
request. A failure after the merge is not one: it needs a new bug ticket.

1. Never judge the cause yourself, and never dispatch a fix outside
   `accord-debug`: no executor, no edit, and no Ruling in place of a
   root cause.
2. When this session is not in that ticket's worktree, first run
   `accord worktree open <id> --continue` and follow the accord skill's
   `./worktree.md`, then Continue's step 2 only; after a `stop:` line,
   ask the owner to type, in the session opened there, `/accord <id> `
   followed by the report, in place of the line it prints, and stop here.
   When it printed `enter:`, or this session is already in that worktree,
   in place of Continue's steps 3 and 4, load
   `accord-debug` for that ticket: a new episode, or the open one when
   the last `## ` heading of
   `debug.md` is not `## Resolved`. Pass the debugger the report as given;
   when it names no failing command or output, say so, and the debugger
   finds them itself, for a failed check with
   `gh run view <run-id> --log-failed`.
3. A failure only another operating system shows (a CI check, or a test
   skipped here): its red is the CI log, and its green is that check
   passing at the next verify. Give the debugger, and the executor in
   its brief, the failing check's log as the failing output, and say
   the reproduction test is skipped on this operating system. After
   the fix, go on to the stage `accord anchor` prints, without
   `## Resolved` (`done`: `accord-verify` at step 6, whose Finish
   closes the episode). The episode stays open
   across that verify and keeps its count of failed fixes: the check
   passing there resolves it, the check failing there counts one failed
   fix in it.
4. After the fix, `accord anchor` prints `review` and a `Review base:`
   line: the fix gets its own review round, then verify runs again.
