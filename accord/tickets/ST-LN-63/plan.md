---
baseline: 57b9310260535e1e9e9769258a8063d793869991
plan_hash: "fnv1a64:9f2802da03611771"
---

Review mode `outcome`: one branch, no slices. Every task can be finished from its own section, this preamble, the
ticket and its ledger.

Order: Task 1 builds the counting harness and the sample repositories; Task 2 records the goldens and the git counts
at the baseline. Neither touches a file under `packages/*/src`. Tasks 3 to 6 are the wiring: Part 1, then the loader's
per-ticket reads, ending in Task 6, whose ac-1 test runs the five read commands end to end. Tasks 7 to 11 are the other
Part 2 items, each with its own count assertion (D-05); Task 11 adds the ac-3 test, which runs every Part 2 item's
count assertion on the four worktree commands (D-11, D-12). Tasks 12 to 14 are Part 4.

Rules for every task:
- Test ids: every test this plan writes is a top-level `it(...)` with no `describe` around it. Its report id is the
  test file's path from the repository root, `#`, then the title with each whitespace run turned into `-`. No title
  holds `@`, a comma or an apostrophe. No existing test is renamed.
- CLI tests import core from `packages/core/dist`. End every task with `npm run build`, `npm run lint` and
  `npm run typecheck`, then run with `npx vitest run <path>` each test file the task names and
  `packages/cli/test/goldens.test.ts`, which must stay green from Task 2 on.
- The two files under `packages/cli/test/__golden__/st-ln-63/` are written once, by Task 2, at the baseline. No other
  task edits, re-records or deletes them. Every test reads them with `readGolden` (Task 2), which fails naming the file
  when it is absent, so neither `vitest -u` nor a renamed test can rewrite them.
