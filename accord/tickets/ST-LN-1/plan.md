---
baseline: 5d8de34
plan_hash: "fnv1a64:a84edb49f22868c5"
---

Review mode `outcome`: one branch, no slices. Each task below states every definition it uses, so it can be
finished from its own section and the ticket.

## Task 1: Wiring: anchor finds the active ticket from a branch named by the working tree's template
covers: @ac-1, D-01, D-02
files: packages/core/schemas/config.schema.json, packages/core/src/model/snapshot.ts, packages/core/src/load/snapshot.ts, packages/core/src/status/branch.ts (new), packages/core/src/index.ts, packages/cli/src/load/fs.ts, packages/cli/src/commands/anchor.ts, packages/cli/src/commands/hook.ts, packages/cli/test/branch.test.ts (new), packages/core/test/schemas.test.ts, packages/cli/test/lane-commands.test.ts
verify: packages/cli/test/lane-commands.test.ts#ac-1-anchor-finds-the-active-ticket-from-a-branch-named-by-the-template (@ac-1), packages/cli/test/branch.test.ts#risk:parsing-ticketOfBranch-matches-a-whole-branch-name-against-each-template

Rules for this task:
- Test ids: every test named on `verify:` is a top-level `it(...)` with no `describe` around it. Its report id is
  the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`
  (`packages/core/src/load/junit.ts`). No test title holds `@` or a comma.
- CLI tests import core from `packages/core/dist`: after changing core source, run `npm run build -w
  packages/core` before running any CLI test.
- Helpers in `packages/cli/test/lane-commands.test.ts`, all already imported there: `makeLaneRepo(extra)`,
  `run(argv, cwd)` (gives `{ code, out, err }`), `gitRun(repo, ...args)`, `commitAll(repo)`, `cleanup(repo)`
  from `./helpers/repo.js`; `CONFIG` and `laneTicket(id)` from `../../../test/helpers/lane.js`.
  `makeLaneRepo(extra)` makes a fresh git sandbox with no commit, holding `accord/config.yml` as `CONFIG`, lane
  ticket `T-1` with its plan, and a green report, each overridden or extended by the `extra` path-to-text map.
  `laneTicket(id)` is a lane M ticket titled `Export`. `CONFIG` ends in a newline and has no `branch` key.
- Add a module-level constant to `lane-commands.test.ts`: `const BRANCHED = CONFIG + 'branch: "feature/{id}"\n';`.
- `t/{id}` is the default template; core exports it as `DEFAULT_BRANCH_TEMPLATE`.

Tests first.
- `packages/cli/test/lane-commands.test.ts`, top-level
  `it('ac-1 anchor finds the active ticket from a branch named by the template')`:
  `makeLaneRepo({ 'accord/config.yml': BRANCHED, 'accord/tickets/ST-AN-2.md': laneTicket('ST-AN-2') })`,
  `commitAll(repo)`, `gitRun(repo, 'checkout', '-q', '-b', 'feature/ST-AN-2')`. `run(['anchor'], repo)`: code 0,
  `out.startsWith('# Anchor: ST-AN-2 "Export"\n')`. Then `run(['hook', 'session-resume'], repo)`: its `out`
  contains `# Anchor: ST-AN-2 "Export"`. `cleanup` in `finally`, as the file's other cases do.
- `packages/cli/test/branch.test.ts` (new), importing `ticketOfBranch` from `../src/load/fs.js`, top-level
  `it('risk:parsing ticketOfBranch matches a whole branch name against each template')`, with
  `none = () => false`:
  - `ticketOfBranch('feature/ST-1', ['t/{id}', 'feature/{id}'], none)` is `'ST-1'`; `'t/ST-1'` with the same
    templates is `'ST-1'`.
  - `'feature/ST-1/x'`, `'feature/'`, `'xfeature/ST-1'` and `'main'` give `undefined`.
  - A `t/` name is matched only by `t/{id}`: `ticketOfBranch('t/x-ST-1', ['t/{id}', 't/x-{id}'], none)` is
    `'x-ST-1'`.
  - Overlapping templates (ledger Ruling): `ticketOfBranch('a-b-ST-1', ['t/{id}', 'a-{id}', 'a-b-{id}'],
    (id) => id === 'ST-1')` is `'ST-1'`; with `none` it is `'b-ST-1'` (first matching template).
  - A template without exactly one `{id}` matches nothing: `ticketOfBranch('main', ['main'], none)` and
    `ticketOfBranch('a-b', ['{id}-{id}'], none)` give `undefined`.
