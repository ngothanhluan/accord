---
id: "TAGS-1"                            # equals the file name: tickets/<id>.md
title: "Build writes each scenario's test tag"
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
No step writes a scenario's `@test:<id>` tag today, so every lane M ticket fails `gate done` unless someone hand-edits the ticket.
For the owner running a lane M ticket through `/accord`, so the documented path reaches Done with no hand edit.
Success: the plan names which test proves each scenario, `accord gate plan` refuses a plan that does not, and `accord task-done` writes the tag.
Not in scope: `accord/tests-baseline.txt` setup, rejecting `@` inside a verify id, and phase 2 config setup (dogfood items 2 to 4).

## Acceptance criteria
```gherkin
Feature: TAGS-1 build writes each scenario's test tag

  @ac-1
  Scenario: task-done writes the tag of the scenario a verify entry proves
    Given a lane M ticket at stage build whose scenario @ac-1 carries no @test tag
    And plan task 1 maps scenario @ac-1 to test id T in its verify line
    And the test report records T as passed
    When the owner runs accord task-done for task 1
    Then the line holding the @ac-1 tag also carries @test:T
    And the ticket's stage, ac_hash and approved_hash are unchanged

  @ac-2
  Scenario: gate plan fails when a scenario has no test mapped to it anywhere in the plan
    Given a lane M plan in which no verify entry in any task maps a test to scenarios @ac-2 and @ac-3, which are not @ui
    When the owner runs accord gate plan
    Then it fails with one reason naming @ac-2 and one naming @ac-3

  @ac-3
  Scenario: gate plan fails when a scenario is mapped more than once
    Given a lane M plan in which two verify entries, in the same task or in different tasks, map scenario @ac-1
    When the owner runs accord gate plan
    Then it fails with a reason naming @ac-1 and every test id mapped to it, even when the two ids are the same

  @ac-4
  Scenario: an unmapped verify id and an unmapped ui scenario need no tag
    Given an otherwise valid lane M plan with a verify id whose entry names no scenario
    And a scenario tagged @ui that no verify entry maps
    When the owner runs accord gate plan and then accord task-done for the task holding that verify id
    Then gate plan passes
    And task-done passes and writes no tag for the unmapped id and none on the @ui scenario

  @ac-5
  Scenario: task-done never overwrites a different test tag
    Given scenario @ac-1 already carries @test:U and the plan maps @ac-1 to a different test id T that passed
    When the owner runs accord task-done for the task mapping @ac-1
    Then it fails with a reason naming @ac-1, U and T
    And neither the ticket nor accord/tickets/TAGS-1/ledger.md changes
```

## Vetoes

## Decisions
- D-01 The plan's verify line names the scenario each test proves, and accord task-done writes the scenario's @test tag once the test passes — "Plan ghi map, task-done tự ghi tag"
- D-02 accord gate plan fails unless every scenario that is not @ui is mapped by exactly one verify entry across plan.md; a verify id mapping no scenario stays valid — "Bắt buộc, lỗi ngay ở bước plan"
- D-03 The smallest done version has all four pieces: the map syntax, the gate plan check, task-done writing the tag, and the text in the ticket template, the build and plan skills, and the planner — "Đủ 4 mảnh"
- D-04 Scope is who writes the tag and when, how each scenario finds its test, and the matching text; dogfood items 2 to 4 are separate tickets — "Đúng, đủ 3 phần"

- D-05 An entry mapping a scenario the ticket does not have fails accord gate plan; a mapped @ui scenario is allowed and gets its tag; a scenario already carrying the same @test:T is left as it is and task-done passes; a test missing from the report or failing is refused as today, before anything is written — "Duyệt bản sửa"

## Corrections

## Open questions

## Approach
