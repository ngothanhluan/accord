---
id: "ST-LN-98"                            # equals the file name: tickets/<id>.md
title: "The rule that tests commit with -F instead of -m holds in every test, or is narrowed to the cases that need it"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
research: ["accord/research/2026-11-14-rule-enforcement.md"]
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
Queued 2026-11-14, not approved; the intent interview replaces this:
- Source: `accord/research/2026-11-14-rule-enforcement.md` (row C2 and section 3). Owner, 2026-11-14: "OK, put them into the backlog, and discuss them when we work on them" (translated).
- Found: `accord/product/conventions.md` says a test that makes a commit writes the message to a file and commits with `-F <file> --cleanup=verbatim`, never `-m`; nothing checks it, and on 2026-11-14 test code held about 62 `commit`/`merge` calls with `-m`, the shared helper `packages/cli/test/helpers/repo.ts:83` among them. A rule kept only as prose decays (Lauren Tan's talk, see ST-LN-84).
- Options for the interview: (a) a test that scans the test sources, as `packages/cli/test/spawn-surface.test.ts` does for `git log` flags, plus moving every call to `-F`; (b) narrow the rule to messages that need it (emoji, blank lines, exact bodies) and check only that; (c) drop the rule.
- Related: `.vitest/` has no `.gitignore` entry although conventions.md says nothing under it is ever committed (row C8); removing that cause is a one-line change that may join this ticket or a lane S one.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-98

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
