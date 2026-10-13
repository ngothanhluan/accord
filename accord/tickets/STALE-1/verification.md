---
ticket: "STALE-1"
commit: "a82ac736644ea4bb7b519cd0597109f5fe5670fe"
reviewed_on: "2026-10-13"
---

## @ac-1 A ticket untouched past the window shows its idle days

Result: pass

Evidence: Exists: `packages/cli/test/status.test.ts` "ac-1 a ticket untouched past the window shows its idle days" builds a real repo and commits at now minus 18 days 1 hour. Substantive: `packages/core/src/status/rows.ts` line 60 computes `floor((now - last) / 86400)` and line 87 sets `idleDays` when it exceeds `Number(stale_days ?? '14')`. `packages/cli/src/render/table.ts` line 63 appends ` idle <n>d` to the stage cell. Wired: `commands/status.ts` line 48 calls `statusRows(ctx.snapshot, Math.floor(Date.now()/1000))`. `loadFromFs` in `cli/src/load/fs.ts` passes `lastActivity` (line 278) into `loadSnapshot` (`core/src/load/snapshot.ts` line 186), and `statusRows` reads it from the snapshot. Data flows: `gitFacts` reads committer time (`%ct`) from `git log --name-only -- accord/tickets` and folds by max per ticket id, covering `<id>.md` and `<id>/`. The test asserts the JSON row `idleDays: 18` and the text `build 1/2 idle 18d`. JUnit `node_modules/.cache/accord/junit.xml` shows the testcase present with 0 failures.

## @ac-2 A recent commit on the claim branch keeps the ticket active

Result: pass

Evidence: Exists: the `status.test.ts` "ac-2" test creates `t/T-1` with a commit 2 days 1 hour old, then re-checks with only `refs/remotes/origin/t/T-1` after deleting the local branch. Substantive: `gitClaims` in `fs.ts` lines 130-147 reads `%(committerdate:unix)` for `refs/heads/t/` and `refs/remotes/*/t/*` and keeps the newest per id. `fs.ts` lines 251-252 merge it with record activity by max. Wired: `loadFromFs` passes the merged map as `lastActivity` into `statusRows`. Data flows: the test asserts the JSON row has no `idleDays` property and the text output has no "idle", for both the local-branch and remote-tracking cases. JUnit shows the testcase passed.

## @ac-3 The window comes from stale_days

Result: pass

Evidence: Exists: `packages/core/test/lane-status.test.ts` "ac-3 the window comes from stale_days" (config `stale_days: "30"`, T-1 18 days idle, T-2 31 days). Substantive: `rows.ts` line 87 reads `snapshot.config?.stale_days`. `config.schema.json` line 77 allows `stale_days` as a digit string, and `core/src/model/snapshot.ts` line 149 types it. Wired: the config comes from `loadSnapshot` over `accord/config.yml`, the same path `status` uses. Data flows: the test asserts T-1 has no `idleDays` and T-2 has `idleDays` 31, so the config value changes the outcome. JUnit shows the testcase passed. The test is core-level with `lastActivity` and `now` given, as the ticket's Tests section specifies.

## @ac-4 Finished and closed tickets are never idle

Result: pass

Evidence: Exists: `lane-status.test.ts` "ac-4 finished and closed tickets are never idle" builds T-DONE (stage done), T-DROP (status dropped), T-ARCH (status archived) and a lane-less T-FREE, all 100 days old. Substantive: `rows.ts` line 61 defines `open` as not dropped, not archived, and stage not done, and line 87 requires `open`. The lane-only guard on line 78 covers D-05. Wired: `statusRows` returns every ticket, and `commands/status.ts` line 50 shows dropped and archived rows only with `--all`, so the three rows are listed. Data flows: the test asserts all ids are returned, T-DONE has stage done, and no row has `idleDays`. JUnit shows the testcase passed. The `--all` listing itself is not exercised in a CLI test for this scenario. I verified it by reading the filter.

## @ac-5 The default window is 14 days and idle means older than it

Result: pass

Evidence: Exists: `lane-status.test.ts` "ac-5 the default window is 14 days and idle means older than it" (no `stale_days`, T-1 14 days plus an hour, T-2 15 days plus an hour). Substantive: `rows.ts` line 87 uses `Number(stale_days ?? '14')` with a strict `>`, and the floor on line 60 turns 14d1h into 14, so it is not idle. Wired: same `statusRows` path as ac-1. Data flows: the test asserts T-1 has no `idleDays` and T-2 has `idleDays` 15. JUnit shows the testcase passed. The full suite (54 files, 1144 tests) passed per the orchestrator, and the JUnit report has 0 `<failure` entries.
