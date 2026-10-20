---
baseline: 1dfe65bb70644e25776735c1f7296c83570c140d
plan_hash: "fnv1a64:acb9771e17618e7d"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: Tasks 1 and 2 are the wiring. Task 1 makes the core stage read the commits after verify; Task 2 makes the
CLI supply them from git, and its tests run the stage end to end through `accord status` from the main checkout.
Task 3 makes the fix's review package leave out what a merge from the default branch brought in. Task 4 adds
`accord tests skipped`. Task 5 turns this repository's operating-system early returns into runner skips and writes
the executor and reviewer rule. Task 6 routes a failure found after verify to `accord-debug` and gives the fix its
review round. Task 7 runs CI inside verify and updates the design spec; it needs Tasks 4 and 6.

Rules for every task:
- Test ids: every test this plan writes is a top-level `it(...)` (or `it.skipIf(...)(...)`) with no `describe`
  around it. Its report id is the test file's path from the repository root, then `#`, then the `it` title with
  each whitespace run turned into `-`. No test title holds `@`, a comma or an apostrophe. No existing test is
  renamed; that includes every id in `accord/tests-baseline.txt`.
- CLI tests import core from `packages/core/dist`. After changing anything under `packages/core/`, run `npm run gen`
  when a file under `packages/core/skills/` or `packages/core/agents/` changed, then `npm run build -w packages/core`,
  before running any CLI test. Run one file with `npx vitest run <path>`. End every task with `npm run build`,
  `npm run lint` and `npm run typecheck`, then run the test files the task names.
- Regenerating skill and agent copies, from the repository root, in this order: `npm run gen`, `npm run build`,
  `node packages/cli/dist/cli.js skills sync`. Any file `skills sync` rewrites beyond those on the task's `files:`
  line is kept as written and declared in the report.
- Files are LF with no BOM. Add no dependency. Every path the CLI prints or stores uses `/` (D-51). Every `git`
  spawn is `execFileSync('git', [...])` with a literal argument array, never a shell.
- Rendered SKILL.md files are capped at 5120 bytes (`packages/core/test/skills.test.ts:188`). Measure a rendered
  copy with `node -e "for (const f of process.argv.slice(1)) console.log(f, require('fs').statSync(f).size)" <paths>`
  before and after editing, and run `npx vitest run packages/core/test/skills.test.ts` after regenerating.

Definitions shared by every task:
- A ticket's own records: `accord/tickets/<id>.md` and every path under `accord/tickets/<id>/` (spec §11, the rule
  `gate/done.ts:202-206` applies).
