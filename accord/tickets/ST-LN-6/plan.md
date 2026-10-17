---
baseline: 517937f0ec0b2a0c287abe0078b381ceafd26233
plan_hash: "fnv1a64:0f8cdba60ad18030"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

External reference the repository does not hold, read where a task cites it: the Claude Code mods type file
`C:/Users/Luan Ngo/.claude/dev-mods/0d0dd6d1-ce2a-45f2-8886-2709f048d5ee/git-diff-pane/.claude-plugin/types/claude-code/index.d.ts`
(cited below as d.ts:<line>).

Rulings taken while planning (the main session records them in the ledger):
- Ruling: the id Button's text takes `color: 'suggestion'` — `Color` is a theme key or a raw colour (d.ts:1676-1679)
  and `ThemeKey` (d.ts:12590) has no `accent` key; `suggestion` is the theme's colour for something to act on —
  cost if wrong: one colour value in `register.js`.
- Ruling: a scenario without an `@ac-n` tag is still listed, with `id: null`, and its heading is its title alone —
  lint already reports it; leaving it out would hide text the owner wrote — cost if wrong: one filter.
- Ruling: the text output of `accord show` starts with one line `<id> <title>` — the id names what is shown, the
  title follows whole — cost if wrong: one line reworded.
- Ruling: while a detail is open, `turn.complete` re-runs both the dashboard and `show`, so Back shows a dashboard
  as fresh as the detail — cost if wrong: one `npx` run per turn while a detail is open.
- Ruling: a `show` result that arrives after Back, or for another ticket than the one now open, is dropped — else
  a late result reopens a closed detail — cost if wrong: one comparison.

Rules for every task:
- Test ids: every test named on a `verify:` line is a top-level `it(...)` with no `describe` around it. Its report
  id is the test file's path from the repository root, then `#`, then the `it` title with each whitespace run
  turned into `-`. No test title holds `@` or a comma.
- CLI tests import core from `packages/core/dist`: after changing anything under `packages/core/`, run `npm run gen`
  (when a file under `packages/core/panel/` changed) and then `npm run build -w packages/core` before running any
  test. Run one file with `npx vitest run <path>`. End every task with `npm run build`, `npm run lint` and
  `npm run typecheck`, then the test files the task names.
- Files are LF with no BOM. No new dependency. No control character in a regular expression (eslint
  `no-control-regex`); scan code points instead. Core stays pure: nothing under `packages/core/src/status/` imports
  a Node built-in.
- `packages/core/panel/*.js` is plain ESM that Claude Code loads directly: no TypeScript, no import outside the
  folder, no Node built-in, no `process.env`. `register.js` follows the mods static-analysis rules: event names as
  string literals; every `$` call written in full (`$.process.run(...)`, `$.command.run(...)`); `$` passed only to a
  function declared at the top level of `register.js`, never to an imported one; no dynamic `import()`.
- Host facts the panel tasks rely on: a `Button` draws `[ label ]`, and with `plain: true` and no `hotkey` the label
  alone (d.ts:1056, d.ts:1099-1100); its children may be strings and `Text`, drawn in the label's place, one press
  wherever it lands, and any other element is refused (d.ts:1070-1074); `key` is its address (d.ts:1062-1068).
  `Text` takes `color`, `bold`, `dimColor` and `underline` (d.ts:12572-12577) and `wrap` from `'wrap' | 'end' |
  'middle' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end'` (d.ts:12580). The `Text` props state
  no default for `wrap`; d.ts:1667-1668 describes `'wrap'` in that vocabulary as continuing a long line on the rows
  under it (said there of the code view). So every `Text` the detail view draws sets `wrap: 'wrap'` explicitly.

