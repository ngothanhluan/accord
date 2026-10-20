---
baseline: 6ead1b6a5e34315768ab998a450701e2283a766b
plan_hash: "fnv1a64:c77a009a35d0dff2"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: Task 1 is the wiring. It adds the D-07 forbidden-line rule in core, the `commits.trailers` key, the one
`git log` loader in the CLI, and the `accord task-done` refusal, so a repository that sets `commits.trailers:
forbid` refuses a trailer end to end. Task 2 adds the same check to `accord gate done` as a core rule. Task 3
scaffolds `accord/product/conventions.md` and appends it to every brief. Task 4 is the executor, planner and
ruleset text. Task 5, the polish, is the promotion step in the verify skill.

Rules for every task:
- Commits carry no trailer of any kind: no `Co-Authored-By:` line, no `Signed-off-by:` or other `-by:` line,
  and no "Generated with" line, in the subject or the body.
- No task touches any file under the repository's top-level `accord/` folder. This repository's
  `accord/config.yml` (`commits: { trailers: forbid }`) and `accord/product/conventions.md` are written by the
  main session after the last task is recorded, not by any task here (ledger Ruling).
- Test ids: every test this plan writes and names on a `verify:` line is a top-level `it(...)` with no
  `describe` around it. Its report id is the test file's path from the repository root, then `#`, then the `it`
  title with each whitespace run turned into `-` (`packages/core/src/load/junit.ts:40`; vitest's JUnit reporter
  writes the file path as `classname` and the describe titles joined by ` > ` plus the `it` title as `name`). The
  existing cases named on a `verify:` line sit inside a `describe`; their ids are copied verbatim from
  `accord/tests-baseline.txt`. No test title holds `@` or a comma. No existing test is renamed. Every new test is
  named on some task's `verify:` line, and no other new test is added.