- `packages/core/test/schemas.test.ts`: the existing case `top-level properties are the six D-16 keys plus ...`
  gains `'branch'` at the end of its expected list; its title stays.

Interface:
- `config.schema.json`: an optional property `"branch": { "type": "string" }` appended after `legacy_ids`.
  Task 4 adds the D-04 rules to it.
- `AccordConfig` gains `branch?: string`.
- `packages/core/src/status/branch.ts` (new), pure: `export const DEFAULT_BRANCH_TEMPLATE = 't/{id}'`, exported
  from `index.ts`. Core holds only what its own rows use; matching a branch name against templates stays in the
  CLI loader, as the Approach chose.
- `packages/cli/src/load/fs.ts`, exported `ticketOfBranch(name: string, templates: readonly string[], known:
  (id: string) => boolean): string | undefined`. A template is used only when `template.split('{id}')` has
  exactly two parts `[pre, suf]`. When `name` starts with `t/`, only `t/{id}` is tried. A template matches when
  `name` starts with `pre`, ends with `suf`, and the middle is non-empty and holds no `/`; the middle is the id.
  Among matches, the first whose id satisfies `known` wins, else the first match in template order.
- `SnapshotInput` and `RepoSnapshot` gain `branchTemplates?: string[]` (the templates in force), carried through
  by `loadSnapshot` with the same spread pattern as `claims`, so an absent value stays absent.
- `loadFromFs`: `branchTemplates` is `[DEFAULT_BRANCH_TEMPLATE, first.config?.branch]` with undefined and
  duplicates removed; the key is omitted when that list is `['t/{id}']`, so every existing load is
  byte-identical.
- `packages/cli/src/commands/anchor.ts`: `activeTicket(root: string, snapshot: RepoSnapshot): string |
  undefined` returns `ticketOfBranch(branch, snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE], (id) =>
  Object.hasOwn(snapshot.tickets, id))`; `anchor` and `hook` pass `ctx.snapshot`. The header comment says the
  active ticket is the current branch named by a template in force.

Must not change: every case in `describe('accord anchor')` and in `packages/cli/test/hook.test.ts` (a `t/<id>`
branch anchors; another branch and a detached HEAD print nothing; a git failure is one stderr line and exit 0);
`gitClaims` and every `status, claims, and next` case; the D-54 snapshot goldens (no fixture sets `branch`).

End by running `npm run build`.

## Task 2: The default branch's template is in force for everyone
covers: D-07
files: packages/core/src/status/branch.ts (new), packages/core/src/index.ts, packages/cli/src/load/fs.ts, packages/core/test/branch.test.ts (new), packages/cli/test/lane-commands.test.ts
verify: packages/cli/test/lane-commands.test.ts#risk:complex-branching-a-template-on-the-default-branch-is-in-force-without-the-key-in-the-working-tree, packages/cli/test/lane-commands.test.ts#risk:complex-branching-a-template-on-a-ref-other-than-the-default-branch-sets-nothing, packages/core/test/branch.test.ts#risk:parsing-branchTemplateOf-reads-only-branch-and-never-throws

