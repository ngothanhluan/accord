---
id: MISSING
title: Config points to absent files
type: story
status: draft
---

## Intent
The config points to a token file and a test report that are not in the repository.

## Requirements
- WHEN the user submits the form the system SHALL save the data

## Acceptance criteria
```gherkin
Feature: MISSING

  @ac-1 @test:t#a
  Scenario: Save the data
    When they submit the form
    Then the data is saved
```

## Open questions

## Plan
- Build @ac-1
