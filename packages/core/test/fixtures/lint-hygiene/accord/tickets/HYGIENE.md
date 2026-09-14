---
id: HYGIENE
title: Vệ sinh phiếu
type: story
status: draft
tracker: {}
assumptions:
  - { text: "Người dùng đã có tài khoản", confirmed: false }
  - { text: "Đã có SSO", confirmed: true }
verified: [ac-1, ac-9]
---

## Intent
Người dùng đăng nhập. TODO viết thêm. FIXME nữa.
Kết quả: <observable outcome> cho người dùng.
<!-- TODO - [ ] <placeholder text> TICKET-ID -->

## Requirements
- WHEN người dùng gửi form the system SHALL lưu TBD
- WHEN người dùng huỷ the system SHALL maybe đóng form

## Acceptance criteria
```gherkin
Feature: TICKET-ID

  @ac-1 @test:t#a
  Scenario: Đăng nhập
    Given probably một người dùng
    When ...
    Then thấy bảng điều khiển
```

## Open questions
- [ ] Chưa rõ luồng SSO
- [x] It depends on the tracker
- [x] Đã rõ

## Plan
- Làm form @ac-1
- Viết test
- Nối tracker @ac-2
