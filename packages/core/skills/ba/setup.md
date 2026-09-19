---
kind: reference
---

# Week zero: the product documents and the epics

This is the `build` profile branch, and it runs once. A new project starts
with nothing written down, so the first work is not a story — it is the
language the stories will be written in and the epics they will hang off.
When this is done, every later ticket takes the `./story.md` branch.

## 1. `accord/product/glossary.md`

One entry per term the project's language depends on: the word the team
actually uses, and what it means to the business, in one sentence. Tickets and
agents then use those words verbatim instead of each story redefining them.

Only the terms that are genuinely load-bearing. A glossary that defines
everything is read by nobody.

## 2. `accord/product/business-rules.md`

One bullet per rule, threshold, tolerance, rounding convention, or edge case
that is already decided. A story that depends on a rule cites it instead of
restating it, so the rule has one home and one wording.

When a rule was chosen over an alternative, record the loser directly beneath
the rule it explains:

- Amounts are rounded to two decimal places, half away from zero
  - `Rejected: banker's rounding — the finance team reconciles against a
    system that rounds half away from zero`

Whoever meets the rule next then finds the argument instead of re-proposing the
option that already lost. Nothing validates the line and no gate reads it; it
is a convention, and its whole value is that the reasoning outlives the person
who had it.

## 3. One epic ticket per epic

Run `accord new ticket <id> --type epic` for each one, and fill in `## Intent`
and `## Requirements` only.

Acceptance criteria are not written here. They are written per story, just
before that story enters the sprint, by the `./story.md` branch. An epic is
never gated, so criteria written now have nothing to be checked against, and
criteria written weeks before the work are criteria written against a guess.

## 4. Hand back

Week zero is finished when every term the epics use is in the glossary, every
decided rule is in the business rules, and every epic has a ticket. From then
on this stage opens on `./story.md`.
