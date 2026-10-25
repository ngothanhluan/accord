---
id: "ST-LN-55"                            # equals the file name: tickets/<id>.md
title: "Finished work leaves no worktree, branch or folder behind"
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
Queued 2026-10-25, not approved; the intent interview replaces this:
- Owner, 2026-10-25: "why doesn't the LLM clean up its own work once the benchmark ticket is done?" 75 benchmark worktrees and their `bench/*` branches stayed after round 1, though `docs/benchmark/round-1.md` existed and `node scripts/benchmark.mjs --clean` was ready; no step runs it.
- Queued intent, three parts: (1) the benchmark removes its run worktrees once the round report is written (each run's commits are already kept under `refs/keep/`); (2) `accord worktree clean` deletes a removed worktree's leftover folder when it holds only links, as `scripts/benchmark.mjs` already does (Windows `git worktree remove` skips npm's workspace junctions, which left five `node_modules` folders on 2026-10-25); (3) branches made by hand (`fix/`, `release/`, `backlog/`) are cleaned once merged into the default branch, or are made through accord.
- Seen, not yet in scope: a worktree kept only for an untracked tool folder (`.impeccable/` kept ST-LN-48's), and a ticket dropped before `accord drop` existed, whose drop record never reached main (ST-LN-33), so clean never sees it as dropped.
- Changes what `accord worktree clean` deletes, a public behaviour; never removes uncommitted work or a commit reachable from nothing else.
- Added (owner, 2026-10-25, after the main session proposed a five-ticket plan for review convergence: "ok, agreed"): each worktree is recorded when created and `gate done` checks it was removed, as GSD records worktrees in a manifest and fails cleanup closed. On 2026-10-25, 15 folders of removed worktrees, each holding only links, were found and deleted by hand.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-55

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
