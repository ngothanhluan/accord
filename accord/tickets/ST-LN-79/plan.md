---
baseline: 5c8b5d96c8cbf6acddfcee3c6358c09b84f75094
plan_hash: "fnv1a64:a2ee33c25271189e"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order. Task 1 runs the approach's switches on one dispatched accord agent before any code (approach, Risks,
first Should), records the command forms that worked, captures real probe transcripts as fixtures, and writes
the reader every other task uses on a probe transcript. Task 2 reads the setup on this machine. Tasks 3 to 5 plan
the probes: the probes run from the probe worktree (Task 3), the probes run from the empty folder (Task 4), and
which probes are missing or stale (Task 5). Task 6 reads the real transcripts' calls. Task 7 turns probe
transcripts into each row's parts. Task 8 wires `--fixed` and prints the raw table (@ac-1, @ac-3). Task 9 adds the
cost-weighted figures, the setup items and the ticket shares (@ac-2). Task 10 commits the real report (@ac-4).

How the measurement is run once Tasks 1 to 9 are done (no executor runs a probe except the spike of Task 1).
Before Task 10 is dispatched, the main session runs `node scripts/benchmark.mjs --fixed --probe` in the ticket
worktree and gives the owner the commands it printed; the owner runs them in Git Bash; the main session then runs
`node scripts/benchmark.mjs --fixed` and gives the owner each set of commands it prints, until `--fixed` exits 0
and prints the table. Only then is Task 10 dispatched.

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
- Every path the scripts print, store or write into the report uses `/`; a path under the home folder is printed
  as `~/` followed by the rest (no user name reaches the output); a path under the repository is printed
  relative to it.
- Nothing under `.claude/`, `packages/core/agents/`, `packages/*/src/`, `CLAUDE.md`, `AGENTS.md`, `accord/` of this
  repository or the real `~/.claude` changes (ticket "Not here": this ticket cuts nothing, D-05); the throwaway
  probe worktree of Task 1 is removed with what it holds. No probe file (settings, MCP
  config, stubs, appended text) is written inside the repository; they go under `<bench>/fixed/`.
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
- A FirstCall (Task 1) is `{ id, model, version, ts, cwd, branch, input, usage: { input, cacheRead, cacheWrite },
  instructions: [{ path, type }], skillListing: string[], agentListing: string[], hookContexts: string[],
  sessionStartHook: boolean, prompt }`.
