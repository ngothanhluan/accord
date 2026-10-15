---
ticket: "ST-LN-2"
commit: "35f4bde119ddd1355540d33d4abc6de589d4fcb9"
reviewed_on: "2026-10-15"
---

## @ac-1 Ready tickets are ranked by inherited priority, then by id

Result: pass

Evidence: Exists: packages/cli/test/dashboard.test.ts:135-163 builds the five tickets, runs approve and gate ready, then `dashboard --json`, then `lint --json` with `priority: urgent`. Substantive: packages/core/src/status/dashboard.ts:69-94 computes inherited priority with a visited-set walk, and :98-99 ranks by priority, unblocked, then id. packages/core/schemas/ticket.schema.json:39 holds the enum. Wired: packages/cli/src/run.ts:213-217 calls dashboardCommand, which calls core `dashboard`. Data flows: `npx vitest run packages/cli/test/dashboard.test.ts` passed 13 of 13. The test asserts ready = ST-AN-1, ST-AN-4, ST-AN-3 and that lint exits 1 with a `schema.*` finding at /priority.

## @ac-2 Rows carry titles and sections carry column headers

Result: pass

Evidence: Exists: packages/cli/test/dashboard.test.ts:40-60 is a CLI-level test. Substantive: packages/core/src/status/rows.ts:25 and :84 set `title` on lane rows only (D-07). Wired: the test reads `status --json` and the `dashboard` text, and both come from the real command. Data flows: the test asserts the status row title is "Password reset", the READY line after the header names id and title, and the next line holds ST-AN-1 and "Password reset". It passed. I also ran `node packages/cli/dist/cli.js dashboard` and saw the `id  title ...` header row followed by the data row.

## @ac-3 UP NEXT shows the viewer what to pick up when nothing is ready

Result: pass

Evidence: Exists: packages/cli/test/dashboard.test.ts:179-192. Substantive: packages/core/src/status/dashboard.ts:143-148 builds UP NEXT only when YOURS and READY are empty, ranks the unclaimed open tickets, and suggests the first unblocked one. Wired: the same `dashboard()` runs behind the CLI, and the JSON key order is checked at :286. :227-248 confirms a case-insensitive viewer match and a claimed ticket on the CLI path. Data flows: the core test asserts ready is empty, upNext rows are ST-AN-1 then ST-AN-2, and suggest is {pick-up, ST-AN-1}. Once the viewer claims ST-AN-1, `upNext` is absent and the text has no "UP NEXT" line. It passed. The AC's scenario step "dashboard --json runs" is exercised at core level here, and its CLI wiring is covered by the :227 and :276 tests.

## @ac-4 Sections are capped on a large backlog

Result: pass

Evidence: Exists: packages/cli/test/dashboard.test.ts:62-82. Substantive: packages/core/src/status/dashboard.ts:36-38 sets the caps and :96-102 applies them. Done tickets are excluded by `isOpen` at :42. Wired: `renderDashboard` is imported from packages/cli/src/render/dashboard.js and used by the command at packages/cli/src/commands/dashboard.ts:11. Data flows: the test builds 3 own, 12 team, 4 done and 25 ready tickets. It asserts yours 3/0, team 10/2, ready 20/5, no done rows, summary 15, 25, 0 and 4, "+2 more" under TEAM, "+5 more" under READY, and exactly one summary line. It passed.

## @ac-5 Epics show their children done over all their children

Result: pass

Evidence: Exists: packages/cli/test/dashboard.test.ts:250-274. Substantive: packages/core/src/status/dashboard.ts:105-115 groups children by `parent`, leaves dropped children out of both counts, and skips archived epics. Wired: the section is part of `dashboard()` output, the JSON key `epics` is always present (:286-288), and the text omits the section when empty. Data flows: the test asserts `epics` equals one row for EP-AN-1 with done 3 and total 7, the text row contains "3/7 done", and EP-AN-2 and ST-AN-20 do not appear. It passed.
