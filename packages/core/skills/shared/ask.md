---
kind: reference
---

# Asking the owner

A question that needs context to be understood is asked in plain chat, never in
a question dialog, because the dialog hides the chat written before it: a few
plain sentences of context, then the question, then lettered options, each
saying what happens if it is chosen, the recommended one first, with one
sentence on why it is recommended. A question dialog is used only when the
question and its options are understood on their own in one line, such as
'Commit now?'.

Ask multiple choice when you can list two to four exclusive options, each with
a consequence drawn from the code or the ticket; ask an open question, with no
options, when the answer is in the owner's head, such as why, for whom, what
success looks like, or what hurts today; offer a short menu only when the owner
is stuck on an open question.

Explain in plain words for an owner who reads no code: a file path or a symbol
is only a pointer, never the explanation, and every id such as ac-2 or D-03
carries a short gloss.

## Recording a rule or a refused option

In a ticket's stage, when the owner states a rule meant to last beyond this
ticket, overrides a step of a skill, or refuses an option, offer one line to
record, in English: the rule as one line, or `Rejected: <option> — <reason>`
with the owner's reason. On an explicit yes, add it as `- <the line>` under the
ticket ledger's `## Conventions` (create the section) and commit it with the
stage's next record commit; `accord-verify` step 6 and lane S's finish write
every line of that section into `accord/product/conventions.md`. Without an
explicit yes write nothing anywhere. A dropped ticket's refused option travels
with `accord drop --rejected` instead.

For a story with `parent:`, a Ruling or lesson that holds for the whole epic is
offered too. On an explicit yes write `- Lesson: <lesson> — "<the owner's
words, in English>"` under `## Epic lessons` in that story's own ledger and
nowhere else, never in a shared file or in another ticket's folder: a later
story of the epic reads it once this story is on the default branch.

Outside a ticket's stages offer nothing.
