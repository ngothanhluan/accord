---
id: "TICKET-ID"                            # equals the file name: tickets/<id>.md
title: "Short title in business language"
type: story                                # epic | story | bug. story and bug touch code and need at least one tagged scenario
status: draft                              # draft | open | archived. Document lifecycle only; work status stays in the tracker. draft blocks Ready
# The epic this ticket belongs to. Grouping is by parent; there is no per-epic folder.
# parent: "EPIC-ID"
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { shortcut: "1234" }
# When true, Ready requires a design reference; the Intent note below says which one this profile expects.
ui: false
# Optional design reference URL. Allowed on epics too.
# design: "https://www.figma.com/..."
# Unconfirmed assumptions block Ready.
# assumptions:
#   - { text: "...", confirmed: false }
# Written by `gate ready`; never edit by hand.
# ac_hash:
# Developer self-test ticks, e.g. [ac-1, ac-2]. Only the developer writes it.
# Always the last key so developer hunks stay far from BA hunks.
# verified: []
---

## Intent
<!-- BA. Why, for whom, how success is measured, and explicit non-goals. About five lines.
Describe observable behaviour in business language; never name tables, endpoints, libraries, or screens.
Terms go in product/glossary.md; rules already decided go in product/business-rules.md.
If the story has a screen, set ui: true in the frontmatter. Ready then requires a Figma link in design:. -->

## Requirements
<!-- BA. One EARS line per requirement: WHEN <trigger> the system SHALL <response>, and its siblings. 5 to 15 lines. -->

## Acceptance criteria
<!-- BA. One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A bug is written as Given the situation, When the action, Then the correct result. -->
```gherkin
Feature: TICKET-ID

  @ac-1
  Scenario: <observable outcome>
    Given ...
    When ...
    Then ...
```

## Open questions
<!-- BA. `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Plan
<!-- Developer fills this in. BA leaves it empty.
A short plan only. Evidence goes to tickets/<id>/verification.md, written by the fresh review context, not by the agent that wrote the code. -->