- The default ref: `gitDefaultRef(root)` (`packages/cli/src/load/fs.ts:574`, origin's), else the first of
  `refs/heads/main` and `refs/heads/master` that resolves (ledger Ruling: "from the main branch").
- The commits after verify of ticket X: the commits reachable from X's own tip and not from X's `verified_commit`
  nor from the default ref, oldest first in graph order. X's own tip is `HEAD` when the current branch names X, and
  X's claim ref otherwise (as `loadClaimView` picks it). A commit is hand-made when it changes a path outside X's
  own records, or when it is a merge whose own changes git could not show. A merge whose remerge diff shows only
  X's own records (usually nothing) is a merge from the default branch.

## Task 1: Wiring: the stage reads the commits after verify and goes back from done to review or verify
covers: @ac-3, D-03, D-07
files: packages/core/src/model/snapshot.ts, packages/core/src/load/snapshot.ts, packages/core/src/load/work.ts, packages/core/src/gate/done.ts, packages/core/src/status/stage.ts, packages/core/src/status/anchor.ts, packages/core/test/lane-status.test.ts
verify: packages/core/test/lane-status.test.ts#ac-3-a-change-after-verify-takes-the-ticket-back-from-done-until-it-is-verified-again (@ac-3)

Consumes: the snapshot as loaded today. Produces: the input field `afterVerify`, `Review.trailing`,
`ownRecordsOnly`, `Progress.base` and the anchor line `Review base: <sha>`. Task 2 supplies `afterVerify`; Task 6's
review skill reads `Review base:`.

Test first, in `packages/core/test/lane-status.test.ts`, appended at the end:
- `it('ac-3 a change after verify takes the ticket back from done until it is verified again')`.
  - Setup, as the existing `walks intent, plan, build, review, verify, done` case builds it: `ap = approved({
    'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') }, 'T-1')`, plus `PLAN`, a ledger with both tasks done and
    `review.md` `'verdict: converged\n'`. Tick the ticket with `verified: ['ac-1', 'ac-2']`, `verified_hash` the
    acHash of its scenarios and `verified_commit: C`, with `C = 'c'.repeat(40)`. Other shas: `F = 'f'.repeat(40)`,
    `R = 'e'.repeat(40)`, `G = 'd'.repeat(40)`, `M = 'b'.repeat(40)`, `X = 'a'.repeat(40)`, `T = '9'.repeat(40)`.
  - `at(after, extra = {})` is `loadSnapshot({ files: { ...done, ...extra }, tree: [], ...(after === undefined ? {} :
    { afterVerify: { 'T-1': after } }) })`; `stage(...)` is `statusRows(at(...))[0].stage`.
  - Checks, each one `expect`:
    - `stage(undefined)` and `stage([])` are `done`.
    - Records only: `[{ sha: T, parents: [C], files: ['accord/tickets/T-1.md', 'accord/tickets/T-1/debug.md'] }]`
      is `done`.
    - A fix: `[{ sha: F, parents: [C], files: ['src/export.ts'] }]` is `review`; `anchorText(at(that), 'T-1')`
      contains `'Stage: review, next: review to convergence\nReview base: ' + C + '\n'`; `isDone` is false.
    - The fix reviewed: `[fix, { sha: R, parents: [F], files: ['accord/tickets/T-1/review.md'] }]` is `verify`,
      and its anchor text holds no `Review base:`.
    - The same list with `review.md` set to `'verdict: converged\n\n## Round 6\n\nMust 1 patch: x — a.ts:1 — open\n'`
      is `review` (the last line is not the verdict).
    - A second fix after the review: `[fix, reviewed, { sha: G, parents: [R], files: ['src/b.ts'] }]` is `review`
      and its anchor text contains `Review base: ` + R.
    - A merge from the default branch: `[{ sha: M, parents: [C, X], files: [] }]` is `verify`, and so is
      `[{ sha: M, parents: [C, X], files: ['accord/tickets/T-1/ledger.md'] }]`.
    - A merge git could not show: `[{ sha: M, parents: [C, X] }]` is `review` with `Review base: ` + C.
    - A merge with its own change: `[{ sha: M, parents: [C, X], files: ['src/export.ts'] }]` is `review`.
    - The verifier already ran at the fix: `[fix]` with `accord/tickets/T-1/verification.md` written as in
      `packages/cli/test/lane-flow.test.ts:16-36` but `commit: "<F>"` and `ticket: "T-1"` is `verify`; with
      `[fix, { sha: G, parents: [F], files: ['src/b.ts'] }]` and the same verification it is `review` with base F.
    - Unbound ticks with a fix (ticket `verified_hash` set to `'fnv1a64:0000000000000000'`) are `review`, not
      `verify`.

Interface:
- `model/snapshot.ts`: export
  `interface AfterVerifyCommit { sha: string; parents: string[]; files?: string[] }` (full shas, first parent
  first; `files` are the paths the commit changes, for a merge the paths its remerge diff shows, absent for a merge
  whose own changes git could not show). `SnapshotInput` and `RepoSnapshot` gain
  `afterVerify?: Record<string, AfterVerifyCommit[]>` with the comment "Ticket id -> the commits after its
  verified_commit on its own tip that the default ref does not hold, oldest first. Present only for a ticket whose
  verified_commit is not on the default ref." `Review` gains `trailing?: true` ("a non-blank line follows the last
  verdict line").
- `load/snapshot.ts`: carry `afterVerify` through as `planFacts` is carried (`load/snapshot.ts:193`), spread so an
  absent field stays absent.
- `load/work.ts` `parseReview`: when a line after the last verdict line has non-blank text, the result gains
  `trailing: true`. Nothing else in the result changes.
- `gate/done.ts`: `export function ownRecordsOnly(id: string, paths: readonly string[]): boolean`, the `every` test
  of `onlyOwnRecords` (`done.ts:205`) moved out; `onlyOwnRecords` calls it.
- `status/stage.ts`: `Progress` gains `base?: string`. In `progressOf`, between the review-verdict line (`:56`) and
  the final return, take `after` = `snapshot.afterVerify[ticket.id]` through `Object.hasOwn`. With `hand(c)` =
  `c.files === undefined || !ownRecordsOnly(id, c.files)` and `records(c)` = `c.parents.length < 2 && !hand(c)`:
  when `after` is defined and not every commit is `records`, return `{ stage: 'review', ...counts, base }` when
  `base = reviewBase(...)` is defined, else `{ stage: 'verify', ...counts }`. Otherwise the existing return runs.
  `reviewBase`: `start` is one past the index of the commit `shaEqual` to `verification.md`'s `commit:` (0 when
  none matches or there is none). Walk from `start`: a `hand` commit sets `first` when `first` is unset; a commit
  whose `files` include `accord/tickets/<id>/review.md`, while `work.review.trailing` is not true, unsets `first`.
  Return `after[first].parents[0]` when `first` is set (ledger Ruling on the recorded review round).
- `status/anchor.ts`: right after the `Stage:` line, push `Review base: <progress.base>` when `base` is defined.

Must not change: every existing stage, row and anchor case; `onlyOwnRecords`'s results and every `gate done` case;
`parseReview`'s results in `packages/core/test/work.test.ts`; the D-54 goldens (no fixture supplies `afterVerify`).

## Task 2: The CLI reads the commits after verify from git for the ticket on its branch and for claimed tickets
covers: @ac-3, D-07
files: packages/cli/src/load/fs.ts, packages/cli/test/after-verify.test.ts (new)
verify: packages/cli/test/after-verify.test.ts#risk:complex-branching-the-commits-after-verify-come-from-the-ticket-tip-without-the-default-branch-in-graph-order, packages/cli/test/after-verify.test.ts#risk:complex-branching-status-in-the-main-checkout-takes-a-claimed-ticket-back-from-done-when-its-branch-holds-a-fix-after-verify

Consumes: `afterVerify` and the stage from Task 1, and `gitDefaultRef`, `currentBranch`, `ticketOfBranch` and
`isSha` as they are at the baseline. A recorded sha may be abbreviated: compare it with a full sha by
`full.toLowerCase().startsWith(recorded.toLowerCase())`.
Produces: `export function defaultRefOf(root: string): string | undefined` (Task 3 uses it) and `afterVerify` in
the input of every command.

