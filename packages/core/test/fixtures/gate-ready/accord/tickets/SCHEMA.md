---
id: SCHEMA
type: story
status: open
ui: false
---

## Intent
Users change their password in the settings.

## Requirements
- WHEN a user submits a valid new password the system SHALL save that password

## Acceptance criteria
```gherkin
Feature: SCHEMA

  @ac-1
  Scenario: Change password
    When they submit a valid new password
    Then the password is saved
```

## Open questions
- [x] Clear

## Plan
- Build the change password form @ac-1
