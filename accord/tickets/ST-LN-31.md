---
id: "ST-LN-31"                            # equals the file name: tickets/<id>.md
title: "Re-evaluate how work is sorted into lanes, so a small change is not made a lane M ticket by default"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-34"]
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
Why: all 44 tickets so far are lane M: lane S has no ticket form, so anything queued becomes lane M; its lift conditions ("new user-visible behaviour", "more than about three files" counting generated copies) catch almost any change; and a queued ticket can never drop. Raised during ST-LN-30: "ngay cả ticket nay tôi nghĩ cũng là lane S thôi. sao bạn lại xếp vào lane M? lý do?"
For whom: anyone sorting work into a lane in an accord repository, alone or on a team.
Success: a small change goes through lane S on a lane S ticket in its own worktree, with the affected tests, one independent reviewer and a pull request; the D-02 samples sort as stated; a queued lane M ticket that fits lane S drops to S at intent on the owner's yes.
Not this ticket: lane L and P (ST-LN-28); queuing an idea mid-session (ST-LN-29); measuring the main session's own tokens in the benchmark (D-06).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-31

  @ac-1
  Scenario: A request is lifted from lane S to M only by the four conditions left
    Given the /accord skill sorts a New request into a lane
    When it reads the conditions that lift lane S to lane M
    Then they are these four and no other: a public interface or schema changes; auth, money or data deletion is touched; more than one plausible reading; more than about five hand-written files expected, generated and rendered copies not counted
    And "new user-visible behaviour" is not among them

  @ac-2
  Scenario: A lane S ticket is written and passes gate ready without acceptance criteria
    Given an accord repository
    When "accord new ticket <id> --lane S" runs
    Then it writes accord/tickets/<id>.md with lane "S", a title, an empty "## Understood" section and an empty "## Done when" section, and no acceptance criteria, plan or verify section
    And "accord lint" reports no error on it, with its sections empty or filled
    And "accord gate ready <id>" passes once both sections are filled, with no "accord approve" needed
    And while a section is empty, "accord gate ready <id>" fails naming each empty section, where a section holding only HTML comments is empty

  @ac-3
  Scenario: The dashboard lists a lane S ticket like any other ticket
    Given a queued lane S ticket and a claimed lane S ticket
    When "accord dashboard" runs
    Then the queued one is listed among the tickets to pick up and the claimed one among those in progress
    And every ticket row has a lane column, which reads "S" for both of them

  @ac-4
  Scenario: Every lane S change is worked from its own lane S ticket
    Given a New request the /accord skill sorts into lane S, or "/accord pick-up <id>" on a lane S ticket
    When the session starts the work
    Then a New request first runs "accord new ticket --lane S --worktree", and Pick up runs "accord worktree open <id>", and the work happens in that ticket's worktree, never in the main checkout
    And the session fills "## Understood" and "## Done when" and "accord gate ready <id>" passes before any change
    And the work is the change made by the session itself; the "tests.affected" command runs over the changed files, and a bug gets a reproducing test written before the fix
    And review runs in rounds, each a fresh accord-reviewer on the diff, until no Must finding is open, with no final reviewer and at most five rounds, after which the session stops and reports the open findings to the owner
    And it ends in a pull request, with no intent interview, approval, approach, plan, executor or verify

  @ac-5
  Scenario: A queued lane M ticket that fits lane S drops to S at intent, and never after
    Given a lane M ticket whose intent is not yet approved, and the interview shows it fits lane S
    When the session proposes the drop and the owner says yes
    Then the lane M ticket gets status dropped, its "## Dropped" section saying "moved to lane S", its lane field unchanged
    And the work continues on a new lane S ticket with a new id, made by "accord new ticket --lane S --worktree" in its own worktree
    And without the owner's yes the session never drops it
    And "accord lint" reports an error on a ticket that has approved_hash and is dropped with the reason "moved to lane S"
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Four parts in scope: the lift conditions, a queued ticket's lane dropping at intent, a queued form for lane S, recording lane S work for the benchmark; overlap with ST-LN-28 (lane L and P) is out of scope — "ok"
- D-02 Lift conditions: drop "new user-visible behaviour"; keep public interface or schema change, auth/money/data deletion, more than one plausible reading; "more than about three files" becomes more than about five hand-written files, generated and rendered copies not counted. Lane S keeps the affected tests, one independent reviewer on the diff, and a reproducing test first for a bug. Samples: ST-LN-9, BUG-LN-5, VID-1, ST-LN-21, and ST-LN-30's fetch part alone sort to S; REFS-1 and ST-LN-32 sort to M — "tôi thấy những ticket sếp vào S là thay đổi nhanh nhỏ, ko đổi logic nhiều. ko break nhiều chỗ. đổi tầm 3-5 files.", then "A"
- D-03 A queued ticket's lane is provisional until its intent is approved: during the interview, when it fits lane S, the main session proposes the drop and drops only on the owner's yes; the ticket is dropped with the reason "moved to lane S" and the work follows lane S; after intent approval a lane never drops — "A"
- D-04 Lane S gets a ticket form: schema, template and `accord new ticket --lane S` accept S; a lane S ticket holds a title, an Understood line and a Done when line, no acceptance criteria, plan or verify; Pick up runs the lane S procedure (change, affected tests, one reviewer, pull request); the dashboard lists it like any ticket — "A"
- D-05 Every lane S change has a lane S ticket, also one done at once: a lane S New request runs `accord new ticket --lane S --worktree` like lane M and is worked in that worktree, so it is recorded, shown on the dashboard, counted by the benchmark by its id, and never edits the main checkout — "A"
- D-06 All four parts ship in this ticket; the benchmark counts lane S work by ticket id as it does today and is not changed; the main session's own tokens on lane S work are not measured — "A"
- D-07 Audit readings: the lift list names four conditions and leaves "new user-visible behaviour" out; lint reports no error on a lane S ticket, empty or filled; gate ready names each empty section; affected tests are the existing tests the change touches, plus a reproducing test first for a bug; a drop sets the lane M ticket to dropped and a new lane S ticket with a new id is made; a lane S ticket needs no `accord approve`; lane S review runs rounds, a fresh reviewer each, until no Must is open, with no final reviewer; lint refuses a drop to lane S on a ticket that has approved_hash — "ok"
- D-08 Second audit readings: a section holding only HTML comments is empty; the title is checked as for lane M today; the dashboard gets a lane column on every ticket row; a lane S ticket passes gate ready before any change; affected tests are the `tests.affected` command over the changed files; lane S review keeps the five-round cap, stops and reports at it, with no model tier-up as it has no executor; Pick up on a lane S ticket runs `accord worktree open`; the drop reason is the `## Dropped` section, the lane S ticket gets its own worktree, and the dropped one is cleaned by `accord worktree clean` — "làm tiếp đi"
- D-09 A lane S ticket lifted to lane M keeps its id, branch and worktree: its `lane: S` becomes `lane: M`, the lane M sections are added, its lane S review.md is removed, and it starts at the intent interview; a lint rule stops a lane M ticket whose review.md was left from lane S — "tôi nghĩ là B"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- On the lift from lane S to M, after answering "A": "tôi nghĩ là B" (lift in place: the same id, `lane: S` becomes `lane: M`, the lane M sections are added, review.md is removed)

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
