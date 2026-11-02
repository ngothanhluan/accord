---
id: "ST-LN-89"                            # equals the file name: tickets/<id>.md
title: "Benchmark round 2 chooses the executor between sonnet at high and opus at medium, per risk kind, or shows it needs a new architecture"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-46"]
research: ["accord/research/2026-11-02-benchmark-per-agent.md"]
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
Queued 2026-11-02, not approved; the intent interview replaces this:
- Source: split from ST-LN-46 when round 2 went per agent. Owner, 2026-11-02 (translated): "Executor: sonnet high and opus medium, or a new architecture is needed for the executor." The intent queued before the split is in accord/research/2026-11-02-benchmark-per-agent.md.
- Question: two arms on the same executor samples, sonnet at high and opus at medium. Today this repository runs sonnet high (accord/config.yml; owner 2026-10-25: "the executor runs sonnet at high, since medium left more defects for review to catch"), the shipped default is sonnet medium (packages/core/src/skills/agents.ts:19). Report per arm what each run leaves for review (tests failing, Must and Should a judge finds in its diff), minutes and cost-weighted tokens; the cheapest arm that keeps quality wins (quality > cost > speed).
- Per risk kind, the question round 1 left open (it varied only effort on the current model): group the samples by the risk kinds of the tests each sample's task names (`risk:<kind>`), and report per kind whether opus medium holds where sonnet high does not. docs/specs/2026-10-12-workflow-layer-design.md "Executor by risk kind" says what a gain would route: a plan task's `risk: <kind>` line and a second executor render with its own `models` key, built only if a kind's quality differs beyond the noise.
- "Or a new architecture": when neither arm holds, the report says so per kind and the owner decides the architecture question; the risk-routed executor above and the advisor cell in the same spec section are candidates, not chosen.
- Uses the harness of ST-LN-46: model axis in scripts/round.mjs, cost-weighted report, reuse of earlier suite results (re-running every executor suite takes about 70 min), runs judged more than once.
- Not here: haiku for the executor per risk kind (in ST-LN-46's widened intent of 2026-10-30, not among the owner's 2026-11-02 arms; whether to add it is for the interview); routing model or effort per task in the CLI (owner agreed 2026-10-23 to queue it as its own ticket depending on this benchmark; no such ticket is queued as of 2026-11-02); parallel tasks inside a ticket.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-89

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
