# Plan review: ST-LN-6

## Round 1 (whole)
1. Should — the detail view's fact lines (`Holder:`, `Blocked by:`, `Test:`, `Test result:`, `Verification:`) get no `wrap: 'wrap'` and rely on a `Text` default the host type file does not state (d.ts:1667-1668 is the code view's wrap); a 120-character `@test` id can be cut at the pane edge, and the ac-5 test checks only the title and a step — give every detail `Text` `wrap: 'wrap'` and assert it on one long `Test:` fact — fixed
2. Should — Task 4's failed-run test cannot pass on the fake host: `$.process.run` pushes to two queues, `settle` shifts `pending` and `fail` shifts `failers` (`packages/core/test/panel.test.ts:48-49, :95`), so after a settled dashboard run `h.fail` rejects the stale first promise and the `show` run never fails — Task 4 says the fake host keeps one queue of `{ res, rej }` pairs that `settle` and `fail` both shift — fixed
3. Should — the detail's Continue or Pick up button is captured when the detail opens and is not refreshed when `turn.complete` re-runs `show`, so after a Pick up moves the ticket to YOURS the open detail still offers Pick up (noted by the build critic outside its lens) — fixed
4. Nice — Tasks 3 and 4 disagree on what the Loading state draws; Task 4 should say "a failed-run message state" — deferred

## Round 2 (diff)
No findings

## Closed
