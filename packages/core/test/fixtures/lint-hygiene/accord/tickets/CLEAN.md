---
id: CLEAN
title: Phiếu sạch
type: story
status: draft
assumptions:
  - { text: "Người dùng đã có tài khoản", confirmed: true }
verified: [ac-1]
---

## Intent
Người dùng đăng nhập bằng email và mật khẩu để vào bảng điều khiển.
Không hỗ trợ đăng nhập mạng xã hội trong phiên bản này.

## Requirements
- WHEN người dùng gửi email và mật khẩu hợp lệ the system SHALL mở bảng điều khiển
- IF mật khẩu sai THEN the system SHALL hiển thị thông báo lỗi

## Acceptance criteria
```gherkin
Feature: CLEAN

  @ac-1 @test:t#a
  Scenario: Đăng nhập thành công
    When họ gửi email và mật khẩu hợp lệ
    Then họ thấy bảng điều khiển

  @ac-2 @ui
  Scenario: Mật khẩu sai
    When họ gửi mật khẩu sai
    Then họ thấy thông báo lỗi
```

## Open questions
- [x] Đã rõ

## Plan
- Bước một @ac-1
- Bước hai @ac-2

## Verification notes
### @ac-1 Đăng nhập
Đã kiểm tra bằng tay.