Definitions shared by every task:
- `TicketDetail` (Task 1, `packages/core/src/status/show.ts`), the one shape the text output, the JSON and the panel
  read:
  ```ts
  export type CriterionLabel = 'failing' | 'blocked' | 'verified' | 'passing' | 'not run' | 'untested';
  export interface CriterionDetail {
    id: string | null; // 'ac-1'; null for a scenario with no @ac-n tag
    title: string; // the scenario name
    steps: string[]; // ScenarioRef.steps as stored: keyword as written, then the text ('And the cell is quoted')
    label: CriterionLabel;
    test: string | null; // the first @test: tag, without '@test:'
    testResult: 'passed' | 'failed' | 'skipped' | null; // snapshot.tests[test]; null without a report or a case
    ticked: boolean; // id is in frontmatter verified:
    verification: 'pass' | 'fail' | 'blocked' | null; // the verification.md block for id
  }
  export interface TicketDetail {
    id: string; title: string; stage: Stage; lane: 'M' | 'L' | 'P';
    tasksDone: number; tasksTotal: number; branch: string;
    holder: string | null; // the row's claimedBy
    blockedBy: string[]; // the row's blockedBy; [] when absent
    intent: string[]; // the Intent section's non-blank lines, comments stripped, as anchorText reads them
    criteria: CriterionDetail[]; // every scenario in document order
  }
  ```
- The label chain (D-04, @ac-3), the first that matches: `failing` when `testResult === 'failed'` or `verification
  === 'fail'`; `blocked` when `verification === 'blocked'`; `verified` when `ticked` and the frontmatter
  `verified_hash` equals `acHash(ticket.scenarios)` (the criteria now, never `ac_hash`); `passing` when `testResult
  === 'passed'`; `not run` when `test !== null`; `untested` otherwise. `scanJUnit` already counts a case holding
  `<failure>` or `<error>` as `failed` (`load/junit.ts:36`), and `loadSnapshot` leaves `snapshot.tests` absent when
  `tests.report` is unset or no file is at it (`load/snapshot.ts:91-105`), which gives `testResult: null`.
- The detail view's facts, the same words in the CLI text and the panel: `Stage: <stage>`, `Lane: <lane>`,
  `Tasks: <done>/<total>`, `Branch: <branch>`, `Holder: <holder or none>`, `Blocked by: <ids joined by one space,
  or none>`; per criterion `State: <label>`, `Test: <test or none>`, `Test result: <testResult or none>`,
  `Ticked: yes|no`, `Verification: <verification or none>`.

## Task 1: Core works out each ticket's detail and each criterion's label
covers: @ac-3, D-03, D-04, D-08
files: packages/core/src/status/show.ts (new), packages/core/src/index.ts, packages/core/test/show.test.ts (new)
verify: packages/core/test/show.test.ts#ac-3-each-criterion-takes-the-first-label-that-matches-top-down (@ac-3), packages/core/test/show.test.ts#risk:complex-branching-holder-and-blocking-tickets-come-from-the-row-and-a-non-lane-ticket-has-no-detail

Tests first, in `packages/core/test/show.test.ts` (new), importing `loadSnapshot` and `ticketDetail` from
`../src/index.js`, `acHash` from `../src/gate/hash.js`, and `CONFIG`, `laneTicket` from `../../../test/helpers/lane.js`.
Snapshots are built in memory: `loadSnapshot({ files, tree: [] })`.
- `it('ac-3 each criterion takes the first label that matches top down')`: a ticket `T-1` made with `laneTicket('T-1',
  { body })` where `body` is an Intent line and one gherkin fence of nine scenarios `@ac-1` to `@ac-9`, each with a
  `Given` and a `Then` step; `@ac-1` to `@ac-7` and `@ac-9` carry `@test:t#c1` .. `@test:t#c7` and `@test:t#c9`,
  `@ac-8` carries none. The report at `reports/junit.xml` is written as raw XML (the shared `junit` helper writes no
  `<error>`): `t#c1` with `<failure/>`, `t#c2` passed, `t#c3` passed, `t#c4` passed, `t#c5` passed, no case for
  `t#c6`, `t#c7` with `<skipped/>`, `t#c9` with `<error/>`. `accord/tickets/T-1/verification.md` holds frontmatter
  `ticket: T-1`, `commit: "abc1234"`, `reviewed_on: "2026-10-16"` and blocks `## @ac-2 two` with `Result: fail`, `##
  @ac-3 three` with `Result: blocked`. Load once to read `acHash(snap.tickets['T-1'].scenarios)`, then load again with
  frontmatter lines `verified: [ac-1, ac-3, ac-4]` and `verified_hash: "<that hash>"`. Labels by id: ac-1 `failing`
  (ticked, test failed), ac-2 `failing`, ac-3 `blocked`, ac-4 `verified`, ac-5 `passing`, ac-6 `not run`, ac-7 `not
  run`, ac-8 `untested`, ac-9 `failing`; ac-1's facts are `test: 't#c1'`, `testResult: 'failed'`, `ticked: true`,
  `verification: null`. Then the same files with config `tests:` and `report:` lines removed from `CONFIG`, and once
  more with the config kept and the report file left out: in both, ac-1 `verified`, ac-2 `failing`, ac-3 `blocked`,
  ac-4 `verified`, ac-5, ac-6, ac-7 and ac-9 `not run`, ac-8 `untested`, every `testResult` `null`. Last, with the
  report back, `verified_hash` and `ac_hash` both set to the hash of the criteria and then one step of `@ac-4`
  changed in the body: ac-4 is `passing`, not `verified`.
