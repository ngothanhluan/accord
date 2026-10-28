# Debug: BUG-LN-14

## Episode 1

## Symptom
Two distinct failures at verify of PR #122, HEAD 1e62bcf (merge of origin/main a615632 into t/BUG-LN-14).

A. CI run 40703038694, all four ci / check jobs (ubuntu and windows, Node 22 and 24), one test each:
`packages/core/test/st-ln-44.test.ts > ac-4 every assertion of a changed row is in its new place or mapped by the row note`
```
AssertionError: expected [ Array(1) ] to deeply equal []
+   "#48 packages/cli/test/worktree.test.ts: expect(r2.err).toContain(taken);",
 ❯ test/st-ln-44.test.ts:431:20
```

B. Local full suite (`npx vitest run --reporter=default --reporter=junit ...`, started 21:08:45, 2057.98 s): the test of A plus 7 that passed on all four CI jobs:
- `packages/cli/test/lane-commands.test.ts > ac-1 task-done writes the tag of the scenario a verify entry proves`: `Error: Test timed out in 30000ms.`
- `packages/cli/test/workflow-script.test.ts > the emitted workflow script — executed >` six cases, e.g. `npx stub: --yes @accord-dev/accord@0.3.0 lint / no ticket file changed in this pull request - nothing to gate : expected +0 to be 1`; `expected 'npx stub: ...' to contain 'OLD-1: an approved or done ticket cannot be deleted before it is dropped'`; `--yes @accord-dev/accord@0.3.0 lint: expected 1 to be +0`; `expected '# Deliberately not -e: ...' not to be '# Deliberately not -e: ...'` (workflow-script.test.ts:614).

## Hypotheses
Failure A, ranked before any probe:
1. The st-ln-44 ac-4 test is a one-time ST-LN-44 check that reads the live text of worktree.test.ts and requires every assertion its baseline froze for row #48 to still be there; this ticket's task 4 (424fdff) replaced the frozen `expect(r2.err).toContain(taken);`, as D-05 and the Approach require, so the check fails: the test, not the product, is wrong once ST-LN-44 is done — for: the flagged text is the line 424fdff removed; the test's header says it is deleted once ST-LN-44 is done — against: none found.
2. BUG-LN-14 lost coverage of the ST-LN-7 ac-4 refusal — for: an assertion of an approved criterion test is gone — against: it is replaced by three stronger ones (folder, local-time form, not the raw ISO time) that D-05 asks for.
3. The merge 1e62bcf mis-resolved worktree.test.ts — for: the failure first shows on the merge — against: needs a probe.

