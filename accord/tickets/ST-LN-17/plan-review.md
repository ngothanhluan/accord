# Plan review

## Round 1 (whole)
1. Must — in lane M a `## Return from verify <sha>` marker is confirmed only from a committed verification.md, which the verify skill leaves uncommitted until gate done passes (verify/SKILL.md:53); a verify failure through failure.md, or a hand-made commit after the review verdict before verify, can never start cycle 2, so AC-1's second cycle is unreachable and the Task 3 test covers only a committed verification.md — open
2. Must — the skills ask `accord round` only before a round, never before writing the verdict, so a round 3 Should that is fixed and followed by `verdict: converged` (review step 7-8, lane S step 4) never prints the stop, the Approach or the change-of-course question; AC-3 and D-02 are reached only as a gate done failure at verify step 6 — open
3. Should — after the owner picks a change of course at a review stop, no record form lets review resume: a re-plan writes no acceptance, allowance or new cycle, so the first `accord round` after the rebuild prints the same stop again — open
4. Should — Task 5 adds a fifth accord hook command, but packages/cli/test/skills-sync.test.ts:541 and :559 expect exactly 4, and the task keeps that file off `files:` and calls it untouched — open
5. Should — Task 6 grows plan/SKILL.md (5111 of 5120 bytes) by about 62 bytes and review/SKILL.md by about 250, against the 5120-byte cap (packages/core/test/skills.test.ts:188), with no byte budget and no cut that keeps every point (owner rule: shortening never loses or changes a point) — open
6. Should — Task 6's new review SKILL.md step 8 drops `verdict: converged` and `verdict: accepted-by-owner`, which packages/core/test/stage-skills.test.ts:28 requires in that file — open
7. Should — the plan cites ledger Rulings by file line number, while the ticket's Approach and the ledger's own cross-references count them in order (the n-th Ruling), so the plan's "Ruling 32" (compliance) is the Approach's Ruling 29 and an executor reads the wrong Ruling — open
8. Nice — Task 5 test 2 builds `tool_name: 'Bash'` with `input(o)`, which spreads into `tool_input`, so that case sends `Agent` and is denied — deferred
9. Nice — Task 6's record.md test asserts only `` `open` ``, which the current record.md already holds; it should assert the new sentence — deferred
