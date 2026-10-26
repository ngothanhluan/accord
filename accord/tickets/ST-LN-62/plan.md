---
baseline: 4253a6510c6f01e7afb557c7cfd722b63a08434f
plan_hash: "fnv1a64:21ef41a6f3b7ef01"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: Task 1 is the wiring. It adds the branch-diff fact, the CLI loader that builds it at `accord gate done` for
every ticket with `lane:`, the fail-closed rule, and the lane S scope rule with its exemptions, proven end to end on a
real git repository (@ac-2). Task 2 adds the declared and confirmed wording-only exception (@ac-3). Task 3 adds
`sensitive:` and its lane S rule (@ac-4). Task 4 adds the interface signs for every lane (@ac-5). Task 5 shows the
out-of-scope files and the interface signs in `accord review-package`. Task 6 makes the lane proposal start from the
scout and makes lane S tickets record `## Scope` (@ac-1). Task 7 writes the reviewer and record text for the three
fixed lines. Task 8 holds this repository's own `sensitive:` and `generated:` lists, which the owner reviews first.
Task 9, added at re-plan from the final review, makes `gate.branch-unknown` fail a branch diff that adds no change
over the merge base in every lane, keeps "the branch diff does not change the ticket file" as a trigger for lane S
only, and supersedes the Task 1 text it names.

Rules for every task:
- Test ids: every test this plan writes is a top-level `it(...)` with no `describe` around it. Its report id is the
  test file's path from the repository root, then `#`, then the `it` title with each run of whitespace turned into
  `-`, letter case kept (`packages/core/src/load/junit.ts:16`), so `lane S` in a title is `lane-S` in its id. No test
  title holds `@`, a comma or an apostrophe. No existing test is renamed.
- A test that makes a commit uses `commitMsg` from `packages/cli/test/helpers/repo.ts` (`-F <file>
  --cleanup=verbatim`, conventions.md), except `lane-flow.test.ts`, which keeps its own `commitAll`. Every test that
  spawns git passes `120_000` as the third argument of `it`. A sandbox repository gets
  `user.email`, `user.name`, `commit.gpgsign false` and `core.autocrlf false` through `gitRun(repo, 'config', ...)`
  right after `makeEmptyRepo()`, as `repoWith` does at `packages/cli/test/lane-s.test.ts:53-60`.
- CLI tests import core from `packages/core/dist`. After any change under `packages/core/`, run
  `npm run build -w packages/core` before a CLI test. Run one file with `npx vitest run <path>`. End every task with
  `npm run build`, `npm run lint` and `npm run typecheck`, then run the test files the task names.
- Every git spawn is `execFileSync('git', [...])` with a literal array and no shell, `cwd: root`,
  `stdio: ['ignore', 'pipe', 'pipe']` (or `pipe` stdin for `cat-file --batch`), a 64 MiB `maxBuffer`, and
  `env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }`. Every `git log` is written
  `'-c', 'log.showSignature=false', 'log', '--no-show-signature', ...` exactly, because
  `packages/cli/test/spawn-surface.test.ts:84-100` checks that text: its scan flags every quoted `'log'` or `'show'`
  not written that way, so a step label or error text in source is never the bare quoted word `'log'` (write
  `` `git log -G ac_hash` `` inside the template string instead). Paths from git are read with `-z` and split on
  `\0`; a path handed back to git as a pathspec carries `:(literal)` (conventions.md).
- Core (`packages/core/src`) imports no `node:` module. Files are LF with no BOM. Add no dependency. Every printed path
  uses `/`.
- No added line in any non-Markdown file of this branch holds the literal text of the call sign, a dot followed by
  `command(` or `option(`: this ticket's own `accord gate done` would read it as a sign of a new interface. In test
  sources build such strings by concatenation, for example `'program.' + 'command(' + "'x')"`; in core source write
  the pattern as `/\.(command|option)\(/`. No text this plan adds under `packages/core/skills/` or
  `packages/core/agents/` names the call sign either, since its generated copy in `packages/core/src/generated/`
  is not Markdown.
- Rendered skill and agent text never names a gate rule id, never says `warning`, never uses `Ready` or `Done` as a
  word other than in `Done when`, and never names a `packages/` path (`packages/core/test/skills.test.ts:280-448`).

Definitions shared by every task:
- The fact: `BranchFact`, defined in Task 1, is the branch's diff from its merge base with the default branch to HEAD,
  loaded by the CLI at `accord gate done` only for a ticket whose frontmatter has `lane:` (ledger Ruling 15).
- Counted change: a `BranchChange` `c` with `c.kind !== 'modified' || c.binary === true || c.lines > 0`. A change
  that only moves whitespace, blank lines or line endings has `kind: 'modified'` and `lines: 0`, and is never
  counted (D-02, ledger Ruling 8).
- Exempt path of ticket `id` (ledger Ruling 9): `accord/tickets/<id>.md`; a path starting `accord/tickets/<id>/`; a
  path in `fact.synced`; a path that an entry of the merge-base config's `generated:` list matches, except
  `.claude/settings.json`, which a `generated:` entry never exempts. `fact.synced` holds a path `accord skills sync`
  writes only when its HEAD text equals what sync would write: the fresh render for a skill, agent or plugin copy,
  and for `.claude/settings.json` the hook merge (`hooksPlanFor`, `packages/cli/src/commands/skills.ts:100`)
  applied to its merge-base text (ledger Ruling 19). `accord/product/conventions.md` is not exempt.
- An entry matches a path when the entry ends in `/` and the path starts with it, or when the two are equal (ledger
  Ruling 12). No globs.
- The last round of `review.md`: its last `## ` section whose heading, after `headingKey`, starts with `round `.

Tickets that predate this change (`.github/workflows/accord.yml:127-145` runs `gate done` on every lane S ticket a
pull request touches):
- A lane S ticket already done and merged, whose ticket file a subsequent pull request edits (for example
  `accord/tickets/ST-LN-61.md`): that pull request already fails `gate done` at the baseline, because the ticket's
  review commit is reachable from the default ref, so `gitAfterVerify` drops it
  (`packages/cli/src/load/fs.ts:317-329`), `gitAfterReview` returns nothing and `gate.commit-after-review` fails
  (`packages/core/src/gate/lane-s.ts:86-87`). This plan adds reasons to that failure and no new failing case; such a
  ticket file stays unedited, as at the baseline. No rule is relaxed for it.
- A lane S ticket in flight at upgrade, whose first `ac_hash` commit holds no `## Scope`: `gate done` fails it with
  the `## Scope held no path` reason of Task 1, and the session lifts it to lane M through lane-s.md's
  `## Lift to lane M` (Task 7 names that reason there). There is no bypass: a Scope written after `ac_hash` is never
  read (ledger Ruling 17), so @ac-2 holds for every new lane S ticket.

## Task 1: Wiring: gate done reads the branch diff and fails a lane S ticket that changed a file outside its recorded scope
covers: @ac-2, D-02, D-04, D-06
files: packages/core/src/model/snapshot.ts, packages/core/src/load/snapshot.ts, packages/core/src/load/config.ts, packages/core/schemas/config.schema.json, packages/core/src/gate/scope.ts (new), packages/core/src/gate/rules.ts, packages/core/src/index.ts, packages/core/test/scope.test.ts (new), packages/core/test/schemas.test.ts, packages/core/test/lane-done.test.ts, packages/cli/src/load/fs.ts, packages/cli/src/commands/branch-fact.ts (new), packages/cli/src/commands/gate.ts, packages/cli/test/branch-fact.test.ts (new), packages/cli/test/lane-s.test.ts, packages/cli/test/lane-flow.test.ts
verify: packages/core/test/scope.test.ts#ac-2-gate-done-fails-a-lane-S-ticket-that-touched-a-file-outside-its-recorded-scope (@ac-2), packages/core/test/scope.test.ts#risk:complex-branching-gate-done-fails-closed-on-a-missing-or-failed-branch-diff-a-diff-without-the-ticket-file-and-an-absent-or-empty-scope, packages/cli/test/branch-fact.test.ts#risk:complex-branching-gate-done-reads-the-branch-diff-from-the-merge-base-ignoring-whitespace-and-pins-the-scope-at-the-first-commit-that-records-ac_hash

Consumes: `defaultRefOf` and `gitFilesAt` (`packages/cli/src/load/fs.ts:292`, `:775`), `skillTargets`,
`agentTargets`, `pluginTargets` and `normaliseText` from core, `parseYamlMap` (`packages/core/src/load/yaml.ts:18`),
`scan`, `headingKey`, `stripHtmlComments` (`packages/core/src/load/sections.ts`), `splitFrontmatter`
(`packages/core/src/load/frontmatter.ts`), `laneTicket` (`packages/core/src/gate/work.ts:21`).
Produces: the types `BranchChange` and `BranchFact`, `snapshot.branchFacts`, the config key `generated`,
`configLists`, `scopeLines`, the rules `gate.branch-unknown` and `gate.out-of-scope`, the helpers `factOf`,
`isExempt`, `isCounted` and `outsideScope` in `scope.ts`, the CLI `gitBranchFact` and `branchFactFor`. Tasks 2 to 5
extend them.

Tests first.

`packages/core/test/scope.test.ts` (new). It imports `loadSnapshot` from `../src/load/snapshot.js`, `gateDone` from
`../src/gate/index.js`, `laneSHash` from `../src/gate/hash.js`, and `CONFIG`, `LANE_S_BODY`, `laneTicket` from
`../../../test/helpers/lane.js`. Shared helpers at the top of the file, reused by Tasks 2 to 4:
- `SCOPE = LANE_S_BODY + '\n## Scope\npackages/core/src/status/dashboard.ts\n'`, `H` the `laneSHash` of the
  loaded `laneTicket('S-1', { lane: 'S', body: SCOPE })`, and `S1 = laneTicket('S-1', { lane: 'S', body: SCOPE,
  frontmatter: ['ac_hash: "' + H + '"'] })`.
