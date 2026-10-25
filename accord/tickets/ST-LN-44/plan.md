---
baseline: 2746d3aa6eedd3ff940f82fa5fe7ef0decc132d8
plan_hash: "fnv1a64:0a0d9594b6f4f049"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket, and the approved table `accord/tickets/ST-LN-44/table.md` (read its header rules 1-7, its levers
H1-H8, and the rows the task names).

Order: Tasks 1 to 5 are the wiring: the shared helpers and guards every task after them stands on, each proved by its own
`risk:` test written first (H8 `run()` guard, the template copy routine with its origin assertions of rule 5, H2,
H6, the core-ready helpers). Tasks 6 to 17 carry out the rows outside `worktree.test.ts`, one test file (or a small
group of files) each. Tasks 18 to 26 carry out the 48 rows of `worktree.test.ts`, by region of the file. Task 27
confirms the rows that take no change. Tasks 28 and 29 audit the assertion maps and restore any omission. Task 30
writes the four tests that prove ac-1 to ac-4 from committed artifacts (the ST-LN-48 precedent of
`packages/core/test/stage-baseline.test.ts`). Task 31 is the measuring run of rule 3, whose junit those tests read.
The update of `accord/tests-baseline.txt` (Main session step 1, before Task 31) and the copy of the measuring run's
junit and rule 3 list into `accord/tickets/ST-LN-44/` (Main session step 2, after Task 31) are main-session steps,
because no executor edits a file under the top-level `accord/` folder. The four ac tests fail until step 2 is
committed, so they fail in Task 31's own run and pass from the next full run (verify's) on.

Row coverage: every one of the 113 rows of table.md is carried out by exactly one task, which lists it on its
first prose line as `Rows: #n, ...`. Nothing outside those rows changes.

Rules for every task:
- The table is the authority. For each row, do exactly what its "how" column says, nothing more (rule 3: no other
  cut is added at build without the owner). A row whose cut cannot be made as written, or whose assertion map does
  not fit the code, stops the task: report the row, what blocks it and the line numbers; do not improvise.
- Split or moved rows: each destination title is copied verbatim from the row's destinations column, in that
  order, placed where the original test stood. Each destination keeps the original test's timeout argument (for
  example `120_000`). A destination that keeps the original title keeps the original test's position.
- Assertions (rule 4, ac-4): every old assertion lands where the row's note column says. An assertion the note
  turns into a core check is written as an `expect` on the core value (for example
  `expect(gateReadyIn(files, 'S-1')).toBe('pass')`). A kept or faster criterion test keeps every assertion line as
  it is; only its setup changes. No risk assertion moves into a criterion test (rule 1).
- Criterion tests (titles starting `ac-`) are never split, renamed or moved (rule 1), so no `@test:` tag moves.
- New titles start with `risk:` (rule 7). Titles written by the table keep its wording, commas included.
- Templates (rule 5, H1): a template is built in a `beforeAll` of its test file and removed in its `afterAll`. A
  template never holds a linked worktree; any `worktree add` runs after the copy, in the copy. A clone template is
  copied only with `copyClone` (Task 2), which asserts the copy's origin; a template with no remote (lane-s, show,
  dashboard, lane-repo templates) is copied with `copyRepo` (Task 2) and never gains an origin. Templates are built
  with `makeTemplate` (Task 4), so every copy carries H6.
- H8: every row's "H8 run guard" is met by Task 1 for the whole suite; no row adds its own guard.
- A new commit made by test code uses `commitMsg` from `packages/cli/test/helpers/repo.ts` (conventions.md: `-F
  <file> --cleanup=verbatim`, never `-m`); existing commit lines that a row does not touch stay as written.
- Test ids: the test file's path from the repository root, `#`, then the `describe` titles and the `it` title
  joined by ` > `, every run of whitespace turned into `-`. No id on a `verify:` line holds `@` or a comma, so a
  destination whose table title holds a comma is run but not named there.
- D-11: no file under `packages/*/src` or `scripts/` changes. Files are LF with no BOM. Add no dependency.
- Running: CLI tests import core from `packages/core/dist`; after any change under `packages/core/`, run
  `npm run build -w packages/core`. End every task with `npm run build`, `npm run lint` and `npm run typecheck`, then
  `npx vitest run <each test file the task names> --reporter=default --reporter=junit
  --outputFile.junit=node_modules/.cache/st-ln-44/task-<n>.xml`, from a shell where `ACCORD_BASH` is
  `C:\Program Files\Git\bin\bash.exe` on Windows (ledger Ruling: from PowerShell `bash` is the WSL one and the
  executed workflow-script cases skip).
