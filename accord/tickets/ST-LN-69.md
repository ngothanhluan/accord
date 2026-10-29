---
id: "ST-LN-69"                            # equals the file name: tickets/<id>.md
title: "Each worktree command prints the next action itself, so the skill no longer maps its output lines"
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
Queued 2026-10-29, not approved; the intent interview replaces this:
- Why (owner, 2026-10-29): "the ~15 output-line cases that worktree.md makes the agent interpret move into the CLI, so each command prints the next action itself".
- Today `worktree.md` (the rendered `.claude/skills/accord/worktree.md`, source `packages/core/skills/accord/worktree.md`) maps about fifteen kinds of output line from `accord worktree open`, `accord new ticket --worktree`, `accord worktree push`, `accord worktree clean` and `accord worktree check` (`pruned`, `fetch from origin failed`, `behind:`, `merged:`, `push of`, `removed`/`deleted`/`kept`, `stop:`, `enter:`, `held:`, `not held:`, `claimed:`, `not claimed:`, `not a ticket:`, the exit-2 messages) to actions the agent must recall and take. Anthropic's skill authoring guide asks the other way ("solve, don't punt"): the script handles the case and says what to do.
- Queued intent: each of those commands prints, beside every such line, the next action in plain words (show and go on, run this command, stop), so the skill shrinks to "do what the line says" and an agent in Claude Code, Cursor, Codex or Copilot acts the same without interpreting the line.
- Research: `accord/research/2026-10-25-plugin-audit.md` §2 (the "Solve, don't punt" row) and the last item of "Rejected, with the reason", which called this the right direction but large, to be discussed on its own (evidence, not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-69

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
