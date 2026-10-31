---
baseline: 5c8b5d96c8cbf6acddfcee3c6358c09b84f75094
plan_hash: "fnv1a64:aa0e053a546a462e"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order. Task 1 runs the approach's switches on one dispatched accord agent before any code (approach, Risks,
first Should), records the command forms that worked, captures real probe transcripts as fixtures, and writes
the reader every other task uses on a probe transcript. Task 2 reads the setup on this machine. Tasks 3 to 5 plan
the probes: the probes that need no all-on transcript (Task 3), the probes planned from the all-on transcript
(Task 4), and which probes are missing, stale or failed (Task 5). Task 6 reads the real transcripts' calls. Task 7 turns
probe transcripts into each row's parts. Task 8 wires `--fixed` and prints the raw table (@ac-1, @ac-3). Task 9
adds the cost-weighted figures, the setup items and the ticket shares (@ac-2). Task 10 commits the real report
(@ac-4).

How the measurement is run once Tasks 1 to 9 are done (no executor runs a probe except the spike of Task 1).
Before Task 10 is dispatched, the main session runs `node scripts/benchmark.mjs --fixed --probe` in the ticket
worktree and gives the owner the commands it printed; the owner runs them in Git Bash; the main session then runs
`node scripts/benchmark.mjs --fixed` and gives the owner each set of commands it prints, until `--fixed` exits 0
and prints the table. That run writes `docs/benchmark/fixed-context.md` into the ticket worktree, and Task 10 commits
that file as it is, without running `--fixed` again: a line the main session writes to auto-memory's `MEMORY.md`
afterwards makes `all-on` stale, though the file already measures the setup as it was when it ran. Only then is
Task 10 dispatched.

Rules for every task:
- Test ids: every test this plan writes is a top-level `it(...)` in `packages/core/test/benchmark-fixed.test.ts`
  with no `describe` around it. Its report id is the file path from the repository root, `#`, then the `it` title
  with each whitespace run turned into `-`. No title holds `@`, a comma or an apostrophe. No existing test is
  renamed or changed.
- Tests import a script as `packages/core/test/benchmark-reader.test.ts:11` does:
  `(await import(new URL('../../../scripts/<name>.mjs', import.meta.url).href)) as { ... }`, typing only what the
  test calls. The repository root in a test is `fileURLToPath(new URL('../../../', import.meta.url))`.
- Temporary folders come from `realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')))` and are removed in a
  `finally` with `rmSync(dir, { recursive: true, force: true, maxRetries: 5 })`. A test that runs git passes
  `120_000` as the third argument of `it`. Commits in tests write the message to a file and run
  `git -c user.name=t -c user.email=t@example.invalid -c commit.gpgsign=false commit -q --no-verify -F <file>
  --cleanup=verbatim`; a dated commit passes `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` in the spawn's `env`.
- `scripts/fixed-context.mjs` (new in Task 1) is pure, as `scripts/round.mjs` is: it imports only `node:crypto`
  (for `createHash`), reads no file, spawns nothing and reads no clock. Files, git and the home folder are touched
  only in `scripts/benchmark.mjs`. No dependency is added.
- `scripts/benchmark.mjs` never spawns `claude`, `npx` or `npm`: the script calls no model (approach). Every git
  spawn goes through its `gitIn(repo, args)` (`scripts/benchmark.mjs:353`); every `git log` and `git show` passes
  `-c log.showSignature=false` before the subcommand and `--no-show-signature` after it; paths read from git are
  read with `-z` and split on `\0`; a path read from git output and given back to git as a pathspec carries
  `:(literal)` (`accord/product/conventions.md`).
- Every function that reads the home folder takes it as a `home` argument (tests pass a fake home); only `main()`
  passes `os.homedir()`. The bench root is `benchRoot(repo)` (`scripts/benchmark.mjs:351`); every function that
  uses it takes it as a `bench` argument.
- Every path the scripts print, store or write into the report uses `/`. In the report and in every printed line
  that is not a command, a path under the home folder is printed as `~/` followed by the rest (no user name
  reaches the report) and a path under the repository is printed relative to it. A path inside a printed
  command, and the `cwd` and `command` stored in `probes.json`, stay absolute and pass through `shellLine`: Git
  Bash does not expand a quoted `~`, and `shellLine` quotes every argument holding one. Printed commands go to
  the terminal only, never into the report or any file under the repository.
- Nothing under `.claude/`, `packages/core/agents/`, `packages/*/src/`, `CLAUDE.md`, `AGENTS.md` or `accord/` of
  this repository changes, and nothing of the owner's setup changes: the settings files, skills, agents, commands,
  rules, plugins, `CLAUDE.md` and memory files under the real `~/.claude`, and the `mcpServers` entries of the real
  `~/.claude.json` (ticket "Not here": this ticket cuts nothing, D-05). The transcripts Claude Code writes under
  `~/.claude/projects/` and the project entries it writes into `~/.claude.json` whenever `claude -p` runs are
  expected and are not a change of the setup. The throwaway probe worktree of Task 1 is removed with what it
  holds. No probe file (settings, MCP config, stubs, appended text) is written inside the repository; they go
  under `<bench>/fixed/`.
- The existing modes of `scripts/benchmark.mjs` (`--compliance`, `--round 1 ...`, `--clean`, the legacy report)
  behave as before for every run that is not a probe run, and the tests in `packages/core/test/benchmark-*.test.ts`
  that exist at the baseline pass unchanged.
- End every task with `npm run lint` and `npm run typecheck`, then the test command the brief prints.