- Run one task's tests with `npx vitest run <files> --reporter=default --reporter=junit
  --outputFile.junit=node_modules/.cache/accord/junit.xml`, then find each id of the task's `verify:` line in
  `node_modules/.cache/accord/junit.xml` before reporting done.
- CLI tests import core from `packages/core/dist`. After changing anything under `packages/core/`, run
  `npm run gen` when a file under `packages/core/templates/`, `packages/core/agents/` or `packages/core/skills/`
  changed, then `npm run build -w packages/core`, before running any CLI test. After `npm run gen`,
  `git status` shows a change only in the generated maps the task's `files:` line names; any other change it
  makes is reported as outside the plan. End every task with `npm run build`, `npm run lint` and
  `npm run typecheck`, then run the test files the task names.
- A task that changes the source of a rendered copy re-syncs it from the repository root with
  `npm run build` and then `node packages/cli/dist/cli.js skills sync`. The sync must change only the rendered
  copies on that task's `files:` line; any other file it reports changed is reported as outside the plan.
- Files are LF with no BOM. Add no dependency. Every path the CLI prints or stores uses `/` (D-51). Every git
  spawn passes literal arguments to `execFileSync('git', ...)`, never a shell.
- Commits a CLI test makes use the message-file helper below, so the message reaches git byte for byte on every
  host:
  `commitMessage(repo, message)`: `writeFileSync(join(repo, '.git', 'ACCORD_MSG'), message)`, then
  `gitRun(repo, 'add', '-A')`, then `gitRun(repo, '-c', 'user.email=fixture@example.invalid', '-c',
  'user.name=fixture', '-c', 'commit.gpgsign=false', 'commit', '-q', '--no-verify', '--allow-empty',
  '--cleanup=verbatim', '-F', join(repo, '.git', 'ACCORD_MSG'))`, and it returns
  `gitRun(repo, 'rev-parse', 'HEAD').trim()`. Each test file that needs it defines it locally.

Definitions shared by every task:
- A forbidden line (D-07, which replaces D-03 and narrows D-06): any line of a commit message after its first
  line (the first line is the subject and is never checked) that, after leading whitespace, starts with a token
  of one or more ASCII letters, digits or hyphens ending in `-by:`, or that contains "Generated with"; letter
  case is ignored in both tests. accord reads the raw message itself and never git's trailer parser.
- The default ref: `gitDefaultRef(root)` (`packages/cli/src/load/fs.ts:574`), origin/HEAD's target, else
  `refs/remotes/origin/main`, else `refs/remotes/origin/master`; never the local main.
- The check is on when `snapshot.config?.commits?.trailers === 'forbid'`. Absent or `allow` is off (D-01).

## Task 1: Wiring: task-done refuses a commit with a forbidden line when the repository forbids trailers
covers: @ac-3, D-01, D-02, D-03, D-06, D-07
files: packages/core/src/gate/trailers.ts (new), packages/core/src/index.ts, packages/core/src/model/snapshot.ts, packages/core/schemas/config.schema.json, packages/core/test/schemas.test.ts, packages/core/test/trailers.test.ts (new), packages/cli/src/load/fs.ts, packages/cli/src/commands/task-done.ts, packages/cli/test/trailers.test.ts (new)
verify: packages/cli/test/trailers.test.ts#ac-3-task-done-refuses-a-task-whose-commit-carries-a-forbidden-line-when-the-repository-forbids-trailers (@ac-3), packages/core/test/trailers.test.ts#risk:parsing-a-forbidden-line-is-found-by-letter-case-and-leading-whitespace-and-never-in-the-subject

Consumes: `gitDefaultRef` and `isSha` (already imported in `load/fs.ts`), `recordTaskDone`, `taskVerdict`,
`workOf` and `staleReport` in `task-done.ts`, all as they are at the baseline.
Produces: `forbiddenLines`, `trailerReason` (core, exported from `packages/core/src/index.ts`),
`AccordConfig.commits`, the `commits` schema key, and `gitBranchCommits` (CLI, exported from `load/fs.ts`).
Task 2 uses all of them.

Tests first.
- `packages/core/test/trailers.test.ts`, importing `forbiddenLines` from `../src/index.js`:
  `it('risk:parsing a forbidden line is found by letter case and leading whitespace and never in the subject')`:
  - `forbiddenLines('Co-Authored-By: A <a@example.com>\n\nplain body\n')` and
    `forbiddenLines('Generated with care\n')` are each `[]` (the subject is never checked).
  - `forbiddenLines('feat: x\n\nAdds the parser.\nCo-Authored-By: Bot <bot@example.com>\n')` is
    `['Co-Authored-By: Bot <bot@example.com>']`.
  - `forbiddenLines('feat: x\n\n   co-authored-BY: Bot <b@example.com>  \n')` is
    `['co-authored-BY: Bot <b@example.com>']` (case ignored, the line returned trimmed).
  - `forbiddenLines('feat: x\n\n\tSigned-off-by: A\nReviewed-by: B\nAcked-by: C\nX2-by: D\n')` is
    `['Signed-off-by: A', 'Reviewed-by: B', 'Acked-by: C', 'X2-by: D']`.
  - `forbiddenLines('feat: x\n\nsee 🤖 GENERATED WITH [Claude Code](https://claude.com/claude-code)\r\n')` is
    `['see 🤖 GENERATED WITH [Claude Code](https://claude.com/claude-code)']` (anywhere in the line, CR dropped by
    the trim).
  - `forbiddenLines('feat: x\n\nbuild: tidy\nOwner: "có"\nCo-Authored: x\nwritten by: me\nCo_Authored-By: x\nby: x\n')`
    is `[]` (the lines git's parser misread, and tokens that do not end in `-by:` or hold another character).
- `packages/cli/test/trailers.test.ts`, top-level, importing `cleanup`, `commitAll`, `gitRun`, `makeLaneRepo`,
  `run` and `writeFiles` from `./helpers/repo.js` and `CONFIG` from `../../../test/helpers/lane.js`, with the
  local `commitMessage` helper of the preamble, `FORBID = CONFIG + 'commits:\n  trailers: forbid\n'`, and
  `fresh(repo)`, which sets the mtime of `reports/junit.xml` to `Date.now() + 5000` with `utimesSync`, as
  `freshen` in `lane-commands.test.ts:68` does. `LEDGER` is `accord/tickets/T-1/ledger.md`.
  `it('ac-3 task-done refuses a task whose commit carries a forbidden line when the repository forbids trailers')`,
  with `120_000` as the third argument of `it`:
  - (a) No origin ref: `repo = makeLaneRepo({ 'accord/config.yml': FORBID })`, `commitAll(repo)`, `fresh(repo)`.
    `run(['task-done', 'T-1', '1'], repo)` exits 2, `err` contains `git fetch origin`, and `LEDGER` does not
    exist.
  - (b) Refusal: in the same repo, `base = gitRun(repo, 'rev-parse', 'HEAD').trim()` and
    `gitRun(repo, 'update-ref', 'refs/remotes/origin/main', base)`. Then
    `bad = commitMessage(repo, 'feat: parser\n\nAdds the parser.\nCo-Authored-By: Bot <bot@example.com>\n')`
    and `fresh(repo)`. `task-done T-1 1` exits 1, `out` starts `task 1 of T-1 is not done:\n` and contains
    `bad.slice(0, 12)` and `Co-Authored-By: Bot <bot@example.com>`, and `LEDGER` does not exist.
  - (c) Every other form D-07 forbids: for each of these four bodies (each one line of JS source):
    - `'Adds the parser.\nSigned-off-by: A <a@example.com>'`
    - `'Adds the parser.\n  reviewed-BY: B <b@example.com>'`
    - `'Adds the parser.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)'`
    - `'Adds the parser.\ngenerated WITH a tool'`

    run
    `gitRun(repo, 'reset', '-q', '--hard', base)`, `c = commitMessage(repo, 'feat: parser\n\n' + body + '\n')`,
    `fresh(repo)`. `task-done T-1 1` exits 1, `out` contains `c.slice(0, 12)` and the forbidden line of that
    body trimmed, and `LEDGER` does not exist.
  - (d) The ledger bound: `gitRun(repo, 'reset', '-q', '--hard', base)`, then `b = commitMessage(repo,
    'feat: one\n\nCo-Authored-By: Bot <bot@example.com>\n')`, `fresh(repo)`. `task-done T-1 2` exits 1 naming
    `b.slice(0, 12)` (no task below 2 is recorded, so `b` is in range). Then write `LEDGER` as
    `'# Ledger\n\n## Tasks\n- task 1 done ' + b.slice(0, 12) + '\n'` with `writeFiles`, `commitMessage(repo,
    'ledger: T-1 task 1\n')`, `commitMessage(repo, 'feat: two\n\nQuotes cells.\n')`, `fresh(repo)`.
    `task-done T-1 2` exits 0 and `out` starts `recorded task 2 done at`.
  - (e) Off: `gitRun(repo, 'reset', '-q', '--hard', base)`; write `accord/config.yml` as
    `CONFIG + 'commits:\n  trailers: allow\n'`; then, with `OFFENDER = 'feat: parser\n\nCo-Authored-By: Bot <bot@example.com>\n'`,
    `commitMessage(repo, OFFENDER)` and `fresh(repo)`. `task-done T-1 1` exits 0 and `LEDGER` contains
    `- task 1 done `. Then `repo2 = makeLaneRepo()` (no `commits` key), `commitAll(repo2)`,
    `commitMessage(repo2, OFFENDER)`, `fresh(repo2)`: `task-done T-1 1` exits 0 with no origin ref at all.
  - `cleanup` both repos in a `finally`.

Interface:
- `packages/core/src/gate/trailers.ts` (pure, no node import):
  - `export function forbiddenLines(message: string): string[]`: `message.split('\n').slice(1)`, keep each line
    matching `/^\s*[A-Za-z0-9-]*-by:/i` or `/generated with/i`, and return each kept line `.trim()`med, in order.
  - `export const trailerReason = (sha: string, line: string): string =>`
    `` `commit ${sha.slice(0, 12)} carries the forbidden line "${line}"; commits.trailers is forbid in accord/config.yml` ``.
  - `packages/core/src/index.ts` exports both, beside the other `./gate/` exports.
- `packages/core/src/model/snapshot.ts`: `AccordConfig` gains
  `commits?: { trailers?: 'allow' | 'forbid' }; // ST-LN-8 D-01: absent or allow is off`.
