---
baseline: 8066285a95ba5f2af083b30d92a49e5f2ab413b4
plan_hash: "fnv1a64:2fdfcd85e73e917b"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, and the ticket.

Rules for every task:
- Test ids: every test named on a `verify:` line is a top-level `it(...)` with no `describe` around it. Its report
  id is the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`. No test title
  holds `@` or a comma. Write each title as the part of its verify id after `#` with every `-` read as a space
  (`risk:complex-branching` may keep its hyphen; both spellings give the same id). The prose below shortens
  titles to their first words followed by `...`.
- CLI tests import core from `packages/core/dist`: after changing anything under `packages/core/`, run
  `npm run build -w packages/core` before running any CLI test. Run one file with `npx vitest run <path>`. End
  every task with `npm run build`, `npm run lint` and `npm run typecheck`, then every test file the task names,
  then `npm test`.
- Files are LF with no BOM. No new dependency. Optional JSON fields are omitted, never set to `undefined` (D-54).
  Strings are compared in code-point order, never with `localeCompare`.
- Every git call this ticket adds is spawned as `execFileSync('git', [...literal args], { cwd: root, ... })`, never
  through a shell, and passes `env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }`. Nothing fetches.

Test helpers available in `packages/cli/test/helpers/repo.ts`: `makeLaneRepo(extra)` (a git sandbox with no commit
holding `accord/config.yml`, lane ticket `T-1` titled `Export` with the two-task `PLAN`, `src/export.ts` and a green
report; `extra` overrides or adds path-to-text entries), `run(argv, cwd)` giving `{ code, out, err }`,
`gitRun(repo, ...args)`, `writeFiles(repo, files)`, `commitAll(repo)`, `commitAllAt(repo, when?)`,
`cleanup(repo)`. From `test/helpers/lane.ts`: `CONFIG`, `PLAN`, `LANE_BODY`,
`laneTicket(id, { lane?, frontmatter?, body? })`. A ticket is approved in a sandbox with `run(['approve', id], repo)`.

Definitions shared by every task (from the Approach and the ledger's Rulings):
- The claim ref of a ticket is the full refname of the ref that already wins its claim in `gitClaims`
  (`packages/cli/src/load/fs.ts`): a pushed ref over a local one, then the newest tip.
- A claim is overlaid when all three hold: its id is not `ticketOfBranch(<current branch>, <templates in force>,
  <known>)`; its claim ref's tip is not an ancestor of HEAD (`git merge-base --is-ancestor <ref> HEAD` exits
  non-zero, an unborn HEAD included); the claim ref holds `accord/tickets/<id>.md`.
- The records of ticket `<id>` are the five paths `accord/tickets/<id>.md` and `accord/tickets/<id>/plan.md`,
  `ledger.md`, `review.md`, `verification.md`. Overlaying replaces each record present at the claim ref with the
  ref's text and removes each record absent at the ref from `files`. `tree` and every other file stay the
  checkout's.
- The checkout snapshot is the one built from the working tree alone; the claim view is the one built after the
  overlay. Lint, gates, approve, task-done, brief, review-package, next, anchor and hook read only the checkout.
- A plan fact is `{ subject?: string; clean: boolean }` keyed by ticket id. A plan is ready when its fact has
  `clean === true` and `subject` equal, character for character, to `plan: <id> ready`.

## Task 1: Wiring: status and dashboard read a claimed ticket from its claim branch
covers: @ac-1, @ac-2, D-01, D-02
files: packages/cli/src/load/fs.ts, packages/cli/src/run.ts, packages/cli/src/commands/anchor.ts, packages/cli/test/helpers/repo.ts, packages/cli/test/status.test.ts
verify: packages/cli/test/status.test.ts#ac-1-a-ticket-filed-only-on-its-pushed-claim-branch-shows-at-that-branch-stage-without-a-fetch (@ac-1), packages/cli/test/status.test.ts#ac-2-the-claim-branch-copy-wins-over-an-older-checkout-copy (@ac-2), packages/cli/test/status.test.ts#risk:complex-branching-a-merged-or-checked-out-or-ticketless-claim-branch-keeps-the-checkout-copy

