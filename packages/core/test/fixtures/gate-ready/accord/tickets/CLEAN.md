---
id: CLEAN
title: Ready ticket
type: story
status: open
ui: false
---

## Intent
Users sign in by email to reach the dashboard.

## Requirements
- WHEN a user submits a valid email and password the system SHALL open the dashboard

## Acceptance criteria
```gherkin
Feature: CLEAN

  @ac-1
  Scenario: Sign-in succeeds
    When they submit a valid email and password
    Then they see the dashboard
```

## Open questions
- [x] Clear

## Plan
- Build the sign-in screen @ac-1
