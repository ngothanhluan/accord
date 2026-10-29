---
baseline: 39fd2ec98567a35f10843999f65eb973aed1ba54
plan_hash: "fnv1a64:24038de09575a51f"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: Task 1 is the wiring. It makes `accord brief <id> <n>` print the task's one test command (ac-1), the
`tests.full` fallback (ac-2) or the no-command line (ac-3) between the task section and the conventions tail,
so every executor brief carries it end to end. Task 2 is the executor text (ac-4, D-05), the build skill's step 3
that runs the printed command, the regenerated maps and `.claude` copies, and the workflow-layer spec. Task 3, the
polish, adds the quoting of odd paths and the line for a task with no path, proven by one `risk:parsing` test.

Rules for every task:
- Commits carry no trailer of any kind: no `Co-Authored-By:` line, no `Signed-off-by:` or other `-by:` line, and
  no "Generated with" line, in the subject or the body.
- No task touches any file under the repository's top-level `accord/` folder.
- Test ids: every test named on a `verify:` line is a top-level `it(...)` with no `describe` around it. Its report
  id is the test file's path from the repository root, then `#`, then the `it` title with each whitespace run
  turned into `-` (`packages/core/src/load/junit.ts:40`). No test title holds `@`, `#` or a comma. No existing
  test is renamed. Every new test is named on some task's `verify:` line, and no other new test is added.
- Tests: run the test command your brief prints. When it prints none, run only the test files your task's
  `files:` line names, with `npx vitest run <files> --reporter=default --reporter=junit
  --outputFile.junit=node_modules/.cache/accord/junit.xml`; never `tests.full`. Then find each id of the task's
  `verify:` line in `node_modules/.cache/accord/junit.xml` before reporting done.
- After changing a file under `packages/core/agents/` or `packages/core/skills/`, run `npm run gen`, then
  `npm run build`, then `node packages/cli/dist/cli.js skills sync`, in that order (a build before `gen` embeds
  the old text). After `npm run gen` and after the sync, `git status` shows a change only in files on the task's
  `files:` line; any other change is reported as outside the plan.
- End every task with `npm run build`, `npm run lint` and `npm run typecheck`, then its tests.
- Files are LF with no BOM. Add no dependency. `packages/core/src/` gains no code, no export and no `node:fs`
  import; `packages/core/src/index.ts` is not touched (approach).
- Helpers already imported in `packages/cli/test/lane-commands.test.ts`: `makeLaneRepo(extra)`, `run(argv, cwd)`
  (gives `{ code, out, err }`), `cleanup(repo)`, `writeFiles(repo, files)` from `./helpers/repo.js`; `CONFIG`,
  `REPORT` from `../../../test/helpers/lane.js`; `readFileSync` from `node:fs`; `join` from `node:path`.
  `makeLaneRepo(extra)` makes an uncommitted git sandbox holding `accord/config.yml` (= `CONFIG`, whose `tests:`
  block holds only `  report: reports/junit.xml`), lane ticket `T-1`, its plan `accord/tickets/T-1/plan.md` (the
  helper `PLAN`: `# Plan`, then `## Task 1: Writer csv mode` and `## Task 2: Escaping`, each with
  `files: src/export.ts` and a `verify:` id `export#...` whose prefix is not a file), `src/export.ts` and the
  report, each overridden by the `extra` path-to-text map. `ctx.snapshot.tree` holds every tracked and untracked,
  not ignored, path of the sandbox (`gitTree`, `packages/cli/src/load/fs.ts:19`), so a file written by
  `makeLaneRepo` or `writeFiles` is in it.

The exact brief lines, shared by Tasks 1 and 3 (each one line, ending with `\n` in the output):
- `ONLY` = `This is the only test command the executor runs for this task.`
- `FULL_WHY` = `tests.full is printed because accord/config.yml has no tests.affected.`
- `NO_COMMAND` = `No test command is configured: accord/config.yml has no tests.affected and no tests.full.`
- `NO_PATHS` = `No test command is configured for this task: its files: and verify: lines name no path for {files}.`
- A printed command is the line `Test command: <command>`.