- `packages/core/schemas/config.schema.json`: after `setup`, `"commits": { "type": "object",
  "additionalProperties": false, "properties": { "trailers": { "type": "string", "enum": ["allow", "forbid"] } } }`.
  `packages/core/test/schemas.test.ts:146`: the expected key list gains `'commits'` after `'setup'`; the case's
  title stays as it is.
- `packages/cli/src/load/fs.ts`: `export function gitBranchCommits(root: string, since?: string): { sha: string; message: string }[]`:
  1. `ref = gitDefaultRef(root)`. When it is undefined, throw
     `UsageError('commits.trailers is forbid in accord/config.yml, but none of origin/HEAD, origin/main and origin/master exists here; run `git fetch origin`')`.
  2. `stop = ['^' + ref]`. When `since` is defined, `isSha(since)`, and
     `execFileSync('git', ['rev-parse', '--verify', '-q', since + '^{commit}'], { cwd: root, stdio: 'ignore' })`
     does not throw, push `'^' + since`. A sha that does not resolve is left out (ledger Ruling: the range falls
     back to the default ref alone).
  3. `execFileSync('git', ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '--first-parent',
     '--format=%H%x00%B%x01', 'HEAD', ...stop], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
     maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } })`. A failure throws
     `UsageError('git log failed reading the commits of this branch' + stderr)`, in the shape `gitDirty` uses.
  4. Split the output on `\x01`, strip leading `\n` from each record, drop records with no `\0`, and return
     `{ sha: <text before the first \0>, message: <text after it> }` per record.
