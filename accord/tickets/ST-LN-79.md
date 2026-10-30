---
id: "ST-LN-79"                            # equals the file name: tickets/<id>.md
title: "The context every agent call carries is measured by owner and cut to what that agent needs"
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
- Source: accord/research/2026-10-30-harness-architecture.md sections 2 and 4.1. About 52% of subagent input is not attributable to transcript content: fixed context sent with every call, roughly 47k tokens per call over 1,303 runs (raw tokens, not cost-weighted); accord's own documents (skills, tickets) are a further 17%.
- Owner, 2026-10-30: "token prices will rise a lot, so we must keep quality good at the lowest cost: quality > cost > speed" (translated).
- Queued intent: first split that fixed context by owner (accord session rules and skill listings, the host tool, plugins, MCP server instructions) and cost-weight it (cache read about 0.1, cache write 1.25, output 5); then remove from each accord agent what it never uses, without dropping a rule any agent follows.
- Not here: shortening the stage skills themselves beyond what an agent never reads; the plan-critique loop (ST-LN-56, ST-LN-57).
- Open for the interview: which part accord controls in each of the four tools, and how a cut is proven not to change behaviour (the benchmark of ST-LN-46 or ST-LN-70).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-79

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
