---
id: LOGIN-1                       # equals the file name
title: Đăng nhập bằng email
type: story
status: open
parent: EPIC-1
# ids in the tracker are strings even when they look numeric
tracker:
  shortcut: 1234
  jira: 1e3
ui: true
design: "https://www.figma.com/file/abc"
assumptions:
  - { text: "Người dùng đã có tài khoản", confirmed: true }
ac_hash: "deadbeef"
verified:
  - ac-1
---

## Intent
Người dùng đăng nhập bằng email và mật khẩu để vào bảng điều khiển.
Không hỗ trợ đăng nhập mạng xã hội trong phiên bản này.

## Requirements
<!-- BA. One EARS line per requirement. -->
- WHEN người dùng gửi email và mật khẩu hợp lệ the system SHALL mở bảng điều khiển
- IF mật khẩu sai THEN the system SHALL hiển thị thông báo lỗi

## Acceptance criteria
<!-- BA. One fenced gherkin block; every scenario tagged @ac-n. -->
```gherkin
Feature: LOGIN-1

  Background:
    Given một người dùng đã đăng ký

  @ac-1
  Scenario: Đăng nhập thành công
    When họ gửi email và mật khẩu hợp lệ
    Then họ thấy bảng điều khiển

  @ac-2
  Scenario: Mật khẩu sai
    When họ gửi mật khẩu sai
    Then họ thấy thông báo lỗi
```

## Open questions
- [x] Có cần ghi nhớ đăng nhập không? Không, để sau.

## Plan
<!-- Developer fills this in. BA leaves it empty. -->
