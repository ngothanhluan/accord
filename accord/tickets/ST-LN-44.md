---
id: "ST-LN-44"                            # equals the file name: tickets/<id>.md
title: "The slowest tests run in less time and still cover what they cover today"
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
- Owner, 2026-10-22, to a read-only audit of all 73 test files (~1,100 tests) by five agents: "cả 2 ticket đi". Make the slow tests below cheaper without losing coverage. Line numbers as of main 8a8ba6f; each item is an agent's reading, check it before changing. Windows CI times from run 39784116057 (windows-latest, Node 22).
- cli show-approval.test.ts:124 ac-1 rebuild over every real ticket, 78.7 s: call core approvalView(snap.tickets[id]) and check snap.errors per ticket instead of one CLI run per ticket; CLI-only parts covered by :297, :313, :267.
  2026-10-24, ST-LN-48 plan baseline: it timed out at the 300 s limit under the full suite (1162 s run) and passed alone in 140 s; the owner chose to track it here.
- cli workflow-script.test.ts:454, 59.9 s: run both scripts in one sandbox (runScript only adds untracked files), about 30 s saved; same for :501 (12.5 s), about 6 s. cli worktree.test.ts:1799, 23.5 s: the two merging cases (1857, 1874) share one clone. cli after-verify.test.ts:27, 22.6 s: sections d (71) and f (105) reuse a clone. cli worktree.test.ts:1006, 17.3 s: all six commands in one folder, one command in the other two.
- cli trailers.test.ts:21, 7.2 s: one CLI body; core trailers.test.ts:4 covers the patterns. cli lane-commands.test.ts:825 it.each over four unsafe paths, 9.0 s: one plan, one repo, four findings. cli lane-commands.test.ts:1040, :1048, :1056 (VID-1 ac-1/2/3, 6.6 s): pure plan parsing; move to core lane-plan.test.ts and retag.
- cli status.test.ts:416 and :438 share one repo; show.test.ts:149 folds into status.test.ts:460; show.test.ts:172 with dashboard.test.ts:354; show.test.ts:120 with status.test.ts:360; dashboard.test.ts:135 uses the in-memory ready()/board() helpers as :165 does. cli publish-workflow.test.ts:140 and :158 merge with :132 and :149.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-44

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