Failure B, ranked before any probe:
1. The built `packages/core/dist` and `packages/cli/dist` are stale: built before the merge that brought BUG-LN-4's workflow-script changes from main; workflow-script.test.ts takes SCRIPT from `initFiles` of `@accord-dev/accord-core` (node_modules symlink to packages/core, `exports` to dist/index.js) and runs `packages/cli/dist/cli.js`, so it tests the old script against the new expectations — for: CI runs `npm run build` before `npm test` and passed on the same commit — against: needs a probe.
2. Low memory or host load made tests slow or flaky — for: 2058 s against the usual ~12 min; worktree.test.ts alone took 2055 s; lane-commands' case has a fixed 30 s timeout — against: wrong output text is not what load produces.
3. A Windows-only line-ending or bash difference — for: the `/^set \+e$/m` replace at workflow-script.test.ts:613 changed nothing, which a CRLF script would also cause — against: windows-latest CI passed.
4. BUG-LN-14's code breaks these tests — for: they fail on the ticket branch — against: needs a probe of the ticket diff.
5. The measurement itself is wrong: the local run was made on an unbuilt tree and an overloaded host (hypotheses 1 and 2 seen from the run's side).

## Probes
- `npx vitest run packages/core/test/st-ln-44.test.ts -t "ac-4 every assertion"` → fails locally with the same single problem `#48 packages/cli/test/worktree.test.ts: expect(r2.err).toContain(taken);` → A reproduced.
- Read packages/core/test/st-ln-44.test.ts:358-432 → ac-4 takes each changed row's old body from the frozen fixtures/st-ln-44/base-tests.json and the new body from the live file (`readFileSync(new URL(p.file, ROOT))`, :377); an old assertion missing from the new body fails unless maps.json maps it with a cite in table.md's row note; accord/tickets/ST-LN-44/table.md:124 is row #48, the ST-LN-7 ac-4 test, "Assertions: 199-217 stay" → A1's mechanism confirmed.
- `git diff 424fdff~1 424fdff -- packages/cli/test/worktree.test.ts` → the hunk at :258 removes `expect(r2.err).toContain(taken);` and adds `toContain(`in ${sib}, since `)`, a `toMatch` of the `YYYY-MM-DD HH:MM (UTC+hh:mm) - ` form, and `not.toContain(taken)` → for A1, against A2.
- `git diff --stat 1e62bcf^1 1e62bcf -- packages/cli/test/worktree.test.ts packages/core/test/` → the merge changed only stage-skills.test.ts; `git diff 1e62bcf^2 1e62bcf -- packages/cli/test/worktree.test.ts` → the only `expect` removed against main is the flagged one → A3 ruled out.
- Read accord/tickets/ST-LN-65.md → queued 2026-10-27 from ST-LN-44's final review: "once ST-LN-44 is done an unrelated ticket that only tidies one of those tests ... turns them red on main"; ST-LN-44 is verified (`verified: [ac-1, ac-2, ac-3, ac-4]`) and merged; accord/tickets/ST-LN-44/plan.md:41-42 leaves the deletion to a separate lane S ticket → A1 confirmed.
- `npx vitest run packages/cli/test/workflow-script.test.ts` on an idle host → the same 6 cases fail, 18 pass, 88 s → deterministic; B2 ruled out for these six.
- `ls -la packages/core/dist/index.js packages/cli/dist/cli.js` → both Oct 28 14:07; `git log -1 --format=%cd` → 1e62bcf at 21:07:57; the full run started 21:08:45 → no build between the merge and the run.
- `git merge-base --is-ancestor 56d7517 6e0688e` → exit 1; against 1e62bcf → exit 0 → BUG-LN-4's workflow change 56d7517 ("name the swap, the unreadable dropped reason and the failing listing") reached this branch only through the merge.
- `grep -c "cannot be deleted before it is dropped"` → packages/core/src/scaffold/workflow.ts 1, .github/workflows/accord.yml 1, packages/core/dist/index.js 0, packages/cli/dist/cli.js 0; `grep -c "set +e"` → workflow.ts has it (:86), dist/index.js 0 → the dist script lacks the deletion check and the `set +e` line the six cases assert → B1 confirmed; it also explains :614 (no `set +e` line for the regex to remove), so B3 ruled out.
- Read .github/workflows/ci.yml:23 → `npm run build` before `npm test`; .gitignore:2 ignores dist/ → why CI passed the six on the same commit.
- `git diff --stat 1e62bcf^2 1e62bcf` → the ticket touches only hook.ts, worktree.ts, proc.ts, worktree.test.ts and its ticket folder; no scaffold, workflow or lane-commands file → B4 ruled out.
- `npx vitest run packages/cli/test/lane-commands.test.ts -t "ac-1 task-done writes the tag"` → passes, 10.9 s file duration; lane-commands.test.ts:910 gives that case a fixed 30000 ms; in the full run lane-commands.test.ts took 586 s and worktree.test.ts 2055 s → the timeout is host load in an overloaded run (B2) for that one case; not this ticket.

## Fixes

- Fix 1 (4834556, from 14b4d87), the owner's decision on 2026-10-28, "Xóa test ngay trong BUG-LN-14" (delete the test right in BUG-LN-14): deleted packages/core/test/st-ln-44.test.ts, its helper packages/core/test/helpers/st-ln-44.ts and packages/core/test/fixtures/st-ln-44/. Red before: st-ln-44.test.ts "Tests 1 failed | 8 passed (9)", the #48 line. After: `npm run build` complete; `npx vitest run packages/core` "Test Files 53 passed (53); Tests 1045 passed (1045)"; `npx accord lint` "0 errors, 222 warnings". `tests.affected` over the changed (deleted) files finds no test file. Result: symptom A gone locally; CI's green is seen at the next verify. Failed fixes: 0.

## Root cause
Failure A (CI, all four jobs): packages/core/test/st-ln-44.test.ts:358-432, ST-LN-44's one-time ac-4 check, reads the live packages/cli/test/worktree.test.ts and requires every assertion frozen for row #48 (accord/tickets/ST-LN-44/table.md:124, "Assertions: 199-217 stay") to remain. BUG-LN-14 task 4 (424fdff) replaced `expect(r2.err).toContain(taken);` in that test with the local-time form that D-05 and the ticket's Approach require. The product change and its test are correct; the failing check is a guard that was meant to be deleted once ST-LN-44 was done (its header; ST-LN-44 plan.md:41-42), and ST-LN-65 is queued to delete it for exactly this failure mode.

Failure B (local only): the 6 workflow-script.test.ts cases failed because packages/core/dist and packages/cli/dist were built at 14:07, before the merge 1e62bcf (21:07) brought BUG-LN-4's workflow script from main; the run started at 21:08:45 with no `npm run build`, so the tests ran the old emitted script and old CLI against the new expectations (dist has 0 matches for "cannot be deleted before it is dropped" and "set +e"; the source has both). The lane-commands ac-1 timeout is host load: the case passes alone in about 10 s, and its fixed 30 s limit was exceeded in a run about 3 times slower than usual. None of the 7 is caused by BUG-LN-14's code.