- `packages/cli/src/commands/task-done.ts`: after `stale` is computed, when `next !== undefined` and the check is
  on, take `done = workOf(ctx.snapshot, id)?.ledger?.done ?? {}`, the highest key `k` with `Number(k) < n`, and
  `since = done[k]` (undefined when there is none). Add
  `gitBranchCommits(ctx.root, since).flatMap((c) => forbiddenLines(c.message).map((l) => trailerReason(c.sha, l)))`
  to `reasons` after the stale reason. The existing `if (next !== undefined && reasons.length > 0) return
  refuse(reasons);` then refuses before any tag or ledger write (ledger Ruling: only a task about to be recorded
  is checked). When the check is off, no git spawn is added.

Must not change: every case in the `accord task-done` describe of `packages/cli/test/lane-commands.test.ts` and
in `packages/core/test/schemas.test.ts` (their configs carry no `commits` key, so task-done's output, its
messages and its order are unchanged); every other loader in `load/fs.ts`; `loadFromFs`, which does not call
`gitBranchCommits`.

## Task 2: gate done refuses a ticket branch holding a forbidden line when the repository forbids trailers
covers: @ac-4, D-02
files: packages/core/src/gate/done.ts, packages/core/src/gate/rules.ts, packages/core/src/model/snapshot.ts, packages/core/test/gate.test.ts, packages/cli/src/commands/gate.ts, packages/cli/test/gate.test.ts
verify: packages/cli/test/gate.test.ts#ac-4-gate-done-refuses-a-ticket-branch-holding-any-forbidden-line-when-the-repository-forbids-trailers (@ac-4), packages/core/test/gate.test.ts#risk:security-gate-done-under-forbid-fails-closed-when-the-host-loaded-no-commits

Consumes: `forbiddenLines`, `trailerReason` and `AccordConfig.commits` from Task 1, and `gitBranchCommits`
from Task 1. Produces: `RepoSnapshot.commits`, the core check `commitTrailer` and the Done row
`gate.commit-trailer`, so `gate done --json` carries the finding (D-87).

Tests first.
- `packages/core/test/gate.test.ts`, appended at the end, top-level, adding
  `import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';`:
  `it('risk:security gate done under forbid fails closed when the host loaded no commits')`:
  - `files = { 'accord/config.yml': CONFIG + 'commits:\n  trailers: forbid\n', 'accord/tickets/T-1.md':
    laneTicket('T-1') }`, `snap = loadSnapshot({ files, tree: Object.keys(files) })`, and
    `pick = (s: RepoSnapshot) => gateDone(s, 'T-1').findings.filter((f) => f.rule === 'gate.commit-trailer')`.
  - `pick(snap)` has length 1, its `level` is `error`, its `file` is `accord/config.yml`, its `reason` contains
    `loaded no commits`, and `gateDone(snap, 'T-1').verdict` is `fail` (ledger Ruling: undefined is never a
    pass).
  - `pick({ ...snap, commits: [] })` is `[]`.
  - With `sha = '0123456789abcdef0123456789abcdef01234567'`,
    `pick({ ...snap, commits: [{ sha, message: 'build: x\n\nAdds.\nCo-Authored-By: Bot <bot@example.com>\n' }] })`
    has one finding whose `reason` contains `0123456789ab` and `Co-Authored-By: Bot <bot@example.com>`.
  - With `config.yml` set to `CONFIG` (no `commits` key), `pick` of that snapshot, with no `commits`, is `[]`.
