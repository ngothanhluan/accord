---
baseline: 995a87c98600c6c9d286aaf16158dcbb6b409928
plan_hash: "fnv1a64:9f27db2b70578893"
---

Review mode `outcome`: one branch, no slices. Each task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: Task 1 is the wiring. The session-start hook runs `accord worktree clean` in the foreground after its usual
output, and ac-2 proves it end to end with a merged ticket, a dead hold and a live hold. The hook clean never prunes the
record of a worktree whose folder is missing. Task 2 adds the `disposable:` key to config.yml. Task 3 makes clean check
ignored files before `git worktree remove`, and print `removed` only once the folder is gone (ac-1). Task 4 records each
worktree accord creates and deletes a recorded folder git has forgotten (ac-3). Task 5 adds the hold guard for any live
hold and the detached-HEAD rule (critique fixes 1 and 2). Task 6 adds the walk guards, with a nested repository in a
disposable folder and an edit hidden by a skip-worktree or assume-unchanged flag kept before `git worktree remove`. Task 5 also
stops a bare clean from pruning while a missing folder holds a detached HEAD on no branch, and lets `worktree open` re-create a
ticket's own worktree whose folder is missing with `git worktree add --force` meanwhile. Task 7 adds the sibling sweep for leftovers that were never recorded (D-01 part C). Task 8
adds the clean lock and the hook's time budget (fix 5). Task 9 updates the skill text and re-renders the copies and the
hooks in `.claude/settings.json`.

Rules for every task:
- Test ids: every test this plan writes is a top-level `it(...)` with no `describe` around it. Its report id is the
  test file's path from the repository root, then `#`, then the `it` title with each run of whitespace turned into
  `-`. No test title holds `@`, a comma or an apostrophe. No existing test is renamed.
- Every test that builds a clone passes `120_000` as the third argument of `it`, except the ac-2 test, which builds
  three clones and passes `300_000`.