- Rows: `main` and each accord agent name. A row's model key is the `model` of that row's FirstCall in the all-on
  probe (the main session's model at probe time; the model an accord agent ran on, from its frontmatter).
- Owners, in this order and with these labels in every table: `accord`, `Claude Code`, `plugins`, `MCP servers`,
  `CLAUDE.md and memory`, `own skills, agents and commands`, and the remainder `unattributed`.
- Probe ids: `all-on`, `plugin:<plugin id>`, `mcp-ref`, `mcp:<server name>`, `set:<prefix>` (run from the probe
  worktree, phase 1); `baseline`, `ref:<model>`, `text:<text id>:<model>` (run from the empty folder, phase 2).
  Text ids: `agent:<name>`, `rules`, `skill-listing`, `agent-listing`, `pointer:<path label>`,
  `doc:<path label>`, `prompt`, `baseline-prompt`, `brief`.
- The probe worktree is `path.resolve(repo, '..', 'accord-probe')`; the empty folder is `<bench>/fixed/empty`; the
  probe state is `<bench>/fixed/probes.json`, `{ probes: [{ id, sessionId, cwd, command, fingerprint }] }` sorted by
  id, where `fingerprint` maps each key the probe depends on to its value when the probe was written.

## Task 1: Spike the switches on a dispatched agent, record the forms that worked, and read a probe's first call
covers: D-06
files: scripts/fixed-context.mjs (new), packages/core/test/benchmark-fixed.test.ts (new), packages/core/test/fixtures/benchmark-fixed/all-on-main.jsonl (new), packages/core/test/fixtures/benchmark-fixed/all-on-executor.jsonl (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:parsing-a-probe-transcript-gives-its-first-call-input-and-what-loaded-before-it

Consumes: the `claude` command on this machine, the owner's login, and the repository at the baseline.
Produces: the constants above, `PROBE_FORMS`, `firstCall(lines)`, and two fixture transcripts.

Spike first, before any code, from Git Bash. Read transcripts with `node -e` one-liners that print only the lines
and fields you need; never read a whole transcript (they run to megabytes). A session's transcript is
`~/.claude/projects/<folder>/<session id>.jsonl` and its subagents are under `<session id>/subagents/`.
1. Run `claude --version`. Make a scratch folder `../accord-bench/fixed-spike/` and in it an empty folder
   `empty/`; check `git -C ../accord-bench/fixed-spike/empty rev-parse --is-inside-work-tree` fails (outside any
   repository). Make the probe worktree:
   `git worktree add -B probe/fixed-context ../accord-probe 5c8b5d96c8cbf6acddfcee3c6358c09b84f75094`.
2. Every run below passes `-p`, `--session-id <uuid>` (a new `node -e "console.log(require('crypto').randomUUID())"`
   each run), and from the probe worktree the prompt `dispatchPrompt(['accord-executor'])`. Settings and MCP config
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
      `{"stub-1":{"description":"probe stub","prompt":"Reply ok.","model":"sonnet"}}`, first as the path of a JSON
      file holding it, then inline in single quotes; the prompt `dispatchPrompt(['stub-1'])`.
   g. reference and append pair: from `empty/` with the flags of f but no `--agents`, the prompt `PROBE_BRIEF`;
      then the same with `--append-system-prompt-file <file holding the accord pointer block of CLAUDE.md>`.
3. For each run, read the first call of the main session and of the dispatched agent: the first assistant line
   whose `message.model` is not `<synthetic>`, and every line with the same `message.id`; its input is
   `usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens`, each field the largest
   over those lines. Pass conditions:
   - `--session-id` names the transcript file, and the executor's transcript exists for runs a to e.
   - Run a: before the main's first call there are attachment lines of type `instructions`, `skill_listing` and
     `agent_listing_delta`; before the executor's there are `hook_additional_context` and `instructions`.
   - Runs b, c, d and e each lower the main's first-call input below run a's; at least one of them also changes the
     executor's first-call input (a switch is shown to reach a dispatched agent).
   - Run e: no `gsd-` name and no `zzprobe-x` is left in any `skill_listing` or `agent_listing_delta` of the main
     or of the executor, and every other entry of run a is still there.
   - Run f: the stub's transcript exists; its first-call input is below the executor's in run a; the main's first
     call has no `instructions` attachment.
   - Run g: the second first-call input is above the first.
   If a condition fails and no other form named above passes it, stop and report BLOCKED with each run's figures
   and the condition that failed: the approach depends on it and the owner decides.
4. Remove the probe worktree (`git worktree remove --force ../accord-probe`, then
   `git update-ref -d refs/heads/probe/fixed-context <the sha you read with git rev-parse>`) and the scratch folder.

Then write `scripts/fixed-context.mjs` (new) with a header comment saying it is the pure half of the fixed-context
measurement (ST-LN-79). It exports the shared constants of the preamble, `dispatchPrompt`, and
`PROBE_FORMS = { claudeVersion, extraArgs, noSources, agentsArg, deny: { skill, agent, command } }`, the forms that
passed: `claudeVersion` the version printed in step 1; `extraArgs` the flags of step 2 (an empty array when none
was needed); `noSources` the argument array that turned every setting source off in run f (such as
`['--setting-sources', '']`); `agentsArg` `'file'` when `--agents` took a file path, else `'inline'`; `deny` the
rule templates of run e with `{name}` for the name (`'Skill({name})'`, `'Agent({name})'`, and for commands the
template that removed `zzprobe-x`).

Fixtures: from run a, write `all-on-main.jsonl` and `all-on-executor.jsonl` holding only: the first user line
(prompt text kept); the attachment lines of type `instructions` (each file reduced to `path` and `type`),
`skill_listing` (content reduced to its `- accord` lines and the first two other lines), `agent_listing_delta`
(`addedLines` reduced the same way, other arrays dropped), `hook_additional_context`, and a `hook_success` line of
the SessionStart hook if there is one (`stdout` and `content` emptied); every line of the first assistant message
(keeping `type`, `timestamp`, `cwd`, `gitBranch`, `version`, and `message` reduced to `id`, `model`, `usage`); and
one assistant line of the second message. In every kept line, the home folder (both slash forms) becomes
`C:/owner-home`; no line holds an e-mail address, `"thinking"`, or `<letter>:/Users/` in either slash form.

Test first, then `firstCall`:
- `it('risk:parsing a probe transcript gives its first call input and what loaded before it')`: read each fixture,
  split into lines, `JSON.parse` each; `firstCall(lines)` returns the first message's `id` and `model`, an `input`
  equal to the sum you compute in the test from the fixture's usage fields (largest per field over the message's
  lines), `version`, `cwd`, `branch` (`gitBranch`), `ts` (the timestamp as milliseconds); for the main fixture
  `instructions` paths and types as in the fixture, `skillListing` holding the fixture's `- accord` lines,
  `agentListing` holding its `- accord-` lines, and `prompt` starting with `PROBE_PREFIX`; for the executor
  fixture `hookContexts[0]` starting with `# accord rules`. An attachment placed after the first assistant line
  in a copy of the lines is not read; lines with no assistant message give `null`. The test also asserts that no
  line of either fixture matches `/[A-Za-z]:[\\/]+Users[\\/]/i`, `/\/[a-z]\/Users\//i`,
  `/[\w.+-]+@[\w-]+(\.[A-Za-z][\w-]*)+/` (an e-mail address; `accord@0.3.0` in the rules block is not one) or
  `/"thinking"/`.
- `firstCall(lines)`: lines are parsed objects. The first call is the first `type: 'assistant'` line whose
  `message.model` is not `<synthetic>`; its message id is `message.id ?? requestId ?? uuid`. Only lines before
  that line count as loaded before it: `instructions` gives `attachment.files` as `{ path, type }`;
  `skill_listing` gives `attachment.content` split into lines; `agent_listing_delta` gives `attachment.addedLines`;
  `hook_additional_context` gives each `attachment.content` item; `sessionStartHook` is true when a `hook_success`
  attachment has `hookEvent: 'SessionStart'`, `exitCode: 0` and a `command` holding ` hook session-start`. `prompt`
  is the text of the first `type: 'user'` line (a string `message.content`, or its `text` items joined with
  `\n`). `version` is the first line's `version` that is set.

## Task 2: Read the setup on this machine and group it by owner
covers: D-01, D-08
files: scripts/benchmark.mjs, packages/core/test/benchmark-fixed.test.ts (new), packages/core/test/helpers/fixed-world.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-the-setup-lists-each-enabled-plugin-listable-MCP-server-and-own-skill-set-under-its-owner

Consumes: the repository's `.claude/` folder, `.mcp.json`, and the home folder's `.claude/settings.json`,
`.claude/plugins/installed_plugins.json`, `.claude.json`, `.claude/skills/`, `.claude/agents/`, `.claude/commands/`.
Produces: `export function readSetup({ repo, home })` in `scripts/benchmark.mjs`, and the test world helper.
Behaviour that must not change in `scripts/benchmark.mjs`: every existing export and mode.

`readSetup` returns, every list sorted by its name or id, every path with `/`:
- `repo`, `home`, `mainCheckout`: the parent of `git rev-parse --path-format=absolute --git-common-dir` run in
  `repo` (a linked worktree gives the main checkout).
- `agents`: each `<repo>/.claude/agents/*.md` holding the line `<!-- generated by accord skills sync` (accord's
  marker): `{ name, file, model, tools, body, hash }`; `name` and `model` from the YAML frontmatter
  (`parseYaml`, already imported); `tools` the frontmatter `tools` split on `,` and trimmed, or `null` when absent
  (every tool); `body` the text after the closing `---` line; `hash` the sha256 hex of the whole file.
- `accordSkills`: each `<repo>/.claude/skills/*/SKILL.md` holding the marker: `{ name, description }` from its
  frontmatter.
- `hookCommand`: the `command` of the `SubagentStart` hook in `<repo>/.claude/settings.json` that holds
  ` hook subagent-start`, else `''`.
- `plugins`: the plugins enabled after merging `enabledPlugins` of `<home>/.claude/settings.json`,
  `<repo>/.claude/settings.json` and `<repo>/.claude/settings.local.json`, in that order (the last file's value
  wins); a plugin set `false` is left out (it costs nothing per call). Each is `{ id, version, accordOwn }`:
  `version` from `<home>/.claude/plugins/installed_plugins.json` `plugins[id]`, the entry with `scope: 'user'`,
  else the one whose `projectPath` equals `mainCheckout` (slashes turned, case folded), else `null`; `accordOwn` is
  `id === 'accord-panel@accord'` (it counts under plugins, named as accord's own: ledger Ruling).
- `mcp`: the listable servers, `{ name, scope, entry, hash }`, from `<home>/.claude.json` `mcpServers` (`user`),
  `<repo>/.mcp.json` `mcpServers` (`project`), and `<home>/.claude.json` `projects[<key>].mcpServers` for each key
  equal to `mainCheckout` or `repo` (slashes turned, case folded) (`local`); a name in `local` replaces one in
  `project`, which replaces one in `user`. `hash` is the sha256 hex of `JSON.stringify(entry)`. An entry's values
  are never printed or written anywhere but the MCP config files of Task 3.
- `sets`: the owner's own skills, agents and commands, user level (`<home>/.claude/skills/<dir>/SKILL.md`,
  `<home>/.claude/agents/*.md`, `<home>/.claude/commands/**/*.md`) and project level (the same under
  `<repo>/.claude/`), without any file holding accord's marker. A member is `{ kind, name, level, hash }`: `kind`
  `skill`, `agent` or `command`; `name` the frontmatter `name`, else the folder name (skills), the file name without
  `.md` (agents), or the path below `commands/` without `.md` with `/` turned to `:` (commands); `hash` the sha256
  hex of the file. Members are grouped by prefix, the name up to its first `-` or `:` (a name with neither is its
  own prefix), into `{ prefix, members }`.
A file or folder that does not exist gives an empty part; a JSON file that does not parse stops with an error
naming the file.

Test first. `packages/core/test/helpers/fixed-world.ts` (new) exports `makeWorld()` returning
`{ tmp, home, repo, bench }` (all with `/`), building under a temporary folder `<tmp>`:
- `<tmp>/work/repo`: `git init -q -b main`; `.claude/agents/accord-scout.md` (tools `Read, Grep, Glob`, model
  `sonnet`), `accord-critic.md` (tools `Read, Grep, Glob`, model `opus`), `accord-executor.md` (no `tools`, model
  `sonnet`), each frontmatter then the marker line then one body line; `.claude/agents/my-helper.md` (no marker);
  `.claude/skills/accord/SKILL.md` (marker, `name: accord`, a description) and `.claude/skills/own-notes/SKILL.md`
  (no marker); `.claude/settings.json` with the SubagentStart hook command
  `npx --yes @accord-dev/accord@0.3.0 hook subagent-start` and `enabledPlugins: { "accord-panel@accord": true }`;
  `.mcp.json` with server `proj-db`; `CLAUDE.md` holding the pointer block (`<!-- accord:start -->` to
  `<!-- accord:end -->`, as in the repository's `CLAUDE.md`) and one own line; one commit of all of it.
- `<tmp>/work/accord-bench` is `bench` (equal to `benchRoot(repo)`).
- `<tmp>/home`: `.claude/settings.json` with `enabledPlugins` `alpha@m: true`, `beta@m: true`, `gamma@m: false`;
  `.claude/plugins/installed_plugins.json` with user-scope versions `1.0.0`, `2.0.0`, `3.0.0` for them;
  `.claude.json` with `mcpServers: { "user-search": { command: "x", env: { API_KEY: "sekret-user-123" } } }` and
  `projects: { <repo path>: { mcpServers: { "local-db": { type: "http", url: "https://x.invalid",
  headers: { Authorization: "Bearer sekret-local-456" } } } } }`; skills `gsd-a`, `gsd-b`, `aws-x`
  (`.claude/skills/<n>/SKILL.md`); agent `.claude/agents/gsd-r.md`; command `.claude/commands/tool/run.md`;
  `.claude/CLAUDE.md` with one line.
- `it('risk:complex-branching the setup lists each enabled plugin listable MCP server and own skill set under its owner')`:
  `readSetup({ repo, home })` lists plugins `accord-panel@accord` (`accordOwn: true`, `version: null`),
  `alpha@m` (`1.0.0`) and `beta@m` (`2.0.0`), and not `gamma@m`; servers `local-db` (`local`), `proj-db`
  (`project`) and `user-search` (`user`), each with a 64-hex `hash`; sets `aws` (skill `aws-x`), `gsd` (skills
  `gsd-a`, `gsd-b`, agent `gsd-r`), `my` (project agent `my-helper`), `own` (project skill `own-notes`) and `tool`
  (command `tool:run`); no set member named `accord` or `accord-*`; agents `accord-critic`, `accord-executor`
  (`tools: null`), `accord-scout` with their models; `accordSkills` `[{ name: 'accord', ... }]`; `hookCommand` the
  command above; `mainCheckout` equal to `repo`.

## Task 3: Write the probes run from the probe worktree, and `--fixed --probe`
covers: D-02, D-08
files: scripts/fixed-context.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-fixed.test.ts (new), packages/core/test/helpers/fixed-world.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-phase-one-has-an-all-on-probe-and-one-leave-one-out-probe-per-plugin-MCP-server-and-own-set, packages/core/test/benchmark-fixed.test.ts#risk:security-MCP-config-files-stay-under-the-bench-root-and-no-server-secret-is-printed-or-stored-in-the-repository

Consumes: `readSetup` (Task 2), `PROBE_FORMS` and `dispatchPrompt` (Task 1). Produces: in
`scripts/fixed-context.mjs`, `fingerprints(setup)` and `phaseOne(setup)`, and `shellLine(args)`; in
`scripts/benchmark.mjs`, `writeProbes({ repo, home, bench, probes, fresh })`, `fixedProbe({ repo, home, bench })`
returning `{ exit, text }`, and the mode `--fixed --probe`, whose `main()` branch prints `text` and returns `exit`
(every function of this plan returns its text and only `main()` prints).
Behaviour that must not change in `scripts/benchmark.mjs`: every existing mode; `main()` keeps answering every
other argument list as before, and its usage line gains `--fixed [--probe]`.

- `fingerprints(setup)` maps: `plugin:<id>` to its version or `none`; `mcp:<name>` to its hash; `set:<prefix>` to
  the sha256 hex of its members as sorted lines `<kind>\0<name>\0<hash>`; `agent:<name>` to the agent's hash;
  `hook` to `hookCommand`; `skills` to the sha256 hex of the accord skills as sorted lines
  `<name>\0<description>`.
- `phaseOne(setup)` returns the probes run from the probe worktree, sorted by id, each
  `{ id, where: 'probe', depends, settings?, mcp? }`: `all-on` (depends on every key of `fingerprints`); one
  `plugin:<id>` per enabled plugin with `settings: { enabledPlugins: { <id>: false } }` (depends `plugin:<id>`);
  `mcp-ref` with `mcp` every listable server (depends on every `mcp:` key, so a changed server re-runs the
  reference its figure is read against); one `mcp:<name>` per listable server with `mcp` every other listable
  server (depends `mcp:<name>`); one `set:<prefix>` per set with `settings: { permissions: { deny: [...] } }`,
  one entry per member from `PROBE_FORMS.deny[kind]` with `{name}` replaced (depends `set:<prefix>`). `mcp-ref` exists also when there
  is no listable server: it then has no `mcp` and is `--strict-mcp-config` alone, so the claude.ai connectors line
  is still measured (approach).
- `shellLine(args)` joins arguments for Git Bash: an argument matching `/^[A-Za-z0-9._/@+=:,-]+$/` as is, any
  other (the empty string included) in single quotes with each `'` written `'\''`.
- `writeProbes` writes, for each probe, its files under `<bench>/fixed/`: `<safe id>.settings.json` (the
  `settings` object) and `<safe id>.mcp.json` (`{ mcpServers: { <name>: <entry> } }`), where the safe id is the id
  with every character outside `[A-Za-z0-9._-]` turned to `_`. It gives the probe a session id
  (`crypto.randomUUID()`) when `fresh` is true or the probe has none in `probes.json`, and builds its command:
  `cd <cwd> && claude -p --session-id <id> ...PROBE_FORMS.extraArgs [--settings <file>] [--mcp-config <file>]
  [--strict-mcp-config] <prompt>` with the prompt `dispatchPrompt(<every setup agent name>)`; `--strict-mcp-config`
  is on `mcp-ref` and every `mcp:` probe. It stores `{ id, sessionId, cwd, command, fingerprint }` (`fingerprint`
  the probe's depends keys with their current values) into `probes.json`, keeping entries of other probes.
- `fixedProbe` (`node scripts/benchmark.mjs --fixed --probe`) refuses with exit 2 and one line
  when `git status --porcelain -z -- ':(literal).claude' ':(literal)CLAUDE.md'` is not empty (the probe worktree
  holds the commit, not the working files). Otherwise it writes every phase-one probe with `fresh: true` and prints:
  a first line `# Run in Git Bash, then run: node scripts/benchmark.mjs --fixed`; then
  `git -C <repo> worktree add -B probe/fixed-context <probe worktree> <HEAD sha>` when the probe worktree folder
  does not exist, else `git -C <probe worktree> checkout -B probe/fixed-context <HEAD sha>`; then each probe's
  command, one per line, sorted by id. Exit 0.

Tests first, both with `makeWorld()`, calling `fixedProbe` and reading its `text`:
- `it('risk:complex-branching phase one has an all-on probe and one leave-one-out probe per plugin MCP server and own set')`:
  `phaseOne(readSetup(...))` ids are exactly `all-on`, `mcp-ref`, `mcp:local-db`, `mcp:proj-db`,
  `mcp:user-search`, `plugin:accord-panel@accord`, `plugin:alpha@m`, `plugin:beta@m`, `set:aws`, `set:gsd`,
  `set:my`, `set:own`, `set:tool`; `set:gsd` denies exactly the four member names through the templates; the
  printed commands pass settings and MCP config by `--settings <path>` / `--mcp-config <path>` (no printed line
  holds `{`), each starts `cd ` and the probe worktree path, and the line before them is the `worktree add` line;
  `probes.json` holds one entry per probe with a distinct session id. A setup with no listable server still has
  `mcp-ref`, whose command holds `--strict-mcp-config` and no `--mcp-config`.
- `it('risk:security MCP config files stay under the bench root and no server secret is printed or stored in the repository')`:
  after `--fixed --probe` on the world, `sekret-user-123` and `sekret-local-456` appear in no printed line, in no
  file under `repo`, and not in `probes.json`; they appear only in `.mcp.json` files under `<bench>/fixed/`, and
  `<bench>` is not inside `repo`.

## Task 4: Plan the probes run from the empty folder: baseline, references and appended texts
covers: D-01, D-06
files: scripts/fixed-context.mjs (new), packages/core/test/benchmark-fixed.test.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-each-text-is-sized-on-the-models-of-the-rows-it-reaches-and-the-baseline-has-one-stub-per-tool-list-and-model

Consumes: a setup (Task 2) and `allOn`, `{ main: FirstCall, agents: { <name>: FirstCall } }` read from the all-on
probe (Task 1). Produces, pure in `scripts/fixed-context.mjs`: `stubsOf(setup, allOn)`, `textsOf(setup, allOn,
read)` and `phaseTwo(setup, allOn, read)`.

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
  - For each `instructions` path in any FirstCall (deduplicated with slashes turned and case folded), with `label`
    its printed path (preamble rules): `read(path)` gives the file now (`undefined` when it no longer exists: no
    text). When the file holds `<!-- accord:start -->` and `<!-- accord:end -->`, `pointer:<label>` (`accord`) is
    the text from the start marker to the end of the end marker, and `doc:<label>` (`CLAUDE.md and memory`) is the
    file with that span removed; otherwise `doc:<label>` is the whole file. Rows of both: each row whose FirstCall
    `instructions` lists the path. A `doc:` text that is empty after the cut is left out.
  - `prompt` (owner `probe`): `dispatchPrompt(<agent names>)`, rows `['main']`; `baseline-prompt` (`probe`):
    `dispatchPrompt(<stub names>)`, rows `['main']`; `brief` (`probe`): `PROBE_BRIEF`, rows every agent with an
    all-on FirstCall.
- `phaseTwo` returns, sorted by id, each `{ id, where: 'empty', depends, model, ... }`: `baseline`
  (`model` the main's model key, `stubs` from `stubsOf`, depends `stubs` with the stubs' JSON as value);
  `ref:<model>` for each model key of a row; `text:<text id>:<model>` for each text and each distinct model key of
  the rows it reaches (`text` the text, `source` `'disk'` for `agent:`, `doc:` and `pointer:` texts and `'probe'`
  for the others, depends `text:<text id>` with the sha256 hex of the text). `phaseTwo` builds no command; Task 5
  writes the files and commands.

Test first: `it('risk:complex-branching each text is sized on the models of the rows it reaches and the baseline has one stub per tool list and model')`,
in memory, no files: a setup of three agents (scout: `Read, Grep, Glob`, sonnet; critic: `Read, Grep, Glob`, opus;
executor: `null`, sonnet) and an `allOn` where main (model `m-opus`, `sessionStartHook: true`, `skillListing`
`['- accord: a', '- gsd-a: b']`, `agentListing` `['- accord-scout: s', '- other: o']`, `instructions` `C:/r/CLAUDE.md`
and `C:/h/MEMORY.md`), scout (`m-sonnet`, the rules context, `instructions` `C:/r/CLAUDE.md`), critic (`m-opus`,
rules, both files) and executor (`m-sonnet`, rules, `skillListing` `['- accord: a']`, `C:/r/CLAUDE.md`); `read`
returns a `CLAUDE.md` with the pointer block and one own line, and a one-line `MEMORY.md`. Assert: the stubs are
three (scout's, critic's, executor's pairs); `agent:accord-critic` is sized on `m-opus` only; `rules` on `m-opus`
and `m-sonnet` (rows main, scout, critic, executor); `skill-listing` on `m-opus` and `m-sonnet` (rows main and
executor, not scout or critic); `agent-listing` on `m-opus` only (row main); the `MEMORY.md` doc on `m-opus` only
(main and critic); the `CLAUDE.md` doc holds the own line and not `accord:start`, and its pointer text holds both
markers; `brief` is sized on both models; `prompt` and `baseline-prompt` on `m-opus`; one `ref:` per model; a
setup agent with no all-on FirstCall gets no text and no stub.

## Task 5: Find the probes that are missing or stale, and write their commands
covers: @ac-1, @ac-3, D-02
files: scripts/fixed-context.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-fixed.test.ts (new), packages/core/test/helpers/fixed-world.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-a-changed-item-reprints-only-its-own-probes-and-the-all-on-probe

Consumes: Tasks 1 to 4. Produces: in `scripts/benchmark.mjs`, `locateSessions(home, sessionIds)` and
`fixedPending({ repo, home, bench, version })`; in `scripts/fixed-context.mjs`, `pendingProbes({ setup, state,
located, version, read })`. Behaviour that must not change: `fixedProbe` (Task 3) still writes every phase-one
probe anew; the existing modes of `scripts/benchmark.mjs`.

- `locateSessions(home, ids)` looks in every folder under `<home>/.claude/projects/` for `<id>.jsonl` and returns a
  Map from id to `{ main: FirstCall | null, agents: { <agentType>: FirstCall } }`, the agents read from
  `<folder>/<id>/subagents/agent-*.jsonl` with their `.meta.json` `agentType`; an id with no file is absent.
- `pendingProbes` returns `{ probes, pending, notes }`: `probes` the probes needed now, `pending` their ids that
  are missing or stale, sorted. A probe is missing when `state` has no entry for it, or its session has no main
  FirstCall, or (phase one) an accord agent of the setup has no FirstCall in it, or (`baseline`) a stub has none.
  A probe is stale when its transcript's `version` differs from `version` (the current Claude Code version), or a
  key of its `depends` has a stored value different from the current one. `all-on` is also stale when the stored
  text hash of a `text:` probe whose text has `source: 'disk'` differs from the current text's hash (a changed
  text needs its own append probe and the all-on probe again: approach); both are then printed together, and once
  both have run neither is stale. A text taken from the all-on transcript itself (`rules`, the listings) never
  makes the all-on stale; the all-on's `hook`, `skills` and `agent:` keys cover what changes it. The probes needed
  are `phaseOne(setup)` always, and `phaseTwo(setup, allOn, read)` whenever the all-on probe in `state` has a
  transcript (`allOn` read from it, stale or not); without one, `notes` holds
  `The baseline, reference and text probes follow once the all-on probe has run.`
- Phase-two files and commands: `<bench>/fixed/stubs.json` holds the baseline stubs as
  `{ <name>: { description: 'probe stub', prompt: 'Reply ok.', model, tools } }` (`model` the frontmatter model,
  `tools` absent for `null`); `<bench>/fixed/<safe id>.md` holds a `text:` probe's text. Every phase-two command is
  `cd <bench>/fixed/empty && claude -p --session-id <id> ...PROBE_FORMS.extraArgs ...PROBE_FORMS.noSources
  --strict-mcp-config --model <model key>` followed by: for `baseline`, `--agents` with the path of `stubs.json`
  when `PROBE_FORMS.agentsArg` is `'file'`, else the JSON itself (quoted by `shellLine`), and the prompt
  `dispatchPrompt(<stub names>)`; for `ref:`, the prompt `PROBE_BRIEF`; for `text:`,
  `--append-system-prompt-file <its .md file>` and the prompt `PROBE_BRIEF`.
- `fixedPending` reads the setup, `probes.json` and the sessions it names, computes the pending probes, and for each
  writes its files (Task 3's for phase one) and its `probes.json` entry; a pending probe keeps its stored session
  id while no transcript exists for it, else gets a new one. When nothing is pending it writes nothing. It returns
  `{ exit, pending, text }`, `text` being the lines `fixedProbe` prints (the worktree line only when a phase-one
  probe is pending) followed by the notes. Phase-two probes run from `<bench>/fixed/empty`, which `fixedPending`
  creates, and refuses (exit 2 and one line) when `git rev-parse --is-inside-work-tree` succeeds there.

Test first. `fixed-world.ts` gains `writeSession(home, folder, sessionId, { main, agents })` writing
`<home>/.claude/projects/<folder>/<sessionId>.jsonl` and each `<sessionId>/subagents/agent-<n>.jsonl` with its
`.meta.json` (`agentType`, `description`), and line builders: `assistantLine({ id, model, input, cacheRead,
cacheWrite, output, ts, cwd, branch, version, chars })`, `attachmentLine(attachment)` and `userLine(text)`.
`it('risk:complex-branching a changed item reprints only its own probes and the all-on probe')` on `makeWorld()`:
1. after `fixedProbe`, `fixedPending` with version `9.0.0` lists every phase-one id and the note, no phase-two id;
2. once every phase-one session is written (main and the three agents, version `9.0.0`, the all-on main with
   `instructions` naming the world's `CLAUDE.md`, the agents with the rules context), it lists exactly the
   phase-two ids;
3. once those are written, nothing is pending and `probes.json` is unchanged by the call;
4. with `beta@m` set to `2.1.0` in `installed_plugins.json`, exactly `all-on` and `plugin:beta@m`;
5. with that restored and the own line of the world's `CLAUDE.md` changed, exactly `all-on` and the
   `text:doc:<label>:<model>` ids of that file, not its `text:pointer:` ids;
6. with that restored and version `9.1.0`, every probe.

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
- `version` is the `version` of the line with the latest timestamp among every line read (left-out runs included),
  the current Claude Code version Task 8 compares probes with; `folders` is `dirs.length`.
- `readSessions` (`scripts/benchmark.mjs:307`) and `legacyReport` (`scripts/benchmark.mjs:68`) skip a subagent run
  whose meta `description` starts with `PROBE_DESCRIPTION` or any of whose lines has `gitBranch` `PROBE_BRANCH`
  (probe runs are left out of the existing round tools: approach).

Test first: `it('risk:parsing calls are read once per message from main and subagent transcripts and probe and bench runs are left out')`,
with `writeSession` into one folder of a fake home: a real main session (message `m1` over two lines with the same
usage, message `m2`, one `<synthetic>` line); an `accord-scout` run of two calls; a `general-purpose` run of one call;
a probe session (`gitBranch` `probe/fixed-context`) with a `fixed probe accord-scout` run; a run whose `cwd` is under
`bench`. Assert the calls: two `main`, two `accord-scout` (`accord: true`), one `general-purpose` (`accord: false`),
none from the probe or the bench run; `m1`'s usage counted once; an `output` raised by its text length; `version`
the newest line's; and `readSessions([folder]).runs` holds the scout and general-purpose runs and not the probe
run.

## Task 7: Turn the probe transcripts into each row's total and parts
covers: @ac-1, D-01
files: scripts/fixed-context.mjs (new), packages/core/test/benchmark-fixed.test.ts (new)
verify: packages/core/test/benchmark-fixed.test.ts#risk:complex-branching-a-part-is-charged-only-to-the-rows-it-reaches-and-unattributed-is-what-the-named-parts-leave

Consumes: a setup, the probes of `pendingProbes` with none pending, the located sessions, and `textsOf`. Produces,
pure: `measure({ setup, probes, located, texts })` returning `{ rows, items }`. `I(p, r)` below is the first-call
`input` of row `r` in probe `p` (for `baseline`, of the stub the row maps to; for `ref:` and `text:` probes, of
the main); `size(t, m) = I(text:t:m, main) − I(ref:m, main)` (no characters-per-token ratio: approach); `m(r)` is
row `r`'s model key.
- Rows: `main` and each setup agent with an all-on FirstCall. Each `{ row, model: m(r), total, parts:
  { accord, claudeCode, plugins, mcp, docs, sets }, unattributed }`, all in raw tokens per call:
  - `total = I(all-on, r) − size(prompt, m(main))` for `main`, `I(all-on, r) − size(brief, m(r))` for an agent
    (the fixed context is without the task prompt: ledger Ruling).
  - `claudeCode = I(baseline, main) − size(baseline-prompt, m(main))` for `main`, and
    `I(baseline, stub of r) − size(brief, m(r))` for an agent.
  - each plugin `p`: `I(all-on, r) − I(plugin:p, r)`; each listable server `s`: `I(mcp-ref, r) − I(mcp:s, r)`;
    the line `claude.ai connectors and plugin-provided servers`: `I(all-on, r) − I(mcp-ref, r)`; each set `g`:
    `I(all-on, r) − I(set:g, r)`.
  - each text with owner `accord` or `CLAUDE.md and memory`: `size(t, m(r))` for each row it reaches, 0 elsewhere.
  - `accord`, `plugins` (accord-panel included, labelled as accord's own), `mcp` (servers plus the connectors
    line), `docs`, `sets` are the sums of their items; `unattributed = total − claudeCode − every other part`, so
    the parts add up to the total (it may be negative: leave-one-out figures need not add up, approach).
- `items`: every item above, `{ id, owner, label, perRow: { <row>: tokens } }`, an item reaching a row when it is a
  text that reaches it or a probe item whose difference in that row is not 0. Labels: the plugin id (with
  ` (accord's own)` for `accord-panel@accord`), the server name, the connectors line, `set <prefix>` with its
  member count, the text label for docs and pointer blocks, `agent definition`, `rules block`, `skill listing
  entries`, `agent listing entries`.

Test first: `it('risk:complex-branching a part is charged only to the rows it reaches and unattributed is what the named parts leave')`,
in memory: rows main, scout (no skill listing) and executor; chosen first-call inputs for every probe of a setup
with plugins `alpha@m` and `beta@m`, one listable server, one set; `alpha@m`'s probe equal to all-on in scout's row.
Assert each part equals the formula's value from the chosen numbers; `skill listing entries` has no value in
scout's row; `alpha@m` does not reach scout; each row's parts plus `unattributed` equal its `total`.

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

`fixedReport`: reads `readCalls(dirs, { bench })`; its `version` is the current Claude Code version (the folders
hold the probe worktree's and the empty folder's sessions too, `C--Work-accord-probe` and
`C--Work-accord-bench-fixed-empty`); `fixedPending(...)` with it. When probes are pending: `exit` 1, `text` the
commands, and the report file is not written (the size is measured on the setup as it is when the report runs:
ac-1). Otherwise `measure(...)`, `render(...)`, writes `text` to `<repo>/docs/benchmark/fixed-context.md`
(creating the folder), `exit` 0.

`render` prints, reading no clock (every date comes from transcripts, as UTC `YYYY-MM-DD`):
```
# Fixed context per call

Transcripts: <calls> calls from <first> to <last>, read from <folders> transcript folder(s).
Probes: the all-on probe of <its date> under Claude Code <version>.
The main session row is measured under claude -p, with its probe prompt sized and taken out.
<row>: <n> of its <m> calls ran on <other model ids>; they are counted at the size measured on <model>.
A claude.ai connector can change its instructions on the server, which no fingerprint sees; its figure holds for the probe date.
A plugin's own MCP servers count under plugins and again in the claude.ai connectors and plugin-provided servers line; unattributed absorbs the overlap.
Cursor, Codex and Copilot calls were not measured.

## Fixed context per call, raw tokens

| row | model | calls | fixed | accord | Claude Code | plugins | MCP servers | CLAUDE.md and memory | own skills, agents and commands | unattributed |
```
`<calls>`, `<first>` and `<last>` count every call `readCalls` kept; the `<row>: ...` line appears once per row
with calls on another model than its model key. Table rows: `main session (claude -p)` first, then each accord
agent that ran (at least one call) by name; `calls` is the row's call count; the figures are integers. An accord
agent that ran but has no definition now gets its calls and `-` in every figure. Rows of agents that did not run
are not printed.

Tests first, on a measured world: `fixed-world.ts` gains `measuredWorld()`, which builds `makeWorld()`, runs
`fixedProbe`, writes a session for every phase-one probe with chosen first-call inputs, runs `fixedReport`
(which writes the phase-two probes), writes their sessions, and writes real calls: a main session of three calls
and an `accord-scout` run of two calls (no `accord-critic` or `accord-executor` calls). It returns the world and the
chosen numbers, so each expected figure is computed in the test.
- `it('ac-1 the main session and each accord agent that ran get one row split by owner')`: `fixedReport` exits 0;
  the raw table has exactly the rows `main session (claude -p)` (calls 3) and `accord-scout` (calls 2); each cell
  equals the value computed from the chosen numbers; in each row the owner cells plus `unattributed` equal `fixed`;
  `docs/benchmark/fixed-context.md` equals `text`; the text holds no `sekret-` value and no home path with a user
  name (`~/` is used).
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
  each call's own row total, each divided by the whole cost. A call of a row with no figure (another subagent)
  counts in the whole cost only.
- `render` appends, after the raw table:
  - `## Fixed context per call, cost-weighted tokens`: the same columns plus a last column `largest owner`, the
    owner with the largest cost-weighted figure among the six named owners (unattributed is a remainder, not an
    owner); figures with one decimal; then `Weights: fresh input 1, cache read 0.1, cache write 1.25. <n> calls had
    less input than the fixed context now measured; the excess was not charged.`
  - `## Setup items, tokens per call (raw / cost-weighted)`: `| item | owner | <one column per printed row> |`, one
    line per item of `measure` (every enabled plugin, every listable server and the connectors line, every
    CLAUDE.md and memory file that loads, every own set, and accord's own parts), each cell `<raw> / <weighted>`
    for a row it reaches and `-` elsewhere, ordered by owner then label; then
    `What the owner could cut: each line above is the cost per call that removing the item saves in that row.`
  - `## Lane M tickets, share of the ticket's cost`: `| ticket | claim | calls | main fixed context | subagent fixed
    context |`, shares in percent with one decimal, by ticket id; then `Weights: fresh input 1, cache read 0.1,
    cache write 1.25, output 5. Output tokens are estimated at 4 characters a token, since transcripts keep the
    usage from the stream's start.`; when no ticket qualifies, the table is replaced by
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
the largest; an item cell reads `<raw> / <weighted>`; the tickets table has exactly `T-1`, with the two shares
computed in the test from the weights 1, 0.1, 1.25 and 5; the output-estimate sentence is printed.

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

Then run `node scripts/benchmark.mjs --fixed` from the ticket worktree. Exit 1 (commands printed) means the
probes are not current: stop and report BLOCKED with the printed commands, so the main session gives them to the
owner. Exit 0 writes `docs/benchmark/fixed-context.md`; read it whole and check by eye that no MCP server value,
token or e-mail address is in it, then commit it with the test. The report changes nothing in accord or in the
owner's setup and names no keep-or-cut judgement (ledger Ruling): the cut and its proof on ST-LN-46's round 2
samples, and the figures after a cut, belong to the cut ticket (D-03, D-04, D-05, D-07). Check that
`git diff --name-only 5c8b5d96c8cbf6acddfcee3c6358c09b84f75094 -- .claude packages/core/agents CLAUDE.md` prints
nothing.
