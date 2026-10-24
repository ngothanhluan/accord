---
baseline: 1d635b5277fa10c77b89c3eba8108cb877065060
plan_hash: "fnv1a64:6b1b8a6871b524ab"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

External references the repository does not hold. Read the ones a task names before writing code:
- `C:/Users/LUANNG~1/AppData/Local/Temp/claude/C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/scratchpad/ST-LN-3-mods-facts.md`:
  verified facts on Claude Code mods (plugin layout, project-level install through settings, `$.command.run`).
- `C:/Users/LUANNG~1/AppData/Local/Temp/claude/C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/scratchpad/mods-docs/claude-code.d.ts`:
  the mods type declarations (event inputs `SessionStartInput`, `TurnCompleteInput`, `RenderInput`; element props
  `Box`, `Text`, `Button`, `InputProps`; `$.command.run`, `$.command.register`, `$.process.run` with
  `ProcessRunInit`/`ProcessRunResult`, `$.ui.open`, `$.ui.panes`, `$.ui.invalidate`, `$.ui.resolve`). Beside it:
  `api.md`, `interface.md`, and `create.md`, whose "Follow these rules so that static analysis can find every hook
  and call" list binds `register.js` (event names as string literals; every `$` call written in full; `$` passed
  only to a function declared at the top level of the same file, never to an imported one; no dynamic `import()`;
  relative imports only).
- `C:/Users/LUANNG~1/AppData/Local/Temp/claude/C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/scratchpad/ST-LN-3-architect.md`:
  the architect's impact list with file:line.
- `C:/Work/accord-panel-spike/.claude/accord-panel/` : a working hand-written mod (`.claude-plugin/marketplace.json`,
  `plugin/.claude-plugin/plugin.json`, `plugin/hooks/hooks.json`, `plugin/hooks/register.js` using a Pane, Buttons
  and `$.command.run`). It is the model for the shape of the files Task 1 writes.

