# Plan review: ST-LN-31

## Round 1 (whole)

1. Must — An approved lane M ticket edited in place to `lane: S` passes `gate ready` and CI's lane S `gate done` with no approval, plan, verification or suite check; nothing hashes the lane or flags a lane S ticket carrying `approved_hash`, `@ac-n` scenarios or `plan.md` (breaks D-03 "never after", @ac-5) — fixed
2. Should — In CI (detached head), lane S `gate done` reads the commits after the review from the claim ref, not HEAD, while `reviewFacts` reads HEAD; a pull request from another branch or a fork that adds code after review.md passes — fixed
3. Should — Lane S review stop condition ("Fix every Must and Should … Stop when a round leaves no Must open") lets fixes made in the last round ship unreviewed, and reads two ways for a round with only Shoulds; the gate cannot see it — repeated as 2.1
4. Should — The drop to lane S checks only committed history, then `ids.md` step 1 commits every change in the worktree and pushes it, and `accord worktree clean` later deletes the branch: uncommitted product code is committed and then deleted — fixed
5. Should — The lifted ticket's fork-point baseline (D-11) relies on plan/SKILL.md wording that still says run `git rev-parse HEAD`, and `packages/core/agents/planner.md:18` is in no task's `files:`; a lifted ticket's lane M review can leave out the lane S code — fixed
6. Should — Lane S `gate done` has no suite rule, so a lane S pull request that breaks a test outside `tests.affected` turns the accord CI job green (accord.yml runs the suite with `|| true`); the approved Approach says no suite rule — fixed (owner: "A", add the lane M suite rule to lane S `gate done`)
7. Should — Lane S review rounds are not recorded until the end, so on resume the stage reads `build`, the session redoes the Change step and counts rounds from 1, breaking the five-round cap (@ac-4, D-08) — fixed
8. Should — Under runtimes that get `stop:` instead of `enter:` (Cursor, Codex, Copilot), the `Understood:`/`Done when:` lines of a lane S request or drop hand-off never reach the session that writes them into the ticket (Compatibility constraint, ledger Ruling on the hand-off) — fixed
9. Should — Task 7's reviewer.md says a lane S ticket has no ledger, yet lane-s.md writes Rulings to the ledger; the lane S reviewer is never given the ledger and re-litigates settled Rulings — fixed
10. Nice — After the review, Understood and Done when can be rewritten and `gate ready` rerun with nothing flagging it — deferred
11. Nice — `lint.dropped-approved` matches only the exact reason `moved to lane S`; a variant such as `moved to lane S.` escapes it — deferred
12. Nice — The intent drop rule applies to any lane M ticket in its interview, not only one queued on origin's default branch (D-03) — deferred
13. Nice — `docs/specs/2026-10-12-workflow-layer-design.md:65-66` still lists the old lift conditions — deferred
14. Nice — Task 6's fork-point test assumes git's default branch is `main` or `master`; `init.defaultBranch=trunk` fails it — deferred

## Round 2 (whole)

1. Should — repeats 1.3: the verdict is committed alone after the last round, and `gitAfterReview`/`gitReviewFact` start from the last review.md commit (the verdict commit), so a code fix committed between the last round's record and the verdict passes `gate done` unreviewed; plan.md and the ledger Ruling claim the gate catches it — fixed
2. Should — Task 2's test expects `next` on a lane S review row, but its interface changes only `ready:` in rows.ts (`next` is set only at `intent`); setting `next` on every lane S stage breaks Task 3's dashboard assertion (`build, next: …`) — the interface must name the stages that get `next` — fixed
3. Should — `## Moving to lane S` runs `git add -- accord/tickets/<id>.md accord/tickets/<id>/`, which fails with "pathspec did not match" when the ticket has no folder yet, so nothing is committed and `accord drop` refuses on uncommitted changes — fixed
4. Should — A move to lane S loses the old ticket's `depends_on`, `tracker`, `priority`, `ui` and `design` (the hand-off carries only Understood and Done when, and step 3 of `## Dropping instead of renaming` is skipped); a lane S ticket can then be built before a ticket it depended on — fixed
5. Should — No lane S step replaces the template's placeholder title, so every lane S ticket shows `Short title in business language` on the dashboard and panel (ac-3) — fixed
6. Should — The CI workflow skips gating a ticket whose pull request changes only `accord/` and that has no `approved_hash`; a lane S ticket never has one, so a lane S pull request changing only `accord/config.yml` with no converged review goes green (packages/core/src/scaffold/workflow.ts:123-163, `.github/workflows/accord.yml`) — fixed

## Round 3 (diff)

1. Should — With the verdict committed apart, `gitReviewFact` still reads the files of the last commit touching review.md (the verdict commit) and `gitAfterReview` starts after the round commit, so code committed in the same commit as the last round's record is never checked; plan lines 168-172 and the ledger Ruling claim the gate catches it — open
2. Nice — The stage starts at the last commit touching review.md while `gate done` starts at the last `## Round` commit, so the dashboard can read done where the gate fails; the ledger Ruling "stage and gate read one fact" is no longer true — deferred
3. Nice — The Keys hand-off writes each key in place of the template's line, but the lane S template has no `design` line, so a moved ticket's design reference can be left out — deferred
