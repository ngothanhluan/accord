---
ticket: A
commit: abcdef0
reviewed_on: 2026-09-02
---

## @ac-1 One

Result: pass
<!-- pass | fail | blocked -->

Evidence: line one
line two <!-- skip -->
line three

## @ac-2 Two

Evidence: run npm test

## @ac-3 Three

Result: PASS

## @ac-4 Four

Result: blocked

## Notes
Free notes, not an evidence block.

## @ac-1 One more time

Result: fail
Evidence: repeated block