- `it('risk:complex-branching holder and blocking tickets come from the row and a non-lane ticket has no detail')`:
  `loadSnapshot({ files, tree: [], claims: { 'T-1': 'bob@x' } })` with `T-1` holding `depends_on: [T-9]` (no T-9
  ticket): `holder` is `'bob@x'`, `blockedBy` `['T-9']`. Without `claims` and `depends_on`: `holder` `null`,
  `blockedBy` `[]`. `ticketDetail` of an id with no ticket, and of `laneTicket('T-2', { lane: '' })`, is `undefined`.

Interface:
- `ticketDetail(snapshot: RepoSnapshot, id: string): TicketDetail | undefined`, pure, in
  `packages/core/src/status/show.ts`: `undefined` unless `Object.hasOwn(snapshot.tickets, id)` and the ticket has
  frontmatter and `lane`. The row is `statusRows(snapshot).find((r) => r.id === id)`: `title`, `stage`, `lane`,
  `tasksDone`, `tasksTotal` and `branch` from it, `holder` `row.claimedBy ?? null`, `blockedBy` `row.blockedBy ?? []`
  (the row omits absent keys, so each is mapped explicitly). `intent` reads the `Intent` section as
  `status/anchor.ts:36-37` does (`headingKey`, `stripHtmlComments`, non-blank lines, text as written). One
  `CriterionDetail` per `ticket.scenarios` entry, in order: `id` `acTag ?? null`; `test` the first tag starting
  `@test:`, sliced; `testResult` `snapshot.tests` own key `test`, else `null`; `ticked` `id !== null` and
  `frontmatter.verified` includes it; `verification` the `result` of the first block of
  `snapshot.verifications[ticket.id]` (own key) whose `acTag === id`, else `null`; `label` by the chain in the
  preamble. Every absent value is `null` or `[]`, never `undefined`, so `JSON.stringify` keeps every key.
- `packages/core/src/index.ts` exports `ticketDetail` and the types `TicketDetail`, `CriterionDetail`,
  `CriterionLabel`.

Must not change: `statusRows`, `anchorText`, `acHash` and every existing core test.

## Task 2: accord show prints the detail as text and as JSON
covers: @ac-1, @ac-2, D-05, D-06
files: packages/cli/src/commands/show.ts (new), packages/cli/src/run.ts, packages/cli/src/render/dashboard.ts, packages/cli/test/show.test.ts (new), packages/cli/test/skill-commands.test.ts
verify: packages/cli/test/show.test.ts#ac-1-accord-show-prints-the-full-detail-as-text (@ac-1), packages/cli/test/show.test.ts#ac-2-accord-show-json-gives-the-same-detail-as-data (@ac-2), packages/cli/test/show.test.ts#risk:security-show-text-turns-control-and-bidi-characters-into-spaces

From Task 1: core exports `ticketDetail(snapshot, id)` and `TicketDetail`.

