---
id: "ST-LN-13"                            # equals the file name: tickets/<id>.md
title: "Research behind a ticket is kept in the repository with its sources, and an agent researches outside libraries before the approach"
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
Queued 2026-10-17, not approved; the intent interview replaces this:
- Owner approved 2026-10-13: an `accord-researcher` agent runs at the approach stage when a ticket touches an outside library, API or version the code cannot answer; writes `accord/tickets/<id>/research.md` with source and date per fact; the architect reads it.
- A library documentation tool first when installed, official docs second, web search third; shipped text describes the tool by function and never names it.
- Widened (owner, 2026-10-25, after the main session proposed it: "ok, do it and open a PR"): knowledge made before a ticket exists, a discussion, a measure or a study, has no home. A ticket's Intent holds five lines, the intent interview replaces the queued intent, and the owner's memory is local to one machine and one runtime. On 2026-10-25 a measure of 129 review findings and a study of GSD fed four tickets and existed only in one session.
- Queued: research is recorded in `accord/research/<date>-<topic>.md`, shared because one study feeds several tickets, with its date and the commit it was made at; a ticket names it under a `research:` key that lint checks exists; the intent interview, architect, critic and planner read it; the interview moves evidence it replaces in the queued intent into the record instead of deleting it. Research is evidence, never a contract. The researcher's output could go there instead of the per-ticket `accord/tickets/<id>/research.md` above; the interview decides.
- Evidence (2026-10-29): in ST-LN-60's intent interview, the main session and `accord-scout` both skipped `accord/research/2026-10-25-plugin-audit.md`, which that ticket named only in free text in its Intent, until the owner asked about it.
- Idea (owner, 2026-10-29): `accord anchor` prints a ticket's research references, so every stage sees them.
- First record: `accord/research/2026-10-25-review-convergence.md`. The ticket schema rejects unknown keys, so `research:` is not usable yet; whether adding it breaks repositories pinned to 0.2.0 is to be checked.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-13

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
