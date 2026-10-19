---
id: "ST-LN-27"                            # equals the file name: tickets/<id>.md
title: "Pick up, Continue and New request move the running session into the ticket's worktree"
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
Why: Pick up, Continue and New request in lane M end with a `stop:` line that makes the owner open a new session in the ticket's worktree folder and type `/accord continue <id>` there (ST-LN-7 D-08, D-13); owner: "đó ko phải cách làm việc. user ko rảnh để làm việc đó đâu. accord phải tự handle".
For whom: anyone working a ticket through Claude Code.
Success: from `/accord` in a Claude Code session started in the main checkout, the owner reaches the ticket's next stage without opening a folder or typing a second command, and one session never works two tickets.
Not this ticket: Cursor, Codex and Copilot (deferred, they keep the `stop:` line); moving the worktree folder (ST-LN-7 D-06 stays); a session switching from one ticket to another; a live session's hold still refuses a second session, as today (ST-LN-7 D-03).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-27

  @ac-1
  Scenario: Pick up moves the Claude Code session into the ticket's worktree and goes on
    Given a Claude Code session started in the main checkout that works no ticket
    And ticket X is ready to pick up
    When the owner types "/accord pick-up X"
    Then the claim on X is committed and pushed on X's branch
    And the same session's working directory becomes X's worktree folder and the session starts X at the stage and step that "accord anchor" prints for X
    And no "stop:" line is shown and the owner opens no folder

  @ac-2
  Scenario: Continue moves the Claude Code session into a claimed ticket's worktree and goes on
    Given a Claude Code session started in the main checkout that works no ticket
    And ticket X is claimed, by anyone as today, whether or not its worktree exists on this machine, and the session that worked it has ended, closed or crashed, mid-stage or between stages
    When the owner types "/accord continue X"
    Then the same session's working directory becomes X's worktree folder and the session resumes X at the stage and step that "accord anchor" prints for X
    And no "stop:" line is shown and the owner opens no folder

  @ac-3
  Scenario: A lane M new request moves the Claude Code session into the new ticket's worktree and goes on
    Given a Claude Code session started in the main checkout that works no ticket
    When the owner types "/accord <request>" and the request is classified lane M
    Then the new ticket is written, committed and pushed on its branch
    And the same session's working directory becomes the new ticket's worktree folder and the session starts its intent interview
    And no "stop:" line is shown and the owner opens no folder

  @ac-4
  Scenario: A Claude Code session that works a ticket refuses a second ticket
    Given a Claude Code session that picked up, continued or created ticket A, or that was started in A's worktree folder or a folder inside it, at any later point in its life, even after A is done or merged
    When the owner types "/accord pick-up B", "/accord continue B", or "/accord <request>" in any lane, even a request about A
    Then accord refuses, naming A, saying to open a new session in the main checkout for other work, and saying to type a request about A without "/accord"
    And no ticket file, branch, worktree, claim or file change is made for the other work

  @ac-5
  Scenario: Sessions other than Claude Code keep today's behaviour
    Given a session that is not Claude Code, started in the main checkout
    When the owner picks up, continues, or creates a lane M ticket
    Then accord prints the "stop:" line with the worktree's path and "/accord continue <id>" as it does today
    And the session is not refused a second ticket, as today
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->
- "ko dc làm 2 ticket trong cùng 1 sessino"

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Only Claude Code sessions move into the ticket's worktree in this ticket; Cursor, Codex and Copilot are deferred to a later ticket and keep today's behaviour — "defer đi. hiện tại chỉ support claude."
- D-02 A session that works a ticket refuses Pick up, Continue and New request for any other ticket, names the ticket it works and says to open a new session in the main checkout, and creates or claims nothing — "A"
- D-03 Moving into the worktree means the session's own working directory becomes the worktree folder, so every later command, relative path and file edit lands there; not a session left in the main checkout that sends each call to the worktree — "A"
- D-04 A session works ticket A when it holds A's hold after picking up, continuing or creating A, or when it was started in A's worktree folder, even before any command — "A"
- D-05 In a session that works a ticket, "/accord <request>" is refused in every lane, lane S included, so the ticket's branch holds only that ticket's work — "A"
- D-06 In a session that works a ticket, only "/accord" (the dashboard) and "/accord continue" naming that same ticket run; every other "/accord <text>" is refused, even one about that ticket, and the refusal says to type a request about the ticket without "/accord" — "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-19, on the proposed part "the worktree may move under .claude/worktrees/ so one session can switch between two tickets": "ko dc làm 2 ticket trong cùng 1 sessino"
- 2026-10-19, on D-01 ("A": Cursor, Codex and Copilot in this ticket), asked whether those runtimes must be enforced by the tool: "defer đi. hiện tại chỉ support claude."

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
