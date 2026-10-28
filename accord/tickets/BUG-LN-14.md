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
approved_hash: "fnv1a64:830b174559076a28"
ac_hash: "fnv1a64:bdb89db655940114"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
For the owner and teammates who work tickets in Claude Code windows: on 2026-10-27 a /clear in a window holding ST-LN-58 left that hold in place for as long as the window stayed open, so every other session was refused `/accord continue ST-LN-58` with a message naming only a conversation id and a pid that no visible window matched, and the same window went on to hold BUG-LN-12 as well.
Success: after a /clear the window holds no ticket, unless it stands in the worktree of a ticket it holds, which it keeps (D-06); a released ticket continues from any session, and the window may take one other ticket; while a live session still holds a ticket, the refusal names the folder that session works in and when it took the hold.
Not in scope: a manual way to take over a hold a live session holds (D-03), and releasing holds left behind before this fix ships, such as today's ST-LN-58 hold (D-04).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-14

  @ac-1 @test:packages/cli/test/worktree.test.ts#ac-1-a-clear-in-a-window-outside-the-ticket-worktree-removes-the-hold-its-old-conversation-took-and-another-session-continues-the-ticket
  Scenario: A /clear releases the hold its old conversation took
    Given a Claude Code window, open in a folder that is neither ST-9's worktree folder nor below it, whose conversation holds ST-9
    When the owner runs /clear in that window
    Then the hold record of ST-9 is removed by the /clear itself, before any other accord command runs
    And `accord worktree open ST-9 --continue` in another session is not refused as held by another session

  @ac-2 @test:packages/cli/test/worktree.test.ts#ac-2-after-a-clear-the-window-claims-one-other-ticket-and-holds-only-that-one
  Scenario: After a /clear the window may take one other ticket and holds only that one
    Given a Claude Code window, open in a folder that is neither ST-9's worktree folder nor below it, whose conversation held ST-9 and then ran /clear
    When the new conversation in that window claims ST-10, a ticket nobody has claimed, with `accord worktree open ST-10`
    Then the claim is not refused
    And that window holds ST-10 and no other ticket

  @ac-3 @test:packages/cli/test/worktree.test.ts#ac-3-a-start-or-a-clear-in-a-second-window-in-the-ticket-worktree-leaves-the-first-window-hold-in-place
  Scenario: A hold whose conversation did not clear stays
    Given a Claude Code window whose conversation holds ST-9
    When a second Claude Code window, open in ST-9's worktree folder or a folder below it, starts a conversation or runs /clear in its own
    Then ST-9 is still held by the first window
    And `accord worktree open ST-9 --continue` in the second window is refused as held by another session

  @ac-4
  Scenario: A refusal names the folder and the time of the hold
    Given a live Claude Code session took the hold on ST-9 while it worked in a folder
    When another session runs `accord worktree open ST-9 --continue`
    Then it exits 2
    And its message names the folder that session worked in when it took the hold, as an absolute path with forward slashes
    And it names the date and time the hold was taken to the minute, in the local time of the machine that prints it with its UTC offset, in the form 2026-10-27 10:03 (UTC+07:00)

  @ac-5 @test:packages/cli/test/worktree.test.ts#ac-5-a-clear-in-the-held-ticket-worktree-moves-its-hold-to-the-new-conversation-and-releases-the-window-other-holds
  Scenario: A /clear in the held ticket's own worktree keeps the ticket for that window
    Given a Claude Code window, open in ST-9's worktree folder or a folder below it, whose conversation holds ST-9
    When the owner runs /clear in that window
    Then the new conversation in that window holds ST-9
    And `accord worktree open ST-9 --continue` in another session is refused as held by another session
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
- D-06 A /clear in a window that stands in the worktree folder of a ticket it holds keeps that ticket for the window: the hold moves to the new conversation, and only its holds on other tickets are released; this narrows D-02 — "a" (owner's choice of "the window keeps the ticket whose worktree it stands in; the folder already says which ticket the window belongs to")

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: release on the existing SessionStart hook. `accord hook session-resume`, already registered for SessionStart resume|clear|compact in every installed repository, reads the input's `source`; on `clear`, and on `resume` to another conversation, it removes inside `withHolds` every hold whose pid and start equal this window's claude process, except the hold of the ticket whose worktree the window stands in (D-06), which it moves to the new conversation's marker. Keyed on the process, not the marker (a /clear changes the marker, as the 2026-10-27 holds show) and not the folder (ac-3). `takeHold` records a `folder` with `taken`: the worktree the session is told to enter, else the folder it runs in; the refusal (`describeSession`) prints it, or "folder not recorded" for an older hold, and `taken` formatted in local time with its offset (D-05). If the release fails, the hook says so on stdout.
Rejected: also drop a window's other holds whenever it takes a new one — a second deletion path in a data-deletion file, and it would clean pre-fix holds that D-04 keeps. A new SessionEnd hook keyed on the conversation id — changes the hooks written into every user repository, which release nothing until they sync, and its timing on /clear is unverified.
Affected: packages/cli/src/commands/hook.ts (hookInput reads `source`; the session-resume branch releases), packages/cli/src/commands/worktree.ts (Hold gains an optional `folder`; takeHold records it; a release next to takeHold), packages/cli/src/load/proc.ts (describeSession prints folder and local time). No CLI flag (D-03), no change to registered hooks; the holds file gains one optional field that older accord versions ignore.
Risks: (1) Unverified that hook processes receive CLAUDE_PID, CLAUDE_CODE_SESSION_ID and CLAUDECODE; the plan's first task probes a real /clear before any build, and the approach goes back to the architect if they are missing. (2) If several Claude Code panels share one process, a /clear in one would release the other's holds; the existing `sameSession` already merges them. (3) The release adds a process-table read, about 1 s on Windows, to each /clear. (4) A pinned-version mismatch makes the hook exit before the release, leaving today's behaviour.
Failure scenarios (data deletion): A, the worktree removed under a cleared window that stands in it — prevented by D-06, which keeps that hold; undone by recreating the branch from origin or the reflog and `git worktree add`, ignored files lost. B, two sessions writing one ticket after a release — prevented by D-06 for a window in the worktree; undone by closing one window and sorting the commits with the reflog. C, a third session's hold lost by an unlocked rewrite — prevented by releasing inside `withHolds`; undone by that session continuing its ticket, which takes the hold again.
Tests: ac-1, ac-2, ac-3 and ac-5 as CLI tests in packages/cli/test/worktree.test.ts that run the session-resume hook with `source: clear` on stdin and a stubbed process table, beside the existing hook-driven hold tests; ac-4 as a CLI test of the refusal with a fixed time zone; the ST-LN-7 ac-4 assertion on the raw ISO time changes to the new form; a `risk:` test for /resume and one for a hold with no folder.
