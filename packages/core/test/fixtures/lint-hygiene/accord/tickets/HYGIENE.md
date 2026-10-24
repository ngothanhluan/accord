---
id: HYGIENE
title: Ticket hygiene
type: story
status: draft
tracker: {}
assumptions:
  - { text: "The user already has an account", confirmed: false }
  - { text: "SSO exists", confirmed: true }
verified: [ac-1, ac-9]
---

## Intent
The user signs in. TODO write more. FIXME again.
Result: <observable outcome> for the user.
<!-- TODO - [ ] <placeholder text> TICKET-ID -->

## Requirements
- WHEN the user submits the form the system SHALL save TBD
- WHEN the user cancels the system SHALL maybe close the form

## Acceptance criteria
```gherkin
Feature: TICKET-ID

  @ac-1 @test:t#a
  Scenario: Sign-in
    Given probably a user
    When ...
    Then they see the dashboard
```

## Open questions
- [ ] The SSO flow is unclear
- [x] It depends on the tracker
- [x] Clear

## Plan
- Build the form @ac-1
- Write the test
- Connect the tracker @ac-2
