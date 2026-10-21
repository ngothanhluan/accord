---
baseline: d5586db44dabc62b93ae03f969c12c4dbcfaad3f
plan_hash: "fnv1a64:032e2ff508ebd1de"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: Task 1 is the wiring. It adds the core section writer and `accord drop`, which reads the claim tip, writes the
record, commits it without a checkout, and pushes `drop/<id>`. ac-1 and ac-2 prove it end to end against a bare remote.
Task 2 adds the refusals drop must make before it pushes anything. Task 3 adds the dropped-ticket path to
`accord worktree clean` (ac-3, ac-4). Task 4 makes clean safe when its fetch failed, when the lease is stale, and when
another clone already cleaned (D-13). Task 5 refuses pick-up of a dropped ticket (D-16). Task 6 rewrites step 1 of
`ids.md` (ac-5) and re-renders the skill copies.

Rules for every task:
- Test ids: every test this plan writes is a top-level `it(...)` with no `describe` around it. Its report id is the
  test file's path from the repository root, then `#`, then the `it` title with each run of whitespace turned into
  `-`. No test title holds `@`, a comma or an apostrophe. No existing test is renamed.
- A test that makes a commit or a merge commit does it through `commitMsg` or `mergeMsg` from
  `packages/cli/test/helpers/repo.ts` (Tasks 1 and 3 add them), which commit with `-F <file> --cleanup=verbatim`,
  never `-m` (conventions.md). New tests do not call the existing `ticketWorktree`, `ticketBranch` or `mergeOnRemote`
  helpers of `worktree.test.ts`, because those commit with `-m`.
- Every test that builds a clone passes `120_000` as the third argument of `it`. It gets its clones from the
  file's existing `clone()` wrapper in `worktree.test.ts`, or in `drop.test.ts` from `makeClone` with every clone
  pushed to a list that an `afterEach` empties through `cleanupAll()`.
- CLI tests import core from `packages/core/dist`. After any change under `packages/core/`, run
  `npm run build -w packages/core` before running a CLI test. Run one file with `npx vitest run <path>`. End every
  task with `npm run build`, `npm run lint` and `npm run typecheck`, then run the test files the task names.
- Every `git log` and `git show` in `packages/cli/src` is written `'-c', 'log.showSignature=false', 'show', '--no-show-signature', ...`.
  The literal `'show'` or `'log'` is directly preceded by `'-c', 'log.showSignature=false', ` and directly followed by
  `, '--no-show-signature',`, because `packages/cli/test/spawn-surface.test.ts:84-100` checks that exact text. Every
  spawn passes a 64 MiB `maxBuffer` when its output can grow with the repository. Every spawn is
  `execFileSync('git', [...])` with a literal array, never a shell.
- Files are LF with no BOM. Add no dependency. Every printed path uses `/`. Core (`packages/core/src`) imports no
  `node:` module.

Definitions shared by every task:
- The default ref: `gitDefaultRef(root)` (`packages/cli/src/load/fs.ts:712`), the ref clean already reads (ledger
  Ruling 2, D-15). Its short name is the ref with `refs/remotes/origin/` removed (`main`, or `trunk` when origin's HEAD
  names `trunk`).
- X's claim branch `b`: `branchOf(ctx.snapshot, X)` (`packages/cli/src/commands/worktree.ts:39`). `L` is the sha of
  `refs/heads/<b>` when it resolves. `R` is the sha of `refs/remotes/origin/<b>` when it resolves.
- `isAncestor(a, c)`: `gitOk(root, ['merge-base', '--is-ancestor', a, c])`.

## Task 1: Wiring: accord drop pushes a branch from the default branch holding only the ticket file set to dropped
covers: @ac-1, @ac-2, D-01, D-02, D-04, D-05, D-06, D-10, D-14, D-15
files: packages/core/src/write/dropped.ts (new), packages/core/src/index.ts, packages/core/test/dropped.test.ts (new), packages/cli/src/commands/drop.ts (new), packages/cli/src/commands/worktree.ts, packages/cli/src/run.ts, packages/cli/test/skill-commands.test.ts, packages/cli/test/helpers/repo.ts, packages/cli/test/drop.test.ts (new)
verify: packages/core/test/dropped.test.ts#risk:parsing-the-dropped-writer-replaces-or-places-the-section-and-reads-a-reason-already-written, packages/cli/test/drop.test.ts#ac-1-dropping-a-ticket-pushes-a-branch-from-the-default-branch-whose-only-change-is-the-ticket-file-set-to-dropped (@ac-1), packages/cli/test/drop.test.ts#ac-2-dropping-without-a-reason-is-refused-and-nothing-is-created-committed-or-pushed (@ac-2), packages/cli/test/drop.test.ts#risk:data-loss-drop-pushes-a-crlf-ticket-file-with-a-bom-byte-for-byte-outside-the-status-value-and-the-dropped-section, packages/cli/test/drop.test.ts#risk:complex-branching-drop-reads-the-claim-tip-that-holds-the-other-refuses-diverged-tips-and-falls-back-to-the-default-branch

Consumes: `setFrontmatterKey` (`packages/core/src/write/frontmatter.ts`), `normaliseText` and `splitFrontmatter`
(`packages/core/src/load/frontmatter.ts`), and `scan`, `headingKey` and `stripHtmlComments`
(`packages/core/src/load/sections.ts`). It also uses `git`, `gitOk`, `branchOf`, `listWorktrees` and `gitNoPrompt` from
`worktree.ts`, and `gitDefaultRef` and `UsageError` from `load/fs.ts`.
Produces: core `markDropped`; the command `accord drop <id> [--reason <reason>]`; the exported `gitNoPrompt` and `ID`;
the test helper `commitMsg`. Task 2 adds the refusals and Task 6 tells the skill to run the command.

Tests first.