- `packages/cli/test/gate.test.ts`, appended at the end, top-level, adding `gitRun` and `makeLaneRepo` to the
  `./helpers/repo.js` import and `import { CONFIG } from '../../../test/helpers/lane.js';`, with the local
  `commitMessage` helper of the preamble and `rows = (out: string) => (JSON.parse(out) as { findings: { rule:
  string; level: string; reason: string }[] }).findings.filter((f) => f.rule === 'gate.commit-trailer')`.
  `it('ac-4 gate done refuses a ticket branch holding any forbidden line when the repository forbids trailers')`,
  with `120_000` as the third argument of `it`:
  - Setup: `repo = makeLaneRepo({ 'accord/config.yml': CONFIG + 'commits:\n  trailers: forbid\n' })` and
    `base = commitAll(repo)`.
  - No origin ref: `run(['gate', 'done', 'T-1'], repo)` exits 2 and `err` contains `git fetch origin`.
  - `gitRun(repo, 'update-ref', 'refs/remotes/origin/main', base)`. A clean branch:
    `commitMessage(repo, 'build: clean\n\nAdds the parser.\n')`. `run(['gate', 'done', 'T-1', '--json'], repo)`
    exits 1 (the unapproved ticket fails other rows) and `rows(out)` is `[]`.
  - A second parent: `gitRun(repo, 'switch', '-q', '-c', 'side', base)`,
    `commitMessage(repo, 'build: side\n\nCo-Authored-By: Bot <bot@example.com>\n')`,
    `gitRun(repo, 'switch', '-q', '-')`, then `gitRun(repo, '-c', 'user.email=fixture@example.invalid', '-c',
    'user.name=fixture', '-c', 'commit.gpgsign=false', 'merge', '-q', '--no-ff', '--no-verify', '-m',
    'merge side', 'side')`. `gate done T-1 --json` gives `rows(out)` equal to `[]`.
  - The robot line, the message one line of JS source:
    `r = commitMessage(repo, 'build: parser\n\nAdds the parser.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n')`.
    `run(['gate', 'done', 'T-1'], repo)` exits 1 and `out` contains
    `r.slice(0, 12)` and `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. With `--json`,
    `rows(out)` has length 1 with `level` `error`.
  - Never the local main: `gitRun(repo, 'update-ref', 'refs/heads/main', 'HEAD')`; `gate done T-1 --json` still
    gives `rows(out)` of length 1.
  - `cleanup(repo)` in a `finally`.

Interface:
- `packages/core/src/model/snapshot.ts`: `RepoSnapshot` gains
  `commits?: { sha: string; message: string }[]; // ST-LN-8: host-supplied by gate done when commits.trailers is forbid`.
  `SnapshotInput` and `loadSnapshot` do not change.
- `packages/core/src/gate/done.ts`, after the `CONFIG` constant, importing `forbiddenLines` and `trailerReason`
  from `./trailers.js`:
  `export const commitTrailer: GateRule['check'] = (snapshot, id) => { ... }`: it returns `[]` when
  `ticketOf(snapshot, id)` is undefined or the check is off. When `snapshot.commits` is undefined it returns one
  draft `{ file: CONFIG, pointer: '/commits/trailers', reason: 'commits.trailers is forbid, but the host loaded
  no commits of this branch, so they cannot be checked' }`. Otherwise one draft per forbidden line, in commit
  order, `{ file: CONFIG, pointer: '/commits/trailers', reason: trailerReason(c.sha, line) }`.
- `packages/core/src/gate/rules.ts`: import `commitTrailer` and add
  `{ id: 'gate.commit-trailer', level: 'error', profiles: ['build', 'maintain'], check: commitTrailer }` to
  `DONE_RULES` right after `gate.stale-review`.
- `packages/cli/src/commands/gate.ts`: import `gitBranchCommits` from `../load/fs.js`. For `which === 'done'`,
  when the check is on and `ctx.snapshot.git !== undefined`, run `gateDone({ ...ctx.snapshot, commits:
  gitBranchCommits(ctx.root) }, id)`; otherwise `gateDone(ctx.snapshot, id)` as today. `since` is not passed:
  gate done checks the whole branch. An unborn HEAD therefore spawns no `git log`, and Done fails on
  `gate.commit-missing` plus the undefined-commits finding. A missing default ref throws Task 1's UsageError,
  exit 2, before anything is printed.

