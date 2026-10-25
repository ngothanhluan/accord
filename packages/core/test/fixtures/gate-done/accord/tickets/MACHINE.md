---
id: MACHINE
title: The machine layer of Done reads the report, not the claim
type: story
status: open
ui: false
ac_hash: "fnv1a64:f75d2f60b5606c77"
verified:
  - ac-1
  - ac-2
  - ac-3
  - ac-4
verified_hash: "fnv1a64:f75d2f60b5606c77"
verified_commit: "1234567"
---

## Intent
Users sign in with an email to reach the dashboard.

## Requirements
- WHEN a user submits a valid email and password the system SHALL open the dashboard

## Acceptance criteria
```gherkin
Feature: MACHINE

  @ac-1 @test:test/login.spec.ts#skip1
  Scenario: Muted test
    When they submit a valid email and password
    Then they see the dashboard

  @ac-2 @test:test/login.spec.ts#fail1
  Scenario: Failing test
    When they submit a wrong password
    Then they see an error message

  @ac-3 @test:nope#missing
  Scenario: Test id absent from the report
    When they submit an unregistered email
    Then they see an invitation to create an account

  @ac-4
  Scenario: Scenario with no test tag
    When they submit an uppercase email
    Then the system still finds the right account
```

## Open questions
- [x] Clear

## Plan
- Build the sign-in screen @ac-1
- Return an error on failed authentication @ac-2
- Invite to create an account for an unknown email @ac-3
- Normalise the email before lookup @ac-4

## Verification notes
### @ac-1
src/auth/login.ts opens a new session and redirects, I read every branch again.

### @ac-2
src/auth/login.ts stops before it creates a session and logs the failed attempt.

### @ac-3
src/auth/login.ts returns a sign-up invitation instead of a wrong-password error, so no existing email is exposed.

### @ac-4
src/auth/login.ts lowercases the email before lookup, so an uppercase email still reaches the right account.
