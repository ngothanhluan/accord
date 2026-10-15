---
id: "ST-LN-2"                            # equals the file name: tickets/<id>.md
title: "The /accord dashboard ranks and groups tickets for a large backlog"
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
approved_hash: "fnv1a64:64c52eae3d09652a"
ac_hash: "fnv1a64:8b1e67cd41949e9a"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
With many tickets the /accord dashboard is a flat list the agent sorts and cuts by itself: no titles, no priority, and "0 ready" while the backlog still holds work, and each runtime may cut it differently.
For whoever opens /accord on a team repository, and for the panel that will read the same output: the CLI ranks, groups and caps the tickets, so every runtime shows the same dashboard.
Success: `accord dashboard` prints YOURS, TEAM, READY, UP NEXT and EPICS, ranked and capped, with titles, as text and as `--json`, and /accord shows that output instead of building its own.
Not in this ticket: the panel itself; priority passed from an epic to its children; a view across repositories; which tickets `accord next` selects.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-2

  @ac-1
  Scenario: Ready tickets are ranked by inherited priority, then by id
    Given five unclaimed tickets, each passing `gate ready` with no task done: ST-AN-1 with `priority: low`, ST-AN-3 with no `priority`, ST-AN-4 with `priority: high`, ST-AN-2 with `priority: medium` and `depends_on: [ST-AN-1]`, and ST-AN-6 with `priority: high` and `depends_on: [ST-AN-2]`
    When `accord dashboard --json` runs
    Then the rows of its `ready` section are ST-AN-1, ST-AN-4, ST-AN-3, in that order, and nothing else
    And with `priority: urgent` on ST-AN-3, `accord lint` reports a schema error on `priority` and exits 1

  @ac-2
  Scenario: Rows carry titles and sections carry column headers
    Given an unclaimed ticket ST-AN-1 with `title: "Password reset"` that passes `gate ready` with no task done
    When `accord status --json` and `accord dashboard` run
    Then the status row of ST-AN-1 has `title` "Password reset"
    And the dashboard's READY section prints a line naming the columns id and title, and the line right after it holds "ST-AN-1" and "Password reset"

  @ac-3
  Scenario: UP NEXT shows the viewer what to pick up when nothing is ready
    Given git `user.email` is "an@example.com", who holds no claim, and "bo@example.com" holds a claim on ST-AN-9, which is in build
    And ST-AN-1 has not passed `gate ready`, ST-AN-2 with `priority: high` has `depends_on: [ST-AN-1]`, and ST-AN-3 is done; none of the three is claimed
    When `accord dashboard --json` runs
    Then `ready` has no rows, the rows of `upNext` are ST-AN-1 then ST-AN-2 and nothing else, and `upNext` suggests `{ "action": "pick-up", "id": "ST-AN-1" }`
    And once "an@example.com" holds a claim on ST-AN-1, the JSON has no `upNext` key and the text has no UP NEXT section

  @ac-4
  Scenario: Sections are capped on a large backlog
    Given git `user.email` is "an@example.com", who holds claims on 3 tickets that are not done
    And teammates hold claims on 12 tickets that are not done and 4 tickets that are done, and 25 unclaimed tickets pass `gate ready` with no task done
    When `accord dashboard --json` and `accord dashboard` run
    Then the JSON's `yours` has 3 rows and `more` 0, `team` 10 rows and `more` 2, `ready` 20 rows and `more` 5, and no section has a done ticket among its rows
    And its summary counts 15 in progress, 25 ready, 0 blocked and 4 done
    And the text prints "+2 more" under TEAM, "+5 more" under READY, and one summary line with those four counts

  @ac-5
  Scenario: Epics show their children done over all their children
    Given epic EP-AN-1 with 8 child tickets by `parent`: 3 done, 1 with `status: dropped`, and 4 not done
    And epic EP-AN-2 with `status: archived`, and ticket ST-AN-20 with no `parent`
    When `accord dashboard --json` and `accord dashboard` run
    Then the JSON's `epics` rows are exactly one, for EP-AN-1, with `done` 3 and `total` 7
    And the text prints "3/7 done" on the EP-AN-1 row of EPICS, and neither EP-AN-2 nor ST-AN-20 under EPICS
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Six parts: `title` in each status row and column headers on the dashboard; an optional `priority: high|medium|low` field, default medium; a ranking computed by the CLI (effective priority is the highest of the ticket and every ticket that depends on it, directly or not; unblocked before blocked; then id; done, archived and dropped left out); an UP NEXT section of at most 20 rows with one suggested action when nothing is in progress or ready; caps (YOURS none, TEAM 10, READY and UP NEXT 20 with `+N more`, one summary count line); an EPICS section grouping tickets by `parent` with a progress roll-up — "Đúng 6 phần (Recommended)"
- D-02 The CLI builds the sections, the ranking and the caps (with `+N more`) and prints them as JSON, and may print text too; the /accord skill only shows what it prints, and the panel reads the same JSON — "CLI dựng sẵn (Recommended)"
- D-03 An epic's progress is the count of its child tickets that are done over all its child tickets, dropped children left out of both, e.g. `3/7 done` — "Số ticket done (Recommended)"
- D-04 UP NEXT is per viewer: it appears when the viewer (git `user.email`) has no ticket in progress and READY is empty, whatever teammates hold; it lists unclaimed tickets that are not done, archived or dropped, in rank order, at most 20, and its one suggested action is to pick up the first that is not blocked — "Theo từng người (Recommended)"
- D-05 All six parts are the smallest version that counts as done — "Cả 6 phần (Recommended)"
- D-06 `accord dashboard --json` holds data, not display text: overflow as a number (`more: 2`), epic progress as `done` and `total`, the suggested action as `{ action, id }`, the summary as counts; a section that does not apply is absent from the JSON; only the text output prints "+2 more" and "3/7 done" — "Số và id, text tự định dạng (Recommended)"
- D-07 `title` is added to the status rows of lane tickets only, so rows of tickets without `lane:` stay byte-identical to 0.1.0; this narrows D-01's "`title` in each status row" — "Chỉ dòng có lane (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] What is the smallest version that still counts as done? All six parts (D-05).

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen: Option 1, amended over three critic rounds — a pure core `dashboard()` and an `accord dashboard [--json]` command.** `dashboard(snapshot, viewer, now)` in core `status/dashboard.ts`, built on `statusRows`, `nextRows` and `isDone`, returns `{ yours, team, ready, upNext?, epics, summary }`, each section `{ rows, more }` (D-02, D-06). Only open lane tickets that are not epics enter the sections and counts. YOURS: claimed by the viewer. TEAM: claimed by others, cap 10. READY: `nextRows`, cap 20. UP NEXT, only when YOURS and READY are empty: open and unclaimed, cap 20, with `suggest: { action: "pick-up", id }` when a row is unblocked (D-04). EPICS: `{ id, title, done, total }` by D-03, unfinished first, cap 20. One rank everywhere: effective priority (the ticket's own, default medium, lifted by every open ticket depending on it through `depends_on`, a visited-set walk), then unblocked first, then id with numbers compared by value. The viewer is `git config user.email`, compared lower-cased; unset exits 2. The text prints a header line followed by its rows per section, `+N more`, `3/7 done`, one summary line, and an action line of at most three. `/accord` runs `accord dashboard`, shows it, and offers its actions; Continue and Pick up take `branch` from `accord status --json`. `title` goes on lane rows only (D-07); the ticket schema gains an optional `priority` enum.
**Rejected:** Option 2, a slim row type plus a shipped `dashboard.schema.json` (serves only the panel, which this ticket excludes); the agent building sections from `status --json` (D-02); laneless tickets in UP NEXT (round 2: finished 0.1.0 tickets and schema-broken claimed tickets would be suggested); `title` on every row (D-07).
**Affected:** core `schemas/ticket.schema.json`, `model/snapshot.ts`, `status/rows.ts`, new `status/dashboard.ts`, `index.ts`, `templates/ticket-lane.md`, `skills/accord/SKILL.md` and generated/synced copies; cli `run.ts`, new `commands/dashboard.ts`, a text renderer beside `render/table.ts`; tests `schemas.test.ts:282`, `skills.test.ts` (command regex, first command), `stage-skills.test.ts:17` and `:156`, `skill-commands.test.ts`, `skills-sync.test.ts:594-598`; `docs/design.md` (frontmatter keys, entry point).
**Risks kept (critic rounds 1–3; every Must resolved by amendment or D-07):**
- `priority` reverses the phase-1 rule that tracker-owned keys are rejected (design.md:43, schemas.test.ts:282), as D-01 approves.
- A lane ticket whose frontmatter fails the schema leaves every section and shows only as a "with schema errors" count; a `priority` typo now causes that.
- `claimedBy` is the tip commit's author: a teammate's or GitHub's commit on the viewer's claim branch moves it from YOURS to TEAM (unchanged behaviour, now load-bearing).
- An unset `user.email` makes `/accord` show nothing but the exit-2 message; wide CJK titles misalign; captured output in Windows PowerShell 5.1 may garble titles.
- ST-LN-1's verified ac-5 test changes its expected Pick up phrase from `accord next --json` to `accord status --json`.
**Tests:** ac-1, ac-3, ac-4, ac-5 as core tests on `dashboard()` with built snapshots (viewer passed in, claims injected), plus a CLI test each for the `--json` wiring where the criterion names it; ac-1's lint half as a schema case; ac-2 as a CLI test on `makeLaneRepo` reading `status --json` and the text. Risk tests: a cycle in `depends_on`, an archived claimed ticket, a laneless and a schema-broken ticket in the counts, numeric id order, the action line, title control characters.