- Report, per row: the old id, the new ids, the alone time of each from that junit, and the assertion map as built
  (each old line, then the new `file:line`), and every old assertion whose text changed or that moved off the row's
  destinations, with the note clause that allows it (Task 30's `MAPPED` list is built from these). Also report every
  id of `accord/tests-baseline.txt` that the task removed or renamed, as `old id -> new id` or `old id -> gone`.
  Tasks 28 to 30 read these reports.

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
  - The same refusal for `join(checkout, 'no-such-folder', 'sub')`, a path that does not exist.
  - `tmp = mkdtempSync(join(tmpdir(), 'accord-guard-'))`; `await run(['--version'], join(tmp, 'sub', 'deeper'))`
    resolves with `code` 0 (the folder does not exist; `--version` needs none). `cleanup(tmp)` in a `finally`.
  - Run it before the guard exists and see it fail on the first expectation.

Guard: walk `resolve(cwd)` up to its nearest existing ancestor, take `realpathSync.native` of it, and refuse unless it
starts with `realpathSync.native(tmpdir())` and differs from `realpathSync.native(process.cwd())`, the same
comparison `gitIn` makes.

Must not change: `gitIn`, every other helper in repo.ts, and `run()`'s behaviour for any cwd under the temp folder.
After the task, run every CLI test file once (`npx vitest run packages/cli/test`); any test the guard now refuses is
reported, not edited (table: "One grep found no test that runs accord outside a temp folder").

## Task 2: Wiring: a template copy has its own origin and matches a built clone (H1, rule 5)
covers: D-05, D-11
files: packages/cli/test/helpers/worktree.ts, packages/cli/test/helpers/repo.ts, packages/cli/test/sandbox-guard.test.ts (new)
verify: packages/cli/test/sandbox-guard.test.ts#risk:data-loss-a-template-copy-pushes-to-its-own-origin-and-matches-a-clone-built-the-same-way, packages/cli/test/sandbox-guard.test.ts#risk:data-loss-copyClone-refuses-a-template-that-holds-a-linked-worktree

Rows: none (H1 and rule 5 for every template row).

Consumes: `makeClone`, `Clone`, `gitRun`, `cleanup`. Produces, in `helpers/worktree.ts`:
- `copyClone(tpl: Clone, others: string[] = []): Clone & { others: string[] }`:
  - Throws `template holds a linked worktree: <root>` when `tpl.git('worktree', 'list', '--porcelain')` has more
    than one entry.
  - Makes a new remote folder (`accord-wt-remote-` prefix) and a new clone folder (`accord-wt-` prefix) with
    `realpathSync.native(mkdtempSync(...))`, `cpSync(..., { recursive: true })` of `tpl.remote` and `tpl.root`, then
    `git remote set-url origin <new remote>` in the new clone (never a text replace).
  - Copies each folder in `others` (clones of `tpl.remote` the file made, for example upgrade's other clone) to an
    `accord-wt-other-` folder and sets its origin the same way.
  - For each copied clone (never the bare remote, which has no origin) asserts, throwing an Error naming both URLs on
    any miss: `git remote get-url origin` equals the new remote; `git remote get-url --push origin` equals the new
    remote; the fetch URL differs from `tpl.remote`; the push URL differs from `tpl.remote`.
  - Returns a Clone over the new folders: `sibling`, `git` as in `makeClone`; `otherClone` as in `makeClone` (Task 3
    changes it); `cleanupAll` removing the siblings, the remote, the root, the copied others and every other clone it
    made. `others` holds the copied other folders, in the given order.
- In `helpers/repo.ts`: `copyRepo(tpl: string): string`, a `mkdtempSync(join(tmpdir(), 'accord-cli-'))` folder with
  `cpSync(tpl, it, { recursive: true })`, for templates with no remote (rule 5 excludes them from the origin check).

Tests first, in `sandbox-guard.test.ts`:
- `it('risk:data-loss a template copy pushes to its own origin and matches a clone built the same way', ..., 120_000)`:
  `tpl = makeClone({ tickets: ['ST-9', 'ST-10'] })`, `built = makeClone({ tickets: ['ST-9', 'ST-10'] })`,
  `c = copyClone(tpl, [tpl.otherClone()])`. Expect: the four origin facts above for `c.root` and `c.others[0]`;
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

Rows: none (H6 for every template row; table: its saving is unconfirmed, Task 31 measures it).

Produces: `makeTemplate(opts)` in `helpers/worktree.ts`: `makeClone(opts)`, then in its root
`git config maintenance.auto false` and `git config gc.auto 0`, and in its remote `git config gc.auto 0` and
`git config receive.autogc false`. Task 3's `otherClone` also passes `-c maintenance.auto=false -c gc.auto=0`.
Every template in Tasks 6 to 26 is built with `makeTemplate`.

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
verify: packages/cli/test/show-approval.test.ts#risk:data-loss-approval-refuses-a-ticket-whose-gherkin-does-not-parse

Rows: #1.

Consumes: `approvalView` and `loadSnapshot` from `@accord-dev/accord-core`, `isUnsafe` from
`../src/render/dashboard.js` (the same unsafe-char map `show.ts:10` uses), the file's `rebuild()`. Produces: the
test `ac-1 every scenario of every real ticket is rebuilt exactly from the approval view`, title, tag and timeout
unchanged.

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

The test proving ST-LN-19 ac-1 must pass, as must ac-2, ac-3 and ac-5 of this file, which make the per-id CLI exit 0
(row #1 note).

Must not change: every other test of the file, `rebuild()`, `viewOf()`.

## Task 7: Workflow-script cases run their scripts concurrently
covers: D-01, D-05, D-11
files: packages/cli/test/workflow-script.test.ts
verify: packages/cli/test/workflow-script.test.ts#the-emitted-workflow-script-—-executed->-risk:parsing-BOM-and-CRLF-frontmatter-and-unreadable-blocks-and-large-files-read-as-approved, packages/cli/test/workflow-script.test.ts#risk:security-a-lane-S-ticket-that-passed-gate-ready-is-gated-in-an-accord-only-diff-and-a-queued-one-is-not

Rows: #2, #6, #9, #17, #35, #57, #109.

Consumes: `runScript` (:220-270). Produces: `runScriptAsync(repo, opts): Promise<Run>` beside it, sharing its stub,
`script.sh`, `calls.log` and `env` code (move that into a local `prepare(repo, opts)` both call), running
`promisify(execFile)(BASH, ['script.sh'], options)`. On rejection, `code` is the error's numeric `code` (execFile
reports the exit status there, not in `status`), `out` and `err` its `stdout` and `stderr`.

Rows #2, #6, #9, #17, #35, #57 become `async` tests: every sandbox of the test is built first, then all its script
runs go through one `Promise.all` of `runScriptAsync`, then every assertion of the old body runs on the results in
the old order (row notes; #2 keeps `named.length === 1` and, per case and both scripts, `toBe(code)` and the
gated-id `toEqual` of :463-470; #17 keeps BIG-1 at 2 MB; #35 keeps every check of :510-523). Each keeps its timeout.

Test first: convert #17 (`risk:parsing ...`) and see it pass with the same assertions, then the others.

#109 is unchanged and keeps the sync `runScript`, as do the other tests of the file. The criterion tests of
BUG-LN-3 (#2 ac-4, #6 ac-3, #9 ac-1, #57 ac-2) must pass. #2 and #9 are kept rows: their ceilings are 106 s and 45 s.

Must not change: `sandbox`, `scriptOf`, `noBash` (:61-67), `runScript`'s behaviour, every assertion.

## Task 8: Lane S gate done verdicts split from one reviewed template
covers: D-04, D-05, D-11
files: packages/cli/test/lane-s.test.ts
verify: packages/cli/test/lane-s.test.ts#risk:complex-branching-lane-S-gate-done-passes-a-reviewed-change, packages/cli/test/lane-s.test.ts#risk:complex-branching-lane-S-gate-done-fails-on-a-code-commit-after-the-review, packages/cli/test/lane-s.test.ts#risk:complex-branching-lane-S-gate-done-fails-on-edited-approved-sections, packages/cli/test/lane-s.test.ts#risk:complex-branching-lane-S-gate-done-passes-a-verdict-committed-right-after-its-round, packages/cli/test/lane-s.test.ts#risk:complex-branching-the-review-package-of-a-lane-S-ticket-starts-at-the-fork-point-from-the-default-branch

Rows: #3, #63, #69, #102.

Consumes: `repoWith`, `copyRepo`, `gateReadyIn`, `P` (Task 5). Produces:
- #3: a `beforeAll` template of the reviewed state of :101-122 (base commit, `t/S-1`, core-ready `ac_hash` by
  `gateReadyIn` in place of the :117 `gate ready` run, `ready: S-1`, `change`, `review: S-1` commits), removed in
  `afterAll`. Fourteen tests, titles and order from row #3, each `copyRepo` of the template, setting its state with at
  most 3 git commands and asserting the one verdict the row's note maps (:123 to :180-184). The first test also
  asserts `expect(gateReadyIn(...)).toBe('pass')` (the :117 exit 0; its CLI form is made by #63). The original
  title is gone.
- #69: `gateReadyIn` in place of the `gate ready S-1` run (:71), with `expect(...).toBe('pass')`; `repoWith`'s
  identity (:55-57) for this test written into `.git/config` with `writeFileSync`/append instead of three
  `git config` runs; the two dashboard runs' checks stay.
- #63 (kept, no cut, ceiling 15 s) and #102 (unchanged) are not edited.

Test first: write the template and the first destination, see it pass, then the other thirteen.

Must not change: #63, #102, `risk:security approve refuses a lane S ticket and writes nothing`, `repoWith` for its
other callers.

## Task 9: After-verify tests from template clones
covers: D-05, D-11
files: packages/cli/test/after-verify.test.ts
verify: packages/cli/test/after-verify.test.ts#risk:complex-branching-the-commits-after-verify-come-from-the-ticket-tip-in-graph-order, packages/cli/test/after-verify.test.ts#risk:complex-branching-a-merge-from-origin-main-after-verify-is-a-commit-after-verify-with-no-files, packages/cli/test/after-verify.test.ts#risk:complex-branching-with-no-origin-the-local-main-is-the-default-branch-and-a-renamed-main-is-not, packages/cli/test/after-verify.test.ts#risk:complex-branching-status-shows-a-claimed-ticket-done-then-review-once-its-branch-holds-a-fix, packages/cli/test/after-verify.test.ts#risk:complex-branching-a-new-review-round-after-the-fix-takes-the-ticket-to-verify, packages/cli/test/after-verify.test.ts#risk:complex-branching-review-package-leaves-out-what-a-merge-from-the-default-branch-brought-in

Rows: #4, #20, #83, #96.

#96's title holds a comma (`... at verify, before ...`), so it is run and reported but not named above.

Consumes: `makeTemplate`, `copyClone`, `approve`, `gateReadyIn`, `P`. Produces:
- #4: seven tests, titles and order from row #4, each from a `copyClone` of one `makeTemplate()` template and
  reading each state once (each doubled `fact()` pair checks one value read once). Assertion map per the note.
- #20: a `beforeAll` template of the pushed done state with core-ready hashes (approve and `gateReadyIn` on the
  ticket text instead of the :125-126 runs, then the plan, ledger, review, `work` and `tick` commits and the push);
  four tests per row #20. The first asserts `gateReadyIn` returns `pass` and the approved hash is set.
- #83: template clone and other clone (copy with `others`); both review-package runs stay.
- #96: template clone; core-ready instead of :219-220 with `toBe('pass')`; both anchor runs stay.

Test first: #4's first destination.

Must not change: `commit`, `setKey`, `VERIFICATION`; every assertion's value.

## Task 10: Drop tests from claimed-clone templates
covers: D-04, D-05, D-11
files: packages/cli/test/drop.test.ts
verify: packages/cli/test/drop.test.ts#risk:complex-branching-drop-reads-a-local-claim-tip-ahead-of-origin, packages/cli/test/drop.test.ts#risk:complex-branching-drop-refuses-diverged-claim-tips, packages/cli/test/drop.test.ts#risk:complex-branching-drop-names-trunk-when-origin-HEAD-is-trunk, packages/cli/test/drop.test.ts#risk:complex-branching-drop-refuses-a-ticket-already-dropped-on-main, packages/cli/test/drop.test.ts#risk:complex-branching-drop-refuses-a-failed-fetch, packages/cli/test/drop.test.ts#risk:data-loss-drop-proceeds-once-the-held-ticket-file-is-committed, packages/cli/test/drop.test.ts#risk:data-loss-drop-pushes-a-crlf-ticket-file-with-a-bom-byte-for-byte-outside-the-status-value-and-the-dropped-section

Rows: #7, #32, #39, #40, #41, #79.

Consumes: `makeTemplate`, `copyClone`, `claimOnBranch`, `ticketWith`, `writeIntent`, `remoteDrop`. Produces, in
`beforeAll` (removed in `afterAll`):
- the drop template: `makeTemplate()` with `claimOnBranch(tpl, 'second')` pushed (rows #32, #40 copy it as is;
  #7 and #39 copy it and then write the intent state each destination needs);
- the crlf template for #41: `core.autocrlf false`, the BOM/CRLF ticket on `t/ST-10`, committed and pushed (:83-88).
- #7: five tests per row #7 (the third sets C on origin and D locally itself; the fifth builds its trunk remote in
  its own copy); #39: four tests per row #39 (the first and second keep a real `drop ST-10` exit 0; the second
  merges `origin/drop/ST-10` into main from an other clone and deletes the drop branch); #79: two tests from a copy
  with `worktree add` after the copy; #32, #40, #41 keep every assertion, only setup changes (#32 does not merge its
  two git reads).

Test first: #7's first destination.

Must not change: `risk:data-loss drop refuses a record the default branch would fail to lint`; the criterion tests'
assertions (#32 ST-LN-34 ac-1, #40 ST-LN-34 ac-2).

## Task 11: Upgrade tests from a template of clone, other clone and remote
covers: D-04, D-05, D-11
files: packages/cli/test/upgrade.test.ts
verify: packages/cli/test/upgrade.test.ts#risk:data-loss-upgrade-refuses-and-pushes-nothing-when-the-pin-is-not-older, packages/cli/test/upgrade.test.ts#risk:data-loss-upgrade-refuses-and-pushes-nothing-when-the-upgrade-branch-exists-on-origin, packages/cli/test/upgrade.test.ts#risk:data-loss-upgrade-refuses-and-pushes-nothing-when-the-settings-are-not-a-JSON-object, packages/cli/test/upgrade.test.ts#risk:data-loss-upgrade-refuses-and-pushes-nothing-when-the-default-branch-would-fail-lint

Rows: #12, #13.

Consumes: `makeTemplate`, `copyClone(tpl, [other])`. Produces:
- #12 (kept, ceiling 43 s): a template of the clone, its other clone and the remote at the old-pin `next` commit
  (:22-33 run once in `beforeAll`), copied with the other clone; the remote reads are not merged; every assertion
  stays in place.
- #13: four tests per row #13, each from a copy of one `makeTemplate()` template with its other clone; each block's
  `refused`/`noBranch` checks move with it (:90-94, :96-101, :103-107, :111-116).

Test first: #13's first destination. The ST-LN-25 ac-3 test (#12) must pass unchanged in its assertions.

Must not change: every assertion of #12.

## Task 12: Hook tests from template clones
covers: D-04, D-05, D-11
files: packages/cli/test/hook.test.ts
verify: packages/cli/test/hook.test.ts#risk:security-the-prompt-expansion-hook-allows-an-empty-prompt-and-a-continue-of-the-worked-ticket, packages/cli/test/hook.test.ts#risk:security-the-prompt-expansion-hook-blocks-continue-and-pick-up-of-other-tickets-in-the-ticket-worktree, packages/cli/test/hook.test.ts#risk:security-the-prompt-expansion-hook-blocks-free-text-and-other-continues-in-the-ticket-worktree, packages/cli/test/hook.test.ts#risk:security-the-prompt-expansion-hook-blocks-from-a-subfolder-and-by-a-hold-in-the-main-checkout-and-lets-another-session-through, packages/cli/test/hook.test.ts#risk:complex-branching-the-prompt-expansion-hook-allows-with-one-stderr-line-in-a-repository-pinned-to-another-accord, packages/cli/test/hook.test.ts#risk:security-the-prompt-expansion-hook-lets-accord-upgrade-through-in-a-session-that-works-a-ticket, packages/cli/test/hook.test.ts#risk:complex-branching-the-registry-is-asked-again-only-after-24-hours-and-only-a-newer-plain-version-is-announced

Rows: #19, #51, #53, #68, #74, #91.

Consumes: `makeTemplate`, `copyClone`, `upgradeNotice` from `../src/commands/notice.js`, the mocks of
`packages/cli/test/setup.ts:7-16`. Produces, with templates per opts (`{}`, `{ tickets: ['ST-9'] }`,
`{ tickets: ['ST-9', 'ST-10'] }`) built in `beforeAll`:
- #19: four tests per row #19, each from a copy with `worktree add` of `t/ST-9` after the copy (and `sub` made in
  the tests that use it).
- #51: two tests per row #51; the pinned clone is a template copy with the pin committed.
- #53 (ST-LN-25 ac-1): one template copy serves both argv instead of two `makeClone` runs; the cache file stays fresh
  per argv; every assertion stays.
- #68: the six dashboard runs of :269-275 become `await upgradeNotice('0.2.0')` calls with the same mocks; :270-271
  and the four version answers check the returned line instead of `out` (undefined or not containing ` is out`);
  :266-268 and :276-279 stay CLI runs on a template copy.
- #74: a template copy instead of `makeClone`; #91 (kept, ceiling 11 s): a template copy; the 3 s abort wait stays.

Test first: #19's first destination.

Must not change: the `describe('accord hook')` tests; `freshCache`, `resetNotice`; every assertion of #53 and #91.

## Task 13: Dashboard tests from core-ready files and lane-repo templates
covers: D-04, D-05, D-11
files: packages/cli/test/dashboard.test.ts
verify: packages/cli/test/dashboard.test.ts#risk:complex-branching-a-dependency-done-only-on-its-claim-branch-still-blocks-its-dependent, packages/cli/test/dashboard.test.ts#risk:complex-branching-the-dashboard-counts-a-dependent-of-a-claim-branch-done-ticket-as-blocked, packages/cli/test/dashboard.test.ts#risk:complex-branching-the-viewer-comes-from-git-user.email-without-case-and-an-empty-one-exits-2, packages/cli/test/dashboard.test.ts#risk:regression-an-idle-ticket-shows-idle-days-in-the-dashboard-text-and-the-json-keeps-every-key

Rows: #28, #54, #71, #78, #81, #90.

Consumes: Task 5's `approve`, `ready`, `done`, `gateReadyIn`, `P`; `copyRepo`. Produces:
- #28 (ST-LN-2 ac-1): the five tickets written core-ready (`approve` then `gateReadyIn`, each
  `expect(...).toBe('pass')`, replacing :146-149's ten runs); `dashboard --json` and the two `lint` runs stay.
- #71 (ST-LN-2 ac-2): ST-AN-1 core-ready instead of :44-45, `toBe('pass')`; status json and dashboard checks stay.
- #90: `approve` in core instead of the :338 run; the rest stays.
- #54: a `beforeAll` template of the claim-done state (commit on base, `update-ref`, `reset --hard` in place of the
  checkout dance); two tests per row #54.
