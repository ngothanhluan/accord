---
id: REPORT
title: Sign-in with a test report
type: story
status: open
---

## Intent
The user signs in with email and password to reach the dashboard.

## Requirements
- WHEN the user submits a valid email and password the system SHALL open the dashboard

## Acceptance criteria
```gherkin
Feature: REPORT

  @ac-1 @test:test/auth.spec.ts#auth->-accepts-a-good-password
  Scenario: Sign-in succeeds
    When they submit a valid email and password
    Then they see the dashboard

  @ac-2 @test:test/auth.spec.ts#auth->-rejects-bad-password
  Scenario: Wrong password
    When they submit a wrong password
    Then they see an error message

  @ac-3 @test:nope#missing
  Scenario: Remember sign-in
    When they choose to be remembered
    Then the session is kept

  @ac-4 @ui
  Scenario: Sign-in button
    When they open the sign-in page
    Then they see the sign-in button
```

## Open questions

## Plan
- Build @ac-1 @ac-2 @ac-3 @ac-4
