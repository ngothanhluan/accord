---
ticket: "BUG-LN-14"
commit: "44825680841ed86f227335b06d44115b2a2ca05e"
reviewed_on: "2026-10-28"
---

## @ac-1 A /clear releases the hold its old conversation took

Result: pass

Evidence: Exists: test `ac-1 a clear in a window outside the ticket worktree ...` at packages/cli/test/worktree.test.ts:2715-2733; release in packages/cli/src/commands/worktree.ts:221-234 (`releaseHolds`, inside `withHolds`). Substantive: it drops every hold whose pid and start equal the window's claude process and whose marker differs from the new one. Wired: registered hook `session-resume` for `resume|clear|compact` (packages/core/src/scaffold/hooks.ts:14) calls `releaseOnNewConversation` (packages/cli/src/commands/hook.ts:~62-76) on `source` clear or resume, before anything else runs. Data flows: the test runs the hook with `source: clear` on stdin and a stubbed process table. ST-9 vanishes from the holds file, ST-10 (DEAD) is untouched, and `worktree open ST-9 --continue` from session B exits 0 with `enter:` and a new hold by sess-B. `npx vitest run packages/cli/test/worktree.test.ts` gave 131 passed, 1 skipped, 0 failed. dist/cli.js contains the new strings.

## @ac-2 After a /clear the window may take one other ticket and holds only that one

Result: pass

Evidence: Exists: test at packages/cli/test/worktree.test.ts:2757-2773. Substantive and wired: the clear hook runs first (`clearOf`), then `worktree open ST-10` runs with the new conversation's env. Data flows: the claim exits 0, with no "held by another session" or "this session works" message. The holds file keys are exactly `['ST-10']` and its marker is sess-A2. The test passed in the full run.

## @ac-3 A hold whose conversation did not clear stays

Result: pass

Evidence: Exists: test at packages/cli/test/worktree.test.ts:2775-2796. Substantive: the release is keyed on the claude process pid and start, not the folder, so window B has a different pid from A's. Wired: it runs the real `hook session-start` and `hook session-resume` (source clear, cwd a subfolder of ST-9's worktree) as B. Data flows: the holds file stays byte-identical after both hooks. `worktree open ST-9 --continue` as B2 exits 2 with "ST-9 is held by another session" naming sess-A, and the hold's marker is still sess-A. The test passed.

## @ac-4 A refusal names the folder and the time of the hold

Result: pass

Evidence: Exists: test at packages/cli/test/worktree.test.ts:2839-2861, plus the `risk:parsing` test at 2863-2874 for a hold with no folder. Substantive: `takeHold` records `folder` (packages/cli/src/commands/worktree.ts:214-215, backslashes turned to `/`). `describeSession` and `localTime` (packages/cli/src/load/proc.ts:107-120) print the folder and local time with its UTC offset. Wired: `takeHold` throws `UsageError` with `describeSession(h)` (worktree.ts:211), which exits 2. Data flows: with TZ=Asia/Ho_Chi_Minh the real second-session run's stderr contains `in <sib>, since 2026-10-27 10:03 (UTC+07:00)` and no backslash. With TZ=America/Bogota it prints `2026-10-26 22:03 (UTC-05:00)`, so the time is computed from `taken`, not hard-coded. The test passed.

## @ac-5 A /clear in the held ticket's own worktree keeps the ticket for that window

Result: pass

Evidence: Exists: test at packages/cli/test/worktree.test.ts:2798-2818. Substantive: `releaseHolds` rewrites the `stay` hold's marker to the new conversation and drops the window's other holds (worktree.ts:227-229); `ticketOfWorktree` (hook.ts) supplies `stay` from the window's worktree. Wired: the hook is run from `${sib}/sub` as source clear. Data flows: afterwards the holds keys are exactly `['ST-9']`. ST-9 has marker sess-A2 with the same pid, start and taken, so the ST-10 hold is gone. The same window's `--continue` is accepted, and session B is refused with "held by another session" naming sess-A2. The test passed.

Notes: the run covered the whole worktree.test.ts file only; I did not run `tests.full`. A real /clear in a live Claude Code window was not exercised by me; the ledger records the owner's probe of 2026-10-28, which I took as a claim and did not check. The tests stub the process table, so the real process-table read is covered only by those ledger claims.
