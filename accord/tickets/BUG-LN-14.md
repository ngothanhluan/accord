---
id: "BUG-LN-14"                            # equals the file name: tickets/<id>.md
title: "A /clear frees its window's ticket hold, and a refusal names the window that holds a ticket"
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
For the owner and teammates who work tickets in Claude Code windows: on 2026-10-27 a /clear in a window holding ST-LN-58 left that hold in place for as long as the window stayed open, so every other session was refused `/accord continue ST-LN-58` with a message naming only a conversation id and a pid that no visible window matched, and the same window went on to hold BUG-LN-12 as well.
Success: after a /clear the window holds no ticket, its old ticket continues from any session, and the window may take one other ticket; while a live session still holds a ticket, the refusal names the folder that session works in and when it took the hold.
Not in scope: a manual way to take over a hold a live session holds (D-03), and releasing holds left behind before this fix ships, such as today's ST-LN-58 hold (D-04).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-14

  @ac-1
  Scenario: A /clear releases the hold its old conversation took
    Given a Claude Code window whose conversation holds ST-9
    When the owner runs /clear in that window
    Then the hold record of ST-9 is removed
    And `accord worktree open ST-9 --continue` in another session is not refused as held by another session

  @ac-2
  Scenario: After a /clear the window may take one other ticket and holds only that one
    Given a Claude Code window whose conversation held ST-9 and then ran /clear
    When the new conversation in that window claims ST-10, a ticket nobody has claimed, with `accord worktree open ST-10`
    Then the claim is not refused
    And that window holds ST-10 and no other ticket

  @ac-3
  Scenario: A hold whose conversation did not clear stays
    Given a Claude Code window whose conversation holds ST-9
    When a second Claude Code window, open in ST-9's worktree folder, starts a conversation or runs /clear in its own
    Then ST-9 is still held by the first window
    And `accord worktree open ST-9 --continue` in the second window is refused as held by another session

  @ac-4
  Scenario: A refusal names the folder and the time of the hold
    Given a live Claude Code session took the hold on ST-9 while it worked in a folder
    When another session runs `accord worktree open ST-9 --continue`
    Then it exits 2
    And its message names the folder that session worked in when it took the hold, and the date and time the hold was taken, in the local time of the machine that prints it with its UTC offset
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The ticket covers all three parts: an orphaned hold (its conversation is gone, its window still open) no longer blocks other sessions; the refusal tells the owner which window holds the ticket; one window never holds two tickets — "a" (owner's choice of "all three, they share one root: the hold belongs to a conversation but lives as long as the process")
- D-02 After /clear (a new conversation in the same window), the window is free: the old conversation's hold is released, the window may take another ticket, and the old ticket can be continued from any session; its worktree, branch and commits stay as they are — "a" (owner's choice of "the window becomes free; /clear means starting over")
- D-03 No manual way to take over a hold a live session holds: the only way out is to find that window from the refusal and close it, and no new CLI option is added — "a" (owner's choice of "no take-over option; a hold exists to stop two sessions editing one ticket")
- D-04 The smallest version that counts as done: a /clear releases the old conversation's hold, and a refusal names the folder the holding session works in and when it took the hold; holds left behind before this fix ships are not cleaned, and the owner closes their window to free them — "a" (owner's choice of "this smallest version is enough; an old leftover hold is a one-off")
- D-05 The refusal shows when the hold was taken in the local time of the machine that prints it, in a readable form with its UTC offset, such as 2026-10-27 10:03 (UTC+07:00), not as a UTC ISO timestamp — "A" (owner's choice of "local time with its offset; I can match it to when I opened the window")

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
