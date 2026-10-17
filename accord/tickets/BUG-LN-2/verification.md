---
ticket: "BUG-LN-2"
commit: "8b0f2fd69f98e3cdd221544643bcc07f54325f40"
reviewed_on: "2026-10-17"
---

## @ac-1 A ticket whose file exists only on its claim branch shows at the stage that branch holds

Result: pass

Evidence: Exists: test `ac-1 a ticket filed only on its pushed claim branch shows at that branch stage without a fetch` at packages/cli/test/status.test.ts:311, matching the @test tag. Substantive and wired: `loadClaimView` at packages/cli/src/load/fs.ts:446-529 reads the five records from the claim ref with one `git cat-file --batch` and sets `GIT_NO_LAZY_FETCH`. packages/cli/src/run.ts:54-55 builds the snapshot from `parts.view` in `claims` mode. The ref-listing code has no fetch call (fs.ts:552 documents "No fetch"). Data flows: I ran `npx vitest run test/status.test.ts test/dashboard.test.ts test/show.test.ts` in packages/cli, which gave 44 of 44 passing. `tsx packages/cli/src/index.ts dashboard` on this repo lists claimed tickets from other branches (ST-LN-5, ST-LN-7) with their stage.

## @ac-2 The claim branch's copy wins over an older copy on the current branch

Result: pass

Evidence: Exists: test `ac-2 the claim branch copy wins over an older checkout copy` at packages/cli/test/status.test.ts:360. Substantive: `loadClaimView` overlays files from the claim ref over the checkout, and skips refs merged into HEAD (the `for-each-ref --merged` call) and the current branch's own ticket. Wired: run.ts:54-56 passes the overlaid view to the rows and keeps the plain checkout only for `isDone` (D-04). The test passed in the run above.

## @ac-3 A plan that has not reached its ready commit is still at stage plan

Result: pass

Evidence: Exists: test `ac-3 a plan reaches build only after its ready commit and while clean` at packages/cli/test/status.test.ts:460. Substantive: packages/core/src/status/stage.ts:24 requires `facts[id].clean && subject === \`plan: ${id} ready\``, and stage.ts:53 holds a ticket at plan when a host supplies facts that do not meet it. Wired and data flows: packages/cli/src/load/fs.ts:407-421 builds `planFacts` from the last commit subject plus git porcelain status for the working tree. fs.ts:504-521 builds them from the claim ref's commits for an overlaid ticket, so the working tree is never consulted there. The test passed. Live check: this ticket reads `verify` on the dashboard, which means the ready commit `6e29f70 plan: BUG-LN-2 ready` was recognised.

## @ac-4 A ticket whose intent is not written yet points to the intent interview

Result: pass

Evidence: Exists: test `ac-4 an unwritten intent points anchor and dashboard to the intent interview` at packages/cli/test/dashboard.test.ts:319. Substantive: packages/core/src/status/stage.ts:39 returns "the intent interview (accord-intent)" unless Intent is written and a non-placeholder scenario exists, in which case it returns "the owner approves the ticket (accord approve)". Wired and data flows: the live `accord dashboard` output on this repo shows `intent, next: the intent interview (accord-intent)` for ST-LN-7 and ST-LN-5, so the `next` field reaches the output. The test passed.
