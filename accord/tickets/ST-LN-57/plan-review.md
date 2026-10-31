# Plan review

## Round 1 (whole)

Three critics in fresh contexts, lenses `criteria`, `build` and `security` (the ticket migrates the review record format).

1. Must — D-10's "the ticket is done there" skip does not reach Task 8's `fixFileUnexplained`: it has no guard for `skipped`, a facts error or a version 2 record, so a pull request for T-2 that touches done ticket T-1's file runs `gate done T-1`, which names every code file of T-2 as an unexplained fix file of T-1's last round and fails CI; no test covers the "done there" skip with a non-empty walk (Task 8 lines 699-705, Task 6 D-10 test lines 565-568) — fixed
2. Should — a version 1 ticket in flight at the cut-over fails CI once on main: on main's first-parent chain review.md is added by the merge M_T, so R_1 = M_T and its pin is 0.3.1, version 1 is refused, `withDefaultRef` is applied only to unversioned-with-round or version 2 records so "done there" never fires, and converting fails because no branch head is below M_T's first parent; fix: apply `withDefaultRef` to every record with a round, follow the parent that has review.md when the adding commit is a merge whose first parent lacks it, and add a real-git `risk:` test — fixed
3. Should — the pin at R_1 is read from the ticket branch, so one commit that sets `accord: "0.3.0"` while rewriting the record as `Round record: 1` and a later commit that restores the pin turns ac-2 to ac-5 off for that ticket with no net config change in the pull request; fix: read the pin from a commit the branch cannot rewrite (for example the merge base with the default ref, else the plan's `baseline:`), or refuse a pin at R_1 lower than the one the branch started from, and add a `risk:security` test — fixed
4. Should — the release that ships this ticket breaks the tests: the CLI pin check is exact equality, so `CONFIG` in `test/helpers/lane.ts:11` becomes `0.3.1`, after which every real-git fixture with a committed version 1 or unversioned round (`samples.ts:230` `REVIEWED`, round.test.ts, lane-s.test.ts, lane-flow.test.ts, git-count golden) gets `gate.review-scope`, and the plan's own tests asserting pin `0.3.0` from `CONFIG` (Tasks 3, 4, 6) fail; fix: the new tests commit an explicit `accord: "0.3.0"` at R_1 and never assert `CONFIG`'s pin, and the existing fixtures are pinned the same way or moved to version 2, or a Ruling names that work for the release — fixed
5. Should — the Risks' "only ever looser" for git versions that list a path on a clean merge does not hold: under Task 5 rule 4 and Task 7 the author's git and CI's git disagree both ways (mark asked locally, refused as "remove the mark" on CI, and the reverse); fix: refuse `(added code round 1)` only when the span holds no merge and no episode commit, adjust test (b), and correct the wording or add a `risk:` test for both behaviours — fixed
6. Should — Task 9's skill text drops `--base <the noted sha>` for re-reviews and the `Review base:` sentence, which version 1 tickets still in flight rely on, so their re-reviews read the whole ticket again; fix: `record.md` keeps both for a version 1 record — fixed
7. Should — Task 4 test 1 expects `ranges[0]` to hold exactly F1, O and E1, but by the Terms (line 83) and Task 7 a range also holds the records-only R1 between C1 and F1, so a correct `roundFactsFor` fails the verify test; fix: add `R1 commit ['accord/tickets/T-1/review.md']` — fixed
8. Nice — rolling back to the 0.3.0 CLI also needs an owner allowance Ruling per cycle that went past round 3 with deferred findings, since 0.3.0 has no D-08 — deferred
9. Nice — Task 4 does not say what a failing `cat-file --batch-check` returns — deferred
10. Nice — `gitIsShallow` returns false on a git error, so the shallow check fails open — deferred
11. Nice — Task 9's `git restore -- <path>` can discard uncommitted edits to a file the sync rewrites — deferred
12. Nice — the Terms do not say whether an episode's end commit is among its commits when it is a record commit — deferred
13. Nice — "except the first such round of its cycle" in the added-code Ruling reads two ways; only one matches Task 5's tests — deferred
14. Nice — Task 4 tests 3 and 4 leave out sandbox facts their assertions depend on (a committed version 2 round; a code commit before R1) — deferred
15. Nice — an unresolved head empties every range, so gate done floods `gate.finding-evidence` and "remove the mark" errors — deferred
16. Nice — Task 4 does not say whether `readHistory` returning `{ error }` fails gate done for a version 1 record whose pin allows version 1 — deferred

## Round 2 (whole)

One critic in a fresh context, no lens. fixed: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7.

1. Should — the cut-over literal `0.3.1` must equal the release that ships this ticket, not only be at least it: if a 0.3.1 release ships other tickets first and `CONFIG` becomes `0.3.1`, every existing fixture with a version 1 round committed under `CONFIG` gets `gate.review-scope` after this branch merges main, and an in-flight ticket whose first round was committed under 0.3.1 with old skill text is refused; fix: a Ruling that the cut-over is the shipping release, a pre-build check that `packages/cli/package.json` is still `0.3.0`, and the release Ruling moves `RECORD_V2_FROM` and the `record.md` literal when a release ships first — fixed
2. Should — only `record.md` keeps version 1 text; Task 9's `lane-s.md` step 4 says only `Round record: 2` and `## Round <n> head <sha>`, so an in-flight lane S ticket with a version 1 record that merges main sets line 1 to version 2, its old `## Round 1` heading becomes unreadable, and `accord round` gives no allowed head to retype; fix: `lane-s.md` step 4 gets the same version 1 sentence, asserted by Task 9's test — fixed
3. Should — the 1.2 fix follows any merged-in side that adds `review.md`, so a branch begun after the cut-over can commit a `Round record: 1` review.md on a side branch cut from an old 0.3.0 main commit and merge it: R_1 and the base pin both read 0.3.0 and ac-2 to ac-5 are off; fix: follow a merge's other parent only when it is not a walk commit (already on the default branch), with a `risk:security` sandbox in Task 3 — fixed
4. Nice — the added-code Ruling's "a record that passes on the git that asks the mark passes on every git" holds for `gate.review-scope` but not for Task 7's evidence count — deferred

## Round 3 (diff)

One critic in a fresh context, mode diff. fixed: 2.1, 2.2, 2.3.

1. Should — the new preamble check (plan.md:31) stops every task when `packages/cli/package.json` is not `0.3.0`, and the cut-over Ruling's merge step (plan.md:171-172) never moves that `0.3.0` and names only code literals that may not exist yet; if 0.3.1 ships after Task 4 is built, the session merges main and edits the literals, and Tasks 5 to 9 still stop; fix: compare with the release the Ruling names, and list every place the merge step moves (plan.md:31, Terms:116, Task 3:419, Task 9:877/915, Task 5's message) — fixed
2. Nice — Task 5's refusal message hard-codes `from accord 0.3.1` (plan.md:597) and the earlier Ruling (plan.md:141) still says "at least `0.3.1`" — fixed

## Round 4 (diff)

One critic in a fresh context, mode diff, a round the owner allowed. fixed: 3.1, 3.2.

1. Should — the shipping-release Ruling's merge step has the session edit plan.md (preamble, Terms, two Rulings, Task 3 and Task 9 text) mid-build: the next `accord task-done` fails on the stale `plan_hash` (packages/core/src/gate/task.ts:20), build rule 7 forbids clearing it with `accord gate plan` outside `accord-plan`, and changing Task 3's text after its ledger line breaks the re-plan rule; fix: (a) the merge step leaves plan.md alone, writes a ledger Ruling naming the release and the next version, and edits only the code places plus gen, build and sync, with the preamble check reading the latest such Ruling; or (b) the Ruling routes the plan edit through `accord-plan`'s re-plan — open
