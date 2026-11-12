---
name: accord-intent
description: Use when a lane M ticket needs its intent captured, or when /accord routes a new request here. Runs the intent interview that writes the ticket's Intent, acceptance criteria, Vetoes, Decisions, and Corrections, so later stages cannot drift from what the owner meant.
license: MIT
kind: skill
loads: [shared/ask.md, shared/scout.md, accord/ids.md, accord/lane.md, intent/research.md, intent/discuss.md]
---

This stage writes down what the owner means, in the ticket, before anyone
plans or builds. You run it in the main session.

## Steps

1. Run `accord anchor`. If the ticket file does not exist yet, `/accord`
   creates it first: start there.

2. **Look before asking.** Dispatch `accord-scout` with the path of
   `accord/tickets/<id>.md` and the questions the code can answer. Check its
   reply as `./scout.md` says, and save it as `accord/tickets/<id>/scout.md`
   only when that file does not exist. Never ask the owner what the code answers. A question about an existing project
   cites the file that prompted it. Before any question, read `./research.md`.

3. **Confirm the parts.** Before the first score, list the request's
   top-level parts and ask the owner to confirm them.

4. **Score ambiguity** from 0 to 1 on four dimensions: goal, scope boundary,
   constraints, acceptance; 0 is unambiguous, 1 is unknown. Show the owner
   the four scores after each round. No dimension may stay above 0.4. Stop
   when the total (the mean) is 0.2 or less with no dimension above 0.4, or
   when the owner says "enough".
   Before you stop, ask once for the smallest version that still counts as
   done, and once how many plan tasks the work should take: the answer is N
   in the Intent line `Expected size: <N> tasks`, and `accord gate plan`
   refuses a plan of more than 2 × N tasks unless the owner allows it.
   On "enough", write `Ruling: interview stopped by the owner at <score>`
   into `accord/tickets/<id>/ledger.md` under `## Rulings`.

5. **One question per message**, aimed at the dimension with the highest
   score; which kind of question to ask, and how, follows `./ask.md`.

6. **Write the ticket** `accord/tickets/<id>.md`, each section as follows:

   | Section | Content |
   |---|---|
   | `## Intent` | at most five lines: why, for whom, success measure, non-goals; then one line `Expected size: <N> tasks`; you draft, the owner approves |
   | `## Acceptance criteria` | two to five Gherkin scenarios, `@ac-1` … `@ac-n`; you draft, the owner approves |
   | `## Vetoes` | what the owner forbids, in the owner's words |
   | `## Decisions` | settled answers in the owner's words: `- D-01 <decision> — "<the owner's sentence>"` |
   | `## Corrections` | every "no, I meant…", verbatim, append-only, written before any other action |
   | `## Open questions` | each unanswered question as an unchecked `- [ ]` item |

   Before you rewrite a queued Intent, follow `./research.md`.

7. **Write back** your understanding. Separate what the owner said from what
   you assumed, and invite correction.

8. **Audit once.** Dispatch `accord-auditor` with only the path of the
   ticket file. A criterion it reads two ways goes back to the owner as a
   question. Then commit `accord/tickets/<id>.md`, with the ledger if it
   changed.

9. **Discuss.** Run `accord gate ready <id>`. When it names `gate.discuss-missing` or `gate.discuss-unmapped`,
   follow `./discuss.md`; otherwise the ticket was claimed before the discuss stage and goes on. Ask no yes here:
   the owner approves once, at accord-approach step 5.

10. Next: `accord-approach`.

## Rules

- Every agent receives the ticket verbatim, by file path, never a summary.
- A correction goes into `## Corrections` verbatim before any other action.
  A correction that exists only in the conversation is lost at the next
  compaction.
- Anything touching intent, a veto, an acceptance criterion, or a public
  interface stops the run and asks the owner. Every other decision is a
  Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`:
  `Ruling: <what> — <why> — <cost if wrong>`.
  Read `./ask.md` before any question to the owner.
- **Lane S.** Before step 9, when the interview shows the request fits lane S (none of the four lift conditions in `./lane.md` holds, judged on what `accord-scout` reports), no ticket that `accord status --json` lists names this one in `depends_on`, and both
  `git diff --name-only <origin's default branch>...HEAD` and `git status --porcelain --untracked-files=all` list
  only `accord/tickets/<id>.md`, paths under `accord/tickets/<id>/` and the records `./research.md` counts as its own,
  propose moving it to lane S, with the
  reason. Move it only on the owner's yes, as `## Moving to lane S` in `./ids.md` says; otherwise say why it stays
  lane M. From step 9 on, a lane never drops.