- #78: a template of a committed lane repo with ST-AN-1 instead of `makeLaneRepo` plus `commitAll`.
- #81 (BUG-LN-2 ac-4): a lane-repo template copy instead of `makeLaneRepo`; the `user.email` of :388 written into
  `.git/config` with fs; the five anchor and dashboard runs stay.

The CLI checks these rows drop are made by `gate.test` `gate ready on a passing ticket exits 0 and writes the
renderText body` and lane-commands `accord approve > writes approved_hash once and is a no-op the second time` and
`accord approve > after approval gate ready passes` (row notes); run those files too.

Test first: #54's two destinations.

Must not change: the pure dashboard tests of the file; the criterion assertions of #28, #71, #81.

## Task 14: Show tests from shared claim-state templates
covers: D-05, D-11
files: packages/cli/test/show.test.ts
verify: packages/cli/test/show.test.ts#risk:complex-branching-show-takes-blockers-from-the-checkout-not-the-claim-branch, packages/cli/test/show.test.ts#risk:complex-branching-show-takes-the-stage-of-a-ticket-done-only-on-its-claim-branch, packages/cli/test/show.test.ts#risk:complex-branching-show-and-status-hold-a-plan-at-stage-plan-before-its-ready-commit, packages/cli/test/show.test.ts#risk:complex-branching-show-and-status-reach-build-at-the-plan's-ready-commit, packages/cli/test/show.test.ts#risk:regression-show-finds-a-ticket-filed-only-on-its-claim-branch-at-that-branch-stage, packages/cli/test/show.test.ts#risk:regression-show-text-of-a-ticket-filed-only-on-its-claim-branch-shows-that-branch-stage, packages/cli/test/show.test.ts#risk:security-show-text-turns-control-and-bidi-characters-into-spaces

