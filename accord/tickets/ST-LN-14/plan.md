---
baseline: 7cb7635a69bd8d5c570c6c9a32cc4688d768e363
plan_hash: "fnv1a64:e0cadaf249fff470"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: Task 1 is the wiring: `scripts/benchmark.mjs` becomes importable and reads, from a transcript folder,
everything every other task consumes. Tasks 2 and 3 build the compliance check (`--compliance`) first, because the
30-day retention starts dropping the dogfood transcripts on 2026-11-11 and Task 2 extracts the real ST-LN-7 and
BUG-LN-3 lines into fixtures. Tasks 4 to 6 prepare round 1: the committed sample list and run matrix (Task 4), the
brief rewrite (Task 5) and `--plan` / `--clean` with their worktrees (Task 6). Tasks 7 and 8 are the hold rules
and the report. Task 9 matches finished runs by tag, adds `--judge`, and makes the default round run write the
report.

How the round is run once the tasks are done (this is the verify evidence for @ac-1 to @ac-3; no task runs it):
`node scripts/benchmark.mjs --compliance <folders>` first, then `--round 1 --plan`; the main session dispatches
every row `--plan` printed; then `--round 1 --judge`, the session dispatches every judge row it printed; then
`--round 1` writes `docs/benchmark/round-1.md`; `--clean` removes the round's worktrees. Executors never dispatch
agents and never run the round.

Rules for every task:
- Test ids: every test this plan writes is a top-level `it(...)` with no `describe` around it. Its report id is
  the test file's path from the repository root, `#`, then the `it` title with each whitespace run turned into
  `-`. No title holds `@`, a comma or an apostrophe. No existing test is renamed.
- Tests import a script the way `packages/core/test/plan-review-count.test.ts:4` does:
  `(await import(new URL('../../../scripts/<name>.mjs', import.meta.url).href)) as { ... }`, typing only what the
  test calls. The repository root in a test is `fileURLToPath(new URL('../../../', import.meta.url))`.
- No line of any test file holds the text `process.platform` (the ST-LN-26 ac-5 test in
  `packages/core/test/stage-skills.test.ts` reports every such line that is not a runner skip).
- Temporary folders come from `mkdtempSync(join(tmpdir(), 'bench-'))` and are removed in a `finally` with
  `rmSync(dir, { recursive: true, force: true })`. A test that runs git passes `120_000` as the third argument
  of `it`. A test that commits writes the message to a file and runs
  `git -c user.name=t -c user.email=t@example.com commit -q -F <file> --cleanup=verbatim`; a dated commit sets
  `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` in the spawn's `env`.