This is the reproduction of the 2026-10-16 report: on main, a ticket whose file lives only on its claim branch is
missing from `accord status` and `accord dashboard`.

Tests first, in `packages/cli/test/status.test.ts`, each a top-level `it` that builds its own sandbox from
`makeLaneRepo()` and cleans up in `finally`:
- First extend `packages/cli/test/helpers/repo.ts`: `commitAll(repo, message = 'fixture')` and
  `commitAllAt(repo, when?, message = 'fixture')` pass `message` to `git commit -m`. Every existing call keeps
  `fixture`.
- `ac-1 ...`: `commitAll(repo)` as the base; note the base branch name with `git rev-parse --abbrev-ref HEAD`.
  `git checkout -q -b t/T-2`; write `accord/tickets/T-2.md` as `laneTicket('T-2')`; `run(['approve', 'T-2'])`;
  write `accord/tickets/T-2/plan.md` as `PLAN` with a third task appended (`## Task 3: Docs`, `covers: @ac-1`,
  `files: src/export.ts`, `verify: export#writes-csv`, one prose line); `commitAll(repo, 'plan: T-2 ready')`; write
  `accord/tickets/T-2/ledger.md` as `'## Tasks\n- task 1 done abc1234\n'`; `commitAll(repo, 'task 1')` is the tip.
  `git update-ref refs/remotes/origin/t/T-2 <tip>`, check out the base, `git branch -q -D t/T-2`, then
  `git remote add origin <repo>/no-such-remote` (a path that does not exist) and
  `git config user.email an@example.com`. Assert: `status --json` exits 0 and its `T-2` row matches
  `{ claimedBy: 'fixture@example.invalid', stage: 'build', tasksDone: 1, tasksTotal: 3, branch: 't/T-2' }`;
  `dashboard` exits 0, the line holding `T-2` contains `build 1/3` and `fixture@example.invalid`, and the summary
  line starts `1 in progress`; afterwards `.git/FETCH_HEAD` does not exist and
  `git rev-parse refs/remotes/origin/t/T-2` still prints the tip.
  The same `it` then proves "neither command fetches" with a check that fails if a new spawn omits
  `GIT_NO_LAZY_FETCH`: the full sandbox above can never lazily fetch, so a second sandbox is a blobless clone whose
  promisor remote stays reachable. Build it right after `commitAll(repo, 'task 1')` and before the steps that
  delete `t/T-2`: check out the base in `repo` (so the clone checks out the base, and the `T-2` record blobs exist
  only on `t/T-2`), run `git config uploadpack.allowFilter true` and `git config uploadpack.allowAnySHA1InWant true`
  in `repo`, make `clone = mkdtempSync(join(tmpdir(), 'accord-cli-'))`, then
  `gitRun(repo, 'clone', '-q', '--filter=blob:none', pathToFileURL(repo).href, clone)` (a `file://` URL, because a
  plain-path clone is local and ignores the filter; `pathToFileURL` from `node:url`), then
  `gitRun(clone, 'config', 'user.email', 'an@example.com')`. Read
  `sha = gitRun(clone, 'rev-parse', 'refs/remotes/origin/t/T-2:accord/tickets/T-2.md').trim()` (a tree lookup, no
  blob read). Assert `gitRun(clone, '--no-lazy-fetch', 'cat-file', '-e', sha)` throws (the blob is absent); run
  `status --json` and `dashboard` in `clone`, each exits 0; then assert the same `cat-file -e` call still throws. A
  spawn without `GIT_NO_LAZY_FETCH=1` that reads `<ref>:accord/tickets/T-2.md` would fetch that blob from `repo`,
  and the last assertion would fail. Do not assert the `T-2` row in `clone`: with its blobs absent the overlay reads
  nothing (the Approach's Risks). `cleanup(clone)` in the same `finally`. Chosen over a code-reading check because
  it runs with plain git on Windows and POSIX (git documents `uploadpack.allowFilter`, `--filter=blob:none`,
  `--no-lazy-fetch` with `cat-file -e`, and `GIT_NO_LAZY_FETCH`), and over deleting the source because a fetch
  attempt against a deleted remote leaves no trace the test can read reliably, while a fetched blob does.
- `ac-2 ...`: base commit holds `T-2` as `laneTicket('T-2')`, unapproved, no plan. On `t/T-2`: approve `T-2`,
  write `accord/tickets/T-2/plan.md` as `PLAN`, `commitAll(repo, 'plan: T-2 ready')`; push it as
  `refs/remotes/origin/t/T-2`, return to the base, delete the local branch. `status --json` row `T-2` matches
  `{ stage: 'build', tasksDone: 0, tasksTotal: 2 }`, not `intent`.
- `risk:complex-branching ...`, three claims in one sandbox, each asserted on `status --json --all`:
  merged: `T-3` committed on the base, `t/T-3` created at that commit, then on the base `T-3` gets
  `status: archived` and is committed, so the `t/T-3` tip is an ancestor of HEAD; the `T-3` row has
  `status: 'archived'`. Ticketless: `refs/remotes/origin/t/T-4` points at a side commit that deletes
  `accord/tickets/T-4.md` while the base holds it unapproved; the `T-4` row is present with `stage: 'intent'`.
  Checked out: `refs/remotes/origin/t/T-1` points at a side commit holding `T-1` unapproved and differing from the
  base (another `title:`); then `git checkout -q -b t/T-1` from the base and `run(['approve', 'T-1'])` without
  committing; the `T-1` row's stage is not `intent` and its `title` is `Export`.

Interface. In `packages/cli/src/load/fs.ts`:
- `gitClaims` also returns `refs: Record<string, string>`, ticket id to the full refname of the winner
  (`refs/remotes/origin/t/T-2`), built in a null-prototype object like `claims`.
- `currentBranch(root): string | undefined` moves here verbatim from `packages/cli/src/commands/anchor.ts` and is
  exported; `anchor.ts` imports it from `../load/fs.js`.
- The body of today's `loadFromFs` becomes a private helper returning the `SnapshotInput`, the claim refs, the
  templates in force and the `known` predicate. `loadFromFs(root): SnapshotInput` returns its input unchanged.
- New `export function loadClaimView(root: string): { checkout: SnapshotInput; view: SnapshotInput }`. For each
  claim it applies the overlay rule of the definitions. One `git cat-file --batch` reads `<ref>:<path>` for the five
  records of every candidate claim (parse its output as `gitDefaultBranch` does: `<sha> <type> <size>` then the
  body, or `<name> missing`); a spawn failure throws `UsageError('git cat-file failed reading the claim branches'
  + stderr)`. `view` is a copy of `checkout` with an overlaid `files` object; `checkout` is never mutated.
In `packages/cli/src/run.ts`: `preflight(opts, mode: 'checkout' | 'claims' = 'checkout')`; under `'claims'` the
snapshot is `loadSnapshot(loadClaimView(root).view)`. The `status` and `dashboard` actions pass `'claims'`; every
other action is unchanged.

Must not change: the `loadFromFs` return value for every caller (`packages/cli/test/load.test.ts`), the claim
winner rule, `claimedBy` and `branch` values, the pin check order (root, snapshot, pin), `anchor` output and its
detached-HEAD silence, and every command other than `status` and `dashboard`.

## Task 2: A dependency counts as done only in the checkout
covers: D-04
files: packages/core/src/status/rows.ts, packages/core/src/status/dashboard.ts, packages/cli/src/run.ts, packages/cli/src/commands/status.ts, packages/cli/src/commands/dashboard.ts, packages/cli/test/dashboard.test.ts
verify: packages/cli/test/dashboard.test.ts#risk:complex-branching-a-dependency-done-only-on-its-claim-branch-still-blocks-its-dependent

Test first, top-level in `packages/cli/test/dashboard.test.ts`, using the module's `done` builder: base holds
`T-1` as `laneTicket('T-1')` (unapproved) and `T-2` as `laneTicket('T-2', { frontmatter: ['depends_on:
["T-1"]'] })`, committed. On `t/T-1`, build a files map with `done(files, 'T-1')`, `writeFiles` it, commit, push the
tip as `refs/remotes/origin/t/T-1`, return to the base and delete the local branch; set `user.email` to
`an@example.com`. `status --json`: row `T-1` has `stage: 'done'`, row `T-2` has `blockedBy: ['T-1']`.
`dashboard --json`: `summary.blocked` is 1 (without `plain` it would be 0, since the claim view holds `T-1`
done).

Interface (the owner's answer: the plain snapshot is an optional trailing parameter):
- `statusRows(snapshot: RepoSnapshot, now?: number, plain?: RepoSnapshot): StatusRow[]`: `blockedBy` uses
  `isDone(plain ?? snapshot, d)`; nothing else reads `plain`.
- `dashboard(snapshot: RepoSnapshot, viewer: string, now?: number, plain?: RepoSnapshot): Dashboard`: passes
  `plain` to `statusRows`; `effectivePriorities`, `epicsSection` and the `withoutLane` count call `isDone` on
  `plain ?? snapshot`.
- `CommandContext` gains `plain?: RepoSnapshot`; `preflight` under `'claims'` sets it to
  `loadSnapshot(checkout)` from the same `loadClaimView` call. `status` calls
  `statusRows(ctx.snapshot, now, ctx.plain)`, `dashboardCommand` calls `dashboard(ctx.snapshot, viewer, now,
  ctx.plain)`.

Must not change: every call with no `plain` returns exactly what it returns today (every core and CLI golden);
`isDone`, `nextRows`, the rank, the caps and the summary's other counts.

## Task 3: Core holds a plan at stage plan until its ready commit
covers: @ac-3, D-02
files: packages/core/src/model/snapshot.ts, packages/core/src/load/snapshot.ts, packages/core/src/status/stage.ts, packages/core/src/status/rows.ts, packages/core/test/lane-status.test.ts
verify: packages/core/test/lane-status.test.ts#risk:complex-branching-the-ready-commit-decides-only-plan-versus-build

Test first, top-level in `packages/core/test/lane-status.test.ts`, building snapshots with
`loadSnapshot({ files, tree: [], planFacts })` over `approved({ CONFIG, T-1 }, 'T-1')` plus `PLAN`:
no `planFacts` key gives `build` 0/2; `planFacts: {}` gives `plan`; `{ 'T-1': { subject: 'plan: T-1 round 1, 1
Must, 0 Should', clean: true } }` gives `plan`; `{ subject: 'plan: T-1 ready', clean: false }` gives `plan`;
`{ subject: 'plan: T-1 ready ', clean: true }` (trailing space) gives `plan`; `{ subject: 'plan: T-1 ready', clean:
true }` gives `build` with `tasksDone: 0, tasksTotal: 2`; with both tasks in the ledger and `planFacts: {}` the
stage is `review`, not `plan`. With task 1 in the ledger and `planFacts: {}`, the `statusRows` row `T-1` has
`stage: 'plan'` and `tasksDone: 1`, and `nextRows([{ ...row, ready: 'ok' }])` is empty, while the same row with
`tasksDone: 0` gives one row.

Interface:
- `SnapshotInput.planFacts?: Record<string, { subject?: string; clean: boolean }>`, ticket id to plan fact,
  absent when the host supplies none; `RepoSnapshot.planFacts` carries it through, spread in `loadSnapshot` like
  `claims` so a snapshot without it stays byte-identical.
- `progressOf`: when tasks remain open and `snapshot.planFacts` is defined, the stage is `plan` (with the same
  counts and no `next`) unless `planFacts` has an own entry for the ticket that is ready by the definition; with
  `planFacts` undefined, or with no task open, the result is today's.
- `nextRows` (`packages/core/src/status/rows.ts`) admits a row only when `r.tasksDone === 0` and its stage is
  `plan` or `build`, so a `plan` row with a task recorded is not offered, matching its doc comment "have no task
  recorded yet". Every lane row carries a numeric `tasksDone` (0 when the ticket has no plan).

Must not change: every result when `planFacts` is absent (every core golden, `isDone`, `anchorText`), and the
`review`, `verify` and `done` stages; `nextRows` still admits every `plan` or `build` row with no task recorded,
and its other conditions.

## Task 4: The CLI supplies plan facts to every stage-deriving command
covers: @ac-3, D-02
files: packages/cli/src/load/fs.ts, packages/cli/src/run.ts, packages/cli/test/status.test.ts, packages/cli/test/lane-flow.test.ts, packages/cli/test/lane-commands.test.ts, packages/cli/test/dashboard.test.ts
verify: packages/cli/test/status.test.ts#ac-3-a-plan-reaches-build-only-after-its-ready-commit-and-while-clean (@ac-3)

Test first, top-level in `packages/cli/test/status.test.ts`, one sandbox from `makeLaneRepo()`:
1. `run(['approve', 'T-1'])`, `commitAll(repo, 'plan: T-1 round 1, 1 Must, 0 Should')`: `status --json` row `T-1`
   has `stage: 'plan'`; `anchor T-1` contains `Stage: plan`.
2. Write `plan.md` as `PLAN + '\n'`, `commitAll(repo, 'plan: T-1 ready')`: the row is `build` 0/2 and `anchor T-1`
   contains `Stage: build 0/2`.
3. Unstaged: write `plan.md` as `PLAN + '\n\n'`: `plan` in both; `git checkout -- accord/tickets/T-1/plan.md`.
4. Staged: the same edit plus `git add accord/tickets/T-1/plan.md`: `plan`; `git reset -q --hard HEAD`; `build`.
5. Untracked: write `T-2` as `laneTicket('T-2')` with `PLAN` at `accord/tickets/T-2/plan.md` and approve it without
   committing: row `T-2` is `plan` while `T-1` is `build`. Remove both `T-2` paths.
6. Claim ref against a dirty tree: `git checkout -q -b side`, write `plan.md` as `PLAN + '\n\n\n'`,
   `commitAll(repo, 'plan: T-1 ready')`, push the tip as `refs/remotes/origin/t/T-1`, return to the base, delete
   `side`, then write `plan.md` as `PLAN + 'dirty\n'` on the base: `status --json` row `T-1` is `build` (read
   from the claim ref) while `anchor T-1` contains `Stage: plan` (the checkout).

Then update the tests that committed a plan with no ready commit, keeping every assertion they make:
`lane-flow.test.ts` line 50 `commitAll(repo, 'plan: T-1 ready')`; `status.test.ts` the two
`commitAllAt(repo, <date>)` calls of `ac-1 a ticket untouched past the window shows its idle days` and `ac-2 a recent
commit on the claim branch keeps the ticket active` pass `'plan: T-1 ready'`; `dashboard.test.ts`
`risk:regression an idle ticket ...` passes `'plan: T-1 ready'` to `commitAllAt`; `lane-commands.test.ts` `next
lists an approved, Ready, unclaimed ticket ...`, whose plan is never committed, asserts the `T-1` line shows `plan`
instead of `build 0/2`, and its comment says the approved ticket sits at stage plan.

Interface, in `packages/cli/src/load/fs.ts`:
- `gitFacts`' existing `git log` format becomes `%x01%ae%x00%ct%x00%s`; the subject is read from the untrimmed
  header line, and the first subject seen for a path `accord/tickets/<id>/plan.md` is that plan's last commit
  subject. No new spawn for subjects.
- New `gitDirty(root): Set<string>` runs `git --no-optional-locks status --porcelain -z -uall -- accord/tickets`;
  every NUL-separated token of the form `XY <path>` adds `<path>`, any other non-empty token (a rename's source)
  is added as written. A spawn failure throws `UsageError('git status failed reading the plan files' + stderr)`.
- `loadFromFs(root, options: { stage?: boolean } = {})`: with `stage`, the input gains `planFacts`, one entry per
  `accord/tickets/<id>/plan.md` in `files`: `subject` when a commit touched it (omitted otherwise),
  `clean: !dirty.has(path)`; `planFacts` is `{}` when no plan exists. Without `stage`, nothing is spawned and the
  return value is today's.
- `loadClaimView(root)` builds its checkout with `stage`; for each overlaid claim whose ref holds the plan, the view's
  `planFacts[id]` is `{ subject: <git log -1 --format=%s <ref> -- accord/tickets/<id>/plan.md>, clean: true }`
  (subject omitted when empty); when the ref holds no plan the entry is removed. The checkout's `planFacts` is
  never mutated.
- `run.ts`: `preflight(opts, mode: 'checkout' | 'stage' | 'claims' = 'checkout')`; `'stage'` loads with
  `loadFromFs(root, { stage: true })`; `next`, `anchor` and `hook` pass `'stage'`; `status` and `dashboard` keep
  `'claims'`.

Must not change: the input `lint`, the three gates, `approve`, `task-done`, `brief`, `review-package`, `skills
sync`, `tests baseline` and `new ticket` load (no `git status` spawn, no `planFacts`); the activity and author maps
`gitFacts` builds today.

## Task 5: An unwritten intent points to the intent interview
covers: @ac-4, D-02, D-03
files: packages/core/src/status/stage.ts, packages/core/src/status/anchor.ts, packages/core/src/status/rows.ts, packages/cli/src/render/dashboard.ts, packages/core/test/lane-status.test.ts, packages/cli/test/dashboard.test.ts
verify: packages/cli/test/dashboard.test.ts#ac-4-an-unwritten-intent-points-anchor-and-dashboard-to-the-intent-interview (@ac-4), packages/core/test/lane-status.test.ts#risk:parsing-an-intent-of-comments-or-a-template-scenario-only-criteria-block-reads-as-unwritten

Tests first:
- `ac-4 ...`, top-level in `packages/cli/test/dashboard.test.ts`: `makeLaneRepo` plus `T-2`, whose body is
  `LANE_BODY` with the Intent line `Owners can export their report as CSV.` replaced by `<!-- why, for whom -->`
  and a blank line, and `T-3`, whose body is `LANE_BODY` with the gherkin block holding only `Feature: T-3`, `@ac-1`
  and `Scenario: <observable outcome>` with `Given ...`, `When ...`, `Then ...`; `user.email` set. `anchor T-2` and
  `anchor T-3` contain `Stage: intent, next: the intent interview (accord-intent)`; `anchor T-1` contains
  `Stage: intent, next: the owner approves the ticket (accord approve)`. In `dashboard` text the lines holding `T-2`
  and `T-3` contain `intent, next: the intent interview (accord-intent)` and the line holding `T-1` contains
  `intent, next: the owner approves the ticket (accord approve)`; in `dashboard --json` the `T-2` row has
  `next: 'the intent interview (accord-intent)'`.
- `risk:parsing ...`, top-level in `packages/core/test/lane-status.test.ts`, on `statusRows` rows: `next` is the
  interview for an Intent of only comments and blank lines, for a ticket with no `## Intent` section, for a ticket
  with no gherkin block (zero scenarios) and for one holding only the template scenario (`Scenario: <observable
  outcome>` from `packages/core/templates/ticket-lane.md`); it is the approval text for the template scenario plus
  one other scenario and for `laneTicket('T-1')` unapproved; an approved ticket at stage
  `plan` has no `next` property. Add `next` to `LANE_KEYS`.

Interface:
- `packages/core/src/status/stage.ts` gains the `NEXT` texts moved from `anchor.ts` and
  `export function nextStep(ticket: Ticket, stage: Exclude<Stage, 'build'>): string`. For `intent` it returns
  `the intent interview (accord-intent)` when the ticket has no section whose `headingKey` is `intent`, when that
  section's lines after `stripHtmlComments` are all blank, or when every scenario's `name` is exactly
  `<observable outcome>` (true for zero scenarios); otherwise `the owner approves the ticket (accord approve)`.
  Every other stage returns today's text.
- `anchorText` writes `${stage}, next: ${nextStep(ticket, stage)}` for every stage but `build`.
- `StatusRow.next?: string`, set right after `stage` only on a lane row at stage `intent`
  (`nextStep(ticket, 'intent')`), so `status --json` and `dashboard --json` carry it.
- `packages/cli/src/render/dashboard.ts`: the stage cell is the stage text, then `, next: <next>` when `next` is
  set, then the idle suffix, all through `sanitise`.

Must not change: no field is removed from any row; rows at other stages are byte-identical; anchor text for every
stage but an unwritten `intent`; the `build` cell and the `idle` suffix.

## Task 6: The spec and the /accord skill follow the claim view
covers: D-01, D-03, D-04
files: packages/core/skills/accord/SKILL.md, packages/core/src/generated/skills.ts, .claude/skills/accord/SKILL.md, packages/core/test/stage-skills.test.ts, docs/specs/2026-10-12-workflow-layer-design.md
verify: packages/core/test/stage-skills.test.ts#risk:regression-the-accord-skill-takes-an-id-that-accord-status-lists-with-a-branch

Test first, top-level in `packages/core/test/stage-skills.test.ts`, on the rendered
`.claude/skills/accord/SKILL.md` with whitespace runs collapsed: the text between `## A ticket named` and
`## Continue` contains `` an id that `accord status --json` lists with a `branch` `` and still contains
`` `/accord continue ST-99` is a New request ``.

Edits:
- `packages/core/skills/accord/SKILL.md`, section `A ticket named`: `the id of a ticket in` `` `accord/tickets/` ``
  becomes `` the id of a ticket in `accord/tickets/` or an id that `accord status --json` lists with a `branch` ``,
  and `with no such ticket` becomes `with neither`.
- `docs/specs/2026-10-12-workflow-layer-design.md` §5, the Claim bullet (lines 148-151): after `to show who holds
  what.` add: `` For a ticket claimed on a branch that is neither the current one nor merged into it, `accord
  status` and `accord dashboard` read its ticket, plan, ledger, review and verification from that branch, without
  fetching; a dependency still counts as done only in the tree the command runs on. ``
- Same file §6, line 179: `The dashboard shows no position;` becomes `` The dashboard shows each ticket's stage:
  `build d/t` only once the plan's last commit is `plan: <id> ready` and the plan has no uncommitted change, and at
  `intent` the next step, the intent interview (accord-intent) while Intent or the criteria are unwritten, otherwise
  the owner's approval (accord approve). It shows no task position; ``, the rest of the line unchanged.
Then run, in order: `npm run gen`, `npm run build`, and `node packages/cli/dist/cli.js skills sync`, which rewrites
`.claude/skills/accord/SKILL.md`. These must pass: `packages/core/test/skills.test.ts` (drift, size, line limit,
`no rendered text restates a rule the CLI enforces`), `packages/core/test/stage-skills.test.ts`,
`packages/cli/test/skill-commands.test.ts`, `packages/cli/test/skills-sync.test.ts`.

Must not change: every other sentence of the `/accord` skill, every `REQUIRED` phrase, and every other line of the
spec.
