---
id: "ST-LN-45"                            # equals the file name: tickets/<id>.md
title: "The auditor runs at high and the critic at xhigh, as benchmark round 1 measured"
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
Queued 2026-10-22, not approved; the intent interview replaces this:
- Source: ST-LN-14 benchmark round 1, docs/benchmark/round-1.md on branch t/ST-LN-14 (5 samples per agent per effort; "held" = no worse than the current-effort run). Owner, 2026-10-22: "ok tạo ticket cho mấy đề xuất đó đi".
- Round 1: accord-auditor (opus, current medium) at high reported Must the current run missed in samples 3 (5 Must) and 4 (2 Must), at 1.0 against 0.8 median minutes; low held 3 of 5.
- Round 1: accord-critic (opus, current high) at xhigh reported Must the current run missed in samples 2 (3 Must) and 5 (1 Must), at 12.1 against 5.5 median minutes and about 4.7 times the cache reads; medium held 4 of 5.
- The script's own suggestions to lower effort are not taken: executor low held 5 of 5 but saves only 0.7 min a task; reviewer, final-reviewer and verifier "held" only because their current-effort runs reported no Must (reviewer 1 informative sample, final-reviewer and verifier none).
- Change: this repository's `accord/config.yml` `models:` entries, which already override each agent (schema packages/core/schemas/config.schema.json `models`, applied by `accord skills sync` over AGENT_DEFAULTS in packages/core/src/skills/agents.ts:14): `auditor: { model: opus, effort: high }` and `critic: { model: opus, effort: xhigh }`, then `node packages/cli/dist/cli.js skills sync`. AGENT_DEFAULTS, which every accord user gets, stays as it is until round 2 gives stronger evidence. Owner, 2026-10-22, agreed to the config route ("ok làm đi").
- Caveat: one sample per effort per cell, judges count new items differently; the owner may prefer to wait for round 2.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-45

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
