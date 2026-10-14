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
approved_hash: "fnv1a64:b169da01c59467fe"
ac_hash: "fnv1a64:047fc0836aa259b2"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
A repository that adopts lane tickets with an existing suite and no `accord/tests-baseline.txt` fails
`gate.test-untraced` on every pre-existing test at Done, and no step creates the file (dogfood item 2).
For the owner running the first lane M ticket in a repository that already has tests.
Done when `accord gate plan` warns while the file is absent and the plan stage asks the owner before it
runs `accord tests baseline`, which refuses a stale report. Not: `accord init`, a config key.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BASE-1

  @ac-1 @test:packages/core/test/lane-plan.test.ts#ac-1-gate-plan-asks-about-the-tests-baseline-while-the-file-is-absent
  Scenario: gate plan warns while the tests baseline is absent
    Given a lane ticket whose plan passes every plan rule
    And accord/config.yml sets tests.report
    And accord/tests-baseline.txt does not exist
    When the owner runs accord gate plan for that ticket
    Then the result carries a warning that asks the owner whether to run accord tests baseline
    And the verdict is pass with exit code 0

  @ac-2 @test:packages/core/test/lane-plan.test.ts#ac-2-gate-plan-is-silent-once-the-tests-baseline-exists
  Scenario: gate plan is silent once the tests baseline exists
    Given a lane ticket whose plan passes every plan rule
    And accord/config.yml sets tests.report
    And accord/tests-baseline.txt exists with no case ids
    When the owner runs accord gate plan for that ticket
    Then the result carries no tests baseline warning

  @ac-3 @test:packages/core/test/lane-plan.test.ts#ac-3-gate-plan-is-silent-when-no-report-is-configured
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
    And to commit the file in a commit of its own on a yes
    And to stop and tell the owner when tests.full wrote no report

  @ac-5 @test:packages/cli/test/lane-commands.test.ts#ac-5-tests-baseline-refuses-a-report-older-than-the-last-commit
  Scenario: tests baseline refuses a report older than the last commit
    Given accord/config.yml sets tests.report
    And the report file was written before the HEAD commit
    And accord/tests-baseline.txt does not exist
    When the owner runs accord tests baseline
    Then it exits 2 and accord/tests-baseline.txt still does not exist
    And the message says to run the tests again
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
- D-06 Approach critic Must: the warning asks rather than orders, the plan skill's gate step says the baseline is asked at step 7 and never created earlier, and the planner says the same — "Dùng bản sửa (Recommended)"
- D-07 `accord tests baseline` refuses a report written before the HEAD commit, as `accord task-done` does; this replaces the earlier non-goal — "Thêm kiểm trong CLI (Recommended)"
- D-08 Teams: the baseline is committed on its own and reaches the main branch in its own pull request before other tickets plan; a merge conflict on it keeps only the lines both sides hold, never the union — "ok theo bạn đề xuất"
- D-09 @ac-4 follows D-08: on a yes the baseline is committed in a commit of its own, not with the `plan: <id> ready` commit, so it can be picked onto its own pull request — "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- "khoan, việc bạn nói tôi làm một mình là ko đúng. vì target là support cho team làm cùng nữa mà?" (on the Approach risk that accepted two branches creating the baseline because the owner works alone)

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen: warning row in `PLAN_RULES`, a plan-skill baseline file, a stale check in `tests baseline`.** One pure
check in `gate/plan.ts`, rule `gate.tests-baseline-missing` (warning): lane ticket, `tests.report` key present,
no `testsBaseline`. Its reason asks the owner whether to run `accord tests baseline`, answered only at the plan
stage's baseline tests step, before the first build commit (D-06). `accord tests baseline` refuses a report older
than HEAD through task-done's stale check, exported and shared; with no commit there is no check (D-07).
Plan skill: step 4 says the baseline is asked at step 7, never earlier; step 7 points to a new
`plan/baseline.md` (keeps SKILL.md under 5120 bytes); step 8 commits the file on its own whenever `git status`
shows it new. `baseline.md`: after every failing case is decided, ask create / don't create / stop, with the count and
samples from `accord lint`'s untraced-test lines; on a stale refusal with nothing changed outside `accord/`,
re-run `tests.full` once and retry; a missing report, or changed product code, stops and tells the owner;
the file is committed on its own, ships to the main branch in its own pull request, and a merge conflict
keeps only the lines both sides hold (D-08).
`planner.md` and the build skill's plan-changed step each say the baseline is never created there.
**Rejected:** the skill following the gate warning instead of checking the file (a rule rename silently moves
its trigger); skill text alone (loses D-03's CLI evidence).
**Affected:** `gate/plan.ts`, `gate/rules.ts`, `commands/tests-baseline.ts`, `commands/task-done.ts`,
`skills/plan/` (SKILL.md, new baseline.md), `skills/build/SKILL.md`, `agents/planner.md`, generated and synced
copies, spec sections 7 and 9.
**Risks:** (critic r1 Must, fixed by D-06) the warning read at step 4 as an order to create the file unasked;
(r2 Should) the warning sorts first, so `lane-plan.test.ts:86,97` must filter by rule; a commit between the
test run and the question makes the report stale, hence the one re-run; build re-running `gate plan` could
relay the question, hence the build-skill line; the count must come from `accord lint`, not a hand count.
Two teammates planning on separate branches both create the file (D-08): `baseline.md` commits it alone and
says it reaches the main branch in its own small pull request before others plan; on a merge conflict keep
only the lines both sides hold, never the union, so a dropped case fails `gate.test-untraced` loudly instead
of being exempted silently. A CLI check that the baseline never gains lines is out of scope.
**Tests:** @ac-1..3 in `core/test/lane-plan.test.ts` (`gatePlan` result), plus @ac-1's exit 0 asserted in the
CLI `gate plan` test; @ac-4 over the rendered plan skill and `baseline.md` in `core/test/stage-skills.test.ts`;
@ac-5 in `cli/test/lane-commands.test.ts`.