`packages/core/test/dropped.test.ts` (new), importing `markDropped` from `../src/index.js` and `laneTicket`,
`LANE_BODY` from `../../../test/helpers/lane.js`:
- `it('risk:parsing the dropped writer replaces or places the section and reads a reason already written')`. With
  `T = (body) => laneTicket('T-1', { body })` and `S = (t) => t.replace('status: open', 'status: "dropped"')`, each
  case below is one `expect(...).toBe(...)`:
  - At the end: `markDropped(T(LANE_BODY), 'no longer needed')` is `S(T(LANE_BODY)) + '\n## Dropped\nno longer needed\n'`.
    `LANE_BODY` ends in a single `\n`, so one blank line comes before the heading.
  - Replaced in the middle: body `B1 = '## Intent\nx\n\n## Dropped\nold reason\nmore\n\n## Approach\ny\n'` with
    reason `'new'` gives `S(T('## Intent\nx\n\n## Dropped\nnew\n\n## Approach\ny\n'))`.
  - Before the notes (ledger Ruling 11): body `'## Intent\nx\n\n## Verification notes\nn\n'` with reason `'r'`
    gives `S(T('## Intent\nx\n\n## Dropped\nr\n\n## Verification notes\nn\n'))`.
  - Read from the file (D-04): `markDropped(T(B1))` with no reason gives `S(T(B1))`.
  - No reason anywhere: `markDropped(T(LANE_BODY))`, and the same with body `'## Intent\nx\n\n## Dropped\n<!-- why -->\n'`,
    are `undefined`.
  - Fence-aware: body `'## Intent\nx\n\n## Acceptance criteria\n```gherkin\n## Dropped\nFeature: a\n```\n'` with no
    reason is `undefined`, because the heading inside the fence is not a section.

`packages/cli/test/drop.test.ts` (new). It imports `makeClone` and `Clone` from `./helpers/worktree.js`, `gitRun`,
`run`, `writeFiles` and `commitMsg` from `./helpers/repo.js`, `laneTicket` and `LANE_BODY` from
`../../../test/helpers/lane.js`, and `loadSnapshot` from `@accord-dev/accord-core`.
`ticketWith(intent)` is `laneTicket('ST-10', { body: LANE_BODY.replace('as CSV.', 'as CSV, ' + intent + '.') })`.
"Write the Intent `Y`" below means: write `accord/tickets/ST-10.md` as `ticketWith('Y')` in that clone.
Shared setup `claimOnBranch(c, intent)`:
- `c.git('switch', '-q', '-c', 't/ST-10')`, then write `accord/tickets/ST-10.md` as `ticketWith('first')`. Also write
  `accord/tickets/ST-10/plan.md` as `'# plan\n'` and `src/a.ts` as `'a\n'`, then `commitMsg(c.root, 'claim: ST-10')`.
- Write the Intent `intent` and `commitMsg(c.root, 'work')`.
- `c.git('push', '-q', '-u', 'origin', 't/ST-10')`.
- Return the ticket text written last (`tip`).

`remoteDrop(c, id)` is `gitRun(c.remote, 'rev-parse', '--verify', '-q', 'refs/heads/drop/' + id)`, wrapped so that a
failure returns `undefined`.
- `it('ac-1 dropping a ticket pushes a branch from the default branch whose only change is the ticket file set to dropped')`:
  - Setup: `c = makeClone()` (ST-9 on main), `tip = claimOnBranch(c, 'second')`, then write `src/a.ts` as `'changed\n'`
    and leave it uncommitted. `head = c.git('rev-parse', 'HEAD')`.
  - `run(['drop', 'ST-10', '--reason', 'no longer needed'], c.root)` exits 0 and `out` is exactly
    `'branch: drop/ST-10\nbase: main\ntitle: drop: ST-10\n'`.
  - `D = remoteDrop(c, 'ST-10')`. `gitRun(c.remote, 'rev-list', '--parents', '-n', '1', D)` names exactly one parent,
    equal to `gitRun(c.remote, 'rev-parse', 'main')`.
  - `gitRun(c.remote, 'diff', '--name-only', 'main', D)` is `'accord/tickets/ST-10.md\n'`, so neither `src/a.ts` nor
    `accord/tickets/ST-10/plan.md` is there (D-04).
  - `gitRun(c.remote, 'cat-file', 'blob', D + ':accord/tickets/ST-10.md')` is
    `tip.replace('status: open', 'status: "dropped"') + '\n## Dropped\nno longer needed\n'`.
  - `gitRun(c.remote, 'cat-file', 'commit', D)` contains `'\n\ndrop: ST-10\n'`.
  - The clone is untouched: `c.git('rev-parse', 'HEAD')` equals `head`, `c.git('status', '--porcelain')` is
    `' M src/a.ts\n'`, and `c.git('for-each-ref', 'refs/heads/drop')` is `''` (ledger Ruling 9).
- `it('ac-2 dropping without a reason is refused and nothing is created committed or pushed')`:
  - Setup: `c = makeClone()`, `claimOnBranch(c, 'second')`. Record `heads = gitRun(c.remote, 'for-each-ref')` and
    `head = c.git('rev-parse', 'HEAD')`.
  - For each argv of `['drop', 'ST-10']`, `['drop', 'ST-10', '--reason', '   ']` and
    `['drop', 'ST-10', '--reason', 'a\nb']`: the run exits 2 and `err` contains `--reason`.
  - After all three: `gitRun(c.remote, 'for-each-ref')` equals `heads`, `c.git('for-each-ref', 'refs/heads/drop')` is
    `''`, `c.git('rev-parse', 'HEAD')` equals `head`, and `c.git('status', '--porcelain')` is `''`.
- `it('risk:data-loss drop pushes a crlf ticket file with a bom byte for byte outside the status value and the dropped section')`:
  - `c = makeClone()`, then `c.git('config', 'core.autocrlf', 'false')` and `c.git('switch', '-q', '-c', 't/ST-10')`.
  - Write `accord/tickets/ST-10.md` as `crlf = '﻿' + laneTicket('ST-10').replaceAll('\n', '\r\n')`, then
    `commitMsg` and `push -q -u origin t/ST-10`.
  - `run(['drop', 'ST-10', '--reason', 'no longer needed'], c.root)` exits 0.
  - The pushed blob, read with `cat-file blob`, is
    `crlf.replace('status: open', 'status: "dropped"') + '\r\n## Dropped\r\nno longer needed\r\n'`.
