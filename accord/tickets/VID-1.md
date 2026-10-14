---
id: "VID-1"                            # equals the file name: tickets/<id>.md
title: "Short title in business language"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
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
A plan `verify:` id holding `@` splits the scenario's `@test:` tag in two, so `gate done` can never pass; one
holding a comma is split into two ids on the `verify:` line, so `task-done` can never find it (dogfood items 3, 20).
For the owner and the planner writing a lane M plan. Done when `accord gate plan` fails on either id and the
planner and executor say a test name holds neither. Not: junit id normalisation, `accord/tests-baseline.txt`,
renaming existing tests whose names hold a comma.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: VID-1

  @ac-1
  Scenario: gate plan fails on a verify id whose test name holds an at sign
    Given a lane ticket whose plan passes every plan rule
    And one task's verify line names the id src/x.test.ts#@test-ac-1-writes
    When the owner runs accord gate plan for that ticket
    Then the result carries an error naming that id
    And the verdict is fail with exit code 1

  @ac-2
  Scenario: gate plan fails on a verify id whose path holds an at sign
    Given a lane ticket whose plan passes every plan rule
    And one task's verify line names the id packages/@scope/x.test.ts#writes
    When the owner runs accord gate plan for that ticket
    Then the result carries an error naming that id
    And the verdict is fail with exit code 1

  @ac-3
  Scenario: gate plan fails on a comma inside a verify id
    Given a lane ticket whose plan passes every plan rule
    And one task's verify line reads src/x.test.ts#refuses-x,-exit-2
    When the owner runs accord gate plan for that ticket
    Then the result carries an error naming src/x.test.ts#refuses-x,-exit-2 whole, as written
    And the verdict is fail with exit code 1

  @ac-4
  Scenario: a marker and a comma between ids are accepted
    Given a lane ticket whose plan passes every plan rule
    And one task's verify line reads src/x.test.ts#writes (@ac-1), src/y.test.ts#risk:data-loss-quotes
    When the owner runs accord gate plan for that ticket
    Then the result carries neither the at sign error nor the comma error

  @ac-5
  Scenario: the planner and the executor say a test name holds no at sign and no comma
    Given the rendered output of the planner and executor agents
    When a reader looks for the rule on test names
    Then each holds the sentence "A test name never holds `@` or a comma." verbatim
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->
(none)

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Three parts: `accord gate plan` rejects a verify id holding `@` (the `(@ac-n)` marker excepted) and a comma inside an id (one touching a non-space character on both sides, not a separating comma followed by a space); the planner and executor say a test name holds neither. The checks live in `gate plan`, because `accord lint` never reads `plan.md`. Not: junit id normalisation, `accord/tests-baseline.txt`, existing tests whose names hold a comma — "Đúng (Recommended)"
- D-02 Both rules are errors on both profiles: such an id can never pass `task-done` or `gate done` — "error (Recommended)"
- D-03 An `@` anywhere in the id is rejected, in the path as well as the test name, because the Gherkin tag splits either way; a test under a directory holding `@` cannot be named on a verify line until a later ticket escapes tags — "Chặn mọi `@` (Recommended)"
- D-04 The smallest version is all three parts: both rules and the text — "Cả ba phần (Recommended)"
- D-05 (audit) The comma error names the whole whitespace-free text holding the comma, as written on the verify line, so the planner finds it at once — "Cả id như viết (Recommended)"
- D-06 (audit) Both agents hold one fixed sentence, checked verbatim by a test over the rendered agents; every runtime renders from the same source, so one render output suffices — "Câu cố định, test đọc bản render (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
