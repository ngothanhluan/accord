---
id: TAGS
title: t
type: story
status: open
---
## Acceptance criteria

```gherkin
@feature-tag
Feature: TAGS

Scenario: No tag
  Given a

@ac-1 @ac-2 @smoke
Scenario: Two tags
  Given b

@smoke @ac-3
Scenario: Third tag
  Given c

@ac-1
Scenario: Duplicate tag
  Given d
```
