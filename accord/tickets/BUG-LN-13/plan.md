---
baseline: 85b3158334ccd32ed9e48e4a7ce560041b86467b
plan_hash: "fnv1a64:d8da1643cd2e6a7a"
---

# Plan: BUG-LN-13

Review mode `outcome`: one branch, no slices.

The baseline is the fork point named in the ledger's lift Ruling; between it and the approved ticket only `accord/` records changed, so every source path below is as it stands at the baseline.

Each task repeats the rules it needs, since an executor receives one task. Common to all: commits carry no trailer of any kind (no `Co-Authored-By:`, no other line whose first word ends in `-by:`, no "Generated with" line). New test titles hold no `@`, no comma and no apostrophe, and are top-level `it(...)` calls, so the case id is `<test file path>#<title with every run of whitespace as one hyphen>`. A commit a test makes uses `commitMsg` from `packages/cli/test/helpers/repo.ts` (`-F <file> --cleanup=verbatim`), never `-m`. Every CLI test that builds a git repository carries a `120_000` timeout and cleans its copy up in a `finally`. The CLI package resolves `@accord-dev/accord-core` to the built core (`packages/core/package.json` exports `./dist/index.js`), so run `npm run build` after a change under `packages/core/src/` and before running CLI tests.

## Task 1: Reproduce the lane S ticket that leaves YOURS, and wire the default-ref read into the dashboard

covers: @ac-1, D-01, D-04
files: packages/cli/test/done-on-default.test.ts (new), packages/core/src/model/snapshot.ts, packages/core/src/status/stage.ts, packages/core/src/status/dashboard.ts, packages/cli/src/load/fs.ts, packages/cli/src/run.ts
verify: packages/cli/test/done-on-default.test.ts#ac-1-a-lane-S-ticket-reviewed-only-on-its-claim-branch-stays-in-yours-with-its-next-step (@ac-1), packages/cli/test/done-on-default.test.ts#risk:complex-branching-the-default-ref-is-the-origin-one-and-falls-back-to-a-local-main-only-without-an-origin-remote

This is the failing reproduction of BUG-LN-12's case and the wiring of the fix end to end: the CLI resolves the default ref, reads the tickets' records there, hangs that read on the snapshot, and the dashboard judges done from it. Write the template and the ac-1 test first and run them at the baseline: the ac-1 test fails because S-1 is missing from YOURS and the count line says `2 done`.