Tests first, in `packages/cli/test/show.test.ts` (new), with `makeLaneRepo`, `run`, `cleanup` from
`./helpers/repo.js` and `LANE_BODY`, `laneTicket` from `../../../test/helpers/lane.js`. The fixture: `LONG =
'Export every report of the month as one CSV file with quoted cells'` (66 characters); `STEP = 'And the file name is
the report name followed by the month and the extension csv'`; the ticket is `laneTicket('T-1', { body:
LANE_BODY.replace('    Then a csv file is written\n', '    Then a csv file is written\n    ' + STEP + '\n')
}).replace('title: "Export"', 'title: "' + LONG + '"')`, passed to `makeLaneRepo({ 'accord/tickets/T-1.md': ... })`
(unapproved, so stage `intent`, its plan 0 of 2 tasks done, both report cases passed, no claim, no dependency).
- `it('ac-1 accord show prints the full detail as text')`: `run(['show', 'T-1'], repo)` exits 0 and `out` equals
  exactly:
  ```
  T-1 Export every report of the month as one CSV file with quoted cells
  Stage: intent
  Lane: M
  Tasks: 0/2
  Branch: t/T-1
  Holder: none
  Blocked by: none

  Intent:
  Owners can export their report as CSV.

  ac-1 export writes a csv
    Given a report
    When the owner exports it
    Then a csv file is written
    And the file name is the report name followed by the month and the extension csv
    State: passing
    Test: export#writes-csv
    Test result: passed
    Ticked: no
    Verification: none

  ac-2 commas are escaped
    Given a cell with a comma
    When the owner exports it
    Then the cell is quoted
    State: passing
    Test: export#escapes-commas
    Test result: passed
    Ticked: no
    Verification: none
  ```
  with one trailing newline, and `out` holds neither `...` nor `…`.
- `it('ac-2 accord show json gives the same detail as data')`: `run(['show', 'T-1', '--json'], repo)` exits 0 and
  `JSON.parse(out)` equals `{ id: 'T-1', title: LONG, stage: 'intent', lane: 'M', tasksDone: 0, tasksTotal: 2, branch:
  't/T-1', holder: null, blockedBy: [], intent: ['Owners can export their report as CSV.'], criteria: [ { id: 'ac-1',
  title: 'export writes a csv', steps: ['Given a report', 'When the owner exports it', 'Then a csv file is written',
  STEP], label: 'passing', test: 'export#writes-csv', testResult: 'passed', ticked: false, verification: null }, {
  id: 'ac-2', title: 'commas are escaped', steps: ['Given a cell with a comma', 'When the owner exports it', 'Then the
  cell is quoted'], label: 'passing', test: 'export#escapes-commas', testResult: 'passed', ticked: false,
  verification: null } ] }`.
- `it('risk:security show text turns control and bidi characters into spaces')`: a ticket whose title is written in
  YAML as `"Bad\u001b[31m x\u202ey"` (a double-quoted escape): the first line of `run(['show', 'T-1'])` is `T-1 Bad
  [31m x y`; with `--json` the `title` holds U+001B and U+202E as written. `run(['show', 'NOPE'])` exits 2 with
  `no ticket NOPE in accord/tickets/` on `err`, and a ticket without `lane:` exits 2 (both through `requireLaneTicket`).

Interface:
- `packages/cli/src/commands/show.ts` (new): `show(ctx: CommandContext, id: string, options: { json?: boolean }):
  number`. It calls `requireLaneTicket(ctx, id)` (unknown id or no `lane:` is a `UsageError`, exit 2), then
  `ticketDetail(ctx.snapshot, id)`, which is defined for every ticket that passes; it writes `JSON.stringify(d, null,
  2) + '\n'` under `--json`, else the text above, and returns 0. The text: the line `<id> <title>`, the six fact
  lines of the preamble, a blank line, `Intent:`, each Intent line (or `none` when there is none), then per criterion
  a blank line, `<id> <title>` (the title alone when `id` is `null`), each step indented two spaces, then the five
  criterion fact lines indented two spaces. Every printed string has each code point for which `isUnsafe` is true
  replaced by one space; nothing is cut, collapsed or trimmed.
- `packages/cli/src/render/dashboard.ts`: `isUnsafe` becomes `export const isUnsafe`; nothing else in the file
  changes, so the table's 60-character title cut stays.
- `run.ts`: `program.command('show <id>').description("print one lane ticket in full: its row facts, Intent, and each
  criterion with its state").option('--json', 'print the TicketDetail object instead of text')`, its action
  `setCode(show(preflight(opts), id, options))`, registered after `anchor`.
