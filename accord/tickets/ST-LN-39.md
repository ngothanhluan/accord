---
id: "ST-LN-39"                            # equals the file name: tickets/<id>.md
title: "Only a freshly started verifier can write the verification record"
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
Queued 2026-10-22, not approved; the intent interview replaces this:
- Audit item 3: "Enforce with tooling that the verifier must be a new agent. Today this is only guidance in the skill." Owner, 2026-10-22, to the proposal in chat: "ok queue them all".
- Today: accord-verify step 3 says "Dispatch `accord-verifier` in a fresh context"; `gate.author-match` (`packages/core/src/gate/rules.ts:195`) is a warning comparing git authors, which are the same for the person and every agent.
- Proposal to confirm at intent: in Claude Code a PreToolUse hook refuses a Write or Edit of `accord/tickets/<id>/verification.md` unless the hook input names agent type `accord-verifier` in a run that was started, not resumed; `subagent-start` is already a hook event (`packages/cli/src/commands/hook.ts:12`). Unchecked: that the hook input carries the agent type.
- Tension to settle at intent: ST-LN-17 chose "no tool-specific hook, so Claude Code, Cursor and Codex behave the same". Either enforce in Claude Code only and say "not enforced in this tool" elsewhere, or find a tool-neutral proof, such as a one-time value the CLI hands to the dispatch and checks in the record.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-39

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
