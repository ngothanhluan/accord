---
baseline: a3f781ff5f9f4290bc5c6bfcc296098c5cb5cb27
plan_hash: "fnv1a64:edd7712420ae0a02"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, and the ticket.

Rules for every task:
- Test ids: every test named on a `verify:` line is a top-level `it(...)` with no `describe` around it. Its report
  id is the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`
  (`packages/core/src/load/junit.ts`). No test title holds `@` or a comma.
- CLI tests import core from `packages/core/dist`: after changing anything under `packages/core/`, run
  `npm run build -w packages/core` before running any CLI test. Run one file with
  `npx vitest run <path>`. End every task with `npm run build`, `npm run lint` and `npm run typecheck`, then the
  test files the task names.
- Files are LF with no BOM. No new dependency. Strings are compared in code-point order, never with
  `localeCompare`. Optional JSON fields are omitted, never set to `undefined` (D-54).
- No control character appears in a regular expression (eslint `no-control-regex`); scan code points instead, as
  `packages/cli/src/render/table.ts` does.

Definitions shared by every task (from the ticket's Approach and the ledger's Rulings):
- A work ticket is a status row with `lane` set and `type` not `epic`. An open work ticket is a work ticket whose
  `status` is neither `archived` nor `dropped` and whose `stage` is not `done`. Only open work tickets enter
  YOURS, TEAM, READY and UP NEXT.
- The viewer is `git config user.email`. A row is the viewer's when `claimedBy.toLowerCase() ===
  viewer.toLowerCase()`.
- The rank, used by every section: effective priority, highest first (added in Task 2); then unblocked
  (`(blockedBy ?? []).length === 0`) before blocked; then id, where ids are split into runs of digits and runs of
  non-digits and compared run by run: two digit runs by numeric value (strip leading zeros, then shorter is
  smaller, then code-point order), anything else in code-point order; equal under that, plain code-point order.
  So `ST-AN-9` comes before `ST-AN-10`.
- Effective priority (Task 2): `high` 3, `medium` 2, `low` 1; a ticket without `priority`, or whose frontmatter
  failed the schema, is `medium`. A ticket's effective priority is the highest of its own and the own priority
  of every ticket that depends on it through `depends_on`, directly or through other tickets, found by a walk
  over the whole snapshot with a visited set. A dependent whose `status` is `archived` or `dropped`, or that
  `isDone`, does not lift.
- Section caps: YOURS none, TEAM 10, READY 20, UP NEXT 20, EPICS 20. A section is `{ rows, more }`: `rows` the
  first `cap` ranked rows, `more` the count left out (0 when none).
- Summary counts, all over open work tickets unless said: `inProgress` (claimed), `ready` (the READY total
  before the cap), `blocked` (unclaimed, `blockedBy` non-empty), `backlog` (unclaimed, not in READY, not
  blocked), `done` (work tickets at stage `done` whose `status` is neither `archived` nor `dropped`),
  `withoutLane` (rows with `type` set to `story` or `bug`, no `lane`, `status` neither `archived` nor `dropped`,
  and not `isDone`), `withSchemaErrors` (rows with no `type`, which is a ticket whose frontmatter failed the
  schema). The JSON always holds all seven numbers; the text names the last two only when above 0.
- Text layout: each section is its heading on its own line (`YOURS`, `TEAM`, `READY`, `UP NEXT`, `EPICS`),
  then, indented two spaces, either the line `none` or a header line naming the columns followed directly by
  one line per row (no separator line), then `+<more> more` when `more` is above 0. Cells are padded to the
  widest cell of their column counted in code points, joined by two spaces, each line `trimEnd()`ed. Sections
  are separated by one blank line; a blank line then the summary line follow the last section.
- Title cell: every code point below 0x20, 0x7F to 0x9F, U+061C, U+200E, U+200F, U+2028, U+2029, U+202A to
  U+202E and U+2066 to U+2069 becomes a space; space runs collapse to one; the result is trimmed; a title
  longer than 60 code points becomes its first 57 code points plus `...`. Every other Unicode character is kept.
  Every other cell goes through the ASCII `sanitise` of `packages/cli/src/render/table.ts`.

## Task 1: Wiring: accord dashboard prints titled rows under column headers and caps its sections
covers: @ac-2, @ac-4, D-02, D-06, D-07
files: packages/core/src/status/rows.ts, packages/core/src/status/dashboard.ts (new), packages/core/src/index.ts, packages/cli/src/run.ts, packages/cli/src/commands/dashboard.ts (new), packages/cli/src/render/table.ts, packages/cli/src/render/dashboard.ts (new), packages/cli/test/dashboard.test.ts (new), packages/core/test/lane-status.test.ts, packages/cli/test/lane-commands.test.ts, packages/cli/test/skill-commands.test.ts
verify: packages/cli/test/dashboard.test.ts#ac-2-rows-carry-titles-and-sections-carry-column-headers (@ac-2), packages/cli/test/dashboard.test.ts#ac-4-sections-are-capped-on-a-large-backlog (@ac-4), packages/cli/test/dashboard.test.ts#risk:parsing-ids-compare-digit-runs-by-value, packages/cli/test/dashboard.test.ts#risk:complex-branching-a-laneless-and-a-schema-broken-ticket-are-counted-and-never-listed, packages/cli/test/dashboard.test.ts#risk:security-a-title-cannot-inject-control-characters-or-overflow-its-cell

Test helpers available: from `./helpers/repo.js`, `makeLaneRepo(extra)` (a git sandbox with no commit holding
`accord/config.yml` as `CONFIG`, lane ticket `T-1` titled `Export` with a two-task plan, and a green report, each
overridden or extended by the `extra` path-to-text map), `run(argv, cwd)` giving `{ code, out, err }`,
`gitRun(repo, ...args)`, `writeFiles(repo, files)`, `cleanup(repo)`; from `../../../test/helpers/lane.js`,
`CONFIG`, `PLAN` (two tasks) and `laneTicket(id, { lane?, frontmatter?, body? })` (a lane M story titled
`Export`, `status: open`; `lane: ''` omits the lane; `frontmatter` lines are added, a `status:` line replacing the
default). Every `laneTicket` shares one set of scenarios, so one AC hash.

Tests first, in `packages/cli/test/dashboard.test.ts` (new). Module-level builders, using only core's public API
(`approvedHash`, `gateReady`, `loadSnapshot`, `setFrontmatterKey`, `dashboard`) from `@accord-dev/accord-core`,
and `renderDashboard` from `../src/render/dashboard.js`:
- `P(id)` is `'accord/tickets/' + id + '.md'`.
- `AC` is `gateReady(loadSnapshot({ files: { 'accord/config.yml': CONFIG, [P('X-1')]: laneTicket('X-1') }, tree:
  [] }), 'X-1').acHash`.
- `approve(files, id)` sets `approved_hash` on `files[P(id)]` with `setFrontmatterKey` to `approvedHash` of
  `loadSnapshot({ files: { 'accord/config.yml': CONFIG, [P(id)]: files[P(id)] }, tree: [] }).tickets[id]`.
- `ready(files, id, opts?)`: `files[P(id)] = laneTicket(id, opts)`, `approve`, then `ac_hash` set to `AC`
  (stage `plan`, passed Ready, no task done).
- `building(files, id, opts?)`: `laneTicket`, `approve`, and `accord/tickets/<id>/plan.md` as `PLAN` (stage
  `build`, 0 of 2).
- `done(files, id, opts?)`: `building`, then `accord/tickets/<id>/ledger.md` as
  `'## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n'`, `accord/tickets/<id>/review.md` as
  `'verdict: converged\n'`, then `verified` set to `['ac-1', 'ac-2']` and `verified_hash` to `AC` (stage `done`).
- `board(files, claims = {}, viewer = 'an@example.com')` is `dashboard(loadSnapshot({ files, tree: [], claims }),
  viewer)`.

Cases, each a top-level `it`:
- `it('ac-2 rows carry titles and sections carry column headers')`: `makeLaneRepo({ [P('ST-AN-1')]:
  laneTicket('ST-AN-1').replace('title: "Export"', 'title: "Password reset"') })`; `gitRun(repo, 'config',
  'user.email', 'an@example.com')`; `run(['approve', 'ST-AN-1'])` and `run(['gate', 'ready', 'ST-AN-1'])`, the
  gate exiting 0. `run(['status', '--json'])`: the row with id `ST-AN-1` has `title` `'Password reset'`.
  `run(['dashboard'])` exits 0; with `lines = out.split('\n')` and `r = lines.indexOf('READY')`, `r` is at least 0,
  `lines[r + 1]` matches `/\bid\b/` and `/\btitle\b/`, and `lines[r + 2]` contains `ST-AN-1` and
  `Password reset`. `cleanup` in `finally`.
- `it('ac-4 sections are capped on a large backlog')`, in memory: `files = { 'accord/config.yml': CONFIG }`;
  `laneTicket` for `ST-AN-1`..`ST-AN-3` claimed by `an@example.com`; `ST-BO-1`..`ST-BO-12` claimed by
  `bo@example.com`; `done` for `ST-DO-1`..`ST-DO-4`, claimed by `bo@example.com`; `ready` for
  `ST-CY-1`..`ST-CY-25`. `d = board(files, claims)`: `yours` has 3 rows and `more` 0, `team` 10 and 2, `ready`
  20 and 5; no row of `yours`, `team` or `ready` has an id starting `ST-DO-`; `d.summary` matches
  `{ inProgress: 15, ready: 25, blocked: 0, done: 4 }`. `text = renderDashboard(d)`, `lines =
  text.split('\n')`: `+2 more` is on a line between the `TEAM` line and the `READY` line; `+5 more` is on a
  line after the `READY` line; exactly one line contains all of `15 in progress`, `25 ready`, `0 blocked` and
  `4 done`.
- `it('risk:parsing ids compare digit runs by value')`: `laneTicket` for `ST-AN-10`, `ST-AN-9`, `ST-AN-1` and
  `ST-AN-010`, all claimed by `bo@example.com`: `team.rows` ids are `['ST-AN-1', 'ST-AN-9', 'ST-AN-010',
  'ST-AN-10']`.
- `it('risk:complex-branching a laneless and a schema-broken ticket are counted and never listed')`: `ready` for
  `ST-AN-1`; `laneTicket('L-1', { lane: '' })`; `laneTicket('B-1', { frontmatter: ['owner: x'] })` (fails the
  schema), claimed by `an@example.com`. `d.summary` matches `{ withoutLane: 1, withSchemaErrors: 1 }`; no row in
  any section has id `L-1` or `B-1`; the summary line of `renderDashboard(d)` contains `1 without lane` and
  `1 with schema errors, run accord lint`. With `L-1` and `B-1` removed, the summary line contains neither
  `without lane` nor `schema errors` and `d.summary` has both at 0.
- `it('risk:security a title cannot inject control characters or overflow its cell')`: a hand-built `Dashboard`
  whose `yours.rows` holds two rows typed as `StatusRow` (`ui: false`, `errors: 0`, `warnings: 0`, `ready:
  'ok'`, `ticksVerified: 0`, `ticksTagged: 0`, `ticksBinding: 'none'`, `lane: 'M'`, `stage: 'plan'`,
  `tasksDone: 0`, `tasksTotal: 0`), titled `'Đặt lại\u001b[31m mật‮ khẩu x'` and `'Ư'.repeat(70)`,
  the other sections empty and every summary count 0. The rendered text holds no code point below 0x20 other
  than `\n`, and none of U+001B, U+202E, U+2028; it contains `Đặt lại [31m mật khẩu x` and `'Ư'.repeat(57) +
  '...'`, and not `'Ư'.repeat(58)`.
- `packages/core/test/lane-status.test.ts`: `LANE_KEYS` gains `'title'`. `packages/cli/test/lane-commands.test.ts`:
  in the case `a ticket without lane is unchanged by a t/<id> branch, in the table and under --json`, the array
  of its `for (const key of [...])` loop gains `'title'` after `'branch'`; nothing else in that case changes.
- `packages/cli/test/skill-commands.test.ts`: the expected list in `reads the real paths off the commander tree
  the CLI runs` gains `'dashboard'` after `'brief'`.

Interface:
- `StatusRow` gains `title?: string`, set in the lane-only block of `statusRows` as its first key (`title:
  fm.title`), so rows of tickets without `lane` stay byte-identical (D-07).
- `packages/core/src/status/dashboard.ts` (new), pure, exported from `index.ts` with its types:
  `dashboard(snapshot: RepoSnapshot, viewer: string, now?: number): Dashboard`, built on `statusRows(snapshot,
  now)`, `nextRows` and `isDone`. `Dashboard` is `{ yours: DashboardSection; team: DashboardSection; ready:
  DashboardSection; summary: DashboardSummary }` in that key order; `DashboardSection` is `{ rows: StatusRow[];
  more: number }`; `DashboardSummary` is `{ inProgress, ready, blocked, backlog, done, withoutLane,
  withSchemaErrors }`, all numbers. YOURS: open work tickets that are the viewer's. TEAM: open work tickets
  claimed by anyone else. READY: `nextRows(rows)` limited to open work tickets. Each ranked as the preamble says
  (in this task: unblocked first, then id), then capped. Task 3 adds `upNext` after `ready` and Task 4 adds
  `epics` before `summary`.
- `packages/cli/src/render/table.ts`: `sanitise` gains `export`; nothing else changes.
- `packages/cli/src/render/dashboard.ts` (new): `renderDashboard(d: Dashboard): string`, ending in a newline.
  YOURS, TEAM and READY in that order, each with columns `id`, `title` (the title cell), `stage` (`build
  <tasksDone>/<tasksTotal>` in build, else the stage, then ` idle <n>d` when `idleDays` is set, as the table's
  stage cell does), `who` (`claimedBy`, else `EMPTY_CELL`) and `blocked by` (`blockedBy` joined by a space,
  else `EMPTY_CELL`). The summary line is `<inProgress> in progress, <ready> ready, <blocked> blocked, <backlog>
  backlog, <done> done`, then `, <n> without lane` and `, <n> with schema errors, run accord lint` when each is
  above 0.
- `packages/cli/src/commands/dashboard.ts` (new): `dashboardCommand(ctx: CommandContext, options: { json?:
  boolean }): number`. `viewer = gitUserEmail(ctx.root)`; when it is `''`, throw `UsageError('git user.email is
  not set - set it with git config user.email <you@example.com>')` (exit 2). Otherwise `d =
  dashboard(ctx.snapshot, viewer, Math.floor(Date.now() / 1000))`; write `JSON.stringify(d, null, 2) + '\n'`
  under `--json`, else `renderDashboard(d)`; return 0.
- `run.ts`: `program.command('dashboard')`, description `print the ranked and capped sections for the viewer`,
  option `--json` (`print the Dashboard object instead of text`), through `preflight`, registered after `next`.

Must not change: rows of tickets without `lane` (every D-54 golden, the `status` table columns, `renderRows`
output); `nextRows`; every `accord status` and `accord next` case; the sort order of `statusRows`.

End by running `npm run build`.

## Task 2: Ready tickets are ranked by inherited priority
covers: @ac-1, D-01
files: packages/core/schemas/ticket.schema.json, packages/core/src/model/snapshot.ts, packages/core/src/status/dashboard.ts (new), packages/core/templates/ticket-lane.md, packages/core/src/generated/templates.ts, packages/core/test/schemas.test.ts, packages/cli/test/dashboard.test.ts (new)
verify: packages/cli/test/dashboard.test.ts#ac-1-ready-tickets-are-ranked-by-inherited-priority-then-by-id (@ac-1), packages/cli/test/dashboard.test.ts#risk:complex-branching-a-depends_on-cycle-ends-and-a-dropped-dependent-does-not-lift

From Task 1: `packages/cli/test/dashboard.test.ts` holds the builders `P`, `AC`, `approve`, `ready`,
`building`, `done` and `board` described there, and imports `run`, `gitRun`, `writeFiles`, `makeLaneRepo`,
`cleanup`. `dashboard()` in `packages/core/src/status/dashboard.ts` ranks every section by unblocked first, then
id.

Tests first, in `packages/cli/test/dashboard.test.ts`:
- `it('ac-1 ready tickets are ranked by inherited priority then by id')`: `makeLaneRepo` with
  `laneTicket('ST-AN-1', { frontmatter: ['priority: low'] })`, `laneTicket('ST-AN-3')`, `laneTicket('ST-AN-4',
  { frontmatter: ['priority: high'] })`, `laneTicket('ST-AN-2', { frontmatter: ['priority: medium',
  'depends_on: ["ST-AN-1"]'] })` and `laneTicket('ST-AN-6', { frontmatter: ['priority: high', 'depends_on:
  ["ST-AN-2"]'] })`; `gitRun(repo, 'config', 'user.email', 'an@example.com')`. For each of the five ids, `run`
  `['approve', id]` then `['gate', 'ready', id]`, each gate exiting 0. `run(['dashboard', '--json'])` exits 0 and
  the ids of `ready.rows` are exactly `['ST-AN-1', 'ST-AN-4', 'ST-AN-3']`. `run(['lint', '--json'])`: no
  finding has `pointer === '/priority'`. Then rewrite `accord/tickets/ST-AN-3.md` with `writeFiles`, its text
  with `'ui: false\n'` replaced by `'ui: false\npriority: urgent\n'`: `run(['lint', '--json'])` exits 1 and its
  `findings` hold one with `pointer === '/priority'` and a `rule` starting `schema.`. `cleanup` in `finally`.
- `it('risk:complex-branching a depends_on cycle ends and a dropped dependent does not lift')`, in memory, every
  ticket claimed by `bo@example.com`: `ST-AN-1` (`priority: low`, `depends_on: ["ST-AN-2"]`), `ST-AN-2`
  (`priority: low`, `depends_on: ["ST-AN-1"]`), `ST-AN-3` (no priority), `ST-AN-4` (`priority: high`,
  `status: dropped`, `depends_on: ["ST-AN-1"]`). `board(...)` returns, and `team.rows` ids are `['ST-AN-3',
  'ST-AN-1', 'ST-AN-2']`.
- `packages/core/test/schemas.test.ts`, case `D-04/D-05: dropped and tracker-owned keys are rejected;
  assumptions are shaped`: `{ priority: 'high' }` leaves the rejected list, and the case gains
  `expect(ticket({ priority: 'high' })).toEqual([])` and `expect(has(ticket({ priority: 'urgent' }),
  '/priority', 'schema.enum')).toBe(true)`. Its title stays.

Interface:
- `ticket.schema.json`: `"priority": { "type": "string", "enum": ["high", "medium", "low"] }` after
  `depends_on`. `TicketFrontmatter` gains `priority?: 'high' | 'medium' | 'low'` after `depends_on`.
- `dashboard.ts`: effective priority as the preamble defines it, read from `snapshot.tickets[id].frontmatter`
  (own priority and `depends_on`), computed once per call for every ticket id, and put first in the rank key.
- `packages/core/templates/ticket-lane.md`: after the commented `# depends_on: ["OTHER-ID"]` line, two lines:
  `# How the dashboard ranks this ticket: high | medium | low; absent means medium.` and `# priority: medium`.
  Then `npm run gen`, which rewrites `packages/core/src/generated/templates.ts`.

Must not change: Task 1 cases; every other `schemas.test.ts` case and golden; `templates.test.ts` (headings,
frontmatter validity, drift); `accord new ticket --lane M` output other than the two comment lines.

End by running `npm run build`.

## Task 3: UP NEXT shows the viewer what to pick up when nothing is ready, and the action line
covers: @ac-3, D-04
files: packages/core/src/status/dashboard.ts (new), packages/cli/src/render/dashboard.ts (new), packages/cli/test/dashboard.test.ts (new)
verify: packages/cli/test/dashboard.test.ts#ac-3-up-next-shows-the-viewer-what-to-pick-up-when-nothing-is-ready (@ac-3), packages/cli/test/dashboard.test.ts#risk:complex-branching-an-archived-claimed-ticket-is-in-no-section-and-no-count, packages/cli/test/dashboard.test.ts#risk:complex-branching-the-action-line-names-only-the-actions-that-apply

From Tasks 1 and 2: `dashboard(snapshot, viewer, now?)` returns `{ yours, team, ready, summary }`, every
section ranked by effective priority, unblocked first, then id; `renderDashboard(d)` prints YOURS, TEAM, READY
and the summary line. The test builders `P`, `ready`, `building`, `done`, `board` exist in
`packages/cli/test/dashboard.test.ts`.

Tests first, in `packages/cli/test/dashboard.test.ts`:
- `it('ac-3 up next shows the viewer what to pick up when nothing is ready')`: `building` for `ST-AN-9`, claimed
  by `bo@example.com`; `laneTicket('ST-AN-1')`; `laneTicket('ST-AN-2', { frontmatter: ['priority: high',
  'depends_on: ["ST-AN-1"]'] })`; `done` for `ST-AN-3`. `d = board(files, { 'ST-AN-9': 'bo@example.com' })`:
  `ready.rows` is `[]`; `upNext.rows` ids are `['ST-AN-1', 'ST-AN-2']`; `upNext.suggest` equals `{ action:
  'pick-up', id: 'ST-AN-1' }`. Then with claims also holding `'ST-AN-1': 'an@example.com'`: `d` has no
  property `upNext`, and no line of `renderDashboard(d)` is `UP NEXT`.
- `it('risk:complex-branching an archived claimed ticket is in no section and no count')`: `laneTicket('ST-AN-1',
  { frontmatter: ['status: archived'] })` claimed by `an@example.com` and `laneTicket('ST-AN-2', { frontmatter:
  ['status: archived'] })` unclaimed. `yours.rows`, `team.rows` and `ready.rows` are `[]`; `upNext` equals
  `{ rows: [], more: 0 }` (no `suggest` key); `summary.inProgress` and `summary.backlog` are 0.
- `it('risk:complex-branching the action line names only the actions that apply')`, on hand-built `Dashboard`
  objects with rows built as in Task 1's title case: the last non-empty line of `renderDashboard` is
  `-> [Continue ST-AN-1]  [Pick up ST-AN-2]  [New request]` when `yours.rows` starts with `ST-AN-1` and
  `ready.rows` with `ST-AN-2`; `-> [Pick up ST-AN-3]  [New request]` when only `upNext` has rows and `suggest`
  `{ action: 'pick-up', id: 'ST-AN-3' }`; `-> [New request]` when `upNext` has rows and no `suggest`.

Interface:
- `Dashboard` gains `upNext?: DashboardSection & { suggest?: { action: 'pick-up'; id: string } }`, placed after
  `ready`. It is present only when YOURS and READY have no rows (D-04, whatever TEAM holds). Its rows are the
  unclaimed open work tickets, ranked, capped at 20; `suggest` names the first unblocked ticket of the whole
  ranked list, and is omitted when none is unblocked.
- `renderDashboard`: an `UP NEXT` section after READY when `upNext` is present, same columns as the others. Its
  last line is the action line: `-> ` then, joined by two spaces, `[Continue <yours.rows[0].id>]` when YOURS has
  a row, `[Pick up <ready.rows[0].id, else upNext.suggest.id>]` when either exists, and `[New request]` always.
  ASCII only.

Must not change: Tasks 1 and 2 cases; YOURS, TEAM, READY and the summary.

End by running `npm run build`.

## Task 4: Epics show their children done over all their children
covers: @ac-5, D-03
files: packages/core/src/status/dashboard.ts (new), packages/cli/src/render/dashboard.ts (new), packages/cli/test/dashboard.test.ts (new)
verify: packages/cli/test/dashboard.test.ts#ac-5-epics-show-their-children-done-over-all-their-children (@ac-5)

From Tasks 1 to 3: `dashboard(snapshot, viewer, now?)` returns `{ yours, team, ready, upNext?, summary }`;
`renderDashboard(d)` prints the sections, the summary line and the action line last. The test builders `P`,
`done`, `board` exist in `packages/cli/test/dashboard.test.ts`.

Test first, in `packages/cli/test/dashboard.test.ts`:
- `it('ac-5 epics show their children done over all their children')`: epic `EP-AN-1` as `laneTicket('EP-AN-1',
  { lane: '' }).replace('type: story', 'type: epic')` (title `Export`); with `parent: "EP-AN-1"` in
  `frontmatter`: `done` for `ST-AN-1`..`ST-AN-3`, `laneTicket('ST-AN-4', ...)` with `status: dropped` too, and
  `laneTicket` for `ST-AN-5`..`ST-AN-8`; epic `EP-AN-2` built the same way with `status: archived`; and
  `laneTicket('ST-AN-20')`. `d.epics` equals `{ rows: [{ id: 'EP-AN-1', title: 'Export', done: 3, total: 7 }],
  more: 0 }`. In `renderDashboard(d)`, the lines from the `EPICS` line up to the next empty line hold one line
  containing `EP-AN-1` and `3/7 done`, and none containing `EP-AN-2` or `ST-AN-20`.

Interface:
- `Dashboard` gains `epics: { rows: EpicRow[]; more: number }` before `summary`; `EpicRow` is `{ id: string;
  title: string; done: number; total: number }`, exported. An epic is a ticket whose frontmatter has `type:
  epic` and a `status` other than `archived` or `dropped`, with or without `lane`. Its children are the tickets
  whose frontmatter `parent` is its id and whose `status` is not `dropped`; `total` counts them, `done` counts
  those that `isDone`. Epics rank unfinished (`done < total`, or `total` 0) before finished, then by id as the
  preamble says; cap 20.
- `renderDashboard`: an `EPICS` section after UP NEXT (or READY), only when `epics.rows` is non-empty, with
  columns `id`, `title` (the title cell) and `progress` (`<done>/<total> done`), and `+<more> more` when above 0.
- Every hand-built `Dashboard` already in `packages/cli/test/dashboard.test.ts` (Task 1's title case, Task 3's
  action-line case) gains `epics: { rows: [], more: 0 }` so it still typechecks; their assertions stay.

Must not change: Tasks 1 to 3 cases; the summary counts (epics never enter them).

End by running `npm run build`.

## Task 5: The /accord skill shows what accord dashboard prints
covers: D-02, D-05
files: packages/core/skills/accord/SKILL.md, packages/core/src/generated/skills.ts, .claude/skills/accord/SKILL.md, packages/core/test/skills.test.ts, packages/core/test/stage-skills.test.ts, packages/cli/test/skills-sync.test.ts, docs/design.md
verify: packages/cli/test/skills-sync.test.ts#risk:regression-the-committed-/accord-copy-shows-accord-dashboard-and-builds-no-section

From Tasks 1 to 4: `accord dashboard [--json]` prints YOURS, TEAM, READY, UP NEXT when it applies, EPICS, one
summary line and an action line; it exits 2 when `git config user.email` is unset. Each lane row of `accord
status --json` carries `title` and `branch`.

Test first: `packages/cli/test/skills-sync.test.ts`, the case `risk:drift the committed /accord copy carries the
idle wording` becomes `it('risk:regression the committed /accord copy shows accord dashboard and builds no
section')`: the copy at `.claude/skills/accord/SKILL.md` contains `` `accord dashboard` `` and `verbatim`, and
contains neither `accord next` nor `claimedBy` nor `idleDays`.

Text in `packages/core/skills/accord/SKILL.md`, naming no other tool:
- The `## Dashboard: \`/accord\` with no argument` section, from step 1 through step 3 (the example block and
  both paragraphs under it included), becomes exactly:
  ```
  1. Run `accord dashboard`. It reads you from `git config user.email` and
     prints every section ranked and capped, one count line, and the actions
     that apply. When it exits 2, show its message and stop.
  2. Show its output verbatim in a code block. Never reorder, cut, merge, or
     add to it, and never build a section from `accord status --json`.
  3. Offer the actions its last line names: Continue, Pick up, New request.
  ```
- The `## Pick up` paragraph becomes exactly:
  ```
  Create its `branch` from `accord status --json`, commit `claim: <id>` on it
  with `--allow-empty`, and push it: the pushed branch is the claim. Then
  continue as above.
  ```

Tests that move with the text (ledger Ruling on the ST-LN-1 test):
- `packages/core/test/skills.test.ts`: `COMMAND` gains `dashboard` in its alternation (after `brief`);
  `firstCommand` returns `'dashboard'` for `accord`.
- `packages/core/test/stage-skills.test.ts`: in `REQUIRED.accord`, `'accord next'` becomes `'accord dashboard'`;
  every other phrase stays. In `ac-5 the accord skill takes the claim branch from the CLI in Continue Pick up and
  New request`, the Pick up line expects `` '`accord status --json`' `` in place of `` '`accord next --json`' ``;
  its title, its other lines and its check that no slice holds `` `t/ `` or `{id}` stay.

`docs/design.md`: line 43 lists `priority` (`high | medium | low`, absent means medium) among the frontmatter
keys and ends `Unknown keys are errors, so tracker-owned data cannot leak into git; \`priority\` is the one such
key accord reads, because the dashboard ranks by it.`; the command block gains `accord dashboard           #
ranked, capped sections for the viewer; --json for the data`; the **Entry point.** paragraph's first sentence
becomes `` `/accord` with no argument runs `accord dashboard` and shows its output verbatim: YOURS, TEAM, READY,
UP NEXT when nothing of yours is in progress and nothing is ready, EPICS with children done over all children,
one count line, and the actions that apply. `` and its sentence `The model formats it and never infers state.`
becomes `The CLI ranks and caps every section; the model never reorders or adds to it.`

Then run, in order: `npm run gen`, `npm run build`, and `node packages/cli/dist/cli.js skills sync`, which
rewrites `.claude/skills/accord/SKILL.md`. These must pass: `skills.test.ts` (first command, size, line limit,
drift, `no rendered text restates a rule the CLI enforces`), `stage-skills.test.ts`,
`packages/cli/test/skill-commands.test.ts`, `packages/cli/test/skills-sync.test.ts`.

Must not change: Continue, New request and Rules sections; every other `REQUIRED` phrase, including
`accord status --json`, `user.email`, `push it (the pushed branch is the claim)` and `claim: <id>`; the other
skills.

End by running `npm run build`.
