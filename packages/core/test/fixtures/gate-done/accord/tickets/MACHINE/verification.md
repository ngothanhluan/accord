---
ticket: MACHINE
commit: 1234567
reviewed_on: 2026-09-10
---

## @ac-1 Muted test

Result: pass

Evidence: test/login.spec.ts#skip1

## @ac-2 Failing test

Result: pass

Evidence: test/login.spec.ts#fail1

## @ac-3 Test id absent from the report

Result: pass

Evidence: test/login.spec.ts and src/auth/login.ts

## @ac-4 Scenario with no test tag

Result: pass

Evidence: test/login.spec.ts and src/auth/login.ts
