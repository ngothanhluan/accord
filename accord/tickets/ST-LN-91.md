---
id: "ST-LN-91"                            # equals the file name: tickets/<id>.md
title: "A discuss stage settles every gray area with the owner, the plan says what and not how, and one checker checks it against ticket lines"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
research: ["accord/research/2026-11-02-critic-loop-practice.md", "accord/research/2026-10-25-review-convergence.md", "accord/research/2026-11-01-architect-fold-review.md"]
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
Queued 2026-11-02, not approved; the intent interview replaces this:
- Root cause agreed with the owner (2026-11-02, ST-LN-46 session): accord tries to prove the implementation right before code exists, by LLM critics reading prose with nothing to check it against. The plan becomes code written in English (ST-LN-46: 600 lines with fixture steps, regexes, signatures), so it carries code bugs only a run reveals; and a critic with no reference never converges (64% of late findings fix-induced; ST-LN-46 approach rounds 3-5 argued one heuristic). Evidence: accord/research/2026-11-02-critic-loop-practice.md.
- Owner (translated): "this is not a memory matter; it must be handled by the accord workflow or rules"; "critique belongs where the direction is chosen ... why is there no agent that verifies the plan, like GSD?"; "at the intent step everything must be clear, or add a discuss step to discuss many more things with the user, not only the intent".
- Shape agreed (2026-11-02, owner: "agreed", translated; to be settled in the interview): (1) intent stays short (why, criteria, Vetoes); (2) a new discuss stage replaces approach: scout and planner read the code, list gray areas by group (direction options, behaviour and output, failure and data loss, scope edges, interfaces, measurement rules or heuristics, test strategy), each with a recommended default and the consequence of each choice; the owner picks which to discuss in depth, like gsd-discuss-phase; every answer, defaults included, is written as a Decision; the owner approves once at its end (approval before the plan, as ST-LN-80 D-01 keeps); (3) the plan says what, not how: tasks, criteria covered, files, interfaces between tasks, test names, verify commands, and each task's dependencies, so CLI can group tasks into waves (ST-LN-92 runs them); lint refuses implementation detail or excess length; (4) one plan checker on a fixed checklist replaces the plan critics: a finding is valid only when it cites the ticket line it breaks; at most 3 rounds, stopping when the count does not fall (as gsd-plan-checker and its revision loop do); (5) implementation correctness is judged only on running code (test-first build, review on the diff, verify).
- Removes: the approach stage and its multi-round critic, the plan critics and the build lens, the separate direction pass whose report was lost at compaction (ST-LN-46 plan writer: 1.82 M weighted tokens).
- Not here: running tasks of one wave in parallel (ST-LN-92); model choice for the checker (measured after ST-LN-46's harness); lane S.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-91

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
