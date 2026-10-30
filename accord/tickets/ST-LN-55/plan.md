---
baseline: 995a87c98600c6c9d286aaf16158dcbb6b409928
plan_hash: "fnv1a64:e044d041035ece48"
---

Review mode `outcome`: one branch, no slices. Each task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: Task 1 is the wiring. The session-start hook runs `accord worktree clean` in the foreground after its usual
output, and ac-2 proves it end to end with a merged ticket, a dead hold and a live hold. The hook clean never prunes the
record of a worktree whose folder is missing. Task 2 adds the `disposable:` key to config.yml. Task 3 makes clean check
ignored files before `git worktree remove`, and print `removed` only once the folder is gone (ac-1). Task 4 records each
worktree accord creates and deletes a recorded folder git has forgotten (ac-3). Task 5 adds the hold guard for any live
hold and the detached-HEAD rule (critique fixes 1 and 2). Task 6 adds the walk guards, with a nested repository in a
disposable folder and an edit hidden by a skip-worktree or assume-unchanged flag kept before `git worktree remove`. Task 7 adds the sibling sweep for leftovers that were never recorded (D-01 part C). Task 8
adds the clean lock and the hook's time budget (fix 5). Task 9 updates the skill text and re-renders the copies and the
hooks in `.claude/settings.json`.

Rules for every task:
- Test ids: every test this plan writes is a top-level `it(...)` with no `describe` around it. Its report id is the
  test file's path from the repository root, then `#`, then the `it` title with each run of whitespace turned into
  `-`. No test title holds `@`, a comma or an apostrophe. No existing test is renamed.
- Every test that builds a clone passes `120_000` as the third argument of `it`, except the ac-2 test, which builds
  three clones and passes `300_000`.
- A test commits through `commitMsg` or `mergeMsg` from `packages/cli/test/helpers/repo.ts`, never `-m`
  (conventions.md). A new test does not call `ticketWorktree`, `ticketBranch` or `verifyStage` from `worktree.test.ts`,
  because those commit with `-m`.
- CLI tests import core from `packages/core/dist`. After any change under `packages/core/`, run
  `npm run build -w packages/core` before a CLI test. Run one file with `npx vitest run <path>`. On Windows, follow
  conventions.md on `ACCORD_BASH`. End every task with `npm run build`, `npm run lint` and `npm run typecheck`, then
  run the test files the task names, plus `packages/cli/test/worktree.test.ts`, `packages/cli/test/hook.test.ts` and
  `packages/cli/test/git-count.test.ts` for every task that edits `worktree.ts` or `hook.ts`.
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
  `dropped`, as `cleanDone` decides (`worktree.ts:868`). Dropped on `ref`: in `droppedOn(root, ref, ids)`.
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

Shared test file `packages/cli/test/worktree-clean.test.ts` (new, made by Task 1). It starts like
`worktree.test.ts:13-69`: the same `vi.mock` of `../src/load/proc.js` and `../src/commands/fetch-limit.js`, a
`TEMPLATE_OPTS` list with one template per set of options built in `beforeAll` (`180_000`), a `copy(opts)` that takes a
`copyClone` of a template and pushes it to a list, and an `afterEach` that resets the two mocks, unstubs envs and calls
`cleanupAll()` on every clone. Each task adds the template options it needs to `TEMPLATE_OPTS`.

Shared test helper file `packages/cli/test/helpers/done.ts` (new, made by Task 1; Tasks 3, 4 and 5 add to it):
- `DEAD = { tool: 'Claude Code', marker: 'sess-D', pid: 4141, start: 'S1', taken: '2026-10-18T00:00:00.000Z' }` and
  `LIVE`, the same with `marker: 'sess-H', pid: 4242, start: 'S2'`. `ALIVE = [{ pid: process.pid, ppid: 1, start: 'self' }, { pid: 4242, ppid: 1, start: 'S2' }]`,
  the process table in which `LIVE` runs and `DEAD` does not.
- `lines(s)`: the non-empty lines of `s`. `has(dir, ref)`: whether `gitRun(dir, 'rev-parse', '--verify', '-q', ref)`
  succeeds. `gone(p)`: the definition above.
