---
id: EXPORT-1
title: Download the weekly report as a CSV file
type: story
status: open
ui: true
ac_hash: "fnv1a64:44d831c3e92c7e40"
verified:
  - ac-1
  - ac-2
verified_hash: "fnv1a64:44d831c3e92c7e40"
verified_commit: "1234567"
---

## Intent
The reports screen already shows a workspace its weekly report, and every team lead who uses it copies the
table into a spreadsheet by hand before the Monday finance call. They should be able to take the same numbers
away as a file instead. We know it worked when those leads stop copying the table, and when nobody asks us to
re-send a report because a number moved in transit. Out of scope: scheduling a report by email, any format
other than CSV, and changing what the report counts.

## Requirements
- WHEN a workspace member opens the reports screen the system SHALL offer a download of the weekly report currently shown
- WHEN a workspace member asks for the download the system SHALL write one line per report line, in the order the screen shows them
- The system SHALL write each day and each recorded name exactly as accord/product/business-rules.md decides, so a file opened elsewhere reads as the screen does

## Acceptance criteria
```gherkin
Feature: EXPORT-1

  @ac-1 @ui
  Scenario: The reports screen offers the download
    Given a workspace member is looking at the weekly report
    Then a download control sits beside the report title, in the colours the product already uses

  @ac-2 @test:test/export.spec.ts#writes-one-row-per-report-line
  Scenario: The file holds the lines the screen shows
    Given the weekly report shows three report lines
    When the member asks for the download
    Then the file holds a heading and those three lines, in the same order
```

## Open questions
- [x] The quoting rule and the day format are settled in accord/product/business-rules.md, so this ticket cites them instead of deciding them again

## Plan
- Add the download control to the reports screen header, built from the existing tokens @ac-1
- Turn the report lines already on the screen into CSV text, quoting through the one rule @ac-2

## Verification notes
### @ac-1
Opened the reports screen against accord/assets/EXPORT-1/prototype.html side by side. The control sits
on the same baseline as the title, and its colours resolve to the names in src/tokens.css, so nothing
new entered the palette.

### @ac-2
src/export.ts writes the heading and then one row per line in the order it is given, and the hours keep
two decimal places on the way out. Checked a name holding a comma by hand as well as through the test.
