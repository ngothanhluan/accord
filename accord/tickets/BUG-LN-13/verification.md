---
ticket: "BUG-LN-13"
commit: "125dc0424977f6853d76ba98444a36eea7f37ff3"
reviewed_on: "2026-10-29"
---

## @ac-1 A lane S ticket with a review verdict that is not yet on the default branch stays in YOURS

Result: pass

Evidence: Exists: packages/cli/test/done-on-default.test.ts:52-76 builds a repo where main and origin/main hold S-1 unreviewed and t/S-1 adds the verdict. Substantive: packages/core/src/status/dashboard.ts (`finished` and `isOpen`) counts a row done only if `isDone(ref.snapshot, id)`. A row whose own stage is `done` but which is not finished on the ref gets `next: nextStep(ticket, 'done')`. packages/core/src/status/stage.ts keeps the lane S wording "the pull request; run accord gate done (lane-s.md)". Wired: packages/cli/src/run.ts `preflight(..., 'claims')` calls `withDefaultRef`, which fills `snapshot.defaultRef` via `doneRef` and `snapshotAt` in packages/cli/src/load/fs.ts:985-1012. Data flows: the real `run(['dashboard'])` output has S-1 under YOURS with "done, next: the pull request; run accord gate done (lane-s.md)" and ", 0 done" in the count line. `npx vitest run packages/cli/test/done-on-default.test.ts packages/core/test/done-on-default.test.ts --maxWorkers=6` gave 8 passed. The full suite (supplied by the caller) passed, and `npm run lint` printed no findings.

## @ac-2 A ticked lane M ticket that is not yet on the default branch stays in YOURS

Result: pass

Evidence: Exists: packages/cli/test/done-on-default.test.ts:96-121. Substantive: packages/core/src/status/stage.ts changes `NEXT.done` to "the pull request; run accord gate done" (D-05). The same dashboard.ts lift keeps the row open until it is done on the ref. Wired: the same claims preflight and `withDefaultRef` path as ac-1. Data flows: the test reads dashboard output where T-1, ticked only on t/T-1, is in YOURS with that next step and no "lane-s.md", and the count line says ", 0 done". The test passed in my run.

## @ac-3 A dependant stays blocked until the ticket's done records reach the default branch

Result: pass

Evidence: Exists: packages/cli/test/done-on-default.test.ts:161-200, plus a risk test for `show` and `next` at :140. Substantive: packages/core/src/status/rows.ts computes `blockedBy` with `doneOnDefault(snapshot, d, ...)`. The new READY rule `dependsUnmerged` in packages/core/src/gate/ready.ts:123-143 is registered in packages/core/src/gate/rules.ts:129 as `gate.depends-unmerged`. Wired: `gate ready` goes through `withDefaultRef` in packages/cli/src/commands/gate.ts, and `next` moved to the claims preflight in packages/cli/src/run.ts. Data flows: with the checkout on t/T-1, the dashboard shows T-2 `blockedBy ['T-1']` and `gate ready T-2` exits 1 with a reason naming "T-1" and "on origin/main". After a squash merge and an `origin/main` update, T-1 leaves YOURS, `summary.done` is 1, `blockedBy` is `[]`, blocked is 0, and `gate ready` exits 0 with no finding naming T-1. The squash merge case is covered. The test passed.

## @ac-4 accord status --json keeps its shape

Result: pass

Evidence: Exists: packages/cli/test/done-on-default.test.ts:123-138. Substantive: the diff touches no row-building keys. packages/core/src/status/rows.ts changes only the `blockedBy` value, and packages/core/src/status/stage.ts adds no new stage value. Wired: the test runs the real `status --json` against a repo where T-1 and S-1 are done only on their claim branches. Data flows: the test asserts `Object.keys(row)` equals the explicit key list `id, type, status, ui, errors, warnings, ready, ticksVerified, ticksTagged, ticksBinding, title, lane, stage, tasksDone, tasksTotal, claimedBy, branch` and `stage === 'done'` for both tickets. The test passed. That key list is hard-coded in the test, and I did not diff it against the pre-change output.
