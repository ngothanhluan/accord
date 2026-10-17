---
ticket: "ST-LN-18"
commit: "29796f9406aedc2811600878a93a8b5860a14775"
reviewed_on: "2026-10-18"
---

## @ac-1 UP NEXT lists the backlog and the blocked tickets while the viewer holds work

Result: pass

Evidence: Exists: packages/cli/test/dashboard.test.ts:199 builds ST-AN-9 (claimed), ST-AN-1, ST-AN-2 (depends_on ST-AN-1) and asserts rows, blockedBy, the UP NEXT block and the last line "[Continue ST-AN-9]  [Pick up ST-AN-1]  [New request]". Substantive: packages/core/src/status/dashboard.ts:128-135 builds upNext on every run, with the early-return gate removed. Wired: packages/cli/src/render/dashboard.ts:60-62 prints block('UP NEXT', d.upNext) and builds the action line. Data flows: `npx vitest run` on dashboard.test.ts and panel.test.ts gave 36 passed. A live `node packages/cli/dist/cli.js dashboard --json` in this repo, where yours holds 3 rows, returned the keys yours, team, ready, upNext, epics, summary with 12 upNext rows.

## @ac-2 UP NEXT leaves out the READY tickets and caps the rest at 20

Result: pass

Evidence: Exists: packages/cli/test/dashboard.test.ts:215. It uses a ready ST-AN-50 plus 22 draft tickets and asserts ready=[ST-AN-50], upNext length 20, more 2, ST-AN-50 absent, "  +2 more" below the heading, and "[Pick up ST-AN-50]" in the last line. Substantive: packages/core/src/status/dashboard.ts:129 filters out `readyAll` (not only the 20 shown), and line 135 slices at READY_CAP with a `more` count. Wired: the same renderer path as @ac-1, with `pick = ready.rows[0] ?? upNext.suggest` at packages/cli/src/render/dashboard.ts:61. Data flows: the test passes in the vitest run (36 passed). The risk test at line 242 covers a ready ticket past the ready cap.

## @ac-3 UP NEXT is present when nothing is left to pick up

Result: pass

Evidence: Exists: packages/cli/test/dashboard.test.ts:230 asserts upNext toEqual {rows: [], more: 0}, "  none" under the heading, and no "[Pick up" in the text. Substantive and wired: packages/core/src/status/dashboard.ts:135 always returns the key, with `suggest` spread only when an unblocked ticket exists. Data flows: the rows come from the real snapshot filter, not a constant. The test passes in the vitest run.

## @ac-4 The panel shows UP NEXT while the viewer holds work

Result: pass

Evidence: Exists: packages/core/test/panel.test.ts:643 feeds a dashboard JSON with yours=ST-AN-9 and upNext=ST-AN-1, ST-AN-2, and asserts the rendered order YOURS, ST-AN-9, UP NEXT, ST-AN-1, ST-AN-2. Substantive and wired: packages/core/panel/view.js renders the upNext key whenever it is present (the ticket cites line 90). The CLI now always emits the key, as the live --json run showed. Data flows: the host harness feeds the stdout JSON through the panel's real view code. The test passes in the vitest run. The panel needs no code change, as the Approach says. I did not run it in a real Claude Code pane.
