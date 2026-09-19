---
ticket: SIGNUP-1
commit: 1234567
reviewed_on: 2026-09-18
---

## @ac-1 A free address creates an account

Result: pass

Evidence: test/signup.spec.ts#creates-the-account, and src/signup.ts returns the workspace only after the account is in the store.

## @ac-2 A taken address is refused

Result: pass

Evidence: test/signup.spec.ts#refuses-an-address-already-taken, run with the address in mixed case so the lowercasing in src/signup.ts is what the test exercises.