Tests first, in `packages/cli/test/after-verify.test.ts` (new), using `makeClone` from `./helpers/worktree.js`,
`run`, `gitRun`, `writeFiles`, `commitAllAt` from `./helpers/repo.js`, `loadFromFs` from `../src/load/fs.js`,
`setFrontmatterKey` from `@accord-dev/accord-core`, and `PLAN` from `../../../test/helpers/lane.js`. Every clone
is removed with `cleanupAll()` in a `finally`. Both tests pass `120_000` as the third argument of `it`.
`commit(dir, msg)` is `gitRun(dir, 'add', '-A'); gitRun(dir, 'commit', '-q', '-m', msg)` and returns
`rev-parse HEAD`.
- `it('risk:complex-branching the commits after verify come from the ticket tip without the default branch in graph order')`:
  - `c = makeClone()`, `c.git('switch', '-c', 't/ST-9')`, write `src/a.ts`, `C = commit(c.root, 'work')`. Set
    `verified_commit` to `C` in `accord/tickets/ST-9.md` with `setFrontmatterKey`, `T = commit(c.root, 'tick')`.
    `fact = () => loadFromFs(c.root).afterVerify?.['ST-9']`.
  - `fact()` equals `[{ sha: T, parents: [C], files: ['accord/tickets/ST-9.md'] }]`.
  - Write `src/fix.ts` and commit it with `commitAllAt(c.root, new Date('2001-01-01T00:00:00Z'), 'fix')`, then
    `F = rev-parse HEAD`. `fact().map((x) => x.sha)` equals `[T, F]` (an older date, but after T in the graph), and the
    last entry's `files` equal `['src/fix.ts']`.
  - In `o = c.otherClone()`, write `src/main.ts`, commit, `push -q origin main`; `Mn` is its sha. In `c`,
    `fetch -q origin` and `merge -q --no-edit origin/main`; `M` is HEAD. `fact()` shas equal `[T, F, M]`, the
    entry for `M` has `parents` `[F, Mn]` and `files` `[]`, and no entry has sha `Mn`.
  - `c.git('switch', '-c', 'side', C)`, write `src/side.ts`, `S = commit(...)`, `switch t/ST-9`,
    `merge -q --no-edit side`, `M2` is HEAD. The sha set of `fact()` equals `{T, F, M, S, M2}` and `S` comes
    before `M2`.
  - `c.git('push', '-q', 'origin', 't/ST-9:main')`, `fetch -q origin`: `loadFromFs(c.root).afterVerify` has no key
    `ST-9` (a verified commit on the default ref, ledger Ruling).
  - Unknown commit: `d = makeClone()`, `switch -c t/ST-9`, set `verified_commit` to `'deadbee' + '0'.repeat(33)`
    and commit. `loadFromFs(d.root).afterVerify?.['ST-9']` is undefined, and `run(['status', '--json'], d.root)`
    exits 0 (no git error exits 2, ledger Ruling).
  - No remote: `e = makeClone()`, `e.git('remote', 'remove', 'origin')`. On `t/ST-9` commit `src/a.ts` (`C`) and
    the tick (`T`); `switch main`, write `src/m.ts`, `Mn = commit(...)`; `switch t/ST-9`, `merge -q --no-edit main`
    (`M`). `fact()` shas equal `[T, M]` and `M`'s `files` are `[]` (the local default branch). Then
    `e.git('branch', '-m', 'main', 'trunk')`: the shas now include `Mn`, and `M`'s entry has no `files` key (no
    default ref, every merge counts, ledger Ruling).
- `it('risk:complex-branching status in the main checkout takes a claimed ticket back from done when its branch holds a fix after verify')`:
  - `c = makeClone()`, `c.git('switch', '-c', 't/ST-9')`. `run(['approve', 'ST-9'], c.root)` and
    `run(['gate', 'ready', 'ST-9'], c.root)` each exit 0. Write `accord/tickets/ST-9/plan.md` as `PLAN`,
    `ledger.md` as `'## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n'`, `review.md` as
    `'## Round 1\nverdict: converged\n'` and `src/a.ts`; `C = commit(c.root, 'work')`. In the ticket, read
    `ac_hash` as `packages/cli/test/lane-flow.test.ts:69` does and set `verified: ['ac-1', 'ac-2']`,
    `verified_hash` to it and `verified_commit` to `C`; `T = commit(c.root, 'tick')`;
    `push -q -u origin t/ST-9`.
  - `row = async () => JSON.parse((await run(['status', '--json'], c.root)).out).find((r) => r.id === 'ST-9').stage`.
    After `switch main`, `row()` is `done`.
  - `switch t/ST-9`, write `src/fix.ts`, commit, `push -q`. `run(['anchor'], c.root)` (on the ticket branch)
    contains `Stage: review` and `Review base: ${T}`. After `switch main`, `row()` is `review`.
  - `switch t/ST-9`, set `review.md` to `'## Round 1\nverdict: converged\n\n## Round 2\n\nNo findings\n\nverdict: converged\n'`,
    commit, `push -q`, `switch main`: `row()` is `verify`.

Interface, `packages/cli/src/load/fs.ts`:
- `defaultRefOf(root)`: `gitDefaultRef(root)`, else the first of `refs/heads/main`, `refs/heads/master` that
  `git rev-parse --verify -q` resolves.
