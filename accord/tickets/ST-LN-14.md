---
id: "ST-LN-14"                            # equals the file name: tickets/<id>.md
title: "Benchmark which model and effort each agent role needs"
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
Queued 2026-10-17, not approved; the intent interview replaces this:
- Phase 3 benchmark: a script (not shipped) reads Claude Code subagent transcripts and git to compare agent runs by model, effort, outcome, tokens and time; it answers whether the executor model matters per risk kind.
- Run before 2026-11-11, when the 30-day transcript retention drops the first dogfood runs.
- Owner, 2026-10-17, after the main session forgot the review tier-up (BUG-LN-3 round 4 executor dispatched on sonnet, not opus): "làm sao để ko thể nào quên chuyện này? tôi nghĩ phần benchmark phải đánh giá thật kỹ mới dc." So the benchmark also scores process compliance from the transcripts: each dispatch against the skill rules (model tier at `escalation.fix_round_tier_up`, the five-round cap, a fresh agent per brief, the ticket copied byte for byte into a brief, commits without trailers), with that missed tier-up as a known case it must find.
- Owner, 2026-10-18: "vậy làm sao để strictly biết dc model đang chạy cho từng agent là gì? effort bao nhiêu? tôi đã bật advisor. sao này để xem chạy benchmark như thế nào", then "ok vậy note mấy cái này vảo ticket benchmark đi".
- Reading each run strictly, checked 2026-10-18 on this machine: every `"type":"assistant"` line of `<session>/subagents/agent-<id>.jsonl` carries `message.model` (the model that answered), `requestedModel` (the one asked at dispatch), `effort` and `perTurnEffort` (equal to the API request's `output_config.effort`), and `advisorModel`; `agent-<id>.meta.json` names `agentType` and the dispatch `description`. The benchmark reads model and effort per turn, not once per run (scripts/benchmark.mjs:31-35 keeps the first `effort` and the last `message.model`), and flags a turn whose model differs from `requestedModel`.
- Advisor: the owner turned on the advisor (Opus 5.5) on 2026-10-18; every subagent then carries an `advisor` tool with `advisorModel: claude-opus-5-5`, and none had called it yet. The benchmark counts advisor calls per run and per agent role, so it can say whether the advisor changes outcomes; how a real advisor call appears in the transcript is unchecked.
- Known compliance cases from ST-LN-7 for the benchmark to find, besides the BUG-LN-3 tier-up: the Task 1 executor's commit 0496cf0 carries a Co-Authored-By trailer; the Task 4 executor wrote the code before its tests (ST-LN-7 ledger, d6c0e76); the Task 2 executor put a verify test inside a `describe`, so `accord task-done` refused it (fixed in 5d27f18).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-14

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