Rules for every task:
- Test ids: every test named on a `verify:` line is a top-level `it(...)` with no `describe` around it. Its report
  id is the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`. No test title
  holds `@` or a comma.
- CLI tests import core from `packages/core/dist`: after changing anything under `packages/core/`, run
  `npm run gen` (when a file under `packages/core/panel/` or `packages/core/skills/` changed) and then
  `npm run build -w packages/core` before running any test. Run one file with `npx vitest run <path>`. End every
  task with `npm run build`, `npm run lint` and `npm run typecheck`, then the test files the task names.
- Files are LF with no BOM. No new dependency. Strings are compared in code-point order, never with
  `localeCompare`. No control character appears in a regular expression (eslint `no-control-regex`); scan code
  points instead.
- `packages/core/panel/*.js` is plain ESM that Claude Code loads directly: no TypeScript, no import outside the
  folder, no Node built-in, no `process.env`.

Definitions shared by every task:
- The plugin lives at `.claude/accord-panel/` (`pluginDir`): marketplace `accord` at
  `.claude/accord-panel/.claude-plugin/marketplace.json`, plugin `accord-panel` under `.claude/accord-panel/plugin/`
  with `.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.js` and `hooks/view.js`.
- The panel settings: `extraKnownMarketplaces.accord` equal to `{ "source": { "source": "directory", "path":
  "./.claude/accord-panel" } }`, and `enabledPlugins["accord-panel@accord"]` equal to `true`.
- The package spec is the CLI package's `name`, `@`, and its `version` (`@accord-dev/accord@0.1.0` today). The
  source `register.js` holds the literal `'ACCORD_PACKAGE_SPEC'`; rendering replaces `ACCORD_PACKAGE_SPEC` with the
  package spec, so the mod runs `npx --yes <package spec> dashboard --json` and reads nothing else (D-04).
- The pane id and the command it registers are both `accord-panel`. A button calls `$.command.run({ command:
  'accord', args })`: Continue `args` `continue <id>`, Pick up `pick-up <id>`, New request the trimmed search text.
- The fake host (Task 1, in `packages/core/test/panel.test.ts`) follows `claude-code.d.ts`: `on(event, matcher?,
  handler)` hooks; `fire(event, e)` runs the hooks of `event` whose matcher keys all equal the same keys of `e`, in
  registration order, each `next` calling the one after and the last resolving to `e`; `$.ui.resolve()` gives `Box`,
  `Text`, `Button`, `Input` factories returning `{ type, props }`; `$.ui.open` resolves `undefined` (it is
  `Promise<void>`, d.ts:2170); `$.ui.panes()` resolves every open pane as a `UiPane` `{ id, title, isShown,
  isFocused, isPlaced }`, `isPlaced` taken from `host.placed` (default `true`); `$.ui.toast(text, options?)` is a
  `vi.fn` returning `undefined`; the pane is drawn by firing `ui.render` with
  `{ component: 'Pane', requestId: 'accord-panel', surface: 'terminal' }` only on `$.ui.open` and on
  `$.ui.invalidate('ui.render')`; as interface.md:647 and `InputProps.value` say, a drawn `Input` holds its `value`
  (empty when drawn without one), and `host.type(text)` replaces the field's text only until the next draw;
  `host.field()` is the field's current text.

## Task 1: Wiring: the generated mod opens a pane that shows the dashboard JSON and refreshes after each turn
covers: @ac-1, D-01, D-04, D-06, D-09
files: packages/core/src/skills/render.ts, packages/core/scripts/gen-panel.mjs (new), package.json, packages/core/panel/view.js (new), packages/core/panel/register.js (new), packages/core/src/generated/panel.ts (new), packages/core/src/skills/plugin.ts (new), packages/core/src/index.ts, packages/core/test/panel.test.ts (new)
verify: packages/core/test/panel.test.ts#ac-1-the-pane-shows-the-dashboard-json-on-open-and-after-each-turn (@ac-1), packages/core/test/panel.test.ts#risk:parsing-every-panel-file-carries-one-marker-whose-hash-recomputes, packages/core/test/panel.test.ts#risk:complex-branching-the-pane-opens-only-in-an-interactive-terminal-and-an-unplaced-pane-names-its-command

Read first: the spike mod, `create.md`'s static-analysis rules, and in `claude-code.d.ts` `SessionStartInput`
(`isInteractive`), `TurnCompleteInput` (`agentId`), `ProcessRunInit`, `ProcessRunResult` and `InputProps`.

Tests first, in `packages/core/test/panel.test.ts` (new), importing `pluginTargets`, `markerHash`, `withoutMarker`
and `contentHash` from `../src/index.js`:
- A module-level `PKG = { name: '@accord-dev/accord', version: '9.9.9' }`.
- `loadPanel()`: writes every file of `pluginTargets({ runtimes: ['claude'] }, PKG)` under a fresh `mkdtempSync`
  directory (each path split on `/`), then returns `await import(/* @vite-ignore */ pathToFileURL(<dir>/.claude/
  accord-panel/plugin/hooks/register.js).href)`. A fresh directory per call gives each test fresh module state.
  `afterEach` removes the directories.
- `host(mod)`: the fake host of the preamble. `$.process.run` is a `vi.fn` returning a promise the test settles
  through `host.settle({ exitCode, stdout, stderr })` (the oldest unsettled call first) or `host.fail(err)`;
  `$.command.register` and `$.command.run` are `vi.fn`s resolving `{}`; `$.ui.open` is a `vi.fn` that adds the id
  to an open set, draws, and resolves `undefined`; `$.ui.panes` resolves the open set as `UiPane` objects (preamble);
  `host.close(id)` removes an id; `host.texts()`
  is every `Text`'s `children` joined, in tree order; `host.buttons()` is every `Button`'s `props`; `host.input()` is
  the `Input`'s `props` or `undefined`; `host.type(text)` calls the `Input`'s `onInput(text, {})`.
- A `board(over)` builder: `{ yours: { rows: [], more: 0 }, team: { rows: [], more: 0 }, ready: { rows: [], more: 0
  }, epics: { rows: [], more: 0 }, summary: { inProgress: 0, ready: 0, blocked: 0, backlog: 0, done: 0,
  withoutLane: 0, withSchemaErrors: 0 }, ...over }`; rows are `{ id, title }`.
- `it('ac-1 the pane shows the dashboard json on open and after each turn')`: `fire('session.start', { cwd: '.',
  surface: 'terminal', isInteractive: true })`. `$.command.register` was called with `name` `accord-panel`;
  `$.ui.open` with `id` `accord-panel`; `$.process.run` once with `['npx', '--yes', '@accord-dev/accord@9.9.9',
  'dashboard', '--json']` and `{ timeoutMs: 120000 }`. Before settling, `host.texts()` is `['Loading…']`. Settle exit
  0 with the JSON of `board({ yours: { rows: [{ id: 'ST-1', title: 'Login form' }], more: 0 }, ready: { rows: [{ id:
  'ST-2', title: 'Export' }], more: 3 }, summary: { inProgress: 7, ready: 4, blocked: 2, backlog: 5, done: 1,
  withoutLane: 0, withSchemaErrors: 0 } })`. Under `vi.waitFor`: in `host.texts()`, `YOURS` comes before the text
  holding `ST-1`, which comes before `READY`, then the text holding `ST-2`, then `+3 more`; one text is exactly
  `7 in progress, 4 ready, 2 blocked, 5 backlog, 1 done` (the JSON's numbers, not the two rows counted). Then
  `fire('turn.complete', { reason: 'answer' })` with no `agentId`: `$.process.run` was called twice; settle with
  YOURS holding only `{ id: 'ST-9', title: 'Audit' }`; under `vi.waitFor` a text holds `ST-9` and none holds `ST-1`.
- `it('risk:parsing every panel file carries one marker whose hash recomputes')`: `pluginTargets({ runtimes:
  ['claude'] }, PKG)` paths are exactly the five plugin paths of the preamble, sorted; for each file `markerHash`
  is defined, `markerHash(withoutMarker(text))` is `undefined` and `contentHash(withoutMarker(text))` equals it;
  each `.json` file parses with `JSON.parse` and its `description` starts with `generated by accord skills sync`;
  `register.js` contains `'@accord-dev/accord@9.9.9'` and not `ACCORD_PACKAGE_SPEC`; `plugin.json`'s `version` is
  `9.9.9`; `pluginTargets({ runtimes: ['codex'] }, PKG)` is `[]`.
- `it('risk:complex-branching the pane opens only in an interactive terminal and an unplaced pane names its
  command')`, one fresh panel each: `session.start` with `isInteractive: false, surface: null`, and one with
  `isInteractive: true, surface: 'desktop'`: no `$.command.register`, `$.ui.open` or `$.process.run` call. With
  `host.placed = false` and `isInteractive: true, surface: 'terminal'`: `$.ui.toast` was called once with
  `Run /accord-panel to show the accord dashboard`; with the default `host.placed = true` it was not called.

Interface:
- `render.ts`: `stamp(head, body, form: 'html' | 'js' | 'json' = 'html')`. The marker line per form: `html` as
  today; `js` is `// generated by accord skills sync - do not edit - <hash>`; `json` is `  "description":
  "generated by accord skills sync - do not edit - <hash>",` (two spaces of indent). `MARKER` matches any of the
  three whole lines, with its trailing newline, capturing the hash in one group, so `markerHash` and
  `withoutMarker` serve every form. The hash input stays `head + body`.
- `packages/core/scripts/gen-panel.mjs` (new), modelled on `gen-agents.mjs`: reads `packages/core/panel/*.js`
  (not recursive, BOM stripped, CRLF to LF) and writes `src/generated/panel.ts` as `export const panel = { "<file>":
  "<text>", ... } as const;` plus `export type PanelKey = keyof typeof panel;`, with the generated header comment.
  The root `package.json` `gen` script runs it after `gen-agents.mjs`.
- `packages/core/src/skills/plugin.ts` (new), pure: `export const pluginDir = '.claude/accord-panel'` and
  `pluginTargets(config: Pick<AccordConfig, 'runtimes'>, pkg: { name: string; version: string }): SkillFile[]`, `[]`
  unless `runtimes` holds `claude`, else the five files sorted by path: `marketplace.json` `{ name: 'accord',
  owner: { name: 'accord' }, plugins: [{ name: 'accord-panel', source: './plugin', description: 'The accord
  dashboard in a Claude Code pane' }] }`; `plugin.json` `{ name: 'accord-panel', version: pkg.version, author: {
  name: 'accord' } }`; `hooks.json` `{ modules: ['./register.js'] }`; each JSON through `stamp('{\n',
  JSON.stringify(value, null, 2).slice(2) + '\n', 'json')`, so `description` is the first key; `register.js` and
  `view.js` through `stamp('', text, 'js')`, `register.js` with `ACCORD_PACKAGE_SPEC` replaced by the package spec.
  It throws an `Error` naming `ACCORD_PACKAGE_SPEC` when the source lacks it. `index.ts` exports `pluginDir` and
  `pluginTargets`.
- `packages/core/panel/view.js` (new), pure, never given `$`:
  `outcome({ exitCode, stdout })` returns `{ dashboard }` with the parsed stdout when the exit code is 0 (this task
  assumes it parses; Task 5 adds the failure paths); `view(state, query)` returns `{ message: ['Loading…'] }` when
  `state` is `undefined`, else `{ sections, summary }`. `sections`, in order: `YOURS`, `TEAM`, `READY` always,
  `UP NEXT` when `upNext` is present, `EPICS` when `epics.rows` is non-empty; each `{ heading, rows, more }`, a row
  `{ text }` where `text` is the id, then two spaces and the title when the title is non-empty (an EPICS row adds two
  spaces and `<done>/<total> done`). `summary` is `<inProgress> in progress, <ready> ready, <blocked> blocked,
  <backlog> backlog, <done> done`, then `, <n> without lane` and `, <n> with schema errors, run accord lint` when each
  is above 0: the JSON's numbers, never a count of rows.
- `packages/core/panel/register.js` (new): imports `outcome` and `view` from `./view.js`; module state `state`
  (`undefined` until the first result). A top-level `async function refresh($)` runs `$.process.run(['npx',
  '--yes', SPEC, 'dashboard', '--json'], { timeoutMs: 120000 })`, sets `state = outcome(result)`, then
  `$.ui.invalidate('ui.render')`. `register(on)` hooks: `session.start`, only when `e.isInteractive` is true
  and `e.surface === 'terminal'` (`RenderSurface` is `'terminal' | 'desktop' | 'mobile' | 'vscode'`; D-09, and
  `$.process.run` is CLI only): `$.command.register({ name: 'accord-panel', description: 'Open the accord dashboard
  pane' })`, `await $.ui.open({ id: 'accord-panel', title: 'accord' })` (it resolves nothing), then when the entry
  of `await $.ui.panes()` whose `id` is `accord-panel` has `isPlaced === false` (a pane the mod opens unasked waits
  undrawn below 144 columns, d.ts:2159-2160 and `UiPane.isPlaced`, d.ts:11160)
  `$.ui.toast('Run /accord-panel to show the accord dashboard')`; then `void refresh($)`; always `return next(e)`. `command.run` with matcher `{
  command: 'accord-panel' }`: `$.ui.open({ id: 'accord-panel', title: 'accord', focus: true })`, `void
  refresh($)`, `return {}`. `turn.complete`: when `e.agentId` is absent, `void refresh($)`; `return next(e)`.
  `ui.render` with matcher `{ component: 'Pane' }`: `next(e)` unless `e.requestId === 'accord-panel'`; else from
  `$.ui.resolve(e)` a column `Box`: a message gives one `Text` per line; otherwise per section a `Text` heading,
  then per row a `Text` of its text, `Text('none')` when it has no row, `+<more> more` when `more` is above 0, and
  last a `Text` of the summary. `Text` takes its string as `children: [text]`, as the spike does.

Must not change: every HTML marker byte `renderSkill` and `renderAgent` produce today (`skills.test.ts` and
`agents.test.ts` stay green unchanged); the generated `skills.ts`, `agents.ts` and `templates.ts`.

## Task 2: skills sync and init write the panel and enable it in .claude/settings.json for claude only
covers: @ac-5, D-02, D-03, D-04
files: packages/core/src/scaffold/panel.ts (new), packages/core/src/index.ts, packages/cli/src/commands/skills.ts, packages/cli/src/commands/init.ts, packages/cli/test/skills-sync.test.ts, packages/cli/test/init.test.ts
verify: packages/cli/test/skills-sync.test.ts#ac-5-skills-sync-installs-and-enables-the-panel-for-claude-code-only (@ac-5), packages/cli/test/skills-sync.test.ts#risk:data-loss-an-owner-false-and-other-marketplaces-survive-the-panel-merge

From Task 1: core exports `pluginDir` and `pluginTargets(config, pkg)`; every rendered panel file carries the
marker that `markerHash` and `withoutMarker` read, so `writeSkillFiles` handles them unchanged.

Tests first, in `packages/cli/test/skills-sync.test.ts`, using its `sandbox`, `setConfig`, `run`, `at` and `bytes`:
- `it('ac-5 skills sync installs and enables the panel for claude code only')`: repository A is `sandbox()` with
  `setConfig(repo, /^runtimes: .*$/m, 'runtimes: [claude]')`; `run(['skills', 'sync'], A)` exits 0. The five plugin
  paths exist, `.claude/accord-panel/.claude-plugin/marketplace.json` and
  `.claude/accord-panel/plugin/.claude-plugin/plugin.json` among them; each holds `generated by accord skills sync`
  and its `markerHash` equals `contentHash(withoutMarker(normaliseText(text)))`; `register.js` contains
  `'@accord-dev/accord@' + pkg.version`; `out` has `created <path>` for each. `.claude/settings.json` parsed has
  `extraKnownMarketplaces.accord` equal to the preamble's value, `enabledPlugins['accord-panel@accord']` `true`,
  and still three accord hook commands. A second run prints `unchanged` for the five paths and for
  `.claude/settings.json`. Repository B is `sandbox()` with `runtimes: [codex]`; after `run(['skills', 'sync'],
  B)`, neither `.claude/accord-panel` nor `.claude/settings.json` exists.
- `it('risk:data-loss an owner false and other marketplaces survive the panel merge')`: `sandbox()`, runtimes
  `[claude]`, `.claude/settings.json` written as `{ "model": "x", "enabledPlugins": { "accord-panel@accord": false,
  "x@y": true }, "extraKnownMarketplaces": { "other": { "source": { "source": "github", "repo": "o/r" } } } }`.
  After sync (exit 0): `model` is `x`; `enabledPlugins` equals `{ 'accord-panel@accord': false, 'x@y': true }`;
  `extraKnownMarketplaces.other` is unchanged and `extraKnownMarketplaces.accord` equals the preamble's value.
  Then a second sandbox, runtimes `[claude]`, `.claude/settings.json` written as `JSON.stringify({ hooks:
  hookEntries(pkg), enabledPlugins: { 'x@y': true } })` (the current accord hooks, so only the panel keys differ;
  `hookEntries` from `@accord-dev/accord-core`): sync prints `updated .claude/settings.json`, and the file then has
  `enabledPlugins` equal to `{ 'x@y': true, 'accord-panel@accord': true }` and `extraKnownMarketplaces.accord`.
- `packages/cli/test/init.test.ts`: `skillPaths` appends `...pluginTargets(<the same parsed config>, pkg).map((t) =>
  t.path)` after the agent paths (import `pluginTargets` from `@accord-dev/accord-core`), so the whole-report cases
  `runs in a repository with no accord/ folder...` and `reports every scaffold path skipped...` expect the panel
  files, in that order, before `.claude/settings.json`. No other line of those cases changes.

Interface:
- `packages/core/src/scaffold/panel.ts` (new), pure: `panelSettings` (the two preamble keys as one object, for the
  by-hand messages) and `mergePanel(existing: Record<string, unknown>): Record<string, unknown>`: throws
  `TypeError('settings is not a JSON object')` when `extraKnownMarketplaces` or `enabledPlugins` is present and not
  a plain object; otherwise returns a new top-level object whose `extraKnownMarketplaces` and `enabledPlugins` are
  new objects spread from the existing ones (never a write into the parsed objects: `mergeHooks` copies only the top
  level and `planHooks` decides `unchanged` by comparing the merge with `parsed`), with
  `extraKnownMarketplaces.accord` added when absent and `enabledPlugins['accord-panel@accord']: true` added only when
  that key is absent; an existing key keeps its value
  (Task 3 refuses an `accord` marketplace with another source). Every other key and the key order survive.
  `index.ts` exports both. The marketplace path is `'./' + pluginDir`.
- `skills.ts`: `planHooks` keeps its name and signature and merges `mergePanel(mergeHooks(parsed, entries))`, for a
  new file from `{}`; `skills()` adds `...pluginTargets(config, pkg)` after the agent targets, so the link guard
  pre-pass covers them before any write.
- `init.ts`: `refusals` takes `[...skillTargets(snapshot.config), ...(extra ?? [...agentTargets(snapshot.config),
  ...pluginTargets(snapshot.config, pkg)])]`; the greenfield list (today `greenfieldAgents`) becomes
  `[...agentTargets(written), ...pluginTargets(written, pkg)]`, guarded by `assertNoLink` before the scaffold loop as
  today. Both init paths therefore write the panel and its settings when `runtimes` holds claude.

Must not change: every existing `skills-sync.test.ts` and `init.test.ts` case other than the `skillPaths` helper;
the hook entries and their order; a settings file that needs no change stays unwritten (`unchanged`, same mtime);
no settings file without the claude runtime; `writeSkillFiles`' four statuses.

## Task 3: Settings the panel cannot merge are refused before any write, and a dropped panel is reported
covers: D-02, D-03
files: packages/core/src/scaffold/panel.ts (new), packages/cli/src/commands/skills.ts, packages/cli/test/skills-sync.test.ts
verify: packages/cli/test/skills-sync.test.ts#risk:data-loss-settings-accord-cannot-merge-are-refused-before-any-write, packages/cli/test/skills-sync.test.ts#risk:data-loss-a-dropped-claude-runtime-reports-the-panel-as-an-orphan-and-deletes-nothing

From Task 2: `mergePanel`, `panelSettings`, `planHooks` merging hooks then the panel keys, and `skills()` writing
`pluginTargets` after the agents.

Tests first, in `packages/cli/test/skills-sync.test.ts`:
- `it('risk:data-loss settings accord cannot merge are refused before any write')`: (a) `sandbox()`, runtimes
  `[claude]`, `.claude/settings.json` holding `{ "extraKnownMarketplaces": { "accord": { "source": { "source":
  "github", "repo": "o/r" } } } }`: sync exits 2, `err` contains `extraKnownMarketplaces` and
  `accord-panel@accord`, the settings bytes are unchanged, and `.claude/accord-panel` does not exist. (b) a second
  sandbox with `.claude/settings.json` as `{ not json`: exit 2, `err` contains `Add these hooks by hand` and
  `accord-panel@accord`, bytes unchanged.
- `it('risk:data-loss a dropped claude runtime reports the panel as an orphan and deletes nothing')`: `sandbox()`,
  runtimes `[claude]`, sync; then runtimes `[codex]`, sync exits 0; `err` has one line starting `orphan
  .claude/accord-panel ` that contains `rm -rf .claude/accord-panel`, `extraKnownMarketplaces.accord` and
  `enabledPlugins["accord-panel@accord"]`; `.claude/accord-panel/plugin/hooks/register.js` still exists and
  `.claude/settings.json` is byte-identical to before the second run.

Interface:
- `mergePanel` throws `RangeError` when `extraKnownMarketplaces.accord` exists and its `source.source` is not
  `directory` or its `source.path` is not `./.claude/accord-panel` (compared field by field, so key order and other
  keys do not matter); it is never overwritten.
- `planHooks`: the not-a-JSON-object message keeps its text and appends `'\nand these keys for the accord panel:\n'
  + JSON.stringify(panelSettings, null, 2)`. A `RangeError` becomes `UsageError(SETTINGS + ' already declares a
  marketplace named accord with another source; nothing was written. Rename it, then add these keys for the accord
  panel by hand:\n' + JSON.stringify(panelSettings, null, 2))`.
- `orphans()`: when `scannable(root, pluginDir)` and `pluginTargets(config, pkg)` is empty, `pluginDir` is an
  orphan. Its stderr line is the usual orphan line followed by ` - then remove extraKnownMarketplaces.accord and
  enabledPlugins["accord-panel@accord"] from .claude/settings.json`. Nothing is deleted.

Must not change: the existing refusal cases (`Add these hooks by hand`, `hook session-start`, exit 2, bytes
unchanged, no skill file written); the orphan lines for skill directories and agent files; exit 0 with orphans.

## Task 4: Search narrows the rows and each button runs its /accord command
covers: @ac-2, D-05, D-07
files: packages/core/panel/view.js (new), packages/core/panel/register.js (new), packages/core/src/generated/panel.ts (new), packages/core/test/panel.test.ts (new)
verify: packages/core/test/panel.test.ts#ac-2-search-narrows-the-rows-and-each-button-runs-its-accord-command (@ac-2), packages/core/test/panel.test.ts#risk:concurrency-a-redraw-from-a-finished-run-keeps-what-the-owner-typed

From Task 1: `loadPanel`, `host` and `board` in `packages/core/test/panel.test.ts`; `view(state, query)` returning
sections of `{ text }` rows and the summary; `register.js` drawing them.

Tests first, in `packages/core/test/panel.test.ts`:
- `it('ac-2 search narrows the rows and each button runs its accord command')`: open as in ac-1 and settle with
  YOURS `[{ id: 'ST-1', title: 'Login form' }]` and READY `[{ id: 'ST-2', title: 'Export' }]`. With the box empty:
  no button is labelled `New request`; pressing the `Continue` button with key `continue:ST-1` calls
  `$.command.run` with `{ command: 'accord', args: 'continue ST-1' }`; pressing `Pick up` with key `pick-up:ST-2`
  calls it with `{ command: 'accord', args: 'pick-up ST-2' }`. `host.type('login')`: under `vi.waitFor` a text
  holds `ST-1` and none holds `ST-2`; pressing `New request` calls `$.command.run` with `{ command: 'accord', args:
  'login' }`. Calling the `Input`'s `onSubmit('login', {})` adds no `$.command.run` call. `host.type('st-2')`: a text
  holds `ST-2`, none holds `ST-1`.
- `it('risk:concurrency a redraw from a finished run keeps what the owner typed')`: after the first settle,
  `host.type('log')`: after the redraw that typing causes, `host.field()` is `log`. `fire('turn.complete', { reason:
  'answer' })` and settle the same JSON: after that redraw `host.field()` is still `log`, the drawn `Input` has
  `value` `log`, and a text still holds `ST-1` and none `ST-2`. (An `Input` drawn without `value` empties the field
  in the fake, so this fails.)

Interface:
- `view(state, query)`: `q` is `query.trim().toLowerCase()`. When `q` is non-empty, a row is kept when its id or
  title, lowercased, contains `q`, and a section with no kept row is left out. A YOURS row gains `action: { key:
  'continue:<id>', label: 'Continue', args: 'continue <id>' }`; a READY or UP NEXT row `action: { key:
  'pick-up:<id>', label: 'Pick up', args: 'pick-up <id>' }`; TEAM and EPICS rows none. The dashboard result gains
  `newRequest: { key: 'new-request', label: 'New request', args: query.trim() }`, present only when the trimmed
  text is non-empty (Button has no `disabled` prop).
- `register.js`: module state `query = ''`. The dashboard tree starts with `Input({ key: 'search', label: 'Search',
  value: query, onInput, onSubmit })`, always carrying `value: query`; `onInput` sets `query` to the typed text and
  invalidates `ui.render`; `onSubmit` does nothing. A row with an action is a row `Box` of its `Text` and `Button({ key, label, onPress })` whose
  `onPress` is `() => void $.command.run({ command: 'accord', args })`. `New request`, when present, is a `Button`
  after the `Input`. A message tree draws no `Input` and no `Button`.

Must not change: the ac-1 and risk:parsing cases; the section order, `none`, `+<n> more` and the summary text.

## Task 5: A failing CLI shows its message, one run at a time, and titles stay printable
covers: @ac-3, D-08, D-06, D-09
files: packages/core/panel/view.js (new), packages/core/panel/register.js (new), packages/core/src/generated/panel.ts (new), packages/core/test/panel.test.ts (new)
verify: packages/core/test/panel.test.ts#ac-3-a-failing-cli-shows-its-message-instead-of-a-dashboard (@ac-3), packages/core/test/panel.test.ts#risk:complex-branching-a-rejected-run-an-unparsable-stdout-and-an-empty-stderr-each-show-a-message, packages/core/test/panel.test.ts#risk:concurrency-one-accord-run-at-a-time-and-none-for-a-subagent-turn-or-a-closed-pane, packages/core/test/panel.test.ts#risk:security-a-title-cannot-put-control-characters-into-the-pane

From Tasks 1 and 4: `view.js` exports `outcome` and `view`; `register.js` runs `refresh($)` on an interactive
session start, on `/accord-panel`, and after every main-loop turn; the test helpers `loadPanel`, `host`, `board`.

Tests first, in `packages/core/test/panel.test.ts`:
- `it('ac-3 a failing cli shows its message instead of a dashboard')`: open; settle `{ exitCode: 2, stdout: '',
  stderr: 'npm warn exec The following package was not found and will be installed\nset git config user.email\n' }`.
  Under `vi.waitFor`, `host.texts()` equals `['set git config user.email']`, `host.buttons()` is empty and
  `host.input()` is `undefined`.
- `it('risk:complex-branching a rejected run an unparsable stdout and an empty stderr each show a message')`, one
  fresh panel each: `host.fail(new Error('timed out'))` gives texts `['accord did not finish: timed out']`; exit 0
  with stdout `not json` gives `['accord dashboard --json printed no dashboard']`; exit 0 with stdout `{}` gives the
  same; exit 3 with stderr `npm notice x\n` gives `['accord exited 3']`.
- `it('risk:concurrency one accord run at a time and none for a subagent turn or a closed pane')`: open (one run
  pending); fire `turn.complete` twice: still one `$.process.run` call; settle: exactly one more call follows (the
  queued rerun); settle it: no further call. `turn.complete` with `agentId: 'a1'`: no call. `host.close('accord-panel')`
  then `turn.complete`: no call. `fire('command.run', { command: 'accord-panel', args: '' })`: `$.ui.open` was
  called with `focus: true` and one new run starts. Settle that run (and any queued rerun) until no run is in flight,
  noting the `$.process.run` call count. Then `host.placed = false` and fire `turn.complete`: the call count is
  unchanged (an unplaced pane does not count as open), and `fire('command.run', { command: 'accord-panel', args: '' })` calls
  `$.ui.toast` with `The terminal is too narrow for the accord pane: it needs 110 columns`.
- `it('risk:security a title cannot put control characters into the pane')`: settle YOURS with one row titled
  `'Réglé\u001b[31m à\u202e x\u2028y'`: no text holds U+001B, U+202E or U+2028, and a text contains
  `Réglé [31m à x y`.
- In `risk:complex-branching a rejected run an unparsable stdout and an empty stderr each show a message`, two more
  fresh panels: exit 0 with the JSON of `board({ yours: { rows: ['ST-1'], more: 0 } })`, and with
  `board({ upNext: { more: 0 } })`, each give texts `['accord dashboard --json printed no dashboard']`.

Interface:
- `view.js` `outcome(result)`: exit code 0 and stdout that parses to an object whose `yours`, `team`, `ready` and
  `epics` each have a `rows` array of plain objects, whose `upNext`, when present, has a `rows` array of plain
  objects too, and whose `summary` is an object gives `{ dashboard }`; exit 0 otherwise gives `{
  message: 'accord dashboard --json printed no dashboard' }`; a non-zero exit gives `{ message }` of the stderr
  lines that do not start with `npm ` (any case), trimmed, or `accord exited <code>` when none is left.
  `failure(err)` gives `{ message: 'accord did not finish: ' + (err?.message ?? String(err)) }`. `view` turns a
  message state into `{ message: <its lines> }`. A row whose `id` is not a string is skipped; a title that is not a
  string is `''`. Nothing in the render hook throws on output `outcome` accepted.
- `clean(text)` in `view.js`, applied to every id, title and message line: each code point below U+0020, U+007F to
  U+009F, U+061C, U+200E, U+200F, U+2028, U+2029, U+202A to U+202E and U+2066 to U+2069 becomes a space; space runs
  collapse to one; the result is trimmed. Code points are scanned, never matched by a regular expression holding a
  control character.
- `register.js` `refresh($)`: module flags `running` and `again`. A call while `running` sets `again` and returns.
  Otherwise it loops: clear `again`; `state = outcome(await $.process.run(...))`, or `failure(err)` when it rejects;
  invalidate `ui.render`; repeat while `again` is set; then clear `running`. `turn.complete` runs it only when
  `e.agentId` is absent and `(await $.ui.panes()).some((p) => p.id === 'accord-panel' && p.isPlaced === true)`.
- The `command.run` hook for `accord-panel`, after `await $.ui.open(...)`, reads `await $.ui.panes()`; when the
  `accord-panel` entry has `isPlaced === false` it calls `$.ui.toast('The terminal is too narrow for the accord
  pane: it needs 110 columns')` (an asked-for pane needs 110 columns, d.ts:2159-2160). It still runs `refresh($)`.

Must not change: the ac-1, ac-2 and the other risk cases; the `Loading…` text before the first result; no timer.

## Task 6: The /accord skill acts on a named ticket
covers: @ac-4, D-01, D-05, D-10
files: packages/core/skills/accord/SKILL.md, packages/core/src/generated/skills.ts, packages/core/test/stage-skills.test.ts, packages/cli/test/skill-commands.test.ts
verify: packages/core/test/stage-skills.test.ts#ac-4-the-accord-skill-picks-up-then-continues-a-named-ticket-and-treats-any-other-text-as-a-new-request (@ac-4)

The ticket's @ac-4 is one sequence (D-10): `/accord pick-up ST-2` picks up the ready ST-2, then `/accord continue
ST-2` continues the ST-2 it claimed, then `/accord continue the refactor` starts a new request whose text is
`continue the refactor`, each without showing the dashboard first. An action applies only when the whole text
after it is exactly one ticket id, so `/accord continue ST-2 now` is a new request too. `continue` on a ticket
nobody has claimed says so, offers Pick up, and never claims it.

Test first, in `packages/core/test/stage-skills.test.ts`:
- `it('ac-4 the accord skill picks up then continues a named ticket and treats any other text as a new request')`:
  `text` is the rendered `.claude/skills/accord/SKILL.md` from `files` with whitespace runs collapsed to one space;
  `named` is the slice from `## A ticket named` to `## Continue`, non-empty, and it comes after `## Dashboard`.
  `named` contains `` `/accord pick-up <id>` `` before `` `/accord continue <id>` ``, and contains `the whole text
  after it is exactly one ticket id`, `without showing the dashboard first`, `nobody has claimed`, `offers Pick up`,
  `never claims it`, `the whole text after`, `` `continue the refactor` ``, `` `/accord continue ST-2 now` `` and
  `` `/accord continue ST-99` is a New request ``.

Text: in `packages/core/skills/accord/SKILL.md`, between the Dashboard section and `## Continue`, insert exactly
(each code span on one line):
```
## A ticket named: `/accord pick-up <id>`, `/accord continue <id>`

An action applies only when the whole text after it is exactly one
ticket id, the id of a ticket in `accord/tickets/`; with no such ticket,
`/accord continue ST-99` is a New request. Then run Pick up or
Continue below on that ticket, without showing the dashboard first. Continue on a ticket nobody has claimed
says so, offers Pick up, and never claims it. Any other text starts a
New request whose text is the whole text after `/accord`: for
`/accord continue the refactor` it is `continue the refactor`, and
`/accord continue ST-2 now` is a new request too.
```
Then `npm run gen`.

Size: the rendered `.claude/skills/accord/SKILL.md` is 4,273 bytes and about 90 lines at the baseline. The inserted
section is 12 lines and about 640 bytes, so the render is about 102 lines and 4,915 bytes, inside 120 and 5120. If
`every SKILL.md is at most MAX_SKILL_BYTES bytes` fails, shorten only this new section (never another section), keeping
every phrase the ac-4 test names.

`packages/cli/test/skill-commands.test.ts`: `MENTION` becomes `/(?<!\/)\baccord((?:\s+[a-z][a-z-]*)+)/g`, so a
`/accord` slash command is not read as an `accord` CLI command; the comment above it gains that one sentence.

Must not change: the Dashboard, Continue, Pick up, New request and Rules sections; every `REQUIRED.accord` phrase;
`skills.test.ts` (first command `dashboard`, at most 120 lines and 5120 bytes, no product name, drift); every
other `skill-commands.test.ts` case.

## Task 7: This repository carries the generated panel, settings and /accord copy
covers: D-02
files: .claude/skills/accord/SKILL.md, .claude/settings.json, .claude/accord-panel/.claude-plugin/marketplace.json (new), .claude/accord-panel/plugin/.claude-plugin/plugin.json (new), .claude/accord-panel/plugin/hooks/hooks.json (new), .claude/accord-panel/plugin/hooks/register.js (new), .claude/accord-panel/plugin/hooks/view.js (new), packages/cli/test/skills-sync.test.ts
verify: packages/cli/test/skills-sync.test.ts#risk:regression-the-committed-panel-and-settings-carry-the-plugin

From Tasks 1 to 6: `accord skills sync` writes the five plugin files and merges the panel keys into
`.claude/settings.json` when `runtimes` holds claude; the /accord skill carries the named-ticket section.

Test first, in `packages/cli/test/skills-sync.test.ts`, beside the two committed-copy cases at its end:
- `it('risk:regression the committed panel and settings carry the plugin')`: for each of the five plugin paths,
  read from the repository root through `new URL('../../../<path>', import.meta.url)`: its `markerHash` equals
  `contentHash(withoutMarker(normaliseText(text)))`; `register.js` contains `'@accord-dev/accord@' + pkg.version`.
  `.claude/settings.json` parsed has `enabledPlugins['accord-panel@accord']` `true`, `extraKnownMarketplaces.accord`
  equal to the preamble's value, and its three accord hook commands. `.claude/skills/accord/SKILL.md` contains
  `` `/accord continue <id>` ``.

Then run, in order: `npm run gen`, `npm run build`, and from the repository root `node packages/cli/dist/cli.js
skills sync`, which writes the five plugin files, updates `.claude/settings.json` and rewrites
`.claude/skills/accord/SKILL.md`. Then `claude plugin validate --strict .claude/accord-panel` and `claude plugin
validate --strict .claude/accord-panel/plugin` must both pass (Claude Code is installed locally; this is a build
step, not a test). Commit those generated files with the task. Then `npm run check`.

Must not change: every other file under `.claude/` (the sync reports them `unchanged`); the hook entries in
`.claude/settings.json`; `accord/config.yml`.

## Task 8: Each section draws as a table of fixed-width cells coloured by stage
covers: D-11, D-12
files: packages/core/panel/view.js (new), packages/core/panel/register.js (new), packages/core/test/panel.test.ts (new), packages/core/src/generated/panel.ts (new), .claude/accord-panel/plugin/hooks/register.js (new), .claude/accord-panel/plugin/hooks/view.js (new)
verify: packages/core/test/panel.test.ts#risk:regression-each-row-draws-as-fixed-width-cells-with-stage-colours-a-red-blocked-by-line-and-a-truncated-title

The change note of 2026-10-16 (ticket `## Approach`, D-11, D-12): on the real pane each row was one run-on string
that wrapped, the title pushed the stage onto the next line, YOURS repeated the owner's own email, and sections ran
together uncoloured. This task changes only how a dashboard is drawn. Every path below marked `(new)` exists on the
branch already (Tasks 1, 4, 5 and 7 created it); the marker is relative to the baseline. Mods facts this task uses:
`Text` takes `color` (a colour name such as `'red'`), `bold`, `dimColor` and `wrap` (`'truncate'` cuts at the
width of its box, d.ts:9937); `Box` takes `width`, `columnGap`, `marginTop`, `flexDirection`, `flexGrow`,
`flexShrink` and `minWidth` (d.ts:704-716), laid out by Ink/Yoga; there is no Table element. The title column is
sized by flex, so the view never reads the pane width: the change note names `e.props.bodyColumns`, the body width
the pane hook receives (d.ts:8384), but a title box with `flexGrow: 1, flexShrink: 1` and no `minWidth` already
takes exactly the cells the fixed boxes leave, which is the "cut to the width left" of D-11, with no width sum in
`view.js` and no redraw on a resize. The title box carries no `minWidth`, so in a narrow pane the title shrinks to
nothing before any other cell moves; only a pane narrower than the id, stage and button cells with their gaps
pushes a row past the right edge. `$.ui.open` keeps its arguments (no `columns`): `columns` is a request the dock
may ignore and the inline pane always ignores (d.ts:6062-6069), and the ac tests assert the open calls. No emoji in
any cell, since a two-column glyph shifts the columns.

Test first, in `packages/core/test/panel.test.ts`:
- Fake host: `draw` is unchanged. `h.cell(s)` walks the tree keeping each node's parent and returns `{ text, box,
  row }` for the first `Text` whose joined `children` equal `s`: `text` its props, `box` its direct parent `Box`'s
  props, `row` the props of that box's parent. `h.buttonBox(key)` is the props of the direct parent `Box` of the
  `Button` whose `key` is `key`. `h.texts()`, `h.buttons()`, `h.input()`, `h.field()` and `h.type()` keep their
  meaning.
- Remove `it('risk:parsing a row also shows its stage, who holds it and what blocks it, cleaned')`: its two
  joined-string assertions describe the one-line row this task replaces, and the new test below carries its fixture
  (the cleaned `claimedBy`, `build 2/5`, the blockers, the row with no title) and its button assertion. This also
  settles the Deferred note that the test covers formatting, not parsing.
- `it('risk:regression each row draws as fixed-width cells with stage colours a red blocked-by line and a truncated
  title')`: open and settle with `board({ yours: { rows: [{ id: 'ST-10', title: LONG, stage: 'review', claimedBy:
  'me@x' }], more: 0 }, team: { rows: [{ id: 'ST-3', title: 'Mine', stage: 'build', tasksDone: 2, tasksTotal: 5,
  claimedBy: 'an\u001b[1m@x' }, { id: 'ST-11', title: 'Odd', stage: 'constructor' }], more: 0 }, upNext: { rows: [{
  id: 'ST-7', title: 'Blocked', stage: 'plan', idleDays: 3, blockedBy: ['ST-6', 'ST-4'] }, { id: 'ST-8' }], more: 2
  }, epics: { rows: [{ id: 'EP-1', title: 'E', done: 1, total: 3 }], more: 0 } })`, where `LONG` is
  `'Title '.repeat(30).trim()`. The stage cells are `review`, `build 2/5`, `constructor`, `plan idle 3d` and
  `1/3 done`; the longest is `plan idle 3d`, 12 code points. Under `vi.waitFor` a text holds `ST-7`. Then:
  - `YOURS`, `TEAM`, `READY`, `UP NEXT` and `EPICS` each: `cell(heading).text` has `bold: true` and `color: 'cyan'`,
    and `cell(heading).box.marginTop` is `1`.
  - Texts `ID`, `STAGE` and `TITLE` each appear four times (YOURS, TEAM, UP NEXT, EPICS; READY has no row), each
    with `dimColor: true`. `none` (READY), `+2 more` and the summary text each have `dimColor: true`.
  - The epic row: `cell('EP-1').text.bold` is `true`; `cell('1/3 done').text.color` is `undefined` and
    `cell('1/3 done').box` equals the stage box below; `cell('E').box` equals the title box below; `cell('EP-1').row`
    has exactly three children (no button box).
  - `cell('ST-3').text.bold` is `true`; `cell('ST-3').row` has `flexDirection: 'row'` and `columnGap: 2`; its first
    two child boxes are `{ width: 5, flexShrink: 0 }` (`ST-10`) and `{ width: 12, flexShrink: 0 }` (`plan idle 3d`),
    and its third is `{ flexGrow: 1, flexShrink: 1 }` with no `width` and no `minWidth` key. `cell('ID').box` and
    `cell('STAGE').box` equal the first two, and `cell('TITLE').box` and `cell(LONG).box` equal the third.
    `cell('ID').row` has `flexDirection: 'row'` and `columnGap: 2`, the same as `cell('ST-3').row`, so the header
    words sit over their columns.
    `cell(LONG).text.wrap` is `'truncate'` and its children hold the whole of `LONG` (the host cuts, the view does
    not).
  - `h.buttonBox('continue:ST-10')` and `h.buttonBox('pick-up:ST-7')` each equal `{ flexShrink: 0 }`.
  - Every box comparison in this test leaves out the `children` key.
  - Stage colours: `build 2/5` `yellow`, `review` `magenta`, `plan idle 3d` `cyan` (the idle suffix is drawn in the
    stage cell and the colour comes from the raw stage); `cell('constructor').text.color` is `undefined`.
  - `cell('blocked by ST-6 ST-4').text.color` is `'red'`; `cell('an [1m@x').text.dimColor` is `true`; no text
    contains `me@x` (YOURS shows no holder); exactly one text starts with `blocked by`, and the texts that equal
    `an [1m@x` number one.
  - Second lines only where a row has one: walk the tree and collect every `Box` with `flexDirection: 'row'` whose
    first child is a `Box` with no `children` key or an empty `children` array. There are exactly two: one holds
    the text `blocked by ST-6 ST-4` (ST-7) and the other the text `an [1m@x` (ST-3). ST-8, ST-10, ST-11 and EP-1
    have neither, so a second line drawn under every row fails here.
  - `h.buttons().map((b) => b.key)` equals `['continue:ST-10', 'pick-up:ST-7', 'pick-up:ST-8']` (EP-1 has none).
  - Last, the columns hold still while typing: `h.type('st-3')`; under `vi.waitFor` no text holds `ST-7`; then
    `cell('ST-3').row`'s first two child boxes are still `{ width: 5, flexShrink: 0 }` and `{ width: 12, flexShrink:
    0 }` (measured over the shown rows they would be 4 and 9).

The ac-1, ac-2 and ac-3 tests and every other risk test stay byte-identical: each finds a row by
`texts().some((x) => x.includes(id))` or a title substring, and the id and the whole cleaned title each stay in one
`Text`; headings, `+N more`, `none`, the summary string, the message lines and the button keys and args keep their
text. If any of those assertions fails, stop and report it instead of editing it, because changing an ac test
needs the owner's yes.

Interface:
- `view.js` `view(state, query)`, signature unchanged. Loading, message, search, the section order and visibility, `newRequest`, `summary`, `clean` and `SAFE_ID` stay as
  they are. A row becomes `{ id, stage, stageColor, title, blockedBy, who, action? }`, every string cleaned:
  `stage` is today's stage cell (`build <done>/<total>`, the ` idle Nd` suffix kept); an EPICS row's `stage` is
  `<done>/<total> done` and it has no `stageColor`; `stageColor` comes from `{ intent: 'blue', plan: 'cyan', build:
  'yellow', review: 'magenta', verify: 'green', ready: 'green' }` read with `Object.hasOwn` on the raw `r.stage`
  (a stage named `constructor` must not pick up an inherited value), else `undefined`; `blockedBy` is `'blocked by '`
  plus the cleaned ids joined by a space when `r.blockedBy` is a non-empty array, else `''`; `who` is the cleaned
  `claimedBy` outside YOURS, `''` in YOURS. The dashboard result gains `widths: { id, stage }`: each the longest of
  the header word (`ID`, `STAGE`) and the cleaned value of every row of the dashboard before the search filter
  (a row whose `id` is not a string is skipped, as today), in code points, across all sections (EPICS included),
  so the columns line up between sections and do not move while the owner types. There is no title width: flex sizes the title.
- `register.js` `ui.render` calls `view(state, query)` as today. Per section: `Box({ marginTop: 1, children:
  [Text({ bold: true, color: 'cyan', children: [heading] })] })`; when the section has rows, a header row; per row a
  row `Box({ flexDirection: 'row', columnGap: 2, children })` of `Box({ width: widths.id, flexShrink: 0 })` holding
  `Text({ bold: true })` of the id, `Box({ width: widths.stage, flexShrink: 0 })` holding `Text` of the stage with
  `color: stageColor` (the key left out when undefined), `Box({ flexGrow: 1, flexShrink: 1 })`
  holding `Text({ wrap: 'truncate' })` of the title, then, when the row has an action, `Box({ flexShrink: 0 })`
  holding the row's `Button` as today. The header row is a row `Box({ flexDirection: 'row', columnGap: 2, children })`,
  the same container as a data row, of the same three boxes holding `Text({ dimColor: true })` of `ID`, `STAGE`,
  `TITLE`. When `blockedBy` or `who` is non-empty, a second row `Box({ flexDirection: 'row',
  columnGap: 2 })` follows: an empty `Box({ width: widths.id, flexShrink: 0 })`, then
  `Text({ color: 'red' })` of `blockedBy` when non-empty, then `Text({ dimColor: true })` of `who` when non-empty.
  `none`, `+N more` and the summary are `Text({ dimColor: true })`. The message tree and the Input stay as they are.

Then run, in order: `npm run gen`, `npm run build`, and from the repository root `node packages/cli/dist/cli.js
skills sync`, which rewrites `.claude/accord-panel/plugin/hooks/register.js` and `view.js` and reports every other
path `unchanged`. Then `claude plugin validate --strict .claude/accord-panel/plugin` must pass (a build step, not a
test). Then `npm run lint`, `npm run typecheck`, `npx vitest run packages/core/test/panel.test.ts` and `npx vitest
run packages/cli/test/skills-sync.test.ts` (its committed-panel case reads the two rewritten hook files). Commit the
generated files with the task.

Must not change: the CLI command each refresh runs, one run in flight, the stale-pane refresh, the toasts; button
keys, labels and `$.command.run` args; the search filter and the Input carrying `value: query`; the failure and
`Loading…` messages; `clean` and `SAFE_ID`; `pluginTargets`, the marker and every other generated file.
