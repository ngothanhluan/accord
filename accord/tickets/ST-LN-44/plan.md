---
baseline: 1cec2ac130d8d34c4dcdadddfee9effb4d1104e9
plan_hash: "fnv1a64:b3fd88bdb6455001"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket, and the approved table `accord/tickets/ST-LN-44/table.md` (read its header rules 1-7, its levers
H1-H8, and the rows the task names).

Baseline: `1cec2ac130d8d34c4dcdadddfee9effb4d1104e9`, written `<BASE>` below: the merge of origin/main that holds
BUG-LN-8 and BUG-LN-9 (ledger Ruling "after D-12 the plan's baseline moves to the merge commit 1cec2ac"). Every line
cited below is a line at `<BASE>`; the commits after it on this branch touch only `accord/`, so the cited lines are
the lines of the working tree when build starts.

Order: Tasks 1 to 5 are the wiring: the shared helpers and guards every task after them stands on, each proved by its own
`risk:` test written first (H8 `run()` guard, the template copy routine with its origin and path checks of rule 5, H2,
H6, the core-ready helpers). Tasks 6 to 17 carry out the rows outside `worktree.test.ts`, one test file (or a small
group of files) each; Task 11 carries the five upgrade rows of D-12 (#114 to #118) with #12 and #13. Tasks 18 to 26
carry out the 48 rows of `worktree.test.ts`, by region of the file. Task 27 confirms the rows that take no change.
Tasks 28 to 33 audit the assertion maps against the row notes and restore any omission, one group of build tasks each
(the audit procedure below). Task 34 writes the table, junit and assertion parsers and the rule 3 tool, each proved by
a `risk:` test, and freezes the approved table. Task 35 is the measuring run of rule 3: it commits the run's junit and
its rule 3 list as test fixtures and writes the ac-1 test that reads them. Task 36 writes the ac-2 and ac-3 tests.
Task 37 freezes the baseline copies of the changed test files and writes the ac-4 test. Every test a `verify:` line
names exists and passes when its task is recorded: the measuring run's artifacts are committed by Task 35, before the
tests that read them are written.

Committed artifacts (nothing outside the repository survives between executors): everything a task produces for a
following task or for the main session is written to a committed file under `packages/core/test/`, never only in the
executor's report and never under the top-level `accord/` folder (executors never touch it). The ST-LN-48 precedent
keeps a ticket's committed run data in `packages/core/test/fixtures/st-ln-48/`; this ticket uses
`packages/core/test/fixtures/st-ln-44/`:
- `maps.json`, written by Tasks 7 to 26 and 28 to 33 (see "maps.json" below);
- `table-approved.md`, written by Task 34;
- `after-junit.xml` and `rule3-list.md`, written by Task 35;
- `base-tests.json`, written by Task 37.
The one artifact under `accord/` is `accord/tickets/ST-LN-44/before-junit.xml`, ac-3's "before" list: the main
session writes it (Main session step 0) before Task 1 is dispatched, never replaces it (Main session step 4 holds
every merge of origin/main until the measuring run is recorded), and tests only read it. No task changes
`.github/workflows/ci.yml`: every input of the four criterion tests is a committed file, so they need no git history and
run the same in CI's shallow clone.

Row coverage: every one of the 118 rows of table.md is carried out by exactly one task, which lists it on its
first prose line as `Rows: #n, ...`. Nothing outside those rows changes.

Rules for every task:
- The table is the authority. For each row, do exactly what its "how" column says, nothing more (rule 3: no other
  cut is added at build without the owner). A row whose cut cannot be made as written, or whose assertion map does
  not fit the code, stops the task: report the row, what blocks it and the line numbers; do not improvise.
- Split or moved rows: each destination title is copied verbatim from the row's destinations column, in that
  order, placed where the original test stood. Each destination keeps the original test's timeout argument (for
  example `120_000`). A destination that keeps the original title keeps the original test's position.
- Assertions (rule 4, ac-4): every old assertion lands where the row's note column says. An assertion is an
  `expect(` statement or a call of a local assertion helper (a function of the test file whose body holds `expect(`,
  for example `refused(text)` and `noBranch()` in upgrade.test.ts:83-90, `onlyRepinned(...)` in upgrade.test.ts:207-213,
  `shallow(...)` declared inside the test body at upgrade.test.ts:159-166, `blocked()` in hook.test.ts:92-101,
  `again(C)` in worktree.test.ts:228-235, `passes()` and `fails(rule)` in lane-s.test.ts:108-113, and the file-level
  `dropAndMerge` and `laneSBranch` of worktree.test.ts:1442-1447 and :2170-2180). The assertion is the helper-call
  statement in the test body (for example `await dropAndMerge(c, 'ST-10');`, read as `dropAndMerge(c, 'ST-10');`),
  never an `expect(` inside the helper's declaration, which `asserts` (Task 34) leaves out. Assertions are counted as
  a multiset: an assertion the old body made twice is made twice in its new places, or the second one has its own
  `maps.json` entry. Keep each assertion's text identical, variable names included (bind a new result to the old name
  before the old assertions run); every assertion whose text changes, that a split drops as a duplicate, or that moves
  off the row's places gets one `maps.json` entry. A `maps.json` entry's `now` is used up by the one old assertion it
  maps: two old assertions never share one new assertion, and a `now` is never an assertion another old line already
  matches unchanged (Task 37 checks both). An assertion the note turns into a core check is written as an `expect` on
  the core value (for example `expect(gateReadyIn(files, 'S-1')).toBe('pass')`). A kept or faster criterion test keeps
  every assertion line as it is; only its setup changes. No risk assertion moves into a criterion test (rule 1).
- Criterion tests (titles starting `ac-`) are never split, renamed or moved (rule 1), so no `@test:` tag moves.
- New titles start with `risk:` (rule 7). Titles written by the table keep its wording, commas included.
- Templates (rule 5, H1): a template is built in a `beforeAll` of its test file and removed in its `afterAll`. A
  template never holds a linked worktree; any `worktree add` runs after the copy, in the copy. A clone template is
  copied only with `copyClone` (Task 2), which asserts the copy's origin and that its paths differ from the
  template's; a template with no remote (lane-s, show, dashboard, lane-repo templates) is copied with `copyRepo`
  (Task 2) and never gains an origin. Clone templates are built with `makeTemplate` (Task 4), so every copy carries H6.
- H7 (`git remote remove origin`) runs only in a destination that checks holds, whose scenario names no fetch and
  that pushes nothing, and in it only after its last real pick-up and its last use of `origin/main` (a
  `worktree add ... origin/main` reads `refs/remotes/origin/main`, which the removal deletes). A row that lists H7
  names the destinations it applies to; the others keep their origin.
- H8: every row's "H8 run guard" is met by Task 1 for the whole suite; no row adds its own guard.
- A new commit made by test code uses `commitMsg` from `packages/cli/test/helpers/repo.ts` (conventions.md: `-F
  <file> --cleanup=verbatim`, never `-m`); existing commit lines that a row does not touch stay as written.
  `commitMsg` passes no git identity (repo.ts:109-120), unlike `commitAll` (repo.ts:72-77), and `makeEmptyRepo` and
  `makeLaneRepo` set none (repo.ts:51-55, :145-156); `makeClone` (helpers/worktree.ts:15-17) and lane-s's `repoWith`
  (lane-s.test.ts:55-57) already do. So every repository built from `makeEmptyRepo` or `makeLaneRepo` (a lane-repo
  template, or a stage setup) writes `gitRun(repo, 'config', 'user.email', 'fixture@example.invalid')`,
  `gitRun(repo, 'config', 'user.name', 'fixture')` and `gitRun(repo, 'config', 'commit.gpgsign', 'false')` before
  its first `commitMsg`, so each commit gets the author `commitAll` gave it (show.test.ts:138 asserts
  `holder: 'fixture@example.invalid'`) and a CI runner with no global identity commits at all. A row that sets another
  `user.email` as the viewer (show.test.ts:175, dashboard.test.ts:361, :392) writes it after its last `commitMsg`; a
  commit whose identity the row asserts keeps its own `-c` arguments (dashboard.test.ts:286).
- Test ids: the test file's path from the repository root, `#`, then the `describe` titles and the `it` title
  joined by ` > `, every run of whitespace turned into `-`. No id on a `verify:` line holds `@` or a comma, so a
  destination whose table title holds a comma is run but not named there. A `verify:` id of another ticket's
  criterion test (a title starting `ac-`) carries no `(@ac-n)` marker: it proves that ticket's scenario, not one of
  this ticket's, and it is named so a change that breaks it stops the task.
- D-11: no file under `packages/*/src` or `scripts/` changes. Files are LF with no BOM. Add no dependency.
- Running: CLI tests import core from `packages/core/dist`; after any change under `packages/core/`, run
  `npm run build -w packages/core`. End every task with `npm run build`, `npm run lint` and `npm run typecheck`, then
  `npx vitest run <each test file the task names> --reporter=default --reporter=junit
  --outputFile.junit=node_modules/.cache/st-ln-44/task-<n>.xml`, from a shell where `ACCORD_BASH` is
  `C:\Program Files\Git\bin\bash.exe` on Windows (ledger Ruling: from PowerShell `bash` is the WSL one and the
  executed workflow-script cases skip). The main session runs `tests.affected` for `accord task-done` with the same
  `ACCORD_BASH`, or the executed workflow-script cases a `verify:` line names are recorded skipped.
- Report, per row: the old id, the new ids, the alone time of each from that junit, and the assertion map as built
  (each old line, then the new `file:line`). The same facts that following tasks need go into `maps.json`.

maps.json (`packages/core/test/fixtures/st-ln-44/maps.json`, LF, two-space indent). The first task that writes it
creates it as `{ "rows": {}, "baseline": [] }`; every task adds to it and never rewrites another task's entries:
- `rows`: keyed by the row number as a string; each value a list of `{ "old": <text>, "now": <text>, "cite": <text> }`
  or `{ "old": <text>, "test": <junit id>, "cite": <text> }`, exactly one of `now` and `test`.
  - `old`: the old assertion as `asserts` (Task 34) reads it: the statement from `expect(` or from the helper name up
    to its closing `;`, every run of whitespace turned into one space. Copy it from the baseline source
    (`git show <BASE>:<file>`). For a call of an assertion helper it is the call statement in the test body, never an
    `expect(` inside the helper.
  - `now`: the new assertion's text, read the same way, present in one of the row's places (its destinations, or for
    a row that is not moved its own test), and not used by any other entry or unchanged old assertion.
  - `test`: the id of the CLI test that makes a dropped CLI exit or output check (D-07's reading of ac-4).
  - `cite`: an exact substring of the row's note column (at least 3 characters). For a `test` entry it also contains
    that test's last title segment, or `#<m>` (not followed by a digit) for a row `m` whose own test or one of whose
    destinations is that test, or whose note contains that test's last title segment (for example
    `the CLI exit 0 is made by #63`; `` `accord approve > after approval gate ready passes` ``; or, for rows #71 and
    #96, whose notes say "as in #28" and "as in #20", `the CLI checks are made as in #28`).
- `baseline`: one `{ "old": <id>, "new": <id or null> }` per id of `accord/tests-baseline.txt` that the task removed
  (`null`) or renamed.

Audit procedure (Tasks 28 to 33; each audits the rows of a group of build tasks, so another executor than the one who
built a row checks it). For each row the task names, read the row's note column, the old test in
`git show 1cec2ac130d8d34c4dcdadddfee9effb4d1104e9:<file>`, its places at HEAD, and its entries in `maps.json`:
- A moved row with more than one destination: every old assertion (an `expect(` statement or an assertion-helper
  call statement, counted with its repeats) is in the destination the note's order names, or has its `maps.json`
  entry. Task 37's ac-4 test checks the multiset over all of a row's places but not which destination holds an
  assertion; this audit checks that.
- Every row: each of its `maps.json` entries makes the check its `old` made (a `now` checks the same value on the same
  state, or the core form the note names; a `test` names a CLI test that asserts the dropped exit or output check),
  and its `cite` is the note's wording for that change.
- A row whose note moves checks that are not assertions in rule 4's sense (row #1's per-id `bad.push` checks of
  show-approval.test.ts:139-149): each lands where the note says.
- A row whose only place is its own test (a faster or kept row): only the two items above; Task 37 checks its
  multiset mechanically.
Output: a list of rows with any gap, each with its old line and what is missing; an empty list is the pass. A gap that
is a plain omission (the note places the assertion and the code lacks it, or an entry is missing from `maps.json`) is
restored in place and named in the report; any other gap is reported, not fixed. Must not change: any test beyond
restoring a missing assertion the note places; any `maps.json` entry beyond adding a missing one or correcting its
text to the code. The task's `verify:` tests must still pass after any restoration.

## Task 1: Wiring: run() refuses any folder outside the temp folder (H8)
covers: D-05, D-09, D-10, D-11
files: packages/cli/test/helpers/repo.ts, packages/cli/test/sandbox-guard.test.ts (new)
verify: packages/cli/test/sandbox-guard.test.ts#risk:data-loss-run-refuses-the-checkout-and-a-folder-outside-the-temp-folder-and-accepts-a-folder-that-exists-only-under-it

Rows: none (H8 is listed on many rows; table rule 6). This task makes the guard every template row relies on, so a
copy with an unset path can never run `accord worktree clean` in the real checkout. D-09 and D-10 are withdrawn by
D-11: this plan makes no product cut, and every lever below is test code.

Consumes: `run()` in `packages/cli/test/helpers/repo.ts:91-101` and the guard pattern of `gitIn` (:18-25).
Produces: `run()` with the same signature and return value that throws
`refusing to run accord outside a temporary sandbox: <cwd>` before calling `runCli` when the cwd is outside the
temp folder.

Test first, in the new file `packages/cli/test/sandbox-guard.test.ts` (imports from `vitest`, `node:fs`, `node:os`,
`node:path`, `node:url` and `./helpers/repo.js`):
- `it('risk:data-loss run refuses the checkout and a folder outside the temp folder and accepts a folder that exists only under it')`:
  - `checkout = fileURLToPath(new URL('../../../', import.meta.url))`;
    `await expect(run(['--version'], checkout)).rejects.toThrow('refusing to run accord outside a temporary sandbox')`.
  - The same refusal for `join(checkout, 'packages')`, an existing folder that is not the process cwd (a guard that
    only compares with `process.cwd()` accepts it), for `join(checkout, 'no-such-folder', 'sub')`, a path that does
    not exist, and for `''`, the unset path of the table's data-deletion risk C.
  - `tmp = mkdtempSync(join(tmpdir(), 'accord-guard-'))`; `await run(['--version'], join(tmp, 'sub', 'deeper'))`
    resolves with `code` 0 (the folder does not exist; `--version` needs none). `cleanup(tmp)` in a `finally`.
  - Run it before the guard exists and see it fail on the first expectation.

Guard: walk `resolve(cwd)` up to its nearest existing ancestor, take `realpathSync.native` of it, and refuse unless it
starts with `realpathSync.native(tmpdir())` and differs from `realpathSync.native(process.cwd())`, the same
comparison `gitIn` makes.

Must not change: `gitIn`, every other helper in repo.ts, and `run()`'s behaviour for any cwd under the temp folder.
After the task, run every CLI test file once (`npx vitest run packages/cli/test`); any test the guard now refuses is
reported, not edited (table: "One grep found no test that runs accord outside a temp folder").

