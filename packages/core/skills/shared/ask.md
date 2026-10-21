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

Write short, plain sentences in every text written for the owner in chat, in
any language. That covers questions, the In plain words lines at a yes,
reports, open findings when review stops, and the closing skipped and risk
lines. A sentence holds one idea and at most 25 words, counting the tokens
separated by spaces. Use the active voice, one word for one concept, and no
idioms. Ticket content such as EARS or Gherkin, repository files, and CLI
output keep their own form.
