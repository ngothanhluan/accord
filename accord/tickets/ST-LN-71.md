---
id: "ST-LN-71"                            # equals the file name: tickets/<id>.md
title: "Approach critique defers implementation detail to the plan, re-reads only what changed, and has the same round cap and stop as review"
type: "story" # story | bug. An epic uses its own template
status: "dropped" # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-17"]
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
- Why (owner, 2026-10-30, ST-LN-17 D-10: "ok A+B"): ST-LN-17's approach critique ran 3 rounds (Must 2/4/1, Should 11/9/5), and most new findings came from the previous round's Rulings; the critic's approach mode (packages/core/agents/critic.md:15-18) has no limit on detail, no diff mode and no `fixed:`/`withdrawn:` lines, which plan critique has (critic.md:13, diff mode :28-32).
- Queued intent (A): in approach mode a finding on implementation detail a planner decides is marked "defer to plan" and is never a Must; from round 2 the critic reads only the amended text and lists `fixed:` and `withdrawn:` as it does for plan-review.md; approach critique takes ST-LN-17's round cap and its stop from round 3.
- Queued intent (B): accord-approach (packages/core/skills/approach/SKILL.md, step 3 at lines 23-36) answers a detail finding by deferring it to the plan in the ledger, not by adding a Ruling (Rulings rule at lines 85-88), so plan critique checks it there.
- Open for the interview: no approach critique round is recorded today (only plan-review.md, counted by scripts/plan-review.mjs), so whether the cap is computed by the CLI from a new round record, as ST-LN-17 does for review and plan critique, or stated in the skill is not settled; nor is where a deferred detail sits in the ledger and how the planner and plan critique pick it up.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-71

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
Folded into ST-LN-80 by its Decision D-02: approach critique defers implementation detail to the plan, re-reads only the amended text from round 2 with fixed: and withdrawn: lines, and takes the same round cap and stop as plan critique, counted by accord round <id> --approach.
