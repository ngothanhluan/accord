---
id: UINOREF
title: Interface ticket missing a reference
type: story
status: open
ui: true
---

## Intent
Users see the new sign-in screen.

## Requirements
- WHEN a user opens the sign-in page the system SHALL show the new form

## Acceptance criteria
```gherkin
Feature: UINOREF

  @ac-1
  Scenario: Open the sign-in page
    When they open the sign-in page
    Then they see the new form
```

## Open questions
- [x] Clear

## Plan
- Build the sign-in form @ac-1
