---
baseline: 84eb2b8daa424884b07b71dc3571f9a7198d0d6c
plan_hash: "fnv1a64:757853c528b7280a"
---

Review mode `outcome`: one branch, no slices. Report case ids follow the JUnit id shape in
`packages/core/src/load/junit.ts`: `<classname>#<name>` with each whitespace run turned into `-`. Every test
below is a top-level `it(...)` whose name starts with its `@test:` tag, so the name carries no describe prefix.

## Task 1: Wiring: records activity reaches the status row and the table
covers: @ac-1, D-01, D-03, D-04, D-07
files: packages/core/src/model/snapshot.ts, packages/core/src/load/snapshot.ts, packages/core/src/status/rows.ts, packages/cli/src/load/fs.ts, packages/cli/src/commands/status.ts, packages/cli/src/render/table.ts, packages/cli/test/helpers/repo.ts, packages/cli/test/status.test.ts
verify: packages/cli/test/status.test.ts#@test:ac-1-a-ticket-untouched-past-the-window-shows-its-idle-days

Test first, in `packages/cli/test/status.test.ts`: `it('@test:ac-1 a ticket untouched past the window shows its idle days')`.
Build a repository with `makeLaneRepo` holding one lane ticket at stage build (approved, a plan, a ledger with
one task done, the same set-up `lane-status.test.ts` uses for build), with no `stale_days` in its config and no
`t/*` branch. Commit it with the new helper dated 18 days and one hour before now. Run `accord status --json`
and assert the row has `idleDays: 18`; run `accord status` and assert the row's text contains `build 1/2 idle 18d`.

Helper, in `packages/cli/test/helpers/repo.ts`: `commitAllAt(repo: string, when: Date): string`. It does what
`commitAll` does and also sets `GIT_COMMITTER_DATE` and `GIT_AUTHOR_DATE` to `when` as `@<unix seconds> +0000`
through the `env` option of the guarded spawn, and returns the HEAD sha. `gitIn` gains an optional `env`
argument merged over `process.env`; every existing caller passes none and behaves exactly as now. `commitAll`
is unchanged.

Interface:
- `SnapshotInput.lastActivity?: Record<string, number>` and the same key on `RepoSnapshot`: ticket id to the
  newest committer time in unix seconds. Absent, never `{}` or undefined, when the host has none, so every D-54
  golden is unchanged. `loadSnapshot` passes it through with the same spread as `claims`.
- `StatusRow.idleDays?: number`, set inside the lane block only.
- `statusRows(snapshot: RepoSnapshot, now?: number)`, `now` in unix seconds. When `now` is given and
  `snapshot.lastActivity` has the ticket id, `idle = Math.floor((now - lastActivity[id]) / 86400)`; the row
  carries `idleDays: idle` when `idle > window`, where `window` is `Number(config.stale_days ?? '14')`.
  No clock is read in core (D-07).
- `gitFacts` in `packages/cli/src/load/fs.ts`: the log format becomes `%x01%ae%x00%ct`. The header line yields
  both the author and the committer time. For each path under `accord/tickets/`, the ticket id is the stem of
  `accord/tickets/<id>.md` or the first segment of `accord/tickets/<id>/...`; the id's time is the max seen.
  `gitFacts` returns that map beside `commit` and `authors`, and `loadFromFs` adds `lastActivity` to its result
  only when the map is non-empty. When the log spawn fails the map is empty and nothing is idle (ledger Ruling).
- `status` in `packages/cli/src/commands/status.ts` calls `statusRows(ctx.snapshot, Math.floor(Date.now() / 1000))`.
- The `stage` column in `packages/cli/src/render/table.ts`: budget 12 becomes 24, and the cell appends
  ` idle <n>d` when `r.idleDays` is set.

Must not change: the `authors` map and `commit` value `gitFacts` returns (the first author seen per path still
wins); `loadFromFs` output for a repository with no ticket commit; `--json` stays the core array verbatim with
no CLI-added field; `statusRows(snapshot)` with no `now`, as `next` and `hook` call it, returns rows with no
`idleDays`, so the session-start line and `accord next` are untouched; a 0.1.0 (laneless) table is unchanged,
since the lane columns render only for lane rows and a cell under 12 characters pads as before.

