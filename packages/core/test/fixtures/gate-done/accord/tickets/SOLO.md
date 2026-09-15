---
id: SOLO
title: Phiếu chỉ có một người vừa viết vừa duyệt
type: story
status: open
ui: false
ac_hash: "fnv1a64:0e84e174c4cdc76b"
verified:
  - ac-1
  - ac-2
verified_hash: "fnv1a64:0e84e174c4cdc76b"
verified_commit: "1234567"
---

## Intent
Người dùng đăng nhập bằng email để vào bảng điều khiển.

## Requirements
- WHEN người dùng gửi email và mật khẩu hợp lệ the system SHALL mở bảng điều khiển

## Acceptance criteria
```gherkin
Feature: SOLO

  @ac-1 @test:test/login.spec.ts#ok1
  Scenario: Đăng nhập thành công
    When họ gửi email và mật khẩu hợp lệ
    Then họ thấy bảng điều khiển

  @ac-2 @test:test/login.spec.ts#ok2
  Scenario: Mật khẩu sai
    When họ gửi mật khẩu sai
    Then họ thấy thông báo lỗi
```

## Open questions
- [x] Đã rõ

## Plan
- Làm màn hình đăng nhập @ac-1
- Trả lỗi khi xác thực hỏng @ac-2

## Verification notes
### @ac-1
src/auth/login.ts mở phiên mới rồi chuyển hướng, đã xem lại bằng tay.

### @ac-2
src/auth/login.ts dừng trước khi tạo phiên và ghi nhật ký lần thử hỏng.
