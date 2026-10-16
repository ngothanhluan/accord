---
id: "BUG-LN-2"                            # equals the file name: tickets/<id>.md
title: "The dashboard shows every claimed ticket at the stage its branch holds"
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
On 2026-10-16 `accord dashboard` on main showed "0 in progress" while ST-LN-5 and ST-LN-6 were claimed, because a ticket created on its claim branch is skipped wherever its file is absent; ST-LN-4 read `build 0/5` while its plan was still in critique, and ST-LN-6 read "the owner approves the ticket" with an empty Intent.
For every teammate who reads the dashboard, `accord status` or the panel to see who holds what and where it stands.
Success: on main, every claimed ticket shows with the stage its claim branch holds, `build` appears only after `plan: <id> ready`, and an unwritten intent points to the intent interview; checked by the criteria tests and by `accord dashboard` on main once this merges.
Not in scope: fetching from the network, changing which branch wins a claim, the panel's own layout.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-2

  @ac-1
  Scenario: A ticket whose file exists only on its claim branch shows at the stage that branch holds
    Given a repository whose current branch has no file for ticket X
    And a remote-tracking branch `origin/t/X`, with no local `t/X`, whose tip holds X approved, a plan whose last commit subject is exactly `plan: X ready`, and one of its three tasks recorded in the ledger
    When `accord status --json` and `accord dashboard` run on the current branch with no network access
    Then X is listed as claimed by the author of that tip commit, at stage `build 1/3`
    And neither command fetches

  @ac-2
  Scenario: The claim branch's copy wins over an older copy on the current branch
    Given the current branch holds ticket X unapproved
    And the claim branch `origin/t/X` holds X approved, with a plan whose last commit subject is exactly `plan: X ready` and no task recorded
    When `accord status --json` runs on the current branch
    Then X is at stage `build 0/n`, the stage `origin/t/X` holds, not at stage `intent`

  @ac-3
  Scenario: A plan that has not reached its ready commit is still at stage plan
    Given ticket X approved, with a plan.md holding tasks
    When the last commit that touched plan.md has the subject `plan: X round 1, 1 Must, 0 Should`, or X is read from the working tree and its plan.md is untracked or has staged or unstaged changes
    Then `accord status --json` and `accord anchor` show X at stage `plan`, not `build`
    And once the last commit that touched plan.md has the subject exactly `plan: X ready`, and plan.md has no uncommitted change when X is read from the working tree, X is at stage `build 0/n`
    And for X read from a claim branch that is not checked out, only that branch's commits decide, never the current working tree

  @ac-4
  Scenario: A ticket whose intent is not written yet points to the intent interview
    Given ticket X whose `## Intent` section holds nothing but HTML comments and blank lines, or whose acceptance criteria block holds no scenario other than the template's placeholder one
    When `accord anchor` and `accord dashboard` show X
    Then its next step reads "the intent interview (accord-intent)", not `accord approve`
    And once Intent and acceptance criteria are written and X is not approved, its next step is "the owner approves the ticket (accord approve)"
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 For a claimed ticket, the dashboard and status read the ticket, its plan, ledger, review, verification and the plan's ready commit from the claim branch, even when the current branch holds an older copy — "Luôn từ nhánh claim (Recommended)"
- D-02 All three parts are in scope and none is cut: claimed tickets on other branches show, `build` only after `plan: <id> ready`, an unwritten intent points to the interview — "Đúng cả 3 (Recommended)", then "Cả 3 phần, không cắt (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
