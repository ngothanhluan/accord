---
id: "ST-LN-6"                            # equals the file name: tickets/<id>.md
title: "Pressing a ticket in the accord panel shows its full detail"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-3"]
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
approved_hash: "fnv1a64:60d2533623951f2b"
ac_hash: "fnv1a64:48286978fa4617c2"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
The panel table cuts each title and shows no criteria, so to learn what a ticket is for and how far it is proved the owner has to open its file.
For anyone on the team: in the Claude Code panel, and in any runtime through `accord show <id>`.
Success: pressing a ticket shows its full title, its row facts, its Intent, and every criterion in full with one state label and the facts behind it, with no text cut; `accord show` prints the same.
Not in scope: editing anything from the view; which tickets the dashboard can see (a separate bug ticket); the dashboard table, which keeps its cuts.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-6

  @ac-1 @test:packages/cli/test/show.test.ts#ac-1-accord-show-prints-the-full-detail-as-text
  Scenario: accord show prints a ticket's full detail as text
    Given a lane M ticket whose title is longer than 60 characters, with an Intent and two criteria, no holder, and no blocking ticket
    When `accord show <id>` runs
    Then it prints the full title, then a labelled line each for the stage, lane, tasks done of total, branch, holder, and blocking tickets, the holder and blocking tickets reading `none`
    And it prints the Intent, and each criterion's id, title, and every step with its Gherkin keyword as written in the file (an "And" stays "And"), each in full
    And under each criterion it prints the criterion's state label, then a labelled line each for its @test tag, that test's result, whether it is ticked in `verified:`, and its verification.md result, an absent one reading `none`
    And no text in the output is cut or ends with "..." or "…"

  @ac-2 @test:packages/cli/test/show.test.ts#ac-2-accord-show-json-gives-the-same-detail-as-data
  Scenario: accord show --json gives the same detail as JSON
    Given the ticket of @ac-1
    When `accord show <id> --json` runs
    Then it prints one JSON object holding every value the text output of @ac-1 prints, each in full, as data rather than display text: tasks done and tasks total as two numbers, the tick as true or false, each step as one string holding its keyword and text, an absent single value as null, and no blocking ticket as an empty list

  @ac-3 @test:packages/core/test/show.test.ts#ac-3-each-criterion-takes-the-first-label-that-matches-top-down
  Scenario: A criterion's label is the first rule that matches, top down
    Given criteria whose facts match more than one rule, among them one ticked in `verified:` whose test result is failed
    When `accord show <id>` runs
    Then each criterion's label is the first that matches of: failing (its test failed, or verification.md says fail), blocked (verification.md says blocked), verified (ticked, and the ticket's `verified_hash` equals the hash of the criteria as they are in the file now, not the stored `ac_hash`), passing (its test passed), not run (an @test tag with no result in the JUnit report at config.yml `tests.report`, or a skipped test), untested (no @test tag); a test whose JUnit case holds a `<failure>` or an `<error>` counts as failed
    And the criterion ticked with a failed test is labelled failing
    And when config.yml sets no `tests.report`, or no file exists at it, every criterion with an @test tag that no earlier rule matches is labelled not run

  @ac-4 @test:packages/core/test/panel.test.ts#ac-4-pressing-a-row-id-opens-its-detail-view-with-its-button-and-back
  Scenario: Pressing a ticket row in the panel opens its detail view
    Given the panel shows the dashboard with a ticket row that offers Continue
    When the owner presses that row's id, the row's only press target
    Then the panel shows the ticket's detail read from `accord show <id> --json`, and submits no command
    And the row's id is drawn underlined, and no other cell of the dashboard table is underlined
    And the row itself holds no Continue button; that button and a Back button are in the detail view
    And pressing that button submits the same `/accord` command the row submitted before this ticket, and pressing Back shows the dashboard already loaded without running any command

  @ac-5
  Scenario: The detail view wraps long text and never cuts it, while the table keeps its cuts
    Given a ticket whose title and one step are each wider than the pane
    When its detail view is shown
    Then the full title, and the full step with its keyword, are each passed to the panel as one whole string that the panel wraps across lines, with no line break inserted, nothing cut, and no "..." or "…" added
    And the same ticket's row in the dashboard table still shows its title cut
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The request has four parts: a new `accord show <id> --json` with the Intent, every criterion's title and steps, and each criterion's state; core code that works out that state; a panel detail view opened by pressing a ticket that draws that JSON; full text with no cut in the detail view while the dashboard table keeps its cuts — "ok option 1" (2026-10-16)
- D-02 Pressing a ticket row opens its detail view; the view holds the Continue or Pick up button and a Back button, so running a ticket takes two presses — "Mở chi tiết, nút ở trong (Khuyên)" (2026-10-16)
- D-03 Each criterion shows one state label worked out in core, and under it every fact the label came from: its @test tag, that test's result, whether it is ticked in `verified:`, and its verification.md result — "Một nhãn + các dữ kiện (Khuyên)" (2026-10-16)
- D-04 A criterion's label is the first that matches, top down: failing (its @test result failed, or verification.md says fail); blocked (verification.md says blocked); verified (in `verified:` and the tick still bound to the current criteria); passing (its test passed); not run (it has an @test tag but the report has no result for it, or the test was skipped); untested (no @test tag) — "Dùng thứ tự này (Khuyên)" (2026-10-16)
- D-05 `accord show <id>` prints readable text, everything in full with no cut, and `--json` gives the same content for the panel, so runtimes without the panel see the detail too — "Có cả chữ và JSON (Khuyên)" (2026-10-16)
- D-06 The detail starts with the full title and the facts the dashboard row already has: stage, lane, tasks done of total, branch, who holds it, and the tickets blocking it — "Tiêu đề đủ + dữ kiện của hàng (Khuyên)" (2026-10-16)
- D-07 The smallest version that still counts as done is all of D-01 to D-06; nothing is cut — "option 1" (2026-10-16)
- D-08 After the audit: an empty fact prints `none` under its label; steps keep their Gherkin keyword; the JSON holds data, not display text; a tick is bound by the ticket-level `verified_hash`; test results come from config.yml `tests.report`, and a missing report makes a tagged criterion not run; the row loses its button to the detail view; Back shows the loaded dashboard without a new run; the panel wraps text itself with no inserted line breaks — "Đồng ý cả 8 (Khuyên)" (2026-10-16)
- D-09 The id that opens the detail is drawn so a user can tell it is pressable — "duyệt nhưng Id phải highlight hoặc sao đó để user biết mà click." (2026-10-16)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-16, on the Approach (id cell as the press target): "duyệt nhưng Id phải highlight hoặc sao đó để user biết mà click."

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] Scope from ST-LN-3 verify (2026-10-16). Owner, asked what a pressed ticket should show: "ok option 1, nhưng phải đảm bảo là hiện đủ thông tin, ko elipsis" — option 1 was: the detail view shows the Intent, the acceptance criteria and each criterion's state, read from a new `accord show <id> --json` so the pane still reads only CLI output (ST-LN-3 D-04). Then, on whether the no-ellipsis rule covers the table: "ko áp dụng cho bảng. khi xem details thì phải details chứ".

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: the id cell is the press target, everything else reused. A pure core `ticketDetail(snapshot, id)` (new `packages/core/src/status/show.ts`) takes the lane row from `statusRows`, the Intent as `anchor` reads it, the stored scenario steps, `snapshot.tests`, the verification.md results, and `acHash` against `verified_hash`, and gives each criterion its label with one first-match chain (D-04); absent values are mapped to null explicitly. A new `accord show <id> [--json]` (`packages/cli/src/commands/show.ts`, registered in `run.ts`, lane tickets only, an unknown id exits 2) prints it as text or JSON. In the panel each lane row's id becomes a `plain` Button, which draws the id alone, underlined and in the accent colour so it reads as pressable (D-09), that runs `show <id> --json`; the row loses its Continue and Pick up button; the detail view, with Continue or Pick up and Back, lives in the existing `view.js` and `register.js`, so the plugin's file list does not change.
Rejected: the whole row as one Button. The host's Button takes only strings and `Text` as children, while the row's columns are `Box` cells (`register.js:89-94`), so the table's columns would break.
Affected: `core/src/status/show.ts` (new), `core/src/index.ts`, `cli/src/commands/show.ts` (new), `cli/src/run.ts`, `cli/src/render/dashboard.ts` (export the unsafe-character scan, the table cut stays), `core/panel/view.js` and `register.js`, `core/src/generated/panel.ts`, `.claude/accord-panel/` by `accord skills sync`, `cli/test/skill-commands.test.ts`, `docs/design.md`.
Risks the option keeps, from the critic, all Should:
- the pane's response check reads only a dashboard: `show` gets its own parser, every string goes through `clean`, its state is kept apart from the dashboard, and a failed run shows its message with Back.
- the `statusRows` row omits absent keys, so `ticketDetail` maps holder to null and blocking tickets to `[]`, and the text prints `none` for both.
- ST-LN-3's `@ac-2` panel test and four row-button assertions break; the test keeps its name and now presses the id, then Continue.
- the id Button's width: drawn `plain`, it takes the id's own width, which the id column already measures.
- EPICS rows and tickets without `lane:` get no id Button, since `show` takes lane tickets only.
- an open detail goes stale after a turn, so `turn.complete` re-runs `show` for the open ticket.
- the live check of ac-4 and ac-5 needs the pane's plugin cache refreshed, because the plugin version is the CLI version.
Tests: @ac-3 in `core/test/show.test.ts` on a snapshot built in memory; @ac-1 and @ac-2 in `cli/test/show.test.ts` through `runCli` on a fixture repository; @ac-4 and @ac-5 in `core/test/panel.test.ts` on the fake host.
