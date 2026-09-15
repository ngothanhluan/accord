---
id: NOTES
title: Ghi chú thiếu, dán lại, và không nêu tệp
type: story
status: open
ui: false
ac_hash: "fnv1a64:01d5981d93f368f0"
verified:
  - ac-1
  - ac-2
  - ac-3
verified_hash: "fnv1a64:01d5981d93f368f0"
verified_commit: "1234567"
---

## Intent
Người dùng đăng nhập bằng email để vào bảng điều khiển.

## Requirements
- WHEN người dùng gửi email và mật khẩu hợp lệ the system SHALL mở bảng điều khiển

## Acceptance criteria
```gherkin
Feature: NOTES

  @ac-1 @test:test/login.spec.ts#ok1
  Scenario: Đăng nhập thành công
    When họ gửi email và mật khẩu hợp lệ
    Then họ thấy bảng điều khiển

  @ac-2 @test:test/login.spec.ts#ok2
  Scenario: Mật khẩu sai
    When họ gửi mật khẩu sai
    Then họ thấy thông báo lỗi

  @ac-3 @ui
  Scenario: Nút đăng nhập bị vô hiệu hoá
    When ô email còn trống
    Then nút đăng nhập bị mờ đi
```

## Open questions
- [x] Đã rõ

## Plan
- Làm màn hình đăng nhập @ac-1
- Trả lỗi khi xác thực hỏng @ac-2
- Làm nút đăng nhập mờ đi @ac-3

## Verification notes
### @ac-2
Mật khẩu sai When họ gửi mật khẩu sai Then họ thấy thông báo lỗi src/auth/login.ts

### @ac-3
LoginButton
