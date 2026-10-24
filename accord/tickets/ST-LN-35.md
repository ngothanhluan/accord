---
id: "ST-LN-35"                            # equals the file name: tickets/<id>.md
title: "An accord subagent hands back its work at a measured context threshold instead of running until its window fills"
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
Queued 2026-10-21, not approved; the intent interview replaces this:
- Raised during the ST-LN-14 build. Owner: "I think there should be some way to auto compact on reaching some limit", then chose "A": a separate ticket, after the ST-LN-14 round 1 report.
- Today nothing measures a subagent's context: `~/.claude/hooks/gsd-context-monitor.js` reads statusline metrics that only the main session writes; `.claude/agents/accord-executor.md:32` asks the executor to return `BLOCKED: context` near its limit, which is recall, not enforced.
- Proposal to confirm at intent: no compaction inside a subagent (it summarises the verbatim ticket away); instead, at a threshold below the window, the agent commits what is finished and hands back, and a fresh executor gets the brief, the diff and the ledger.
- First measure: peak context per run (input + cache read + cache write per turn, from the transcript `usage`) against whether the run held in the ST-LN-14 round 1 report, to find where quality drops; only then pick the threshold.
- To settle at intent: what enforces it (a hook reading the subagent's own transcript, or the CLI); whether the main session's compaction threshold changes too.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-35

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