## Task 1: Wiring: the brief prints the task's one test command
covers: @ac-1, @ac-2, @ac-3, D-01, D-02, D-03, D-04
files: packages/cli/src/commands/brief.ts, packages/cli/test/lane-commands.test.ts
verify: packages/cli/test/lane-commands.test.ts#ac-1-the-brief-prints-the-task-tests.affected-command-as-the-only-one-to-run (@ac-1), packages/cli/test/lane-commands.test.ts#ac-2-without-tests.affected-the-brief-prints-tests.full-and-says-why (@ac-2), packages/cli/test/lane-commands.test.ts#ac-3-without-either-command-the-brief-says-no-test-command-is-configured (@ac-3)

Consumes: `brief` in `packages/cli/src/commands/brief.ts` as it is at the baseline; the task `t` it already
finds (`t.files`: the `files:` paths in order with `(new)` dropped; `t.verify`: the `verify:` ids in order with
`(@ac-n)` markers dropped, `packages/core/src/model/snapshot.ts:143-145`); `ctx.snapshot.config?.tests`
(`{ report: string; affected?: string; full?: string }`, absent when `config.yml` is missing or invalid);
`ctx.snapshot.tree`. Produces: the test block of every brief, which Task 2's executor text and build step point
to and Task 3 extends.

Tests first, in `packages/cli/test/lane-commands.test.ts`.
- Module level, directly below `const BRIEF_RULE = ...` (line 262), add:
  - `const NO_COMMAND = 'No test command is configured: accord/config.yml has no tests.affected and no tests.full.';`
  - `const ONLY = 'This is the only test command the executor runs for this task.';`
  - `const withTests = (lines: string[]) => CONFIG.replace('  report: ' + REPORT + '\n', '  report: ' + REPORT + '\n' + lines.map((l) => '  ' + l + '\n').join(''));`
    (each given line becomes one more key under `tests:`).
- The two exact-output brief tests of BUG-LN-1 change their expected text only, because the fixture config has no
  test command: line 272 becomes
  `expect(r.out).toBe(ticket.replace(/\n*$/, '\n') + '\n---\n\n' + BRIEF_RULE + '\n\n## Task 2: B\ncovers: @ac-2\n' + '\n---\n\n' + NO_COMMAND + '\n');`
  and line 287 becomes
  `expect(r.out).toBe(ticket.replace(/\n*$/, '\n') + '\n---\n\n## Task 1: A\ncovers: @ac-1\n' + '\n---\n\n' + NO_COMMAND + '\n');`.
  Their titles and every other line stay.
