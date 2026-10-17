---
id: "BUG-LN-3"                            # equals the file name: tickets/<id>.md
title: "A pull request that adds draft tickets to the backlog can pass the accord check"
type: "bug" # story | bug. An epic uses its own template
status: draft                             # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
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
On 2026-10-17 PR #28, which adds only draft tickets ST-LN-8..15, failed the accord check: the workflow `accord init` writes runs `accord gate done` on every ticket file a pull request touches, so a backlog cannot land on the default branch, and dropping a ticket the way the ids rules say ("commit and merge that") fails the same way.
For a team where one person files the backlog and another picks it up, and for anyone dropping a ticket.
Success: PR #28 passes the accord check and merges; a pull request that carries code still gates every ticket it touches.
Not in scope: `gate done` and `gate ready` rules themselves, gating pull requests that touch no ticket file, the CI test matrix.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-3

  # "Approved" below means the ticket's parsed frontmatter has an `approved_hash` key, in the pull request's
  # version or in the base commit's version of the file; a commented `# approved_hash:` line is not a key.
  # "Dropped" means `status: dropped` in the pull request's version, with a `## Dropped` section `accord lint` accepts.

  @ac-1
  Scenario: A pull request that adds or edits only unapproved tickets passes without gate done
    Given a pull request whose diff changes only files under `accord/`
    And no ticket file `accord/tickets/<id>.md` it adds or changes is approved, in its own version or in the base commit's
    When the lint-and-gate script of the workflow `accord init` writes runs on it
    Then `accord gate done` runs on none of those tickets, `accord lint` runs, and the script exits 0 when lint has no error
    And the script exits 1 when lint reports an error

  @ac-2
  Scenario: A pull request that drops a ticket, or edits a dropped one, passes without gate done
    Given a pull request whose diff changes only files under `accord/`
    And it changes ticket X, which is dropped in the pull request's version, approved or not
    When the lint-and-gate script runs on it
    Then `accord gate done` does not run on X, and the script exits 0 when lint has no error
    And when X's `## Dropped` section is missing or empty, lint reports an error and the script exits 1

  @ac-3
  Scenario: A pull request that carries code, or touches an approved ticket, still gates it
    Given a pull request that changes ticket X
    And either its diff changes any file outside `accord/`, whatever X says, or its diff changes only files under `accord/` while X is approved in its own version or in the base commit's and is not dropped
    When the lint-and-gate script runs on it
    Then it runs `accord gate done X`, and exits 1 when that gate fails
    And removing `approved_hash` from X in the pull request does not stop `accord gate done X` from running when the base commit's X has it

  @ac-4
  Scenario: This repository's workflow gates by the same rule as the one `accord init` writes
    Given the workflow `accord init` writes and this repository's `.github/workflows/accord.yml`
    When the cases of @ac-1, @ac-2 and @ac-3 run against the lint-and-gate script of each
    Then in every case both scripts run `accord gate done` on the same tickets and exit with the same code
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 All four parts are in scope and none is cut: unapproved tickets pass, dropped tickets pass, a pull request with code still gates every ticket it touches, and the workflow `accord init` writes applies the same rule as this repository's — "Làm tiếp, đủ cả 4 phần (Recommended)", then "Đủ cả 4 phần, không cắt (Recommended)"
- D-02 `gate done` is skipped for a ticket only when it is unapproved (no `approved_hash`) or dropped with a reason, and the pull request changes nothing outside `accord/`; a pull request with code gates every ticket it touches whatever the ticket says — "Ticket nháp/đã bỏ VÀ PR không có code (Recommended)"
- D-03 A ticket counts as approved when `approved_hash` is in its frontmatter in the pull request's version or in the base commit's version, so deleting the key cannot skip the gate — "Có dấu ở main HOẶC trong PR thì kiểm (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
