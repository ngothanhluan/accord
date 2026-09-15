---
id: NOUI
title: Phiếu không có giao diện
type: story
status: open
ui: false
---

## Intent
Hệ thống dọn phiên đăng nhập đã hết hạn mỗi đêm.

## Requirements
- WHEN phiên đăng nhập hết hạn the system SHALL xoá phiên đó

## Acceptance criteria
```gherkin
Feature: NOUI

  @ac-1
  Scenario: Xoá phiên hết hạn
    When công việc đêm chạy
    Then phiên hết hạn không còn
```

## Open questions
- [x] Đã rõ

## Plan
- Viết công việc dọn phiên @ac-1
