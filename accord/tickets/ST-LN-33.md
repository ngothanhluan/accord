---
id: "ST-LN-33"                            # equals the file name: tickets/<id>.md
title: "Text for the owner is written in short, plain sentences, and the benchmark measures it"
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
Why: the owner reads long sentences at every stop (questions, the yes, the verify report); a rule near ASD-STE100 makes them easier to read (Karpathy's tip, D-01).
For whom: the owner, in any chat language, in every text written for them in chat (D-03).
Success: every rendered ask.md and the session rules hold the rule (D-02), and the benchmark reports, for each main session, the share of owner-facing sentences longer than 25 words (D-04, D-05); at verify the owner compares one run without the rule and one with it (D-06).
Not: ticket content (EARS, Gherkin), repository files, CLI output, STE's English dictionary, or a pass or fail threshold (D-05).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-33

  @ac-1
  Scenario: every rendered ask.md holds the writing rule for the owner
    Given the files `accord skills sync` writes for a config that enables every runtime, in every target directory, each read with every line break and the spaces or tabs around it as one space
    When a reader opens each stage's ask.md
    Then it holds the literal texts "every text written for the owner", "in any language", "at most 25 words", "separated by spaces", "one idea", "active voice", "one word for one concept", and "no idioms"
    And every line that is not blank in the ask.md it rendered before this ticket is still in it, word for word and in the same order

  @ac-2
  Scenario: the session rules carry the sentence limit
    Given the rules text that the session-start hook injects
    When it is filled with the invocation `npx --yes @accord-dev/accord@` followed by the package's own version
    Then it holds the literal text "at most 25 words"
    And it is under 2048 bytes and still holds every text its tests checked before this ticket

  @ac-3
  Scenario: the benchmark counts only the owner-facing sentences of a main session
    Given a main-session transcript whose assistant text blocks hold a sentence of 25 words, a sentence of 26 words, a list line without a full stop, a fenced code block of 40 words on one line, a table line of 30 words whose first character that is not a space is "|", and a sentence of 10 words that holds a "|" after its first word, and whose user messages, thinking blocks, and tool calls each hold a sentence of 30 words
    When the benchmark's sentence counter reads it
    Then it counts the four sentences from the assistant text outside the fence and the table line, and no sentence from the fence, the table, the user messages, the thinking blocks, or the tool calls
    And it ends a sentence at a ".", "?", or "!" followed by a space or a line end, and at every line end
    And a word is a run of characters without spaces that holds at least one letter or digit, so "—", "|", "-", and "**" are not words
    And it marks the 26-word sentence as long and does not mark the 25-word sentence

  @ac-4
  Scenario: the benchmark report shows the sentence lengths of each main session
    Given a transcript folder that holds two main sessions, each recorded on its own branch, and one subagent run
    When `node scripts/benchmark.mjs` runs in the repository with that folder as its one argument
    Then the report holds a section "## Sentence length in owner-facing text" with one row per main session, holding its start date as the UTC date of its first transcript record, its branch, its sentence count, the count and percent of sentences longer than 25 words, and the word count of its longest sentence
    And under that table it quotes the three longest sentences across those sessions, each with its word count
    And outside the quoted sentences, that section holds neither "pass" nor "fail" as a whole word
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->
(none)

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The parts are: (1) a light ASD-STE100 rule: about 20 words or fewer a sentence, one idea a sentence, active voice, one word for one concept, no idioms; (2) it applies to the questions to the owner, the "In plain words" lines at the intent and approach yes, and the verify report; (3) in any chat language, without STE's English dictionary; (4) not ticket content (EARS, Gherkin), repository files, or CLI output — "ok"
- D-02 Done is proven by a literal-text test that the rule is in every rendered ask.md, plus a benchmark score of the sentence lengths in owner-facing text from main-session transcripts — "A"
- D-03 The rule covers every text written for the owner in chat, also the debug architecture question, the open findings when review stops, and the closing skipped/risk lines; this widens part (2) of D-01 — "A"
- D-04 Sentence length is counted as space-separated tokens, with one limit of 25 for every chat language; this settles "about 20 words" in D-01 — "A"
- D-05 The smallest done: the rule in ask.md plus one short line in the session rules, and a benchmark that reports per session the share of sentences longer than 25 with the longest as examples, with no pass or fail threshold — "A"
- D-06 Verify holds a human test: the same request is run once without the new rule and once with it, and the owner compares the two side by side before approving — "nghĩa là chạy một bản khi chưa apply rule mới, và một bản rule mới. đối chiếu so sánh."

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- "A. phần verify cần human test" — then, on what that means: "nghĩa là chạy một bản khi chưa apply rule mới, và một bản rule mới. đối chiếu so sánh."

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
(none)

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
