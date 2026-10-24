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
approved_hash: "fnv1a64:02874d3577e3912b"
ac_hash: "fnv1a64:1990703df52e3f7c"
verified_hash: "fnv1a64:1990703df52e3f7c"
verified_commit: "aa6263162222be22493e5d69f95a9b0985187095"
verified:
  - "ac-1"
  - "ac-2"
  - "ac-3"
  - "ac-4"
  - "ac-5"
---

## Intent
No step writes a scenario's `@test:<id>` tag today, so every lane M ticket fails `gate done` unless someone hand-edits the ticket.
For the owner running a lane M ticket through `/accord`, so the documented path reaches Done with no hand edit.
Success: the plan names which test proves each scenario, `accord gate plan` refuses a plan that does not, and `accord task-done` writes the tag.
Not in scope: `accord/tests-baseline.txt` setup, rejecting `@` inside a verify id, and phase 2 config setup (dogfood items 2 to 4).

## Acceptance criteria
```gherkin
Feature: TAGS-1 build writes each scenario's test tag

  @ac-1 @test:packages/cli/test/lane-commands.test.ts#ac-1-task-done-writes-the-tag-of-the-scenario-a-verify-entry-proves
  Scenario: task-done writes the tag of the scenario a verify entry proves
    Given a lane M ticket at stage build whose scenario @ac-1 carries no @test tag
    And plan task 1 maps scenario @ac-1 to test id T in its verify line
    And the test report records T as passed
    When the owner runs accord task-done for task 1
    Then the line holding the @ac-1 tag also carries @test:T
    And the ticket's stage, ac_hash and approved_hash are unchanged

  @ac-2 @test:packages/core/test/lane-plan.test.ts#ac-2-gate-plan-fails-when-a-scenario-has-no-test-mapped-to-it-anywhere-in-the-plan
  Scenario: gate plan fails when a scenario has no test mapped to it anywhere in the plan
    Given a lane M plan in which no verify entry in any task maps a test to scenarios @ac-2 and @ac-3, which are not @ui
    When the owner runs accord gate plan
    Then it fails with one reason naming @ac-2 and one naming @ac-3

  @ac-3 @test:packages/core/test/lane-plan.test.ts#ac-3-gate-plan-fails-when-a-scenario-is-mapped-more-than-once
  Scenario: gate plan fails when a scenario is mapped more than once
    Given a lane M plan in which two verify entries, in the same task or in different tasks, map scenario @ac-1
    When the owner runs accord gate plan
    Then it fails with a reason naming @ac-1 and every test id mapped to it, even when the two ids are the same

  @ac-4 @test:packages/cli/test/lane-commands.test.ts#ac-4-an-unmapped-verify-id-and-an-unmapped-ui-scenario-need-no-tag
  Scenario: an unmapped verify id and an unmapped ui scenario need no tag
    Given an otherwise valid lane M plan with a verify id whose entry names no scenario
    And a scenario tagged @ui that no verify entry maps
    When the owner runs accord gate plan and then accord task-done for the task holding that verify id
    Then gate plan passes
    And task-done passes and writes no tag for the unmapped id and none on the @ui scenario

  @ac-5 @test:packages/cli/test/lane-commands.test.ts#ac-5-task-done-never-overwrites-a-different-test-tag
  Scenario: task-done never overwrites a different test tag
    Given scenario @ac-1 already carries @test:U and the plan maps @ac-1 to a different test id T that passed
    When the owner runs accord task-done for the task mapping @ac-1
    Then it fails with a reason naming @ac-1, U and T
    And neither the ticket nor accord/tickets/TAGS-1/ledger.md changes
```

## Vetoes

## Decisions
- D-01 The plan's verify line names the scenario each test proves, and accord task-done writes the scenario's @test tag once the test passes — "The plan records the map, task-done writes the tag itself"
- D-02 accord gate plan fails unless every scenario that is not @ui is mapped by exactly one verify entry across plan.md; a verify id mapping no scenario stays valid — "Mandatory, an error right at the plan step"
- D-03 The smallest done version has all four pieces: the map syntax, the gate plan check, task-done writing the tag, and the text in the ticket template, the build and plan skills, and the planner — "All 4 pieces"
- D-04 Scope is who writes the tag and when, how each scenario finds its test, and the matching text; dogfood items 2 to 4 are separate tickets — "Right, all 3 parts"

- D-05 An entry mapping a scenario the ticket does not have fails accord gate plan; a scenario already carrying the same @test:T is left as it is and task-done passes; a test missing from the report or failing is refused as today, before anything is written — "Approve the revised version"
- D-06 An entry mapping a @ui scenario fails accord gate plan, matching the rule that @ui and @test contradict (lint.test-tag-on-ui); this replaces the D-05 clause that let a mapped @ui scenario get its tag — "gate plan refuses a map onto @ui"

## Corrections

## Open questions

## Approach
Chosen: a marker token after the test id on the verify line, like `(new)` on `files:`. `verify: pkg/x.test.ts#writes-tag (@ac-1), pkg/y.test.ts#helper`; a whole token `(@ac-n)` maps the id just before it, `T (@ac-1) (@ac-2)` maps one test to two scenarios. `load/work.ts` splits markers out so `task.verify` keeps only test ids and `PlanTask` gains `maps: { test, ac }[]`. `gate plan` adds `gate.plan-test-unmapped` (one reason per non-@ui scenario with no map) and `gate.plan-test-repeated` (names every id, repeats included); a map onto a scenario the ticket lacks, or onto a @ui scenario (D-06), also fails it. A pure writer `write/testtag.ts` takes the ticket text and the maps and returns the new text or the conflicts: it reads existing tags from the parsed scenario, inserts ` @test:T` right after the `@ac-n` token (never at line end, where a `#` comment would swallow it), and writes LF like `write/frontmatter.ts`. `task-done` computes the task's tags after a pass verdict and before the already-recorded return, so a re-run fills a missing tag; a conflict exits 1 naming @ac-n, U and T before any write; otherwise the ticket, then the ledger.
Rejected: a key=value prefix (`@ac-1=T`): a second convention beside `(new)`, breaks on stray spaces, repeats the id to map two scenarios.
Affected: `packages/core/src/load/work.ts`, `model/snapshot.ts`, `gate/plan.ts`, `gate/rules.ts`, new `write/testtag.ts` exported from `index.ts`, `packages/cli/src/commands/task-done.ts`, the shared PLAN fixture in `test/helpers/lane.ts`; text in `packages/core/agents/planner.md` and `executor.md` (the marker is not part of a test name), `skills/plan/SKILL.md`, `skills/build/SKILL.md` (commit the ticket with the ledger; a tag conflict asks the owner, never an executor or debug), `templates/ticket-lane.md`, the workflow-layer spec; then gen, build, skills sync.
Risks (critic, no Must; Shoulds on re-runs, comments, parsed tags, @ui and the conflict branch are folded in above):
- Nice: a malformed marker such as `(@ac-1,` stays a verify id and fails later as missing from the report; dogfood item 3 (lint rejects `@` in a verify id) catches it.
- Nice: re-running `gate plan` on a plan written before this change fails until maps are added; done tickets never re-run it.
Tests: map parsing in core `work.test.ts`; @ac-2, @ac-3, @ac-4's gate part, D-05 and D-06 in core `lane-plan.test.ts`; the writer's insertion, comment, CRLF and conflict cases in a core test; @ac-1, @ac-4's task-done part and @ac-5 in CLI `lane-commands.test.ts` on a ticket without tags.
