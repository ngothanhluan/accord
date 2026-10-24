---
id: ACTAGS
title: Tag @ac-n
type: story
status: draft
---

## Intent
Each scenario carries exactly one @ac-n tag of its own.

## Requirements
- WHEN the user submits the form the system SHALL save the data

## Acceptance criteria
```gherkin
Feature: ACTAGS

  @test:t#a
  Scenario: No tag
    Given a

  @ac-1 @ac-2 @test:t#b
  Scenario: Two tags
    Given b

  @ac-1 @test:t#c
  Scenario: Duplicate tag
    Given c
```

## Open questions

## Plan
- Build @ac-1