Names shared by every task (all in `scripts/fixed-context.mjs` unless said otherwise):
- `PROBE_BRANCH = 'probe/fixed-context'`; `PROBE_BRIEF = 'accord fixed-context probe: reply ok, use no tool'`;
  `PROBE_PREFIX = 'accord fixed-context probe'` (every probe prompt and the brief start with it);
  `PROBE_DESCRIPTION = 'fixed probe '` (every probe dispatch's description starts with it).
- `dispatchPrompt(types)` returns `accord fixed-context probe. In one message, dispatch each of these subagent
  types once, with the description "fixed probe <type>" and the prompt "accord fixed-context probe: reply ok, use
  no tool": <types joined by ", ">. Use no other tool, then reply ok.` (`<type>` is written literally; the
  description each dispatch gets is `fixed probe ` and its type).
- `serverKey(name)` is the name with every character outside `[A-Za-z0-9]` turned to `_` (Claude Code writes the
  connector `claude.ai Claude Docs` into tool names as `mcp__claude_ai_Claude_Docs__<tool>`). A connected server
  is a claude.ai connector when its name starts with `claude.ai ` or its key starts with `claude_ai_`.
- A FirstCall (Task 1) is `{ id, model, version, ts, cwd, branch, input, usage: { input, cacheRead, cacheWrite },
  instructions: [{ path, type }], skillListing: string[], agentListing: string[], hookContexts: string[],
  mcpServers: string[], sessionStartHook: boolean, prompt }`.
- Rows: `main` and each accord agent name. A row's model key is the `model` of that row's FirstCall in the all-on
  probe (the main session's model at probe time; the model an accord agent ran on, from its frontmatter).
- Owners, in this order and with these labels in every table: `accord`, `Claude Code`, `plugins`, `MCP servers`,
  `CLAUDE.md and memory`, `own skills, agents and commands`, and the remainder `unattributed`.
- Probe ids. Phase one, run from the probe worktree, planned from the setup alone: `all-on`, `plugin:<plugin id>`,
  `mcp-ref`, `mcp:<server name>`, `set:<prefix>`. Phase two, planned from the all-on transcript: `connector:<name>`
  (run from the probe worktree), `baseline`, `ref:<model>`, `text:<text id>:<model>` (run from the empty folder).
  Each probe has `where`: `'probe'` or `'empty'`. Text ids: `agent:<name>`, `rules`, `skill-listing`,
  `agent-listing`, `pointer:<label>`, `doc:<label>`, `prompt`, `baseline-prompt`, `brief`, where `<label>` is
  `standsFor(path, setup).label` (Task 2).
- The probe worktree is `path.resolve(repo, '..', 'accord-probe')` (the setup's `probeDir`); the empty folder is
  `<bench>/fixed/empty`; the probe state is `<bench>/fixed/probes.json`,
  `{ probes: [{ id, sessionId, cwd, command, fingerprint }] }` sorted by id, where `fingerprint` maps each key the
  probe depends on to its value when the probe was written.
- The probe version is the `version` of the main FirstCall with the newest `ts` among the sessions `probes.json`
  names (the Claude Code the owner runs probes with in Git Bash); a probe whose main FirstCall has another version
  is stale.

Re-plan after the change of course of 2026-10-31 (the ticket's "Change note, 2026-10-31" at the end of `## Approach`,
and its `## Corrections`). The leave-one-out probes (per plugin, per set, per MCP server), the MCP reference and the
per-text append probes are dropped. Tasks 1 to 10 keep their text; where they and this paragraph or Tasks 11 to 15
differ, this paragraph and Tasks 11 to 15 hold.
- Dispatch order: 11, 12, 13, 14, 15, then 10. Task 10 keeps its number and is dispatched last, after Task 15 and
  after the owner's probe runs ("How the measurement is run" above holds as written). Each of Tasks 11 to 15 leaves
  every test of `benchmark-fixed.test.ts` passing: 11 adds the texts of every owner, which nothing reads yet; 12 plans
  the calibration pairs beside the existing probes; 13 switches `measure` to text sizing and drops the text probes,
  which wires the new approach end to end through `--fixed`; 14 removes what nothing uses any more; 15 is the
  report's wording.
- Probes from Task 14 on: `all-on` (run from the probe worktree, planned from the setup); then, planned from the
  all-on transcript and run from the empty folder, `baseline` (Task 4's stubs) and, for each row's model key,
  `ref:<model>` (the brief alone) and `cal:<model>` (the brief with the calibration text appended). About 20 model
  calls in all.
- The calibration text is `scripts/fixed-calibration.txt` (Task 12), read only by `calibrationText()` in
  `scripts/benchmark.mjs`; tests read it through that export.
- Sizes: with `I(p, r)` as in Task 7, `perChar(m) = (I(cal:m, main) − I(ref:m, main)) / calibration.length` tokens a
  character, and a text's size in row `r` is `Math.round(text.length × perChar(<the model key of r>))`, where
  `length` is the JavaScript string length. Claude Code's part is still measured directly by the baseline.
- Rows a text reaches are read from the attachments before each row's first call in the all-on probe, with one
  exception: an MCP server's instructions block that the all-on main holds before its first call is charged to every
  agent row as well, because Claude Code adds that block to a subagent after the subagent's first call (real
  accord-critic transcripts carry the `claude.ai Claude Docs` `mcp_instructions_delta` after their first assistant
  line; ledger Ruling "re-plan 2, review 1.1"). Task 11 builds those rows, Task 15 says so in the report.
- Stale: a change of the setup makes only `all-on` stale (Task 3's `fingerprints`, whose `docs` key also covers each
  instruction file's content from Task 12); `baseline` is also stale when its stubs change (an accord agent's tool
  list or model changed); a Claude Code version other than the probe version makes every probe stale; a calibration
  pair whose `cal:` input is not above its `ref:` input is pending again, both its probes.
- A FirstCall (Task 1) gains `mcpBlocks` and `deferredTools`, and a text (Task 4's `textsOf`) is
  `{ id, owner, item, label, text, rows }` (both Task 11).
- Tests: the rule "No existing test is renamed or changed" above means the tests that exist at the baseline. Tasks
  11 to 15 change, replace or delete tests that Tasks 1 to 9 wrote, each as its section says; a test whose title
  would no longer hold is deleted and a new one with a true title is written in its place. The id of a test that
  proves a criterion is listed on Tasks 12 to 15 without its `(@ac-n)` marker, which stays on Tasks 8, 9 and 10 (a
  second marker would map the criterion twice).
- `files:` lines mark `scripts/fixed-context.mjs`, `benchmark-fixed.test.ts` and `fixed-world.ts` `(new)` as Tasks 3
  to 10 do: they do not exist at the baseline.

## Task 1: Spike the switches on a dispatched agent, record the forms that worked, and read a probe's first call
covers: D-06
files: scripts/fixed-context.mjs (new), packages/core/test/benchmark-fixed.test.ts (new), packages/core/test/fixtures/benchmark-fixed/all-on-main.jsonl (new), packages/core/test/fixtures/benchmark-fixed/all-on-executor.jsonl (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:parsing-a-probe-transcript-gives-its-first-call-input-and-what-loaded-before-it

Consumes: the `claude` command on this machine, the owner's login, and the repository at the baseline.
Produces: the constants above, `serverKey`, `PROBE_FORMS`, `firstCall(lines)`, and two fixture transcripts.

Spike first, before any code, from Git Bash. Read transcripts with `node -e` one-liners that print only the lines
and fields you need; never read a whole transcript (they run to megabytes). A session's transcript is
`~/.claude/projects/<folder>/<session id>.jsonl` and its subagents are under `<session id>/subagents/`. Each run
writes its own transcript under `~/.claude/projects/` and Claude Code records the folder in `~/.claude.json`; that
is expected (preamble). No run changes a settings file, skill, agent, command, plugin, rule, `CLAUDE.md` or memory
file of the owner's.
1. Run `claude --version`. Make a scratch folder `../accord-bench/fixed-spike/` and in it an empty folder
   `empty/`; check `git -C ../accord-bench/fixed-spike/empty rev-parse --is-inside-work-tree` fails (outside any
   repository). Make the probe worktree:
   `git worktree add -B probe/fixed-context ../accord-probe 5c8b5d96c8cbf6acddfcee3c6358c09b84f75094`.
2. Every run below passes `-p` with its prompt directly after it (the documented `claude -p "query"` form, so a flag
   that takes a list, added below, cannot take the prompt as one of its values), then `--session-id <uuid>` (a new
   `node -e "console.log(require('crypto').randomUUID())"` each run); from the probe worktree the prompt is
   `dispatchPrompt(['accord-executor'])`. Settings and MCP config
   go in files under the scratch folder and are passed by path, never as inline JSON. If `-p` stops without
   dispatching the agent, add the smallest flag that lets it dispatch (such as `--allowedTools Agent`) to every run
   and record it.
   a. all on: no other flag.
   b. every plugin off: `--settings <file>` whose `enabledPlugins` maps every enabled plugin (the keys set `true`
      in `~/.claude/settings.json` and `.claude/settings.json`) to `false`.
   c. MCP off: `--strict-mcp-config`.
   d. user settings off: `--setting-sources project,local`.
   e. one own set out of reach: create `.claude/commands/zzprobe-x.md` (one line of text) in the probe worktree,
      uncommitted; `--settings <file>` whose `permissions.deny` lists `Skill(<name>)` for each skill under
      `~/.claude/skills/` whose name starts with `gsd-`, `Agent(<name>)` for each agent under `~/.claude/agents/`
      whose name starts with `gsd-` (the name is the frontmatter `name`, else the file or folder name), and
      `Skill(zzprobe-x)`.
   f. baseline: from `empty/`, the flags that turn every setting source off (try `--setting-sources ""`, then
      `--setting-sources=`), `--strict-mcp-config`, and `--agents` with
      `{"stub-1":{"description":"probe stub","prompt":"Reply ok.","model":"sonnet"},"stub-2":{"description":"probe stub","prompt":"Reply ok.","model":"sonnet","tools":["Read"]}}`,
      first as the path of a JSON file holding it, then inline in single quotes; the prompt
      `dispatchPrompt(['stub-1', 'stub-2'])`.
   g. reference and append pair: from `empty/` with the flags of f but no `--agents`, the prompt `PROBE_BRIEF`;
      then the same with `--append-system-prompt-file <file holding the accord pointer block of CLAUDE.md>`.
   h. one claude.ai connector off: only when run a's main lists a connector before its first call (an
      `mcp_instructions_delta` attachment's `addedNames` item starting `claude.ai `, or a `deferred_tools_delta`
      attachment's `addedNames` item starting `mcp__claude_ai_`). Take the first such connector by name and its key
      `k = serverKey(name)`; `--settings <file>` whose `permissions.deny` is `["mcp__<k>"]`; when that run fails the
      condition below, run again with `["mcp__<k>__*"]`.
3. For each run, read the first call of the main session and of each dispatched agent: the first assistant line
   whose `message.model` is not `<synthetic>`, and every line with the same `message.id`; its input is
   `usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens`, each field the largest
   over those lines. Pass conditions:
   - `--session-id` names the transcript file, and the executor's transcript exists for runs a to e and h.
   - Run a: before the main's first call there are attachment lines of type `instructions`, `skill_listing` and
     `agent_listing_delta`; before the executor's there are `hook_additional_context` and `instructions`.
   - Runs b, c, d and e each lower the main's first-call input below run a's; at least one of them also changes the
     executor's first-call input (a switch is shown to reach a dispatched agent).
   - Run e: no `gsd-` name and no `zzprobe-x` is left in any `skill_listing` or `agent_listing_delta` of the main
     or of the executor, and every other entry of run a is still there.
   - Run f: both stubs' transcripts exist; `stub-1`'s first-call input is below the executor's in run a; `stub-2`'s
     first-call input is below `stub-1`'s (the `tools` array of `--agents` limits a stub's tool definitions, which
     every agent row's Claude Code part depends on); the main's first call has no `instructions` attachment. When
     `stub-2`'s input is not below `stub-1`'s, no other form is tried: stop and report BLOCKED with both figures
     (the owner's ruling on plan review 1.13).
   - Run g: the second first-call input is above the first.
   - Run h: the main's first-call input is below run a's, and no line before the main's first call names the
     connector (no `deferred_tools_delta` name starting `mcp__<k>__`, no `mcp_instructions_delta` name whose key is
     `k`). Run h never makes the task BLOCKED: when neither deny form passes, or run a lists no connector, the
     connectors share one line (approach: "else one line for all").
   If a condition of runs a to g fails and no other form named above passes it, stop and report BLOCKED with each
   run's figures and the condition that failed: the approach depends on it and the owner decides.
4. Remove the probe worktree (`git worktree remove --force ../accord-probe`, then
   `git update-ref -d refs/heads/probe/fixed-context <the sha you read with git rev-parse>`) and the scratch folder.

Then write `scripts/fixed-context.mjs` (new) with a header comment saying it is the pure half of the fixed-context
measurement (ST-LN-79). It exports the shared constants of the preamble, `dispatchPrompt`, `serverKey`, and
`PROBE_FORMS = { claudeVersion, extraArgs, noSources, agentsArg, deny: { skill, agent, command }, connector }`, the
forms that passed: `claudeVersion` the version printed in step 1; `extraArgs` the flags of step 2 (an empty array
when none was needed); `noSources` the argument array that turned every setting source off in run f (such as
`['--setting-sources', '']`); `agentsArg` `'file'` when `--agents` took a file path, else `'inline'`; `deny` the
rule templates of run e with `{name}` for the name (`'Skill({name})'`, `'Agent({name})'`, and for commands the
template that removed `zzprobe-x`); `connector` the deny template of run h that passed with `{server}` for the key
(`'mcp__{server}'` or `'mcp__{server}__*'`), or `null`.

Fixtures: from run a, write `all-on-main.jsonl` and `all-on-executor.jsonl` holding only: the first user line
(prompt text kept); the attachment lines of type `instructions` (each file reduced to `path` and `type`),
`skill_listing` (content reduced to its `- accord` lines and the first two other lines), `agent_listing_delta`
(`addedLines` reduced the same way, other arrays dropped), `mcp_instructions_delta` (`addedNames` kept,
`addedBlocks` emptied), `deferred_tools_delta` (`addedNames` reduced to its `mcp__` items, other arrays dropped),
`hook_additional_context`, and a `hook_success` line of the SessionStart hook if there is one (`stdout` and
`content` emptied); every line of the first assistant message (keeping `type`, `timestamp`, `cwd`, `gitBranch`,
`version`, and `message` reduced to `id`, `model`, `usage`); and one assistant line of the second message. In
every kept line, the home folder (both slash forms) becomes `C:/owner-home`; no line holds an e-mail address,
`"thinking"`, or `<letter>:/Users/` in either slash form.

Test first, then `firstCall`:
- `it('risk:parsing a probe transcript gives its first call input and what loaded before it')`: read each fixture,
  split into lines, `JSON.parse` each; `firstCall(lines)` returns the first message's `id` and `model`, an `input`
  equal to the sum you compute in the test from the fixture's usage fields (largest per field over the message's
  lines), `version`, `cwd`, `branch` (`gitBranch`), `ts` (the timestamp as milliseconds); for the main fixture
  `instructions` paths and types as in the fixture, `skillListing` holding the fixture's `- accord` lines,
  `agentListing` holding its `- accord-` lines, `mcpServers` equal to the list the test computes from the fixture's
  `mcp_instructions_delta` and `deferred_tools_delta` lines by the rule below, and `prompt` starting with
  `PROBE_PREFIX`; for the executor fixture `hookContexts[0]` starting with `# accord rules`. An attachment placed
  after the first assistant line in a copy of the lines is not read; lines with no assistant message give `null`.
  `serverKey('claude.ai Claude Docs')` is `claude_ai_Claude_Docs`. The test also asserts that no line of either
  fixture matches `/[A-Za-z]:[\\/]+Users[\\/]/i`, `/\/[a-z]\/Users\//i`,
  `/[\w.+-]+@[\w-]+(\.[A-Za-z][\w-]*)+/` (an e-mail address; `accord@0.3.0` in the rules block is not one) or
  `/"thinking"/`.
- `firstCall(lines)`: lines are parsed objects. The first call is the first `type: 'assistant'` line whose
  `message.model` is not `<synthetic>`; its message id is `message.id ?? requestId ?? uuid`. Only lines before
  that line count as loaded before it: `instructions` gives `attachment.files` as `{ path, type }`;
  `skill_listing` gives `attachment.content` split into lines; `agent_listing_delta` gives `attachment.addedLines`;
  `hook_additional_context` gives each `attachment.content` item; `mcpServers` is every `addedNames` item of the
  `mcp_instructions_delta` attachments, then, for each `deferred_tools_delta` `addedNames` item of the form
  `mcp__<server>__<tool>`, the `<server>` part, deduplicated by `serverKey` (the instructions name is kept when
  both name one server) and sorted; `sessionStartHook` is true when a `hook_success` attachment has
  `hookEvent: 'SessionStart'`, `exitCode: 0` and a `command` holding ` hook session-start`. `prompt` is the text
  of the first `type: 'user'` line (a string `message.content`, or its `text` items joined with `\n`). `version`
  is the first line's `version` that is set.

## Task 2: Read the setup on this machine and group it by owner
covers: D-01, D-08
files: scripts/fixed-context.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-fixed.test.ts (new), packages/core/test/helpers/fixed-world.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-the-setup-lists-each-enabled-plugin-listable-MCP-server-and-own-skill-set-under-its-owner

Consumes: the repository's `.claude/` folder, `.mcp.json` and tracked `CLAUDE.md` files, the folders above the
repository, and the home folder's `.claude/settings.json`, `.claude/plugins/installed_plugins.json`,
`.claude.json` (its top-level `mcpServers` only), `.claude/skills/`, `.claude/agents/`, `.claude/commands/`,
`.claude/CLAUDE.md`, `.claude/rules/` and `.claude/projects/<folder>/memory/`. Two things are never read, because
the probe worktree loads neither, so a cost given to them would be one the all-on probe never measured: the
local-scope MCP servers (`<home>/.claude.json` `projects[<path>].mcpServers`, keyed by a checkout's path, which
the probe worktree's path never equals) and `<repo>/.claude/settings.local.json` (an untracked file, which a
worktree of the commit does not carry). The report says so (Task 8).
Produces: `export function readSetup({ repo, home })` in `scripts/benchmark.mjs`, `standsFor(path, setup)` in
`scripts/fixed-context.mjs`, and the test world helper.
Behaviour that must not change in `scripts/benchmark.mjs`: every existing export and mode.

`standsFor(path, { repo, mainCheckout, probeDir, home })` (pure) turns `\` into `/` and returns `{ file, label }`:
a path under `probeDir`, `repo` or `mainCheckout` (compared case folded, in that order) stands for the same path
under `repo`: `file` is `<repo>/<rest>` and `label` is `<rest>` (a probe transcript names the probe worktree's
copy, never the repository file the report sizes); otherwise a path under `home` keeps `file` and gets the label
`~/<rest>`; any other path keeps `file` and is its own label.

`readSetup` returns, every list sorted by its name, id or label, every path with `/`:
- `repo`, `home`, `mainCheckout`: the parent of `git rev-parse --path-format=absolute --git-common-dir` run in
  `repo` (a linked worktree gives the main checkout); `probeDir`: `path.resolve(repo, '..', 'accord-probe')`.
- `agents`: each `<repo>/.claude/agents/*.md` holding the line `<!-- generated by accord skills sync` (accord's
  marker): `{ name, file, model, tools, body, hash }`; `name` and `model` from the YAML frontmatter
  (`parseYaml`, already imported); `tools` the frontmatter `tools` split on `,` and trimmed, or `null` when absent
  (every tool); `body` the text after the closing `---` line; `hash` the sha256 hex of the whole file.
- `accordSkills`: each `<repo>/.claude/skills/*/SKILL.md` holding the marker: `{ name, description }` from its
  frontmatter.
- `hookCommand`: the `command` of the `SubagentStart` hook in `<repo>/.claude/settings.json` that holds
  ` hook subagent-start`, else `''`.
- `plugins`: the plugins enabled after merging `enabledPlugins` of `<home>/.claude/settings.json` and
  `<repo>/.claude/settings.json`, in that order (the second file's value wins; `settings.local.json` is never
  read); a plugin set `false` is left out (it costs nothing per call). Each is `{ id, version, accordOwn }`.
  `<home>/.claude/plugins/installed_plugins.json` holds `{ version, plugins: { <id>: [<install record>, ...] } }`:
  `plugins[id]` is an array of install records, each `{ scope, projectPath?, installPath, version, ... }` with
  `scope` `'user'` or `'project'` (checked: `~/.claude/plugins/installed_plugins.json:3-30` on the owner's
  machine). `version` is the `version` of the record with `scope: 'user'`, else of the record with
  `scope: 'project'` whose `projectPath` equals `mainCheckout` (slashes turned, case folded), else `null`;
  `accordOwn` is `id === 'accord-panel@accord'` (it counts under plugins, named as accord's own: ledger Ruling).
- `mcp`: the listable servers, `{ name, scope, entry, hash }`, from `<home>/.claude.json` `mcpServers` (`user`)
  and `<repo>/.mcp.json` `mcpServers` (`project`); a name in `project` replaces one in `user`. The `projects`
  map of `<home>/.claude.json` is never read (local scope, above). `hash` is the sha256 hex of `JSON.stringify(entry)`. An entry's values
  are never printed or written anywhere but the MCP config files of Task 3.
- `sets`: the owner's own skills, agents and commands, user level (`<home>/.claude/skills/<dir>/SKILL.md`,
  `<home>/.claude/agents/*.md`, `<home>/.claude/commands/**/*.md`) and project level (the same under
  `<repo>/.claude/`), without any file holding accord's marker. A member is `{ kind, name, level, hash }`: `kind`
  `skill`, `agent` or `command`; `name` the frontmatter `name`, else the folder name (skills), the file name without
  `.md` (agents), or the path below `commands/` without `.md` with `/` turned to `:` (commands); `hash` the sha256
  hex of the file. Members are grouped by prefix, the name up to its first `-` or `:` (a name with neither is its
  own prefix), into `{ prefix, members }`.
- `docs`: every instruction and memory file that exists now, `{ file, label, topic }` with `label` from
  `standsFor`, deduplicated by `file` case folded: `<home>/.claude/CLAUDE.md`; every `<home>/.claude/rules/**/*.md`;
  `CLAUDE.md` and `.claude/CLAUDE.md` in each folder above `repo` up to the drive root; every tracked file of
  `git ls-files -z -- ':(glob)**/CLAUDE.md' ':(glob).claude/rules/**/*.md'` run in `repo` (the root `CLAUDE.md`
  included); and every `*.md` in `<home>/.claude/projects/<enc>/memory/`, where `<enc>` is `mainCheckout` with
  every character outside `[A-Za-z0-9]` turned to `-` (`C:\Work\accord` gives `C--Work-accord`, the folder whose
  `memory/MEMORY.md` this repository's sessions load). `topic` is true for a memory file other than `MEMORY.md`
  (read on demand, not at session start), false for every other file.
A file or folder that does not exist gives an empty part; a JSON file that does not parse stops with an error
naming the file.

Test first. `packages/core/test/helpers/fixed-world.ts` (new) exports `makeWorld()` returning
`{ tmp, home, repo, bench, probeDir, memDir }` (all with `/`), building under a temporary folder `<tmp>`:
- `<tmp>/work/repo`: `git init -q -b main`; `.claude/agents/accord-scout.md` (tools `Read, Grep, Glob`, model
  `sonnet`), `accord-critic.md` (tools `Read, Grep, Glob`, model `opus`), `accord-executor.md` (no `tools`, model
  `sonnet`), each frontmatter then the marker line then one body line; `.claude/agents/my-helper.md` (no marker);
  `.claude/skills/accord/SKILL.md` (marker, `name: accord`, a description) and `.claude/skills/own-notes/SKILL.md`
  (no marker); `.claude/settings.json` with the SubagentStart hook command
  `npx --yes @accord-dev/accord@0.3.0 hook subagent-start` and `enabledPlugins: { "accord-panel@accord": true }`;
  `.mcp.json` with server `proj-db`; `CLAUDE.md` holding the pointer block (`<!-- accord:start -->` to
  `<!-- accord:end -->`, as in the repository's `CLAUDE.md`) and one own line; one commit of all of it. Then
  `.claude/settings.local.json` with `enabledPlugins: { "gamma@m": true }`, uncommitted, its path
  `.claude/settings.local.json` appended to `.git/info/exclude` so `git status` does not list it.
- `<tmp>/work/accord-bench` is `bench` (equal to `benchRoot(repo)`); `probeDir` is `<tmp>/work/accord-probe`
  (not created).
- `<tmp>/home`: `.claude/settings.json` with `enabledPlugins` `alpha@m: true`, `beta@m: true`, `gamma@m: false`;
  `.claude/plugins/installed_plugins.json` in the array form: `{ version: 2, plugins: { "alpha@m": [{ scope:
  "user", version: "1.0.0" }], "beta@m": [{ scope: "project", projectPath: "C:\\elsewhere", version: "9.9.9" },
  { scope: "user", version: "2.0.0" }], "gamma@m": [{ scope: "user", version: "3.0.0" }], "accord-panel@accord":
  [{ scope: "project", projectPath: <repo with every / turned to \>, version: "0.3.0" }] } }`;
  `.claude.json` with `mcpServers: { "user-search": { command: "x", env: { API_KEY: "sekret-user-123" } } }` and
  `projects: { <repo path>: { mcpServers: { "local-db": { type: "http", url: "https://x.invalid",
  headers: { Authorization: "Bearer sekret-local-456" } } } } }`; skills `gsd-a`, `gsd-b`, `aws-x`
  (`.claude/skills/<n>/SKILL.md`); agent `.claude/agents/gsd-r.md`; command `.claude/commands/tool/run.md`;
  `.claude/CLAUDE.md` with one line; `memDir`, `.claude/projects/<enc>/memory` with `<enc>` computed from `repo` by
  the rule above, holding `MEMORY.md` (one line) and `note.md` (one line).
- `it('risk:complex-branching the setup lists each enabled plugin listable MCP server and own skill set under its owner')`:
  `readSetup({ repo, home })` lists plugins `accord-panel@accord` (`accordOwn: true`, `version: '0.3.0'`),
  `alpha@m` (`1.0.0`) and `beta@m` (`2.0.0`), and not `gamma@m` (set `true` only in the excluded
  `settings.local.json`); servers exactly `proj-db` (`project`) and `user-search` (`user`), each with a 64-hex
  `hash`, and not the local-scope `local-db`; sets `aws` (skill `aws-x`), `gsd` (skills
  `gsd-a`, `gsd-b`, agent `gsd-r`), `my` (project agent `my-helper`), `own` (project skill `own-notes`) and `tool`
  (command `tool:run`); no set member named `accord` or `accord-*`; agents `accord-critic`, `accord-executor`
  (`tools: null`), `accord-scout` with their models; `accordSkills` `[{ name: 'accord', ... }]`; `hookCommand` the
  command above; `mainCheckout` equal to `repo`; `probeDir` equal to the world's; the `docs` whose `file` lies under
  `<tmp>` are exactly `CLAUDE.md`, `~/.claude/CLAUDE.md`, `~/.claude/projects/<enc>/memory/MEMORY.md` (`topic`
  false) and `~/.claude/projects/<enc>/memory/note.md` (`topic` true). `standsFor` of `<probeDir>/CLAUDE.md` written
  with `\` gives `{ file: '<repo>/CLAUDE.md', label: 'CLAUDE.md' }`, and of `<home>/.claude/CLAUDE.md` gives the
  label `~/.claude/CLAUDE.md`.

## Task 3: Write the phase-one probes, and `--fixed --probe`
covers: D-02, D-08
files: scripts/fixed-context.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-fixed.test.ts (new), packages/core/test/helpers/fixed-world.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-phase-one-has-an-all-on-probe-and-one-leave-one-out-probe-per-plugin-MCP-server-and-own-set, packages/core/test/benchmark-fixed.test.ts#risk:security-MCP-config-files-stay-under-the-bench-root-and-no-server-secret-is-printed-or-stored-in-the-repository, packages/core/test/benchmark-fixed.test.ts#risk:parsing-printed-commands-keep-absolute-paths-Git-Bash-runs-when-the-repository-lies-under-the-home-folder

Consumes: `readSetup` (Task 2), `PROBE_FORMS` and `dispatchPrompt` (Task 1). Produces: in
`scripts/fixed-context.mjs`, `fingerprints(setup)`, `phaseOne(setup)` and `shellLine(args)`; in
`scripts/benchmark.mjs`, `setupDirty(repo)`, `writeProbes({ repo, home, bench, probes, fresh, forms = PROBE_FORMS })`,
`fixedProbe({ repo, home, bench, forms = PROBE_FORMS })` (it passes `forms` to `writeProbes`) returning
`{ exit, text }`, and the mode `--fixed --probe`, whose `main()`
branch prints `text` and returns `exit` (every function of this plan returns its text and only `main()` prints).
Behaviour that must not change in `scripts/benchmark.mjs`: every existing mode; `main()` keeps answering every
other argument list as before, and its usage line gains `--fixed [--probe]`.

- `fingerprints(setup)` maps: `plugin:<id>` to its version or `none`; `mcp:<name>` to its hash; `set:<prefix>` to
  the sha256 hex of its members as sorted lines `<kind>\0<name>\0<hash>`; `agent:<name>` to the agent's hash;
  `hook` to `hookCommand`; `skills` to the sha256 hex of the accord skills as sorted lines
  `<name>\0<description>`; `docs` to the sha256 hex of the sorted labels of the `docs` whose `topic` is false
  (which instruction files exist: a `CLAUDE.md`, rule or `MEMORY.md` added or removed since the all-on probe makes
  it stale).
- `phaseOne(setup)` returns the probes run from the probe worktree, sorted by id, each
  `{ id, where: 'probe', depends, settings?, mcp? }`: `all-on` (depends on every key of `fingerprints`); one
  `plugin:<id>` per enabled plugin with `settings: { enabledPlugins: { <id>: false } }` (depends `plugin:<id>`);
  `mcp-ref` with `mcp` every listable server (depends on every `mcp:` key, so a changed server re-runs the
  reference its figure is read against); one `mcp:<name>` per listable server with `mcp` every other listable
  server (depends `mcp:<name>`); one `set:<prefix>` per set (depends `set:<prefix>`) whose `settings` move every
  member out of reach by its kind, the forms Task 1's spike proved (ledger Rulings): each `agent` member is an
  entry of `permissions.deny`, `PROBE_FORMS.deny.agent` with `{name}` replaced by the member's name; each `skill`
  and `command` member is a key of `skillOverrides`, the member's name mapped to `PROBE_FORMS.skillOverride` (a
  `Skill(<name>)` deny rule leaves the entry in the skill listing, so `PROBE_FORMS.deny.skill` and
  `PROBE_FORMS.deny.command` are `null` and are never read). `permissions` is present only when the set has an
  agent member and `skillOverrides` only when it has a skill or command member; a command's key is its name as
  Task 2 gives it (`tool:run` for `commands/tool/run.md`). `mcp-ref`
  exists also when there is no listable server: it then has no `mcp` and is `--strict-mcp-config` alone, so the
  connected-servers line is still measured (approach).
- `shellLine(args)` joins arguments for Git Bash: an argument matching `/^[A-Za-z0-9._/@+=:,-]+$/` as is, any
  other (the empty string included) in single quotes with each `'` written `'\''`. Every path given to it is
  absolute, never `~/...` (preamble): a `~` is outside the plain set, so it would be quoted and Git Bash would
  not expand it.
- `setupDirty(repo)` is true when `git status --porcelain -z -- ':(literal).claude' ':(glob)**/CLAUDE.md'` run in
  `repo` prints anything (the probe worktree holds the commit, not the working files).
- `writeProbes` writes, for each probe with `where: 'probe'`, its files under `<bench>/fixed/`:
  `<safe id>.settings.json` (the `settings` object) and `<safe id>.mcp.json` (`{ mcpServers: { <name>: <entry> } }`),
  where the safe id is the id with every character outside `[A-Za-z0-9._-]` turned to `_`. It gives the probe a
  session id (`crypto.randomUUID()`) when `fresh` is true or the probe has none in `probes.json`, and builds its
  command with `shellLine`: `cd <probeDir> && claude -p <prompt> --session-id <id> ...forms.extraArgs
  [--settings <file>] [--mcp-config <file>] [--strict-mcp-config]` with the prompt
  `dispatchPrompt(<every setup agent name>)` directly after `-p` (the documented `claude -p "query"` form: a flag of
  `extraArgs` that takes a list, such as `--allowedTools Agent`, would take a prompt placed after it as one more
  value); `--strict-mcp-config` is on `mcp-ref` and every `mcp:` probe. It
  stores `{ id, sessionId, cwd, command, fingerprint }` (`fingerprint` the probe's depends keys with their current
  values) into `probes.json`, keeping entries of other probes.
- `fixedProbe` (`node scripts/benchmark.mjs --fixed --probe`) refuses with exit 2 and the one line
  `Refused: .claude or a CLAUDE.md file has uncommitted changes; the probe worktree holds the commit. Commit them and run again.`
  when `setupDirty(repo)` is true. Otherwise it writes every phase-one probe with `fresh: true` and prints:
  a first line `# Run in Git Bash, then run: node scripts/benchmark.mjs --fixed`; then
  `git -C <repo> worktree add -B probe/fixed-context <probeDir> <HEAD sha>` when the probe worktree folder
  does not exist, else `git -C <probeDir> checkout -B probe/fixed-context <HEAD sha>` (absolute paths through
  `shellLine`);
  then each probe's command, one per line, sorted by id. Exit 0.

Tests first, both with `makeWorld()`, calling `fixedProbe` and reading its `text`:
- `it('risk:complex-branching phase one has an all-on probe and one leave-one-out probe per plugin MCP server and own set')`:
  `phaseOne(readSetup(...))` ids are exactly `all-on`, `mcp-ref`, `mcp:proj-db`, `mcp:user-search`, `plugin:accord-panel@accord`, `plugin:alpha@m`, `plugin:beta@m`, `set:aws`, `set:gsd`,
  `set:my`, `set:own`, `set:tool`; the `settings` of each set probe, compared with `toEqual` against objects the
  test builds from `PROBE_FORMS` (`PROBE_FORMS.deny.agent.replace('{name}', <name>)` and
  `PROBE_FORMS.skillOverride`): `set:gsd` is `{ permissions: { deny: [<agent gsd-r>] }, skillOverrides: { 'gsd-a':
  <off>, 'gsd-b': <off> } }`, `set:my` is `{ permissions: { deny: [<agent my-helper>] } }` with no
  `skillOverrides`, `set:aws` is `{ skillOverrides: { 'aws-x': <off> } }`, `set:own` is `{ skillOverrides:
  { 'own-notes': <off> } }` and `set:tool` is `{ skillOverrides: { 'tool:run': <off> } }`, the last three with no
  `permissions`; `<bench>/fixed/set_gsd.settings.json`, which `writeProbes` wrote, parses to the same object; the printed commands pass settings and MCP config by `--settings <path>` /
  `--mcp-config <path>` (no printed line holds `{`), each starts with `'cd ' + shellLine([probeDir]) + ' && '`
  (the temporary path may hold a space, which `shellLine` quotes), and the line before them is the `worktree add`
  line; each command holds `'claude -p ' + shellLine([dispatchPrompt(<the agent names of readSetup in order>)]) +
  ' --session-id '`; `probes.json` holds one entry per probe with a distinct session id. With
  `forms: { ...PROBE_FORMS, extraArgs: ['--allowedTools', 'Agent'] }`, `fixedProbe` prints an all-on command (the
  line holding the all-on session id of `probes.json`) that holds that same `claude -p <prompt> --session-id ` text
  and ends with ` --allowedTools Agent`. A setup with no listable server still
  has `mcp-ref`, whose command holds `--strict-mcp-config` and no `--mcp-config`. After an uncommitted edit of
  `.claude/agents/accord-scout.md`, `fixedProbe` exits 2 with the refusal line.
- `it('risk:security MCP config files stay under the bench root and no server secret is printed or stored in the repository')`:
  after `--fixed --probe` on the world, `sekret-user-123` appears in no printed line, in no file under `repo`,
  and not in `probes.json`; it appears only in `.mcp.json` files under `<bench>/fixed/`, and `<bench>` is not
  inside `repo`; `sekret-local-456` (the local-scope server, never read) appears in no printed line and in no
  file under `repo` or `<bench>`.
- `it('risk:parsing printed commands keep absolute paths Git Bash runs when the repository lies under the home folder')`:
  `makeWorld` gains an option `{ underHome: true }` that builds the work folder at `<tmp>/home/work` instead of
  `<tmp>/work`, so `repo`, `bench` and `probeDir` lie under `home` (every other part of the world as before). On
  that world, `fixedProbe({ repo, home, bench })` exits 0; no printed line holds `~`; the line after the first is
  exactly `'git -C ' + shellLine([repo]) + ' worktree add -B probe/fixed-context ' + shellLine([probeDir]) + ' ' +
  <HEAD sha>`; every command starts with `'cd ' + shellLine([probeDir]) + ' && '`; the `set:gsd` command holds
  `' --settings ' + shellLine([bench + '/fixed/set_gsd.settings.json'])` and the `mcp-ref` command holds
  `' --mcp-config ' + shellLine([bench + '/fixed/mcp-ref.mcp.json'])`, each of those files exists, and each
  `cwd` in `probes.json` equals `probeDir`.

## Task 4: Plan the phase-two probes: connectors, baseline, references and appended texts
covers: D-01, D-06
files: scripts/fixed-context.mjs (new), packages/core/test/benchmark-fixed.test.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-each-text-is-sized-on-the-models-of-the-rows-it-reaches-and-the-baseline-has-one-stub-per-tool-list-and-model

Consumes: a setup (Task 2), `standsFor` (Task 2), and `allOn`, `{ main: FirstCall, agents: { <name>: FirstCall } }`
read from the all-on probe (Task 1). Produces, pure in `scripts/fixed-context.mjs`: `stubsOf(setup, allOn)`,
`textsOf(setup, allOn, read)`, `connectorsOf(setup, allOn)` and `phaseTwo(setup, allOn, read, forms = PROBE_FORMS)`.

- `stubsOf`: one stub per distinct pair of tool list (sorted; `null` is its own value) and model key among the
  accord agents that have an all-on FirstCall; stubs are named `stub-1`, `stub-2`, ... in the order of their first
  agent by name. Each is `{ name, tools, model, agents: [<agent names>] }`, where `model` is the agent's
  frontmatter model (passed to `--agents`) and the pair is told apart by the FirstCall model key.
- `textsOf` returns `{ id, owner, label, text, rows }` for each text that reaches at least one row (a text is
  charged only to rows it reaches, read from the all-on probe):
  - `agent:<name>` (owner `accord`): the agent's `body`; rows `[<name>]`.
  - `rules` (`accord`): the first `hookContexts` item starting `# accord rules` among the agents' FirstCalls; rows:
    each agent whose FirstCall holds that item, and `main` when the main FirstCall's `sessionStartHook` is true
    (the session-start hook prints the same block first: `packages/cli/src/commands/hook.ts:20-48`).
  - `skill-listing` (`accord`): the lines of a FirstCall's `skillListing` that start with `- <accord skill name>:`,
    joined with `\n`, taken from the main FirstCall when it has them, else from the first agent by name that has
    them; rows: each row whose FirstCall `skillListing` holds such a line.
  - `agent-listing` (`accord`): the same with `agentListing` and `- <accord agent name>:`.
  - For each `instructions` path in any FirstCall, `{ file, label } = standsFor(path, setup)`, deduplicated by
    `file` case folded: `read(file)` gives the file now (`undefined` when it no longer exists: no text). `read` is
    never given a path under `probeDir`: the probe worktree's copy stands for the repository file, which is what is
    sized. When the file holds `<!-- accord:start -->` and `<!-- accord:end -->`, `pointer:<label>` (`accord`) is
    the text from the start marker to the end of the end marker, and `doc:<label>` (`CLAUDE.md and memory`) is the
    file with that span removed; otherwise `doc:<label>` is the whole file. Rows of both: each row whose FirstCall
    `instructions` lists a path standing for that `file`. A `doc:` text that is empty after the cut is left out.
  - `prompt` (owner `probe`): `dispatchPrompt(<agent names>)`, rows `['main']`; `baseline-prompt` (`probe`):
    `dispatchPrompt(<stub names>)`, rows `['main']`; `brief` (`probe`): `PROBE_BRIEF`, rows every agent with an
    all-on FirstCall.
- `connectorsOf(setup, allOn)`: the names in the all-on main FirstCall's `mcpServers` whose `serverKey` equals no
  listable server's `serverKey`, split into `connectors` (the claude.ai connectors, preamble) and `others` (the
  rest, such as plugin-provided servers whose key starts `plugin_`), each sorted.
- `phaseTwo` returns, sorted by id, each `{ id, where, depends, model?, ... }`: when `forms.connector` is not
  `null`, one `connector:<name>` per name of `connectorsOf(...).connectors`, `where: 'probe'`,
  `settings: { permissions: { deny: [forms.connector with {server} replaced by serverKey(name)] } }`, `depends`
  `{}`; `baseline` (`where: 'empty'`, `model` the main's model key, `stubs` from `stubsOf`, depends `stubs` with the
  stubs' JSON as value); `ref:<model>` (`where: 'empty'`) for each model key of a row; `text:<text id>:<model>`
  (`where: 'empty'`) for each text and each distinct model key of the rows it reaches (`text` the text, `source`
  `'disk'` for `agent:`, `doc:` and `pointer:` texts and `'probe'` for the others, depends `text:<text id>` with
  the sha256 hex of the text). `phaseTwo` builds no command; Task 5 writes the files and commands.

Test first: `it('risk:complex-branching each text is sized on the models of the rows it reaches and the baseline has one stub per tool list and model')`,
in memory, no files: a setup with `repo` and `mainCheckout` `C:/w/repo`, `probeDir` `C:/w/accord-probe`, `home`
`C:/h`, one listable server `proj-db`, and three agents (scout: `Read, Grep, Glob`, sonnet; critic:
`Read, Grep, Glob`, opus; executor: `null`, sonnet); an `allOn` where main (model `m-opus`, `sessionStartHook:
true`, `skillListing` `['- accord: a', '- gsd-a: b']`, `agentListing` `['- accord-scout: s', '- other: o']`,
`instructions` `C:\w\accord-probe\CLAUDE.md` and `C:/h/.claude/projects/C--w-repo/memory/MEMORY.md`, `mcpServers`
`['claude.ai Docs X', 'plugin_alpha_srv', 'proj_db']`), scout (`m-sonnet`, the rules context, `instructions`
`C:/w/accord-probe/CLAUDE.md`), critic (`m-opus`, rules, both files) and executor (`m-sonnet`, rules,
`skillListing` `['- accord: a']`, `C:/w/accord-probe/CLAUDE.md`); `read` records every file it is given and returns
a `CLAUDE.md` with the pointer block and one own line for `C:/w/repo/CLAUDE.md`, and a one-line `MEMORY.md`.
Assert: `read` was given `C:/w/repo/CLAUDE.md` and no path under `C:/w/accord-probe`; the texts `doc:CLAUDE.md`,
`pointer:CLAUDE.md` and `doc:~/.claude/projects/C--w-repo/memory/MEMORY.md` exist; the stubs are three (scout's,
critic's, executor's pairs); `agent:accord-critic` is sized on `m-opus` only; `rules` on `m-opus` and `m-sonnet`
(rows main, scout, critic, executor); `skill-listing` on `m-opus` and `m-sonnet` (rows main and executor, not scout
or critic); `agent-listing` on `m-opus` only (row main); the `MEMORY.md` doc on `m-opus` only (main and critic);
the `CLAUDE.md` doc holds the own line and not `accord:start`, and its pointer text holds both markers; `brief` is
sized on both models; `prompt` and `baseline-prompt` on `m-opus`; one `ref:` per model; a setup agent with no
all-on FirstCall gets no text and no stub; `connectorsOf` gives connectors `['claude.ai Docs X']` and others
`['plugin_alpha_srv']`; with `forms` `{ ...PROBE_FORMS, connector: 'mcp__{server}' }` the probes hold exactly one
`connector:claude.ai Docs X` (`where: 'probe'`, deny `['mcp__claude_ai_Docs_X']`), and with `connector: null` none.

## Task 5: Find the probes that are missing or stale, and write their commands
covers: @ac-1, @ac-3, D-02
files: scripts/fixed-context.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-fixed.test.ts (new), packages/core/test/helpers/fixed-world.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-a-changed-item-reprints-only-its-own-probes-and-the-all-on-probe, packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-a-set-probe-that-still-lists-a-member-makes-fixed-refuse-naming-the-set-and-the-probe-version

Consumes: Tasks 1 to 4. Produces: in `scripts/benchmark.mjs`, `locateSessions(home, sessionIds)` and
`fixedPending({ repo, home, bench })`; in `scripts/fixed-context.mjs`, `probeVersion(state, located)` and
`pendingProbes({ setup, state, located, version, read, forms = PROBE_FORMS })`, whose `failed` list makes
`fixedPending` refuse. Behaviour that must not change: `fixedProbe` (Task 3) still writes every phase-one probe
anew and checks no transcript; the existing modes of `scripts/benchmark.mjs`.

- `locateSessions(home, ids)` looks in every folder under `<home>/.claude/projects/` for `<id>.jsonl` and returns a
  Map from id to `{ main: FirstCall | null, agents: { <agentType>: FirstCall } }`, the agents read from
  `<folder>/<id>/subagents/agent-*.jsonl` with their `.meta.json` `agentType`; an id with no file is absent.
- `probeVersion(state, located)`: the probe version (preamble), `undefined` when no session `state` names has a
  main FirstCall. The version of the session running the script is never used here: the probes run in Git Bash,
  whose Claude Code may be another build.
- `pendingProbes` returns `{ probes, pending, failed, notes }`: `probes` the probes needed now, `pending` their ids
  that are missing or stale, sorted, and `failed` the set probes that did not move their members out of reach
  (below). A probe is missing when `state` has no entry for it, or its session has no main FirstCall, or (`where: 'probe'`) an accord agent of the setup has no FirstCall in it, or (`baseline`) a stub has
  none. A probe is stale when `version` is set and its main FirstCall's `version` differs from it, or a key of its
  `depends` has a stored value different from the current one. `all-on` is also stale when the stored text hash
  of a `text:` probe whose text has `source: 'disk'` differs from the current text's hash (a changed text needs
  its own append probe and the all-on probe again: approach); both are then printed together, and once both have
  run neither is stale. A text taken from the all-on transcript itself (`rules`, the listings) never makes the
  all-on stale; the all-on's `hook`, `skills`, `docs` and `agent:` keys cover what changes it. The probes needed
  are `phaseOne(setup)` always, and `phaseTwo(setup, allOn, read, forms)` whenever the all-on probe in `state` has
  a transcript (`allOn` read from it, stale or not); without one, `notes` holds
  `The connector, baseline, reference and text probes follow once the all-on probe has run.`
- `failed`: `skillOverrides` is read from the `claude.exe` binary, not documented (ledger Ruling), so a newer
  Claude Code may ignore it and leave a set in reach. A `set:<prefix>` probe that is not pending fails when its
  main FirstCall or any of its agents' FirstCalls still lists a member of the set: a `skill` or `command`
  member when a line of that FirstCall's `skillListing` starts with `- <name>:`, an `agent` member when a line of
  its `agentListing` starts with `- <name>:`. A pending set probe is never failed (it is run again anyway).
  `failed` is `[{ id, member }]` sorted by id, `member` the first listed member's name in sorted order.
- Files and commands: a probe with `where: 'probe'` (phase one and `connector:`) gets Task 3's files and command
  through `writeProbes`. For `where: 'empty'`, `<bench>/fixed/stubs.json` holds the baseline stubs as
  `{ <name>: { description: 'probe stub', prompt: 'Reply ok.', model, tools } }` (`model` the frontmatter model,
  `tools` the array of tool names, the form run f of Task 1 proved, and absent for `null`);
  `<bench>/fixed/<safe id>.md` holds a `text:` probe's text. Every `where: 'empty'` command is
  `cd <bench>/fixed/empty && claude -p <prompt> --session-id <id> ...PROBE_FORMS.extraArgs ...PROBE_FORMS.noSources
  --strict-mcp-config --model <model key>`, the prompt directly after `-p` as in Task 3, followed by: for
  `baseline`, `--agents` with the path of `stubs.json` when `PROBE_FORMS.agentsArg` is `'file'`, else the JSON
  itself (quoted by `shellLine`), with the prompt `dispatchPrompt(<stub names>)`; for `ref:`, nothing more, with the
  prompt `PROBE_BRIEF`; for `text:`, `--append-system-prompt-file <its .md file>`, with the prompt `PROBE_BRIEF`.
- `fixedPending` first refuses with exit 2 and Task 3's refusal line, writing nothing, when `setupDirty(repo)` is
  true: a working-copy edit would be sized from disk while the probe worktree checks out HEAD. Otherwise it reads
  the setup, `probes.json` and the sessions it names, takes `version = probeVersion(...)`, computes the pending
  probes with `read` reading a file from disk (`undefined` when absent). When `failed` is not empty it refuses
  with exit 2, writing nothing, and its `text` is one line per failed probe, in `failed`'s order:
  `Refused: the probe <id> still lists <member> under Claude Code <version>, so the settings that move a set out of reach no longer work on this version; run the switch spike again and update PROBE_FORMS in scripts/fixed-context.mjs before measuring.`
  (`<version>` is the probe version.) Otherwise, for each pending probe it writes its files and its `probes.json`
  entry; a pending probe keeps its stored session id while no transcript exists for
  it, else gets a new one. When nothing is pending it writes nothing. It returns
  `{ exit, pending, version, text }`, `text` being the lines `fixedProbe` prints (the worktree line only when a
  `where: 'probe'` probe is pending) followed by the notes. `where: 'empty'` probes run from
  `<bench>/fixed/empty`, which `fixedPending` creates, and refuses (exit 2 and one line) when
  `git rev-parse --is-inside-work-tree` succeeds there.

Test first. `fixed-world.ts` gains `writeSession(home, folder, sessionId, { main, agents })` writing
`<home>/.claude/projects/<folder>/<sessionId>.jsonl` and each `<sessionId>/subagents/agent-<n>.jsonl` with its
`.meta.json` (`agentType`, `description`), and line builders: `assistantLine({ id, model, input, cacheRead,
cacheWrite, output, ts, cwd, branch, version, chars })`, `attachmentLine(attachment)` and `userLine(text)`.
`it('risk:complex-branching a changed item reprints only its own probes and the all-on probe')` on `makeWorld()`:
1. after `fixedProbe`, `fixedPending` lists every phase-one id and the note, no phase-two id;
2. once every phase-one session is written (main and the three agents, version `9.0.0`, the all-on main with
   `instructions` naming `<probeDir>/CLAUDE.md` and `<home>/.claude/CLAUDE.md`, the agents with the rules
   context), it lists exactly the phase-two ids of `phaseTwo` for that all-on transcript, and no id holds
   `accord-probe` (the doc and pointer labels are `CLAUDE.md` and `~/.claude/CLAUDE.md`);
3. once those are written (version `9.0.0`), nothing is pending and `probes.json` is unchanged by the call. The
   test saves the bytes of `probes.json` here. Steps 4 to 8 each begin by writing those bytes back, so every step
   is read against the step-3 state; steps 4 to 6 undo their own change to the world after asserting;
4. with `beta@m`'s user record set to `2.1.0` in `installed_plugins.json`, exactly `all-on` and `plugin:beta@m`;
5. with `<home>/.claude/rules/style.md` created (one line), exactly `all-on` (the `docs` key changed);
6. with the all-on main transcript rewritten at version `9.1.0` and a newer `ts` (its bytes saved first and
   written back after asserting), every needed probe except `all-on`;
7. with the own line of the world's `CLAUDE.md` changed and committed, exactly `all-on` and the
   `text:doc:CLAUDE.md:<model>` ids of that file, not its `text:pointer:CLAUDE.md:` ids;
8. with `.claude/agents/accord-scout.md` edited and not committed, `fixedPending` returns exit 2 with the refusal
   line and `probes.json` keeps its bytes.

`it('risk:complex-branching a set probe that still lists a member makes fixed refuse naming the set and the probe version')`
on `makeWorld()`: after `fixedProbe`, write every phase-one session (main and the three agents, version `9.0.0`)
as step 2 above does (one function in the test file writes them for both tests), except that the `set:gsd` main session holds, before its first assistant line,
`attachmentLine({ type: 'skill_listing', content: '- accord: a\n- gsd-b: b' })`; save the bytes of `probes.json`.
Assert, each case starting from those bytes:
1. `fixedPending` returns exit 2, and its `text` is exactly the one refusal line for `set:gsd` with member `gsd-b`
   and version `9.0.0`; `probes.json` keeps its bytes and no `<bench>/fixed/stubs.json` exists;
2. with the `set:gsd` session rewritten without that line and the `set:my` session's `accord-executor` transcript
   holding, before its first assistant line, `attachmentLine({ type: 'agent_listing_delta', addedLines:
   ['- my-helper: h'] })`, the exit is 2 and the one refusal line names `set:my`, `my-helper` and `9.0.0`;
3. with the `set:my` main session also rewritten at version `8.0.0` and a `ts` older than every other session's
   (the probe version stays `9.0.0`, so `set:my` is stale and pending), its executor transcript still holding
   that line, the exit is not 2 and `pending` holds `set:my`;
4. with the `set:my` session rewritten as the other phase-one sessions are (no member listed, version `9.0.0`),
   the exit is not 2 and `pending` holds no phase-one id.

## Task 6: Read every real call, main session and subagents, and leave out probe and bench runs
covers: @ac-1, @ac-2, D-06
files: scripts/benchmark.mjs, packages/core/test/benchmark-fixed.test.ts (new), packages/core/test/helpers/fixed-world.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:parsing-calls-are-read-once-per-message-from-main-and-subagent-transcripts-and-probe-and-bench-runs-are-left-out

Consumes: transcript folders (`defaultDirs(repo)`, `scripts/benchmark.mjs:17`, or the folders named on the command
line). Produces: `export function readCalls(dirs, { bench })` in `scripts/benchmark.mjs`, returning
`{ calls, version, folders }`. Behaviour that must not change: `readSessions` and the legacy report read every run
that is not a probe run exactly as before.

- A call is one assistant message (`message.id ?? requestId ?? uuid`) whose `model` is not `<synthetic>`, read
  from a main session `<folder>/<s>.jsonl` (row `main`) or a subagent run `<folder>/<s>/subagents/agent-*.jsonl`
  (row its `.meta.json` `agentType`; `accord` true when it starts with `accord-`). Each call is
  `{ row, accord, file, ts, model, version, cwd, branch, input, cacheRead, cacheWrite, output }`: the usage fields
  are each the largest over the message's lines (a streamed message repeats its usage: count it once); `output`
  is the larger of `output_tokens` and `Math.ceil(chars / 4)`, chars being the length of every `text`, `thinking`
  and `JSON.stringify(input)` of `tool_use` items (the existing 4-characters-a-token estimate,
  `scripts/benchmark.mjs:280-286`); `cwd`, `branch` (`gitBranch`), `version` and `ts` from the message's first line.
- Left out (they are measurement, not work: ledger Ruling): a main session any of whose lines has `gitBranch`
  `PROBE_BRANCH` or whose first user line starts with `PROBE_PREFIX`, with all its subagent runs; a subagent run
  whose meta `description` starts with `PROBE_DESCRIPTION` or `bench r` or any of whose lines has `gitBranch`
  `PROBE_BRANCH`; and a call whose `cwd` lies under `bench` (slashes turned, case folded) or whose `branch` starts
  with `bench/`.
- `version` is the `version` of the kept call with the newest `ts` (the Claude Code of the owner's work sessions);
  Task 8 prints it beside the probe version when the two differ, and no probe is judged by it. `folders` is
  `dirs.length`.
- `readSessions` (`scripts/benchmark.mjs:307`) and `legacyReport` (`scripts/benchmark.mjs:68`) skip a subagent run
  whose meta `description` starts with `PROBE_DESCRIPTION` or any of whose lines has `gitBranch` `PROBE_BRANCH`
  (probe runs are left out of the existing round tools: approach).

Test first: `it('risk:parsing calls are read once per message from main and subagent transcripts and probe and bench runs are left out')`,
with `writeSession` into one folder of a fake home: a real main session (message `m1` over two lines with the same
usage, message `m2`, one `<synthetic>` line); an `accord-scout` run of two calls; a `general-purpose` run of one call;
a probe session (`gitBranch` `probe/fixed-context`, its lines newer than every other and on another version) with a
`fixed probe accord-scout` run; a run whose `cwd` is under `bench`. Assert the calls: two `main`, two
`accord-scout` (`accord: true`), one `general-purpose` (`accord: false`), none from the probe or the bench run;
`m1`'s usage counted once; an `output` raised by its text length; `version` the newest kept call's, not the probe
session's; and `readSessions([folder]).runs` holds the scout and general-purpose runs and not the probe run.

## Task 7: Turn the probe transcripts into each row's total and parts
covers: @ac-1, D-01
files: scripts/fixed-context.mjs (new), packages/core/test/benchmark-fixed.test.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-a-part-is-charged-only-to-the-rows-it-reaches-and-unattributed-is-what-the-named-parts-leave

Consumes: a setup, the probes of `pendingProbes` with none pending, the probe state, the located sessions,
`textsOf` and `connectorsOf`. Produces, pure: `measure({ setup, probes, state, located, texts })` returning
`{ rows, items }`, where `state` is the parsed `probes.json` (`{ probes: [{ id, sessionId, ... }] }`) and `located`
the Map `locateSessions` returns, keyed by session id. `S(p)` is the `sessionId` of the `state` entry whose `id` is
`p`. `I(p, r)` below is the first-call `input` of row `r` in probe `p`: `located.get(S(p)).main` for `main`,
`located.get(S(p)).agents[r]` for an agent; for `baseline`, `agents[<the stub row r maps to>]`; for `ref:` and
`text:` probes, the `main`. `size(t, m) = I(text:t:m, main) − I(ref:m, main)` (no characters-per-token ratio:
approach); `m(r)` is row `r`'s model key. The all-on transcript is `located.get(S('all-on'))`.
- Rows: `main` and each setup agent with an all-on FirstCall. Each `{ row, model: m(r), total, parts:
  { accord, claudeCode, plugins, mcp, docs, sets }, unattributed }`, all in raw tokens per call:
  - `total = I(all-on, r) − size(prompt, m(main))` for `main`, `I(all-on, r) − size(brief, m(r))` for an agent
    (the fixed context is without the task prompt: ledger Ruling).
  - `claudeCode = I(baseline, main) − size(baseline-prompt, m(main))` for `main`, and
    `I(baseline, stub of r) − size(brief, m(r))` for an agent.
  - each plugin `p`: `I(all-on, r) − I(plugin:p, r)`; each listable server `s`: `I(mcp-ref, r) − I(mcp:s, r)`;
    each connector `c` with a `connector:` probe: `I(all-on, r) − I(connector:c, r)`; the line `other connected
    servers`: `I(all-on, r) − I(mcp-ref, r)` less every connector item of that row; each set `g`:
    `I(all-on, r) − I(set:g, r)`.
  - each text with owner `accord` or `CLAUDE.md and memory`: `size(t, m(r))` for each row it reaches, 0 elsewhere.
  - `accord`, `plugins` (accord-panel included, labelled as accord's own), `mcp` (listable servers, connectors and
    the other connected servers line), `docs`, `sets` are the sums of their items; `unattributed = total −
    claudeCode − every other part`, so the parts add up to the total (it may be negative: leave-one-out figures need
    not add up, approach).
- `items`: one entry per item, `{ id, owner, label, perRow: { <row>: tokens } }`, listed whether or not it reaches
  a row (ac-4 asks for every item): every enabled plugin, every listable server, every connector with a probe, the
  other connected servers line, every set, every accord text, and every doc of `setup.docs` plus every `doc:` text
  whose label is in none of them. An item reaches a row, and gets a `perRow` value there, when it is a text that
  reaches the row or a probe item whose difference in that row is not 0; a doc of `setup.docs` with no `doc:` text
  (it did not load, such as a memory topic file) reaches no row. Labels: the plugin id (with ` (accord's own)` for
  `accord-panel@accord`), the server name, the connector name with ` (claude.ai connector)`, `other connected
  servers: <names>` (the `connectorsOf` names with no `connector:` probe, `others` included, joined with `, `, or
  `none`), `set <prefix>` with its member count, the doc's label, `pointer block <label>`, `agent definition`,
  `rules block`, `skill listing entries`, `agent listing entries`.

Test first: `it('risk:complex-branching a part is charged only to the rows it reaches and unattributed is what the named parts leave')`,
in memory: rows main, scout (no skill listing) and executor; a `state` naming one session id per probe and a
`located` Map holding chosen first-call inputs for every probe of a setup with plugins `alpha@m` and `beta@m`, one
listable server, one set, the docs `CLAUDE.md` and `~/.claude/projects/x/memory/note.md` (no text for the second),
and an all-on main whose `mcpServers` are `claude.ai Docs X` and `plugin_alpha_srv` with a `connector:claude.ai
Docs X` probe; `alpha@m`'s probe equal to all-on in scout's row; `beta@m`'s probe equal to all-on in every row.
Assert each part equals the formula's value from the chosen numbers; the connector item and the `other connected
servers: plugin_alpha_srv` line equal theirs; `skill listing entries` has no value in scout's row; `alpha@m` does
not reach scout; the `beta@m` and `note.md` items are listed with an empty `perRow`; each row's parts plus
`unattributed` equal its `total`.

## Task 8: `--fixed` prints the raw table by owner and writes the report
covers: @ac-1, @ac-3, D-02, D-06, D-07
files: scripts/fixed-context.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-fixed.test.ts (new), packages/core/test/helpers/fixed-world.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#ac-1-the-main-session-and-each-accord-agent-that-ran-get-one-row-split-by-owner (@ac-1), packages/core/test/benchmark-fixed.test.ts#ac-3-the-report-printed-twice-on-the-same-transcripts-and-setup-is-the-same (@ac-3)

Consumes: Tasks 2 to 7. Produces: `export function fixedReport({ repo, home, bench, dirs })` returning
`{ exit, text }` in `scripts/benchmark.mjs`, `render(...)` in `scripts/fixed-context.mjs`, and the mode
`node scripts/benchmark.mjs --fixed [folder ...]`, which prints `text` and returns `exit`. With no folder named,
`main()` passes `defaultDirs(<main checkout>)` (the main checkout's folder and every sibling worktree's, such as
`C--Work-accord-st-ln-79`; `defaultDirs(repo)` run from a ticket worktree would read that worktree alone).
Behaviour that must not change: the other modes and `--fixed --probe`.

`fixedReport`: reads `readCalls(dirs, { bench })`, then `fixedPending({ repo, home, bench })`. When that exits 2,
`fixedReport` returns its exit and text. When probes are pending: `exit` 1, `text` the commands, and the report
file is not written (the size is measured on the setup as it is when the report runs: ac-1). Otherwise
`measure({ setup, probes, state, located, texts })` with the `probes.json` it read, `render(...)`, writes `text`
to `<repo>/docs/benchmark/fixed-context.md` (creating the folder), `exit` 0.

`render` prints, reading no clock (every date comes from transcripts, as UTC `YYYY-MM-DD`):
```
# Fixed context per call

Transcripts: <calls> calls from <first> to <last>, read from <folders> transcript folder(s).
Probes: the all-on probe of <its date> under Claude Code <probe version>.
The newest transcript call ran Claude Code <readCalls version>; the figures are measured under Claude Code <probe version>.
The main session row is measured under claude -p, with its probe prompt sized and taken out.
<row>: <n> of its <m> calls ran on <other model ids>; they are counted at the size measured on <model>.
A claude.ai connector can change its instructions on the server, which no fingerprint sees; its figure holds for the probe date.
A plugin's own MCP servers count under plugins and again in the other connected servers line; unattributed absorbs the overlap.
Local-scope MCP servers and .claude/settings.local.json are not measured: the probe worktree loads neither.
Cursor, Codex and Copilot calls were not measured.

## Fixed context per call, raw tokens

| row | model | calls | fixed | accord | Claude Code | plugins | MCP servers | CLAUDE.md and memory | own skills, agents and commands | unattributed |
```
`<calls>`, `<first>` and `<last>` count every call `readCalls` kept; the `The newest transcript call ...` line
appears only when the `readCalls` version differs from the probe version; the `<row>: ...` line appears once per
row with calls on another model than its model key. Table rows: `main session (claude -p)` first, then each
accord agent that ran (at least one call) by name; `calls` is the row's call count; the figures are integers. An
accord agent that ran but has no definition now gets its calls and `-` in every figure. Rows of agents that did
not run are not printed.

Tests first, on a measured world: `fixed-world.ts` gains `measuredWorld()`, which builds `makeWorld()`, runs
`fixedProbe`, writes a session for every phase-one probe with chosen first-call inputs (all at version `9.0.0`;
`plugin:beta@m`'s inputs equal to the all-on's in every row; the all-on main's `instructions` naming
`<probeDir>/CLAUDE.md`, `<home>/.claude/CLAUDE.md` and `<memDir>/MEMORY.md`, not `note.md`), runs `fixedReport`
(which writes the phase-two probes), writes their sessions, and writes real calls: a main session of three calls
and an `accord-scout` run of two calls (no `accord-critic` or `accord-executor` calls). It returns the world and the
chosen numbers, so each expected figure is computed in the test.
- `it('ac-1 the main session and each accord agent that ran get one row split by owner')`: `fixedReport` exits 0;
  the raw table has exactly the rows `main session (claude -p)` (calls 3) and `accord-scout` (calls 2); each cell
  equals the value computed from the chosen numbers; in each row the owner cells plus `unattributed` equal `fixed`;
  `docs/benchmark/fixed-context.md` equals `text`; the text holds the line `Local-scope MCP servers and
  .claude/settings.local.json are not measured: the probe worktree loads neither.` and no `local-db`; the text
  holds no `sekret-` value, no `accord-probe` and no home path with a user name (`~/` is used).
- `it('ac-3 the report printed twice on the same transcripts and setup is the same')`: `fixedReport` run twice on
  the measured world gives equal `text`, and `probes.json` is byte-equal before and after the second run.

## Task 9: Cost-weighted figures, the setup items with their cost per call, and the ticket shares
covers: @ac-2, @ac-4, D-01, D-07
files: scripts/fixed-context.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-fixed.test.ts (new), packages/core/test/helpers/fixed-world.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#ac-2-each-figure-is-given-raw-and-cost-weighted-and-each-done-lane-M-ticket-gets-two-fixed-context-shares (@ac-2)

Consumes: Task 8. Produces: in `scripts/fixed-context.mjs`, `weighFixed(size, call)` and `ticketShares({ calls,
rows, tickets })`, and three sections `render` appends; in `scripts/benchmark.mjs`, `doneTickets(repo)`.
Behaviour that must not change: the raw table and header of Task 8, byte for byte.

- `weighFixed(F, call)`: the fixed context sits at the front of the call's input, so it is charged first against
  the call's cache reads, then its cache writes, then its fresh input (ledger Ruling): `a = min(F, cacheRead)`,
  `b = min(F − a, cacheWrite)`, `c = min(F − a − b, input)`; returns `{ weighted: 0.1a + 1.25b + c, clamped:
  F > a + b + c }` (a size measured today can exceed an old call's whole input; the excess is not charged).
- A row's cost-weighted fixed context per call is the mean of `weighFixed(total, call).weighted` over its calls; each
  part's (and each item's) cost-weighted figure is its raw tokens times that row's weighted-to-raw ratio, so the
  weighted parts also add up to the weighted fixed context.
- `doneTickets(repo)`: the tickets at `defaultRef(repo)` (`scripts/benchmark.mjs:381`), listed with
  `git ls-tree -z --name-only <ref> accord/tickets/` (a constant path; the entries kept are those ending `.md`),
  whose frontmatter (`git show <ref>:<path>`,
  `parseYaml`) has `lane` `M` and a non-empty `verified_hash` (reached done: ledger Ruling), each `{ id, claimAt }`
  where `claimAt` is the earliest `at` among `branchCommits(repo)` (`scripts/benchmark.mjs:396`) whose message's
  first line is `claim: <id>`; a ticket with no claim commit is left out.
- `ticketShares`: for each done ticket whose `claimAt` lies within the first and last call times, the ticket's calls
  are those whose `branch` is `t/<id>`, plus those whose `cwd` is a folder for which every call that records a
  branch records `t/<id>` (slashes turned, case folded). Its whole cost is the sum over its calls of
  `input + 0.1·cacheRead + 1.25·cacheWrite + 5·output`. The two shares are the sum of
  `weighFixed(total of main, call).weighted` over its `main` calls, and the same over its accord-agent calls with
  each call's own row total, each divided by the whole cost. A call of a row with no figure (another subagent,
  such as Explore or general-purpose) counts in the whole cost only.
- `render` appends, after the raw table:
  - `## Fixed context per call, cost-weighted tokens`: the same columns plus a last column `largest owner`, the
    owner with the largest cost-weighted figure among the six named owners (unattributed is a remainder, not an
    owner); figures with one decimal; then `Weights: fresh input 1, cache read 0.1, cache write 1.25. <n> calls had
    less input than the fixed context now measured; the excess was not charged.`
  - `## Setup items, tokens per call (raw / cost-weighted)`: `| item | owner | <one column per printed row> |`, one
    line per entry of `measure`'s `items` (every enabled plugin, every listable server, every connector with its
    own probe and the other connected servers line, every CLAUDE.md and memory file, every own set, and accord's
    own parts), each cell `<raw> / <weighted>` for a row it reaches and `-` elsewhere, so an item that reaches no
    row is still a line of `-` cells; ordered by owner then label; then
    `What the owner could cut: each line above is the cost per call that removing the item saves in that row.`
  - `## Lane M tickets, share of the ticket's cost`: `| ticket | claim | calls | main fixed context | accord
    subagents fixed context |`, shares in percent with one decimal, by ticket id; then `Weights: fresh input 1,
    cache read 0.1, cache write 1.25, output 5. Output tokens are estimated at 4 characters a token, since
    transcripts keep the usage from the stream's start.` and `The subagent share counts accord agents only; other
    subagents (such as Explore or general-purpose) count in the ticket's whole cost, and their fixed context is not
    measured.`; when no ticket qualifies, the table and these two lines are replaced by
    `No lane M ticket reached done with its claim inside the transcripts' date range.`

Test first: `measuredWorld()` gains options to give each real call a chosen billing and branch, and to commit
tickets: `accord/tickets/T-1.md` (lane `M`, `verified_hash` set) with a `claim: T-1` commit dated inside the
calls' range, `T-2.md` (lane `L`, done), `T-3.md` (lane `M`, no `verified_hash`), `T-4.md` (lane `M`, done, claim
dated before the first call). Calls of T-1: two main calls and one scout call with `branch` `t/T-1`, and one
`general-purpose` call in the same `cwd`.
`it('ac-2 each figure is given raw and cost-weighted and each done lane M ticket gets two fixed context shares')`:
with calls chosen so that one call's cache reads cover the fixed context, one call's fixed context reaches into
its cache writes, and one call's whole input is below it, the cost-weighted table's `fixed` cell of each row equals
the mean computed in the test, each owner cell equals its raw value times the row's ratio, `largest owner` names
the largest; an item cell reads `<raw> / <weighted>`; the items table has exactly one line for each enabled plugin
(`accord-panel@accord`, `alpha@m`, `beta@m`), each listable server (`proj-db`, `user-search`; no `local-db`), the
other connected servers line, each doc of `readSetup(...).docs` and each set (`aws`, `gsd`, `my`, `own`, `tool`),
and the `beta@m` line and the `note.md` line hold `-` in every row cell (they reach no row); the tickets table has
exactly `T-1`, with the two shares computed in the test from the weights 1, 0.1, 1.25 and 5; the output-estimate
sentence and the accord-agents-only sentence are printed.

## Task 10: Run the report on the owner's transcripts and commit it
covers: @ac-4, D-02, D-03, D-04, D-05, D-07
files: docs/benchmark/fixed-context.md (new), packages/core/test/benchmark-fixed.test.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#ac-4-the-committed-report-holds-the-date-range-the-call-counts-the-setup-items-and-the-not-measured-line (@ac-4)

Consumes: Tasks 1 to 9, and the owner's probe runs (preamble: this task is dispatched only once
`node scripts/benchmark.mjs --fixed` exits 0 in the ticket worktree). Produces: `docs/benchmark/fixed-context.md`,
the committed report of a real run.

Test first: `it('ac-4 the committed report holds the date range the call counts the setup items and the not-measured line')`
reads `docs/benchmark/fixed-context.md` from the repository root and asserts: a line matching
`/^Transcripts: (\d+) calls from (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2}), read from \d+ transcript folder\(s\)\.$/m`
with more than 0 calls and the first date not after the second; in the raw table, a `main session (claude -p)` row
and at least one `accord-` row, each `calls` cell an integer above 0; a `## Setup items` table with at least one
line for each of the owners `plugins`, `MCP servers`, `CLAUDE.md and memory` and `own skills, agents and commands`
(the owner's setup has each), every cell after `item` and `owner` either `-` or
`/^-?\d+ \/ -?\d+\.\d$/`; the line `Cursor, Codex and Copilot calls were not measured.`; and no line matching
`/[A-Za-z]:[\\/]+Users[\\/]/i`, `/\/[a-z]\/Users\//i`, `/[\w.+-]+@[\w-]+(\.[A-Za-z][\w-]*)+/` or
`/sekret|Bearer /`.

Then take `docs/benchmark/fixed-context.md` as the main session's clean `node scripts/benchmark.mjs --fixed` run
wrote it into the ticket worktree (preamble), and do not run `--fixed` again: an auto-memory line written since
would make `all-on` stale, though the file already measures the setup as it was when it ran (ac-1). When the file
is missing, stop and report BLOCKED, so the main session runs `--fixed` again with the owner. Read it whole and check by eye that no MCP server value,
token or e-mail address is in it and that each claude.ai connector the owner has connected is named on an
`MCP servers` line, then commit it with the test. The report changes nothing in accord or in the owner's setup and
names no keep-or-cut judgement (ledger Ruling): the cut and its proof on ST-LN-46's round 2 samples, and the
figures after a cut, belong to the cut ticket (D-03, D-04, D-05, D-07). Check that
`git diff --name-only 5c8b5d96c8cbf6acddfcee3c6358c09b84f75094 -- .claude packages/core/agents CLAUDE.md` prints
nothing.

## Task 11: Read each MCP server's block and tool names, and give every text its owner and item
covers: @ac-1, D-01, D-08
files: scripts/fixed-context.mjs (new), packages/core/test/benchmark-fixed.test.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:parsing-a-probe-transcript-gives-its-first-call-input-and-what-loaded-before-it, packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-each-text-is-charged-to-its-owner-and-to-the-rows-it-reaches-and-the-baseline-has-one-stub-per-tool-list-and-model

Dispatched first of the re-plan (preamble: 11, 12, 13, 14, 15, then 10).
Consumes: `firstCall` (Task 1), `textsOf` and `stubsOf` (Task 4), a setup (Task 2). Produces, pure in
`scripts/fixed-context.mjs`: two more FirstCall fields, and the texts of plugins, own sets and MCP servers, every text
carrying the item it belongs to. Nothing reads the new texts until Task 13: `measure` picks texts by id prefix, so it
skips the new ids, and `phaseTwo` plans a `text:` probe for a new text as for any text (no test world has one yet).
Behaviour that must not change: every FirstCall field Task 1 gives; every text Task 4 gives, with its id, owner,
label, text and rows; `stubsOf`.

- `firstCall` also returns:
  - `mcpBlocks`: an object from server name to block text, from the `mcp_instructions_delta` attachments before the
    first call. Each `addedBlocks` item is a string (checked on a real all-on probe transcript of 2026-10-31,
    `~/.claude/projects/C--Work-accord-probe/878b9741-156e-4fe9-8a03-1d84deeeef9f.jsonl` line 10:
    `"addedNames":["claude.ai Claude Docs"],"addedBlocks":["## claude.ai Claude Docs\nClaude Docs: ..."]`). A block
    belongs to the `addedNames` item `n` of the same attachment when it equals `## <n>` or starts with `## <n>\n`,
    otherwise to the `addedNames` item at its own index; a block with neither is dropped.
  - `deferredTools`: every `addedNames` item of the `deferred_tools_delta` attachments before the first call, in
    order, each once.
- The entry name of a listing line: when the line starts with `- `, the text after it up to the first `:` that is
  followed by a space or ends the line (`- claude-security:explore: x` gives `claude-security:explore`, `- accord: a`
  gives `accord`); otherwise the line has none.
- The owner of an entry is the first of these that applies, so a line is charged once:
  1. accord: in a skill listing, the name of an accord skill (`setup.accordSkills`); in an agent listing, the name of
     an accord agent (`setup.agents`).
  2. a plugin: the name starts with `<plugin name>:`, the plugin name being the plugin id up to its last `@`
     (`alpha@m` gives `alpha:`; a real listing reads `- claude-security:explore: ...`); every enabled plugin of
     `setup.plugins` counts, `accord-panel@accord` included.
  3. an own set: in a skill listing, the name of a `skill` or `command` member of a set; in an agent listing, the name
     of an `agent` member.
  4. none: the line is in no text. Claude Code's own entries (such as `general-purpose`) are in the baseline, so
     they stay out of every named part, and an unknown entry stays in unattributed.
- `textsOf` gives every text an `item`:
  - Task 4's texts: `agent:<name>` has item `agent-definition`; `rules`, `skill-listing`, `agent-listing`,
    `pointer:<label>` and `doc:<label>` have their own id as item; `prompt`, `baseline-prompt` and `brief` have item
    `null`. `skill-listing` and `agent-listing` hold the lines whose owner is accord by the rule above.
  - A listing text of another owner is built as Task 4 builds `skill-listing`: its lines are the listing lines with
    that owner, taken from the main FirstCall when it holds any, else from the first agent by name that holds any,
    joined with `\n`; its rows are the rows whose FirstCall holds at least one of those lines. For each enabled plugin
    `<id>`: `plugin-skills:<id>` (skill listing) and `plugin-agents:<id>` (agent listing), owner `plugins`, item
    `plugin:<id>`, label `<id>`. For each set `<prefix>`: `set-skills:<prefix>` and `set-agents:<prefix>`, owner
    `own skills, agents and commands`, item `set:<prefix>`, label `set <prefix>`. A text with no line is left out.
  - Connected servers: the keys of every row's `mcpBlocks`, then the `<server>` part of each `deferredTools` item of
    the form `mcp__<server>__<tool>` (the pattern `/^mcp__(.+?)__.+$/` of `firstCall`), deduplicated by `serverKey`
    (a block's name is kept when both name one server) and sorted. For each such name `n`, with `k = serverKey(n)`:
    the item is `mcp:<s>` when a listable server `s` of `setup.mcp` has `serverKey(s) === k`, else `mcp:<n>`; owner
    `MCP servers`; label `n`. `mcp-block:<n>` is the block of the main FirstCall whose `mcpBlocks` holds a name with
    key `k`, else that of the first agent by name that holds one. Its rows: when the main FirstCall holds a block
    with key `k`, `main` and every agent row (each setup agent with an all-on FirstCall, whether or not its own
    FirstCall holds the block), because Claude Code adds an MCP server's instructions block to a subagent after the
    subagent's first call, so the attachments before that first call understate what its next calls carry (real
    accord-critic transcripts, tools `Read, Grep, Glob`, carry the `claude.ai Claude Docs` `mcp_instructions_delta`
    after their first assistant line; the all-on executor transcript has the deferred tool names but no block before its first call; ledger
    Ruling "re-plan 2, review 1.1"); otherwise the agent rows whose FirstCall holds a block with key `k`. Rows are
    ordered as every text's are, `main` first, then agent names sorted. `mcp-tools:<n>` is
    the `deferredTools` items starting `mcp__<k>__`, joined with `\n`, from the main FirstCall when it holds any,
    else from the first agent by name that holds any; its rows are those holding any.
  - The new texts come after the `doc:` texts and before `prompt`, in this order: plugins by id, sets by prefix,
    servers by name.

Tests first.
- In `it('risk:parsing a probe transcript gives its first call input and what loaded before it')` (Task 1; its title
  still holds), add: `call.deferredTools` equals the `addedNames` of the main fixture's `deferred_tools_delta` lines
  in order; `call.mcpBlocks` is `{}` (the fixture's blocks were emptied); in a copy of the main lines with two
  attachment lines inserted just before the first assistant line, an `mcp_instructions_delta` with `addedNames:
  ['srv one', 'claude.ai Docs X']` and `addedBlocks: ['## claude.ai Docs X\nDocs rules', '## srv one\nOne rules']`,
  then one with `addedNames: ['srv two']` and `addedBlocks: ['Two rules']`, `mcpBlocks` is `{ 'claude.ai Docs X':
  '## claude.ai Docs X\nDocs rules', 'srv one': '## srv one\nOne rules', 'srv two': 'Two rules' }`. The
  `mcp_instructions_delta` line placed after the first call in the existing check also gets `addedBlocks:
  ['## late server\nx']`, and `firstCall` still equals `call`.
- Delete `it('risk:complex-branching each text is sized on the models of the rows it reaches and the baseline has one stub per tool list and model')`
  (Task 4; from Task 13 on no text is sized on a model by a probe) and write in its place
  `it('risk:complex-branching each text is charged to its owner and to the rows it reaches and the baseline has one stub per tool list and model')`,
  in memory, no files. It keeps every assertion of the deleted test on `stubsOf`, on what `read` is given, and on
  the texts `agent:`, `rules`, `skill-listing`, `agent-listing`, `doc:`, `pointer:`, `prompt`, `baseline-prompt` and
  `brief`; it drops those on `phaseTwo` and `connectorsOf` (Task 13 rewrites `phaseTwo`, Task 14 removes
  `connectorsOf`). Its setup adds `plugins` `accord-panel@accord` and `alpha@m`, `sets` `gsd` (skill `gsd-a`, agent
  `gsd-r`) and `tool` (command `tool:run`), and keeps `mcp` `proj-db`; each FirstCall gets `mcpBlocks: {}` and
  `deferredTools: []` unless given below. The main FirstCall's `skillListing` is `['- accord: a', '- gsd-a: b',
  '- alpha:sk: c', '- tool:run: d', '- other: o']`, its `agentListing` `['- accord-scout: s', '- gsd-r: r',
  '- alpha:helper: h', '- other: o']`, its `mcpBlocks` `{ 'claude.ai Docs X': '## claude.ai Docs X\nrules',
  'proj-db': '## proj-db\nq' }` and its `deferredTools` `['mcp__claude_ai_Docs_X__read', 'mcp__proj_db__query',
  'mcp__plugin_alpha_srv__ping', 'WebFetch']`; the executor's `skillListing` is `['- accord: a', '- gsd-a: b']` and
  its `deferredTools` `['mcp__proj_db__query']`; the critic's `mcpBlocks` is `{ 'agent-only': '## agent-only\nz' }`
  (no agent's `mcpBlocks` holds `claude.ai Docs X` or `proj-db`). Assert, besides the kept assertions:
  - `plugin-skills:alpha@m` is `{ owner: 'plugins', item: 'plugin:alpha@m', label: 'alpha@m', text: '- alpha:sk: c',
    rows: ['main'] }` and `plugin-agents:alpha@m` has the text `- alpha:helper: h` and rows `['main']`; no text id
    ends with `accord-panel@accord`;
  - `set-skills:gsd` is `{ owner: 'own skills, agents and commands', item: 'set:gsd', text: '- gsd-a: b', rows:
    ['main', 'accord-executor'] }`; `set-agents:gsd` has the text `- gsd-r: r` and rows `['main']`; `set-skills:tool`
    has the text `- tool:run: d`;
  - `mcp-block:claude.ai Docs X` is `{ owner: 'MCP servers', item: 'mcp:claude.ai Docs X', text: '## claude.ai Docs
    X\nrules', rows: ['main', 'accord-critic', 'accord-executor', 'accord-scout'] }` (a block the main holds reaches
    every agent row, though no agent FirstCall holds it) and `mcp-tools:claude.ai Docs X` has the text
    `mcp__claude_ai_Docs_X__read` and rows `['main']`; `mcp-block:proj-db` has item `mcp:proj-db` and rows `['main',
    'accord-critic', 'accord-executor', 'accord-scout']`; `mcp-tools:proj-db` has the text `mcp__proj_db__query` and
    rows `['main', 'accord-executor']`; `mcp-block:agent-only` has item `mcp:agent-only`, the text `## agent-only\nz`
    and rows `['accord-critic']` (a block only an agent holds stays on the agents holding it);
    `mcp-tools:plugin_alpha_srv` has item `mcp:plugin_alpha_srv`, and there is no `mcp-block:plugin_alpha_srv`;
  - `skill-listing` still has the text `- accord: a`; no text holds `- other: o` or `WebFetch`; every line of the main
    listings is in at most one text;
  - `agent:accord-critic` has item `agent-definition`, `rules` item `rules`, `pointer:CLAUDE.md` item
    `pointer:CLAUDE.md`, `brief` item `null`.

## Task 12: Plan one calibration pair per model, and fingerprint each instruction file by its content
covers: @ac-1, @ac-3, D-02
files: scripts/fixed-calibration.txt (new), scripts/fixed-context.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-fixed.test.ts (new), packages/core/test/helpers/fixed-world.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-a-changed-item-reprints-only-its-own-probes-and-the-all-on-probe, packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-a-set-probe-that-still-lists-a-member-makes-fixed-refuse-naming-the-set-and-the-probe-version, packages/core/test/benchmark-fixed.test.ts#ac-1-the-main-session-and-each-accord-agent-that-ran-get-one-row-split-by-owner, packages/core/test/benchmark-fixed.test.ts#ac-2-each-figure-is-given-raw-and-cost-weighted-and-each-done-lane-M-ticket-gets-two-fixed-context-shares, packages/core/test/benchmark-fixed.test.ts#ac-3-the-report-printed-twice-on-the-same-transcripts-and-setup-is-the-same

Dispatched after Task 11. Consumes: Tasks 3 to 5, 8 and 11. Produces: `scripts/fixed-calibration.txt`; in
`scripts/benchmark.mjs`, `export const calibrationText`, a `hash` on each `docs` entry of `readSetup`, and
`fixedPending` returning `calibration` beside what it returns now; in `scripts/fixed-context.mjs`, `cal:<model>`
probes from `phaseTwo(setup, allOn, read, calibration, forms = PROBE_FORMS)`, `pendingProbes({ setup, state,
located, version, read, calibration, forms })`, and a `docs` fingerprint that covers each file's content.
Behaviour that must not change: every other probe `phaseOne` and `phaseTwo` plan; `measure` and the report, which
read no `cal:` probe until Task 13; `writeProbes`, which already writes a `where: 'empty'` probe that has a `text` as
`<bench>/fixed/<safe id>.md`, passed by `--append-system-prompt-file` after the prompt `PROBE_BRIEF`.

- `scripts/fixed-calibration.txt`: the body of `.claude/agents/accord-planner.md` at the baseline, a fixed English
  Markdown text of the kind most texts the report sizes are (rules, lists, code spans). Take
  `git show 5c8b5d96c8cbf6acddfcee3c6358c09b84f75094:.claude/agents/accord-planner.md`, keep what follows the line
  that starts with `<!-- generated by accord skills sync`, drop the blank lines at its start, and end it with exactly
  one `\n`; write it with a `node -e` one-liner so the bytes are exact. It holds no `\r` (`.gitattributes` keeps it LF
  on every checkout) and no accord marker, so no accord tool takes it for a generated file. Its text is fixed: a
  different text makes every pair stale.
- `calibrationText()` returns `fs.readFileSync(fileURLToPath(new URL('./fixed-calibration.txt', import.meta.url)),
  'utf8')`, whichever repository the script measures.
- `phaseTwo` also returns, for each model key it plans a `ref:` probe for, `{ id: 'cal:<model>', where: 'empty',
  model, text: calibration, depends: { calibration: <sha256 hex of calibration> } }`.
- `pendingProbes` passes `calibration` to `phaseTwo`. It drops the rule that a changed `source: 'disk'` text makes
  `all-on` stale: the `docs` key (below) and the `agent:` keys of `all-on` now cover every text read from disk. When
  `ref:<m>` and `cal:<m>` both have a main FirstCall and the `cal:` input is not above the `ref:` input, both are
  pending: a pair that gives no positive size runs again.
- `readSetup`'s `docs` entries gain `hash`, the sha256 hex of the file's content. `fingerprints`' `docs` value is the
  sha256 hex of the sorted lines `<label>\0<hash>` of the docs whose `topic` is false, so an edit of a `CLAUDE.md`, a
  rules file or `MEMORY.md` makes `all-on` stale as an added or removed file does.
- `fixedPending` passes `calibration: calibrationText()` to `pendingProbes` and returns `calibration` too.

Tests first.
- `writeProbeSessions` (in the test file) writes a `cal:` probe as it writes a `ref:` one (main session only) with
  `input: 1000`; every other call keeps `assistantLine`'s default input 1; an option `input` sets the main call's
  input.
- In `it('risk:complex-branching a changed item reprints only its own probes and the all-on probe')` (Task 5; its
  title still holds), step 2 computes the expected ids with `phaseTwo(setup, allOn, disk, calibrationText())` and
  also expects `cal:m-opus` and `cal:m-sonnet`; `<bench>/fixed/cal_m-opus.md` exists and its text equals
  `calibrationText()`, which is longer than 4,000 characters and holds no `\r` and no `generated by accord skills
  sync`. Steps 3 to 6 stay. Two new steps come after step 6 and before the step that commits a `CLAUDE.md` edit,
  because that step and the uncommitted-edit step after it leave their changes in place (the commit moves the `docs`
  hash and the uncommitted edit makes `setupDirty` refuse), so a step placed after them could not pass. The two old
  steps keep their code and assertions and are renumbered 9 and 10. Each new step begins, as steps 4 to 6 do, by
  writing the step-3 bytes of `probes.json` back:
  7. with the `cal:m-opus` session rewritten at input 1 (its bytes saved first and written back after asserting),
     the pending ids are exactly `cal:m-opus` and `ref:m-opus`;
  8. with one line appended to `<memDir>/MEMORY.md` (its bytes saved first and written back after asserting), the
     pending ids are exactly `all-on`.
- `it('risk:complex-branching a set probe that still lists a member makes fixed refuse naming the set and the probe version')`
  is unchanged and passes with the new `writeProbeSessions`.
- `measuredWorld` (`fixed-world.ts`): `CHOSEN` gains `perChar: { 'm-opus': 0.25, 'm-sonnet': 0.3 }`; its loop over
  the phase-two probes also writes each `cal:<model>` session (main only, prompt as for `ref:`) with input
  `CHOSEN.ref[model] + Math.round(calibrationText().length × CHOSEN.perChar[model])`, `calibrationText` imported
  from `benchmark.mjs` (add it to `BenchApi`). Nothing else in the world changes, and the ac-1, ac-2 and ac-3 tests
  pass unchanged.

## Task 13: Size every part from its text at the calibrated ratio, and plan only the baseline and the calibration pairs after the all-on probe
covers: @ac-1, @ac-2, @ac-3, D-01, D-06, D-07
files: scripts/fixed-context.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-fixed.test.ts (new), packages/core/test/helpers/fixed-world.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-a-part-is-charged-only-to-the-rows-it-reaches-and-unattributed-is-what-the-named-parts-leave, packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-a-changed-item-reprints-only-its-own-probes-and-the-all-on-probe, packages/core/test/benchmark-fixed.test.ts#ac-1-the-main-session-and-each-accord-agent-that-ran-get-one-row-split-by-owner, packages/core/test/benchmark-fixed.test.ts#ac-2-each-figure-is-given-raw-and-cost-weighted-and-each-done-lane-M-ticket-gets-two-fixed-context-shares, packages/core/test/benchmark-fixed.test.ts#ac-3-the-report-printed-twice-on-the-same-transcripts-and-setup-is-the-same

Dispatched after Task 12. This is the wiring of the new approach: from it on, `--fixed` sizes every part but Claude
Code from text. Consumes: Tasks 11 and 12. Produces: in `scripts/fixed-context.mjs`, `phaseTwo(setup, allOn,
calibration)` and `measure({ setup, state, located, texts, calibration })` returning `{ rows, items, ratios }`; in
`scripts/benchmark.mjs`, `fixedReport` calling them.
Behaviour that must not change: the rows `measure` gives (`main`, then each setup agent that has an all-on FirstCall,
by name) and their fields `{ row, model, total, parts: { accord, claudeCode, plugins, mcp, docs, sets },
unattributed }`; that the parts and `unattributed` add up to `total`; `state` read as `{ probes }` or a bare array;
`render` and every line of the report (Task 15 changes the wording); the exits of `fixedReport`; phase one.

- `phaseTwo(setup, allOn, calibration)` returns `baseline` (as Task 4 plans it), and `ref:<model>` and `cal:<model>`
  (Task 12) for each model key of a row; no `text:` and no `connector:` probe. `pendingProbes` drops its `read`
  argument. `PHASE_TWO_NOTE` becomes `The baseline and calibration probes follow once the all-on probe has run.`
- `measure`: `S(p)`, `I(p, r)` and the stub row of an agent as in Task 7; `perChar(m)` and a text's size `size(t, r)`
  as in the preamble's re-plan paragraph. When `I(cal:m, main) ≤ I(ref:m, main)` for a row's model, `measure` throws
  `The calibration pair of <model> gives no positive size.` (the pending rule of Task 12 keeps that from reaching it).
  `ratios` maps each row's model key to `calibration.length / (I(cal:m, main) − I(ref:m, main))`, characters a token.
  - `total`: `I(all-on, main) − size(prompt, main)` for `main`, `I(all-on, r) − size(brief, r)` for an agent;
    `claudeCode`: `I(baseline, main) − size(baseline-prompt, main)` for `main`, `I(baseline, <stub of r>) −
    size(brief, r)` for an agent. These are Task 7's formulas with a text's size read from the ratio.
  - `items`, each `{ id, owner, label, perRow }`, in this order: each enabled plugin `plugin:<id>` (label the id, with
    ` (accord's own)` for `accord-panel@accord`); each listable server `mcp:<name>` (label its name), then each other
    `mcp:<n>` item the texts name, by name, `<n>` being the text's `item` after `mcp:` (a text's `label` is not read
    for it), labelled `<n> (claude.ai connector)` when `n` is a claude.ai connector by the preamble's rule, else `n`;
    each set `set:<prefix>` (label `set <prefix> (<member count> members)`);
    `agent-definition`, `rules`, `skill-listing`, `agent-listing` and each `pointer:<label>` (labels as Task 7 gives
    them); each doc of `setup.docs`, then each `doc:` text whose label is none of theirs (labels as Task 7).
    `perRow[r]` is the sum of `size(t, r)` over the texts whose `item` is the item's id and whose `rows` hold `r`; a
    row with no such text has no key, so an item with no text is listed with an empty `perRow`. The items
    `connector:<name>` and `other-servers` are gone: every connected server is its own item.
  - Each part is the sum of its owner's items in the row; `unattributed = total − claudeCode − every other part`.
- `fixedReport` calls `measure({ setup: p.setup, state: p.state, located: p.located, texts, calibration:
  p.calibration })` and passes `render` the same arguments as before.

Tests first.
- Rewrite `it('risk:complex-branching a part is charged only to the rows it reaches and unattributed is what the named parts leave')`
  (Task 7; its title still holds), in memory. Rows `main` (`m-opus`), `accord-scout` and `accord-executor` (both
  `m-sonnet`); the setup of the old test with a second listable server `idle`. `located` holds only `all-on` (inputs
  main 50000, scout 20000, executor 21000), `baseline` (main 12000; the scout's stub 8000, the executor's 9000),
  `ref:m-opus` 100, `ref:m-sonnet` 80, `cal:m-opus` 350 and `cal:m-sonnet` 380, so a `measure` that still reads a
  leave-one-out or `text:` session throws. `calibration` is `'c'.repeat(1000)` (0.25 and 0.3 tokens a character).
  `texts` are given directly, each text `'x'.repeat(<length>)`, as `[id, owner, item, length, rows]`:
  `agent:accord-scout` 2001 [scout], `agent:accord-executor` 2403 [executor], `rules` 999 [all], `skill-listing` 1601
  [main, executor], `agent-listing` 801 [main], `pointer:CLAUDE.md` 241 [all], `doc:CLAUDE.md` 361 [all],
  `doc:~/extra.md` 45 [main], `plugin-skills:alpha@m` 401 [main, executor], `plugin-agents:alpha@m` 121 [main],
  `set-skills:gsd` 201 [main, scout], `set-agents:gsd` 61 [main], `mcp-block:srv` 603 [all], `mcp-tools:srv` 101
  [main, executor], `mcp-block:claude.ai Docs X` 905 [all], `mcp-tools:claude.ai Docs X` 301 [main],
  `mcp-tools:plugin_alpha_srv` 51 [main], `prompt` 161 [main], `baseline-prompt` 121 [main], `brief` 63 [scout,
  executor], with owners and items by Task 11's rules. Assert: each row's `total`, `claudeCode` and every part equal
  the values the test computes with `Math.round(length × perChar)` per text; `ratios` is `{ 'm-opus': 4, 'm-sonnet':
  1000 / 300 }`; `plugin:alpha@m` has `perRow` keys main and executor only; `plugin:beta@m`,
  `plugin:accord-panel@accord` and `mcp:idle` are listed with an empty `perRow`; `mcp:claude.ai Docs X` has the label
  `claude.ai Docs X (claude.ai connector)` and a `perRow` key in every row (its block reaches every row), and
  `mcp:plugin_alpha_srv` the label `plugin_alpha_srv` and a `perRow` key in main only; `set:gsd` has the
  label `set gsd (3 members)`; there is no item `other-servers`, `prompt` or `brief`; each row's parts plus
  `unattributed` equal its `total`; with `cal:m-sonnet`'s input set to 80, `measure` throws the message above.
- In the Task 5 test `a changed item reprints only its own probes and the all-on probe`, step 2 computes the expected
  ids with `phaseTwo(setup, allOn, calibrationText())` and asserts that no id starts with `text:`; its
  `arrayContaining` list becomes exactly `baseline`, `ref:m-opus`, `ref:m-sonnet`, `cal:m-opus` and `cal:m-sonnet`
  (the four `text:` ids go), and its check that `<bench>/fixed/text_doc_CLAUDE.md_m-opus.md` exists goes; step 9 (the
  committed `CLAUDE.md` edit, renumbered by Task 12) now expects exactly `all-on`, and its check that no id starts
  with `text:pointer:` goes; the test file's `NOTE` is the new note.
- `measuredWorld` and the criterion tests. `CHOSEN` drops `cut`, `mcpRefCut`, `mcpCut` and `delta`, and `sizeOf`
  goes; the leave-one-out sessions, planned until Task 14, are written with the all-on inputs; no `text:` session is
  written. `fixed-world.ts` exports `perCharOf(model)`, `(cal input − ref input) / calibrationText().length` from the
  inputs it writes, and the listing, block and tool-name strings it writes, so each expected figure is computed from
  them. The all-on transcripts gain texts of every owner: the main session's `skill_listing` also lists
  `- alpha:sk: <description>`, `- gsd-a: <description>` and `- tool:run: <description>`; its `agent_listing_delta`
  also `- gsd-r: <description>` and `- alpha:helper: <description>`; it gains one `mcp_instructions_delta` with
  `addedNames` `claude.ai Docs X` and `proj-db` and a block each (`## <name>\n` then one line), and one
  `deferred_tools_delta` with `mcp__claude_ai_Docs_X__read`, `mcp__proj_db__query` and `mcp__plugin_alpha_srv__ping`;
  the scout's all-on transcript also gets a `skill_listing` with `- gsd-a: <description>` and a `deferred_tools_delta`
  with `mcp__proj_db__query`, and no `mcp_instructions_delta` (the main's two blocks reach the scout's row by Task
  11's rule all the same). `expectedRow` (ac-1) computes each owner's figure as the sum of `Math.round(<text
  length> × perCharOf(<row model>))` over that owner's texts in the row, built by Task 11's rules from those strings,
  and the docs from the files `makeWorld` writes (the root `CLAUDE.md` with its pointer block cut out, as Task 4
  cuts it). In ac-2 the item expectations become: the `MCP servers` lines are `claude.ai Docs X (claude.ai
  connector)`, `plugin_alpha_srv`, `proj-db` and `user-search`; `claude.ai Docs X (claude.ai connector)` and
  `proj-db` each have a main and a scout cell (the block reaches the scout's row), `plugin_alpha_srv` a main cell and
  `-` for the scout; `alpha@m` has a main cell and `-` for the scout;
  `beta@m`, `user-search` and the `note.md` line have `-` in every cell; `set gsd (3 members)` has a main and a scout
  cell, each computed as the other cells are. Every other assertion of ac-1, ac-2 and ac-3 stays.

## Task 14: Remove the leave-one-out probes, the set-probe check and what only they used
covers: @ac-1, @ac-3, D-02
files: scripts/fixed-context.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-fixed.test.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-phase-one-is-the-all-on-probe-alone-and-its-command-passes-no-settings-or-MCP-config, packages/core/test/benchmark-fixed.test.ts#risk:security-no-MCP-server-secret-is-printed-or-written-to-any-file, packages/core/test/benchmark-fixed.test.ts#risk:parsing-printed-commands-keep-absolute-paths-Git-Bash-runs-when-the-repository-lies-under-the-home-folder, packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-a-changed-item-reprints-only-its-own-probes-and-the-all-on-probe, packages/core/test/benchmark-fixed.test.ts#ac-1-the-main-session-and-each-accord-agent-that-ran-get-one-row-split-by-owner, packages/core/test/benchmark-fixed.test.ts#ac-3-the-report-printed-twice-on-the-same-transcripts-and-setup-is-the-same

Dispatched after Task 13. Consumes: Tasks 12 and 13. Produces: `phaseOne(setup)` returning the all-on probe alone;
`pendingProbes({ setup, state, located, version, calibration })` returning `{ probes, pending, notes }`;
`PROBE_FORMS` with exactly `claudeVersion`, `extraArgs`, `noSources` and `agentsArg`; `readSetup`'s `mcp` entries
as `{ name, scope, hash }`.
Behaviour that must not change: `--fixed --probe` (its dirty-setup refusal, its first line, its worktree line, and
the all-on command `cd <probeDir> && claude -p <prompt> --session-id <id> ...extraArgs`, with `forms` still taken by
`fixedProbe`, `fixedPending` and `fixedReport`); every output of `--fixed`; `fingerprints`, all of whose keys
(plugins, servers, sets, agents, `hook`, `skills`, `docs`) are now the all-on probe's alone.

Remove (the ticket's change note drops the leave-one-out probes and the set-probe check with them):
- in `scripts/fixed-context.mjs`: `phaseOne`'s `plugin:`, `mcp-ref`, `mcp:` and `set:` probes and its `forms`
  parameter, so it returns `[{ id: 'all-on', where: 'probe', depends: fingerprints(setup) }]`; in `pendingProbes`, the
  `failed` list, the set-member check and the `forms` parameter; `PROBE_FORMS.deny`, `.skillOverride` and `.connector`,
  with the comment lines about them replaced by one line saying the switches are no longer used since the change of
  course of 2026-10-31; `connectorsOf`.
- in `scripts/benchmark.mjs`: in `writeProbes`, the settings and MCP config files of a `where: 'probe'` probe and the
  arguments `--settings`, `--mcp-config` and `--strict-mcp-config` it adds for one; in `fixedPending`, the refusal for
  a failed set probe; the `entry` of each `readSetup` `mcp` server (its `hash` is still taken from the entry, so a
  changed server still makes `all-on` stale; nothing writes a server's config any more, so no secret outlives
  `readSetup`); every import no longer used.

Tests first.
- Delete `it('risk:complex-branching phase one has an all-on probe and one leave-one-out probe per plugin MCP server and own set')`
  (Task 3) and write
  `it('risk:complex-branching phase one is the all-on probe alone and its command passes no settings or MCP config')`
  on `makeWorld()`: `phaseOne(setup)` equals `[{ id: 'all-on', where: 'probe', depends: fingerprints(setup) }]` and its
  `depends` holds `hook`, `skills`, `docs`, `agent:accord-scout`, `plugin:alpha@m`, `mcp:proj-db` and `set:gsd`;
  `fixedProbe` exits 0 and prints exactly three lines, the first line, the `worktree add` line and the all-on command;
  that command equals the one stored in `probes.json`, starts with `'cd ' + shellLine([probeDir]) + ' && '`, holds
  `'claude -p ' + shellLine([dispatchPrompt(<the agent names of readSetup in order>)]) + ' --session-id ' + <its
  session id>`, and holds none of `--settings`, `--mcp-config` and `--strict-mcp-config`; `<bench>/fixed` holds
  `probes.json` alone; with `forms: { ...PROBE_FORMS, extraArgs: ['--allowedTools', 'Agent'] }` the command ends with
  ` --allowedTools Agent`; `Object.keys(PROBE_FORMS)` sorted is `['agentsArg', 'claudeVersion', 'extraArgs',
  'noSources']`; then, with `<bench>/fixed` removed (`rmSync` with `recursive: true, force: true, maxRetries: 5`) and
  an uncommitted edit of `.claude/agents/accord-scout.md`, `fixedProbe` exits 2 with the refusal line and
  `<bench>/fixed` does not exist (the refusal writes nothing).
- Delete `it('risk:security MCP config files stay under the bench root and no server secret is printed or stored in the repository')`
  (Task 3) and write `it('risk:security no MCP server secret is printed or written to any file')` on `makeWorld()`:
  after `fixedProbe`, and after `fixedPending` once the all-on session is written with `writeProbeSessions` (so the
  baseline and calibration files are written too), `sekret-user-123` and `sekret-local-456` appear in no text either
  call returned, in no file under `repo` and in no file under `bench`, and `JSON.stringify(readSetup(...))` holds
  neither.
- In `it('risk:parsing printed commands keep absolute paths Git Bash runs when the repository lies under the home folder')`
  (Task 3; its title still holds), drop the `set:gsd` and `mcp-ref` assertions and keep the rest; then write the
  all-on session with `writeProbeSessions` and assert that `fixedPending`'s text holds no `~`, that the `baseline`
  command holds `' --agents ' + shellLine([bench + '/fixed/stubs.json'])` and each `cal:<model>` command holds
  `' --append-system-prompt-file ' + shellLine([bench + '/fixed/cal_<model>.md'])`, and that each of those files
  exists.
- In `it('risk:complex-branching a changed item reprints only its own probes and the all-on probe')` (Task 5; its
  title still holds), the phase-one ids are `['all-on']`, so step 1 prints the first line, the worktree line, one
  command and the note; step 4 (a plugin's new version) now expects exactly `all-on`; every other step stays.
- Delete `it('risk:complex-branching a set probe that still lists a member makes fixed refuse naming the set and the probe version')`
  (Task 5) and its `refusalFor` helper: the set probes are gone.
- The ac-1 and ac-3 tests pass unchanged: `measuredWorld` writes a session for each entry of `probes.json`, now the
  all-on, baseline and calibration probes alone.

## Task 15: The report says its sizes carry the calibrated ratio estimate
covers: @ac-1, D-07
files: scripts/fixed-context.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-fixed.test.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#ac-1-the-main-session-and-each-accord-agent-that-ran-get-one-row-split-by-owner

Dispatched after Task 14 and before Task 10. Consumes: `measure`'s `ratios` (Task 13). Produces: `render({ ...,
ratios })`, and `fixedReport` passing `ratios` to it.
Behaviour that must not change: every table of the report, every other line before the first table, and their
order.

- `render` drops the line `A plugin's own MCP servers count under plugins and again in the other connected servers
  line; unattributed absorbs the overlap.` and prints, in its place, `A plugin's own MCP servers count under MCP
  servers; its skills and agents count under plugins.`, then directly after it `An MCP server's instructions block
  that the main session loads is charged to every accord agent row too: Claude Code adds it to a subagent after the
  subagent's first call.` (the rows rule of Task 11). Directly after the line `The main session row is measured under
  claude -p, with its probe prompt sized and taken out.` it prints `Every part but Claude Code is sized from its
  text's characters at a characters-per-token ratio calibrated on each model (<model>: <ratio>, ... characters a
  token), so those sizes carry that estimate, about ±10%; unattributed absorbs the difference.`, with each model key
  of `ratios` sorted, `<ratio>` its value with two decimals, the pairs joined with `, `.

Test first: in `it('ac-1 the main session and each accord agent that ran get one row split by owner')` (Task 8; its
title still holds), the assertion on the dropped line becomes one that no line holds `again in the other connected
servers line`; the text holds the plugin-servers line above, directly followed by the MCP-block line above, and the
ratio line, its ratios computed in the test from
`measuredWorld`'s inputs as `calibrationText().length / (cal input − ref input)` for `m-opus` and `m-sonnet`, and the
ratio line comes directly after the main-session line. Every other assertion stays.
