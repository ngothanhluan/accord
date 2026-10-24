---
id: COMMIT
title: Copy of PASS for COMMIT
type: story
status: open
ui: false
ac_hash: "fnv1a64:d195ee776986de2f"
verified:
  - ac-1
  - ac-2
verified_hash: "fnv1a64:d195ee776986de2f"
verified_commit: "9999999"
---

## Intent
Users sign in with an email to reach the dashboard.

## Requirements
- WHEN a user submits a valid email and password the system SHALL open the dashboard

## Acceptance criteria
```gherkin
Feature: COMMIT

  @ac-1 @test:test/login.spec.ts#ok1
  Scenario: Sign-in succeeds
    When they submit a valid email and password
    Then they see the dashboard

  @ac-2 @test:test/login.spec.ts#ok2
  Scenario: Wrong password
    When they submit a wrong password
    Then they see an error message
```

## Open questions
- [x] Clear

## Plan
- Build the sign-in screen @ac-1
- Return an error on failed authentication @ac-2

## Verification notes
### @ac-1
src/auth/login.ts opens a new session and redirects, checked by hand.

### @ac-2
src/auth/login.ts stops before it creates a session and logs the failed attempt.