## Task 2: The claim branch tip counts as activity
covers: @ac-2, D-02, D-06
files: packages/cli/src/load/fs.ts, packages/cli/test/status.test.ts
verify: packages/cli/test/status.test.ts#@test:ac-2-a-recent-commit-on-the-claim-branch-keeps-the-ticket-active

Test first: `it('@test:ac-2 a recent commit on the claim branch keeps the ticket active')`. Same repository as
Task 1, records committed 18 days and one hour ago with `commitAllAt`; then create branch `t/<id>`, commit a
file outside `accord/tickets/` on it dated 2 days and one hour ago, and switch back to the original branch so
the records walk from HEAD still sees only the old commit. Assert the JSON row has no `idleDays` key and the
text row contains no `idle`. A second branch in the same test repeats this with the recent commit reachable only
as a remote-tracking ref (`git update-ref refs/remotes/origin/t/<id> <sha>` with the local branch deleted), and
asserts the same.

Interface: `gitClaims` keeps its one `for-each-ref` spawn; its format becomes
`%(refname)%00%(authoremail)%00%(committerdate:unix)`. It returns `{ claims, times }`, where `times` is ticket id
to the max committer time over every matching ref, local and remote-tracking (D-06). `loadFromFs` folds `times`
into the records map from Task 1 by max per id (D-02) before the single `lastActivity` spread.

Must not change: `claims` itself, including the rule that the remote-tracking ref read last wins the author;
the UsageError thrown when `for-each-ref` fails; `claims` and `lastActivity` both omitted when empty.

## Task 3: The window, the default, and who can be idle
covers: @ac-3, @ac-4, @ac-5, D-04, D-05
files: packages/core/src/status/rows.ts, packages/core/test/lane-status.test.ts
verify: packages/core/test/lane-status.test.ts#@test:ac-3-the-window-comes-from-stale_days, packages/core/test/lane-status.test.ts#@test:ac-4-finished-and-closed-tickets-are-never-idle, packages/core/test/lane-status.test.ts#@test:ac-5-the-default-window-is-14-days-and-idle-means-older-than-it

Tests first, in `packages/core/test/lane-status.test.ts`, with no git: each calls
`statusRows(loadSnapshot({ files, tree: [], lastActivity }), now)` with `now` a fixed second count and
`lastActivity` set from it, the gaps offset by one hour off the whole-day boundary.
- `@test:ac-3 the window comes from stale_days`: config with `stale_days: "30"`, a build-stage lane ticket 18 days
  idle; the row has no `idleDays`.
- `@test:ac-4 finished and closed tickets are never idle`: three lane tickets 100 days idle, one at stage done,
  one with `status: dropped`, one with `status: archived`; `statusRows` returns all three rows and none has
  `idleDays`. A fourth, laneless ticket with the same activity also has no `idleDays` (D-05).
- `@test:ac-5 the default window is 14 days and idle means older than it`: no `stale_days`; one build-stage lane
  ticket 14 days idle has no `idleDays`, another 15 days idle has `idleDays: 15`.

Interface: in the lane block of `statusRows`, `idleDays` is set only when the row's stage is not `done` and the
frontmatter status is neither `dropped` nor `archived`, on top of Task 1's `idle > window` test. A laneless
ticket never reaches the lane block, so it can never be idle. A lane ticket at stage intent can be idle (ledger
Ruling).

Must not change: every existing case in `lane-status.test.ts` passes untouched, since none passes `now`; the row
key order and the D-54 omission of absent optional fields.

## Task 4: The dashboard shows idle tickets
covers: D-08
files: packages/core/skills/accord/SKILL.md, packages/core/src/generated/skills.ts, .claude/skills/accord/SKILL.md
verify: packages/core/test/skills.test.ts#generated-module->-generated-module-matches-skills/-(drift)

In the Dashboard section of `packages/core/skills/accord/SKILL.md`, step 2: a row that carries `idleDays` shows
`idle <n>d` after its stage, in both YOURS IN PROGRESS and TEAM, and the example block gains one such row
(`T-19  Export CSV  build 1/4 idle 18d · binh`). The text names no other tool. Then regenerate with `npm run gen`,
which rewrites `packages/core/src/generated/skills.ts`, and `accord skills sync`, which rewrites
`.claude/skills/accord/SKILL.md` (this repository's only runtime is `claude`). The existing drift case is the
proof the source, the generated module, and the synced copy agree; no new test, since the change is prose.

Must not change: the rule that the dashboard never infers a state the JSON does not hold; every other section of
the skill.