- `it('risk:complex-branching drop reads the claim tip that holds the other refuses diverged tips and falls back to the default branch')`
  (ledger Ruling 14, D-10, D-15). `blob(c, id)` reads the pushed `drop/<id>` file with `cat-file blob`, and
  `undrop(c, id)` is `c.git('push', '-q', 'origin', '--delete', 'drop/' + id)`.
  - Local ahead: `c = makeClone()` and `claimOnBranch(c, 'A')`. Write the Intent `B`, `commitMsg(c.root, 'B')`, and
    do not push. The drop exits 0, `blob(c, 'ST-10')` contains `as CSV, B.`, then
    `undrop`.
  - Origin ahead: `c.git('push', '-q')`. Then make `o = c.otherClone()`, `gitRun(o, 'switch', '-q', 't/ST-10')`,
    write the Intent `C`, `commitMsg(o, 'C')` and `gitRun(o, 'push', '-q')`. The drop from `c.root`
    exits 0 and the blob contains `as CSV, C.`. Then `undrop`.
  - Diverged: in `c`, write the Intent `D` and `commitMsg(c.root, 'D')`. The drop exits 2 with `err`
    containing `diverged`, and `remoteDrop(c, 'ST-10')` is `undefined`.
  - No claim branch (D-10): `run(['drop', 'ST-9', '--reason', 'gone'], c.root)` exits 0. `blob(c, 'ST-9')` equals
    `laneTicket('ST-9').replace('status: open', 'status: "dropped"') + '\n## Dropped\ngone\n'`.
  - Another default branch (D-15): `d = makeClone()`. Run `gitRun(d.remote, 'branch', '-m', 'main', 'trunk')` and
    `gitRun(d.remote, 'symbolic-ref', 'HEAD', 'refs/heads/trunk')`, then `d.git('fetch', '-q', 'origin')` and
    `d.git('remote', 'set-head', 'origin', 'trunk')`. `run(['drop', 'ST-9', '--reason', 'gone'], d.root)` exits 0 and
    `out` contains `'base: trunk\n'`. The one parent of `drop/ST-9` on `d.remote` equals `rev-parse trunk` there.

Interface:
- `packages/core/src/write/dropped.ts`:
  `export function markDropped(text: string, reason?: string): string | undefined`.
  - `bom = text.startsWith('﻿')` and `crlf = text.includes('\r\n')`.
  - `lf = setFrontmatterKey(normaliseText(text), 'status', 'dropped')`. That call throws when the file has no
    frontmatter block; let the error through.
  - `{ body, bodyOffset } = splitFrontmatter(lf)` and `{ sections } = scan(body, bodyOffset)`, so section lines are
    1-based lines of `lf`. `lines = lf.split('\n')`. `dropped` is the first section whose `headingKey` is `dropped`.
    A section's body runs from the line after its heading up to the line before the next section's heading, or to the
    end of the file.
  - When `reason` is undefined: return `undefined` unless `dropped` exists and
    `stripHtmlComments(dropped.lines).some((l) => l.text.trim() !== '')`, the test `lint/dropped.ts:9` uses. Otherwise
    change only the status.
  - When `reason` is given and `dropped` exists: replace its body with `[reason, '']` when a section follows it, else
    with `[reason]`.
  - When `reason` is given and no `dropped` exists: when a `verification notes` section exists, insert
    `['## Dropped', reason, '']` before its heading line. Otherwise append at the end, after making sure the text ends
    with exactly one blank line: `\n## Dropped\n<reason>\n`.
  - The result ends with one `\n`. Restore the line endings at the end: replace every `\n` with `\r\n` when `crlf`,
    then prefix `﻿` when `bom`. A file whose line endings are all CRLF therefore keeps every byte outside the
    status value and the `## Dropped` section.
  - Export it from `packages/core/src/index.ts`, next to `setFrontmatterKey`.
- `worktree.ts`:
  - `const ID` becomes `export const ID`.
  - `function gitNoPrompt` becomes `export function gitNoPrompt`.
  - Nothing else in the file changes.
- `packages/cli/src/commands/drop.ts` (new): `export function drop(ctx: CommandContext, id: string, opts: { reason?: string }): number`.
  It never calls `guardTicketSession`: step 1 runs in the session working the dropped ticket (D-11, D-14). Steps, each
  refusal a `UsageError` (exit 2) whose text ends `nothing was created`:
  1. `ID.test(id)`, else `not a valid ticket id: <id>`. When `opts.reason` is given, trim it. An empty result, or a
     reason containing `\n` or `\r`, is refused with `--reason must be one line of text`.
  2. `gitOk(root, ['remote', 'get-url', 'origin'])`, else `no origin remote - accord drop pushes the record there`.
  3. `gitNoPrompt(root, ['fetch', '--no-prune', 'origin'])`. Task 2 wraps its failure.
  4. `ref = gitDefaultRef(root)`. When it is undefined, refuse with
     `no origin/main in this clone - run git fetch origin, then try again`. `short` is its short name, and
     `base = git(root, ['rev-parse', ref]).trim()`.
  5. Tip (ledger Ruling 14, D-10). With `L` and `R` of `b` resolved by `rev-parse --verify -q`:
     - Both exist and differ: take `L` when `isAncestor(R, L)` and `R` when `isAncestor(L, R)`. Otherwise refuse with
       `<b> here and origin/<b> have diverged - pull or push <b> so one holds the other, then run accord drop again`.
     - Otherwise take `L ?? R ?? base`.
  6. `path = 'accord/tickets/' + id + '.md'`. When `cat-file -e <tip>:<path>` fails, refuse with
     `no <path> on <b or short> - nothing to drop`. Otherwise
     `text = git(root, ['-c', 'log.showSignature=false', 'show', '--no-show-signature', tip + ':' + path])`.
  7. `next = markDropped(text, reason)`. When it throws, refuse with `<path>: <message>`. When it is `undefined`,
     refuse with `<path> has no "## Dropped" reason - pass --reason "<why>"`.
  8. Commit without a checkout:
     - Make a temporary folder with `mkdtempSync(join(tmpdir(), 'accord-drop-'))` and use `<folder>/index` as
       `GIT_INDEX_FILE`. Remove the folder with `rmSync(..., { recursive: true, force: true })` in a `finally`.
     - `blob`: `hash-object -w --stdin` with `input: Buffer.from(next, 'utf8')`. From stdin no filter runs, so the
       bytes go in unchanged.
     - With `env: { ...process.env, GIT_INDEX_FILE }`: `read-tree <base>`, then
       `update-index --add --cacheinfo 100644,<blob>,<path>`, then `tree = write-tree`.
     - `sha = commit-tree <tree> -p <base>`, with the message `drop: <id>\n` on stdin.
  9. `gitNoPrompt(root, ['push', 'origin', sha + ':refs/heads/drop/' + id])`, with no force (ledger Ruling 9). Task 2
     wraps its failure.
  10. Write `branch: drop/<id>\nbase: <short>\ntitle: drop: <id>\n` to stdout and return 0. Write nothing else.
  - Use a small local `gitIn(root, args, extra)` for the spawns that need `env` or `input`:
    `execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, ...extra })`.
    Turn a failure into a `UsageError` the way `git()` in `worktree.ts` does.
