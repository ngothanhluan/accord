---
id: HYGIENE
title: Phiếu chưa vệ sinh
type: story
status: open
ui: false
assumptions:
  - { text: "Đã có SSO", confirmed: false }
---

## Intent
Người dùng đăng nhập bằng email. TODO viết thêm phần quên mật khẩu.

## Requirements
- WHEN thanh toán maybe thất bại the system SHALL thử lại một lần

## Acceptance criteria
```gherkin
Feature: HYGIENE

  @ac-1
  Scenario: Đăng nhập thành công
    When họ gửi email và mật khẩu hợp lệ
    Then họ thấy bảng điều khiển
```

## Open questions
- [ ] Chưa rõ luồng SSO

## Plan
- Làm màn hình đăng nhập @ac-1
