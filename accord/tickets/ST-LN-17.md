---
id: "ST-LN-17"                            # equals the file name: tickets/<id>.md
title: "The review round and the fix executor's model come from the CLI, so a session cannot miss the tier-up or the round cap"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
priority: high
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
- In BUG-LN-3 the main session dispatched the round 4 fix executor on sonnet; accord-review step 6 says a round at or after `escalation.fix_round_tier_up` (default 4) goes one tier up. The round count lived only in the session's memory, because review.md is written once, at step 8.
- Owner: "how do we make it impossible to forget this?", then chose "Create ticket: CLI computes it (Recommended)": the review skill writes each round to review.md as it happens, and the CLI reads it and prints the round, the cap and the model to dispatch the fix executor with, refusing past the cap; no tool-specific hook, so Claude Code, Cursor and Codex behave the same.
- ST-LN-14 scores the same rule from transcripts.
- Also in scope (owner: "ok, the proposal is valid", 2026-10-17): past a round threshold, or when the findings keep hitting a risk the Approach held an option in reserve for, the CLI says to ask the owner about a change of course (accord-build step 6). In BUG-LN-3 four rounds of YAML-reading fixes ran while the Approach held `accord gate pr` "in reserve if the grep reading proves too fragile", and nobody asked.
- Benchmark round 1 (ST-LN-14, 2026-10-22) found 6 tier-up misses: ST-LN-3 review round 5, BUG-LN-3 round 4, ST-LN-26 round 4, and ST-LN-14 rounds 6, 7 and 8 (fix executor on sonnet where `escalation.fix_round_tier_up` asks for opus); and 2 reviews past the round cap with no Ruling allowing it: ST-LN-14 (review.md to round 9, rounds 10 to 15 after verify) and ST-LN-3 (round 6). Whether the cap and tier-up count restarts after each return from verify is not settled in the skill text and should be decided here.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-17

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