Rules for this task:
- Test ids: every test named on `verify:` is a top-level `it(...)` with no `describe` around it. Its report id is
  the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`
  (`packages/core/src/load/junit.ts`). No test title holds `@` or a comma.
- CLI tests import core from `packages/core/dist`: after changing core source, run `npm run build -w
  packages/core` before running any CLI test.
- Helpers in `packages/cli/test/lane-commands.test.ts`: `makeLaneRepo(extra)`, `run(argv, cwd)` (gives
  `{ code, out, err }`), `gitRun(repo, ...args)`, `commitAll(repo)`, `writeFiles(repo, files)`, `cleanup(repo)`
  from `./helpers/repo.js`; `CONFIG` and `laneTicket(id)` from `../../../test/helpers/lane.js`.
  `makeLaneRepo(extra)` makes a fresh git sandbox with no commit, holding `accord/config.yml` as `CONFIG`, lane
  ticket `T-1` with its plan, and a green report, each overridden or extended by `extra`. `laneTicket(id)` is a
  lane M ticket titled `Export`. `CONFIG` has no `branch` key. `BRANCHED` is the module-level constant Task 1
  added: `CONFIG + 'branch: "feature/{id}"\n'`.
- `packages/core/src/status/branch.ts` exists from Task 1 and exports `DEFAULT_BRANCH_TEMPLATE = 't/{id}'`.
  `loadFromFs` in `packages/cli/src/load/fs.ts` sets the snapshot's `branchTemplates` (Task 1), omitted when it
  would be `['t/{id}']`.
- The default branch is the first of these three refs that names a commit, in this order: `refs/remotes/origin/HEAD`
  (followed as a symbolic ref), `refs/remotes/origin/main`, `refs/remotes/origin/master`. It is the order
  `gitPeopleOnRefs` in `fs.ts` uses.
- The templates in force (D-07) are, in this order with undefined and duplicates removed: `t/{id}`, the default
  branch's valid `branch`, and the working tree's `branch`.

Tests first.
- `packages/cli/test/lane-commands.test.ts`, top-level
  `it('risk:complex-branching a template on the default branch is in force without the key in the working tree')`:
  `makeLaneRepo({ 'accord/config.yml': BRANCHED, 'accord/tickets/ST-AN-2.md': laneTicket('ST-AN-2') })`,
  `commitAll`; `gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD')`;
  `gitRun(repo, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')`; write
  `accord/config.yml` as `CONFIG`, `commitAll`; `gitRun(repo, 'checkout', '-q', '-b', 'feature/ST-AN-2')`.
  `run(['anchor'], repo)` prints `# Anchor: ST-AN-2 "Export"\n` at the start. Then
  `gitRun(repo, 'symbolic-ref', '--delete', 'refs/remotes/origin/HEAD')`: `anchor` still prints it (the
  `origin/main` fallback). `cleanup` in `finally`.
- Top-level `it('risk:complex-branching a template on a ref other than the default branch sets nothing')`: the
  same, but the committed `BRANCHED` config goes to `refs/remotes/origin/other` and no `origin/HEAD`,
  `origin/main` or `origin/master` exists; after rewriting config.yml as `CONFIG`, `commitAll` and checking out
  `feature/ST-AN-2`, `run(['anchor'], repo)` gives code 0 and `out` `''`.
- `packages/core/test/branch.test.ts` (new), importing `branchTemplateOf` from `../src/status/branch.js`,
  top-level `it('risk:parsing branchTemplateOf reads only branch and never throws')`: `''`, a text with a YAML
  syntax error (`'branch: [\n'`), `'branch: [a]\n'` and `'profile: build\n'` give `undefined`;
  `'branch: "feature/{id}"\nunknown: 1\n'` gives `'feature/{id}'`.

Interface:
- `packages/core/src/status/branch.ts` gains, exported from `index.ts`, `branchTemplateOf(text: string): string
  | undefined`: `parseYamlMap` on `normaliseText(text)` (as `peopleOf` in `lint/ids.ts` does); returns
  `map.branch` only when it is a string and `validate('config', map)` holds no finding whose `pointer` is
  `/branch` (ledger Ruling: the rest of that file is not validated); never throws.
- `packages/cli/src/load/fs.ts`, a new non-exported
  `gitDefaultBranch(root: string): { exists: boolean; template?: string }`: one spawn of
  `git -c credential.interactive=never cat-file --batch` with `input` the six lines `<ref>` and
  `<ref>:accord/config.yml` for each of the three default-branch refs above in order, `maxBuffer: 64 * 1024 *
  1024`, stdio all `pipe`, and `env: { ...process.env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0',
  GCM_INTERACTIVE: 'never' }` (ledger Ruling). The Buffer output is read as `gitPeopleOnRefs` reads its own:
  a header `<sha> <type> <size>` followed by `size` bytes and a newline, or a `missing` line. The default branch
  is the first ref whose `<ref>` line names a commit; its config blob goes through `branchTemplateOf`.
  No ref found gives `{ exists: false }`. A spawn failure gives `{ exists: true }`: no template is added, and a
  new claim then takes `t/{id}` rather than a template the team may not count.
- `loadFromFs`: `branchTemplates` becomes `[DEFAULT_BRANCH_TEMPLATE, def.template, first.config?.branch]`,
  undefined and duplicates removed, still omitted when equal to `['t/{id}']`.

Must not change: Task 1's cases; `gitPeopleOnRefs` and every `new-ticket.test.ts` case; a repository with no
commit loads as before (cat-file prints `missing` for each line and nothing is added).