- `run.ts`: import `drop`, and register before `worktree`:
  `program.command('drop <id>').description("put the ticket file, set to dropped with its reason, on a new branch drop/<id> from origin's default branch and push it, printing the pull request to open").option('--reason <reason>', 'why the ticket is dropped; replaces the ## Dropped section').action((id: string, o: { reason?: string }) => { setCode(drop(preflight(opts), id, o)); });`
- `skill-commands.test.ts:92`: the expected list gains `'drop'` between `'dashboard'` and `'gate done'`.
- `packages/cli/test/helpers/repo.ts`: add `export function commitMsg(dir: string, text: string): string`.
  - Write `text + '\n'` to `msg.txt` in a new `mkdtempSync(join(tmpdir(), 'accord-msg-'))` folder.
  - `gitRun(dir, 'add', '-A')`, then `gitRun(dir, 'commit', '-q', '-F', file, '--cleanup=verbatim')`.
  - `cleanup` the folder and return `rev-parse HEAD`.

Must not change: every other command and its tests; `setFrontmatterKey`'s results; `gitNoPrompt`'s behaviour for
`worktree clean` and `new ticket --worktree`; the other entries of the command list.

## Task 2: accord drop refuses what would lose work, an existing drop branch, an already dropped ticket and a record main would fail to lint
covers: D-02, D-05
files: packages/cli/src/commands/drop.ts (new), packages/cli/src/commands/worktree.ts, packages/cli/src/load/fs.ts, packages/cli/test/helpers/repo.ts, packages/cli/test/drop.test.ts (new)
verify: packages/cli/test/drop.test.ts#risk:data-loss-drop-refuses-an-uncommitted-ticket-file-in-the-worktree-holding-its-branch, packages/cli/test/drop.test.ts#risk:complex-branching-drop-refuses-a-failed-fetch-an-existing-drop-branch-a-ticket-already-dropped-and-names-a-failed-push, packages/cli/test/drop.test.ts#risk:data-loss-drop-refuses-a-record-the-default-branch-would-fail-to-lint

Consumes: Task 1's `drop`, `claimOnBranch`, `remoteDrop` and `commitMsg`, plus core `loadSnapshot` and `lintSnapshot`.
Produces: `gitFilesAt`, `loadRefInput` and `droppedOn` in `load/fs.ts`. Tasks 3 and 5 use `droppedOn`. `gitNoPrompt`
returns its stdout. Also produces the test helper `mergeMsg`, which Task 3 uses.

Tests first, appended to `packages/cli/test/drop.test.ts`. After each refusal, assert
`remoteDrop(c, <id>)` is `undefined` unless the case says otherwise.
- `it('risk:data-loss drop refuses an uncommitted ticket file in the worktree holding its branch')` (D-05):
  - `c = makeClone()` stays on `main`. Run `c.git('worktree', 'add', '-q', '-b', 't/ST-10', c.sibling('ST-10'), 'origin/main')`,
    write `accord/tickets/ST-10.md` there as `laneTicket('ST-10')`, `commitMsg(c.sibling('ST-10'), 'claim: ST-10')`,
    then push `-u origin t/ST-10` from the sibling.
  - Append `'\nedited\n'` to the sibling's ticket file without committing. `run(['drop', 'ST-10', '--reason', 'x'], c.root)`
    exits 2, and `err` contains `accord/tickets/ST-10.md` and `uncommitted`.
  - Run `commitMsg` in the sibling. The same run now exits 0.
- `it('risk:complex-branching drop refuses a failed fetch an existing drop branch a ticket already dropped and names a failed push')`
  (ledger Rulings 9 and 12):
  - `c = makeClone()` and `claimOnBranch(c, 'A')`. A first drop with `--reason x` exits 0. A second exits 2, and `err`
    contains `git push origin --delete drop/ST-10`.
  - Merge it on the remote: `o = c.otherClone()`, `mergeMsg(o, 'origin/drop/ST-10', 'merge drop/ST-10')`,
    `gitRun(o, 'push', '-q', 'origin', 'main')`, then `c.git('push', '-q', 'origin', '--delete', 'drop/ST-10')`. A drop
    of ST-10 now exits 2, and `err` contains `already dropped on main`.
  - A failed push: write `#!/bin/sh\nexit 1\n` to `${c.remote}/hooks/pre-receive` and `chmodSync` it `0o755`.
    `run(['drop', 'ST-9', '--reason', 'gone'], c.root)` exits 2, and `err` matches
    `/git push origin [0-9a-f]{40}:refs\/heads\/drop\/ST-9/`. Delete the hook.
  - `c.git('remote', 'set-url', 'origin', c.remote + '-missing')`. `drop ST-9 --reason gone` exits 2, and `err` starts
    `fetch from origin failed`.
- `it('risk:data-loss drop refuses a record the default branch would fail to lint')` (ledger Ruling 18):
  - `c = makeClone()`. In `o = c.otherClone()`, write `accord/tickets/ST-11.md` as
    `laneTicket('ST-11', { frontmatter: ['depends_on: ["ST-9"]'] })`, run `commitMsg`, push `main`, then
    `c.git('pull', '-q')`.
  - `run(['drop', 'ST-9', '--reason', 'gone'], c.root)` exits 2. `err` contains `lint.depends-dropped`,
    `accord/tickets/ST-11.md` and `nothing was created`, and `remoteDrop(c, 'ST-9')` is `undefined`.

Interface:
- `packages/cli/test/helpers/repo.ts`: add `export function mergeMsg(dir: string, ref: string, text: string): string`.
  It wraps `gitRun(dir, 'merge', '-q', '--no-ff', '-F', file, '--cleanup=verbatim', ref)` in `commitMsg`'s file
  handling and returns `rev-parse HEAD`.
- `worktree.ts` `gitNoPrompt`: return type `string`, returning the `execFileSync` result. Its callers ignore it, and
  nothing else changes.