- Appended at the end of the file, top-level, each with `cleanup(repo)` in a `finally`:
  - `it('ac-1 the brief prints the task tests.affected command as the only one to run')`: with
    `plan = '---\nbaseline: abc1234\n---\n\n## Task 1: A\ncovers: @ac-1\n\n## Task 2: B\ncovers: @ac-2\nfiles: src/export.ts, src/csv.ts\nverify: test/csv.test.ts#quotes-cells (@ac-2), test/export.test.ts#writes-csv, src/csv.ts#direct\n'`,
    `repo = makeLaneRepo({ 'accord/config.yml': withTests(['affected: npx vitest related --run {files} --reporter=junit', 'full: npx vitest run --reporter=junit']), 'accord/tickets/T-1/plan.md': plan, 'src/csv.ts': 'export const csv = 1;\n', 'test/csv.test.ts': '', 'test/export.test.ts': '' })`,
    `ticket = readFileSync(join(repo, 'accord/tickets/T-1.md'), 'utf8')`. `run(['brief', 'T-1', '2'], repo)`
    exits 0 and `out` equals
    `ticket.replace(/\n*$/, '\n') + '\n---\n\n## Task 2: B\ncovers: @ac-2\nfiles: src/export.ts, src/csv.ts\nverify: test/csv.test.ts#quotes-cells (@ac-2), test/export.test.ts#writes-csv, src/csv.ts#direct\n' + '\n---\n\nTest command: npx vitest related --run src/export.ts src/csv.ts test/csv.test.ts test/export.test.ts --reporter=junit\n' + ONLY + '\n'`
    (the `files:` paths in order, then each `verify:` test file in order, `src/csv.ts` not repeated; `tests.affected`
    wins over `tests.full`, so no `FULL_WHY` line).
  - `it('ac-2 without tests.affected the brief prints tests.full and says why')`:
    `repo = makeLaneRepo({ 'accord/config.yml': withTests(['full: npx vitest run --reporter=junit']) })`.
    `run(['brief', 'T-1', '2'], repo)` exits 0 and `out` ends with
    `'\n---\n\nTest command: npx vitest run --reporter=junit\n' + ONLY + '\ntests.full is printed because accord/config.yml has no tests.affected.\n'`.
  - `it('ac-3 without either command the brief says no test command is configured')`: `repo = makeLaneRepo()`.
    For each task number `'1'` and `'2'`, `run(['brief', 'T-1', n], repo)` has `code` 0, `out` ends with
    `'\n---\n\n' + NO_COMMAND + '\n'`, and `out` does not contain `Test command:`.
  All three fail at the baseline.

Interface, `packages/cli/src/commands/brief.ts`:
- A non-exported `testBlock(ctx: CommandContext, t: PlanTask): string`, with `PlanTask` imported as a type from
  `@accord-dev/accord-core` (already exported there, as `RepoSnapshot` is in `lane-args.ts`). It returns the lines
  of the block, each ending in `\n`:
  1. `tests = ctx.snapshot.config?.tests`. When `tests?.affected` is defined: the paths are `t.files` in order,
     then for each `verify` entry in order its text before the first `#` (the whole entry when it has no `#`),
     kept only when `ctx.snapshot.tree.includes(prefix) || t.files.includes(prefix)`; a path equal (exact string)
     to one already listed is left out. The command is `tests.affected.split('{files}').join(paths.join(' '))`
     (split and join, never `String.replace`, so a `$` in a path is never read as a replacement pattern; a
     command without `{files}` is printed as written). Return `'Test command: ' + command + '\n' + ONLY + '\n'`.
  2. Else when `tests?.full` is defined: `'Test command: ' + tests.full + '\n' + ONLY + '\n' + FULL_WHY + '\n'`.
  3. Else (neither key, or `config` undefined because `config.yml` is missing or invalid):
     `NO_COMMAND + '\n'`.
  `ONLY`, `FULL_WHY` and `NO_COMMAND` are module-level constants holding the texts of the preamble; `NO_PATHS`
  is added by Task 3.
- The output becomes
  `text.replace(/\n*$/, '\n') + '\n---\n\n' + rules + section.replace(/\n*$/, '\n') + '\n---\n\n' + testBlock(ctx, t) + tail`.
  The block ends in exactly one `\n` and holds no word `conventions`, so the conventions test at
  `packages/cli/test/lane-commands.test.ts:1283-1309` (its `before` ends in one `\n`, not `\n\n`, and contains no
  `conventions`; every brief with a conventions file equals `before + '\n---\n\n' + <file text>`) passes unchanged.
  `brief` still returns 0 in every case.
- Update the header comment: the brief is the ticket verbatim, the plan's preamble, task n, the task's one test
  command, then the conventions.

Must not change: the brief's refusals (no plan, unknown task, task number, ticket without lane, exit 2); the
ticket, preamble, section and conventions tail byte for byte, as `prints the ticket verbatim, then the one task`,
`brief keeps a fenced "## Task" line inside its task and stops at the next real one` and
`ac-2 every brief ends with the repository conventions` check; every other command. The CLI runs no test command.

