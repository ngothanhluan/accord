---
baseline: a9b6094ec87cf13f49d69f77ee5a8d115f48bfcd
plan_hash: "fnv1a64:9d923556b436190c"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, and the ticket.

Rules for every task:
- Test ids: every test named on a `verify:` line is a top-level `it(...)` with no `describe` around it. Its report
  id is the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`. No test
  title holds `@` or a comma.
- CLI tests import core from `packages/core/dist`: after changing anything under `packages/core/`, run
  `npm run build -w packages/core` before running any CLI test. Run one file with `npx vitest run <path>`. End
  every task with `npm run build`, `npm run lint` and `npm run typecheck`, then the test files the task names.
- Files are LF with no BOM. No new dependency. Optional JSON fields are omitted, never set to `undefined`.
- The panel is not edited: `packages/core/panel/view.js`, `packages/core/src/generated/panel.ts` and
  `.claude/accord-panel/plugin/hooks/view.js` stay byte-identical (Approach, rejected option).
- `accord/tickets/ST-LN-2.md` is not edited: its AC hash would change and drop it out of done.

Definitions (from the ticket's Decisions, its Approach and the ledger's Rulings):
- An open work ticket is a status row with `lane` set, `type` not `epic`, `status` neither `archived` nor
  `dropped`, and `stage` not `done` (`isOpen` in `packages/core/src/status/dashboard.ts`; `status: draft` is open,
  D-06).
- UP NEXT holds the open work tickets with no claim that are not in `nextRows(open)` (every ready ticket, not only
  the 20 READY shows), ranked by the existing `section` rank (effective priority, unblocked before blocked, then
  id), capped at 20 rows with `more` the count left out. `suggest` is `{ action: 'pick-up', id }` of the first
  unblocked ticket of that ranked list before the cap, and is omitted when none is unblocked.

## Task 1: Wiring: UP NEXT is built and printed on every run, without the ready tickets
covers: @ac-1, @ac-2, @ac-3, D-01, D-02, D-03, D-04, D-06
files: packages/core/src/status/dashboard.ts, packages/cli/src/render/dashboard.ts, packages/cli/test/dashboard.test.ts
verify: packages/cli/test/dashboard.test.ts#ac-1-up-next-lists-the-backlog-and-the-blocked-tickets-while-the-viewer-holds-work (@ac-1), packages/cli/test/dashboard.test.ts#ac-2-up-next-leaves-out-the-ready-tickets-and-caps-the-rest-at-20 (@ac-2), packages/cli/test/dashboard.test.ts#ac-3-up-next-is-present-when-nothing-is-left-to-pick-up (@ac-3), packages/cli/test/dashboard.test.ts#risk:complex-branching-a-ready-ticket-past-the-ready-cap-is-not-in-up-next

Test helpers already in `packages/cli/test/dashboard.test.ts` (module level): `Files`, `P(id)`, `ready(files, id,
opts?)` (approved with `ac_hash`, so it passes `gate ready` with no task done), `building`, `done(files, id,
opts?)` (stage `done`), `board(files, claims = {}, viewer = 'an@example.com')` returning `dashboard(...)`,
`summaryLine(text)`, and `laneTicket(id, { frontmatter })` from `../../../test/helpers/lane.js` (a `status:` line
in `frontmatter` replaces the default `status: open`; a ticket built by `laneTicket` alone is not approved, so its
stage is `intent`). Every case below is in memory: `files` starts as `{ 'accord/config.yml': CONFIG }`, `d =
board(files, claims)`, `j = JSON.parse(JSON.stringify(d))` stands for `accord dashboard --json` and `text =
renderDashboard(d)` for `accord dashboard` (the command prints exactly these). `lastLine` is the last non-empty
line of `text`.

Tests first, each a new top-level `it` in `packages/cli/test/dashboard.test.ts`:
- `it('ac-1 up next lists the backlog and the blocked tickets while the viewer holds work')`:
  `laneTicket('ST-AN-9')`; `laneTicket('ST-AN-1', { frontmatter: ['status: draft'] })`; `laneTicket('ST-AN-2', {
  frontmatter: ['status: draft', 'depends_on: ["ST-AN-1"]'] })`; claims `{ 'ST-AN-9': 'an@example.com' }`. The
  ids of `j.yours.rows` are `['ST-AN-9']`; the ids of `j.upNext.rows` are exactly `['ST-AN-1', 'ST-AN-2']`, and
  `j.upNext.rows[1].blockedBy` equals `['ST-AN-1']`. With `lines = text.split('\n')` and `u =
  lines.indexOf('UP NEXT')`, `u` is at least 0 and among the lines from `u` up to the next `''` some line starts with
  `  ST-AN-1` and some line starts with `  ST-AN-2` (not a count of lines containing `ST-AN-1`: the ST-AN-2 row
  also prints `ST-AN-1` in its `blocked by` column). `lastLine` is `-> [Continue ST-AN-9]  [Pick up ST-AN-1]  [New request]`.
- `it('ac-2 up next leaves out the ready tickets and caps the rest at 20')`: `laneTicket('ST-AN-9')` claimed by
  `an@example.com`; `ready(files, 'ST-AN-50')`, unclaimed; `laneTicket('ST-BO-' + i, { frontmatter: ['status:
  draft'] })` for `i` 1 to 22, unclaimed. The ids of `j.ready.rows` are `['ST-AN-50']`; `j.upNext.rows` has 20
  rows and `j.upNext.more` is 2; no `j.upNext.rows` id is `ST-AN-50`. In `lines = text.split('\n')`, the index of
  `'  +2 more'` is greater than `lines.indexOf('UP NEXT')`, which is at least 0; `lastLine` contains
  `[Pick up ST-AN-50]`.
- `it('ac-3 up next is present when nothing is left to pick up')`: `laneTicket('ST-AN-9')` claimed by
  `an@example.com`; `done(files, 'ST-AN-1')` and `done(files, 'ST-AN-2')`. `j.upNext` equals `{ rows: [], more: 0
  }`. With `u = lines.indexOf('UP NEXT')`, `u` is at least 0 and `lines[u + 1]` is `'  none'`; no line of `text`
  contains `[Pick up`.
- `it('risk:complex-branching a ready ticket past the ready cap is not in up next')` (ledger Ruling: UP NEXT leaves
  out every ready ticket, not only the 20 READY shows): `laneTicket('ST-AN-9')` claimed by `an@example.com`;
  `ready(files, 'ST-CY-' + i)` for `i` 1 to 21; `laneTicket('ST-BO-1')`, unclaimed. `[d.ready.rows.length,
  d.ready.more]` is `[20, 1]`; the ids of `d.upNext.rows` are exactly `['ST-BO-1']` and `d.upNext.more` is 0.

Existing cases that move with the change (Approach, Affected), nothing else in them changes:
- `ac-3 up next shows the viewer what to pick up when nothing is ready` (ST-LN-2's @ac-3, keeps its title): delete
  its last three lines, the `d2` board with `'ST-AN-1': 'an@example.com'` and its two assertions that `upNext` is
  absent and no line is `UP NEXT`. The `d` half stays; `d.upNext?.` may become `d.upNext.`.
- `risk:complex-branching the viewer comes from git user.email without case and an empty one exits 2`:
  `expect(j).not.toHaveProperty('upNext')` becomes `expect(j).toHaveProperty('upNext')`.
- The hand-built `Dashboard` in `risk:security a title cannot inject control characters or overflow its cell`,
  and the first one (`a`, no `upNext` today) in `risk:complex-branching the action line names only the actions
  that apply`, each gain `upNext: empty` so they typecheck; their assertions stay. `a`'s action line stays
  `-> [Continue ST-AN-1]  [Pick up ST-AN-2]  [New request]`, since `empty` has no `suggest`.

Interface:
- `packages/core/src/status/dashboard.ts`: `Dashboard.upNext` becomes required, `upNext: DashboardSection & {
  suggest?: { action: 'pick-up'; id: string } }` (D-04, ledger Ruling). `dashboard()` keeps its signature and
  builds `upNext` on every call as the preamble defines it, from `unclaimed.filter((r) => !readyAll.includes(r))`;
  the `if (yours.rows.length === 0 && ready.rows.length === 0)` gate at line 144 and its second return go, and
  one result literal is built with the keys in the order `yours, team, ready, upNext, epics, summary`. The cap
  reuses the value 20 (`READY_CAP`, or a new `UP_NEXT_CAP = 20`).
- `packages/cli/src/render/dashboard.ts`: `renderDashboard` always pushes `block('UP NEXT', d.upNext)` after
  READY, which prints `  none` when it has no row; `pick` reads `d.ready.rows[0]?.id ?? d.upNext.suggest?.id`.
  The action line logic is otherwise unchanged (D-01(C) needs no other code).

Must not change: the rank, the caps of YOURS, TEAM, READY and EPICS, every summary count (`backlog` and
`blocked` included); `upNext.suggest` taken from the uncapped list; `nextRows`; the section order and the
text layout of every other section; every other case in `packages/cli/test/dashboard.test.ts`, including
`risk:regression an idle ticket shows idle days in the dashboard text and the json keeps every key` (its key order
already holds `upNext`).

End by running `npm run build`.

## Task 2: The panel shows UP NEXT below YOURS, and the docs say UP NEXT is always there
covers: @ac-4, D-01, D-05
files: packages/core/test/panel.test.ts, docs/design.md, accord/tickets/ST-LN-2/ledger.md
verify: packages/core/test/panel.test.ts#ac-4-the-panel-shows-up-next-while-the-viewer-holds-work (@ac-4)

From Task 1: `accord dashboard --json` always carries `upNext`, also while `yours` has rows. The panel renders an
UP NEXT section whenever `d.upNext` is present (`packages/core/panel/view.js:90`), so no panel code changes.

Test first, a new top-level `it` in `packages/core/test/panel.test.ts`, on the existing harness (`host`,
`loadPanel`, `board`, `start`). It passes before any code change, since the panel already does this; it guards
against a regression (Approach, Risks):
- `it('ac-4 the panel shows up next while the viewer holds work')`: `h = await host(await loadPanel())`; `await
  h.fire('session.start', start)`; `h.settle({ stdout: JSON.stringify(board({ yours: { rows: [{ id: 'ST-AN-9',
  title: 'Audit' }], more: 0 }, upNext: { rows: [{ id: 'ST-AN-1', title: 'Export' }, { id: 'ST-AN-2', title:
  'Import' }], more: 0 } })) })`. In `vi.waitFor`, with `t = h.texts()` and `at = (s) => t.findIndex((x) =>
  x.includes(s))`, `order = [at('YOURS'), at('ST-AN-9'), at('UP NEXT'), at('ST-AN-1'), at('ST-AN-2')]` has every
  index at least 0 and equals itself sorted ascending, as `ac-1 the pane shows the dashboard json on open and after
  each turn` checks its order.

Text, no test:
- `docs/design.md` line 161, the **Entry point.** paragraph: `UP NEXT when nothing of yours is in progress and
  nothing is ready` becomes `UP NEXT with the unclaimed open tickets that are not ready`; the rest of the
  paragraph stays.
- `accord/tickets/ST-LN-2/ledger.md`: one line appended as the last line of `## Rulings`, exactly:
  ```
  - Superseded by ST-LN-18 D-01 and D-04: UP NEXT and the `upNext` key appear on every run, also while the viewer holds a claim; this replaces ST-LN-2 D-04, D-08 and the last clause of its @ac-3.
  ```
  `## Tasks` and every other line stay, so ST-LN-2 stays done.

Must not change: every other case in `packages/core/test/panel.test.ts` and its `board` helper; the panel files
named in the preamble; every other line of `docs/design.md` and of the ST-LN-2 ledger.

End by running `npm run build`, then `npx vitest run packages/core/test/panel.test.ts packages/core/test/convention.test.ts`.
