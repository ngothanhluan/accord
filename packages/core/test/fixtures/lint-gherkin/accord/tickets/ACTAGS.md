---
id: ACTAGS
title: Thẻ @ac-n
type: story
status: draft
---

## Intent
Mỗi kịch bản mang đúng một thẻ @ac-n riêng.

## Requirements
- WHEN người dùng gửi biểu mẫu the system SHALL lưu dữ liệu

## Acceptance criteria
```gherkin
Feature: ACTAGS

  @test:t#a
  Scenario: Không thẻ
    Given a

  @ac-1 @ac-2 @test:t#b
  Scenario: Hai thẻ
    Given b

  @ac-1 @test:t#c
  Scenario: Trùng thẻ
    Given c
```

## Open questions

## Plan
- Làm @ac-1
