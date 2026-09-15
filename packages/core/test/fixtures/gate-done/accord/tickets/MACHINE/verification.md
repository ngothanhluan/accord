---
ticket: MACHINE
commit: 1234567
reviewed_on: 2026-09-10
---

## @ac-1 Bài kiểm thử bị tắt tiếng

Result: pass

Evidence: test/login.spec.ts#skip1

## @ac-2 Bài kiểm thử hỏng

Result: pass

Evidence: test/login.spec.ts#fail1

## @ac-3 Mã kiểm thử không có trong báo cáo

Result: pass

Evidence: test/login.spec.ts và src/auth/login.ts

## @ac-4 Kịch bản quên gắn thẻ kiểm thử

Result: pass

Evidence: test/login.spec.ts và src/auth/login.ts
