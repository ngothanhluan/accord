---
id: "BUG-LN-5"                            # equals the file name: tickets/<id>.md
title: "The accord check runs its lint-and-gate script under bash -e, which the script says it avoids, and no test runs it that way"
type: "bug" # story | bug. An epic uses its own template
status: dropped                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
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
Queued 2026-10-17, not approved; the intent interview replaces this:
- Found in BUG-LN-3 final review. The lint-and-gate step of the workflow `accord init` writes (packages/core/src/scaffold/workflow.ts:75) and this repository's .github/workflows/accord.yml:36 set `shell: bash`, which GitHub runs as `bash --noprofile --norc -eo pipefail {0}`. The script's own comment says "Deliberately not -e: a lint failure and a gate failure should both be reported on one push". Under `-e` a failing command outside a condition can end the script before every ticket is gated or reported. packages/cli/test/workflow-script.test.ts runs the script with plain `bash`, so the flags CI uses are never tested.
- Owner: "make it a separate ticket". Open: whether to set `shell: bash --noprofile --norc {0}` (or `set +e`) so the comment holds, and to run the tests under the CI flags.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-5

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

## Dropped
Merged into BUG-LN-4, which carries its notes (owner, 2026-10-18, after the main session proposed merging tickets that touch the same code: "ok, merge them").
