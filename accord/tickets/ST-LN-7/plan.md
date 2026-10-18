---
baseline: 8a67291ea2a2581c4c75d7b35fc250140a08d9a3
plan_hash: "fnv1a64:9900eb5ad8e98a04"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: D-14 puts the hands-on check of how each tool appears in the process table first (Tasks 1 and 2),
before anything is built on it; Task 3 is the wiring that proves the approach end to end (Pick up from the
main checkout to a prepared worktree); the skill text and this repository's own config and README come last.

Owner step between Task 1 and Task 2 (D-14). Task 1 commits the probe and the Claude Code capture. Before Task 2
is dispatched, the main session asks the owner to run, from `C:/Work/accord-ln7`, in a chat of each tool the
owner uses for that product (Cursor's agent chat, VS Code Copilot Chat in agent mode, and Codex), the line
`node packages/cli/test/helpers/session-probe.mjs <Tool> packages/cli/test/fixtures/sessions/<file>.json`, with
`<Tool>` and `<file>` being `Cursor cursor`, `Copilot copilot` and `Codex codex`. The owner reads each written
file before it is committed (it holds process names and filtered environment variables). Task 2 commits the three
files. A tool where the probe fails still writes its file, with an `error` field.

Rules for every task:
- Test ids: every test named on a `verify:` line is a top-level `it(...)` with no `describe` around it. Its report
  id is the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`. No test title
  holds `@` or a comma.
- CLI tests import core from `packages/core/dist`: after changing anything under `packages/core/`, run
  `npm run gen` (when a file under `packages/core/skills/` changed) and then `npm run build -w packages/core`
  before running any test. Run one file with `npx vitest run <path>`. End every task with `npm run build`,
  `npm run lint` and `npm run typecheck`, then the test files the task names.
- Files are LF with no BOM. No new dependency. Strings are compared in code-point order, never with
  `localeCompare`. Every path the CLI prints or stores uses `/`, never `\` (D-51).
- Every `git` spawn is `execFileSync('git', [literal args...], { cwd, encoding: 'utf8', stdio: ['ignore',
  'pipe', 'pipe'] })` as in `load/fs.ts`; a git failure the command cannot continue past becomes a `UsageError`
  (exit 2) carrying git's trimmed stderr. No spawn passes `shell:` except the one setup site of Task 3.
- Tests that need a remote use the helpers of `packages/cli/test/helpers/worktree.ts` (Task 3); every directory
  they create is under `os.tmpdir()` and removed in `afterEach`.

Definitions shared by every task:
- The ticket's branch, `branchOf(snapshot, id)`: `snapshot.claimBranches[id]` when `Object.hasOwn` finds it, else
  `(snapshot.claimTemplate ?? DEFAULT_BRANCH_TEMPLATE).replace('{id}', id)`, the same expression as
  `packages/core/src/status/rows.ts:91-94`, so it equals the `branch` `accord status --json` prints. With the
  default template it is `t/<id>`.
- The worktree list: `git worktree list --porcelain` from the root, parsed into entries `{ path, head, branch? }`
  (`branch` is the short name after `refs/heads/`; a `detached` entry has none). The first entry is the main
  worktree. Two paths are the same when they are equal, compared case-insensitively on win32.
- The sibling path of a ticket (D-06, ledger Ruling 7): the main worktree's path up to and including its last
  `/`, then its folder name, `-`, and the id in lower case. For `C:/Work/accord` and `ST-9`:
  `C:/Work/accord-st-9`.
- The default ref (D-15, ledger Ruling 3): `gitDefaultRef(root)`, Task 3, the target of
  `refs/remotes/origin/HEAD` when that ref resolves, else the first of `refs/remotes/origin/main` and
  `refs/remotes/origin/master` that resolves, else `undefined`. Never the local `main`, never fetched by `open`.
- The stop output (D-11, D-12, ledger Ruling 2), written to stdout by the CLI, exactly three lines:
  `stop: open a session in this folder and type the line below it`, then the worktree path, then
  `/accord continue <id>`. It names no tool. The hold output is the one line `held: <id> by this session`.
- Setup (D-07): the `setup` list of the worktree's own `accord/config.yml` (read with core's `loadConfig`; a
  missing or invalid file runs nothing), each command run in order with the worktree as its directory. The setup
  marker is the file `accord-setup-done` in the worktree's own git dir
  (`git rev-parse --path-format=absolute --git-dir` run there), written after every command succeeded (Task 5).
- Holds (D-14): the JSON file `accord/holds` in the common git dir (`git rev-parse --path-format=absolute
  --git-common-dir`), an object keyed by ticket id, each value `{ tool, marker?, pid, start, taken }`, `taken` an
  ISO time. Its lock is `accord/holds.lock` beside it.

## Task 1: Hands-on check: the process table as accord reads it, and the Claude Code capture
covers: D-14
files: packages/cli/src/load/proc.ts (new), packages/cli/test/helpers/session-probe.mjs (new), packages/cli/test/fixtures/sessions/claude-code.json (new), packages/cli/test/proc.test.ts (new), packages/cli/test/spawn-surface.test.ts
verify: packages/cli/test/proc.test.ts#risk:parsing-the-real-process-table-holds-this-process-with-its-parent-and-a-start-time

D-14 asks for a check, in each tool, of how a session appears to a command it runs, before the hold is built.
This task builds the reader and the probe and captures the tool this executor runs in.

Test first, in `packages/cli/test/proc.test.ts` (new):
- `it('risk:parsing the real process table holds this process with its parent and a start time')`:
  `processTable()` (the real one, no mock) returns more than one row; the row whose `pid` is `process.pid` has
  `ppid` equal to `process.ppid`, a non-empty `start` and `name` `node`; a row whose `pid` is `process.ppid`
  exists. Calling it twice gives the same `start` for `process.pid`. It runs on both CI systems.

Interface, `packages/cli/src/load/proc.ts` (new):
- `export interface ProcRow { pid: number; ppid: number; name: string; command: string; start: string }`.
- `processTable(): ProcRow[]`. On win32: `execFileSync('powershell', ['-NoProfile', '-NonInteractive',
  '-Command', <script>], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })`
  where the script sets `[Console]::OutputEncoding = [Text.Encoding]::UTF8`, then maps `Get-CimInstance
  Win32_Process` to objects `pid` (ProcessId), `ppid` (ParentProcessId), `name` (Name), `command` (CommandLine,
  `''` when null) and `start` (`CreationDate.ToUniversalTime().ToString('o')`, `''` when null), piped to
  `ConvertTo-Json -Compress` (a single object, when only one comes back, is wrapped in an array). Elsewhere:
  `execFileSync('ps', ['-A', '-ww', '-o', 'pid=', '-o', 'ppid=', '-o', 'lstart=', '-o', 'args='], { encoding:
  'utf8', env: { ...process.env, LC_ALL: 'C' }, ... })`, each line read as pid, ppid, the five `lstart` fields
  (`Sun Oct 18 10:00:00 2026`, the day possibly space-padded) joined by one space as `start`, and the rest as
  `command`. `name` is the basename of the first word of `command` (POSIX) or of `Name` (win32), lowercased, a
  leading `-` and a trailing `.exe` removed. A spawn failure or output that does not parse throws
  `UsageError('cannot read the process table: ' + reason)`: a hold is never taken on a guess.

`packages/cli/test/helpers/session-probe.mjs` (new), plain Node ESM, run as `node
packages/cli/test/helpers/session-probe.mjs <Tool> <out.json>`: it repeats `processTable`'s two queries and row
shape (it cannot import TypeScript), walks from `process.pid` up through `ppid` (stopping at a missing row, pid 0,
a repeat, or 64 steps), and writes `{ tool, platform, env, chain }` as JSON with two-space indent and a final
newline. `chain` is the walked rows, the probe's own first; `command` is kept only on rows named `node` and is `''`
elsewhere, with `os.homedir()` replaced by `~`. `env` holds every variable whose name matches
`/SESSION|CLAUDE|CODEX|CURSOR|COPILOT|VSCODE|TERM_PROGRAM/i` and does not match
`/TOKEN|KEY|SECRET|PASS|AUTH|CRED/i`. When the table cannot be read it writes `{ tool, platform, error, env, chain:
[] }` with the error message. It prints the written path.

Then run it from this session's shell: `node packages/cli/test/helpers/session-probe.mjs "Claude Code"
packages/cli/test/fixtures/sessions/claude-code.json`, read the file, and in your report name the nearest ancestor
row that is Claude Code itself (its `name`, and its `command` when it is `node`) and every `env` variable whose
value names this session rather than the machine. Commit the file.

`spawn-surface.test.ts`: `ALLOWED` becomes `['git', 'gh', 'ps', 'powershell']`, and the comment above it says
`ps` and `powershell` read the process table for the hold (D-14). Must not change: every other case in that file.

## Task 2: A session is recognised by its tool, from the captured chains, and an unknown one is refused
covers: D-14, D-12
files: packages/cli/src/load/proc.ts (new), packages/cli/test/fixtures/sessions/cursor.json (new), packages/cli/test/fixtures/sessions/copilot.json (new), packages/cli/test/fixtures/sessions/codex.json (new), packages/cli/test/proc.test.ts (new)
verify: packages/cli/test/proc.test.ts#risk:complex-branching-every-captured-tool-session-is-recognised-and-an-unknown-chain-is-refused

Precondition: the owner step of the preamble is done, so `cursor.json`, `copilot.json` and `codex.json` exist
under `packages/cli/test/fixtures/sessions/` beside Task 1's `claude-code.json`. When one is missing, report
BLOCKED naming it; never write a capture by hand. D-12: the hold belongs to the long-lived agent session, so the
session is the tool's own process (and its marker), never the short-lived command that runs the hold.

From Task 1: `ProcRow`, `processTable()`, and the four captures, each `{ tool, platform, env, chain, error? }`.

Test first, in `packages/cli/test/proc.test.ts`:
- `it('risk:complex-branching every captured tool session is recognised and an unknown chain is refused')`: the
  `.json` files under `test/fixtures/sessions/` are exactly `claude-code.json`, `codex.json`, `copilot.json`,
  `cursor.json`. For each without `error`: `sessionOf(f.env, f.chain, f.chain[0].pid)` is defined, its `tool`
  equals `f.tool`, its `pid` and `start` are those of a row of `f.chain` other than the first, and when the
  matching `TOOLS` entry has a `marker`, `session.marker` equals `f.env[marker]`. For each with `error`:
  `sessionOf(f.env, f.chain, 0)` is `undefined`. The Claude Code chain with every row's `name` set to `explorer`
  and `command` to `''` gives `undefined`; so does a table with no row for `self`.

Interface, added to `packages/cli/src/load/proc.ts`:
- `export const TOOLS: readonly { tool: 'Claude Code' | 'Cursor' | 'Codex' | 'Copilot'; names: readonly string[];
  commands: readonly string[]; marker?: string }[]`, written from the captures: `names` are the normalised process
  names of the tool's own process (for example `claude`, `cursor`, `code`, `codex`); `commands` are substrings of
  the command line of a `node` row that hosts the tool (an npm-installed CLI); `marker` is the environment
  variable that names one session of that tool, present only when a capture shows one. Write no entry the
  captures do not support. A tool whose capture has `error` gets no entry, so it is refused.
- `export interface Session { tool: string; marker?: string; pid: number; start: string }`.
- `sessionOf(env: NodeJS.ProcessEnv, table: readonly ProcRow[], self: number): Session | undefined`, pure:
  starting at the parent of `self`'s row, walk up through `ppid` (stop at a missing row, pid 0, a repeat, or 64
  steps); the first row whose `name` is in an entry's `names`, or that is named `node` with a `command` holding one
  of its `commands`, is the session: `{ tool, pid, start }` plus `marker: env[entry.marker]` when that value is a
  non-empty string. No such row gives `undefined`, also when a marker variable is set (D-14: never silently
  unheld).

Must not change: `processTable` and Task 1's test.

## Task 3: Wiring: Pick up from the main checkout adds the ticket's worktree, runs setup, and points to a session there
covers: @ac-1, @ac-2, D-02, D-06, D-07, D-11, D-15
files: packages/core/schemas/config.schema.json, packages/core/src/model/snapshot.ts, packages/core/test/schemas.test.ts, packages/cli/src/load/fs.ts, packages/cli/src/load/proc.ts (new), packages/cli/src/commands/worktree.ts (new), packages/cli/src/run.ts, packages/cli/test/helpers/worktree.ts (new), packages/cli/test/worktree.test.ts (new), packages/cli/test/spawn-surface.test.ts, packages/cli/test/skill-commands.test.ts
verify: packages/cli/test/worktree.test.ts#ac-1-pick-up-adds-the-ticket-worktree-from-origin-main-runs-setup-in-order-and-prints-where-to-continue (@ac-1), packages/cli/test/worktree.test.ts#ac-2-a-failing-setup-command-exits-2-naming-it-and-keeps-the-worktree (@ac-2), packages/cli/test/worktree.test.ts#risk:security-a-ticket-id-cannot-place-a-worktree-outside-its-sibling-folder, packages/cli/test/spawn-surface.test.ts#risk:security-only-git-gh-ps-and-powershell-are-spawned-by-name-and-one-setup-site-uses-the-shell, packages/core/test/schemas.test.ts#risk:parsing-setup-is-a-list-of-non-empty-command-strings

Test helper first, `packages/cli/test/helpers/worktree.ts` (new), using `gitRun`, `writeFiles` and `cleanup` from
`./repo.js` and `CONFIG` and `laneTicket` from `../../../../test/helpers/lane.js`:
- `makeClone(opts: { setup?: string[]; tickets?: string[] } = {})` returns `{ root, remote, sibling(id), git(...args),
  cleanupAll() }`. `remote` is a fresh `mkdtemp` directory under `os.tmpdir()` holding `git init --bare -q -b main`.
  `root` is another, `git init -q -b main`, with local config `user.email fixture@example.invalid`, `user.name
  fixture`, `commit.gpgsign false`; it holds `accord/config.yml` (`CONFIG` plus, when `setup` is given, a `setup:`
  block list of the commands, each double-quoted YAML), `accord/tickets/<id>.md` from `laneTicket(id)` for each of
  `tickets` (default `['ST-9']`), `.gitignore` with `node_modules/`, and `setup-step.js`:
  `require('node:fs').appendFileSync('setup.log', process.argv[2] + '\n'); if (process.argv[2] === 'fail') {
  console.error('boom'); process.exit(1); }`. It commits all, adds `remote` as `origin`, pushes `main` with
  `-u`, and runs `git remote set-head origin main`. `root` is returned as `git rev-parse --show-toplevel` prints it,
  so it matches what the CLI prints. `sibling(id)` is the sibling path of the preamble. `cleanupAll` removes
  `remote`, `root`, and every directory whose name starts with `root`'s folder name plus `-`.

Tests first, in `packages/cli/test/worktree.test.ts` (new), driving the CLI with `run` from `./helpers/repo.js`:
- `it('ac-1 pick up adds the ticket worktree from origin main runs setup in order and prints where to continue')`:
  `makeClone({ setup: ['node setup-step.js ci', 'node setup-step.js build'] })`; in `root`, `git switch -c other`
  and commit one more file, so `root`'s HEAD differs from `origin/main`. `run(['worktree', 'open', 'ST-9'], root)`
  exits 0. `git worktree list --porcelain` has an entry `worktree <sibling('ST-9')>` with `branch
  refs/heads/t/ST-9`; `git rev-parse t/ST-9^` equals `git rev-parse origin/main` and `git log -1 --format=%s t/ST-9`
  is `claim: ST-9`; `<sibling>/setup.log` is exactly `ci\nbuild\n`; `out` split on `\n` holds the three stop lines
  of the preamble with the path `sibling('ST-9')`, and `out` contains none of `claude`, `cursor`, `codex`,
  `copilot` in any case; `git branch --show-current` in `root` is `other`.
- `it('ac-2 a failing setup command exits 2 naming it and keeps the worktree')`: setup `['node setup-step.js ci',
  'node setup-step.js fail']`. `worktree open ST-9` from `root` exits 2; `err` contains `node setup-step.js fail`
  and `boom`; `<sibling>` exists and its `setup.log` is exactly `ci\nfail\n`; neither `out` nor `err` contains
  `sibling('ST-9')` or `/accord continue`.
- `it('risk:security a ticket id cannot place a worktree outside its sibling folder')`: `worktree open ../x`,
  `worktree open a/b` and `worktree open ST-99` (no such ticket, no branch) each exit 2; `git worktree list
  --porcelain` still has one entry and no branch other than `main` exists.

In `packages/core/test/schemas.test.ts`:
- `it('risk:parsing setup is a list of non-empty command strings')`: `setup: ['npm ci', 'npm run build']` and
  `setup: []` validate; `setup: 'npm ci'` gives a `schema.type` finding at `/setup`, and `setup: ['']` one at
  `/setup/0`.
- In `top-level properties are ...`, the expected key list ends `..., 'branch', 'setup']`; nothing else changes.

In `packages/cli/test/spawn-surface.test.ts`, replace the two cases `spawns only git and gh, named as a string
literal (T-05-01)` and `passes no shell option to any spawn site` with one top-level
`it('risk:security only git gh ps and powershell are spawned by name and one setup site uses the shell')`: the
sites whose first argument is not a literal in `ALLOWED` are exactly one, in `load/proc.ts`, and its arguments
contain `shell: true`; the sites whose arguments contain `shell:` are exactly that same one. `has spawn sites to
check` and the printed-paths cases stay.

`packages/cli/test/skill-commands.test.ts`: the expected `REAL` list gains `'worktree open'` in sorted place.

Interface:
- `config.schema.json`: a last property `"setup": { "type": "array", "items": { "type": "string", "minLength":
  1 } }`. `AccordConfig` gains `setup?: string[]; // D-07: commands run in order in a new worktree`.
- `load/fs.ts`: `export function gitDefaultRef(root: string): string | undefined`, the default ref of the
  preamble (`git symbolic-ref -q refs/remotes/origin/HEAD`, then `git rev-parse --verify -q` on each candidate).
  `gitPeopleOnRefs` takes its `defaultRef` from it in place of lines 447-454.
- `load/proc.ts`: `runSetup(commands: readonly string[], cwd: string): { failed?: { command: string; code: number
  | null; tail: string } }`: for each command in order, `spawnSync(command, { cwd, shell: true, encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })`, the only shell site (approach risk 3:
  `setup` is committed repository content, trusted as `tests.affected` is); output is shown only on failure
  (ledger Ruling 6): the first failing command stops the run, with `tail` the last 20 lines of its stderr, else of
  its stdout.
- `commands/worktree.ts` (new): `worktreeOpen(ctx: CommandContext, id: string): number`. The id must match
  `/^[A-Za-z0-9][A-Za-z0-9._-]*$/` (the ticket schema's pattern, as in `new-ticket.ts`), else `UsageError('not a
  valid ticket id: ' + id)`, before any path is built. With `branch = branchOf(ctx.snapshot, id)`: when the branch
  exists (`refs/heads/<branch>` or `refs/remotes/origin/<branch>` resolves) or a worktree entry has it, exit 2 with
  `<branch> already exists` (Task 4 replaces this refusal). Otherwise the claim path: the ticket must be in
  `ctx.snapshot.tickets`, else `UsageError('no ticket ' + id + ' in accord/tickets - nothing was created')`; the
  default ref must exist, else `UsageError('no origin/main in this clone - run git fetch origin, then try again')`;
  then `git worktree add --no-track -b <branch> <sibling> <default ref>`, then in the new worktree `git commit
  --allow-empty -m "claim: <id>"` at once (ledger Ruling 1), then `prepare(path)`, then the stop output.
  `prepare(path)` reads the worktree's own setup (preamble) and calls `runSetup`; a failure throws
  `UsageError('setup command failed in the new worktree: ' + command + ' (exit ' + code + ')\n' + tail + '\nthe
  worktree is kept; fix the command, then continue the ticket again')`, which names no path and no `/accord`
  line. Export `branchOf`, `worktrees(root)` (the parsed list), `siblingOf(mainPath, id)`, `prepare` and
  `printStop(ctx, path, id)` for Tasks 4 to 7.
- `run.ts`: `const worktree = program.command('worktree').description('work each ticket in its own git
  worktree')`, then `worktree.command('open <id>').description('find or prepare the ticket\'s worktree, or take
  its hold from inside it').action((id: string) => { setCode(worktreeOpen(preflight(opts), id)); })`.

Must not change: `gitPeopleOnRefs`'s result for every existing ids test; every other schema case; the order and
options of every existing command; the printed-paths cases in `spawn-surface.test.ts`.

## Task 4: Continue from another checkout finds the worktree that holds the branch, or prepares one on it
covers: @ac-3, D-08, D-15
files: packages/cli/src/commands/worktree.ts (new), packages/cli/test/worktree.test.ts (new)
verify: packages/cli/test/worktree.test.ts#ac-3-continue-from-another-checkout-reuses-the-worktree-holding-the-branch (@ac-3), packages/cli/test/worktree.test.ts#risk:complex-branching-continue-of-a-claimed-branch-with-no-worktree-adds-one-on-that-branch-and-claims-nothing

From Task 3: `worktreeOpen`, `branchOf`, `worktrees`, `siblingOf`, `prepare`, `printStop`; the `makeClone`
helper; the `<branch> already exists` refusal this task replaces.

Tests first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-3 continue from another checkout reuses the worktree holding the branch')`: `makeClone({ setup: ['node
  setup-step.js ci'] })`; `git worktree add -b t/ST-9 <root>-ln9 origin/main` by hand (the folder name is not the
  sibling name). `worktree open ST-9` from `root` exits 0; `out` holds the three stop lines with the path
  `<root>-ln9`; `<root>-ln9/setup.log` does not exist; `git worktree list --porcelain` has the same two entries as
  before; `sibling('ST-9')` does not exist; `root`'s current branch is still `main`.
- `it('risk:complex-branching continue of a claimed branch with no worktree adds one on that branch and claims
  nothing')`: (a) a branch `t/ST-9` made in `root` with one commit and no worktree: `worktree open ST-9` exits 0,
  the entry at `sibling('ST-9')` has `branch refs/heads/t/ST-9` and HEAD equal to that commit (no new commit), its
  `setup.log` is `ci\n`, and `out` holds the stop lines. (b) a fresh clone where `t/ST-10` was pushed to `origin`
  from a second clone and exists here only as `refs/remotes/origin/t/ST-10` (after `git fetch`): `worktree open
  ST-10` exits 0 and the new worktree's HEAD equals `origin/t/ST-10`, with `t/ST-10` tracking it.

Interface, in `worktreeOpen`, before the claim path, in this order:
1. A worktree entry other than the one at `ctx.root` has `branch`: print the stop output with that entry's path and
   return 0, running nothing there (D-15).
2. The entry at `ctx.root` has `branch`: Task 5's hold. Until Task 5 lands, this case falls through to 1's output
   with `ctx.root`'s path.
3. `refs/heads/<branch>` resolves: `git worktree add <sibling> <branch>`, `prepare`, stop output.
4. `refs/remotes/origin/<branch>` resolves: `git worktree add --track -b <branch> <sibling> origin/<branch>`,
   `prepare`, stop output.
5. Otherwise the claim path of Task 3. No claim commit in 1 to 4.

Must not change: Task 3's ac-1, ac-2 and risk:security cases; the stop output's three lines.

## Task 5: The session rooted in the worktree takes the hold; a live holder refuses a second session; a dead hold is taken over
covers: @ac-4, D-03, D-14, D-15
files: packages/cli/src/load/proc.ts (new), packages/cli/src/commands/worktree.ts (new), packages/cli/test/worktree.test.ts (new)
verify: packages/cli/test/worktree.test.ts#ac-4-a-live-holder-refuses-a-second-session-and-a-dead-holder-is-taken-over (@ac-4), packages/cli/test/worktree.test.ts#risk:complex-branching-the-holding-session-re-enters-its-own-hold, packages/cli/test/worktree.test.ts#risk:concurrency-a-locked-hold-file-is-never-overwritten, packages/cli/test/worktree.test.ts#risk:complex-branching-a-worktree-whose-setup-never-finished-reruns-setup-in-full

From Tasks 2 to 4: `processTable`, `TOOLS`, `Session`, `sessionOf`; `worktreeOpen`'s case 2; `prepare`.

Mocking: at the top of `worktree.test.ts`, `vi.mock('../src/load/proc.js', ...)` keeps every real export and
replaces `processTable` with a `vi.fn` running the real one; a test sets rows with
`vi.mocked(processTable).mockReturnValue(rows)`, and `afterEach` restores the real implementation. `CLAUDE =
TOOLS.find((t) => t.tool === 'Claude Code')`. A table for session `S` is: `{ pid: process.pid, ppid: S.pid,
name: 'node', command: '', start: 'self' }`, and `{ pid: S.pid, ppid: 1, name: CLAUDE.names[0], command: '', start: S.start }`;
`envOf(S)` is `{ [CLAUDE.marker]: S.marker }` when `CLAUDE.marker` is set, else `{}`; `idOf(S)` is `S.marker` when
`CLAUDE.marker` is set, else `'pid ' + S.pid`. Sessions: A `{ pid: 7001, start: 'S-A', marker: 'sess-A' }`, B
`{ pid: 7002, start: 'S-B', marker: 'sess-B' }`.

Tests first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-4 a live holder refuses a second session and a dead holder is taken over')`: `makeClone()`; `worktree
  open ST-9` from `root` (exit 0). With the table holding A, `worktree open ST-9` from `sibling('ST-9')` with
  `envOf(A)` exits 0 and `out` is `held: ST-9 by this session\n`; the holds file names A with a `taken` time.
  With the table holding B and A's row too (A still running), from the same folder with `envOf(B)`: exit 2, `err`
  contains `Claude Code`, `idOf(A)` and A's `taken` value, and the holds file bytes are unchanged. With a table
  holding B and no row for 7001 (A stopped without releasing): exit 0, `held: ST-9 by this session`, and the holds
  file now names B.
- `it('risk:complex-branching the holding session re-enters its own hold')`: after A takes the hold, a second
  `worktree open ST-9` with A's table and `envOf(A)` exits 0 with the held line (the command that took the hold
  has exited; the session has not). A table where no ancestor matches any `TOOLS` entry exits 2 with `err`
  containing `cannot tell which agent session`, and the holds file is unchanged.
- `it('risk:concurrency a locked hold file is never overwritten')`: create `accord/holds.lock` in the common git
  dir; `worktree open ST-9` from the sibling with A exits 2 within 5 s, `err` names `holds.lock`, and no holds
  file exists. Remove the lock: the same command exits 0.
- `it('risk:complex-branching a worktree whose setup never finished reruns setup in full')`: `makeClone({ setup:
  ['node setup-step.js ci', 'node setup-step.js build'] })`; `git worktree add -b t/ST-9 <sibling> origin/main`
  by hand. From the sibling with A: exit 0 and `setup.log` is `ci\nbuild\n`; again: `setup.log` is unchanged. In a
  second clone with setup `['node setup-step.js ci', 'node setup-step.js fail']`, `worktree open ST-9` from `root`
  exits 2; the setup marker is absent; with `setup.log` removed, `worktree open ST-9` from the sibling with A exits
  2 again and `setup.log` is `ci\nfail\n` (rerun in full, not from the failed command).

Interface:
- `proc.ts`: `sameSession(a, b)`: same `tool`, and equal `marker` when both have one, else equal `pid` and
  `start`. `isLive(s, table)`: a row with `s.pid` and `s.start` exists (ledger Ruling 4: never `process.kill(pid,
  0)`). `describeSession(s)`: `<tool> session <marker>` or `<tool> pid <pid>`.
- `worktree.ts` case 2 (the entry at `ctx.root` has the ticket's branch): `session = sessionOf(ctx.env,
  processTable(), process.pid)`; `undefined` throws `UsageError('cannot tell which agent session runs this
  command: no known tool among its parent processes - run it from a Claude Code, Cursor, Codex, or Copilot
  session')`. Under the lock, read the holds file (absent is `{}`; a file that is not a JSON object throws a
  `UsageError` naming it and is never rewritten); when the entry for `id` exists, is not `sameSession` and
  `isLive`, throw `UsageError(id + ' is held by another session: ' + describeSession(h) + ' since ' + h.taken + '
  - work it there, or close that session first')`; otherwise write the entry `{ ...session, taken: new
  Date().toISOString() }` (kept `taken` when it is the same session). Then, when the setup marker is missing,
  `prepare(ctx.root)`; then print the held line.
- The lock: `openSync(lock, 'wx')`, creating the `accord` folder first; on `EEXIST` wait 50 ms
  (`Atomics.wait` on a `SharedArrayBuffer`) and retry for 2 s, then `UsageError('the hold file is locked by
  another accord command: ' + lock + ' - if none is running, delete that file')`. The write goes to
  `holds.<pid>.tmp` and is renamed over `holds`; the lock is removed in a `finally`.
- `prepare` writes the setup marker after every command succeeded, so Task 3's and Task 4's added worktrees carry
  it and a session there runs no setup again.

Must not change: the outside cases 1, 3, 4, 5 of Task 4; the ac-1 to ac-3 cases.

## Task 6: `accord worktree clean` fetches, removes the worktrees of merged tickets, and names what it keeps
covers: @ac-5, D-01, D-05, D-11, D-12, D-16
files: packages/cli/src/commands/worktree.ts (new), packages/cli/src/run.ts, packages/cli/test/worktree.test.ts (new), packages/cli/test/skill-commands.test.ts
verify: packages/cli/test/worktree.test.ts#ac-5-bare-accord-fetches-then-removes-merged-worktrees-and-names-what-it-keeps (@ac-5), packages/cli/test/worktree.test.ts#risk:complex-branching-a-failed-fetch-is-said-and-the-refs-in-the-clone-are-judged, packages/cli/test/worktree.test.ts#risk:data-loss-a-worktree-holding-unpushed-commits-is-kept

From Tasks 3 to 5: `worktrees`, `gitDefaultRef`, the holds file and its lock, `sessionOf`, `isLive`,
`sameSession`, the mocked `processTable`. `ticketOfBranch` is in `load/fs.ts`.

Tests first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-5 bare accord fetches then removes merged worktrees and names what it keeps')`: `makeClone({ tickets:
  ['ST-9', 'ST-10', 'ST-11', 'ST-12'] })`; for each id add `git worktree add -b t/<id> <sibling> origin/main`,
  commit one file in it, and push the branch. A second clone of `remote` merges `t/ST-9`, `t/ST-10` and `t/ST-12`
  into `main` with `--no-ff` and pushes; `root` does not fetch. Then: `<sibling ST-9>/node_modules/x` (ignored),
  `<sibling ST-10>/new.txt` (not added), a holds entry for `ST-12` naming `{ tool: 'Claude Code', pid: 4242, start:
  'S2' }` with a table holding that row. `worktree clean` from `root` with env `{}` exits 0. `origin/main` in
  `root` now equals the remote's `main`; `sibling('ST-9')` no longer exists; `out` lines are exactly, in this order,
  `removed <sibling ST-9>`, `kept <sibling ST-10>: uncommitted work`, `kept <sibling ST-12>: held by another
  session`; `<sibling ST-10>/new.txt` and `sibling('ST-11')` still exist; no line names `sibling('ST-11')`; the
  holds file has no `ST-9` entry.
- `it('risk:complex-branching a failed fetch is said and the refs in the clone are judged')`: a worktree `t/ST-9`
  added at `origin/main` with no commit of its own; `git remote set-url origin <a path that does not exist>`;
  `worktree clean` exits 0, its first line starts `fetch from origin failed, judging against the refs already in
  this clone`, and the next is `removed <sibling ST-9>`. With no `origin` remote at all, or with no worktree other
  than the main one, `out` is empty (no fetch is tried).
- `it('risk:data-loss a worktree holding unpushed commits is kept')`: `t/ST-9` pushed and merged on the remote as
  above, then one more commit in its worktree that is not pushed: `worktree clean` keeps the folder and prints
  nothing about it. Run from inside a merged clean worktree, that worktree is kept and named `kept <path>: this
  session's worktree`.

Interface: `worktreeClean(ctx: CommandContext): number`, always 0 unless git cannot run:
1. The entries of `worktrees(ctx.root)` after the first (the main worktree is never removed) whose `branch` gives
   an id through `ticketOfBranch(branch, ctx.snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE], (id) =>
   Object.hasOwn(ctx.snapshot.tickets, id))` are the candidates, whatever the folder is called (D-16). None, or no
   `origin` remote (`git remote get-url origin` fails): print nothing, return 0.
2. Fetch (D-11, ledger Ruling 3): `git -c credential.interactive=never -c "core.sshCommand=ssh -o BatchMode=yes"
   fetch origin` with `env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }`. On failure print `fetch from origin
   failed, judging against the refs already in this clone: <first line of git's stderr>`.
3. `ref = gitDefaultRef(ctx.root)`; none: return 0. A candidate is merged when `git merge-base --is-ancestor
   <entry.head> <ref>` exits 0: its checked-out commit, never `origin/t/<id>` (D-16), against the fetched
   remote-tracking ref, never the local `main` (D-12). An unmerged candidate is kept and not named (ledger Ruling
   5).
4. A merged one, first reason that applies: its path is `ctx.root`: `kept <path>: this session's worktree`;
   `git status --porcelain` there prints anything (modified or new files; ignored files do not count, D-15):
   `kept <path>: uncommitted work`; its holds entry is live (`isLive` on `processTable()`) and not `sameSession`
   with `sessionOf(ctx.env, table, process.pid)` (an unrecognised session counts as no session here, never an
   error): `kept <path>: held by another session`; otherwise `git worktree remove <path>` (never `--force`):
   `removed <path>` and its holds entry is dropped under the lock; a failure prints `kept <path>: git worktree
   remove failed: <first line of git's stderr>` (approach risk 7). `processTable` runs once, and only when a merged
   candidate has a holds entry.
- `run.ts`: `worktree.command('clean').description('fetch, then remove the worktrees of merged tickets and name
  the ones kept').action(() => { setCode(worktreeClean(preflight(opts))); })`. The panel keeps calling only
  `dashboard` (D-12). `skill-commands.test.ts`: `REAL` gains `'worktree clean'`.

D-01: no `git branch -d` and no `--prune`; branches and remote-tracking refs are ST-LN-20's.

Must not change: `worktree open` and every case of Tasks 3 to 5.

## Task 7: A new lane M request writes, commits and pushes its ticket in its own worktree
covers: @ac-6, D-13, D-15
files: packages/cli/src/commands/new-ticket.ts, packages/cli/src/commands/worktree.ts (new), packages/cli/src/run.ts, packages/cli/test/worktree.test.ts (new)
verify: packages/cli/test/worktree.test.ts#ac-6-a-new-lane-m-ticket-gets-its-own-worktree-with-the-ticket-committed-and-pushed (@ac-6), packages/cli/test/worktree.test.ts#risk:data-loss-a-failed-push-keeps-the-claim-commit-and-names-the-push-to-run

From Tasks 3 and 5: `branchOf`, `siblingOf`, `worktrees`, `gitDefaultRef`, `prepare` (writing the setup marker),
`printStop`.

Tests first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-6 a new lane m ticket gets its own worktree with the ticket committed and pushed')`: `makeClone({ setup:
  ['node setup-step.js ci'], tickets: [] })`, `root` on `main`. `run(['new', 'ticket', 'ST-9', '--lane', 'M',
  '--worktree'], root)` exits 0. The worktree list has `branch refs/heads/t/ST-9` at `sibling('ST-9')`; its
  `setup.log` is `ci\n`; `git --git-dir <remote> rev-parse refs/heads/t/ST-9` equals the sibling's HEAD; `git show
  t/ST-9:accord/tickets/ST-9.md` equals the text `new ticket ST-9 --lane M` writes in a second `makeClone({ tickets:
  [] })` without `--worktree`; `git rev-parse t/ST-9^` equals
  `origin/main` before the run; `out` starts with `accord/tickets/ST-9.md` and then holds the three stop lines with
  `sibling('ST-9')`; `root` is on `main` and `<root>/accord/tickets/ST-9.md` does not exist.
- `it('risk:data-loss a failed push keeps the claim commit and names the push to run')`: as above with `origin`'s
  push URL set to a missing path (`git remote set-url --push origin <missing>`): exit 2; `err` contains `git -C
  <sibling> push -u origin t/ST-9`; the sibling exists with the ticket committed; `setup.log` does not exist (setup
  runs after the push).

Interface:
- `newTicket` options gain `worktree?: boolean`. Everything up to the id check and the `existsSync` refusal on
  `ctx.root` is unchanged. With `worktree`: refuse with `<branch> already exists - nothing was written` when the
  branch exists locally, on `origin`, or in a worktree entry; the default ref must exist (same message as Task 3);
  `git worktree add --no-track -b <branch> <sibling> <default ref>` (no fetch, D-15); write the ticket text to
  `<sibling>/accord/tickets/<id>.md`; there `git add -- accord/tickets/<id>.md` and `git commit -m "claim: <id>"`;
  push with `git -c credential.interactive=never -c "core.sshCommand=ssh -o BatchMode=yes" push -u origin
  <branch>` and `GIT_TERMINAL_PROMPT=0`, a failure throwing `UsageError('the ticket is committed in ' + sibling +
  ' but the push failed: ' + <first stderr line> + ' - push it with git -C ' + sibling + ' push -u origin ' +
  branch)`; then `prepare(sibling)`; then print `accord/tickets/<id>.md` and the stop output. Nothing is written
  under `ctx.root`.
- `run.ts`, on `new ticket`: `.option('--worktree', 'write the ticket in its own new worktree on its claim branch,
  commit and push it, then run setup there')`, passed through in `options`.

Must not change: `new ticket` without `--worktree` (every `new-ticket.test.ts` and `lane-commands.test.ts` case,
the printed path, the refusals and their order); the id assignment under `people`.

## Task 8: The /accord skill works each ticket in its own worktree and cleans only from the bare dashboard
covers: D-02, D-04, D-08, D-09, D-11, D-12, D-13
files: packages/core/skills/accord/SKILL.md, packages/core/skills/accord/worktree.md (new), packages/core/src/generated/skills.ts, packages/core/test/stage-skills.test.ts, .claude/skills/accord/SKILL.md, .claude/skills/accord/worktree.md (new)
verify: packages/core/test/stage-skills.test.ts#risk:regression-the-accord-skill-opens-each-ticket-in-its-own-worktree-and-cleans-only-from-the-bare-dashboard

The real bug this guards: Continue ran `git switch` in the one checkout, moving the branch under another session
(ticket `## Intent`). D-04 and D-09: this task adds no file-overlap warning and no other ticket's stage.

Test first, in `packages/core/test/stage-skills.test.ts`:
- `it('risk:regression the accord skill opens each ticket in its own worktree and cleans only from the bare
  dashboard')`: `text` is the rendered `.claude/skills/accord/SKILL.md` from `files` with whitespace runs
  collapsed; `ref` is the rendered `.claude/skills/accord/worktree.md`, non-empty, collapsed the same way. The
  Dashboard slice (`## Dashboard` to `## A ticket named`) has `` `accord worktree clean` `` before `` `accord
  dashboard` ``. The Continue slice (`## Continue` to `## Pick up`) and the Pick up slice (`## Pick up` to `## New
  request`) each contain `` `accord worktree open <id>` `` and `./worktree.md`; the Pick up slice contains `` `git
  push -u origin <branch>` `` and `even when a setup command failed`; the M slice (`- **M.**` to `- **L and P.**`)
  contains `--worktree` and `./worktree.md`. No slice but the Dashboard's contains `worktree clean`, and `text`
  contains no `git switch`. `ref` contains `` `stop:` ``, `` `held: <id> by this session` ``, `Never change
  directory into the worktree`, `editing nothing`, `runs every setup command again`, `the longest timeout`,
  `` `git restore accord/config.yml` `` and ``only from `/accord` with no argument``.

Text, in `packages/core/skills/accord/SKILL.md`; every code span stays on one line, and each phrase in
`REQUIRED.accord` stays on one line:
- frontmatter `loads:` becomes `[accord/ids.md, accord/worktree.md, shared/ask.md]`.
- Dashboard step 1 becomes: ``1. Run `accord worktree clean` and show its lines verbatim; it removes the
  worktrees of merged tickets and names what it keeps. Then run `accord dashboard`. It reads you from `git config
  user.email` and prints every section ranked and capped, one count line, and the actions that apply. When it
  exits 2, show its message and stop.`` (wrapped as the file wraps).
- Continue step 1 becomes: ``1. Run `accord worktree open <id>` and follow `./worktree.md`: only a session
  rooted in the worktree holding its `branch` from `accord status --json` works the ticket. The active ticket is
  the branch, read from git, never from memory.``
- Pick up becomes: ``Run `accord worktree open <id>`: it creates its `branch` from `accord status --json` in the
  ticket's own worktree and commits `claim: <id>` on it. Then push it (the pushed branch is the claim) with `git
  push -u origin <branch>`, even when a setup command failed, and follow `./worktree.md`.`` with `push it (the
  pushed branch is the claim)` on one line.
- The M bullet becomes: ``**M.** Run `accord new ticket <id> --lane M --worktree`; when config.yml has `people`,
  follow `./ids.md` and run `accord new ticket --type <story|bug> --lane M --worktree` with no id instead. It
  writes the ticket on its `branch` (the one `accord status --json` names) in the ticket's own worktree, commits
  it and pushes it; when it says the push failed, push it as it says. Follow `./worktree.md`: `accord-intent`
  runs in the session opened there.``

`packages/core/skills/accord/worktree.md` (new), frontmatter `kind: reference`, then:
```
# Working a ticket in its own worktree

Only a session rooted in a ticket's worktree works that ticket, so no session ever switches tickets.

What `accord worktree open <id>` and `accord new ticket --worktree` print:

- A line `stop:`: show the two lines after it verbatim, the worktree's path and the line to type in a
  session opened in that folder, then stop. Never change directory into the worktree, never edit a file
  there, and never start the next stage from this session.
- `held: <id> by this session`: this session holds the ticket; go on with the next step.
- Exit 2 naming the session that holds the ticket: show the message and stop, editing nothing.
- Exit 2 naming a setup command: show the message and stop. The worktree is kept; once the owner fixes
  the command, `/accord continue <id>` in a session opened there runs every setup command again.
- Any other exit 2: show the message and stop.

Setup commands can take minutes: run these commands with the longest timeout your tool allows.

A `people` edit made before `accord new ticket --worktree`: make the same edit in the worktree's
`accord/config.yml`, commit it there and push it with `git -C <path> push`, then run
`git restore accord/config.yml` here.

`accord worktree clean` runs only from `/accord` with no argument, never from Pick up or Continue.
```

Then `npm run gen`, `npm run build`, and from the repository root `node packages/cli/dist/cli.js skills sync`,
which rewrites `.claude/skills/accord/SKILL.md` and writes `.claude/skills/accord/worktree.md`; commit both.

Size: `skills.test.ts` holds every SKILL.md to 120 lines and 5120 bytes. If either fails, move sentences of these
four edited passages into `worktree.md`, keeping every phrase this test, `REQUIRED.accord`, `ac-5 the accord skill
takes the claim branch...` and `ac-4 the accord skill picks up...` name; never shorten another section.

Must not change: the `## A ticket named` section, Continue steps 2 to 4, the S, L and P bullets and `## Rules`;
every existing case in `stage-skills.test.ts`, `skills.test.ts` (first command `dashboard`, drift, references) and
`packages/cli/test/skill-commands.test.ts`; the skill copies `skills sync` reports `unchanged`.

## Task 9: This repository declares its setup, and the README states what worktrees do and their limits
covers: D-07, D-10, D-14, D-15
files: accord/config.yml, README.md, packages/cli/README.md, packages/cli/test/worktree.test.ts (new)
verify: packages/cli/test/worktree.test.ts#risk:regression-this-repository-setup-builds-before-it-relinks-the-accord-bin

The real bug (D-10, the ticket's ST-LN-21 finding): `npm ci` before `npm run build` left no `accord` bin linked in
a worktree, so the hooks and the panel failed until `npm rebuild @accord-dev/accord --ignore-scripts` ran.

Test first, in `packages/cli/test/worktree.test.ts`:
- `it('risk:regression this repository setup builds before it relinks the accord bin')`: `loadConfig` from
  `@accord-dev/accord-core` over `new URL('../../../accord/config.yml', import.meta.url)` gives no findings and a
  `setup` equal to `['npm ci', 'npm run build', 'npm rebuild @accord-dev/accord --ignore-scripts']`.

Text:
- `accord/config.yml`: after `legacy_ids`, a comment `# Run in order in each new ticket worktree (ST-LN-7 D-07):
  the build links the workspace bin the hooks call.` and the block list `setup:` with the three commands. No other
  line changes.
- `README.md`, under `## What it is`: the CLI bullet gains `` `worktree open|clean` `` after `` `skills sync` ``.
  A new bullet after the Lanes bullet: ``- One worktree per ticket. Pick up, Continue and a new lane M ticket each
  work in the ticket's own git worktree, the sibling folder `<repository folder>-<id in lower case>`, prepared by
  the `setup` commands `config.yml` lists, run in order through the shell (they are repository content, trusted
  as `tests.affected` is). `accord worktree open` prints the folder and the line `/accord continue <id>` to type
  in a session opened there. The session rooted there holds the ticket until it ends, and a second session is
  refused. Sessions are told apart by the tool's own session marker where it has one, else by the tool's process,
  so every chat in one Cursor or VS Code window counts as one session, and a tool whose session cannot be
  recognised is refused. `/accord` with no argument fetches, then removes with `git worktree remove` each
  worktree whose checked-out commit is on the remote main branch, keeping one with uncommitted work or held by
  another session; files ignored by `.gitignore`, such as `node_modules`, are removed with it.``
- Then `npm run gen`, which regenerates `packages/cli/README.md`.

Must not change: every other key of `accord/config.yml` (the pin, `tests`, `people`, `legacy_ids`); the README's
other bullets and its pinned run line; `readme.test.ts` stays green.