- `function gitAfterVerify(root: string, wanted: Record<string, { commit: string; tip: string }>): Record<string, AfterVerify>`,
  where `AfterVerify` is `NonNullable<SnapshotInput['afterVerify']>[string]`. With no entry it spawns nothing.
  1. `def = defaultRefOf(root)`.
  2. When `def` is defined: one `git rev-list --ignore-missing <every commit> ^<def> --`; an entry whose commit no
     listed sha starts with (lowercased) is on the default ref, or unknown, and is dropped. A failing spawn drops
     every entry.
  3. Per remaining id: `git -c core.quotePath=false log -z --topo-order --reverse --format=%H%x00%P --name-only
     --no-renames --remerge-diff <tip> ^<commit> [^<def>] --`, with `env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }`
     and `maxBuffer: 64 * 1024 * 1024`. When it fails, run it again without `--remerge-diff`; when that fails, the
     id is dropped. Never a UsageError (ledger Ruling).
  4. Parse into `{ sha, parents, files }`. Before writing the parser, run the command once in the test's
     repository and parse the byte layout it prints; the test's `files` assertions pin it. A merge (two or more
     parents) keeps `files` only when `--remerge-diff` was used and `def` is defined; otherwise its `files` key is
     left out.
- `loadParts`: when any ticket's `verified_commit` passes `isSha`, read `currentBranch(root)`; when it names a
  ticket `own` through `ticketOfBranch` and that ticket's `verified_commit` passes `isSha`, call `gitAfterVerify`
  with `{ [own]: { commit, tip: 'HEAD' } }`. The input gains `afterVerify` only when the result has a key.
- `loadClaimView`: for each candidate (`:473`) whose overlaid ticket file has a `verified_commit` that passes
  `isSha` (read with `loadSnapshot({ files: { [path]: text }, tree: [] }).tickets[id]?.frontmatter?.verified_commit`),
  call `gitAfterVerify` once with `{ commit, tip: ref }` for each. `view.afterVerify` is the checkout's entries plus
  these, left out when empty. `checkout` is unchanged.

Must not change: every existing loader, `load.test.ts` and golden case (none has a ticket branch with a
`verified_commit`), the `lane-flow.test.ts` flow (its ticket sits on the repository's default branch, so no tip is
read), and `gitDefaultRef`'s results. A repository where no ticket has a `verified_commit` spawns no new process.

## Task 3: The review package of a fix leaves out what a merge from the default branch brought in
covers: @ac-3, D-03
files: packages/cli/src/commands/review-package.ts, packages/cli/test/after-verify.test.ts (new)
verify: packages/cli/test/after-verify.test.ts#risk:complex-branching-review-package-leaves-out-what-a-merge-from-the-default-branch-brought-in

Consumes: `defaultRefOf` (Task 2). Produces: the package Task 6's review skill reads with `--base <Review base>`.

Test first, appended to `packages/cli/test/after-verify.test.ts`, with `120_000` as the third argument of `it`:
- `it('risk:complex-branching review-package leaves out what a merge from the default branch brought in')`:
  `c = makeClone()`, `B0 = c.git('rev-parse', 'HEAD').trim()`, `switch -c t/ST-9`, write `src/a.ts` and commit
  `fix one`. Before any merge, `run(['review-package', 'ST-9', '--base', B0], c.root)` exits 0 and its `out` starts
  `# Review package: ST-9 (${B0}...HEAD)`. In `o = c.otherClone()` write `src/main.ts`, commit `main work`, push
  `main`; in `c` fetch and `merge -q --no-edit origin/main`; write `src/b.ts`, commit `fix two`. Now the same run
  exits 0, `out` contains `without origin/main`, `fix one` and `fix two`, and does not contain `main work`; the part
  after `## Diff` contains `src/a.ts` and `src/b.ts` and not `src/main.ts`; the part between `## Stat` and
  `## Undeclared files` does not contain `src/main.ts`.

Interface, `review-package.ts`, after the base checks (`:33-43`):
- `def = defaultRefOf(ctx.root)`. `excluded` is true when `def` is defined, `git merge-base --is-ancestor HEAD <def>`
  fails (HEAD is not on the default ref, so a repository working on its default branch is untouched), and
  `git rev-list --count <base>..HEAD ^<def> --` differs from `git rev-list --count <base>..HEAD --`.
- When `excluded` is false, the output is byte for byte today's.
- When true, with `short` = `def` without its `refs/remotes/` or `refs/heads/` prefix and `R` = `<base>..HEAD ^<def>`:
  header `# Review package: <id> (<base>..HEAD, without <short>)`; `## Commits` from
  `git log --no-color --format=%h %s R --`; `## Stat` from
  `git log --reverse --no-color --no-ext-diff --remerge-diff --stat --format=%h %s R --`; `## Diff` the same with
  `-p -U10` instead of `--stat`; the changed paths for `## Undeclared files` from
  `git log --no-renames --remerge-diff --name-only -z --format= R --`, split on NUL and newline, empty and repeated
  paths dropped. Each `git log` that fails is run once more without `--remerge-diff`. Errors keep today's
  `cannot diff` message.

Must not change: every `review-package` case in `packages/cli/test/lane-commands.test.ts` (their repositories work
on the default branch, so `excluded` is false), the `REF` check, and the `--base` default from `baseline:`.

## Task 4: accord tests skipped prints every case the report records as skipped, with the operating system
covers: @ac-4, D-07
files: packages/cli/src/commands/tests-skipped.ts (new), packages/cli/src/run.ts, packages/cli/test/skill-commands.test.ts, packages/cli/test/lane-commands.test.ts
verify: packages/cli/test/lane-commands.test.ts#ac-4-tests-skipped-prints-every-case-the-report-records-as-skipped-with-the-operating-system (@ac-4)

