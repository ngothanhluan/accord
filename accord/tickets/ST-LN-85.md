---
id: "ST-LN-85"                            # equals the file name: tickets/<id>.md
title: "Each accord agent carries only the fixed context it uses, proven on round 2 samples"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-79", "ST-LN-46"]
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
- Source: split from ST-LN-79 (its D-05, owner 2026-10-30: "A"). ST-LN-79 measures the fixed per-call context by owner, cost-weighted, for the main session and each accord agent; this ticket cuts from each accord agent what it never uses, without dropping a rule any agent follows. Owner, 2026-10-30: "token prices will rise a lot, so we must keep quality good at the lowest cost: quality > cost > speed" (translated).
- Proof, from ST-LN-79 D-03 (owner "A") and D-04 (owner "C"): a cut is proven by replaying benchmark samples for every agent it changes, before and after the cut, at the agent's current model and effort, comparing the runs the judge holds; an agent that holds fewer runs after the cut keeps its old definition; a test also checks each agent still carries every rule and every tool its body names. The samples are ST-LN-46's round 2 samples (known or seeded Musts, judged more than once), because round 1 cannot see a cut make an agent worse: 17 of its samples hold by default (the first run found no Must), scout, architect and planner already miss at their current effort, and each sample runs once.
- Candidates seen at ST-LN-79's interview (unmeasured): accord-executor has no `tools:` line, so it inherits every tool, MCP tools and the skill listing included; the 8-rule block (packages/core/templates/ruleset.md, about 2 KB) reaches every accord subagent through the SubagentStart hook while several agent bodies restate some rules.
- The figures after the cut go in ST-LN-79's report format (scripts/benchmark.mjs fixed-context report), before and after.
- Not here: the owner's own setup (plugins, MCP servers, CLAUDE.md, memory), which ST-LN-79's report lists for the owner to cut; shortening stage skills beyond what an agent never reads.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-85

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
