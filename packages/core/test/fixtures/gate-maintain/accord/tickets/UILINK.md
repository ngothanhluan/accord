---
id: UILINK
title: Interface ticket with only a design link
type: story
status: open
ui: true
design: "https://example.com/design/uilink"
---

## Intent
Users see the rebuilt settings page.

## Requirements
- WHEN a user opens the settings page the system SHALL show the new layout

## Acceptance criteria
```gherkin
Feature: UILINK

  @ac-1
  Scenario: Open the settings page
    When they open the settings page
    Then they see the new layout
```

## Open questions
- [x] Clear

## Plan
- Rebuild the settings page @ac-1