## Task 2: The executor runs only its brief's test command, and the build skill runs the printed one
covers: @ac-4, D-01, D-04, D-05
files: packages/core/agents/executor.md, packages/core/skills/build/SKILL.md, packages/core/src/generated/agents.ts, packages/core/src/generated/skills.ts, packages/core/test/agents.test.ts, .claude/agents/accord-executor.md, .claude/skills/accord-build/SKILL.md, docs/specs/2026-10-12-workflow-layer-design.md
verify: packages/core/test/agents.test.ts#ac-4-the-executor-runs-only-the-test-command-its-brief-prints-and-never-tests.full-on-its-own (@ac-4)

Consumes: `agents`, `agentTargets` and the `config(over)` helper already in `packages/core/test/agents.test.ts`;
the brief block of Task 1. Produces: the executor rule in the core definition, the generated map and the rendered
`.claude/agents/accord-executor.md`; step 3 of the build skill running the command the brief printed; the spec
text of §8 and §9.

Test first, in `packages/core/test/agents.test.ts`, appended at the end, top-level:
`it('ac-4 the executor runs only the test command its brief prints and never tests.full on its own')`.
- `flat = (s: string) => s.replace(/\s+/g, ' ')`.
- `rendered = agentTargets(config({ runtimes: ['claude', 'codex', 'cursor', 'copilot'] })).filter((f) => f.path.endsWith('/accord-executor.md'))`
  (every runtime that receives agent files); `rendered.length` is greater than 0.
- `committed = readFileSync(new URL('../../../.claude/agents/accord-executor.md', import.meta.url), 'utf8')` (the copy
  `accord skills sync` wrote in this repository; `readFileSync` is already imported).
- `texts = [agents['executor.md'], ...rendered.map((f) => f.text), committed]`; each is non-empty.
- Each of `texts`, flattened, contains each of these phrases, written as JavaScript string literals, one per line;
  each phrase is exactly the text between its double quotes:
  ```
  "Run only the test command your brief prints for your task"
  "never run `tests.full` on your own"
  "`tests.full` belongs to the plan's baseline run and to verify"
  "you run it only when your brief prints it as your task's command"
  "When your brief prints no test command"
  "run only the test files you wrote or changed, never `tests.full`"
  ```
  The message of each `expect` names the text (`core`, the rendered path, or `committed`) and the phrase.
It fails at the baseline.

Interface (text):
- `packages/core/agents/executor.md`, under `How you work:`, directly after the bullet that begins
  `- Write the failing test first:`, this one bullet on one line:
  ``- Run only the test command your brief prints for your task, and never run `tests.full` on your own: `tests.full` belongs to the plan's baseline run and to verify, and you run it only when your brief prints it as your task's command. When your brief prints no test command, as a review, debug or failure brief does, run only the test files you wrote or changed, never `tests.full`.``
- `packages/core/skills/build/SKILL.md`, step 3: replace the text
  ``run the affected tests yourself: the `tests.affected` command from `accord/config.yml`, with `{files}` replaced by the paths on the task's `files:` line.``
  with
  ``run the test command its brief printed yourself; when the brief printed none, run the test files the executor reports it wrote or changed.``
  (the same files the executor bullet above tells the executor to run when its brief prints no command).
  The rest of step 3 and its bullets stay; the bullet that begins ``It refuses because the report is missing or
  older than the commit: the `tests.affected` command`` stays word for word, so the build row of `REQUIRED` in
  `packages/core/test/stage-skills.test.ts:27` (which needs `tests.affected`, `accord brief`, `accord task-done`)
  still holds. The new text names no gate state word (`Ready`, `Done`), no finding level and no rule id, so
  `no rendered text restates a rule the CLI enforces` in `packages/core/test/skills.test.ts` stays green. It is
  15 bytes shorter than the text it replaces (138 against 153), so the rendered build skill stays under `MAX_SKILL_BYTES`
  (5120, `packages/core/test/skills.test.ts:188`); check it with
  `node -e "console.log(require('fs').statSync('.claude/skills/accord-build/SKILL.md').size)"`.
