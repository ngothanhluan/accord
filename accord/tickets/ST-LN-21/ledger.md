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

## Deferred
