---
id: SCHEMA
type: story
status: open
ui: false
---

## Intent
Người dùng đổi mật khẩu trong phần cài đặt.

## Requirements
- WHEN người dùng gửi mật khẩu mới hợp lệ the system SHALL lưu mật khẩu đó

## Acceptance criteria
```gherkin
Feature: SCHEMA

  @ac-1
  Scenario: Đổi mật khẩu
    When họ gửi mật khẩu mới hợp lệ
    Then mật khẩu được lưu
```

## Open questions
- [x] Đã rõ

## Plan
- Làm biểu mẫu đổi mật khẩu @ac-1
