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
approved_hash: "fnv1a64:321c7f9e06e86aa6"
ac_hash: "fnv1a64:540f1dd027a973a2"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
For teams that rely on the accord check in CI: an approved or done ticket must never disappear without a recorded reason, and the check must report every lint and gate failure on one push under the shell flags GitHub uses.
Success: a pull request that deletes an approved ticket not yet `status: dropped` fails with a message naming the fix; deleting a dropped ticket or any unapproved ticket still passes (A-09 narrowed by D-01); under `bash -eo pipefail` a lint failure and a gate failure are both reported; the tests run the script with those flags.
Found in BUG-LN-3 review round 1 and final review; the delete-and-add variant is already blocked by BUG-LN-3's code and only gets a test here.
Not in scope: `gate done` itself, the `accord drop` command, any change to which tickets `gate done` treats as approved, and refreshing the script in repositories that already ran `accord init` (D-03, its own ticket).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-4

  @ac-1 @test:packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-a-deleted-approved-ticket-not-dropped-at-the-base-fails-naming-the-ticket-and-accord-drop
  Scenario: Deleting an approved ticket that was not dropped fails the check
    Given a ticket whose version at the base commit has an approved_hash key, whatever its value, or an ac_hash key on lane S or with no lane key, or at least one verified tick on any lane, and is not dropped as in @ac-2
    When a pull request deletes that ticket's file, a rename included, and the accord check runs
    Then the check exits non-zero
    And it prints the ticket id and says to drop the ticket with accord drop before deleting it

  @ac-2 @test:packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-a-deleted-ticket-dropped-at-the-base-or-not-approved-there-passes-without-gate-done
  Scenario: Deleting a dropped ticket or an unapproved ticket still passes
    Given a ticket that is status dropped with a readable reason under ## Dropped at the base commit, and another that is not approved as in @ac-1 at the base commit, whatever its status
    When a pull request deletes either ticket's file, with or without its folder under accord/tickets/, and changes nothing else, and the accord check runs
    Then the check exits zero without running gate done

  @ac-3 @test:packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-a-swap-of-an-approved-ticket-for-an-unapproved-one-fails-naming-the-deleted-ticket-and-still-gates-the-new-one
  Scenario: Swapping an approved ticket for an unapproved one fails and still gates the new ticket
    Given a ticket approved as in @ac-1 and not status dropped at the base commit
    When a pull request that changes only accord/ deletes it and adds a new unapproved ticket, and the accord check runs
    Then the check exits non-zero and names the deleted ticket as in @ac-1
    And gate done still runs on the new ticket and its output is printed, whatever its verdict

  @ac-4 @test:packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-lint-and-a-gate-failing-together-under-the-CI-shell-flags-are-both-printed-and-the-check-fails
  Scenario: Every failure is reported on one push under the flags CI uses
    Given the script the workflow runs, started as bash --noprofile --norc -eo pipefail
    When lint fails and a gate fails in the same run
    Then lint and every gate still run and their failures are printed
    And the check exits non-zero
    And every test in the file that runs the workflow script, probes included, starts bash with those same flags
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Deleting an approved or done ticket passes only when its base version is already `status: dropped`; otherwise the pull request fails with a message saying how to fix it; an unapproved draft may still be deleted freely (A-09 narrowed) — owner chose option (a): "A"
- D-02 An unapproved ticket may be deleted whatever its status (draft, open or archived); only an approved one must be dropped first — owner chose option (a): "A"
- D-03 Repositories that already hold the workflow are out of scope; `accord upgrade` refreshing the script is its own ticket — owner chose option (a): "A"
- D-04 A done ticket written before lanes existed (no lane key, with an ac_hash or verified ticks) is protected like an approved one and must be dropped before deletion — owner chose option (a): "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: the deletion check plus `set +e`. In the lint-and-gate script (packages/core/src/scaffold/workflow.ts and this repository's .github/workflows/accord.yml), the deletion loop runs always, not only when the pull request is accord-only, and the "nothing to gate" exit moves below it. `is_dropped` takes a revision and a path. A ticket approved at the base that is deleted keeps setting has_code (BUG-LN-3's rule); when it is also not dropped at the base the script prints its id, says to run `accord drop <id>`, merge the default branch into this branch and push, and sets code=1. A ticket whose base status is dropped but whose reason the script cannot read gets its own line saying to fix the `## Dropped` reason on the default branch, never the `accord drop` advice that command would refuse. A failing listing of deleted files fails with a line of its own. `set +e` goes ahead of `set -uo pipefail` with a comment that GitHub starts the script with -e and this line undoes it; `shell: bash` stays. The emitted comments that said deletion never fails are rewritten, and the "nothing to gate" line is not printed after a deletion error.
The verify skill's local stand-in for the check (packages/core/skills/verify/ci.md, rendered with `npm run gen`) applies the same deletion rule, so verify cannot report green on a branch the check will fail.
Rejected: deletion check alone, relying on every command staying inside a condition — one later unguarded line ends the script early, which @ac-4 forbids. A custom `shell:` line without -e — lost when anyone edits the step, and the tests could no longer use GitHub's default flags that @ac-4 names.
Affected: workflow.ts, .github/workflows/accord.yml, packages/core/skills/verify/ci.md and its rendered copies, packages/cli/test/workflow-script.test.ts, accord/tests-baseline.txt (the A-09 line goes).
Risks (critic, all Should, all taken into the plan): no test fails without `set +e` because today's script already survives -e, so a mutation probe inserts a bare `false` and shows lint and gate still run with the line and stop without it; the stub prints nothing, so it gains an output marker the tests assert for "printed"; an accord-only test set would not see the loop guard come back, so one @ac-1 case also changes code; the new cases join the replay against this repository's copy. Kept: a dropped ticket deleted with a new draft still gates the draft, as today. Out: repositories initialised before this release keep the gap until the upgrade ticket (D-03); the same false comment in .github/workflows/ci.yml, a different step.
Failure scenarios (data deletion): an existing install upgrades and still merges a delete-only pull request (undone by D-03's ticket; the file stays recoverable from history); verify's local check misses a deletion (closed by the ci.md change); a lint-valid dropped ticket the script cannot read blocks its own deletion (the separate message names the fix; worst case the file stays, nothing is lost).
Tests: all in workflow-script.test.ts, executing the emitted script under `bash --noprofile --norc -eo pipefail` in temporary repositories: @ac-1 (approved_hash, lane S ac_hash, with and without code), @ac-2 (the A-09 test reworked: dropped and unapproved at the base), @ac-3 (swap), @ac-4 (lint and gate fail together, plus the `false` probe and a flags probe).
