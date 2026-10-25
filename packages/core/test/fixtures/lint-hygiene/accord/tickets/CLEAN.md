---
id: CLEAN
title: Clean ticket
type: story
status: draft
assumptions:
  - { text: "The user already has an account", confirmed: true }
verified: [ac-1]
---

## Intent
The user signs in with email and password to reach the dashboard.
Social sign-in is not supported in this version.

## Requirements
- WHEN the user submits a valid email and password the system SHALL open the dashboard
- IF the password is wrong THEN the system SHALL display an error message

## Acceptance criteria
```gherkin
Feature: CLEAN

  @ac-1 @test:t#a
  Scenario: Sign-in succeeds
    When they submit a valid email and password
    Then they see the dashboard

  @ac-2 @ui
  Scenario: Wrong password
    When they submit a wrong password
    Then they see an error message
```

## Open questions
- [x] Clear

## Plan
- Step one @ac-1
- Step two @ac-2

## Verification notes
### @ac-1 Sign-in
Checked by hand.