End by running `npm run build`.

## Task 3: Template branches and t/ branches both count as claims, and each lane row carries its branch
covers: @ac-2, D-03, D-08, D-09
files: packages/core/src/model/snapshot.ts, packages/core/src/load/snapshot.ts, packages/core/src/status/rows.ts, packages/cli/src/load/fs.ts, packages/core/test/lane-status.test.ts, packages/cli/test/lane-commands.test.ts
verify: packages/cli/test/lane-commands.test.ts#ac-2-template-branches-and-t-branches-both-count-as-claims (@ac-2), packages/cli/test/lane-commands.test.ts#risk:complex-branching-among-claim-refs-for-one-ticket-a-pushed-ref-wins-and-then-the-newest-tip, packages/cli/test/lane-commands.test.ts#risk:complex-branching-a-new-claim-is-named-by-the-default-branch-template-before-the-working-tree-one, packages/core/test/lane-status.test.ts#risk:complex-branching-a-lane-row-carries-its-claim-branch-or-the-name-a-new-claim-would-use

Rules for this task:
- Test ids: every test named on `verify:` is a top-level `it(...)` with no `describe` around it. Its report id is
  the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`
  (`packages/core/src/load/junit.ts`). No test title holds `@` or a comma.
- CLI tests import core from `packages/core/dist`: after changing core source, run `npm run build -w
  packages/core` before running any CLI test.
- Helpers in `packages/cli/test/lane-commands.test.ts`: `makeLaneRepo(extra)`, `run(argv, cwd)` (gives
  `{ code, out, err }`), `gitRun(repo, ...args)`, `commitAll(repo)`, `writeFiles(repo, files)`, `cleanup(repo)`
  from `./helpers/repo.js`; `CONFIG` and `laneTicket(id)` from `../../../test/helpers/lane.js`.
  `makeLaneRepo(extra)` makes a fresh git sandbox with no commit, holding `accord/config.yml` as `CONFIG`, lane
  ticket `T-1` with its plan, and a green report, each overridden or extended by `extra`. `laneTicket(id)` is a
  lane M ticket titled `Export`. `CONFIG` has no `branch` key. `BRANCHED` is the module-level constant Task 1
  added: `CONFIG + 'branch: "feature/{id}"\n'`. `OLD` is the file's existing constant
  `new Date('2000-01-01T00:00:00Z')`.
- From Tasks 1 and 2: core exports `DEFAULT_BRANCH_TEMPLATE = 't/{id}'` from `status/branch.ts`; `fs.ts` exports
  `ticketOfBranch(name, templates, known)` (the id a branch name holds under the templates, or undefined) and
  holds `gitDefaultBranch(root)`, giving `{ exists, template? }` for the fetched default branch (the first of
  `origin/HEAD`, `origin/main`, `origin/master` that names a commit) and its valid `branch`. `loadFromFs` sets
  `branchTemplates`, the templates in force: `t/{id}`, the default branch's valid `branch`, and the working
  tree's `branch` (`first.config?.branch`), in that order, duplicates removed.
- The claim template is the template a new claim is named by (D-09): when a default branch exists, its valid
  `branch`, else `t/{id}`; when no default branch exists, the working tree's `branch`, else `t/{id}`.

Tests first.
- `packages/cli/test/lane-commands.test.ts`, top-level
  `it('ac-2 template branches and t branches both count as claims')`: `makeLaneRepo` with `accord/config.yml`
  as `BRANCHED` and `accord/tickets/ST-AN-2.md`, `ST-AN-3.md`, `ST-AN-4.md` as `laneTicket(id)`. For each of the
  three ids run `['approve', id]` and `['gate', 'ready', id]` (each gate exits 0), then `commitAll`. For
  `[email, ref]` in `[['an@example.com', 'refs/remotes/origin/feature/ST-AN-2'], ['bo@example.com',
  'refs/remotes/origin/t/ST-AN-3']]`: `sha = gitRun(repo, '-c', 'user.email=' + email, '-c', 'user.name=x',
  'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'claim').trim()`, then `gitRun(repo, 'update-ref', ref,
  sha)`. `status --json`: ST-AN-2 has `claimedBy` `'an@example.com'` and `branch` `'feature/ST-AN-2'`; ST-AN-3
  has `'bo@example.com'` and `'t/ST-AN-3'`; ST-AN-4 has no `claimedBy`. `next --json`: the ids are exactly
  `['ST-AN-4']` and that row's `branch` is `'feature/ST-AN-4'` (no default branch exists, so the working tree's
  template names new claims).
- Top-level `it('risk:complex-branching among claim refs for one ticket a pushed ref wins and then the newest tip')`
  (ledger Ruling): `makeLaneRepo` with `BRANCHED` and `ST-AN-2`; `commitAllAt(repo, OLD)` (add `commitAllAt` to
  the file's import from `./helpers/repo.js`; it commits everything with that author and committer date),
  `update-ref refs/remotes/origin/t/ST-AN-2 HEAD`; write `src/a.ts`, `commitAllAt(repo, new
  Date('2010-01-01T00:00:00Z'))`, `update-ref refs/remotes/origin/feature/ST-AN-2 HEAD`; write `src/b.ts`,
  `commitAll`, `gitRun(repo, 'branch', 't/ST-AN-2')`. The `status --json` row of ST-AN-2 has `branch`
  `'feature/ST-AN-2'`: the local branch is newest but not pushed, and of the two pushed refs the newer wins over
  the one that sorts after it by refname (`origin/t/...` after `origin/feature/...`).
- Top-level `it('risk:complex-branching a new claim is named by the default branch template before the working tree one')`
  (D-09): `makeLaneRepo` with config `CONFIG` and `ST-AN-4`; `commitAll`;
  `update-ref refs/remotes/origin/main HEAD`; write config as `BRANCHED` (left uncommitted). `status --json`:
  ST-AN-4's `branch` is `'t/ST-AN-4'`. Write config as `CONFIG + 'branch: "team/{id}"\n'`, `commitAll`,
  `update-ref refs/remotes/origin/main HEAD`, write config as `BRANCHED`: `branch` is `'team/ST-AN-4'`. Then
  `gitRun(repo, 'update-ref', '-d', 'refs/remotes/origin/main')`: `branch` is `'feature/ST-AN-4'`.
- `packages/core/test/lane-status.test.ts`, top-level
  `it('risk:complex-branching a lane row carries its claim branch or the name a new claim would use')`, with
  files `{ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1'), 'accord/tickets/L-1.md': laneTicket('L-1',
  { lane: '' }) }` (`T1` is that file's existing path constant for `T-1`) and
  `statusRows(loadSnapshot({ files, tree: [], ...extra }))`: with no extra, T-1's `branch` is `'t/T-1'` and
  L-1's row has no `branch`; with `{ claimTemplate: 'feature/{id}' }` it is `'feature/T-1'`; with
  `{ claimTemplate: 'feature/{id}', claims: { 'T-1': 'an@example.test' }, claimBranches: { 'T-1': 't/T-1' } }`
  it is `'t/T-1'`.
- `LANE_KEYS` in `lane-status.test.ts` gains `'branch'`. In `lane-commands.test.ts`, the case `a ticket without
  lane is unchanged by a t/<id> branch, in the table and under --json` changes in one place only: the array in its
  `for (const key of [...])` loop gains `'branch'` after `'claimedBy'`, so a 0.1.0 row is proved free of it. Every
  other line of that case stays as it is.

Interface:
- `SnapshotInput` and `RepoSnapshot` gain `claimBranches?: Record<string, string>` (ticket id -> the short name
  of the winning claim ref, e.g. `feature/ST-AN-2`) and `claimTemplate?: string`, carried through by
  `loadSnapshot` like `claims` (ledger Ruling: they travel in the snapshot).
- `StatusRow` gains `branch?: string`, set in the lane-only block directly after `claimedBy`:
  the winning claim branch when `snapshot.claimBranches` has `id` as an own key (checked with `Object.hasOwn`,
  as the `claimedBy` line in `status/rows.ts` checks `claims`), else
  `(snapshot.claimTemplate ?? DEFAULT_BRANCH_TEMPLATE).replace('{id}', id)`. A plain index is not used: ticket ids
  such as `constructor` or `toString` would read `Object.prototype` and lose their `branch` (D-08; ledger Ruling: lane rows only, so no 0.1.0 row or golden moves). `nextRows` is unchanged; its rows
  carry `branch` because they are status rows.
- `fs.ts` `gitClaims(root, templates, known)` returns `{ claims, branches, activity }`. One for-each-ref spawn,
  same format, with the patterns `refs/heads/<pre>*<suf>` and `refs/remotes/*/<pre>*<suf>` for each template in
  force (`[pre, suf] = template.split('{id}')`, a template without exactly two parts skipped). Each ref's short
  name is the part after `refs/heads/` (local) or `refs/remotes/<remote>/` (pushed, remote without `/`, as
  today); its id is `ticketOfBranch(short, templates, known)`. Per id the winner is a pushed ref over a local
  one, then the greater committer time; the per-id winners are kept in a `Map` keyed by id, so an inherited
  key such as `constructor` never counts as an earlier winner. `claims` and `branches` are then built from that
  `Map` as objects made with `Object.create(null)`; `claims[id]` is the winner's author, `branches[id]` its
  short name. `activity`
  keeps the newest time over every matched ref, as today. The failure message still starts with
  `git for-each-ref failed`.
- `loadFromFs` passes `known = (id) => Object.hasOwn(first.tickets, id)`, sets `claimBranches` when non-empty,
  and sets `claimTemplate` to the claim template from `gitDefaultBranch` and `first.config?.branch`, omitted when
  it is `t/{id}`.

Must not change: every case in `describe('status, claims, and next')` (ids with dots and underscores claim; the
pushed claim wins over a local one; a broken claim ref exits 2), except the one-key addition to `a ticket
without lane is unchanged by a t/<id> branch, in the table and under --json` described under Tests first,
whose before-and-after equality and every other assertion stay as they are; the status table columns; `nextRows` filtering; `lastActivity`.

End by running `npm run build`.

## Task 4: Lint rejects an invalid template, and without the key nothing changes
covers: @ac-3, @ac-4, D-04, D-06
files: packages/core/schemas/config.schema.json, packages/core/test/schemas.test.ts, packages/core/test/branch.test.ts (new), packages/cli/test/lane-commands.test.ts
verify: packages/cli/test/lane-commands.test.ts#ac-3-lint-rejects-an-invalid-template-and-anchor-still-reads-the-t-branch (@ac-3), packages/cli/test/lane-commands.test.ts#ac-4-without-the-branch-key-t-branches-count-and-template-branches-do-not (@ac-4), packages/core/test/schemas.test.ts#risk:parsing-branch-refuses-a-template-that-breaks-any-one-rule, packages/core/test/branch.test.ts#risk:parsing-branchTemplateOf-drops-a-template-the-schema-refuses, packages/cli/test/lane-commands.test.ts#risk:complex-branching-an-invalid-template-names-no-claim

Rules for this task:
- Test ids: every test named on `verify:` is a top-level `it(...)` with no `describe` around it. Its report id is
  the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`
  (`packages/core/src/load/junit.ts`). No test title holds `@` or a comma.
- CLI tests import core from `packages/core/dist`: after changing the schema, run `npm run build -w
  packages/core` before running any CLI test.
- Helpers in `packages/cli/test/lane-commands.test.ts`: `makeLaneRepo(extra)`, `run(argv, cwd)` (gives
  `{ code, out, err }`), `gitRun(repo, ...args)`, `commitAll(repo)`, `writeFiles(repo, files)`, `cleanup(repo)`
  from `./helpers/repo.js`; `CONFIG` and `laneTicket(id)` from `../../../test/helpers/lane.js`.
  `makeLaneRepo(extra)` makes a fresh git sandbox with no commit, holding `accord/config.yml` as `CONFIG`, lane
  ticket `T-1` with its plan, and a green report, each overridden or extended by `extra`. `laneTicket(id)` is a
  lane M ticket titled `Export`. `CONFIG` ends in a newline and has no `branch` key. `BRANCHED` is the
  module-level constant Task 1 added: `CONFIG + 'branch: "feature/{id}"\n'`.
- From Tasks 1 to 3: `branch` is a plain string in `config.schema.json`; `branchTemplateOf(text)` in
  `packages/core/src/status/branch.ts` gives a config text's `branch` when the schema raises nothing at
  `/branch`, else `undefined`. `loadFromFs` in `packages/cli/src/load/fs.ts` builds the templates in force:
  `t/{id}`, the fetched default branch's valid `branch` (the default branch is the first of `origin/HEAD`,
  `origin/main`, `origin/master` that names a commit), and the working tree's `branch` (`first.config?.branch`).
  Lane rows of `status --json` carry `claimedBy` and `branch`.

Tests first.
- `packages/cli/test/lane-commands.test.ts`, top-level
  `it('ac-3 lint rejects an invalid template and anchor still reads the t branch')`: `makeLaneRepo` with
  `ST-AN-2`; `commitAll`; `checkout -q -b t/ST-AN-2`. For each value in `['{id}', 'feature/{id}/{id}',
  'feature/x', 'feature {id}', 'feature/..{id}']`: write `accord/config.yml` as `CONFIG + 'branch: "' + value +
  '"\n'`; `run(['lint', '--json'], repo)` exits 1 and its `findings` hold one with `pointer === '/branch'` and a
  `rule` starting `schema.`; `run(['anchor'], repo)` exits 0 and its `out` starts with
  `# Anchor: ST-AN-2 "Export"\n`. Then with `BRANCHED`, the lint findings hold none with `pointer === '/branch'`.
- Top-level `it('ac-4 without the branch key t branches count and template branches do not')`: `makeLaneRepo`
  with `ST-AN-2` and `ST-AN-3` (config `CONFIG`); `commitAll`;
  `update-ref refs/remotes/origin/feature/ST-AN-3 HEAD`; `checkout -q -b t/ST-AN-2`. `anchor` prints the
  ST-AN-2 anchor; `status --json`: ST-AN-2 has `claimedBy`, ST-AN-3 has none. This is a guard test: it passes
  once written. Its red step is a mutation check: append `'feature/{id}'` to the templates in force in
  `loadFromFs`, see the case fail, and restore it.
- `packages/core/test/schemas.test.ts`, top-level
  `it('risk:parsing branch refuses a template that breaks any one rule')`, with its `idsBase` and `at` helpers:
  `'feature/{id}'`, `'t/{id}'` and `'team.x/{id}-wip'` are valid. Each of `'{id}'`, `'a/x'`, `'a/{id}/{id}'`,
  `'a {id}'`, `'a/{name}/{id}'`, `'-a/{id}'`, `'/a/{id}'`, `'a/{id}/'`, `'a/{id}.'`, `'a/..{id}'`,
  `'a//{id}'`, `'.a/{id}'`, `'a/.x/{id}'`, `'a.lock/{id}'`, `'t/x/{id}'` and `'t/{id}-x'` gives
  `schema.pattern@/branch`.
- `packages/core/test/branch.test.ts` (created in Task 2), top-level
  `it('risk:parsing branchTemplateOf drops a template the schema refuses')`: `'branch: "{id}"\n'` and
  `'branch: "feature/..{id}"\n'` give `undefined`.
- `packages/cli/test/lane-commands.test.ts`, top-level
  `it('risk:complex-branching an invalid template names no claim')`: `makeLaneRepo` with config
  `CONFIG + 'branch: "{id}"\n'` and `ST-AN-2`; `commitAll`; `update-ref refs/remotes/origin/main HEAD` (the
  default branch holds the same invalid template); `gitRun(repo, 'branch', 'ST-AN-2')`;
  `update-ref refs/remotes/origin/ST-AN-2 HEAD`. `status --json`: ST-AN-2 has no `claimedBy` and its `branch`
  is `'t/ST-AN-2'`.

Interface: `branch` in `config.schema.json` becomes `{ "type": "string", "allOf": [...] }` with one `pattern`
per rule (D-04; ledger Ruling: lint names the rule that failed), each JSON-escaped:
1. exactly one `{id}`: `^[^{}]*\{id\}[^{}]*$`
2. a fixed character besides it: `^(?!\{id\}$)`
3. only `[A-Za-z0-9._/-]` besides `{id}`: `^(?:[A-Za-z0-9._/-]|\{id\})+$`
4. no leading `-` or `/`: `^(?![-/])`
5. no trailing `/` or `.`: `[^/.]$`
6. no `..`: `^(?!.*\.\.)`
7. no `//`: `^(?!.*//)`
8. no segment starting with `.`: `^(?!(?:.*/)?\.)`
9. no segment ending in `.lock`: `^(?!.*\.lock(?:/|$))`
10. no `t/` prefix other than `t/{id}`: `^(?:t/\{id\}$|(?!t/))`
The schema still compiles under ajv's strict mode with no warning. An invalid working-tree `branch` makes
`config` undefined, as any schema error does (D-06), so the templates in force fall back to `t/{id}` plus the
default branch's valid one; `branchTemplateOf` drops an invalid default-branch template through the same rules.

Must not change: Tasks 1 to 3 cases; every existing `schemas.test.ts` case, including the D-16 minimal config
with no `branch`; the lint goldens (no fixture sets `branch`).

End by running `npm run build`.

## Task 5: The /accord skill takes the claim branch from the CLI
covers: @ac-5, D-05, D-08
files: packages/core/skills/accord/SKILL.md, packages/core/skills/accord/ids.md, packages/core/src/generated/skills.ts, .claude/skills/accord/SKILL.md, .claude/skills/accord/ids.md, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#ac-5-the-accord-skill-takes-the-claim-branch-from-the-CLI-in-Continue-Pick-up-and-New-request (@ac-5)

Rules for this task:
- Test ids: every test named on `verify:` is a top-level `it(...)` with no `describe` around it. Its report id is
  the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`
  (`packages/core/src/load/junit.ts`). No test title holds `@` or a comma.
