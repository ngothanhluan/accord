---
id: "ST-LN-74"                            # equals the file name: tickets/<id>.md
title: "The seven kept benchmark-worktree tests run --plan over every sample, so each takes 19-57 s in a full run"
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
- Why: ST-LN-44 kept seven tests in packages/core/test/benchmark-worktree.test.ts over 10 s (its table rows #11, #16, #22, #23, #29, #33, #37, ceilings 44, 39, 30, 28, 26, 25, 23 s) because their only lever is a script change: `checkSamples` (scripts/round.mjs:36-40) needs 9 agents x n 1-5, and `--plan` makes one worktree per non-writer sample and per writer row (scripts/benchmark.mjs:837-855), so every test pays for all of them. In ST-LN-63's verify full run at d67b280 (2026-10-30, 4 workers) they took 57.1, 35.3, 31.0, 25.6, 23.5, 19.4 and 18.8 s; #11 (57.1 s, ceiling 44) and #22 (31.0 s, ceiling 30) were over their ceilings. Origin: ST-LN-44 rejected the filter inside its own ticket (it crashed rows, broke the per-verifier check, and added a 20-40 s test) and queued it with the git-cut ticket; ST-LN-63 D-01 moved it to its own draft ticket ("A", owner). This is that ticket, ST-LN-63 part 3.
- Queued intent: a sample filter in scripts/benchmark.mjs lets these tests run `--plan` over only the samples each one needs, so each is under 10 s in a full run, or kept with a reason and a ceiling the owner approves, as ST-LN-44 did.
- Known constraints: the filter must not crash the executor loop at benchmark.mjs:859-862 (`rows.find(...)` returns undefined for a filtered-out sample, then `r.worktree` throws); it must keep the once-per-verifier-sample tests.full run and the report copy to its effort rows (benchmark.mjs:868-872, tested by #33); a real benchmark round still refuses a sample list that `checkSamples` rejects.
- Open for the interview: whether the filter is a CLI flag, an environment variable, or a test-only entry; whether it relaxes `checkSamples` or runs after it; whether the 20-40 s guard test the critic sized for the crash fix is worth it or folds into an existing test.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-74

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
