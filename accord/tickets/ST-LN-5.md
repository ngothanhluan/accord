---
id: "ST-LN-5"                            # equals the file name: tickets/<id>.md
title: "An owner question gives its context in the chat, not inside the dialog"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# The epic this ticket belongs to.
# parent: "EPIC-ID"
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Optional design reference URL.
# design: "https://example.com/design/..."
# Written by `accord approve` after the owner says yes; never edit by hand.
# approved_hash:
# Written by `gate ready`; never edit by hand.
# ac_hash:
# Self-test ticks, e.g. [ac-1, ac-2]. Always the last key.
# verified: []
# The AC hash and the commit the ticks were made against.
# verified_hash:
# verified_commit:
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
In Claude Code a question dialog hides the chat written before it, so ASK-1 packed all context into the dialog,
which the owner finds hard to follow (D-02). For the owner, who works through a terminal and reads no code, at
every stage that asks. Success: after one reading the owner answers without asking back what the question is
about (D-05). Done when the shared ask.md says where a question goes, which kind to ask, and how to explain it,
and the intent skill follows it. Not: the docs/ design files, the panel, the benchmark, an owner trial.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-5

  @ac-1
  Scenario: the shared rule sends a question that needs context to plain chat
    Given the files `accord skills sync` writes for a config that enables every runtime, in every target directory, each read with every line break and the spaces or tabs around it as one space
    When a reader opens the ask.md beside the SKILL.md of each of accord, intent, approach, plan, build, review, verify, and debug
    Then each ask.md holds the sentence "A question that needs context to be understood is asked in plain chat, never in a question dialog, because the dialog hides the chat written before it: a few plain sentences of context, then the question, then lettered options, each saying what happens if it is chosen, the recommended one first." verbatim
    And each ask.md holds the sentence "A question dialog is used only when the question and its options are understood on their own in one line, such as 'Commit now?'." verbatim

  @ac-2
  Scenario: the shared rule says when to ask multiple choice and when to ask an open question
    Given the files `accord skills sync` writes for a config that enables every runtime, in every target directory, each read with every line break and the spaces or tabs around it as one space
    When a reader opens the ask.md beside the SKILL.md of each of accord, intent, approach, plan, build, review, verify, and debug
    Then each ask.md holds the sentence "Ask multiple choice when you can list two to four exclusive options, each with a consequence drawn from the code or the ticket; ask an open question, with no options, when the answer is in the owner's head, such as why, for whom, what success looks like, or what hurts today; offer a short menu only when the owner is stuck on an open question." verbatim

  @ac-3
  Scenario: the shared rule asks for plain words and drops the ASK-1 sentence
    Given the files `accord skills sync` writes for a config that enables every runtime, in every target directory, each read with every line break and the spaces or tabs around it as one space
    When a reader opens the ask.md beside the SKILL.md of each of accord, intent, approach, plan, build, review, verify, and debug
    Then each ask.md holds the sentence "Explain in plain words for an owner who reads no code: a file path or a symbol is only a pointer, never the explanation, and every id such as ac-2 or D-03 carries a short gloss." verbatim
    And no ask.md holds the text "may see only the question and its options" in any letter case

  @ac-4
  Scenario: the intent skill takes the kind of question from the shared rule
    Given the files `accord skills sync` writes for a config that enables every runtime, in every target directory, each read with every line break and the spaces or tabs around it as one space
    When a reader opens the SKILL.md of the intent skill in each target directory
    Then the numbered step that begins "One question per message", up to the next numbered step, holds the literal text `./ask.md`
    And the SKILL.md does not hold the text "multiple choice where possible" in any letter case
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The ticket also covers choosing the kind of question: multiple choice when the agent can list two to four exclusive options, each with a consequence drawn from the code or the ticket; an open question when the answer is in the owner's head (why, for whom, success, what hurts today); a menu only when the owner is stuck on an open question — "ok A. vì nếu build 1 project from idea thì cần rất nhiều brainstorming"
- D-02 In Claude Code, while the question dialog is open the owner sees none of the chat written just before it (observed 2026-10-18: five parts listed in chat, then a dialog asking to confirm them; the owner answered "5 phần này là gì?") — "tôi ko thấy gì hết."
- D-03 A question that needs context to be understood is asked in plain chat, not in the dialog: short context, the question, then lettered options each with its consequence, the owner typing the letter; the dialog is used only when the question and its options are understood on their own in one line, such as "Commit now?" — "A"
- D-04 Done is proven by text tests, as ASK-1 did: each rule must sit in the ask.md of every rendered skill directory, and the ASK-1 sentence "the owner may see only the question and its options" must be gone; no owner trial and no transcript check in this ticket — "A"
- D-05 Success: after reading a question once, the owner can answer it without asking back what it is about; the owner works through a terminal and does not read the code, so the context must be enough to choose or give feedback — "tôi nghĩ là A, vì chủ yếu tôi prompt với AI qua terminal, nên thường sẽ ko có cái nhìn trực quan vì ko đọc code. nên tôi cần context phải đủ hiểu để tôi có thể đưa ra lựa chọn hoặc feedback."
- D-06 Scope: ask.md takes the rules of D-01 and D-03 plus "explain in plain words; a file path is only a pointer, never the explanation"; step 5 of the intent skill ("multiple choice where possible") is aligned with D-01; the ASK-1 test follows the new text; the design documents under docs/, the panel, and the benchmark are out of scope — "A"
- D-07 The smallest version that counts as done is the whole of D-06: all three rules in ask.md (D-03, D-01, plain words) and the intent skill aligned — "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] Answered 2026-10-18 by D-01 to D-07. The owner (2026-10-15) found intent questions hard to follow because all context is packed into the question dialog: "format khi chạy intent đã ổn chưa? tôi thấy vẫn chưa ổn lắm. kiểu như dồn hết context vào môt dialog title. cũng khá khó để follow và hiểu context, sao ko học brainstorming thì superpowers." Proposal to confirm at intent: the context (what is known, what is decided, why now, an example) goes as short prose in the chat message; the dialog keeps a one-line question and short options, each with a one-line consequence; long comparisons go in the option preview. It changes `ask.md`, shared by every stage, which today says the owner may see only the question and its options (ASK-1).

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
