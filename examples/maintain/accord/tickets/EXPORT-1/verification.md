---
ticket: EXPORT-1
commit: 1234567
reviewed_on: 2026-09-18
---

## @ac-1 The reports screen offers the download

Result: pass

Evidence: opened the screen beside accord/assets/EXPORT-1/prototype.html; the control is where the prototype puts it and every colour it uses is declared in src/tokens.css.

## @ac-2 The file holds the lines the screen shows

Result: pass

Evidence: test/export.spec.ts#writes-one-row-per-report-line, and src/export.ts emits the heading before the rows, so an empty report still opens as a table elsewhere.