- `packages/cli/test/skill-commands.test.ts`: the `REAL` list gains `'show'` between `'review-package'` and
  `'skills sync'`; nothing else in the file changes.

Must not change: every other command's output and exit codes; `renderDashboard` and `dashboard.test.ts`.

## Task 3: Pressing a row's id opens its detail view, which holds the row's button and Back
covers: @ac-4, D-01, D-02, D-09
files: packages/core/panel/view.js, packages/core/panel/register.js, packages/core/src/generated/panel.ts, packages/core/test/panel.test.ts
verify: packages/core/test/panel.test.ts#ac-4-pressing-a-row-id-opens-its-detail-view-with-its-button-and-back (@ac-4)

From Task 2: `accord show <id> --json` prints one `TicketDetail` object (preamble). This task draws the detail when
the run exits 0 with that object; Task 4 handles a failed or malformed run, re-runs after a turn, and the wrapping.

Tests first, in `packages/core/test/panel.test.ts`:
- Fake host: add `h.row(s)`, the props of the nearest ancestor `Box` with `flexDirection: 'row'` of the first `Text`
  whose joined `children` equal `s` (the walk keeps a stack of ancestors), because an id `Text` now sits inside a
  `Button` inside the id box, so `h.cell(id).row` is the id box.
- A module-level `detailOf(over)` builder: `{ id: 'ST-1', title: 'Login form', stage: 'build', lane: 'M', tasksDone:
  1, tasksTotal: 3, branch: 't/ST-1', holder: 'me@x', blockedBy: [], intent: ['Owners log in.'], criteria: [{ id:
  'ac-1', title: 'Logs in', steps: ['Given a user', 'When they log in', 'And they see the home page'], label:
  'passing', test: 'a#b', testResult: 'passed', ticked: false, verification: null }], ...over }`.
- `it('ac-4 pressing a row id opens its detail view with its button and back')`: open and settle `twoRows` (YOURS
  ST-1, READY ST-2). Before any press: `h.buttons()` keys are exactly `['show:ST-1', 'show:ST-2']` (no row holds
  Continue or Pick up); each of those Buttons has `plain: true`, `label` its id, and `children` one `Text` with
  `underline: true`, `bold: true`, `color: 'suggestion'` and children `[id]`; the `Text` nodes with `underline: true`
  are exactly those two. Press `show:ST-1`: `$.process.run` was last called with `['npx', '--yes',
  '@accord-dev/accord@9.9.9', 'show', 'ST-1', '--json']` and `{ timeoutMs: 120000 }`, and `$.command.run` was not
  called. Settle with `JSON.stringify(detailOf())`: under `vi.waitFor` `h.texts()` contains `Login form`, `Stage:
  build`, `Lane: M`, `Tasks: 1/3`, `Branch: t/ST-1`, `Holder: me@x`, `Blocked by: none`, `Intent`, `Owners log in.`,
  `ac-1 Logs in`, `Given a user`, `And they see the home page`, `State: passing`, `Test: a#b`, `Test result: passed`,
  `Ticked: no`, `Verification: none`; the buttons are exactly `back` (label `Back`) and `continue:ST-1` (label
  `Continue`), and no `Input` is drawn. Press `continue:ST-1`: `$.command.run` was called once, with `{ command:
  'accord', args: 'continue ST-1' }`. Note the `$.process.run` call count, press `back`: under `vi.waitFor` a text
  holds `YOURS` and one holds `ST-2`, the `Input` is drawn again, and the call count is unchanged.
- Existing tests, rewritten as the approved Approach says (names unchanged, each assertion kept unless named here):
  - `ac-2 search narrows the rows and each button runs its accord command`: each row press becomes press
    `show:<id>`, settle `detailOf({ id: <id> })`, wait for the detail's button, press it, then press `back`; the
    `continue:ST-1` and `pick-up:ST-2` assertions on `$.command.run` stay as they are; the search part is unchanged.
  - `risk:security a row whose id has spaces or a pipe is shown with no button`: the expected keys become
    `['show:ST-1']`.
  - `risk:regression each row draws as fixed-width cells ...`: `h.cell('ST-3').row` and `h.cell('EP-1').row` become
    `h.row('ST-3')` and `h.row('EP-1')` (in `widthsHold` too); `cell('ST-3').row` then has three children like
    `EP-1`; the two `buttonBox` lines become `expect(h.buttonBox('show:ST-10')).toEqual({ width: 5, flexShrink: 0,
    children: undefined })` and the same for `show:ST-7`; the last key list becomes `['show:ST-10', 'show:ST-3',
    'show:ST-11', 'show:ST-7', 'show:ST-8']`.

