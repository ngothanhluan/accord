# Ledger

## Rulings
- Ruling: `accord show` with an id that names no ticket exits 2 with a message naming the id — the CLI's exit-code table gives 2 to usage errors, and the lane commands already throw `UsageError` "no ticket <id> in accord/tickets/" (`packages/cli/src/commands/lane-args.ts:18`) — cost if wrong: one exit code and message change.
- Ruling: the dashboard bug (a ticket only on its claim branch is invisible; the stage reads build before `plan: <id> ready`) stays its own bug ticket, not part of ST-LN-6 — the owner chose "Ticket bug riêng (Khuyên)" on 2026-10-16 — cost if wrong: `accord show` of a ticket only on its claim branch fails until that bug is fixed.
- Ruling: a row is pressed through a `plain` Button on its id cell — the host's Button takes only strings and `Text` as children and the row's columns are `Box` cells; `plain` draws the id with no `[ ]` around it, so the id column keeps its width — cost if wrong: the row layout is rebuilt around one Button.
- Ruling: `accord show` takes lane tickets only, through `requireLaneTicket`; EPICS rows and tickets without `lane:` get no id Button — the dashboard's YOURS, TEAM, READY and UP NEXT rows are lane tickets — cost if wrong: a 0.1.0 ticket has no detail view until `show` accepts it.
- Ruling: TEAM rows open the detail too, holding only Back, since a TEAM row offers no action today — cost if wrong: one press target fewer.
- Ruling: a failed `show` run shows its message with the Back button, and the detail state is kept apart from the loaded dashboard — otherwise a failure replaces the dashboard and Back has nothing to show — cost if wrong: one branch in view.js.
- Ruling: in the JSON, no holder is `null` and no blocking ticket is `[]`; the text prints `none` for both — cost if wrong: one field changes shape.
- Ruling: when a scenario carries more than one `@test` tag, the first is the one reported — cost if wrong: a list instead of a single value.
- Ruling: while a detail is open, `turn.complete` re-runs `show` for that ticket, so labels do not go stale after a turn — cost if wrong: one extra `npx` run per turn while the detail is open.
- Ruling: the id Button, and the detail's Continue and Pick up buttons, appear only for ids that pass the pane's `SAFE_ID` check, as row actions do today — cost if wrong: a ticket whose id fails that check cannot be opened from the pane.
- Ruling: Background steps are printed under every criterion, as the snapshot stores them — cost if wrong: the steps are split by origin.
- Ruling: second audit splits closed to match the code and D-08 — the step keyword as written (`load/gherkin.ts:23-33` stores it so), every fact line printed with `none` when absent, each step one JSON string, no blocking ticket `[]`, the tick compared with the hash of the criteria now (`gate/hash.ts:40`, as `status/rows.ts:77` does), `<error>` counted as failed (`load/junit.ts:36`), no `tests.report` treated as no report, the id the row's only press target — cost if wrong: one criterion line reworded; the owner approves the text as shown.
- Ruling: ST-LN-6's plan, build and review follow the workflow this session loaded, the accord skills and agents of `C:/Work/accord` on t/ST-LN-4 (the plan critique loop of `accord-plan/critique.md`, not yet on main), not the copies in this worktree — the session's agents come from that checkout and cannot be switched, so following main's skill text would pair it with ST-LN-4's critic and planner — cost if wrong: ST-LN-6 runs one unmerged loop early; its records still pass `gate plan`.
- Ruling: the id's colour is the theme key `suggestion`, the Approach's "accent colour" — the host's `ThemeKey` has no `accent` key — cost if wrong: one colour value.
- Ruling: a scenario with no `@ac-n` tag is still listed, with `id: null` — cost if wrong: one filter.
- Ruling: the text output starts with the line `<id> <title>` — cost if wrong: one line reworded.
- Ruling: while a detail is open, a turn re-runs both the dashboard and `show` — cost if wrong: one extra `npx` run per turn.
- Ruling: a `show` result for a detail that was closed or replaced is dropped — cost if wrong: one comparison.
- Ruling: the detail's Continue or Pick up button is worked out from the current dashboard state each time it draws, not stored when the detail opens — `turn.complete` already re-runs the dashboard, so the button follows it with no extra run — cost if wrong: one lookup in `register.js`.
- Ruling: the detail's message lines also take `wrap: 'wrap'` — plan round 1.1 asks for every detail `Text` — cost if wrong: one prop.
- Ruling: each brief gets a one-line header naming the worktree C:/Work/accord-sev and branch t/ST-LN-6 before the `accord brief` output — this session's cwd C:/Work/accord holds another ticket's branch, and an executor without the header would edit there — cost if wrong: none to the code; ST-LN-7 removes the need.
- Ruling: `accord show` throws a plain Error when `ticketDetail` returns undefined, a branch `requireLaneTicket` makes unreachable — a guard, not a user path — cost if wrong: an internal error message instead of exit 2 if that check ever changes.
- Ruling: `openDetail` calls `$.process.run` before it awaits the first redraw — the press runs `show` at once, and the test asserts the call right after the press — cost if wrong: swap two lines.
- Ruling: the detail view's message state (Loading, a failed run) also draws Back and the action button — Back must always be reachable — cost if wrong: one condition.
- Ruling: `register.js` adds `run.catch(() => {})` on the show promise — a run that rejects during the first redraw is not reported as unhandled, and the rejection is still handled when awaited — cost if wrong: one line.
- Ruling: `view.js` builds the newline in `detailView` as `String.fromCharCode(10)` — the executor reports `npm run gen` broke an escaped `'
'` literal there; the review should check whether the generator or the literal is at fault — cost if wrong: one odd-looking constant.

## Deferred
- plan round 1.4 (Nice): Tasks 3 and 4 disagree on what the Loading state draws; Task 4 should say "a failed-run message state".

## Tasks
- task 1 done c8e60485ddd2
- task 2 done 31f687fdf78f
- task 3 done 34962b5e49a0
