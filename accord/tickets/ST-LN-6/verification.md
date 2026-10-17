---
ticket: "ST-LN-6"
commit: "96223a26ac6c5214f82bd977cb78ee2cf8985932"
reviewed_on: "2026-10-17"
---

## @ac-1 accord show prints a ticket's full detail as text

Result: pass

Evidence: Exists: packages/cli/src/commands/show.ts:10-37 (text), packages/core/src/status/show.ts:34-64 (ticketDetail), test packages/cli/test/show.test.ts:14. Substantive: text() prints the title, Stage/Lane/Tasks/Branch/Holder/Blocked by (none when absent), Intent, then per criterion id+title, steps as stored with keyword, State, Test, Test result, Ticked, Verification (none when absent); the test asserts the whole output with an "And" step and a 66-char title and no "..." or "…". Wired: show registered in packages/cli/src/run.ts; I ran `node packages/cli/dist/cli.js show ST-LN-6` and saw this layout on the real ticket. Data flows: values come from the loaded snapshot (row, sections, scenarios, tests), not constants. Full suite `npx vitest run`: 63 files, 1263 tests passed.

## @ac-2 accord show --json gives the same detail as JSON

Result: pass

Evidence: packages/cli/src/commands/show.ts:41 writes JSON.stringify of the same TicketDetail object. packages/cli/test/show.test.ts:61 asserts toEqual with tasksDone/tasksTotal numbers, ticked boolean, steps as keyword-plus-text strings, holder null, blockedBy []. I ran `show ST-LN-6 --json` and saw the object with those fields. Same data path as ac-1, tests pass.

## @ac-3 A criterion's label is the first rule that matches, top down

Result: pass

Evidence: packages/core/src/status/show.ts:51-57 is the chain failing (testResult failed or verification fail), blocked, verified (ticked and fm.verified_hash === acHash of current scenarios, line 42, not ac_hash), passing, not run (test tag present, covers null and skipped), untested. JUnit failure and error are mapped to failed by the existing report loader; packages/core/test/show.test.ts:56-90 covers a ticked-but-failed criterion (failing), error case, skipped, no report file, no tests.report key (all tagged become not run or verified), and a stale hash that stops the tick binding. Wired through ticketDetail, exported from core index and used by the CLI. Test passes.

## @ac-4 Pressing a ticket row in the panel opens its detail view

Result: pass

Evidence: packages/core/panel/view.js:70-75 (withOpen) gives each lane row an open target and moves the action into it; packages/core/panel/register.js:173-185 draws the id as a plain Button with an underlined, bold, accent Text child and no other cell underlined, and no row button. Test packages/core/test/panel.test.ts:261-298 on the fake host: asserts only underlined Texts are the ids, pressing runs `show ST-1 --json` via process.run with command.run not called, detail shows all facts, buttons become Back and Continue, Continue submits `continue ST-1`, Back redraws the dashboard with no new process.run call. register.js was diffed and the committed .claude/accord-panel copies match (skills-sync test passes). Limit: proven on the fake host only; a real Claude Code pane was not run.

## @ac-5 The detail view wraps long text and never cuts it, while the table keeps its cuts

Result: pass

Evidence: packages/core/panel/register.js:117-137 passes title, steps and fact lines as single-string Text with wrap 'wrap'; view.js detailView only cleans control characters, never cuts. Test packages/core/test/panel.test.ts:533-556 asserts the title and step each appear as one whole Text child with wrap 'wrap', no "\n", "..." or "…" in any text, and after Back the dashboard row title Text has wrap 'truncate'. Test passes.
