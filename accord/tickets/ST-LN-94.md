---
id: "ST-LN-94"                            # equals the file name: tickets/<id>.md
title: "A question accord cannot answer from the code is worked in a research lane with a timebox, ending in a research record"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
research: ["accord/research/2026-11-03-backlog-review.md"]
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
Queued 2026-11-03, not approved; the intent interview replaces this:
- Why: tickets that only answer a question (ST-LN-35, ST-LN-42, the measurement half of ST-LN-89 and ST-LN-90, and ST-LN-46 itself) go through intent, approach, plan, build, review and verify like a feature, so a question costs a plan, plan critics and code review. ST-LN-46 took 5 approach critique rounds and 1.82 M weighted tokens for the plan writer alone (accord/research/2026-11-02-critic-loop-practice.md section 3).
- Proposal to confirm at intent: a lane whose ticket holds a question, a timebox and a token budget; its output is an `accord/research/<date>-<topic>.md` record the owner reads and decides on; no plan critique and no code review; scripts it writes stay out of the shipped packages. Its name and letter are for the interview (lanes today are S, M, L, P).
- Open for the interview: whether a research-lane script that later ships must go through lane M; relation to ST-LN-86 (the researcher agent) and ST-LN-83 (routing a request that is not a change).
- Research: `accord/research/2026-11-03-backlog-review.md` M3 (evidence, not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-94

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
