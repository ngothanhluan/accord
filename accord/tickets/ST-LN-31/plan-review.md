# Plan review: ST-LN-31

## Round 1 (whole)

1. Must — An approved lane M ticket edited in place to `lane: S` passes `gate ready` and CI's lane S `gate done` with no approval, plan, verification or suite check; nothing hashes the lane or flags a lane S ticket carrying `approved_hash`, `@ac-n` scenarios or `plan.md` (breaks D-03 "never after", @ac-5) — open
2. Should — In CI (detached head), lane S `gate done` reads the commits after the review from the claim ref, not HEAD, while `reviewFacts` reads HEAD; a pull request from another branch or a fork that adds code after review.md passes — open
3. Should — Lane S review stop condition ("Fix every Must and Should … Stop when a round leaves no Must open") lets fixes made in the last round ship unreviewed, and reads two ways for a round with only Shoulds; the gate cannot see it — open
4. Should — The drop to lane S checks only committed history, then `ids.md` step 1 commits every change in the worktree and pushes it, and `accord worktree clean` later deletes the branch: uncommitted product code is committed and then deleted — open
5. Should — The lifted ticket's fork-point baseline (D-11) relies on plan/SKILL.md wording that still says run `git rev-parse HEAD`, and `packages/core/agents/planner.md:18` is in no task's `files:`; a lifted ticket's lane M review can leave out the lane S code — open
6. Should — Lane S `gate done` has no suite rule, so a lane S pull request that breaks a test outside `tests.affected` turns the accord CI job green (accord.yml runs the suite with `|| true`); the approved Approach says no suite rule — open
7. Should — Lane S review rounds are not recorded until the end, so on resume the stage reads `build`, the session redoes the Change step and counts rounds from 1, breaking the five-round cap (@ac-4, D-08) — open
8. Should — Under runtimes that get `stop:` instead of `enter:` (Cursor, Codex, Copilot), the `Understood:`/`Done when:` lines of a lane S request or drop hand-off never reach the session that writes them into the ticket (Compatibility constraint, ledger Ruling on the hand-off) — open
9. Should — Task 7's reviewer.md says a lane S ticket has no ledger, yet lane-s.md writes Rulings to the ledger; the lane S reviewer is never given the ledger and re-litigates settled Rulings — open
10. Nice — After the review, Understood and Done when can be rewritten and `gate ready` rerun with nothing flagging it — deferred
11. Nice — `lint.dropped-approved` matches only the exact reason `moved to lane S`; a variant such as `moved to lane S.` escapes it — deferred
12. Nice — The intent drop rule applies to any lane M ticket in its interview, not only one queued on origin's default branch (D-03) — deferred
13. Nice — `docs/specs/2026-10-12-workflow-layer-design.md:65-66` still lists the old lift conditions — deferred
14. Nice — Task 6's fork-point test assumes git's default branch is `main` or `master`; `init.defaultBranch=trunk` fails it — deferred
