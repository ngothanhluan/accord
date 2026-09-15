---
id: NOVERIF
title: Không có hồ sơ kiểm chứng
type: story
status: open
ui: false
---

## Intent
Người dùng đăng nhập bằng email để vào bảng điều khiển.

## Requirements
- WHEN người dùng gửi email và mật khẩu hợp lệ the system SHALL mở bảng điều khiển

## Acceptance criteria
```gherkin
Feature: NOVERIF

  @ac-1 @test:test/login.spec.ts#ok1
  Scenario: Đăng nhập thành công
    When họ gửi email và mật khẩu hợp lệ
    Then họ thấy bảng điều khiển
```

## Open questions
- [x] Đã rõ

## Plan
- Làm màn hình đăng nhập @ac-1
