---
id: NOUI
title: Ticket without an interface
type: story
status: open
ui: false
---

## Intent
The system cleans up expired sign-in sessions every night.

## Requirements
- WHEN a sign-in session expires the system SHALL delete that session

## Acceptance criteria
```gherkin
Feature: NOUI

  @ac-1
  Scenario: Expired session is deleted
    When the nightly job runs
    Then the expired session is gone
```

## Open questions
- [x] Clear

## Plan
- Write the session cleanup job @ac-1
