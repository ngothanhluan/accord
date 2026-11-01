---
name: accord-approach
description: Use when a lane M ticket has its intent and acceptance criteria and needs an approach. Has the planner draft the lightest approach that works, has a critic argue against it in capped rounds, and takes the owner's explicit yes before accord approve.
license: MIT
kind: skill
loads: [approach/critique.md, shared/ask.md]
---

This stage chooses how the ticket will be built, lightest first, and takes
the owner's yes before anyone plans. You run it in the main session.

## Steps

1. Run `accord anchor`.

2. **Options.** Dispatch `accord-planner` in its `direction` mode with the path of
   `accord/tickets/<id>.md`. It writes no file. Its report holds an impact
   list naming file and line, two or three options in ladder order with the
   lightest that works first, each added layer naming the criterion or
   constraint that requires it, and, when the ticket touches auth, money,
   migration, or data deletion, three failure scenarios in total with how
   each is undone. The chosen option is the one it marks `Recommended`,
   unless the owner has already picked another. Write into `## Approach`
   only the chosen option's name, what it does, and the impact list, never
   its reasons, its risk line, the other options or the `Recommended` line,
   so the critic's review stays independent. Write the ladder Ruling of
   `./critique.md` into `accord/tickets/<id>/ledger.md`. When a new session
   or a revision needs the planner again, dispatch it in `direction` mode
   with the name of the option `## Approach` names: it keeps that option,
   and nobody picks again. Commit `accord/tickets/<id>.md` and
   `accord/tickets/<id>/ledger.md`; keep the report for steps 3 and 4.

3. **Critique.** Run the loop in `./critique.md`, running
   `accord round <id> --approach` before each round. One `accord-critic` in a
   fresh context, mode `approach`, argues the strongest case against the
   chosen option and checks it against Vetoes, Decisions, and Corrections,
   for every ticket in lane M and above. A Must that would break a Veto,
   Decision, or Correction rules the option out, and the first option of
   the ladder Ruling that is not yet ruled out takes its place, as
   `./critique.md` says; when none is left, ask the owner.

4. **Write `## Approach`** in `accord/tickets/<id>.md`, in full, about fifteen lines:

   - a `- Chosen:` line, the option and why;
   - one `- Rejected: <option> — <why>` line per other option the ladder
     Ruling names, the why taken from its `## Closed` heading or the
     Ruling's `Recommended` line;
   - affected areas, from the impact list;
   - risks: every critic finding the chosen option keeps, Must findings
     first, so the owner approves with them in view; for a ticket that
     touches auth, money, migration, or data deletion, each of the three
     failure scenarios and how it is undone;
   - test strategy: which criterion is tested at which layer.

   Commit `accord/tickets/<id>.md` and `accord/tickets/<id>/approach-review.md`, with the ledger if it changed.

5. **The owner's yes.** Run `accord show <id> --approval`; if it fails, stop and tell
   the owner. Paste its output, which holds every approved section, unchanged, as Markdown, not inside a code
   block; below it put a horizontal rule, a heading "In plain words" written in the chat language, and one line
   per scenario that begins with its ac-n and says in plain words what it means; and ask for an explicit yes.
   The question
   names the text above it and `accord/tickets/<id>.md`. Say that the yes
   also approves the ticket's Intent, acceptance criteria, Vetoes,
   Decisions, and Corrections as written: the approval covers them all. On
   yes, run
   `accord approve <id>`, then `accord gate ready <id>` and work from what it
   prints. When it says a `depends_on` ticket is not done on the default
   branch, never remove that entry from `depends_on`: tell the owner this
   ticket waits for that ticket's merge, then after the merge run `git fetch`
   and `accord gate ready <id>` again. Then commit the ticket, with `approved_hash:` and `ac_hash:` in
   it, and the ledger if it changed. Then run `accord worktree push <id>`; go on even if it fails. If the
   owner picks another option, append
   `## Closed <option>: the owner picked <other option>` to
   `accord/tickets/<id>/approach-review.md`, write that option into
   `## Approach` as step 2 says, go back to step 3 with that option, and ask
   again. On any other no, write the owner's words under `## Corrections`
   first, append `## Closed <option>: the owner's no` to
   `approach-review.md`, empty `## Approach` below its heading, go back to
   `accord-intent` step 8, and restart this stage at step 2.
   `accord approve` runs only on a yes to the sections as shown. Never run
   `accord approve` without the owner's yes in this conversation.

6. Next: `accord-plan`, only once `accord gate ready <id>` passes. While it
   fails, the commit in step 5 carries `approved_hash:` alone; after its push,
   stop and tell the owner that `/accord continue <id>` plans the ticket once
   the gate passes.

## Rules

- Every agent receives the ticket verbatim, by file path, never a summary.
- A later change to Intent, acceptance criteria, Vetoes, Decisions,
  Corrections, or Approach needs a new yes from the owner and a new
  `accord approve <id>`.
- Anything touching intent, a veto, an acceptance criterion, or a public
  interface stops the run and asks the owner. Every other decision is a
  Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`:
  `Ruling: <what> — <why> — <cost if wrong>`.
  Read `./ask.md` before any question to the owner.
