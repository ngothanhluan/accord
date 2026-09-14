---
id: TESTTAGS
title: Thẻ kiểm thử
type: story
status: draft
---

## Intent
Kịch bản không phải @ui mang đúng một thẻ @test:.

## Requirements
- WHEN người dùng gửi biểu mẫu the system SHALL lưu dữ liệu

## Acceptance criteria
```gherkin
Feature: TESTTAGS

  @ac-1 @test:t#a @test:t#b
  Scenario: Hai thẻ kiểm thử
    Given a

  @ac-2 @ui @test:t#c
  Scenario: Giao diện có thẻ kiểm thử
    Given b

  @ac-3
  Scenario: Thiếu thẻ kiểm thử
    Given c

  @ac-4 @ui
  Scenario: Giao diện
    Given d
```

## Open questions

## Plan
- Làm @ac-1 @ac-2 @ac-3 @ac-4
