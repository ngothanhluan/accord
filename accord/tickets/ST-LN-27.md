---
id: "ST-LN-27"                            # equals the file name: tickets/<id>.md
title: "Pick up, Continue and New request move the running session into the ticket's worktree"
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
Queued 2026-10-19, not approved; the intent interview replaces this:
- Found after ST-LN-20: Pick up, Continue and New request in lane M end with a `stop:` line that tells the owner to open a new session in the ticket's worktree folder and type `/accord continue <id>` there (ST-LN-7 D-08, D-11, D-13). Owner: "đó ko phải cách làm việc. user ko rảnh để làm việc đó đâu. accord phải tự handle", then chose a ticket of its own, done before ST-LN-24, ST-LN-25 and ST-LN-26.
- Proposal to confirm at intent: the running session moves itself into the ticket's worktree and goes on with the next stage, with no `stop:` line and no folder for the owner to open. Claude Code has a tool that switches the session into an existing worktree, but after the first switch it only switches between worktrees under `.claude/worktrees/` of the same repository, so the worktree location (ST-LN-7 D-06) may move there. Cursor, Codex and Copilot need their own way (for example every command run with the worktree as its working directory); the hold (D-03, D-14, D-17), the session-start hook and `accord anchor` read the ticket from the session's checkout and must still find it.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-27

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
