---
ticket: "STALE-1"
commit: "cb39d50212904ba500c0bfa473ebd36f446c9678"
reviewed_on: "2026-10-13"
---

## @ac-1 A ticket untouched past the window shows its idle days

Result: pass

Evidence: Exists: test "ac-1 a ticket untouched past the window shows its idle days" in packages/cli/test/status.test.ts:264, a real repo with a commit dated 18d+1h back. Substantive: packages/cli/src/load/fs.ts gitFacts reads `git log --format=...%ct --name-only -- accord/tickets` and folds max committer time per ticket id (regex covers `<id>.md` and `<id>/`); packages/core/src/status/rows.ts:60,87 does floor((now-last)/86400) and sets idleDays when > stale_days (default 14). Wired: fs.ts:251 builds lastActivity, core/src/load/snapshot.ts:186 carries it, commands/status.ts:48 calls statusRows(snapshot, Date.now()/1000), render/table.ts:63 appends " idle <n>d" to the stage cell. Data flows: the test asserts JSON idleDays 18 and the text contains "build 1/2 idle 18d"; junit.xml at this commit shows it passed (0 failures in the report).

## @ac-2 A recent commit on the claim branch keeps the ticket active

Result: pass

Evidence: Exists: test "ac-2 a recent commit on the claim branch keeps the ticket active" in status.test.ts:279. Substantive: fs.ts gitClaims reads `%(committerdate:unix)` over refs/heads/t/ and refs/remotes/*/t/*, keeping the newest per id; fs.ts:252 merges it by max with the record activity. Wired: the same lastActivity path as @ac-1 reaches statusRows and the table. Data flows: the test checks both a local t/T-1 and a remote-tracking-only ref (refs/remotes/origin/t/T-1, local branch deleted); in each case the JSON row has no idleDays and the text has no "idle". It passed in junit.xml.

## @ac-3 The window comes from stale_days

Result: pass

Evidence: Exists: test "ac-3 the window comes from stale_days" in packages/core/test/lane-status.test.ts (uses stale_days "30" with a 18d ticket and a 31d ticket). Substantive: rows.ts:87 compares against Number(snapshot.config?.stale_days ?? '14'). Wired: the config reaches snapshot.config through loadSnapshot, which the test goes through. Data flows: the 18d ticket has no idleDays and the 31d one has idleDays 31, so the configured value, not a constant, decides. It passed in junit.xml.

## @ac-4 Finished and closed tickets are never idle

Result: pass

Evidence: Exists: test "ac-4 finished and closed tickets are never idle" in lane-status.test.ts:142, with done, dropped, and archived tickets at 100d plus a no-lane ticket (D-05). Substantive: rows.ts:61 sets `open` false for status dropped or archived and for stage done, and the idleDays spread at rows.ts:87 requires `open`; it sits inside the lane-only branch. Wired: statusRows is the single producer of rows for `accord status`. Data flows: the test asserts that all rows are listed and none has idleDays, with lastActivity set to 100d old for every ticket. It passed in junit.xml.

## @ac-5 The default window is 14 days and idle means older than it

Result: pass

Evidence: Exists: test "ac-5 the default window is 14 days and idle means older than it" in lane-status.test.ts:136. Substantive: rows.ts:87 uses strict `>` against the default '14'. Wired: same path as @ac-3, with no stale_days in the config. Data flows: the 14d ticket has no idleDays and the 15d ticket has idleDays 15. It passed in junit.xml (full suite, 0 failures).
