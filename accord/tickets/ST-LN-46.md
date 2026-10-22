---
id: "ST-LN-46"                            # equals the file name: tickets/<id>.md
title: "Benchmark round 2 measures the executor model per risk kind, the scout on sonnet, a changed architect prompt, and samples where a Must exists"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-14"]
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
- Source: ST-LN-14 benchmark round 1, docs/benchmark/round-1.md on branch t/ST-LN-14. Owner, 2026-10-22: "ok tạo ticket cho mấy đề xuất đó đi".
- Depends on ST-LN-14 (scripts/benchmark.mjs, scripts/round.mjs, scripts/compliance.mjs).
- accord-scout (haiku low): held 0 of 5 at low, 1 of 5 at medium, with 2 to 5 wrong facts per run. Round 1 tried only efforts, not models: round 2 runs the scout samples on sonnet as well.
- accord-architect (opus high): held 2/5 at medium, 1/5 at high, 3/5 at xhigh; wrong facts at every effort, so effort is not the cause. Round 2 compares the current prompt with a changed one (for example, facts only from a scout's report with file:line), at the current effort.
- accord-planner: no effort held all 5 (low 3, medium 4, high 3); the failing samples (low 1, 5; medium 1; high 3, 4) are read for a common cause before any change.
- The ticket's first question is still open: does the executor model matter per risk kind? Round 1 varied only effort on each agent's current model. Round 2 runs the executor samples on sonnet and on opus at the current effort, grouped by the risk kinds of the tests each sample's task names (`risk:<kind>`), so the report says per kind whether opus holds where sonnet does not.
- Gather samples when a ticket is done, not by a shipped skill: a repo-internal step (a `scripts/benchmark.mjs` flag, run by hand after `accord gate done`) adds that ticket's agent runs to scripts/benchmark-samples.json and snapshots what each run read under the bench root, so the 30-day transcript retention cannot drop them; rounds then run every few weeks over all gathered samples. Not a shipped skill: transcripts are Claude Code's own format, while accord's skills must behave the same in Claude Code, Cursor, Codex and Copilot, and one ticket gives one sample per role.
- accord-debugger was not measured in round 1; round 2 includes it.
- Reviewer, final-reviewer and verifier samples are uninformative when the current-effort run reports no Must or no failing criterion (D-08 holds them at every effort by default). Round 2 adds samples whose work has a known Must or failing criterion, so a lower effort can be seen to miss it.
- Carry the round 1 measurement problems into the design: runs under machine load (10 to 45 node processes), sonnet verifiers at high hanging on `python3 - <<'E'` with an empty heredoc, judges counting per item or per criterion, judges reading transcripts beyond their brief; and `--round` re-runs every executor suite (about 70 min) with no reuse of earlier results.
- Before 2026-11-11 the 30-day transcript retention drops the first dogfood runs; round 1's samples are snapshotted under the bench root.

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