Must not change: every Done golden under `packages/core/test/__golden__/` and every existing case in both
`gate.test.ts` files (no fixture sets `commits.trailers`, so the new row returns nothing and no git spawn is
added); `gate ready` and `gate plan`; the `ac_hash` and `plan_hash` writes in `gate.ts`.

## Task 3: init writes the conventions file and every brief ends with it
covers: @ac-2, D-04
files: packages/core/templates/conventions.md (new), packages/core/src/generated/templates.ts, packages/core/src/scaffold/init.ts, packages/core/test/scaffold.test.ts, packages/cli/src/commands/brief.ts, packages/cli/test/lane-commands.test.ts, packages/cli/test/init.test.ts
verify: packages/cli/test/lane-commands.test.ts#ac-2-every-brief-ends-with-the-repository-conventions (@ac-2)

Consumes: `initFiles`, the generated `templates` map, and `brief` as they are at the baseline. Produces:
`templates['conventions.md']`, `accord/product/conventions.md` in every `accord init`, and the conventions tail
of `accord brief`.

Test first, in `packages/cli/test/lane-commands.test.ts`, appended at the end, top-level, adding `templates` from
`@accord-dev/accord-core` and `writeFileSync` from `node:fs` to the imports:
`it('ac-2 every brief ends with the repository conventions')`, with `60_000` as the third argument of `it`:
- `repo = makeLaneRepo()`, `conv = join(repo, 'accord', 'product', 'conventions.md')`.
- Absent: `before = (await run(['brief', 'T-1', '2'], repo)).out`. It ends with `'\n'` and not with `'\n\n'`,
  and does not contain `conventions`.
- `run(['init'], repo)` exits 0 and `readFileSync(conv, 'utf8')` equals `templates['conventions.md']`. The brief
  then equals `before + '\n---\n\n' + templates['conventions.md']`.
- `writeFileSync(conv, '- Never add a commit trailer.')`: the brief equals
  `before + '\n---\n\n- Never add a commit trailer.'`, nothing after it.
- Byte for byte: `writeFileSync(conv, '﻿- A\r\n- B\r\n')`: the brief equals
  `before + '\n---\n\n﻿- A\r\n- B\r\n'`.
- Blank: for each of `''`, `' \n\t\r\n'`, `'﻿'` and `'﻿\n  ﻿\n'`, written to `conv`, the brief
  equals `before`. After `rmSync(conv)`, the brief equals `before`.
- `cleanup(repo)` in a `finally`.

Interface:
- `packages/core/templates/conventions.md` (new), exactly:
  ```
  # Conventions

  <!-- One rule per line, followed by every commit and every agent in this repository. Record an option that was tried and refused as `Rejected: <option> — <reason>`. accord brief appends this file to every executor brief. -->
  ```
  with one trailing newline. Run `npm run gen` so `packages/core/src/generated/templates.ts` carries it.
- `packages/core/src/scaffold/init.ts`: `initFiles` adds
  `{ path: 'accord/product/conventions.md', text: templates['conventions.md'] }` beside the two product
  documents, and extends their comment to name it (D-04: free text like its siblings, unchecked by lint).
- `packages/core/test/scaffold.test.ts:77-82`: the expected list gains `'accord/product/conventions.md'` between
  `business-rules.md` and `glossary.md`; the title stays as it is.
- `packages/cli/test/init.test.ts`: `SCAFFOLD` (line 19) gains `'accord/product/conventions.md'` between
  `business-rules.md` and `glossary.md`, and the expected lines at 230-235 gain
  `'skipped accord/product/conventions.md'` before `'created accord/product/glossary.md'`.
- `packages/cli/src/commands/brief.ts`: read `join(ctx.root, 'accord', 'product', 'conventions.md')` from disk
  with `readFileSync(..., 'utf8')` when `existsSync` says it exists (ledger Ruling: from disk, not the snapshot
  copy, so a BOM or CRLF reaches the brief as written). When the text with every whitespace character and
  `﻿` removed is empty, or the file is absent, the output is today's. Otherwise write today's output, then
  `'\n---\n\n'`, then the text unchanged.

Must not change: every other `accord brief` case in `lane-commands.test.ts` (none has a conventions file, so each
prints the brief it prints today); `init`'s refusal to write over an existing path and its code-point order;
`glossary.md` and `business-rules.md` byte for byte.

