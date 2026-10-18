# Ledger

## Tasks
- task 1 done 81c368590136
- task 2 done 1adaa51d44b8

## Rulings

- Ruling: the intent interview runs in the worktree C:/Work/accord-ln5, with accord run from the build in C:/Work/accord (packages/cli/dist/cli.js) — another session holds C:/Work/accord on t/ST-LN-18 and the new worktree has no accord bin — cost if wrong: that build differs from 0.1.0 in a command this stage uses.
- Ruling: the acceptance criteria fix the new ask.md sentences verbatim, as ASK-1's did — D-04 proves done by text tests, and a fixed sentence is what the owner approves — cost if wrong: rewording a sentence later reopens the criteria.
- Ruling: the auditor's two readings are settled in the criteria's wording, not asked of the owner — every file is read with a line break and the spaces or tabs around it as one space (as the ASK-1 test does), the negative checks ignore letter case, and the intent step runs to the next numbered step — each picks the stricter reading and none changes what the owner decided — cost if wrong: a test stricter than needed fails on harmless wrapping.
- Ruling: origin/main (382a125, ST-LN-18 merged) is merged into t/ST-LN-5 before the approach — main changed the stage skills and stage-skills.test.ts since the claim, and the architect must read the code this ticket will merge onto — cost if wrong: none beyond a merge commit; a conflict would have shown here.
- Ruling: the approach critic's three Should findings are answered in `## Approach` before the owner's yes (negative checks normalise line breaks first; sync runs from this worktree's build; step 5 loses its option-ordering clause) and its two Nice findings are taken as written (a comment on the repointed test; strip `**` before matching step 5) — none touches a Decision — cost if wrong: none, each only narrows how the tests are written.
- Ruling: the D-08 re-plan keeps Task 1 at its number — no task has a ledger line, so no number exists to put a changed task after, and Task 1 stays the wiring task — cost if wrong: Task 1 becomes Task 3 and the wiring task runs after Task 2.
- Ruling: the D-08 re-plan also rewords Task 2's reason for dropping step 5's ordering clause to "ask.md already puts the recommended option first with one sentence on why (D-08)" — the old wording read as if the reason were dropped, and the Approach already says this — cost if wrong: none, it changes no test or file.
- Ruling: each executor brief file gets one line prepended naming the worktree C:/Work/accord-ln5 and forbidding commit trailers — `accord brief` names no working tree and the executor starts in C:/Work/accord, which another session holds on another branch — cost if wrong: none, the line only restates where the plan already says to run.

## Deferred
- plan re-plan round 1, Nice: the plan preamble cites packages/core/src/load/junit.ts:16 for the whole `<file>#<name>` id shape; the `#` join is at :40. The four verify ids are already correct.
