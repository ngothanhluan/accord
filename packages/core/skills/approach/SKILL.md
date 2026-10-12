---
name: accord-approach
description: Use when a lane M ticket has its intent and acceptance criteria and needs an approach. Chooses the lightest approach that works, has a critic argue against it, and takes the owner's explicit yes before accord approve.
license: MIT
kind: skill
---

This stage chooses how the ticket will be built, lightest first, and takes
the owner's yes before anyone plans. You run it in the main session.

## Steps

1. Run `accord anchor`.

2. **Options.** Dispatch `accord-architect` with the path of
   `accord/tickets/<id>.md`. It runs an impact analysis (callers,
   interfaces, tests, config, exports the change must reach) and proposes
   two or three options. The first option is always the lightest that
   works. Every added layer of complexity names the acceptance criterion or
   constraint that requires it, or is dropped.

3. **Critique.** Dispatch `accord-critic` in a fresh context, mode
   `approach`, with the path of the ticket file and the chosen option. It
   argues the strongest case against the chosen option and checks it
   against Vetoes, Decisions, and Corrections. This runs for every ticket
   in lane M and above.

4. **Write `## Approach`** in `accord/tickets/<id>.md`, about fifteen lines:

   - chosen option and why;
   - rejected options and why;
   - affected areas;
   - risks;
   - test strategy: which criterion is tested at which layer.

5. **The owner's yes.** Show the owner the brief and ask for an explicit
   yes. On yes, run `accord approve <id>`, then `accord gate ready <id>`
   and work from what it prints. Never run `accord approve` without the
   owner's yes in this conversation.

6. Next: `accord-plan`.

## Rules

- Every agent receives the ticket verbatim, by file path, never a summary.
- A later change to Intent, acceptance criteria, Vetoes, Decisions,
  Corrections, or Approach needs a new yes from the owner and a new
  `accord approve <id>`.
- Anything touching intent, a veto, an acceptance criterion, or a public
  interface stops the run and asks the owner. Every other decision is a
  Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`:
  `Ruling: <what> — <why> — <cost if wrong>`.
