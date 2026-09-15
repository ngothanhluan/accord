---
id: UINOTE
title: Kịch bản @ui chịu đúng quy tắc ghi chú như mọi kịch bản khác
type: story
status: open
ui: false
ac_hash: "fnv1a64:f3a2a28e8544cf06"
verified:
  - ac-1
  - ac-2
verified_hash: "fnv1a64:f3a2a28e8544cf06"
verified_commit: "1234567"
---

## Intent
Màn hình đăng nhập phải hiển thị đúng trạng thái cho người dùng.

## Requirements
- WHEN ô email còn trống the system SHALL làm mờ nút đăng nhập

## Acceptance criteria
```gherkin
Feature: UINOTE

  @ac-1 @ui
  Scenario: Nút đăng nhập bị vô hiệu hoá
    When ô email còn trống
    Then nút đăng nhập bị mờ đi

  @ac-2 @ui
  Scenario: Thông báo lỗi hiện ra
    When họ gửi mật khẩu sai
    Then thông báo lỗi hiện ngay dưới ô mật khẩu
```

## Open questions
- [x] Đã rõ

## Plan
- Làm nút đăng nhập mờ đi @ac-1
- Hiện thông báo lỗi @ac-2

## Verification notes
### @ac-1
src/auth/login.ts đặt thuộc tính disabled, tôi đã bấm thử trên máy và nút không phản hồi.

### @ac-2
Thông báo lỗi hiện ra When họ gửi mật khẩu sai Then thông báo lỗi hiện ngay dưới ô mật khẩu src/auth/login.ts
