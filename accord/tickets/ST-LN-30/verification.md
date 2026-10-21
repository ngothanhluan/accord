---
ticket: "ST-LN-30"
commit: "9febb6a779b4056bd5a1fec5e6b1b4240608c058"
reviewed_on: "2026-10-21"
---

## @ac-1 A new ticket branch starts at the remote's latest default branch

Result: pass

Evidence: Exists: test `ac-1 pick up and a new worktree ticket cut the ticket branch ...` at packages/cli/test/worktree.test.ts:1356-1375 covers both Examples rows. Substantive: `fetchOrigin` at packages/cli/src/commands/worktree.ts:462-473 runs a prompt-off `git fetch origin` and reloads the snapshot. Wired: `worktreeOpen` calls it at worktree.ts:363, before any ref is read; `newTicket` calls it at packages/cli/src/commands/new-ticket.ts:25 when `--worktree` is set. Data flows: the test pushes a commit from a second clone, runs both commands, and asserts `t/ST-9^` equals that tip. The full-suite JUnit report (node_modules/.cache/accord/junit.xml) has this case with no failure and no skip.

## @ac-2 Continue says when the ticket branch is behind the default branch

Result: pass

Evidence: Exists: test at packages/cli/test/worktree.test.ts:1388-1410. Substantive and wired: `worktreeOpen` fetches (worktree.ts:363), then at worktree.ts:377-384 counts `rev-list --count tip..default`. It prints `behind: ... N commits behind <short>; merge them with git merge <short>`, where `<short>` comes from `gitDefaultRef` and is not hard-coded. Nothing is written to the branch. Data flows: the test pushes 2 unfetched commits and expects the exact line "t/ST-9 is 2 commits behind origin/main; merge them with git merge origin/main". It asserts the branch and worktree HEAD are unchanged and the status is clean. JUnit shows the test passed.

## @ac-3 Verify runs on the ticket merged with the latest default branch

Result: pass

Evidence: Exists: test at packages/cli/test/worktree.test.ts:1437-1461, plus the `risk:regression` order test at packages/core/test/stage-skills.test.ts:444-451. Substantive: `worktreeMerge` at worktree.ts:477-523 fetches, then runs `git merge --no-ff --no-edit` against the full ref. It refuses unless the stage is verify (worktree.ts:488-491). Wired: the command is registered in packages/cli/src/run.ts:231. The verify skill step 2 (the `verify/SKILL.md` text embedded in packages/core/src/generated/skills.ts:19) runs `accord worktree merge <id>` after the commit and before `tests.full` and before the verifier. Data flows: the test asserts HEAD^1 is the old head, HEAD^2 is the pushed tip, and the commit has exactly 2 parents. It also asserts no rebase in the reflog, and that a second merge is a no-op. JUnit shows it passed. "Suite and verification run on the merge commit" rests on the order of the skill text, which the stage-skills test holds; the session's behaviour is not testable in-process.

## @ac-4 A merge conflict leaves the branch as it was and stops verify

Result: pass

Evidence: Exists: test at packages/cli/test/worktree.test.ts:1463 onward. Substantive: the catch branch at worktree.ts:512-519 lists the unmerged files, runs `merge --abort` when MERGE_HEAD exists, and throws a `UsageError` naming the file. The run layer maps that to exit 2. Nothing is written to mark verify as blocked. Wired: same entry point as ac-3. Data flows: the test loops twice. Each pass expects code 2, "conflict" and "shared.txt" in stderr, HEAD unchanged, and a clean status, so the second attempt retries the merge. JUnit shows it passed.

## @ac-5 A failed fetch is reported and the work goes on

Result: pass

Evidence: Exists: test at packages/cli/test/worktree.test.ts:1654 onward. It covers pick up, new ticket, continue and merge against a missing remote, and a hung remote under a mocked 2 s limit. Substantive: `fetchOrigin` catches the failure and prints one accord line. For ETIMEDOUT the line is "no answer within N seconds"; otherwise it quotes git's first stderr line (worktree.ts:468-469). The limit is 30 s in packages/cli/src/commands/fetch-limit.ts, passed as the `execFileSync` timeout in `gitNoPrompt` (worktree.ts:450-456). Wired: the same helper is used by `worktreeOpen`, `newTicket` and `worktreeMerge` (worktree.ts:493). Data flows: the test asserts exactly one fetch line with the fixed prefix, no `fatal:` line, exit 0, and the branch still cut from the existing ref. For the hang it asserts the line equals "... no answer within 2 seconds" and the call returns in under 15 s. JUnit shows it passed (38.6 s). The real 30 s limit is not exercised, only the mocked one. The test is not run on Windows here, and the ticket's Windows stale-ref-lock risk is not checked.

Full suite: node_modules/.cache/accord/junit.xml has 0 failures. I did not re-run the suite. My own re-run of the two touched test files was still running when I wrote this; the JUnit report is the evidence.