- `ch(path, lines = 1, kind = 'modified')` returns `{ path, kind, lines }`.
- `fact(changes, extra = {}, id = 'S-1')` returns `{ base: 'b'.repeat(40), changes: [ch('accord/tickets/' + id + '.md'), ...changes],
  synced: [], scope: { commit: 'c'.repeat(40), paths: ['packages/core/src/status/dashboard.ts'] }, ...extra }`.
- `snap(files, facts)` is `loadSnapshot({ files: { 'accord/config.yml': CONFIG, ...files }, tree: [], branchFacts: facts })`.
- `found(s, id, rule)` is `gateDone(s, id).findings.filter((f) => f.rule === rule)`.

- `it('ac-2 gate done fails a lane S ticket that touched a file outside its recorded scope')`:
  - `f = fact([ch('packages/core/src/status/dashboard.ts', 3), ch('packages/core/src/gate/rules.ts', 2),
    ch('accord/tickets/S-1/review.md', 4, 'added'), ch('.claude/skills/accord/SKILL.md', 4), ch('docs/gen/out.txt', 5),
    ch('src/ws.ts', 0)], { synced: ['.claude/skills/accord/SKILL.md'], baseConfig: CONFIG + 'generated:\n  - docs/gen/\n' })`.
  - `r = found(snap({ 'accord/tickets/S-1.md': S1 }, { 'S-1': f }), 'S-1', 'gate.out-of-scope')` has length 1, its
    `level` is `error`, its `file` is `accord/tickets/S-1.md`, and its `reason` contains
    `packages/core/src/gate/rules.ts` and `must be lifted to lane M`.
  - `gateDone(...).verdict` is `fail`.
  - The same fact without the `rules.ts` change gives no `gate.out-of-scope` finding: the ticket file, a file under
    `accord/tickets/S-1/`, a synced copy, a path the base `generated:` list matches, a whitespace-only change and the
    scoped file cause none.
- `it('risk:complex-branching gate done fails closed on a missing or failed branch diff a diff without the ticket file and an absent or empty scope')`:
  - No `branchFacts`: `found(..., 'S-1', 'gate.branch-unknown')` has length 1 with the reason in the Interface
    below; the same for a lane M ticket `laneTicket('T-1')`; a ticket with no `lane:` (`laneTicket('X-1', { lane: '' })`)
    gets no `gate.branch-unknown` and no `gate.out-of-scope`.
  - `{ error: 'boom' }` gives one `gate.branch-unknown` whose reason is `boom`.
  - A fact whose `changes` lack `accord/tickets/S-1.md` gives one `gate.branch-unknown` whose reason contains
    `does not change accord/tickets/S-1.md`.
  - `scope` absent gives one `gate.out-of-scope` whose reason contains `no commit on this branch records ac_hash`;
    `scope.paths` `[]` gives one whose reason contains `## Scope held no path`.
  - `generated:` only in the HEAD config (files `accord/config.yml` = `CONFIG + 'generated:\n  - docs/gen/\n'`, no
    `baseConfig`) does not exempt `docs/gen/out.txt`: one finding naming it.
  - Base `generated:` listing `.claude/` does not exempt `.claude/settings.json`: one finding naming it.
  - `ch('src/x.sh', 0, 'mode')` and `{ ...ch('img/a.png', 0), binary: true }` each give a finding.

`packages/core/test/schemas.test.ts:146`: the expected key list gains `'generated'` after `'commits'`.

`packages/core/test/lane-done.test.ts`: `snap` (line 55) also passes
`branchFacts: { 'T-1': { base: 'b'.repeat(40), changes: [{ path: 'accord/tickets/T-1.md', kind: 'modified', lines: 1 }], synced: [] } }`,
so every existing case keeps its expected findings.

`packages/cli/test/branch-fact.test.ts` (new), importing `cleanup`, `commitMsg`, `gitRun`, `makeEmptyRepo`, `run`,
`writeFiles` from `./helpers/repo.js`, `CONFIG`, `LANE_S_BODY`, `laneTicket`, `junit`, `REPORT` from
`../../../test/helpers/lane.js`, `gitBranchFact` from `../src/load/fs.js`, `hooksPlanFor` and `SETTINGS` from `../src/commands/skills.js`, and
`loadConfig`, `skillTargets` from `@accord-dev/accord-core`. A local `repoWith(files)` sets up the sandbox as the
preamble says.
`errs(out, rule)` returns the reasons of `JSON.parse(out).findings` with that rule.
- `it('risk:complex-branching gate done reads the branch diff from the merge base ignoring whitespace and pins the scope at the first commit that records ac_hash')`:
  - Base on `main`: `accord/config.yml` = `CONFIG`, `accord/tickets/S-1.md` =
    `laneTicket('S-1', { lane: 'S', body: LANE_S_BODY + '\n## Scope\nsrc/a.ts\n' })`, `src/a.ts` `'a\n'`, `src/b.ts`
    `'b\n'`, `src/ws.ts` `'x = 1;\n'`, `.claude/settings.json` `'{"x":1}\n'`, `REPORT` = `junit({ 'a#b': 'passed' })`.
    `commitMsg(repo, 'base')`, then
    `gitRun(repo, 'branch', '-M', 'main')`.
  - `switch -q -c t/S-1`; `run(['gate', 'ready', 'S-1'], repo)` exits 0; `R = commitMsg(repo, 'ready: S-1')`.
  - `switch -q main`, write `src/main.ts`, `commitMsg(repo, 'main moves')`, `switch -q t/S-1`.
  - On the branch write `src/a.ts` `'a2\n'` and `src/ws.ts` `'x   =   1;   \r\n\r\n\r\n'`, then `commitMsg`.
  - Widen the scope at HEAD: replace `'## Scope\nsrc/a.ts\n'` with `'## Scope\nsrc/a.ts\nsrc/b.ts\n'` in the ticket,
    write `src/b.ts` `'b2\n'`, `commitMsg`.
  - Synced copies: `cfg = loadConfig('accord/config.yml', CONFIG).config`; write `.claude/skills/accord/SKILL.md` as the
    `text` of its `skillTargets(cfg)` entry, and `.claude/skills/accord/ids.md` as its entry's `text + 'x\n'`.
    Settings as sync writes them: `.claude/settings.json` = `hooksPlanFor('{"x":1}\n', cfg).text`.
  - Generated from the base only: append `'generated:\n  - gen/\n'` to `accord/config.yml` and write `gen/out.txt`.
    `commitMsg`.
  - `d = run(['gate', 'done', 'S-1', '--json'], repo)` exits 1. `errs(d.out, 'gate.out-of-scope')` has exactly four
    reasons, starting `.claude/skills/accord/ids.md `, `accord/config.yml `, `gen/out.txt ` and `src/b.ts `; each
    contains `` at commit ${R} ``. No reason names `src/a.ts`, `src/ws.ts`, `src/main.ts`,
    `.claude/skills/accord/SKILL.md`, `.claude/settings.json` or `accord/tickets/S-1.md`.
    `errs(d.out, 'gate.branch-unknown')` is `[]`.
  - `f = gitBranchFact(repo, 'S-1', { rendered: skillTargets(cfg), scope: true, settings: { path: SETTINGS, expected: (b) => hooksPlanFor(b, cfg)?.text ?? b } })`:
    `f.base` equals `gitRun(repo, 'merge-base', 'main', 'HEAD').trim()`; `f.scope` equals
    `{ commit: R, paths: ['src/a.ts'] }`; the change for `src/ws.ts` is `{ path: 'src/ws.ts', kind: 'modified', lines: 0 }`;
    no change names `src/main.ts`; `f.synced` is `['.claude/settings.json', '.claude/skills/accord/SKILL.md']`;
    `f.baseConfig` equals `CONFIG`.
  - A hand edit of the settings: rewrite `.claude/settings.json` as `JSON.stringify({ ...JSON.parse(<its text>), y: 2 }, null, 2) + '\n'`,
    `commitMsg`; `errs(run(gate done S-1 --json).out, 'gate.out-of-scope')` now has five reasons, one starting
    `.claude/settings.json `.
  - Lane work on the default branch: `switch -q main`; `errs(run(gate done S-1 --json).out, 'gate.branch-unknown')`
    has one reason containing `does not change accord/tickets/S-1.md`. `switch -q t/S-1`.
  - No default branch: `gitRun(repo, 'branch', '-m', 'main', 'trunk')`; gate done exits 1 and the one
    `gate.branch-unknown` reason contains `none of origin/HEAD, origin/main, origin/master, main or master resolves`.