## Task 4: The executor and planner instructions and the ruleset name the verify id, the accord folder and the conventions
covers: @ac-1, D-01
files: packages/core/agents/executor.md, packages/core/agents/planner.md, packages/core/templates/ruleset.md, packages/core/src/generated/agents.ts, packages/core/src/generated/templates.ts, packages/core/test/agents.test.ts, .claude/agents/accord-executor.md, .claude/agents/accord-planner.md
verify: packages/core/test/agents.test.ts#ac-1-the-executor-is-told-how-verify-ids-match-what-it-must-not-touch-and-to-read-the-conventions (@ac-1), packages/core/test/session.test.ts#rulesetText->-is-under-2048-bytes, packages/core/test/agents.test.ts#rendered-agents->-stays-short

Consumes: `agentTargets` and `rulesetText`, as they are at the baseline. Produces: the rendered executor and
planner text and the ruleset every session receives at its start.

Test first, in `packages/core/test/agents.test.ts`, appended at the end, top-level, adding `rulesetText` to the
`../src/index.js` import:
`it('ac-1 the executor is told how verify ids match what it must not touch and to read the conventions')`.
`flat(s)` is `s.replace(/\s+/g, ' ')`; `executor` and `planner` are the flattened texts of
`.claude/agents/accord-executor.md` and `.claude/agents/accord-planner.md` from `agentTargets(config())`, each
non-empty; `rules` is `flat(rulesetText('npx --yes @x/accord@1.2.3'))`.
- `executor` contains each of: ``A `verify:` id must equal, character for character, the id accord builds from
  the JUnit report``, ``the testcase's classname, then `#`, then its name``, `every enclosing describe title`,
  `are each trimmed`, ``each run of whitespace in them becomes `-` ``,
  `missing or is the empty string before trimming`, `read the JUnit report and find each verify id`,
  ``never run `accord task-done` ``, `create, change, delete or rename`,
  ``the repository's top-level `accord/` folder``, ``An `accord/` folder inside a test fixture or an example is
  not it``, ``Read `accord/product/` ``, ``follow `accord/product/conventions.md` ``.
- `planner` contains ``Read `accord/product/` ``.
- `rules` contains ``Every commit, by the main session or any agent, follows `accord/product/conventions.md`
  when that file exists.``

Interface (text):
- `packages/core/agents/executor.md`, after the bullet `- You read, write code, run commands, and commit.`, two
  bullets:
  - ``- Read `accord/product/` before you start, and follow `accord/product/conventions.md` in every commit and every file you write.``
  - ``- You never run `accord task-done`, and you never create, change, delete or rename any file under the repository's top-level `accord/` folder. An `accord/` folder inside a test fixture or an example is not it.``
  After the `(@ac-n)` bullet under `How you work:`, two bullets:
  - ``- A `verify:` id must equal, character for character, the id accord builds from the JUnit report: the testcase's classname, then `#`, then its name, which already carries every enclosing describe title. The whole classname and the whole name are each trimmed, and each run of whitespace in them becomes `-`. When the classname attribute is missing or is the empty string before trimming, the id is that name alone.``
  - ``- Before you report `DONE`, read the JUnit report and find each verify id of your task in it; an id you cannot find there is not done.``
- `packages/core/agents/planner.md`, after the bullet that begins `- Your input is the path of one ticket file`:
  ``- Read `accord/product/` before you plan: its glossary, business rules and `conventions.md` bind every task.``
- `packages/core/templates/ruleset.md`: after rule 7 (its line `   its limits.`), the line
  ``8. Every commit, by the main session or any agent, follows `accord/product/conventions.md` when that file exists.``
  (ledger Ruling: "when that file exists"). To stay under the 2048-byte cap that
  `packages/core/test/session.test.ts:16` checks, line 3 becomes
  `These hold for every reply here, for the main session and every accord agent.` Counted by hand, the ruleset
  with the test's invocation is about 1942 bytes at the baseline and about 2037 after both edits. If the
  `is under 2048 bytes` case still fails, also shorten `Any other decision you take is a Ruling,` in rule 1 to
  `Any other decision is a Ruling,`; if it fails after that, stop with `BLOCKED` and the byte count.
- Run `npm run gen`, then `npm run build` and `node packages/cli/dist/cli.js skills sync`, which rewrites
  `.claude/agents/accord-executor.md` and `.claude/agents/accord-planner.md`.

