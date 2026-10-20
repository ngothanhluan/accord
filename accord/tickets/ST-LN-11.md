---
id: "ST-LN-11"                            # equals the file name: tickets/<id>.md
title: "CI and verify run the full test suite on the result that will merge"
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
- Dogfood items 4/4a: config keys, `accord init` CI runs `tests.full`.
- One accord-verify step: git fetch, merge origin/main when behind, then `tests.full`; never rebase.
- Added 2026-10-19 at the owner's "ok theo bạn đề xuất đi. miễn sao vẫn tốt mà ko impact gì mà vẫn nhanh hơn là dc": this repository's `ci.yml` runs two jobs on a pull request, ubuntu with Node 22 (the engines floor) and windows with Node 24 (the author's OS and the current LTS), and the full os x node matrix on a push to main. Why: a PR waits about 5 minutes, almost all of it the two windows jobs (`npm test` 198 s on Node 24, 254 s on Node 22, against 32-36 s on ubuntu); OS bugs and Node-version bugs are mostly independent, so two jobs cover both kinds. Cost: a bug only on windows with Node 22 shows after merge, on main, not on the PR. Rejected: skipping `ci` for PRs that touch only `accord/**`, since tests read this repository's own tickets and workflow (`show-approval.test.ts` "every real ticket", `workflow-script.test.ts`).
- Decision to confirm at intent, same answer: `engines` stays `>=22.12.0`; the floor rises to Node 24 when Node 22 reaches end of life on 2027-04-30, or at the first npm release if that lands near it, and then the CLI checks the running Node version at start and exits 2 naming the version needed, since `engines` only warns.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-11

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
