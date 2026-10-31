---
ticket: "ST-LN-55"
commit: "3139d1f9db688de1d44af5fc48d1a61f1d54a3cc"
reviewed_on: "2026-10-31"
---

## @ac-1 Clean removes a done ticket's worktree completely, and keeps and names one that holds a file it may not delete

Result: pass

Evidence: Exists: the test `ac-1 clean removes a done ticket worktree completely and keeps and names one holding an ignored env file` is at packages/cli/test/worktree-clean.test.ts:674-695, and its title matches the ticket's @test slug. Substantive: it builds two done tickets with real links, `node_modules`, `dist`, `.DS_Store` and `Thumbs.db`, and puts an ignored `.env` in the second. It asserts the first folder is gone with a `removed <path>` line, and the second is still listed by `git worktree list`, byte-identical (`listing` before and after), with a `kept <path>: .env` line and no `removed` line for it. The code is `removeWorktree` (packages/cli/src/commands/worktree.ts:963-995), which deletes leftovers through `sweepRemoved` and prints `removed` only when nothing is left. The defaults are `DEFAULT_DISPOSABLE = ['node_modules','dist','.DS_Store','Thumbs.db']` (packages/cli/src/commands/leftover.ts:5), read from `config.disposable` (worktree.ts:868, 978; schema packages/core/schemas/config.schema.json:118). Wired: the test calls `runCli worktree clean`, which reaches `removeWorktree`. Data flows: the `.env` name and the folder come from the real git worktree listing and the file scan, not constants. The container run in node_modules/.cache/accord/junit.xml (HEAD 3139d1f9) lists this test with no failure or skip, and the file has 54 tests, 0 failures, 1 skipped (not this one). The Windows side was not run by me; it runs in CI on PR #146.

## @ac-2 The next session start cleans a done ticket's worktree and branches, unless a live session holds it

Result: pass

Evidence: Exists: the test `ac-2 a session start resume or clear cleans a done ticket worktree and branches and keeps one a live session holds` is at packages/cli/test/worktree-clean.test.ts:579-606. Substantive: it loops over startup, resume and clear, each with a done ST-9 (dead hold) and a done ST-10 (live hold), and runs `hook session-start` or `hook session-resume` with stdin JSON. It asserts the ST-9 folder is gone, its local branch and its origin branch are gone, its hold entry is gone, `removed <folder>` is in the output, and `tell the owner the lines above` comes after it. It also asserts ST-10's folder is still on disk and still listed by git, with `kept ... held by another session`. Wired: `hook.ts` line 52 calls `sessionClean` (packages/cli/src/commands/hook.ts:61), which calls `cleanQuietly` with a time budget (hook.ts:88-91). `compact` is excluded (hook.ts:63), and a risk test covers that. The hook entries register `timeout: 600` on both events (packages/core/src/scaffold/hooks.ts:15-16), and `.claude/settings.json` also carries `timeout: 600`. Data flows: the real `worktree clean` pipeline fetches from a bare origin, and the hold file is read from disk. The junit.xml entry at line 1228 has no failure or skip.

## @ac-3 A session start cleans a done ticket's recorded worktree that git has forgotten

Result: pass

Evidence: Exists: the test `ac-3 a session start in a worktree and a clear in the main checkout delete the recorded folder of a done ticket that git forgot` is at packages/cli/test/worktree-clean.test.ts:793-817. Substantive: it creates worktrees with `worktree open` and asserts the record file lists all three (`recorded(c)`, line 796). It makes git forget ST-9 and puts empty folders and a link in the folder, then runs a session start from inside the ST-10 worktree. It asserts the folder is gone, `removed <path>` is printed, the main checkout's `accord/config.yml` is untouched (the link target was not followed), and the record no longer lists ST-9 while it still lists ST-10. It repeats this for ST-11 with a clear in the main checkout. The code is `recordWorktree` (worktree.ts:224-256, written under `<git-common-dir>/accord/worktrees`) and `sweepForgotten` (worktree.ts:1162, which deletes only links and empty folders). Risk test lines 819-843 shows a forgotten folder holding a modified `dist/index.js` is kept unchanged and named. Wired: the hook path is the same `sessionClean`. Data flows: the recorded paths come from the real creation commands. The junit.xml entry at line 1248 has no failure or skip.

Not checked: Windows (CI on PR #146), and the full suite beyond reading the junit.xml lines for these three tests and the file totals.
