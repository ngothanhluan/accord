---
id: "ST-LN-84"                            # equals the file name: tickets/<id>.md
title: "A lasting rule the owner states reaches the repository, so every teammate and tool follows it"
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
- Source: accord/research/2026-10-30-harness-architecture.md section 3, Memory. Owner, 2026-10-30, asked whether accord should bring in a memory plugin like GSD (translated).
- Found: no memory plugin reaches every teammate and all four tools (Claude Code auto memory is machine-local and not loaded into subagents; Copilot Memory is Copilot-only; mem0 needs an API key); evidence of gain is weak (context files cost over 20% more with no general gain, arXiv 2602.11988). One owner's machine-local memory for this repository held about 15 lasting rules that belong in the repository, one of them overriding a shipped skill (merging main into a ticket branch that is behind, against skills/accord/worktree.md), so other tools and teammates behave differently.
- Queued intent: when the owner states a lasting rule or overrides a skill at any stage, the agent offers to record it as a line in accord/product/conventions.md, a `Rejected:` line, or a backlog ticket, and writes it on a yes; today verify does this only for Corrections and Rulings.
- Not here: an external memory plugin; a new memory store. Related: ST-LN-68 (refused options), ST-LN-22, ST-LN-28.
- Open for the interview: how conventions stay small, since they are added to every executor brief; whether a conventions line cites its source ticket and date and lint warns when that ticket is dropped.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-84

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
