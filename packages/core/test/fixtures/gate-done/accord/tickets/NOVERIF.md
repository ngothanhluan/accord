---
id: NOVERIF
title: No verification record
type: story
status: open
ui: false
---

## Intent
Users sign in with an email to reach the dashboard.

## Requirements
- WHEN a user submits a valid email and password the system SHALL open the dashboard

## Acceptance criteria
```gherkin
Feature: NOVERIF

  @ac-1 @test:test/login.spec.ts#ok1
  Scenario: Sign-in succeeds
    When they submit a valid email and password
    Then they see the dashboard
```

## Open questions
- [x] Clear

## Plan
- Build the sign-in screen @ac-1
