---
id: "BUG-LN-4"                            # equals the file name: tickets/<id>.md
title: "The accord check in CI misses a deleted approved ticket, and runs its script under bash -e"
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
For teams that rely on the accord check in CI: an approved or done ticket must never disappear without a recorded reason, and the check must report every lint and gate failure on one push under the shell flags GitHub uses.
Success: a pull request that deletes an approved ticket not yet `status: dropped` fails with a message naming the fix; deleting a dropped ticket or any unapproved ticket still passes (A-09 narrowed by D-01); under `bash -eo pipefail` a lint failure and a gate failure are both reported; the tests run the script with those flags.
Found in BUG-LN-3 review round 1 and final review; the delete-and-add variant is already blocked by BUG-LN-3's code and only gets a test here.
Not in scope: `gate done` itself, the `accord drop` command, and any change to which tickets count as approved.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-4

  @ac-1
  Scenario: Deleting an approved ticket that was not dropped fails the check
    Given a ticket whose version at the base commit has an approved_hash key, whatever its value, or on lane S an ac_hash key, and is not status dropped
    When a pull request deletes that ticket's file and the accord check runs
    Then the check exits non-zero
    And it prints the ticket id and says to drop the ticket with accord drop before deleting it

  @ac-2
  Scenario: Deleting a dropped ticket or an unapproved ticket still passes
    Given a ticket that is status dropped at the base commit, and another that is not approved as in @ac-1 at the base commit, whatever its status
    When a pull request deletes either ticket's file and changes nothing else, and the accord check runs
    Then the check exits zero without running gate done

  @ac-3
  Scenario: Swapping an approved ticket for an unapproved one fails and still gates the new ticket
    Given a ticket approved as in @ac-1 and not status dropped at the base commit
    When a pull request that changes only accord/ deletes it and adds a new unapproved ticket, and the accord check runs
    Then the check exits non-zero and names the deleted ticket as in @ac-1
    And gate done still runs on the new ticket and its result is printed

  @ac-4
  Scenario: Every failure is reported on one push under the flags CI uses
    Given the script the workflow runs, started as bash --noprofile --norc -eo pipefail
    When lint fails and a gate fails in the same run
    Then lint and every gate still run and their failures are printed
    And the check exits non-zero
    And every test in the file that runs the workflow script starts bash with those same flags
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Deleting an approved or done ticket passes only when its base version is already `status: dropped`; otherwise the pull request fails with a message saying how to fix it; an unapproved draft may still be deleted freely (A-09 narrowed) — owner chose option (a): "A"
- D-02 An unapproved ticket may be deleted whatever its status (draft, open or archived); only an approved one must be dropped first — owner chose option (a): "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