Interface:
- `view.js`: the YOURS, TEAM, READY and UP NEXT row mappers give a row whose id passes `SAFE_ID` an `open: { key:
  'show:<id>', id, action? }` instead of `action`: `action` is today's `act('continue', 'Continue', id)` in YOURS and
  `act('pick-up', 'Pick up', id)` in READY and UP NEXT, absent in TEAM. EPICS rows and ids failing `SAFE_ID` get no
  `open`. YOURS still clears `who`. New export `actionFor(state, id)`: `undefined` unless `state?.dashboard` is set;
  else the `open.action` of the first row with that `id` in `view(state, '').sections`, or `undefined` when no such row
  has one. The detail's action is always read through `actionFor` from the current dashboard state at draw time, never
  stored when the detail opens, so it follows the latest dashboard run. New export `detailView(detail)` where `detail`
  is `{ id, action?, state? }`:
  `state` `undefined` gives `{ back, action, message: ['Loading…'] }`; `state.ticket` gives `{ back, action, title,
  facts, intent, criteria }` with `back` `{ key: 'back', label: 'Back' }`, `facts` the six preamble fact lines, each
  criterion `{ head: '<id> <title>' (the title alone when id is null), steps, facts: ['State: <label>', ...the four
  criterion fact lines] }`, every string through `clean`. New export `detailOutcome(result)`: exit 0 gives `{ ticket:
  JSON.parse(stdout) }`.
- `register.js`: module state `detail` (`undefined` while the dashboard shows). A top-level `async function
  openDetail($, open)` sets `detail = { id: open.id }`, invalidates `ui.render`, then sets
  `detail.state = detailOutcome(await $.process.run(['npx', '--yes', 'ACCORD_PACKAGE_SPEC', 'show', open.id,
  '--json'], { timeoutMs: 120000 }))` and invalidates again. In a dashboard row the id box holds `Button({ key:
  open.key, label: open.id, plain: true, onPress: () => void openDetail($, r.open), children: [Text({ bold: true,
  underline: true, color: 'suggestion', children: [r.id] })] })`; a row without `open` keeps `Text({ bold: true,
  children: [r.id] })`; no row draws an action Button. With `detail` set, the render hook draws `detailView({
  ...detail, action: actionFor(state, detail.id) })` instead of the dashboard: a row `Box({ flexDirection: 'row', columnGap: 2 })` of `Button({ key: 'back', label:
  'Back', onPress })`, whose `onPress` sets `detail = undefined` and invalidates `ui.render` (no run), then the action
  `Button({ key, label, onPress: run(args) })` when present; then `Text({ bold: true })` of the title, a `Text` per
  fact, a `Box({ marginTop: 1 })` holding `Text({ bold: true, color: 'cyan' })` of `Intent`, a `Text` per intent line,
  and per criterion a `Box({ marginTop: 1 })` holding `Text({ bold: true })` of its head, a `Text` per step and a
  `Text({ dimColor: true })` per fact. A message state draws a `Text` per line. No `Input` in the detail.
- Then `npm run gen` (it rewrites `packages/core/src/generated/panel.ts`) and `npm run build -w packages/core`.

Must not change: the dashboard run and its argv, one dashboard run at a time, the stale-pane refresh, both toasts;
the search filter and the `Input` carrying `value: query`; `clean`, `SAFE_ID`, the column widths, the title
`Text({ wrap: 'truncate' })` of the table; the ac-1, ac-3 and other risk tests of `panel.test.ts`.

