# Plan review: ST-LN-21

## Round 1 (whole)

1. Should — Task 1's ac-3 test, steps 3 and 4, does not observe the redraw it claims: after `h.type('log')` the row ST-1 "Login form" is already on screen, so waiting for ST-1 passes before the turn.complete refresh draws, and `marked()` reads the tree drawn after typing; step 4 can call `h.settle` while the queued run is not yet pushed (`refresh` still inside `await $.ui.invalidate` with `running` true), so `runs.shift()` throws at panel.test.ts:47 and the test is flaky. Fix: in step 3 settle a board the eye can tell apart (for example twoRows plus a TEAM row ST-3 "Logout", matching `log`) and wait for ST-3; in step 4 wait for `h.inflight()` to be 1 before `h.settle` (panel.test.ts:49) — fixed
2. Nice — the `h.input()?.['place' + 'holder']` indirection is not needed in the test: the deferral-word rule scans only plan task lines (packages/core/src/gate/plan.ts:13, :193-207), so `h.input()?.placeholder` is fine in panel.test.ts — deferred

## Round 2 (diff)

No findings

## Closed