- `load/fs.ts`, beside `gitDefaultRef`:
  - `export function gitFilesAt(root: string, ref: string, paths: readonly string[]): Record<string, string>`:
    - With no path it spawns nothing and returns `{}`.
    - Otherwise run one `git cat-file --batch` with the input `<ref>:<path>\n` per path, `stdio: ['pipe', 'pipe', 'pipe']`,
      the 64 MiB `maxBuffer` and `env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }`. Parse the output as
      `loadClaimView` does (`fs.ts:609-622`), decoding each blob as utf8.
    - A `missing` path is left out. A failed spawn throws `UsageError('git cat-file failed reading <ref>' + stderr)`.
  - `export function loadRefInput(root: string, ref: string): SnapshotInput`:
    - `git ls-tree -r -z --name-only <ref> -- accord/config.yml accord/tickets`, with the 64 MiB `maxBuffer`. Keep
      `accord/config.yml` and each path matching `/^accord\/tickets\/[^/]+\.md$/`.
    - Return `{ files: gitFilesAt(root, ref, kept), tree: kept }`. A failed ls-tree throws a `UsageError` naming `ref`.
  - `export function droppedOn(root: string, ref: string, ids: readonly string[]): Set<string>`:
    - `files = gitFilesAt(root, ref, ids.map((i) => 'accord/tickets/' + i + '.md'))`.
    - Return the ids whose `loadSnapshot({ files, tree: [] }).tickets[id]?.frontmatter?.status` is `dropped`, read
      through `Object.hasOwn`.
- `drop.ts`, with the step numbers of Task 1:
  - Before step 3 (D-05): when `listWorktrees(root).find((w) => w.branch === b)` exists, run
    `git(w.path, ['status', '--porcelain', '--untracked-files=all', '--', path])`. When it is non-empty, refuse with
    `<path> has uncommitted changes in <w.path> - commit them on <b> first`.
  - Step 3: wrap the fetch. On failure, refuse with `fetch from origin failed: <first stderr line>`.
  - After step 4:
    - When `droppedOn(root, ref, [id]).has(id)`, refuse with `<id> is already dropped on <short>`.
    - When `gitNoPrompt(root, ['ls-remote', 'origin', 'refs/heads/drop/' + id]).trim() !== ''`, refuse with
      `drop/<id> already exists on origin - delete it with git push origin --delete drop/<id>, then run accord drop again`.
  - After step 7 (ledger Ruling 18):
    - `input = loadRefInput(root, ref)`. Set `input.files[path] = next`, and add `path` to `input.tree` when it is
      absent.
    - `errors = lintSnapshot(loadSnapshot(input)).findings.filter((f) => f.level === 'error')`. When any exist, refuse
      with `the drop record would fail lint on <short>:\n` plus one line per finding, `<file>: <rule>: <reason>`,
      then `\nfix these on <short> first`.
  - Step 9: wrap the push. On failure, throw
    `the drop commit <sha> was made but the push failed: <first stderr line> - push it with git push origin <sha>:refs/heads/drop/<id>`
    (exit 2).

Must not change: Task 1's four CLI tests; `worktree clean` and `new ticket --worktree`, which still ignore
`gitNoPrompt`'s result; `loadClaimView` and every loader result.

## Task 3: worktree clean deletes the worktree and both branches of a dropped ticket when nothing is lost
covers: @ac-3, @ac-4, D-01, D-03, D-07, D-09, D-12
files: packages/cli/src/commands/worktree.ts, packages/cli/src/run.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#ac-3-clean-deletes-the-worktree-and-both-branches-of-a-ticket-dropped-on-the-default-branch (@ac-3), packages/cli/test/worktree.test.ts#ac-4-clean-keeps-a-dropped-ticket-whose-local-branch-has-commits-not-on-origin (@ac-4), packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-dropped-ticket-whose-origin-branch-has-commits-not-here-or-has-diverged, packages/cli/test/worktree.test.ts#risk:data-loss-clean-deletes-a-dropped-ticket-branch-that-exists-on-one-side-only-when-nothing-is-lost, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-everything-of-a-dropped-ticket-that-a-guard-keeps-or-whose-worktree-remove-fails

Consumes: `droppedOn` and `mergeMsg` (Task 2), `accord drop` (Task 1), and `worktreeClean` as it is at the
baseline.
Produces: the dropped path of `worktreeClean`, the line formats Task 4 extends, and the test helpers `claimWorktree`
and `dropOnRemote`, which Tasks 4 and 5 reuse.

Tests first, appended at the end of `packages/cli/test/worktree.test.ts`, using its `clone`, `writeHolds`, `LIVE`,
`lines` and `sha` helpers. Add `commitMsg` and `mergeMsg` to the import from `./helpers/repo.js`, and `LANE_BODY` to
the import from `../../../test/helpers/lane.js`. Add these helpers above the new tests:
- `claimWorktree(c, id, files = { [`${id}.txt`]: id + '\n' })`:
  `c.git('worktree', 'add', '-q', '-b', `t/${id}`, c.sibling(id), 'origin/main')`, `writeFiles(c.sibling(id), files)`,
  `commitMsg(c.sibling(id), id)`, then `gitRun(c.sibling(id), 'push', '-q', '-u', 'origin', `t/${id}`)`. Returns the sha.
- `dropOnRemote(c, ids)`: in `o = c.otherClone()`, write each `accord/tickets/<id>.md` as
  `laneTicket(id, { frontmatter: ['status: dropped'], body: LANE_BODY + '\n## Dropped\ngone\n' })`, then
  `commitMsg(o, 'drop')` and `gitRun(o, 'push', '-q', 'origin', 'main')`.
- `has(dir, ref)`: whether `gitRun(dir, 'rev-parse', '--verify', '-q', ref)` succeeds.

Tests:
- `it('ac-3 clean deletes the worktree and both branches of a ticket dropped on the default branch')`:
  - `c = clone()`. `S = claimWorktree(c, 'ST-10', { 'accord/tickets/ST-10.md': laneTicket('ST-10'), 'src/a.ts': 'a\n' })`.
  - `run(['drop', 'ST-10', '--reason', 'no longer needed'], c.root)` exits 0.
  - In `o = c.otherClone()`: `mergeMsg(o, 'origin/drop/ST-10', 'merge drop/ST-10')` and push `main`. `c` does not
    fetch.
  - `run(['worktree', 'clean'], c.root)` exits 0 and `lines(out)` equals
    `[`removed ${c.sibling('ST-10')}`, `deleted origin/t/ST-10 (was ${S})`, `deleted t/ST-10 (was ${S})`]`.
  - `existsSync(c.sibling('ST-10'))` is false; `has(c.root, 'refs/heads/t/ST-10')` and
    `has(c.remote, 'refs/heads/t/ST-10')` are false; `has(c.remote, 'refs/heads/drop/ST-10')` is true (D-12).
