---
kind: reference
---

`/accord` follows this file on `/accord queue <idea>` and on the queue route of `./route.md`; it notes an idea as a draft ticket for later. It never starts the work and never touches this session's branch or working tree, so it runs in a session that works a ticket as well as in the main checkout; it does not run the session check. With no argument, ask the owner for the idea in one question and write nothing.

## Queue an idea: `/accord queue <idea>`

1. Turn the idea into a short title in business language and one to four one-line notes. Write them in English, keeping the owner's own words where they are English; the owner may chat in another language, and tickets are English. Never add a point the owner did not make.
2. Pick the type, `story` or `bug`. Run `accord new ticket --queue --type <story|bug> --lane M --title "<title>" --note "<line>"` as `./similar.md` says, one `--note` per line. When config.yml has `people`, give no id and follow `./ids.md`; otherwise use the id the owner gives, or the next free one.
3. On exit 2 with `similar:` lines, judge them as `./similar.md` says; on any other exit 2, show the message and stop: nothing was written or pushed. The one exception is a message that says you are not registered: follow `./ids.md`, then run the command again. On exit 0 it has pushed one commit to a backlog branch cut from origin's default branch, holding the draft and, when that branch did not list you under `people`, your entry there, and printed the `branch:`, `base:`, `title:` and `merge:` lines, then a `people:` line when it committed your entry; do what that line says.
4. Open the pull request when `gh` is available with `gh pr create --head <branch> --base <base> --title "<title>" --body "<the idea>"`, using the lines it printed; otherwise show the `branch:` line and ask the owner to open it.
5. Read the `merge:` line.
   - `merge: at-once`: merge the pull request now with `gh pr merge <branch>` and `--merge`, `--rebase` or `--squash` as `git.merge` in config.yml says (absent: `--merge`). When that fails, show gh's message and leave the pull request open.
   - `merge: owner`: say the pull request waits for a person to merge it.
6. Report the id, the title and the pull request, and say the intent interview happens when someone starts the ticket.

## Rules

- Anything touching intent, a veto, an acceptance criterion, or a public interface stops the run and asks the owner; a queued draft carries only what the owner said. Read `./ask.md` before any question to the owner.
- Never merge with admin rights, never merge under `merge: owner`, and never push by hand: the command pushes.
- Never switch branches, stash, or change a file in this session's working tree, except the `people` entry `./ids.md` has you add and a `people:` line has you remove.
