---
id: "ST-LN-30"                            # equals the file name: tickets/<id>.md
title: "Work starts from the latest main: a new ticket branch is cut after a fetch, and a ticket branch behind main is noticed"
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
Queued 2026-10-21, not approved; the intent interview replaces this:
- Owner asked "hiện tại accord có always pull latest from main trước khi bắt đầu làm ko", then "ok tạo đi". Today only `accord worktree clean` (run by `/accord` with no argument) fetches; `accord worktree open <id>` (Pick up) and `accord new ticket --worktree` cut the branch from `origin/main` as last fetched, so `/accord pick-up <id>` typed directly can start from a stale base. Continue (`worktree open --continue`) never compares the ticket branch with main, and lane S edits the current checkout without a fetch. The main checkout is never pulled.
- Proposal to confirm at intent: Pick up and `new ticket --worktree` fetch origin first (prompts off, as `worktree clean` does), and on a failed fetch say so and go on with the refs in the clone; Continue says when the ticket branch is behind the default branch and names the command to bring it up to date, without merging or rebasing itself.
- Also to settle: whether lane S fetches; whether the main checkout's own staleness is reported; overlap with ST-LN-16 (dashboard without a manual fetch) and ST-LN-11 (tests run on the result that will merge).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-30

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
