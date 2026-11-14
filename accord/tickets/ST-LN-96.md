---
id: "ST-LN-96"                            # equals the file name: tickets/<id>.md
title: "A ticket keeps the rules it was claimed under through squash and rebase merges, and a team chooses how its branch takes main"
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
Queued 2026-11-14, not approved; the intent interview replaces this:
- Phase 3.1 TEAM-01 (backlog 999.1): the ruleset a ticket was claimed under is recorded in its frontmatter (D-02) so squash and rebase merges no longer lose it.
- `git.merge` and `git.sync` let a team choose how its ticket branch takes main (D-03, D-14, D-15), and accord itself decides whether a recorded verification still holds after any sync (D-04, D-16).
- Its acceptance criteria t1-ac-1 to t1-ac-5 are settled in `.planning/phases/03.1-team-adoption/03.1-CONTEXT.md` and built through GSD (Phase 1 D-14), not by the accord stages.
- Not part of this: the tracker interface (ST-LN-97) and the onboarding guide (ST-LN-50).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-96

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