## Task 2: Wiring: a template copy has its own origin and paths and matches a built clone (H1, rule 5)
covers: D-05, D-11, D-12
files: packages/cli/test/helpers/worktree.ts, packages/cli/test/helpers/repo.ts, packages/cli/test/sandbox-guard.test.ts (new)
verify: packages/cli/test/sandbox-guard.test.ts#risk:data-loss-a-template-copy-pushes-to-its-own-origin-and-matches-a-clone-built-the-same-way, packages/cli/test/sandbox-guard.test.ts#risk:data-loss-copyClone-refuses-a-template-that-holds-a-linked-worktree

Rows: none (H1 and rule 5 for every template row, the upgrade copies of D-12 included).

Consumes: `makeClone`, `Clone`, `gitRun`, `cleanup`. Produces, in `helpers/worktree.ts`:
- `copyClone(tpl: Clone, others: string[] = []): Clone & { others: string[] }`:
  - Throws `template holds a linked worktree: <root>` when `tpl.git('worktree', 'list', '--porcelain')` has more
    than one entry.
  - Makes a new remote folder (`accord-wt-remote-` prefix) and a new clone folder (`accord-wt-` prefix) with
    `realpathSync.native(mkdtempSync(...))`, `cpSync(..., { recursive: true })` of `tpl.remote` and `tpl.root`, then
    `git remote set-url origin <new remote>` in the new clone (never a text replace).
  - The copy's `root` is `gitRun(<new clone folder>, 'rev-parse', '--show-toplevel').trim()`, the form `makeClone`
    uses (helpers/worktree.ts:48): forward slashes on Windows, which the CLI prints (src/commands/worktree.ts:78-80)
    and `sibling` builds on. `remote` is the `realpathSync.native` folder, as in `makeClone`.
  - Copies each folder in `others` (clones of `tpl.remote` the file made, for example upgrade's other clone) to an
    `accord-wt-other-` folder and sets its origin the same way.
  - For each copied clone (never the bare remote, which has no origin) asserts, throwing an Error naming both URLs on
    any miss: `git remote get-url origin` equals the new remote; `git remote get-url --push origin` equals the new
    remote; the fetch URL differs from `tpl.remote`; the push URL differs from `tpl.remote`.
  - Rule 5's upgrade check, made for every copy: throws `copy shares a path with its template: <path>` when the copy's
    `root` equals `tpl.root`, its `remote` equals `tpl.remote`, or a copied other folder equals any folder of
    `others` or `tpl.root`.
  - Returns a Clone over the new folders: `sibling`, `git` as in `makeClone`; `otherClone` as in `makeClone` (Task 3
    changes it); `cleanupAll` removing the siblings, the remote, the root, the copied others and every other clone it
    made. `others` holds the copied other folders, in the given order.
- In `helpers/repo.ts`: `copyRepo(tpl: string): string`, a `mkdtempSync(join(tmpdir(), 'accord-cli-'))` folder with
  `cpSync(tpl, it, { recursive: true })`, for templates with no remote (rule 5 excludes them from the origin check).

Tests first, in `sandbox-guard.test.ts`:
- `it('risk:data-loss a template copy pushes to its own origin and matches a clone built the same way', ..., 120_000)`:
  `tpl = makeClone({ tickets: ['ST-9', 'ST-10'] })`, `other = tpl.otherClone()`,
  `built = makeClone({ tickets: ['ST-9', 'ST-10'] })`, `c = copyClone(tpl, [other])`. Expect: the four origin facts
  above for `c.root` and `c.others[0]`; `c.root`, `c.remote` and `c.others[0]` differ from `tpl.root`, `tpl.remote`
  and `other`; `c.root` equals `c.git('rev-parse', '--show-toplevel').trim()` and holds no `\`;
  `c.git('push', '-q', 'origin', 'HEAD:refs/heads/probe')` creates `refs/heads/probe` in `c.remote` and not in
  `tpl.remote`; equal between `c` and `built`: `for-each-ref --format=%(refname)` of the clone and of the remote,
  `ls-tree -r HEAD`, `log --format=%s`, `config user.email`, `config user.name`, `config commit.gpgsign`, an empty
  `status --porcelain`, and `worktree list --porcelain` with the root replaced by `<root>` and the `HEAD <sha>` line
  replaced by `HEAD <sha>` (one entry each). All three `cleanupAll()` in a `finally`.
- `it('risk:data-loss copyClone refuses a template that holds a linked worktree')`: after
  `tpl.git('worktree', 'add', '-q', '-b', 't/ST-9', tpl.sibling('ST-9'), 'origin/main')`,
  `expect(() => copyClone(tpl)).toThrow('linked worktree')`.

Must not change: `makeClone` and its returned object; every existing export of both helper files; Task 1's guard.

## Task 3: Wiring: a copy's other clone is one git clone (H2)
covers: D-05, D-11
files: packages/cli/test/helpers/worktree.ts, packages/cli/test/sandbox-guard.test.ts (new)
verify: packages/cli/test/sandbox-guard.test.ts#risk:regression-an-other-clone-of-a-template-copy-is-one-clone-with-the-fixture-identity-and-its-own-origin

Rows: none (H2 for every row that lists it).

Consumes: Task 2's copied Clone. Produces: its `otherClone()` as one spawn:
`git clone -q -c user.email=fixture@example.invalid -c user.name=fixture -c commit.gpgsign=false <copy remote> .`
in a new `accord-wt-other-` folder (git writes each `-c` of `clone` into the new repository's config).

Test first: `it('risk:regression an other clone of a template copy is one clone with the fixture identity and its own origin', ..., 60_000)`:
from `copyClone(makeClone())`, `o = c.otherClone()`; `config user.email`, `user.name` and `commit.gpgsign` in `o`
equal those of `c.root`; `git remote get-url origin` in `o` equals `c.remote`; `o`'s `main` equals the remote's
`main`.

Must not change: `makeClone`'s `otherClone` (unlisted tests keep it), Task 2's tests.

## Task 4: Wiring: templates and their copies run no automatic git maintenance (H6)
covers: D-05, D-11
files: packages/cli/test/helpers/worktree.ts, packages/cli/test/sandbox-guard.test.ts (new)
verify: packages/cli/test/sandbox-guard.test.ts#risk:regression-a-template-copy-and-its-other-clone-run-no-automatic-git-maintenance

Rows: none (H6 for every template row; table: its saving is unconfirmed, Task 35 measures it).

Produces: `makeTemplate(opts)` in `helpers/worktree.ts`: `makeClone(opts)`, then in its root
`git config maintenance.auto false` and `git config gc.auto 0`, and in its remote `git config gc.auto 0` and
`git config receive.autogc false`. Task 3's `otherClone` also passes `-c maintenance.auto=false -c gc.auto=0`.
Every clone template in Tasks 6 to 26 is built with `makeTemplate`.

Test first: `it('risk:regression a template copy and its other clone run no automatic git maintenance', ..., 60_000)`:
`c = copyClone(makeTemplate())`, `o = c.otherClone()`; `config --get maintenance.auto` is `false` and
`config --get gc.auto` is `0` in `c.root` and `o`; `config --get receive.autogc` is `false` and `gc.auto` `0` in
`c.remote`.

Must not change: `makeClone`; Tasks 2 and 3's tests.

## Task 5: Wiring: core-ready hashes equal the ones approve and gate ready write
covers: D-05, D-11
files: test/helpers/lane.ts, packages/cli/test/core-ready.test.ts (new), packages/cli/test/dashboard.test.ts, packages/cli/test/show.test.ts
verify: packages/cli/test/core-ready.test.ts#risk:regression-core-approve-and-gateReadyIn-write-the-hashes-accord-approve-and-gate-ready-write

Rows: none (the core-ready lever of table.md, used by rows #3, #5, #10, #20, #28, #43, #44, #46, #60, #64, #69,
#71, #90, #95, #96).

Consumes: `approvedHash`, `gateReady`, `loadSnapshot`, `setFrontmatterKey` from
`../../packages/core/src/index.js` (the import core tests already make; `test/helpers/lane.ts` is imported by both
test trees, so it never imports the built package). Produces, exported from `test/helpers/lane.ts`, moved verbatim
from `packages/cli/test/dashboard.test.ts:11-35` (show.test.ts:99-118 holds identical copies): `type Files`,
`type Opts`, `P`, `AC`, `approve`, `ready`, `building`, `done`; plus one new function:
- `gateReadyIn(files: Files, id: string): string`: `gateReady(loadSnapshot({ files, tree: Object.keys(files) }), id)`;
  when its verdict is `pass`, sets `ac_hash` of `files[P(id)]` to the result's `acHash`; returns the verdict. It is
  the core form of `accord gate ready`, used where a row turns a setup-only `gate ready` run into a core check.

Test first, `packages/cli/test/core-ready.test.ts`:
- `it('risk:regression core approve and gateReadyIn write the hashes accord approve and gate ready write', ..., 60_000)`:
  - Lane M: `a = makeLaneRepo()`; `run(['approve', 'T-1'], a)` and `run(['gate', 'ready', 'T-1'], a)` exit 0. A files map
    of the same `makeLaneRepo` contents (`CONFIG`, `laneTicket('T-1')`, `PLAN`, `src/export.ts`, the report),
    `approve(files, 'T-1')`, `expect(gateReadyIn(files, 'T-1')).toBe('pass')`; `files[P('T-1')]` equals
    `accord/tickets/T-1.md` read from `a`.
  - Lane S: the same with `laneTicket('S-1', { lane: 'S', body: LANE_S_BODY })`, `gate ready` only, no approve.
  - `cleanup` both repositories in a `finally`.

Then `dashboard.test.ts` and `show.test.ts` import those names from `../../../test/helpers/lane.js` and drop their
local copies.

Must not change: every test body in `dashboard.test.ts` and `show.test.ts`; the existing exports of `lane.ts`
(`REPORT`, `CONFIG`, `LANE_S_BODY`, `LANE_BODY`, `laneTicket`, `PLAN`, `junit`), which core tests import. Run
`npx vitest run packages/core/test` once as well.

## Task 6: The ST-LN-19 ac-1 test rebuilds every ticket in core and runs show once (D-08)
covers: D-04, D-05, D-08, D-11
files: packages/cli/test/show-approval.test.ts
verify: packages/cli/test/show-approval.test.ts#ac-1-every-scenario-of-every-real-ticket-is-rebuilt-exactly-from-the-approval-view, packages/cli/test/show-approval.test.ts#risk:data-loss-approval-refuses-a-ticket-whose-gherkin-does-not-parse

Rows: #1.

Consumes: `approvalView` and `loadSnapshot` from `@accord-dev/accord-core`, `isUnsafe` from
`../src/render/dashboard.js` (the same unsafe-char map `show.ts:10` uses), the file's `rebuild()`. Produces: the
test `ac-1 every scenario of every real ticket is rebuilt exactly from the approval view`, title, tag and timeout
unchanged. Row #1 writes no `maps.json` entry.

Body, per row #1:
- `expect(ids.length).toBeGreaterThanOrEqual(10)` stays.
- Core loop over every id: `out = approvalView(snap.tickets[id]).split('\n').map(clean).join('\n')` with
  `clean` as in `show.ts:10`; the rebuild-equal and shares-past-first-Then checks of :143-149 run on `out`; and
  `snap.errors.filter((f) => f.file === snap.tickets[id].file)` is empty (the condition `show.ts:45` exits 1 on),
  pushed to `bad` as `<id> load finding` otherwise.
- One CLI run: a `makeEmptyRepo()` sandbox holding only `accord/config.yml` (`CONFIG`) and
  `accord/tickets/ST-LN-19.md`; `run(['show', 'ST-LN-19', '--approval'], repo)` exits 0 and its `rebuild(out)`
  equals ST-LN-19's scenarios.
- `expect(bad).toEqual([])` stays last.
- The old body's assertions in rule 4's sense are its two `expect(` statements (:132 and :154), and both keep their
  text, so row #1 needs no `maps.json` entry. The per-id exit 0 and rebuild checks of :139-149 are `if (...)
  bad.push(...)` conditions that `asserts` does not read; their D-08 mapping (exit 0 to the load finding check,
  rebuild checks to the core loop) is the row's note, and Task 28's audit checks it.

The test proving ST-LN-19 ac-1 must pass, as must ac-2, ac-3 and ac-5 of this file, which make the per-id CLI exit 0
(row #1 note).

Must not change: every other test of the file, `rebuild()`, `viewOf()`.

## Task 7: Workflow-script cases run their scripts concurrently
covers: D-01, D-05, D-11
files: packages/cli/test/workflow-script.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-risk:parsing-BOM-and-CRLF-frontmatter-and-unreadable-blocks-and-large-files-read-as-approved, packages/cli/test/workflow-script.test.ts#risk:security-a-lane-S-ticket-that-passed-gate-ready-is-gated-in-an-accord-only-diff-and-a-queued-one-is-not, packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-the-workflow-of-this-repository-gates-the-same-tickets-with-the-same-exit-as-the-emitted-one, packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-code-in-the-diff-or-an-approved-ticket:-gate-done-runs-and-its-failure-fails-the-job, packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-unapproved-tickets-in-an-accord-only-diff:-lint-runs-and-no-gate-done-runs-and-the-exit-follows-lint, packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-against-the-real-CLI->-dropped-ticket-in-an-accord-only-diff:-no-gate-done-on-it-and-a-missing-Dropped-reason-fails-through-lint

Rows: #2, #6, #9, #17, #35, #57, #109.

Consumes: `runScript` (:220-270). Produces: `runScriptAsync(repo, opts): Promise<Run>` beside it, sharing its stub,
`script.sh`, `calls.log` and `env` code (move that into a local `prepare(repo, opts)` both call), running
`promisify(execFile)(BASH, ['script.sh'], options)`. On rejection, `code` is the error's numeric `code` (execFile
reports the exit status there, not in `status`), `out` and `err` its `stdout` and `stderr`.

Rows #2, #6, #9, #17, #35, #57 become `async` tests: every sandbox of the test is built first, then all its script
runs go through one `Promise.all` of `runScriptAsync`, then every assertion of the old body runs on the results in
the old order (row notes; #2 keeps `named.length === 1` and, per case and both scripts, `toBe(code)` and the
gated-id `toEqual` of :463-470; #17 keeps BIG-1 at 2 MB; #35 keeps every check of :510-523). Each keeps its timeout.
Each result is bound to the variable name the old body used before that body's assertions run, so the assertion
text stays identical; any assertion whose text still changes gets one `maps.json` entry under its row (`now` the
new text, `cite` from "checked after its run resolves" or the row's own wording).

Test first: convert #17 (`risk:parsing ...`) and see it pass with the same assertions, then the others.

#109 is unchanged and keeps the sync `runScript`, as do the other tests of the file. The criterion tests of
BUG-LN-3 (#2 ac-4, #6 ac-3, #9 ac-1, #57 ac-2) must pass. #2 and #9 are kept rows: their ceilings are 106 s and 45 s.

Must not change: `sandbox`, `scriptOf`, `noBash` (:61-67), `runScript`'s behaviour, every assertion.

## Task 8: Lane S gate done verdicts split from one reviewed template
covers: D-04, D-05, D-11
files: packages/cli/test/lane-s.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/lane-s.test.ts#risk:complex-branching-lane-S-gate-done-passes-a-reviewed-change, packages/cli/test/lane-s.test.ts#risk:complex-branching-lane-S-gate-done-fails-on-a-code-commit-after-the-review, packages/cli/test/lane-s.test.ts#risk:complex-branching-lane-S-gate-done-fails-on-edited-approved-sections, packages/cli/test/lane-s.test.ts#risk:complex-branching-lane-S-gate-done-fails-on-a-fix-committed-between-a-round-and-its-verdict, packages/cli/test/lane-s.test.ts#risk:complex-branching-lane-S-gate-done-passes-a-verdict-committed-right-after-its-round, packages/cli/test/lane-s.test.ts#risk:complex-branching-the-review-package-of-a-lane-S-ticket-starts-at-the-fork-point-from-the-default-branch, packages/cli/test/lane-s.test.ts#ac-3-the-dashboard-lists-a-queued-and-a-claimed-lane-S-ticket-with-a-lane-column

Rows: #3, #63, #69, #102.

Consumes: `repoWith`, `copyRepo`, `gateReadyIn`, `P` (Task 5). Produces:
- #3: a `beforeAll` template of the reviewed state of :101-120: the base commit, `t/S-1`, core-ready `ac_hash` by
  `gateReadyIn` in place of the :117 `gate ready` run, the `ready: S-1` commit and the `change` commit (:119-120).
  The template's tip is the `change` commit the review reads; the `review: S-1` commit of :121-122 is the first step
  of each destination that needs it. Removed in `afterAll`. Fourteen tests, titles and order from row #3, each a
  `copyRepo` of the template that sets its state with at most 3 git commands (each `commitMsg` call, `reset` and
  `switch` counts as one; file writes are not git commands) and asserts the one verdict the row's note maps (:123 to
  :180-184), with the `passes`/`fails` helpers of :108-113 declared once in the file:
  1. passes a reviewed change: review commit (1).
  2. passes when a ledger commit follows the review: review, ledger (2).
  3. fails on a code commit after the review: review, `src/b.ts` commit (2).
  4. fails on a detached commit after the review: review, `switch --detach`, `src/d.ts` commit (3).
  5. fails on a failed suite: review (1), the failed report written.
  6. fails on an edited review that is not committed: review (1), the review file edited.
  7. fails on a review whose commit was undone: review, `reset --soft HEAD~1` (2).
  8. fails on lines after the verdict: review, trailing commit (2).
  9. fails on edited approved sections: review, `edit` commit (2).
  10. fails on a review commit that holds code: one commit of the review and `src/c.ts` (1).
  11. passes a verdict the owner accepted with a Must open: the Round 5 review commit (1).
  12. fails on a fix committed between a round and its verdict: round 1, `src/e.ts`, verdict commits (3).
  13. passes a verdict committed right after its round: round 1, verdict commits (2).
  14. fails on a verdict commit with code, names the file, and finds no commit after review: round 1 with
      `src/e.ts`, verdict commits (2); :181-184 stay in it.
  The first test also asserts `expect(gateReadyIn(...)).toBe('pass')` (the :117 exit 0; its CLI form is made by #63:
  one `maps.json` entry under `3`, `test` the #63 id, `cite` "the CLI exit 0 is made by #63"). The original title is
  gone. Each `passes()`/`fails(rule)` call of the old body lands once in its destination, so the multiset holds.
- #69: `gateReadyIn` in place of the `gate ready S-1` run (:71), with `expect(...).toBe('pass')`; `repoWith`'s
  identity (:55-57) for this test written into `.git/config` with `writeFileSync`/append instead of three
  `git config` runs; the two dashboard runs' checks stay. The :71 exit 0 gets one `maps.json` entry under `69`
  (`test` the #63 id, `cite` "the CLI check is made by #63").
- #63 (kept, no cut, ceiling 15 s) and #102 (unchanged) are not edited.

Test first: write the template and the first destination, see it pass, then the other thirteen.

Must not change: #63, #102, `risk:security approve refuses a lane S ticket and writes nothing`, `repoWith` for its
other callers.

## Task 9: After-verify tests from template clones
covers: D-05, D-11
files: packages/cli/test/after-verify.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/after-verify.test.ts#risk:complex-branching-the-commits-after-verify-come-from-the-ticket-tip-in-graph-order, packages/cli/test/after-verify.test.ts#risk:complex-branching-a-merge-from-origin-main-after-verify-is-a-commit-after-verify-with-no-files, packages/cli/test/after-verify.test.ts#risk:complex-branching-with-no-origin-the-local-main-is-the-default-branch-and-a-renamed-main-is-not, packages/cli/test/after-verify.test.ts#risk:complex-branching-a-new-review-round-after-the-fix-takes-the-ticket-to-verify, packages/cli/test/after-verify.test.ts#risk:complex-branching-review-package-leaves-out-what-a-merge-from-the-default-branch-brought-in

Rows: #4, #20, #83, #96.

#20's first destination (`... done, then review ...`) and #96's title (`... at verify, before ...`) hold commas, so
they are run and reported but not named above.

Consumes: `makeTemplate`, `copyClone`, `approve`, `gateReadyIn`, `P`. Produces:
- #4: seven tests, titles and order from row #4, each from a `copyClone` of one `makeTemplate()` template and
  reading each state once. In a destination that uses `fact` (the old :35 and :95), `fact` is rebound to the value
  read once: `let state = loadFromFs(<root>).afterVerify?.['ST-9']; const fact = () => state;`, with
  `state = loadFromFs(<root>).afterVerify?.['ST-9'];` after each state change (after the fix commit, after the merge
  of `origin/main`, after the side merge; after the rename of `main` in the other block). Every assertion of :36-115
  then keeps its text, and each doubled `fact()` pair checks one value read once, so row #4 writes no `maps.json`
  entry. Assertion map per the note.
- #20: a `beforeAll` template of the pushed done state with core-ready hashes (approve and `gateReadyIn` on the
  ticket text instead of the :125-126 runs, then the plan, ledger, review, `work` and `tick` commits and the push);
  four tests per row #20. The first asserts `gateReadyIn` returns `pass` and the approved hash is set; the :125-126
  exit 0 checks get `maps.json` entries under `20` naming the two lane-commands tests the note names.
- #83: template clone and other clone (copy with `others`); both review-package runs stay.
- #96: template clone; core-ready instead of :219-220 with `toBe('pass')`; both anchor runs stay. The :219 and :220
  exit checks get one `test` entry each under `96`, naming
  `packages/cli/test/lane-commands.test.ts#accord-approve->-writes-approved_hash-once-and-is-a-no-op-the-second-time`
  and `packages/cli/test/lane-commands.test.ts#accord-approve->-after-approval-gate-ready-passes`, each with `cite`
  "the CLI checks are made as in #20" (row #20's note quotes both titles).

Test first: #4's first destination.

Must not change: `commit`, `setKey`, `VERIFICATION`; every assertion's value.

## Task 10: Drop tests from claimed-clone templates
covers: D-04, D-05, D-11
files: packages/cli/test/drop.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/drop.test.ts#risk:complex-branching-drop-reads-a-local-claim-tip-ahead-of-origin, packages/cli/test/drop.test.ts#risk:complex-branching-drop-refuses-diverged-claim-tips, packages/cli/test/drop.test.ts#risk:complex-branching-drop-names-trunk-when-origin-HEAD-is-trunk, packages/cli/test/drop.test.ts#risk:complex-branching-drop-refuses-a-ticket-already-dropped-on-main, packages/cli/test/drop.test.ts#risk:complex-branching-drop-refuses-a-failed-fetch, packages/cli/test/drop.test.ts#risk:data-loss-drop-proceeds-once-the-held-ticket-file-is-committed, packages/cli/test/drop.test.ts#risk:data-loss-drop-pushes-a-crlf-ticket-file-with-a-bom-byte-for-byte-outside-the-status-value-and-the-dropped-section, packages/cli/test/drop.test.ts#ac-1-dropping-a-ticket-pushes-a-branch-from-the-default-branch-whose-only-change-is-the-ticket-file-set-to-dropped, packages/cli/test/drop.test.ts#ac-2-dropping-without-a-reason-is-refused-and-nothing-is-created-committed-or-pushed

Rows: #7, #32, #39, #40, #41, #79.

Consumes: `makeTemplate`, `copyClone`, `claimOnBranch`, `ticketWith`, `writeIntent`, `remoteDrop`. Produces, in
`beforeAll` (removed in `afterAll`), three templates of this file:
- the plain template: `makeTemplate()` with nothing claimed, for #79, whose own claim creates `t/ST-10` in a
  worktree (:145) and so cannot start from a clone where `t/ST-10` exists and is checked out (drop.test.ts:27);
- the claimed template: `makeTemplate()` with `claimOnBranch(tpl, 'second')` pushed (rows #32, #40 copy it as is;
  #7 and #39 copy it and then write the intent state each destination needs);
- the crlf template for #41: `core.autocrlf false`, the BOM/CRLF ticket on `t/ST-10`, committed and pushed (:83-88).
All three are drop templates of rule 5 with a remote, copied with `copyClone`.
- #7: five tests per row #7 (the third sets C on origin and D locally itself; the fifth builds its trunk remote in
  its own copy); #39: four tests per row #39 (the first and second keep a real `drop ST-10` exit 0; the second
  merges `origin/drop/ST-10` into main from an other clone and deletes the drop branch); #79: two tests from a copy
  of the plain template with `worktree add` after the copy; #32, #40, #41 keep every assertion, only setup changes
  (#32 does not merge its two git reads).

Test first: #7's first destination.

Must not change: `risk:data-loss drop refuses a record the default branch would fail to lint`; the criterion tests'
assertions (#32 ST-LN-34 ac-1, #40 ST-LN-34 ac-2).

## Task 11: Upgrade tests from templates of clone, other clone and remote (rows #12, #13 and D-12's #114 to #118)
covers: D-04, D-05, D-11, D-12, D-13
files: packages/cli/test/upgrade.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/upgrade.test.ts#risk:data-loss-upgrade-refuses-and-pushes-nothing-when-the-pin-is-not-older, packages/cli/test/upgrade.test.ts#risk:data-loss-upgrade-refuses-and-pushes-nothing-when-the-upgrade-branch-exists-on-origin, packages/cli/test/upgrade.test.ts#risk:data-loss-upgrade-refuses-and-pushes-nothing-when-the-settings-are-not-a-JSON-object, packages/cli/test/upgrade.test.ts#risk:data-loss-upgrade-refuses-and-pushes-nothing-when-the-default-branch-would-fail-lint, packages/cli/test/upgrade.test.ts#risk:complex-branching-an-anchored-lint-and-gate-step-is-only-repinned-and-the-warning-says-it-must-be-a-block-list-item, packages/cli/test/upgrade.test.ts#risk:complex-branching-a-flow-lint-and-gate-step-is-only-repinned-and-the-warning-says-it-must-be-a-block-list-item, packages/cli/test/upgrade.test.ts#risk:complex-branching-a-lint-and-gate-step-whose-env-another-step-aliases-is-only-repinned-and-warns-it-was-not-refreshed, packages/cli/test/upgrade.test.ts#risk:complex-branching-a-step-that-was-not-refreshed-still-gets-its-warning-when-the-push-fails, packages/cli/test/upgrade.test.ts#ac-3-upgrade-pushes-a-branch-from-the-latest-origin-main-whose-one-commit-moves-every-pin-and-the-checkout-is-unchanged, packages/cli/test/upgrade.test.ts#ac-1-upgrade-replaces-the-lint-and-gate-step-of-a-0.1.0-workflow-with-the-step-accord-init-writes-now, packages/cli/test/upgrade.test.ts#ac-2-upgrade-replaces-only-the-lint-and-gate-step-and-keeps-every-other-line-of-the-workflow, packages/cli/test/upgrade.test.ts#ac-3-a-workflow-with-no-or-two-lint-and-gate-steps-is-only-repinned-and-upgrade-warns-on-stderr

Rows: #12, #13, #114, #115, #116, #117, #118.

Consumes: `makeTemplate`, `copyClone(tpl, [other])` (Task 2, with rule 5's origin and path checks, which keep each
copy's `c.root`, `c.remote` and other clone apart from the template's). Produces, in `beforeAll` (removed in
`afterAll` by each template's `cleanupAll()`, which also removes the other clone it made):
- the plain template: `plain = makeTemplate()` and `plainOther = plain.otherClone()` ("#13's plain `makeTemplate()`
  template with its other clone" in rows #114 to #118);
- #12's template: `pinned = makeTemplate()`, `pinnedOther = pinned.otherClone()`, then :25-35 (the 0.0.9 config,
  workflow and settings, the `pin 0.0.9` and `next` commits, the push) run once in `pinnedOther`; the `next` commit's
  sha is kept in a file-level variable.
- A file-level `copy(tpl, other)`: `copyClone(tpl, [other])`, pushed to `clones` so the existing `afterEach` removes
  it. In every copy, `c.others[0]` takes the place of the old `o = c.otherClone()`.

Rows:
- #12 (ST-LN-25 ac-3, kept, ceiling 43 s): `c = copy(pinned, pinnedOther)` and `base` bound to the stored `next`
  sha, so :53-54 keep their text (the test body no longer needs `o` or `old`); :37-69 unchanged (the `p` clone of :56 is the copy's own
  `otherClone()`, H2); the remote reads are not merged; every assertion stays in place.
- #13: four tests per row #13, each from `copy(plain, plainOther)` with `o = c.others[0]`, `cfg`, `pin`, `head`,
  `refused` and `noBranch` declared as at :76-90 with their bodies unchanged (in each destination, or once in a
  file-level factory over the copy). Destinations, in the row's order: :92-96; :98-103; `pin('0.0.9')` then
  :105-109; `pin('0.0.9')` then :113-118 (the second to fourth start from the 0.0.9 pin of :98, the state the old body
  had reached; a fresh template holds no `.claude/settings.json` and no upgrade branch, the state at :105 and :113).
  Every `refused(...)`/`noBranch()` call of the old body, with its argument, is made once in its destination.
- #114 (BUG-LN-8 ac-2, kept, ceiling 83 s): in the loop, :175-177 become `const c = copy(plain, plainOther);
  const o = c.others[0];`; the three cases and their three upgrade runs stay in one test; every assertion stays
  (:154, :163-164 inside `shallow`, :187-190 per case).
- `upgradeOf` (:197-206), used by #115 and #116: :198-200 become `const c = copy(plain, plainOther); const o =
  c.others[0];`; the rest of `upgradeOf` and all of `onlyRepinned` (:207-213) unchanged.
- #115 (moved; each destination kept with a 29 s ceiling, D-13): three tests per row #115, titles and order from the
  row, in place of the original test. Each declares `const base = init09();`, the one `cases` entry of :236-238 it
  covers as `const k = { label: ..., input: ..., shape: ... }` (the alias test also declares `env` as at :233), then
  `const r = await onlyRepinned(k.input, k.label);` and the old checks with their text unchanged: anchored and flow
  run :242, :244 and :245; alias runs :234 (`expect(base).toContain(env);`, before its `onlyRepinned`) and :242. So
  every old assertion keeps its text and no `maps.json` entry is needed; any text that still changes gets one under
  `115`.
- #116 (BUG-LN-8 ac-3, kept, ceiling 56 s): no edit beyond `upgradeOf`; both cases stay in one test.
- #117 (kept, ceiling 29 s, D-13): :251-253 become `const c = copy(plain, plainOther); const o = c.others[0];`; the
  pre-receive hook is written into the copy's own `c.remote` (:258-260) and removed in its `finally` (:268); every
  assertion stays (:263-266).
- #118 (BUG-LN-8 ac-1, kept, ceiling 26 s): :122-124 become `const c = copy(plain, plainOther); const o =
  c.others[0];`; every assertion stays (:132-134, :138-139, :142, :144, :147).

Test first: #13's first destination, then #118 on `copy(plain, plainOther)`, which proves the plain template; then the
rest. The criterion tests of ST-LN-25 (#12) and BUG-LN-8 (#114, #116, #118) must pass with every assertion line
unchanged.

Must not change: every assertion of #12, #114, #116, #117 and #118; `STEP`, `init09`, `repinned`, `onlyRepinned`.

## Task 12: Hook tests from template clones
covers: D-04, D-05, D-11
files: packages/cli/test/hook.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/hook.test.ts#risk:security-the-prompt-expansion-hook-allows-an-empty-prompt-and-a-continue-of-the-worked-ticket, packages/cli/test/hook.test.ts#risk:security-the-prompt-expansion-hook-blocks-continue-and-pick-up-of-other-tickets-in-the-ticket-worktree, packages/cli/test/hook.test.ts#risk:security-the-prompt-expansion-hook-blocks-free-text-and-other-continues-in-the-ticket-worktree, packages/cli/test/hook.test.ts#risk:security-the-prompt-expansion-hook-blocks-from-a-subfolder-and-by-a-hold-in-the-main-checkout-and-lets-another-session-through, packages/cli/test/hook.test.ts#risk:complex-branching-the-prompt-expansion-hook-allows-with-one-stderr-line-in-a-repository-pinned-to-another-accord, packages/cli/test/hook.test.ts#risk:security-the-prompt-expansion-hook-lets-accord-upgrade-through-in-a-session-that-works-a-ticket, packages/cli/test/hook.test.ts#risk:complex-branching-the-registry-is-asked-again-only-after-24-hours-and-only-a-newer-plain-version-is-announced, packages/cli/test/hook.test.ts#ac-1-a-newer-release-is-announced-by-the-session-start-hook-and-the-dashboard-and-the-registry-is-asked-once-in-24-hours, packages/cli/test/hook.test.ts#ac-2-an-unreachable-registry-adds-no-line-is-given-up-after-3-seconds-and-is-not-asked-again

Rows: #19, #51, #53, #68, #74, #91.

Consumes: `makeTemplate`, `copyClone`, `upgradeNotice` from `../src/commands/notice.js`, the mocks of
`packages/cli/test/setup.ts:7-16`. Produces, with templates per opts (`{}`, `{ tickets: ['ST-9'] }`,
`{ tickets: ['ST-9', 'ST-10'] }`) built in `beforeAll`:
- #19: four tests per row #19, each from a copy with `worktree add` of `t/ST-9` after the copy (and `sub` made in
  the tests that use it). Every `blocked(...)` call of the old body, with its argument, is made once in the
  destination the note names; `blocked` keeps its body.
- #51: two tests per row #51; the pinned clone is a template copy with the pin committed.
- #53 (ST-LN-25 ac-1): one template copy serves both argv instead of two `makeClone` runs (:190); the cache file
  stays fresh per argv; every assertion stays.
- #68: the dashboard runs of :269-275 become `await upgradeNotice('0.2.0')` calls with the same mocks; :270-271
  and the version answers check the returned line instead of `out` (undefined or not containing ` is out`), each
  rewritten assertion with one `maps.json` entry under `68`; :266-268 and :276-279 stay CLI runs on a template copy.
- #74: a template copy instead of `makeClone`; #91 (kept, ceiling 11 s): a template copy; the 3 s abort wait stays.

Test first: #19's first destination.

Must not change: the `describe('accord hook')` tests; `freshCache`, `resetNotice`; every assertion of #53 and #91.

## Task 13: Dashboard tests from core-ready files and lane-repo templates
covers: D-04, D-05, D-11
files: packages/cli/test/dashboard.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/dashboard.test.ts#risk:complex-branching-a-dependency-done-only-on-its-claim-branch-still-blocks-its-dependent, packages/cli/test/dashboard.test.ts#risk:complex-branching-the-dashboard-counts-a-dependent-of-a-claim-branch-done-ticket-as-blocked, packages/cli/test/dashboard.test.ts#risk:complex-branching-the-viewer-comes-from-git-user.email-without-case-and-an-empty-one-exits-2, packages/cli/test/dashboard.test.ts#risk:regression-an-idle-ticket-shows-idle-days-in-the-dashboard-text-and-the-json-keeps-every-key, packages/cli/test/dashboard.test.ts#ac-1-ready-tickets-are-ranked-by-inherited-priority-then-by-id, packages/cli/test/dashboard.test.ts#ac-2-rows-carry-titles-and-sections-carry-column-headers, packages/cli/test/dashboard.test.ts#ac-4-an-unwritten-intent-points-anchor-and-dashboard-to-the-intent-interview

Rows: #28, #54, #71, #78, #81, #90.

Consumes: Task 5's `approve`, `ready`, `done`, `gateReadyIn`, `P`; `copyRepo`. Produces:
- #28 (ST-LN-2 ac-1): the five tickets written core-ready (`approve` then `gateReadyIn`, each
  `expect(...).toBe('pass')`), replacing the ten runs of the loop at :142-145 (:143-144); `dashboard --json` and the
  two `lint` runs stay.
- #71 (ST-LN-2 ac-2): ST-AN-1 core-ready instead of :44-45, `toBe('pass')`; status json and dashboard checks stay.
- #90: `approve` in core instead of the :342 run; the rest stays.
- #54: a `beforeAll` template of the claim-done state (commit on base, `update-ref`, `reset --hard` in place of the
  checkout dance of :364-371); two tests per row #54.
- #78: a template of a committed lane repo with ST-AN-1 instead of `makeLaneRepo` plus `commitAll` (:283-285).
- #81 (BUG-LN-2 ac-4): a lane-repo template copy instead of `makeLaneRepo`; the `user.email` of :392 written into
  `.git/config` with fs; the five anchor and dashboard runs stay.

The CLI checks these rows drop are made by `gate.test` `gate ready on a passing ticket exits 0 and writes the
renderText body` and lane-commands `accord approve > writes approved_hash once and is a no-op the second time` and
`accord approve > after approval gate ready passes` (row notes); run those files too. Each dropped exit check gets
one `maps.json` `test` entry under its row naming the test its row note names, with the note's words as `cite`.
Row #71's note names its CLI tests only as "as in #28": its :45 exit check's entry names
`packages/cli/test/lane-commands.test.ts#accord-approve->-after-approval-gate-ready-passes` with `cite`
"the CLI checks are made as in #28" (row #28's note quotes that title).

Identity (preamble rule on `commitMsg`): the lane-repo templates of #54, #78 and #81 write
`user.email fixture@example.invalid`, `user.name fixture` and `commit.gpgsign false` into the repository's config
before their first `commitMsg`. #54's and #81's viewer `user.email an@example.com` (:361, :392) is written after the
template's last `commitMsg`; #78's claim commit keeps its `-c user.email=An@Example.com` `commit-tree` line (:286),
the identity it asserts, with the viewer email after it (:288).

Test first: #54's two destinations.

Must not change: the pure dashboard tests of the file; the criterion assertions of #28, #71, #81.

## Task 14: Show tests from claim-state templates
covers: D-05, D-11
files: packages/cli/test/show.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/show.test.ts#risk:complex-branching-show-takes-blockers-from-the-checkout-not-the-claim-branch, packages/cli/test/show.test.ts#risk:complex-branching-show-takes-the-stage-of-a-ticket-done-only-on-its-claim-branch, packages/cli/test/show.test.ts#risk:complex-branching-show-and-status-hold-a-plan-at-stage-plan-before-its-ready-commit, packages/cli/test/show.test.ts#risk:complex-branching-show-and-status-reach-build-at-the-plan's-ready-commit, packages/cli/test/show.test.ts#risk:regression-show-finds-a-ticket-filed-only-on-its-claim-branch-at-that-branch-stage, packages/cli/test/show.test.ts#risk:regression-show-text-of-a-ticket-filed-only-on-its-claim-branch-shows-that-branch-stage, packages/cli/test/show.test.ts#risk:security-show-text-turns-control-and-bidi-characters-into-spaces

Rows: #30, #60, #64, #94.

Consumes: `copyRepo`, `approve`, `building`, `done`, `P`. Produces, in `beforeAll` (removed in `afterAll`), one
claim-state template per row, because the two rows' claim states differ (no checkout in either; claim tip from
commits on base, `update-ref` and reset):
- #30's template: the :173 repo (T-1, and T-2 with `depends_on: ["T-1"]` in the checkout), `user.email`
  `an@example.com`, T-1 done on `refs/remotes/origin/t/T-1` only (:178-185); #30's two tests per row #30 copy it.
- #64's template: the plain lane repo with T-2 only on its claim branch at stage build (core-ready T-2, the plan,
  the task 1 ledger line; :121-134), so `blockedBy` is `[]` (:138); #64's two tests per row #64 copy it.
- #60: two tests per row #60 with `approve` in core (the :152 run was unasserted).
- #94 is unchanged.

Identity (preamble rule on `commitMsg`): both templates and #60's setup write `user.email fixture@example.invalid`,
`user.name fixture` and `commit.gpgsign false` into the repository's config before their first `commitMsg`, so #64's
claim tip is authored `fixture@example.invalid`, the `holder` :138 asserts. #30's viewer `user.email an@example.com`
(:175) is written after its template's last `commitMsg`.

Test first: #64's two destinations.

Must not change: #94, `ac-1 accord show prints the full detail as text`, `ac-2 accord show json gives the same detail
as data`.

## Task 15: Status claim-branch tests with core-ready setup
covers: D-04, D-05, D-11
files: packages/cli/test/status.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/status.test.ts#risk:complex-branching-a-merged-or-checked-out-or-ticketless-claim-branch-keeps-the-checkout-copy, packages/cli/test/status.test.ts#ac-1-a-ticket-untouched-past-the-window-shows-its-idle-days, packages/cli/test/status.test.ts#ac-2-a-recent-commit-on-the-claim-branch-keeps-the-ticket-active, packages/cli/test/status.test.ts#ac-1-a-ticket-filed-only-on-its-pushed-claim-branch-shows-at-that-branch-stage-without-a-fetch, packages/cli/test/status.test.ts#ac-3-a-plan-reaches-build-only-after-its-ready-commit-and-while-clean

Rows: #43, #44, #46, #95, #106.

Consumes: `approve` (Task 5). Produces, setup only, every assertion in place:
- #43 (STALE-1 ac-2, kept, ceiling 21 s): `approve` in core instead of :285; the claim tip by `branch t/T-1` and
  `reset` instead of the checkouts of :289 and :292.
- #44 (BUG-LN-2 ac-3, kept, ceiling 21 s): the two approve runs (:467, :490) in core.
- #46 (BUG-LN-2 ac-1, kept, ceiling 19 s): `approve` in core instead of :319; the claim by commits on base,
  `update-ref` and reset.
- #95 (STALE-1 ac-1): `approve` in core instead of :270.
- #106 is unchanged.
An approve run that was asserted (an exit check) gets one `maps.json` entry under its row; an unasserted run needs
none (the runs of :270, :285, :319, :467 and :490 are all unasserted).

Test first: #95, then the kept rows. These criterion tests must pass with every assertion line unchanged.

Must not change: every `describe` block of :63-265 and #106.

## Task 16: The lane flow walk becomes four stage tests
covers: D-05, D-11
files: packages/cli/test/lane-flow.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/lane-flow.test.ts#lane-ticket-flow->-risk:complex-branching-gate-ready-passes-only-after-approve-and-gate-plan-passes-on-a-plan-against-HEAD, packages/cli/test/lane-flow.test.ts#lane-ticket-flow->-risk:complex-branching-task-done-records-task-1-once-and-status-shows-build-1/2

Rows: #10.

Consumes: `makeLaneRepo`, `commitAll`, `approve`, `gateReadyIn`, `freshReport`, `evidence`. Produces four tests in
`describe('lane ticket flow')`, titles from row #10, each starting at its stage from core-ready files
(approve and `gateReadyIn` in core, the plan written against the baseline commit, earlier task-done ledger lines
written in setup). Assertion map: :43-49 (the CLI `gate ready` exit 1, `approve` exit 0, `gate ready` exit 0 and
`gate plan` stay CLI here), :50-55, :56-62 (the ledger line written in setup), :63-92. The third and fourth titles
hold commas, so they are run and reported but not named above.
Identity (preamble rule on `commitMsg`): each stage setup writes `user.email fixture@example.invalid`,
`user.name fixture` and `commit.gpgsign false` into its `makeLaneRepo` repository's config before its first
`commitMsg`.

The original id `packages/cli/test/lane-flow.test.ts#lane-ticket-flow->-walks-one-ticket-from-unapproved-to-done`
is gone (it is `accord/tests-baseline.txt:129`; the new titles carry `risk:`): add
`{ "old": "<that id>", "new": null }` to `baseline` in `maps.json`.

Must not change: `freshReport`, `evidence`.

## Task 17: Single rows in benchmark-compliance, lane-commands, new-ticket and bin
covers: D-05, D-11
files: packages/core/test/benchmark-compliance.test.ts, packages/cli/test/lane-commands.test.ts, packages/cli/test/new-ticket.test.ts, packages/cli/test/bin.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/new-ticket.test.ts#risk:complex-branching-a-ticket-added-and-deleted-on-a-merged-and-deleted-branch-keeps-its-number, packages/cli/test/bin.test.ts#risk:parsing-the-built-cli-hands-hook-input-on-stdin-to-the-prompt-expansion-hook, packages/core/test/benchmark-compliance.test.ts#ac-5-the-compliance-check-scores-every-run-against-the-other-rules

Rows: #61, #73, #87, #99, #104, #107, #110.

Produces:
- #61 (ST-LN-14 ac-5): memoize the injected `ticketAt` at `benchmark-compliance.test.ts:135` by id plus ms, test
  side; assertions unchanged. No core rebuild is needed: only a test file changes.
- #73: the title test keeps the `x` run and the no-commit run; a new test in `describe('accord task-done')`,
  `risk:parsing a task number of 0, 01, -1 or 1.5 is refused`, calls the exported `taskNumber` from
  `../src/commands/lane-args.js` for each of `0`, `01`, `-1`, `1.5` and expects a throw of
  `not a task number: <bad>`. Its title holds a comma, so it is run and reported but not named on the `verify:` line.
  The title test's id stays (`accord/tests-baseline.txt:97`). The title test keeps the loop of :189-193 with its
  list cut to `['x']` and the no-commit run of :194-196, so its four assertions keep their text and row #73 needs no
  `maps.json` entry (one new assertion in the `taskNumber` loop could not serve two mapped old ones, Task 37).
- #87: build the add/delete side and the `--no-ff` merge of :233-241 with `write-tree`, `commit-tree` and
  `update-ref HEAD`; assertions unchanged.
- #99: a `makeTemplate()` copy instead of `makeClone`.
- #104 (ST-LN-1 ac-3), #107, #110 (IDS-1 ac-1) are unchanged.

Test first: the #73 risk test.

Must not change: #104, #107, #110 and every other test of the four files.

## Task 18: worktree.test.ts templates, and the pick-up and continue rows of lines 36-182
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/worktree.test.ts#risk:security-a-ticket-id-cannot-place-a-worktree-outside-its-sibling-folder, packages/cli/test/worktree.test.ts#risk:complex-branching-pick-up-refuses-a-ticket-that-origin-main-lacks, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-reaches-a-ticket-whose-file-is-only-on-its-branch-in-the-sibling-worktree, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-reaches-a-ticket-whose-file-is-only-on-a-local-branch-with-no-worktree, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-reaches-a-ticket-whose-branch-is-only-on-origin-and-tracks-it, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-never-claims-a-ticket, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-of-an-id-that-is-no-ticket-names-it-and-creates-nothing, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-prunes-a-worktree-whose-folder-was-deleted-by-hand, packages/cli/test/worktree.test.ts#ac-1-pick-up-adds-the-ticket-worktree-from-origin-main-runs-setup-in-order-and-prints-where-to-continue, packages/cli/test/worktree.test.ts#ac-2-a-failing-setup-command-exits-2-naming-it-and-keeps-the-worktree, packages/cli/test/worktree.test.ts#ac-3-continue-from-another-checkout-reuses-the-worktree-holding-the-branch

Rows: #15, #36, #42, #49, #59, #66, #84, #111.

Consumes: `makeTemplate`, `copyClone`. Produces the file's template wiring, which Tasks 19 to 26 extend:
- `const TEMPLATE_OPTS: Parameters<typeof makeClone>[0][]` listing the opts the template rows use;
  `const TEMPLATES = new Map<string, Clone>()`; `key = (o) => JSON.stringify(o ?? {})`;
  `beforeAll(() => { for (const o of TEMPLATE_OPTS) TEMPLATES.set(key(o), makeTemplate(o)); }, 180_000)`;
  `afterAll(() => { for (const t of TEMPLATES.values()) t.cleanupAll(); })`.
- `copy(opts)`: `copyClone` of `TEMPLATES.get(key(opts))`, throwing `no template for <key>; add it to TEMPLATE_OPTS`
  when missing, pushed to `clones` so `afterEach` removes it. Rows that list H1 use `copy`; the existing `clone`
  stays for every test the table does not list.
- #36 (ST-LN-7 ac-1): `copy`; one `worktree list --porcelain` read serves the checks of :44 and :45 (both assertions
  keep their text over the one read value; any text change gets a `maps.json` entry under `36`).
- #42, #49 (ST-LN-7 ac-2), #59, #66 (ST-LN-7 ac-3, keeps its fetch), #111: `copy`; assertions in place.
- #15: three tests per row #15 (assertions 119-121, 132-135, 146-150 verbatim; the third uses the copy's
  `otherClone`, H2).
- #84: two tests per row #84 (156-157 with 161-164; 159-160 with 161-163). The shared lines 161-163 are made in both
  tests, so the multiset of the old body (one each) is met.

Test first: #42 on `copy`, which proves the wiring on one row; then the rest.

Must not change: `clone`, `afterEach`, the mocks of :11-20, every test the table does not list.

## Task 19: worktree.test.ts hold rows of lines 195-305
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-the-holding-session-re-enters-its-own-hold-and-a-partial-table-refuses, packages/cli/test/worktree.test.ts#risk:complex-branching-a-session-with-the-holding-marker-under-another-pid-re-enters-the-hold, packages/cli/test/worktree.test.ts#risk:complex-branching-a-session-that-cannot-see-itself-in-the-process-table-is-refused-and-the-hold-is-unchanged, packages/cli/test/worktree.test.ts#risk:complex-branching-outside-claude-code-no-hold-is-taken-and-one-line-says-so, packages/cli/test/worktree.test.ts#risk:concurrency-a-locked-hold-file-is-never-overwritten, packages/cli/test/worktree.test.ts#risk:complex-branching-a-worktree-whose-setup-never-finished-reruns-setup-in-full, packages/cli/test/worktree.test.ts#risk:complex-branching-a-hand-made-worktree-with-no-done-marker-reruns-setup-in-full-and-exits-2-on-its-failure, packages/cli/test/worktree.test.ts#risk:complex-branching-a-pick-up-whose-setup-fails-leaves-no-done-marker, packages/cli/test/worktree.test.ts#ac-4-a-live-holder-refuses-a-second-session-and-a-dead-holder-is-taken-over

Rows: #27, #47, #48, #62, #82.

Consumes: Task 18's `copy` and `TEMPLATE_OPTS` (add any opts these rows need). Produces (H7 per the preamble rule,
after the destination's `worktree add ... origin/main`):
- #48 (ST-LN-7 ac-4): `copy`; the pick-up becomes `git worktree add -b t/ST-9 <sibling> origin/main` (H3), then H7;
  199-217 stay; its pick-up exit 0 (197) is made by #36 (`maps.json` entry under `48`, `cite` "made by #36").
- #27: three tests per row #27, each `worktree add` by git, then H7; assertions 232-234 for the first A continue,
  `again(A)` and `again(A2)`; 232-234 for `again(C)`; 242 and 246-248. Each `again(...)` call of the old body, with
  its argument, is made once in its destination; `again` keeps its body.
- #82, #62: `copy`, H3, then H7; #62 keeps the 15 s bound at :278.
- #47: three tests per row #47. The first: `copy` of the two-step setup opts, `worktree add` (H3), then H7;
  290-293. The second (a hand-made worktree with no done marker): `copy` of the failing setup opts, `worktree add`
  (H3), then H7; 300-302. The third (a pick-up whose setup fails): its real pick-up of :296 keeps origin, no H7;
  297-298 plus one `rev-parse`. The pick-up exit 2 (296) is made by #49 (`maps.json` entry under `47`).

Test first: #27's third destination.

Must not change: `A`, `B`, `envOf`, `tableOf`, `setTable`, `holdsFile`, `HELD`, and every unlisted test.

## Task 20: worktree.test.ts clean and claim rows of lines 384-760
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-a-failed-fetch-is-said-and-the-refs-in-the-clone-are-judged, packages/cli/test/worktree.test.ts#risk:complex-branching-clean-with-no-origin-prints-nothing-and-a-failed-fetch-with-no-ticket-branch-prints-only-that, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-unpushed-commits-and-new-files-that-git-status-config-would-hide, packages/cli/test/worktree.test.ts#risk:data-loss-a-failed-push-keeps-the-claim-commit-and-names-the-quoted-push-to-run, packages/cli/test/worktree.test.ts#risk:data-loss-a-holds-file-that-is-not-a-JSON-object-keeps-a-merged-clean-worktree-and-clean-exits-0, packages/cli/test/worktree.test.ts#risk:complex-branching-pick-up-refuses-a-branch-another-person-claimed, packages/cli/test/worktree.test.ts#risk:complex-branching-pick-up-reuses-a-branch-claimed-by-the-same-email, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-opens-a-ticket-another-person-claimed-and-a-later-pick-up-still-refuses, packages/cli/test/worktree.test.ts#ac-5-bare-accord-fetches-then-removes-merged-worktrees-and-names-what-it-keeps, packages/cli/test/worktree.test.ts#ac-1-bare-accord-deletes-merged-ticket-branches-with-or-without-a-worktree-and-names-the-checked-out-one-it-keeps

Rows: #34, #50, #56, #72, #75, #77, #113.

Consumes: `copy`, `doneOnRemote` (:340), `mergeOnRemote`. Produces:
- #56 (ST-LN-7 ac-5, kept, ceiling 18 s): `copy`; `doneOnRemote` pushes all its branches in one `git push` (the
  same refs result; every caller of `doneOnRemote` gets it, and no caller's assertion changes).
- #72 (ST-LN-20 ac-1, kept, ceiling 13 s): `copy`; one push for the three ticket branches; H5 not taken.
- #50 (kept, ceiling 18 s): `copy`; no split (the two-branch clean of 446-460 and the d clone stay).
- #75: two tests per row #75. #77: two tests per row #77 (its first title holds commas: run, not named above).
- #34: six tests per row #34, each pushing only the branches it needs; in the last, `entries` length 3 becomes 2
  (no ST-10 worktree; one `maps.json` entry under `34`, `cite` "`entries` length 3 becomes 2") and it still asserts
  the refusal adds no worktree. Lines 715-720 are made twice (ST-11, ST-12); the old body made them once, so the
  second set needs no entry.
- #113: `copy`, no H7 (it must keep origin); assertions in place.

Test first: #75's second destination.

Must not change: `ticketWorktree`, `mergeOnRemote`, `doneTicket`, `ticketBranch`, the end state `doneOnRemote`
leaves, and every unlisted test.

## Task 21: worktree.test.ts Claude Code session rows of lines 947-1160
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-worktree-pinned-to-another-accord-version-refuses-before-setup-and-prints-no-enter, packages/cli/test/worktree.test.ts#risk:complex-branching-outside-claude-code-a-worktree-pinned-to-another-accord-version-still-prints-the-stop-lines, packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-pick-up-whose-origin-main-pins-another-version-refuses-and-names-the-main-checkout, packages/cli/test/worktree.test.ts#ac-1-in-claude-code-pick-up-from-the-main-checkout-takes-the-hold-and-prints-enter-instead-of-stop, packages/cli/test/worktree.test.ts#ac-2-in-claude-code-continue-from-the-main-checkout-enters-a-claimed-worktree-whose-session-ended-with-or-without-a-worktree-here, packages/cli/test/worktree.test.ts#ac-4-in-claude-code-a-session-that-works-a-ticket-refuses-other-tickets-and-new-tickets-and-changes-nothing, packages/cli/test/worktree.test.ts#ac-5-outside-claude-code-pick-up-continue-and-new-ticket-print-the-stop-lines-and-nothing-is-refused

Rows: #18, #52, #80, #86, #97.

Consumes: `copy`. Produces:
- #97 (ST-LN-27 ac-1): `copy`; the 962 continue run is dropped (its HELD check is made by #27's title test:
  `maps.json` entry under `97`, `cite` "962 (HELD) is made by #27's title test"); 951-961 stay.
- #80 (ST-LN-27 ac-2, kept, ceiling 12 s): `copy`, H2, H3 (the pick-up becomes `worktree add`; 967 was not asserted).
- #86: three tests per row #86 (998-1002; 1004-1005; 1015-1021).
- #18 (ST-LN-27 ac-4, kept, ceiling 32 s): `copy` only; no split; the pick-up run (1071) stays.
- #52 (ST-LN-27 ac-5, kept, ceiling 18 s): `copy` (H6 by the template).

Test first: #86's second destination. The four criterion tests must pass with every assertion line unchanged.

Must not change: `C`, `C3`, `WORKS`, and every unlisted test.

## Task 22: worktree.test.ts session and hold rows of lines 1163-1411
covers: D-05, D-11
files: packages/cli/test/worktree.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-a-claude-code-session-that-sets-no-session-variables-keeps-the-main-checkout-flows-and-only-the-folder-rule-refuses-it, packages/cli/test/worktree.test.ts#risk:complex-branching-a-claude-code-session-without-session-variables-gets-the-stop-lines-from-a-new-worktree-ticket, packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-pick-up-whose-setup-failed-still-holds-its-ticket-and-refuses-a-second-one, packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-continue-after-a-failed-pick-up-setup-reruns-setup-and-is-not-refused, packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-new-ticket-whose-push-failed-still-holds-it-and-refuses-a-second-one, packages/cli/test/worktree.test.ts#risk:data-loss-clean-removes-a-held-done-worktree-and-its-hold-and-keeps-the-worked-record, packages/cli/test/worktree.test.ts#risk:complex-branching-a-session-whose-hold-was-cleaned-or-taken-over-still-works-its-ticket-when-resumed-in-the-main-checkout, packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-pick-up-records-the-session-as-working-its-ticket, packages/cli/test/worktree.test.ts#risk:complex-branching-a-session-recorded-as-working-a-ticket-whose-worktree-is-gone-is-refused-other-tickets-in-the-main-checkout

Rows: #24, #58, #88, #89.

Consumes: `copy`, `writeHolds`, `readHolds`, `LIVE`, `DEAD`. Produces (H7 per the preamble rule):
- #88: two tests per row #88; the first keeps the refusal from the ST-9 worktree the pick-up made.
- #58: three tests per row #58. The first (a pick-up whose setup failed, 1190-1202): its real pick-up of :1189
  pushes the claim, so it keeps origin, no H7. The second (a continue after a failed pick-up setup, 1204-1206): the
  ST-9 worktree by `worktree add` (H3) and hold A by fs, then H7. The third (a new ticket whose push failed,
  1212-1219): its push URL set to `<remote>-missing` (:1209) is the case, so it keeps origin, no H7.
- #24: four tests per row #24 (H2, H3). The first (clean of a held done worktree, 1311-1315): it pushes (:1307) and
  `doneOnRemote` and clean fetch, so it keeps origin, no H7. The second (the worked file only, 1318-1325): worked
  file and holds written by fs, then H7. The third (a hold taken over, 1333-1349): the ST-10 worktree by
  `worktree add` (H3) and hold C by fs, then H7. The fourth is new (1305: worked is `ST-9\tsess-A` after a pick-up):
  its real pick-up keeps origin, no H7. The dropped CLI checks are made by #97 (1302-1303, 1329-1330) and #27's title
  test (1304): one `maps.json` entry under `24` each, `cite` "1302-1303 and 1329-1330 are made by #97" or
  "1304 (HELD) by #27's title test".
- #89: two tests per row #89 (1363-1393; 1397-1410 with the worked file and LIVE hold written by fs).
  `requestLatest` and `cachePath` are already mocked for every CLI test by `packages/cli/test/setup.ts:7-16`; the
  first test also sets `LOCALAPPDATA` and `XDG_CACHE_HOME` to a temp folder with `vi.stubEnv` and restores them with
  `vi.unstubAllEnvs()`, as the row asks.

Test first: #89's second destination.

Must not change: every unlisted test (including the BUG-LN-9 resume hook test at :1270), the hook and hold helpers.

## Task 23: worktree.test.ts dropped-ticket clean rows of lines 1449-1669
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-dropped-ticket-whose-origin-branch-has-commits-not-here-or-has-diverged, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-dropped-ticket-whose-local-and-origin-branches-have-diverged, packages/cli/test/worktree.test.ts#risk:data-loss-clean-deletes-a-dropped-ticket-branch-that-exists-on-one-side-only-when-nothing-is-lost, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-everything-of-a-dropped-ticket-that-a-guard-keeps-or-whose-worktree-remove-fails, packages/cli/test/worktree.test.ts#risk:data-loss-a-second-clone-deletes-its-local-branch-of-a-dropped-ticket-another-clone-cleaned, packages/cli/test/worktree.test.ts#risk:data-loss-a-second-clone-keeps-its-local-branch-of-a-cleaned-dropped-ticket-that-has-commits-not-on-origin, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-the-local-branch-of-a-dropped-ticket-that-moved-after-clean-read-it, packages/cli/test/worktree.test.ts#risk:complex-branching-pick-up-refuses-a-ticket-the-default-branch-holds-as-dropped, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-still-opens-a-ticket-the-default-branch-holds-as-dropped, packages/cli/test/worktree.test.ts#ac-3-clean-deletes-the-worktree-and-both-branches-of-a-ticket-dropped-on-the-default-branch, packages/cli/test/worktree.test.ts#ac-4-clean-keeps-a-dropped-ticket-whose-local-branch-has-commits-not-on-origin

Rows: #45, #67, #92, #93, #98, #101, #103, #105.

Consumes: `copy`, `claimWorktree`, `dropOnRemote`, `dropAndMerge`, `has`. Produces:
- #105 (ST-LN-34 ac-3): `copy`; one real `accord drop` then `accord worktree clean` stays; H3 and H5 not taken.
- #103 (ST-LN-34 ac-4): `copy`; H3 `dropOnRemote(c, ['ST-10'])` in place of the `await dropAndMerge(c, 'ST-10');`
  call (:1467); 1469-1473 stay. That call is an assertion of the old body (`dropAndMerge` holds the drop exit 0
  check, :1443), so it gets one `maps.json` entry under `103`:
  `{ "old": "dropAndMerge(c, 'ST-10');", "test": "packages/cli/test/worktree.test.ts#ac-3-clean-deletes-the-worktree-and-both-branches-of-a-ticket-dropped-on-the-default-branch", "cite": "is made by #32 and by #105" }`
  (#105 keeps its real `dropAndMerge` call, so its test still asserts the drop exit 0).
- #101: two tests per row #101 (1486 first, 1489 second, 1490-1492 in both).
- #93, #92: `copy`, no split (one clean at :1509 judges ST-9 to ST-11, and the 4-branch clean at :1531, stay whole).
- #67: two tests per row #67; c's clean becomes `git push origin --delete t/ST-9` (1601-1602 are made by #105:
  `maps.json` entries under `67`, `cite` "1601-1602 (c's clean exits 0 and deletes the origin branch) is made by
  #105").
- #98: `copy`. #45: three tests per row #45 (1657-1661; 1662-1665; 1666-1668).

Test first: #101's second destination.

Must not change: `has`, `claimWorktree`, `dropOnRemote`, `dropAndMerge`, every unlisted test.

## Task 24: worktree.test.ts fetch and merge rows of lines 1680-1864
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-worktree-merge-refuses-a-ticket-before-verify-and-merges-nothing, packages/cli/test/worktree.test.ts#risk:complex-branching-worktree-merge-refuses-on-a-branch-other-than-the-ticket's-and-merges-nothing, packages/cli/test/worktree.test.ts#risk:complex-branching-worktree-merge-refuses-over-tracked-changes-and-merges-nothing, packages/cli/test/worktree.test.ts#ac-1-pick-up-and-a-new-worktree-ticket-cut-the-ticket-branch-from-a-main-commit-this-clone-had-not-fetched, packages/cli/test/worktree.test.ts#ac-3-worktree-merge-at-verify-gives-the-ticket-branch-a-merge-commit-of-its-head-and-the-fetched-main-commit, packages/cli/test/worktree.test.ts#ac-4-a-merge-conflict-is-aborted-names-the-file-exits-2-and-the-next-merge-tries-again

Rows: #65, #70, #76, #85.

Consumes: `copy`, `pushNext`, `verifyStage`, `pushMain`. Produces:
- #65 (ST-LN-30 ac-1, kept, ceiling 14 s), #85 (ST-LN-30 ac-3, kept, ceiling 11 s), #76 (ST-LN-30 ac-4, kept,
  ceiling 12 s): `copy` (H2, H6 by the template); no part moved; every assertion in place.
- #70: three tests per row #70 (1835-1839, 1847-1850, 1860-1863).

Test first: #70's first destination.

Must not change: `pushNext`, `verifyStage`, `pushMain`, every unlisted test.

## Task 25: worktree.test.ts merge and continue rows of lines 1866-2166
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/worktree.test.ts#risk:data-loss-worktree-merge-never-overwrites-an-ignored-file-and-quotes-the-git-error-that-stopped-it, packages/cli/test/worktree.test.ts#risk:data-loss-worktree-merge-never-overwrites-an-ignored-file-that-a-rename-on-main-targets, packages/cli/test/worktree.test.ts#risk:data-loss-worktree-merge-names-a-non-ASCII-ignored-file-it-would-overwrite, packages/cli/test/worktree.test.ts#risk:complex-branching-worktree-merge-takes-a-case-only-rename-on-main-of-a-tracked-file, packages/cli/test/worktree.test.ts#risk:regression-worktree-merge-of-a-main-that-adds-500-long-paths-passes-the-Windows-command-line-limit, packages/cli/test/worktree.test.ts#risk:data-loss-a-continue-merge-that-conflicts-is-aborted-names-the-file-and-pushes-nothing, packages/cli/test/worktree.test.ts#risk:data-loss-continue-does-not-merge-into-a-worktree-with-uncommitted-changes-and-says-it-is-behind, packages/cli/test/worktree.test.ts#risk:data-loss-continue-does-not-merge-into-a-worktree-a-live-session-holds-and-says-it-is-behind, packages/cli/test/worktree.test.ts#risk:data-loss-continue-does-not-merge-into-a-branch-whose-origin-copy-has-a-teammate-commit-and-pushes-nothing, packages/cli/test/worktree.test.ts#ac-5-a-failed-or-silent-fetch-is-one-accord-line-at-pick-up-new-ticket-continue-and-merge-and-the-work-goes-on, packages/cli/test/worktree.test.ts#ac-4-continue-merges-the-latest-origin-main-into-a-ticket-branch-before-verify-runs-setup-on-the-merge-and-pushes-it

Rows: #21, #26, #38, #55.

Consumes: `copy`, `pushMain`, `verifyStage`. Produces:
- #21: five tests per row #21 (1879-1884, 1900-1903, 1918-1921, 1936-1938, 1954-1956 verbatim; the last with fs
  writes); the first keeps the title (block c).