- A test commits through `commitMsg` or `mergeMsg` from `packages/cli/test/helpers/repo.ts`, never `-m`
  (conventions.md). A new test does not call `ticketWorktree`, `ticketBranch`, `ticketBranches`, `mergeOnRemote` or
  `verifyStage` of `packages/cli/test/helpers/worktree.ts`, because those commit with `-m`. `doneOnRemote` of that
  file, which calls `verifyStage`, is used as it is (ledger Rulings on task 1's helpers).
- CLI tests import core from `packages/core/dist`. After any change under `packages/core/`, run
  `npm run build -w packages/core` before a CLI test. Run one file with `npx vitest run <path>`. On Windows, follow
  conventions.md on `ACCORD_BASH`. End every task with `npm run build`, `npm run lint` and `npm run typecheck`, then
  run the test files the task names, plus `packages/cli/test/worktree-clean.test.ts`,
  `packages/cli/test/worktree-merge.test.ts`, `packages/cli/test/worktree-open.test.ts`,
  `packages/cli/test/worktree-push.test.ts`, `packages/cli/test/worktree-session.test.ts`,
  `packages/cli/test/hook.test.ts` and `packages/cli/test/git-count.test.ts` for every task that edits `worktree.ts` or
  `hook.ts`.
- `accord task-done` records a verify id from the report of `tests.affected`, which on Windows with Docker running runs
  vitest in a Linux container as root (`scripts/test-linux.mjs`, ST-LN-78), and otherwise on the host. Every verify id
  of this plan is a test with no `skipIf`, so it runs on the owner's Windows host and in that container alike. A test
  skipped on Windows or as root (`it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)`) is never a
  verify id; CI's non-root POSIX jobs still run it. `link` (Task 3) makes a junction on Windows and a directory symlink
  on POSIX, so a junction case of Tasks 3, 4, 6 and 7 is observed on a Windows host run and in CI's Windows jobs, and
  the same verify id passes in the container with symlinks.
- `packages/cli/test/git-count.test.ts` and its golden files pass unchanged after every task. Its sample clean prints
  the same lines as before. When a bound fails, cut the new git spawns: never edit a golden file. No new phase reads the
  worktree list (`git worktree list`) unless it has a recorded entry or a leftover folder to judge, because the
  `worktree list` item of `packages/cli/test/helpers/items.ts:50-54` counts every list read of `worktree open` and
  `new ticket --worktree`, whose clean runs first.
- Every git spawn is `execFileSync('git', [...])` or the existing `git`/`gitOk` helpers, with a literal array, never a
  shell. Paths read from git output are read with `-z` and split on `\0` (conventions.md). A local branch is deleted
  only with `git update-ref -d refs/heads/<b> <sha it checked>`, as `cleanDone` already does.
- Files are LF with no BOM. Add no dependency. Every printed path uses `/`. Core (`packages/core/src`) imports no
  `node:` module.
- No new line is printed on the success path of `worktree open` or `new ticket --worktree`.

Definitions shared by every task:
- `norm`: the existing `norm` of `worktree.ts:201`, which turns `\` into `/` and lower-cases the path on Windows. Every
  comparison of two paths in this plan uses it.
- The default ref `ref`: `gitDefaultRef(root)`, the ref clean already reads. `def` is `ref` without `refs/remotes/`.
- Done on `ref`: a ticket whose row in `statusRows(snapshotAt(root, ref, ids))` has stage `done` and a status that is not
  `dropped`, as `cleanDone` decides (`worktree.ts:888`). Dropped on `ref`: in `droppedOn(root, ref, ids)`.
- `names`: `ctx.snapshot.config?.disposable ?? DEFAULT_DISPOSABLE`. `DEFAULT_DISPOSABLE` is
  `['node_modules', 'dist', '.DS_Store', 'Thumbs.db']`, exported from `packages/cli/src/commands/leftover.ts` (D-08,
  D-12). The list is read from the config of the checkout clean runs in, like every other clean setting.
- A disposable path: a `/`-separated path relative to the worktree root, with any trailing `/` dropped, at least one of
  whose segments is in `names`.
- A link: an entry for which `lstatSync(p).isSymbolicLink()` is true. On Windows a junction counts. A link is never
  followed. A real file: any entry that is neither a link nor a folder (ledger Ruling).
- Gone: `lstatSync(p, { throwIfNoEntry: false }) === undefined`. Never use `existsSync` to decide that a folder is gone,
  because it follows a dangling link.
- The record: `<git-common-dir>/accord/worktrees`, one line per worktree accord created, `<id>\t<path>\n`, with the path
  as git prints it (forward slashes). A line that does not split into a valid id (`ID` of `worktree.ts:14`) and a
  non-empty path is skipped on reading and kept on rewriting.
- A kept line names the folder and what keeps it: `kept <folder>: <reason>`. When the reason is a file, it is the path
  relative to the folder, as git prints it or as the walk found it.
- Judged: a folder whose `norm`ed path is in `seen.judged` (Task 1), because this clean already wrote a `removed` or
  `kept` line for it through `folderLine`. No phase after that one in the same clean judges it again: it writes nothing for
  it and changes nothing in it.

Shared test file `packages/cli/test/worktree-clean.test.ts` (new since the baseline: main's split of `worktree.test.ts`
made it, and Task 1 appended its tests at its end). Lines 10-17 mock `../src/load/proc.js` (`processTable` wrapped in
`vi.fn`) and `../src/commands/fetch-limit.js` (`fetchLimitMs` wrapped in `vi.fn`). Lines 19-24 call `useSandboxes` of
`helpers/worktree.ts` with the template sets `{}`, `{ tickets: ['ST-9', 'ST-10'] }`, `{ tickets: ['ST-9', 'ST-10', 'ST-11'] }`
and `{ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] }`, built once in its `beforeAll` (`180_000`). `copy(opts)` takes a
`copyClone` of one of them, and the `afterEach` of `useSandboxes` resets the `processTable` and `fetchLimitMs` mocks,
unstubs envs and removes every clone. Every set this plan's tests use is already in that list. Each task appends its
tests at the end of the file and adds its imports to the existing import lines.

Shared test helpers:
- `packages/cli/test/helpers/worktree.ts` (new since the baseline, from main) holds
  `DEAD = { tool: 'Claude Code', marker: 'sess-D', pid: 4141, start: 'S1', taken: '2026-10-18T00:00:00.000Z' }` and
  `LIVE`, the same with `marker: 'sess-H', pid: 4242, start: 'S2'`; `writeHolds(c, holds)` and `readHolds(c)`, the JSON
  file `${c.root}/.git/accord/holds`; `lines(s)`, the non-empty lines of `s`; `has(dir, ref)`, whether
  `gitRun(dir, 'rev-parse', '--verify', '-q', ref)` succeeds; `sha(c, ref)`; `copy` and `clone`.
- The same file holds `claimWorktree(c, id, files = { [`${id}.txt`]: id + '\n' })`: a `t/<id>` worktree at
  `origin/main` with one `commitMsg` commit, pushed with `-u`; it returns that commit.
- The same file holds `doneOnRemote(c, ids)`. In another clone, for each id, it writes the verify-stage commits and the
  done ticket of `doneTicket(id, v)`, pushes that tip to `t/<id>` when origin has that branch, and merges it into `main`
  with `mergeMsg`. Then one push. `c` does not fetch. It returns each id's tick commit.
- The same file holds `dropOnRemote(c, ids)` (`helpers/worktree.ts:363`), which puts each ticket on the remote `main` as
  dropped through `commitMsg`.
- `packages/cli/test/helpers/done.ts` (new, made by Task 1) holds `ALIVE = [{ pid: process.pid, ppid: 1, start: 'self' }, { pid: 4242, ppid: 1, start: 'S2' }]`,
  the process table in which `LIVE` runs and `DEAD` does not; `gone(p)`, the definition above; and `runWhole`. Tasks 3
  and 4 add to it.

## Task 1: Wiring: the session-start hook runs the clean after its usual output
covers: @ac-2, D-03, D-09, D-11
files: packages/cli/src/commands/hook.ts, packages/cli/src/commands/worktree.ts, packages/core/src/scaffold/hooks.ts, packages/core/test/hooks.test.ts, packages/cli/test/helpers/done.ts (new), packages/cli/test/worktree-clean.test.ts (new)
verify: packages/cli/test/worktree-clean.test.ts#ac-2-a-session-start-resume-or-clear-cleans-a-done-ticket-worktree-and-branches-and-keeps-one-a-live-session-holds (@ac-2), packages/cli/test/worktree-clean.test.ts#risk:complex-branching-a-compaction-runs-no-clean-and-fetches-nothing, packages/cli/test/worktree-clean.test.ts#risk:data-loss-a-session-start-keeps-the-record-of-a-worktree-whose-folder-is-missing, packages/cli/test/worktree-clean.test.ts#risk:complex-branching-a-session-start-whose-input-folder-is-not-a-repository-prints-clean-failed-after-the-rules, packages/cli/test/worktree-clean.test.ts#risk:data-loss-a-session-start-whose-clean-output-passes-128-KiB-still-prints-its-last-line, packages/core/test/hooks.test.ts#risk:regression-both-session-start-hooks-carry-a-600-second-timeout-and-a-re-sync-adds-it

Consumes: `fetchOrigin`, `cleanQuietly`, `readList`, `passGuards`, `hookInput` and `repoRoot`. Produces: the hook
clean, the line `tell the owner the lines above`, `timeout: 600` on both SessionStart entries, `folderLine` and the
judged set, the hook clean's no-prune rule, the test file and the helper file Tasks 3 to 8 use.

Tests first. Create `packages/cli/test/helpers/done.ts` and `packages/cli/test/worktree-clean.test.ts` as the
preamble says, with `TEMPLATE_OPTS = [{ tickets: ['ST-9', 'ST-10'] }]`.
- `it('ac-2 a session start resume or clear cleans a done ticket worktree and branches and keeps one a live session holds')`.
  For each `[event, source]` of `[['session-start', 'startup'], ['session-resume', 'resume'], ['session-resume', 'clear']]`,
  on a fresh `c = copy({ tickets: ['ST-9', 'ST-10'] })`:
  - `claimWorktree(c, 'ST-9')`, `claimWorktree(c, 'ST-10')`, then `doneOnRemote(c, ['ST-9', 'ST-10'])`.
  - `writeHolds(c, { 'ST-9': { ...DEAD, folder: c.sibling('ST-9') }, 'ST-10': { ...LIVE, folder: c.sibling('ST-10') } })`
    and `vi.mocked(proc.processTable).mockReturnValue(ALIVE)`.
  - `r = await run(['hook', event], c.root, {}, JSON.stringify({ session_id: 'sess-M', cwd: c.root, source }))`.
  - `r.code` is 0 and `r.out` starts with `'# accord rules\n'`.
  - `gone(c.sibling('ST-9'))`; `has(c.root, 'refs/heads/t/ST-9')` and `has(c.remote, 'refs/heads/t/ST-9')` are false;
    `readHolds(c)` has no key `ST-9`.
  - `L = lines(r.out)` holds `removed ${c.sibling('ST-9')}` and `kept ${c.sibling('ST-10')}: held by another session`,
    and `L.indexOf('tell the owner the lines above')` is greater than the index of the removed line.
  - `c.sibling('ST-10')` exists and `c.git('worktree', 'list', '--porcelain')` contains `worktree ${c.sibling('ST-10')}\n`.
- `it('risk:complex-branching a compaction runs no clean and fetches nothing')` (ledger Ruling: compaction is not a
  session start): `c = copy({ tickets: ['ST-9', 'ST-10'] })`, `claimWorktree(c, 'ST-9')`, `doneOnRemote(c, ['ST-9'])`,
  `writeHolds(c, { 'ST-9': { ...DEAD, folder: c.sibling('ST-9') } })`, the `ALIVE` table, and
  `before = c.git('rev-parse', 'origin/main')`. `run(['hook', 'session-resume'], c.root, {}, JSON.stringify({ session_id: 'sess-M', cwd: c.root, source: 'compact' }))`
  exits 0; the sibling still exists; no line starts with `removed`; `tell the owner` is not in `out`; and
  `c.git('rev-parse', 'origin/main')` equals `before`.
- `it('risk:data-loss a session start keeps the record of a worktree whose folder is missing')` (an unmounted drive:
  `git worktree prune` would delete the record and the detached commit with it):
  - `c = copy({ tickets: ['ST-9', 'ST-10'] })` and `p = c.sibling('ST-9')`.
    `c.git('worktree', 'add', '-q', '--detach', p, 'origin/main')`, `writeFiles(p, { 'x.txt': 'x\n' })`, then
    `X = commitMsg(p, 'detached work')`. `renameSync(p, p + '-away')`.
  - `hook session-start` in `c.root` with the startup input of the ac-2 test exits 0. A line starts with
    `kept ${p}: its folder is missing`, no line starts with `pruned`, and `tell the owner the lines above` follows it.
  - `c.git('worktree', 'list', '--porcelain')` still contains `worktree ${p}\n`. After `renameSync(p + '-away', p)`,
    `gitRun(p, 'rev-parse', 'HEAD').trim()` equals `X`.
- `it('risk:complex-branching a session start whose input folder is not a repository prints clean failed after the rules')`:
  `c = copy({ tickets: ['ST-9', 'ST-10'] })`.
  `run(['hook', 'session-start'], c.root, {}, JSON.stringify({ session_id: 'sess-M', cwd: c.root + '/no-such-folder', source: 'startup' }))`
  exits 0; `out` starts with `'# accord rules\n'`; a line starts with `clean failed, nothing more was removed: `; and
  `tell the owner the lines above` comes after it.
- `it('risk:data-loss a session start whose clean output passes 128 KiB still prints its last line')`. A stream that
  is read once returns only what its buffer holds (64 KiB on Node 22 and 24), so this test reads the hook's output
  through `runWhole`, never `run`, whose `stdout.read()` (`repo.ts:115`) would cut it the same way:
  - Add to `helpers/done.ts`
    `runWhole(argv: string[], cwd: string, stdin?: string): Promise<{ code: number; out: string; err: string }>`. It
    makes the sandbox check of `run` (`repo.ts:106-111`, copied: the nearest existing ancestor of `cwd`, under
    `realpathSync.native(tmpdir())` and not `process.cwd()`, else it throws), then calls `runCli` from
    `../../src/run.js` with `env` `{}`, `stdin` when given, and `stdout` and `stderr` each a sink
    `{ write(chunk: string | Uint8Array): boolean { s += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'); return true; } }`
    cast `as unknown as NodeJS.WritableStream`, one string per sink.
  - `c = copy({ tickets: ['ST-9', 'ST-10'] })`, `claimWorktree(c, 'ST-9')`, `doneOnRemote(c, ['ST-9'])`, the `ALIVE`
    table, and `head = c.git('rev-parse', 'origin/main').trim()`.
  - 1000 worktree records whose folders are missing, written as files with no git spawn: for each `n` from 0 to 999,
    `writeFiles(`${c.root}/.git/worktrees/gone-${n}`, { gitdir: `${c.sibling('gone-' + n)}/.git\n`, HEAD: head + '\n', commondir: '../..\n' })`.
    `git worktree list --porcelain` lists each as `prunable`, so the hook clean writes one
    `kept <path>: its folder is missing (...)` line per record, about 150 bytes each, before it judges ST-9.
  - `r = await runWhole(['hook', 'session-start'], c.root, JSON.stringify({ session_id: 'sess-M', cwd: c.root, source: 'startup' }))`.
    `r.code` is 0, `r.out` starts with `'# accord rules\n'`, and `r.out.length` is greater than `131072`.
  - With `L = lines(r.out)`: exactly 1000 lines start with `kept ` and contain `: its folder is missing (`;
    `L` holds `removed ${c.sibling('ST-9')}`, the clean's last line, written after all of them; and
    `L.indexOf('tell the owner the lines above')` is greater than its index. `gone(c.sibling('ST-9'))`.
  - At a `sessionClean` that reads a `PassThrough` once, the removed line and the closing line are missing.
- In `packages/core/test/hooks.test.ts`, top level:
  `it('risk:regression both session start hooks carry a 600 second timeout and a re-sync adds it')`. With
  `e = hookEntries({ name: '@accord-dev/accord', version: '0.2.0' })`: `e.SessionStart.map((x) => x.hooks[0].timeout)`
  equals `[600, 600]`; no hook of `SubagentStart`, `UserPromptExpansion` or `PreToolUse` has a `timeout` key; and
  `mergeHooks({ hooks: { SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'npx --yes @accord-dev/accord@0.0.9 hook session-start' }] }] } }, e).hooks.SessionStart`
  equals `e.SessionStart`.

Interface:
- `hooks.ts`: in `HookEntries`, each hook becomes `{ type: 'command'; command: string; timeout?: number }`. Both
  SessionStart hook objects become `{ type: 'command', command: cmd(pkg, ...), timeout: 600 }`. Add a comment saying the
  value is in seconds and is longer than the hook clean's budget (Task 8), so the hook is never cut short in the middle
  of a removal (D-11). `isAccordHookCommand` and `mergeHooks` do not change. `.claude/settings.json` is re-rendered in
  Task 9.
- `worktree.ts`:
  - `interface SeenList` gains `keepMissing?: boolean` (set only by the hook clean) and `judged?: Set<string>` (the
    `norm`ed folders this clean already wrote a `removed` or `kept` line for).
  - `GuardState.seen` becomes required, `seen: SeenList`. `worktreeClean` takes `const seen = opts.seen ?? {}` and uses it
    wherever it used `opts.seen`, so `state = { seen }`. No git spawn is added or removed.
  - `function folderLine(ctx: CommandContext, seen: SeenList, path: string, text: string): void`: writes `text + '\n'`
    and adds `norm(path)` to `seen.judged`, creating the set. Every new folder line of this plan goes through it.
  - `readList(ctx, seen)` returns `PrunableEntry[]`. When `seen?.keepMissing` is true it runs
    `listWorktrees(ctx.root)` and never `git worktree prune`. For each entry whose `prunable` is set and whose folder is
    not judged, it calls `folderLine` with
    `kept <path>: its folder is missing (<prunable>); a session start never prunes its record`. Those entries stay in
    the returned list, so `cleanDone` finds the branch checked out there and keeps it. Otherwise `readList` is unchanged.
  - `passGuards` takes `w: PrunableEntry`. Its first step: when `w.prunable` is set, return `undefined` with no line,
    because `readList` already named it.
  - In `cleanDone` and `cleanDropped`, the `rebasing` search (`worktree.ts:874` and `982`) skips entries whose `prunable`
    is set, so `rebaseBranch` never spawns git in a missing folder.
  - `cleanQuietly(ctx, fetched, skip?, o: { hook?: boolean } = {})`: its `seen` is `{ keepMissing: true }` when
    `o.hook` is true, else `{}` as today. Its result and its other callers do not change.
- `hook.ts`: add `function sessionClean(ctx: CommandContext, event: 'session-start' | 'session-resume'): void`. `hook()`
  calls it as its last step for those two events: after `ctx.stdout.write(rules + '\n' + note + body)` and, for
  `session-start`, after `startHold(ctx)`. Steps:
  1. `input = hookInput(ctx)`. For `session-resume`, return unless `input?.source` is `resume` or `clear`. Compaction
     and a resume with no readable input run no clean (ledger Ruling on what a session start is).
  2. `let text = ''` and `out`, a minimal writable that keeps every write and never drops one:
     `{ write(chunk: string | Uint8Array): boolean { text += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'); return true; } }`
     cast `as unknown as NodeJS.WritableStream`. Every writer the clean reaches calls only `write(chunk)` on its
     stdout (`worktree.ts`, `worktrees(root, out)` at `worktree.ts:67-75`), so no other method is needed. No
     `PassThrough`: a single `read()` returns only its buffer, and output past 64 KiB would be lost. Everything else
     runs in one `try`:
     - `root = input?.cwd !== undefined ? repoRoot(input.cwd) : ctx.root`. `c` is `{ ...ctx, root, stdout: out }` with
       `branch` removed when `root !== ctx.root`.
     - `f = fetchOrigin(c)`. When `f.fetched` is `none`, the clone has no origin to judge against, and no clean runs.
     - Otherwise `cleanQuietly(f.ctx, f.fetched, undefined, { hook: true })`.
     In the `catch`, write `clean failed, nothing more was removed: <first line of the message>` to `out`, as
     `cleanQuietly` words it. A hook input folder that is gone or is not a repository lands here, so the hook still
     exits 0 with its rules printed.
  3. When `text` is not empty, write `text`, then `tell the owner the lines above\n`, to `ctx.stdout`.
- Clean never removes the worktree this session runs in: `passGuards` keeps it as today (`worktree.ts:679`), so a
  session started in the ticket's own worktree keeps it (D-09, D-11, ledger Ruling).

Must not change: the rules, the anchor, the `this session works` resume body, `startHold`, `recordResume`,
`releaseOnNewConversation` and their stderr lines; `prompt-expansion`, `pre-tool-use` and `subagent-start`; the
upgrade notice that `run.ts:372-375` writes after the hook. In a repository with no origin, the hook prints exactly
what it printed before, because no clean runs there; so the `hook.test.ts` cases pass unchanged. A bare
`accord worktree clean` and the clean inside `worktree open` and `new ticket --worktree` still prune and print
`pruned <path>: <reason>` as today. The `session-resume` run with no stdin in `git-count.test.ts:514` runs no clean.
Every `hook session-start` and `hook session-resume` case in `worktree.test.ts` (lines 1434 to 2826) and in
`lane-commands.test.ts:1086` passes unchanged.

## Task 2: config.yml takes a disposable list of names
covers: D-08, D-12
files: packages/core/schemas/config.schema.json, packages/core/src/model/snapshot.ts, packages/core/test/schemas.test.ts
verify: packages/core/test/schemas.test.ts#risk:parsing-disposable-is-a-list-of-file-or-folder-names

Consumes: nothing new. Produces: `AccordConfig.disposable`, which Task 3 reads.

Test first, top level in `packages/core/test/schemas.test.ts`, with its `validate`, `has` and `minimal` helpers:
- `it('risk:parsing disposable is a list of file or folder names')`:
  - `validate('config', { ...minimal.config, disposable: v })` is `[]` for `v` each of
    `['node_modules', 'dist', '.DS_Store', 'Thumbs.db']`, `[]` and `['.claude']`.
  - `'dist'` gives a finding at `/disposable` with `schema.type`. `['']` gives `/disposable/0` with
    `schema.minLength`. `['a/b']`, `['a\\b']`, `['.']` and `['..']` each give `/disposable/0` with `schema.pattern`.
    `['dist', 'dist']` gives `/disposable` with `schema.uniqueItems`.
- In the existing key-order test (`schemas.test.ts:146`), the expected list gains `'disposable'` after `'sensitive'`.

Interface:
- `config.schema.json`: after `sensitive`, add
  `"disposable": { "type": "array", "uniqueItems": true, "items": { "type": "string", "minLength": 1, "allOf": [ { "pattern": "^[^/\\\\]+$" }, { "pattern": "^(?!\\.{1,2}$)" } ] } }`.
  A name is one path segment, matched at any depth (D-12, ledger Ruling on the key's name).
- `snapshot.ts` `AccordConfig`: after `sensitive`, add
  `disposable?: string[]; // ST-LN-55 D-08, D-12: file and folder names an ignored path may hold at any depth and still be deleted with its worktree; absent means node_modules, dist, .DS_Store, Thumbs.db`.
- Run `npm run build -w packages/core`.

Must not change: the validation of every other key; every existing config, this repository's included, stays valid.

## Task 3: Clean keeps a worktree holding an ignored file outside the list, and prints removed only once the folder is gone
covers: @ac-1, D-01, D-04, D-08, D-12
files: packages/cli/src/commands/leftover.ts (new), packages/cli/src/commands/worktree.ts, packages/cli/test/helpers/done.ts (new), packages/cli/test/worktree-clean.test.ts (new)
verify: packages/cli/test/worktree-clean.test.ts#ac-1-clean-removes-a-done-ticket-worktree-completely-and-keeps-and-names-one-holding-an-ignored-env-file (@ac-1), packages/cli/test/worktree-clean.test.ts#risk:data-loss-clean-keeps-a-worktree-holding-an-ignored-env-file-when-status-shows-no-untracked-files, packages/cli/test/worktree-clean.test.ts#risk:data-loss-the-disposable-list-in-config.yml-decides-which-ignored-folders-a-done-worktree-may-hold-and-still-be-removed, packages/cli/test/worktree-clean.test.ts#risk:regression-a-folder-git-reports-removed-but-leaves-links-and-disposable-files-in-is-deleted-before-removed-is-printed, packages/cli/test/worktree-clean.test.ts#risk:complex-branching-a-worktree-remove-that-fails-after-git-unregistered-the-folder-keeps-and-names-the-file-left-in-it

Consumes: `AccordConfig.disposable` (Task 2), `folderLine` (Task 1), `passGuards` and `removeWorktree`. Produces:
`leftover.ts` with `DEFAULT_DISPOSABLE`, `isDisposable` and `sweepRemoved`; the ignored-file guard; the `removed` and
kept lines after a removal. Tasks 4 to 7 reuse them.

Tests first. Add to `helpers/done.ts`:
- `exclude(c, patterns)`: append each pattern and `\n` to `${c.root}/.git/info/exclude`, which every worktree reads.
- `link(target, at)`: `mkdirSync(dirname(at), { recursive: true })`, then
  `symlinkSync(target, at, process.platform === 'win32' ? 'junction' : 'dir')`. A junction needs no admin right.
- `listing(dir)`: the sorted lines of a walk with `lstatSync` that never follows a link: `<rel> -> <readlinkSync>` for a
  link, `<rel>/` for a folder, and `<rel>: <content>` for a file.

In `worktree-clean.test.ts`, beside its two `vi.mock` calls (lines 10-17), add the spawn wrapper `git-count.test.ts:19`
uses:
`vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));`,
and import `spawnLog` from `./helpers/git-spawns.js`. With `spawnLog.on` false, the wrapper passes every call through
unchanged (`git-spawns.ts:31`). With it true, a git call for which `spawnLog.fail(args)` returns true throws an injected
failure instead of running (`git-spawns.ts:34-41`), and `spawnLog.after` runs after each git call that returned
(`git-spawns.ts:42-51`). Add an `afterEach` of the file's own (import `afterEach` from `vitest`) that sets
`spawnLog.on = false`, `spawnLog.after = undefined`, `spawnLog.fail = undefined` and `spawnLog.calls = []`; the
`afterEach` of `useSandboxes` still resets the mocks and removes the clones.

Tests, at the end of the file (the `{}` and two-ticket sets are already in the `useSandboxes` list):
- `it('ac-1 clean removes a done ticket worktree completely and keeps and names one holding an ignored env file')`:
  - `c = copy({ tickets: ['ST-9', 'ST-10'] })` and `exclude(c, ['dist/', '.DS_Store', 'Thumbs.db', '.env'])`.
    `.gitignore` already ignores `node_modules/`.
  - For each id of `ST-9` and `ST-10`: `claimWorktree(c, id)`. Then, with `s = c.sibling(id)`, add npm's workspace link
    `link(`${s}/accord`, `${s}/node_modules/@x/ws`)` and write `node_modules/.bin/tool.cmd`, `dist/index.js`,
    `sub/.DS_Store` and `Thumbs.db` with `x`.
  - In the ST-10 sibling only, write `.env` as `SECRET=1\n`. `before = listing(c.sibling('ST-10'))`.
  - `doneOnRemote(c, ['ST-9', 'ST-10'])`. `r = await run(['worktree', 'clean'], c.root)`, which exits 0.
  - `gone(c.sibling('ST-9'))`, and `lines(r.out)` holds `removed ${c.sibling('ST-9')}`.
  - The worktree list still names the ST-10 sibling; `listing(c.sibling('ST-10'))` equals `before`; `lines(r.out)` holds
    `kept ${c.sibling('ST-10')}: .env`; no line starts with `removed ${c.sibling('ST-10')}`.
- `it('risk:data-loss clean keeps a worktree holding an ignored env file when status shows no untracked files')`
  (critique fix 4, scenario B): `c = copy()`, `exclude(c, ['.env'])`, `claimWorktree(c, 'ST-9')`, write `.env` there as
  `SECRET=1\n`, `doneOnRemote(c, ['ST-9'])`, then `c.git('config', 'status.showUntrackedFiles', 'no')`. Clean exits 0
  and holds `kept ${c.sibling('ST-9')}: .env`; the sibling is still listed; `.env` still reads `SECRET=1\n`.
- `it('risk:data-loss the disposable list in config.yml decides which ignored folders a done worktree may hold and still be removed')`
  (D-08: the list comes from config.yml, so a clean that reads `DEFAULT_DISPOSABLE` directly fails this test both ways):
  - `c = copy({ tickets: ['ST-9', 'ST-10'] })` and `exclude(c, ['coverage/', 'dist/'])`. `claimWorktree(c, 'ST-9')`, then
    write `coverage/x` there as `x`. `claimWorktree(c, 'ST-10')`, then write `dist/x` there as `x`.
    `doneOnRemote(c, ['ST-9', 'ST-10'])`.
  - `cfg = `${c.root}/accord/config.yml`` and `text = readFileSync(cfg, 'utf8').trimEnd()`. The main checkout's
    config.yml is the one clean reads (`names` above); the worktrees' own copies are never read.
  - `writeFileSync(cfg, text + '\ndisposable: [node_modules]\n')`. `worktree clean` exits 0. A line starts with
    `kept ${c.sibling('ST-9')}: coverage/` and a line starts with `kept ${c.sibling('ST-10')}: dist/` (git prints an
    ignored folder as `dist/` under `--ignored=matching`); no line starts with `removed`; both siblings are still
    listed, and `dist/x` still reads `x`. The default list holds `dist`, so a clean that ignored the config would remove
    the ST-10 sibling here.
  - `writeFileSync(cfg, text + '\ndisposable: [node_modules, dist, coverage]\n')`. `worktree clean` exits 0, and its
    lines hold `removed ${c.sibling('ST-9')}` and `removed ${c.sibling('ST-10')}`; both siblings are gone. The default
    list lacks `coverage`, so a clean that ignored the config would keep the ST-9 sibling here.
- `it('risk:regression a folder git reports removed but leaves links and disposable files in is deleted before removed is printed')`.
  This is the bug of 2026-10-30: Git for Windows leaves npm's junctions behind and exits 0. On POSIX git unlinks a
  symlink itself, so the test rebuilds that leftover right after git's own remove returns, on every OS:
  - `c = copy()`, `claimWorktree(c, 'ST-9')`, `doneOnRemote(c, ['ST-9'])`.
  - `spawnLog.after = (args) => { if (args[0] === 'worktree' && args[1] === 'remove') { const p = args[2]; link(`${c.root}/accord`, `${p}/node_modules/@x/ws`); mkdirSync(`${p}/a/b`, { recursive: true }); writeFiles(p, { 'dist/index.js': 'x' }); } }`,
    then `spawnLog.on = true`.
  - `worktree clean` exits 0. `gone(c.sibling('ST-9'))`; `lines(r.out)` holds `removed ${c.sibling('ST-9')}` and no line
    starting `kept ${c.sibling('ST-9')}`; `${c.root}/accord/config.yml` still exists, so the link was not followed.
  - At the baseline this fails on every OS: clean prints `removed` while the folder still exists.
- `it('risk:complex-branching a worktree remove that fails after git unregistered the folder keeps and names the file left in it')`.
  `git worktree remove` deletes the folder's files, then unregisters it even when a deletion failed, and exits non-zero
  (the part-way case). This test makes that case on every OS, so it runs on the Windows host and in the root container:
  - `c = copy()`, `claimWorktree(c, 'ST-9')`, `t = doneOnRemote(c, ['ST-9'])`, `sha9 = sha(c, 't/ST-9')`,
    `writeHolds(c, { 'ST-9': { ...DEAD, folder: c.sibling('ST-9') } })` and
    `vi.mocked(proc.processTable).mockReturnValue(ALIVE)`.
  - `spawnLog.fail = (args) => { if (args[0] !== 'worktree' || args[1] !== 'remove') return false; spawnLog.on = false; try { gitRun(c.root, ...args); writeFiles(args[2], { 'sub/f.txt': 'left\n' }); } finally { spawnLog.on = true; } return true; }`,
    then `spawnLog.on = true`. git's own remove runs and unregisters the folder, a file is put back where a failed
    deletion would leave it, and clean sees a failure.
  - `r = await run(['worktree', 'clean'], c.root)`, then `spawnLog.on = false`. `r.code` is 0, and `lines(r.out)` equals
    `[`kept ${c.sibling('ST-9')}: sub/f.txt`, `deleted t/ST-9 (was ${sha9})`, `deleted origin/t/ST-9 (was ${t['ST-9']})`]`.
  - `${c.sibling('ST-9')}/sub/f.txt` still reads `left\n`; `c.git('worktree', 'list', '--porcelain')` does not contain
    `c.sibling('ST-9')`; `Object.keys(readHolds(c))` is `[]`.
  - At the baseline this fails: clean prints `removed ${c.sibling('ST-9')} in part: ...`.
- `worktree-clean.test.ts:130`, the POSIX-only part-way test, keeps its name and setup. It is
  `it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)`, so neither the owner's Windows host nor the
  root Linux container runs it; it is not a verify id, and CI's non-root POSIX jobs run it. git stops at its first
  failed entry in readdir order, so what it leaves differs by file system. Its line checks become: `lines(q.out)` has
  length 3; `lines(q.out)[0]` starts with `kept ${d.sibling('ST-9')}: `; lines 1 and 2 stay as they are; and
  `${d.sibling('ST-9')}/sub/f.txt` still exists. Drop the `in part` and `delete what is left of the folder by hand`
  checks (lines 143-144). Everything else in it stays.

The ac-1 test and the regression test call `link`, which makes junctions on the Windows host and symlinks in the
container; both verify ids run in both places, and the junction case itself is seen on a Windows run.

Interface:
- `packages/cli/src/commands/leftover.ts` (new), importing only `node:fs`:
  - `export const DEFAULT_DISPOSABLE: readonly string[] = ['node_modules', 'dist', '.DS_Store', 'Thumbs.db'];`
  - `export function isDisposable(rel: string, names: readonly string[]): boolean`: true when a segment of `rel`, with
    any trailing `/` dropped, is in `names`.
  - `export function sweepRemoved(dir: string, names: readonly string[]): string | undefined`. This is the walk after git
    unregistered the folder. Walk `dir` depth first, with entries in code-point order and `lstatSync` for each:
    - a link: `unlinkSync`, never followed;
    - a folder: walk it, then `rmdirSync` it when it is empty;
    - a file whose relative path is disposable: `rmSync(p)`, without `recursive`;
    - any other file: left, and remembered when it is the first.
    A failed deletion leaves that entry and counts it as remembered. At the end `rmdirSync(dir)` when it is empty. Return
    `undefined` when `dir` is gone. Otherwise return the first remembered relative path, or else the first name
    `readdirSync(dir)` now lists, or else `.`.
- `worktree.ts` `passGuards`, the uncommitted-work step (`worktree.ts:703`):
  - Run `git(w.path, ['status', '--porcelain', '-z', '--ignored=matching', '--untracked-files=normal', '--ignore-submodules=none'])`,
    split on `\0`, empty entries dropped. `matching` shows an ignored file under a folder that is not itself ignored, so
    `sub/.DS_Store` is judged by its own name. `--untracked-files=normal` stays explicit (critique fix 4).
  - An entry that does not start with `!! ` keeps the worktree with today's `kept <path>: uncommitted work` line.
  - Otherwise the first `!! ` entry whose path is not disposable keeps it with `kept <w.path>: <path>`, the path as git
    prints it. That happens before `git worktree remove` runs, which would delete every ignored file (D-08, ledger
    Ruling on ac-1).
- `worktree.ts` `removeWorktree`, after the `git worktree remove` attempt, which still has no `--force`:
  - `listed = failure !== undefined && readList(ctx, seen).some((x) => x.path === w.path)`. On success no list is read,
    as today.
  - When `listed`: today's `kept <path>: git worktree remove failed: <failure>` line, written through `folderLine`, the
    hold kept, and `{ failed: true }`.
  - Otherwise git unregistered the folder. `left = gone(w.path) ? undefined : sweepRemoved(w.path, names)`. Through
    `folderLine`, write `removed <path>` when `left === undefined`, else `kept <path>: <left>`. The `removed ... in part`
    line is gone: the word `removed` now always means the folder is gone (D-01 part A).
  - The hold is dropped as today, and the result is `{ failed: false }`, so the branch steps go on as today.

Must not change: the own-session, hold and cannot-tell lines of `passGuards`; the `ac-5` clean test
(`worktree-clean.test.ts:26`), whose `node_modules/x` is disposable; the locked-worktree failure case
(`worktree-clean.test.ts:114`); every dropped-ticket case (`worktree-clean.test.ts:266-491`); the spawn count of a
clean that removes nothing.

## Task 4: Accord records each worktree it creates, and clean deletes a recorded folder git has forgotten when it holds only links and empty folders
covers: @ac-3, D-01, D-04, D-06, D-07
files: packages/cli/src/commands/worktree.ts, packages/cli/src/commands/leftover.ts (new), packages/cli/test/helpers/done.ts (new), packages/cli/test/worktree-clean.test.ts (new)
verify: packages/cli/test/worktree-clean.test.ts#ac-3-a-session-start-in-a-worktree-and-a-clear-in-the-main-checkout-delete-the-recorded-folder-of-a-done-ticket-that-git-forgot (@ac-3), packages/cli/test/worktree-clean.test.ts#risk:data-loss-a-forgotten-folder-holding-a-dist-file-or-a-recorded-path-that-is-a-link-is-kept-unchanged-and-named, packages/cli/test/worktree-clean.test.ts#risk:regression-worktree-open-on-an-existing-branch-and-new-ticket-in-a-worktree-both-record-the-worktree

Consumes: Task 1's hook clean and `folderLine`, and Task 3's `removeWorktree` and `leftover.ts`. Produces: the record
(D-07), written at the three places accord creates a worktree; `cleanRecorded`; `cleanForgotten`; `sweepForgotten`.
Tasks 5 to 8 extend them. `gate done` gets no worktree check (D-07). Part (D) stays in this ticket (D-06, D-10).

Tests first. Add to `helpers/done.ts`:
- `forget(c, id)`: `c.git('worktree', 'remove', '--force', c.sibling(id))`, then `mkdirSync(c.sibling(id))`. This leaves
  a folder git no longer lists.
- `recorded(c)`: the lines of `${c.root}/.git/accord/worktrees` as `{ id, path }`, or `[]` when the file is missing.

Tests, at the end of `worktree-clean.test.ts` (the two- and three-ticket sets are already in the `useSandboxes` list).
The first two call `link`, which makes junctions on the Windows host and symlinks in the container; every verify id
below runs in both places, and the junction case itself is seen on a Windows run:
- `it('ac-3 a session start in a worktree and a clear in the main checkout delete the recorded folder of a done ticket that git forgot')`:
  - `c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] })`. Run `run(['worktree', 'open', id], c.root)` for `ST-9`, `ST-10`
    and `ST-11`, each exiting 0. `recorded(c)` then holds the three siblings with their ids.
  - Forget ST-9: `forget(c, 'ST-9')`, `mkdirSync(`${c.sibling('ST-9')}/a/b`, { recursive: true })`, and
    `link(`${c.root}/accord`, `${c.sibling('ST-9')}/node_modules/outside`)`, a link to a folder outside it.
    `doneOnRemote(c, ['ST-9'])`.
  - Start a session in the ST-10 worktree:
    `run(['hook', 'session-start'], c.sibling('ST-10'), {}, JSON.stringify({ session_id: 'sess-W', cwd: c.sibling('ST-10'), source: 'startup' }))`
    exits 0. `gone(c.sibling('ST-9'))`; `out` holds `removed ${c.sibling('ST-9')}`; `${c.root}/accord/config.yml`
    still exists, so the link was not followed; `recorded(c)` has no entry for the ST-9 sibling and still has the ST-10
    one.
  - Forget ST-11 the same way, with only `a/b` and no link, then `doneOnRemote(c, ['ST-11'])`.
    `run(['hook', 'session-resume'], c.root, {}, JSON.stringify({ session_id: 'sess-M', cwd: c.root, source: 'clear' }))`
    exits 0, `gone(c.sibling('ST-11'))`, and `recorded(c)` has no entry for the ST-11 sibling.
- `it('risk:data-loss a forgotten folder holding a dist file or a recorded path that is a link is kept unchanged and named')`
  (critique fix 3, scenario C):
  - `c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] })`. `worktree open` for ST-9 and ST-10, each exiting 0.
  - `forget(c, 'ST-9')`. Write `dist/index.js` there as `modified\n`, add
    `link(`${c.root}/accord`, `${c.sibling('ST-9')}/node_modules/outside`)`, and `mkdirSync` an `empty` folder.
  - The recorded ST-10 path becomes a link: `c.git('worktree', 'remove', '--force', c.sibling('ST-10'))`. With
    `t = c.sibling('ST-11')`, a folder of a ticket that is not done: `mkdirSync(`${t}/a/b`, { recursive: true })` and
    `link(`${c.root}/accord`, `${t}/l`)`. Then `link(t, c.sibling('ST-10'))`.
  - `doneOnRemote(c, ['ST-9', 'ST-10'])`, `before = listing(c.sibling('ST-9'))` and `beforeT = listing(t)`.
  - `worktree clean` exits 0. Its lines hold `kept ${c.sibling('ST-9')}: dist/index.js` and
    `kept ${c.sibling('ST-10')}: it is a link`.
  - `listing(c.sibling('ST-9'))` equals `before`; `listing(t)` equals `beforeT`;
    `lstatSync(c.sibling('ST-10')).isSymbolicLink()` is true; `recorded(c)` still names both siblings. A disposable name
    never makes a file in a forgotten folder deletable, and a link is never walked through.
- `it('risk:regression worktree open on an existing branch and new ticket in a worktree both record the worktree')`.
  The ac-3 test reaches only the fresh-claim site (`worktree.ts:438`); this one reaches the other two:
  - `c = copy({ tickets: ['ST-9', 'ST-10'] })`. `c.git('branch', 't/ST-10', 'origin/main')`: a local branch with no
    worktree and no claim commit, so `checkClaimant` finds no claimant and lets it through.
  - `run(['worktree', 'open', 'ST-10'], c.root)` exits 0. It takes the existing-branch site (`worktree.ts:412`,
    `git worktree add <path> t/ST-10`).
  - `run(['new', 'ticket', 'ST-11', '--lane', 'M', '--worktree'], c.root)` exits 0. It takes the `newTicketWorktree`
    site (`worktree.ts:1078`); the fixture's config.yml has no `people`, so the typed id is accepted.
  - `recorded(c)` equals `[{ id: 'ST-10', path: c.sibling('ST-10') }, { id: 'ST-11', path: c.sibling('ST-11') }]`, in
    that order, and neither run printed a line starting with `note `.

Interface, `worktree.ts`:
- `function withLock<T>(root: string, fn: (dir: string) => T): T`. It holds the lock loop and the `finally` of
  `withHolds` (`worktree.ts:122-138` and `159-162`), moved unchanged: the same `<common>/accord/holds.lock`, 2 s wait and
  error text. `dir` is `<common>/accord`. `withHolds` becomes `withLock` plus its read and write of `holds`. The record
  is written under this same lock (Approach).
- `export function recordWorktree(root: string, id: string, path: string): void`: under `withLock`, read the record and
  return when a line's path equals `path` under `norm`. Otherwise write the old lines plus `${id}\t${path}\n` to a
  `.${process.pid}.tmp` file and rename it over the record, as `withHolds` writes.
- `export function readRecorded(root: string): { id: string; path: string }[]`: no lock; a missing file gives `[]`.
- `function dropRecorded(root: string, path: string): void`: under `withLock`, rewrite without the lines whose path
  equals `path` under `norm`. It writes nothing when there are none.
- `function recordQuietly(ctx: CommandContext, id: string, path: string): void`: `recordWorktree` in a `try`. On a
  failure it writes `note <id>: the worktree <path> was not recorded: <first line>`, and the command goes on.
- The three creation sites call `recordQuietly(ctx, id, path)` right after their `git worktree add`: `worktreeOpen` after
  `worktree.ts:412` and after `worktree.ts:438`, and `newTicketWorktree` after `worktree.ts:1078`.
- `GuardState` gains `accord?: string`, the `<common>/accord` folder read once per clean, so the record read costs one
  spawn per clean at most, and `recorded?: { id: string; path: string }[]`, the entries `cleanRecorded` read.
- `removeWorktree`: when it wrote `removed <path>`, call `dropRecorded(ctx.root, w.path)` in a `try`. On a failure write
  `note <id>: the record of the removed worktree could not be updated: <first line>`.
- `function cleanForgotten(ctx: CommandContext, path: string, s: GuardState): boolean`. Every line it writes goes
  through `folderLine`. Steps:
  1. When the folder is judged, return false with no line.
  2. When `norm(ctx.root) === norm(path)` or `norm(ctx.root)` starts with `norm(path) + '/'`, write
     `kept <path>: this session's worktree` and return false.
  3. `st = lstatSync(path, { throwIfNoEntry: false })`. Return true when it is `undefined`. When `st.isSymbolicLink()`,
     write `kept <path>: it is a link` and return false: the link and what it points to are never touched, and nothing
     behind it is walked (ledger Ruling). When `!st.isDirectory()`, write `kept <path>: it is not a folder` and return
     false.
  4. `left = sweepForgotten(path)`: write `removed <path>` and return true when it is `undefined`, else write
     `kept <path>: <left>` and return false.
- `function cleanRecorded(ctx: CommandContext, ref: string, s: GuardState, fetchFailed: boolean): void`:
  - `s.recorded = readRecorded(ctx.root)`. When there is no entry, return.
  - `ids` are the entries' ids. `done` is the done set on `ref`, and `dropped` is the dropped set, only when
    `!fetchFailed`, as `cleanDropped` refuses a stale drop. When no entry's id is in `done` or `dropped`, return before
    any list read.
  - `list = readList(ctx, s.seen)`.
  - For each entry, sorted by path, whose id is in `done` or `dropped` and whose folder is not judged, inside a `try`
    whose `catch` writes `kept <path>: could not be judged: <first line>` through `folderLine`:
    - git lists the path under `norm`: leave it to `cleanDone` and `cleanDropped` here (Task 5 adds this case);
    - the folder is gone: `dropRecorded`;
    - otherwise the folder is one git forgot: when `cleanForgotten(ctx, path, s)` returns true, `dropRecorded`.
- `worktreeClean` calls `cleanRecorded(ctx, ref, state, fetchFailed)` after `cleanDropped`.

Interface, `leftover.ts`: `export function sweepForgotten(dir: string): string | undefined` (critique fix 3). When
`lstatSync(dir)` is not a folder, a link included, return `.` with nothing changed. Otherwise it scans first: walk `dir`
with `lstatSync`, entries in code-point order. The first entry that is neither a link nor a folder ends the scan, and
its relative path is returned with nothing changed. When the whole tree is links and folders, `unlinkSync` every link,
then `rmdirSync` every folder deepest first, then `dir`. A failed deletion stops there and returns that entry's
relative path. Return `undefined` when `dir` is gone.

Must not change: the holds file, its lock, its timeout message, `takeHold`, `releaseHolds` and `readHoldsFile`; every
line `worktree open` and `new ticket --worktree` print; the clean output of a repository with no record; the
`git-count.test.ts` counts and goldens.

## Task 5: Clean keeps any folder a live hold names, and removes a recorded detached worktree only when its HEAD is on the default branch or a branch tip
covers: D-07, D-11
files: packages/cli/src/commands/worktree.ts, packages/cli/test/worktree-clean.test.ts (new)
verify: packages/cli/test/worktree-clean.test.ts#risk:data-loss-clean-keeps-a-recorded-detached-worktree-whose-head-is-on-no-branch-and-removes-one-at-the-default-branch, packages/cli/test/worktree-clean.test.ts#risk:data-loss-clean-never-removes-a-recorded-worktree-on-another-branch-or-a-folder-a-live-hold-names, packages/cli/test/worktree-clean.test.ts#risk:complex-branching-clean-names-a-recorded-worktree-of-a-dropped-ticket-whose-branch-is-already-on-the-default-branch, packages/cli/test/worktree-clean.test.ts#risk:data-loss-a-bare-clean-keeps-the-record-of-a-missing-folder-whose-detached-head-is-on-no-branch, packages/cli/test/worktree-clean.test.ts#risk:data-loss-worktree-open-re-creates-a-ticket-worktree-whose-folder-was-deleted-while-a-missing-folder-holds-a-detached-head-on-no-branch

Consumes: Task 4's `cleanRecorded`, `cleanForgotten` and record, plus `passGuards`, `removeWorktree`, `rebaseBranch`,
`folderLine`, and `worktrees` and `readList` with Task 1's handling of entries whose folder is missing. Produces:
critique fixes 1 and 2, `onNoBranch`, a kept line for every recorded worktree of a done or dropped ticket that no other
phase judges (D-07: "printing the ones it cannot"), a bare clean that never prunes the only ref to a detached
commit (the Intent: never remove a commit reachable from nothing else; `/accord` is a clean moment, D-07, D-11), and a
`worktree open` that, while that no-prune rule holds, re-creates the ticket's own worktree whose folder was deleted
with `git worktree add --force`, and otherwise refuses without suggesting a prune (owner's answer "Use --force
(Recommended)" to plan round 5 finding 1).

Tests first, at the end of `worktree-clean.test.ts`; each passes `120_000` and none calls `link`, so each runs alike on
the Windows host and in the container. They use `dropOnRemote(c, ids)` of `helpers/worktree.ts:363`,
which the file already imports and which commits through `commitMsg`, and `forget` and `recorded` of `helpers/done.ts`
(Task 4). The four-ticket set is already in the `useSandboxes` list.
- `it('risk:data-loss clean keeps a recorded detached worktree whose head is on no branch and removes one at the default branch')`
  (fix 1, scenario A):
  - `c = copy({ tickets: ['ST-9', 'ST-10'] })`, then `worktree open` for ST-9 and ST-10.
  - In the ST-9 sibling: `switch -q --detach`, write `x.txt`, and `X = commitMsg(sibling, 'detached work')`.
  - In the ST-10 sibling: `switch -q --detach origin/main`. `doneOnRemote(c, ['ST-9', 'ST-10'])`.
  - `worktree clean` exits 0. Its lines hold `kept ${c.sibling('ST-9')}: its detached HEAD ${X} is on no branch` and
    `removed ${c.sibling('ST-10')}`.
  - The ST-9 sibling is still listed with `x.txt`, `c.git('cat-file', '-e', X)` succeeds, and `recorded(c)` names the
    ST-9 sibling but not the ST-10 one.
- `it('risk:data-loss clean never removes a recorded worktree on another branch or a folder a live hold names')` (fix 2):
  - `c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] })`.
  - `worktree open ST-9`, then `switch -q -c other` in its sibling.
  - `claimWorktree(c, 'ST-10')`.
  - `worktree open ST-12`, then `forget(c, 'ST-12')` and `mkdirSync` an `empty` folder there.
  - `writeHolds(c, { 'ST-11': { ...LIVE, folder: c.sibling('ST-10') }, 'ST-13': { ...LIVE, folder: c.sibling('ST-12') } })`:
    live holds keyed by ids other than the folders' own. Use the `ALIVE` table.
  - `doneOnRemote(c, ['ST-9', 'ST-10', 'ST-12'])`. Clean exits 0, and its lines hold `kept ${c.sibling('ST-9')}: checked out on other`,
    `kept ${c.sibling('ST-10')}: held by another session` and `kept ${c.sibling('ST-12')}: held by another session`.
  - All three folders exist; the ST-9 and ST-10 siblings are still listed; and `has(c.root, 'refs/heads/other')`.
- `it('risk:complex-branching clean names a recorded worktree of a dropped ticket whose branch is already on the default branch')`:
  - `c = copy()`, `worktree open ST-9` exits 0, then `gitRun(c.sibling('ST-9'), 'reset', '-q', '--hard', 'origin/main')`,
    so `t/ST-9` is an ancestor of `origin/main`. `dropOnRemote(c, ['ST-9'])`.
  - `worktree clean` exits 0, and its lines hold
    `kept ${c.sibling('ST-9')}: its ticket is dropped and its branch t/ST-9 is already on origin/main`.
  - The sibling is still listed, `has(c.root, 'refs/heads/t/ST-9')` is true, and `recorded(c)` still names the sibling.
- `it('risk:data-loss a bare clean keeps the record of a missing folder whose detached head is on no branch')`. Task 1
  stops the hook clean from pruning; a bare `accord worktree clean`, and the clean inside `worktree open` and
  `new ticket --worktree`, still run `git worktree prune` in `worktrees()` (`worktree.ts:67-75`), which deletes the only
  ref to such a commit:
  - `c = copy({ tickets: ['ST-9', 'ST-10'] })`, `p = c.sibling('ST-9')` and `q = c.sibling('ST-10')`.
  - `c.git('worktree', 'add', '-q', '--detach', p, 'origin/main')`, `writeFiles(p, { 'x.txt': 'x\n' })`, then
    `X = commitMsg(p, 'detached work')`, a commit on no branch. `c.git('worktree', 'add', '-q', '--detach', q, 'origin/main')`,
    whose HEAD is on `origin/main`.
  - `renameSync(p, p + '-away')` and `renameSync(q, q + '-away')`, so both are listed as `prunable`.
  - `r = await run(['worktree', 'clean'], c.root)`. `r.code` is 0. `lines(r.out)` holds
    `kept ${p}: its folder is missing and its detached HEAD ${X} is on no branch`; a line starts with
    `kept ${q}: its folder is missing (`; no line starts with `pruned`. `c.git('worktree', 'list', '--porcelain')`
    contains `worktree ${p}\n` and `worktree ${q}\n`.
  - `renameSync(p + '-away', p)`. `gitRun(p, 'rev-parse', 'HEAD').trim()` equals `X`.
  - `r2 = await run(['worktree', 'clean'], c.root)`. `r2.code` is 0; a line starts with `pruned ${q}: `; no line starts
    with `kept ${p}`; the worktree list still contains `worktree ${p}\n` and no longer contains `worktree ${q}\n`.
  - At the baseline the first clean prints `pruned ${p}: ...`, and `X` is reachable from nothing.
- `it('risk:data-loss worktree open re-creates a ticket worktree whose folder was deleted while a missing folder holds a detached head on no branch')`.
  While the rule above keeps every missing entry listed, git still has the ticket's own sibling registered, so a plain
  `git worktree add <sibling> t/<id>` fails and git's message suggests `prune`, which would lose `X`. Import `rmSync`
  and `renameSync` from `node:fs` on the file's existing import line when they are not there yet:
  - `c = copy({ tickets: ['ST-9', 'ST-10'] })`, `p = c.sibling('scratch')`, `s = c.sibling('ST-9')` and
    `q = c.sibling('elsewhere')`.
  - `c.git('worktree', 'add', '-q', '--detach', p, 'origin/main')`, `writeFiles(p, { 'x.txt': 'x\n' })`, then
    `X = commitMsg(p, 'detached work')`, a commit on no branch. `renameSync(p, p + '-away')`.
  - `claimWorktree(c, 'ST-9')`, `sha9 = sha(c, 't/ST-9')`, then `rmSync(s, { recursive: true, force: true })`: the
    ticket's own folder deleted by hand, its entry still on branch `t/ST-9`.
  - `r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root)`. `r.code` is 0; no line of `r.out` starts with
    `pruned`; `gitRun(s, 'branch', '--show-current').trim()` equals `t/ST-9` and `gitRun(s, 'rev-parse', 'HEAD').trim()`
    equals `sha9`. With `list = c.git('worktree', 'list', '--porcelain')`: `list.split('worktree ' + s + '\n').length`
    is 2 (one entry for `s`), and `list` contains `worktree ${p}\nHEAD ${X}\n`.
  - The refusal: `c.git('worktree', 'add', '-q', '-b', 't/ST-10', q, 'origin/main')`, then `renameSync(q, q + '-away')`,
    so `t/ST-10` is held by a missing folder that is not ST-10's sibling.
    `r2 = await run(['worktree', 'open', 'ST-10', '--continue'], c.root)`. `r2.code` is 2; `r2.err` contains
    `ST-10: its branch t/ST-10 is checked out in ${q}, whose folder is missing` and does not contain `prune`;
    `gone(c.sibling('ST-10'))`; the worktree list still contains `worktree ${q}\n` and `worktree ${p}\nHEAD ${X}\n`.
  - At the baseline the open's clean prunes `p`, so the check on `worktree ${p}\nHEAD ${X}\n` fails; with the no-prune
    rule and no `--force`, the first open exits 2 with git's `is a missing but already registered worktree` message.

Interface, `worktree.ts`:
- `function onNoBranch(root: string, head: string, ref: string | undefined, merged?: Set<string>): boolean`, the
  detached-HEAD rule of fix 1, used by `worktrees` and by `cleanRecorded` below. It returns true, with no spawn, when
  `head` is empty. It returns false when `merged?.has(head.toLowerCase())`, or when `ref !== undefined` and
  `gitOk(root, ['merge-base', '--is-ancestor', head, ref])`, or when
  `git(root, ['for-each-ref', '--points-at', head, '--format=%(refname)', 'refs/heads', 'refs/remotes/origin'])`
  prints a non-empty line. A `for-each-ref` that throws counts as no line. Otherwise it returns true.
- `worktrees(root: string, out: NodeJS.WritableStream, judged?: Set<string>): PrunableEntry[]`. When no entry is
  prunable it returns the list with no other spawn, as today. Otherwise:
  - `ref = gitDefaultRef(root)`, and `held` is the prunable entries with no `branch` for which
    `onNoBranch(root, w.head, ref)` is true. A prunable entry on a branch is never in `held`: its branch keeps its
    commits.
  - When `held` is empty, today's steps run unchanged: `git worktree prune`, a `pruned <path>: <reason>` line per entry
    it removed, and the list without prunable entries.
  - Otherwise no `git worktree prune` runs in this call, because git prunes every prunable entry at once and has no
    per-entry form. For each prunable entry whose `norm`ed path is not in `judged`, write
    `kept <path>: its folder is missing and its detached HEAD <head> is on no branch` for an entry of `held`, else
    `kept <path>: its folder is missing (<prunable>); no prune runs while a missing folder holds a detached HEAD on no branch`,
    then add its `norm`ed path to `judged`. When `judged` is undefined, write none of these lines: the only callers
    without it are the list reads of `worktreeOpen` and `newTicketWorktree` below, which run right after a clean whose
    `readList` already named those entries, so no line is printed twice. Return the whole list, prunable entries included, as the hook path of
    `readList` does (Task 1): `passGuards` skips them with no line, the `rebasing` search skips them, `cleanDone` keeps
    a branch checked out in a missing folder, and `cleanRecorded` skips them as judged.
  - The next clean in which no missing folder holds such a HEAD prunes as today, so every other entry's `pruned` line
    comes back once the owner restores or deletes that folder (ledger Ruling).
- `readList`, the path that is not the hook's: `list = worktrees(ctx.root, ctx.stdout, seen === undefined ? undefined : (seen.judged ??= new Set()))`,
  so its lines go into the judged set like a `folderLine` line, and a second read in the same clean writes nothing new.
  The hook path is unchanged: it never prunes.
- `worktreeOpen` (`worktree.ts:388`) and `newTicketWorktree` (`worktree.ts:1066`) use only the entries of their list
  whose `prunable` is unset: `(seen ?? worktrees(ctx.root, ctx.stdout)).filter((w) => (w as PrunableEntry).prunable === undefined)`.
  They never enter or claim a missing folder, and `list[0]`, the main checkout, is never prunable. When no prunable
  entry exists, both behave and print exactly as today.
- `worktreeOpen` keeps the unfiltered list as `all = seen ?? worktrees(ctx.root, ctx.stdout)` (typed
  `PrunableEntry[]`) and sets `list = all.filter(...)` as above, so no list read is added. Prunable entries reach `all`
  only while the no-prune rule holds, because otherwise `worktrees()` has already pruned them. In the
  `if (local || remote)` block, after `path = siblingOf(mainPath, id)` and before the `git worktree add` of
  `worktree.ts:412`, take `missing = all.filter((w) => w.prunable !== undefined && w.branch === branch)`:
  - `missing` is empty: today's `git worktree add`, unchanged.
  - `missing` has exactly one entry and `norm(missing[0].path) === norm(path)`: the ticket's own sibling, deleted by
    hand, is still registered. Run `git(ctx.root, ['worktree', 'add', '--force', path, branch])` (`branch` is local here,
    since a worktree holds it). Per the git-worktree docs (https://git-scm.com/docs/git-worktree, `--force`), this
    overrides only the two safeguards in the way: the branch checked out by another worktree, and a path assigned to a
    worktree but missing. Git replaces only that one entry's record; every other entry, `p` included, stays. The
    commits of that entry are on `branch`, so nothing is lost. Then the steps of `worktree.ts:413-419` run as today.
  - Any other case: throw `UsageError` (exit 2) with
    `<id>: its branch <branch> is checked out in <paths>, whose folder is missing - put that folder back, then try again; nothing was created`,
    `<paths>` the entries' paths joined by `, `. The text never names `prune`, and no git command runs.
  - `git worktree remove` never takes `--force`, here or anywhere else in this plan.
- Split the lazy holds read out of `passGuards` (`worktree.ts:708-719`) into
  `function guardHolds(ctx, s): Record<string, Hold> | undefined`. It returns `undefined` after the same `its hold could
  not be read` line, now naming the folder it was asked for.
- `function heldElsewhere(ctx: CommandContext, path: string, skip: string | undefined, s: GuardState): string | undefined`.
  For each hold whose key is not `skip` and whose `folder` equals `path` under `norm`, apply the same tests `passGuards`
  applies to the id's hold (`worktree.ts:720-741`):
  - the marker of this session gives `this session's worktree`;
  - a process-table failure gives `cannot tell whether the session holding it still runs`;
  - a live hold of another session gives `held by another session`.
  Return the first reason, or `undefined`.
- `passGuards`: after the id's hold check, `heldElsewhere(ctx, w.path, id, s)`. A reason writes `kept <w.path>: <reason>`
  and returns `undefined` (fix 2, first half).
- `cleanForgotten`: after the session check, read `guardHolds`. Return false when it is `undefined`. Then a
  `heldElsewhere(ctx, path, undefined, s)` reason writes `kept <path>: <reason>` through `folderLine` and returns false.
- `cleanRecorded`, the listed case, with `W` the listed entry (`cleanRecorded` now takes `merged`, the set
  `worktreeClean` already builds). Every line here goes through `folderLine`:
  - `W.branch === branchOf(ctx.snapshot, id)`, and the id is in `dropped`, and `merged.has(W.head.toLowerCase())` or
    `merge-base --is-ancestor W.head ref` succeeds: `kept <path>: its ticket is dropped and its branch <W.branch> is already on <def>`.
    `cleanDropped` leaves such a branch (`worktree.ts:983-989`) and `cleanDone` judges only done tickets, so without
    this line clean would say nothing (D-07, ledger Ruling);
  - `W.branch === branchOf(ctx.snapshot, id)` otherwise: nothing here, because `cleanDone` and `cleanDropped` judge it;
  - `W.branch` is another branch: `kept <path>: checked out on <W.branch>`. Clean never removes by path a worktree on a
    branch (fix 2, second half);
  - detached, and `rebaseBranch(W.path) !== undefined`: `kept <path>: being rebased`;
  - detached, and `onNoBranch(ctx.root, W.head, ref, merged)` is false (`W.head` is in `merged`, or
    `merge-base --is-ancestor W.head ref` succeeds, or `for-each-ref --points-at` finds a local or origin branch at it):
    then `g = passGuards(ctx, W, id, s)`, and when it passes, `removeWorktree(ctx, W, id, g.h, s.seen)`, which drops the
    record entry (fix 1);
  - detached otherwise: `kept <path>: its detached HEAD <W.head> is on no branch`.

Must not change: every line and hold case `passGuards` had (`worktree-clean.test.ts:207` and `:226`, the stale holds
lock and the holds file that is not a JSON object; `worktree-session.test.ts:436` and `:508`, the merged worktree this
session holds and the held done worktree whose hold goes); the rebase cases of `cleanDone` and `cleanDropped`; every
dropped-ticket case of `worktree-clean.test.ts` (lines 266-491), whose worktrees are not recorded; Tasks 1, 3 and 4
tests. The prune and its `pruned <path>: <reason>` line stay as they are for every clean in which no missing folder holds
a detached HEAD on no branch, so `worktree-clean.test.ts:152` and `worktree-open.test.ts:166`, whose missing folders
hold branches, pass unchanged; in them the clean prunes first, so `worktreeOpen` finds no missing entry and runs
today's `git worktree add` with no `--force`. Every `worktree open` case of `worktree-open.test.ts` prints and exits as
today. The hook clean of Task 1 still never prunes and still writes its own line. A clean with
no prunable entry spawns nothing new, so the `git-count.test.ts` counts and goldens hold.

## Task 6: The clean never enters or removes a listed worktree, a folder holding .git, the main checkout, a folder that holds one of these, or a worktree with an edit git status cannot see
covers: D-01, D-04
files: packages/cli/src/commands/leftover.ts (new), packages/cli/src/commands/worktree.ts, packages/cli/test/worktree-clean.test.ts (new)
verify: packages/cli/test/worktree-clean.test.ts#risk:data-loss-clean-keeps-a-done-worktree-that-holds-another-listed-worktree, packages/cli/test/worktree-clean.test.ts#risk:data-loss-clean-keeps-a-done-worktree-whose-disposable-folder-holds-a-nested-repository, packages/cli/test/worktree-clean.test.ts#risk:data-loss-clean-keeps-a-done-worktree-holding-an-edit-in-a-skip-worktree-or-assume-unchanged-file, packages/cli/test/worktree-clean.test.ts#risk:data-loss-a-forgotten-folder-holding-a-listed-worktree-or-a-git-folder-is-kept-unchanged

Consumes: `sweepRemoved`, `sweepForgotten`, `passGuards`, `cleanForgotten` and `readList`. Produces: the walk guards
(Approach Should), the nested-repository guard and the flagged-file guard before `git worktree remove`, and
`seen.listed` and `seen.main`, which Task 7 relies on.

Tests first, at the end of `worktree-clean.test.ts`. The last one calls `link`, which makes a junction on the Windows
host and a symlink in the container; every verify id below runs in both places, and the junction case itself is seen
on a Windows run:
- `it('risk:data-loss clean keeps a done worktree that holds another listed worktree')`:
  - `c = copy()`, `claimWorktree(c, 'ST-9')`, and `n = c.sibling('ST-9') + '/node_modules/nested'`.
  - `c.git('worktree', 'add', '-q', '-b', 'scratch', n, 'origin/main')`. It sits in an ignored, disposable folder, where
    `git worktree remove` would delete it.
  - `doneOnRemote(c, ['ST-9'])`. Clean exits 0 and holds `kept ${c.sibling('ST-9')}: it holds the worktree ${n}`.
  - The worktree list still names both, and `n` still holds its tracked files.
- `it('risk:data-loss clean keeps a done worktree whose disposable folder holds a nested repository')`:
  - `c = copy()`, `exclude(c, ['dist/'])`, `claimWorktree(c, 'ST-9')`, and `n = c.sibling('ST-9') + '/dist/pkg'`.
  - `mkdirSync(n, { recursive: true })`, `gitRun(n, 'init', '-q')`, `writeFiles(n, { 'a.txt': 'a\n' })`, then
    `N = commitMsg(n, 'nested work')`, a commit that exists nowhere else.
  - `doneOnRemote(c, ['ST-9'])`. Clean exits 0 and holds `kept ${c.sibling('ST-9')}: dist/pkg/.git`; no line starts
    with `removed ${c.sibling('ST-9')}`.
  - The worktree list still names the sibling, and `gitRun(n, 'rev-parse', 'HEAD').trim()` equals `N`.
- `it('risk:data-loss clean keeps a done worktree holding an edit in a skip-worktree or assume-unchanged file')`
  (`git status`, and so `git worktree remove`, cannot see such an edit; owner's answer "A" to plan round 1 finding 5):
  - `c = copy({ tickets: ['ST-9', 'ST-10'] })`, `claimWorktree(c, 'ST-9')`, `claimWorktree(c, 'ST-10')`.
  - `s9 = c.sibling('ST-9')`: `gitRun(s9, 'update-index', '--skip-worktree', 'ST-9.txt')`, then write `ST-9.txt` there
    as `edited\n`. `s10 = c.sibling('ST-10')`: `gitRun(s10, 'update-index', '--assume-unchanged', 'ST-10.txt')`, then
    write `ST-10.txt` there as `edited\n`.
  - `doneOnRemote(c, ['ST-9', 'ST-10'])`. Clean exits 0 and its lines hold `kept ${s9}: ST-9.txt` and
    `kept ${s10}: ST-10.txt`; no line starts with `removed`.
  - Both siblings are still listed, and both files still read `edited\n`.
- `it('risk:data-loss a forgotten folder holding a listed worktree or a git folder is kept unchanged')`:
  - `c = copy({ tickets: ['ST-9', 'ST-10'] })`, then `worktree open` and `forget` for ST-9 and ST-10.
  - In the ST-9 folder, `c.git('worktree', 'add', '-q', '-b', 'scratch', c.sibling('ST-9') + '/inner', 'origin/main')`
    and `mkdirSync` an `empty` folder.
  - In the ST-10 folder, `mkdirSync` `sub/.git` (empty) and add `link(`${c.root}/accord`, `${c.sibling('ST-10')}/l`)`.
  - `doneOnRemote(c, ['ST-9', 'ST-10'])`, and take `listing` of both folders.
  - Clean exits 0, and its lines hold `kept ${c.sibling('ST-9')}: inner` and `kept ${c.sibling('ST-10')}: sub/.git`.
  - Both listings are unchanged, and `scratch`'s worktree is still listed.

Interface:
- Move `norm` from `worktree.ts:201` to `leftover.ts` as `export const norm`, same body, and import it in `worktree.ts`.
- `SeenList` gains `listed?: Set<string>` and `main?: string`. `readList` adds the `norm`ed path of every entry it
  returns to `seen.listed`, creating the set, and sets `seen.main` to the first entry's path when it is not set. So
  `seen.listed` holds the main checkout and every worktree any list read of this clean returned, with no new git spawn.
- `export function gitInside(root: string, rel: string): string | undefined` in `leftover.ts`. `rel` is a `!! ` path of
  `git status`, its trailing `/` dropped. When `lstatSync(root + '/' + rel)` is not a folder, a link included, return
  `undefined`. Otherwise walk it depth first with `lstatSync`, entries in code-point order, never entering a link. The
  first entry named `.git`, of any type, ends the walk: return its path relative to `root`. Return `undefined` when
  there is none.
- `passGuards`, the ignored-file step of Task 3: when no `!! ` entry keeps the worktree, the first `!! ` entry ending
  in `/` for which `gitInside(w.path, path)` returns a path keeps it with `kept <w.path>: <that path>`, before
  `git worktree remove` runs, which would delete that repository and its unpushed commits.
- `passGuards`, right after that step, the flagged-file guard (owner's answer "A" to plan round 1 finding 5):
  - Run `git(w.path, ['ls-files', '-v', '-z'])`, split on `\0`, empty entries dropped. Each entry is a one-letter tag,
    a space, then the path. A flagged entry has the tag `S` (skip-worktree) or a lower-case tag (assume-unchanged).
  - A flagged entry counts only when `lstatSync(w.path + '/' + path, { throwIfNoEntry: false })` finds it on disk; a
    sparse-checkout `S` entry that is not on disk never counts.
  - For a flagged entry on disk, read its index line with
    `git(w.path, ['ls-files', '-s', '-z', '--', ':(literal)' + path])` (`<mode> <sha> <stage>\t<path>`). The
    `:(literal)` prefix (conventions.md) keeps a name such as `a?.txt` from matching `a1.txt` as a glob, so the sha
    compared is always the flagged file's own. When the mode is `120000`, it counts as differing. Otherwise it differs when
    `git(w.path, ['hash-object', '--', path]).trim()` is not the index sha.
  - The first flagged entry, in git's order, that differs keeps the worktree with `kept <w.path>: <path>`, the path as
    git prints it, before `git worktree remove` runs.
  - Only a worktree of a done or dropped ticket whose `git status` showed nothing to keep reaches this step. Each such
    worktree costs one `ls-files -v` plus two spawns per flagged file on disk; a clean that judges no worktree spawns
    nothing new.
- `sweepRemoved` and `sweepForgotten` gain a last parameter `fenced: readonly string[]` of `norm`ed paths.
  - Before anything else, when `norm(dir)` is in `fenced` or a fenced path starts with `norm(dir) + '/'`, return that
    path relative to `dir`, or `.` for `dir` itself. Nothing is touched.
  - In the walk, a folder whose `norm`ed path is fenced, or is an ancestor of a fenced path, is never entered. It counts
    as a real entry named by its relative path.
  - A folder holding a `.git` entry (`lstatSync(abs + '/.git', { throwIfNoEntry: false })`) is never entered. It counts
    as a real entry named `<rel>/.git`.
  - In `sweepForgotten` a real entry stops the scan before any change, as Task 4 has it. In `sweepRemoved` it is left
    and named.
- `worktree.ts`: no caller reads the list to build `fenced`. `removeWorktree` passes `[...seen.listed]` without
  `norm(w.path)`, the folder it sweeps. `cleanForgotten` passes `[...s.seen.listed]`.
- `passGuards` takes the list its caller already read, `after` in `cleanDone` and `cleanDropped` and `list` in
  `cleanRecorded`, as a new parameter `list: readonly WorktreeEntry[]`. Right after the own-session check, when an entry
  `x` of `list` other than `w` has `norm(x.path)` starting with `norm(w.path) + '/'`, write
  `kept <w.path>: it holds the worktree <x.path>` and return `undefined`. No new git spawn.

Must not change: every earlier task's tests; a clean with no nested folder prints and spawns what it did.

## Task 7: The sibling sweep deletes old leftover folders of done or dropped tickets that were never recorded
covers: D-01, D-04
files: packages/cli/src/commands/worktree.ts, packages/cli/test/worktree-clean.test.ts (new)
verify: packages/cli/test/worktree-clean.test.ts#risk:data-loss-the-sibling-sweep-deletes-an-unrecorded-leftover-of-a-done-ticket-and-keeps-one-holding-a-file

Consumes: `cleanForgotten` with its guards (Tasks 4 to 6), `seen.listed`, `seen.main` and `seen.judged`, and
`s.recorded`. Produces: `cleanSiblings`, which cleans the folders left before the record existed (D-01 part C).

Test first:
- `it('risk:data-loss the sibling sweep deletes an unrecorded leftover of a done ticket and keeps one holding a file')`:
  - `c = copy({ tickets: ['ST-9', 'ST-10', 'ST-11'] })`. No worktree is made and nothing is recorded.
  - `mkdirSync(`${c.sibling('ST-9')}/a/b`, { recursive: true })` and `link(`${c.root}/accord`, `${c.sibling('ST-9')}/node_modules/w`)`.
  - Write `notes.txt` in `c.sibling('ST-10')`, and `mkdirSync(c.sibling('ST-11') + '/a')` with ST-11 not done.
  - `mkdirSync(c.sibling('ST-99') + '/a')`, for an id that is not on `origin/main`.
  - `doneOnRemote(c, ['ST-9', 'ST-10'])`. Clean exits 0.
  - `gone(c.sibling('ST-9'))` with `removed ${c.sibling('ST-9')}` in the lines; `kept ${c.sibling('ST-10')}: notes.txt`
    in the lines, once, and `notes.txt` unchanged; the ST-11 and ST-99 folders exist; `${c.root}/accord/config.yml`
    exists.

Interface, `worktree.ts`: `function cleanSiblings(ctx: CommandContext, ref: string, s: GuardState, fetchFailed: boolean): void`,
called by `worktreeClean` after `cleanRecorded`. It reads no worktree list: `seen.listed` already holds every path the
clean's list reads returned (finding of plan round 1).
1. `main = s.seen.main`; return when it is `undefined`. `parent` is `main` up to its last `/`, and `base` is the name
   after it.
2. `readdirSync(parent, { withFileTypes: true })` in a `try`; a failure returns. Keep the entries that are folders, not
   links, whose name starts with `base + '-'`, and whose path `parent + '/' + name`, under `norm`, is not in
   `s.seen.listed`, is not judged, and is not the path of an entry of `s.recorded`. A folder `removeWorktree` left kept
   in this clean is judged, so it gets no second line. When none is left, return with no git spawn, which keeps the
   `git-count.test.ts` counts.
3. The ticket ids come from origin's default ref (Approach Should):
   `git(ctx.root, ['ls-tree', '-z', '--name-only', ref, '--', 'accord/tickets/'])`, split on `\0`, keeping the stems
   of `/^accord\/tickets\/([^/]+)\.md$/`. Map each lower-cased id to its id, and leave out a lower-cased id that two
   ids share.
4. The candidates: the folders of step 2 whose name is `base + '-' + lower` for a mapped id. When none is left, return.
5. `done` and `dropped` as in `cleanRecorded`, dropped only after a good fetch. For each candidate of a done or dropped
   ticket, sorted by path: `cleanForgotten(ctx, path, s)` with its guards, inside the same `try`/`catch` line as
   `cleanRecorded`.

Must not change: a folder that is a link is never touched; every earlier test, the POSIX part-way test of
`worktree-clean.test.ts:130` and Task 3's part-way test that runs on every OS, with their three lines included; the
clean output and counts of the `git-count.test.ts` sample.

## Task 8: A second clean skips with one line, and the hook clean stops starting removals when its time budget is spent
covers: D-11
files: packages/cli/src/commands/worktree.ts, packages/cli/src/commands/hook.ts, packages/cli/src/commands/fetch-limit.ts, packages/cli/test/worktree-clean.test.ts (new)
verify: packages/cli/test/worktree-clean.test.ts#risk:concurrency-a-clean-that-finds-another-clean-running-skips-with-one-line-and-a-stale-lock-is-taken-over, packages/cli/test/worktree-clean.test.ts#risk:complex-branching-the-hook-clean-starts-no-removal-once-its-time-budget-is-spent-and-says-the-rest-waits

Consumes: `worktreeClean`, `cleanQuietly`, `sessionClean` (Task 1), every phase of Tasks 3 to 7, and `fetchLimitMs`.
Produces: the clean lock (Approach Should) and the time budget (critique fix 5).

Tests first:
- `it('risk:concurrency a clean that finds another clean running skips with one line and a stale lock is taken over')`:
  - `c = copy()`, `claimWorktree(c, 'ST-9')`, `doneOnRemote(c, ['ST-9'])`.
  - `mkdirSync(`${c.root}/.git/accord`, { recursive: true })`, then write `${c.root}/.git/accord/clean.lock` holding
    `String(process.pid)`, a running process. `worktree clean` exits 0
    and its whole output is one line, starting `clean skipped: another accord worktree clean is running`. The sibling
    still exists.
  - Get the pid of a process that has ended: `spawnSync(process.execPath, ['-e', ''])` and its `pid`. Write it to the
    lock. The next clean exits 0, holds `removed ${c.sibling('ST-9')}`, and the lock file is gone afterwards.
- `it('risk:complex-branching the hook clean starts no removal once its time budget is spent and says the rest waits')`:
  - `c = copy()`, `claimWorktree(c, 'ST-9')`, `doneOnRemote(c, ['ST-9'])`, and
    `vi.mocked(limit.cleanBudgetMs).mockReturnValue(0)`.
  - `hook session-start` with the startup input in `c.root` exits 0.
  - Its lines hold `clean stopped: its time budget is spent; the rest waits for the next session start`, and after it
    `tell the owner the lines above`, and no line starts with `removed` or `deleted`.
  - The sibling exists, and `has(c.root, 'refs/heads/t/ST-9')` and `has(c.remote, 'refs/heads/t/ST-9')` are true.

Interface:
- `fetch-limit.ts`: add `export function cleanBudgetMs(): number { return 300_000; }`, with a comment: the hook clean
  starts no new branch, entry or folder after 300 s, well below the hook's 600 s timeout, so the one it started still
  finishes in time. In `worktree-clean.test.ts`, the `vi.mock` of this module (lines 14-17) also wraps `cleanBudgetMs`
  in `vi.fn` like `fetchLimitMs`, and the file's own `afterEach` (Task 3) calls
  `vi.mocked(limit.cleanBudgetMs).mockReset()`, because the `afterEach` of `useSandboxes` resets only `fetchLimitMs`
  and the other `worktree-*.test.ts` files do not mock `cleanBudgetMs`. Import
  `* as limit from '../src/commands/fetch-limit.js'` there.
- `worktree.ts`, clean lock:
  - `worktreeClean` takes the lock first. The lock is `<accord dir>/clean.lock`, read once into `state.accord` (Task 4).
    Make the folder with `mkdirSync(dir, { recursive: true })`, open the lock with `openSync(lock, 'wx')` and write
    `process.pid`.
  - On `EEXIST`, read the pid. The lock is stale when that pid no longer runs (`process.kill(pid, 0)` throws `ESRCH`) or
    when the file is older than one hour by `mtimeMs`. A stale lock is removed with `rmSync(lock, { force: true })`, and
    the open is tried once more.
  - When the lock is held, or the second open meets `EEXIST`, write
    `clean skipped: another accord worktree clean is running (pid <pid>)` and return 0.
  - Release the lock in a `finally`: `closeSync`, then `rmSync(lock, { force: true })`.
  - `cleanQuietly` and the bare clean both go through it.
- `worktree.ts`, budget: `worktreeClean` takes `until?: number` in its options, kept as `GuardState.until`, with
  `GuardState.stopped?: boolean`. `cleanQuietly`'s options object of Task 1 gains `until?: number` and passes it on.
  `function spent(ctx, s): boolean` returns false when `until` is undefined. It returns true when `stopped` is already
  set. When `Date.now() >= until`, it writes the `clean stopped: ...` line once, sets `stopped` and returns true.
  Call it once per unit of work, never between two steps of the same unit:
  - as the first statement inside the `try` of each branch's turn in the loops of `cleanDone` and `cleanDropped`.
    Once a branch's turn has started, its worktree removal, its local-branch `update-ref -d` and its origin delete push
    all run. A stop between the origin delete push and the local delete would leave a local branch that every next
    clean keeps with a wrong `commits not on origin` reason;
  - before each entry of `cleanRecorded` and each candidate of `cleanSiblings`.
  On true, the phase returns at once, and `worktreeClean` runs none of the phases after it. When `until` is set, each
  origin delete push passes `fetchLimitMs()` as `gitNoPrompt`'s timeout, so a hung push fails with today's
  `kept origin/<b>: git push failed` line.
- `hook.ts` `sessionClean`: `until = Date.now() + cleanBudgetMs()`, taken before `fetchOrigin`, and passed as
  `cleanQuietly(f.ctx, f.fetched, undefined, { hook: true, until })`.

Must not change: a bare `accord worktree clean` and the clean inside `worktree open` and `new ticket --worktree` have no
budget and print what they printed; the holds lock is separate from the clean lock; every earlier test.

## Task 9: The worktree reference and the finish report say that a session start cleans a merged ticket, and the copies are re-rendered
covers: D-02, D-05, D-10, D-11
files: packages/core/skills/accord/worktree.md, packages/core/skills/shared/finish.md, packages/core/src/generated/skills.ts, .claude/skills/accord/worktree.md, .claude/skills/accord-debug/worktree.md, .claude/skills/accord-verify/worktree.md, .claude/skills/accord/finish.md, .claude/skills/accord-verify/finish.md, .claude/settings.json, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#risk:regression-the-worktree-reference-and-the-finish-report-say-a-session-start-cleans-a-merged-ticket-and-nobody-removes-it-by-hand

Consumes: the lines of Tasks 1 and 3 to 8 and the hook timeout of Task 1. Produces: the text an agent follows, and
`.claude/settings.json` carrying `"timeout": 600` on both SessionStart hooks. This ticket does not touch
`verify/ci.md` or the no-Vietnamese test (D-02), merged non-ticket branches, agent worktrees, or the benchmark's clean
(D-05, D-10).

Test first, top level at the end of `packages/core/test/stage-skills.test.ts`, using its `files` and the whitespace
flattening of `stage-skills.test.ts:835`:
- `it('risk:regression the worktree reference and the finish report say a session start cleans a merged ticket and nobody removes it by hand')`:
  - For each of `.claude/skills/accord/worktree.md`, `.claude/skills/accord-debug/worktree.md` and
    `.claude/skills/accord-verify/worktree.md`, the flat text contains `` `clean skipped` or `clean stopped` ``,
    `` A `kept <folder>: <file>` line names a file accord never deletes ``, `every session start, resume or /clear runs the same clean`
    and `` `tell the owner the lines above` ``. It also still contains `` `removed`, `deleted` or `kept` `` and
    `` only from `/accord` with no argument and from `/accord upgrade` ``.
  - For each of `.claude/skills/accord/finish.md` and `.claude/skills/accord-verify/finish.md`, the flat text contains
    `Never wait for the merge, and never remove the ticket's worktree or branches by hand`.

Text:
- `packages/core/skills/accord/worktree.md`, the bullet at lines 43-44, becomes, wrapped like its neighbours:
  "- Lines starting `removed`, `deleted` or `kept`, or `clean failed`, `clean skipped` or `clean stopped`: the clean of
  tickets done or dropped on the default branch. A `kept <folder>: <file>` line names a file accord never deletes, so
  that folder stays until the owner moves or deletes the file. Show them verbatim and go on."
- The same file, lines 80-83: after the sentence ending "loses its worktree and branches at any `/accord` command.",
  add: "In a tool that runs accord's session-start hook, every session start, resume or /clear runs the same clean, so
  a ticket merged since the last session loses its worktree, its branches and any folder left behind with nobody typing
  a command; the hook ends its clean lines with `tell the owner the lines above`, so show them to the owner in your
  first reply." Nothing else in the file changes.
- `packages/core/skills/shared/finish.md`: append, after item 3, the paragraph "After this message, end the turn.
  Never wait for the merge, and never remove the ticket's worktree or branches by hand: once the owner merges the pull
  request, the next session start, resume or /clear, or the next `/accord`, removes them." (D-11: no session waits for a
  merge.)
- Regenerate from the repository root, in this order: `npm run gen`, `npm run build`, then
  `node packages/cli/dist/cli.js skills sync` (conventions.md). Any file `skills sync` rewrites beyond those on the
  `files:` line is kept as written and named in the report.
- Then run `npx vitest run packages/core/test/stage-skills.test.ts packages/core/test/skills.test.ts packages/cli/test/skill-commands.test.ts packages/cli/test/skills-sync.test.ts`.

Must not change: every phrase `stage-skills.test.ts:820-831` and `:834-852` asserts, and the anchor
text "Lines starting `removed`" that `stage-skills.test.ts:868` looks for; the three-part shape of the finish message; no rendered text names a
runtime product or a `packages/` path.
