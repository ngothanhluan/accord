---
id: TESTTAGS
title: Test tags
type: story
status: draft
---

## Intent
A scenario that is not @ui carries exactly one @test: tag.

## Requirements
- WHEN the user submits the form the system SHALL save the data

## Acceptance criteria
```gherkin
Feature: TESTTAGS

  @ac-1 @test:t#a @test:t#b
  Scenario: Two test tags
    Given a

  @ac-2 @ui @test:t#c
  Scenario: Interface with a test tag
    Given b

  @ac-3
  Scenario: Missing test tag
    Given c

  @ac-4 @ui
  Scenario: Interface
    Given d
```

## Open questions

## Plan
- Build @ac-1 @ac-2 @ac-3 @ac-4
