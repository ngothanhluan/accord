---
id: "BUG-LN-18"                            # equals the file name: tickets/<id>.md
title: "The accord workflow re-gates every done ticket a pull request touches, so moving a @test tag fails a check nothing in that pull request can fix"
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
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Queued 2026-10-30, not approved; the intent interview replaces this:
- Why: the job "lint and gate the tickets this pull request touches" (.github/workflows/accord.yml:49 lists every changed accord/tickets/<id>.md, :199 runs `gate done` on each) gates a done ticket against the pull request's HEAD, while its ticks and verification are bound to its own verified commit. Any edit to a done ticket therefore fails `gate.tick-stale-commit` and `gate.stale-review`, and deleting a test file a done ticket's verification.md cites adds `gate.evidence-unresolved`. ST-LN-75 (PR #141, 2026-10-30) split worktree.test.ts and rewrote the 29 `@test:` tag lines in 7 done tickets (BUG-LN-14, ST-LN-7, ST-LN-20, ST-LN-25, ST-LN-27, ST-LN-30, ST-LN-34) to the new paths, as `accord lint` requires; all 7 failed, and the owner had the pull request admin-merged with the job red ("Merge despite the red job", translated).
- The same workflow is what `accord init` writes into a user's repository (packages/core/src/scaffold/workflow.ts), so every team hits this the first time a test moves.
- Queued intent: a pull request that moves or renames the tests a done ticket names can pass the check without re-verifying that ticket, while an edit that changes what a done ticket promises still fails.
- Open for the interview: which edits to a done ticket count as safe (only `@test:` tag lines; tag lines whose new id resolves and passes in the report; anything outside the AC hash); whether the check proves the moved test is the same test (same name, passing) or trusts the edit; what to do with verification.md evidence that cites a deleted file; whether the fix lives in the workflow script, in `gate done`, or in a new command the workflow calls.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-18

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