- `writeHolds(c, holds)` and `readHolds(c)`: the JSON file `${c.root}/.git/accord/holds`, as `worktree.test.ts:397-401`.
- `claimWorktree(c, id, files = { [`${id}.txt`]: id + '\n' })`:
  `c.git('worktree', 'add', '-q', '-b', `t/${id}`, c.sibling(id), 'origin/main')`, `writeFiles(c.sibling(id), files)`,
  `commitMsg(c.sibling(id), id)`, then `gitRun(c.sibling(id), 'push', '-q', '-u', 'origin', `t/${id}`)`. Returns the sha.
- `doneOnRemote(c, ids)`: the logic of `worktree.test.ts:421-462` and `1997-2010` without the `squash` and `local`
  options, with every commit made through `commitMsg` and every merge through `mergeMsg`. In `o = c.otherClone()`, for
  each id: when `origin/t/<id>` exists, `switch -q --detach origin/t/<id>`; write the verify-stage files and commit
  them; `v = rev-parse HEAD`; write the done ticket of `doneTicket(id, v)` (`worktree.test.ts:421`) and commit
  `verify: <id>`; when on a branch, push that tip to `refs/heads/t/<id>`, `switch -q main` and `mergeMsg` the tip into
  `main`. Then one push of `main` and the branch refspecs. `c` does not fetch.

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
files: packages/cli/src/commands/leftover.ts (new), packages/cli/src/commands/worktree.ts, packages/cli/test/helpers/done.ts (new), packages/cli/test/worktree-clean.test.ts (new), packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree-clean.test.ts#ac-1-clean-removes-a-done-ticket-worktree-completely-and-keeps-and-names-one-holding-an-ignored-env-file (@ac-1), packages/cli/test/worktree-clean.test.ts#risk:data-loss-clean-keeps-a-worktree-holding-an-ignored-env-file-when-status-shows-no-untracked-files, packages/cli/test/worktree-clean.test.ts#risk:regression-a-folder-git-reports-removed-but-leaves-links-and-disposable-files-in-is-deleted-before-removed-is-printed, packages/cli/test/worktree.test.ts#risk:complex-branching-a-worktree-remove-that-fails-part-way-removes-it-in-part-and-names-what-is-left

Consumes: `AccordConfig.disposable` (Task 2), `folderLine` (Task 1), `passGuards` and `removeWorktree`. Produces:
`leftover.ts` with `DEFAULT_DISPOSABLE`, `isDisposable` and `sweepRemoved`; the ignored-file guard; the `removed` and
kept lines after a removal. Tasks 4 to 7 reuse them.

Tests first. Add to `helpers/done.ts`:
- `exclude(c, patterns)`: append each pattern and `\n` to `${c.root}/.git/info/exclude`, which every worktree reads.
- `link(target, at)`: `mkdirSync(dirname(at), { recursive: true })`, then
  `symlinkSync(target, at, process.platform === 'win32' ? 'junction' : 'dir')`. A junction needs no admin right.
- `listing(dir)`: the sorted lines of a walk with `lstatSync` that never follows a link: `<rel> -> <readlinkSync>` for a
  link, `<rel>/` for a folder, and `<rel>: <content>` for a file.

At the top of `worktree-clean.test.ts`, add the spawn wrapper `git-count.test.ts:19` uses:
`vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig<typeof import('node:child_process')>()));`,
and import `spawnLog` from `./helpers/git-spawns.js`. With `spawnLog.on` false, the wrapper passes every call through
unchanged (`git-spawns.ts:31`). With it true, `spawnLog.after` runs after each git call that returned
(`git-spawns.ts:42-51`). The `afterEach` also sets `spawnLog.on = false`, `spawnLog.after = undefined` and
`spawnLog.calls = []`.

Add `{}` to `TEMPLATE_OPTS`. Tests:
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
- `it('risk:regression a folder git reports removed but leaves links and disposable files in is deleted before removed is printed')`.
  This is the bug of 2026-10-30: Git for Windows leaves npm's junctions behind and exits 0. On POSIX git unlinks a
  symlink itself, so the test rebuilds that leftover right after git's own remove returns, on every OS:
  - `c = copy()`, `claimWorktree(c, 'ST-9')`, `doneOnRemote(c, ['ST-9'])`.
  - `spawnLog.after = (args) => { if (args[0] === 'worktree' && args[1] === 'remove') { const p = args[2]; link(`${c.root}/accord`, `${p}/node_modules/@x/ws`); mkdirSync(`${p}/a/b`, { recursive: true }); writeFiles(p, { 'dist/index.js': 'x' }); } }`,
    then `spawnLog.on = true`.
  - `worktree clean` exits 0. `gone(c.sibling('ST-9'))`; `lines(r.out)` holds `removed ${c.sibling('ST-9')}` and no line
    starting `kept ${c.sibling('ST-9')}`; `${c.root}/accord/config.yml` still exists, so the link was not followed.
  - At the baseline this fails on every OS: clean prints `removed` while the folder still exists.