- Sample build time: a test file that uses a sample builds it in `beforeAll(() => ..., <limit>)` (the second argument
  is the hook's own time limit, as packages/cli/test/worktree.test.ts:51-53 does with `180_000`), never inside an `it`,
  so no test pays for the build inside its own limit. Each `it` that runs samples passes its own time limit as `it`'s
  third argument, at least three times its time measured on Windows.
- conventions.md binds every task: each `git log` and `git show` the code runs passes
  `-c log.showSignature=false --no-show-signature` and a 64 MiB `maxBuffer`; paths read from git output are read with
  `-z`; no unbounded list of shas or paths goes on one command line; a test that makes a commit uses
  `git commit -F <file> --cleanup=verbatim` (or `git fast-import`, whose `data` blocks carry exact bytes); local
  branches are deleted only with `update-ref -d <ref> <sha>`; a time bound is wide enough for the whole suite running
  in parallel; vitest's JUnit output goes to `--outputFile.junit=node_modules/.cache/...`.
- Every git spawn is `execFileSync('git', [...])` with a literal argument array, never a shell, spawned by name. Paths
  stored or printed use `/` (`path.posix`). Nothing under `packages/core/src` changes: the gates read the same
  `RepoSnapshot` fields, now supplied only where read.
- Files are LF with no BOM. Add no dependency.
- Part 4 keeps (Tasks 12 to 14): a Part 4 task is done when its verify cases pass, whatever the measured time. The
  10 s limit holds for each of the four tests and for every test a Part 4 task splits off from one of them (D-12). A
  test still at or over 10 s is reported by the executor, by its own title, with its time alone and with the suite,
  where the time goes, why it cannot be cut further, and a proposed ceiling: the with-suite time times 1.35 (the
  loaded-run factor the Intent names), rounded up to a whole second. The executor writes nothing in the ticket and the
  plan goes on with the next task meanwhile; no task after it depends on the answer. The main session asks the owner;
  an approved keep is written by the main session as a new last line of the ticket's `## Decisions`,
  `- D-<next> <test title> is kept with a ceiling of <n> s: <reason> — "<the owner's words>"`. `## Decisions` is an
  approved section (packages/core/src/gate/hash.ts:46), so that line makes `gate done` fail with `gate.approval-stale`
  (packages/core/src/gate/rules.ts:105-110) until the owner says yes again and the main session runs
  `accord approve ST-LN-63`; both happen before `gate done`. At verify, the times of the four tests and of every
  split-off test are read from the junit report of the owner's full run on the owner's machine against 10 s or the
  approved ceiling (ac-4, D-11); there is no separate CI check.

Definitions shared by every task:
- Counting harness: `packages/cli/test/helpers/git-spawns.ts` (Task 1). A test file counts git spawns by declaring
  `vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig()));`.
  Only spawns made while `spawnLog.on` is true are recorded, and only then is `fail` applied. `counted` (Task 2) turns
  it on only around `await run(...)` and `countedSync` (Task 1) only around one synchronous call such as
  `loadFromFs(...)`, so what is counted is the git processes accord itself starts (D-09), never the test's own setup.
- Run key: one entry of `RUNS` in `packages/cli/test/helpers/runs.ts` (Task 2), written `<place> <argv joined by spaces>`,
  for example `main status --json`, `wt-A-7 gate done A-7 --json`, `main worktree clean`.
- Count assertion of key K with predicate P (P over one git argument array): `expectFewer(K, P, argv?)` in
  `packages/cli/test/helpers/items.ts` (Task 3). `before` is the number of arrays in `git-counts.before.json[K]` that P
  matches and `after` the same over `argv` when given, else over a fresh `runSample([K])`. It asserts
  `expect(before).toBeGreaterThan(0)` then `expect(after).toBeLessThan(before)`, each with a message naming K. P matches
  git's subcommand and flags, never a normalised sha or path. P always also matches the command the item adds, so a
  build that ran the new command once per ticket or per branch fails the assertion.
- A Part 2 item's count assertions are one entry `{ item, keys, p }` of `ITEMS` in items.ts, added by the task that
  builds the item; that task's risk test runs it with `checkItem(entry)` (`expectFewer` for each key), and Task 11's
  ac-3 test runs every entry on each of its keys that names one of the four worktree commands (D-05, D-11, D-12).
- The default ref: `gitDefaultRef(root)` (origin's), else the first of `refs/heads/main` and `refs/heads/master` that
  resolves (`defaultRefOf`, fs.ts:292).
- A ticket's start commit: its `verified_commit`, else the `commit:` of its verification.md, each kept only when a
  sha (`startOf`, fs.ts:367); with neither, the review start: the last commit on its tips that touched its review.md
  (`reviewStartOf`, fs.ts:374).
- An open task: a task of the ticket's plan whose number is not a key of its ledger's `done` (stage.ts:84-86, read
  through `workOf`, which core exports). Core reads `afterVerify` for a ticket only when it is lane S
  (stage.ts:73, gate/lane-s.ts:85) or has no open task (stage.ts:91-94), and a plan subject only when the ticket has a
  lane other than S and an open task (stage.ts:91).
- An entry: a ticket with a start commit or a review.md and with tips (`HEAD` for the ticket of the current branch,
  else its claim tips), as `afterWanted` holds them today (fs.ts:553-567), and for which `readsAfter` (Task 5) holds.
- With a merge (D-10, D-11): a ticket whose branch, between the default ref and its tips, holds a commit with more than
  one parent, before or after its review commit. A sample's `withMerge` lists them.
- The walk (Task 5) and an own call (Task 5) are defined there and used by Tasks 6 and 7. Accord never steps through a
  merge itself (D-10): wherever the walk would, the ticket's read goes to git's own call, as today.

## Task 1: The counting harness and the sample repositories
covers: D-04
files: packages/cli/test/helpers/git-spawns.ts (new), packages/cli/test/helpers/samples.ts (new), packages/cli/test/samples.test.ts (new)
verify: packages/cli/test/samples.test.ts#risk:complex-branching-each-sample-ticket-shows-the-stage-its-kind-is-built-for

This task's commit holds only the three files above and is made with the baseline code: no file under
`packages/*/src` changes.

Produces, in `git-spawns.ts` (it imports nothing, since a `vi.mock` factory loads it):
- `export const spawnLog: { on: boolean; calls: string[][]; fail?: (args: string[]) => boolean; after?: (args: string[], options?: { cwd?: string }) => void }`.
- `export function wrapChildProcess(actual)`: returns `{ ...actual }` with `execFileSync`, `spawnSync`, `execFile` and
  `spawn` wrapped. For `file === 'git'` while `spawnLog.on`: push a copy of the argument array to `calls`; when
  `fail?.(args)` is true, throw an Error with `status: 128` and `stderr: 'fatal: injected'` instead of spawning; else
  call the real function with the same arguments and then `after?.(args, options)` (the call's options object) with
  `on` cleared and restored around it, so git run by the hook is never counted. Every other call passes straight
  through.
- `export function countedSync<T>(fn: () => T): { value: T; argv: string[][] }`: clears `calls`, sets `on`, calls
  `fn`, clears `on` in a `finally`, returns the value and a copy of `calls`. A test that calls the loader directly
  (Tasks 4 and 5) calls it inside `countedSync`, so its counts and its injected failures are real.

Produces, in `samples.ts`:
- `buildSample(tickets: { id: string; kind: Kind }[], opts: { template?: string; ahead?: string[] } = {}): Sample`.
  A bare remote and a clone in fresh `mkdtemp` folders under `os.tmpdir()`, `git init -b main`; config user.email
  `fixture@example.invalid`, user.name `fixture`, commit.gpgsign false, core.autocrlf false, gc.auto 0,
  maintenance.auto false (remote: gc.auto 0, receive.autogc false), as `makeTemplate` in helpers/worktree.ts does.
  Every commit is written by `git fast-import` (`--quiet --export-marks=<f> --import-marks-if-exists=<f>`), one
  process per phase; a new phase starts only where a file must hold the sha of a commit made before it (a plan
  `baseline:`, a `verified_commit`, a verification.md `commit:`), shas read from the marks file. Each commit's author and
  committer date is the build's start time minus a fixed offset in seconds per commit, so idle days are the same in
  every run while shas differ between runs. The first phase's main commit holds the config and every ticket's file;
  every branch forks from main after it; a main commit after it changes a ticket's records only for the done and
  dropped kinds. Then `git remote add origin <remote>`, one `git push -q origin refs/heads/*:refs/heads/*`,
  `git remote set-head origin main` and `git reset -q --hard`; then, for each id in `opts.ahead`, one more commit on
  its local branch only that changes only that ticket's ledger, so the local branch is one commit ahead of its pushed
  one (two claim tips). The config is `CONFIG` from test/helpers/lane.ts (repository root), plus
  `branch: "<template>"\n` when `opts.template` is given (as packages/cli/test/lane-commands.test.ts:1073 builds
  `BRANCHED`); branch names follow the template, `t/{id}` by default. Ticket and record texts come from lane.ts's
  `laneTicket`, `approve`, `ready`, `building`, `done`, `PLAN` and `junit` helpers, with `baseline:` and shas filled in.
  Every plan.md carries `plan_hash` equal to the body hash core computes for it
  (`loadSnapshot(...).work[id].plan.bodyHash`), so a passing `gate plan` writes nothing.
- `Sample`: `{ root, remote, names: Record<string, string>, withMerge: string[], copy(): SampleCopy, cleanup() }`.
  `names` maps each fixture commit's full sha to a stable name (`main-1`, `A-6-review`, `A-6-merge`, ...).
  `withMerge` lists the ids whose branch holds a merge commit that is not on main, in ticket order.
- `SampleCopy`: `{ root, remote, worktree(id): string, cleanup() }`. `copy()` copies root and remote with `cpSync` into
  fresh folders and points `origin` at the copied remote with `git remote set-url` and checks both URLs, as
  `copyClone` does (reuse it when its `Clone` shape fits). `worktree(id)` runs
  `git worktree add <root>-<id lower> <the ticket's branch>`.
- Kinds, in this order (each ticket's file is on main; a branch is local and on origin at the same sha unless `ahead`
  names it):
  - `intent`: the ticket file on main, no approval, no branch.
  - `plan`: approved ticket and plan.md on the branch; the last commit touching plan.md is not `plan: <id> ready`.
  - `build-missing-file`: plan ready (`plan: <id> ready`), task 1 done in the ledger; `baseline:` is a main commit that
    is an ancestor of the branch; task 2's `files:` names `src/missing.ts`, absent at that baseline and not `(new)`.
  - `plan-foreign-baseline`: plan ready; `baseline:` is a commit on the branch of the nearest earlier ticket of kind
    `plan` in the list, not an ancestor of its own.
  - `review`: every task done; review.md has no verdict.
  - `verify-merged`: every task done, review.md `verdict: converged` committed (the review commit), then main moves and
    is merged into the branch with a merge commit, as `worktree merge` does; no verification.md. Listed in `withMerge`.
  - `verify-straight`: review commit R; then one commit that changes only the ticket's own records, adding
    verification.md with `commit: R` and `verified_commit: R` with no bound ticks. Main moves after the branch's fork.
  - `verify-merged-before`: every task done; main moves and is merged into the branch with a merge commit; then one
    code commit; then review.md `verdict: converged` committed (the review commit), the branch's last commit; no
    verification.md. Listed in `withMerge`.
  - `done-merged`: done records (`done` helper, `verified_commit`, verification.md); the branch is merged into main with
    `--no-ff`; the branch is kept.
  - `done-squash`: done records; main holds one commit with the branch's whole change; the branch is kept.
  - `done-rebased`: done records; main holds the branch's commits replayed on main; the branch is kept.
  - `done-extra`: as `done-squash`, plus one branch commit after the verified commit that changes code main lacks.
  - `dropped`: on main, `status: dropped` with a `## Dropped` reason; the branch is unmerged.
  - `lane-s`: a lane S ticket (`laneTicket(id, { lane: 'S', ... })`) on its branch with `ac_hash`, one code change, then
    review.md with `## Round 1` and `verdict: converged` committed.
- `MIXED`: A-1 intent, A-2 plan, A-3 build-missing-file, A-4 plan-foreign-baseline (baseline on A-2's branch), A-5
  review, A-6 verify-merged, A-7 verify-straight, A-8 done-merged, A-9 done-squash, A-10 done-rebased, A-11
  done-extra, A-12 dropped, A-13 verify-merged-before, S-1 lane-s; default options.
- `SIDE`: F-1 verify-straight, F-2 review, F-3 verify-merged, F-4 plan, with `template: 'feature/{id}'` and
  `ahead: ['F-1']`. Its place `side` is a copy as built; its place `side-local` is a copy after
  `git remote remove origin`, which drops every `refs/remotes/origin/*` ref, so the default ref falls back to
  `refs/heads/main` and every claim comes from a local branch.
- `export const SAMPLE_BUILD_LIMIT`: at least three times the build of MIXED and SIDE together measured on Windows,
  in milliseconds.
- `prepareSamples(): { mixed: Sample; side: Sample }`, built once per test file and kept at module level;
  `samples()` returns them and throws `call prepareSamples in beforeAll first` when they are not built.

Test written first, in `samples.test.ts`: `beforeAll(() => prepareSamples(), SAMPLE_BUILD_LIMIT)`, `afterAll` cleaning
both, then `it('risk:complex-branching each sample ticket shows the stage its kind is built for', ...)`. From a
MIXED copy's root, `run(['status', '--json'])` shows A-1 intent, A-2 plan, A-3 and A-4 build, A-5 review, A-6, A-7
and A-13 verify, S-1 done, and A-8 to A-12 as main records them; `withMerge` is `['A-6', 'A-13']`, and in the copy
`git rev-list --merges refs/heads/main..refs/heads/t/A-13` prints one sha that is an ancestor of A-13's review commit.
From `side` and from `side-local`, `status --json` shows F-1 verify, F-2 review, F-3 verify, F-4 plan, each with
branch `feature/<id>`; SIDE's `withMerge` is `['F-3']`; in `side`, `refs/heads/feature/F-1` and
`refs/remotes/origin/feature/F-1` differ and the first is a child of the second; `side-local` has no
`refs/remotes/origin/` ref. A kind that shows another stage is fixed in the builder, never in `src`. See it fail (no
samples.ts), then build. Measure the build and the test on Windows, set `SAMPLE_BUILD_LIMIT` and the test's own limit
as the preamble says, and report both times.

## Task 2: Goldens and git counts recorded at the baseline
covers: @ac-2, D-04, D-07
files: packages/cli/test/helpers/runs.ts (new), packages/cli/test/goldens.test.ts (new), packages/cli/test/__golden__/st-ln-63/goldens.json (new), packages/cli/test/__golden__/st-ln-63/git-counts.before.json (new)
verify: packages/cli/test/goldens.test.ts#ac-2-every-command-prints-what-it-printed-before-the-change (@ac-2)

This task's commit holds only the four files above and is made with the baseline code: no file under
`packages/*/src` changes. Every following task is checked against what it records. Consumes Task 1's harness,
`prepareSamples`, `samples()` and `SampleCopy`.

Produces, in `runs.ts`:
- `RUNS`, in this order. Places: `main` is a MIXED copy's root; `wt-<id>` is that ticket's linked worktree in the same
  copy; `side` and `side-local` are Task 1's SIDE places. The `main` and `wt-*` read runs share one MIXED copy that
  holds worktrees for A-3, A-4, A-7 and S-1; the `side` runs share one copy and the `side-local` runs another; each of
  the last four runs gets its own fresh MIXED copy (with A-7's worktree for the merge).
  `main status`, `main status --json`, `main lint`, `main lint --json`, `main dashboard`, `main dashboard --json`,
  `main show A-6`, `main show A-6 --json`, `main show A-13 --json`, `main anchor A-6`, `main anchor`,
  `main gate done A-8 --json`,
  `wt-A-7 status --json`, `wt-A-7 anchor`, `wt-A-7 lint --json`, `wt-A-7 dashboard --json`, `wt-A-7 show A-7 --json`,
  `wt-A-7 gate plan A-7 --json`, `wt-A-7 gate done A-7`, `wt-A-7 gate done A-7 --json`, `wt-A-3 gate plan A-3`,
  `wt-A-3 gate plan A-3 --json`, `wt-A-4 gate plan A-4 --json`, `wt-S-1 gate done S-1`, `wt-S-1 gate done S-1 --json`,
  `side status`, `side status --json`, `side lint --json`, `side dashboard --json`, `side show F-1 --json`,
  `side anchor F-1`, `side-local status`, `side-local status --json`, `side-local lint --json`,
  `side-local dashboard --json`, `side-local show F-1 --json`, `side-local anchor F-1`,
  `main worktree open A-1` (pick-up), `main worktree clean` (clean), `wt-A-7 worktree merge A-7` (worktree merge),
  `main new ticket N-1 --lane M --worktree` (new ticket --worktree).
- `normalise(text, sample, copy)`: replaces each temporary folder (template root and remote, copy root and remote),
  in its native, forward-slash and `realpathSync.native` spellings and the forward-slash form of that last one,
  longest first, case-insensitively on win32, with `<root>` or `<remote>` (a sibling worktree becomes `<root>-a-7`);
  replaces each run of 7 to 40 hex characters that is a prefix of a known commit with `<sha:NAME>` when 40 long, else
  `<short:NAME>`. Known commits are `names`, plus, after the run, each ref of the copy and of its remote whose sha is
  not a fixture commit, named `ref:<refname>`. Nothing else is replaced (D-07); an unknown sha stays and fails the
  comparison.
- `counted(argv, cwd)`: clears `spawnLog.calls`, sets `on`, awaits `run(argv, cwd, {})` from helpers/repo.ts, clears
  `on` in a `finally`, returns `{ code, out, err, argv: spawnLog.calls }`.
- `runSample(keys = all of RUNS)`: reads the samples with `samples()`, makes the copies the keys need, runs the keys in
  `RUNS` order through `counted`, and returns per key `{ code, out, err, argv, refs? }`, each normalised; `refs`, for
  the four fresh-copy runs, is `git for-each-ref --format=%(objectname) %(refname)` of the copy then of its remote,
  read after the run. It cleans every copy it made.
- `readGolden(name)`: `readFileSync` of `packages/cli/test/__golden__/st-ln-63/<name>` parsed as JSON; when absent it
  throws `<path> is missing: it is recorded once at the ST-LN-63 baseline and never rewritten`.

`goldens.test.ts`: the `vi.mock` line of the counting harness, `beforeAll(() => prepareSamples(), SAMPLE_BUILD_LIMIT)`,
`afterAll` cleaning the samples, then one `it('ac-2 every command prints what it printed before the change', ...)`.
It calls `runSample()`. With `ACCORD_RECORD_ST_LN_63=1` in the environment and neither golden file present, it writes
`goldens.json` (key -> `{ code, out, err, refs? }`) and `git-counts.before.json` (key -> `argv`), each
`JSON.stringify(x, null, 2) + '\n'`; with the variable set and either file present it throws, so nothing re-records
by accident. Then, in every mode, it reads both with `readGolden` and expects each key's `code`, `out`, `err` and
`refs` to equal the golden's.

Test first: write `goldens.test.ts` and see it fail on the missing files; record once with the variable; run it
twice more without it, which must pass both times (other folders, other shas). Measure its time on Windows and set its
own limit as the preamble says. Report the measured time.

## Task 3: Baseline history only in gate plan and gate done
covers: D-01, D-02, D-06
files: packages/cli/src/load/fs.ts, packages/cli/src/commands/gate.ts, packages/cli/test/git-count.test.ts (new), packages/cli/test/helpers/items.ts (new)
verify: packages/cli/test/git-count.test.ts#risk:complex-branching-gate-plan-and-gate-done-read-baseline-history-for-the-gated-ticket-alone-and-the-read-commands-read-none

Part 1. Consumes `gitAncestors`, `gitBaselineFiles`, `gitRecordsSince` (fs.ts:211-285), unchanged, and Task 2's
`runSample` and `readGolden`.

Produces:
- `loadParts` (fs.ts:501) no longer computes or sets `ancestors`, `baselineFiles` or `recordsSince`: the `shas`,
  `ancestors`, `wanted`, `baselineFiles`, `recorded` and `recordsSince` code (fs.ts:526-528, 534-552) and the three
  spreads (fs.ts:590-592) go.
- `export function gitPlanHistory(root: string, snapshot: RepoSnapshot, id: string): { ancestors?: Record<string, boolean>; baselineFiles?: Record<string, string[]> }`.
  `sha = workOf(snapshot, id)?.plan?.baseline`; not a sha (`isSha`) -> `{}`. Else `ancestors = gitAncestors(root, [sha])`,
  `wanted = { [sha]: that plan's non-new task files, de-duplicated in task order }`,
  `baselineFiles = gitBaselineFiles(root, wanted, ancestors)`; returns `{ ancestors }` plus `baselineFiles` when it has
  a key.
- `export function gitRecordsSinceFor(root: string, snapshot: RepoSnapshot, id: string): { recordsSince?: Record<string, string[]> }`:
  the ticket's `verified_commit` and its verification.md `commit:`, each kept when `isSha`, de-duplicated; none ->
  `{}`; else `gitRecordsSince(root, recorded)`, returned under `recordsSince` when it has a key.
- `gate.ts`: `plan` runs `gatePlan({ ...ctx.snapshot, ...gitPlanHistory(ctx.root, ctx.snapshot, id) }, id)`; `done`
  adds `...gitRecordsSinceFor(ctx.root, ctx.snapshot, id)` to `forScope`. `ready` is unchanged.
- `helpers/items.ts`: `expectFewer(key, p, argv?)` as the preamble defines it (before counts from
  `readGolden('git-counts.before.json')`); `export type Item = { item: string; keys: string[]; p: (args: string[]) => boolean }`;
  `export const ITEMS: Item[]`, holding no entry in this task (Part 1 is not a Part 2 item); each Part 2 task appends
  its entries to the array literal; `checkItem(entry)` runs `expectFewer(key, entry.p)` for each of its keys.

Must not change: every gate verdict, finding and finding order; the plan_hash and ac_hash writes; a failed `ls-tree`
or `diff` at the gated ticket's own sha is still the UsageError naming that sha (exit 2); `gitAncestors` never
throws. Only the read commands of a repository with a damaged object stop failing on another ticket's baseline.

Test written first, in `git-count.test.ts` (new; the harness's `vi.mock` line at its top, and
`beforeAll(() => prepareSamples(), SAMPLE_BUILD_LIMIT)` for the count assertions): a lane repository built with
`makeEmptyRepo`, `writeFiles` and `commitMsg` holding T-1 and T-2, whose plans share one baseline (T-1's `files:` exist
there, one of T-2's does not), T-3 whose baseline is not an ancestor of HEAD, and T-4 whose `verified_commit` is HEAD's
parent and whose HEAD commit changes only T-4's own records. Through `counted`: `gate plan T-1 --json` has no
`gate.task-file-unknown`, T-2 has exactly one naming the missing path, T-3 has `gate.plan-baseline-unknown`;
`gate done T-4 --json` has no `gate.tick-stale-commit`. Counts: `status`, `lint`, `dashboard`, `show T-1` and
`anchor T-1` start no `merge-base --is-ancestor`, no `ls-tree` and no `diff --name-only -z --no-renames <sha> HEAD`;
`gate plan T-1` starts one `merge-base --is-ancestor` and one `ls-tree`; `gate done T-4` starts one such `diff`.
`expectFewer('main status', P)` with P = any of those three shapes.

## Task 4: HEAD author from the existing cat-file and claim tips from the claim listing
covers: D-02, D-05
files: packages/cli/src/load/fs.ts, packages/cli/test/git-count.test.ts (new), packages/cli/test/helpers/items.ts (new)
verify: packages/cli/test/git-count.test.ts#risk:parsing-the-head-author-comes-from-the-commit-object-and-from-git-show-when-the-commit-names-an-encoding, packages/cli/test/git-count.test.ts#risk:complex-branching-a-claim-tip-adds-the-local-branch-only-when-the-claim-listing-holds-it

Two Part 2 items in the loader.

HEAD author:
- `gitDefaultBranch` (fs.ts:449) sends `HEAD\n` after its six lines and reads all seven objects before deciding.
  It returns `{ exists, template?, head? }` with `head: { commit: string; author: string } | 'unborn' | undefined`:
  the seventh object of type `commit` gives `commit` (its header sha) and `author` (the email between the last `<` and
  `>` of the `author ` header line); `HEAD missing` gives `'unborn'`; a failed batch, a header holding an `encoding `
  line, or no author line gives `undefined`.
- `gitFacts(root, head)` uses `head` and spawns `git show -s --format=%H%x00%ae HEAD` (today's call, fs.ts:78) only
  when `head` is `undefined`; `'unborn'` returns `undefined` as a failed show does today. Its log of
  `accord/tickets` is unchanged.

Claim tips:
- `gitClaims` adds `%(objectname)` to its format and also returns `listed: Map<string, string>` (every refname it
  printed -> sha).
- `claimTips(id, ref, claimBranches, listed)` spawns nothing: the local ref is `refs/heads/<claimBranches[id]>`;
  `[ref, local]` when local differs from `ref` and `listed` holds it, else `[ref]`. Its two callers (fs.ts:563, 699)
  pass the listing; `loadParts` returns it to `loadClaimView`.

ITEMS entries: `{ item: 'HEAD author', keys: ['main worktree open A-1'], p: show -s --format=%H%x00%ae HEAD }` and
`{ item: 'claim tips', keys: ['main status', 'main worktree open A-1'], p: rev-parse --verify -q refs/heads/<anything> }`.

Must not change: `git` facts (commit, authors, the sha-keyed author), the unborn-HEAD omission of `git`, the default
branch and template, every claim, claim branch, claim ref and activity, the tip order `[ref, local]`.

Tests written first:
- `risk:parsing ...`: repositories with a plain HEAD commit, a HEAD commit carrying an `encoding ISO-8859-1` header
  (made with `-c i18n.commitEncoding=ISO-8859-1`) and an unborn HEAD. `countedSync(() => loadFromFs(root))`: its
  `value.git` equals `{ commit: <rev-parse HEAD>, authors: { ..., [sha]: <git show -s --format=%ae HEAD> } }`, and `git`
  is absent for the unborn one. The plain one's `argv` holds a `cat-file --batch` and no `show`; the encoded one's holds
  one `show`. `checkItem` of the HEAD author entry.
- `risk:complex-branching ...`: claim branches pushed with the local branch at the same sha, the local branch one
  own-records commit ahead, no local branch, and a `feature/{id}` template; a ticket with a `verified_commit` on each.
  `countedSync(() => loadFromFs(root))`: `value.afterVerify` holds the local commit for the ahead case only, and `argv`
  holds a `for-each-ref` and no `rev-parse --verify -q refs/heads/...`. `checkItem` of the claim tips entry.

## Task 5: One shared walk for the commits after each start and the review starts
covers: D-02, D-08, D-09, D-10
files: packages/cli/src/load/fs.ts, packages/cli/test/git-count.test.ts (new)
verify: packages/cli/test/git-count.test.ts#risk:complex-branching-the-shared-walk-gives-each-ticket-what-its-own-git-log-gives-straight-merged-or-unresolvable

Produces, in fs.ts:
- `function readsAfter(snapshot, id): boolean`: false only when the ticket has a lane other than `S` and an open task
  (preamble); core never reads such a ticket's `afterVerify`, so it gets neither a review start nor an after-verify
  read. Every other ticket keeps them, a ticket with no lane or no plan included.
- `function gitWalk(root, def: string | undefined, positives: string[]): Map<string, { parents: string[]; files: string[]; subject: string }> | undefined`.
  One spawn: `git -c core.quotePath=false -c log.showSignature=false log --no-show-signature --stdin --ignore-missing -z --format=%x01%H%x00%P%x00%s --name-only --no-renames --`,
  stdin = each positive on its own line, then `^<def>` when `def` is defined; env `GIT_NO_LAZY_FETCH=1`; 64 MiB.
  Keys are lower-case full shas; a non-merge's `files` are its paths against its parent. No `--diff-merges` option is
  passed: the walk never reads a merge's paths (D-10), so any paths printed for a merge are ignored and its `files` is
  empty. The layout is fs.ts:309-310's with the subject as one more NUL-separated field after the parents; the test
  prints one real output before the parser relies on it. Any failure (exit code, ENOBUFS, an option an old git
  rejects) returns `undefined`.
- `function walkAfter(walk, start: string, tips: string[]): AfterVerify | 'drop' | 'own'` (tips as shas).
  `S` = the walk key starting with `start.toLowerCase()`; none -> `'drop'` (the start is on the default ref or
  missing, which today's `rev-list` filter at fs.ts:321-328 drops). Tips not in the walk are on the default ref and
  add nothing; none left -> `[]`. Else from one tip T, step to the single parent while the commit is in the walk and is
  not `S`: a commit with more than one parent -> `'own'` (D-10); reaching `S` -> the visited commits, oldest first, each
  `{ sha, parents, files }`; leaving the walk or reaching a root first, or another remaining tip not met on that chain
  (try each tip as T) -> `'own'`.
- `function walkPath(walk, tip: string, path: string): string | null | 'own'`: what `git log -1 <tip> -- <path>` names,
  answered only on a chain of single-parent commits. From T: a commit not in the walk -> `'own'`; a commit with more
  than one parent -> `'own'` (D-10: accord never steps through a merge); a commit whose `files` hold `path` -> that sha;
  a root commit without it -> `null`; else step to its parent. On such a chain git's walk meets the commits in the same
  order, so the first commit touching `path` is the one git names.
- `function ownAfterVerify(root, def, want: { commit: string; tips: string[] }): AfterVerify | undefined`: the body of
  fs.ts:331-361 for one ticket (one log with `--remerge-diff`, once more without it when that fails). `gitAfterVerify`
  keeps its `defaultRefOf`, its `rev-list` and calls `ownAfterVerify` per entry; `gitAfterReview` keeps using it.
- An own call is one `ownAfterVerify` or one `reviewStartOf` for one ticket. A ticket with a merge in the range its
  walk covers costs at most these two (D-10).
- `loadParts`, outside light mode: reads `currentBranch(root)` once, unconditionally, and returns it as
  `branch: { name: string | undefined }` (fs.ts:560 goes). The tickets considered are the entries (preamble), so a
  ticket for which `readsAfter` is false gets no read. `positives` = the sha (from the claim listing) of every claim tip
  of every claimed ticket, HEAD's commit when the current branch names a ticket, and every entry's start commit.
  Non-empty positives -> `def = defaultRefOf(root)` once and `walk = gitWalk(root, def, positives)`. Per entry (tips as
  shas; `HEAD` is the git facts' commit):
  - `walk` undefined -> today's path for every entry: `reviewStartOf` per ticket, then `gitAfterVerify` (D-08: a failed
    walk never drops more than today).
  - with a start: `walkAfter`; `'drop'` -> no entry; `'own'` -> `ownAfterVerify` with the tip names.
  - with only a review.md: every tip in the walk and one distinct tip sha -> `walkPath(walk, tip, review.md path)`;
    otherwise, or on `'own'`, `reviewStartOf(root, id, tip names)`. `null` or undefined -> no entry; a sha not in the
    walk is on the default ref -> no entry; else `walkAfter` with it. Every tip outside the walk -> no entry without
    a spawn (a review commit on those tips is on the default ref, which today's filter drops).
  In this task `loadClaimView`'s candidate reads (fs.ts:668-707) keep today's calls; Task 6 moves them onto the walk.

Must not change: each ticket's `afterVerify` wherever `readsAfter` holds (presence of the key, order, parents, files,
files left out of a merge only when `--remerge-diff` failed), `planFacts`, every output; the per-ticket argv of an own
call.

Test written first, against an oracle: a repository (via `buildSample` or plain git) whose checkout holds each
ticket's file and its verification.md or review.md (that is what makes it an entry) and whose claim branches hold the
commits: a ticket straight after its `verified_commit` with the local branch ahead of the pushed one; a
`verify-merged` ticket with no start (its tip is the merge after its review commit); a `verify-merged-before` ticket
with no start; a start on main; a start not on its own tip's chain; a ticket whose tips are all on main; and a lane M
ticket with a `verified_commit`, an open task in its ledger and a merge after its start. For every ticket but the last,
the test runs today's per-ticket commands itself with `gitRun` (fs.ts:376's log, fs.ts:321's `rev-list`,
fs.ts:331-334's log) outside any counted call and parses them as fs.ts does; it expects
`countedSync(() => loadFromFs(root, { stage: true })).value.afterVerify` to equal that, and the last ticket to have no
`afterVerify` key. `argv` holds exactly one log with `--stdin`, exactly one review-start log (`-1 --format=%H`, a path
ending `/review.md`), naming the `verify-merged` ticket's tips, and exactly two `--topo-order --reverse` logs, one
naming the `verify-merged` ticket's tips and one the tips of the ticket whose start is off its tip's chain, and no
other per-ticket log: the merge-before-review ticket is answered by the walk, the open-task ticket is not read.
Then the same with `spawnLog.fail = (a) => a.includes('--stdin')`: `afterVerify` equal again, and `argv` holds the
failed `--stdin` log followed by today's shapes, so the fallback ran. `expectFewer` on `wt-A-7 anchor` and on
`main lint` with P = a log holding `--topo-order` and `--reverse`, or a log holding `-1` and `--format=%H` with a path
ending `/review.md`, or `rev-list --ignore-missing`, or a log holding `--stdin`.

## Task 6: The claim view on the same walk, and the 1-versus-20 count
covers: @ac-1, D-02, D-07, D-08, D-09, D-10, D-11, D-12
files: packages/cli/src/load/fs.ts, packages/cli/test/git-count.test.ts (new), packages/cli/test/helpers/samples.ts (new)
verify: packages/cli/test/git-count.test.ts#ac-1-a-read-command-starts-as-many-git-processes-with-20-tickets-as-with-1 (@ac-1), packages/cli/test/git-count.test.ts#risk:complex-branching-the-claim-view-reads-plan-subjects-and-review-starts-from-the-shared-walk-and-leaves-each-merge-to-at-most-two-git-reads

Consumes Task 5's `readsAfter`, `gitWalk`, `walkAfter`, `walkPath`, `ownAfterVerify`, the claim listing and `branch`.

Produces:
- `loadParts(root, stage, light, defer)`: with `defer` (only `loadClaimView` passes it) it computes no walk and no
  `afterVerify`, and returns its entries (start or review-only, tip names and shas), `listed`, the HEAD commit and
  `branch`.
- `loadClaimView`: reuses `branch` instead of calling `currentBranch` (fs.ts:616). After its `--merged` query and its
  `cat-file` (unchanged) and the candidates' starts read from the overlaid texts (fs.ts:693-704), one walk:
  `positives` = every claim tip sha, HEAD's commit when the current branch names a ticket, every checkout entry's
  start and every candidate's start; `def = defaultRefOf(root)` once. A candidate is an entry only when `readsAfter`
  holds for the snapshot of its overlaid ticket, plan and ledger texts. The checkout's `afterVerify` is computed from
  the checkout entries and the view's from the checkout's minus the candidates plus the candidate entries, both by
  Task 5's rules; one own call serves a checkout entry and a candidate entry of one id with the same start and tips.
  The plan subject of a candidate whose ref holds plan.md is read only when that overlaid ticket has a lane other than
  S and an open task, the only state core reads it in (stage.ts:91); otherwise `planFacts[id]` is `{ clean: true }`
  with no subject and nothing is spawned. When read: `walkPath(walk, sha of ref, plan.md path)` -> that commit's
  `subject` (`''` when `null`, so no subject); `'own'` or no walk -> today's `log -1 --format=%s <ref> -- <plan.md>`
  (fs.ts:675). So a ticket with a merge costs at most two own reads: a review start and an after-verify read when it
  has no open task, one plan-subject read when it has one. With no candidate, `view` is the same object as `checkout`
  (run.ts:63 relies on it), now carrying the `afterVerify` computed here.
- samples.ts: `oneTicketFrom(sample: Sample, id: string): Sample`, the one-ticket repository of ac-1, holding the
  ticket's branch with the same commits (D-09). In `sample.root`: `P = git merge-base refs/heads/t/<id> refs/heads/main`
  (for a `verify-merged` ticket, the main commit its merge brought in) and the paths
  `git ls-tree -r -z --name-only P -- accord/tickets`. A fresh bare remote and clone, configured as `buildSample` does;
  `git fetch -q <sample.root> refs/heads/t/<id>:refs/heads/t/<id> refs/remotes/origin/t/<id>:refs/st-ln-63/origin-tip`;
  one `git fast-import` commit on `refs/heads/main` with `from P` and a `D` line for every listed path that is neither
  `accord/tickets/<id>.md` nor under `accord/tickets/<id>/`, dated as `buildSample` dates its commits; `git reset -q --hard`;
  `git remote add origin <remote>`;
  `git push -q origin refs/heads/main:refs/heads/main refs/st-ln-63/origin-tip:refs/heads/t/<id>`;
  `git update-ref -d refs/st-ln-63/origin-tip <its sha>`; `git fetch -q origin`; `git remote set-head origin main`.
  `names` is the sample's plus that commit as `one-main`; `withMerge` is `[id]` when the sample lists `id`, else `[]`.
  Main holds only that ticket's file and records, and the default ref holds every main commit its branch holds, so the
  ticket's stage and its commits after review are the same in both repositories.
- The 20-ticket sample, `buildSample` with: B-1 intent, B-2 plan, B-3 build-missing-file, B-4 plan-foreign-baseline
  (baseline on B-2's branch), B-5 review, B-6 verify-merged, B-7 verify-straight, B-8 verify-merged-before, B-9
  done-merged, B-10 done-squash, B-11 done-rebased, B-12 done-extra, B-13 dropped, B-14 lane-s, B-15 plan, B-16 review,
  B-17 verify-merged, B-18 verify-straight, B-19 verify-merged-before, B-20 done-squash; default options. Its
  `withMerge` is `['B-6', 'B-8', 'B-17', 'B-19']`: a merge after review (B-6), a merge before review (B-8), and B-7 at
  verify with none (D-11). The two one-ticket repositories are `oneTicketFrom(twenty, 'B-6')` (a merge) and
  `oneTicketFrom(twenty, 'B-7')` (none). samples.ts exports `TWENTY_BUILD_LIMIT`, at least three times the build of
  the three measured on Windows; this file builds them in a second `beforeAll` with that limit.

Must not change: `checkout` and `view` files and claims, and every output; each `afterVerify` and planFacts subject
that core reads (preamble: an open task); a candidate's own records still come from its ref.

Tests written first:
- `ac-1 ...`: for each X of B-6 and B-7, with `one` = X's one-ticket repository: first, `one.withMerge` is `['B-6']`
  for B-6 and `[]` for B-7; in both repositories `refs/heads/t/X` and `refs/remotes/origin/t/X` name the same shas,
  and `status --json` from each root shows X at the same stage (D-07). Then for each of `status`, `anchor X`, `lint`,
  `dashboard` and `show X` (D-12: the same ticket in both), run from each root through `counted`; `M` = the 20-ticket
  sample's `withMerge` without X. Expect `count(twenty) <= count(one) + 2 * M.length` for each command, the one bound
  of ac-1 as D-11 reads it. Measure the test on Windows, set its own limit as the preamble says; report it.
- `risk:complex-branching ...`: in one repository, run from main, each candidate claimed and unmerged: (a) a candidate
  at build on a straight branch shows build in `status --json` and starts no `log -1 --format=%s`; (b) a candidate at
  build whose branch merged main after its `plan: <id> ready` commit shows build and starts exactly one plan-subject
  log, and its subject equals what the test's own `git log -1 --format=%s <ref> -- <plan.md>` prints; (c) a
  review-only candidate with every task done whose branch merged main after its review commit shows verify and starts
  exactly one review-start log and one `--topo-order --reverse` log naming its ref, and no plan-subject log; (d) a
  `verify-merged-before` candidate shows verify and starts none of the three; (e) a candidate with a review.md, an
  open task and a merge after its review commit shows build and starts one plan-subject log and no review-start or
  after-verify log. `expectFewer('main status', P)` with P = `log ... -1 --format=%s`, or a log holding `--stdin`.

## Task 7: The current branch and the review commit read once per command
covers: D-05
files: packages/cli/src/load/fs.ts, packages/cli/src/run.ts, packages/cli/src/commands/anchor.ts, packages/cli/src/commands/hook.ts, packages/cli/src/commands/worktree.ts, packages/cli/src/commands/gate.ts, packages/cli/test/git-count.test.ts (new), packages/cli/test/helpers/items.ts (new)
verify: packages/cli/test/git-count.test.ts#risk:complex-branching-anchor-hook-and-worktree-merge-read-the-current-branch-once-detached-or-unreadable-included, packages/cli/test/git-count.test.ts#risk:complex-branching-lane-S-gate-done-reads-the-review-commit-once-and-fails-closed-without-one

Produces:
- fs.ts: `export function loadWithBranch(root, options: { stage?: boolean; light?: boolean }): { input: SnapshotInput; branch?: { name: string | undefined } }`
  (no `branch` in light mode); `loadFromFs` returns its `input`. `loadClaimView` also returns `branch`.
- `CommandContext.branch?: { name: string | undefined }`, set by `preflight` from the load outside light mode.
- anchor.ts: `activeTicket(root, snapshot, branch?)` uses `branch.name` when given, else `currentBranch(root)`;
  `anchor` passes `ctx.branch`.
- hook.ts: `activeTicket` (hook.ts:38) and `ticketOfWorktree` (hook.ts:62) get `ctx.branch` only when their `root`
  equals `ctx.root`.
- worktree.ts `worktreeMerge`: `cur` is `ctx.branch.name` when `ctx.branch` is set, else `currentBranch(ctx.root)`.
- fs.ts: `export function gitReviewCommit(root, id)` (today's `reviewCommit`); `gitReviewFact(root, id, commit)` and
  `gitAfterReview(root, id, commit)` take it (`undefined` keeps today's fail-closed results); gate.ts reads it once for
  a lane S `gate done`.
- ITEMS entries: `{ item: 'current branch', keys: ['wt-A-7 anchor', 'wt-A-7 worktree merge A-7'], p: symbolic-ref --short -q HEAD }`
  and `{ item: 'review commit', keys: ['wt-S-1 gate done S-1 --json'], p: a log holding -G and ^## Round  }`.

Must not change: anchor's stderr lines (`could not read the current branch; nothing to anchor`, `... is not a lane
ticket ...`) and silence on a detached HEAD; every hook output; worktree merge's refusals and their order; lane S
`gate done` results, `clean: false` when there is no review commit or git fails.

Tests written first:
- `risk:complex-branching ... current branch ...`: `anchor` from a ticket worktree, from a detached HEAD (silent, exit
  0) and with the branch unreadable (`spawnLog.fail` on `symbolic-ref --short -q HEAD`: the stderr line, exit 0);
  `worktree merge` from another branch refuses as today. Each starts one `symbolic-ref --short -q HEAD`. `checkItem` of
  the current branch entry.
- `risk:complex-branching ... review commit ...`: `wt-S-1 gate done S-1 --json` through `runSample` has one
  `log ... -G ^## Round ` spawn and the golden's `out`; a lane S ticket whose review.md has no `## Round ` commit makes
  `gate done` exit 1 and starts one such log and no `git show` of a review commit. `checkItem` of the review commit
  entry.

## Task 8: The default ref in one git process
covers: D-05
files: packages/cli/src/load/fs.ts, packages/cli/src/commands/review-package.ts, packages/cli/test/git-count.test.ts (new), packages/cli/test/helpers/items.ts (new)
verify: packages/cli/test/git-count.test.ts#risk:complex-branching-the-default-ref-resolves-in-one-git-process-from-a-symbolic-plain-or-dangling-origin-HEAD-and-falls-back-to-the-local-main

Produces, in fs.ts: one private `defaultRefs(root, local: boolean): { origin?: string; local?: string }` running
`git for-each-ref --format=%(refname)%00%(symref)%00%(objectname) refs/remotes/origin/HEAD refs/remotes/origin/main refs/remotes/origin/master`
plus `refs/heads/main refs/heads/master` when `local`, stderr ignored. A ref counts only when its refname is exactly
one of those (a pattern also matches refs below it, such as `refs/remotes/origin/main/x`) and its objectname is not
empty, so a ref whose target does not resolve never counts, as today's `rev-parse --verify` checks. `origin`:
origin/HEAD's `%(symref)` when origin/HEAD counts and has one; a plain origin/HEAD is not used, as `symbolic-ref -q`
fails on it today; else the first counted of origin/main, origin/master. `local`: the first counted of main, master.
A failed spawn gives `{}`. `gitDefaultRef` returns `origin`; `defaultRefOf` returns
`origin ?? local`. No result is kept between calls: clean reads it again after its prune (worktree.ts:740).
review-package.ts: the default ref read for a lane S base (line 16) is reused at line 54 instead of read again.
ITEMS entry `{ item: 'default ref', keys: [the four worktree-command keys, 'side-local status --json'], p }` with p =
`symbolic-ref -q refs/remotes/origin/HEAD`, or `rev-parse --verify -q` of an origin/HEAD target or of origin/main,
origin/master, main or master, or `for-each-ref` of those refs.

Must not change: every caller's value for every repository state; review-package output.

Test written first, one repository per case, each call starting one git process:
- origin/HEAD symbolic to origin/main: both functions give `refs/remotes/origin/main`;
- origin/HEAD a plain ref (`update-ref`, not symbolic) and only origin/master: both give `refs/remotes/origin/master`;
- origin/HEAD symbolic to a missing ref, origin/main present: both give `refs/remotes/origin/main`;
- no origin refs, local `master` only: `gitDefaultRef` gives undefined, `defaultRefOf` `refs/heads/master`;
- `refs/remotes/origin/main/x` and local `main`, no origin/main: undefined and `refs/heads/main`.
Then `checkItem` of the default ref entry.

## Task 9: Clean answers ancestry from one sha-keyed merged set
covers: D-05, D-07
files: packages/cli/src/commands/worktree.ts, packages/cli/test/git-count.test.ts (new), packages/cli/test/helpers/items.ts (new)
verify: packages/cli/test/git-count.test.ts#risk:data-loss-clean-answers-ancestry-from-one-sha-keyed-merged-set-and-sends-every-miss-and-every-re-read-tip-to-the-content-checks

Produces, in worktree.ts:
- `worktreeClean`, after `ref` is read (worktree.ts:740): one
  `git for-each-ref --merged <ref> --format=%(objectname) refs/heads refs/remotes/origin`, its lines lower-cased into
  `merged: Set<string>` of shas (a failure gives an empty set); passed to `cleanDone` and `cleanDropped`.
- `safeTip(root, tip, vc, ref, merged?)`: a tip in `merged` is `'safe'` without a spawn; a miss runs every check as
  today, its `merge-base --is-ancestor` included.
- `cleanDone`: the first judgement of L (worktree.ts:846) and the judgement of R (worktree.ts:876) pass `merged`; the
  tip re-read after the guards (worktree.ts:862-863) never does, so it gets the full checks.
- `cleanDropped`: a tip (`t.L ?? t.R`) in `merged` is merged without a spawn; a miss runs today's
  `merge-base --is-ancestor` (worktree.ts:916).
- ITEMS entry `{ item: 'clean merged set', keys: ['main worktree clean'], p: merge-base --is-ancestor, or a for-each-ref holding --merged }`.

Must not change: which branches and worktrees clean removes, keeps and deletes, and every line it prints, a
squash-merged or rebased branch included (ac-3, D-07); `update-ref -d <ref> <sha it checked>`; the leased origin
deletes; the fresh worktree list before each deletion (worktree.ts:705, 819, 924).

Test written first, one clean sample:
- a done branch merged into main: deleted, with no `merge-base` for its tip;
- a squash-merged one: a miss, so the content checks run, and it is deleted as at the baseline;
- a `done-merged` branch with a linked worktree W, where `spawnLog.after` fires once, on the first
  `status --porcelain --untracked-files=normal --ignore-submodules=none` whose `options.cwd` is W (passGuards'
  read, worktree.ts:655; paths compared after `realpathSync.native`, case-folded on win32), and there writes
  `src/late.ts` and commits it with `git commit -F <file> --cleanup=verbatim`. W is clean again, so the guards pass
  and clean prints `removed <W>`; the re-read at worktree.ts:862 gets the new commit, outside the set, so the full
  checks run: clean prints `kept t/<id>: it has commits after its verified commit` and no `deleted t/<id>` line, and
  `refs/heads/t/<id>` names the new commit. A build that drops the re-read or answers it from a branch-name key fails
  here;
- a dropped branch merged into main stays on the merged path.
Then `checkItem` of the clean merged set entry.

## Task 10: get-url, the worktree list and the ssh config read once
covers: D-05
files: packages/cli/src/commands/worktree.ts, packages/cli/src/commands/new-ticket.ts, packages/cli/src/run.ts, packages/cli/src/commands/drop.ts, packages/cli/src/commands/upgrade.ts, packages/cli/test/git-count.test.ts (new), packages/cli/test/helpers/items.ts (new)
verify: packages/cli/test/git-count.test.ts#risk:security-every-network-git-call-keeps-prompts-off-while-core.sshCommand-is-read-once-per-folder, packages/cli/test/git-count.test.ts#risk:complex-branching-pick-up-and-new-ticket-worktree-reuse-the-worktree-list-clean-read-and-read-it-again-after-clean-removed-one, packages/cli/test/git-count.test.ts#risk:complex-branching-a-command-that-proved-the-origin-remote-asks-for-it-once-and-with-no-origin-nothing-is-fetched

Three Part 2 items.

get-url: `worktreeClean` skips its `remote get-url origin` (worktree.ts:727) when `opts.fetched` is `'ok'` or
`'failed'`, since only a found origin gives those. `fetchOrigin(ctx, known?: boolean)` skips its own when `known`;
`worktreeMerge` passes `true` after its check (worktree.ts:606-607).

Worktree list: `worktreeClean(ctx, opts)` takes `opts.seen?: { list?: WorktreeEntry[] }`; each read of the list in
clean (worktree.ts:725, 705, 819, 924) stores it there, and each `removeWorktree` call clears it. `cleanQuietly`
returns `seen.list` (undefined after a throw). `worktreeOpen` uses that list instead of `worktrees(...)` at
worktree.ts:387 when defined; `newTicket` passes it to `newTicketWorktree(ctx, id, rel, text, list?)`, which uses it
at worktree.ts:994. The four reads inside clean stay fresh.

ssh config: `gitNoPrompt(cwd, args, timeout?, seen?: Map<string, string>)` reads `config --get core.sshCommand` once
per `cwd` per map. `CommandContext.ssh?: Map<string, string>` is made in `preflight` and kept by `fetchOrigin`'s
reload; `fetchOrigin`, `worktreeClean`, `pruneStale`, both push paths of clean, `continueMerge`, `worktreePush` and
`newTicketWorktree` pass `ctx.ssh`; `drop` and `upgrade` each make one map for their own calls.

ITEMS entries: `{ item: 'ssh config', keys: ['main worktree clean', 'main worktree open A-1'], p: config --get core.sshCommand }`,
`{ item: 'worktree list', keys: ['main worktree open A-1', 'main new ticket N-1 --lane M --worktree'], p: worktree list --porcelain }`
and `{ item: 'get-url', keys: ['main worktree open A-1', 'main new ticket N-1 --lane M --worktree', 'wt-A-7 worktree merge A-7'], p: remote get-url origin }`.

Must not change: every network call's argument array (`-c credential.interactive=never`, the injected
`-c core.sshCommand=<cmd> -o BatchMode=yes`) and environment (`GIT_TERMINAL_PROMPT=0`, the `GIT_SSH_COMMAND` rule); a
non-OpenSSH command passed through; with no origin, clean returns 0 after pruning worktree records and worktree merge
returns 0 with no fetch; pick-up, new ticket, drop and upgrade output.

Tests written first:
- `risk:security ...`: with `GIT_SSH_COMMAND` and `GIT_SSH` removed from `process.env` for the run and restored
  after it, a clean sample with `core.sshCommand` set to `ssh -o ConnectTimeout=5` in the repository: every
  `fetch`, `remote prune` and `push` that `worktree clean` starts carries
  `-c core.sshCommand=ssh -o ConnectTimeout=5 -o BatchMode=yes` and `-c credential.interactive=never`, and one
  `config --get core.sshCommand` is started. `checkItem` of the ssh config entry.
- `risk:complex-branching ... worktree list ...`: pick-up when clean removed nothing starts one list fewer and prints
  the golden's lines; pick-up after clean removed a done ticket's worktree reads the list again and its stop lines
  name the new worktree. `checkItem` of the worktree list entry.
- `risk:complex-branching ... origin ...`: `worktree merge` with an origin starts one `remote get-url origin`; with no
  origin it starts no `fetch` and exits 0; pick-up with no origin creates the worktree without a fetch as at the
  baseline. `checkItem` of the get-url entry.

## Task 11: A light load before the fetch in pick-up and new ticket --worktree, and the ac-3 count
covers: @ac-3, D-05, D-06, D-07, D-11, D-12
files: packages/cli/src/run.ts, packages/cli/src/commands/worktree.ts, packages/cli/test/git-count.test.ts (new), packages/cli/test/helpers/items.ts (new)
verify: packages/cli/test/git-count.test.ts#ac-3-each-worktree-command-starts-fewer-git-processes-than-before-the-change-and-clean-keeps-and-removes-the-same-branches (@ac-3), packages/cli/test/git-count.test.ts#risk:complex-branching-pick-up-and-new-ticket-worktree-load-the-full-snapshot-after-a-failed-or-absent-fetch

Produces:
- run.ts: `worktree open` without `--continue` runs `preflight(opts, 'light')`; `new ticket` runs
  `preflight(opts, options.worktree === true ? 'light' : 'checkout')`; plain `new ticket` keeps the full load, which
  it needs for the claims that keep an id from being reused (D-12). A light `preflight` sets `CommandContext.light: true`;
  the pin check runs as today.
- worktree.ts `fetchOrigin`: a light context gets the full snapshot (`loadSnapshot(loadFromFs(ctx.root))`, today's
  preflight load) on `'none'` and `'failed'` as well as on `'ok'`, and the returned context has no `light`.
  `guardTicketSession` keeps running first, on the light snapshot, which holds the tickets and branch templates it
  reads.
- ITEMS entry `{ item: 'light preflight', keys: ['main worktree open A-1', 'main new ticket N-1 --lane M --worktree'], p }`
  with p = the git facts' log (`--format=%x01%ae%x00%ct%x00%s` with `--name-only` and `accord/tickets`).

Must not change: pick-up's and `new ticket --worktree`'s refusals (guard, claimed by another, dropped, branch exists),
output and exit codes; the pin refusal; `worktree open --continue` and plain `new ticket`.

Tests written first:
- `ac-3 ...`: one `runSample` of `main worktree open A-1`, `main worktree clean`, `wt-A-7 worktree merge A-7` and
  `main new ticket N-1 --lane M --worktree`. For every ITEMS entry and each of its keys that is one of these four,
  `expectFewer(key, entry.p, that key's argv)`, so each Part 2 item touching a worktree command shows fewer than its
  own recorded count (D-05, D-11, D-12); the three per-ticket reads are proven by ac-1 (Task 6). Each of the four
  also starts fewer git processes in total than its array in `git-counts.before.json`; clean's `out` and `refs` equal
  `goldens.json`'s, so it removes and keeps the same branches, the squash-merged A-9 and the rebased A-10 included
  (D-11).
- `risk:complex-branching ...`: what only the full snapshot knows still decides after a failed fetch (origin pointed at
  a missing folder with `remote set-url`) and with no origin. Pick-up of a ticket another email claimed on a
  `feature/{id}` branch (the `branch:` template in config.yml), present here, refuses with `claimed: <id> by <email>`
  and makes no `t/<id>` branch, since `branchOf` reads the claim branch from the full snapshot. With `people` in
  config.yml holding the fixture email, `new ticket --lane M --worktree` with no id never assigns the id of a branch
  that holds only an empty `claim: <id>` commit, since only the claims show that id. `checkItem` of the light preflight
  entry.

## Task 12: The two branch-fact tests under 10 s
covers: D-03, D-12
files: packages/cli/test/branch-fact.test.ts, packages/cli/src/load/fs.ts, packages/cli/src/commands/gate.ts
verify: packages/cli/test/branch-fact.test.ts#risk:complex-branching-gate-done-reads-the-branch-diff-from-the-merge-base-ignoring-whitespace-and-pins-the-scope-at-the-first-commit-that-records-ac_hash, packages/cli/test/branch-fact.test.ts#risk:parsing-gate-done-reads-added-call-lines-and-package-json-maps-from-the-branch-diff

Part 4. Measure first: run the file alone on Windows with
`--reporter=junit --outputFile.junit=node_modules/.cache/st-ln-63/branch-fact.before.xml` and note each test's time
(Intent: 51.2 s and 32.3 s in ST-LN-44's full run, before Parts 1 and 2). Find where the time goes by timing each
setup step, each `run(...)` and each `gitBranchFact` call locally, and counting each `run(...)`'s git processes with
the harness (that timing code is not committed).

Then cut where the measurement puts the time, on either side. Each test stays one test with its title: neither is
split, so no split-off part needs its own limit.
- Test side, in branch-fact.test.ts: build each history with fewer git processes (one `git fast-import` stream as
  helpers/samples.ts does, or fewer `commitMsg` steps), and drop repeated runs that read a state another run already
  read, keeping every assertion and both titles exactly.
- Command side, only in `gitBranchFact` (fs.ts:834) and the lane `gate done` path of gate.ts, and only by starting
  fewer git processes or reading less for the same result, for example one `git diff` read where two read the same
  range: the `BranchFact` for every repository state (each `{ error }` text included) and every gate finding stay as
  they are, which branch-fact.test.ts, lane-s.test.ts and goldens.test.ts hold.

Must not change: each test's title and each of its assertions (the out-of-scope reasons, `at commit <R>`, the scope
pin, whitespace-only changes, synced paths, the hand-edited settings, the default-branch and no-default-branch
cases; each parse branch of the second test); every output of `gate done`.

Report each test's time alone and with the suite, before and after, and which side each cut was on. A test still at
or over 10 s is handled as the preamble's Part 4 keeps say.

## Task 13: The lane S review-package test under 10 s
covers: D-03, D-12
files: packages/cli/test/lane-s.test.ts, packages/cli/src/commands/review-package.ts, packages/cli/src/load/fs.ts
verify: packages/cli/test/lane-s.test.ts#risk:complex-branching-the-review-package-lists-the-out-of-scope-files-and-interface-signs-gate-done-would-name

Part 4, as Task 12, for lane-s.test.ts:304 (22.8 s in ST-LN-44's full run). Measure first, alone and with the
suite, JUnit output under `node_modules/.cache/st-ln-63/`, and find where the time goes as Task 12 does. Then cut on
either side; the test stays one test with its title, not split:
- Test side: fewer git processes to build the two branches, no run that repeats a state another run read; the five
  `review-package` outcomes it asserts (out-of-scope and interface signs listed, both `(none)`, T-1's sign with no
  out-of-scope section, the `cannot tell` line with no default branch) all stay, and the title stays exactly.
- Command side, only in `reviewPackage` (review-package.ts:14) and the fs.ts reads it calls, only by starting fewer
  git processes for the same output.

Must not change: the other tests of lane-s.test.ts; every line `review-package` prints, for every repository state.

Report as Task 12; a test still at or over 10 s is handled as the preamble's Part 4 keeps say.

## Task 14: The upgrade ac-2 test keeps its CRLF case end to end and its other cases move to core
covers: @ac-4, D-03, D-06, D-07, D-11, D-12
files: packages/cli/test/upgrade.test.ts, packages/core/test/scaffold.test.ts
verify: packages/cli/test/upgrade.test.ts#ac-2-upgrade-replaces-only-the-lint-and-gate-step-and-keeps-every-other-line-of-the-workflow (@ac-4), packages/core/test/scaffold.test.ts#risk:parsing-the-lint-and-gate-refresh-keeps-every-other-line-of-a-workflow-written-plain-or-with-a-shallow-indent

Part 4, last. Measure first: the upgrade ac-2 test alone and with the suite on Windows (107.8 s at 85b3158, over the
cli's 90 s limit at packages/cli/vitest.config.ts:5-8, which this task does not raise).

Produces:
- upgrade.test.ts: the test keeps its title and runs only the `crlf` case end to end (one copy, one `upgrade`, the
  `.gitattributes` `* -text` line, the byte comparison on the pushed branch, the stdout and the `was not refreshed`
  check), with the `team`, `expectedTeam` and `crlf` values as today.
- scaffold.test.ts: a new top-level
  `it('risk:parsing the lint and gate refresh keeps every other line of a workflow written plain or with a shallow indent', ...)`:
  for the `plain` and `indent` cases built exactly as upgrade.test.ts:202-224 builds them (the `shallow` helper moved
  with them), `refreshLintStep(input, name, v)` returns `{ text }` and
  `repinWorkflow(text, name, '0.0.9', v)` equals the expected text, the same composition upgrade.ts:64-66 applies;
  `name` and `v` from packages/cli/package.json. This is the part split off from the upgrade ac-2 test, so it is held
  to under 10 s or an approved ceiling as well (D-12); report its time alone and with the suite.

Must not change: the other upgrade tests, including the hash-object count test and its `vi.mock`.

The ac-4 verify id is the upgrade ac-2 test because `accord task-done` records a task only when its verify cases pass
in the test report, and this test is a case there whose pass within the 90 s limit is ac-4's last Then; a test that
read the JUnit report could not pass inside the run that writes that report and would depend on the machine. The
times of the four tests and of the split-off core test in the owner's full run on the owner's machine are read from
that report at verify, with no separate CI check (D-11).

Report the times as Task 12 does; a test still at or over 10 s is handled as the preamble's Part 4 keeps say.
