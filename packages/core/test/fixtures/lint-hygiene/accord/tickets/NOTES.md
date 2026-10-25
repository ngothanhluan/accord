---
id: NOTES
title: Verification notes in the wrong place
type: story
status: draft
---

## Intent
Verification notes must come last and match the scenarios.

## Requirements
- WHEN the user submits the form the system SHALL save the data

## Acceptance criteria
```gherkin
Feature: NOTES

  @ac-1 @test:t#a
  Scenario: Sign-in
    Given a user
    Then they see the dashboard
```

## Open questions

## Verification notes
### @ac-1 Sign-in
Checked by hand.
<!-- sample note -->
### @ac-9 None
There is no such scenario.
### @AC-1 nope

## Plan
- Build @ac-1