**Template**, at the top of the new `packages/cli/test/done-on-default.test.ts`, built once in `beforeAll` and copied per test with `copyRepo` (the H1 pattern of `packages/cli/test/dashboard.test.ts` lines 14-49); `afterAll` cleans it up. Tasks 2, 3 and 5 reuse it unchanged.
- Imports: `appendFileSync`, `readFileSync` from `node:fs`; `join` from `node:path`; `cleanup`, `commitMsg`, `copyRepo`, `gitRun`, `makeEmptyRepo`, `run`, `writeFiles` from `./helpers/repo.js`; `AC`, `approve`, `CONFIG`, `done`, `gateReadyIn`, `LANE_S_BODY`, `laneTicket`, `P` and the type `Files` from `../../../test/helpers/lane.js`; `setFrontmatterKey` from `@accord-dev/accord-core`; `doneRef` from `../src/load/fs.js`.
- `const REVIEWED = '## Round 1\n\nNo findings\n\nverdict: converged\n';`
- Files: `accord/config.yml` = `CONFIG`; `P('S-1')` = `laneTicket('S-1', { lane: 'S', body: LANE_S_BODY })`; `P('T-1')` = `laneTicket('T-1')`; `P('T-2')` = `laneTicket('T-2', { frontmatter: ['depends_on: ["T-1"]'] })`. Then `gateReadyIn(files, 'S-1')` must return `'pass'` (it writes S-1's `ac_hash`; throw if not), `approve(files, 'T-1')`, `approve(files, 'T-2')`.
- `tpl = makeEmptyRepo()`; append `'[user]\n\temail = an@example.com\n\tname = an\n[commit]\n\tgpgsign = false\n'` to `join(tpl, '.git', 'config')` (as `packages/cli/test/lane-s.test.ts` line 70 does), so the viewer and every claim author is `an@example.com`; `writeFiles(tpl, files)`; `commitMsg(tpl, 'base')`; `gitRun(tpl, 'branch', '-M', 'main')`; `gitRun(tpl, 'update-ref', 'refs/remotes/origin/main', 'HEAD')` (origin's default branch, faked with no remote, as other tests fake origin refs).
- `gitRun(tpl, 'switch', '-q', '-c', 't/S-1')`; `writeFiles(tpl, { 'accord/tickets/S-1/review.md': REVIEWED })`; `commitMsg(tpl, 'review: S-1')`; `gitRun(tpl, 'switch', '-q', 'main')`.
- `gitRun(tpl, 'switch', '-q', '-c', 't/T-1')`; `const t1: Files = {}; done(t1, 'T-1'); writeFiles(tpl, t1)`; `commitMsg(tpl, 'verify: T-1')`; `gitRun(tpl, 'switch', '-q', 'main')`.
- Helper `rowsOf(j)` = the `rows` of `j.yours`, `j.team`, `j.ready` and `j.upNext`, flattened; helper `summaryLine(text)` = the line holding `' in progress, '`.

So `main` (and `origin/main`) hold S-1 readied but unreviewed and T-1, T-2 approved; `t/S-1` adds S-1's verdict; `t/T-1` adds T-1's plan, ledger, review and bound ticks.

**Test first**, title `ac-1 a lane S ticket reviewed only on its claim branch stays in yours with its next step`: on a copy (on `main`), `run(['dashboard', '--json'])` exits 0; the row of `j.yours.rows` with id `S-1` exists with `stage` `'done'` and `next` `'the pull request; run accord gate done (lane-s.md)'`; `j.summary.done` is 0. `run(['dashboard'])` exits 0; between the `YOURS` line and the next empty line there is a line starting `  S-1` that contains `done, next: the pull request; run accord gate done (lane-s.md)`; `summaryLine(out)` contains `, 0 done`.

**Second test**, title `risk:complex-branching the default ref is the origin one and falls back to a local main only without an origin remote`, on one copy:
1. `doneRef(copy)` is `'refs/remotes/origin/main'`.
2. `gitRun(copy, 'update-ref', '-d', 'refs/remotes/origin/main')`: `doneRef(copy)` is `'refs/heads/main'`, and `dashboard --json` still lists S-1 in `yours` with `stage` `'done'` (local main lacks its verdict).
3. `gitRun(copy, 'remote', 'add', 'origin', 'https://example.invalid/none.git')` (no fetch is ever run): `doneRef(copy)` is undefined, and `dashboard --json` keeps today's checkout reading: S-1 is in no section and `j.summary.done` is 2 (S-1 and T-1, both done in the claim view).

**Snapshot field**, in `packages/core/src/model/snapshot.ts`, on `RepoSnapshot` only (not on `SnapshotInput`; `loadSnapshot` never sets it, so every golden stays as it is):

```ts
  // BUG-LN-13 D-01: host-supplied after load: the default ref as git names it ('refs/remotes/origin/main', or
  // 'refs/heads/main' in a clone without origin) and a snapshot of the records of the view's tickets and every
  // depends_on entry as that ref holds them. Only the done readers read it; absent when no default ref resolves.
  defaultRef?: { ref: string; snapshot: RepoSnapshot };
```

**Done reader**, in `packages/core/src/status/stage.ts`, after `isDone`:

```ts
/** BUG-LN-13 D-01, D-04: done for the dashboard and for dependants: on the default ref the host read, else in `fallback` (BUG-LN-2 D-04). */
export function doneOnDefault(snapshot: RepoSnapshot, id: string, fallback: RepoSnapshot = snapshot): boolean {
  return isDone(snapshot.defaultRef?.snapshot ?? fallback, id);
}
```

`isDone`, `progressOf`, `nextStep` and both next-step tables do not change.

**Dashboard**, in `packages/core/src/status/dashboard.ts` `dashboard()`:
- `const ref = snapshot.defaultRef;` and `const finished = (r: StatusRow) => (ref === undefined ? r.stage === 'done' : isDone(ref.snapshot, r.id));` (D-01: with a ref read, a row counts as done exactly when it is done there; with none, today's reading, the row's own stage).
- `all` becomes the `statusRows` result mapped so that a row with `isWork(r) && !closed(r) && r.stage === 'done' && !finished(r)` becomes `{ ...r, next: nextStep(snapshot.tickets[r.id], 'done') }` (import `nextStep` from `./stage.js`); every other row is passed through unchanged.
- The module-level `isOpen` becomes `isWork(r) && !closed(r) && !finished(r)`, defined inside `dashboard()` (move it there).
- `first` becomes `rest.find((r) => !blocked(r) && r.stage !== 'done')`: an unclaimed row done only off the default ref is listed in UP NEXT and counted with the backlog, but never offered as Pick up.
- `summary.done` becomes `all.filter((r) => isWork(r) && !closed(r) && finished(r)).length`.
- Behaviour that must not change: without `snapshot.defaultRef` every section, row, count and the suggestion are exactly as at the baseline (every pure `board(...)` test in `packages/cli/test/dashboard.test.ts` proves it); the keys of `Dashboard` and of `summary`; the ranking. `effectivePriorities`, `epicsSection` and `withoutLane` still read `isDone(plain, ...)` in this task (Task 3 moves them).

**Resolver and read**, in `packages/cli/src/load/fs.ts`, placed after `snapshotAt`:

```ts
/** BUG-LN-13 D-01: origin's default ref (gitDefaultRef); in a clone with no `origin` remote, the first of refs/heads/main and refs/heads/master that resolves; else undefined. Never fetches. */
export function doneRef(root: string): string | undefined

/** BUG-LN-13: `snapshot` with `defaultRef` read by snapshotAt at doneRef, over the view's ticket ids and every depends_on entry; `snapshot` itself when no default ref resolves. */
export function withDefaultRef(root: string, snapshot: RepoSnapshot): RepoSnapshot
```

- `doneRef`: `gitDefaultRef(root)` when it returns a ref; otherwise, when `git remote get-url origin` exits 0 (an origin exists whose default branch this clone has not fetched), undefined; otherwise the first of `refs/heads/main`, `refs/heads/master` for which `git rev-parse --verify -q <ref>` exits 0, else undefined. Spawn with `{ cwd: root, ...GIT_QUIET }` inside try/catch, as `defaultRefOf` does.
- `withDefaultRef`: `ref = doneRef(root)`; undefined returns `snapshot` unchanged; otherwise `ids` = the unique union of `Object.keys(snapshot.tickets)` and every `frontmatter.depends_on` entry of those tickets, and the result is `{ ...snapshot, defaultRef: { ref, snapshot: snapshotAt(root, ref, ids) } }`. The ids go to git on stdin (`gitFilesAt`), never on the command line.
- Behaviour that must not change: `gitDefaultRef`, `defaultRefOf`, `snapshotAt`, `gitFilesAt`, `loadClaimView` and `loadFromFs` keep their code and results (`accord worktree clean` and the after-verify read use them).

**Preflight**, in `packages/cli/src/run.ts` `preflight()`: name the loaded snapshot `loaded`; `plain` is computed from `loaded` exactly as today; the pin check reads `loaded.config` exactly as today; after the pin check, `const snapshot = mode === 'claims' ? withDefaultRef(root, loaded) : loaded;` (import `withDefaultRef` beside `loadClaimView`), and the returned context carries that `snapshot`. The comment on `CommandContext.plain` (line 48) becomes: checkout-only snapshot, set under 'claims': `show --approval` reads it, and a dependency counts as done on the default branch (`snapshot.defaultRef`, BUG-LN-13 D-01), here only when no default ref resolves. Behaviour that must not change: the modes `checkout`, `stage` and `light` load exactly as today; root, snapshot, pin stay in that order; `plain` stays the checkout.

Run `npm run build`, then the two tests, then `packages/cli/test/dashboard.test.ts`, `packages/cli/test/show.test.ts` and `packages/cli/test/status.test.ts`, which must stay green unchanged.

## Task 2: A lane M ticket done off the default branch shows the pull request as its next step, and status keeps its shape

covers: @ac-2, @ac-4, D-02, D-05
files: packages/cli/test/done-on-default.test.ts (new), packages/core/src/status/stage.ts
verify: packages/cli/test/done-on-default.test.ts#ac-2-a-ticked-lane-M-ticket-on-its-claim-branch-stays-in-yours-with-the-pull-request-as-its-next-step (@ac-2), packages/cli/test/done-on-default.test.ts#ac-4-status-json-keeps-the-row-keys-and-stage-done-of-a-ticket-done-only-on-its-claim-branch (@ac-4)

Consumes Task 1's template in `packages/cli/test/done-on-default.test.ts` (T-1 is a lane M ticket whose ticks are bound on `t/T-1` only) and its dashboard change, which already keeps T-1 in YOURS. Produces the D-05 text.

**Tests first**, in `packages/cli/test/done-on-default.test.ts`, each on its own `copyRepo` of the template, on `main`:
- Title `ac-2 a ticked lane M ticket on its claim branch stays in yours with the pull request as its next step`: `run(['dashboard', '--json'])` exits 0; the `j.yours.rows` row with id `T-1` has `stage` `'done'` and `next` exactly `'the pull request; run accord gate done'`; `j.summary.done` is 0. `run(['dashboard'])`: the YOURS line starting `  T-1` contains `done, next: the pull request; run accord gate done` and does not contain `lane-s.md`; `summaryLine(out)` contains `, 0 done`. It fails at the start of this task on the text, which reads `nothing; run accord gate done`.
- Title `ac-4 status json keeps the row keys and stage done of a ticket done only on its claim branch`: `run(['status', '--json'])` exits 0; for each of `T-1` and `S-1`, `Object.keys(row)` equals `['id', 'type', 'status', 'ui', 'errors', 'warnings', 'ready', 'ticksVerified', 'ticksTagged', 'ticksBinding', 'title', 'lane', 'stage', 'tasksDone', 'tasksTotal', 'claimedBy', 'branch']` (the keys and order `statusRows` writes at the baseline for a claimed lane row with no `depends_on`, tracker, parent or idle days) and `row.stage` is `'done'`. This test passes at the start of the task too: it guards D-02 against the dashboard-only `next` reaching status rows.

**Change**, in `packages/core/src/status/stage.ts`: `NEXT.done` becomes `'the pull request; run accord gate done'` (D-05). `accord anchor` prints it through `nextStep` for a lane M ticket at done as well. Behaviour that must not change: `LANE_S_NEXT`, the other `NEXT` entries, `nextStep`, and `statusRows`, which still sets `next` only at intent and at a lane S review, so `accord status --json` keeps its keys and its `stage` values (D-02).

## Task 3: Status, show, next and the dashboard judge a prerequisite on the default ref

covers: D-01
files: packages/cli/test/done-on-default.test.ts (new), packages/core/test/done-on-default.test.ts (new), packages/core/src/status/rows.ts, packages/core/src/status/dashboard.ts, packages/core/src/status/show.ts, packages/cli/src/commands/next.ts, packages/cli/src/run.ts
verify: packages/cli/test/done-on-default.test.ts#risk:complex-branching-show-and-next-keep-a-dependant-blocked-while-its-prerequisite-is-done-only-on-its-own-branch, packages/core/test/done-on-default.test.ts#risk:complex-branching-epic-counts-priority-lifts-and-laneless-tickets-read-done-on-the-default-ref

Consumes `doneOnDefault` from `packages/core/src/status/stage.ts`, the `defaultRef` field and `withDefaultRef` (Task 1). Produces: every done reader that judges a prerequisite or a finished ticket reads the default ref, and `accord next` reads through the claims preflight (the approach's answer to the critic's Must that `next` and `show` would otherwise let a dependant start).

**CLI test first**, in `packages/cli/test/done-on-default.test.ts`, title `risk:complex-branching show and next keep a dependant blocked while its prerequisite is done only on its own branch`, on one copy of Task 1's template:
1. `gitRun(copy, 'switch', '-q', 't/T-1')`: the checkout is T-1's own branch, where T-1's records give stage done.
2. Write `P('T-2')` = `setFrontmatterKey(readFileSync(join(copy, 'accord', 'tickets', 'T-2.md'), 'utf8'), 'ac_hash', AC)` into the working tree (no commit), so T-2 would be offered by `next` once unblocked.
3. `run(['show', 'T-2', '--json'])` parses to `blockedBy` `['T-1']`; the ids of `run(['next', '--json'])` do not contain `T-2`. At the baseline both read the checkout, where T-1 is done, so the test fails there.
4. `gitRun(copy, 'update-ref', 'refs/remotes/origin/main', 't/T-1')` (T-1's records reach the default ref): `show T-2 --json` has `blockedBy` `[]` and the ids of `next --json` are `['T-2']`.

**Core test first**, in the new `packages/core/test/done-on-default.test.ts` (`dashboard`, `loadSnapshot`, `setFrontmatterKey` from `../src/index.js`; `AC`, `CONFIG`, `done`, `laneTicket`, `P`, `ready` and the type `Files` from `../../../test/helpers/lane.js`), title `risk:complex-branching epic counts priority lifts and laneless tickets read done on the default ref`. Files, all with `accord/config.yml` = `CONFIG`:
- `EP-1` = `laneTicket('EP-1', { lane: '' }).replace('type: story', 'type: epic')`;
- `done(files, 'C-1', { frontmatter: ['parent: "EP-1"'] })`;
- `L-1` = `laneTicket('L-1', { lane: '' })` with `verified` `['ac-1', 'ac-2']` and `verified_hash` `AC` set by `setFrontmatterKey` (its ticks are bound);
- `ready(files, 'P-1', { frontmatter: ['priority: low'] })`, `ready(files, 'Q-1')`;
- `done(files, 'D-1', { frontmatter: ['priority: high', 'depends_on: ["P-1"]'] })`.
`snap = loadSnapshot({ files, tree: [] })`; `ref` = `loadSnapshot` of `CONFIG` plus `C-1`, `L-1`, `D-1` as plain `laneTicket` texts (C-1 and D-1 lane M, L-1 laneless, none done). Assert:
- `dashboard(snap, 'an@example.com')`: `epics.rows[0]` has `done` 1 of `total` 1; `summary.withoutLane` 0; `ready.rows` ids `['Q-1', 'P-1']`; `summary.done` 2.
- `dashboard({ ...snap, defaultRef: { ref: 'refs/remotes/origin/main', snapshot: ref } }, 'an@example.com')`: `epics.rows[0].done` 0; `summary.withoutLane` 1; `ready.rows` ids `['P-1', 'Q-1']` (D-1 is not done on the ref, so its high priority lifts P-1); `summary.done` 0; the sorted ids of `upNext.rows` are `['C-1', 'D-1']`, each with `next` `'the pull request; run accord gate done'`; `upNext.suggest` is undefined (C-1 is unblocked but done only off the ref, so it is never offered).

**Changes**:
- `packages/core/src/status/rows.ts` line 92: `blockedBy: deps.filter((d) => !doneOnDefault(snapshot, d, plain ?? snapshot))` (import `doneOnDefault`). The doc comment at line 51 says: a dependency counts as done on the default branch the host read (`snapshot.defaultRef`, BUG-LN-13 D-01), else in `plain`, the checkout (spec §5, BUG-LN-2 D-04). Behaviour that must not change: every other row field, the key set and order, `stage`, and `blockedBy` without the field.
- `packages/core/src/status/dashboard.ts`: in `effectivePriorities` the lift reads `!doneOnDefault(snapshot, id, plain)`; in `epicsSection` the child count reads `doneOnDefault(snapshot, k, plain)`; `withoutLane` reads `!doneOnDefault(snapshot, r.id, plain)` (a ticket without lane counts as done there when its ticks are bound, `isDone`'s rule, per the ledger). Behaviour that must not change: Task 1's section and count rules and everything without the field.
- `packages/core/src/status/show.ts` line 33: the doc comment says `blockedBy` is decided on the default branch the host read (`snapshot.defaultRef`), else by `plain`, the checkout (BUG-LN-2 D-04, D-05, BUG-LN-13 D-01). No code change: `blockedBy` comes from `statusRows`.
- `packages/cli/src/commands/next.ts`: `nextRows(statusRows(ctx.snapshot, undefined, ctx.plain))`. Output text and JSON stay as they are.
- `packages/cli/src/run.ts`: the `next` action calls `next(preflight(opts, 'claims'), options)`. Its description and options stay as they are; the claims load also reads plan facts, so `next` keeps the plan hold of BUG-LN-2.

Then run `packages/cli/test/lane-commands.test.ts` (its `next` tests, including the broken claim ref that must still exit 2 naming `git for-each-ref failed`), `packages/cli/test/dashboard.test.ts` and `packages/core/test/lane-status.test.ts`; they stay green unchanged.

## Task 4: gate ready refuses a prerequisite not done on the default ref

covers: D-06
files: packages/core/test/done-on-default.test.ts (new), packages/core/src/gate/ready.ts, packages/core/src/gate/rules.ts, packages/core/test/gate.test.ts, packages/cli/test/dashboard.test.ts
verify: packages/core/test/done-on-default.test.ts#risk:complex-branching-gate-ready-waits-on-each-prerequisite-not-done-on-the-default-ref-and-asks-to-re-plan-without-one-dropped-there

Consumes `doneOnDefault` and the `defaultRef` field (Task 1). Produces the Ready rule `gate.depends-unmerged`; Task 5 wires it to the CLI.

**Test first**, in `packages/core/test/done-on-default.test.ts`, title `risk:complex-branching gate ready waits on each prerequisite not done on the default ref and asks to re-plan without one dropped there`. Files with `CONFIG`: `A` = `laneTicket('A')`; `done(files, 'C')`; `D` = `laneTicket('D', { frontmatter: ['status: dropped'], body: LANE_BODY + '\n## Dropped\nNot needed.\n' })`; `B` = `laneTicket('B', { frontmatter: ['depends_on: ["A", "C", "D", "NOPE"]'] })`, then `approve(files, 'B')`. Import `gateReady` and `loadSnapshot` from `../src/index.js`, and `approve`, `CONFIG`, `done`, `LANE_BODY`, `laneTicket`, `P` from `../../../test/helpers/lane.js`. `snap = loadSnapshot({ files, tree: [] })`.
- `r = gateReady(snap, 'B')`: `r.verdict` is `'fail'`; the findings with rule `gate.depends-unmerged` are exactly one, pointer `/depends_on/0`, reason containing `"A"`, `in this checkout` and `never remove it from depends_on`; findings with rules `lint.depends-dropped` (pointer `/depends_on/2`) and `lint.depends-unknown` (pointer `/depends_on/3`) are present, and no `gate.depends-unmerged` finding names `"D"` or `"NOPE"`.
- With `refFiles` = `CONFIG`, `done(refFiles, 'A')` and `C` = `laneTicket('C')`, `gateReady({ ...snap, defaultRef: { ref: 'refs/remotes/origin/main', snapshot: loadSnapshot({ files: refFiles, tree: [] }) } }, 'B')`: exactly one `gate.depends-unmerged` finding, pointer `/depends_on/1`, reason containing `"C"` and `on origin/main`.
- With `droppedFiles` = `CONFIG`, `done(droppedFiles, 'C')` and `A` = `laneTicket('A', { frontmatter: ['status: dropped'], body: LANE_BODY + '\n## Dropped\nNot needed.\n' })` (A is dropped on the ref and still open in the checkout, so lint, which reads the checkout, says nothing about it), `gateReady({ ...snap, defaultRef: { ref: 'refs/remotes/origin/main', snapshot: loadSnapshot({ files: droppedFiles, tree: [] }) } }, 'B')`: `verdict` `'fail'`; exactly one `gate.depends-unmerged` finding, pointer `/depends_on/0`, reason containing `"A"`, `dropped on origin/main` and `re-plan this ticket without it`, and not containing `wait` or `never remove it from depends_on`; no finding with rule `lint.depends-dropped` has pointer `/depends_on/0`.

**Rule**, in `packages/core/src/gate/ready.ts` (import `doneOnDefault` from `../status/stage.js`; that module imports nothing from `gate/rules.ts` or `gate/ready.ts` at run time, so no import cycle forms):

```ts
/** BUG-LN-13 D-06: each prerequisite not done on the default ref the host read, or with none read in this checkout. One lint already reports (unknown, dropped in the checkout) is left to lint's reason; one dropped on the default ref asks for a re-plan, since its merge never comes. */
export const dependsUnmerged: GateRule['check'] = (snapshot, id) => …
```

- `where` = `'on ' + ref` with a leading `refs/remotes/` or `refs/heads/` removed (`on origin/main`, `on main`) when `snapshot.defaultRef` is set, else `'in this checkout'`.
- For each entry `d` of the gated ticket's `depends_on`, at index `i`, in this order:
  1. skip it when `!Object.hasOwn(snapshot.tickets, d)` or `snapshot.tickets[d].frontmatter?.status === 'dropped'` (lint reports it);
  2. when `snapshot.defaultRef` is set, `Object.hasOwn(snapshot.defaultRef.snapshot.tickets, d)` and `snapshot.defaultRef.snapshot.tickets[d].frontmatter?.status === 'dropped'`, one draft with `reason` = `` `depends_on names "${d}", which is dropped ${where}; re-plan this ticket without it` `` (the wording of `lint.depends-dropped` in `packages/core/src/lint/dropped.ts`, with the ref named);
  3. skip it when `doneOnDefault(snapshot, d)`;
  4. otherwise one draft with `reason` = `` `depends_on names "${d}", which is not done ${where}; wait until its pull request merges, run git fetch, then run accord gate ready ${id} again; never remove it from depends_on` ``.
- Every draft is `{ file: 'accord/tickets/' + id + '.md', pointer: '/depends_on/' + i, reason }`.

**Row**, in `packages/core/src/gate/rules.ts`: import `dependsUnmerged` and append `{ id: 'gate.depends-unmerged', level: 'error', profiles: ['build', 'maintain'], check: dependsUnmerged }` to `READY_RULES` after `APPROVAL_STALE`. `PLAN_RULES`, `DONE_RULES`, `DONE_S_RULES` and every existing row do not change.

**Existing tests**:
- `packages/core/test/gate.test.ts`: add the clause `'every prerequisite done on the default branch': ['gate.depends-unmerged']` to `GATE01`, so its test that the clauses name exactly `READY_RULES` passes.
- `packages/cli/test/dashboard.test.ts`, the ST-LN-2 test `ac-1 ready tickets are ranked by inherited priority then by id` (lines 144-174): ST-AN-2 depends on ST-AN-1 and ST-AN-6 on ST-AN-2, neither done, so `gateReadyIn` now fails them. The loop at lines 154-157 approves all five ids but expects `'pass'` only for ST-AN-1, ST-AN-3 and ST-AN-4 and `'fail'` for ST-AN-2 and ST-AN-6. Its other assertions (the READY order `['ST-AN-1', 'ST-AN-4', 'ST-AN-3']`, the lint checks) stay as they are.

Then run `packages/core/test/gate.test.ts`, `packages/core/test/lane-s.test.ts`, `packages/cli/test/lane-s.test.ts` and `packages/cli/test/dashboard.test.ts`; they must pass.

## Task 5: gate ready reads the default ref, and a dependant stays blocked until its prerequisite merges

covers: @ac-3, D-01, D-03, D-06
files: packages/cli/test/done-on-default.test.ts (new), packages/cli/src/commands/gate.ts
verify: packages/cli/test/done-on-default.test.ts#ac-3-a-dependant-stays-blocked-in-the-dashboard-and-gate-ready-until-its-prerequisite-is-done-on-the-default-branch (@ac-3)

Consumes `withDefaultRef` from `packages/cli/src/load/fs.ts` (Task 1) and the rule `gate.depends-unmerged` (Task 4). With this task all four criteria are covered (D-03).

**Test first**, in `packages/cli/test/done-on-default.test.ts`, title `ac-3 a dependant stays blocked in the dashboard and gate ready until its prerequisite is done on the default branch`, on one copy of Task 1's template (T-2 names T-1; T-1 is done only on `t/T-1`):
1. `gitRun(copy, 'switch', '-q', 't/T-1')`: the checkout is T-1's own branch, where T-1's records give stage done, so a checkout reading would unblock T-2.
2. `dashboard --json` exits 0: the row `T-2` among `rowsOf(j)` has `blockedBy` `['T-1']`; `j.summary.blocked` is 1; T-1 is in `j.yours.rows`.
3. `run(['gate', 'ready', 'T-2', '--json'])` exits 1; its findings hold one with rule `gate.depends-unmerged` whose reason contains `"T-1"` and `on origin/main`. This step fails at the start of the task: `gate ready` reads the checkout.
4. The merge, by squash so the claim tip never becomes an ancestor of main (D-01): `gitRun(copy, 'switch', '-q', 'main')`; `gitRun(copy, 'merge', '--squash', '-q', 't/T-1')`; `commitMsg(copy, 'T-1 (#1)')`; `gitRun(copy, 'update-ref', 'refs/remotes/origin/main', 'HEAD')` (the fetch after the merge).
5. `dashboard --json`: no row `T-1` in `j.yours.rows` or `j.team.rows`; `j.summary.done` is 1 (S-1 stays unmerged); the row `T-2` has `blockedBy` `[]`; `j.summary.blocked` is 0.
6. `gate ready T-2 --json` exits 0 and no finding names `"T-1"`.

**Change**, in `packages/cli/src/commands/gate.ts`: import `withDefaultRef` from `../load/fs.js`; the Ready branch becomes `gateReady(withDefaultRef(ctx.root, ctx.snapshot), id)`. Behaviour that must not change: `gate plan` and `gate done` get exactly the snapshot they get today; the `ac_hash` write (only on a pass, from `ctx.snapshot.tickets[id].file`, notices on stderr); the text and JSON output; the exit codes.

Then run `packages/cli/test/gate.test.ts` and `packages/cli/test/lane-s.test.ts`; they must pass.

## Task 6: The spec and the two skills say a prerequisite counts once it is on the default branch

covers: D-01, D-06
files: docs/specs/2026-10-12-workflow-layer-design.md, packages/core/skills/accord/lane-s.md, packages/core/skills/approach/SKILL.md, packages/core/src/generated/skills.ts, .claude/skills/accord/lane-s.md, .claude/skills/accord-approach/SKILL.md, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#risk:regression-the-lane-S-and-approach-skills-wait-for-a-prerequisite-merge-and-never-edit-depends_on

Consumes the behaviour of Tasks 1-5. Produces the text the agents and readers follow.

The sentence, `S`, used verbatim in both skills and in the test; it is keyed to the words `not done` of the wait reason, so it never reaches the reason for a prerequisite dropped on the default branch, which asks for a re-plan (Task 4):

> When it says a `depends_on` ticket is not done on the default branch, never remove that entry from `depends_on`: tell the owner this ticket waits for that ticket's merge, then after the merge run `git fetch` and `accord gate ready <id>` again.

**Test first**, in `packages/core/test/stage-skills.test.ts`, a top-level `it` titled `risk:regression the lane S and approach skills wait for a prerequisite merge and never edit depends_on`: with the file's `flatS` helper (line 691, whitespace collapsed), `flatS('.claude/skills/accord/lane-s.md')` and `flatS('.claude/skills/accord-approach/SKILL.md')` each contain `S` with its whitespace collapsed the same way. It fails until the sources change and `npm run gen` runs.

**Changes**:
- `packages/core/skills/accord/lane-s.md` step 1: insert `S` right after the sentence `Run \`accord gate ready <id>\` and fix what it prints until it exits 0, then commit the ticket.`
- `packages/core/skills/approach/SKILL.md` step 5: insert `S` right after `\`accord gate ready <id>\` and work from what it prints.`
- Then, in this order (conventions.md): `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`; commit the regenerated `packages/core/src/generated/skills.ts` and the synced `.claude/skills/accord/lane-s.md` and `.claude/skills/accord-approach/SKILL.md`.
- `docs/specs/2026-10-12-workflow-layer-design.md` §5: the **Dependencies** bullet (lines 145-147) keeps its first two sentences and replaces the rest with: a ticket counts as done for the dashboard and for its dependants (`accord dashboard`, `status`, `show`, `next` and `gate ready`) only when its records, as they stand on the default branch, give stage done; the default branch is origin's as `accord worktree clean` reads it (origin/HEAD, else origin/main or origin/master), or the local main or master in a clone with no origin remote, read without fetching; when none resolves, the tree the command runs on decides; this holds for merge, squash and rebase alike; `accord status --json` keeps the stage the ticket's own records give; `gate ready` refuses a ticket while a prerequisite is not done there, and asks to re-plan the ticket without a prerequisite that is dropped there. In the **Claim** bullet (line 150), `a dependency still counts as done only in the tree the command runs on` becomes `a dependency still counts as done only on the default branch`.
- Behaviour that must not change: every other step and sentence of both skills; every phrase `packages/core/test/stage-skills.test.ts` and `packages/core/test/lane-s.test.ts` already assert; `packages/core/test/skills.test.ts` keeps every rendered `SKILL.md` at most 5120 bytes. If the approach skill then exceeds it, shorten `S` in both skills and in the test alike, keeping its four points: never remove the entry from `depends_on`, tell the owner, wait for the merge, then `git fetch` and `gate ready` again.

Then run `packages/core/test/stage-skills.test.ts`, `packages/core/test/skills.test.ts` and `packages/core/test/lane-s.test.ts`; they must pass.
