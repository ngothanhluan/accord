---
ticket: "ST-LN-81"
commit: "a21819468daa97ea8e813b6e3a3e9745dc64d76e"
reviewed_on: "2026-11-02"
---

## @ac-1 A logged absence claim that its own search contradicts fails the check

Result: pass

Evidence: Exists: packages/cli/test/scout-check.test.ts:12 holds the named test; the judging is packages/core/src/scout/check.ts (Absent loop near the end of `scoutCheck`). Substantive: each row's regex runs line by line over tracked files covered by its folders, minus allowed hits and the ticket's own files, and a hit pushes a failure naming the claim and `path:line`. Wired: `scout check` is registered at packages/cli/src/run.ts:237-243, calls `scoutCheckCommand` (packages/cli/src/commands/scout.ts), which returns 1 on any failure. Data flows: the test commits a fixture repo, adds an untracked file, and asserts exit 1, the claim text and `packages/cli/src/commands/init.ts:2` in the output, the untracked scratch file absent, and exit 0 once the hit is allowed. I ran `npx vitest run packages/cli/test/scout-check.test.ts` here: passes; the supplied JUnit report also shows it passed with 0 failures overall.

## @ac-2 A citation that does not resolve fails the check

Result: pass

Evidence: Exists: packages/cli/test/scout-check.test.ts:40. Substantive: the citation loop in packages/core/src/scout/check.ts compares the path exactly against the tracked set and counts lines of the tracked file. A line past the end or an untracked path pushes "citation ... does not resolve". Wired: same `scout check` entry as ac-1, exit 1 on failures. Data flows: the test cites `scope.ts:9999` (3-line file) and an untracked `missing.ts:3`. It asserts both are named with their reasons, "2 failures", and that the valid `scope.ts:1` is not flagged. The test passed in my run and in the JUnit report.

## @ac-3 The check computes the lane lift conditions from the report file list

Result: pass

Evidence: Exists: packages/cli/test/scout-check.test.ts:135. Substantive: `laneOf` in packages/core/src/scout/check.ts drops test files and generated or rendered copies and cuts areas to four segments. It reads each sensitive match's line from `configLists`, and lifts for more than 5 files or any sensitive match. Wired: `scoutLines` in packages/cli/src/commands/scout.ts prints the numbers, and `judge` passes `accord/config.yml` text and the rendered path list. Data flows: the 8-file fixture yields "expected files: 6", "code areas: 2", the sensitive line with `accord/config.yml:15`, and "lifts to lane M: more than 5 expected files; a listed sensitive area". The test passed in my run.

## @ac-4 A lane M ticket is approved only with a scout report that passes the check or says why it was skipped

Result: pass

Evidence: Exists: packages/cli/test/lane-commands.test.ts:66. Substantive: `scoutRefusal` in packages/cli/src/commands/scout.ts returns a refusal for a missing report. A report that fails with no `skipped:` line also gets a refusal. It judges at `lastCommitOf` via `commitFacts`, or on the working tree when `hasLocalChanges`. Wired: packages/cli/src/commands/approve.ts calls it for lane M before `writeKey` and returns 1 without writing. Data flows: the test covers six cases. No report gives exit 1 and the ticket unchanged. A failing committed report gives exit 1 naming the commit. A `skipped:` line gives exit 0. A report that passed at its commit but not on today's tree is approved (D-03). The same report with an uncommitted change is judged on the working tree and refused. `scout check` gives the same verdict. The test passed in my run (`-t "ac-4 a lane M"`) and in the JUnit report.

Full suite per the JUnit report: 0 `<failure>` elements. Not checked by me: the skill text and README edits beyond the tests that cover them (packages/core/test/scout-text.test.ts passed in the JUnit report).
