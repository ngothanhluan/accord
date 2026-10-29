---
id: "ST-LN-64"                            # equals the file name: tickets/<id>.md
title: "An executor runs only the test command its brief prints for the task, never the full suite"
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
Why: in ST-LN-62's build an executor ran the whole suite on its own (1368 s, 7 timeouts), because no text named the one test command it runs and `tests.full` writes the same JUnit report `accord task-done` reads.
For whom: everyone whose ticket an executor builds; the executor gets its test command from `accord brief`, not from recall.
Success: `accord brief <id> <n>` prints the task's exact test command and says it is the only one the executor runs, and the executor text says it never runs `tests.full`, which belongs to the plan's baseline run and to verify.
Non-goals: no benchmark score or hook for an executor's `tests.full` run; no change to `tests.full` runs in plan, review, lane S or verify; the CLI still runs no test command itself.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-64

  @ac-1
  Scenario: The brief prints the task's affected test command as the only one to run
    Given accord/config.yml has a tests.affected command containing {files}
    And task 2 of the ticket's plan has a files: line and a verify: line whose entries are a test file path, "#" and a test id
    When a person runs accord brief with the ticket's id and 2
    Then the output holds the tests.affected command with {files} replaced by the task's files: paths in their order, then the test file of each verify: entry in its order, leaving out any path already listed, joined by single spaces
    And the output says it is the only test command the executor runs for this task

  @ac-2
  Scenario: Without tests.affected the brief prints tests.full and says why
    Given accord/config.yml has a tests.full key and no tests.affected key
    When a person runs accord brief with the ticket's id and a task number
    Then the output holds the tests.full command and says it is the only test command the executor runs for this task
    And it says tests.full is printed because accord/config.yml has no tests.affected

  @ac-3
  Scenario: Without either command the brief says no test command is configured
    Given accord/config.yml has neither a tests.affected key nor a tests.full key
    When a person runs accord brief with the ticket's id and a task number
    Then the output holds a line saying no test command is configured
    And the command exits 0

  @ac-4
  Scenario: The executor's agent text forbids the full suite
    Given the executor agent definition in core and the copy accord skills sync renders from it for each runtime that receives agent files
    When a person reads each one
    Then each says the executor runs only the test command its brief prints
    And each says the executor never runs tests.full on its own, that tests.full belongs to the plan's baseline run and to verify, and that the executor runs it only when its brief prints it as the task's command
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Parts confirmed: the brief prints the task's exact test command; the brief says it is the only test command the executor runs; the executor text says it never runs `tests.full` — "ok"
- D-02 `{files}` is the task's `files:` paths plus the test files on its `verify:` line, without duplicates — "A"
- D-03 Without `tests.affected` the brief prints `tests.full` as the task's command and says why; without either it prints one line saying no test command is configured — "A"
- D-04 The smallest version that counts as done is all three parts — "A"
- D-05 ac-4 says the executor never runs `tests.full` on its own and runs it only when its brief prints it as the task's command, so it agrees with ac-2 — "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: option 1, the brief prints the command. `packages/cli/src/commands/brief.ts` builds the task's paths: the `files:` paths in order, then each `verify:` entry's text before its first `#` when that text is a file in the repository or on `files:`, leaving out repeats. It replaces every `{files}` in `tests.affected` with them, joined by single spaces. A path holding a character outside `[A-Za-z0-9._/@+=:-]` is single-quoted. It prints that command, the ac-2 `tests.full` line, or the ac-3 line between the task section and the conventions tail, and still exits 0. When no path is left, it prints the ac-3 kind of line, not a command with an empty `{files}`.
Why: the brief is the one text every executor reads; the core gains no code or export, and `packages/core/src/index.ts` (sensitive) is untouched.
Also changed: `packages/core/agents/executor.md` gets one bullet (ac-4, D-05), plus a clause for a brief that prints no command (review, debug and failure briefs, ac-3): run only the test files you wrote or changed, never `tests.full`. Build `SKILL.md` step 3 runs the command the brief printed, and says what to do when it printed none. `docs/specs/2026-10-12-workflow-layer-design.md` §brief and §tests are updated. The generated `agents.ts`/`skills.ts` and `.claude` copies are regenerated.
Rejected: option 2, double-quoting every path with an odd character (`$` and `%` are still expanded inside double quotes); a pure core helper exported from `index.ts` (no criterion needs it, and it would add a public export to a sensitive file).
Risks: (Must, fixed above) a `verify:` prefix is a file only under vitest; pytest or jest classnames are module or test names, so a prefix is kept only when it is a file. (Should) BUG-LN-1's exact-output brief tests at `packages/cli/test/lane-commands.test.ts:272` and `:287` change expected text, because their fixture config has no test command; the plan names them. (Nice) Under vitest, a `files:` path matching `forceRerunTriggers`, such as a `package.json`, still makes the printed command run every spec; this comes from D-02. Single quotes do not quote in cmd.exe.
Tests: ac-1, ac-2 and ac-3 are in-process `runCli` tests in `lane-commands.test.ts`. ac-4 is a core test in `packages/core/test/agents.test.ts` over the render and the committed `.claude/agents/accord-executor.md`. One `risk:parsing` test covers `(new)`, repeats, a non-file `verify:` prefix, an empty path list and quoting.
