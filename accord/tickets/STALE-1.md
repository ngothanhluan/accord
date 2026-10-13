---
id: "STALE-1"                            # equals the file name: tickets/<id>.md
title: "Idle tickets show in status"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
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
A claimed ticket that nobody touches is invisible today: `accord status` shows its stage but not that work stopped.
For the owner and teammates reading `accord status` or the `/accord` dashboard, so a stopped ticket is seen and picked up or dropped.
Success: a lane ticket with no commit on its records (`accord/tickets/<id>.md` and everything under `accord/tickets/<id>/`) or its claim branch for longer than `stale_days` shows how many days it has been idle.
Not in scope: the session-start line, notifications, and any automatic change to the ticket.

## Acceptance criteria
```gherkin
Feature: STALE-1 idle tickets

  @ac-1
  Scenario: A ticket untouched past the window shows its idle days
    Given a lane ticket at stage build whose newest commit on its records is 18 whole days old
    And no claim branch for it and no stale_days in the config
    When the owner runs accord status
    Then its JSON row carries idleDays 18
    And its text row shows "idle 18d" after its stage

  @ac-2
  Scenario: A recent commit on the claim branch keeps the ticket active
    Given a lane ticket at stage build whose newest commit on its records is 18 whole days old
    And its claim branch t/<id>, local or remote-tracking, has a commit 2 days old
    When the owner runs accord status
    Then its JSON row carries no idleDays
    And its text row shows no idle marker

  @ac-3
  Scenario: The window comes from stale_days
    Given stale_days is "30" in the config
    And a lane ticket at stage build whose newest commit on its records is 18 whole days old
    When the owner runs accord status
    Then its JSON row carries no idleDays

  @ac-4
  Scenario: Finished and closed tickets are never idle
    Given three lane tickets whose newest commit on their records is 100 whole days old
    And one is at stage done, one has status dropped, and one has status archived
    When the owner runs accord status --all
    Then all three rows are listed
    And none of them carries idleDays

  @ac-5
  Scenario: The default window is 14 days and idle means older than it
    Given no stale_days in the config
    And one lane ticket at stage build whose newest commit on its records is 14 whole days old
    And another whose newest commit on its records is 15 whole days old
    When the owner runs accord status
    Then the first row carries no idleDays
    And the second row carries idleDays 15
```

## Vetoes

## Decisions
- D-01 Idle shows as an `idleDays` JSON field, present only when idle, and as "idle <n>d" in the stage cell of the text table — "idleDays + cột stage"
- D-02 Activity is the newest commit among the ticket's records and its claim branch tip — "Lấy hoạt động mới nhất"
- D-03 All three parts are in scope: records, claim branch, and status output — "Đủ 3 phần"
- D-04 idleDays counts whole 24-hour periods since the newest activity; a ticket is idle when idleDays is greater than stale_days — "Duyệt bản sửa"
- D-05 Only tickets with `lane:` can be idle — "Duyệt bản sửa"
- D-06 The claim branch is read from local and remote-tracking refs, the newest commit counting — "Duyệt bản sửa"
- D-07 Now is when the command runs; the CLI passes it in and core reads no clock — "Duyệt bản sửa"

## Corrections

## Open questions

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