Consumes: `ctx.snapshot.tests`, `staleReport` (`commands/task-done.ts:23`). Produces: the command Task 7's verify
skill runs right after the full suite.

Test first, appended at the end of `packages/cli/test/lane-commands.test.ts`, with `30000` as the third argument:
- `it('ac-4 tests skipped prints every case the report records as skipped with the operating system')`:
  `repo = makeLaneRepo({ [REPORT]: junit({ 'export#writes-csv': 'passed', 'util#b': 'skipped', 'export#escapes-commas': 'skipped' }) })`,
  `commitAll(repo)`, `freshen(repo)`. `run(['tests', 'skipped'], repo)` exits 0 with `out` exactly
  `` `skipped on ${process.platform}: 2\nexport#escapes-commas\nutil#b\n` ``. Then
  `utimesSync(REPORT_PATH(repo), OLD, OLD)`: exit 2 and `err` contains `run the tests again`. With a report holding
  no skipped case, freshened: `out` is `` `skipped on ${process.platform}: 0\n` ``. A repository whose config has no
  `tests.report` (as the existing baseline case builds it): exit 2, `err` contains `no tests.report`.

Interface:
- `tests-skipped.ts`: `export function testsSkipped(ctx: CommandContext): number`. The same three refusals, in the
  same order and words, as `testsBaseline` (`tests-baseline.ts:17-25`). Then write
  `skipped on <process.platform>: <n>\n` and each id whose status is `skipped`, sorted by code point, one per line.
  It writes no file.
- `run.ts`: `program.command('tests')` becomes `const tests = program.command('tests').description(...)` with the
  same description; `tests.command('baseline')` keeps its description and action; add
  `tests.command('skipped').description('print every case the test report records as skipped, with the operating system it ran on').action(() => { setCode(testsSkipped(preflight(opts))); })`.
- `skill-commands.test.ts:92`: the expected list gains `'tests skipped'` after `'tests baseline'`.

Must not change: `tests baseline`'s behaviour and every case of it; the other entries of that list.

## Task 5: Assertions that run only on some operating systems sit in tests the runner skips
covers: @ac-5, D-04, D-05
files: packages/core/agents/executor.md, packages/core/agents/reviewer.md, packages/core/src/generated/agents.ts, .claude/agents/accord-executor.md, .claude/agents/accord-reviewer.md, packages/cli/test/worktree.test.ts, packages/cli/test/workflow-script.test.ts, packages/cli/test/publish-workflow.test.ts, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#ac-5-an-assertion-that-runs-only-on-some-operating-systems-sits-in-a-test-the-runner-skips (@ac-5), packages/cli/test/worktree.test.ts#risk:complex-branching-a-worktree-remove-that-fails-part-way-removes-it-in-part-and-names-what-is-left, packages/cli/test/workflow-script.test.ts#risk:regression-bash-runs-on-a-posix-host-so-the-executed-workflow-script-cases-are-not-skipped-there, packages/cli/test/publish-workflow.test.ts#risk:regression-bash-runs-on-a-posix-host-so-the-executed-version-check-cases-are-not-skipped-there

Consumes: nothing from other tasks. Produces: the executor rule and reviewer finding Task 7's spec text names.

Test first, in `packages/core/test/stage-skills.test.ts`, appended at the end (add `readdirSync`, `readFileSync`
from `node:fs`, `join` from `node:path` and `fileURLToPath` from `node:url`):
- `it('ac-5 an assertion that runs only on some operating systems sits in a test the runner skips')`:
  - `flat` collapses whitespace. `exec` is the rendered `.claude/agents/accord-executor.md` and `rev` the rendered
    `.claude/agents/accord-reviewer.md` from `agentTargets(config)`, each flat and non-empty.
  - `exec` contains `goes in a test of its own`, `the test runner's own skip` and
    `never behind an early return or a branch on the operating system inside a test`.
  - `rev` contains `An early return or a branch on the operating system inside a test` and
    `leaves an assertion unrun on some operating system is a finding`.
  - `root = fileURLToPath(new URL('../../../', import.meta.url))`. Walk `packages/core/test`, `packages/cli/test` and
    `test` under `root` recursively (`readdirSync(dir, { recursive: true, withFileTypes: true })`), every `.ts`
    file. `needle = 'process.' + 'platform'` (split so this file never matches itself). Every line holding `needle`
    must also match `/\.(skipIf|runIf)\(/`; the offenders, as `<path>:<line>`, equal `[]`. Guard the guard: at least
    three lines hold `needle`.

Test conversions (the new tests first, then remove the early returns):
- `packages/cli/test/worktree.test.ts`: lines 428-446 of the case `risk:complex-branching a worktree remove that
  fails is named truthfully` move, unchanged except for the removed `if (...) return;` line, into a new top-level
  `it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('risk:complex-branching a worktree remove that fails part way removes it in part and names what is left', async () => { ... })`
  placed right after that case. The original case keeps its title and lines 414-426.
- `packages/cli/test/workflow-script.test.ts`: remove the `if (process.platform !== 'win32') { ... }` block at
  279-281 from the case inside `the emitted workflow script — what is under test`, and add right after that
  `describe`, top-level:
  `it.skipIf(process.platform === 'win32')('risk:regression bash runs on a posix host so the executed workflow script cases are not skipped there', () => { expect(noBash, `${BASH} did not run on a POSIX host; set ACCORD_BASH`).toBe(false); });`
  The T-07-35 comment above the `describe` stays.
- `packages/cli/test/publish-workflow.test.ts`: the same for lines 124-126, the new test titled
  `risk:regression bash runs on a posix host so the executed version check cases are not skipped there`.

