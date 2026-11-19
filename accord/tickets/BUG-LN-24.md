---
id: "BUG-LN-24"                            # equals the file name: tickets/<id>.md
title: "A refused task record names the step the build skill allows after a plan change"
type: "bug" # story | bug. An epic uses its own template
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
related:
  - "BUG-LN-23"
ruleset: "0.8.0"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: `accord task-done` refuses a task whose plan.md changed after `accord gate plan` passed, or never passed it, and tells the agent to run `accord gate plan`, while accord-build step 7 forbids running it to clear the refusal; an agent that follows the CLI breaks its skill.
For whom: the agent building a lane M ticket, and the owner who must see a plan change before it is built.
Success: both refusals name the step the build skill allows (show the owner the diff, accord-plan reviews it, or restore plan.md; or go back to accord-plan), and neither says to run `accord gate plan`.
Not here: the two review-round mismatches BUG-LN-23 also lists, and a general check that every CLI message agrees with the skills.
Expected size: 1 tasks

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-24

  @ac-1
  Scenario: A plan edited after it passed the gate is refused with the build skill's way out
    Given plan.md of ticket T-1 passed accord gate plan and was then edited
    When the agent runs accord task-done T-1 1
    Then it exits 1 and its reason says to show the owner the diff of plan.md, that accord-plan reviews it when the owner made the change, and that otherwise plan.md is restored with the owner's yes
    And the words "accord gate plan" appear nowhere in the reason

  @ac-2
  Scenario: A plan that never passed the gate sends the agent back to the plan stage
    Given plan.md of ticket T-1 has no plan_hash line
    When the agent runs accord task-done T-1 1
    Then it exits 1 and its reason says the plan stage has not finished and names accord-plan
    And the words "accord gate plan" appear nowhere in the reason

  @ac-3
  Scenario: A changed plan that accord-plan passes again is recorded as before
    Given plan.md of ticket T-1 was edited after accord gate plan passed and then passed accord gate plan again
    When the agent runs accord task-done T-1 1 with the task's tests recorded passed in a report that task-done already accepts
    Then it exits 0 and the ledger records task 1 done
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Fix both refusals, the changed plan and the plan with no plan_hash — "Both sentences"
- D-02 The work is one plan task — "1 task"
- D-03 Neither refusal contains the words "accord gate plan"; it names the skill step instead — "A: it does not contain those words"
- D-04 Each refusal writes its way out in full: "plan.md changed since its plan_hash was recorded: show the owner the diff of plan.md; if the owner made the change, accord-plan reviews it; otherwise restore plan.md with the owner's yes" and "plan.md has no plan_hash: the plan stage has not finished; go back to accord-plan", with no ticket id — "Write it all in the sentence"
- D-05 Only the code and its tests change; the build and plan skills and the old records that quote the message stay as they are — "No, only code + test"
- D-06 The check is a case-sensitive absence of "accord gate plan" in the joined reasons — "Absence of the phrase 'accord gate plan'"
- D-07 ac-1 and ac-2 are proved by two core tests replacing "taskVerdict plan hash" in packages/core/test/task.test.ts; ac-3 by the existing CLI test in packages/cli/test/lane-commands.test.ts, renamed with an ac-3 id — "Core for AC1-2, the existing CLI test for AC3"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
- Chosen: Option 1, rewrite the two sentences in place. The two string literals in packages/core/src/gate/task.ts:19-20 become D-04's sentences, word for word, with no ticket id. The check order in taskVerdict and its signature stay as they are; no new file, export or dependency.
- Affected: packages/core/src/gate/task.ts:19-20; packages/core/test/task.test.ts:63-74 (the "taskVerdict plan hash" block is replaced by two tests); packages/cli/test/lane-commands.test.ts:863 (renamed with an ac-3 id) and :878 (the substring changes to the start of the new sentence). Unchanged under D-05: the build and plan skills, docs/plans/2026-10-12-phase-2-skills.md:681, accord/tickets/BUG-LN-23.md:34, accord/research/2026-11-14-rule-enforcement.md:158 and :220. The caller packages/cli/src/commands/task-done.ts:114,128-132 prints the reasons verbatim and is not changed.
