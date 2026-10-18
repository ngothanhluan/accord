---
baseline: 385361f43127e6110c285effba93fa6bd6700883
plan_hash: "fnv1a64:8a2c385290e30992"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

External reference the repository does not hold, read where a task cites it: the Claude Code mods type file
`C:/Users/LUANNG~1/AppData/Local/Temp/claude/C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/scratchpad/mods-docs/claude-code.d.ts`
(cited below as d.ts:<line>). `InputProps` is at d.ts:4602-4644: `label` is "Text drawn before the field"
(d.ts:4608-4610); the next field, documented "Text drawn dim in an empty field" (d.ts:4611-4614), is called the
dim-hint prop below (its name is the word made of "place" and "holder"); `autoFocus?: true` (d.ts:4625-4633) makes
the focus ring start on the field whenever the pane takes the keyboard, the first drawn wins, and a ring the person
has moved stays where it was put.

Rulings taken while planning (the main session records them in the ledger):
- Ruling: while the dashboard loads, the search Input is drawn above the "Loading…" line, the same place it holds on
  the dashboard — so the field does not jump when the dashboard lands — cost if wrong: two lines swap in `register.js`.
- Ruling: the dim-hint text is written in `register.js` beside `label: 'Search'`, and the no-match line in `view.js`
  beside `newRequest` — each string sits next to the text it belongs with — cost if wrong: one string moves file.

Rules for every task:
- Test ids: every test named on a `verify:` line is a top-level `it(...)` in `packages/core/test/panel.test.ts`, no
  `describe` around it. Its report id is the file's path from the repository root, then `#`, then the `it` title with
  each whitespace run turned into `-` (packages/core/src/load/junit.ts). No title holds `@` or a comma, and no title
  equals an existing title in that file.
- `packages/core/panel/*.js` is plain ESM that Claude Code loads directly: no TypeScript, no import outside the
  folder, no Node built-in, no `process.env`. `register.js` keeps the mods static-analysis rules: event names as string
  literals, every `$` call written in full, `$` passed only to functions declared at the top level of `register.js`.
- The tests load the panel through `pluginTargets`, which reads `packages/core/src/generated/panel.ts`: after editing a
  file under `packages/core/panel/`, run `npm run gen`, then `npm run build`, then from the repository root
  `node packages/cli/dist/cli.js skills sync`, which rewrites the committed copies under
  `.claude/accord-panel/plugin/hooks/` and reports every other path `unchanged`. Commit the regenerated `panel.ts` and
  the rewritten copies with the task; `packages/cli/test/skills-sync.test.ts#risk:regression-the-committed-panel-hooks-match-what-skills-sync-renders`
  fails without them. End every task with `npm run check`.
- Files are LF with no BOM. No new dependency.

## Task 1: The search field shows its dim hint and is the one control that takes focus
covers: @ac-1, @ac-3, D-01, D-02
files: packages/core/panel/register.js, packages/core/src/generated/panel.ts, .claude/accord-panel/plugin/hooks/register.js, packages/core/test/panel.test.ts
verify: packages/core/test/panel.test.ts#ac-1-the-empty-search-field-keeps-its-Search-label-and-shows-the-dim-hint (@ac-1), packages/core/test/panel.test.ts#ac-3-the-search-field-is-the-one-control-marked-to-take-focus-on-every-draw-and-while-loading (@ac-3)

Consumes: the fake host in `panel.test.ts` (`host`, `loadPanel`, `board`, `twoRows`, `start`, `h.input()`,
`h.nodes(type)`, `h.type(text)`, `h.settle`, `h.fire`, `h.$.ui.open`). Produces: on every draw that shows the
dashboard or "Loading…", one `Input` with `key: 'search'`, `label: 'Search'`, the dim-hint prop set to
`'ticket id or title, or a new request'`, and `autoFocus: true`.

Tests first, in `packages/core/test/panel.test.ts`, after the existing `ac-3 a failing cli shows its message instead of
a dashboard` test:
- `it('ac-1 the empty search field keeps its Search label and shows the dim hint')`: `session.start`, settle a
  `board({ yours: { rows: [{ id: 'ST-1', title: 'Login form' }], more: 0 } })`, wait until a text holds `ST-1`. Then
  `h.input()` has `label` exactly `'Search'`, `value` `''`, and its dim-hint prop exactly
  `'ticket id or title, or a new request'` (read it as `h.input()?.['place' + 'holder']` or with a typed key, so the
  test text needs no lint exception; either form is fine).
- `it('ac-3 the search field is the one control marked to take focus on every draw and while loading')`: define
  `const marked = () => ['Box', 'Text', 'Button', 'Input'].flatMap((t) => h.nodes(t)).filter((n) => n.props.autoFocus === true)`.
  1. `session.start`; before any settle, `h.texts()` equals `['Loading…']`, and `marked()` is exactly one node, of
     type `Input` with `props.key === 'search'`. The first `h.$.ui.open` call's argument has no `focus` key
     (`expect(h.$.ui.open.mock.calls[0][0]).not.toHaveProperty('focus')`).
  2. Settle `twoRows`; wait for a text holding `ST-2`; `marked()` is again exactly the one search `Input`; the row
     `show:ST-1` and `show:ST-2` buttons carry no `autoFocus`.
  3. Record `h.$.ui.open.mock.calls.length`; `h.type('log')`; fire `turn.complete` with `{ reason: 'answer' }` and
     settle `twoRows`; wait until a text holds `ST-1`. `marked()` is still exactly the one search `Input`, and
     `h.$.ui.open` has no new call (a redraw never reopens the pane to take the keyboard).
  4. Fire `command.run` with `{ command: 'accord-panel' }`: the last `h.$.ui.open` call carries `focus: true`, and after
     settling its dashboard run `marked()` is exactly the one search `Input`.

