---
kind: reference
---

# Writing one story

This is the per-story branch. It fills one ticket, in this order, and ends
when `accord gate ready <id>` passes.

Size discipline first, because it governs everything below: about five lines
of intent, five to fifteen requirement lines, two to five scenarios. If the
spec is longer than the code it describes, the spec is wrong.

## 1. `## Intent`

Why this story exists, for whom, how anyone would know it worked, and what it
deliberately does not cover. In business language: never name tables,
endpoints, libraries, or screens. A term the business uses belongs in
`accord/product/glossary.md`, and a rule already decided belongs in
`accord/product/business-rules.md`; cite them here rather than restating them.

## 2. `## Requirements`

One EARS line per requirement, each in one of six shapes. Write the shape the
requirement actually is — the classifier reads the keywords, and a line that
is none of the six is reported by `accord lint` at its line number.

- Ubiquitous, always true:
  `The system shall record the time every approval was granted.`
- State-driven, true while something holds:
  `WHILE an order is unpaid, the system shall show its outstanding balance.`
- Event-driven, triggered by something happening:
  `WHEN a customer submits a refund request, the system shall send them a
  confirmation.`
- Unwanted behaviour, an undesired condition and its response:
  `IF the payment provider returns an error, THEN the system shall keep the
  order unpaid and show the provider's message.`
- Optional feature, true only where a feature is present:
  `WHERE the tenant has multi-currency enabled, the system shall display
  amounts in the tenant's default currency.`
- Complex, more than one of the above on one line:
  `WHILE a promotion is running, WHEN a customer applies a second discount
  code, the system shall reject the second code.`

## 3. `## Acceptance criteria`

Gherkin in one fenced block, every scenario tagged `@ac-1`, `@ac-2`, and so
on, with a unique number each. Two to five scenarios for a story.

Write each scenario as an outcome someone could watch happen, not as a
description of how the code will do it. A bug fix is written as Given the
situation, When the action, Then the correct result. A Scenario Outline with
three examples is one scenario, not three.

## 4. `## Open questions` and `assumptions:`

Anything still undecided goes into one of these two and never into a guess: an
unchecked `- [ ]` item under `## Open questions`, or an entry under
`assumptions:` in the frontmatter with `confirmed: false`. Writing them down
rather than resolving them in your head is the point.

This applies hardest to business logic: a threshold, a rounding rule, a
tolerance, or what happens at zero. Whoever owns the business decides those.
You record the question.

## 5. The readiness review

Hand a fresh context `./ready.md` and nothing else. Do not run it inline: you
would be grading acceptance criteria you had just written, which is the one
thing the separate context exists to prevent.

Answer the questions it writes into `## Open questions`, then continue.

## 6. The gate

Run `accord gate ready <id>` and fix what it names. Then run `accord lint` and
read what it reports.

Once `accord gate ready <id>` passes, the acceptance criteria are recorded as
they stand. Changing them afterwards has a consequence `accord gate done <id>`
reports, so a scenario that turns out to be wrong is re-opened deliberately,
not edited in passing.