## Task 4: The detail view wraps whole text, survives a failed run, and stays current after a turn
covers: @ac-5, D-08
files: packages/core/panel/view.js, packages/core/panel/register.js, packages/core/src/generated/panel.ts, packages/core/test/panel.test.ts
verify: packages/core/test/panel.test.ts#ac-5-the-detail-view-wraps-long-text-whole-while-the-table-keeps-its-cut (@ac-5), packages/core/test/panel.test.ts#risk:complex-branching-a-failed-or-malformed-show-run-shows-a-message-with-back, packages/core/test/panel.test.ts#risk:concurrency-an-open-detail-reruns-show-after-a-turn-and-drops-a-result-for-a-closed-one, packages/core/test/panel.test.ts#risk:security-detail-text-cannot-put-control-characters-into-the-pane

From Task 3: `view.js` exports `actionFor`, `detailView` and `detailOutcome`; `register.js` holds `detail` and `openDetail($,
open)`; the test file has `detailOf`, `h.row` and the `show:<id>` keys.

Tests first, in `packages/core/test/panel.test.ts`:
- Fake host, changed first: `pending` and `failers` become one queue `runs: { res, rej }[]`; `$.process.run` pushes
  one `{ res, rej }` pair, `settle` shifts the oldest pair and calls its `res`, `fail` shifts the oldest pair and
  calls its `rej`, and `inflight()` is `runs.length`. Each existing caller keeps its order (every existing test
  settles or fails the oldest run, as now); today `settle` shifts only `pending` and `fail` only `failers`
  (lines 36-37, 48-49, 95), so a `fail` after a settled dashboard run would reject that stale promise instead of the
  `show` run.
- `it('ac-5 the detail view wraps long text whole while the table keeps its cut')`: `LONG = 'Title '.repeat(40).trim()`,
  `STEP = 'Given ' + 'word '.repeat(40).trim()` and `TEST = 'a#' + 'x'.repeat(118)` (each wider than the 110-column
  pane). Settle a dashboard whose YOURS row is `{ id: 'ST-1', title: LONG }`; press `show:ST-1`; settle `detailOf({
  title: LONG, criteria: [{ ...detailOf().criteria[0], steps: [STEP], test: TEST }] })`. The `Text` nodes whose
  children join to `LONG`, to `STEP` and to `'Test: ' + TEST` are each exactly one, each has `children` equal to one
  string (`[LONG]`, `[STEP]`, `['Test: ' + TEST]`) and `wrap: 'wrap'`; every `Text` node drawn in the detail has `wrap:
  'wrap'`; no text holds `\n`, `...` or `…`. Press `back`: `h.cell(LONG).text.wrap` is `'truncate'`.
- `it('risk:complex-branching a failed or malformed show run shows a message with back')`, one fresh panel per case,
  each opened from `show:ST-1` of `twoRows`: exit 2 with stderr `npm warn x\nno ticket ST-1 in accord/tickets/\n`
  shows texts holding `no ticket ST-1 in accord/tickets/` and buttons exactly `back`; a rejected run
  (`h.fail(new Error('timed out'))`) shows `accord did not finish: timed out`; exit 0 with stdout `not json`, `{}`, and
  the JSON of `detailOf({ criteria: [{ steps: 'x' }] })` each show `accord show --json printed no ticket`. In each,
  pressing `back` shows the dashboard (a text holds `ST-2`) with no new `$.process.run` call.
- `it('risk:concurrency an open detail reruns show after a turn and drops a result for a closed one')`: open the
  detail of ST-1 and settle it. `fire('turn.complete', { reason: 'answer' })`: two new `$.process.run` calls, the
  dashboard argv and the `show ST-1 --json` argv. Settle both, the show result with `detailOf({ title: 'Renamed'
  })`: a text holds `Renamed`. A subagent turn (`agentId: 'a1'`) starts no run. Then fire `turn.complete`, press
  `back` before settling, settle both: the dashboard is shown and no text holds `Renamed` or `Stage: build`. Open
  ST-1 again, press `back` and open ST-2 while ST-1's run is pending; settling ST-1's run with `detailOf({ title:
  'Old' })` leaves no text holding `Old`, and settling ST-2's with `detailOf({ id: 'ST-2', title: 'Export' })` shows
  `Export` with the button `pick-up:ST-2`. Last, the action follows the refreshed dashboard: fire `turn.complete`,
  settle the dashboard run with `board({ yours: { rows: [{ id: 'ST-2', title: 'Export' }], more: 0 } })` and the show
  run with `detailOf({ id: 'ST-2', title: 'Export' })`: the button keys are exactly `['back', 'continue:ST-2']`.