Interface:
- `packages/core/src/model/snapshot.ts`, after `AfterVerifyCommit`:
  ```ts
  /** ST-LN-62: one path the branch changes from its merge base with the default branch to HEAD, renames split. */
  export interface BranchChange {
    path: string;
    kind: 'added' | 'deleted' | 'modified' | 'mode' | 'type'; // 'mode': status M with differing modes; 'type': status T
    lines: number; // the larger of lines added and lines removed under -b --ignore-blank-lines --ignore-cr-at-eol; 0 when binary
    binary?: true;
  }
  /** ST-LN-62: the branch diff of one lane ticket, or why the host could not read it. */
  export type BranchFact =
    | { error: string }
    | { base: string; changes: BranchChange[]; synced: string[]; baseConfig?: string; scope?: { commit: string; paths: string[] } };
  ```
  `SnapshotInput` and `RepoSnapshot` gain `branchFacts?: Record<string, BranchFact>` ("ticket id -> its branch diff;
  host-supplied by gate done"). `AccordConfig` gains `generated?: string[]`.
- `packages/core/src/load/snapshot.ts:195`: pass `branchFacts` through like `reviewFacts`, absent when absent.
- `packages/core/schemas/config.schema.json`, after `commits`:
  `"generated": { "type": "array", "uniqueItems": true, "items": { "type": "string", "minLength": 1 } }`.
  Task 3 tightens the item pattern.
- `packages/core/src/load/config.ts`: `export function configLists(text: string | undefined): { generated: string[];
  sensitive: { area: string; path: string }[] }`. It never validates: `undefined` or a text whose
  `parseYamlMap('accord/config.yml', normaliseText(text), 0).map` is undefined gives two empty lists. `generated` is
  the string items of a `generated` array. `sensitive` is, for each own key `area` of a plain-object `sensitive` value
  in key order, each string item of its array value as `{ area, path }`. Task 3 consumes `sensitive`.
- `packages/core/src/gate/scope.ts` (new):
  - `export function scopeLines(text: string): string[] | undefined`: `splitFrontmatter(normaliseText(text))`, then
    `scan(body, bodyOffset)`; the first section whose `headingKey` is `scope`, else `undefined`. Its lines after
    `stripHtmlComments`, each trimmed, a leading `- `, `* ` or `+ ` removed, one pair of surrounding backticks
    removed, `\` turned into `/`, empty ones dropped (ledger Ruling 21).
  - `export const factOf = (s: RepoSnapshot, id: string): BranchFact | undefined` through `Object.hasOwn`.
  - `export const matches = (entry: string, path: string): boolean`, as the preamble defines.
  - `export function isExempt(id: string, fact: <the non-error member>, path: string): boolean`, as the preamble
    defines, reading `configLists(fact.baseConfig).generated`.
  - `export const isCounted = (c: BranchChange): boolean`, as the preamble defines.
  - `export function outsideScope(s, id): { paths: string[] } | { cannot: string } | undefined`: `undefined` unless
    `laneTicket(s, id)` has `lane: 'S'` and the fact exists without `error`. `{ cannot }` holds the reason of the
    absent or empty scope below. Otherwise `paths` is every counted, non-exempt change path not in
    `fact.scope.paths`, sorted by code point.
  - `branchUnknown: GateRule['check']`, silent unless `laneTicket(s, id)` exists. Reasons, `file` the ticket file:
    no fact: `the host loaded no branch diff for this ticket, so the files it changed cannot be checked`; an error
    fact: the `error` text verbatim; no change with path `accord/tickets/<id>.md`:
    `` `the branch diff from ${base}, the merge base with the default branch, does not change accord/tickets/${id}.md; lane work is committed on the ticket's own branch, never on the default branch` ``.
  - `outOfScope: GateRule['check']`, silent unless lane S and a fact without `error` that changes the ticket file
    (so one problem gives one reason). `file` the ticket file. Scope absent:
    `` `no commit on this branch records ac_hash in accord/tickets/${id}.md, so the ## Scope that gate ready fixed cannot be read; commit the ticket after accord gate ready ${id}` ``.
    `paths` empty:
    `` `## Scope held no path when ac_hash was first recorded (commit ${commit}); a lane S ticket lists the files it expects to touch before any change, so it must be lifted to lane M` ``.
    Otherwise one finding per path of `outsideScope`:
    `` `${path} is changed on this branch but not listed in ## Scope as recorded at commit ${commit}; the ticket must be lifted to lane M` ``.
- `packages/core/src/gate/rules.ts`: `const BRANCH_UNKNOWN: GateRule = { id: 'gate.branch-unknown', level: 'error',
  profiles: ['build', 'maintain'], check: branchUnknown }`, one row object placed in `DONE_RULES` after
  `COMMIT_TRAILER` and in `DONE_S_RULES` after `COMMIT_TRAILER`; `{ id: 'gate.out-of-scope', ... check: outOfScope }`
  in `DONE_S_RULES` after it.
- `packages/core/src/index.ts`: export the types `BranchChange`, `BranchFact` and the function `scopeLines`.
- `packages/cli/src/load/fs.ts`, beside `gitFilesAt`:
  `export function gitBranchFact(root: string, id: string, opts: { rendered: readonly { path: string; text: string }[]; scope: boolean; settings?: { path: string; expected: (base: string | undefined) => string | undefined } }): BranchFact`.
  `settings.expected` takes the settings file's merge-base text (undefined when absent there) and returns the text
  `accord skills sync` would write over it, or undefined when sync would not write it.
  It never throws; each failure returns `{ error }`, the git ones as
  `` `git ${what} failed reading the branch diff: ${first stderr line}` ``.
  1. `def = defaultRefOf(root)`. Undefined: `{ error: "none of origin/HEAD, origin/main, origin/master, main or master resolves, so the branch diff cannot be read; run git fetch origin" }` (ledger Ruling 16).
  2. `base = git merge-base <def> HEAD`, trimmed.
  3. `git diff --raw -z --no-renames --no-ext-diff <base> HEAD --`. Tokens alternate a meta token
     `:<old mode> <new mode> <old sha> <new sha> <status>` and a path. Status `A` is `added`, `D` `deleted`, `T`
     `type`, `M` `mode` when the two modes differ, else `modified`; any other letter is `type` (ledger Ruling 18).
  4. `git diff --numstat -z --no-renames --no-ext-diff -b --ignore-blank-lines --ignore-cr-at-eol <base> HEAD --`,
     never `-w`. Each token `<added>\t<removed>\t<path>`; `lines` is the larger number; `-\t-` sets `binary: true`
     and `lines: 0`. A path missing from this output has `lines: 0`.
  5. When `opts.scope`: `git -c log.showSignature=false log --no-show-signature --reverse --format=%H -G ^ac_hash: HEAD -- :(literal)accord/tickets/<id>.md`.
     The first line, when it is a sha, is `commit`; its ticket text is `gitFilesAt(root, commit, [file])[file]`, and
     `scope = { commit, paths: scopeLines(text) ?? [] }` (ledger Ruling 17). No such commit leaves `scope` out.
  6. `synced`: the changed paths whose kind is not `deleted` and that an `opts.rendered` entry names, kept when
     `normaliseText(gitFilesAt(root, 'HEAD', those)[p]) === entry.text`; plus `opts.settings.path` when it is a
     changed path whose kind is not `deleted`, `want = opts.settings.expected(gitFilesAt(root, base, [path])[path])`
     is defined, and `normaliseText(<its HEAD text>) === normaliseText(want)`. Sorted by code point.
  7. `baseConfig = gitFilesAt(root, base, ['accord/config.yml'])['accord/config.yml']`, left out when absent.
  `changes` are sorted by path.
- `packages/cli/src/commands/branch-fact.ts` (new): `export function branchFactFor(ctx: CommandContext, id: string): BranchFact`.
  `rendered` is `[]` without a config, else `[...skillTargets(c), ...agentTargets(c), ...pluginTargets(c, pkg)]`
  with `import pkg from '../../package.json' with { type: 'json' }` as `skills.ts:27` does; `scope` is true when the
  ticket has `lane: 'S'`. With a config, `settings` is `{ path: SETTINGS, expected }`, `SETTINGS` and `hooksPlanFor`
  imported from `./skills.js` (`skills.ts:82`, `:100`), and `expected(b)` is `hooksPlanFor(b, c)`'s `text`, else `b`
  when the plan is `unchanged`, else undefined when the plan is undefined (no `claude` runtime) or `hooksPlanFor`
  throws (settings that are not a JSON object, or another `accord` marketplace source). Without a config,
  `settings` is left out. The text equals what `writeHooks` writes (`skills.ts:134-142`), since both come from
  `hooksPlanFor`.
- `packages/cli/src/commands/gate.ts`: after `forDone` is built and only for `which === 'done'` and a ticket that
  exists with `lane:`, gate `{ ...forDone, branchFacts: { [id]: branchFactFor(ctx, id) } }`. The commits load stays
  first, so its exit 2 without a default ref is unchanged (`packages/cli/test/gate.test.ts:302-304`).
- `packages/cli/test/lane-s.test.ts:103`: the ticket body becomes `LANE_S_BODY + '\n## Scope\nsrc/a.ts\n'`. Every
  assertion in that test stays.
- `packages/cli/test/lane-flow.test.ts`: right after `makeLaneRepo()`, `commitAll(repo, 'base')` and
  `gitRun(repo, 'switch', '-q', '-c', 't/T-1')` (import `gitRun`), so the ticket is worked on its own branch. Every
  assertion stays.

Must not change: every gate result of a ticket without `lane:`, so the D-54 goldens and `examples.test.ts` stay as
they are; the exit 2 of `gate done` under `commits.trailers: forbid` without a default ref; every other rule of
`DONE_RULES` and `DONE_S_RULES`; `gate ready` and `gate plan`; `defaultRefOf`, `gitFilesAt` and every other loader; `packages/cli/src/commands/skills.ts`,
which this task only imports from.

Test run, after the preamble's build steps: `npx vitest run packages/core/test/scope.test.ts packages/core/test/schemas.test.ts packages/core/test/lane-done.test.ts packages/cli/test/branch-fact.test.ts packages/cli/test/lane-s.test.ts packages/cli/test/lane-flow.test.ts packages/cli/test/spawn-surface.test.ts`.
`spawn-surface.test.ts` must stay green: it checks every new git spawn in `fs.ts` against the preamble's spawn rules.

## Task 2: A declared and confirmed wording-only file outside the scope passes; anything more fails
covers: @ac-3, D-02, D-07
files: packages/core/src/model/snapshot.ts, packages/core/src/load/work.ts, packages/core/src/gate/scope.ts (new), packages/core/test/work.test.ts, packages/core/test/scope.test.ts (new)
verify: packages/core/test/scope.test.ts#ac-3-a-wording-only-file-outside-the-scope-passes-only-when-declared-and-confirmed (@ac-3), packages/core/test/work.test.ts#risk:parsing-the-ledger-and-the-last-review-round-yield-only-the-fixed-declaration-lines

Consumes: Task 1's `outsideScope`, `outOfScope` and test helpers. Produces: `Ledger.wordingOnly`,
`Review.confirmed` and `Review.notInterface` (Task 4 reads the last).

Tests first.
- `packages/core/test/work.test.ts`, appended:
  `it('risk:parsing the ledger and the last review round yield only the fixed declaration lines')`:
  - `parseLedger('l', '## Rulings\n- Wording-only: README.md — fixes a typo\nWording-only: `docs/a.md` — one word\nWording-only: docs/a b.md — spaced name\nWording-only: `src/c d.md` — quoted spaced name\nWording-only: x.md - no dash\nWording-only: y.md —\n')`
    has `wordingOnly` equal to `[{ path: 'README.md', reason: 'fixes a typo' }, { path: 'docs/a.md', reason: 'one word' }, { path: 'docs/a b.md', reason: 'spaced name' }, { path: 'src/c d.md', reason: 'quoted spaced name' }]`.
  - `parseLedger('l', '- task 1 done abc1234\n')` has no `wordingOnly` property.
  - `parseReview('r', '## Round 1\n\nConfirmed wording-only: OLD.md\nNot an interface: src/old.ts — old\n\n## Round 2\n\n- Confirmed wording-only: README.md\nNot an interface: src/cli.ts — test harness only\nConfirmed wording-only: docs/a b.md\nConfirmed wording-only: `src/c d.md`\nNot an interface: `src/a b.ts` — spaced harness\nNot an interface: src/x y.ts — spaced too\nConfirmed wording-only:\nNot an interface: src/z.ts\n\nverdict: converged\n')`
    equals `{ file: 'r', verdict: 'converged', line: 17, confirmed: ['README.md', 'docs/a b.md', 'src/c d.md'], notInterface: ['src/cli.ts', 'src/a b.ts', 'src/x y.ts'] }`
    (the bare `Confirmed wording-only:` and the `Not an interface:` line without ` — <reason>` give nothing).
  - The existing `parseReview` and `parseLedger` cases stay `toEqual` their current values.
- `packages/core/test/scope.test.ts`, appended:
  `it('ac-3 a wording-only file outside the scope passes only when declared and confirmed')`. Ledger
  `L = '## Rulings\n- Wording-only: README.md — fixes a typo\n'`, review
  `V = '## Round 1\n\nConfirmed wording-only: README.md\n\nverdict: converged\n'`, and `w(change, ledger, review)`
  running `found(..., 'S-1', 'gate.out-of-scope')` with those as `accord/tickets/S-1/ledger.md` and `review.md`:
  - `ch('README.md', 3)` with `L` and `V`: no finding.
  - Without the confirmation (`V` with that line removed): one finding containing `README.md`, `Confirmed wording-only: README.md`
    and `must be lifted to lane M`.
  - The confirmation only in an earlier round (`'## Round 1\n\nConfirmed wording-only: README.md\n\n## Round 2\n\nNo findings\n\nverdict: converged\n'`): one finding.
  - `ch('README.md', 4)`: one finding containing `changes 4 lines, more than 3`.
  - `ch('README.md', 1, 'added')`, `ch('README.md', 0, 'deleted')`: one finding each, containing `is new` and
    `is deleted`.
  - Not declared, with `V`: the Task 1 finding `README.md is changed on this branch but not listed in ## Scope`.

Interface:
- `snapshot.ts`: `Ledger` gains `wordingOnly?: { path: string; reason: string }[]`; `Review` gains
  `confirmed?: string[]` and `notInterface?: string[]`. Each is present only when non-empty, so every existing value
  and golden is unchanged.
- `work.ts`:
  - `WORDING = /^\s*(?:[-*+]\s+)?Wording-only:\s+(\S.*?)\s+—\s+(.*\S)\s*$/`, read on every line of `ledger.md`: the
    path is everything up to the first ` — `, so a path may hold spaces. The path is trimmed and has one pair of
    surrounding backticks removed.
  - `parseReview` also scans `normaliseText(text)` with `scan(..., 0)` and takes the last round. On each of its lines,
    with `LIST_MARKER` removed and trimmed, `CONFIRMED = /^Confirmed wording-only:\s+(.+)$/` adds its whole rest of
    line to `confirmed` and `NOT_INTERFACE = /^Not an interface:\s+(\S.*?)\s+—\s+(.*\S)$/` adds its path, everything
    up to the first ` — `, to `notInterface`; each path trimmed and with one pair of surrounding backticks removed
    as above (ledger Ruling 11).
- `scope.ts` `outOfScope`: a path of `outsideScope` that `workOf(s, id)?.ledger?.wordingOnly` declares is judged in
  this order, the first failing check giving
  `` `${path} is declared wording-only in accord/tickets/${id}/ledger.md but ${why}; the ticket must be lifted to lane M` ``:
  `is new` (kind `added`), `is deleted`, `changes its file type or mode` (kind `type` or `mode`), `is binary`,
  `` `changes ${lines} lines, more than 3` `` (D-07, ledger Ruling 10), and
  `` `has no "Confirmed wording-only: ${path}" line in the last ## Round of accord/tickets/${id}/review.md` ``. A
  declared path that passes all six causes no finding. `outsideScope` itself still lists it, for Task 5.

Must not change: Task 1's tests; `parseLedger`'s `done`, `rulings` and `rulingsSection`; `parseReview`'s `verdict`,
`line` and `trailing`; `RULING` and the `## Rulings` section reading.

## Task 3: gate done fails a lane S ticket that touched a listed sensitive area
covers: @ac-4, D-04
files: packages/core/src/model/snapshot.ts, packages/core/schemas/config.schema.json, packages/core/src/gate/scope.ts (new), packages/core/src/gate/rules.ts, packages/core/test/schemas.test.ts, packages/core/test/scope.test.ts (new)
verify: packages/core/test/scope.test.ts#ac-4-gate-done-fails-a-lane-S-ticket-that-touched-a-listed-sensitive-area (@ac-4), packages/core/test/schemas.test.ts#risk:parsing-sensitive-and-generated-entries-are-repository-paths-without-globs-backslashes-or-parent-segments

Consumes: `configLists`, `matches`, `isCounted`, `factOf` (Task 1), and `Ledger.wordingOnly` (Task 2). Produces:
the config key `sensitive`, `sensitiveEntries`, and the rule `gate.sensitive-touched`.

Tests first.
- `packages/core/test/schemas.test.ts`: the key list at line 146 gains `'sensitive'` after `'generated'`. Appended,
  `it('risk:parsing sensitive and generated entries are repository paths without globs backslashes or parent segments')`:
  - Valid: `sensitive: { interface: ['packages/cli/src/run.ts', 'packages/core/schemas/', 'src/a b.ts'], 'data-deletion': ['.github/x.yml'] }`
    and `generated: ['packages/core/src/generated/', 'packages/cli/README.md', 'docs/a b/']` validate to `[]`: a path
    may hold a space inside it.
  - Each of these gives a finding at its pointer: an area `Interface` (propertyNames), a path `src/*.ts`, `src\\a.ts`,
    `../a.ts`, `a/../b.ts`, `/abs.ts`, `a//b.ts`, `' a.ts'`, `'a.ts '`, `''`, a duplicate path, a non-array area
    value, and the same five bad paths `src/*.ts`, `src\\a.ts`, `../a.ts`, `/abs.ts`, `' a.ts'` as `generated` items.
- `packages/core/test/scope.test.ts`, appended:
  `it('ac-4 gate done fails a lane S ticket that touched a listed sensitive area')`. Base config
  `B = CONFIG + 'sensitive:\n  interface:\n    - packages/cli/src/run.ts\n    - packages/core/schemas/\n'`, HEAD
  config `CONFIG`:
  - `ch('packages/cli/src/run.ts', 2)`, with the fact's `scope.paths` also listing `packages/cli/src/run.ts` and the
    ledger declaring it `Wording-only` with a confirmation in the last round: one `gate.sensitive-touched` finding
    whose reason contains `interface` and `packages/cli/src/run.ts` and `must be lifted to lane M`.
  - `ch('packages/core/schemas/x.json', 1)`: a finding naming the entry `packages/core/schemas/`.
  - The entry only in the HEAD config (files `accord/config.yml` = `B`, no `baseConfig`): still a finding, since the
    list is the base and HEAD lists together (the approved `## Approach`).
  - `ch('packages/cli/src/run.ts', 0)`: no finding (whitespace only).
  - The same changes on lane M ticket `laneTicket('T-1')` with a fact for `T-1`: no `gate.sensitive-touched`.

Interface:
- `snapshot.ts`: `AccordConfig` gains `sensitive?: Record<string, string[]>`.
- `config.schema.json`: one path item schema used by both keys, written inline twice:
  `{ "type": "string", "minLength": 1, "allOf": [ { "pattern": "^[A-Za-z0-9._@-](?:[A-Za-z0-9._@/ -]*[A-Za-z0-9._@/-])?$" }, { "pattern": "^(?!(?:.*/)?\\.\\.(?:/|$))" }, { "pattern": "^(?!.*//)" } ] }`.
  A space is allowed inside a path, never first or last, so a file whose name holds a space can be listed.
  `generated` takes it as `items`. After `generated`:
  `"sensitive": { "type": "object", "propertyNames": { "pattern": "^[a-z][a-z0-9-]*$" }, "additionalProperties": { "type": "array", "uniqueItems": true, "items": <the path item> } }`.
  Area names are free lower-case words (Ruling in this plan's report).
- `scope.ts`: `export function sensitiveEntries(s: RepoSnapshot, fact): { area: string; path: string }[]`: the base
  entries `configLists(fact.baseConfig).sensitive`, then the HEAD entries of `s.config?.sensitive` in key order, with
  any `{ area, path }` pair already seen dropped.
  `sensitiveTouched: GateRule['check']`: lane S, a fact without `error`. For each counted change, with no exemption
  and whatever its scope or declaration, the first entry that `matches` its path gives one finding, `file` the ticket
  file:
  `` `${path} is in the sensitive area ${area} (accord/config.yml lists ${entry} under sensitive); the ticket must be lifted to lane M` ``.
- `rules.ts`: `{ id: 'gate.sensitive-touched', level: 'error', profiles: ['build', 'maintain'], check: sensitiveTouched }`
  in `DONE_S_RULES` after `gate.out-of-scope`.

Must not change: Tasks 1 and 2 tests; every other schema key and its tests; a config without `sensitive` validates as
before.

## Task 4: A sign of a new interface outside the sensitive list fails a lane S ticket and needs the list updated or a reviewer's reason in any other lane
covers: @ac-5, D-04, D-05
files: packages/core/src/model/snapshot.ts, packages/core/src/gate/scope.ts (new), packages/core/src/gate/rules.ts, packages/core/src/index.ts, packages/core/test/scope.test.ts (new), packages/cli/src/load/fs.ts, packages/cli/test/branch-fact.test.ts (new)
verify: packages/core/test/scope.test.ts#ac-5-a-sign-of-a-new-interface-outside-the-list-needs-the-list-updated-or-a-reviewers-reason (@ac-5), packages/cli/test/branch-fact.test.ts#risk:parsing-gate-done-reads-added-call-lines-and-package-json-maps-from-the-branch-diff

Consumes: `factOf`, `isExempt`, `matches`, `sensitiveEntries`, `Review.notInterface`, `gitBranchFact`. Produces:
`BranchChange.calls` and `BranchChange.pkg`, `CALL_SIGN`, `interfaceSigns`, `unquoteGitPath` and the rule
`gate.interface-sign`.

Tests first.
- `packages/core/test/scope.test.ts`, appended:
  `it('ac-5 a sign of a new interface outside the list needs the list updated or a reviewers reason')`. Build every
  call text by concatenation (preamble). Changes on lane S `S-1` and on lane M `T-1` = `laneTicket('T-1')`, each
  with its own fact (`fact(changes, {}, 'T-1')` for `T-1`); `<id>` below is the ticket's own id:
  `{ ...ch('schemas/thing.json', 1, 'added') }`, `ch('src/a.schema.json', 1, 'added')`,
  `{ ...ch('pkg/package.json', 2), pkg: { base: '{"bin":{"old":"a.js"},"exports":"./i.js"}', head: '{"bin":{"old":"a.js","tool":"t.js"},"exports":{".":"./i.js","./extra":"./e.js"}}' } }`,
  `{ ...ch('src/cli.ts', 1), calls: ["program." + "command('x')"] }`, `{ ...ch('docs/how.md', 1), calls: [...] }`,
  `{ ...ch('accord/tickets/<id>/notes.txt', 1, 'added'), calls: [...] }`.
  - Lane S: `gate.interface-sign` findings name `schemas/thing.json`, `src/a.schema.json`, the key `tool` of `bin`,
    the key `./extra` of `exports`, and `src/cli.ts`, each reason containing `must be lifted to lane M`; none names
    `docs/how.md` or the ticket's own folder; `"."` is not a new key, since a string `exports` counts as the key `.`.
  - Lane M, same changes: the same five findings, each containing `Not an interface: <path> — <reason>` with the path
    filled in, and verdict `fail`.
  - Lane M with review `'## Round 1\n\nNot an interface: src/cli.ts — test harness only\n\nverdict: converged\n'`:
    the `src/cli.ts` finding is gone and the others stay.
  - Lane M whose HEAD config adds `sensitive:\n  interface:\n    - schemas/\n` (no `baseConfig`): the
    `schemas/thing.json` finding is gone. Lane S with the same HEAD config has no sign for that path either, since
    a matched path is no longer outside the list, and fails on a `gate.sensitive-touched` finding for it instead.
  - A base `sensitive` entry `pkg/package.json`: no sign for that path on either lane.
  - A laneless ticket gets no `gate.interface-sign`.
- `packages/cli/test/branch-fact.test.ts`, appended:
  `it('risk:parsing gate done reads added call lines and package json maps from the branch diff')`:
  - Base on `main`: `CONFIG`, `accord/tickets/T-1.md` = `laneTicket('T-1')`, `src/cli.ts` with one line
    `const p = 1;`, `pkg/package.json` `'{"name":"p","bin":{"old":"a.js"}}\n'`, `docs/how.md` `'x\n'`. Commit,
    `branch -M main`, `switch -q -c t/T-1`.
  - On the branch: append to the ticket `'\n<!-- worked -->\n'`; append to `src/cli.ts` a line made as
    `'program.' + 'option(' + "'--x')\n"` and a line `'  ' + 'program.' + 'command(' + "'y')\n"`; write
    `src/é.ts` with one call line and `src/a b.ts` (a space in the name) with one call line; rewrite
    `pkg/package.json` adding `"tool":"t.js"` to `bin`; add
    `schemas/thing.json`; append a call line to `docs/how.md`. Commit.
  - `gitBranchFact(repo, 'T-1', { rendered: [], scope: false })`: the change for `src/cli.ts` has `calls` of length
    2, `src/é.ts` and `src/a b.ts` each have `calls` of length 1, `docs/how.md` has `calls` (the loader keeps it; the rule skips Markdown),
    `pkg/package.json` has `pkg.base` and `pkg.head` equal to the two texts, and `schemas/thing.json` has kind `added`.
  - `gate done T-1 --json` exits 1 and its `gate.interface-sign` reasons name `src/cli.ts`, `src/é.ts`,
    `src/a b.ts`, `pkg/package.json` and `schemas/thing.json`, and not `docs/how.md`; it has no
    `gate.branch-unknown` finding.
  - The way out on a spaced path: write `accord/tickets/T-1/review.md` =
    `` '## Round 1\n\nNot an interface: `src/a b.ts` — test harness only\n\nverdict: converged\n' ``, commit; the
    `gate.interface-sign` reasons of `gate done T-1 --json` no longer name `src/a b.ts` and still name `src/cli.ts`.
  - `unquoteGitPath('"a\\tb\\"c\\303\\251.ts"')` is `'a\tb"cé.ts'` and `unquoteGitPath('plain/é.ts')` is unchanged.

Interface:
- `snapshot.ts` `BranchChange` gains `calls?: string[]` ("added lines, under the same whitespace flags, that the call
  sign matches; present only when non-empty") and `pkg?: { base?: string; head?: string }` ("a file named
  package.json: its text at the merge base and at HEAD, each absent when the file is").
- `scope.ts`:
  - `export const CALL_SIGN = /\.(command|option)\(/;` (ledger Ruling 13).
  - `keysOf(text: string | undefined, map: 'exports' | 'bin'): string[]`: `JSON.parse` inside a `try` (a failure is
    `[]`); a plain-object value gives its own keys, a string value `['.']`, anything else `[]`.
  - `export function interfaceSigns(s, id): { path: string; sign: string }[] | undefined`: `undefined` without a
    lane ticket or with an absent or error fact. For each change whose path no entry of `sensitiveEntries` matches:
    kind `added` and a folder segment named `schemas` or a name ending `.schema.json` gives `a new schema file`; a
    path equal to `package.json` or ending `/package.json` gives, for `exports` then `bin`, each key of `pkg.head`
    not in `pkg.base` as `` `a new key "${k}" in the ${map} map of package.json` ``; a path not ending `.md` or
    `.markdown` (case-insensitive), not exempt (ledger Ruling 20), with `calls` gives, per distinct name the calls
    match, `` `an added line that calls .${name}(` ``. Sorted by path, then sign.
  - `interfaceSign: GateRule['check']`, one finding per sign, `file` the ticket file. Lane S:
    `` `${path} adds ${sign}, a sign of a new interface; the ticket must be lifted to lane M` ``. Any other lane,
    unless `workOf(s, id)?.review?.notInterface` holds the path (ledger Ruling 14):
    `` `${path} adds ${sign}, a sign of a new interface no sensitive entry matches; add an entry matching it under sensitive: in accord/config.yml, or have the reviewer record "Not an interface: ${path} — <reason>" in the last ## Round of accord/tickets/${id}/review.md` ``.
    An entry the branch adds to the HEAD config is in `sensitiveEntries`, so it removes the sign for lane M and
    `gate.sensitive-touched` still fails lane S.
- `rules.ts`: `const INTERFACE_SIGN: GateRule = { id: 'gate.interface-sign', ... check: interfaceSign }`, one row in
  `DONE_RULES` after `BRANCH_UNKNOWN` and in `DONE_S_RULES` after `gate.sensitive-touched`.
- `index.ts`: export `CALL_SIGN`.
- `fs.ts` `gitBranchFact`, after step 4:
  - `git -c core.quotePath=false diff -U0 --no-color --no-ext-diff --no-textconv --no-renames -b --ignore-blank-lines --ignore-cr-at-eol --src-prefix=a/ --dst-prefix=b/ <base> HEAD --`.
    Read line by line: `diff --git ` starts a header; in a header a `+++ ` line sets the current path from `rest`,
    the text after `+++ `: one trailing `\t` is removed first (git may end the name with a tab when it holds a space;
    a name that really holds a tab is always quoted, so an unquoted name never ends in one), then
    `unquoteGitPath(rest)`, then its leading `b/` removed (`/dev/null` sets none). The resulting path must be one of
    the paths of the `--raw -z` listing of step 3; any other gives
    `` { error: `git diff -U0 named ${path}, which the raw listing of the branch diff does not hold` } ``, so a
    misread name fails closed and never drops a call line. An `@@` line starts the hunk; in a hunk a line
    starting `+` whose text after the `+`, with a trailing `\r` removed, matches `CALL_SIGN` is pushed to that
    path's `calls`. An `ENOBUFS` failure gives `{ error: 'the branch diff is larger than 64 MiB' }`.
  - `export function unquoteGitPath(v: string): string`: a value not wrapped in `"` is returned as is; otherwise the
    inside is read byte by byte, `\\`, `\"`, `\a`, `\b`, `\t`, `\n`, `\v`, `\f`, `\r` and `\` plus three octal
    digits turned into their bytes, and the bytes decoded as utf8.
  - For the changes named `package.json` or ending `/package.json`: `pkg.base` from
    `gitFilesAt(root, base, <those not added>)` and `pkg.head` from `gitFilesAt(root, 'HEAD', <those not deleted>)`.

Must not change: Tasks 1 to 3 tests, the first `branch-fact.test.ts` test included; the error reasons of Task 1.

Test run, after the preamble's build steps: `npx vitest run packages/core/test/scope.test.ts packages/cli/test/branch-fact.test.ts packages/cli/test/spawn-surface.test.ts`.
`spawn-surface.test.ts` must stay green: the `diff -U0` spawn follows the preamble's spawn rules, and no step label
in `fs.ts` is the bare quoted word `'log'`.

## Task 5: The review package lists the out-of-scope files and the interface signs gate done would name
covers: D-04
files: packages/core/src/index.ts, packages/cli/src/commands/review-package.ts, packages/cli/test/lane-s.test.ts
verify: packages/cli/test/lane-s.test.ts#risk:complex-branching-the-review-package-lists-the-out-of-scope-files-and-interface-signs-gate-done-would-name

Consumes: `outsideScope` (Tasks 1 and 2), `interfaceSigns` (Task 4), `branchFactFor` (Task 1). Produces the two
package sections that Task 7's reviewer text reads (ledger Ruling 23).

Test first, appended to `packages/cli/test/lane-s.test.ts`:
- `it('risk:complex-branching the review package lists the out-of-scope files and interface signs gate done would name')`:
  - `repoWith` a base on `main` (`branch -M main`) holding `CONFIG`, `accord/tickets/S-1.md` =
    `laneTicket('S-1', { lane: 'S', body: LANE_S_BODY + '\n## Scope\nsrc/a.ts\n' })`, `src/a.ts`, and
    `accord/tickets/T-1.md` = `laneTicket('T-1')`.
  - `switch -q -c t/S-1`, `gate ready S-1`, commit; change `src/a.ts` and `src/b.ts`, add `schemas/x.json`, commit.
  - `review-package S-1` exits 0 and its output holds
    `'## Out-of-scope files\n\nschemas/x.json\nsrc/b.ts\n\n## Interface signs\n\nschemas/x.json: a new schema file\n\n## Stat'`.
  - With `src/b.ts` and `schemas/x.json` removed by `git rm` and committed: `'## Out-of-scope files\n\n(none)'` and
    `'## Interface signs\n\n(none)'`.
  - `switch -q main`, `switch -q -c t/T-1`, append to `T-1.md`, add `schemas/y.json`, commit:
    `review-package T-1 --base main` (T-1 has no plan, so it needs `--base`) holds
    `'## Interface signs\n\nschemas/y.json: a new schema file'` and no `## Out-of-scope files`.
  - `gitRun(repo, 'branch', '-m', 'main', 'trunk')`: `review-package T-1 --base HEAD~1` exits 0 and holds
    `'## Interface signs\n\n(cannot tell: none of origin/HEAD'`.

Interface:
- `index.ts`: export `outsideScope` and `interfaceSigns`.
- `review-package.ts`: once `parts` is built, `s = { ...ctx.snapshot, branchFacts: { [id]: branchFactFor(ctx, id) } }`
  and `f = s.branchFacts[id]`. Insert before `'## Stat'` with
  `parts.splice(parts.indexOf('## Stat'), 0, ...)`:
  - for a lane S ticket, `'## Out-of-scope files'` and its body: `` `(cannot tell: ${f.error})` `` for an error fact,
    `` `(cannot tell: ${o.cannot})` `` for `{ cannot }`, the paths joined by `\n`, or `(none)`;
  - for every lane, `'## Interface signs'` and its body: the error form, `` `${path}: ${sign}` `` lines, or `(none)`.
  The command never fails on the fact.

Must not change: the `## Commits`, `## Stat`, `## Undeclared files` and `## Diff` sections and their order relative to
each other (`lane-commands.test.ts:444`, `:844-862`, `after-verify.test.ts:204-209`), the `--base` handling, and every
existing review-package test.

## Task 6: A lane is proposed from the scout's facts, and a lane S ticket records its scope
covers: @ac-1, D-01, D-03, D-06
files: packages/core/skills/accord/lane.md (new), packages/core/skills/accord/SKILL.md, packages/core/skills/accord/lane-s.md, packages/core/skills/accord/worktree.md, packages/core/skills/intent/SKILL.md, packages/core/templates/ticket-lane-s.md, packages/core/src/generated/skills.ts, packages/core/src/generated/templates.ts, .claude/skills/accord/lane.md (new), .claude/skills/accord-intent/lane.md (new), .claude/skills/accord/SKILL.md, .claude/skills/accord/lane-s.md, .claude/skills/accord/worktree.md, .claude/skills/accord-verify/worktree.md, .claude/skills/accord-debug/worktree.md, .claude/skills/accord-intent/SKILL.md, README.md, packages/cli/README.md, packages/core/test/stage-skills.test.ts, packages/core/test/templates.test.ts, packages/cli/test/lane-s.test.ts
verify: packages/core/test/stage-skills.test.ts#ac-1-a-lane-is-proposed-from-the-scout-facts-and-a-lane-S-ticket-records-its-scope (@ac-1)

Consumes: nothing from Tasks 1 to 5 at run time; the text names `## Scope`, which Task 1 reads. Produces the text the
session follows when it proposes a lane.

Test first, appended to `packages/core/test/stage-skills.test.ts`, using `flatS`:
- `it('ac-1 a lane is proposed from the scout facts and a lane S ticket records its scope')`:
  - `ln = flatS('.claude/skills/accord/lane.md')` is non-empty and equals `flatS('.claude/skills/accord-intent/lane.md')`.
  - `ln.indexOf('dispatch `accord-scout`')` is at least 0 and below `ln.indexOf('you form the one question that settles the reading')`,
    which is below `ln.indexOf('Propose a lane')`; `ln` contains
    `however small it looks`, `` ask for facts only, each with its `path:line` ``,
    `the code locations a different reading of the request would change`, `never judges the reading`,
    `the files the change is expected to touch, any listed sensitive area among them, and whether the request has one reading or one question settles it`,
    `LIFT` exactly once, `a reading one question settles stays lane S`, `` `## Scope` ``,
    `one repository path per line and never a folder` and `before any change is made`.
  - `acc = flatS('.claude/skills/accord/SKILL.md')`: its New request section (from `## New request` to `## Upgrade`)
    contains `` `./lane.md` `` and `however small it looks`; the `- **S.**` bullet contains
    `lane S without asking again` and `` `## Scope` ``.
  - `ls = flatS('.claude/skills/accord/lane-s.md')`: the `## Start` part (up to `## Steps`) contains `` `## Scope` ``;
    step 1, the text from `1. **Understood.**` to `2. **Change.**`, contains `` When `## Scope` holds no path ``, and
    that index is below the index of `` `accord gate ready <id>` `` in step 1.
  - `flatS('.claude/skills/accord-intent/SKILL.md')` contains `` four lift conditions in `./lane.md` ``.
Existing tests, updated:
- `stage-skills.test.ts:691-704`: `LIFT` becomes the sentence below; the test reads `lane.md` for both counts
  (`ln.split(LIFT).length - 1` and `ln.split('lifts S to M').length - 1` are 1), asserts `acc` does not contain
  `lifts S to M`, and keeps its other assertions.
- `stage-skills.test.ts:731`: the phrase becomes "… its `## Understood`, `## Done when` and `## Scope` lines, its
  carried …", matching the new `worktree.md` text.
- `templates.test.ts:172` and `packages/cli/test/lane-s.test.ts:20`: the headings become
  `['## Understood', '## Done when', '## Scope']`.

Text:
- `packages/core/skills/accord/lane.md` (new), `kind: reference` frontmatter, then:
  ```
  # Proposing a lane

  1. For every new request, however small it looks, first dispatch `accord-scout` with the request's text and ask
     for facts only, each with its `path:line`: the existing files the change is expected to touch; which of them an
     entry under `sensitive:` in `accord/config.yml` matches, with that entry's `path:line`, an entry ending in `/`
     matching every path below that folder; and the code locations a different reading of the request would change,
     or "not found" and where it looked. The scout reports facts and never judges the reading.
  2. From those facts, judge each lift condition yourself. When the scout names code locations a different reading
     would change, you form the one question that settles the reading from them, or count the request as having
     more than one plausible reading when no single question can.
  3. Propose a lane with its reason, out loud, stating the scout's facts for each lift condition and what you judged
     from them: the files the change is expected to touch, any listed sensitive area among them, and whether the request has one reading or one
     question settles it. The owner may override.

  Any of these lifts S to M, and nothing else: a public interface or schema changes; a listed sensitive area, or
  auth, money or data deletion, is touched; more than one plausible reading, where a reading one question settles
  stays lane S; the expected files, not counting test files and the copies accord itself generates, number more
  than 5 or span more than 3 code areas, a code area being a file's folder cut to its first four path segments.

  A test file sits under a folder named `test`, `tests` or `__tests__`, or its name holds `.test.` or `.spec.`.
  The copies accord generates are the files `accord skills sync` writes and the paths listed under `generated:` in
  `accord/config.yml`. The code area of `src/app/export/csv/writer.ts` is `src/app/export/csv`; that of
  `README.md` is the repository root.

  ## Scope

  A lane S ticket lists the expected files under a `## Scope` section of its ticket file, one repository path per
  line and never a folder, before any change is made: every file the change is expected to touch, test files and
  new files included, the new ones named by you, since the scout reports only files that exist. Write each as a
  bare path or `- path`, with forward slashes. The scope stands as it is when `ac_hash` is first committed; a file
  the change needs beyond it lifts the ticket to lane M, except a wording-only file the lane S steps declare.
  ```
  `LIFT` in the test is the third paragraph, flattened.
- `packages/core/skills/accord/SKILL.md`: `loads:` gains `accord/lane.md` after `accord/ids.md`. In
  `## New request`, "Propose a lane with its reason, out loud. The owner may override." becomes "Propose a lane as
  `./lane.md` says, for every new request however small it looks; the owner may override." The paragraph starting
  "Any of these lifts S to M" is removed. The `- **S.**` bullet's last sentence becomes "A request that carries
  `Understood: …` and `Done when: …` from a drop is lane S without asking again; the scout still runs first and its
  files still go under `## Scope`." (ledger Ruling 22). Nothing else changes; the rendered file stays within
  5120 bytes and 120 lines.
- `lane-s.md`: in `## Start`, "write the title and the two lines of step 1" becomes "write the title, the two lines
  of step 1 and the `## Scope` lines `./lane.md` describes". Step 1 gains, before "Run `accord gate ready <id>`":
  "When `## Scope` holds no path, run step 1 of `./lane.md` and write its files there as its `## Scope` says."
- `worktree.md:40`: "its `## Understood` and `## Done when` lines" becomes "its `## Understood`, `## Done when` and
  `## Scope` lines".
- `intent/SKILL.md`: `loads:` gains `accord/lane.md`; "(none of the accord skill's four lift conditions holds)"
  becomes "(none of the four lift conditions in `./lane.md` holds, judged on what `accord-scout` reports)".
- `ticket-lane-s.md`: after `## Done when` and its comment, a blank line, `## Scope`, and
  `<!-- One repository path per line, never a folder: every file the change is expected to touch, tests and new files included. -->`.
- `README.md:105` becomes: "A request moves from S to M when it changes a public interface or schema, touches a
  listed sensitive area or auth, money or data deletion, has more than one plausible reading that one question
  cannot settle, or is expected to touch more than 5 files or more than 3 code areas, tests and generated copies not
  counted. A scout reads the code before any lane is proposed, a lane S ticket records the files it expects to touch,
  and `accord gate done` fails it when it touches others. A lane only rises."
- Regenerate from the repository root, in this order: `npm run gen`, `npm run build`,
  `node packages/cli/dist/cli.js skills sync`. Any file `skills sync` rewrites beyond those on the `files:` line is
  kept as written and named in the report. Then run `npx vitest run packages/core/test/stage-skills.test.ts packages/core/test/skills.test.ts packages/core/test/lane-s.test.ts packages/core/test/templates.test.ts packages/cli/test/lane-s.test.ts packages/cli/test/readme.test.ts packages/cli/test/skill-commands.test.ts`.

Must not change: every phrase `REQUIRED.accord` and `REQUIRED.intent` assert; the ST-LN-31 assertions at
`packages/core/test/lane-s.test.ts:125-157` (`lane S without asking again`, the `**Lane S.**` phrases); the table of
lanes; the other steps of `lane-s.md`; the drop and move sections of `ids.md`.

## Task 7: The lane S steps, the reviewer and the review record write the fixed lines gate done reads
covers: D-02, D-04
files: packages/core/agents/reviewer.md, packages/core/skills/review/record.md, packages/core/skills/review/SKILL.md, packages/core/skills/accord/lane-s.md, packages/core/src/generated/agents.ts, packages/core/src/generated/skills.ts, .claude/agents/accord-reviewer.md, .claude/agents/accord-final-reviewer.md, .claude/skills/accord-review/record.md, .claude/skills/accord-review/SKILL.md, .claude/skills/accord/lane-s.md, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#risk:parsing-the-declaration-lines-the-lane-S-steps-the-reviewer-and-the-review-record-write-match-what-gate-done-parses

Consumes: `parseLedger` and `parseReview` as Task 2 left them, the package sections of Task 5. Produces the text that
makes the @ac-3 and @ac-5 paths reachable: without it nobody writes the lines the gate reads.

Test first, appended to `packages/core/test/stage-skills.test.ts` (import `parseLedger`, `parseReview` from
`../src/load/work.js`):
- `it('risk:parsing the declaration lines the lane S steps the reviewer and the review record write match what gate done parses')`:
  - `rev` is the flattened `.claude/agents/accord-reviewer.md` from `agentTargets(config)`, `ls` the flattened
    `lane-s.md`, `rec` the flattened `.claude/skills/accord-review/record.md`.
  - `ls` contains `` `Wording-only: <path> — <reason>` `` and `` `Confirmed wording-only: <path>` ``; `rev` contains
    those two and `` `Not an interface: <path> — <reason>` ``, `## Out-of-scope files` and `## Interface signs`;
    `rec` contains `` `Not an interface: <path> — <reason>` `` and `` Only the last `## Round` is read ``.
  - Each format, taken from the text between its backticks, with `<path>` replaced by `README.md` and `<reason>` by
    `fixes a typo`: the ledger line parses to `wordingOnly` `[{ path: 'README.md', reason: 'fixes a typo' }]`; the two
    review lines inside `'## Round 1\n\n' + line + '\n\nverdict: converged\n'` parse to `confirmed: ['README.md']` and
    `notInterface: ['README.md']`.

Text:
- `reviewer.md`, after the `Undeclared files:` paragraph:
  - "Out-of-scope files: in a lane S ticket each path under `## Out-of-scope files` in the review package is a Must
    finding, the ticket to be lifted to lane M, unless the ledger has the line `Wording-only: <path> — <reason>` for
    it. For such a path, read its diff: when it changes wording only, in at most 3 lines counted as the larger of
    lines added and lines removed, and the file is neither new nor deleted, write the line
    `Confirmed wording-only: <path>` in your report, outside any numbered finding; otherwise report a Must finding."
  - "Interface signs: each line under `## Interface signs` in the review package is a sign of a new public
    interface. In a lane S ticket it is a Must finding, the ticket to be lifted to lane M. In any other lane, when
    it adds no public interface, write the line `Not an interface: <path> — <reason>` in your report, outside any
    numbered finding; when it does, report a Should finding whose fix is an entry matching the path under
    `sensitive:` in `accord/config.yml`."
- `record.md`, after "A round with no findings says `No findings`.": "- Every `Confirmed wording-only: <path>` and
  `Not an interface: <path> — <reason>` line a reviewer reports is copied verbatim, one per line, into that round's
  section. Only the last `## Round` is read for them, so the last round, the final review, carries every one that
  still holds."
- `review/SKILL.md` step 2: after "every changed file no task's `files:` line names" add ", and under
  `## Interface signs` each sign of a new interface the branch adds". Rendered size stays within the caps.
- `lane-s.md` step 2 gains: "A file outside `## Scope` that the change only rewords, in at most 3 lines, neither new
  nor deleted, needs the line `Wording-only: <path> — <reason>` under `## Rulings` in
  `accord/tickets/<id>/ledger.md` before the review. Any other file beyond `## Scope`, a listed sensitive area, or a
  sign of a new interface lifts the ticket to lane M." Step 4: after "or `No findings`," add "copy each
  `Confirmed wording-only: <path>` line it reports verbatim into that round,". `## Lift to lane M`: "When the work
  meets a lift condition of the accord skill" becomes "When the work meets a lift condition in `./lane.md`, or
  `accord gate done <id>` names a file outside `## Scope`, a sensitive area or a sign of a new interface, or says
  `## Scope` held no path".
- Regenerate as in Task 6, then run `npx vitest run packages/core/test/stage-skills.test.ts packages/core/test/skills.test.ts packages/core/test/agents.test.ts packages/core/test/lane-s.test.ts`.

Must not change: the reviewer's lens, severity and findings format text; every `REQUIRED.review` phrase; every
`stage-skills.test.ts:706-739` phrase (lane S steps and the reviewer's `` `## Understood` and `## Done when` ``).

## Task 8: This repository's sensitive and generated lists, reviewed by the owner before build
covers: D-04
files: packages/core/test/repo-config.test.ts (new)
verify: packages/core/test/repo-config.test.ts#risk:parsing-this-repository-config-validates-and-holds-the-sensitive-and-generated-lists-the-owner-approved

Owner review before build: yes. Before this task is dispatched, the main session shows the owner the two lists
below and asks for a yes or changes (D-04: the list is written by hand for this repository; ledger Ruling 25). On a
yes, the main session itself appends them to `accord/config.yml` after `commits:` and commits
`config: ST-LN-62 sensitive and generated lists`; the executor never edits that file. On changes, the plan is
re-planned with the owner's lists in this section and in the test.

Draft, as YAML appended to `accord/config.yml`:
```yaml
# ST-LN-62 D-04: paths a lane S ticket may not touch; an entry ending in / covers every path below it.
sensitive:
  interface:
    - packages/cli/src/run.ts
    - packages/core/schemas/
    - packages/core/src/index.ts
    - packages/core/package.json
    - packages/cli/package.json
  data-deletion:
    - packages/cli/src/commands/drop.ts
    - packages/cli/src/commands/worktree.ts
# Copies generated by npm run gen that accord skills sync does not write; gate done never counts them.
generated:
  - packages/core/src/generated/
  - packages/cli/README.md
```
`generated:` leaves out `.claude/` on purpose: the copies `accord skills sync` writes are exempt only when they equal
the fresh render, `.claude/settings.json` only when it equals the hook merge applied to its merge-base text (ledger
Ruling 19), and listing `.claude/` would exempt hand-edited copies (ledger Ruling 34).

Test first, `packages/core/test/repo-config.test.ts` (new), as `packages/cli/test/worktree.test.ts:564-570` reads
this repository's config:
- `it('risk:parsing this repository config validates and holds the sensitive and generated lists the owner approved')`:
  `text = readFileSync(new URL('../../../accord/config.yml', import.meta.url), 'utf8')`;
  `{ config, findings } = loadConfig('accord/config.yml', text)` from `../src/load/config.js`; `findings` is `[]`;
  `config?.sensitive` equals the `sensitive` map above and `config?.generated` equals the `generated` list above.

Interface: none; the test reads the file the main session wrote.

Must not change: every other key of `accord/config.yml`, which the main session leaves as it is;
`worktree.test.ts:564-570`.

## Task 9: gate done reads lane M work from a branch diff that lacks the ticket file and fails an empty branch diff in every lane
covers: D-04
files: packages/core/src/gate/scope.ts (new), packages/core/src/gate/rules.ts, packages/core/test/scope.test.ts (new), packages/cli/test/branch-fact.test.ts (new)
verify: packages/core/test/scope.test.ts#risk:regression-gate-done-reads-lane-M-work-from-a-branch-diff-that-lacks-the-ticket-file-and-fails-an-empty-branch-diff-in-every-lane

Why: `gate.branch-unknown` fires today whenever the committed branch diff does not change `accord/tickets/<id>.md`
(`changesTicket`, `packages/core/src/gate/scope.ts:68`). A lane M ticket whose `approved_hash` and `ac_hash` were
committed on the default branch, whose scenarios are all `@ui` (so `accord task-done` writes no `@test` tag into the
ticket), and whose claim commit is `--allow-empty` (`packages/cli/src/commands/worktree.ts:420`) commits only code
and files under `accord/tickets/<id>/` on its branch. Verify step 6 runs `accord gate done` with the tick still
uncommitted, so Done fails with a reason about the default branch. Per the re-approved `## Approach`, the trigger for
every lane becomes a branch diff that adds no change over the merge base (lane work committed on the default branch,
or a branch ahead only by empty commits such as the claim commit). Lane S keeps the ticket-file trigger as well: a
lane S ticket always commits its ticket on its own branch, and dropping that trigger would let a lane S ticket whose
ready commit and an out-of-scope change landed on the default branch pass once its branch diff is not empty.

This task supersedes, without editing their text, only these parts of Task 1: the third reason of `branchUnknown` in
Task 1's Interface, which now applies to lane S only and after the empty-diff check below; and the expected text of
the Task 1 CLI bullet "Lane work on the default branch", which changes as below. The Task 1 test bullet "A fact
whose `changes` lack `accord/tickets/S-1.md` gives one `gate.branch-unknown` ..." still holds, since that fact is lane
S and not empty. `outOfScope`'s guard in Task 1's Interface ("that changes the ticket file") stays as it is:
`outOfScope` acts only on lane S (through `outsideScope`), and a lane S diff without the ticket file, an empty one
included, already fails `gate.branch-unknown`, so one problem still gives one reason.

Consumes: Task 1's `factOf`, `branchUnknown`, `outOfScope`, `laneTicket` and the `scope.test.ts` helpers `S1`, `ch`,
`fact`, `snap`, `found`. Produces: the empty-diff trigger and reason of `gate.branch-unknown`, and the lane S limit on
its ticket-file trigger.

Test first, appended to `packages/core/test/scope.test.ts`, run failing before `scope.ts` changes:
- `it('risk:regression gate done reads lane M work from a branch diff that lacks the ticket file and fails an empty branch diff in every lane')`:
  - Lane M, the failing case: `m = snap({ 'accord/tickets/T-1.md': laneTicket('T-1') }, { 'T-1': { ...fact([], {}, 'T-1'), changes: [ch('src/x.ts', 2), ch('accord/tickets/T-1/plan.md', 3, 'added'), ch('accord/tickets/T-1/ledger.md', 1, 'added')] } as BranchFact })`;
    `found(m, 'T-1', 'gate.branch-unknown')` is `[]`.
  - Lane M, a whitespace-only change alone (`changes: [ch('src/ws.ts', 0)]`): `found(..., 'T-1', 'gate.branch-unknown')`
    is `[]`, since any change means HEAD is ahead of the merge base (ledger Ruling 63).
  - Lane M, an empty diff (`changes: []`): `found(..., 'T-1', 'gate.branch-unknown')` has length 1, its reason contains
    `adds no change over the merge base` and `never on the default branch`.
  - Lane S keeps the ticket-file trigger: `s = snap({ 'accord/tickets/S-1.md': S1 }, { 'S-1': { ...fact([]), changes: [ch('packages/core/src/status/dashboard.ts', 2), ch('src/x.ts', 1)] } as BranchFact })`;
    `found(s, 'S-1', 'gate.branch-unknown')` has length 1 and its reason contains
    `does not change accord/tickets/S-1.md`; `found(s, 'S-1', 'gate.out-of-scope')` is `[]`.
  - Lane S, an empty diff (`changes: []` for `S-1`): `found(..., 'S-1', 'gate.branch-unknown')` has length 1, its
    reason contains `adds no change over the merge base` and does not contain `does not change`;
    `found(..., 'S-1', 'gate.out-of-scope')` is `[]`.

Existing tests, updated in the same commit:
- `packages/core/test/scope.test.ts`, inside the Task 1 test
  `risk:complex-branching gate done fails closed on a missing or failed branch diff a diff without the ticket file and an absent or empty scope`:
  its title and every assertion stay. Add one comment line directly above the `noTicket` fact (line 66):
  `// Since Task 9 a diff without the ticket file fails only lane S; lane M fails only an empty branch diff.`
- `packages/cli/test/branch-fact.test.ts:108`, the on-main case of the first test (HEAD on `main` equals the merge
  base, so the diff is empty and the empty-diff reason comes first): `toContain('does not change accord/tickets/S-1.md')`
  becomes `toContain('adds no change over the merge base')`. Every other assertion of that file stays.

Interface:
- `packages/core/src/gate/scope.ts`: keep `changesTicket` and add
  `const hasChanges = (fact: BranchRead): boolean => fact.changes.length > 0;`. A change of any kind counts here, a
  whitespace-only one included.
- `branchUnknown`, after its no-fact and error-fact reasons, which stay verbatim:
  1. When `!hasChanges(fact)`, one finding, `file` the ticket file:
     `` `the branch diff from ${fact.base}, the merge base with the default branch, to HEAD is empty: HEAD adds no change over the merge base; lane work is committed on the ticket's own branch, never on the default branch` ``.
  2. Else when `laneTicket(s, id)?.frontmatter?.lane === 'S'` and `!changesTicket(fact, id)`, one finding with the
     ticket-file reason of today, verbatim:
     `` `the branch diff from ${fact.base}, the merge base with the default branch, does not change ${file}; lane work is committed on the ticket's own branch, never on the default branch` ``.
  3. Otherwise `[]`.
- `outOfScope`: unchanged, its guard still `fact === undefined || 'error' in fact || !changesTicket(fact, id)`.
- `packages/core/src/gate/rules.ts:159`, comment only: the doc comment on `BRANCH_UNKNOWN` becomes
  `` /** ST-LN-62: Done reads the branch diff of every ticket with `lane:`; no diff, an empty diff, or in lane S a diff without the ticket file, fails closed. */ ``.

Must not change: the no-fact and error-fact reasons of `gate.branch-unknown`; its silence for a ticket without
`lane:`; the lane S ticket-file reason; `outOfScope` and every `gate.out-of-scope`, `gate.sensitive-touched` and
`gate.interface-sign` reason; `outsideScope`, `isExempt`, `isCounted`, `interfaceSigns`; every test title and every
`ac-` test of `scope.test.ts`; `gitBranchFact`, which still returns `{ error }` for a missing default ref or a failed
git call; in `rules.ts`, every rule row, its level, its profiles and its place in `DONE_RULES` and `DONE_S_RULES`.

Test run, after the preamble's build steps: `npx vitest run packages/core/test/scope.test.ts packages/core/test/lane-done.test.ts packages/cli/test/branch-fact.test.ts packages/cli/test/lane-flow.test.ts`.
