# Ledger

## Tasks

## Rulings

- Ruling: every new piece of panel text is English — repository artifacts stay English and the panel already reads "Search", "New request" and "none" — cost if wrong: the criteria text is rewritten before approval.
- Ruling: the search and the new request stay in one field, as ST-LN-3 D-05 set — the owner chose the four parts over the option that split the field — cost if wrong: none, a split would be its own ticket.
- Ruling: the auditor's three split readings are settled in the criteria's wording, each by the platform's or today's behaviour, and shown to the owner at the yes — ac-1: the label stays "Search", which the terminal draws as "Search: "; ac-2: with a query, a section with no match drops its heading, as ST-LN-3 built it; ac-3: focus is set once when the pane opens, as the platform's autoFocus does — cost if wrong: the owner rewords a criterion at the yes.
- Ruling: the no-match text is built in view.js next to `newRequest` — the New request label already lives there and view() is the pure layer — cost if wrong: one string moves to register.js.
- Ruling: the no-match line is plain text below the Input and above the New request button — ac-2 fixes neither colour nor order — cost if wrong: one prop or one line moves.
- Ruling: the Input is drawn under "Loading…" too — the approach critic showed /accord-panel opened before the first dashboard run ends takes the keyboard with no Input, so the cursor misses the field — cost if wrong: the field shows before data, and typing filters nothing until the dashboard loads.
- Ruling: the session-start open keeps no `focus` — taking focus there would take keys from the prompt the owner is typing in — cost if wrong: at session start the cursor reaches the field only after Ctrl+X Tab or a click.
- Ruling: the re-audit's four split readings are settled in the wording and shown to the owner at the yes — ac-1: the hint is the field's own dim hint drawn by the host; ac-2: New request stays shown while some ticket matches, as ST-LN-3 built it; ac-3: the cursor lands in the field whenever the pane takes the keyboard, which rules out marking only the first draw; ac-4: the redraw is checked while a running reply finishes with the pane focused, since sending a message leaves the pane — cost if wrong: the owner rewords a criterion at the yes.
- Ruling: while loading, the search Input is drawn above the "Loading…" line, where it sits on the dashboard — so the field does not jump when the dashboard arrives — cost if wrong: two lines swap in register.js.
- Ruling: the dim-hint text lives in register.js next to `label: 'Search'`, and the no-match line in view.js next to `newRequest` — each sits beside the text it belongs with — cost if wrong: one string moves to the other file.
- Ruling: the plan-review 1.1 fix also waits for `h.inflight()` before settling in step 3, not only step 4 — the turn.complete refresh can still be inside the previous run's `$.ui.invalidate` with `running` set, so the same `runs.shift()` throw at panel.test.ts:47 can happen there — cost if wrong: one redundant wait line.
- Ruling: step 4 of the ac-3 test settles a board with ST-4 "Logbook" and waits for it, not twoRows — only a row never drawn before proves the step 4 run drew, and "Logbook" matches the query `log` still set — cost if wrong: one fixture line.

## Deferred
- Plan review 1.2 (Nice): the test may read `h.input()?.placeholder` directly; the deferral-word rule scans only plan task lines (packages/core/src/gate/plan.ts:13, :193-207), so the string-built prop name in Task 1 is not needed.