- From Task 3: each lane row of `accord status --json` and `accord next --json` carries `branch`, the claim
  branch of a claimed ticket or the name a new claim would use.

Test first: `packages/core/test/stage-skills.test.ts`, top-level
`it('ac-5 the accord skill takes the claim branch from the CLI in Continue Pick up and New request')`. From
`files` (the module's render), the text of `.claude/skills/accord/SKILL.md`; three slices, each with every
whitespace run turned into one space: Continue from `## Continue` to `## Pick up`; Pick up from `## Pick up` to
`## New request`; M from `- **M.**` to `- **L and P.**`. Continue contains `` `branch` `` and
`` `accord status --json` ``; Pick up contains `` `branch` ``, `` `accord next --json` `` and `push it`; M
contains `` `branch` ``, `` `accord status --json` `` and `push it`. None of the three contains `` `t/ `` or
`{id}`. In the same file, the `accord` row of `REQUIRED` drops `'t/<id>'`.

Text, naming no other tool, in `packages/core/skills/accord/SKILL.md`:
- Continue step 1 becomes exactly:
  ```
  1. Switch to its `branch` from `accord status --json`. The active ticket is
     the branch, read from git, never from memory.
  ```
- The Pick up paragraph becomes exactly:
  ```
  Create its `branch` from `accord next --json`, commit `claim: <id>` on it
  with `--allow-empty`, and push it: the pushed branch is the claim. Then
  continue as above.
  ```
- The lane M bullet becomes exactly:
  ```
  - **M.** Run `accord new ticket <id> --lane M`; when config.yml has
    `people`, follow `./ids.md` and run `accord new ticket --type <story|bug>
    --lane M` with no id instead. Create the ticket's `branch` from
    `accord status --json`, commit the ticket file and any `people` edit on
    it, and push it (the pushed branch is the claim), then load
    `accord-intent`.
  ```
- To keep the rendered file within 5120 bytes, the three-line Dashboard paragraph that starts
  `Every section, READY TO PICK UP included,` and ends `after its stage.` becomes exactly:
  ```
     Every section, READY TO PICK UP included, shows `idle <n>d` after the
     stage of a ticket whose `accord status --json` row has `idleDays`.
  ```
- `packages/core/skills/accord/ids.md`: in step 1 of `## Dropping instead of renaming`, the sentence that
  forbids deleting a `t/` branch becomes `Never delete a claim branch to drop a ticket.`

Then run, in order: `npm run gen`, `npm run build`, and `node packages/cli/dist/cli.js skills sync`, which
rewrites `.claude/skills/accord/SKILL.md` and `.claude/skills/accord/ids.md`. These must pass with the new case:
`stage-skills.test.ts` (the `accord` row of `REQUIRED`), `skills.test.ts` (the `MAX_SKILL_BYTES` size case, the
generated-module drift case, the source line limit of 120, and `no rendered text restates a rule the CLI
enforces`), and `skills-sync.test.ts` (`risk:drift the committed /accord copy carries the idle wording`, which
needs `idleDays` and `idle <n>d`).

Must not change: every other phrase in the `accord` row of `REQUIRED`, including `--lane M`, `push it (the
pushed branch is the claim)`, `claim: <id>`, `accord new ticket --type` and `./ids.md`; Continue steps 2 to 4;
the S, L and P bullets; the Rules; the other skills.

End by running `npm run build`.
