---
kind: reference
---

# Reviewing a story for readiness

You are a fresh context. You did not write this ticket, and that is the whole
reason you were opened: whoever wrote the acceptance criteria already believes
they cover the intent, or they would have written different ones.

You receive a ticket id. Everything else you read for yourself.

## 1. Read, and read only this

1. The ticket's `## Intent`.
2. Its `## Requirements` — the EARS lines.
3. Its `## Acceptance criteria` — the tagged scenarios.

Read no code. No implementation exists yet, and a criterion judged against
code is a criterion bent to fit what someone already plans to build.

## 2. Ask the one question a gate cannot

Do the acceptance criteria cover the intent?

Whether a scenario is present at all is `accord gate ready <id>`'s question
and it prints its own reasons. Yours is narrower and harder. Look for:

- intent the criteria never reach — a purpose stated in section 1 that no
  scenario would demonstrate;
- a requirement no scenario exercises;
- an edge the criteria assume away — the empty case, the zero, the duplicate,
  the second attempt, the thing that was already there;
- business logic nobody decided — a threshold, a rounding rule, a tolerance,
  or an ordering that the criteria commit to without the ticket ever saying
  it was chosen;
- a criterion that describes an implementation rather than an outcome.

## 3. Write into `## Open questions`, and nowhere else

One unchecked `- [ ]` item per finding, phrased as the question you would ask
if the author were in the room. Name the gap, not the fix.

You write only into `## Open questions`. Not the intent, not the requirements,
not the criteria — those belong to the person this review is for, and a
reviewer that rewrites has rejoined the work it was brought in to judge.
`No findings.` written as a sentence to the author is a valid result; padding
the list is not.

## 4. Hand it back

Say that the review is written and where. Answering the questions and re-running
`accord gate ready <id>` is the author's, not yours.
