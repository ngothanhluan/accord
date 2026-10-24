---
id: "BUG-LN-7"                            # equals the file name: tickets/<id>.md
title: "The accord pane in a clone reports a version mismatch after a release until the CLI is built again"
type: "bug" # story | bug. An epic uses its own template
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
- Owner, 2026-10-24, after the accord pane in C:\Work\accord showed "config.yml pins accord 0.2.0, running 0.1.0 - run: npx --yes @accord-dev/accord@0.2.0": "ok, open a ticket".
- Cause found in session (main 7422cc4): the pane runs `npx --yes @accord-dev/accord@0.2.0 dashboard --json`. In this repository `node_modules/@accord-dev/accord` is a junction to the workspace `packages/cli`, whose package.json reads 0.2.0, so npx runs the local `dist/cli.js` instead of the npm release. That dist was built 2026-10-22, before `release: 0.2.0` (4cca564), so it reported 0.1.0 and the pin check refused. `npm run build` fixed it; the global `accord` (0.2.0) was never affected.
- Recurs on every version bump in any clone of accord itself whose dist is older than its package.json; the `setup:` commands in config.yml build only new ticket worktrees, not the main checkout after a pull.
- Not decided: whether the fix is a build step after the bump, a clearer message when the running dist is older than its own package.json, or the pane preferring the npm release over a workspace link.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-7

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