- `it('ac-4 clean keeps a dropped ticket whose local branch has commits not on origin')`:
  - The same setup up to the drop.
  - Write `more.txt` in the sibling and `L = commitMsg(c.sibling('ST-10'), 'unpushed')`. Then merge the drop on the
    remote as in ac-3.
  - Clean exits 0 and `lines(out)` equals `['kept t/ST-10: 1 commits not on origin']`.
  - The sibling exists; `sha(c, 't/ST-10')` is `L`; `gitRun(c.remote, 'rev-parse', 't/ST-10').trim()` is `S`.
- `it('risk:data-loss clean keeps a dropped ticket whose origin branch has commits not here or has diverged')`
  (ledger Ruling 13):
  - `c = clone()` and `claimWorktree(c, 'ST-9')`. In `o = c.otherClone()`: `switch -q t/ST-9`, write `o.txt`,
    `commitMsg`, and `push -q`.
  - `dropOnRemote(c, ['ST-9'])`. Clean gives exactly `['kept t/ST-9: origin/t/ST-9 has commits not here']`.
  - Write `l.txt` in the sibling and run `commitMsg` there, which makes the branches diverge. Clean gives the same
    single line.
  - The sibling, the local branch and `t/ST-9` on the remote all still exist.
- `it('risk:data-loss clean deletes a dropped ticket branch that exists on one side only when nothing is lost')`
  (D-03, D-09):
  - `c = clone({ tickets: ['ST-9', 'ST-10', 'ST-11'] })`.
  - Remote only: `S9 = claimWorktree(c, 'ST-9')`, then `c.git('worktree', 'remove', c.sibling('ST-9'))` and
    `c.git('branch', '-D', 't/ST-9')`.
  - Local only, every commit on origin: `S10 = claimWorktree(c, 'ST-10')`, then
    `gitRun(c.sibling('ST-10'), 'push', '-q', 'origin', 't/ST-10:refs/heads/keep')` and
    `c.git('push', '-q', 'origin', '--delete', 't/ST-10')`.
  - Local only, not on origin: `claimWorktree(c, 'ST-11')`, write `x.txt` in its sibling, run `commitMsg` there, then
    `c.git('worktree', 'remove', c.sibling('ST-11'))` and `c.git('push', '-q', 'origin', '--delete', 't/ST-11')`.
  - `dropOnRemote(c, ['ST-9', 'ST-10', 'ST-11'])`. Clean exits 0, and `lines(out).sort()` equals the sorted
    `deleted origin/t/ST-9 (was ${S9})`, `removed ${c.sibling('ST-10')}`, `deleted t/ST-10 (was ${S10})` and
    `kept t/ST-11: 2 commits not on origin`.
  - `has(c.remote, 'refs/heads/t/ST-9')` is false; `has(c.root, 'refs/heads/t/ST-11')` is true.
- `it('risk:data-loss clean keeps everything of a dropped ticket that a guard keeps or whose worktree remove fails')`:
  - `c = clone({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] })`, and `claimWorktree` for each.
  - ST-9: write `new.txt` in its sibling without committing.
  - ST-10: `c.git('worktree', 'lock', c.sibling('ST-10'))`.
  - ST-11: `c.git('worktree', 'remove', c.sibling('ST-11'))`, then `c.git('switch', '-q', 't/ST-11')` in the main
    checkout.
  - ST-12: `writeHolds(c, { 'ST-12': LIVE })`, and
    `vi.mocked(proc.processTable).mockReturnValue([{ pid: process.pid, ppid: 1, start: 'self' }, { pid: 4242, ppid: 1, start: 'S2' }])`.
  - `dropOnRemote(c, ['ST-9', 'ST-10', 'ST-11', 'ST-12'])`, then clean from `c.root`. It exits 0 and its lines, sorted,
    are `kept ${c.sibling('ST-9')}: uncommitted work`, a line starting
    `kept ${c.sibling('ST-10')}: git worktree remove failed: `, `kept t/ST-11: checked out in ${c.root}` and
    `kept ${c.sibling('ST-12')}: held by another session`, with nothing else.
  - Every `t/ST-<n>` still exists locally and on the remote, and the siblings of ST-9, ST-10 and ST-12 exist.
  - Finally run `c.git('worktree', 'unlock', c.sibling('ST-10'))` so that cleanup can remove it.

Interface:
- `worktree.ts`: refactor first, with identical output.
  - `interface GuardState { holds?: Record<string, Hold>; holdsError?: string; table?: ReturnType<typeof processTable> }`.
  - `function passGuards(ctx: CommandContext, w: WorktreeEntry, id: string, s: GuardState): { h: Hold | undefined } | undefined`
    holds lines 493-536 moved unchanged. It covers this session's worktree, uncommitted work, the hold read, this
    session's hold, the live check and the cannot-tell case. Each `continue` becomes `return undefined` after the same
    kept line.
  - `function removeWorktree(ctx: CommandContext, w: WorktreeEntry, id: string, h: Hold | undefined): { failed: boolean }`
    holds lines 537-557 moved unchanged, the three lines and the hold drop included.
  - The merged loop becomes: merged check, `g = passGuards(...)`, `if (g === undefined) continue`, then
    `removeWorktree(ctx, w, id, g.h)`. Run every existing clean test before going on.
