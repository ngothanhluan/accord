---
id: UINOTE
title: A @ui scenario follows the same note rule as every other scenario
type: story
status: open
ui: false
ac_hash: "fnv1a64:eea0f403346c3592"
verified:
  - ac-1
  - ac-2
verified_hash: "fnv1a64:eea0f403346c3592"
verified_commit: "1234567"
---

## Intent
The sign-in screen must show the right state to the user.

## Requirements
- WHEN the email field is empty the system SHALL grey out the sign-in button

## Acceptance criteria
```gherkin
Feature: UINOTE

  @ac-1 @ui
  Scenario: Sign-in button disabled
    When the email field is empty
    Then the sign-in button is greyed out

  @ac-2 @ui
  Scenario: Error message appears
    When they submit a wrong password
    Then the error message appears right below the password field
```

## Open questions
- [x] Clear

## Plan
- Grey out the sign-in button @ac-1
- Show an error message @ac-2

## Verification notes
### @ac-1
src/auth/login.ts sets the disabled attribute, I clicked it on a device and the button did not respond.

### @ac-2
Error message appears When they submit a wrong password Then the error message appears right below the password field src/auth/login.ts