- #26: four tests per row #26 (2105-2113, 2131-2135, 2144-2148, 2161-2165).
- #38 (ST-LN-30 ac-5, kept, ceiling 22 s): `copy` (H6 by the template); every assertion in place.
- #55 (ST-LN-25 ac-4, kept, ceiling 18 s): `copy`, H2; no part moved; H7 not used (the scenario names the fetch).

Test first: #21's third destination.

Must not change: every unlisted test.

## Task 26: worktree.test.ts done-ticket clean rows of lines 2168-2380
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/worktree.test.ts#risk:data-loss-clean-removes-only-a-done-ticket-and-keeps-a-branch-with-a-commit-after-its-verified-commit, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-done-ticket-branch-that-a-stopped-rebase-in-its-worktree-is-rebuilding, packages/cli/test/worktree.test.ts#risk:data-loss-clean-deletes-a-done-lane-S-branch-with-no-verified-commit-only-when-its-merge-into-main-changes-nothing, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-done-lane-S-branch-whose-merge-into-main-conflicts, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-done-lane-S-origin-branch-whose-merge-into-main-conflicts, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-done-ticket-branch-whose-commit-after-verify-conflicts-with-main, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-an-origin-branch-whose-lease-is-stale-and-names-the-failed-push, packages/cli/test/worktree.test.ts#risk:data-loss-clean-after-a-failed-fetch-deletes-the-local-branch-and-never-the-origin-branch, packages/cli/test/worktree.test.ts#risk:data-loss-clean-deletes-no-origin-branch-that-the-prune-already-removed, packages/cli/test/worktree.test.ts#ac-5-clean-pick-up-continue-and-a-new-worktree-ticket-remove-the-worktree-and-both-branches-of-a-done-ticket