Text:
- `packages/core/agents/executor.md`, a bullet after the `(@ac-n)` bullet: "- An assertion that should run only on
  some operating systems goes in a test of its own, skipped on the others through the test runner's own skip;
  never behind an early return or a branch on the operating system inside a test."
- `packages/core/agents/reviewer.md`, a bullet at the end of lens `quality`: "- An early return or a branch on the
  operating system inside a test that leaves an assertion unrun on some operating system is a finding: that
  assertion belongs in a test of its own, skipped through the test runner's own skip."
- Regenerate as the preamble says.

Must not change: the two existing `what is under test` case titles (both are in `accord/tests-baseline.txt`, lines
172 and 286) and their other assertions; every agent phrase `packages/core/test/agents.test.ts` asserts; each
agent body stays within 60 lines (`agents.test.ts:101`). No `accord lint` rule is added (D-05).

## Task 6: A failure found after verify goes to accord-debug, and its fix gets its own review round
covers: @ac-1, @ac-3, D-01, D-02, D-03, D-07
files: packages/core/skills/shared/failure.md (new), packages/core/skills/accord/SKILL.md, packages/core/skills/debug/SKILL.md, packages/core/skills/review/SKILL.md, packages/core/agents/debugger.md, packages/core/src/generated/skills.ts, packages/core/src/generated/agents.ts, .claude/skills/accord/SKILL.md, .claude/skills/accord/failure.md (new), .claude/skills/accord-debug/SKILL.md, .claude/skills/accord-debug/failure.md (new), .claude/skills/accord-review/SKILL.md, .claude/agents/accord-debugger.md, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#ac-1-a-failure-reported-after-verify-goes-to-the-debug-stage-before-any-fix (@ac-1), packages/core/test/stage-skills.test.ts#risk:complex-branching-the-fix-review-after-verify-reads-only-the-changes-after-the-review-base-and-counts-its-own-five-rounds

Consumes: the `Review base:` anchor line (Task 1) and the review package (Task 3). Produces: `failure.md`, which
Task 7's verify skill also loads.

Byte budget, measured on the rendered copies before editing: `.claude/skills/accord/SKILL.md` is about 5106
bytes, `accord-debug` about 4800, `accord-review` about 4840. The edits below change them by about -17, +67 and
+160 bytes. All three must end at most 5120.

Tests first, in `packages/core/test/stage-skills.test.ts`, top-level, using the file's `files` and a `flat` helper
that collapses whitespace:
- `it('ac-1 a failure reported after verify goes to the debug stage before any fix')`:
  - `text` = flat `.claude/skills/accord/SKILL.md`. `i = text.indexOf('A failure reported in a ticket at verify or done follows `./failure.md`.')`
    is greater than -1 and less than `text.indexOf('## Dashboard')`.
  - `a` = flat `.claude/skills/accord/failure.md` and `d` = flat `.claude/skills/accord-debug/failure.md`: both
    non-empty and equal. `a` contains: `its pull request is not merged`,
    `with or without the failing command and its output`, `Never judge the cause yourself`,
    `never dispatch a fix outside `accord-debug``, `load `accord-debug` for that ticket`,
    `the debugger finds them itself`, `` `gh run view <run-id> --log-failed` ``, `keeps its count of failed fixes`
    and `a new bug ticket`.
  - `dbg` = flat `.claude/skills/accord-debug/SKILL.md`: contains `For a failure found after verify, read `./failure.md`.`,
    `or the report alone when it gives neither` and `run `accord anchor` again and go to the stage it prints now`,
    and does not contain `The stage it prints is the one this returns to`.
  - The rendered `.claude/agents/accord-debugger.md` from `agentTargets(config)`, flat, contains
    `find the failing command and its output yourself` and `` `gh run view <run-id> --log-failed` ``.
- `it('risk:complex-branching the fix review after verify reads only the changes after the review base and counts its own five rounds')`:
  `rv` = flat `.claude/skills/accord-review/SKILL.md`. `step2 = rv.slice(rv.indexOf('2. **Package.**'), rv.indexOf('3. **Reviewers.**'))`
  contains `` `Review base: <sha>` `` and `` `accord review-package <id> --base <sha>` ``;
  `rv.slice(rv.indexOf('6. **Cap.**'), rv.indexOf('7. **Final review.**'))` contains
  `after verify counted from the first round after it`.

