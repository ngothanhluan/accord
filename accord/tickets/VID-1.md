---
id: "VID-1"                            # equals the file name: tickets/<id>.md
title: "Gate plan rejects verify ids holding an at sign or a comma"
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
approved_hash: "fnv1a64:2131b41ab3b67bdc"
ac_hash: "fnv1a64:d112f951cb144e0d"
verified_hash: "fnv1a64:d112f951cb144e0d"
verified_commit: "debd399c21bc61470da80c103405282c4999ebc0"
verified:
  - "ac-1"
  - "ac-2"
  - "ac-3"
  - "ac-4"
  - "ac-5"
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

  @ac-1 @test:packages/cli/test/lane-commands.test.ts#ac-1-gate-plan-fails-on-a-verify-id-whose-test-name-holds-an-at-sign
  Scenario: gate plan fails on a verify id whose test name holds an at sign
    Given a lane ticket whose plan passes every plan rule
    And one task's verify line names the id src/x.test.ts#@test-ac-1-writes
    When the owner runs accord gate plan for that ticket
    Then the result carries an error naming that id
    And the verdict is fail with exit code 1

  @ac-2 @test:packages/cli/test/lane-commands.test.ts#ac-2-gate-plan-fails-on-a-verify-id-whose-path-holds-an-at-sign
  Scenario: gate plan fails on a verify id whose path holds an at sign
    Given a lane ticket whose plan passes every plan rule
    And one task's verify line names the id packages/@scope/x.test.ts#writes
    When the owner runs accord gate plan for that ticket
    Then the result carries an error naming that id
    And the verdict is fail with exit code 1

  @ac-3 @test:packages/cli/test/lane-commands.test.ts#ac-3-gate-plan-fails-on-a-comma-inside-a-verify-id
  Scenario: gate plan fails on a comma inside a verify id
    Given a lane ticket whose plan passes every plan rule
    And one task's verify line reads src/x.test.ts#refuses-x,-exit-2
    When the owner runs accord gate plan for that ticket
    Then the result carries an error naming src/x.test.ts#refuses-x,-exit-2 whole, as written
    And the verdict is fail with exit code 1

  @ac-4 @test:packages/core/test/lane-plan.test.ts#ac-4-a-marker-and-a-comma-between-ids-raise-neither-verify-id-error
  Scenario: a marker and a comma between ids are accepted
    Given a lane ticket whose plan passes every plan rule
    And one task's verify line reads src/x.test.ts#writes (@ac-1), src/y.test.ts#risk:data-loss-quotes
    When the owner runs accord gate plan for that ticket
    Then the result carries neither the at sign error nor the comma error

  @ac-5 @test:packages/core/test/agents.test.ts#ac-5-the-planner-and-the-executor-say-a-test-name-holds-no-at-sign-and-no-comma
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
- D-01 Three parts: `accord gate plan` rejects a verify id holding `@` (the `(@ac-n)` marker excepted) and a comma inside an id (one touching a non-space character on both sides, not a separating comma followed by a space); the planner and executor say a test name holds neither. The checks live in `gate plan`, because `accord lint` never reads `plan.md`. Not: junit id normalisation, `accord/tests-baseline.txt`, existing tests whose names hold a comma — "Right (Recommended)"
- D-02 Both rules are errors on both profiles: such an id can never pass `task-done` or `gate done` — "error (Recommended)"
- D-03 An `@` anywhere in the id is rejected, in the path as well as the test name, because the Gherkin tag splits either way; a test under a directory holding `@` cannot be named on a verify line until a later ticket escapes tags — "Block every `@` (Recommended)"
- D-04 The smallest version is all three parts: both rules and the text — "All three parts (Recommended)"
- D-05 (audit) The comma error names the whole whitespace-free text holding the comma, as written on the verify line, so the planner finds it at once — "The whole id as written (Recommended)"
- D-06 (audit) Both agents hold one fixed sentence, checked verbatim by a test over the rendered agents; every runtime renders from the same source, so one render output suffices — "A fixed sentence, the test reads the render (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen: two gate checks over data the gate already has.** `gate.plan-verify-at` flags each parsed verify id
holding `@`, path included; markers never reach it (D-01, D-03). `gate.plan-verify-comma` finds the raw verify
line by the parser's own rule (fenced lines skipped, list marker stripped, `FIELD`, first match), splits it on
whitespace, and names every chunk whose comma touches a non-space character on both sides, as written (D-05).
Both are error rows in `PLAN_RULES` on both profiles, placed before the tests-baseline warning row (D-02). Pure
string work in `gate/`; no model or loader shape change.
**Rejected:** storing the raw verify value on `PlanTask`: it widens an exported core type for an edge case the
shared fence rule already covers.
**Affected:** `packages/core/src/gate/plan.ts`, `rules.ts`; `load/work.ts` only to share its fence and field
helpers; `agents/executor.md` (the D-06 sentence replaces "never starts with `@`") and `agents/planner.md`;
generated and synced agent copies; spec §7.
**Risks (critic):** Should 1, kept and fixed: ac-1..ac-3 end in exit code 1, so their tests run `accord gate
plan` through the CLI. Nice: a plan gated before this change keeps its `plan_hash:` and never meets the new
rules, as on a teammate's parallel branch; `gate done` still fails it, no worse than today, until its plan is
gated again. Nice items 2 to 4 are folded in above and below.
**Tests:** ac-1..ac-3 in `packages/cli/test/lane-commands.test.ts` (exit 1 and the id in the output); ac-4 in
`packages/core/test/lane-plan.test.ts`; ac-5 one dedicated test reading both rendered agents, not two
`AGENT_REQUIRED` rows.
