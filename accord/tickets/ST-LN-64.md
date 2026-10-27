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
Queued 2026-10-26, not approved; the intent interview replaces this:
- Why: in ST-LN-62's build, the task 1 executor ran the whole suite on its own (1368 s, 7 timeouts) although no text asked for it. The brief says only "run the test files the task names", the executor agent says only "read the JUnit report and find each verify id", and `tests.full` in config.yml writes the same report `accord task-done` reads, so the executor picked the full run to be safe.
- Queued intent (owner chose option 2 of three, 2026-10-26: "ok, option 2"): `accord brief <id> <n>` prints the task's exact test command, `tests.affected` with `{files}` replaced by the task's `files:` paths (or the task's own test files, to be settled at intent), and says it is the only test command the executor runs; the executor agent text says it never runs `tests.full`, which belongs to the plan's baseline run and to verify.
- Rejected at queueing: a line in the executor text alone (relies on recall); option 2 plus a benchmark score for executor `tests.full` runs (later; catches it only after the fact; a hook would be Claude Code only).
- Related: ST-LN-44 (slow tests); in ST-LN-62 the main session appends a "Main session note" to each brief as a stopgap.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-64

  @ac-1
  Scenario: <observable outcome>
    Given ...
    When ...
    Then ...
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
