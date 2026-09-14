---
id: REPORT
title: Đăng nhập có báo cáo kiểm thử
type: story
status: open
---

## Intent
Người dùng đăng nhập bằng email và mật khẩu để vào bảng điều khiển.

## Requirements
- WHEN người dùng gửi email và mật khẩu hợp lệ the system SHALL mở bảng điều khiển

## Acceptance criteria
```gherkin
Feature: REPORT

  @ac-1 @test:test/auth.spec.ts#auth->-accepts-a-good-password
  Scenario: Đăng nhập thành công
    When họ gửi email và mật khẩu hợp lệ
    Then họ thấy bảng điều khiển

  @ac-2 @test:test/auth.spec.ts#auth->-rejects-bad-password
  Scenario: Mật khẩu sai
    When họ gửi mật khẩu sai
    Then họ thấy thông báo lỗi

  @ac-3 @test:nope#missing
  Scenario: Ghi nhớ đăng nhập
    When họ chọn ghi nhớ
    Then phiên được giữ

  @ac-4 @ui
  Scenario: Nút đăng nhập
    When họ mở trang đăng nhập
    Then họ thấy nút đăng nhập
```

## Open questions

## Plan
- Làm @ac-1 @ac-2 @ac-3 @ac-4