Must not change: every other case in `agents.test.ts`, including `executor names every required phrase`,
`planner names every required phrase`, `ac-4 the planner runs every plan check of the critic before it replies`,
`ac-5 the planner and the executor say a test name holds no at sign and no comma` and `stays short` (body at most
60 lines); the rest of both agent texts; `rulesetText`'s other cases (`fills the invocation...` and
`leaves the ledger and the report shape to each agent`, so rule 1's `never writes the ledger unless its own
instructions say so` and rule 7's `these lines go inside that report` stay word for word); `hook.test.ts`. No
text names a runtime product (D-109).

## Task 5: The verify skill offers to promote a Ruling or Correction into the conventions
covers: @ac-5, D-05
files: packages/core/skills/verify/SKILL.md, packages/core/src/generated/skills.ts, packages/core/test/stage-skills.test.ts, .claude/skills/accord-verify/SKILL.md
verify: packages/core/test/stage-skills.test.ts#ac-5-the-verify-skill-offers-to-promote-a-ruling-or-correction-into-the-conventions (@ac-5), packages/core/test/skills.test.ts#render-output-invariants->-every-SKILL.md-is-at-most-MAX_SKILL_BYTES-bytes-(spec-§2), packages/core/test/stage-skills.test.ts#stage-skills-name-what-the-spec-requires->-verify-names-every-required-phrase

Consumes: `skillTargets` and the `files` constant of `stage-skills.test.ts`, and `accord/product/conventions.md`
from Task 3. Produces: the promotion text in step 6 of the rendered `accord-verify` skill.

Test first, in `packages/core/test/stage-skills.test.ts`, appended at the end, top-level:
`it('ac-5 the verify skill offers to promote a ruling or correction into the conventions')`:
- `text` is the rendered `.claude/skills/accord-verify/SKILL.md` from `files`, non-empty, with every whitespace
  run collapsed to one space. `step = text.slice(text.indexOf('6. Run `accord gate done <id>`'),
  text.indexOf('7. Next:'))`, and both indexes are greater than -1.
- `step` contains ``read the ticket's `## Corrections` and the Rulings under the ledger's `## Rulings` ``,
  `judge to hold across tickets`, `ask the owner whether it becomes a rule of this repository`,
  ``write it as one rule line in `accord/product/conventions.md` `` and
  ``Without the owner's yes, write nothing to `conventions.md` ``.
- `a = step.indexOf('ask the owner whether')`, `w = step.indexOf('write it as one rule line')` and
  `c = step.indexOf('Then commit only')` satisfy `-1 < a < w < c`, and `step.slice(c)` contains
  ``accord/tickets/<id>/verification.md`` and ``accord/product/conventions.md``.

Interface (text), `packages/core/skills/verify/SKILL.md`, step 6 becomes:
```
6. Run `accord gate done <id>` and work from what it prints. Leave
   `verification.md` and the tick uncommitted until it passes;
   the notice that the review file has no author yet is expected and no
   reason to commit earlier. When it passes, read the ticket's
   `## Corrections` and the Rulings under the ledger's `## Rulings`. For
   each one you judge to hold across tickets, ask the owner whether it
   becomes a rule of this repository; on a yes, write it as one rule
   line in `accord/product/conventions.md`. Without the owner's yes,
   write nothing to `conventions.md`. Then commit only
   `accord/tickets/<id>.md`, `accord/tickets/<id>/verification.md` and,
   when a rule was written, `accord/product/conventions.md`; under
   `review: outcome` the commit message quotes the owner's answer.
```
The step stays number 6, because the accord skill resumes `done` at `accord-verify` step 6. The added text names
no gate state word (`Ready`, `Done`), no finding level and no rule id, so
`no rendered text restates a rule the CLI enforces` in `skills.test.ts` stays green. Run `npm run gen`, then
`npm run build` and `node packages/cli/dist/cli.js skills sync`, which rewrites
`.claude/skills/accord-verify/SKILL.md`. Check the rendered file's size with
`node -e "console.log(require('fs').statSync('.claude/skills/accord-verify/SKILL.md').size)"`; it stays at or
under 5120 bytes.

Must not change: steps 1 to 5 and 7 of the verify skill and its `## Rules`; every phrase in the `verify` row of
`REQUIRED` in `stage-skills.test.ts`; `exactly one rendered file tells its reader about ticking verified` in
`skills.test.ts`; every other stage skill.