Rows: #30, #60, #64, #94.

Consumes: `copyRepo`, `approve`, `building`, `done`, `P`. Produces: one shared `beforeAll` template of the claim state
(core-ready T-2, claim tip from commits on base, `update-ref` and reset, no checkout) for #30 and #64; #30 and #64
two tests each per their rows; #60 two tests per row #60 with `approve` in core (the :152 run was unasserted).
#94 is unchanged.

Test first: #64's two destinations.

Must not change: #94, `ac-1 accord show prints the full detail as text`, `ac-2 accord show json gives the same detail
as data`.

## Task 15: Status claim-branch tests with core-ready setup
covers: D-04, D-05, D-11
files: packages/cli/test/status.test.ts
verify: packages/cli/test/status.test.ts#risk:complex-branching-a-merged-or-checked-out-or-ticketless-claim-branch-keeps-the-checkout-copy

Rows: #43, #44, #46, #95, #106.

Consumes: `approve` (Task 5). Produces, setup only, every assertion in place:
- #43 (STALE-1 ac-2, kept, ceiling 21 s): `approve` in core instead of :285; the claim tip by `branch t/T-1` and
  `reset` instead of three checkouts.
- #44 (BUG-LN-2 ac-3, kept, ceiling 21 s): the two approve runs (:467, :490) in core.
- #46 (BUG-LN-2 ac-1, kept, ceiling 19 s): `approve` in core instead of :319; the claim by commits on base,
  `update-ref` and reset.
- #95 (STALE-1 ac-1): `approve` in core instead of :270.
- #106 is unchanged.

Test first: #95, then the kept rows. These criterion tests must pass with every assertion line unchanged.

Must not change: every `describe` block of :63-265 and #106.

## Task 16: The lane flow walk becomes four stage tests
covers: D-05, D-11
files: packages/cli/test/lane-flow.test.ts
verify: packages/cli/test/lane-flow.test.ts#lane-ticket-flow->-risk:complex-branching-gate-ready-passes-only-after-approve-and-gate-plan-passes-on-a-plan-against-HEAD, packages/cli/test/lane-flow.test.ts#lane-ticket-flow->-risk:complex-branching-task-done-records-task-1-once-and-status-shows-build-1/2

Rows: #10.

Consumes: `makeLaneRepo`, `commitAll`, `approve`, `gateReadyIn`, `freshReport`, `evidence`. Produces four tests in
`describe('lane ticket flow')`, titles from row #10, each starting at its stage from core-ready files
(approve and `gateReadyIn` in core, the plan written against the baseline commit, earlier task-done ledger lines
written in setup). Assertion map: :43-49 (the CLI `gate ready` exit 1, `approve` exit 0, `gate ready` exit 0 and
`gate plan` stay CLI here), :50-55, :56-62 (the ledger line written in setup), :63-92. The third and fourth titles
hold commas, so they are run and reported but not named above.

The original id `packages/cli/test/lane-flow.test.ts#lane-ticket-flow->-walks-one-ticket-from-unapproved-to-done`
is gone; report it as `-> gone` (it is `accord/tests-baseline.txt:129`; the new titles carry `risk:`).

Must not change: `freshReport`, `evidence`.

## Task 17: Single rows in benchmark-compliance, lane-commands, new-ticket and bin
covers: D-05, D-11
files: packages/core/test/benchmark-compliance.test.ts, packages/cli/test/lane-commands.test.ts, packages/cli/test/new-ticket.test.ts, packages/cli/test/bin.test.ts
verify: packages/cli/test/new-ticket.test.ts#risk:complex-branching-a-ticket-added-and-deleted-on-a-merged-and-deleted-branch-keeps-its-number, packages/cli/test/bin.test.ts#risk:parsing-the-built-cli-hands-hook-input-on-stdin-to-the-prompt-expansion-hook

Rows: #61, #73, #87, #99, #104, #107, #110.

Produces:
- #61 (ST-LN-14 ac-5): memoize the injected `ticketAt` at `benchmark-compliance.test.ts:135` by id plus ms, test
  side; assertions unchanged. No core rebuild is needed: only a test file changes.
- #73: the title test keeps the `x` run and the no-commit run; a new test in `describe('accord task-done')`,
  `risk:parsing a task number of 0, 01, -1 or 1.5 is refused`, calls the exported `taskNumber` from
  `../src/commands/lane-args.js` for each of `0`, `01`, `-1`, `1.5` and expects a throw of
  `not a task number: <bad>`. Its title holds a comma, so it is run and reported but not named on the `verify:` line.
  The title test's id stays (`accord/tests-baseline.txt:97`).
- #87: build the add/delete side and the `--no-ff` merge of :233-241 with `write-tree`, `commit-tree` and
  `update-ref HEAD`; assertions unchanged.
- #99: a `makeTemplate()` copy instead of `makeClone`.
- #104 (ST-LN-1 ac-3), #107, #110 (IDS-1 ac-1) are unchanged.

Test first: the #73 risk test.

Must not change: #104, #107, #110 and every other test of the four files.

## Task 18: worktree.test.ts templates, and the pick-up and continue rows of lines 36-182
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:security-a-ticket-id-cannot-place-a-worktree-outside-its-sibling-folder, packages/cli/test/worktree.test.ts#risk:complex-branching-pick-up-refuses-a-ticket-that-origin-main-lacks, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-reaches-a-ticket-whose-file-is-only-on-its-branch-in-the-sibling-worktree, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-reaches-a-ticket-whose-file-is-only-on-a-local-branch-with-no-worktree, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-reaches-a-ticket-whose-branch-is-only-on-origin-and-tracks-it, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-never-claims-a-ticket, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-of-an-id-that-is-no-ticket-names-it-and-creates-nothing, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-prunes-a-worktree-whose-folder-was-deleted-by-hand

Rows: #15, #36, #42, #49, #59, #66, #84, #111.

