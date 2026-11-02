---
id: "ST-LN-46"                            # equals the file name: tickets/<id>.md
title: "Benchmark round 2 chooses the scout's model and effort from six arms, on a harness the executor and planner benchmarks reuse"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-14", "ST-LN-81"]
research: ["accord/research/2026-11-02-benchmark-per-agent.md", "accord/research/2026-11-02-scout-trust.md"]
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
Queued 2026-10-22, rewritten 2026-11-02 when round 2 was split per agent; not approved, the intent interview replaces this:
- Source: owner, 2026-11-02 (translated): "Scout: haiku and sonnet at low, medium, high. Executor: sonnet high and opus medium, or a new architecture is needed for the executor. Planner is certainly opus, only re-check the effort level, or a new architecture is needed. The other roles need discussing after implementing." This ticket keeps the scout and the shared harness; the executor is ST-LN-89, the planner ST-LN-90. The intent queued before the split, every role included, is moved verbatim to accord/research/2026-11-02-benchmark-per-agent.md.
- Question: which model and effort the scout needs. Six arms: haiku and sonnet, each at low, medium and high, on the same samples. Today the shipped default is haiku low (packages/core/src/skills/agents.ts:15) and this repository runs sonnet low (accord/config.yml, ST-LN-47 D-02, unmeasured). Round 1 tried only haiku: low held 0 of 5, medium 1 of 5, with 2 to 5 wrong facts per run; sonnet and any high effort were never benchmarked (docs/benchmark/round-1.md:33-34, accord/research/2026-11-02-scout-trust.md). Owner, 2026-10-23: "so is haiku high better than sonnet low/medium?", then "ok add it".
- Scoring: every reply goes through `accord scout check` (ST-LN-81: citations resolve, each logged search re-runs), then is scored on false "only" / "none" claims and on recall of wiring files (index.ts exports, CLI registration, README text restating a rule) against a true file list per sample. The 5 scout samples hold no true file list today (scripts/benchmark-samples.json:711-767), and no sample covers lane classification. Haiku is chosen only where it ties sonnet on wiring recall and on false absence claims (scout-trust record, recommendation). Report wrong facts, minutes and cost per arm; the cheapest arm that keeps quality wins (quality > cost > speed).
- Shared harness, built here and reused by ST-LN-89 and ST-LN-90: a model axis in scripts/round.mjs (none today, scripts/round.mjs:91-100); results reported cost-weighted (cache read about 0.1, cache write 1.25, output 5), not in raw tokens; reuse of earlier results, since `--round` re-runs every executor suite (about 70 min); each run judged more than once.
- Gather samples when a ticket is done, not by a shipped skill: a repo-internal step (a `scripts/benchmark.mjs` flag, run by hand after `accord gate done`) adds that ticket's agent runs to scripts/benchmark-samples.json and snapshots what each run read under the bench root, so the 30-day transcript retention cannot drop them. Not a shipped skill: transcripts are Claude Code's own format, while accord's skills must behave the same in Claude Code, Cursor, Codex and Copilot, and one ticket gives one sample per role.
- Carry the round 1 measurement problems into the design: runs under machine load (10 to 45 node processes), sonnet verifiers at high hanging on `python3 - <<'E'` with an empty heredoc, judges counting per item or per criterion, judges reading transcripts beyond their brief.
- Before about 2026-11-11 (date unverified) the 30-day transcript retention drops the first dogfood runs; round 1's samples are snapshotted under the bench root, other runs a sample needs must be snapshotted before then.
- Not here: the executor (ST-LN-89) and the planner (ST-LN-90); critic, reviewer, final reviewer, verifier, debugger and auditor, which get no ticket until the owner discusses them once these are built (their notes are in the research record); a routing layer for scout count, model or effort per request (rejected in accord/research/2026-10-30-harness-architecture.md).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-46

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
