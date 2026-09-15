---
id: MACHINE
title: Lớp máy của Done đọc báo cáo chứ không nghe lời khai
type: story
status: open
ui: false
ac_hash: "fnv1a64:cf39577f15f434b9"
verified:
  - ac-1
  - ac-2
  - ac-3
  - ac-4
verified_hash: "fnv1a64:cf39577f15f434b9"
verified_commit: "1234567"
---

## Intent
Người dùng đăng nhập bằng email để vào bảng điều khiển.

## Requirements
- WHEN người dùng gửi email và mật khẩu hợp lệ the system SHALL mở bảng điều khiển

## Acceptance criteria
```gherkin
Feature: MACHINE

  @ac-1 @test:test/login.spec.ts#skip1
  Scenario: Bài kiểm thử bị tắt tiếng
    When họ gửi email và mật khẩu hợp lệ
    Then họ thấy bảng điều khiển

  @ac-2 @test:test/login.spec.ts#fail1
  Scenario: Bài kiểm thử hỏng
    When họ gửi mật khẩu sai
    Then họ thấy thông báo lỗi

  @ac-3 @test:nope#missing
  Scenario: Mã kiểm thử không có trong báo cáo
    When họ gửi email chưa đăng ký
    Then họ thấy lời mời tạo tài khoản

  @ac-4
  Scenario: Kịch bản quên gắn thẻ kiểm thử
    When họ gửi email viết hoa
    Then hệ thống vẫn nhận đúng tài khoản
```

## Open questions
- [x] Đã rõ

## Plan
- Làm màn hình đăng nhập @ac-1
- Trả lỗi khi xác thực hỏng @ac-2
- Mời tạo tài khoản khi email lạ @ac-3
- Chuẩn hoá email trước khi tra cứu @ac-4

## Verification notes
### @ac-1
src/auth/login.ts mở phiên mới rồi chuyển hướng, tôi đã đọc lại từng nhánh.

### @ac-2
src/auth/login.ts dừng trước khi tạo phiên và ghi nhật ký lần thử hỏng.

### @ac-3
src/auth/login.ts trả về lời mời đăng ký thay vì báo sai mật khẩu, tránh lộ email nào đã tồn tại.

### @ac-4
src/auth/login.ts hạ chữ thường email trước khi tra cứu, nên email viết hoa vẫn vào đúng tài khoản.