Consumes: `makeTemplate`, `copyClone`. Produces the file's template wiring, which Tasks 19 to 26 extend:
- `const TEMPLATE_OPTS: Parameters<typeof makeClone>[0][]` listing the opts the template rows use;
  `const TEMPLATES = new Map<string, Clone>()`; `key = (o) => JSON.stringify(o ?? {})`;
  `beforeAll(() => { for (const o of TEMPLATE_OPTS) TEMPLATES.set(key(o), makeTemplate(o)); }, 180_000)`;
  `afterAll(() => { for (const t of TEMPLATES.values()) t.cleanupAll(); })`.
- `copy(opts)`: `copyClone` of `TEMPLATES.get(key(opts))`, throwing `no template for <key>; add it to TEMPLATE_OPTS`
  when missing, pushed to `clones` so `afterEach` removes it. Rows that list H1 use `copy`; the existing `clone`
  stays for every test the table does not list.
- #36 (ST-LN-7 ac-1): `copy`; one `worktree list --porcelain` read serves the checks of :44 and :45.
- #42, #49 (ST-LN-7 ac-2), #59, #66 (ST-LN-7 ac-3, keeps its fetch), #111: `copy`; assertions in place.
- #15: three tests per row #15 (assertions 119-121, 132-135, 146-150 verbatim; the third uses the copy's
  `otherClone`, H2).
- #84: two tests per row #84 (156-157 with 161-164; 159-160 with 161-163).

Test first: #42 on `copy`, which proves the wiring on one row; then the rest.

Must not change: `clone`, `afterEach`, the mocks of :11-20, every test the table does not list.

## Task 19: worktree.test.ts hold rows of lines 195-305
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-the-holding-session-re-enters-its-own-hold-and-a-partial-table-refuses, packages/cli/test/worktree.test.ts#risk:complex-branching-a-session-with-the-holding-marker-under-another-pid-re-enters-the-hold, packages/cli/test/worktree.test.ts#risk:complex-branching-a-session-that-cannot-see-itself-in-the-process-table-is-refused-and-the-hold-is-unchanged, packages/cli/test/worktree.test.ts#risk:complex-branching-outside-claude-code-no-hold-is-taken-and-one-line-says-so, packages/cli/test/worktree.test.ts#risk:concurrency-a-locked-hold-file-is-never-overwritten, packages/cli/test/worktree.test.ts#risk:complex-branching-a-worktree-whose-setup-never-finished-reruns-setup-in-full, packages/cli/test/worktree.test.ts#risk:complex-branching-a-hand-made-worktree-with-no-done-marker-reruns-setup-in-full-and-exits-2-on-its-failure, packages/cli/test/worktree.test.ts#risk:complex-branching-a-pick-up-whose-setup-fails-leaves-no-done-marker

Rows: #27, #47, #48, #62, #82.

Consumes: Task 18's `copy` and `TEMPLATE_OPTS` (add any opts these rows need). Produces:
- #48 (ST-LN-7 ac-4): `copy`; the pick-up becomes `git worktree add -b t/ST-9 <sibling> origin/main` (H3); H7
  (`git remote remove origin` first); 199-217 stay; its pick-up exit 0 (197) is made by #36.
- #27: three tests per row #27 (worktree add by git, H7); assertions 232-234, 232-234 for again(C), 242 and 246-248.
- #82, #62: `copy`, H3, H7; #62 keeps the 15 s bound at :278.
- #47: three tests per row #47 (H3, H7); 290-293; 300-302; 297-298 plus one `rev-parse`; the pick-up exit 2 (296)
  is made by #49.

Test first: #27's third destination.

Must not change: `A`, `B`, `envOf`, `tableOf`, `setTable`, `holdsFile`, `HELD`, and every unlisted test.

## Task 20: worktree.test.ts clean and claim rows of lines 384-760
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-a-failed-fetch-is-said-and-the-refs-in-the-clone-are-judged, packages/cli/test/worktree.test.ts#risk:complex-branching-clean-with-no-origin-prints-nothing-and-a-failed-fetch-with-no-ticket-branch-prints-only-that, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-unpushed-commits-and-new-files-that-git-status-config-would-hide, packages/cli/test/worktree.test.ts#risk:data-loss-a-failed-push-keeps-the-claim-commit-and-names-the-quoted-push-to-run, packages/cli/test/worktree.test.ts#risk:data-loss-a-holds-file-that-is-not-a-JSON-object-keeps-a-merged-clean-worktree-and-clean-exits-0, packages/cli/test/worktree.test.ts#risk:complex-branching-pick-up-refuses-a-branch-another-person-claimed, packages/cli/test/worktree.test.ts#risk:complex-branching-pick-up-reuses-a-branch-claimed-by-the-same-email, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-opens-a-ticket-another-person-claimed-and-a-later-pick-up-still-refuses

Rows: #34, #50, #56, #72, #75, #77, #113.

Consumes: `copy`, `doneOnRemote` (:340), `mergeOnRemote`. Produces:
- #56 (ST-LN-7 ac-5, kept, ceiling 18 s): `copy`; `doneOnRemote` pushes all its branches in one `git push` (the
  same refs result; every caller of `doneOnRemote` gets it, and no caller's assertion changes).
- #72 (ST-LN-20 ac-1, kept, ceiling 13 s): `copy`; one push for the three ticket branches; H5 not taken.
- #50 (kept, ceiling 18 s): `copy`; no split (the two-branch clean of 446-460 and the d clone stay).
- #75: two tests per row #75. #77: two tests per row #77 (its first title holds commas: run, not named above).
- #34: six tests per row #34, each pushing only the branches it needs; in the last, `entries` length 3 becomes 2
  (no ST-10 worktree) and it still asserts the refusal adds no worktree.
- #113: `copy`, no H7 (it must keep origin); assertions in place.

Test first: #75's second destination.

Must not change: `ticketWorktree`, `mergeOnRemote`, `doneTicket`, `ticketBranch`, the end state `doneOnRemote`
leaves, and every unlisted test.

## Task 21: worktree.test.ts Claude Code session rows of lines 947-1160
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-worktree-pinned-to-another-accord-version-refuses-before-setup-and-prints-no-enter, packages/cli/test/worktree.test.ts#risk:complex-branching-outside-claude-code-a-worktree-pinned-to-another-accord-version-still-prints-the-stop-lines, packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-pick-up-whose-origin-main-pins-another-version-refuses-and-names-the-main-checkout

Rows: #18, #52, #80, #86, #97.

Consumes: `copy`. Produces:
- #97 (ST-LN-27 ac-1): `copy`; the 962 continue run is dropped (its HELD check is made by #27's title test);
  951-961 stay.
- #80 (ST-LN-27 ac-2, kept, ceiling 12 s): `copy`, H2, H3 (the pick-up becomes `worktree add`; 967 was not asserted).
- #86: three tests per row #86 (998-1002; 1004-1005; 1015-1021).
- #18 (ST-LN-27 ac-4, kept, ceiling 32 s): `copy` only; no split; the pick-up run (1071) stays.
- #52 (ST-LN-27 ac-5, kept, ceiling 18 s): `copy` (H6 by the template).

Test first: #86's second destination. The four criterion tests must pass with every assertion line unchanged.

Must not change: `C`, `C3`, `WORKS`, and every unlisted test.

