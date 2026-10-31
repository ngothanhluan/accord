---
id: "ST-LN-57"                            # equals the file name: tickets/<id>.md
title: "Review checks a fixed scope, and a late finding blocks only with evidence"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-17"]
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
- Why: 64% of round-3+ review findings came from an earlier round's fix, and 5 of the 7 late Musts from code added mid-review by a debug episode or a merge of main, none from a defect missed earlier (`accord/research/2026-10-25-review-convergence.md`); ST-LN-14's review ran 18 rounds.
- For whom: whoever runs accord review in lane S or lane M, and the owner who waits on it.
- Success: review checks a pinned scope; code added by a debug episode or a merge gets its own round 1; `accord gate done` refuses a late block without a test or command, a Should without grounds, and a file a fix changed that nothing explains; data loss and security always block.
- Not this ticket: counting rounds, the cap, tier-up, and whether counts restart after verify (ST-LN-17); how a finding is stated and fixed (ST-LN-56); the CLI never runs a reviewer's command.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-57

  @ac-1
  Scenario: The next review round covers only code added after the last round
    Given a ticket in review whose last recorded round reviewed the ticket branch up to a known head commit
    And a debug episode or a merge of main has since added commits to the ticket branch
    When the review package for the next round is built without a --base option
    Then it holds only the ticket branch's commits after that head commit, leaving out what a merge brought in from main but keeping the merge's own conflict resolutions
    And review.md records, for each round, the head commit that round reviewed up to

  @ac-2
  Scenario: From round 3, a new finding outside the last fix's files blocks only with evidence
    Given review.md whose round 3 holds a Must or a Should that is not marked as carried forward from an earlier round
    And the file in the finding's location is one that none of round 2's fix commits, every commit after round 2 up to round 3 but a merge of main, a debug episode's commits and commits that change only the ticket's records, changed, or the finding gives no file
    And the finding is not marked as data loss or security
    When accord gate done runs
    Then it fails and names the finding while the finding records neither a failing test nor a reproducing command
    And it passes that finding when the finding records a failing test or a reproducing command
    And it passes that finding when the finding is marked deferred and the ledger's Deferred names it by round and number
    And it passes the same finding without evidence when it is marked as data loss or security
    And a finding so deferred, with its Deferred line, does not count toward the stop ST-LN-17 prints from round 3, nor toward the gate done failure that stop causes

  @ac-3
  Scenario: Code added by a debug episode or a merge starts its own round 1 for the evidence rule
    Given a ticket whose review reached round 4
    And a debug episode or a merge of main then added commits
    When the next round reviews those commits
    Then review.md records that round as round 1 of the added code
    And accord gate done asks no evidence of a finding located in a file the package of ac-1 shows those commits changed until that code's own round 3
    And a finding in any other file keeps the ticket's round count
    And the round count ST-LN-17 keeps still counts that round as the ticket's round 5

  @ac-4
  Scenario: From round 3, a Should rests on a ticket line or a failing case
    Given review.md whose round 3 or later, counted as ac-2 and ac-3 count it, holds a Should that is not marked as carried forward from an earlier round
    When accord gate done runs
    Then it fails and names the Should when the finding records neither a reference to an acceptance criterion, Decision, Veto or Intent line that exists in the ticket, nor a failing test or reproducing command
    And it passes when the finding records one of them, or the finding is a Nice, or it is marked as data loss or security
    And it asks no grounds of a Should in round 1 or 2

  @ac-5
  Scenario: A file a fix changed needs a finding or a Ruling
    Given a review round whose fix commits, every commit after that round up to the next round but a merge of main, a debug episode's commits and commits that change only the ticket's records, change a file that is the location of no finding of that round
    When accord gate done runs
    Then it fails and names the file while the ledger's Rulings hold no Ruling giving that file's repository path and a reason
    And it passes once such a Ruling is there
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The ticket has four parts: (1) review scope pinned to a base, code added by a debug episode or a merge reviewed as its own round 1; (2) a fix that changes a file no finding names needs a Ruling; (3) from round 3 a new finding blocks only with a failing test or a reproducing command, else Deferred, data loss and security always block; (4) a Should rests on a ticket line or an in-scope failing case, else Nice, with the same exception — "A" (2026-10-29, asked: keep all four parts)
- D-02 The ticket waits for ST-LN-17: its round-based rules (own round 1, from round 3) use the round count the CLI keeps, not one the agent counts — "A" (2026-10-29, asked: wait for ST-LN-17, build alone now, or fold round counting in)
- D-03 From round 3, a finding counts as on the last fix when it is in a file that fix changed (file, not line); only a finding outside those files needs evidence to block — "A" (2026-10-29, asked: file or line)
- D-04 The CLI checks the form: each finding line in review.md carries its grounds (a ticket line, or a test or command that reproduces it), and `accord gate done` fails on a blocking finding from round 3 outside the last fix's files without a test or command, a Should without grounds, or a file a fix changed that no finding names and no Ruling covers; the CLI never runs the command — "A" (2026-10-29, asked: CLI checks the form, skill text only, or CLI runs the evidence)
- D-05 The own round 1 for code added by a debug episode or a merge restarts only the evidence gate's count; the round cap and the stop that reports to the owner keep counting every round of the ticket — "A" (2026-10-29, asked: restart only the evidence count, or restart everything)
- D-06 The smallest version that counts as done holds all four parts — "A" (2026-10-29, asked: all four parts required, or parts 1 and 3 as the core)
- D-07 The rule that a Should rests on a ticket line or a failing case applies from round 3 only; rounds 1 and 2 fix every Should as today — "A" (2026-10-29, asked: from round 3 only, or every round)
- D-08 A finding deferred under ac-2's evidence rule, with its line in the ledger's Deferred, does not count toward ST-LN-17's stop from round 3 or the gate done failure it causes; this ticket changes that one rule of ST-LN-17 — "as proposed" (2026-10-31, asked: deferred findings leave the stop, or keep counting as ST-LN-17 does today)
- D-09 A round's fix commits are every commit after that round up to the next round, but a merge of main, a debug episode's commits and commits that change only the ticket's records; a fix split over two commits cannot escape the checks and nobody has to name each commit as "fixed in" — "A" (2026-10-31, asked: fix commits are the round's range, or only the commits findings name as "fixed in" plus a check that every commit is named)
- D-10 When the ticket branch's HEAD is already on the default branch, or the ticket is done there, gate done skips this ticket's checks and prints a line saying so; the pull request's CI gate ran them on the branch — "A" (2026-10-31, asked: skip with a notice, or keep checking and fail a ticket whose pull request merged before its tick)
- D-11 In lane S, a Should's ticket line under ac-4 may be a quote from the ticket's `## Understood` or `## Done when`, lane S's counterparts of Intent and acceptance criteria — "A" (2026-10-31, asked: allow those quotes, or accept only a test or command in lane S)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