- Run `npm run gen`, then `npm run build`, then `node packages/cli/dist/cli.js skills sync`, which rewrites
  `.claude/agents/accord-executor.md` and `.claude/skills/accord-build/SKILL.md`.
- `docs/specs/2026-10-12-workflow-layer-design.md`, four edits, keeping the wrapping near the current width and no
  other text changed:
  1. §8, line 304: the text after `(new): ` up to the end of the line, today
     ``the ticket verbatim plus that task. It never receives chat history.``, becomes
     ``the ticket verbatim, the plan's preamble, that task, the task's test command, then `accord/product/conventions.md` when it holds text. It never receives chat history.``
     Directly after that bullet, a new bullet:
     ``- The task's test command (ST-LN-64): `tests.affected` with every `{files}` replaced by the task's `files:` paths in order, then each `verify:` entry's text before its first `#` when that text is a file in the repository or on `files:`, a repeated path left out, joined by single spaces; a path holding a character outside `[A-Za-z0-9._/@+=:-]` is single-quoted. Without `tests.affected` it is `tests.full`, and the brief says why; with neither, or with no path for `{files}`, the brief says no test command is configured. The brief says the command it prints is the only test command the executor runs.``
  2. §8, under `- Executor rules:`, directly after `  - Write the task's criterion test first. ...` (line 306),
     the sub-bullet ``  - Run only the test command the brief prints. Never run `tests.full` on its own: it belongs to the plan's baseline run and to verify, and the executor runs it only when the brief prints it as the task's command.``
  3. §8, line 328: ``The orchestrator runs the tests (`tests.affected`) and then `task-done` `` becomes
     ``The orchestrator runs the test command the brief printed and then `task-done` ``; the rest of the sentence
     (from `; the executor's claim alone records`) stays.
  4. §9, the **Speed** row (line 352): its cell becomes
     ``during build only the test command `accord brief` prints for the task runs: `tests.affected` (a command template in config, for example `vitest related {files}` or `dotnet test --filter …`, added in phase 2 with its consumer), or `tests.full` when `tests.affected` is not configured; an executor never runs `tests.full` on its own; `tests.full` runs on the baseline before build and at Done and writes the report `tests.report` names; the verify report lists slow tests``.

Must not change: every other line of the executor definition, including ``A test name never holds `@` or a
comma.`` and the verify-id and JUnit bullets; every existing case of `agents.test.ts` (`executor names every
required phrase`, `stays short` with a body of at most 60 lines, `ac-1 the executor is told how verify ids
match ...`, the drift case); steps 1, 2 and 4 to 8 and the `## Rules` of the build skill; every phrase of the
`build` row of `REQUIRED`; every other agent, skill and rendered copy. No text names a runtime product (D-109).

## Task 3: The brief quotes odd paths and names a task with no path
covers: D-02, D-03
files: packages/cli/src/commands/brief.ts, packages/cli/test/lane-commands.test.ts
verify: packages/cli/test/lane-commands.test.ts#risk:parsing-the-brief-test-command-quotes-odd-paths-and-drops-new-marks-repeats-and-non-file-verify-prefixes

Consumes: `testBlock` and the constants `ONLY`, `NO_COMMAND` and `withTests` from Task 1. Produces: single-quoting
of a path with a shell metacharacter and the `NO_PATHS` line (ledger Rulings: quoting, empty path list).