## Task 22: worktree.test.ts session and hold rows of lines 1163-1407
covers: D-05, D-11
files: packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-a-claude-code-session-that-sets-no-session-variables-keeps-the-main-checkout-flows-and-only-the-folder-rule-refuses-it, packages/cli/test/worktree.test.ts#risk:complex-branching-a-claude-code-session-without-session-variables-gets-the-stop-lines-from-a-new-worktree-ticket, packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-pick-up-whose-setup-failed-still-holds-its-ticket-and-refuses-a-second-one, packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-continue-after-a-failed-pick-up-setup-reruns-setup-and-is-not-refused, packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-new-ticket-whose-push-failed-still-holds-it-and-refuses-a-second-one, packages/cli/test/worktree.test.ts#risk:data-loss-clean-removes-a-held-done-worktree-and-its-hold-and-keeps-the-worked-record, packages/cli/test/worktree.test.ts#risk:complex-branching-a-session-whose-hold-was-cleaned-or-taken-over-still-works-its-ticket-when-resumed-in-the-main-checkout, packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-pick-up-records-the-session-as-working-its-ticket, packages/cli/test/worktree.test.ts#risk:complex-branching-a-session-recorded-as-working-a-ticket-whose-worktree-is-gone-is-refused-other-tickets-in-the-main-checkout

Rows: #24, #58, #88, #89.

Consumes: `copy`, `writeHolds`, `readHolds`, `LIVE`, `DEAD`. Produces:
- #88: two tests per row #88; the first keeps the refusal from the ST-9 worktree the pick-up made.
- #58: three tests per row #58 (H3, H7; the second sets worktree and hold A by git and fs).
- #24: four tests per row #24 (H2, H3, H7); the last is new (1301: worked is `ST-9\tsess-A` after a pick-up); its
  dropped CLI checks are made by #97 (1298-1299, 1325-1326) and #27's title test (1300).
- #89: two tests per row #89 (1359-1389; 1393-1406 with the worked file and LIVE hold written by fs).
  `requestLatest` and `cachePath` are already mocked for every CLI test by `packages/cli/test/setup.ts:7-16`; the
  first test also sets `LOCALAPPDATA` and `XDG_CACHE_HOME` to a temp folder with `vi.stubEnv` and restores them with
  `vi.unstubAllEnvs()`, as the row asks.

Test first: #89's second destination.

Must not change: every unlisted test, the hook and hold helpers.

## Task 23: worktree.test.ts dropped-ticket clean rows of lines 1445-1665
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-dropped-ticket-whose-origin-branch-has-commits-not-here-or-has-diverged, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-dropped-ticket-whose-local-and-origin-branches-have-diverged, packages/cli/test/worktree.test.ts#risk:data-loss-clean-deletes-a-dropped-ticket-branch-that-exists-on-one-side-only-when-nothing-is-lost, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-everything-of-a-dropped-ticket-that-a-guard-keeps-or-whose-worktree-remove-fails, packages/cli/test/worktree.test.ts#risk:data-loss-a-second-clone-deletes-its-local-branch-of-a-dropped-ticket-another-clone-cleaned, packages/cli/test/worktree.test.ts#risk:data-loss-a-second-clone-keeps-its-local-branch-of-a-cleaned-dropped-ticket-that-has-commits-not-on-origin, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-the-local-branch-of-a-dropped-ticket-that-moved-after-clean-read-it, packages/cli/test/worktree.test.ts#risk:complex-branching-pick-up-refuses-a-ticket-the-default-branch-holds-as-dropped, packages/cli/test/worktree.test.ts#risk:complex-branching-continue-still-opens-a-ticket-the-default-branch-holds-as-dropped

Rows: #45, #67, #92, #93, #98, #101, #103, #105.

Consumes: `copy`, `claimWorktree`, `dropOnRemote`, `dropAndMerge`, `has`. Produces:
- #105 (ST-LN-34 ac-3): `copy`; one real `accord drop` then `accord worktree clean` stays; H3 and H5 not taken.
- #103 (ST-LN-34 ac-4): `copy`; H3 `dropOnRemote` instead of `drop` (its exit 0 at 1439 is made by #32 and #105);
  1465-1469 stay.
- #101: two tests per row #101 (1482 first, 1485 second, 1486-1488 in both).
- #93, #92: `copy`, no split (one clean judges ST-9 to ST-11, and the 4-branch clean at :1527, stay whole).
- #67: two tests per row #67; c's clean becomes `git push origin --delete t/ST-9` (1597-1598 are made by #105).
- #98: `copy`. #45: three tests per row #45 (1653-1657; 1658-1661; 1662-1664).

Test first: #101's second destination.

Must not change: `has`, `claimWorktree`, `dropOnRemote`, `dropAndMerge`, every unlisted test.

## Task 24: worktree.test.ts fetch and merge rows of lines 1676-1860
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-worktree-merge-refuses-a-ticket-before-verify-and-merges-nothing, packages/cli/test/worktree.test.ts#risk:complex-branching-worktree-merge-refuses-on-a-branch-other-than-the-ticket's-and-merges-nothing, packages/cli/test/worktree.test.ts#risk:complex-branching-worktree-merge-refuses-over-tracked-changes-and-merges-nothing

Rows: #65, #70, #76, #85.

Consumes: `copy`, `pushNext`, `verifyStage`, `pushMain`. Produces:
- #65 (ST-LN-30 ac-1, kept, ceiling 14 s), #85 (ST-LN-30 ac-3, kept, ceiling 11 s), #76 (ST-LN-30 ac-4, kept,
  ceiling 12 s): `copy` (H2, H6 by the template); no part moved; every assertion in place.
- #70: three tests per row #70 (1831-1835, 1843-1846, 1856-1859).

Test first: #70's first destination.

Must not change: `pushNext`, `verifyStage`, `pushMain`, every unlisted test.

## Task 25: worktree.test.ts merge and continue rows of lines 1862-2162
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:data-loss-worktree-merge-never-overwrites-an-ignored-file-and-quotes-the-git-error-that-stopped-it, packages/cli/test/worktree.test.ts#risk:data-loss-worktree-merge-never-overwrites-an-ignored-file-that-a-rename-on-main-targets, packages/cli/test/worktree.test.ts#risk:data-loss-worktree-merge-names-a-non-ASCII-ignored-file-it-would-overwrite, packages/cli/test/worktree.test.ts#risk:complex-branching-worktree-merge-takes-a-case-only-rename-on-main-of-a-tracked-file, packages/cli/test/worktree.test.ts#risk:regression-worktree-merge-of-a-main-that-adds-500-long-paths-passes-the-Windows-command-line-limit, packages/cli/test/worktree.test.ts#risk:data-loss-a-continue-merge-that-conflicts-is-aborted-names-the-file-and-pushes-nothing, packages/cli/test/worktree.test.ts#risk:data-loss-continue-does-not-merge-into-a-worktree-with-uncommitted-changes-and-says-it-is-behind, packages/cli/test/worktree.test.ts#risk:data-loss-continue-does-not-merge-into-a-worktree-a-live-session-holds-and-says-it-is-behind, packages/cli/test/worktree.test.ts#risk:data-loss-continue-does-not-merge-into-a-branch-whose-origin-copy-has-a-teammate-commit-and-pushes-nothing

Rows: #21, #26, #38, #55.

Consumes: `copy`, `pushMain`, `verifyStage`. Produces:
- #21: five tests per row #21 (1875-1880, 1896-1899, 1914-1917, 1932-1934, 1950-1952 verbatim; the last with fs
  writes); the first keeps the title (block c).
- #26: four tests per row #26 (2101-2109, 2127-2131, 2140-2144, 2157-2161).
- #38 (ST-LN-30 ac-5, kept, ceiling 22 s): `copy` (H6 by the template); every assertion in place.
- #55 (ST-LN-25 ac-4, kept, ceiling 18 s): `copy`, H2; no part moved; H7 not used (the scenario names the fetch).

Test first: #21's third destination.

Must not change: every unlisted test.

## Task 26: worktree.test.ts done-ticket clean rows of lines 2164-2376
covers: D-04, D-05, D-11
files: packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:data-loss-clean-removes-only-a-done-ticket-and-keeps-a-branch-with-a-commit-after-its-verified-commit, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-done-ticket-branch-that-a-stopped-rebase-in-its-worktree-is-rebuilding, packages/cli/test/worktree.test.ts#risk:data-loss-clean-deletes-a-done-lane-S-branch-with-no-verified-commit-only-when-its-merge-into-main-changes-nothing, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-done-lane-S-branch-whose-merge-into-main-conflicts, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-done-lane-S-origin-branch-whose-merge-into-main-conflicts, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-done-ticket-branch-whose-commit-after-verify-conflicts-with-main, packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-an-origin-branch-whose-lease-is-stale-and-names-the-failed-push, packages/cli/test/worktree.test.ts#risk:data-loss-clean-after-a-failed-fetch-deletes-the-local-branch-and-never-the-origin-branch, packages/cli/test/worktree.test.ts#risk:data-loss-clean-deletes-no-origin-branch-that-the-prune-already-removed

