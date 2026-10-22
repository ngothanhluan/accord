---
id: "ST-LN-37"                            # equals the file name: tickets/<id>.md
title: "A ticket's pull request cannot merge until accord's own CI check passes on a test report CI produced"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
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
Queued 2026-10-22, not approved; the intent interview replaces this:
- Audit item 2 (another agent): "Hiện CLI không biết ai đã tạo file báo cáo, nên agent có thể làm giả. Đây là lỗ hổng lớn nhất." Owner, 2026-10-22, to the proposal in chat: "ok queue hết di".
- Checked 2026-10-22: true locally, since `gate done` reads the `tests.report` file the session's own run wrote; but that file is gitignored and `.github/workflows/accord.yml` reruns the full suite and gates on its own report.
- The real gaps: main has no branch protection or ruleset (`gh api`, 2026-10-22: "Branch not protected", rulesets `[]`), so the accord check never blocks a merge; accord-verify `ci.md` leaves out the accord workflow ("never wait for it"), so the owner's report never shows CI's gate verdict; a `pull_request` run uses the pull request's own `accord.yml`, test config and `accord/config.yml`, so the change under review can change what CI runs.
- Proposal to confirm at intent: verify waits for the accord check on the verified commit and puts its verdict in the report; a ticket pull request that changes the accord workflow, the test config or the `tests.*` keys is flagged to the owner; `accord init` and the readme say how to make the accord check required. Rejected: pulling CI's report artifact into local `gate done` (network and gh, and the artifact comes from the same workflow the pull request controls). Related: ST-LN-11 (`accord init` CI runs `tests.full`).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-37

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