Test first, in `packages/cli/test/lane-commands.test.ts`, appended at the end, top-level, with `60_000` as the
third argument of `it`:
`it('risk:parsing the brief test command quotes odd paths and drops new marks repeats and non-file verify prefixes')`.
One sandbox, rewritten with `writeFiles` between runs (each `run` reloads the repository), `cleanup(repo)` in a
`finally`:
- `plan` is the text below, each line ending in `\n` (written as a JavaScript template literal or joined lines;
  the `'` in `it's` is part of the path):
  ```
  ---
  baseline: abc1234
  ---

  ## Task 1: A
  covers: @ac-1
  files: src/export.ts, lib/@scope/a+b=c.ts, app/(group)/[slug]/page.tsx (new), routes/$id.tsx, src/$&.ts, docs/it's.md, src/export.ts
  verify: src/export.ts#a (@ac-1), export#writes-csv, tests.test_csv.TestCsv#test_quotes, test/csv.test.ts#b, test/csv.test.ts#c, app/(group)/[slug]/page.tsx#d, lonely-name

  ## Task 2: B
  covers: @ac-2
  verify: export#escapes-commas, tests.test_csv.TestCsv#test_x
  ```
- `repo = makeLaneRepo({ 'accord/config.yml': withTests(['affected: run {files} -- {files}']), 'accord/tickets/T-1/plan.md': plan, 'test/csv.test.ts': '' })`.
- (a) With ``J = String.raw`src/export.ts lib/@scope/a+b=c.ts 'app/(group)/[slug]/page.tsx' 'routes/$id.tsx' 'src/$&.ts' 'docs/it'\''s.md' test/csv.test.ts` ``:
  `run(['brief', 'T-1', '1'], repo)` exits 0 and `out` ends with
  `'\n---\n\nTest command: run ' + J + ' -- ' + J + '\n' + ONLY + '\n'`. This proves: `(new)` is not a path;
  `src/export.ts` appears once although `files:` and `verify:` repeat it; `export`,
  `tests.test_csv.TestCsv` and `lonely-name` are not files and are left out; `test/csv.test.ts` is kept once
  because it is in the repository; a path whose every character is in `[A-Za-z0-9._/@+=:-]` is bare; any other
  is single-quoted, an inner `'` written `'\''`; `$&` reaches the output as written; every `{files}` is replaced.
- (b) `run(['brief', 'T-1', '2'], repo)` exits 0, `out` ends with
  `'\n---\n\nNo test command is configured for this task: its files: and verify: lines name no path for {files}.\n'`
  and does not contain `Test command:`.
- (c) `writeFiles(repo, { 'accord/config.yml': withTests(['affected: npm test']) })`: `run(['brief', 'T-1', '2'], repo)`
  exits 0 and `out` ends with `'\n---\n\nTest command: npm test\n' + ONLY + '\n'` (a command without `{files}` is
  printed as written, even with no path).
- (d) `writeFiles(repo, { 'accord/config.yml': withTests(['affected: ""']) })` (an empty value fails the schema's
  `minLength: 1`, so the config is invalid): `run(['brief', 'T-1', '1'], repo)` exits 0 and `out` ends with
  `'\n---\n\n' + NO_COMMAND + '\n'`. If the brief exits 2 here for a reason outside `brief.ts`, stop with
  `BLOCKED` and its stderr.
(a) and (b) fail before the change; (c) and (d) pass after Task 1 and must still pass.

Interface, `packages/cli/src/commands/brief.ts`:
- A non-exported `quote(p: string): string`: `p` when it matches `/^[A-Za-z0-9._\/@+=:-]+$/`, otherwise
  `"'" + p.replace(/'/g, "'\\''") + "'"`.
- In `testBlock`'s `tests.affected` branch: when `tests.affected` contains `{files}` and the path list is empty,
  return `NO_PATHS + '\n'` (module-level constant, text as in the preamble); otherwise the command is
  `tests.affected.split('{files}').join(paths.map(quote).join(' '))`. The `tests.full` and `NO_COMMAND`
  branches do not change.

Must not change: Task 1's three criterion tests and the two BUG-LN-1 tests at lines 272 and 287, byte for byte;
the order and de-duplication of paths; the conventions test at `lane-commands.test.ts:1283-1309`; the refusals.