- `worktree.ts`: add `function cleanDropped(ctx: CommandContext, ref: string, templates: readonly string[], s: GuardState): void`.
  `worktreeClean` calls it after the merged-branch loop, before `return 0`. Steps:
  1. Read `git(ctx.root, ['for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads', 'refs/remotes/origin'])`.
     A `refs/heads/<n>` row gives `L` of branch `n`. A `refs/remotes/origin/<n>` row, `HEAD` excluded, gives `R`.
     Keep each branch `n` whose `ticketOfBranch(n, templates, known)` (known as in `worktreeClean`) names an id.
  2. Drop every branch whose `L ?? R` satisfies `isAncestor(tip, ref)`. Merged tickets stay on today's path, and a
     merged origin branch is left to the host. Then keep the branches whose id is in
     `droppedOn(ctx.root, ref, ids)`.
  3. `after = worktrees(ctx.root, ctx.stdout)`. For each branch `b`, sorted by code point, inside
     `try { ... } catch (e) { write `kept ${b}: could not be judged: ${firstLine(...)}` as the merged loop does }`:
     1. `W = after.find((x) => x.branch === b)`. When `W` is `after[0]`, the main checkout, write
        `kept <b>: checked out in <W.path>` and stop.
     2. When `W` exists: `g = passGuards(ctx, W, id, s)`, and stop when it is undefined.
     3. Loss check (D-03, D-07, D-09, ledger Ruling 13):
        - `L` and `R` both exist and differ, and `isAncestor(R, L)`: write
          `kept <b>: <git rev-list --count R..L> commits not on origin` and stop.
        - Otherwise, when they differ: write `kept <b>: origin/<b> has commits not here` and stop.
        - Only `L`: `n = git rev-list --count <L> --not --remotes=origin`. When `n > 0`, write
          `kept <b>: <n> commits not on origin` and stop.
     4. When `W` exists: `removeWorktree(ctx, W, id, g.h)`. Stop when it `failed`: git refuses to delete a branch
        checked out in a worktree, and a branch must not lose its folder after its origin copy is gone (ledger
        Ruling 16).
     5. When `R` exists: `gitNoPrompt(ctx.root, ['push', '--force-with-lease=refs/heads/' + b + ':' + R, 'origin', ':refs/heads/' + b])`,
        then write `deleted origin/<b> (was <R>)`.
     6. When `L` exists: `git branch -D <b>`, spawned as the merged loop does, then write `deleted <b> (was <L>)`.
  - `drop/<id>` never matches a ticket branch template (ledger Ruling 8), so it is never touched (D-12).
- `run.ts`: the `worktree clean` description becomes
  `'fetch, then remove the worktrees of merged tickets, delete merged ticket branches, delete the worktree and branches of tickets dropped on the default branch when nothing is lost, and prune stale remote refs, naming what is removed, deleted or kept'`.

Must not change: every existing `worktree clean` test in `worktree.test.ts`, which pins every line of the merged path,
including `ac-5`, the failed-fetch case, the remove-fails cases, the stale-lock case and the branch-deletion and prune
cases. Also unchanged: `worktree open`, `new ticket --worktree` and the hook cases in the same file.

## Task 4: clean deletes nothing dropped after a failed fetch, keeps the local branch after a stale lease, and deletes a branch another clone already cleaned
covers: D-03, D-13
files: packages/cli/src/commands/worktree.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:data-loss-a-failed-fetch-keeps-every-dropped-ticket-and-says-so-once, packages/cli/test/worktree.test.ts#risk:data-loss-a-stale-lease-keeps-the-local-branch-of-a-dropped-ticket-and-names-the-origin-branch, packages/cli/test/worktree.test.ts#risk:data-loss-a-second-clone-deletes-its-local-branch-of-a-dropped-ticket-another-clone-cleaned

Consumes: Task 3's `cleanDropped`, `claimWorktree`, `dropOnRemote` and `has`. Produces: the final clean behaviour.

Tests first, appended to `packages/cli/test/worktree.test.ts`:
- `it('risk:data-loss a failed fetch keeps every dropped ticket and says so once')` (ledger Ruling 17):
  - `c = clone({ tickets: ['ST-9', 'ST-10'] })`, then `claimWorktree` both and `dropOnRemote(c, ['ST-9', 'ST-10'])`.
  - `c.git('fetch', '-q', 'origin')`, so that the refs in the clone already show both as dropped. Then
    `c.git('remote', 'set-url', 'origin', c.remote + '-missing')`.
  - Clean exits 0 with exactly two lines. The first starts
    `fetch from origin failed, judging against the refs already in this clone`; the second is
    `kept dropped tickets: fetch from origin failed`.
  - Both siblings and both local branches exist, and `has(c.remote, 'refs/heads/t/ST-9')` is true.
- `it('risk:data-loss a stale lease keeps the local branch of a dropped ticket and names the origin branch')`
  (ledger Ruling 16):
  - `c = clone()`, `S = claimWorktree(c, 'ST-9')`, `dropOnRemote(c, ['ST-9'])`.
  - In `o = c.otherClone()`: `switch -q -c elsewhere`, write `e.txt`, `S2 = commitMsg(o, 'elsewhere')`, and
    `push -q origin elsewhere`.
  - Write `${c.root}/.git/hooks/pre-push` as
    `#!/bin/sh\ngit --git-dir="${c.remote.replaceAll('\\', '/')}" update-ref refs/heads/t/ST-9 ${S2}\nexit 0\n`
    and `chmodSync` it `0o755`. The hook moves origin's branch after clean fetched it, so the lease is stale.
  - Clean exits 0 with lines `removed ${c.sibling('ST-9')}`, then one starting `kept origin/t/ST-9: git push failed: `,
    then `kept t/ST-9: its origin branch was not deleted`.
  - `sha(c, 't/ST-9')` is `S`; `gitRun(c.remote, 'rev-parse', 't/ST-9').trim()` is `S2`.
- `it('risk:data-loss a second clone deletes its local branch of a dropped ticket another clone cleaned')` (D-13):
  - `c = clone()` and `S = claimWorktree(c, 'ST-9')`.
  - `o2 = c.otherClone()` and `gitRun(o2, 'branch', 't/ST-9', 'origin/t/ST-9')`.
  - `o3 = c.otherClone()`: `switch -q t/ST-9`, write `x.txt`, `commitMsg(o3, 'mine')`, then `switch -q main`.
  - `dropOnRemote(c, ['ST-9'])`. Clean in `c.root` exits 0 and deletes `t/ST-9` on the remote.
  - `run(['worktree', 'clean'], o2)` gives exactly
    `[`pruned refs/remotes/origin/t/ST-9 (was ${S})`, `deleted t/ST-9 (was ${S})`]`, and `has(o2, 'refs/heads/t/ST-9')`
    is false.
  - `run(['worktree', 'clean'], o3)` gives exactly
    `[`pruned refs/remotes/origin/t/ST-9 (was ${S})`, 'kept t/ST-9: 2 commits not on origin']`, and the branch remains.

Interface, `worktree.ts`:
- `pruneStale` returns `Map<string, string>`, mapping each removed refname to its sha (the pairs it already prints).
  `worktreeClean` keeps the map, or an empty map when the fetch failed, and keeps `fetchFailed = true` when its fetch
  catch ran. Both are passed to `cleanDropped`.
