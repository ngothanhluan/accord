---
id: "ST-LN-82"                            # equals the file name: tickets/<id>.md
title: "A ticket's tests are budgeted in seconds, reviewed for duplicates, and a fix extends an existing test instead of adding one"
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
Queued 2026-10-30, not approved; the intent interview replaces this:
- Source: accord/research/2026-10-30-harness-architecture.md section 3, Tests. Owner, 2026-10-30: "accord really needs a test auditor: AI generates far too many tests and many are not needed, which slows development" (translated).
- Measured: 1,742 cases; 214 cases of 5 s or more take 75% of the time, CLI tests 94% (CI Linux 80-119 s, Windows 790-941 s); `risk:` tests grow about four times faster than criterion tests (about 2.4 per criterion test); 40% of risk-test lines come from review, round or fix commits because the executor brief asks for a test per fixed finding; a random 30 held 24 real risks, 4 duplicates, 1 restating the code.
- Queued intent: the CLI reports the tests a ticket adds and their seconds against the plan baseline, with a budget in seconds, not a count; review has a test lens for duplicates, titles the body no longer checks, wrong layer and text-only checks; a fix extends the test that covers the code before adding a new one.
- Not here: deleting tests by coverage alone (published studies lost 12.5-48% of fault detection); mutation testing (StrykerJS does not fit the CLI tests); the existing dedup and speed tickets ST-LN-43, ST-LN-44, ST-LN-74, ST-LN-75.
- Open for the interview: is a test's cost counted in local Windows seconds or CI Linux seconds; do the 76 benchmark and dev-script tests count; do the 32 criterion tests that only check skill or agent text stay.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-82

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
