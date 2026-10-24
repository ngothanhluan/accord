---
id: NOTES
title: Notes missing, pasted back, and naming no file
type: story
status: open
ui: false
ac_hash: "fnv1a64:a95f4c063932127a"
verified:
  - ac-1
  - ac-2
  - ac-3
verified_hash: "fnv1a64:a95f4c063932127a"
verified_commit: "1234567"
---

## Intent
Users sign in with an email to reach the dashboard.

## Requirements
- WHEN a user submits a valid email and password the system SHALL open the dashboard

## Acceptance criteria
```gherkin
Feature: NOTES

  @ac-1 @test:test/login.spec.ts#ok1
  Scenario: Sign-in succeeds
    When they submit a valid email and password
    Then they see the dashboard

  @ac-2 @test:test/login.spec.ts#ok2
  Scenario: Wrong password
    When they submit a wrong password
    Then they see an error message

  @ac-3 @ui
  Scenario: Sign-in button disabled
    When the email field is empty
    Then the sign-in button is greyed out
```

## Open questions
- [x] Clear

## Plan
- Build the sign-in screen @ac-1
- Return an error on failed authentication @ac-2
- Grey out the sign-in button @ac-3

## Verification notes
### @ac-2
Wrong password When they submit a wrong password Then they see an error message src/auth/login.ts

### @ac-3
LoginButton