- `cleanDropped`, after step 2: when `fetchFailed` and at least one dropped branch is left, write
  `kept dropped tickets: fetch from origin failed` once and return. Stale refs can show a revived ticket as dropped
  (ledger Ruling 17).
- Step 3, only `L`: count it as on origin, with no count taken, when
  `pruned.get('refs/remotes/origin/' + b) === L` (D-13).
- Step 3.5: wrap the push. On failure write `kept origin/<b>: git push failed: <firstLine(e)>`. When `L` exists, also
  write `kept <b>: its origin branch was not deleted`, then stop. The local branch is deleted only when the origin
  delete succeeded or origin had none.

Must not change: every `pruned ... (was ...)` line and the prune cases; Task 3's tests; the failed-fetch case at
`worktree.test.ts:366`, which has no dropped ticket and so prints no new line.

## Task 5: Picking up a ticket the default branch holds as dropped is refused
covers: D-16
files: packages/cli/src/commands/worktree.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-pick-up-refuses-a-ticket-the-default-branch-holds-as-dropped

Consumes: `droppedOn` (Task 2), and `dropOnRemote` and `has` (Task 3). Produces: the refusal that keeps clean from
deleting a revived claim.

Test first, appended to `packages/cli/test/worktree.test.ts`:
- `it('risk:complex-branching pick up refuses a ticket the default branch holds as dropped')`:
  - `c = clone({ tickets: ['ST-9', 'ST-10'] })` and `c.git('branch', 't/ST-10', 'origin/main')`. Then
    `dropOnRemote(c, ['ST-9', 'ST-10'])` and `c.git('fetch', '-q', 'origin')`.
  - `run(['worktree', 'open', 'ST-9'], c.root)` exits 2, and `err` contains `ST-9 is dropped on main` and
    `make a new ticket instead`. `existsSync(c.sibling('ST-9'))` is false and `has(c.root, 'refs/heads/t/ST-9')` is
    false.
  - `run(['worktree', 'open', 'ST-10'], c.root)`, with its branch already present, exits 2 with the same words for
    ST-10, and `existsSync(c.sibling('ST-10'))` is false.
  - `run(['worktree', 'open', 'ST-10', '--continue'], c.root)` exits 0 and the sibling exists. Continue is not
    refused, so a session working a dropped ticket can still reach it.

Interface, `worktreeOpen`: as the first statement inside `if (opts.continue !== true) {` (`worktree.ts:370`), before
either `checkClaimant`:
`const def = gitDefaultRef(ctx.root); if (def !== undefined && droppedOn(ctx.root, def, [id]).has(id)) throw new UsageError(`${id} is dropped on ${def.replace('refs/remotes/origin/', '')} - make a new ticket instead (the drop reason is in accord/tickets/${id}.md there); nothing was created`);`

Must not change: every pick up and continue case in `worktree.test.ts`, and `--continue` on any ticket.

## Task 6: The ids reference drops a ticket with accord drop
covers: @ac-5, D-06, D-08, D-11, D-14
files: packages/core/skills/accord/ids.md, packages/core/src/generated/skills.ts, .claude/skills/accord/ids.md, .claude/skills/accord-debug/ids.md, .claude/skills/accord-verify/ids.md, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#ac-5-the-ids-reference-drops-a-ticket-with-accord-drop (@ac-5)

Consumes: the registered `drop` command (Task 1), so the command check in `skill-commands.test.ts` passes. Produces:
the text an agent follows.

Test first, appended at the end of `packages/core/test/stage-skills.test.ts`:
- `it('ac-5 the ids reference drops a ticket with accord drop')`:
  - `flat` collapses whitespace runs to one space. `ids` is flat `.claude/skills/accord/ids.md` from `files`, and is
    non-empty.
  - `drop = ids.slice(ids.indexOf('## Dropping instead of renaming'))` and
    `step1 = drop.slice(drop.indexOf('1. '), drop.indexOf('2. Create the new ticket'))`, which is non-empty.
  - `step1` contains: `` `accord drop <id> --reason "<reason>"` ``, `` `branch:`, `base:` and `title:` ``,
    `` `gh pr create --head <branch> --base <base> --title "<title>" --body "<reason>"` ``,
    `otherwise ask the owner to open it`, `waits for the owner's merge`, `Never delete a claim branch` and
    `` `accord worktree clean` ``.
  - `step1` contains neither `` Set `status: dropped` `` nor `commit and merge that`.
  - `drop` contains `run step 1 there` and does not contain `commit step 1`.
  - The flat `.claude/skills/accord-debug/ids.md` and `.claude/skills/accord-verify/ids.md` each equal `ids`.
  - The flat `.claude/skills/accord/SKILL.md` does not contain `accord drop` (D-08: `/accord` gains no drop action).

Text, `packages/core/skills/accord/ids.md`:
- Step 1, line 37, becomes, wrapped like its neighbours, with each code span on one line:
  "1. Run `accord drop <id> --reason "<reason>"` with the owner's reason. It pushes a branch made from the default
  branch that holds only the ticket file, set to dropped with that reason, and prints `branch:`, `base:` and `title:`
  lines. Open that pull request with
  `gh pr create --head <branch> --base <base> --title "<title>" --body "<reason>"` when `gh` is available, otherwise
  ask the owner to open it; it waits for the owner's merge like other ticket work. Never delete a claim branch to
  drop a ticket: once the pull request is merged, `accord worktree clean` deletes it and its worktree."
- Line 49: "commit step 1 there" becomes "run step 1 there". Nothing else in that sentence changes (D-11).
- Nothing else in the file changes.
- Regenerate from the repository root, in this order: `npm run gen`, `npm run build`,
  `node packages/cli/dist/cli.js skills sync`. Any file `skills sync` rewrites beyond those on the `files:` line is
  kept as written and named in the report.
- Then run `npx vitest run packages/core/test/stage-skills.test.ts packages/core/test/skills.test.ts packages/cli/test/skill-commands.test.ts`.

Must not change: every phrase `REQUIRED.accord` asserts (`./ids.md` stays); the drop-section phrases
`stage-skills.test.ts:311-313` asserts (`` `accord new ticket` is refused `` and `open a new session in the main checkout`);
the `## Assigning` phrase at `stage-skills.test.ts:278`; and steps 2 to 6. No rendered text names a runtime product or a
`packages/` path.
