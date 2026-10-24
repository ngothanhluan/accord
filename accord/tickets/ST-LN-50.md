---
id: "ST-LN-50"                            # equals the file name: tickets/<id>.md
title: "A person new to accord is guided from init to their first ticket"
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
Queued 2026-10-24, not approved; the intent interview replaces this:
- Owner, 2026-10-24, asked "does accord have an onboarding process?"; told there is none beyond `accord init` and the README's "Try it", answered: "yes, open another ticket for onboarding".
- Today `accord init` writes the `accord/` folder, the skills for the named runtimes and a pinned CI workflow, skipping every path that exists; nothing then tells a person what a lane or a stage is, what to type first, or how their first ticket reaches done. A teammate who joins a repository that already has accord gets no guide either.
- The interview settles who is onboarded (a repository adopting accord, a person joining one, or both), where the guide lives (a command or skill, init's output, the dashboard when there are no tickets yet, docs), and how success is measured.
- Related, not part of this: ST-LN-40 (a draft of an existing codebase's conventions) and ST-LN-49 (separate /accord commands, which changes what the guide tells a person to type).
- Must hold the Compatibility constraint: the same guide in Claude Code, Cursor, Copilot and Codex.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-50

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
