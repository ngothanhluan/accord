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

Scenario: Không thẻ
  Given a

@ac-1 @ac-2 @smoke
Scenario: Hai thẻ
  Given b

@smoke @ac-3
Scenario: Thẻ ba
  Given c

@ac-1
Scenario: Trùng thẻ
  Given d
```
