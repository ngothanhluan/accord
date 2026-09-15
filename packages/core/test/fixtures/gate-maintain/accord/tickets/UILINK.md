---
id: UILINK
title: Phiếu giao diện chỉ có đường dẫn thiết kế
type: story
status: open
ui: true
design: "https://example.com/design/uilink"
---

## Intent
Người dùng thấy trang cài đặt được dựng lại.

## Requirements
- WHEN người dùng mở trang cài đặt the system SHALL hiển thị bố cục mới

## Acceptance criteria
```gherkin
Feature: UILINK

  @ac-1
  Scenario: Mở trang cài đặt
    When họ mở trang cài đặt
    Then họ thấy bố cục mới
```

## Open questions
- [x] Đã rõ

## Plan
- Dựng lại trang cài đặt @ac-1
