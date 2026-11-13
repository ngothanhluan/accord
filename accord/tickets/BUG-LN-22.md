---
id: "BUG-LN-22"                            # equals the file name: tickets/<id>.md
title: "The approach record's risk slot refuses sentences, its documented fix drops the risk, and approval.md and the corpus miss cases"
type: "bug" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-91"]
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
Queued 2026-11-13, not approved; the intent interview replaces this. These are the four Warnings of the round-7 code review of PR #172 (ST-LN-91, phase 3 group 1; .planning/phases/03-discuss-stage/03-group1-REVIEW7.md WR-01..WR-04). The owner decided on 2026-11-13 that after round 7 only Critical findings are fixed and Warnings go to a bug ticket. The code they name lands with ST-LN-91.
- WR-01: `kindLike` in packages/core/src/round/record.ts reads only the first word or two of a `risk:` / `rests on: risk:` slot. A slot holding a sentence that starts with a kind (`— risk: security is unaffected by this change — fixed`), or a column-0 prose line `Risk: security was reviewed …` under a finding, is a record problem, so `accord approve` exits 1 (and `round --plan` refuses in a plan record), although the release note calls it prose.
- WR-02: docs/releases.md says to fix a misplaced column-0 `risk: security` line by indenting it or adding a blank line before it; both make `approve` exit 0 and drop the block. A deeper `rests on: risk: security` after a lazy note and a blank line is read as prose although CommonMark renders it on the finding, and the problem text calls a readable but misplaced mark unreadable.
- WR-03: approval.md step 2 says the short view never lists a Nice, but for a ticket claimed under 0.4.0 `show --approval --short` lists an open risk-marked Nice under `## Risks`. WR-04: the corpus (packages/core/test/helpers/approach-corpus.ts) misses round 6's PL2, `PlanRow` cannot state the `gate plan` outcome, and legacy rows claim a byte comparison with origin/main that no test makes.
- Success: each case above gets the outcome the owner's group-1 decisions require, proven by a test that fails before its fix; this does not reopen those decisions (structural reading, fail closed on a mis-written kind).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-22

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
