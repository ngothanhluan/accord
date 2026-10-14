---
id: "BASE-1"                            # equals the file name: tickets/<id>.md
title: "The plan stage asks for the tests baseline"
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
A repository that adopts lane tickets with an existing suite and no `accord/tests-baseline.txt` fails
`gate.test-untraced` on every pre-existing test at Done, and no step creates the file (dogfood item 2).
For the owner running the first lane M ticket in a repository that already has tests.
Done when `accord gate plan` warns while the file is absent and the plan stage asks the owner before it
runs `accord tests baseline`. Not: `accord init`, a staleness check in `tests baseline`, a config key.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BASE-1

  @ac-1
  Scenario: gate plan warns while the tests baseline is absent
    Given a lane ticket whose plan passes every plan rule
    And accord/config.yml sets tests.report
    And accord/tests-baseline.txt does not exist
    When the owner runs accord gate plan for that ticket
    Then the result carries a warning that names accord tests baseline
    And the verdict is pass with exit code 0

  @ac-2
  Scenario: gate plan is silent once the tests baseline exists
    Given a lane ticket whose plan passes every plan rule
    And accord/config.yml sets tests.report
    And accord/tests-baseline.txt exists with no case ids
    When the owner runs accord gate plan for that ticket
    Then the result carries no tests baseline warning

  @ac-3
  Scenario: gate plan is silent when no report is configured
    Given a lane ticket whose plan passes every plan rule
    And accord/config.yml has no tests.report key
    And accord/tests-baseline.txt does not exist
    When the owner runs accord gate plan for that ticket
    Then the result carries no tests baseline warning

  @ac-4
  Scenario: the plan skill asks the owner before creating the baseline
    Given the skills rendered by accord skills sync
    When the owner reads step 7, "Baseline tests", of the accord-plan skill
    Then it says to ask the owner before running accord tests baseline when accord/tests-baseline.txt is absent
    And to ask only after the owner has decided every failing case at the baseline
    And to commit the file with the plan: <id> ready commit on a yes
    And to stop and tell the owner when tests.full wrote no report
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The plan stage asks the owner before creating `accord/tests-baseline.txt`; it never creates it unasked — "tôi nghĩ là nên hỏi trước khi tạo"
- D-02 No `tests.report` configured: skip, no question. `tests.full` ran but the report is missing: stop and tell the owner. Failing cases at the baseline: the existing step-7 decision comes first, then the baseline, failing cases included — "theo bạn đề xuất đi"
- D-03 Evidence: `accord gate plan` warns when a lane ticket exists, `tests.report` is set, and the baseline file is absent; plus a test that the rendered plan skill carries the step — "ok b kết hợp A"
- D-04 When the owner declines the baseline, the `gate plan` warning stays on every run; no config key records the choice — "1"
- D-05 "Sets tests.report" means the key is present in `accord/config.yml`, whatever its value, as `lint.test-untraced` and `accord tests baseline` already read it — "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