Text, each code span on one line:
- `packages/core/skills/shared/failure.md` (new), exactly:

  ```
  ---
  kind: reference
  ---

  # A failure found after verify

  A failure is found after verify when ticket <id> is at `verify` or `done`
  (`accord anchor` prints the stage), its pull request is not merged
  (`gh pr view <branch> --json state` does not print `MERGED`), and either
  someone reports a failure in its work, with or without the failing
  command and its output, or verify finds a failed check on that pull
  request. A failure after the merge is not one: it needs a new bug ticket.

  1. Never judge the cause yourself, and never dispatch a fix outside
     `accord-debug`: no executor, no edit, and no Ruling in place of a
     root cause.
  2. When this session is not in that ticket's worktree, first run the
     accord skill's Continue on it. Then load `accord-debug` for that
     ticket: a new episode, or the open one when the last `## ` heading of
     `debug.md` is not `## Resolved`. Pass the debugger the report as given;
     when it names no failing command or output, say so, and the debugger
     finds them itself, for a failed check with
     `gh run view <run-id> --log-failed`.
  3. A failure only another operating system shows (a CI check, or a test
     skipped here): its red is the CI log, and its green is that check
     passing at the next verify. After the fix, go on to the stage
     `accord anchor` prints without `## Resolved`. The episode stays open
     across that verify and keeps its count of failed fixes: the check
     passing there resolves it, the check failing there counts one failed
     fix in it.
  4. After the fix, `accord anchor` prints `review` and a `Review base:`
     line: the fix gets its own review round, then verify runs again.
  ```
- `packages/core/skills/accord/SKILL.md`: frontmatter `loads` gains `shared/failure.md`. The line
  `First run the session check in `./worktree.md`.` becomes
  `First run the session check in `./worktree.md`. A failure reported in a ticket at verify or done follows `./failure.md`.`
  Continue step 2 becomes `2. Run `accord anchor`.` (its second sentence is dropped to stay under the cap; the
  anchor prints the same). Nothing else changes.
- `packages/core/skills/debug/SKILL.md`: `loads` becomes `[shared/ask.md, shared/failure.md]`. Step 1 becomes
  `1. Run `accord anchor`. For a failure found after verify, read `./failure.md`.` In step 3, "and the failing
  command and its output." becomes "and the failing command and its output, or the report alone when it gives
  neither." Step 9's first sentence "Next: return to the stage `accord anchor` prints." becomes "Next: run
  `accord anchor` again and go to the stage it prints now."; the rest of step 9 stays.
- `packages/core/skills/review/SKILL.md`: at the end of step 2 add "After `accord anchor` prints
  `Review base: <sha>`, use `accord review-package <id> --base <sha>`: only the changes after verify." In step 6,
  "At most five rounds." becomes "At most five rounds, after verify counted from the first round after it."
- `packages/core/agents/debugger.md`, the input bullet: "the failing command with its output" becomes "the failing
  command with its output, or a failure report that gives neither: then find the failing command and its output
  yourself, for a failed CI check with `gh run view <run-id> --log-failed`".
- Regenerate as the preamble says, then measure the three rendered SKILL.md files.

Must not change: every phrase `REQUIRED` and the existing accord, review and debug cases in `stage-skills.test.ts`
assert (`First run the session check in `./worktree.md`.` stays a substring; `its step 3 for the task that entered
debug` and `five` stay); `agents.test.ts`'s debugger phrases; the accord skill's first command stays
`accord dashboard` (`failure.md` is not a SKILL.md, and the new line names no command); no rendered text names a
runtime product or a `packages/` path.

## Task 7: Verify runs the pull request's CI beside its own checks and reports skipped tests; the spec says so
covers: @ac-2, @ac-4, D-01, D-06, D-07, D-08, D-09
files: packages/core/skills/verify/SKILL.md, packages/core/skills/verify/ci.md (new), packages/core/src/generated/skills.ts, .claude/skills/accord-verify/SKILL.md, .claude/skills/accord-verify/ci.md (new), .claude/skills/accord-verify/failure.md (new), packages/core/test/stage-skills.test.ts, docs/specs/2026-10-12-workflow-layer-design.md
verify: packages/core/test/stage-skills.test.ts#ac-2-verify-starts-ci-before-the-suite-and-shows-the-owners-report-only-after-every-check-finished (@ac-2), packages/core/test/stage-skills.test.ts#risk:regression-the-owners-report-lists-every-test-the-verify-run-skipped-by-name-with-its-operating-system

Consumes: `accord tests skipped` (Task 4, already registered, so the command check in `skill-commands.test.ts`
passes) and `shared/failure.md` (Task 6). The rendered verify SKILL.md is about 3830 bytes; this adds about 500.

Tests first, in `packages/core/test/stage-skills.test.ts`, top-level, with the same `flat` helper:
- `it('ac-2 verify starts ci before the suite and shows the owners report only after every check finished')`:
  - `v` = flat `.claude/skills/accord-verify/SKILL.md`; `s2 = v.slice(v.indexOf('2. **Suite.**'), v.indexOf('3. **Verifier.**'))`
    has `s2.indexOf('Start CI as `./ci.md` says')` greater than -1 and less than
    `s2.indexOf('run the `tests.full` command')`. `s4 = v.slice(v.indexOf('4. **Report.**'), v.indexOf('5. **Owner.**'))`
    contains `Wait for CI as `./ci.md` says`, `a failed check goes to `./failure.md` instead of this report` and
    `CI: each check's result, or CI not checked and why`. `v.slice(v.indexOf('6. Run'))` contains
    `finish CI as `./ci.md` says`.
  - `ci` = flat `.claude/skills/accord-verify/ci.md`: `ci.indexOf('## Start')` < `ci.indexOf('## Wait')` <
    `ci.indexOf('## Finish')`, all greater than -1. It contains: `no GitHub remote`, `` `gh auth status` ``,
    `` `gh pr create --draft --fill` ``, `A pull request already open is left as it is`, `Never merge it`,
    `A push that changed nothing still counts`, `gh run list --commit <sha> --json`, `` `.github/workflows/accord.yml` ``,
    `never wait for it and never send it to debug`, `ten minutes`, `thirty minutes`, `` `cancelled` and `skipped` ``,
    `goes to no debug`, ``CI failed on `<sha>` `` and `Do not wait for CI again`.
    `fin = ci.slice(ci.indexOf('## Finish'))` has `fin.indexOf('`accord lint`')` > -1, less than
    `fin.indexOf('`gh pr ready`')`, and contains `` `accord gate done <t>` for every ticket file ``.
  - `.claude/skills/accord-verify/failure.md` exists in `files` and is non-empty.
