---
id: FENCE
title: t
type: story
status: open
---
## Requirements
<!-- single-line comment -->
<!--
- WHEN inside a comment the system SHALL not count
-->
~~~
## Acceptance criteria
- WHEN inside a fence the system SHALL not count
~~~
- WHEN one
* WHEN two
+ WHEN three
1. WHEN four
WHEN five
### Sub heading

## Acceptance criteria
```gherkin
Feature: FENCE

  @ac-1
  Scenario: one
    Given x
```

## Plan
```gherkin
Feature: FENCE plan

  @ac-9
  Scenario: ignored
    Given y
```