Change in `packages/core/panel/register.js`, inside the `ui.render` hook's dashboard branch:
- Build the search `Input` in one local function (for example `const search = () => Input({ ... })`) holding
  `key: 'search'`, `label: 'Search'`, the dim-hint prop `'ticket id or title, or a new request'`, `autoFocus: true`,
  `value: query`, and the existing `onInput` and `onSubmit` unchanged.
- In the `v.message` branch, when `state === undefined` (the "Loading…" state), push `search()` before the message
  lines; a failed or malformed run (`state.message` set) still pushes no `Input`. In the dashboard branch, push
  `search()` where the `Input` is pushed today.
- No other element gets `autoFocus`. The `session.start` open keeps no `focus`; the `/accord-panel` open keeps
  `focus: true`.
- Then `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`, `npm run check`.

Must not change: the existing tests in `panel.test.ts`, among them `ac-1 the pane shows the dashboard json on open and
after each turn` (texts equal `['Loading…']` before the first run ends), `ac-3 a failing cli shows its message instead
of a dashboard` (no `Input` after a failed run), `ac-4 pressing a row id opens its detail view with its button and
back` (no `Input` in the detail view) and `risk:concurrency a redraw from a finished run keeps what the owner typed`
(the `Input` carries `value: query` on every draw); the dashboard run and its argv, one run at a time, the stale-pane
refresh, both toasts; `view.js`.

## Task 2: Text that matches no ticket says so and points to New request
covers: @ac-2, @ac-4, D-01, D-03, D-04, D-05, D-06
files: packages/core/panel/view.js, packages/core/panel/register.js, packages/core/src/generated/panel.ts, .claude/accord-panel/plugin/hooks/view.js, .claude/accord-panel/plugin/hooks/register.js, packages/core/test/panel.test.ts
verify: packages/core/test/panel.test.ts#ac-2-text-that-matches-no-ticket-shows-the-no-match-line-and-New-request (@ac-2)

From Task 1: the search `Input` built by `search()` in `register.js`, carrying the dim hint and `autoFocus`.

Consumes: `view(state, query)` in `view.js`, which already drops every section with no matching row when the trimmed
query is non-blank and returns `newRequest` when it is non-blank. Produces: `view()` also returns
`noMatch: 'No ticket shown here matches. Press New request to send this text to /accord.'` exactly when the trimmed
query is non-blank and `sections` is empty; `register.js` draws it as `Text({ children: [v.noMatch] })` right after
the search `Input` and before the New request `Button`.

Test first, in `packages/core/test/panel.test.ts`, after the Task 1 tests:
- `it('ac-2 text that matches no ticket shows the no-match line and New request')`: `session.start`, settle
  `twoRows` (ST-1 "Login form" under YOURS, ST-2 "Export" under READY), wait for a text holding `ST-2`. Let
  `LINE = 'No ticket shown here matches. Press New request to send this text to /accord.'` and
  `HEADINGS = ['YOURS', 'TEAM', 'READY', 'UP NEXT', 'EPICS']`.
  1. `h.type('zzz')`, then wait until: no text equals any of `HEADINGS`; no text holds `ST-1` or `ST-2`; no button key
     starts with `show:`; `h.texts()` contains `LINE`; a button has key `new-request` and label `New request`.
  2. `h.type('login')`, then wait until: the texts equal to a member of `HEADINGS` are exactly `['YOURS']`; a text holds
     `ST-1` and none holds `ST-2`; the button keys starting with `show:` are exactly `['show:ST-1']`; the
     `new-request` button is shown; no text equals `LINE`.

Change:
- `packages/core/panel/view.js` `view()`: add `noMatch` to the returned object under the condition above, next to the
  `newRequest` spread, with the line verbatim. The filter stays on id and title only (`keep`), and on the rows the
  dashboard JSON holds; nothing else in `view()` changes.
- `packages/core/panel/register.js`: in the dashboard branch, after `children.push(search())`, push the `Text` when
  `v.noMatch` is set.
- Then `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`, `npm run check`.

@ac-4 and D-06 are proven by the owner on the real panel built from this branch, which reads the committed copies
under `.claude/accord-panel/plugin/hooks/`; this task's sync leaves those copies equal to the sources, so every part
of D-01 (dim hint, the hint naming a new request, the no-match line, `autoFocus`) is in the panel the owner opens. No
test is written for @ac-4.

Must not change: the existing tests in `panel.test.ts`, among them `ac-2 search narrows the rows and each button runs
its accord command` (New request stays shown while a ticket matches, and runs `/accord <text>`); the column widths, read
over every row before the filter; `actionFor`, `outcome`, `failure`, `clean`, `SAFE_ID`; everything Task 1 lists
except `view.js`.
