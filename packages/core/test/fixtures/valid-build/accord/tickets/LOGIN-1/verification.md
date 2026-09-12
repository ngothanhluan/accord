---
ticket: LOGIN-1
commit: 1234567
reviewed_on: 2026-09-01
---

<!-- written by the fresh review context -->

## @ac-1 Đăng nhập thành công

Result: pass
<!-- pass | fail | blocked -->

Evidence: npm test -- login.spec.ts
test/login.spec.ts covers the happy path

## @ac-2 Mật khẩu sai

Result: fail
Evidence:
