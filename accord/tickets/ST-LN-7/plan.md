---
baseline: 8a67291ea2a2581c4c75d7b35fc250140a08d9a3
plan_hash: "fnv1a64:c85d58ff2504f566"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: the Approach leaves risk 2 (how a Claude Code session is told apart and whether its process is visible)
open until the plan's first task, so Task 1 builds the process-table reader and the Claude Code session rule,
guarded against both unchecked facts, with the one Windows gap its Ruling names.
Task 2 is the wiring that proves the approach end to end (Pick up from the main checkout to a prepared worktree);
the skill text and this repository's own config and README come last. D-17 replaced D-14's hands-on check in
Cursor, Copilot and Codex: no owner step and no captured probe file is planned.

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
  (exit 2) carrying git's trimmed stderr. No spawn passes `shell:` except the one setup site of Task 2.
- Tests that need a remote use the helpers of `packages/cli/test/helpers/worktree.ts` (Task 2); every directory
  they create is under `os.tmpdir()` and removed in `afterEach` by `cleanupAll()`.

Definitions shared by every task:
- The ticket's branch, `branchOf(snapshot, id)`: `snapshot.claimBranches[id]` when `Object.hasOwn` finds it, else
  `(snapshot.claimTemplate ?? DEFAULT_BRANCH_TEMPLATE).replace('{id}', id)`, the same expression as
  `packages/core/src/status/rows.ts:91-94`, so it equals the `branch` `accord status --json` prints. With the
  default template it is `t/<id>`. It needs no ticket file for `id`.
- The worktree list: `git worktree list --porcelain` from the root, parsed into entries `{ path, head, branch? }`
  (`branch` is the short name after `refs/heads/`; a `detached` entry has none), in the order git prints them. The
  first entry is the main worktree. From Task 3 on, an entry carrying a `prunable` line (its folder was deleted or
  moved by hand; `git worktree list` documents the attribute) is never returned: `worktrees(root)` runs `git
  worktree prune` once and lists again when any entry has one, writing one line `pruned <path>: <git's reason>`
  per entry the prune removed. Two paths are the same when they are equal, compared case-insensitively on
  win32.
- The sibling path of a ticket (D-06, ledger Ruling 7): the main worktree's path up to and including its last
  `/`, then its folder name, `-`, and the id in lower case. For `C:/Work/accord` and `ST-9`:
  `C:/Work/accord-st-9`.
- The default ref (D-15, ledger Ruling 3): `gitDefaultRef(root)`, Task 2, the target of
  `refs/remotes/origin/HEAD` when that ref resolves, else the first of `refs/remotes/origin/main` and
  `refs/remotes/origin/master` that resolves, else `undefined`. Never the local `main`, never fetched by `open`.
- The stop output (D-11, D-12, ledger Ruling 2), written to stdout by the CLI, exactly three lines:
  `stop: open a session in this folder and type the line below it`, then the worktree path, then
  `/accord continue <id>`. It names no tool. The hold output is the one line `held: <id> by this session`; the
  no-hold output (D-17) is the one line `not held: <id> - a second session in this worktree is not refused in this
  tool yet`.
- Setup (D-07): the `setup` list of the worktree's own `accord/config.yml` (its text read and passed to core's
  `loadConfig`; a missing or invalid file runs nothing), each command run in order with the worktree as its
  directory. The setup marker is the file `accord-setup-done` in the worktree's own git dir
  (`git rev-parse --path-format=absolute --git-dir` run there), written after every command succeeded (Task 4).
- Holds (D-14, D-17): the JSON file `accord/holds` in the common git dir (`git rev-parse --path-format=absolute
  --git-common-dir`), an object keyed by ticket id, each value `{ tool: 'Claude Code', marker, pid, start, taken }`,
  `taken` an ISO time. Its lock is `accord/holds.lock` beside it. Only Claude Code sessions take holds.
- A Claude Code session (D-17): Claude Code sets `CLAUDE_CODE_SESSION_ID` (the session marker), `CLAUDE_PID` (the
  claude process) and `CLAUDECODE=1` in the environment of every command it runs. Read from `ctx.env`, never from
  `process.env` directly (in a real run `ctx.env` is `process.env`, `packages/cli/src/index.ts:11`).

## Task 1: The process table and the Claude Code session, guarded against the two unchecked facts
covers: D-12, D-17
files: packages/cli/src/load/proc.ts (new), packages/cli/test/proc.test.ts (new), packages/cli/test/spawn-surface.test.ts
verify: packages/cli/test/proc.test.ts#risk:parsing-the-real-process-table-holds-this-process-and-its-parent-with-a-stable-start-time, packages/cli/test/proc.test.ts#risk:complex-branching-a-claude-code-session-is-its-marker-or-its-process-and-a-partial-table-is-refused

Approach risk 2 leaves unchecked whether `CLAUDE_CODE_SESSION_ID` stays the same across a resume and a
compaction, and whether a sandboxed command sees `CLAUDE_PID` in the process table. Checked by the main session
on the author's Windows machine (Claude Code CLI, Git Bash), 2026-10-18: a subagent of a session sees the same
`CLAUDE_CODE_SESSION_ID` and the same `CLAUDE_PID` as the main session, so a subagent's command is the same
session as its parent's; and the `CLAUDE_PID` row (`claude.exe`) is in the table `processTable()` reads. This
task makes the hold safe whichever way the unchecked facts fall: two sessions are the same when their markers are
equal or when their process (pid and start time) is the same, so a marker that changes inside one running claude
process, or a process that changes under one resumed marker, never refuses its own session; and before any hold is
judged, `sessionIn` walks up the parent ids from the command's own process and refuses when the walk ends at the
root of the table (a row with `pid` 1 or `ppid` 0) without meeting `CLAUDE_PID`. On POSIX an orphan is reparented,
so every parent id has a row and the walk always ends at `CLAUDE_PID` or at the root: a sandbox in its own PID
namespace, whose table holds some process numbered `CLAUDE_PID`, is refused, and so is a stale `CLAUDE_PID` reused
by an unrelated process. D-12: the hold belongs to the claude process, never to the short-lived command.

The walk also accepts when it stops at a parent id with no row, provided the `CLAUDE_PID` row exists with a
non-empty start (ledger Ruling on the parent walk, replacing the pid-alone one). On Windows a parent is not
reparented: an intermediate msys `bash.exe` exits after spawning its child, so checked on the author's machine a
direct `node` run walks node, bash, bash, bash, `claude.exe` (met), while through `npm exec -- node` (the shape of
`npx vitest` and of an `npx accord` call) it walks node, cmd, node, bash, bash and then a parent id with no row
(the gap). Only in that gap is the `CLAUDE_PID` row taken on its pid alone, so on Windows a stale `CLAUDE_PID`
whose pid was reused can still be recorded as holder. No check of the row's process name is made: Claude Code runs
as `claude.exe` here, as `node` when installed through npm, and under other names elsewhere, so a name check would
refuse a real session.

The previous executor left uncommitted, in `C:/Work/accord-ln7`, `packages/cli/src/load/proc.ts`,
`packages/cli/test/proc.test.ts` and the `ALLOWED` change in `packages/cli/test/spawn-surface.test.ts`. Keep them
or rewrite them; either way they must end as this section says (its `sessionIn` refuses at a parent id with no
row, and must accept there as below).

Tests first, in `packages/cli/test/proc.test.ts` (new):
- `it('risk:parsing the real process table holds this process and its parent with a stable start time')`:
  `processTable()` (the real one, no mock) returns more than one row; the row whose `pid` is `process.pid` has
  `ppid` equal to `process.ppid` and a non-empty `start`; a row whose `pid` is `process.ppid` exists; a second call
  gives the same `start` for `process.pid`. When `process.env.CLAUDE_PID` is set (this test run from a Claude Code
  session), `sessionIn(claudeEnv(process.env)!, table, process.pid).pid` equals `Number(process.env.CLAUDE_PID)` and its
  `start` is non-empty: this is the check, on this machine, that a command Claude Code runs sees its claude process.
  If that part fails, report BLOCKED with the output; never weaken it. It runs on both CI systems, where that part
  is skipped.
- `it('risk:complex-branching a claude code session is its marker or its process and a partial table is refused')`,
  pure, with a table `[{ pid: 10, ppid: 20, start: 's10' }, { pid: 20, ppid: 30, start: 's20' }, { pid: 30, ppid:
  1, start: 's30' }]` and `self` 10:
  - `claudeEnv({})` is `undefined`; `claudeEnv({ CLAUDECODE: '1' })` throws a `UsageError` whose message contains
    `CLAUDE_CODE_SESSION_ID`; `claudeEnv({ CLAUDE_CODE_SESSION_ID: 'm', CLAUDE_PID: 'abc' })` throws one containing
    `CLAUDE_PID`.
  - `sessionIn({ marker: 'm', pid: 30 }, table, 10)` is `{ tool: 'Claude Code', marker: 'm', pid: 30, start:
    's30' }` (the walk meets 30).
  - With row 20's `ppid` set to 55, a pid with no row (the Windows case: an msys bash between the command and
    claude has exited), `sessionIn({ marker: 'm', pid: 30 }, table, 10)` is still that same session.
  - Each of these throws a `UsageError` containing `cannot see this Claude Code session`, and returns: row 30
    present, row 20's `ppid` set to 1 and a row `{ pid: 1, ppid: 0, start: 's1' }` added (the walk reaches the root
    without meeting 30: a PID namespace, or a reused pid); `pid: 99` (no such row; the walk ends at the missing
    row 1); row 30's `start` set to `''`; `self` 77 (no row for the command itself); row 20's `ppid` set to 10 (a
    parent loop, which ends the walk).
  - `sameSession` is true for equal markers with different pids (a resume in a new process), true for different
    markers with equal pid and start (a compaction or a subagent in one process), false when both differ, and
    false for equal pid with a different start (a reused pid).
  - `isLive({ pid: 30, start: 's30' }, table)` is true; with `start: 'old'` it is false.

Interface, `packages/cli/src/load/proc.ts` (new):
- `export interface ProcRow { pid: number; ppid: number; start: string }`.
- `processTable(): ProcRow[]`. On win32: `execFileSync('powershell', ['-NoProfile', '-NonInteractive',
  '-Command', <script>], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })`
  where the script sets `[Console]::OutputEncoding = [Text.Encoding]::UTF8`, then maps `Get-CimInstance
  Win32_Process` to objects `pid` (ProcessId), `ppid` (ParentProcessId) and `start`
  (`CreationDate.ToUniversalTime().ToString('o')`, `''` when null), piped to `ConvertTo-Json -Compress` (a single
  object, when only one comes back, is wrapped in an array). Elsewhere: `execFileSync('ps', ['-A', '-o', 'pid=',
  '-o', 'ppid=', '-o', 'lstart='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 *
  1024, env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' } })`, so every caller records the same start for one
  process whatever its locale and time zone; each non-blank line split on whitespace runs is pid, ppid, then the
  five `lstart` fields (`Sun Oct 18 10:00:00 2026`) joined by one space as `start`. A spawn failure or a line that
  does not parse throws `UsageError('cannot read the process table: ' + reason)`: a hold is never judged on a
  guess.
- `export interface Session { tool: 'Claude Code'; marker: string; pid: number; start: string }`.
- `claudeEnv(env: NodeJS.ProcessEnv): { marker: string; pid: number } | undefined`: when `CLAUDE_CODE_SESSION_ID`
  and `CLAUDE_PID` are both non-empty, `CLAUDE_PID` must match `/^[1-9][0-9]*$/` (else `UsageError('CLAUDE_PID is
  not a process id: ' + value)`) and the result is `{ marker, pid }`. When either is missing and `CLAUDECODE` is
  `'1'`, `UsageError('this Claude Code session sets no ' + <the missing names joined by ' or '> + ', so its hold
  cannot be taken - update Claude Code')`. Otherwise `undefined`: another tool (D-17).
- `sessionIn(claude: { marker: string; pid: number }, table: ProcRow[], self: number): Session`, pure; callers
  pass `process.pid` as `self`. With `rows` the table keyed by `pid` and `c` the row of `claude.pid`, the walk
  starts at `cur = self`, keeps a set of the pids it has visited, and at each step, in this order:
  1. `cur === claude.pid`: accept.
  2. `cur` has no row: when `cur === self`, refuse; otherwise accept (the gap).
  3. the row of `cur` has `pid` 1 or `ppid` 0: refuse (the root, without meeting `CLAUDE_PID`).
  4. its `ppid` is already visited: refuse (a loop). Otherwise add it, set `cur` to it, and step again.
  The visited set bounds the walk to one step per row plus one. Accept gives, when `c` exists and `c.start` is
  non-empty, `{ tool: 'Claude Code', marker: claude.marker, pid: claude.pid, start: c.start }`; without such a `c`
  it refuses. Refuse throws `UsageError('cannot see this Claude Code session (CLAUDE_PID ' + pid + ') among the
  parents of this command in the process table, so no hold can be judged - run it outside a sandbox')`.
- `sameSession(a, b)`: `a.marker === b.marker || (a.pid === b.pid && a.start === b.start)`.
- `isLive(h, table)`: a row with `h.pid` and `h.start` exists (ledger Ruling 4: never `process.kill(pid, 0)`).
- `describeSession(h)`: `Claude Code session <marker> (pid <pid>)`.

`spawn-surface.test.ts`: `ALLOWED` becomes `['git', 'gh', 'ps', 'powershell']`, and the comment above it says
`ps` and `powershell` read the process table for the hold (D-17). Must not change: every other case in that file.

## Task 2: Wiring: Pick up from the main checkout adds the ticket's worktree, runs setup, and points to a session there
covers: @ac-1, @ac-2, D-02, D-06, D-07, D-11, D-15
files: packages/core/schemas/config.schema.json, packages/core/src/model/snapshot.ts, packages/core/test/schemas.test.ts, packages/cli/src/load/fs.ts, packages/cli/src/load/proc.ts (new), packages/cli/src/commands/worktree.ts (new), packages/cli/src/run.ts, packages/cli/test/helpers/worktree.ts (new), packages/cli/test/worktree.test.ts (new), packages/cli/test/spawn-surface.test.ts, packages/cli/test/skill-commands.test.ts
verify: packages/cli/test/worktree.test.ts#ac-1-pick-up-adds-the-ticket-worktree-from-origin-main-runs-setup-in-order-and-prints-where-to-continue (@ac-1), packages/cli/test/worktree.test.ts#ac-2-a-failing-setup-command-exits-2-naming-it-and-keeps-the-worktree (@ac-2), packages/cli/test/worktree.test.ts#risk:security-a-ticket-id-cannot-place-a-worktree-outside-its-sibling-folder, packages/cli/test/worktree.test.ts#risk:complex-branching-pick-up-refuses-a-ticket-that-origin-main-lacks, packages/cli/test/spawn-surface.test.ts#risk:security-only-git-gh-ps-and-powershell-are-spawned-by-name-and-one-setup-site-uses-the-shell, packages/core/test/schemas.test.ts#risk:parsing-setup-is-a-list-of-non-empty-command-strings

From Task 1: `load/proc.ts` and the `ALLOWED` list.

Test helper first, `packages/cli/test/helpers/worktree.ts` (new), using `gitRun`, `writeFiles` and `cleanup` from
`./repo.js` and `CONFIG` and `laneTicket` from `../../../../test/helpers/lane.js`:
- `makeClone(opts: { setup?: string[]; tickets?: string[] } = {})` returns `{ root, remote, sibling(id),
  git(...args), otherClone(), cleanupAll() }`. `remote` is a fresh `mkdtemp` directory under `os.tmpdir()` holding
  `git init --bare -q -b main`. `root` is another, `git init -q -b main`, with local config `user.email
  fixture@example.invalid`, `user.name fixture`, `commit.gpgsign false`; it holds `accord/config.yml` (`CONFIG`
  plus, when `setup` is given, a `setup:` block list of the commands, each double-quoted YAML),
  `accord/tickets/<id>.md` from `laneTicket(id)` for each of `tickets` (default `['ST-9']`), `.gitignore` with
  `node_modules/`, and `setup-step.js`: `require('node:fs').appendFileSync('setup.log', process.argv[2] + '\n'); if
  (process.argv[2] === 'fail') { console.error('boom'); process.exit(1); }`. It commits all, adds `remote` as
  `origin`, pushes `main` with `-u`, and runs `git remote set-head origin main`. `root` is returned as `git
  rev-parse --show-toplevel` prints it, so it matches what the CLI prints. `git(...args)` is `gitRun(root, ...args)`.
  `sibling(id)` is the sibling path of the preamble.
- `otherClone()`: a fresh `mkdtemp` directory under `os.tmpdir()`, `git clone -q <remote> .` run in it, then the
  same three local config values as `root`; returns its path, which `cleanupAll` removes. Tasks 3 and 5 use it to
  push or merge on the remote as a teammate would.
- `cleanupAll()` removes `remote`, `root`, every `otherClone()` directory, and every directory whose name starts
  with `root`'s folder name plus `-`.

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
- `it('risk:complex-branching pick up refuses a ticket that origin main lacks')`: `makeClone()`, then
  `writeFiles(root, { 'accord/tickets/ST-30.md': laneTicket('ST-30') })`, not committed, so the checkout has the
  ticket and `origin/main` does not. `worktree open ST-30` from `root` exits 2; `err` contains `ST-30 is not on
  origin/main`; `git worktree list --porcelain` still has one entry; `git rev-parse --verify -q
  refs/heads/t/ST-30` fails; `sibling('ST-30')` does not exist; `git log --all --format=%s` holds no `claim:` line.

In `packages/core/test/schemas.test.ts`:
- `it('risk:parsing setup is a list of non-empty command strings')`: `setup: ['npm ci', 'npm run build']` and
  `setup: []` validate; `setup: 'npm ci'` gives a `schema.type` finding at `/setup`, and `setup: ['']` one at
  `/setup/0`.
- In `top-level properties are ...`, the expected key list ends `..., 'branch', 'setup']`; nothing else changes.

In `packages/cli/test/spawn-surface.test.ts`, replace the two cases `spawns only git and gh, named as a string
literal (T-05-01)` and `passes no shell option to any spawn site` with one top-level
`it('risk:security only git gh ps and powershell are spawned by name and one setup site uses the shell')` (outside
the `describe`, using `spawnSites()` itself): the sites whose first argument is not a literal in `ALLOWED` are
exactly one, in `load/proc.ts`, and its arguments contain `shell: true`; the sites whose arguments contain
`shell:` are exactly that same one. `has spawn sites to check` and the printed-paths cases stay.

`packages/cli/test/skill-commands.test.ts`: the expected `REAL` list gains `'worktree open'` in sorted place.

Interface:
- `config.schema.json`: a last property `"setup": { "type": "array", "items": { "type": "string", "minLength":
  1 } }`. `AccordConfig` gains `setup?: string[]; // D-07: commands run in order in a new worktree`.
- `load/fs.ts`: `export function gitDefaultRef(root: string): string | undefined`, the default ref of the
  preamble (`git symbolic-ref -q refs/remotes/origin/HEAD`, then `git rev-parse --verify -q` on each candidate).
  `gitPeopleOnRefs` takes its `defaultRef` from it in place of lines 447-454, keeping the rule that the ref must
  be among the refs it read.
- `load/proc.ts`: `runSetup(commands: readonly string[], cwd: string): { failed?: { command: string; code: number
  | null; tail: string } }`: for each command in order, `spawnSync(command, { cwd, shell: true, encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })`, the only shell site (approach risk 3:
  `setup` is committed repository content, trusted as `tests.affected` is); output is shown only on failure
  (ledger Ruling 6): the first failing command stops the run, with `tail` the last 20 lines of its stderr, else of
  its stdout.
- `commands/worktree.ts` (new): `worktreeOpen(ctx: CommandContext, id: string, opts: { continue?: boolean } =
  {}): number`. The id must match `/^[A-Za-z0-9][A-Za-z0-9._-]*$/` (the ticket schema's pattern, as in
  `new-ticket.ts`), else `UsageError('not a valid ticket id: ' + id)`, before any path is built. With `branch =
  branchOf(ctx.snapshot, id)`: when the branch exists (`refs/heads/<branch>` or `refs/remotes/origin/<branch>`
  resolves) or a worktree entry has it, exit 2 with `<branch> already exists` (Task 3 replaces this refusal).
  Otherwise the claim path: the ticket must be in `ctx.snapshot.tickets`, else `UsageError('no ticket ' + id + '
  in accord/tickets - nothing was created')`; the default ref must exist, else `UsageError('no origin/main in this
  clone - run git fetch origin, then try again')`; the ticket file must be on the default ref, checked with `git
  cat-file -e <default ref>:accord/tickets/<id>.md`, else `UsageError(id + ' is not on ' + <the default ref without
  its leading refs/remotes/> + ' - merge accord/tickets/' + id + '.md into the main branch, run git fetch origin,
  then try again; nothing was created')`, so the new worktree, built from that ref, always holds the ticket it
  claims; then `git worktree add --no-track -b <branch> <sibling> <default ref>`, then in the new worktree `git commit --allow-empty -m "claim: <id>"` at once (ledger Ruling 1), then
  `prepare(path)`, then the stop output. `prepare(path)` reads the worktree's own setup (preamble) and calls
  `runSetup`; a failure throws `UsageError('setup command failed in the new worktree: ' + command + ' (exit ' +
  code + ')\n' + tail + '\nthe worktree is kept; fix the command, then continue the ticket again')`, which names
  no path and no `/accord` line. Export `branchOf`, `worktrees(root)` (the parsed list), `siblingOf(mainPath,
  id)`, `prepare` and `printStop(ctx, path, id)` for Tasks 3 to 6.
- `run.ts`: `const worktree = program.command('worktree').description('work each ticket in its own git
  worktree')`, then `worktree.command('open <id>').description('find or prepare the ticket\'s worktree, or take
  its hold from inside it').action((id: string) => { setCode(worktreeOpen(preflight(opts), id)); })`.

Must not change: `gitPeopleOnRefs`'s result for every existing ids test; every other schema case; the order and
options of every existing command; the printed-paths cases in `spawn-surface.test.ts`.

## Task 3: Continue from another checkout finds the worktree that holds the branch, reaches a ticket whose file is only on its branch, and never claims
covers: @ac-3, D-08, D-15, D-18
files: packages/cli/src/commands/worktree.ts (new), packages/cli/src/run.ts, packages/cli/test/worktree.test.ts (new)
verify: packages/cli/test/worktree.test.ts#ac-3-continue-from-another-checkout-reuses-the-worktree-holding-the-branch (@ac-3), packages/cli/test/worktree.test.ts#risk:complex-branching-continue-reaches-a-ticket-whose-file-is-only-on-its-branch-here-or-on-origin, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-never-claims-a-ticket, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-prunes-a-worktree-whose-folder-was-deleted-by-hand

From Task 2: `worktreeOpen`, `branchOf`, `worktrees`, `siblingOf`, `prepare`, `printStop`; `makeClone` with
`otherClone()`; the `<branch> already exists` refusal this task replaces. D-18: after @ac-6 the ticket file
exists only on its branch, so `/accord continue <id>` typed in the main checkout must reach it through its branch
rather than become a New request; D-12: this lookup reads only the refs already in the clone and fetches nothing.

Tests first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-3 continue from another checkout reuses the worktree holding the branch')`: `makeClone({ setup: ['node
  setup-step.js ci'] })`; `git worktree add -b t/ST-9 <root>-ln9 origin/main` by hand (the folder name is not the
  sibling name). `worktree open ST-9 --continue` from `root` exits 0; `out` holds the three stop lines with the
  path `<root>-ln9`; `<root>-ln9/setup.log` does not exist; `git worktree list --porcelain` has the same two entries
  as before; `sibling('ST-9')` does not exist; `root`'s current branch is still `main`.
- `it('risk:complex-branching continue reaches a ticket whose file is only on its branch here or on origin')`, each
  part with `makeClone({ setup: ['node setup-step.js ci'], tickets: [] })`, so `root` has no ticket file:
  (a) `git worktree add -b t/ST-9 <sibling> origin/main`, then write `accord/tickets/ST-9.md` from
  `laneTicket('ST-9')` only in the sibling and commit it there: `worktree open ST-9 --continue` from `root` exits 0
  with the stop lines naming `sibling('ST-9')`, and `<root>/accord/tickets/ST-9.md` does not exist.
  (b) a branch `t/ST-9` made in `root` with one commit adding that ticket file, and no worktree: exit 0, the entry
  at `sibling('ST-9')` has `branch refs/heads/t/ST-9` and HEAD equal to that commit (no new commit), its
  `setup.log` is `ci\n`, and `out` holds the stop lines.
  (c) in `otherClone()`, a branch `t/ST-10` with that ticket's file, pushed to `origin`; in `root`, `git fetch
  origin`, so it exists here only as `refs/remotes/origin/t/ST-10`: `worktree open ST-10 --continue` exits 0, the
  new worktree's HEAD equals `origin/t/ST-10`, and `t/ST-10` tracks it.
- `it('risk:complex-branching continue never claims a ticket')`: `makeClone()` (ticket `ST-9` present, no branch):
  `worktree open ST-9 --continue` from `root` exits 2, `err` starts with `not claimed: ST-9`; `worktree open ST-77
  --continue` (no ticket, no branch) exits 2, `err` starts with `not a ticket: ST-77`. After both: the worktree list
  has one entry, no branch other than `main` exists, `git log --all --format=%s` holds no `claim:` line, and no
  sibling folder exists.
- `it('risk:complex-branching continue prunes a worktree whose folder was deleted by hand')`: `makeClone({ setup:
  ['node setup-step.js ci'] })`; `git worktree add -b t/ST-9 <sibling> origin/main`, then `rmSync(sibling('ST-9'),
  { recursive: true, force: true })`, so `git worktree list --porcelain` shows that entry with a `prunable` line;
  `reason` is the text after `prunable ` on that line, read before the run. `worktree open ST-9 --continue` from
  `root` exits 0; `out` split on `\n`, empty lines dropped, is exactly `pruned <sibling('ST-9')>: <reason>` followed
  by the three stop lines naming `sibling('ST-9')`, and no line holds `repair`; the folder exists again with `setup.log` equal to `ci\n` (case 3 below re-added it); `git worktree list
  --porcelain` has an entry at `sibling('ST-9')` with `branch refs/heads/t/ST-9` and no line starting `prunable`.

`worktrees(root, out: NodeJS.WritableStream)` (preamble): parse a line `prunable` or `prunable <reason>` into
`prunable: true` and its reason; when any entry has it, run `git worktree prune` once (it drops only the records
of missing folders; branches are untouched, and a locked worktree is never prunable) and parse the list again; for
each prunable entry absent from the second list, in the first list's order, write `pruned <path>: <reason>\n` to
`out` (`<reason>` is git's text after `prunable `, or `no reason given` when git prints none; no repair advice:
a folder moved by hand loses its git record, its files stay); return no entry that is still prunable. Every caller
(Pick up and Continue in `worktreeOpen`, Task 5's `clean`, Task 6's `newTicket --worktree`) passes `ctx.stdout`.
Every caller then never prints a missing path, never runs a command in a missing folder, and `git worktree add`
is not blocked by a stale record of the branch (git refuses to add a branch whose entry is still prunable).

Interface, in `worktreeOpen`, after the id check and before the claim path, in this order:
1. A worktree entry other than the one at `ctx.root` has `branch`: print the stop output with that entry's path and
   return 0, running nothing there (D-15).
2. The entry at `ctx.root` has `branch`: Task 4's hold. Until Task 4 lands, this case prints 1's output with
   `ctx.root`'s path.
3. `refs/heads/<branch>` resolves: `git worktree add <sibling> <branch>`, `prepare`, stop output.
4. `refs/remotes/origin/<branch>` resolves: `git worktree add --track -b <branch> <sibling> origin/<branch>`,
   `prepare`, stop output.
5. With `opts.continue`: never the claim path. When `id` is in `ctx.snapshot.tickets`, `UsageError('not claimed: '
   + id + ' has no branch ' + branch + ' here or on origin - nothing was created; pick it up first')`; otherwise
   `UsageError('not a ticket: no ticket ' + id + ' in accord/tickets and no branch ' + branch + ' here or on origin
   - nothing was created')`. The two first words are what the skill reads (Task 7, ledger Ruling 2).
6. Without `opts.continue` (Pick up): the claim path of Task 2. No claim commit in 1 to 5. None of 1 to 4 needs a
   ticket file in `ctx.root` (D-18).

`run.ts`: `open <id>` gains `.option('--continue', 'continue a claimed ticket: never claim, refuse when it has no
branch')`, and the action passes `{ continue: o.continue === true }`.

Must not change: Task 2's ac-1, ac-2 and risk:security cases (all without `--continue`); the stop output's three
lines.

## Task 4: The Claude Code session rooted in the worktree takes the hold; a live holder refuses a second session; a dead hold is taken over; other tools go on unheld
covers: @ac-4, D-03, D-14, D-15, D-17
files: packages/cli/src/load/proc.ts (new), packages/cli/src/commands/worktree.ts (new), packages/cli/test/worktree.test.ts (new)
verify: packages/cli/test/worktree.test.ts#ac-4-a-live-holder-refuses-a-second-session-and-a-dead-holder-is-taken-over (@ac-4), packages/cli/test/worktree.test.ts#risk:complex-branching-the-holding-session-re-enters-its-own-hold-and-a-partial-table-refuses, packages/cli/test/worktree.test.ts#risk:complex-branching-outside-claude-code-no-hold-is-taken-and-one-line-says-so, packages/cli/test/worktree.test.ts#risk:concurrency-a-locked-hold-file-is-never-overwritten, packages/cli/test/worktree.test.ts#risk:complex-branching-a-worktree-whose-setup-never-finished-reruns-setup-in-full

From Tasks 1 to 3: `processTable`, `claudeEnv`, `sessionIn`, `sameSession`, `isLive`, `describeSession`;
`worktreeOpen`'s case 2; `prepare`.

Mocking: at the top of `worktree.test.ts`, `vi.mock('../src/load/proc.js', ...)` keeps every real export and
replaces `processTable` with a `vi.fn` running the real one; a test sets rows with
`vi.mocked(processTable).mockReturnValue(rows)`, and `afterEach` restores the real implementation. Sessions: A `{
pid: 7001, start: 'S-A', marker: 'sess-A' }`, B `{ pid: 7002, start: 'S-B', marker: 'sess-B' }`. `envOf(S)` is `{
CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: S.marker, CLAUDE_PID: String(S.pid) }`. `tableOf(S, ...others)` is `[{
pid: process.pid, ppid: S.pid, start: 'self' }, { pid: S.pid, ppid: 1, start: S.start }]` followed by `{ pid:
O.pid, ppid: 1, start: O.start }` for each other session `O`. No row is built from a name or a command line.

Tests first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-4 a live holder refuses a second session and a dead holder is taken over')`: `makeClone()`; `worktree
  open ST-9` from `root` (exit 0). With `tableOf(A)`, `worktree open ST-9 --continue` from `sibling('ST-9')` with
  `envOf(A)` exits 0 and `out` is `held: ST-9 by this session\n`; the holds file names A with a `taken` time.
  With `tableOf(B, A)` (A still running), from the same folder with `envOf(B)`: exit 2, `err` contains `Claude
  Code`, `sess-A` and A's `taken` value, and the holds file bytes are unchanged. With `tableOf(B)` (A stopped
  without releasing): exit 0, `held: ST-9 by this session`, and the holds file now names B.
- `it('risk:complex-branching the holding session re-enters its own hold and a partial table refuses')`: after A
  takes the hold, each of these exits 0 with the held line and leaves A's `taken` unchanged: `envOf(A)` with
  `tableOf(A)` again (the command that took the hold has exited; the session has not); `{ ...A, marker: 'sess-A2'
  }` with `tableOf(A)` (a new marker in the same claude process); `{ pid: 7003, start: 'S-C', marker: 'sess-A' }`
  with `tableOf` of it and A (one marker, a new process). Then, with B holding (taken over as in ac-4), `envOf(A)`
  with a table of only `{ pid: process.pid, ppid: 1, start: 'self' }` (neither A nor B visible): exit 2, `err`
  contains `cannot see this Claude Code session`, and the holds file still names B, byte for byte.
- `it('risk:complex-branching outside claude code no hold is taken and one line says so')`: after the claim from
  `root`, `vi.mocked(processTable).mockClear()`; with env `{}` from the sibling: exit 0, `out` is the no-hold line of the preamble for `ST-9` followed by `\n`, no holds file exists, and
  `processTable` was not called. With env `{ CLAUDECODE: '1' }`: exit 2, `err` contains `CLAUDE_CODE_SESSION_ID`,
  no holds file exists.
- `it('risk:concurrency a locked hold file is never overwritten')`: create `accord/holds.lock` in the common git
  dir; `worktree open ST-9 --continue` from the sibling with A exits 2 within 5 s, `err` names `holds.lock`, and no
  holds file exists. Remove the lock: the same command exits 0.
- `it('risk:complex-branching a worktree whose setup never finished reruns setup in full')`: `makeClone({ setup:
  ['node setup-step.js ci', 'node setup-step.js build'] })`; `git worktree add -b t/ST-9 <sibling> origin/main` by
  hand. From the sibling with A: exit 0 and `setup.log` is `ci\nbuild\n`; again: `setup.log` is unchanged. In a
  second `makeClone` with setup `['node setup-step.js ci', 'node setup-step.js fail']`, `worktree open ST-9` from
  `root` exits 2; the setup marker is absent; with `setup.log` removed, `worktree open ST-9 --continue` from the
  sibling with A exits 2 again and `setup.log` is `ci\nfail\n` (rerun in full, not from the failed command).

Interface, `worktree.ts` case 2 (the entry at `ctx.root` has the ticket's branch):
1. `claude = claudeEnv(ctx.env)` (its `UsageError` propagates). When `undefined` (D-17): no table is read, no holds
   file is touched; when the setup marker is missing, `prepare(ctx.root)`; then print the no-hold line; return 0.
2. `session = sessionIn(claude, processTable(), process.pid)`; its `UsageError` propagates before the holds file
   is read, so a partial table never judges a holder (finding 1.7).
3. Under the lock, read the holds file (absent is `{}`; a file that is not a JSON object throws a `UsageError`
   naming it and is never rewritten). When the entry for `id` exists, is not `sameSession` with `session` and
   `isLive` on the same table, throw `UsageError(id + ' is held by another session: ' + describeSession(h) + '
   since ' + h.taken + ' - work it there, or close that session first')`. Otherwise write the entry `{ ...session,
   taken }`, keeping the old `taken` when it is the same session, else `new Date().toISOString()`.
4. When the setup marker is missing, `prepare(ctx.root)`; then print the held line.
- The lock: `openSync(lock, 'wx')`, creating the `accord` folder first; on `EEXIST` wait 50 ms (`Atomics.wait` on
  a `SharedArrayBuffer`) and retry for 2 s, then `UsageError('the hold file is locked by another accord command: '
  + lock + ' - if none is running, delete that file')`. The write goes to `holds.<pid>.tmp` and is renamed over
  `holds`; the lock is removed in a `finally` around the read and the write only. Export `withHolds(root, fn)`
  (lock, read, `fn` returns the new object or `undefined` for no write, write) for Task 5.
- `prepare` writes the setup marker after every command succeeded, so Task 2's and Task 3's added worktrees carry
  it and a session there runs no setup again.

Must not change: the outside cases 1, 3, 4, 5, 6 of Task 3; the ac-1 to ac-3 cases.

## Task 5: `accord worktree clean` fetches, removes the worktrees of merged tickets, and names what it keeps
covers: @ac-5, D-01, D-05, D-11, D-12, D-16
files: packages/cli/src/commands/worktree.ts (new), packages/cli/src/run.ts, packages/cli/test/worktree.test.ts (new), packages/cli/test/skill-commands.test.ts
verify: packages/cli/test/worktree.test.ts#ac-5-bare-accord-fetches-then-removes-merged-worktrees-and-names-what-it-keeps (@ac-5), packages/cli/test/worktree.test.ts#risk:complex-branching-a-failed-fetch-is-said-and-the-refs-in-the-clone-are-judged, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-unpushed-commits-and-new-files-that-git-status-config-would-hide, packages/cli/test/worktree.test.ts#risk:complex-branching-a-worktree-remove-that-fails-is-named-truthfully, packages/cli/test/worktree.test.ts#risk:complex-branching-clean-prunes-a-worktree-whose-folder-was-deleted-by-hand

From Tasks 2 to 4: `worktrees`, `gitDefaultRef`, `withHolds`, `claudeEnv`, `sessionIn`, `isLive`, `sameSession`,
the mocked `processTable`, `makeClone` with `otherClone()`. `ticketOfBranch` is in `load/fs.ts`.

Tests first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-5 bare accord fetches then removes merged worktrees and names what it keeps')`: `makeClone({ tickets:
  ['ST-9', 'ST-10', 'ST-11', 'ST-12'] })`; for each id add `git worktree add -b t/<id> <sibling> origin/main`,
  commit one file in it, and push the branch. In `otherClone()`, after `git fetch origin`, merge `origin/t/ST-9`,
  `origin/t/ST-10` and `origin/t/ST-12` into `main` with `--no-ff` and push; `root` does not fetch. Then:
  `<sibling ST-9>/node_modules/x` (ignored), `<sibling ST-10>/new.txt` (not added), a holds entry for `ST-12`
  `{ tool: 'Claude Code', marker: 'sess-H', pid: 4242, start: 'S2', taken: '2026-10-18T00:00:00.000Z' }` with the
  table `[{ pid: process.pid, ppid: 1, start: 'self' }, { pid: 4242, ppid: 1, start: 'S2' }]`. `worktree clean`
  from `root` with env `{}` exits 0. `origin/main` in `root` now equals the remote's `main`; `sibling('ST-9')` no
  longer exists; `out`'s non-empty lines, sorted, equal, sorted, `removed <sibling ST-9>`, `kept <sibling ST-10>:
  uncommitted work`, `kept <sibling ST-12>: held by another session` (git lists worktrees by path, so the command
  prints them in that order and the test does not depend on it); `<sibling ST-10>/new.txt` and `sibling('ST-11')`
  still exist; no line names `sibling('ST-11')`; the holds file has no `ST-9` entry.
- `it('risk:complex-branching a failed fetch is said and the refs in the clone are judged')`: a worktree `t/ST-9`
  added at `origin/main` with no commit of its own; `git remote set-url origin <a path that does not exist>`;
  `worktree clean` exits 0, its first line starts `fetch from origin failed, judging against the refs already in
  this clone`, and the next is `removed <sibling ST-9>`. With no `origin` remote at all, or with no worktree other
  than the main one, `out` is empty (no fetch is tried).
- `it('risk:data-loss clean keeps unpushed commits and new files that git status config would hide')`: (a) `t/ST-9`
  pushed and merged on the remote as in ac-5, then one more commit in its worktree that is not pushed: `worktree
  clean` keeps the folder and prints nothing about it. (b) `git config status.showUntrackedFiles no` in `root`, a
  merged `t/ST-10` worktree holding `new.txt` not added: `kept <sibling ST-10>: uncommitted work` and `new.txt`
  still exists. (c) Run from inside a merged clean worktree, that worktree is kept and named `kept <path>: this
  session's worktree`.
- `it('risk:complex-branching a worktree remove that fails is named truthfully')`: (a) a merged clean `t/ST-9`
  worktree with a holds entry for a dead holder, locked with `git worktree lock <sibling>`: the line is `kept
  <sibling ST-9>: git worktree remove failed: ` followed by git's first stderr line, the worktree is still listed,
  and its holds entry is kept. (b) Only when `process.platform !== 'win32'` and `process.getuid?.() !== 0` (the
  case Windows reaches with a locked file, made portable): a merged `t/ST-9` whose branch commit adds
  `sub/f.txt`, with a holds entry for a dead holder, and `chmodSync(<sibling>/sub, 0o555)`: git deletes what it can,
  fails on `sub/f.txt` and unregisters the worktree; the line is `removed <sibling ST-9> in part: git worktree remove
  failed: <git's first stderr line> - delete what is left of the folder by hand`, the worktree is no longer listed,
  and the holds entry for `ST-9` is gone. The test restores `0o755` in a `finally` before `cleanupAll`.
- `it('risk:complex-branching clean prunes a worktree whose folder was deleted by hand')`: `makeClone({ tickets:
  ['ST-9', 'ST-10'] })`; `git worktree add -b t/<id> <sibling> origin/main` for both, with no commit of their own,
  so both are merged; then `rmSync(sibling('ST-9'), { recursive: true, force: true })`. `worktree clean` from
  `root` with env `{}` exits 0 and its non-empty lines are exactly, in this order, `pruned <sibling ST-9>:
  <reason>` (`reason` the text after `prunable ` on that entry's line of `git worktree list --porcelain`, read
  before the run) and `removed <sibling ST-10>`; no line holds `repair`; `git worktree list --porcelain` has only the main entry and no line starting `prunable`;
  `git rev-parse --verify -q refs/heads/t/ST-9` still succeeds (D-01: branches are ST-LN-20's).

Interface: `worktreeClean(ctx: CommandContext): number`, always 0 unless git cannot run:
1. The entries of `worktrees(ctx.root, ctx.stdout)` (which has already pruned, printed one `pruned` line per pruned
   entry, and dropped every `prunable` entry, Task 3) after
   the first (the main worktree is never removed) whose `branch` gives
   an id through `ticketOfBranch(branch, ctx.snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE], (id) =>
   Object.hasOwn(ctx.snapshot.tickets, id))` are the candidates, whatever the folder is called (D-16), in the
   list's order. None, or no `origin` remote (`git remote get-url origin` fails): print nothing, return 0.
2. Fetch (D-11, ledger Ruling 3): `git -c credential.interactive=never -c "core.sshCommand=ssh -o BatchMode=yes"
   fetch origin` with `env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }`. On failure print `fetch from origin
   failed, judging against the refs already in this clone: <first line of git's stderr>`.
3. `ref = gitDefaultRef(ctx.root)`; none: return 0. A candidate is merged when `git merge-base --is-ancestor
   <entry.head> <ref>` exits 0: its checked-out commit, never `origin/t/<id>` (D-16), against the fetched
   remote-tracking ref, never the local `main` (D-12). An unmerged candidate is kept and not named (ledger Ruling
   5).
4. A merged one, first reason that applies:
   - its path is `ctx.root`: `kept <path>: this session's worktree`;
   - `git status --porcelain --untracked-files=normal --ignore-submodules=none` there prints anything (modified or
     new files whatever `status.showUntrackedFiles` says; ignored files do not count, D-15): `kept <path>:
     uncommitted work`;
   - its holds entry exists and its holder cannot be judged: `processTable()` throws, or `claudeEnv(ctx.env)` is
     defined and `sessionIn(claude, table, process.pid)` throws (a partial table, finding 1.7): `kept <path>: cannot tell whether the session
     holding it still runs`;
   - its holds entry `isLive` and is not `sameSession` with this command's own session (`sessionIn(...)` when
     `claudeEnv(ctx.env)` is defined, else none): `kept <path>: held by another session`;
   - otherwise `git worktree remove <path>` (never `--force`). Success: `removed <path>`. Failure: list the
     worktrees again; when the path is no longer an entry, `removed <path> in part: git worktree remove failed:
     <first line of git's stderr> - delete what is left of the folder by hand`; when it still is, `kept <path>:
     git worktree remove failed: <first line of git's stderr>` (approach risk 7). After `removed` either way, its
     holds entry is dropped through `withHolds`.
   `processTable` runs at most once, and only when a merged candidate has a holds entry.
- `run.ts`: `worktree.command('clean').description('fetch, then remove the worktrees of merged tickets and name
  the ones kept').action(() => { setCode(worktreeClean(preflight(opts))); })`. The panel keeps calling only
  `dashboard` (D-12). `skill-commands.test.ts`: `REAL` gains `'worktree clean'`.

D-01: no `git branch -d` and no `--prune`; branches and remote-tracking refs are ST-LN-20's.

Must not change: `worktree open` and every case of Tasks 2 to 4.

## Task 6: A new lane M request writes, commits and pushes its ticket in its own worktree
covers: @ac-6, D-13, D-15
files: packages/cli/src/commands/new-ticket.ts, packages/cli/src/commands/worktree.ts (new), packages/cli/src/run.ts, packages/cli/test/worktree.test.ts (new)
verify: packages/cli/test/worktree.test.ts#ac-6-a-new-lane-m-ticket-gets-its-own-worktree-with-the-ticket-committed-and-pushed (@ac-6), packages/cli/test/worktree.test.ts#risk:data-loss-a-failed-push-keeps-the-claim-commit-and-names-the-quoted-push-to-run

From Tasks 2 to 4: `branchOf`, `siblingOf`, `worktrees`, `gitDefaultRef`, `prepare` (writing the setup marker),
`printStop`; `worktree open --continue` (Task 3).

Tests first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-6 a new lane m ticket gets its own worktree with the ticket committed and pushed')`: `makeClone({ setup:
  ['node setup-step.js ci'], tickets: [] })`, `root` on `main`. `run(['new', 'ticket', 'ST-9', '--lane', 'M',
  '--worktree'], root)` exits 0. The worktree list has `branch refs/heads/t/ST-9` at `sibling('ST-9')`; its
  `setup.log` is `ci\n`; `git --git-dir <remote> rev-parse refs/heads/t/ST-9` equals the sibling's HEAD; `git show
  t/ST-9:accord/tickets/ST-9.md` equals the text `new ticket ST-9 --lane M` writes in a second `makeClone({
  tickets: [] })` without `--worktree`; `git rev-parse t/ST-9^` equals `origin/main` before the run; `out` starts
  with `accord/tickets/ST-9.md` and then holds the three stop lines with `sibling('ST-9')`; `root` is on `main` and
  `<root>/accord/tickets/ST-9.md` does not exist.
- `it('risk:data-loss a failed push keeps the claim commit and names the quoted push to run')`: as above with
  `origin`'s push URL set to a missing path (`git remote set-url --push origin <missing>`): exit 2; `err` contains
  `git -C "` + `sibling('ST-9')` + `" push -u origin t/ST-9`; the sibling exists with the ticket committed;
  `setup.log` does not exist (setup runs after the push); neither `out` nor `err` holds the `stop:` line. Then the
  recovery the skill follows (Task 7): `git remote set-url --push origin <remote>`, the push named in `err` run with
  `git -C <sibling> push -u origin t/ST-9`, and `worktree open ST-9 --continue` from `root` exits 0 with `out`
  holding the three stop lines naming `sibling('ST-9')` (Task 3's case 1, which needs no ticket file in `root`).

Interface:
- `newTicket` options gain `worktree?: boolean`. Everything up to the id check and the `existsSync` refusal on
  `ctx.root` is unchanged. With `worktree`: refuse with `<branch> already exists - nothing was written` when the
  branch exists locally, on `origin`, or in a worktree entry; the default ref must exist (same message as Task 2);
  `git worktree add --no-track -b <branch> <sibling> <default ref>` (no fetch, D-15); write the ticket text to
  `<sibling>/accord/tickets/<id>.md`; there `git add -- accord/tickets/<id>.md` and `git commit -m "claim: <id>"`;
  push with `git -c credential.interactive=never -c "core.sshCommand=ssh -o BatchMode=yes" push -u origin
  <branch>` and `GIT_TERMINAL_PROMPT=0`, a failure throwing `UsageError('the ticket is committed in ' + sibling +
  ' but the push failed: ' + <first stderr line> + ' - push it with git -C "' + sibling + '" push -u origin ' +
  branch)`, the path double-quoted so a folder with a space still works; then `prepare(sibling)`; then print
  `accord/tickets/<id>.md` and the stop output. Nothing is written under `ctx.root`.
- `run.ts`, on `new ticket`: `.option('--worktree', 'write the ticket in its own new worktree on its claim branch,
  commit and push it, then run setup there')`, passed through in `options`.

Must not change: `new ticket` without `--worktree` (every `new-ticket.test.ts` and `lane-commands.test.ts` case,
the printed path, the refusals and their order); the id assignment under `people`, which still reads the main
checkout's `accord/config.yml`.

## Task 7: The /accord skill works each ticket in its own worktree and cleans only from the bare dashboard
covers: D-02, D-04, D-08, D-09, D-11, D-12, D-13, D-17, D-18
files: packages/core/skills/accord/SKILL.md, packages/core/skills/accord/worktree.md (new), packages/core/skills/accord/ids.md, packages/core/src/generated/skills.ts, packages/core/test/stage-skills.test.ts, .claude/skills/accord/SKILL.md, .claude/skills/accord/worktree.md (new), .claude/skills/accord/ids.md
verify: packages/core/test/stage-skills.test.ts#risk:regression-the-accord-skill-opens-each-ticket-in-its-own-worktree-and-cleans-only-from-the-bare-dashboard

The real bug this guards: Continue ran `git switch` in the one checkout, moving the branch under another session
(ticket `## Intent`). D-04 and D-09: this task adds no file-overlap warning and no other ticket's stage.

Test first, in `packages/core/test/stage-skills.test.ts`:
- `it('risk:regression the accord skill opens each ticket in its own worktree and cleans only from the bare
  dashboard')`: `text` is the rendered `.claude/skills/accord/SKILL.md` from `files` with whitespace runs
  collapsed; `ref` is the rendered `.claude/skills/accord/worktree.md`, non-empty, collapsed the same way; `ids` is
  the rendered `.claude/skills/accord/ids.md`, collapsed the same way. The Dashboard slice (`## Dashboard` to `## A
  ticket named`) has `` `accord worktree clean` `` before `` `accord dashboard` `` and contains `both outputs`. The
  named slice (`## A ticket named` to `## Continue`) contains `` `accord worktree open <id> --continue` finds ``.
  The Continue slice (`## Continue` to `## Pick up`) contains `` `accord worktree open <id> --continue` `` and
  `./worktree.md`; the Pick up slice (`## Pick up` to `## New request`) contains `` `accord worktree open <id>` ``
  and `./worktree.md`; the M slice (`- **M.**` to `- **L and P.**`) contains `--lane M --worktree` twice and
  `./worktree.md`. No slice but the Dashboard's contains `worktree clean`, and `text` contains no `git switch`.
  `ref` contains `` `pruned <path>: <reason>` ``, `` `stop:` ``, `` `held: <id> by this session` ``, `` `not held:` ``, `` `not a ticket:` ``, ``
  `not claimed:` ``, `Never change directory into the worktree`, `except the people entry below`, `editing
  nothing`, `runs every setup command again`, `the longest timeout`, `` `git push -u origin <branch>` ``, `even
  when a setup command failed`, `git -C "<path>" push -u origin <branch>`, `and only that entry`, ``only from
  `/accord` with no argument`` and ``once it succeeds, run `accord worktree open <id> --continue` ``, and contains
  neither `git restore` nor `git checkout`. The `ids` slice `## Assigning` to `## When your email` contains
  `` adding `--worktree` when the lane is M ``.

Text, in `packages/core/skills/accord/SKILL.md`; every code span stays on one line, and each phrase in
`REQUIRED.accord` and in the cases `ac-4 the accord skill picks up...` and `ac-5 the accord skill takes the claim
branch...` stays on one line.

The size budget sets this wording (finding 2.4). `skills.test.ts:188` and `:255-259` hold every rendered SKILL.md
to 5120 bytes. Measured at the baseline: the source `packages/core/skills/accord/SKILL.md` is 4,864 bytes and the
rendered `.claude/skills/accord/SKILL.md` 4,902 bytes, so 218 bytes are free. Rendering strips `kind` and `loads`
from the frontmatter, so the `loads:` change costs nothing rendered. Counted by hand, the passages below add about
210 bytes and the deletion in the second bullet saves 97, about 110 net, leaving about 100 free: every detail that
is not routing lives in `worktree.md`, never in SKILL.md. Use the wording exactly, wrapped at the file's width with
the file's indentation:
- frontmatter `loads:` becomes `[accord/ids.md, accord/worktree.md, shared/ask.md]`.
- The paragraph `` `/accord` is the entry point. It routes to the stage skills, so nobody has to remember their
  names. `` and the blank line after it are deleted (97 bytes; the frontmatter `description` says the same, and no
  test names it).
- Dashboard step 1 becomes ``1. Run `accord worktree clean`, then `accord dashboard`. It reads you from `git config
  user.email` and prints every section ranked and capped, one count line, and the actions that apply. When it
  exits 2, show its message and stop.``, and in step 2 only `Show its output verbatim` becomes `Show both outputs
  verbatim`.
- In the `## A ticket named` paragraph only ``ticket id, the id of a ticket in `accord/tickets/`; with no such
  ticket,`` changes, to ``ticket id, the id of a ticket in `accord/tickets/`, or for Continue of a ticket `accord
  worktree open <id> --continue` finds; with no such ticket,``. Every other word of the paragraph stays.
- Continue step 1 becomes ``1. Run `accord worktree open <id> --continue` unless it just ran; follow
  `./worktree.md`. The active ticket is its `branch` from `accord status --json`, read from git, never from
  memory.``
- The Pick up paragraph becomes ``Run `accord worktree open <id>`: it makes its `branch` from `accord status
  --json` and commits `claim: <id>` on it. Then push it (the pushed branch is the claim) and follow
  `./worktree.md`.`` with `push it (the pushed branch is the claim)` on one line.
- In the M bullet, both commands gain ` --worktree` after `--lane M`, and the text after `with no id instead.`
  becomes ``It writes the ticket on its `branch` from `accord status --json`, commits it and pushes it; follow
  `./worktree.md`, and push it as that file says when the push fails.``

No other passage of SKILL.md is cut, shortened or moved. If `every SKILL.md is at most MAX_SKILL_BYTES bytes`
still fails, report BLOCKED with the rendered byte count; never cut another section.

`packages/core/skills/accord/ids.md`, line 14 only, becomes ``Then run `accord new ticket --type <story|bug> --lane
<lane>` with no id, adding `--worktree` when the lane is M, and use the id it prints.``, still one line in the file
(finding 2.3, @ac-6). The
`## Dropping instead of renaming` steps stay as they are: a replacement ticket is made inside the dropped ticket's
own session.

`packages/core/skills/accord/worktree.md` (new), frontmatter `kind: reference`, then:
```
# Working a ticket in its own worktree

Only a session rooted in a ticket's worktree works that ticket, so no session ever switches tickets.

For Continue, `accord worktree open <id> --continue` also finds a ticket whose file is only on its claim
branch, here or on `origin`. When it exits 2 with a line starting `not a ticket:`, the text is a New
request. A line starting `not claimed:` means nobody has claimed the ticket: say so, offer Pick up, and
never claim it.

After Pick up's `accord worktree open <id>`, push the claim with `git push -u origin <branch>` before
anything else, even when a setup command failed.

What `accord worktree open <id>` and `accord new ticket --worktree` print:

- A line `pruned <path>: <reason>`: git dropped its record of a worktree whose folder is gone; show the
  line verbatim and go on with the other lines.
- A line `stop:`: show the two lines after it verbatim, the worktree's path and the line to type in a
  session opened in that folder, then stop. Never change directory into the worktree, never edit a file
  there except the people entry below, and never start the next stage from this session.
- `held: <id> by this session`: this session holds the ticket; go on with the next step.
- `not held:`: this tool does not refuse a second session yet; say so in one line and go on with the
  next step.
- Exit 2 naming the session that holds the ticket: show the message and stop, editing nothing.
- Exit 2 naming a setup command: show the message and stop. The worktree is kept; once the owner fixes
  the command, `/accord continue <id>` in a session opened there runs every setup command again.
- Any other exit 2: show the message and stop.

Setup commands can take minutes: run these commands with the longest timeout your tool allows.

When `./ids.md` had you add an entry under `people` before `accord new ticket --worktree`, carry it to the
worktree before you stop: add the same entry to `<path>/accord/config.yml`, run
`git -C "<path>" commit -m "people: <email>" -- accord/config.yml` and
`git -C "<path>" push -u origin <branch>`, then remove that entry, and only that entry, from
`accord/config.yml` here, leaving every other line of the file as it is.

When `accord new ticket --worktree` says the push failed, it prints no `stop:` line: carry any people
entry as above, run the push it names, and once it succeeds, run `accord worktree open <id> --continue`
and follow the `stop:` line it prints. When that push fails again, show git's message and stop.

`accord worktree clean` runs only from `/accord` with no argument, never from Pick up or Continue. At the
dashboard its lines are shown verbatim with the dashboard's.
```

Then `npm run gen`, `npm run build`, and from the repository root `node packages/cli/dist/cli.js skills sync`,
which rewrites `.claude/skills/accord/SKILL.md` and `.claude/skills/accord/ids.md` and writes
`.claude/skills/accord/worktree.md`; commit all three. Then run `npx vitest run packages/core/test/skills.test.ts`
for the size and line limits (120 lines; the passages above add about two net).

Must not change: every phrase `ac-4 the accord skill picks up...` checks in the `## A ticket named` section,
Continue steps 2 to 4, the S, L and P bullets and `## Rules`; every existing case in `stage-skills.test.ts`,
`skills.test.ts` (first command `dashboard`, drift, references) and `packages/cli/test/skill-commands.test.ts`; the
skill copies `skills sync` reports `unchanged`.

## Task 8: This repository declares its setup, and the README states what worktrees do and their limits
covers: D-07, D-10, D-14, D-15, D-17
files: accord/config.yml, README.md, packages/cli/README.md, packages/cli/test/worktree.test.ts (new)
verify: packages/cli/test/worktree.test.ts#risk:regression-this-repository-setup-builds-before-it-relinks-the-accord-bin

The real bug (D-10, the ticket's ST-LN-21 finding): `npm ci` before `npm run build` left no `accord` bin linked in
a worktree, so the hooks and the panel failed until `npm rebuild @accord-dev/accord --ignore-scripts` ran.

Test first, in `packages/cli/test/worktree.test.ts`:
- `it('risk:regression this repository setup builds before it relinks the accord bin')`: `loadConfig` from
  `@accord-dev/accord-core`, given the path `accord/config.yml` and the text of the file at `new
  URL('../../../accord/config.yml', import.meta.url)`, gives no findings and a `setup` equal to `['npm ci', 'npm
  run build', 'npm rebuild @accord-dev/accord --ignore-scripts']`.

Text:
- `accord/config.yml`: after `legacy_ids`, a comment `# Run in order in each new ticket worktree (ST-LN-7 D-07):
  the build links the workspace bin the hooks call.` and the block list `setup:` with the three commands. No other
  line changes.
- `README.md`, under `## What it is`: the CLI bullet gains `` `worktree open|clean` `` after `` `skills sync` ``.
  A new bullet after the Lanes bullet: ``- One worktree per ticket. Pick up, Continue and a new lane M ticket each
  work in the ticket's own git worktree, the sibling folder `<repository folder>-<id in lower case>`, prepared by
  the `setup` commands `config.yml` lists, run in order through the shell (they are repository content, trusted
  as `tests.affected` is). `accord worktree open` prints the folder and the line `/accord continue <id>` to type
  in a session opened there. In Claude Code the session rooted there holds the ticket until it ends, and a second
  session is refused. In Cursor, Copilot and Codex the worktree is made, prepared, reused and removed the same
  way, but a second session is not refused yet. `/accord` with no argument fetches, then removes with `git
  worktree remove` each worktree whose checked-out commit is on the remote main branch, keeping one with
  uncommitted work or held by another session; files ignored by `.gitignore`, such as `node_modules`, are removed
  with it.``
- Then `npm run gen`, which regenerates `packages/cli/README.md`.

Must not change: every other key of `accord/config.yml` (the pin, `tests`, `people`, `legacy_ids`); the README's
other bullets and its pinned run line; `readme.test.ts` stays green.

## Task 9: Pick up refuses a ticket another person claimed and reuses a claim of the user's own
covers: D-08, D-18
files: packages/cli/src/commands/worktree.ts (new), packages/cli/test/worktree.test.ts (new), packages/core/skills/accord/worktree.md (new), packages/core/src/generated/skills.ts, .claude/skills/accord/worktree.md (new)
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-pick-up-refuses-a-branch-another-person-claimed-and-reuses-one-claimed-by-the-same-email

The gap (final review 2, ledger Ruling of 2026-10-18, owner: "Từ chối nếu người khác claim (Khuyên)"): Task 3's
cases 1 to 4 run for Pick up as well as for Continue, so when a teammate has pushed `t/<id>` with `claim: <id>`
and the user has fetched, `accord worktree open <id>` (no `--continue`) adds a worktree on the teammate's branch,
exits 0, and the skill's push is a no-op: two people work one ticket. After this task, Pick up reuses an existing
branch only when its claim is the user's own (a claim made from another machine, with the same email), and
otherwise exits 2 having created nothing. Continue (`--continue`) is unchanged: D-18 lets it reach any claimed
branch, which is how one who really means to work on it together does so.

From Tasks 2 and 3: `worktreeOpen`, `branchOf`, `worktrees`, `git`, `gitOk`, `printStop`; `makeClone` with
`otherClone()`. From `load/fs.ts`: `gitUserEmail(root)` (the reader `accord dashboard` uses,
`packages/cli/src/commands/dashboard.ts:8`). From the snapshot: `ctx.snapshot.claims`, ticket id to the author
email of the tip of its claim branch (`gitClaims`, `packages/cli/src/load/fs.ts:125-170`), the claimant the
dashboard credits.

Test first, in `packages/cli/test/worktree.test.ts`, a top-level
`it('risk:complex-branching pick up refuses a branch another person claimed and reuses one claimed by the same email')`:
- `c = makeClone({ tickets: ['ST-9', 'ST-10', 'ST-11'] })`; `o = c.otherClone()`, then in `o` `git config
  user.email y@example.invalid` (the teammate). In `o`, each from `main`:
  - `git switch -q -c t/ST-9 main`, `git commit -q --allow-empty -m "claim: ST-9"`;
  - `git switch -q -c t/ST-10 main`, `git -c user.email=fixture@example.invalid commit -q --allow-empty -m
    "claim: ST-10"` (the user's own claim from another machine), then `git commit -q --allow-empty -m help` by
    `y` on top, so the tip's author is not the claimant;
  - `git switch -q -c t/ST-11 main`, one commit adding `x.txt` with the subject `work` (no claim commit);
  - `git push -q origin t/ST-9 t/ST-10 t/ST-11`. In `root`, `git fetch -q origin`.
- `worktree open ST-9` from `root`: exit 2; `err` starts with `claimed: ST-9 by y@example.invalid` and contains
  `/accord continue ST-9`; `out` holds no `stop:` line; `git worktree list --porcelain` has one entry; `git
  rev-parse --verify -q refs/heads/t/ST-9` fails; `sibling('ST-9')` does not exist.
- `worktree open ST-11` from `root`: exit 2; `err` starts with `claimed: ST-11 by y@example.invalid` (no claim
  commit, so the tip's author, as the dashboard credits it).
- `worktree open ST-10` from `root`: exit 0; `out` split on `\n` holds the three stop lines naming
  `sibling('ST-10')`; `git -C <sibling('ST-10')> rev-parse HEAD` equals `git rev-parse origin/t/ST-10`; `git log
  --all --format=%s` in `root` holds exactly one line `claim: ST-10` (no second claim commit).
- `worktree open ST-9 --continue` from `root`: exit 0 with the three stop lines naming `sibling('ST-9')`
  (Continue unchanged). Then `worktree open ST-9` again: exit 2, `err` starts with `claimed: ST-9 by
  y@example.invalid` (a worktree of the branch in this clone does not change who claimed it), and the worktree
  list still has the same two entries.

Interface, in `worktreeOpen` (`packages/cli/src/commands/worktree.ts`), after `list` is read and before case 1:
compute `local` and `remote` there (the two `rev-parse --verify -q` checks case 3 and 4 already make; reuse them
for those cases). When `opts.continue !== true` and the branch exists (`held !== undefined`, `local` or `remote`;
a worktree entry with the branch implies `local`), run `claimantOf(ctx, id, local ? 'refs/heads/' + branch :
'refs/remotes/origin/' + branch)`:
- The claimant is the author email (`%ae`) of the newest commit reachable from that ref whose subject is exactly
  `claim: <id>`, read with one `git log --format=%ae%x00%s <ref>` (first line, newest first, whose subject after the
  `\0` equals `'claim: ' + id`). When no such commit exists, it is `ctx.snapshot.claims[id]` when `claims` is
  defined and `Object.hasOwn(ctx.snapshot.claims, id)`; otherwise there is no claimant and Pick up goes on as today.
- `me = gitUserEmail(ctx.root)`; when it is `''`, throw `UsageError('git user.email is not set - set it with git
  config user.email <you@example.com>')` (the dashboard's message), so a claim is never judged against nobody.
- When the claimant and `me` differ after trimming and lower-casing both, throw `UsageError('claimed: ' + id + '
  by ' + claimant + ' - nothing was created; to work on it with them, type /accord continue ' + id)` before any
  `git worktree add`, `prepare` or output. The first word `claimed:` is what the skill reads, apart from `not a
  ticket:` and `not claimed:`.
- Otherwise cases 1 to 4 run exactly as before.

Skill text, `packages/core/skills/accord/worktree.md`: the paragraph `After Pick up's ...` becomes, wrapped at the
file's width:
```
After Pick up's `accord worktree open <id>`, push the claim with `git push -u origin <branch>` before
anything else, even when a setup command failed. When it exits 2 with a line starting `claimed:`,
another person holds the claim: push nothing, show the message and stop. Offer `/accord continue <id>`
only when the owner means to work on the ticket with them.
```
SKILL.md is not changed (its 5,120-byte limit; its Pick up paragraph already says to follow `./worktree.md`).
Then `npm run gen`, `npm run build`, and from the repository root `node packages/cli/dist/cli.js skills sync`,
which rewrites `.claude/skills/accord/worktree.md`; commit it with `packages/core/src/generated/skills.ts`. Then
run `npx vitest run packages/core/test/stage-skills.test.ts packages/core/test/skills.test.ts`.

Must not change: Continue (`--continue`) in every case; the claim path when no branch exists (Task 2's ac-1, ac-2
and risk cases, Task 4's cases that pick up first, the bad-config case); the stop output's three lines; every
phrase `risk:regression the accord skill opens each ticket in its own worktree...` checks in `worktree.md`
(`` `git push -u origin <branch>` `` and `even when a setup command failed` stay); the skill copies `skills sync`
reports `unchanged` besides `worktree.md`.
