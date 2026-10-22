# Review: ST-LN-31

## Round 1

Should 1 [patch]: the accord skill's Rules still say "A lane never drops" with no exception for the drop at intent (D-03) — packages/core/skills/accord/SKILL.md:87-88 — fixed in 8c32d45
Should 2 [patch]: the worktree.md `stop:` exception lets the main session write only Understood and Done when, not the title and carried keys lane-s.md Start writes, nor their commit and push — packages/core/skills/accord/worktree.md:33 — fixed in 8c32d45
Should 3 [patch]: lane S step 6 runs gate done, whose suite rule needs the test report, but no step runs tests.full where tests.affected does not write it — packages/core/skills/accord/lane-s.md:36-37 — fixed in 8c32d45
Should 4 [patch]: an approved lane M ticket edited in place to lane S, its lane M records deleted, passes CI's lane S gate done with no approval, plan or verify; CI now fails when BASE is approved or lane M/L/P and HEAD is lane S — packages/core/src/scaffold/workflow.ts — fixed in 8c32d45
Should 5 [patch]: the move to lane S loses the interview's Vetoes, Decisions and Corrections once the claim branch is cleaned; they are now carried verbatim (owner: "A") — packages/core/skills/accord/ids.md:61-74 — fixed in 6cfb5e2
Nice 6 [patch]: `new ticket --type epic --lane S` is refused with a message naming only M — packages/cli/src/commands/new-ticket.ts:91 — deferred
Nice 7 [patch]: `accord status` and `accord show` print a lane S build ticket as `build 0/0` — packages/cli/src/render/table.ts:62 — deferred
Nice 8 [patch]: lane S gate done calls reviewCommit twice; the forDone IIFE could be a helper — packages/cli/src/load/fs.ts — deferred
Nice 9 [patch]: LANE_S_REQUIRED is a Record of three identical entries — packages/core/src/lint/ticket.ts — deferred
Nice 10 [patch]: the ac-5 test also asserts the D-11 fork-point text — packages/core/test/lane-s.test.ts:131-135 — deferred
Nice 11 [patch]: the plan skill lost "The owner does not need to read the plan." — packages/core/skills/plan/SKILL.md:9-10 — deferred
Nice 12 [patch]: lane-s.md and the intent skill leave the default branch, branch and files placeholders unresolved — packages/core/skills/accord/lane-s.md — deferred
Nice 13 [patch]: the hand-off carries no ticket type, says "each Keys: line" for one line, and ids.md's header still names only `people` — packages/core/skills/accord/ids.md — deferred
Nice 14 [patch]: lane S review records define no per-finding status nor Nice handling — packages/core/skills/accord/lane-s.md:42-46 — deferred
Nice 15 [patch]: the VERDICT regex now lets "Ready when" and "Done when" prose pass — packages/core/test/skills.test.ts:407 — deferred
Nice 16 [patch]: a request worded as a drop hand-off is taken as lane S without checks — packages/core/skills/accord/SKILL.md:75-76 — deferred
Nice 17 [patch]: the move-to-S hand-off drops the parent key — packages/core/skills/accord/ids.md — deferred

## Round 2

Should 1 [patch]: the lane S row added to the lane templates it.each makes a test id with no scenario, no risk: and no baseline entry, so gate done fails gate.test-untraced — packages/core/test/templates.test.ts:152 — fixed in a885c85

verdict: converged
