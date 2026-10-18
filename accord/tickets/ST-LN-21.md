---
id: "ST-LN-21"                            # equals the file name: tickets/<id>.md
title: "The panel's search field shows that it filters tickets and starts a new request"
type: "story" # story | bug. An epic uses its own template
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
For whoever opens the accord panel in Claude Code: the field above the tickets says only "Search:", shows nothing
while empty, and nothing on screen says the same text also starts a new request, so a user does not see that it is
there to type in. Success: on first sight the user knows the field filters the tickets on the dashboard by id or title and can
start a new request, and can type at once; the owner confirms it on the real panel (D-02). Not in this ticket: matching
stage or person, a search icon, a keyboard shortcut, the ticket detail view, or splitting the field in two (D-03).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-21

  @ac-1
  Scenario: The empty search field says what it is for
    Given the panel shows ST-1 titled "Login form" under YOURS
    When the panel draws its search field and the field is empty
    Then the field's label is still "Search", which the terminal draws as "Search: ", and the field shows the dim hint "ticket id or title, or a new request" verbatim

  @ac-2
  Scenario: Text that matches no ticket says so and points to New request
    Given the panel shows ST-1 titled "Login form" under YOURS and ST-2 titled "Export" under READY
    When the owner types "zzz" in the search field
    Then no section heading and no ticket row is shown, the line "No ticket shown here matches. Press New request to send this text to /accord." is shown verbatim, and the New request button is shown
    And when the owner types "login" instead, only the YOURS heading and ST-1 are shown, and that line is not

  @ac-3
  Scenario: The cursor is in the search field when the panel opens
    Given the panel shows a dashboard with at least one ticket
    When the pane opens
    Then the search field is the one control marked to take focus when the pane opens, so the cursor is in it, and a later redraw, such as after typing or a refreshed dashboard, does not move focus back to it

  @ac-4 @ui
  Scenario: The owner reads the real panel as a place to search and to start a request
    Given the panel built from this ticket's branch, open in a Claude Code terminal session
    When the owner opens /accord-panel, looks at the empty field, and types text that matches no ticket
    And then clears the field, presses Tab to move to a ticket button, sends any message to Claude, and waits for the reply to finish
    Then the owner says the field reads as a place to search tickets and to start a new request, without asking what it is for
    And the cursor is still on that ticket button after the reply finishes
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The ticket has four parts: the empty search field says it searches (dim hint text); the screen says the same field also starts a new request; when nothing matches the panel says so; the cursor is in the field when the panel opens — "A"
- D-02 Done is proven twice: tests fix every new piece of panel text verbatim in the criteria and check it through the panel test host; and at verify the owner opens the real panel once, looks at the empty field, types text that matches nothing, and confirms it reads as searchable — "chọn A"
- D-03 The search still matches only a ticket's id and title (ST-LN-3 D-07 stands); out of scope: matching stage or person, a search icon, a keyboard shortcut, the ticket detail view — "A"
- D-04 The smallest version that counts as done is all four parts of D-01; none is cut — "A"
- D-05 The search filters only the tickets the current dashboard shows, and the no-match line says so ("No ticket shown here matches."); finding an older, hidden, or done ticket is not the panel's job, since the agent finds it from the ticket files when asked — "câu 1. ok A, nhưng đúng là phải nói rõ là filter trên dashboard hiện tại thôi. nhưng nếu user muốn tìm lại ticket cũ thì sao nhỉ? thực tế khi làm với AI thì tôi thấy ko cần lắm. vì nếu cần thì AI tự tìm phải ko?"
- D-06 The owner's check on the real panel (ac-4) also moves focus to a ticket button, lets a turn finish, and confirms the cursor stayed there, because the test host cannot see focus — "Câu 2. A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: fixed hint, autoFocus and a view line. On every draw the search Input in `panel/register.js` keeps
`label: 'Search'` and gains `placeholder` (the dim hint of ac-1) and `autoFocus: true`; no other control carries
`autoFocus`. The Input is also drawn under "Loading…", so a /accord-panel opened before the first dashboard run
ends still puts the cursor in it; a failed run still draws no Input (ST-LN-3 ac-3). `view()` in `panel/view.js`
returns the no-match line of ac-2 when the query is non-blank and no section is left; register.js draws it as plain
text below the Input, above New request. The session-start open stays without `focus`, so the panel never takes
keys from the prompt. Rejected: autoFocus only on the first draw after each open — the host reads it only when the
pane takes the keyboard (claude-code.d.ts:4626-4631), so a later Ctrl+X Tab, click, or /accord-panel on an open
pane would land on nothing (critic Must, breaks D-01 part 4); searching hidden or done tickets (D-05).
Affected: `packages/core/panel/register.js`, `view.js`, the regenerated `src/generated/panel.ts`, the synced
`.claude/accord-panel/plugin/hooks/` copies, `packages/core/test/panel.test.ts`; nothing in the CLI, schemas, or skills.
Risks: ac-3's redraw clause rests on the host rule that a moved focus stays put (d.ts:4631) and is seen only in
ac-4 (D-06); `placeholder` and `autoFocus` are in a declaration file copied 2026-10-15, not compared with the
installed 2.1.302, and an engine without them refuses the whole pane, seen only in ac-4; `gate plan` rejects the
words "placeholder" and "later" in task lines, so the plan must word around them.
Tests: ac-1 to ac-3 each one test in `panel.test.ts` through the test host (Input props; texts after typing "zzz"
then "login"; the Input as the only autoFocus control, on a dashboard and under "Loading…"); ac-4 by the owner.
