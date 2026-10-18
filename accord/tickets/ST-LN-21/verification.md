---
ticket: "ST-LN-21"
commit: "c29ee9e213ce879104509a9131a8881cdc748f8a"
reviewed_on: "2026-10-18"
---

## @ac-1 The empty search field says what it is for

Result: pass

Evidence: Exists: packages/core/test/panel.test.ts "ac-1 the empty search field keeps its Search label and shows the dim hint" (diff at HEAD). Substantive: packages/core/panel/register.js:146-152 draws Input with label 'Search', the verbatim hint 'ticket id or title, or a new request', value: query (empty). Wired: the Input is drawn from the ui.render handler, and the test reaches it through session.start and the dashboard run in the test host, asserting label, value '' and the hint. Data flows: the hint reaches the host through the Input props the test reads (h.input()). The regenerated packages/core/src/generated/panel.ts and .claude/accord-panel/plugin/hooks/register.js carry the same change (diff main...HEAD). junit.xml line 1800: the test case passed, and the suite had 1290 tests, 0 failures.

## @ac-2 Text that matches no ticket says so and points to New request

Result: pass

Evidence: Exists: the test "ac-2 text that matches no ticket shows the no-match line and New request". Substantive: packages/core/panel/view.js:109-110 returns noMatch, the verbatim line, only when the query is non-blank and no section is left, and always returns newRequest when the query is non-blank. packages/core/panel/register.js:~156-157 draws noMatch as Text above the New request Button. Wired: the test types "zzz" and then "login" through h.type, which fires onInput and a redraw. It asserts no headings, rows or show: buttons, the verbatim line present, and the New request button present. After "login" it asserts only YOURS, only show:ST-1, New request still shown, and the line absent. Data flows: the query typed into the Input goes to view(state, query) and its output to the drawn nodes. junit.xml line 1804: passed.

## @ac-3 The cursor is in the search field when the panel opens

Result: pass

Evidence: Exists: the test "ac-3 the search field is the one control marked to take focus on every draw and while loading". Substantive: packages/core/panel/register.js:151 sets autoFocus: true on the search Input, and grep shows no other autoFocus in register.js. Line 85 is the only `focus: true`, on the explicit /accord-panel command.run. The session-start ui.open has no focus. Wired and data flows: the test scans every Box, Text, Button and Input node for autoFocus === true after the Loading… draw, the dashboard draw, a draw after typing plus a turn.complete refresh, and a draw after command.run. Each time the only marked node is Input 'search'. It also checks that the session-start open call has no focus property and that ui.open is not called again on a redraw. The draw under Loading… takes the state===undefined branch, which draws the Input. A failed run draws no Input, which the existing ST-LN-3 ac-3 test covers. junit.xml line 1802: passed. The clause that a redraw does not move focus depends on host behaviour that the test host cannot see, and ac-4 covers it.

## @ac-4 The owner reads the real panel as a place to search and to start a request

Result: pass

Evidence: Exists: .claude/accord-panel/plugin/hooks/register.js:148-153 draws the Input with label 'Search', placeholder 'ticket id or title, or a new request' and autoFocus: true; .claude/accord-panel/plugin/hooks/view.js:110-111 builds the no-match line and the New request button; register.js:165 draws the line. Substantive: these are the real props and strings, not stubs (read at c29ee9e). Wired and data flows: the owner ran Claude Code 2.1.302 in C:\Workccord-search with this branch's panel loaded by `claude --plugin-dir C:\Workccord-search\.claudeccord-panel\plugin` and the main-checkout panel disabled by a settings file (two earlier attempts showed the old panel, recognisable by the missing dim hint, so the final session ran this branch's code). The owner was shown four checks and all four held: (1) /accord-panel opens with the cursor in the Search field and the dim hint visible; (2) typing zzz shows "No ticket shown here matches. Press New request to send this text to /accord." and New request; (3) during a slow reply, after Ctrl+X and Tab into the pane and Tab to a ticket button, the cursor stayed on that button after the reply finished and the panel refreshed; (4) the field reads as a place to search tickets and to start a new request. The owner answered "ok dc rồi", then, asked to approve only if all four held, answered "duyệt". This is the owner's observation of the installed 2.1.302 host, which closes the gap the ticket's Approach recorded (props checked only against a copied declaration file).