Rows: #5, #14, #31.

Consumes: `copy`, `copyClone`, `doneOnRemote`, `laneSBranch` (:2170, used by #5 only), `gateReadyIn`, `P`.
Produces:
- `laneSBranch`: the `gate ready` run (:2175) becomes core: read the sibling's `accord/config.yml` and ticket into a
  files map, `expect(gateReadyIn(files, id)).toBe('pass')`, write the ticket back. Its signature (async, returning
  the review commit) stays, and its body still holds `expect(`, so it stays an assertion helper. Row #5's assertions
  are its `laneSBranch(...)` call statements (:2228, :2229, :2261), never the `expect` inside the helper, and each
  call keeps its text (variable names included), so row #5 writes no `maps.json` entry for it. The CLI `gate ready`
  exit 0 the helper no longer makes is made by #63, as row #5's note says.
- #5: six tests per row #5. The first keeps the title and block c whole (ST-9, ST-10 merged and not done, ST-11 in
  one clean, with the ordered `toEqual` at 2192-2197 and the checks of 2198-2203); the third is block f whole (ST-12
  and ST-13 in one clean, r3's 4-line `toEqual` at 2248-2253); block g split per clean. Assertion map per row #5.
- #31: three tests per row #31 (2320-2326, 2335-2339, 2347-2350).
- #14 (ST-LN-25 ac-5, kept, ceiling 39 s): the done-ST-9 state is built once in the test with no linked worktree,
  then `copyClone` of it for each outline row, with `worktree add` in each copy; every assertion in place.

Test first: #5's second destination, then the first (the multi-branch guard of rule 5).

Must not change: `REVIEWED`, every unlisted test, including
`risk:complex-branching pick up and continue never clean the ticket they open`.

## Task 27: The rows that take no change still pass untouched
covers: D-05, D-06, D-11
files: packages/cli/test/trailers.test.ts, packages/cli/test/gate.test.ts, packages/core/test/benchmark-worktree.test.ts, packages/core/test/benchmark-samples.test.ts, packages/cli/test/skills-sync.test.ts, packages/cli/test/tracker.test.ts
verify: packages/core/test/benchmark-worktree.test.ts#risk:regression-a-suite-that-fails-once-and-passes-on-its-re-run-does-not-stop---plan-and-the-re-run-is-recorded, packages/core/test/benchmark-worktree.test.ts#risk:regression-a-suite-that-fails-on-its-re-run-too-is-red, packages/core/test/benchmark-samples.test.ts#risk:data-loss-a-sample-snapshot-keeps-the-dispatch-and-every-named-file-and-is-never-overwritten

Rows: #8, #11, #16, #22, #23, #25, #29, #33, #37, #100, #108, #112.

These rows are kept with no cut (#8 ST-LN-8 ac-3, #25 ST-LN-8 ac-4, and the seven benchmark rows, whose only lever is a
script change, D-11) or unchanged (#100, #108, #112). Nothing is edited: the files are on the `files:` line only so
the task may confirm them. Run `git diff 1cec2ac130d8d34c4dcdadddfee9effb4d1104e9 -- <each file>` and confirm it is
empty, then run the six files and report each row's alone time and, for kept rows, its ceiling (#8 49 s, #25 27 s,
#11 44 s, #16 33 s, #22 30 s, #23 28 s, #29 26 s, #33 25 s, #37 23 s). A non-empty diff is reported, not reverted.

Must not change: any of the six files.

## Task 28: Audit the assertion maps of the rows of Tasks 6 to 9
covers: D-05, D-07
files: packages/cli/test/show-approval.test.ts, packages/cli/test/workflow-script.test.ts, packages/cli/test/lane-s.test.ts, packages/cli/test/after-verify.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/show-approval.test.ts#ac-1-every-scenario-of-every-real-ticket-is-rebuilt-exactly-from-the-approval-view, packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-risk:parsing-BOM-and-CRLF-frontmatter-and-unreadable-blocks-and-large-files-read-as-approved, packages/cli/test/lane-s.test.ts#risk:complex-branching-lane-S-gate-done-passes-a-reviewed-change, packages/cli/test/after-verify.test.ts#risk:complex-branching-the-commits-after-verify-come-from-the-ticket-tip-in-graph-order

Rows: none (it audits rows #1, #2, #3, #4, #6, #9, #17, #20, #35, #57, #69, #83, #96, built by Tasks 6 to 9; #63,
#102 and #109 take no change).

Run the audit procedure of the preamble over these rows. Row #1 is the row whose per-id checks are `bad.push`
conditions (show-approval.test.ts:139-149): check the per-id exit 0 became the load finding check of the core loop,
the rebuild checks moved to the core loop, and the one CLI run on ST-LN-19 makes its exit 0 and rebuild-equal check.
Moved rows here: #3 (14 destinations), #4 (7), #20 (4).

## Task 29: Audit the assertion maps of the rows of Tasks 10 to 13
covers: D-05, D-07, D-12
files: packages/cli/test/drop.test.ts, packages/cli/test/upgrade.test.ts, packages/cli/test/hook.test.ts, packages/cli/test/dashboard.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/drop.test.ts#risk:complex-branching-drop-reads-a-local-claim-tip-ahead-of-origin, packages/cli/test/upgrade.test.ts#risk:data-loss-upgrade-refuses-and-pushes-nothing-when-the-pin-is-not-older, packages/cli/test/upgrade.test.ts#risk:complex-branching-an-anchored-lint-and-gate-step-is-only-repinned-and-the-warning-says-it-must-be-a-block-list-item, packages/cli/test/hook.test.ts#risk:security-the-prompt-expansion-hook-blocks-continue-and-pick-up-of-other-tickets-in-the-ticket-worktree, packages/cli/test/dashboard.test.ts#risk:complex-branching-a-dependency-done-only-on-its-claim-branch-still-blocks-its-dependent

Rows: none (it audits rows #7, #12, #13, #19, #28, #32, #39, #40, #41, #51, #53, #54, #68, #71, #74, #78, #79, #81,
#90, #91, #114, #115, #116, #117, #118, built by Tasks 10 to 13).

Run the audit procedure of the preamble over these rows. Moved rows here: #7 (5 destinations), #13 (4, with every
`refused(...)`/`noBranch()` call), #19 (4, with every `blocked(...)` call), #39 (4), #51 (2), #54 (2), #79 (2), #115
(3, with every `onlyRepinned(...)` call and the alias destination's `expect(base).toContain(env);`). For #68, check
each rewritten `upgradeNotice` assertion checks the value its dashboard run checked. For #114 to #118, also check
each test takes its clone from `copyClone` of the plain template with its other clone, and #117's pre-receive hook is
written into the copy's own `c.remote` (rule 5).

## Task 30: Audit the assertion maps of the rows of Tasks 14 to 17
covers: D-05, D-07
files: packages/cli/test/show.test.ts, packages/cli/test/status.test.ts, packages/cli/test/lane-flow.test.ts, packages/core/test/benchmark-compliance.test.ts, packages/cli/test/lane-commands.test.ts, packages/cli/test/new-ticket.test.ts, packages/cli/test/bin.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/show.test.ts#risk:complex-branching-show-takes-blockers-from-the-checkout-not-the-claim-branch, packages/cli/test/status.test.ts#risk:complex-branching-a-merged-or-checked-out-or-ticketless-claim-branch-keeps-the-checkout-copy, packages/cli/test/lane-flow.test.ts#lane-ticket-flow->-risk:complex-branching-gate-ready-passes-only-after-approve-and-gate-plan-passes-on-a-plan-against-HEAD, packages/cli/test/new-ticket.test.ts#risk:complex-branching-a-ticket-added-and-deleted-on-a-merged-and-deleted-branch-keeps-its-number

Rows: none (it audits rows #10, #30, #43, #44, #46, #60, #61, #64, #73, #87, #95, #99, built by Tasks 14 to 17; #94,
#104, #106, #107 and #110 take no change).

Run the audit procedure of the preamble over these rows. Moved rows here: #10 (4 destinations), #30 (2), #60 (2),
#64 (2), and #73's CLI checks that move to its new `taskNumber` test.

## Task 31: Audit the assertion maps of the worktree.test.ts rows of Tasks 18 to 20
covers: D-05, D-07
files: packages/cli/test/worktree.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/worktree.test.ts#risk:security-a-ticket-id-cannot-place-a-worktree-outside-its-sibling-folder, packages/cli/test/worktree.test.ts#risk:complex-branching-the-holding-session-re-enters-its-own-hold-and-a-partial-table-refuses, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-unpushed-commits-and-new-files-that-git-status-config-would-hide

Rows: none (it audits rows #15, #27, #34, #36, #42, #47, #48, #49, #50, #56, #59, #62, #66, #72, #75, #77, #82, #84,
#111, #113, built by Tasks 18 to 20).

Run the audit procedure of the preamble over these rows; their old tests sit in lines 36 to 760 of the old file
(read a helper outside that range only when an assertion calls it). Moved rows here: #15 (3 destinations), #27 (3,
with every `again(...)` call), #34 (6), #47 (3), #75 (2), #77 (2), #84 (2).

## Task 32: Audit the assertion maps of the worktree.test.ts rows of Tasks 21 to 23
covers: D-05, D-07
files: packages/cli/test/worktree.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-outside-claude-code-a-worktree-pinned-to-another-accord-version-still-prints-the-stop-lines, packages/cli/test/worktree.test.ts#risk:data-loss-clean-removes-a-held-done-worktree-and-its-hold-and-keeps-the-worked-record, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-dropped-ticket-whose-local-and-origin-branches-have-diverged

Rows: none (it audits rows #18, #24, #45, #52, #58, #67, #80, #86, #88, #89, #92, #93, #97, #98, #101, #103, #105,
built by Tasks 21 to 23).

Run the audit procedure of the preamble over these rows; their old tests sit in lines 947 to 1669 of the old file
(read a helper outside that range only when an assertion calls it). Moved rows here: #24 (4 destinations), #45 (3),
#58 (3), #67 (2), #86 (3), #88 (2), #89 (2), #101 (2). For #103, check its `dropAndMerge(c, 'ST-10');` entry names
#105's test and that test still calls `dropAndMerge`.

## Task 33: Audit the assertion maps of the worktree.test.ts rows of Tasks 24 to 26
covers: D-05, D-07
files: packages/cli/test/worktree.test.ts, packages/core/test/fixtures/st-ln-44/maps.json (new)
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-worktree-merge-refuses-a-ticket-before-verify-and-merges-nothing, packages/cli/test/worktree.test.ts#risk:data-loss-a-continue-merge-that-conflicts-is-aborted-names-the-file-and-pushes-nothing, packages/cli/test/worktree.test.ts#risk:data-loss-clean-removes-only-a-done-ticket-and-keeps-a-branch-with-a-commit-after-its-verified-commit

Rows: none (it audits rows #5, #14, #21, #26, #31, #38, #55, #65, #70, #76, #85, built by Tasks 24 to 26).

Run the audit procedure of the preamble over these rows; their old tests sit in lines 1680 to 2380 of the old file
(read a helper outside that range only when an assertion calls it). Moved rows here: #5 (6 destinations, with every
`laneSBranch(...)` call), #21 (5), #26 (4), #31 (3), #70 (3).

## Task 34: The table, junit and assertion parsers, the rule 3 tool and the frozen approved table
covers: D-01, D-03, D-05, D-07, D-13
files: packages/core/test/helpers/st-ln-44.ts (new), packages/core/test/st-ln-44.test.ts (new), packages/core/test/fixtures/st-ln-44/table-approved.md (new)
verify: packages/core/test/st-ln-44.test.ts#risk:parsing-table.md-parses-to-rows-1-to-118-and-the-keep-syntax-of-rule-3-parses-without-changing-them, packages/core/test/st-ln-44.test.ts#risk:parsing-junit-cases-are-read-with-file-title-time-and-status-and-their-text-unescaped, packages/core/test/st-ln-44.test.ts#risk:complex-branching-the-rule-3-list-stops-on-a-test-over-10-s-that-is-not-kept-and-on-a-kept-test-over-its-ceiling, packages/core/test/st-ln-44.test.ts#risk:parsing-assertions-are-a-multiset-of-expect-statements-and-local-assertion-helper-calls

Rows: none (the tools the ac tests and rule 3 use over all 118 rows).

The helper module is test code (D-11 forbids product and `scripts/` code; the ST-LN-48 precedent keeps such code
under `packages/core/test/`). It is TypeScript with erasable syntax only (no enum, namespace or parameter property),
imports only `node:fs`, `node:path`, `node:url` and `node:process`, so `node --experimental-strip-types` runs it as a
script and vitest imports it as `./helpers/st-ln-44.js`. A header comment says it serves ST-LN-44's criteria and the
rule 3 check, and is deleted with `packages/core/test/st-ln-44.test.ts` and `packages/core/test/fixtures/st-ln-44/`
once the ticket is done.

Produces, exported from `packages/core/test/helpers/st-ln-44.ts`:
- `ROOT = new URL('../../../../', import.meta.url)`; `TABLE = new URL('accord/tickets/ST-LN-44/table.md', ROOT)`.
- `interface Case { file: string; title: string; time: number; status: 'passed' | 'failed' | 'skipped' }` and
  `cases(xml: string): Case[]`: every `<testcase ...>` of a junit text: `classname` is `file`, `name` is `title`
  (describe titles and the `it` title joined by ` > `), both XML-unescaped (`&lt;`, `&gt;`, `&quot;`, `&apos;`,
  `&#10;`, `&amp;` last); `time` the number of its `time` attribute; `status` is `failed` when the element holds
  `<failure` or `<error`, `skipped` when it holds `<skipped`, `passed` otherwise.
- `idOf(file, title)`: `file + '#' + title.replace(/\s+/g, '-')`, the report id.
- `interface Dest { file: string; title: string; ceiling?: number }`; `interface Row { n: number; file: string;
  title: string; tag: string; action: string; how: string; destinations: Dest[]; note: string; ceiling?: number }`;
  `rows(table: string): Row[]`: every line matching `^\| \d+ \| `; the text between the leading `| ` and the trailing
  ` |`, split on ` | `; the first eight parts are `n`, `file` (`'packages/' + part`), `title`, `tag`, `action`, `how`,
  `destinations`, `expected`; the rest joined with ` | ` is `note`; `ceiling` is the number of the first
  `Ceiling (\d+) s` in the note. `destinations`: `-` is `[]`; otherwise split on `<br>`, each split on ` :: `: two
  parts are `{ file, title }`; three parts whose third matches `^kept (\d+) s$` are `{ file, title, ceiling }` (row
  #115's three destinations carry ` :: kept 29 s` in the approved table, D-13); any other entry throws
  `table row <n>: bad destination "<entry>"`.
- `tableProblems(rs: Row[]): string[]`: rows 1 to 118 each present exactly once; every row numbered above 118 is
  numbered 119 upward without a gap, has action `kept`, no destinations, and a ceiling; every `kept` row has a
  ceiling; every action is one of `faster`, `moved`, `merged`, `removed`, `kept`, `unchanged`; every `moved` or
  `merged` row has a destination. One message per problem.
- `interface Entry { n?: number; file: string; title: string; action: string; time: number; ceiling?: number; stop: boolean }`;
  `rule3(rs: Row[], cs: Case[]): Entry[]`, rule 3 of table.md over one run, sorted by time, slowest first. Each case
  is matched by `file` and `title` to a destination of a `moved` or `merged` row (action `destination`, or `kept
  destination` with that destination's ceiling), else to a row's own test (that row's action and, for `kept`, its
  ceiling), else it is `outside`. A matched case is listed when its time is over 5 s; it stops (`stop: true`) when
  its time is over its ceiling for a kept row or kept destination, and over 10 s for any other. An `outside` case is
  listed, with `stop: true`, when over 10 s.
- `listText(es: Entry[]): string`: one line per entry, `- #<n or -> <file> > <title>: <time> s, <action>[, ceiling
  <N> s][, STOP]`; `No entry.` for none; LF, ending in a newline.
- `body(source: string, title: string): string | undefined`: the text of the test whose last ` > ` segment of
  `title` appears as a quoted string at an `it(` call (`it('`, `it("`, `` it(` ``, or `it.<modifier>(...)('`), from
  that line to the first line after it that starts with the same indentation followed by `})` or `}, `.
- `helpersOf(source: string): string[]`: the names of every `function <name>(` and every
  `const <name> = (async )?(<params>) =>` or `const <name> = (async )?<param> =>` in the source whose declaration text
  (read with the bracket counter below to the end of its statement) holds `expect(`.
- `asserts(text: string, helpers: string[]): string[]`: with every helper declaration's text removed first, every
  statement starting at `expect(` or at `<helper>(` (the name not preceded by a letter, digit, `_`, `$` or `.`), read
  with a bracket counter that skips quoted strings and template literals up to its closing `;` (or the end of the
  line when the counter is back to zero and no `;` follows), every run of whitespace turned into one space; scanning
  resumes after each statement, so a helper call inside an `expect(` is not counted twice. Repeats are kept: the
  result is a multiset.
- A script entry, run when `process.argv[1]` is this file:
  `node --experimental-strip-types packages/core/test/helpers/st-ln-44.ts <junit> [--out <file>] [--verify]` reads
  the junit and `TABLE`, exits 2 with the message on an unreadable file or any `tableProblems`, writes
  `listText(rule3(...))` (with `--verify`, only the `stop` entries) to `--out` (UTF-8, LF; the file is written by
  Node, never by a shell redirect) or to stdout, and exits 1 when any entry stops, 0 otherwise.

The approved table, frozen: `packages/core/test/fixtures/st-ln-44/table-approved.md` holds the bytes of
`git show 36be029295a5e602ee4796c54ec40814267c33a9:accord/tickets/ST-LN-44/table.md` (the approval commit of the
118-row table, after the baseline: the table at `<BASE>` predates rows 114-118), written by Node (`execFileSync`
output passed to `writeFileSync`), never by a shell redirect. Before writing the test, compute its sha256; when it is
not `b6e47395c1fbbc6b4ed76fcc39e6753b59afbfca04b8adc09ffcacb3f28d9bbc`, the hash `## Approach` records, stop and
report `BLOCKED` with both hashes. The frozen copy is what lets this test prove the approved table parses fully even
when a late keep of rule 3 edits the live `table.md`; it needs no git history, so it also runs in CI's shallow clone.

Tests first, in the new `packages/core/test/st-ln-44.test.ts` (imports: `node:fs`, `node:crypto`, `vitest`,
`./helpers/st-ln-44.js`), each top-level with its exact title:
- `it('risk:parsing table.md parses to rows 1 to 118 and the keep syntax of rule 3 parses without changing them')`:
  - The approved table: `approvedText` is the fixture `table-approved.md` read through
    `new URL('./fixtures/st-ln-44/table-approved.md', import.meta.url)`; its sha256 (`createHash('sha256')` over
    the file's bytes) is the hash above. `approved = rows(approvedText)` has 118 rows numbered 1 to 118,
    `tableProblems(approved)` is `[]`, 33 rows are `kept` and each has a ceiling, row 2's ceiling is 106, row 114's is
    83, row 117's is 29, and row 115 is `moved` with three destinations, each with ceiling 29.
  - The live table: `live = rows(readFileSync(TABLE, 'utf8'))`; `tableProblems(live)` is `[]`; for each `n` from 1 to
    118 the live row has the approved row's `file` and `title`, and the same destination files and titles in the
    same order. A late keep written with main-session step 2's syntax changes only an action, a note, a destination's
    ceiling, or appends rows from 119, so this part stays green after it.
  - The keep syntax, on `approvedText` with three edits: row 3's first destination given ` :: kept 12 s`, row 6's
    action `faster` changed to `kept` with `Ceiling 9 s.` prefixed to its note, and the row
    `| 119 | cli/test/sandbox-guard.test.ts | risk:data-loss a template copy pushes to its own origin and matches a
    clone built the same way | - | kept | - | - | - | Ceiling 14 s. Reason. |` appended after row 118: it parses to
    119 rows with no problem, row 3's first destination has ceiling 12, row 6 is kept with ceiling 9, row 119 is kept
    with ceiling 14. A destination `a :: b :: c` throws; a row 121 appended after 119 is a problem (a gap).
- `it('risk:parsing junit cases are read with file title time and status and their text unescaped')`: a three-case
  junit text (a passed case whose name holds `&amp;` and `&gt;`, a failed one with `<failure`, a skipped one) reads
  to the three cases with the unescaped titles, times and statuses; `idOf` of a title with two spaces and ` > `
  gives one `-` per run and `->-`.
- `it('risk:complex-branching the rule 3 list stops on a test over 10 s that is not kept and on a kept test over its ceiling')`:
  over three hand-made rows (a faster row, a kept row with ceiling 20, a moved row with one plain destination and one
  ` :: kept 15 s` destination) and cases at 4, 7, 11, 19, 21, 14 and 16 s plus an outside case at 12 s: the 4 s
  case is not listed; 7 s on the faster row is listed, not stopping; 11 s on it stops; 19 s on the kept row is
  listed, not stopping; 21 s stops; 14 s on the kept destination does not stop and 16 s does; 12 s outside stops.
  `listText([])` is `No entry.\n`.
- `it('risk:parsing assertions are a multiset of expect statements and local assertion-helper calls')`: a source
  with `const refused = async (t: string) => { expect(1).toBe(1); };` and a test body calling `await refused('a')`
  twice, `refused('b')` once and `expect(x).toBe(2)` spread over two lines: `helpersOf` is `['refused']`; `asserts`
  of the body is `["refused('a');", "refused('a');", "refused('b');", 'expect(x).toBe(2);']` in source order, and
  holds no `expect(1)` from the declaration.

Must not change: every other test, fixture and helper; `stage-baseline.test.ts`.

## Task 35: The measuring run, committed with its rule 3 list, and the ac-1 test that reads it
covers: @ac-1, D-02, D-03, D-06
files: packages/core/test/fixtures/st-ln-44/after-junit.xml (new), packages/core/test/fixtures/st-ln-44/rule3-list.md (new), packages/core/test/st-ln-44.test.ts (new)
verify: packages/core/test/st-ln-44.test.ts#ac-1-no-test-in-the-measuring-run-takes-over-10-s-apart-from-a-kept-test-within-its-ceiling (@ac-1)

Rows: none (rule 3's measuring run over all 118 rows).

Precondition: Tasks 1 to 34 are done and the main session has done Main session step 1
(`accord/tests-baseline.txt`). No merge of origin/main into `t/ST-LN-44` lands before this task is recorded (Main
session step 4).

Run, once, from PowerShell:
`$env:ACCORD_BASH = 'C:\Program Files\Git\bin\bash.exe'`, `npm run build`, then the configured full run
`npx vitest run --reporter=default --reporter=junit --outputFile.junit=node_modules/.cache/accord/junit.xml`. Confirm
the executed workflow-script cases ran (not skipped); if they skipped, the run does not count: fix the environment
and run again. Any failing case is reported. Then copy that report to
`packages/core/test/fixtures/st-ln-44/after-junit.xml`, and run
`node --experimental-strip-types packages/core/test/helpers/st-ln-44.ts packages/core/test/fixtures/st-ln-44/after-junit.xml --out packages/core/test/fixtures/st-ln-44/rule3-list.md`
(exit 1 means an entry stops; the file is written either way).

Test, added to `packages/core/test/st-ln-44.test.ts`, top-level, exact title:
- `it('ac-1 no test in the measuring run takes over 10 s apart from a kept test within its ceiling')`:
  `rs = rows(readFileSync(TABLE, 'utf8'))`, `expect(tableProblems(rs)).toEqual([])`;
  `cs = cases(readFileSync(new URL('./fixtures/st-ln-44/after-junit.xml', import.meta.url), 'utf8'))`;
  every row of `rs` is found in `cs` (each destination of a `moved` or `merged` row, the row's own test otherwise),
  so the run is whole; the case of row #2 has a status other than `skipped` (Git Bash ran the executed cases; ledger
  Ruling on ACCORD_BASH); `expect(rule3(rs, cs).filter((e) => e.stop).map(<one line of listText>)).toEqual([])`.
  It reads table.md each run, so a keep the owner adds through rule 3 counts without touching the test, and the kept
  rows and kept destinations (#115's three and #117 at 29 s among them, D-13) are judged on their ceilings.

Commit the two fixtures and the test. When the ac-1 test fails because entries stop, do not change any test or
the table: report `BLOCKED` with the stopping entries of `rule3-list.md` (a criterion test is the owner's; build
takes it to the owner). Report: the rule 3 list, the failing cases, and the two fixture paths.

Must not change: every other test, fixture and helper.

## Task 36: The ac-2 and ac-3 tests read the committed runs
covers: @ac-2, @ac-3, D-04, D-07
files: packages/core/test/st-ln-44.test.ts (new)
verify: packages/core/test/st-ln-44.test.ts#ac-2-every-test-tag-that-names-a-test-of-the-table-names-one-passing-test-and-lint-reports-no-error (@ac-2), packages/core/test/st-ln-44.test.ts#ac-3-every-test-gone-since-the-baseline-run-is-a-row-the-table-moves-and-every-destination-exists (@ac-3)

Rows: none (it proves ac-2 and ac-3 over all 118 rows).

Consumes: Task 34's helpers, Task 35's `after-junit.xml`, and `accord/tickets/ST-LN-44/before-junit.xml` with the
sha256 the main session recorded for it in a ledger Ruling (Main session step 0). Each test runs well under 10 s: no
CLI run and one `git ls-files` spawn; no git history is read, so both run the same in CI's shallow clone.

Shared code added to the test file (imports also `node:child_process`, `readDir` from `./helpers/fixture.js`, and
`loadSnapshot`, `lintSnapshot` from `../src/index.js` and `scanJUnit` from `../src/load/junit.js`, which index.ts does
not export; no core source changes, D-11):
- `after()` reads the fixture `after-junit.xml`.
- `before()` reads `new URL('accord/tickets/ST-LN-44/before-junit.xml', ROOT)` as bytes and throws
  `before-junit.xml is not the recorded baseline run` unless their sha256 equals `BEFORE_SHA256`, a constant holding
  the hex sha256 that `accord/tickets/ST-LN-44/ledger.md` records in the Ruling of Main session step 0 (copy it from
  there; when the ledger holds no such Ruling, stop and report `BLOCKED`).
- `rowIds(rs)`: the set of `idOf(row.file, row.title)` for every row and `idOf(d.file, d.title)` for every
  destination of every row.

Tests first, top-level, exact titles:
- `it('ac-2 every test tag that names a test of the table names one passing test and lint reports no error')`:
  - `input`: the files of the `accord/` folder (read as `accordInput` in stage-baseline.test.ts:9-13 does; copy its
    body, never import a test file), plus the key `node_modules/.cache/accord/junit.xml` (this repository's
    `tests.report`) holding `after()`'s text; `tree` is `git ls-files -z` of ROOT split on NUL (conventions.md)
    plus the report key.
  - `snap = loadSnapshot(input)`; `expect(lintSnapshot(snap).findings.filter((f) => f.level === 'error'))
    .toEqual([])`.
  - `rs = rows(readFileSync(TABLE, 'utf8'))`, `ids = scanJUnit(<after text>)`. For every ticket other than ST-LN-44
    and each scenario's `tags` entry starting with `@test:` whose id (the rest of the tag) is in `rowIds(rs)`: the
    report has exactly one case with that id (count `cases()` whose `idOf(file, title)` equals it) and
    `ids[id] === 'passed'`. A tag naming a test outside the table's rows is not this ticket's to check (ledger
    Ruling: ST-LN-2 and ST-LN-18 hold two tags ST-LN-61 left on renamed tests). ST-LN-44 is left out: its own tags
    name the tests of this file, written after the run it reads.
  - Every row whose `tag` column is not `-` (the form `<ticket id> <ac-n>`): that ticket's scenario with `acTag`
    `ac-n` carries the tag `@test:` + `idOf(row.file, row.title)`, so each criterion test the table keeps, makes
    faster or rebuilds (D-04, rule 1) still holds its ticket's tag.
  - Collect failures as `<ticket> <ac> <id>: <why>`, expect `[]`.
- `it('ac-3 every test gone since the baseline run is a row the table moves and every destination exists')`: the
  before pairs are the `{ file, title }` pairs of `before()`, the run of the whole suite at `<BASE>`; the after pairs
  are `after()`'s. Every row's own `file`/`title` must be a before pair (the before list is whole). Every before pair
  missing from after must be the `file`/`title` of a row whose action is `removed`, `merged` or `moved`; every
  destination of a `merged` or `moved` row must be an after pair. Collect each kind of failure, expect `[]`. A
  destination carrying a rule 3 keep is still a destination, and an appended keep row is neither removed nor moved,
  so neither changes this check.

Must not change: the tests of Tasks 34 and 35; every other test, fixture and helper.

## Task 37: The ac-4 test checks every changed row's assertions against its frozen old body and maps.json
covers: @ac-4, D-07
files: packages/core/test/st-ln-44.test.ts (new), packages/core/test/fixtures/st-ln-44/maps.json (new), packages/core/test/fixtures/st-ln-44/base-tests.json (new)
verify: packages/core/test/st-ln-44.test.ts#ac-4-every-assertion-of-a-changed-row-is-in-its-new-place-or-mapped-by-the-row-note (@ac-4)

Rows: none (it proves ac-4 over every row whose action is `faster`, `moved`, `merged` or `kept`; rule 4 maps kept rows
with cuts too, so a row kept through rule 3 stays checked).

Consumes: Task 34's `rows`, `body`, `helpersOf`, `asserts`, `cases`, `idOf`, `TABLE`, `ROOT`; Task 36's `after`;
`packages/core/test/fixtures/st-ln-44/maps.json`.

The frozen old bodies, written first: `packages/core/test/fixtures/st-ln-44/base-tests.json`, LF, two-space indent,
`{ "base": "1cec2ac130d8d34c4dcdadddfee9effb4d1104e9", "files": { "<path>": { "sha256": "<hex>", "text": "<file text>" } } }`
with one entry per distinct `file` of rows 1 to 118, whatever the row's action (22 files: packages/cli/test/
show-approval, workflow-script, lane-s, after-verify, worktree, drop, trailers, lane-flow, upgrade, gate, hook,
dashboard, show, status, lane-commands, new-ticket, bin, skills-sync and tracker `.test.ts`, and packages/core/test/
benchmark-worktree, benchmark-compliance and benchmark-samples `.test.ts`). The `unchanged` rows' files are frozen
too, so a late keep of rule 3 that turns an `unchanged` row (#100, #108, #112) into `kept` is still checked here
instead of making `baseText` throw. Each entry is made by Node from
`execFileSync('git', ['show', base + ':' + path], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })` (a Buffer): `text`
its UTF-8 text, `sha256` the hex sha256 of that Buffer; the file is written by `writeFileSync`, never by a shell
redirect, and the script that wrote it is not committed. Anyone can recheck an entry against
`git show <BASE>:<path>`. One JSON file, not copies named `*.test.ts`, which vitest and tsc would pick up.

In the test file: `baseText(path)` returns `files[path].text` after checking that `base` is `<BASE>` and the sha256 of
`Buffer.from(text, 'utf8')` equals the entry's `sha256`; it throws `no frozen baseline copy of <path>` or
`frozen baseline copy of <path> changed` otherwise.

Test first, top-level, exact title:
`it('ac-4 every assertion of a changed row is in its new place or mapped by the row note')`: for every row numbered 1
to 118 whose action is `faster`, `moved`, `merged` or `kept`:
- `src = baseText(row.file)`; `oldBody = body(src, row.title)`, `undefined` fails the row;
  `old = asserts(oldBody, helpersOf(src))`.
- `places`: the row's destinations, or for any other action the row's own file and title; `now` is the
  concatenation, over the places, of `asserts(body(text, place.title), helpersOf(text))` with `text` the place's file
  read at HEAD; a missing body fails the row.
- `left` is a working copy of `now`. First pass: each entry of `old`, in order, that has an equal entry in `left`
  removes one such entry. Second pass: each entry of `old` the first pass left unmatched, in order, is matched by an
  unused `maps.json` entry of that row with the same `old`: a `test` entry is used as it is; a `now` entry is used
  only when its `now` text is still in `left`, and using it removes one occurrence from `left`. So a mapped `now`
  can never be an assertion an unchanged old line already matched, and one new assertion never serves two old ones
  (row #4's :42 mapped to :41's text fails). An old entry that finds neither is collected as
  `#<n> <file>: <assertion>`.
- Every `maps.json` entry is checked whether used or not: its row exists; `old` is in that row's `old`; `cite` has at
  least 3 characters and `row.note` contains it; a `now` entry's text is in the row's `now`; a `test` entry's id is
  a `passed` case of `after()` (by `idOf`), and `cite` contains that case's last title segment, or `#<m>` not
  followed by a digit for a row `m` whose own test or one of whose destinations is that case, or whose note contains
  that case's last title segment (rows #71 and #96 cite "as in #28" and "as in #20", whose notes quote the CLI
  tests). Each failure is collected as `#<n> maps.json: <why>`.
- `expect(<all collected>).toEqual([])`.

Write the test and run it. Any failure is a gap Tasks 28 to 33 missed: a plain omission (the note places the
assertion and the code or `maps.json` lacks it) is restored in place (a test file outside this task's line is
declared in the report with the reason) and named in the report; any other failure is reported as
`BLOCKED`, not fixed. A restoration here does not repeat the measuring run; the verify full run and its rule 3 check
measure it.

Must not change: the tests of Tasks 34 to 36; every assertion any task wrote, beyond a restored omission.

## Main session steps

These edit files under the top-level `accord/` folder, which no executor touches, or need the owner.

0. Before Task 1 is dispatched, and before any `accord task-done` (its `tests.affected` run writes the same report
   path): copy `node_modules/.cache/accord/junit.xml`, the plan stage's full run of step 7 at this plan's commit (its
   test code is `<BASE>`'s: the commits after `<BASE>` touch only `accord/`), byte for byte to
   `accord/tickets/ST-LN-44/before-junit.xml`. When that report is no longer the step-7 run, run `tests.full` once
   at the plan commit and copy its report instead. Write a ledger Ruling naming the file, its case count and its
   sha256 (`Ruling: before-junit.xml is the full run at 1cec2ac, <n> cases, sha256 <hex> — ac-3's before list — ...`),
   and commit both. Task 36 copies that sha256 into its test.
1. Before dispatching Task 35 (the update of `accord/tests-baseline.txt` for every baseline title that moved): from
   the `baseline` list of `packages/core/test/fixtures/st-ln-44/maps.json`, remove each line whose `new` is `null`
   and replace each other `old` in place with its `new`. Known: row #10 removes line 129
   (`packages/cli/test/lane-flow.test.ts#lane-ticket-flow->-walks-one-ticket-from-unapproved-to-done`; its four
   destinations carry `risk:`); row #73 keeps its title, so line 97 stays. New `risk:` titles need no line. Then run
   `node packages/cli/dist/cli.js lint` and confirm no `lint.test-untraced` finding names a test of this ticket.
   Commit.
2. After Task 35 reports (recorded, or `BLOCKED` on stopping entries): read
   `packages/core/test/fixtures/st-ln-44/rule3-list.md`. When it is not `No entry.`, write one proposal per entry and
   take the whole list to the owner as one question before review (rule 3):
   - an entry that stops: propose either a keep, with its ceiling the larger of its measuring-run time and its
     earlier full-run times in measurements.md, rounded up, and the reason it cannot get under 10 s; or a further
     split, naming the independent blocks it would become, when the test has any;
   - an entry that does not stop (5 to 10 s, or a kept test under its ceiling): propose leaving the row as the table
     has it, or a further split when the margin is thin and the test has independent blocks.
   On the owner's yes to a keep: record it as a Decision in the ticket, write it into table.md with the syntax below,
   update the table's sha256 in `## Approach`, and run `accord approve ST-LN-44` before verify (table rule 3, "Late
   keeps"); then run `tests.affected` for Task 35's files and `accord task-done ST-LN-44 35` again (Task 34's test
   reads the frozen approved table and checks the live one only for what a keep leaves unchanged, so it stays
   green). On the owner's yes to a further split: that is a new cut beyond the approved table, so it is a change of
   course (accord-build step 6): a change note under `## Approach`, the owner's new yes, `accord approve`, and a
   re-plan that adds the split tasks and a new measuring task after them, which replaces the two measuring fixture
   files, and a task that replaces `table-approved.md` and its hash in Task 34's test with the newly approved table
   (a split changes destination titles, which that test compares).
   Keep syntax (`rows()` of Task 34 accepts exactly this; today's table parses to rows 1 to 118, whose only keep
   destinations are #115's three ` :: kept 29 s`):
   - a `faster` or `unchanged` row becomes kept: its action cell becomes `kept` and its note starts with
     `Ceiling <N> s. <reason>`;
   - a kept row over its ceiling: the number in its `Ceiling <N> s` is raised and the reason added to its note;
   - a destination of a `moved` or `merged` row: that destination entry becomes `<file> :: <title> :: kept <N> s`
     (or its `kept <N> s` number is raised) and the reason is added to the row's note; the row's action stays
     `moved` (or `merged`), so ac-3 and ac-4 are unchanged;
   - a test that has no row (for example Task 2's copy-vs-built test): a row appended after the last row, numbered
     119 upward with no gap, `| <n> | <path without the packages/ prefix> | <title, describe titles joined by " > "> | - | kept | - | - | - | Ceiling <N> s. <reason> |`.
3. At verify: after verify's full run (with `ACCORD_BASH` set to Git Bash), run
   `node --experimental-strip-types packages/core/test/helpers/st-ln-44.ts node_modules/.cache/accord/junit.xml --verify`
   before ac-1 is judged. Exit 1 lists a row over 10 s that the table does not keep, a kept row or destination over
   its ceiling, or a test outside the table over 10 s: verify stops, the list goes to the owner as in step 2, and on a
   yes the table is changed and re-approved and the full suite runs again (table rule 3, "At verify").
4. Merging origin/main is held (owner, 2026-10-26: "Hold merging main until after the measuring run"). From the
   commit `plan: ST-LN-44 ready` until Task 35's measuring run is recorded by `accord task-done ST-LN-44 35`,
   origin/main is not merged into `t/ST-LN-44`. A Continue that reports `behind:` in that span is not merged, and the
   main session says so in its reply: `behind: origin/main is not merged until Task 35's measuring run is recorded
   (ST-LN-44 plan, Main session step 4)`. When a re-plan of step 2 adds a measuring task that replaces Task 35's
   fixtures, the hold lasts until that task is recorded. So ac-3's before list stays the full run at `<BASE>` that the
   Approach names, and ac-3 and ac-4 read the state at 1cec2ac.
   After that, merges follow the owner's usual rule: origin/main is merged whenever Continue reports `behind:`.
   `accord/tickets/ST-LN-44/before-junit.xml` is never replaced: a merge after the measuring run does not refresh it,
   since `before-junit.xml` and `after-junit.xml` then both predate the merge, so ac-3 compares like with like, and
   verify's full run with step 3 measures the merged code. After each such merge one check is made, for ac-4 (whose
   old bodies and `maps.json` `old` texts are read at `<BASE>`) and ac-2:
   - `M` is the merged origin/main commit without this ticket's commits: `git rev-parse <the merge commit>^2`.
   - Rows main changed: list each table row whose old test body main changed, its title line included
     (`git diff <BASE> <M> -- <the row's file>` has a hunk inside that body), and each destination title main now
     uses for another test (`git grep -n -F '<last title segment>' <M> -- <the destination's file>` finds it and the
     same search at `<BASE>` does not). When the list is
     not empty, take it to the owner as one question before the next task is dispatched (before verify when every
     task is recorded), with a proposal per row (the row's new title, the row dropped, or its old body re-read at
     `<M>`): each is a change to the approved table or to the plan, so on the owner's yes it is a change of course
     (accord-build step 6): a change note under `## Approach`, the owner's new yes, `accord approve`, and a re-plan of
     the tasks that carry those rows.
