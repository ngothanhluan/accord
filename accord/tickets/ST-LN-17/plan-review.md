# Plan review

## Round 1 (whole)
1. Must — in lane M a `## Return from verify <sha>` marker is confirmed only from a committed verification.md, which the verify skill leaves uncommitted until gate done passes (verify/SKILL.md:53); a verify failure through failure.md, or a hand-made commit after the review verdict before verify, can never start cycle 2, so AC-1's second cycle is unreachable and the Task 3 test covers only a committed verification.md — fixed
2. Must — the skills ask `accord round` only before a round, never before writing the verdict, so a round 3 Should that is fixed and followed by `verdict: converged` (review step 7-8, lane S step 4) never prints the stop, the Approach or the change-of-course question; AC-3 and D-02 are reached only as a gate done failure at verify step 6 — fixed
3. Should — after the owner picks a change of course at a review stop, no record form lets review resume: a re-plan writes no acceptance, allowance or new cycle, so the first `accord round` after the rebuild prints the same stop again — fixed
4. Should — Task 5 adds a fifth accord hook command, but packages/cli/test/skills-sync.test.ts:541 and :559 expect exactly 4, and the task keeps that file off `files:` and calls it untouched — fixed
5. Should — Task 6 grows plan/SKILL.md (5111 of 5120 bytes) by about 62 bytes and review/SKILL.md by about 250, against the 5120-byte cap (packages/core/test/skills.test.ts:188), with no byte budget and no cut that keeps every point (owner rule: shortening never loses or changes a point) — fixed
6. Should — Task 6's new review SKILL.md step 8 drops `verdict: converged` and `verdict: accepted-by-owner`, which packages/core/test/stage-skills.test.ts:28 requires in that file — fixed
7. Should — the plan cites ledger Rulings by file line number, while the ticket's Approach and the ledger's own cross-references count them in order (the n-th Ruling), so the plan's "Ruling 32" (compliance) is the Approach's Ruling 29 and an executor reads the wrong Ruling — fixed
8. Nice — Task 5 test 2 builds `tool_name: 'Bash'` with `input(o)`, which spreads into `tool_input`, so that case sends `Agent` and is denied — deferred
9. Nice — Task 6's record.md test asserts only `` `open` ``, which the current record.md already holds; it should assert the new sentence — deferred

## Round 2 (whole)
fixed: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
1. Must — the Task 5 hook acts only when progressOf gives stage review; in a lane M second cycle with no verification.md the after-verify window starts at the round commit, so the stage reads verify and a sonnet fix executor passes although fixModel says opus (D-03); accord anchor also prints verify mid-cycle (stage.ts:93-99, fs.ts:374-381) — fixed
2. Should — gate done passes a lane M ticket whose last cycle has rounds but no verdict, since gate.review-unconverged reads cycle 1's verdict (work.ts:54-67, 160-162) and lane M has no gate.review-trailing row; Task 4 checks the last cycle only for unallowed rounds and the stop — fixed
3. Should — Task 5's edit to packages/core/test/hooks.test.ts:15 expects the foreign `{ matcher: 'Bash', hooks: [] }` PreToolUse entry kept, but mergeHooks drops an entry with no hooks left (scaffold/hooks.ts:43-44), so the test fails and the task forbids changing mergeHooks — fixed
4. Should — an allowance of n rounds turns off the round-3 stop for all n rounds (allowed(p) is checked before the stop), and the change-of-course Ruling always writes n = 5, so a Must inside the allowance never stops or asks D-02's question (AC-3) — fixed
5. Should — scripts/compliance.mjs:44-47 reads the written round number and dedupes on id#n, so a sticky-tier miss in cycle 2 (numbered from 1) is never reported, and Task 7 leaves the tier-up rule alone; the Intent's "no tier-up miss" measure cannot see a D-01 miss — fixed
6. Nice — at the plan cap with a clean round 5, the refusal says "write the verdict", a form plan critique never writes — deferred
7. Nice — the pre-tool-use hook runs a full checkout preflight before reading tool_name; light mode would answer non-executor dispatches faster — deferred
8. Nice — lane-s.md keeps "the next round is one after the last ## Round <n>" beside "the rounds after it count from 1" — deferred

## Round 3 (whole)
fixed: 2.1, 2.2, 2.3, 2.4, 2.5
1. Should — plan critique has no way out of the loop after an owner acceptance: critique.md:61-64 (pinned by stage-skills.test.ts:362) still ends the loop only with no Must or Should open, the accepted findings stay open, and the step 6 refusal "append a ## Closed line" read with "On refused:, fix what it names" starts a fresh 5-round cycle on a plan the owner accepted — fixed
2. Should — the plan limits tier-up, fixModel, the hook, the Approach in the stop and the open-cycle check to "lane M", while progressOf (stage.ts:82) sends lanes L and P down the lane M path; read literally, a lane L story gets no tier-up, no hook check and no open-cycle check — fixed
3. Should — the hook judges against the latest recorded round, so a correct opus dispatch for round 4's findings made before round 4 is written is denied with "dispatch again with model sonnet", and the session re-dispatches on the wrong model; the deny reason should say to write and commit the round first — fixed
## Round 4 (diff)
fixed: 3.1, 3.2, 3.3
1. Nice — only fixModel has a lane L or P test; checkFixDispatch's lane guard, the Approach in nextRound's stop and the open-cycle gate done check have none, so a `lane === 'M'` guard in the hook would pass every test — deferred
## Closed
