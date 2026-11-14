---
id: "ST-LN-97"                            # equals the file name: tickets/<id>.md
title: "Jira, Linear and a team script behind one read-only tracker interface"
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
- Phase 3.1 TEAM-03 (backlog 999.3): every tracker sits behind one interface, ticket ids in and title, state and labels out as JSON (D-12), with built-in `jira`, `linear` and `github-issues` adapters and a team `script` adapter.
- Jira supports Cloud and Server/Data Center by which environment variables are set, and Linear uses `LINEAR_API_KEY` (D-13); a failed lookup is a warning, never a verdict.
- Its acceptance criteria t3-ac-1 to t3-ac-3 are settled in `.planning/phases/03.1-team-adoption/03.1-CONTEXT.md` and built through GSD (Phase 1 D-14), not by the accord stages.
- Not part of this: ruleset and merge handling (ST-LN-96) and the onboarding guide (ST-LN-50).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-97

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
