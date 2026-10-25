---
id: HYGIENE
title: Ticket with hygiene problems
type: story
status: open
ui: false
assumptions:
  - { text: "SSO exists", confirmed: false }
---

## Intent
Users sign in by email. TODO write the forgotten password part.

## Requirements
- WHEN a payment maybe fails the system SHALL retry once

## Acceptance criteria
```gherkin
Feature: HYGIENE

  @ac-1
  Scenario: Sign-in succeeds
    When they submit a valid email and password
    Then they see the dashboard
```

## Open questions
- [ ] The SSO flow is unclear

## Plan
- Build the sign-in screen @ac-1
