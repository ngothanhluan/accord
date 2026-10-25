---
id: "ST-LN-63"                            # equals the file name: tickets/<id>.md
title: "Each accord command starts as few git processes as it needs"
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
- Why (owner, 2026-10-25, ST-LN-44 D-11: the git cut is "queued together as their own ticket"). Measured with GIT_TRACE2_EVENT in this repository on 2026-10-25: `status` 150 git processes / 21 s, `anchor` 137 / 19.5 s, `lint` 135 / 21 s, `dashboard` 151 / 21 s, `show` 150 / 23 s.
- Queued intent, part 1 (ST-LN-44 D-10, sized): `loadParts` (packages/cli/src/load/fs.ts) computes plan-baseline ancestry, baseline files and paths changed since each recorded commit for every ticket on every command (128 of `status`'s 150 processes), but only `gate plan` / `gate done` read them, and only for the gated ticket (core gate/plan.ts, gate/done.ts). Compute them only there.
- Part 2: one-process default ref, claim tips from the existing listing, HEAD author folded into the existing `cat-file`, one `--merged` query in clean instead of a merge-base per branch, the duplicate `currentBranch` / `reviewCommit` / `get-url` / `worktree list` / ssh-config calls, and a light preflight before the fetch in pick-up and `new ticket --worktree`; `safeTip`'s re-check stays (data-loss guard).
- Part 3, from ST-LN-44's table: a benchmark sample filter in scripts/benchmark.mjs for the 7 kept benchmark tests, without the crash at :859-862 or a loss of the once-per-verifier check; open at intent whether it belongs here.
- Same stdout, stderr, exit code and JSON on any repository whose objects are intact; the architect's sizing and risk tests are in ST-LN-44's session record and ledger.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-63

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