- `worktree.test.ts:590`, the POSIX-only part-way test, keeps its name and setup. git stops at its first failed entry
  in readdir order, so what it leaves differs by file system. Its line checks become: `lines(q.out)` has length 3;
  `lines(q.out)[0]` starts with `kept ${d.sibling('ST-9')}: `; lines 1 and 2 stay as they are; and
  `${d.sibling('ST-9')}/sub/f.txt` still exists. Drop the `in part` and `delete what is left of the folder by hand`
  checks. Everything else in it stays.

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
- `worktree.ts` `passGuards`, the uncommitted-work step (`worktree.ts:684`):
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
(`worktree.test.ts:486`), whose `node_modules/x` is disposable; the locked-worktree failure case
(`worktree.test.ts:574`); every dropped-ticket case; the spawn count of a clean that removes nothing.

## Task 4: Accord records each worktree it creates, and clean deletes a recorded folder git has forgotten when it holds only links and empty folders
covers: @ac-3, D-01, D-04, D-06, D-07
files: packages/cli/src/commands/worktree.ts, packages/cli/src/commands/leftover.ts (new), packages/cli/test/helpers/done.ts (new), packages/cli/test/worktree-clean.test.ts (new)
verify: packages/cli/test/worktree-clean.test.ts#ac-3-a-session-start-in-a-worktree-and-a-clear-in-the-main-checkout-delete-the-recorded-folder-of-a-done-ticket-that-git-forgot (@ac-3), packages/cli/test/worktree-clean.test.ts#risk:data-loss-a-forgotten-folder-holding-a-dist-file-or-a-recorded-path-that-is-a-link-is-kept-unchanged-and-named

Consumes: Task 1's hook clean and `folderLine`, and Task 3's `removeWorktree` and `leftover.ts`. Produces: the record
(D-07), written at the three places accord creates a worktree; `cleanRecorded`; `cleanForgotten`; `sweepForgotten`.
Tasks 5 to 8 extend them. `gate done` gets no worktree check (D-07). Part (D) stays in this ticket (D-06, D-10).

Tests first. Add to `helpers/done.ts`:
- `forget(c, id)`: `c.git('worktree', 'remove', '--force', c.sibling(id))`, then `mkdirSync(c.sibling(id))`. This leaves
  a folder git no longer lists.
- `recorded(c)`: the lines of `${c.root}/.git/accord/worktrees` as `{ id, path }`, or `[]` when the file is missing.

Add `{ tickets: ['ST-9', 'ST-10', 'ST-11'] }` to `TEMPLATE_OPTS`. Tests:
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
  `worktree.ts:412` and after `worktree.ts:438`, and `newTicketWorktree` after `worktree.ts:1058`.
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
files: packages/cli/src/commands/worktree.ts, packages/cli/test/helpers/done.ts (new), packages/cli/test/worktree-clean.test.ts (new)
verify: packages/cli/test/worktree-clean.test.ts#risk:data-loss-clean-keeps-a-recorded-detached-worktree-whose-head-is-on-no-branch-and-removes-one-at-the-default-branch, packages/cli/test/worktree-clean.test.ts#risk:data-loss-clean-never-removes-a-recorded-worktree-on-another-branch-or-a-folder-a-live-hold-names, packages/cli/test/worktree-clean.test.ts#risk:complex-branching-clean-names-a-recorded-worktree-of-a-dropped-ticket-whose-branch-is-already-on-the-default-branch

Consumes: Task 4's `cleanRecorded`, `cleanForgotten` and record, plus `passGuards`, `removeWorktree`, `rebaseBranch`
and `folderLine`. Produces: critique fixes 1 and 2, and a kept line for every recorded worktree of a done or dropped
ticket that no other phase judges (D-07: "printing the ones it cannot").

