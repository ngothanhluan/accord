---
id: EARS
title: Phân loại EARS
type: story
status: draft
---

## Intent
Mỗi dòng yêu cầu là một trong sáu mẫu EARS.

## Requirements
- The system shall log every request.
- WHEN the user submits the form, the system SHALL save the data
- While the aircraft is on ground, the system shall disable reverse thrust
- IF the password is wrong THEN the system SHALL show an error
- Where the premium feature is enabled, the system shall show the export button
- While the user is signed in, when the session expires, the system shall redirect to login
- WHEN người dùng gửi email và mật khẩu hợp lệ the system SHALL mở bảng điều khiển
- IF mật khẩu sai THEN the system SHALL hiển thị thông báo lỗi
- WHEN người dùng có tài khoản the system SHALL cho phép đăng nhập
- WHEN the user clicks, it saves
- The user logs in
- The system must log it
- WHEN x the system shall
- Sau khi đăng nhập WHEN x the system shall y
- WHEN a WHEN b the system shall c
- WHEN the system shall save
- IF x the system shall y
- WHEN x THEN the system shall y
- IF x THEN y WHEN z the system shall w

## Acceptance criteria
```gherkin
Feature: EARS

  @ac-1 @test:t#a
  Scenario: Ghi nhật ký
    When họ gửi yêu cầu
    Then yêu cầu được ghi lại
```

## Open questions

## Plan
- Ghi nhật ký @ac-1
