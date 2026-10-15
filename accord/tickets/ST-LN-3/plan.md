---
baseline: 1d635b5277fa10c77b89c3eba8108cb877065060
plan_hash: "fnv1a64:3df13cae794a5e35"
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
  `$.ui.invalidate('ui.render')`; a drawn `Input` with a `value` prop resets the field to it, one without keeps what
  was typed.

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
  `host.type('log')`: the `Input` drawn next has no `value` key. `fire('turn.complete', { reason: 'answer' })` and
  settle the same JSON: the `Input` drawn then has `value` `log`, and a text still holds `ST-1` and none `ST-2`.

Interface:
- `view(state, query)`: `q` is `query.trim().toLowerCase()`. When `q` is non-empty, a row is kept when its id or
  title, lowercased, contains `q`, and a section with no kept row is left out. A YOURS row gains `action: { key:
  'continue:<id>', label: 'Continue', args: 'continue <id>' }`; a READY or UP NEXT row `action: { key:
  'pick-up:<id>', label: 'Pick up', args: 'pick-up <id>' }`; TEAM and EPICS rows none. The dashboard result gains
  `newRequest: { key: 'new-request', label: 'New request', args: query.trim() }`, present only when the trimmed
  text is non-empty (Button has no `disabled` prop).
- `register.js`: module state `query = ''` and `typed = false`. The dashboard tree starts with `Input({ key:
  'search', label: 'Search', onInput, onSubmit })`, carrying `value: query` only when `typed` is false; `onInput`
  sets `query`, sets `typed = true` and invalidates `ui.render`; `onSubmit` does nothing; each render ends by setting
  `typed = false`. A row with an action is a row `Box` of its `Text` and `Button({ key, label, onPress })` whose
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
  called with `focus: true` and one new run starts.
- `it('risk:security a title cannot put control characters into the pane')`: settle YOURS with one row titled
  `'Đặt\u001b[31m lại\u202e x\u2028y'`: no text holds U+001B, U+202E or U+2028, and a text contains
  `Đặt [31m lại x y`.
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
  `e.agentId` is absent and `(await $.ui.panes()).some((p) => p.id === 'accord-panel')`.

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
  `never claims it`, `the whole text after`, `` `continue the refactor` `` and `` `/accord continue ST-2 now` ``.

Text: in `packages/core/skills/accord/SKILL.md`, between the Dashboard section and `## Continue`, insert exactly
(each code span on one line):
```
## A ticket named: `/accord pick-up <id>`, `/accord continue <id>`

An action applies only when the whole text after it is exactly one
ticket id. Then run Pick up or Continue below on that ticket, without
showing the dashboard first. Continue on a ticket nobody has claimed
says so, offers Pick up, and never claims it. Any other text starts a
New request whose text is the whole text after `/accord`: for
`/accord continue the refactor` it is `continue the refactor`, and
`/accord continue ST-2 now` is a new request too.
```
Then `npm run gen`.

Size, counted from the source at the baseline: `packages/core/skills/accord/SKILL.md` is 89 lines and about 4,000
bytes of body; rendered with its frontmatter and marker it is about 4,400 bytes and 90 lines. The inserted section
is 10 lines and about 520 bytes, so the render is about 100 lines and 4,920 bytes, inside 120 and 5120. If
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