Tests first. Add to `helpers/done.ts` `dropOnRemote(c, ids)`, the body of `worktree.test.ts:1657-1664` (it already
commits through `commitMsg`), with `laneTicket` and `LANE_BODY` imported from `../../../../test/helpers/lane.js`. Add
`{ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] }` to `TEMPLATE_OPTS`.
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

Interface, `worktree.ts`:
- Split the lazy holds read out of `passGuards` (`worktree.ts:689-700`) into
  `function guardHolds(ctx, s): Record<string, Hold> | undefined`. It returns `undefined` after the same `its hold could
  not be read` line, now naming the folder it was asked for.
- `function heldElsewhere(ctx: CommandContext, path: string, skip: string | undefined, s: GuardState): string | undefined`.
  For each hold whose key is not `skip` and whose `folder` equals `path` under `norm`, apply the same tests `passGuards`
  applies to the id's hold (`worktree.ts:702-721`):
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
    `cleanDropped` leaves such a branch (`worktree.ts:963-968`) and `cleanDone` judges only done tickets, so without
    this line clean would say nothing (D-07, ledger Ruling);
  - `W.branch === branchOf(ctx.snapshot, id)` otherwise: nothing here, because `cleanDone` and `cleanDropped` judge it;
  - `W.branch` is another branch: `kept <path>: checked out on <W.branch>`. Clean never removes by path a worktree on a
    branch (fix 2, second half);
  - detached, and `rebaseBranch(W.path) !== undefined`: `kept <path>: being rebased`;
  - detached, and `W.head` is in `merged`, or `merge-base --is-ancestor W.head ref` succeeds, or
    `git for-each-ref --points-at <W.head> --format=%(refname) refs/heads refs/remotes/origin` prints a line: then
    `g = passGuards(ctx, W, id, s)`, and when it passes, `removeWorktree(ctx, W, id, g.h, s.seen)`, which drops the
    record entry (fix 1);
  - detached otherwise: `kept <path>: its detached HEAD <W.head> is on no branch`.

Must not change: every line and hold case `passGuards` had (`worktree.test.ts:761`, `780`, `1413` and `1485`); the
rebase cases of `cleanDone` and `cleanDropped`; every dropped-ticket case of `worktree.test.ts`, whose worktrees are
not recorded; Tasks 1, 3 and 4 tests.

## Task 6: The clean never enters or removes a listed worktree, a folder holding .git, the main checkout, a folder that holds one of these, or a worktree with an edit git status cannot see
covers: D-01, D-04
files: packages/cli/src/commands/leftover.ts (new), packages/cli/src/commands/worktree.ts, packages/cli/test/worktree-clean.test.ts (new)
verify: packages/cli/test/worktree-clean.test.ts#risk:data-loss-clean-keeps-a-done-worktree-that-holds-another-listed-worktree, packages/cli/test/worktree-clean.test.ts#risk:data-loss-clean-keeps-a-done-worktree-whose-disposable-folder-holds-a-nested-repository, packages/cli/test/worktree-clean.test.ts#risk:data-loss-clean-keeps-a-done-worktree-holding-an-edit-in-a-skip-worktree-or-assume-unchanged-file, packages/cli/test/worktree-clean.test.ts#risk:data-loss-a-forgotten-folder-holding-a-listed-worktree-or-a-git-folder-is-kept-unchanged

Consumes: `sweepRemoved`, `sweepForgotten`, `passGuards`, `cleanForgotten` and `readList`. Produces: the walk guards
(Approach Should), the nested-repository guard and the flagged-file guard before `git worktree remove`, and
`seen.listed` and `seen.main`, which Task 7 relies on.

Tests first:
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
  - For a flagged entry on disk, read its index line with `git(w.path, ['ls-files', '-s', '-z', '--', path])`
    (`<mode> <sha> <stage>\t<path>`). When the mode is `120000`, it counts as differing. Otherwise it differs when
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
`worktree.test.ts:590` with its three lines included; the clean output and counts of the `git-count.test.ts` sample.

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
  finishes in time. The test file's `vi.mock` of this module wraps it in `vi.fn` like `fetchLimitMs`, and its
  `afterEach` resets it too.
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
