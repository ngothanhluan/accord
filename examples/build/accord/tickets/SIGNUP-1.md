---
id: SIGNUP-1
title: Sign up with an email address
type: story
status: open
ui: false
ac_hash: "fnv1a64:6b9d74873ab9078e"
verified:
  - ac-1
  - ac-2
verified_hash: "fnv1a64:6b9d74873ab9078e"
verified_commit: "1234567"
---

## Intent
A visitor who wants to try the product creates an account themselves, with an email address and a
password, and is working inside their workspace a few seconds later. We know it worked when a visitor
who has never been here reaches their workspace on the first attempt, with nobody approving anything.
Out of scope: signing in with an account borrowed from another service, and inviting teammates.

## Requirements
- WHEN a visitor submits an unregistered email address and a password of at least ten characters the system SHALL create the account and open its workspace
- WHEN a visitor submits an email address that already holds an account the system SHALL keep the existing account unchanged and say the address is taken
- The system SHALL treat two email addresses that differ only in letter case as one address

## Acceptance criteria
```gherkin
Feature: SIGNUP-1

  @ac-1 @test:test/signup.spec.ts#creates-the-account
  Scenario: A free address creates an account
    Given no account holds mai@example.test
    When the visitor submits mai@example.test with a password of twelve characters
    Then the workspace for mai@example.test opens

  @ac-2 @test:test/signup.spec.ts#refuses-an-address-already-taken
  Scenario: A taken address is refused
    Given an account already holds mai@example.test
    When the visitor submits MAI@example.test with any password
    Then they are told the address is taken and no second account exists
```

## Open questions
- [x] Ten characters is the password floor, and it comes from accord/product/business-rules.md rather than from this ticket

## Plan
- Store an account under its lowercased address and return its workspace @ac-1
- Look the address up in lowercase before storing, and refuse when it is already held @ac-2

## Verification notes
### @ac-1
src/signup.ts stores the account and hands back the workspace name; the password floor is read from
the one rule rather than written again here, and a nine-character password is refused on the same path.

### @ac-2
src/signup.ts lowercases the address before the lookup, so the second attempt is refused and the
first account is still the one in the store afterwards.