Rows: #5, #14, #31.

Consumes: `copy`, `copyClone`, `doneOnRemote`, `laneSBranch` (:2166, used by #5 only), `gateReadyIn`, `P`.
Produces:
- `laneSBranch`: the `gate ready` run (:2171) becomes core: read the sibling's `accord/config.yml` and ticket into a
  files map, `expect(gateReadyIn(files, id)).toBe('pass')`, write the ticket back. Its CLI exit 0 is made by #63.
- #5: six tests per row #5. The first keeps the title and block c whole (ST-9, ST-10 merged and not done, ST-11 in
  one clean, with the ordered `toEqual` at 2188-2193 and 2194-2199); the third is block f whole (ST-12 and ST-13 in
  one clean, r3's 4-line `toEqual`); block g split per clean. Assertion map per row #5.
- #31: three tests per row #31 (2316-2322, 2331-2335, 2343-2346).
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
the task may confirm them. Run `git diff 2746d3aa6eedd3ff940f82fa5fe7ef0decc132d8 -- <each file>` and confirm it is
empty, then run the six files and report each row's alone time and, for kept rows, its ceiling (#8 49 s, #25 27 s,
#11 44 s, #16 33 s, #22 30 s, #23 28 s, #29 26 s, #33 25 s, #37 23 s). A non-empty diff is reported, not reverted.

Must not change: any of the six files.

## Task 28: Audit the assertion maps of the worktree.test.ts rows
covers: D-05, D-07
files: packages/cli/test/worktree.test.ts
verify: check:assertion-map-audit-of-the-worktree-rows

Rows: none (it audits the 48 rows of Tasks 18 to 26).

For each of the 48 rows of `worktree.test.ts` (every one changes in setup or is split), read the old
test in `git show 2746d3aa6eedd3ff940f82fa5fe7ef0decc132d8:packages/cli/test/worktree.test.ts` and the new tests at
HEAD, and check every old `expect` against the row's note column: it is in the place the note names (for a kept or
faster row, on the same check in the same test), or the note names the other test that makes a dropped CLI exit or
output check and that test still asserts it (D-07's reading of ac-4). Work region by region (Tasks 18 to 26), so the
diff read at a time stays small.

Output: a list of rows with any old assertion that has no match, each with its old line and what is missing. A gap
that is a plain omission (the note places the assertion and the code lacks it) is restored in place and named in
the report; any other gap is reported, not fixed. An empty list is the pass.

Must not change: any test beyond restoring a missing assertion the note places.

## Task 29: Audit the assertion maps of every other changed row
covers: D-05, D-07
files: packages/cli/test/show-approval.test.ts, packages/cli/test/workflow-script.test.ts, packages/cli/test/lane-s.test.ts, packages/cli/test/after-verify.test.ts, packages/cli/test/drop.test.ts, packages/cli/test/upgrade.test.ts, packages/cli/test/hook.test.ts, packages/cli/test/dashboard.test.ts, packages/cli/test/show.test.ts, packages/cli/test/status.test.ts, packages/cli/test/lane-flow.test.ts, packages/core/test/benchmark-compliance.test.ts, packages/cli/test/lane-commands.test.ts, packages/cli/test/new-ticket.test.ts, packages/cli/test/bin.test.ts
verify: check:assertion-map-audit-of-every-changed-row

Rows: none (it audits the changed rows of Tasks 6 to 17).

The same audit as Task 28, for the rows of Tasks 6 to 17 whose body changed (every row there except #63, #94,
#102, #104, #106, #107, #109, #110), against `git show 2746d3aa6eedd3ff940f82fa5fe7ef0decc132d8:<file>`. Report
the result together with Task 28's; Task 30's ac-4 test then checks the same maps mechanically.

Must not change: any test beyond restoring a missing assertion the note places.

## Task 30: Four repository-reading tests prove ac-1 to ac-4 from the committed runs and the table
covers: @ac-1, @ac-2, @ac-3, @ac-4, D-01, D-02, D-03, D-04, D-06, D-07
files: packages/core/test/st-ln-44.test.ts (new)
verify: packages/core/test/st-ln-44.test.ts#ac-1-no-test-in-the-measuring-run-takes-over-10-s-apart-from-a-kept-row-within-its-ceiling (@ac-1), packages/core/test/st-ln-44.test.ts#ac-2-every-test-tag-of-another-ticket-names-one-passing-test-and-lint-reports-no-error (@ac-2), packages/core/test/st-ln-44.test.ts#ac-3-every-test-gone-since-the-baseline-run-is-a-row-the-table-moves-and-every-destination-exists (@ac-3), packages/core/test/st-ln-44.test.ts#ac-4-every-assertion-of-a-faster-or-moved-row-is-in-its-new-place-or-mapped-by-the-row-note (@ac-4)

Rows: none (it proves the criteria over all 113 rows).

Precondition: Tasks 1 to 29 are done, and their reports (the per-row assertion maps and text changes) are in the
brief or given with it. The tests read `accord/tickets/ST-LN-44/after-junit.xml`, which exists only after Task 31 and
Main session step 2; until then they fail with `accord/tickets/ST-LN-44/after-junit.xml is missing: run Task 31 and
Main session step 2`. That failure is expected when this task ends, and in Task 31's own run. They never skip.

The ST-LN-48 precedent: `packages/core/test/stage-baseline.test.ts` proves a process criterion by reading committed
artifacts with core, and so does this file. Each test runs well under 10 s: no CLI run, at most one `git` spawn per
test file read at the baseline (cached in a module-level `Map`), and one `git ls-files`.

Shared code, at the top of the new file (imports: `node:child_process`, `node:fs`, `vitest`, and `loadSnapshot`,
`lintSnapshot` from `../src/index.js`, and `scanJUnit` from `../src/load/junit.js`, which index.ts does not export;
no core source changes, D-11):
- `ROOT = new URL('../../../', import.meta.url)`, `DIR = new URL('accord/tickets/ST-LN-44/', ROOT)`,
  `BASE = '2746d3aa6eedd3ff940f82fa5fe7ef0decc132d8'`. A header comment says the file proves ST-LN-44's criteria
  and is deleted with `accord/tickets/ST-LN-44/after-junit.xml` once the ticket is done, as stage-baseline.test.ts
  says of its own.
- `cases(xml)`: every `<testcase ...>` of a junit text as `{ file, title, time, status }`: `classname` is `file`,
  `name` is `title` (describe titles and the `it` title joined by ` > `), both XML-unescaped (`&lt;`, `&gt;`,
  `&quot;`, `&apos;`, `&amp;`, last); `status` is `failed` when the element holds `<failure` or `<error`, `skipped`
  when it holds `<skipped`, `passed` otherwise. `after()` reads after-junit.xml (failing with the message above when
  missing); `before()` reads `baseline-junit.xml`.
- `rows()`: parse `table.md`'s table: every line starting `| ` followed by a row number, split on ` | `, giving `n`,
  `file` (`'packages/' + column 2`), `title`, `tag`, `action`, `destinations` (column 7 split on `<br>`, each
  `file :: title` split on ` :: `; `-` means none), and `note`; `ceiling` is the number of `Ceiling (\d+) s` in the
  note. `expect(rows().length).toBe(113)` in the first test that reads it.
- `atBase(file)`: `execFileSync('git', ['-c', 'log.showSignature=false', 'show', '--no-show-signature',
  BASE + ':' + file], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })`, cached; `''` when git fails
  (the file did not exist).
- `body(source, title)`: the text of the test whose last ` > ` segment of `title` appears as a quoted string at an
  `it(` call (`it('`, `it("`, or `it.<modifier>(...)('`), from that line to the first line after it that starts with
  the same indentation followed by `})` or `}, ` (the close of the callback); `undefined` when absent.
- `expects(text)`: every statement that starts at `expect(`, read with a parenthesis counter that skips quoted
  strings, up to its closing `;`, with every run of whitespace turned into one space.

Tests first, in this order, each top-level, each with its exact title:
- `it('ac-1 no test in the measuring run takes over 10 s apart from a kept row within its ceiling')`: for every case
  of `after()` with `time > 10`, find the row with the same `file` and `title`; collect it unless that row's action
  is `kept` and `time <= ceiling`; `expect(over).toEqual([])` with entries `file > title: time s`. Also
  `expect` the case of row #2 to be present with status other than `skipped` (Git Bash ran the executed cases; ledger
  Ruling on ACCORD_BASH).
- `it('ac-2 every test tag of another ticket names one passing test and lint reports no error')`:
  - `input`: the files of the `accord/` folder (read as `accordInput` in stage-baseline.test.ts does; copy those four
    lines, never import a test file), plus the key `node_modules/.cache/accord/junit.xml` (this repository's
    `tests.report`) holding after-junit.xml's text; `tree` is `git ls-files -z` of ROOT split on NUL (conventions.md)
    plus the report key.
  - `snap = loadSnapshot(input)`; `expect(lintSnapshot(snap).findings.filter((f) => f.level === 'error'))
    .toEqual([])`.
  - `ids = scanJUnit(after-junit text)`. For every ticket other than ST-LN-44 and each scenario's `@test:<id>` tag:
    the report has exactly one case with that id (count `cases()` whose `file + '#' + title` with whitespace runs
    turned into `-` equals it) and `ids[id] === 'passed'`; collect failures as `<ticket> <ac> <id>: <why>`, expect
    `[]`. ST-LN-44 is left out: its own tags name these four tests, which fail in the run they read.
- `it('ac-3 every test gone since the baseline run is a row the table moves and every destination exists')`: the
  before pairs are the `{ file, title }` pairs of `before()` whose last title segment appears in `atBase(file)` (a pair absent from the baseline source left before this ticket); the after pairs
  are `after()`'s. Every before pair missing from after must be the `file`/`title` of a row whose action is
  `removed`, `merged` or `moved`; every destination of a `merged` or `moved` row must be an after pair. Collect both
  kinds of failure, expect `[]`.
- `it('ac-4 every assertion of a faster or moved row is in its new place or mapped by the row note')`: for every row
  whose action is `faster`, `moved` or `merged`:
  - `old = expects(body(atBase(row.file), row.title))`; `undefined` body fails the row.
  - `places`: the row's destinations, or for `faster` the row's own file and title; `now` is the union of
    `expects(body(readFileSync(new URL(place.file, ROOT)), place.title))` over the places, each body required.
  - Every entry of `old` must be in `now`, or be the `old` of an entry of `MAPPED[row.n]`.
  - `MAPPED: Record<number, { old: string; to: string; cite: string }[]>`, a constant in the file, one entry per
    old assertion that a row's note moves off its places or rewrites, transcribed from the note column and the
    reports of Tasks 6 to 26. `cite` is an exact substring of that row's note, asserted with
    `expect(row.note).toContain(cite)`, so every entry rests on the approved table. `to` is either
    `core: <new expect>` (a rewritten or core check, for example #3's `:117` exit 0 becoming
    `expect(gateReadyIn(files, 'S-1')).toBe('pass')`), whose new text must be in `now`, or the junit id of the CLI
    test that takes a dropped CLI check (for example #20's checks made by
    `packages/cli/test/lane-commands.test.ts#accord-approve->-after-approval-gate-ready-passes`), which must be a passed
    case of `after()`.
  - `EXCEPTIONS: Record<number, string>`, a constant of rows whose bodies cannot be paired assertion by assertion,
    each with its reason quoting the note; those rows are skipped by the loop and listed in the task report. Use it
    only when no `MAPPED` pairing fits. The candidates are #2, #6, #17, #35 and #57 if the async rewrite changes the
    assertion text beyond a 1:1 pairing, and #4 if its doubled `fact()` pairs cannot be paired one to one.
  - Collect every unmatched old assertion as `#<n> <file>: <assertion>`, expect `[]`.

Write the shared code and the four tests, run `npx vitest run packages/core/test/st-ln-44.test.ts`, and see each fail
only on the missing after-junit.xml. To check the parsers before Task 31, run them once against a junit of the
task files (`node_modules/.cache/st-ln-44/task-*.xml`) by pointing `after()` at it in a throwaway local edit, and
revert that edit before the task ends.

Report: the `MAPPED` count per row, and every `EXCEPTIONS` entry with its reason.

Must not change: every other test, fixture and helper; `stage-baseline.test.ts`.

## Task 31: The measuring run: one full run, saved with its rule 3 list
covers: D-01, D-02, D-03, D-06
files:
verify: check:measuring-run-rule-3-list

Rows: none (rule 3's measuring run over all 113 rows).

Precondition: Tasks 1 to 30 are done and the main session has done Main session step 1
(`accord/tests-baseline.txt`). This task edits no tracked file; its outputs are its report and two files under
`node_modules/.cache/st-ln-44/`, which Main session step 2 copies into `accord/tickets/ST-LN-44/`.

Run, once, from PowerShell:
`$env:ACCORD_BASH = 'C:\Program Files\Git\bin\bash.exe'`, `npm run build`, then the configured full run
`npx vitest run --reporter=default --reporter=junit --outputFile.junit=node_modules/.cache/accord/junit.xml`, then
copy that report to `node_modules/.cache/st-ln-44/after-junit.xml`. Confirm the executed workflow-script cases ran
(not skipped); if they skipped, the run does not count: fix the environment and run again. Task 30's four tests fail
in this run (after-junit.xml is not committed yet); any other failing case is reported.

Write `node_modules/.cache/st-ln-44/rule3-list.md` with a throwaway Node script kept in the OS temp folder, mapping
each table row, or each of its destinations, to its case by file and title: every row or destination over 5 s,
whatever its action; every faster, moved or unchanged row or destination over 10 s; every kept row over its ceiling;
and every case outside the table over 10 s. One line each: row number, file, title, action, time, ceiling where kept,
and the table's route (a proposed further split or keep is for the owner; this task proposes no new cut). An empty
list is written as `No entry.`.

Report: the rule 3 list, the failing cases other than Task 30's four, and the two file paths.

Must not change: any tracked file.

## Main session steps

These edit files under the top-level `accord/` folder, which no executor touches.

1. Before Task 31 (the update of `accord/tests-baseline.txt` for every baseline title that moved): from the reports of
   Tasks 6 to 26, remove each line reported as `-> gone` and replace each `old id -> new id` in place. Known: row #10
   removes line 129 (`packages/cli/test/lane-flow.test.ts#lane-ticket-flow->-walks-one-ticket-from-unapproved-to-done`;
   its four destinations carry `risk:`); row #73 keeps its title, so line 97 stays. New `risk:` titles need no line.
   Then run `node packages/cli/dist/cli.js lint` and confirm no `lint.test-untraced` finding names a test of this
   ticket.
2. After Task 31: copy `node_modules/.cache/st-ln-44/after-junit.xml` to `accord/tickets/ST-LN-44/after-junit.xml`
   and `node_modules/.cache/st-ln-44/rule3-list.md` to `accord/tickets/ST-LN-44/rule3-list.md`, and commit both. Then
   run `npx vitest run packages/core/test/st-ln-44.test.ts`: the four ac tests now read the committed run. When the
   rule 3 list is not empty, take it to the owner as one list before review (rule 3); a late keep is written into
   table.md and the ticket re-approved as rule 3 says, and a new measuring run (Task 31 again) replaces both files.
