---
id: UIPROTO
title: Interface ticket with a prototype
type: story
status: open
ui: true
---

## Intent
Users see the rebuilt profile page.

## Requirements
- WHEN a user opens the profile page the system SHALL show the new layout

## Acceptance criteria
```gherkin
Feature: UIPROTO

  @ac-1
  Scenario: Open the profile page
    When they open the profile page
    Then they see the new layout
```

## Open questions
- [x] Clear

## Plan
- Rebuild the profile page @ac-1
