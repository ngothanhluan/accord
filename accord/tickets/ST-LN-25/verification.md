---
ticket: "ST-LN-25"
commit: "9d180e7cdeb711e7496255788237a38ab0b79c15"
reviewed_on: "2026-10-23"
---

## @ac-1 A newer accord release is announced, and the registry is asked at most once in 24 hours

Result: pass

Evidence: Exists: packages/cli/test/hook.test.ts:188 runs both Examples (`hook session-start`, `dashboard`). Substantive: the test asserts exactly one ` is out` line on the second run, `requestLatest` called once with `@accord-dev/accord`, and the agent-say line after the hook notice; packages/cli/src/commands/notice.ts:18 `upgradeNotice` holds the cache and version compare. Wired: packages/cli/src/commands/dashboard.ts:12 and packages/cli/src/run.ts:322 (hook) call `upgradeNotice(ctx.snapshot.config?.accord)`. Data flows: the pin comes from the loaded config and the answer from `requestLatest` in packages/cli/src/commands/registry.ts:7; the test fakes only the clock and the registry call. The JUnit report node_modules/.cache/accord/junit.xml lists this test with no failure.

## @ac-2 An unreachable registry is never seen and never waited on for long

Result: pass

Evidence: Exists: packages/cli/test/hook.test.ts:214. Substantive: it runs the real `requestLatest` against a stubbed `fetch` that never answers. It asserts the abort reason is TimeoutError, the elapsed time is 2900 ms or more and under 6000 ms, both runs exit 0 with identical output and no ` is out`, and `fetch` is called once across two runs. Wired: packages/cli/src/commands/registry.ts:11 uses `AbortSignal.timeout(REGISTRY_MS)`, reached through notice.ts and run.ts:322. Data flows: the failed request is cached as the check, so the second run sends nothing. The JUnit report shows the test passed.

## @ac-3 Upgrading moves every pin on a pushed branch and leaves the checkout alone

Result: pass

Evidence: Exists: packages/cli/test/upgrade.test.ts:19; the command is in packages/cli/src/commands/upgrade.ts, registered at packages/cli/src/run.ts:221. Substantive: the test uses a real bare remote and pins config.yml, the workflow and the settings.json hooks to 0.0.9 on origin's main, with an unfetched later commit. After `accord upgrade`, the remote branch `upgrade/<v>` has the base commit as its parent and exactly one commit on top of it. All three files carry the running version. No `0.0.9` remains in the workflow, and every hook command matches `npx --yes <name>@<v> hook ...`. A following `skills sync` leaves a clean status, so the skill files match what the running version writes. The checkout's HEAD, branch, status, a dirty scratch file and the index are unchanged, and no `.claude` directory appears. Wired: the command is reachable as `accord upgrade` through run.ts. Data flows: the test reads the pushed content back from a fresh clone. The JUnit report shows the test passed.

## @ac-4 Continue merges the latest main into a ticket branch that is behind

Result: pass

Evidence: Exists: packages/cli/test/worktree.test.ts:2041. Substantive: with an unfetched origin main two commits ahead, `worktree open ST-9 --continue` gives a merge commit with HEAD^1 equal to the previous head, HEAD^2 equal to the origin main tip, and exactly two parents. The reflog has no rebase. The remote ticket branch equals the new HEAD, and setup.log reads `merged ci`, so setup ran on the merge. A second scenario shows a failing setup exits 2 and removes the setup marker. A `risk:data-loss` test right after covers a conflict (aborted, file named, no MERGE_HEAD) and dirty or held worktrees. Wired: packages/cli/src/commands/worktree.ts:385 and :394 call `continueMerge` (defined at :499) when `--continue` is given. Data flows: the real fetched sha and git state are asserted. The JUnit report shows the test passed.

## @ac-5 Any /accord command removes a done and merged ticket's worktree and branches

Result: pass

Evidence: Exists: packages/cli/test/worktree.test.ts:2349 loops over all four Examples (`worktree clean`, `open`, `open --continue`, `new ticket --worktree`). Substantive: ST-9 is made done on origin's main by a squash merge that is not fetched, with the local branch tip equal to the verified commit. Each command removes ST-9's worktree and deletes the local and origin branches, and the output lines `removed`, `deleted t/ST-9` and `deleted origin/t/ST-9` are asserted, along with the directory and both refs being gone. A companion risk:complex-branching test shows the ticket being opened is never cleaned. Wired: packages/cli/src/commands/worktree.ts:677 `worktreeClean` takes the `fetched` and `skip` options, and worktree.ts:704 calls it from the open path. packages/cli/src/run.ts:232 handles `worktree clean`. Data flows: the done check reads the ticket file at origin's main (per D-08). The JUnit report shows the test passed.
