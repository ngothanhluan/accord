---
id: TCK-1
title: Export the ticket list as a CSV file
type: story
status: open
ui: false
---

<!-- D-115 fixture. The `## Plan` below is deliberately wrong in both ways ROADMAP criterion 7
names: its steps are technical layers rather than vertical slices, so the first step carries every
`@ac-n` tag while the rest carry none, and that first step is placed before the two steps whose
output it consumes. Everything else in this ticket passes Ready. The fixture exists to be handed to
the dev skill's plan-review step and come back changed; nothing asserts its contents. -->

## Intent
A team lead who keeps their own weekly figures wants the ticket list out of the
tool and into a spreadsheet, without retyping it. Success is that the file opens
in a spreadsheet with one row per ticket. Editing tickets in the spreadsheet and
importing them back is a non-goal.

## Requirements
- WHEN the user asks to export and at least one ticket is listed the system SHALL produce a CSV file with one header row and one row per listed ticket
- WHEN the user asks to export and no ticket is listed the system SHALL say that there is nothing to export and produce no file

## Acceptance criteria
```gherkin
Feature: TCK-1

  @ac-1
  Scenario: Export a list that has tickets in it
    Given three tickets are listed
    When the user asks to export
    Then a CSV file arrives with a header row and three ticket rows

  @ac-2
  Scenario: Export an empty list
    Given no ticket is listed
    When the user asks to export
    Then the user is told there is nothing to export and no file arrives
```

## Open questions
- [x] The separator is a comma in every locale.

## Plan
- Wire the export control to the endpoint and show the empty-list message @ac-1 @ac-2
- Add the row serialiser that turns a ticket into a CSV line
- Add the export endpoint that gathers the listed tickets and calls the serialiser

## Verification notes
