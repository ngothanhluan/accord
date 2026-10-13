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
- D-08 The `/accord` dashboard shows "idle <n>d" for a row that carries idleDays — "Có, thêm vào skill"

## Corrections

## Open questions

## Approach
Chosen: the host supplies the newest activity per ticket and core does the arithmetic. The CLI loader extends the two git reads it already makes: the `git log --name-only -- accord/tickets` walk gains the committer time, and the `for-each-ref` over local and remote `t/*` gains `%(committerdate:unix)`. Both fold by max into `lastActivity: Record<id, seconds>` on `SnapshotInput`, left out when empty. `statusRows(snapshot, now?)` sets `idleDays` on lane rows that are not done, dropped, or archived when `floor((now - lastActivity) / 86400)` is greater than `stale_days` (default 14). `accord status` passes the current time; the table appends ` idle <n>d` to the stage cell; the `/accord` skill shows it (D-08). No new spawn, no new dependency, about 25 lines of source.
Rejected: the host passes raw per-path and per-branch times and core maps them to tickets. It keeps the records rule pure but changes the shipped `claims` shape; no criterion needs it.
Affected: `packages/core/src/model/snapshot.ts`, `packages/core/src/load/snapshot.ts`, `packages/core/src/status/rows.ts`, `packages/cli/src/load/fs.ts`, `packages/cli/src/commands/status.ts`, `packages/cli/src/render/table.ts` (stage width 12 to 24), `packages/core/skills/accord/SKILL.md` with its synced copies, tests in `packages/core/test/lane-status.test.ts` and `packages/cli/test/status.test.ts` with a dated-commit helper in `packages/cli/test/helpers/repo.ts`.
Risks (critic, no Must; the Should on the dashboard is resolved by D-08):
- Nice: records are read from history reachable from HEAD, so on an old branch a teammate's live ticket can look idle.
- Nice: committer time; backdated test commits must set GIT_COMMITTER_DATE, and a rebase makes a branch look active.
- Nice: a claim branch with no commit of its own carries the base's tip time, so a fresh pick up can still show idle until its first commit.
- Nice: a lane ticket never committed is never idle.
- Nice: in a shallow clone every ticket gets the boundary commit's time, so nothing is idle, silently.
Tests: @ac-3, @ac-4, @ac-5 in core `lane-status.test.ts` with `lastActivity` and `now` given, no git; @ac-1 and @ac-2 in CLI `status.test.ts` against a real repository with commits dated away from whole-day boundaries (18 days plus an hour).
