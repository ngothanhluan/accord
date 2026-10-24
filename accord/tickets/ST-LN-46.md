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
- Source: ST-LN-14 benchmark round 1, docs/benchmark/round-1.md on branch t/ST-LN-14. Owner, 2026-10-22: "ok create tickets for those proposals".
- Depends on ST-LN-14 (scripts/benchmark.mjs, scripts/round.mjs, scripts/compliance.mjs).
- accord-scout (haiku low): held 0 of 5 at low, 1 of 5 at medium, with 2 to 5 wrong facts per run. Round 1 tried only efforts, not models. This repository's config moves the scout to sonnet low before round 2 (from ST-LN-45, unmeasured), so round 2 runs the same 5 scout samples on haiku high, sonnet low and sonnet medium, and reports wrong facts, minutes and tokens for each, to answer whether haiku at a higher effort matches sonnet at a lower one. Owner, 2026-10-23, asked "so is haiku high better than sonnet low/medium?", then "ok add it".
- accord-architect (opus high): held 2/5 at medium, 1/5 at high, 3/5 at xhigh; wrong facts at every effort, so effort is not the cause. Round 2 compares the current prompt with a changed one (for example, facts only from a scout's report with file:line), at the current effort.
- accord-planner: no effort held all 5 (low 3, medium 4, high 3). Read 2026-10-23: three of the five misses (low 1, low 5, medium 1) are `accord gate plan` failing on `gate.plan-deferral` for "later" used as an adjective ("a later commit", "every later `--compliance` read"), though .claude/agents/accord-planner.md:45 already forbids the word; in the real plan stage the gate loop fixes that in one revision, but the benchmark scores the first write. The other two (high 3, high 4) report more Must than the current run, each from one judge run, and high 4's first Must is the one low 4 also reported, so they are judge noise as much as effort. Round 2: either the planner prompt says "later" is forbidden in every sense (write "next" or "subsequent") or the deferral rule stops matching "a later <noun>"; report a gate failure on wording apart from Must found in the plan; and judge each planner run more than once. Round 2 runs the planner samples at medium, high and xhigh, since high cost about the same as medium in round 1 (2.2 against 2.3 median minutes, similar tokens) and gsd's planner runs at high; the owner, 2026-10-23, asked "I wonder why the planner is only medium?" and chose to measure before any change ("A"). The planner's method is not in question yet, so a GSD-style planner prompt is tried only if the planner still misses after that.
- accord-planner fix rounds: ST-LN-48's plan took four critic rounds, the most allowed (accord/tickets/ST-LN-48/plan-review.md on branch t/ST-LN-48). Its round 2 Must came from the planner applying round 1's proposed fix word for word, which put Task 11 after review although review starts only once every task is recorded; its round 3 Should 3.2 misordered a step against accord-review's final review the same way. Both passed the planner's self-check (.claude/agents/accord-planner.md:47-53), which has no item for checking the plan's steps against the order of the build, review and verify skills. Round 2 adds those fix rounds as planner samples and runs them at medium and at high, with and without a self-check line telling the planner to check every step against that order, and reports which runs catch both findings. Owner, 2026-10-24, on adding this: "ok".
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