- `it('risk:security detail text cannot put control characters into the pane')`: settle a detail whose title,
  one intent line, one step and `holder` each hold `\u001b[31m`, `\u202e` and `\u2028`: no text holds U+001B, U+202E
  or U+2028.

Interface:
- `view.js` `detailOutcome(result)`: a non-zero exit gives the same `{ message }` as `outcome` (stderr lines not
  starting `npm `, trimmed, else `accord exited <code>`; factor that into one shared function); exit 0 gives `{ ticket
  }` only when stdout parses to a plain object whose `id`, `title`, `stage`, `lane` and `branch` are strings,
  `tasksDone` and `tasksTotal` numbers, `holder` a string or `null`, `blockedBy` and `intent` arrays of strings, and
  `criteria` an array of plain objects each with `title` and `label` strings, `steps` an array of strings, `id`,
  `test`, `testResult` and `verification` each a string or `null`, and `ticked` a boolean; otherwise `{ message:
  'accord show --json printed no ticket' }`. `detailView` gives a message state `{ back, message: <its lines through
  clean> }` with no action.
- `register.js`: `openDetail` sets `detail` and calls a new top-level `async function loadDetail($)`, which has its
  own `detailRunning` and `detailAgain` flags shaped like `refresh`'s `running` and `again`; each pass reads `const id
  = detail?.id`, stops when it is `undefined`, runs `show <id> --json`, catches a rejection into `failure(err)`, and
  stores the result only when `detail?.id === id` still holds, then invalidates `ui.render`. `turn.complete` on a
  placed pane, with no `agentId`, runs `refresh($)` and, when `detail` is set, `loadDetail($)`; a stale pane does
  both on its next draw. Every `Text` the detail view draws (the title, each fact, `Intent`, each intent line, each
  criterion head, step and fact, and each message line) carries `wrap: 'wrap'` and its string as the one child, with
  no line break added. A message state draws its lines and the Back button only. The action Button stays read through
  `actionFor(state, detail.id)` at each draw (Task 3), so after `refresh` stores a new dashboard the open detail shows
  that dashboard's Continue or Pick up, or none.
- Then `npm run gen` and `npm run build -w packages/core`.

Must not change: everything Task 3 lists, the ac-4 test, and the table title's `wrap: 'truncate'`.

## Task 5: This repository carries the regenerated panel and the design doc names accord show
covers: D-01, D-07
files: .claude/accord-panel/plugin/hooks/register.js, .claude/accord-panel/plugin/hooks/view.js, docs/design.md, packages/cli/test/skills-sync.test.ts
verify: packages/cli/test/skills-sync.test.ts#risk:regression-the-committed-panel-hooks-match-what-skills-sync-renders

From Tasks 1 to 4: the panel sources and `accord show`. The pane's live check of @ac-4 and @ac-5 reads the committed
copies under `.claude/accord-panel/`, so they must be the rendered sources.

Test first, in `packages/cli/test/skills-sync.test.ts`, beside `risk:regression the committed panel and settings
carry the plugin`:
- `it('risk:regression the committed panel hooks match what skills sync renders')`: for `register.js` and `view.js`
  under `.claude/accord-panel/plugin/hooks/`, read from the repository root through `new URL('../../../<path>',
  import.meta.url)`, `withoutMarker(normaliseText(text))` equals `withoutMarker(t.text)` of the entry `t` of
  `pluginTargets({ runtimes: ['claude'] }, pkg)` with the same path (`pkg` as that file already imports it). It fails
  before the sync below, since the committed copies predate Tasks 3 and 4.

Then run, in order: `npm run gen`, `npm run build`, and from the repository root `node packages/cli/dist/cli.js
skills sync`, which rewrites the two hook files and reports every other path `unchanged`. Commit those files with
the task.

`docs/design.md`, section 7's command block: after the `accord dashboard` line add `accord show <id>            #
one lane ticket in full: row facts, Intent, each criterion and its state; --json for the data`, its `#` aligned with
the lines above. Then `npm run check`.

Must not change: every other file under `.claude/` and `accord/config.yml`; the existing committed-panel test.
