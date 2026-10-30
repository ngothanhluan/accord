---
id: "ST-LN-83"                            # equals the file name: tickets/<id>.md
title: "A request that is not a change goes to its own path, not to a scout and a lane proposal"
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
- Source: accord/research/2026-10-30-harness-architecture.md section 3, Intent routing. Owner, 2026-10-30, asked whether accord needs an intent classifier routing to skill, model and effort, then: "I think there will be many intents, right?" (translated).
- Today: /accord routes the dashboard, Pick up, Continue, upgrade, a failure after verify (failure.md), pull request comments (comments.md) and debug inside a lane M ticket; "any other text starts a New request" (skills/accord/SKILL.md), so a question about the code, a brainstorm, research or an idea to keep gets a scout and a lane proposal.
- Candidate intents for the interview to settle: change (story or bug, lanes S/M as today), question about code or accord, brainstorm or explore an idea, research (ST-LN-13), queue an idea for later (ST-LN-29), review code accord did not build, debug with no ticket, release or operations (ST-LN-15), change or drop an approved ticket.
- Queued intent: a short intent step before the lane step routes to a skill only; when unsure it defaults to a change request, says the route out loud, and the owner can override. Model and effort are never chosen by this step (12 tier-up misses before ST-LN-17 moved that rule into the CLI).
- Open for the interview: which intents get a path now and which stay New requests; whether the route is printed by the CLI from the request text or judged by the main session; relation to ST-LN-49 (one command per action) and ST-LN-22.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-83

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