- `scripts/round.mjs` and `scripts/compliance.mjs` are pure, as `scripts/plan-review.mjs` is: they import nothing,
  read no file and spawn nothing. Files, git and child processes live only in `scripts/benchmark.mjs`. The scripts
  may import `yaml` (installed at the repository root as core's dependency); no dependency is added anywhere.
- Every `git` spawn is `execFileSync('git', [...args], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'] })`. Every `git log` and `git show` passes `-c log.showSignature=false` before
  the subcommand and `--no-show-signature` after it (`accord/product/conventions.md`).
- Every path the scripts print or store uses `/`.
- Nothing under `.claude/agents/`, `packages/core/agents/`, `packages/*/src/` or any package's `files` changes
  (ticket Intent "Not", @ac-3).
- End every task with `npm run lint` and `npm run typecheck`, then `npx vitest run <each test file the task
  names>`, then `npx vitest run packages/core/test/stage-skills.test.ts packages/core/test/plan-review-count.test.ts`.

Definitions shared by every task:
- Projects root: `path.join(os.homedir(), '.claude', 'projects')`. A transcript folder is a directory such as
  `<projects root>/C--Work-accord`. A session is `<folder>/<session>.jsonl`; its subagent runs are
  `<folder>/<session>/subagents/agent-<id>.jsonl`, each beside `agent-<id>.meta.json` (`agentType`,
  `description`, `toolUseId`, and sometimes `model`, `effort`). Folders below `subagents/` (such as
  `subagents/workflows/`) are not read. A run's file name is `<folder name>/<session>/subagents/agent-<id>.jsonl`
  and a session's is `<folder name>/<session>.jsonl`.
- A transcript line is one JSON object; a line that does not parse is skipped. An assistant line has
  `type: 'assistant'` and a `message` with `id`, `model`, `usage` and `content[]` (`text`, `thinking`,
  `tool_use { id, name, input }`). `requestedModel`, `effort`, `perTurnEffort`, `timestamp`, `gitBranch` and
  `cwd` are read from the line, else from `message`. A user line has `type: 'user'` and `message.content[]` items
  `tool_result { tool_use_id, content }`; `content` is a string or an array whose `text` items are joined with `\n`.
- A run's dispatch: the `tool_use` named `Agent` or `Task` whose `id` equals the run's `meta.toolUseId`, found on
  an assistant line of the session file; its `input` (`description`, `subagent_type`, `model`, `effort`, `prompt`),
  that line's `timestamp` and its `cwd`.
- Round tags: `<role>-<n>-<effort>`, where `<role>` is the agent name without `accord-` (`final-reviewer-3-high`).
  A round run is dispatched with the description `bench r1 <tag>` and its judge with `bench r1 <tag> judge`.
  Every run whose description starts with `bench r` is a round run and never a compliance input.
- Bench root: `path.resolve(repo, '..', 'accord-bench')`, where `repo` is the repository the script runs in. It
  holds `compliance.md`, `round-1.json` (the round's state), `wt/` (worktrees), `briefs/` and `files/`.
- The nine agents and their roles: `accord-executor` and `accord-planner` (their own roles); `accord-critic`,
  `accord-reviewer`, `accord-final-reviewer`, `accord-auditor`, `accord-verifier` (finding roles);
  `accord-architect`, `accord-scout` (fact roles). The writing agents are the executor, the planner and the
  verifier (`.claude/agents/accord-verifier.md:13` writes `verification.md`); the others are read-only.

## Task 1: Wiring: benchmark.mjs reads every run's turns, usage, dispatch, sends, commits, edits, reads and task-done refusals
covers: D-07, D-03
files: scripts/benchmark.mjs, packages/core/test/benchmark-reader.test.ts (new)
verify: packages/core/test/benchmark-reader.test.ts#risk:parsing-turns-usage-dispatch-sends-commits-edits-reads-and-task-done-refusals-are-read-from-a-transcript-folder

Consumes: `scripts/benchmark.mjs` as it is at the baseline. Produces: `readSessions(dirs)` and the importable
script every other task extends.

Before editing, copy `<projects root>/C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3.jsonl` and the folder
`<projects root>/C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/` (a finished session) into
`<scratchpad>/legacy/C--Work-accord/`, and run `node scripts/benchmark.mjs <scratchpad>/legacy/C--Work-accord >
<scratchpad>/before.md` from the repository root.

Test first, in `packages/core/test/benchmark-reader.test.ts` (new):
- `it('risk:parsing turns usage dispatch sends commits edits reads and task-done refusals are read from a transcript folder')`:
  write under a temporary `<tmp>/C--Work-x/`:
  - `S1.jsonl`: (1) an assistant line, timestamp `2026-10-01T00:00:00Z`, `cwd: 'C:\\Work\\x'`, content one
    `tool_use { id: 'toolu_A', name: 'Agent', input: { description: 'Build T-1 task 2', subagent_type:
    'accord-executor', model: 'sonnet', effort: 'low', prompt: 'Brief: C:/tmp/brief.md' } }`; (2) an assistant
    line at `2026-10-01T00:30:00Z` with `tool_use { id: 'toolu_S', name: 'SendMessage', input: { to: 'x1',
    summary: 'one more fix', message: 'fix b too' } }`; (3) an assistant line with
    `tool_use { id: 'toolu_T', name: 'Bash', input: { command: 'accord task-done T-1 2' } }` and a user line at
    `2026-10-01T00:40:00Z` with its `tool_result` content
    `'task 2 of T-1 is not done:\n  a.test.ts#b is not in r.xml\n'`.
  - `S1/subagents/agent-x1.meta.json`: `{ agentType: 'accord-executor', description: 'Build T-1 task 2',
    toolUseId: 'toolu_A' }`.
  - `S1/subagents/agent-x1.jsonl`, all with `perTurnEffort` and `requestedModel` on the line:
    - message `m1`, two lines: `model: 'claude-sonnet-5-5'`, `requestedModel: 'claude-sonnet-5-5'`,
      `perTurnEffort: 'low'`; first line `usage { input_tokens: 5, cache_read_input_tokens: 100,
      cache_creation_input_tokens: 7, output_tokens: 10 }` with a `text` item `'ok'`; second line the same usage but
      `output_tokens: 40` with `tool_use { id: 'e1', name: 'Edit', input: { file_path: 'C:\\Work\\x\\src\\a.test.ts' } }`.
    - message `m2`, one line, `perTurnEffort: 'medium'`, `usage { input_tokens: 1, output_tokens: 1 }`, content
      `tool_use { id: 'e2', name: 'Write', input: { file_path: 'C:/Work/x/src/a.ts', content: 'x'.repeat(400) } }`.
    - message `m3`, `usage { output_tokens: 50 }`: `tool_use { id: 'b1', name: 'Bash', input: { command: 'git commit -q -F m.txt && git log --oneline -1' } }`,
      then a user line with its `tool_result` `'abc1234 T-1 task 2: work'`.
    - message `m4`, `usage { output_tokens: 50 }`: `tool_use { id: 'r1', name: 'Read', input: { file_path: 'C:/tmp/brief.md' } }`,
      then a user line with its `tool_result` `'     1\tline one\n     2\tline two\n<system-reminder>\nnote\n</system-reminder>'`.
    - message `m5` at `2026-10-01T00:20:00Z`, `usage { output_tokens: 50 }`: `tool_use { id: 'h1', name:
      'SubagentHandback', input: { message: 'DONE\ncommits: abc1234 T-1 task 2: work' } }`.
  - `S1/subagents/workflows/agent-zz.meta.json` and `.jsonl` (any content): never read.
  - `const s = readSessions([join(tmp, 'C--Work-x')])`. Each `expect`:
    - `s.runs.length` is 1; `run.file` is `C--Work-x/S1/subagents/agent-x1.jsonl`; `run.id` `x1`; `run.agent`
      `accord-executor`; `run.ticket` `T-1`; `run.task` `2`; `run.fix` false.
    - `run.dispatch` matches `{ model: 'sonnet', effort: 'low', prompt: 'Brief: C:/tmp/brief.md', cwd: 'C:\\Work\\x',
      ts: Date.parse('2026-10-01T00:00:00Z') }`.
    - `run.turns.map((t) => [t.id, t.model, t.requestedModel, t.perTurnEffort])` starts with
      `['m1', 'claude-sonnet-5-5', 'claude-sonnet-5-5', 'low']` and its second entry has `perTurnEffort` `medium`.
    - `run.usage` equals `{ input: 6, cacheRead: 100, cacheWrite: 7, output: 302, estimated: true }`: `m1` gives
      40 (its larger line), `m2` gives its estimate 112 (`ceil(447 / 4)`, the length of
      `JSON.stringify(input)`, beating its `output_tokens: 1`), `m3`, `m4`, `m5` give 50 each (their estimates are
      smaller).
    - `run.edits.map((e) => e.path)` equals `['C:/Work/x/src/a.test.ts', 'C:/Work/x/src/a.ts']`.
    - `run.commits` equals `['abc1234']`; `run.reads` equals `[{ path: 'C:/tmp/brief.md', text: 'line one\nline two', ts }]`.
    - `run.handbacks` has one entry with text starting `DONE`, and `run.outcome` is `DONE`.
    - `run.sends` equals `[{ ts: Date.parse('2026-10-01T00:30:00Z'), to: 'x1', summary: 'one more fix', message: 'fix b too' }]`.
    - `s.refusals` equals `[{ file: 'C--Work-x/S1.jsonl', ts: Date.parse('2026-10-01T00:40:00Z'), ticket: 'T-1',
      task: 2, reasons: ['a.test.ts#b is not in r.xml'] }]`.
    - No field of any run counts advisor calls (D-03): `Object.keys(run)` contains no key matching `/advisor/i`.

Interface, `scripts/benchmark.mjs`:
- Today's top-level code moves, unchanged in what it prints, into `export function legacyReport(dirs)` returning
  the Markdown string; it keeps `process.cwd()` as the repository and its own `readRun`. A main guard,
  `if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exitCode = main(process.argv.slice(2))`,
  runs `main(args)`: with no argument starting `--`, it writes `legacyReport(dirs)` to stdout as today (same
  default folders); an unknown `--` flag writes `usage: node scripts/benchmark.mjs [--compliance | --round 1
  [--plan | --judge] | --clean] [folder ...]` to stderr and returns 2. Importing the module runs nothing.
- `export function readSessions(dirs)` returns `{ runs, refusals }`:
  - Runs: every `<session>/subagents/agent-<id>.meta.json` with its `.jsonl`, as the Definitions say. Each run:
    `{ file, id, agent, desc, ticket, task, fix, metaModel, metaEffort, start, end, ms, dispatch, turns, usage,
    edits, commits, reads, handbacks, outcome, lastText, sends }`. `ticket`, `task`, `fix`, `ms` (active time), `lastText`
    and `outcome` follow today's `readRun` rules (`benchmark.mjs:38-61`); `task` is a number or null.
  - `turns`: one per `message.id` in order of first appearance, skipping `model === '<synthetic>'`, each
    `{ id, ts, model, requestedModel, effort, perTurnEffort }`, every value the first non-empty one among that
    id's lines (D-07).
  - `usage`: per message id, the largest `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`
    and `output_tokens` seen on its lines; summed over ids into `input`, `cacheRead`, `cacheWrite`, `output`. Per
    id, when `ceil(chars / 4)` of all its content (`text`, `thinking`, `JSON.stringify(tool_use.input)`) is larger
    than its `output_tokens`, the estimate is used for that id and `estimated` becomes true (ledger Ruling on
    output tokens; checked on a real run: `output_tokens` for one message id grows across its lines, 37 then 119,
    in `C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ac2ea8c2c64fff9ae.jsonl:72-73`, and a
    one-line `SubagentHandback` message records 24).
  - `edits`: each `tool_use` named `Edit`, `Write`, `MultiEdit` or `NotebookEdit`, `{ path, ts }`, `path` from
    `input.file_path ?? input.notebook_path` with `\` turned into `/`.
  - `reads`: each `Read` `tool_use` with its `tool_result` text: drop every line from the first one starting
    `<system-reminder>`, strip `^\s*\d+\t` from each line, drop trailing newlines; `{ path, text, ts }`.
  - `commits`: from the `tool_result` of every `Bash` `tool_use` whose `command` contains `git commit`, each hex
    token of 7 to 40 characters at the start of a line or right after `[<branch> `; plus each hex token of 7 to 40
    characters on the `commits:` line of every handback; unique, in order. Task 2 filters them by git.
  - `handbacks`: each `SubagentHandback` `tool_use`, `{ ts, text: input.message }`.
  - `sends`: every `SendMessage` `tool_use` in any session file of the same folder whose `input.to` equals the
    run's id, `{ ts, to, summary, message }`.
- Refusals: in every session and run file, each `tool_result` text matching `^task (\d+) of (\S+) is not done:$`
  (multiline), with the following lines that start with two spaces as `reasons` (trimmed); `{ file, ts, ticket,
  task, reasons }`, unique by file, ticket, task and reasons.

Must not change: `node scripts/benchmark.mjs <scratchpad>/legacy/C--Work-accord` prints exactly
`<scratchpad>/before.md` (compare with `git diff --no-index`); `scripts/plan-review.mjs` and
`packages/core/test/plan-review-count.test.ts` stay as they are and pass.

## Task 2: The compliance check finds the four known breaches by rules that name no ticket
covers: @ac-4, D-06
files: scripts/compliance.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-compliance.test.ts (new), packages/core/test/fixtures/benchmark/commits.json (new), packages/core/test/fixtures/benchmark/schemas.test.ts.txt (new), packages/core/test/fixtures/benchmark/projects/C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240.jsonl (new), packages/core/test/fixtures/benchmark/projects/C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-aae0cafc466e597f4.jsonl (new), packages/core/test/fixtures/benchmark/projects/C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-aae0cafc466e597f4.meta.json (new), packages/core/test/fixtures/benchmark/projects/C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3.jsonl (new), packages/core/test/fixtures/benchmark/projects/C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ac2ea8c2c64fff9ae.jsonl (new), packages/core/test/fixtures/benchmark/projects/C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ac2ea8c2c64fff9ae.meta.json (new), packages/core/test/fixtures/benchmark/projects/C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ae0a4407a746836a7.jsonl (new), packages/core/test/fixtures/benchmark/projects/C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ae0a4407a746836a7.meta.json (new)
verify: packages/core/test/benchmark-compliance.test.ts#ac-4-the-compliance-check-finds-the-four-known-breaches (@ac-4)

Consumes: `readSessions` (Task 1). Produces: `compliance(input)`, `render(result)` and
`node scripts/benchmark.mjs --compliance <folder ...>`, which Task 3 extends and Task 6 requires before `--plan`.

Fixtures first. Write a one-off extraction script in the scratchpad (never committed) that copies, from
`<projects root>/C--Work-accord/`, into `packages/core/test/fixtures/benchmark/projects/C--Work-accord/`:
- the three runs: `c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-aae0cafc466e597f4` ("Fix BUG-LN-3 final
  review", the round 4 fix: its commit `ca75fa2` is `fixed in ca75fa2` under `## Round 4` of
  `accord/tickets/BUG-LN-3/review.md`), `4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ac2ea8c2c64fff9ae`
  ("Build ST-LN-7 task 1 again", whose transcript shows `0496cf0`) and
  `4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ae0a4407a746836a7` ("Build ST-LN-7 task 4"). Each
  `.meta.json` byte for byte; from each `.jsonl`, every assistant line and every user line holding a `tool_result`.
- from each of the two session files, the assistant line holding the `Agent` `tool_use` of each copied run
  (`meta.toolUseId`), and, from `4c922939-….jsonl`, the first user line whose `tool_result` holds
  `task 2 of ST-LN-7 is not done:` with the assistant line holding its `Bash` `tool_use`.
- In every copied line: delete `toolUseResult`; cut every string longer than 2000 characters to its first 2000
  characters, except `command`, `file_path`, `description`, `subagent_type`, `model`, `effort`, `to`, `summary`;
  keep every other field and the line order.
- `commits.json`: for each sha in the copied runs' `commits` (`readSessions` on the fixture folder), the output of
  `git -c log.showSignature=false show --no-show-signature -s --format=%H%x00%at%x00%B <sha>` run in this
  repository (the object store is shared; `refs/keep/ST-LN-14-0496cf0` keeps `0496cf0`, ledger Ruling), as
  `[{ "sha": <full>, "at": <seconds * 1000>, "message": <body> }]`; a sha git cannot show is left out.
- `schemas.test.ts.txt`: byte for byte what `testFileAt(repo, 'packages/core/test/schemas.test.ts', <the refusal's
  ts>)` (below) returns in this repository.
- Before writing the rules, run `readSessions` on the fixture folder and check by eye that the ST-LN-7 task 4
  run's first `edits` entry is a source file and the first test-file edit comes after it. If the transcript shows
  the source edit made through `Bash` instead, stop `BLOCKED` naming the line.

Test first, in `packages/core/test/benchmark-compliance.test.ts` (new):
- `it('ac-4 the compliance check finds the four known breaches')`:
  - `s = readSessions([<fixtures>/benchmark/projects/C--Work-accord])`; `commits = JSON.parse(commits.json)`;
    `tickets` = for `BUG-LN-3` and `ST-LN-7`, `{ review, ledger }` read from `accord/tickets/<id>/review.md` and
    `ledger.md` under the repository root (an absent file is `''`).
  - `out = render(compliance({ runs: s.runs, refusals: s.refusals, commits: [], tickets, settings: { tierUp: 4,
    executorModel: 'sonnet' }, commitInfo: (short) => commits.find((c) => c.sha.startsWith(short)), testFile:
    (p) => (p === 'packages/core/test/schemas.test.ts' ? <schemas.test.ts.txt text> : undefined) }))`.
  - `lines = out.split('\n')`; each of these finds exactly one line holding every listed part:
    - `'- tier-up: '`, `'BUG-LN-3 review round 4'`, `'asked for sonnet where escalation.fix_round_tier_up asks for opus'`,
      `'C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-aae0cafc466e597f4.jsonl'`;
    - `'- trailer: '`, `'ST-LN-7 task 1'`, `'commit 0496cf0'`, `'Co-Authored-By'`;
    - `'- test-first: '`, `'ST-LN-7 task 4'`,
      `'C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ae0a4407a746836a7.jsonl'`;
    - `'- verify-id: '`, `'ST-LN-7 task 2'`, `'inside describe('`, `'C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3.jsonl'`.
  - The count table holds `| tier-up | 1 |`, and `| trailer |`, `| test-first |`, `| verify-id |` rows.
  - General rules (the criterion's "name no ticket, task or commit"): the text of `scripts/compliance.mjs` holds
    none of `BUG-LN-3`, `ST-LN-7`, `0496cf0`, `ca75fa2`, `aae0caf`, `ae0a440`.

Interface, `scripts/compliance.mjs` (new, pure):
- `export const RULES = ['tier-up', 'trailer', 'test-first', 'verify-id']` (Task 3 appends three).
- `export function compliance({ runs, refusals, commits, tickets, settings, commitInfo, testFile })` returns
  `{ [rule]: string[] }` for every rule, empty arrays included. It first drops every run whose `agent` does not
  start `accord-` or whose `desc` starts `bench r`. A run's label is `<ticket or ?> task <task or ?>`; every line
  ends ` — <file or commit>`.
  - A run's commits: each `commitInfo(short)` of `run.commits` that is defined and whose `at` lies within one
    minute of `[run.start, run.end]`, unique by `sha`.
  - `tier-up`: for each executor run and each ticket in `tickets`, each `## Round <N>` section of its `review`
    holding `fixed in <hex>` where one of the run's commits has a `sha` starting with `<hex>` (lowercase) marks the
    run as that round's fix, once per run and round. When `N >= settings.tierUp`, `expected` is one tier above
    `settings.executorModel` (`haiku` -> `sonnet` -> `opus`, `opus` stays) and `asked` is
    `run.dispatch?.model ?? run.metaModel ?? settings.executorModel`; when they differ:
    `- tier-up: <ticket> review round <N>: the fix executor asked for <asked> where escalation.fix_round_tier_up asks for <expected> — <run.file>`.
  - `trailer`: every commit of every executor run (labelled by its run) and every entry of `commits` (Task 3 fills
    it; labelled from its subject: the first `[A-Z]+(?:-[A-Z]+)?-\d+` and `task (\d+)`), unique by `sha`, the run's
    label winning. Each body line after the subject that matches `/^\s*co-authored-by:/i` or `/generated with/i`:
    `- trailer: <label>: commit <sha 7> carries "<trimmed line>" — commit <sha 7>` plus `, shown in <run.file>`
    for a run's commit.
  - `test-first`: each executor run with a `task` and `fix` false. A test file matches
    `/(^|\/)(test|tests|__tests__)\//` or `/\.(test|spec)\.[cm]?[jt]sx?$/`; a source file is any other path ending
    `.ts .mts .cts .tsx .js .mjs .cjs .jsx`. When the run's first source edit comes before its first test edit, or
    it has a source edit and no test edit:
    `- test-first: <label>: its first edit to a source file (<path>) came before its first edit to a test file — <run.file>`,
    `<path>` relative to `run.dispatch.cwd` (slashes turned) when it starts with it. Shortcut comment: edits made
    through `Bash` are not seen.
  - `verify-id`: each refusal reason matching `^(\S+?)#(\S+) is not in (\S+)$`:
    `- verify-id: <ticket> task <task>: accord task-done refused: <id> is not in <report>` plus
    `; the test sits inside describe('<name>')` when `describeOf(testFile(<path>, ts), <slug>)` names one, then
    ` — <refusal.file>`.
- `export function describeOf(text, slug)`: undefined for undefined text. Find the first line whose
  `it(`/`test(` call (any `.skip`/`.only`/`.skipIf(...)` chain) has a quoted title that, with each whitespace run
  turned into `-`, equals `slug`; scan upward for the nearest `describe(` line indented less than it, and return its
  quoted title. Shortcut comment: indentation stands in for brace depth; a test file formatted differently needs a
  parser.
- `export function render(result)`: `## Compliance`, a blank line, `| rule | count |`, `| --- | ---: |`, one row
  per rule in `RULES` order, zero included; then per rule `### <rule>` and its lines, or `None.`.

Interface, `scripts/benchmark.mjs`:
- `export const benchRoot = (repo) => path.resolve(repo, '..', 'accord-bench')`.
- `export function commitInfo(repo, short)`: `{ sha, at, message }` from the `git show` above with `<short>^{commit}`,
  undefined when git fails.
- `export function testFileAt(repo, file, ms)`: from `git log --all --format=%H %at -- <file>`, the newest commit
  whose author time times 1000 is at most `ms`; `git show <sha>:<file>`; undefined when none or git fails.
- `export function complianceSettings(repo)`: `tierUp` = `escalation.fix_round_tier_up` of `accord/config.yml`
  (parsed with `yaml`), as a number, default 4; `executorModel` = `models.executor.model` there, else the `model:`
  of `.claude/agents/accord-executor.md`'s frontmatter.
- `export function ticketRecords(repo)`: for every directory under `accord/tickets/` holding `review.md`,
  `{ [id]: { review, ledger } }` from the working tree (`ledger` `''` when absent).
- `main`: `--compliance <folder ...>` with no folder writes `--compliance needs the transcript folders to read`
  to stderr and returns 2. Otherwise it builds the input from `readSessions(folders)`, `ticketRecords`,
  `complianceSettings`, `commitInfo` and `testFileAt` bound to the repository, writes `render(...)` to stdout and to
  `<bench root>/compliance.md` (creating the folder), and returns 0.

Must not change: the legacy report and Task 1's test.

## Task 3: The compliance check scores every run against the round cap, reassignment, brief and trailer rules
covers: @ac-5, D-06
files: scripts/compliance.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-compliance.test.ts (new)
verify: packages/core/test/benchmark-compliance.test.ts#ac-5-the-compliance-check-scores-every-run-against-the-other-rules (@ac-5)

Consumes: Task 2's `compliance`, `render` and `--compliance`. Produces: the rules `round-cap`, `reassigned`,
`brief-quote`, the branch commits for `trailer`, and `ticketAt`, which Task 6 also uses.

Test first, appended to `packages/core/test/benchmark-compliance.test.ts`:
- `it('ac-5 the compliance check scores every run against the other rules')`:
  - Git, in a temporary repository (`git init -q`, `git checkout -q -b main`): commit `accord/tickets/T-1.md`
    holding `TICKET_A` (`'---\nid: "T-1"\n---\n\n## Intent\nfirst\n'`) dated `2026-01-01T00:00:00Z` with the
    message `'T-1: a\n'`; then
    `git checkout -q -b t/T-1`, rewrite it to `TICKET_B` (`first` becomes `second`) and commit it dated
    `2026-01-02T00:00:00Z` with the message `'T-1 task 1: b\n\nCo-Authored-By: X <x@example.com>\n'`; then
    `git checkout -q main` and commit a file `n.txt` dated `2026-01-03T00:00:00Z` with the message
    `'T-2 task 3: n\n\nGenerated with a tool\n'`.
    - `ticketAt(repo, 'T-1', Date.parse('2026-01-01T12:00:00Z'))` is `TICKET_A`; at `2026-01-02T12:00:00Z` it is
      `TICKET_B`; at `2025-12-31T00:00:00Z` it is undefined.
    - `branchCommits(repo)` holds both commits (`sha`, `at`, `message`) and no commit twice.
  - `runs`, each `{ agent: 'accord-executor', desc, ticket, task, fix: false, commits: [], edits: [], reads: [],
    sends: [], handbacks: [], file }` plus what each case sets:
    - `r1` (`T-1`, task 1): `dispatch.ts` `2026-01-01T12:00:00Z`, `dispatch.prompt`
      `'Brief: C:/s/b1.md'`, `reads: [{ path: 'C:/s/b1.md', text: TICKET_A + '\n---\n\n## Task 1: a\n' }]`: no line.
    - `r2` (`T-1`, task 2): `dispatch.ts` `2026-01-02T12:00:00Z`, the same prompt and read (still
      `TICKET_A`): one `brief-quote` line holding `T-1 task 2`, `line 6` and `first`.
    - `r3` (`T-1`, task 3): handback `DONE` at `t0`, a send at `t0 + 60_000` with summary `'one more fix'`: one
      `reassigned` line holding `T-1 task 3` and `one more fix`.
    - `r4`: handback `NEEDS_CONTEXT` then a send after it; `r5`: a send with no handback before it; `r6`: a run
      whose `desc` is `bench r1 executor-1-low` with a DONE handback and a send after it: no line for any of them.
  - `tickets`: `A` with a review holding `## Round 1` to `## Round 6` and a ledger with no Ruling about the cap;
    `B` the same with the ledger line `- Ruling: review past the cap: one more round — owner: "ok" — none`; `C` with
    five rounds. One `round-cap` line, holding `A review` and `round 6`.
  - `out = render(compliance({ runs, refusals: [], commits: branchCommits(repo), tickets, settings: { tierUp: 4,
    executorModel: 'sonnet' }, commitInfo: () => undefined, testFile: () => undefined, ticketAt: (id, ms) =>
    ticketAt(repo, id, ms) }))`. The `trailer` section has two lines: one holding `T-1 task 1` and
    `Co-Authored-By`, one holding `T-2 task 3` and `Generated with`.
  - Counts: the table holds exactly the rows `| tier-up | 0 |`, `| trailer | 2 |`, `| test-first | 0 |`,
    `| verify-id | 0 |`, `| round-cap | 1 |`, `| reassigned | 1 |`, `| brief-quote | 1 |`, in that order.

Interface, `scripts/compliance.mjs`:
- `RULES` gains `'round-cap'`, `'reassigned'`, `'brief-quote'`, in that order; `compliance` takes `ticketAt` too.
- `round-cap`: for each ticket whose `review` has a `## Round <N>` with `N >= 6` (the largest N) and whose `ledger`
  has no line starting `- Ruling:` that matches `/(past|beyond|over) the (round )?cap|round cap/i`:
  `- round-cap: <id> review: reached round <N> with no Ruling that allows going past the round cap — accord/tickets/<id>/review.md`.
- `reassigned`: for each executor run, each send whose latest handback before it starts `DONE` (a send after a
  `BLOCKED` or `NEEDS_CONTEXT` handback, or before any handback, is a clarifying reply):
  `- reassigned: <label>: got another assignment through SendMessage ("<summary>") after it reported DONE, instead of a fresh agent — <run.file>`.
- `brief-quote`: for each executor run with a dispatch, the texts are its prompt and every read whose `path`, with
  slashes turned, appears in the prompt and does not end with `accord/tickets/<ticket>.md`. For each text,
  `quoteProblem(text, run.ticket, ticketAt(run.ticket, run.dispatch.ts))`; a problem gives
  `- brief-quote: <label>: the brief's copy of the ticket differs from accord/tickets/<ticket>.md as committed when it was dispatched, first at line <k>: "<brief line>" — <run.file>`,
  or `...: no committed accord/tickets/<ticket>.md existed when it was dispatched — <run.file>`.
- `export function quoteProblem(text, id, committed)`: strip a BOM and turn CRLF into LF in both. The brief quotes
  the ticket when a line matches `^id:\s*"?<id>"?(\s|#|$)`: the quote starts at the nearest `---` line above it,
  and the committed text is compared from its first line. Else when a line is exactly `## Intent`: the quote starts
  there and the committed text is compared from its own `## Intent` line. Neither: undefined. The committed text,
  trailing newlines dropped, must be a prefix of the brief from the quote's start; otherwise return
  `{ line: k, text }`, the first differing line (1-based within the quote). An undefined `committed` with a quote
  returns `{ missing: true }`.

Interface, `scripts/benchmark.mjs`:
- `export function defaultRef(repo)`: the first of `refs/remotes/origin/HEAD`, `refs/remotes/origin/main`,
  `refs/heads/main`, `refs/heads/master` that `git rev-parse --verify -q` resolves.
- `export function ticketAt(repo, id, ms)`: the refs among `refs/heads/t/<id>`, `refs/remotes/origin/t/<id>` and
  `defaultRef(repo)` that resolve; `git log --format=%H %at <refs> -- accord/tickets/<id>.md`; the newest commit
  whose author time times 1000 is at most `ms`; `git show <sha>:accord/tickets/<id>.md`; undefined otherwise.
- `export function branchCommits(repo)`: `git for-each-ref --format=%(refname) refs/heads/main refs/heads/t
  refs/remotes/origin/main refs/remotes/origin/t`, then one `git log --format=%H%x1f%at%x1f%B%x1e <refs> --`,
  parsed into `{ sha, at, message }`, unique by sha; no ref gives `[]`.
- `ticketRecords(repo)` also reads, for every `refs/heads/t/<id>` and `refs/remotes/origin/t/<id>`,
  `accord/tickets/<id>/review.md` and `ledger.md` through `git show <ref>:<path>`; a ticket branch's copy wins
  over the working tree's.
- `--compliance` passes `commits: branchCommits(repo)` and `ticketAt` bound to the repository.

Must not change: Task 2's rules, lines and test; the legacy report.

## Task 4: The committed sample list and the run matrix: current effort and one step either side, with each differing turn flagged
covers: @ac-1, D-01, D-02, D-04, D-07
files: scripts/round.mjs (new), scripts/benchmark.mjs, scripts/benchmark-samples.json (new), packages/core/test/benchmark-round.test.ts (new)
verify: packages/core/test/benchmark-round.test.ts#ac-1-every-agent-sample-runs-at-its-current-effort-and-one-step-either-side-and-each-differing-turn-is-flagged (@ac-1)

Consumes: `readSessions` (Task 1). Produces: `scripts/round.mjs` and the sample list Tasks 6 to 9 read.

The sample list, `scripts/benchmark-samples.json`, composed by hand from the transcripts under
`<projects root>/C--Work-accord*/`. Find candidates from the `.meta.json` files and the dispatch lines with
`node` one-liners or a scratchpad script (never committed); do not read whole transcripts into context.
- Shape: `{ "round": 1, "samples": [ { "agent", "n", "transcript", "ticket", "task", "kind", "base", "main",
  "files": [...], "pairs": [...] } ] }`. `transcript` is the run's file name (Definitions); `n` is 1 to 5 per agent;
  `task` and `kind` (`"plain"` or `"risk"`) only on executor samples; `base` and `main` are full lowercase shas.
- Per agent (the nine of the Definitions; never `accord-debugger`, ledger Ruling): 5 finished runs (a handback or a
  final text), dispatched on or after 2026-10-12, newest first, on 5 different tickets where 5 exist, never a run
  whose `desc` starts `bench r`.
- Executor samples are build runs (a `task` and no `fix`), at least two `plain` and at least two `risk` (D-04):
  `risk` when that task's `verify:` line in `accord/tickets/<ticket>/plan.md` at `base` names a `risk:<kind>`.
- `base`: the commit the run started from: for an executor, the parent of its first commit (Task 1's `commits`);
  otherwise the newest commit, by author time at or before the dispatch, on the branch the dispatch line's
  `gitBranch` names (for a rewritten branch, the matching commit of its rewrite). `main`:
  `git rev-list -1 --first-parent --before=<dispatch time> refs/heads/main`.
- `files`: one entry per file the dispatch prompt names outside the dispatch's `cwd`, with `"path"` exactly as the
  prompt writes it and `"from"` one of: `"copy"` (the file still exists and its modification time is before the
  dispatch), `"git"` (with `"commit"` and `"file"`, a repository path), `"brief"` (with `"task"`: rebuilt by
  `accord brief` at `base`), `"review-package"` (with `"base"`: rebuilt by `accord review-package <ticket> --base
  <base>` at the sample's `base`). Every path the prompt names inside `cwd` must exist at `base`
  (`git cat-file -e <base>:<path>`); a sample that fails this is replaced by the next candidate.
- `pairs`: `[from, to]` for every ref the prompt names in a backticked span or after `--base `: `main` and
  `origin/main` become `main`, `t/<id>` and `HEAD` become `base`.

Test first, in `packages/core/test/benchmark-round.test.ts` (new):
- `it('ac-1 every agent sample runs at its current effort and one step either side and each differing turn is flagged')`:
  - `list` is `scripts/benchmark-samples.json` parsed; `checkSamples(list)` equals `[]`.
  - `settings = agentSettings(root)`; `rows = runMatrix(list, settings)`; `rows.length` is 130.
  - For every sample: its rows all carry `settings[agent].model`; their efforts equal, in order,
    `EFFORTS.slice(max(0, i - 1), i + 2)` with `i = EFFORTS.indexOf(settings[agent].effort)`; for `accord-scout`
    they equal `['low', 'medium']`; exactly one row per sample has `current: true`, at the current effort.
  - Executor samples: at least two with `kind` `plain` and at least two `risk`. A copy of the list with every
    executor sample set to `plain` makes `checkSamples` return a problem containing `risk`; a copy without the
    `accord-scout` samples, one containing `accord-scout`; a copy with an `accord-debugger` sample added, one
    containing `accord-debugger`.
  - Turns: under a temporary `<tmp>/C--Work-y/`, a session `S.jsonl` and one run `agent-r1` with meta
    `description: 'bench r1 executor-1-low'`, four assistant messages: one matching (`claude-sonnet-5-5`,
    `claude-sonnet-5-5`, `low`), one with `perTurnEffort: 'medium'`, one with `model: 'claude-opus-5-5'`, one with
    `requestedModel: 'claude-haiku-4-5'`; and a run `agent-r2` (`bench r1 executor-2-low`) whose two messages all
    match. With `run1`, `run2` from `readSessions`: `turnFlags(run1.turns, { model: 'sonnet', effort: 'low' })` has 3
    entries, fields `perTurnEffort`, `message.model`, `requestedModel`, turns 2, 3 and 4;
    `turnFlags(run2.turns, ...)` is `[]`. `flagSection([{ tag: 'executor-1-low', flags: f1 }, { tag:
    'executor-2-low', flags: [] }])` contains `Turns that differ from the dispatched setting: 3` and
    `- executor-1-low turn 2: perTurnEffort is medium where the round dispatched low`; with only the second entry it
    contains `Turns that differ from the dispatched setting: 0`.

Interface, `scripts/round.mjs` (new, pure):
- `export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']`; `export const ROLES` maps the nine agents
  to `'executor' | 'planner' | 'finding' | 'fact'` (Definitions); `export const WRITERS = ['accord-executor',
  'accord-planner', 'accord-verifier']`; `export const JUDGE = { model: 'opus', effort: 'high' }`.
- `export function steps(effort)`: the current effort with the one below and the one above that exist, in scale
  order.
- `export const tagOf = (agent, n, effort) => agent.slice('accord-'.length) + '-' + n + '-' + effort`;
  `export const describe = (tag) => 'bench r1 ' + tag`; `export const judgeDescribe = (tag) => describe(tag) + ' judge'`.
- `export function checkSamples(list)`: problem strings for: `round` not 1; an agent outside `ROLES`
  (`accord-debugger` included); an agent of `ROLES` without samples `n` 1 to 5 exactly once each; a sample without
  a `transcript` ending `.jsonl` and holding `/subagents/agent-`, a `ticket` matching `^[A-Z]+(?:-[A-Z]+)?-\d+$`,
  a 40-hex `base` and `main`, `files` and `pairs` arrays, each file's `from` with its own fields; an executor
  sample without a digit `task` or with `kind` not `plain` or `risk`; fewer than two `plain` or two `risk`
  executor samples (the problem names `plain` or `risk`).
- `export function runMatrix(list, settings)`: per sample in list order, per effort of
  `steps(settings[agent].effort)`: `{ tag, agent, n, ticket, model: settings[agent].model, effort, current,
  judge }`. `judge` is null for a finding-role current run (it is the reference), else
  `{ agent: agent === 'accord-executor' ? 'accord-reviewer' : 'accord-critic', ...JUDGE }`.
- `export function turnFlags(turns, { model, effort })`: for each turn (1-based `turn`), one entry per field
  that differs: `message.model` and `requestedModel` match when equal to the alias or when the value split on `-`
  holds it; `perTurnEffort` matches when equal. An absent value differs and is shown as `absent`.
  Entries `{ turn, field, got, want }`.
- `export function flagSection(entries)`: `## Model and effort per turn`, a blank line,
  `Turns that differ from the dispatched setting: <total>`, then per entry and flag
  `- <tag> turn <turn>: <field> is <got> where the round dispatched <want>`.

Interface, `scripts/benchmark.mjs`: `export function agentSettings(repo)`: for each agent of `ROLES`, the
`model` and `effort` of the frontmatter of `.claude/agents/<agent>.md`, parsed with `yaml`.

Must not change: the legacy report; Tasks 1 to 3 and their tests.

## Task 5: A brief keeps the ticket text byte for byte while its root and refs are rewritten
covers: D-01
files: scripts/round.mjs (new), packages/core/test/benchmark-round.test.ts (new)
verify: packages/core/test/benchmark-round.test.ts#risk:parsing-a-brief-keeps-the-ticket-text-byte-for-byte-while-its-root-and-refs-are-rewritten

Consumes: `quoteProblem` (Task 3). Produces: `rewriteBrief` and `dispatchTable`, which Task 6 uses.

Test first, appended to `packages/core/test/benchmark-round.test.ts`:
- `it('risk:parsing a brief keeps the ticket text byte for byte while its root and refs are rewritten')`:
  - `ticket = '---\nid: "T-1"\n---\n\n## Intent\nRun in C:/Work/accord on `main` and `t/T-1`.\n'`;
    `prompt = 'Repository root: C:/Work/accord\n' + ticket + '\n---\n\nRun `git diff origin/main...HEAD` in C:\\Work\\accord\n'`;
    `S` = `'a'.repeat(40)`.
  - `r = rewriteBrief(prompt, { ticket, root: 'C:\\Work\\accord', to: 'C:\\Work\\accord-bench\\wt\\x', pairs:
    [['origin/main', S], ['HEAD', S]], checkRefs: true })`: `r.problems` is `[]`; `r.text` starts
    `'Repository root: C:/Work/accord-bench/wt/x\n'`; `r.text.indexOf(ticket)` equals
    `'Repository root: C:/Work/accord-bench/wt/x\n'.length` (the ticket, with its own root path and refs, is
    unchanged); `r.text` ends `` 'Run `git diff ' + S + '...' + S + '` in C:\\Work\\accord-bench\\wt\\x\n' ``.
  - With `pairs: []`: `r.problems` has one entry naming `origin/main`.
  - With the ticket changed by one character inside the prompt: `r.problems` has one entry containing
    `does not hold the ticket at base byte for byte`.
  - `stripReadPrefixes('     1\tone\n     2\ttwo\n<system-reminder>\nx\n')` is `'one\ntwo'`.
  - `dispatchTable([{ tag: 'executor-1-low', agent: 'accord-executor', model: 'sonnet', effort: 'low', prompt:
    'C:/b/x.md', judge: { agent: 'accord-reviewer', model: 'opus', effort: 'high' } }])` holds the header
    `| description | subagent_type | model | effort | prompt file | judge |` and the row
    `| bench r1 executor-1-low | accord-executor | sonnet | low | C:/b/x.md | accord-reviewer opus high |`.

Interface, `scripts/round.mjs`:
- `export function rewriteBrief(text, { ticket, root, to, pairs, checkRefs })` returns `{ text, problems }`. When
  `text` holds `ticket` byte for byte, only the parts before and after its first occurrence are rewritten; when it
  does not and `quoteProblem(text, <ticket's id>, ticket)` (the id read from the ticket's `id:` line) finds a quote,
  the problem `the brief does not hold the ticket at base byte for byte` is returned and the text is left as it is.
  Rewriting replaces `root` written with `\` by `to` with `\`, and `root` written with `/` by `to` with `/`, then
  each `[from, to]` of `pairs`, all as literal text (`replaceAll`). With `checkRefs`, each backticked span or
  `--base <word>` in the rewritten parts that still names `main`, `master`, `origin/<anything>`,
  `t/<ticket id>` or `HEAD` as a whole word gives the problem `ref <span> is not pinned to a sha`.
- `export function stripReadPrefixes(text)`: the Read-result rule of Task 1 (`reads`), shared by both.
- `export function dispatchTable(rows)`: the header above, `| --- | --- | --- | --- | --- | --- |`, then per row
  `describe(tag)`, `agent`, `model`, `effort`, `prompt`, and `<judge.agent> <judge.model> <judge.effort>` or `-`.

Must not change: Task 4's exports and test.

## Task 6: --plan prepares every run's worktree and brief, and --clean removes only the round's marked worktrees
covers: D-01, D-02
files: scripts/benchmark.mjs, packages/core/test/benchmark-worktree.test.ts (new)
verify: packages/core/test/benchmark-worktree.test.ts#risk:data-loss-clean-removes-only-the-worktrees-the-round-marked

Consumes: `readSessions`, `ticketAt`, `defaultRef`, `benchRoot`, `agentSettings`, `checkSamples`, `runMatrix`,
`rewriteBrief`, `stripReadPrefixes`, `dispatchTable`, the sample list. Produces: `<bench root>/round-1.json`, the
worktrees, `briefs/<tag>.md` and `files/<tag>/`, which Task 9 reads.

Test first, in `packages/core/test/benchmark-worktree.test.ts` (new):
- `it('risk:data-loss clean removes only the worktrees the round marked')`: a temporary repository with one commit
  (`H` its sha) and a file `keep.txt` left uncommitted in the main checkout.
  - `addWorktree(repo, { path: A, base: H, branch: 'bench/executor-1-low' })` and `addWorktree(repo, { path: B,
    base: H })` (detached) each return `{ path, base, branch }`; both folders exist.
  - Unmarked: `git worktree add -q -b other <C> H`, then write `C/wip.txt`.
  - A failed add: `D` is a folder holding `d.txt`; `addWorktree(repo, { path: D, base: H, branch: 'bench/x-1-low' })`
    throws, and `D` still holds only `d.txt`.
  - `cleanWorktrees(repo)` returns `removed` holding `A` and `B` (slashes turned) and `failed` `[]`. Then `A` and `B`
    do not exist; `git branch --list bench/*` prints nothing; `C/wip.txt`, `D/d.txt` and `repo/keep.txt` exist;
    the branch `other` exists; `git worktree list --porcelain` names the main checkout and `C` only.

Interface, `scripts/benchmark.mjs`:
- `export function addWorktree(repo, { path, base, branch })`: `git worktree add -q [-b <branch>] <path> <base>`
  (`--detach` when no branch). Only after it succeeds: write the file `accord-bench` (content: the path) into
  `git -C <path> rev-parse --absolute-git-dir`, and return the record. A failure throws with git's message.
- `export function cleanWorktrees(repo)`: from `git worktree list --porcelain`, skipping the first entry (the main
  checkout) always: each worktree whose absolute git dir holds `accord-bench` is removed with
  `git worktree remove --force <path>`, and its branch, when it starts `refs/heads/bench/`, is deleted with
  `git branch -D`. Every other worktree is left untouched. Then `git worktree prune`. Returns `{ removed, failed }`;
  each failure keeps the path and git's message.
- `main`, `--clean`: prints each removed path, and each failure with the undo of the approach's Windows risk (stop
  the `node` processes, `git worktree remove --force <path>`, `git worktree prune`, delete the folder); returns 1
  when any failed, else 0.
- `main`, `--round 1 --plan [folder ...]` (`--round` with any value but `1` returns 2 with the usage line):
  1. `<bench root>/compliance.md` missing: stderr `run --compliance first: the round adds commits`, return 2.
  2. The sample list, `checkSamples` problems: each to stderr, return 2. `rows = runMatrix(list,
     agentSettings(repo))`.
  3. Per sample, its run is read from `<projects root>/<transcript>` (`readSessions` on that folder, matched by
     the file name); no run or no dispatch: return 2 naming the sample. The ticket at base is
     `git show <base>:accord/tickets/<ticket>.md`.
  4. Worktrees under `<bench root>/wt/`: a writing agent's row gets `<tag>` on branch `bench/<tag>`; a read-only
     agent's sample gets one detached `<role>-<n>` shared by its rows. A path already in `round-1.json` is reused;
     otherwise `addWorktree`, and the record is written to `round-1.json` right after it returns.
  5. In each new worktree, run every command of `setup:` in its own `accord/config.yml`, else in this repository's,
     with `execSync(command, { cwd, stdio: ['ignore', 2, 2] })`; a failure returns 2 naming the worktree (it stays
     recorded, so `--clean` removes it).
  6. Executor samples: the task's `verify:` line in `plan.md` at `base` decides `plain` or `risk`; a mismatch with
     `kind` returns 2. The `tests.full` command of the worktree's config runs once, in the sample's current-effort
     worktree, the same way; a non-zero exit returns 2 with `suite red at base for <agent> <n>`.
  7. Files, per row into `<bench root>/files/<tag>/<basename>`: `copy` reads the original (missing, or modified
     after the dispatch: return 2); `git` is `git show <commit>:<file>`; `brief` is
     `node packages/cli/dist/cli.js brief <ticket> <task>` and `review-package` is
     `node packages/cli/dist/cli.js review-package <ticket> --base <base>`, both spawned with `process.execPath` in
     the row's worktree. A `copy` or `brief` file must equal, trailing newlines dropped, the run's `reads` entry
     for that path (compared with slashes turned and case folded); no such read or a difference returns 2 naming
     the path. Each file's text then goes through `rewriteBrief(text, { ticket, root: dispatch.cwd, to: <worktree>,
     pairs, checkRefs: false })`; a problem returns 2.
  8. The prompt: `rewriteBrief(dispatch.prompt, { ticket, root: dispatch.cwd, to: <worktree>, pairs: [...sample
     pairs, ...each file's [original path, new path] in both slash forms], checkRefs: true })`; a problem returns 2;
     written to `<bench root>/briefs/<tag>.md`.
  9. `round-1.json` gains `rows` (each row with its `worktree` and `prompt` path). Print `dispatchTable(rows)` and
     the line `Dispatch every row: description, subagent_type, model and effort as shown, and the prompt file's
     text as the prompt. Judges are printed by --round 1 --judge once these runs finish.` Return 0.

Must not change: Tasks 1 to 5 and their tests; the legacy report. No worktree outside `<bench root>/wt/` is ever
created, and none without the marker is ever removed.

## Task 7: A run holds only when it is no worse than the current effort on the same sample
covers: @ac-2, D-08
files: scripts/round.mjs (new), packages/core/test/benchmark-round.test.ts (new)
verify: packages/core/test/benchmark-round.test.ts#ac-2-a-run-holds-only-when-it-is-no-worse-than-the-current-effort-on-the-same-sample (@ac-2)

Consumes: `ROLES`, `runMatrix` (Task 4). Produces: `mustsOf`, `parseVerdict`, `holds`, `judgeBrief`, used by Task 9.

Test first, appended to `packages/core/test/benchmark-round.test.ts`:
- `it('ac-2 a run holds only when it is no worse than the current effort on the same sample')`:
  - Executor: `holds('accord-executor', { current: false, suite: true, verdict: { must: 1 }, currentVerdict: { must: 1 } })`
    is true; with `suite: false` false; with `verdict: { must: 2 }` false; with `verdict: null` null; the current run
    `holds('accord-executor', { current: true, suite: true })` is true and with `suite: false` false.
  - Planner: the same four cases with `gate` in place of `suite`.
  - Each finding role (`accord-critic`, `accord-reviewer`, `accord-final-reviewer`, `accord-auditor`,
    `accord-verifier`): `{ current: false, verdict: { same: [true, true], newMusts: 0 } }` true;
    `{ same: [true, false] }` false; `{ same: [], newMusts: 3 }` true (a sample whose current run has no reference
    item holds at every effort, D-08); the current run true with no verdict.
  - Each fact role (`accord-architect`, `accord-scout`): `{ wrongFacts: 0 }` true, `{ wrongFacts: 1 }` false, for the
    current run too.
  - `parseVerdict('must', 'findings\n1. Must — x\nMust findings: 1\n', 0)` is `{ must: 1 }`;
    `parseVerdict('match', 'M1: same\nM2: missed\nnew Musts: 1\n', 2)` is `{ same: [true, false], newMusts: 1 }`;
    with `M2` absent it is null; `parseVerdict('fact', 'wrong facts: 0\n', 0)` is `{ wrongFacts: 0 }`; any kind
    with an empty text is null.
  - `mustsOf('accord-critic', '1. Must — a\n2. Should — b\n3. **Must** — c\n')` equals `['1. Must — a', '3. **Must** — c']`;
    `mustsOf('accord-auditor', '@ac-1: one reading\n@ac-2: "x" or "y", split by "each"\n')` equals
    `['@ac-2: "x" or "y", split by "each"']`; `mustsOf('accord-verifier', '', <verification text with @ac-1 pass,
    @ac-2 fail, @ac-3 blocked>)` equals `['@ac-2 fail', '@ac-3 blocked']`.
  - Judges: for `runMatrix(list, agentSettings(root))` on the committed sample list, every row whose `judge` is not
    null has `judge.model` `opus` and `judge.effort` `high`; executor rows' judge is `accord-reviewer`, every other
    judge `accord-critic`; a row has `judge` null exactly when its agent is a finding role and `current` is true.
  - `judgeBrief('match', { agent: 'accord-reviewer', ticket: 't.md', worktree: 'w', base: 'b', reference: ['1. Must — a'],
    report: 'r' })` contains `M1: 1. Must — a`, `` exactly `M<k>: same` or `M<k>: missed` `` and `new Musts: <n>`;
    `judgeBrief('must', ...)` contains `Must findings: <n>`; `judgeBrief('fact', ...)` contains `wrong facts: <n>`.
    The same `match` call with `agent: 'accord-auditor'` and `reference: ['@ac-2: "x" or "y"']` contains
    `M1: @ac-2: "x" or "y"` and `read that criterion two ways too`; with `agent: 'accord-verifier'` and
    `reference: ['@ac-2 fail']` it contains `M1: @ac-2 fail` and `marked that criterion fail or blocked`.

Interface, `scripts/round.mjs`:
- `export function mustsOf(agent, report, verification)`: the reference items of a finding-role run (ledger
  Ruling: the auditor and the verifier report no `Must`, so their closest items stand in): critic, reviewer and
  final reviewer, each line of `report` matching `^\s*\d+\.\s*\**\s*Must\b`, trimmed; auditor, each line starting
  `@ac-<n>:` that does not contain `one reading`, trimmed; verifier, each `## @ac-<n>` block of `verification`
  whose `Result:` line is `fail` or `blocked`, as `@ac-<n> <result>`.
- `export function parseVerdict(kind, text, expected)`: `must`: the last line matching `^Must findings:\s*(\d+)\s*$`
  gives `{ must }`; `match`: for every k from 1 to `expected` a line `^M<k>:\s*(same|missed)\s*$` and a line
  `^new Musts:\s*(\d+)\s*$` give `{ same, newMusts }`; `fact`: a line `^wrong facts:\s*(\d+)\s*$` gives
  `{ wrongFacts }`. Anything missing: null.
- `export function holds(agent, { current, suite, gate, verdict, currentVerdict })`: executor: current, `suite ===
  true`; otherwise null when `verdict` or `currentVerdict` is null, else `suite === true && verdict.must <=
  currentVerdict.must`. Planner: the same with `gate`. Finding role: current, true; otherwise null without a
  verdict, else every entry of `verdict.same` is true. Fact role: null without a verdict, else `wrongFacts === 0`.
  Null means not judged.
- `export function judgeBrief(kind, { agent, ticket, worktree, base, package, plan, report, reference })`, text
  joined with `\n`:
  - `must` with `package` (an executor's result, for `accord-reviewer`): `You judge one benchmark run. Review its
    work as you review any ticket, lens both.`, `Ticket: <ticket>`, `Review package: <package>`,
    `Ledger: <worktree>/accord/tickets/<id>/ledger.md`, `Repository root: <worktree>`, `Report your findings in
    your usual numbered format, then end with one line, exactly \`Must findings: <n>\`, the number of Must findings
    you reported.`
  - `must` with `plan` (for `accord-critic`): `You judge one benchmark run in plan mode: critique the plan as you
    critique any plan.`, `Ticket: <ticket>`, `Plan: <plan>`, `Repository root: <worktree>`, and the same last
    instruction.
  - `match`: `You judge one benchmark run of <agent> against the reference run on the same input.`,
    `Ticket: <ticket>`, `Repository root: <worktree>`, then a heading line, one line `M<k>: <item>` each (or the
    empty line below), and a question line, chosen by `agent` (ac-2, D-08):
    - critic, reviewer, final reviewer: `The reference run reported these Must findings:`, empty `The reference
      run reported no Must finding.`, question `For each M<k>, decide whether the run reported the same issue,
      whatever its wording; read the ticket and the code to decide.`
    - auditor: `The reference run read these criteria two ways:`, empty `The reference run read no criterion two
      ways.`, question `For each M<k>, decide whether the run read that criterion two ways too, whatever its
      wording.`
    - verifier: `The reference run marked these criteria fail or blocked:`, empty `The reference run marked no
      criterion fail or blocked.`, question `For each M<k>, decide whether the run marked that criterion fail or
      blocked in its verification.md.`
    then `Answer one line per item, exactly \`M<k>: same\` or \`M<k>: missed\`, then one line \`new Musts: <n>\`:
    the items of the same kind the run reported that match none of the reference ones.`, then `=== report ===`,
    `report`, `=== end ===`.
  - `fact`: `You judge one benchmark run of <agent>: check every fact its report states against the ticket and the
    code under Repository root, which is at commit <base>.`, `Ticket: <ticket>`, `Repository root: <worktree>`,
    `Answer with one line, exactly \`wrong facts: <n>\`, then each wrong fact with the file and line that
    contradicts it.`, then the report between the same two lines.
  `<id>` is the ticket file's base name without `.md`.

Must not change: Tasks 4 and 5's exports and tests.

## Task 8: The report suggests an effort for each agent and changes no agent definition
covers: @ac-3, D-05, D-08
files: scripts/round.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-round.test.ts (new)
verify: packages/core/test/benchmark-round.test.ts#ac-3-the-report-suggests-an-effort-for-each-agent-and-changes-no-agent-definition (@ac-3)

Consumes: `EFFORTS`, `ROLES`, `steps`, `flagSection` (Task 4) and the result shape Task 9 builds. Produces:
`median`, `suggest`, `better`, `byDefault`, `report` and `writeReport`.

A result is `{ tag, agent, n, effort, current, held, ms, usage: { input, cacheRead, cacheWrite, output, estimated },
verdict, reference }`, `held` true, false or null; `reference` is set only on the current-effort result of a
finding role: the number of reference items `mustsOf` gave for that sample.

Test first, appended to `packages/core/test/benchmark-round.test.ts`:
- `it('ac-3 the report suggests an effort for each agent and changes no agent definition')`:
  - `settings`: executor `sonnet`/`medium`, critic `opus`/`high`, scout `haiku`/`low`. Results, 5 samples each:
    - executor `low`: all held, each `ms: 120_000`, usage `{ input: 100, cacheRead: 200, cacheWrite: 30, output: 40,
      estimated: n === 1 }`; executor `medium`: all held, verdict `{ must: 1 }`; executor `high`: all held, sample 2
      verdict `{ must: 0 }`, the others `{ must: 1 }`.
    - critic `medium`: samples 1 to 4 held, sample 5 not; critic `high`: all held; critic `xhigh`: all held, sample 3
      verdict `{ same: [true], newMusts: 1 }`, the others `newMusts: 0`. The critic `high` results carry
      `reference: 1`, except sample 4, `reference: 0`.
    - scout `low` and `medium`: all held.
    - Every result not given `ms` and `usage` above has `ms: 60_000` and usage `{ input: 1, cacheRead: 1,
      cacheWrite: 1, output: 1, estimated: false }`.
  - `text = report(results, settings, { flags: [], unjudged: [], compliance: '## Compliance\n' })`:
    - holds the row `| accord-executor | low | 5 | 5 | 2.0 | 100 | 200 | 30 | ~40 |` under the header
      `| agent | effort | runs | runs held | median min | median input | median cache read | median cache write | median output |`;
      and `| accord-critic | medium | 5 | 4 |` at the start of the critic medium row.
    - Suggested: `| accord-executor | sonnet | medium | low |`, `| accord-critic | opus | high | high |`,
      `| accord-scout | haiku | low | low |`; the sentence `accord-scout: every effort tried held on all 5 samples;
      nothing below low was measured.` and `accord-executor: every effort tried held on all 5 samples; nothing below
      low was measured.`.
    - Higher did better: `- accord-executor sample 2 (high): the judge found 0 Must findings where the current run had 1`
      and `- accord-critic sample 3 (xhigh): reported 1 Must the current run missed`, and no other line in that
      section.
    - Held by default (D-08): under `## Samples that held at every effort by default`, the line
      `- accord-critic sample 4: the current-effort run reported no Must, so every effort held there by default.`
      and no other line in that section. With every critic `high` result at `reference: 1`, that section holds
      `None.`.
    - holds `Turns that differ from the dispatched setting: 0` and `## Compliance`.
  - With critic `high` sample 1 not held either, `suggest(...)['accord-critic']` is `{ current: 'high', suggested:
    'high', heldAll: ['xhigh'] }`, and `report` holds `accord-critic: held on all 5 samples only at xhigh.`; with
    no critic effort held on all 5, `accord-critic: no effort tried held on all 5 samples.`.
  - `writeReport`: in a temporary root holding `.claude/agents/accord-executor.md` and
    `packages/core/agents/executor.md` (any text), the sorted recursive file listing after `writeReport(root, text)`
    equals the listing before plus `docs/benchmark/round-1.md`; both agent files keep their bytes; the report file
    holds `text`.

Interface, `scripts/round.mjs`:
- `export const median = (xs) => ...`: today's rule (`benchmark.mjs:21`), 0 for none.
- `export function suggest(results, settings)`: per agent of `ROLES` present, `heldAll` = the efforts, in scale
  order, at which 5 results exist and all 5 are held; `lower` = `steps(current)[0]` when it is not `current`;
  `suggested` = `lower` when `heldAll` includes it, else `current` (ac-3).
- `export function better(results)`: per sample of each agent, the result one step above the current effort
  against the current one: finding role, `verdict.newMusts > 0` gives
  `- <agent> sample <n> (<effort>): reported <k> Must the current run missed`; executor or planner, a higher
  `verdict.must` below the current one gives
  `- <agent> sample <n> (<effort>): the judge found <h> Must findings where the current run had <c>`.
- `export function byDefault(results)` (D-08): per finding-role current result with `reference === 0`, in `ROLES`
  order then sample order, `- <agent> sample <n>: the current-effort run <what>, so every effort held there by
  default.`, `<what>` being `reported no Must` for the critic, reviewer and final reviewer, `read no criterion two
  ways` for the auditor, `marked no criterion fail or blocked` for the verifier.
- `export function report(results, settings, { flags, unjudged, compliance })`:
  - `# Round 1 benchmark`, then `Each sample ran on the agent's current model at its current effort and one step
    either side. Suggestions only: this report changes no agent definition.`
  - `## Runs by agent and effort`: the header above, `| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`,
    one row per agent (in `ROLES` order) and effort (scale order): runs, held count, median `ms / 60000` to one
    decimal, then the medians of `input`, `cacheRead`, `cacheWrite`, `output` as integers, the output cell prefixed
    `~` when any result of the row has `estimated`.
  - `## Suggested effort`: `| agent | model | current | suggested |`, `| --- | --- | --- | --- |`, one row each; then
    per agent one sentence: every tried effort in `heldAll`: `<agent>: every effort tried held on all 5 samples;
    nothing below <lowest> was measured.`; `heldAll` empty: `<agent>: no effort tried held on all 5 samples.`;
    otherwise, when `suggested` is not in `heldAll`: `<agent>: held on all 5 samples only at <heldAll joined by
    " and ">.`.
  - `## Higher effort did better`: `better(results)` lines, or `None.`.
  - `## Samples that held at every effort by default`: `byDefault(results)` lines, or `None.`.
  - `flagSection(flags)`; `## Runs not judged`: `- <tag>: <reason>` per entry of `unjudged`, or `None.`; then
    `compliance` as given.

Interface, `scripts/benchmark.mjs`: `export function writeReport(root, text)`: creates `docs/benchmark/` and
writes `docs/benchmark/round-1.md`; returns that path from the root. It writes nothing else.

Must not change: Tasks 4 to 7's exports and tests.

## Task 9: Runs and judges are matched by tag, --judge prints the judges, and the round run writes the report
covers: @ac-2, @ac-3, D-01, D-05, D-08
files: scripts/round.mjs (new), scripts/benchmark.mjs, packages/core/test/benchmark-round.test.ts (new)
verify: packages/core/test/benchmark-round.test.ts#risk:complex-branching-runs-and-judges-are-matched-by-tag-and-every-tag-with-no-run-or-two-runs-is-named

Consumes: everything above; `<bench root>/round-1.json` from Task 6; `<bench root>/compliance.md` from Task 2.
Produces: `--round 1 --judge` and `--round 1`, the commands the verify stage runs for @ac-1 to @ac-3.

Test first, appended to `packages/core/test/benchmark-round.test.ts`:
- `it('risk:complex-branching runs and judges are matched by tag and every tag with no run or two runs is named')`:
  rows `A` (`executor-1-low`, judge set), `B` (`critic-1-high`, current, judge null), `C` (`critic-1-xhigh`, judge
  set). Runs: one with `desc` `bench r1 executor-1-low`, two with `bench r1 critic-1-high`, none for `C`; one
  `bench r1 executor-1-low judge` with no sends; one `bench r1 critic-1-xhigh judge` with one send; one
  `bench r1 critic-1-high judge`.
  - `m = matchRuns(rows, runs, { judges: false })`: `m.missing` equals `['bench r1 critic-1-xhigh']`,
    `m.duplicate` equals `['bench r1 critic-1-high (2 runs)']`, `m.runs.get('executor-1-low')` is the first run.
  - `matchRuns(rows, runs, { judges: true })`: `missing` as above (the judge of `C` exists, so it is not missing),
    `duplicate` as above, `m.judges.get('executor-1-low')` the judge run, `m.notFresh` equals `['critic-1-xhigh']`,
    and the `critic-1-high judge` run (a judge for a row that has none) is listed in `m.extra`.

Interface, `scripts/round.mjs`: `export function matchRuns(rows, runs, { judges })`: runs matched by `desc`
equal to `describe(tag)`, and with `judges`, judge runs by `judgeDescribe(tag)` for rows whose `judge` is set.
`missing`: each description with no run; `duplicate`: `<description> (<count> runs)` for more than one; `notFresh`:
tags whose judge run has any `sends` (a judge resumed by `SendMessage` is not fresh, ac-2); `extra`: judge runs for
rows without a judge. All in row order.

Interface, `scripts/benchmark.mjs`, both modes reading `round-1.json` (missing: return 2 with `run --round 1
--plan first`) and the runs from `readSessions` over the default folders plus the folders given:
- `--round 1 --judge`: `matchRuns(rows, runs, { judges: false })`; any `missing` or `duplicate`: each to stderr
  as `no run or more than one run for: <entry>`, return 2. For each row with a judge, build its brief with
  `judgeBrief`: the ticket is `<worktree>/accord/tickets/<ticket>.md`; an executor row's `package` is the output of
  `node packages/cli/dist/cli.js review-package <ticket> --base <base>` in its worktree, written to
  `files/<tag>/result.md`; a planner row's `plan` is `<worktree>/accord/tickets/<ticket>/plan.md`; a finding row's
  `reference` is `mustsOf(agent, <current run>.lastText, <current worktree>/accord/tickets/<ticket>/verification.md
  text or ''>)` and its `report` the run's `lastText` (for the verifier, followed by its own `verification.md`);
  a fact row's `report` the run's `lastText`. Write `briefs/<tag>-judge.md`; print `dispatchTable` of the judge
  rows (description `judgeDescribe(tag)`, the judge's agent, model, effort and brief) and the line `Dispatch every
  row: a fresh agent each, with the brief file's text as the prompt.` Return 0.
- `--round 1`: `matchRuns(rows, runs, { judges: true })`; any `missing` or `duplicate`: as above, return 2. For
  each executor row, run its worktree's `tests.full` command (as in Task 6) and keep `suite` (exit 0); for each
  planner row, `node packages/cli/dist/cli.js gate plan <ticket>` in its worktree, `gate` (exit 0). Verdicts:
  `parseVerdict(kind, <judge run>.lastText, <reference length>)`, `kind` `must` for executor and planner rows,
  `match` for finding rows, `fact` for fact rows; a judge in `notFresh` gives no verdict. `held` from `holds`, the
  current row's verdict as `currentVerdict`. `unjudged`: each row needing a judge whose verdict is null, with the
  reason `judge verdict unreadable` or `judge was not fresh`. `flags`: `turnFlags` for every run and judge run,
  against the row's `model` and `effort` or the judge's. Results carry the run's `ms` and `usage`; the current
  row of each finding-role sample also carries `reference`, the length of the `mustsOf` list built for it as in
  `--judge` (D-08). Then
  `writeReport(repo, report(results, agentSettings(repo), { flags, unjudged, compliance: <bench root>/compliance.md text> }))`,
  print the path, return 0.

Must not change: Tasks 1 to 8's exports, modes and tests; the legacy report. Neither mode writes outside
`<bench root>/` except `docs/benchmark/round-1.md`.