- `it('risk:regression the owners report lists every test the verify run skipped by name with its operating system')`:
  in `s2`, `s2.indexOf('run `accord tests skipped`')` is greater than `s2.indexOf('run the `tests.full` command')`;
  `s4` contains `every test `accord tests skipped` printed, by name, with the operating system it names`.

Text:
- `packages/core/skills/verify/SKILL.md`: `loads` becomes `[verify/ci.md, shared/ask.md, shared/failure.md]`.
  - Step 2 becomes: "2. **Suite.** First commit everything, `review.md` included, so the working tree is clean:
    that commit is the one verified. Start CI as `./ci.md` says, then run the `tests.full` command from
    `accord/config.yml` at it, so the report `tests.report` names is fresh. Right after it, before the verifier,
    run `accord tests skipped` and keep what it prints."
  - Step 4 opens with "Wait for CI as `./ci.md` says first; a failed check goes to `./failure.md` instead of this
    report." Its bullets gain, after the criterion bullet, "- CI: each check's result, or CI not checked and why;"
    and the "what was not checked" bullet becomes "- what was not checked, including every criterion the verifier
    recorded as `blocked`, every check CI did not check, and every test `accord tests skipped` printed, by name,
    with the operating system it names;".
  - Step 6 gains, at its end, "Then finish CI as `./ci.md` says."
- `packages/core/skills/verify/ci.md` (new), exactly:

  ```
  ---
  kind: reference
  ---

  # CI on the pull request

  Verify watches the pull request's CI once, while its own checks run. Only
  GitHub Actions on a GitHub pull request is read; anything else is
  reported as CI not checked, with the reason.

  ## Start: step 2, before the suite

  1. Read `git remote get-url origin`. No `origin`, or a host other than
     `github.com`: CI not checked, "no GitHub remote"; skip the rest of Start.
  2. Run `gh auth status`, then
     `gh pr list --head <branch> --state open --json number,url`. gh
     missing, not logged in, or unable to reach the repository: CI not
     checked, with gh's message; skip the rest of Start.
  3. Run `git push -u origin <branch>`. A rejected push: CI not checked,
     with git's message; skip the rest of Start. Note `<sha>`, from
     `git rev-parse HEAD`, and the time. A push that changed nothing still
     counts: the runs already on `<sha>` are used.
  4. When that list was empty, run `gh pr create --draft --fill`. A pull
     request already open is left as it is. Never merge it: merging waits
     for the owner.

  Then run the suite and the verifier while CI runs.

  ## Wait: step 4, before the report

  - Only runs on `<sha>` count:
    `gh run list --commit <sha> --json databaseId,workflowName,status,conclusion`.
    Leave out the workflow whose `name:` is in `.github/workflows/accord.yml`:
    never wait for it and never send it to debug; step 6's local checks
    stand in for it.
  - Read the list once a minute until a run appears. None within ten
    minutes of the push: CI not checked, "no check appeared on `<sha>`
    within ten minutes".
  - Then read it once a minute until every run is `completed`. A run not
    completed thirty minutes after it appeared: CI not checked for it, by
    name, "still running after thirty minutes".
  - Once every run has finished: `success` passed; `failure`, `timed_out`
    and `startup_failure` failed; any other conclusion, `cancelled` and
    `skipped` among them, is CI not checked for that run, by name, and goes
    to no debug.
  - Any failed run: give the owner one line, "CI failed on `<sha>`:
    <the failed runs' names>", show no report, ask for no tick, and follow
    `./failure.md` with the failed runs' ids.
  - Otherwise the report gives each run's name and result.

  ## Finish: step 6, after the tick is committed

  1. Run `accord lint`, then `accord gate done <t>` for every ticket file
     `git diff --name-only --diff-filter=d origin/HEAD...HEAD` lists as
     `accord/tickets/<t>.md` (`origin/main` when `origin/HEAD` is not
     set). Any failure: show it and stop; nothing is pushed.
  2. When Start pushed, run `git push`, then `gh pr ready`. Do not wait for
     CI again.
  ```
- `docs/specs/2026-10-12-workflow-layer-design.md`:
  - §6, after the bullet ending "never re-runs completed tasks." add: "- After verify, any commit on the ticket's
    branch that the default branch does not hold and that changes a path outside the ticket's own records takes
    the stage back from `done`: to `review` for a hand-made change, with `accord anchor` printing the review base,
    the commit before the first unreviewed change, until a review round of those changes is recorded in
    `review.md`; to `verify` for a merge from the default branch alone. A ticket whose verified commit is on the
    default branch keeps its stage."
  - §11, after the owner's report list, add a paragraph: "A failure found after verify (someone reports one, or a
    check on the pull request fails) goes to `accord-debug`; the main session never judges the cause or fixes it
    outside that stage. Verify pushes the branch and opens a draft pull request before the full suite, waits for
    every check on the pushed commit other than the accord workflow's before the owner's report, and after the tick
    runs `accord lint` and `accord gate done` for every ticket the pull request touches, pushes, and marks the pull
    request ready without waiting again. The report names every test `accord tests skipped` lists, with the
    operating system. An assertion that runs only on some operating systems sits in its own test, skipped through
    the test runner's own skip."
- Regenerate as the preamble says, then measure the rendered verify SKILL.md.

Must not change: every `REQUIRED.verify` phrase; steps 3 and 5 of verify; verify's first command stays
`accord anchor`; no rendered text names a runtime product or a `packages/` path.
