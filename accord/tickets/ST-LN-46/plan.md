---
baseline: 2bd987e53d9c77223669a3b50896993e4e0bef09
plan_hash: "fnv1a64:b8cc592fe216cf3e"
---

Review mode `outcome`: one branch, no slices. Every task can be finished from its own section, this preamble, the
ticket and its ledger.

Order: Task 1 is the wiring: a round definition becomes one dispatch row per sample, arm and run, printed by
`--round <name> --plan` from the main checkout's bench root, with worktrees and briefs. Tasks 2 and 3 are the
gathering step, second in build order as the ledger Ruling sets, because the 30-day transcript retention starts
dropping runs about 2026-11-11: Task 2 gathers the runs that name the ticket and ends by running `--gather` on the
done tickets the scout round needs; Task 3 ties lane scouts to their ticket, takes runs named on the command line,
lists untied scouts, runs `--gather` on every done ticket with more than 5 truth files and a tied or untied scout run,
and fixes the sample list of round `r2-scout`. Right after Task 3, before about 2026-11-11, the main session puts
Task 3's untied lists to the owner, runs `node scripts/benchmark.mjs --gather <id> <transcript>` for each run the
owner names, sets `samples` of `r2-scout` again by Task 3's rule, and commits both json files.
Tasks 4 and 5 score a scout run by script (@ac-2). Task 6 is the report (@ac-3). Task 7 matches and caches runs so
none is run twice, and adds the report mode (@ac-4). Task 8 guards `--clean`. Tasks 9 and 10 are the remaining
round 1 measurement fixes (minutes, overlap, judges).

How round 2 is run once every task is done. No task runs it; it happens at verify, and its report is the evidence
for the Intent's Success line (the acceptance criteria are proven by the tests below):
1. The owner gives the price factor of `haiku` and `sonnet` from the price list current that day (D-08); the main
   session writes them into `prices` of round `r2-scout` in `scripts/benchmark-rounds.json`, with that day's date
   in `pricesAt`, and commits. Until then `--plan` exits 2 naming the model with no positive price.
2. `npm run build` (the scorer loads `packages/core/dist/index.js`).
3. `node scripts/benchmark.mjs --round r2-scout --plan`, run in a checkout holding this branch's scripts; the bench
   root is the main checkout's either way. A session whose working folder is the main checkout (ledger Ruling)
   dispatches every printed row: description, subagent_type, model and effort as shown, and the prompt file's text as
   the prompt. With the four round 1 samples that is 4 x 6 x 3 = 72 runs, plus 18 per gathered scout sample.
   `--plan` is run again whenever wanted: it scores every run that finished and lists only rows still without a run.
4. When `--plan` lists no row: `node scripts/benchmark.mjs --round r2-scout` writes
   `docs/benchmark/round-r2-scout.md`; commit it. `--clean` only after that.

Rules for every task:
- Test ids: every test is a top-level `it(...)` with no `describe` around it. Its report id is the test file's path
  from the repository root, `#`, then the `it` title with each whitespace run turned into `-`. No title holds `@`, a
  comma or an apostrophe. No existing test is renamed or edited, except where a task says so.
- Tests import a script as `(await import(new URL('../../../scripts/<name>.mjs', import.meta.url).href)) as { ... }`,
  typing only what they call, and core as `import { parseScoutReport, scoutCheck } from '../src/index.js'`. The
  repository root in a test is `fileURLToPath(new URL('../../../', import.meta.url))`.
- No line of any test file holds the text `process.platform`.
- Temporary folders: `realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')))`, slashes turned to `/` before use,
  removed in a `finally` with `rmSync(dir, { recursive: true, force: true, maxRetries: 5 })`. A test that runs git
  passes `120_000` as the third argument of `it`. A commit or merge in a test writes its message to a file and runs
  `git -c user.name=t -c user.email=t@example.invalid -c commit.gpgsign=false commit -q --no-verify -F <file>
  --cleanup=verbatim` (a merge: `merge --no-ff -q -F <file> --cleanup=verbatim <branch>` with the same `-c` flags); a
  dated commit passes `env: { ...process.env, GIT_AUTHOR_DATE: <iso>, GIT_COMMITTER_DATE: <iso> }`. `git init -q -b
  main`. A test that runs the script as a process uses `spawnSync(process.execPath, [<root>/scripts/benchmark.mjs,
  ...args], { cwd, env, encoding: 'utf8' })` and, when the script reads transcripts, sets `HOME` and `USERPROFILE`
  in `env` to a temporary home so `os.homedir()` points there.
- `scripts/round.mjs` stays pure: it imports only `scripts/compliance.mjs`, reads no file, spawns nothing; callbacks
  such as `read` and core functions such as `scoutCheck` are passed in. Files, git and processes live in
  `scripts/benchmark.mjs`. No dependency is added.
- Every `git` spawn is `execFileSync('git', [...], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio:
  ['ignore', 'pipe', 'pipe'] })` (the `gitIn` helper, scripts/benchmark.mjs:421); every `git log` and `git show`
  passes `-c log.showSignature=false` before the subcommand and `--no-show-signature` after it; paths from git are
  read with `-z`, split on `\0`. Every path printed or stored uses `/`.
- Not touched (D-01): `packages/core/src/skills/agents.ts`, `accord/config.yml`, anything under `.claude/agents/`,
  `packages/core/agents/`, `packages/*/src/`. `scripts/benchmark-samples.json` is not edited.
- Round 1 stays as it is: `--round 1 --samples | --plan | --judge`, `--round 1`, `--compliance`, `--fixed` and their
  output and messages do not change. These stay green unchanged: packages/core/test/benchmark-round.test.ts,
  benchmark-samples.test.ts, benchmark-worktree.test.ts, benchmark-reader.test.ts, benchmark-compliance.test.ts,
  benchmark-fixed.test.ts.
- End every task with `npm run build`, `npm run lint`, `npm run typecheck`, then `npx vitest run` on each test file
  the task names and on the six files above plus `packages/core/test/stage-skills.test.ts`; on Windows set
  `ACCORD_BASH` to Git Bash for the test runs (`accord/product/conventions.md`).

Definitions shared by every task:
- Main checkout of a repository `repo`: `path.dirname(gitIn(repo, ['rev-parse', '--path-format=absolute',
  '--git-common-dir']).trim())`, as scripts/benchmark.mjs:1149 resolves it. Bench root of every named-round mode,
  of `--gather` and of the `--clean` guard: `slashed(benchRoot(<main-checkout>))`; each of those modes prints
  `bench root: <bench-root>` as its first stdout line. Round 1 keeps `benchRoot(repo)`.
- Transcript folders: `transcriptDirs(main, extra)` = `defaultDirs(main)` when `~/.claude/projects` exists, else
  `[]`, then each folder in `extra`, without repeats.
- Round definitions: `scripts/benchmark-rounds.json` of the repository the script runs in, `{ "rounds": { "<name>":
  { agent, arms: [{ model, effort }], runs, judges, prices: { <model>: <factor> }, pricesAt, samples: [<n>] } } }`.
- Short agent name: the agent without `accord-` (`scout`). Arm row: `{ tag, agent, n, ticket, model, effort, k,
  judge }`, with `tag = <short-agent>-<n>-<model>-<effort>-<k>` and description `bench <name> <tag>`. Names start
  with `r`, so compliance keeps leaving these runs out (scripts/compliance.mjs:37).
- Samples of a named round: the entries of `scripts/benchmark-samples.json` and `scripts/benchmark-gathered.json`
  (each optional, both `{ samples: [...] }`) of the repository the script runs in, whose `agent` is the round's
  agent and whose `n` is in its `samples`. Snapshot folder of an entry: `<bench>/<entry.snapshot>` when the entry
  has `snapshot`, else `<bench>/samples/<short-agent>-<n>`; it holds `sample.json` (`{ transcript, prompt, cwd, ts,
  reads }`) and `root-reads.json`, the layout `runPlan` loads (scripts/benchmark.mjs:883-895).
- Named state: `<bench>/round-<name>.json`, `{ worktrees, live, rows, leftOut: { <n>: <reason> }, scores: { <tag>:
  <record> }, judges: { <tag>: [...] } }`. It is read with `JSON.parse` when the file exists, `{}` when it does
  not; a file that does not parse exits 2 `<file> does not parse: <message>; restore it or remove it` and is left as
  it is. Every save writes `<file>.<process.pid>.tmp`, then `fs.renameSync`s it onto the file, as
  packages/cli/src/commands/notice.ts:40-42 does. Worktrees: `<bench>/wt/<name>/<short-agent>-<n>` (key
  `<name>/<short-agent>-<n>`) for a read-only agent, `<bench>/wt/<name>/<tag>` with branch `bench/<name>/<tag>` for
  a writer (`WRITERS`). Briefs: `<bench>/briefs/<name>/<tag>.md`; files: `<bench>/files/<name>/<tag>/`.
- Score record (Tasks 6, 7, 9, 10): `{ tag, n, agent, model, effort, k, transcript, reply, usage: { input,
  cacheRead, cacheWrite, output, estimated }, start, end, ms, flags, values: { <measure-key>: number }, beside: {
  <key>: number }, detail }`. Scout measures, in order: `check` "scout check passes" (higher is better),
  `falseClaims` "false only or none claims" (lower), `recall` "wiring recall" (higher); beside the measures:
  `unsearchable` "prose claims not searched".

## Task 1: Wiring: a round definition prints one row per sample, arm and run from the main checkout's bench root
covers: @ac-1, D-01, D-05
files: scripts/round.mjs, scripts/benchmark.mjs, scripts/benchmark-rounds.json (new), packages/core/test/benchmark-arms.test.ts (new)
verify: packages/core/test/benchmark-arms.test.ts#ac-1-a-round-plan-lists-every-sample-three-times-for-each-model-and-effort-arm-and-a-round-for-another-agent-is-planned-the-same-way (@ac-1), packages/core/test/benchmark-arms.test.ts#risk:parsing-a-round-definition-with-a-bad-name-or-agent-or-arm-or-price-or-run-count-or-sample-list-is-refused, packages/core/test/benchmark-arms.test.ts#risk:complex-branching-a-named-plan-run-from-a-linked-worktree-uses-the-main-checkout-bench-root-and-leaves-out-a-sample-that-fails-a-step

Consumes: scripts/round.mjs and scripts/benchmark.mjs at the baseline. Produces, in round.mjs: `checkRound(name,
def)` (problem strings), `armTag(agent, n, model, effort, k)`, `armMatrix(def, samples)`, and a second parameter
`name = 'r1'` on `describe(tag, name)`, `judgeDescribe(tag, name)` and `dispatchTable(rows, name)`. In
benchmark.mjs: `mainBench(repo)` → `{ main, bench }`, `writeBrief(...)`, `verifierReport(...)`,
`runNamedPlan(repo, name)` and the route `--round <name> --plan`. The data file `scripts/benchmark-rounds.json`.

Tests first, in packages/core/test/benchmark-arms.test.ts (new):
- ac-1: read the committed `scripts/benchmark-rounds.json`; round `r2-scout` has agent `accord-scout`, arms haiku
  low, medium, high then sonnet low, medium, high, and `runs: 3`. `armMatrix({ ...r2, samples: [1, 2, 4] }, three
  scout samples)` gives 54 rows; each sample appears exactly three times per arm with k 1, 2, 3; every row carries its
  arm's model and effort; `dispatchTable(rows.map((r) => ({ ...r, prompt: 'p' })), 'r2-scout')` holds the line
  `| bench r2-scout scout-4-sonnet-high-3 | accord-scout | sonnet | high | p | - |`. Then an executor definition
  (arms sonnet high and opus medium, runs 2, judges 0, prices sonnet 3 and opus 5, pricesAt `2026-11-02`, samples
  [7]): `checkRound('r3-exec', def)` is `[]`, `armMatrix` gives 4 rows tagged `executor-7-sonnet-high-1` ...
  `executor-7-opus-medium-2`, and the table prints them the same way. `describe('scout-1-low')` still returns
  `bench r1 scout-1-low`.
- risk:parsing: `checkRound` returns one problem each for: name `r1`, name `x2`, an agent outside `ROLES` or in
  `RETIRED`, an effort outside `EFFORTS`, a model not matching `^[A-Za-z0-9._-]+$`, the same model and effort twice, a
  model whose price is missing, 0 or not a number, `pricesAt` not `YYYY-MM-DD` (the empty string included), `runs`
  0 or 1.5, `judges` -1, `samples` not a list of distinct whole numbers of at least 1. Messages: `round name <name>
  must match r[a-z0-9-]+ and not be r1`, `agent <a> is not a benchmark agent`, `arm <i>: effort <e> is not one of
  low, medium, high, xhigh, max`, `arm <i>: model <m> is not a model name`, `arm <model> <effort> is listed twice`,
  `model <m> has no positive price in prices`, `pricesAt must be a date YYYY-MM-DD`, `runs must be a whole number of
  at least 1`, `judges must be a whole number of at least 0`, `samples must be a list of distinct whole numbers of
  at least 1` (`<i>` counts from 1).
- risk:complex-branching (a process test): a temp repo `<t>/repo` with a commit B holding `a.txt`,
  `accord/config.yml` (`setup: []`), `accord/tickets/T-1.md`, `scripts/benchmark-samples.json` (`{ round: 1, samples: [...] }` with three
  `accord-scout` entries, n 1, 2, 3, base B, root `<t>/orig`, `elsewhere: [], files: [], pairs: []`, transcripts
  `C--x/S/subagents/agent-<n>.jsonl`; n 1 and 2 have ticket T-1, n 3 has ticket T-9, which does not exist) and
  `scripts/benchmark-rounds.json` with round `r9-test` (accord-scout, arms haiku low and sonnet low, runs 2, judges
  0, prices haiku 1 and sonnet 3, pricesAt `2026-11-02`, samples [1, 2, 3]); after B, branch `t/T-1` changes `a.txt`
  and branch `t/T-9` adds `accord/tickets/T-9.md` and changes `a.txt`, each merged into `main` with subject `Merge
  branch 't/T-1'` or `Merge branch 't/T-9'` (so both tickets have a truth when Task 5 leaves out samples with none); a
  linked worktree `<t>/sub/linked` of the repo at B. Write the fixture builder as a function at the top of the file:
  Task 7 reuses it. Snapshots under `<t>/accord-bench/samples/scout-1/` and `scout-3/`: `sample.json` with the same
  transcript, prompt `Scout <t>/orig for T-1.`, and `root-reads.json` `[]`; none for n 2. Run `--round r9-test
  --plan` with cwd `<t>/sub/linked` (the rounds file also holds a round `r9-none` like `r9-test` but with samples
  [2]): exit 0; first stdout line `bench root: <t>/accord-bench` (not
  `<t>/sub/accord-bench`); a line `left out: accord-scout 2: no snapshot under <t>/accord-bench`; 8 table rows (n 1
  and 3, two arms, two runs); `<t>/accord-bench/briefs/r9-test/scout-1-haiku-low-1.md` holds
  `<t>/accord-bench/wt/r9-test/scout-1` and not `<t>/orig`; the n 3 brief is written although T-9 does not exist
  at B; `<t>/accord-bench/wt/r9-test/scout-1` is a worktree at B; `round-r9-test.json` holds 8 rows and
  `leftOut["2"]`, and no `.tmp` file is left in `<t>/accord-bench`. Then `git worktree remove --force
  <t>/accord-bench/wt/r9-test/scout-1` (in `<t>/repo`) and `--round r9-test --plan` again: exit 0 and
  `<t>/accord-bench/wt/r9-test/scout-1` is a worktree at B again. Then write `{"rows": [` into
  `round-r9-test.json`: `--round r9-test --plan` exits 2 with `does not parse` on stderr and the file still holds
  `{"rows": [`. Then `--round r9-none --plan` exits 2 with `no sample left` on stderr.

Implementation, round.mjs:
- `checkRound(name, def)` with the rules and messages above; `armTag` builds the tag; `armMatrix(def, samples)`
  returns, for each sample in ascending `n`, for each arm in definition order, for k 1 to `runs`: `{ tag, agent,
  n, ticket, model, effort, k, judge: null }`. No `current` field.
- `describe(tag, name = 'r1')` → `'bench ' + name + ' ' + tag`; `judgeDescribe(tag, name = 'r1')`;
  `dispatchTable(rows, name = 'r1')` uses `describe(r.tag, name)`. Calls with one argument give the same text as
  today.

Implementation, benchmark.mjs:
- `mainBench(repo)` as the Definitions say.
- `writeBrief({ repo, bench, row, sample, snap, ticket, briefDir, filesDir, own })`: the body of the loop at
  scripts/benchmark.mjs:953-990 moved into a function, with `ticket` passed in, the brief written to
  `<briefDir>/<tag>.md`, files to `<filesDir>/<basename>`, and `own` the run's branch; it returns `{ prompt }` or
  `{ problem }` with today's texts (`<tag>: <cmd> failed: ...`, the package drift text, `<tag>: <problems joined by
  '; '>`), and prints the same stderr notice. `runPlan` calls it with the ticket text read as at :956 (a missing
  ticket still throws there), `briefDir` `<bench>/briefs`, `filesDir` `<bench>/files/<tag>`, `own` `bench/<tag>`,
  and turns `problem` into the same `err(...)`.
- `verifierReport({ repo, row, reported })`: the body of :938-951 for one row, returning a problem string or null
  with today's texts; `runPlan` calls it per verifier row.
- `runNamedPlan(repo, name)`: (1) `mainBench`; print the bench root line. (2) read the definition; a missing file or
  name exits 2 `no round <name> in scripts/benchmark-rounds.json`; `checkRound` problems exit 2, one per line. (3)
  load the samples; an `n` in `samples` with no entry is left out `no sample <n>`. (4) per sample, left out with
  the first reason that holds: a gathered entry with `replay.ok === false` (`replay: <problems joined by '; '>`); no
  `sample.json` in its snapshot folder (`no snapshot under <bench>`); no `root-reads.json` (`no stored root reads
  in <folder>`); the snapshot's transcript tail differs (the round 1 text of :888); `sampleDrift` problems (joined).
  (5) state: read and saved as the Definitions say; `worktrees ??= {}`, `live ??= liveState(main)`, `leftOut = {}`. (6) rows =
  `armMatrix(def, kept samples)`. (7) per kept sample, one `try` around its worktree (a recorded worktree whose folder
  no longer exists, as after `--clean --force`, first goes through `removeWorktree(main, rec)`, which prunes it,
  deletes a writer branch still at its base and refuses one holding commits, and its record is deleted, so the next
  call builds it again at base; then `prepareWorktree(main, state, key, spec, setup, save)` as :906-926 builds
  `spec`, with the named paths and branches of the Definitions), then
  `verifierReport` for verifier rows, then `writeBrief` for each of its rows with `ticket` = `showAt(main, base,
  accord/tickets/<ticket>.md) ?? ''`; a thrown error or a problem leaves the sample out with its message (plus
  `planHint(e)` for a thrown one), prints `left out: <agent> <n>: <reason>` and drops its rows. (8) every reason
  goes into `state.leftOut`; no sample left → exit 2 `no sample left`. (9) `state.rows = rows` (with `worktree`,
  `prepared`, `prompt`), save, print `dispatchTable(rows, name)` and the line `Dispatch every row: description,
  subagent_type, model and effort as shown, and the prompt file's text as the prompt.` Exit 0. Named rounds do not require `compliance.md`.
- `main`: `--round <x> --plan` with `<x>` other than `1` calls `runNamedPlan(process.cwd(), x)`; the usage line
  gains `| --round <name> --plan`.

Data: `scripts/benchmark-rounds.json` (new) holds round `r2-scout`: agent `accord-scout`, the six arms in the order
above, `runs: 3` (D-05), `judges: 0` (ledger Ruling), `prices: {}`, `pricesAt: ""` (D-08: set from the price list
current when the round runs, step 1 of the preamble; `--plan` refuses until then), `samples: [1, 2, 3, 4, 5]`.

Must not change: everything round 1 prints and stores; `tagOf`; `rewriteBrief` (an empty ticket already rewrites the
whole text, scripts/round.mjs:170).

## Task 2: Gather the runs of a done ticket as snapshotted samples, then gather the tickets round 2 needs
covers: @ac-5, D-01, D-03
files: scripts/benchmark.mjs, scripts/benchmark-gathered.json (new), packages/core/test/benchmark-gather.test.ts (new)
verify: packages/core/test/benchmark-gather.test.ts#ac-5-a-done-ticket-gathered-twice-gives-one-snapshotted-sample-per-accord-agent-run-and-the-second-run-adds-and-overwrites-nothing (@ac-5), packages/core/test/benchmark-gather.test.ts#risk:data-loss-gather-copies-the-runs-before-it-refuses-a-ticket-that-is-not-done-and-never-overwrites-a-snapshot-file

Consumes: `mainBench` (Task 1), `readSessions`, `rootReads`, `sampleDrift`, `showAt`, `existsAt`, `defaultRef`,
`transcriptTail`, `rewriteBrief`. Produces, exported from benchmark.mjs: `transcriptDirs(main, extra)`,
`ticketMerges(repo, id)`, `truthOf(repo, id, base)`, `ticketDone(repo, id)`, `ticketRuns(runs, id)`,
`runGather(repo, id, named)`, the route `--gather <id> [<transcript> ...]`, and a `branch` field on each run
`parseRun` returns (the first `gitBranch`, as it reads at :227).

Tests first, in packages/core/test/benchmark-gather.test.ts (new), on one fixture builder at the top of the file:
- Repo `<t>/repo`: commit 1 at 2026-10-01T00:00:00Z holds `a.txt` `a1`, `b.txt` `b1`, `accord/tickets/T-1.md`
  (`---\nid: "T-1"\nverified_hash: ""\n---\n`) and `scripts/benchmark-samples.json` (`{ round: 1, samples: [...] }`
  with one `accord-scout` entry, n 1, ticket T-1, whose transcript is x5's below, as round 1 lists its own runs); branch `t/T-1` at 02:00 changes `a.txt` and `b.txt`, adds `c.txt`
  and sets `verified_hash: "fnv1a64:1"`; `main` merges it at 03:00 with subject `Merge branch 't/T-1'`.
- Home `<t>/home`; transcript folder `<t>/home/.claude/projects/<main checkout with : \ / turned to ->/`. Session
  `S1.jsonl`: an assistant line at 01:00 with cwd `<t>/repo` and five `Agent` tool uses: `toolu_A` (description `Scout
  for T-1`, subagent_type `accord-scout`, prompt `Find the files for T-1 in <t>/repo.`), `toolu_B` (`Critique T-1
  plan`, `accord-critic`, prompt `Critique the plan of T-1.`), `toolu_C` (`bench r2-x scout-1-haiku-low-1`, `accord-scout`), `toolu_D` (`Explore T-1`,
  `general-purpose`), `toolu_E` (`Scout for T-1`, `accord-scout`). Subagents `agent-x1` to `agent-x5` with those
  `toolUseId`s and agent types; x1 has `gitBranch` `t/T-1`, a `Read` of `<t>/repo/a.txt` answered `     1\ta1`, a
  `Bash` answered `Output too large (3KB). Full output saved to: <P>\n\nPreview (first 2KB):\nx`, where `<P>` is
  `<transcript-folder>/S1/tool-results/toolu_R.txt` with every `/` written `\` as Claude Code writes it on Windows
  (that file exists and holds `full output\n`), and a `SubagentHandback`; the others hand back a line. x5 is round
  1's own sample, so it is never gathered. Build transcript lines the way packages/core/test/benchmark-reader.test.ts:19-49 does.
- ac-5: run `--gather T-1` (cwd `<t>/repo`, temp home): exit 0; first line `bench root: <t>/accord-bench`;
  `<t>/accord-bench/samples/gathered/T-1/scout-x1/` and `critic-x2/` exist, nothing for x3, x4 or x5; `transcript.jsonl`
  and `meta.json` equal the source files byte for byte; `prompt.md` is the dispatch prompt; `reads.json` holds the
  read of `a.txt`; `scout-x1/tool-results/toolu_R.txt` holds `full output\n`; no file under the bench root ends in
  `.tmp`; `scripts/benchmark-gathered.json` holds two entries, the scout one `{ agent: 'accord-scout', n: 2,
  ticket: 'T-1', base: <commit-1>, ticketAtBase: true, truth: ['a.txt', 'accord/tickets/T-1.md', 'b.txt'], replay: {
  ok: true, problems: [] } }` (with `transcript`, `main`, `root`, `elsewhere`, `files`, `pairs`, `snapshot`; `c.txt`
  is new, so not in the truth; the ticket file is, as the ledger Ruling excludes nothing). Run it again: exit 0, the
  json is byte-identical, and every file under the bench root keeps its content and `mtimeMs`.
- risk:data-loss: the same fixture before the branch and merge exist: `--gather T-1` exits 2, stderr names `T-1 is
  not done`, the six files of `scout-x1/` and `scout-x1/tool-results/toolu_R.txt` exist with the transcript
  byte-equal, no json is written. Write `kept\n` into `scout-x1/prompt.md`, cut `scout-x1/transcript.jsonl` to its
  first line (a partial copy), then add the branch and merge: `--gather T-1` exits 0, adds the entries, `prompt.md`
  is still `kept\n`, `transcript.jsonl` still holds the one line, `scout-x1/transcript-<source-mtime-ms>.jsonl` (the
  source file's `mtimeMs`, rounded down) equals the source byte for byte, and stdout holds `snapshot
  <t>/accord-bench/samples/gathered/T-1/scout-x1/transcript.jsonl differs from its source; the source is kept beside
  it as transcript-<source-mtime-ms>.jsonl`. Then remove the folder `critic-x2/` and run `--gather T-1` again: exit 0,
  `critic-x2/` holds its six files again with `transcript.jsonl` byte-equal to its source, and
  `scripts/benchmark-gathered.json` is byte-identical.

Implementation:
- `ticketMerges(repo, id)`: `git log --first-parent --merges --format=%H%x1f%P%x1f%ct%x1f%s%x1e <defaultRef>`; keep
  merges whose subject matches `(?<![\w-])t/<escaped-id>(?![\w-])`; each `{ merge, base: <merge-base of its two
  parents>, tip: <second-parent>, at }`, oldest first.
- `truthOf(repo, id, base)`: null with no merge; else the union over merges of `git diff --no-renames
  --diff-filter=MD --name-only -z <merge-base> <tip>`, kept where present in `git ls-tree -r -z --name-only <base>`,
  sorted (D-03; ledger Ruling: nothing else excluded).
- `ticketDone(repo, id)`: `accord/tickets/<id>.md` at `defaultRef` has frontmatter `verified_hash` that is a
  non-empty string (parse with the `frontmatter` helper, :1232).
- `ticketRuns(runs, id)`: runs whose agent starts `accord-`, whose description does not start `bench `, and whose
  description or `branch` matches `(?<![\w-])<escaped-id>(?![\w-])`; each returned as `{ run, tie: 'id' }`.
- `runGather(repo, id, named)`: (1) `mainBench`, print the bench root line. (2) `readSessions(transcriptDirs(main,
  []))`; the gathered list `<repo>/scripts/benchmark-gathered.json` (`{ samples: [] }` when missing); drop runs whose
  `transcriptTail` is listed in `<repo>/scripts/benchmark-samples.json` (round 1's own runs, already samples); runs
  whose `transcriptTail` is in the gathered list go through step (3) into their entry's `snapshot` folder, which
  only fills files that are missing, and get no new entry. (3) for each remaining run, by start then file: folder
  `<bench>/samples/gathered/<id>/<short-agent>-<run-id>`; copy the subagent `.jsonl` and `.meta.json` (located by
  the folder name of `run.file` among the dirs) to `transcript.jsonl` and `meta.json`, write `prompt.md` (dispatch
  prompt, `''` without one), `reads.json` (`run.reads`), `sample.json` (`{ transcript: run.file, prompt, cwd, ts,
  reads: {} }`) and `root-reads.json` (`rootReads(run, root)`, root = the dispatch cwd with `/`), and copy each file a
  tool result of the run names after `Full output saved to: ` (`\` turned to `/`) that exists inside a transcript
  folder to `tool-results/<basename>`. Every file is written whole first, to `<name>.<process.pid>.tmp` opened with
  flag `wx`, then `fs.renameSync`d onto its name only when that name does not exist (else the temp file is removed):
  an existing file is kept, never rewritten. When `transcript.jsonl` already existed and its bytes differ from the
  source, the source is also copied the same way to `transcript-<source-mtime-ms>.jsonl` (its `mtimeMs` rounded
  down) and stdout gets `snapshot <folder>/transcript.jsonl differs from its source; the source is kept beside it as
  transcript-<source-mtime-ms>.jsonl`. Print `snapshot: <folder>`.
  (4) only then the checks: not `ticketDone` → exit 2 `<id> is not done: accord/tickets/<id>.md on <ref> has no
  verified_hash; its runs are copied under <bench>/samples/gathered/<id>/; run --gather <id> again once it is
  done`; no merge → exit 2 `<id> has no merge into <ref>; its runs are copied under ...`. (5) per new run, an entry
  `{ agent, n, transcript: run.file, ticket: id, base, main, root, elsewhere, files: [], pairs, snapshot:
  'samples/gathered/<id>/<short-agent>-<run-id>', ticketAtBase, truth, replay: { ok, problems } }` (and `task` when
  `run.task`): `base` = the newest commit with commit time at or before the dispatch time (else `run.start`) on the
  run's branch from merged history: the first-parent history of each merge tip when the branch names the id, else
  of `defaultRef`; `main` the same on `defaultRef`; `elsewhere` the distinct absolute paths in the prompt (the `ABS`
  pattern of scripts/round.mjs:124, trailing `.` cut, `/`) outside root and bench; `pairs` `[['main', 'main'],
  ['origin/main', 'main'], ['HEAD', 'base'], ['t/<id>', 'base'], ['origin/t/<id>', 'base']]`; `ticketAtBase` =
  `existsAt`; `truth` = `truthOf(repo, id, base)`; `n` = one more than the highest `n` of that agent in both lists
  and the entries added so far. Replay problems: no dispatch; no base; `accord/tickets/<id>.md does not exist at
  base` when `ticketAtBase` is false; `sampleDrift(repo, entry, rootReads(run, root))`; `rewriteBrief(prompt, {
  ticket: <ticket-at-base> ?? '', paths: [[root, '<bench>/wt/check'], ...elsewhere mapped to '<bench>/absent/<i>'],
  pairs: entry pairs mapped to shas, check: { bench, allowed: [] } }).problems`. (6) when an entry was added, write
  the list (`JSON.stringify(list, null, 2) + '\n'`) and print `added <agent> <n> <transcript>: replay ok` or `...:
  replay <problems joined by '; '>`. Exit 0.
- `main`: `--gather <id> [<transcript> ...]` calls `runGather(process.cwd(), id, names)`; Task 3 uses `names`. The
  usage line gains `| --gather <id> [<transcript> ...]`.

Ending step, the real gathering (ledger Ruling: before about 2026-11-11). With a scratch module in the OS temp folder,
never committed, that imports `scripts/benchmark.mjs` by file URL: for every `accord/tickets/<id>.md` at
`defaultRef` of the main checkout with `ticketDone` true and a merge, print `<id> <truth-count> <scout-runs>`, where
truth count is `truthOf(main, id, ticketMerges(main, id)[0].base).length` and scout runs counts the `ticketRuns`
results whose agent is `accord-scout` among `readSessions(transcriptDirs(main, [])).runs`. Run `node
scripts/benchmark.mjs --gather <id>` in this worktree for each id with more than 5 truth files and at least one
scout run. Report the list, each command's output, and commit `scripts/benchmark-gathered.json` with the task.

Must not change: `readSessions` results other than the new `branch` field; compliance; round 1.

## Task 3: Gather lane scouts tied by their session's scout report commit, named runs and the untied list
covers: @ac-5, D-01
files: scripts/benchmark.mjs, scripts/benchmark-gathered.json (new), scripts/benchmark-rounds.json (new), packages/core/test/benchmark-gather.test.ts (new)
verify: packages/core/test/benchmark-gather.test.ts#risk:complex-branching-a-lane-scout-is-tied-by-the-next-scout-report-commit-of-its-session-and-an-untied-scout-before-the-claim-is-printed-and-can-be-named

Consumes: Task 2. Produces: `readSessions(dirs).commits` (`[{ session, ts, subject }]`), `ticketRuns(runs, id, {
commits, named })` with ties `id`, `scout-commit` and `named`, exported `untiedScouts(repo, id, runs, commits)` (the
untied list), named transcripts outside the default folders, and the round's sample list.

Test first (same file, its own fixture): commit 1 at 2026-10-01T00:00:00Z holds `a.txt` and `b.txt` only; branch
`t/T-1`: `new ticket T-1` at 01:05 (adds the ticket, `verified_hash: ""`), `claim: T-1` at 02:00, work at 02:30
(changes `a.txt`, `b.txt`, sets `verified_hash`); merge into `main` at 03:00. Session `S2.jsonl` (cwd `<t>/repo`,
gitBranch `main`): scout y1 dispatched 00:10, ending 00:20, description `Lane scout`; a Bash `git -C "<t>/repo"
commit -m "scout: T-0 report" -- x` answered `[main 1111111] scout: T-0 report` at 00:30; scout y2 dispatched
00:40, ending 00:50, description `Lane scout`; a Bash commit answered `[t/T-1 2222222] scout: T-1 report` at 01:00.
Session `S3.jsonl`: scout y3 dispatched 01:20, ending 01:30, description `Look around`, no scout commit. Every
scout's lines carry `gitBranch` `main`, and no prompt holds a path. Run
`--gather T-1`: y2 is added with `ticketAtBase: false`, `replay.ok: true`, truth `['a.txt', 'b.txt']`; y1 is not
added and not listed as untied (it is tied to T-0); stdout holds `untied scout run: <y3-file> ended
2026-10-01T01:30:00.000Z; to add it: node scripts/benchmark.mjs --gather T-1 <y3-file>`, and `untiedScouts(<t>/repo,
'T-1', runs, commits)` on the same transcripts returns y3 only. Session `S4.jsonl` lies in `<t>/other/P/`, outside
the temp home, with scout y4 dispatched 01:40, ending 01:45, description `Look again`, cwd `<t>/repo`. Run `--gather
T-1 <y3-file> <t>/other/P/S4/subagents/agent-y4.jsonl` (the second an absolute path): y3 and y4 are added, each with
`replay.ok: false` and the problem `accord/tickets/T-1.md does not exist at base`; y2 is not added again. A name that
matches no run prints `no run <name> in the transcript folders` and makes the exit 2 after the other runs are copied
and added.

Implementation:
- `readSessions`: per session file, for each user `tool_result` whose `tool_use_id` is a collected use with a
  `command` matching `GIT_COMMIT` (:218), each git summary line `^\[[^\]\n]* ([0-9a-f]{7,40})\] (.+)$` gives `{
  session: '<folder-name>/<session>.jsonl', ts: <the user line's time, else the use's>, subject }`. `runs` and
  `refusals` stay as they are.
- `ticketRuns(runs, id, { commits = [], named = [] })`: the Task 2 rule (`tie: 'id'`); plus each `accord-scout` run
  whose description and branch match no `ID` (:24), not `bench `, whose session's next `scout: <x> report` commit
  after the run's `end` has `x === id` (`tie: 'scout-commit'`); plus each run whose `transcriptTail` equals that of a
  name in `named` (`\` turned to `/`) (`tie: 'named'`), once each.
- `untiedScouts(repo, id, runs, commits)`: `accord-scout` runs naming no id, not `bench `, with no `scout:` commit
  after their end in their session, whose `end` lies in the 24 hours up to the earliest commit (from
  `branchCommits`) whose first line is `claim: <id>`, sorted by end; `[]` with no such commit.
- `runGather`: a name that is an existing file adds the folder three levels above it
  (`<project>/<session>/subagents/agent-<run-id>.jsonl`) to `extra` of `transcriptDirs`, and is matched by its last
  four path segments, the form `run.file` has; passes `commits` and `named`; a `scout-commit` run whose ticket is
  missing at base records `ticketAtBase: false` with no replay problem for it; the untied list is `untiedScouts`
  minus runs already gathered for this id, printed after the copies and before the checks. Unmatched names: the
  notice, then exit 2 at the end.

Ending step, the real gathering of lane scouts (ledger Ruling: before about 2026-11-11). With a scratch module in the
OS temp folder, never committed, that imports `scripts/benchmark.mjs` by file URL: take `runs` and `commits` from
`readSessions(transcriptDirs(main, []))` of the main checkout; for every `accord/tickets/<id>.md` at `defaultRef` of
the main checkout with `ticketDone` true and a merge, print `<id> <truth-count> <tied-scouts> <untied-scouts>`, where
truth count is `truthOf(main, id, ticketMerges(main, id)[0].base).length`, tied scouts counts the `ticketRuns(runs,
id, { commits })` results whose agent is `accord-scout`, and untied scouts is `untiedScouts(main, id, runs,
commits).length`. Run `node scripts/benchmark.mjs --gather <id>` in this worktree for each id with more than 5 truth
files and at least one tied or untied scout run (the Task 2 ids add only their tied lane scouts). Then set `samples`
of round `r2-scout` in `scripts/benchmark-rounds.json` to every `n` of an `accord-scout` entry in
`scripts/benchmark-samples.json` and `scripts/benchmark-gathered.json`, ascending (the round leaves out and names
those it cannot use). Report the listing, each command's output and every `untied scout run:` line with its ticket
id, and commit both json files. The owner's choice among the untied runs is the main session's step after this
task (preamble).

Must not change: the Task 2 behaviour for runs that name the id; `runs` and `refusals` of `readSessions`.

## Task 4: A prose "only" or "none" claim becomes an Absent row searched only within its own scope
covers: @ac-2
files: scripts/round.mjs, packages/core/test/benchmark-arms.test.ts (new)
verify: packages/core/test/benchmark-arms.test.ts#risk:parsing-a-prose-only-or-none-claim-is-searched-only-when-it-names-one-subject-and-its-own-folder-and-a-cited-file-is-allowed-only-when-every-matching-line-is-cited

Consumes: nothing new. Produces, in round.mjs: `proseClaims(reply, { tracked, read, report })` → `{ rows: [{ line,
subject, pattern, folders, allowed }], unsearchable: [{ line, why }] }`, where `report` is
`parseScoutReport(reply)` (its `absent` and `citations`, packages/core/src/scout/report.ts:117-123) and `read(paths)`
returns each text or undefined, as `ScoutFacts.read` does.

Test first (pure; `report` from core's `parseScoutReport`; `tracked` and `read` from a small map): `src/a.ts` (1
`export function foo() {}`, 2 `export function qux() {}`, 3 `qux();`), `src/b.ts` (1 `import { foo } from './a';`, 2
`foo();`), `README.md`. One reply, which cites `src/a.ts:1` and `src/a.ts:1-2` on other lines, holds these lines
and gives: `` `foo` is only called in `src/b.ts` `` → a row, subject `foo`, pattern
`(?<![A-Za-z0-9_$])foo(?![A-Za-z0-9_$])`, folders `['src']`, allowed `['src/b.ts', 'src/a.ts']` (its one matching
line, 1, is cited); `` `qux` is only called in `src/b.ts` `` → allowed `['src/b.ts']` (lines 2 and 3 match, 3 is not
cited); a span `` `src/a.ts:1,3` `` counts as the path `src/a.ts`; `` `foo()` `` gives subject `foo`; `` `bar` is not
found in `README.md` `` → `no folder`; `` `foo` and `bar` are ONLY in `src/` `` → `more than one subject`; a line
reading none of this touches `` `bar` `` → `no path`; a line with only paths → `no subject`; the same subject twice →
one row; a subject in an Absent row's claim or pattern → no row; lines inside a fence, the Absent table's `|` lines
and a `Skipped:` line are not read; `nonetheless` is not a claim word.

Implementation: normalise BOM and CRLF; skip fenced lines (a line starting with three backticks or tildes opens or
closes), lines starting with `|` inside the `## Absent` section (up to the next `#` or `##` heading), and lines
matching `/^\s*(?:[-*+]\s+)?skipped:/i`. A claim line matches `/\b(only|none|no other|not found)\b/i`. Each backticked
span is trimmed, `\` turned to `/`, a leading `./` dropped, then a citation suffix `:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$`
cut (approach-review 4.2): a tracked path is a file; a path some tracked path starts with plus `/` (a trailing `/`
dropped) is a folder; anything else is a subject candidate, a trailing `()` cut. Unsearchable, in this order: no
path (`no path`), not exactly one distinct subject (`no subject`, `more than one subject`), a path holding
whitespace or a comma, which an Absent cell cannot hold (`a path the table cannot hold`), no folder (`no folder`).
Folders: the named folders plus the folder of each named file not at the root. Pattern: the subject escaped,
bounded as above. Allowed: the named files in the order the line names them, then, sorted, each tracked cited
file (from `report.citations`) not already named whose matching lines in the text `read` gives (CRLF turned, one
trailing empty line dropped) are at least one and all within that file's cited lines; a citation's lines are read
from its `text` after `<path>:`, each comma item a line or an inclusive range (approach-review 5.1;
scripts/round.mjs:164 stays allowed, so 3.1 holds). One row per subject, the first line naming it; a subject that is
a substring of any Absent row's claim or pattern gives no row. Rows and `unsearchable` are sorted by line.

Must not change: everything else in round.mjs.

## Task 5: A scout run is scored by script on scout check, false claims and recall
covers: @ac-2, D-03
files: scripts/round.mjs, scripts/benchmark.mjs, packages/core/test/benchmark-arms.test.ts (new)
verify: packages/core/test/benchmark-arms.test.ts#ac-2-a-scout-run-is-scored-by-script-on-scout-check-and-contradicted-only-or-none-claims-and-recall-against-the-merged-diff-and-scoring-again-gives-the-same-row (@ac-2)

Consumes: `proseClaims` (Task 4), `truthOf` (Task 2), core `scoutCheck` and `parseScoutReport` passed in.
Produces: round.mjs `SCOUT_MEASURES` (`[{ key: 'check', label: 'scout check passes', best: 'high' }, { key:
'falseClaims', label: 'false only or none claims', best: 'low' }, { key: 'recall', label: 'wiring recall', best:
'high' }]`), `SCOUT_BESIDE` (`[{ key: 'unsearchable', label: 'prose claims not searched' }]`), `namesPath(reply,
path)`, `scoreScout(reply, { tracked, read, ticket, truth
}, { scoutCheck, parseScoutReport })` → `{ values: { check, falseClaims, recall }, beside: { unsearchable }, detail:
{ failures, absentFalse, proseFalse, named } }`; benchmark.mjs `scoutFacts(dir)` and `scoreScoutRun(dir, { reply,
ticket, base, truth }, core)`; the named plan leaves out samples with no truth.

Test first (ac-2, git): a temp repo, commit B with `src/a.ts` and `src/b.ts` as in Task 4, `src/c.ts` (`export const
baz = 2;`), `README.md`, `accord/tickets/T-1.md` (its body holds the word `zed`); branch `t/T-1` changes `README.md`, `src/a.ts`, `src/b.ts`,
`src/c.ts` and adds `src/d.ts`; `main` merges it (`Merge branch 't/T-1'`); a worktree at B. The reply: a `## Files`
list naming `src/a.ts` (`defines foo and qux, src/a.ts:1, src/a.ts:1-2` in backticks) and `src/b.ts` (`calls foo,
src/b.ts:2`); an `## Absent` table with a row `no other file defines bar` (pattern `bar`, folders `src`, allowed
`src/a.ts`), which holds, and a row `nothing reads baz` (pattern `baz`, folders `src`, no allowed hit), which
`src/c.ts:1` contradicts, and a row `nothing else names zed` (pattern `zed`, folders `accord`, no allowed hit), which
holds only because the ticket's own file is left out of the search; prose lines `` `foo` is only called in `src/b.ts` `` (true: the definition line of
`src/a.ts` is cited), `` `qux` is only called in `src/b.ts` `` (false: `src/a.ts:3` is uncited), none of this touches
`` `bar` `` (no path, so not searched), and `` `baz` is not found outside `src/c.ts` `` (already an Absent row).
`truthOf(repo, 'T-1', B)` is `['README.md', 'src/a.ts', 'src/b.ts', 'src/c.ts']` (`src/d.ts` is new);
`scoreScoutRun(<worktree>, { reply, ticket: 'T-1', base: B, truth }, core)` gives `values: { check: 0, falseClaims:
2, recall: 0.75 }`, `beside: { unsearchable: 1 }` and `detail.failures` 1; a second call gives an equal result.

Implementation:
- `scoreScout`: `report = parseScoutReport(reply)`; `checked = scoutCheck({ text: reply, tracked, read, ...(ticket
  === undefined ? {} : { ticket }) })`, so a sample's ticket file is left out of Absent searches
  (packages/core/src/scout/check.ts:85-101); `check` 1 when no failure, else 0. `absentFalse`: distinct row lines of failures matching `/\(row (\d+)\): .+
  matches its pattern outside its allowed hits$/`. Prose: `proseClaims(...)`; when it has rows, one more
  `scoutCheck` on a built report `## Absent` + header + separator + one row per claim (`| prose line <line> |
  <pattern, each '|' written '\|'> | <folders joined by ' '> | <allowed joined by ' '> |`) with the same facts and
  ticket; `proseFalse` = the claims whose built row fails the same way. `falseClaims = absentFalse.length +
  proseFalse.length`. `recall` = share of `truth` paths `namesPath` finds; `namesPath` matches the path in the
  reply (`\` turned to `/`) not preceded by `[A-Za-z0-9_./-]` and not followed by `[A-Za-z0-9_/-]` or by `.` and a
  word character. `unsearchable` = their count.
- `scoutFacts(dir)`: tracked from `git ls-files -z` in `dir`; `read` from the files on disk, undefined when
  unreadable (as `workingFacts`, packages/cli/src/commands/scout.ts:28-40). Ledger Ruling: the worktree's facts.
- `scoreScoutRun`: `{ problem: '<dir> is not at base <sha7>' }` unless `atBase(dir, base)`; the ticket is passed only
  when `accord/tickets/<ticket>.md` is tracked (no ticket for a lane scout).
- `runNamedPlan`: before step (4) of Task 1, `truthOf(main, ticket, base)` null leaves the sample out `no merge of
  t/<ticket>`, and an empty truth `no file its merged diff changed existed at base`.

Must not change: Task 1 and Task 4 behaviour.

## Task 6: The round report shows each arm's means, pass ranges and cost, and names the winner or none
covers: @ac-3, D-02, D-06, D-07, D-08
files: scripts/round.mjs, scripts/benchmark.mjs, packages/core/test/benchmark-arms.test.ts (new)
verify: packages/core/test/benchmark-arms.test.ts#ac-3-the-report-shows-pass-mean-ranges-and-weighted-cost-per-arm-and-names-the-cheapest-arm-that-ties-the-best-one-or-no-winner (@ac-3)

Consumes: score records (Definitions). Produces: round.mjs `weighted(usage)`, `armStats({ def, measures, samples,
records })` → `{ arms: [{ model, effort, runs, mean, range, cost, beside }], best: { <key>: arm }, winner }` and
`armReport({ name, def, measures, besides, samples, leftOut, records, notCounted, flags })` → Markdown, where
`samples` is `[{ n, ticket, truth: <truth-file-count> }]` of the kept samples, `leftOut` `[{ agent, n, reason }]`,
`notCounted` `[{ tag, why }]` and `flags` as `flagSection` takes them; benchmark.mjs `writeReport(root, text, rel =
'docs/benchmark/round-1.md')`.

Test first (ac-3, pure): arms A haiku low, B haiku medium (price 1), C sonnet low (price 3), runs 2, samples 1 and
2, every run's usage `{ input: 100, cacheRead: 1000, cacheWrite: 40, output: 20 }` (weighted 350). Values are
given per pass as sample 1, sample 2. Scenario 1: A check 1 on every run, falseClaims 1,0 then 0,1, recall 0.75 on
every run; C check 1 on every run, falseClaims 0,0 then 1,0, recall 1,0.5 then 1,1; B check 1, falseClaims 1 and
recall 0.25 on every run. Then: A mean cost 350, C 1050; C's falseClaims range 0 to 0.5 and recall range 0.75 to 1;
best check A (equal with B and C, cheapest first in definition order), falseClaims C, recall C; winner A, and the
text holds `Winner: haiku low`. Scenario 2: as 1, but C check 1,0 then 1,1 and A recall 0.5 on every run: no
winner; the text holds `No winner: the measures have different best arms and no arm ties all three.` and the best
arm per measure (check A, falseClaims C, recall C). Scenario 3: arms A and C only, A check 1,0 on both passes and
recall 0.5, C as in scenario 1: C is best on all three, A ties none, winner C (`Winner: sonnet low`). In scenario 1
with B's sample 2 record of pass 2 removed, B's range comes from pass 1 alone; the arm table shows each cost and
range.

Implementation:
- `weighted(u) = u.input + 0.1 * u.cacheRead + 1.25 * u.cacheWrite + 5 * u.output`; a run's cost = weighted ×
  `def.prices[model]` (D-08).
- `armStats`: per arm (definition order), its records on the given samples; per measure the mean over every scored
  run; pass k (1 to `runs`) is complete when it has a record on every sample, and its mean is the mean of those
  records; `range` = lowest and highest complete pass mean, null with none (D-06); `cost` = mean run cost; `beside`
  = sums. Best per measure among arms with a range: highest mean, or lowest when the measure says so; means within
  1e-9 are equal, the cheaper wins, then definition order. Winner: the cheapest arm with a range whose mean on every
  measure lies within the best arm's range on it (1e-9 slack), the best arm itself counting when it is best on all
  measures (D-02); none → `winner: null` (D-07).
- `armReport` text: `# Benchmark round <name>`; a line naming the agent, arm count, runs per arm, sample count, the
  prices and `pricesAt`, the cost formula, and that the report changes no agent definition; `## Arms` table `| model
  | effort | runs | <label> mean | <label> pass range | ... | mean cost per run | <beside-label> |` (means and ranges
  to 2 decimals, `lo to hi` or `none`, cost rounded); `## Result`: `Winner: <model> <effort>, the cheapest arm whose
  mean on every measure lies within the pass-mean range of the best arm on that measure.`, or `No winner: the
  measures have different best arms and no arm ties all three.` (or `No winner: no arm has a complete pass.`), then
  `| measure | best arm | mean | pass range |`; `## Samples` `| sample | ticket | truth files |`; `## Samples left out`
  (`- <agent> <n>: <reason>` or `None.`); `## Runs` `| tag | sample | model | effort | k | <labels> | cost |`;
  `flagSection(flags)`; `## Runs not counted` (`- <tag>: <why>` or `None.`).
- `writeReport` writes `rel`; the one-argument call is unchanged (benchmark-round.test.ts:293-294).

Must not change: `report`, `suggest`, `better`, `byDefault`, `holds` (round 1 only).

## Task 7: A printed plan lists only rows with no run, scores matched runs once, and `--round <name>` writes the report
covers: @ac-4
files: scripts/round.mjs, scripts/benchmark.mjs, packages/core/test/benchmark-arms.test.ts (new)
verify: packages/core/test/benchmark-arms.test.ts#ac-4-a-printed-plan-lists-only-rows-with-no-matched-run-and-a-matched-run-with-no-score-is-scored-once-and-every-scored-run-is-counted (@ac-4), packages/core/test/benchmark-arms.test.ts#risk:complex-branching-a-named-round-report-for-an-agent-with-no-scorer-exits-2-naming-the-scorer-while-its-plan-still-prints-its-rows, packages/core/test/benchmark-arms.test.ts#risk:complex-branching-a-matched-scout-run-is-scored-through-the-scout-scorer-cached-in-the-state-and-counted-in-the-named-report

Consumes: Tasks 1, 5, 6. Produces: round.mjs `pendingRows(rows, runs, { name, scores, read })` → `{ dispatch,
toScore: [{ row, run }], notCounted: [{ tag, why }] }` and a `describe` option on `matchRuns`; benchmark.mjs
`SCORERS` (`accord-scout` only: `{ measures: SCOUT_MEASURES, besides: SCOUT_BESIDE, score: ({ dir, sample, run,
truth, core }) => scoreScoutRun(dir, { reply: run.lastText, ticket: sample.ticket, base: sample.base, truth }, core)
}`, the Task 5 signature), `scoreRound(...)` shared by both modes, `runNamedRound(repo, name, extra)`, an async
`main`, and `stopOnEscape` taking the state file name and sample list.

Tests first:
- ac-4 (pure): rows of one sample, one arm, k 1 to 5 (`prepared: 0`, `prompt: '<t>/p-<k>.md'`, read callback
  returning undefined). Runs, each dispatched under `accord-scout` with its brief path as the prompt: one for k1,
  whose record is already in `scores`; one for k2, not scored; none for k3; one for k4 dispatched as
  `accord-critic`; none for k5, whose record is in `scores` (its transcript expired). `pendingRows` gives `dispatch`
  k3 and k4, `toScore` only k2, and `notCounted` the k4 run with its `runProblem` reason. After a record for k2 is
  added to `scores`, `armStats` (definition `runs: 5`) counts 3 runs for the arm, and a second `pendingRows` gives
  the same `dispatch` and an empty `toScore`.
- risk:complex-branching (process): the Task 1 fixture builder with one more sample entry, `accord-critic` n 1 like
  scout n 1, its snapshot under `<t>/accord-bench/samples/critic-1/`, a round `r9-crit` (agent `accord-critic`, arm
  sonnet medium, runs 1, judges 0, prices sonnet 3, samples [1]) and a temp home without transcripts: `--round
  r9-crit --plan` exits 0 and prints its one row; `--round r9-crit` exits 2 with `no scorer for accord-critic` on
  stderr and no `docs/benchmark/round-r9-crit.md` is written.
- risk:complex-branching (process, the real scoring path): the Task 1 fixture builder with a round `r9-one`
  (accord-scout, arm haiku low, runs 1, judges 0, prices haiku 1, pricesAt `2026-11-02`, samples [1]) and a temp
  home. `--round r9-one --plan` (cwd `<t>/sub/linked`) prints the row `scout-1-haiku-low-1`. Then write a session
  into `<t>/home/.claude/projects/<encoded-main-checkout>/` (`<t>/repo` with `:`, `\` and `/` turned to `-`), built
  as packages/core/test/benchmark-reader.test.ts:19-49 builds one, timed after that plan, that dispatches the row as
  the ac-4 runs are dispatched (description `bench r9-one scout-1-haiku-low-1`, `accord-scout`, the printed brief
  path as the prompt) and whose reply names `a.txt`. `--round r9-one --plan` again: exit 0, stdout holds `scored
  scout-1-haiku-low-1` and no table row for it, and `<t>/accord-bench/round-r9-one.json` holds
  `scores['scout-1-haiku-low-1']` with `values.recall` 1 and a number for `values.check` and `values.falseClaims`.
  `--round r9-one` exits 0 and writes `docs/benchmark/round-r9-one.md` under the cwd, holding `Winner: haiku low`.

Implementation:
- `matchRuns(rows, runs, { judges, describe: d = describe })`: uses `d(row.tag)` at :317; among several fresh runs
  of one description the earliest dispatched comes first. Round 1 calls are unchanged.
- `pendingRows`: open rows are those with no `scores[tag]`; runs whose description is `bench <name> <tag>` of an
  open row and fail `runProblem` go to `notCounted`; the rest go through `matchRuns(open, valid, { judges: false,
  describe: (t) => describe(t, name) })`; `toScore` = its matches; duplicates go to `notCounted` as `another run of
  this row counts`; `dispatch` = open rows with no match.
- `scoreRound(repo, { main, bench, name, def, state, samples, extra })`: runs from `readSessions(transcriptDirs(main,
  extra))`; `pendingRows`; when `toScore` is not empty and the agent has a scorer, load core once with `await
  import(new URL('../packages/core/dist/index.js', import.meta.url).href)` (missing → exit 2 `run npm run build
  first: packages/core/dist/index.js is missing`); `stopOnEscape(main, rows, { runs: <the toScore map>, judges: new
  Map() }, bench, { samples }, { state: 'round-<name>.json' })` exits 2 as round 1 does (`stopOnEscape` gains a last
  argument `{ state = 'round-1.json' } = {}` naming the state file it reads `live` from, and its first message names
  `--round <name> --plan` for a named state); each run scored by
  `SCORERS[agent].score({ dir: row.worktree, sample, run, truth: truthOf(main, sample.ticket, sample.base), core })`; a `problem` goes to
  `notCounted`; else `state.scores[tag]` = the record (`reply: run.lastText`, `usage: run.usage`, `start`, `end`: the
  last hand-back's time or `run.end`, `ms`, `flags: turnFlags(run.turns, row)`, and the scorer's `values`, `beside`,
  `detail`), saved at once; print `scored <tag>` and `not counted <tag>: <why>`. With no scorer, print `notice: no
  scorer for <agent>; matched runs stay unscored`.
- `runNamedPlan`: after step (9) prepares rows, calls `scoreRound` and prints `dispatchTable` of `dispatch` only.
- `runNamedRound`: bench root line; definition and `checkRound`; no scorer → exit 2 `no scorer for <agent>:
  --round <name> writes no report`; no state rows → exit 2 `run --round <name> --plan first`; `scoreRound`; then
  `writeReport(repo, armReport(...), 'docs/benchmark/round-<name>.md')` with every record of a kept sample, the
  left-out reasons, `notCounted` and the cached flags; print the path. The usage line gains `| --round <name>
  [--plan]`.
- `main` may return a promise; the entry line becomes `Promise.resolve(main(process.argv.slice(2))).then((code) => {
  process.exitCode = code; })`.

Must not change: round 1's `runRound`, `runPlan` and their exits; `stopOnEscape` texts for round 1.

## Task 8: `--clean` refuses while a named round has unscored rows and prints each branch it deletes with its tip
covers: D-01
files: scripts/benchmark.mjs, packages/core/test/benchmark-worktree.test.ts
verify: packages/core/test/benchmark-worktree.test.ts#risk:data-loss-clean-refuses-while-a-named-round-holds-an-unscored-row-and-prints-each-bench-branch-with-its-tip-before-deleting-it

Consumes: `SCORERS` (Task 7), `mainBench`. Produces: `unscoredRounds(bench)` → `[{ name, count }]`, the guard, and an
`onDelete` option of `cleanWorktrees`.

Test first (new `it` in the existing file, a fixture as :16-40 builds, with `<repo>/docs/benchmark/round-1.md`
written first so the round 1 guard (:809) lets the clean through): a bench worktree with branch
`bench/r2-x/executor-1-sonnet-high-1`; `<t>/accord-bench/round-r2-x.json` with a row of `accord-scout` and no
score: `cleanWorktrees(repo)` returns `{ refused: true, removed: [], failed: [] }` and the worktree stays, and
`node scripts/benchmark.mjs --clean` (cwd `<repo>`) exits 2 with stderr holding `round r2-x has 1 rows with no
score`; the same
row with a score in `scores`, plus a round of `accord-critic` (no scorer) with an unscored row, does not refuse;
`cleanWorktrees(repo, { onDelete })` calls `onDelete('bench/r2-x/executor-1-sonnet-high-1 <its-tip-sha>')` while
that branch still exists, then the branch is gone.

Implementation: `unscoredRounds(bench)` reads each `round-<r…>.json` under the bench root and counts rows with no
`scores[tag]`, skipping rows whose agent has no scorer (approach-review 2.3: such rows can never be scored);
`cleanWorktrees(repo, { force, onDelete })` refuses without `force` when the round 1 guard (:809) refuses or
`unscoredRounds(mainBench(repo).bench)` is not empty, with the same result shape; before deleting a branch it reads
its tip, calls `onDelete('<branch> <sha>')`, and deletes with `git update-ref -d refs/heads/<branch> <sha>`
(`accord/product/conventions.md`). `runClean` prints the bench root line, passes `onDelete` writing the line to
stdout, and on a named-round refusal prints `round <name> has <count> rows with no score (<bench>/round-<name>.json);
--clean would delete the worktrees and branches its runs need. Score them with --round <name> --plan, or pass
--force.` and exits 2 (the round 1 refusal text stays). A deleted branch is restored with `git branch <branch>
<sha>`.

Must not change: the existing clean tests (:11-63, :862-907) and the refused result's shape.

## Task 9: Minutes end at the last hand-back and each run shows how many other round runs overlapped it
covers: D-01
files: scripts/round.mjs, scripts/benchmark.mjs, packages/core/test/benchmark-arms.test.ts (new)
verify: packages/core/test/benchmark-arms.test.ts#risk:regression-minutes-end-at-the-last-hand-back-and-each-run-shows-how-many-other-round-runs-overlapped-it

Consumes: Tasks 6 and 7. Produces: `parseRun`'s `ms` counted only over timestamps up to the run's last hand-back
when it has one; round.mjs `overlapCounts(records)` → `Map<tag, number>`; columns `min` and `overlapped` in the
`## Runs` table of `armReport`.

Test first: a transcript folder (as benchmark-reader.test.ts:19-49 builds) with a run whose lines are at 00:00,
00:04, a hand-back at 00:08, then a woken reply at 00:30: `readSessions` gives `ms` 8 minutes and `end` 00:30; a run
with no hand-back keeps today's `ms`. Three records with start/end 0-10, 5-15 and 20-30 minutes: `overlapCounts`
gives 1, 1, 0, and the `## Runs` table shows them with the minutes.

Implementation: in `parseRun` (:305) the active-time sum runs over the sorted times that are at or before the last
`handbacks` time when there is one. `overlapCounts`: two records overlap when each starts at or before the other's
`end`. `armReport` adds `min` (`ms / 60000`, 1 decimal) and `overlapped` after `cost`.

Must not change: `start`, `end`, `usage` and every other field of a run; compliance results.

## Task 10: Each run gets k judges, their spread is shown, and a judge that reads the transcripts is not counted
covers: D-01, D-04
files: scripts/round.mjs, scripts/benchmark.mjs, packages/core/test/benchmark-arms.test.ts (new)
verify: packages/core/test/benchmark-arms.test.ts#risk:complex-branching-a-run-gets-judge-rows-until-k-judges-are-counted-and-a-judge-that-touches-the-transcript-folders-is-not-counted

Consumes: Tasks 1 and 7. Produces: `parseRun`'s `toolInputs` (the JSON text of each tool use's input);
round.mjs `touchesTranscripts(run)`, `pendingJudges(rows, runs, { name, k, scores, read })` → `{ dispatch, judged:
Map<tag, [{ j, transcript, value, counted, why }]> }`, `judgeSection(judged, kindOf)`; a `checkRound` rule; judge
rows in the named plan and a `## Judges` section in the report.

Test first (pure): a fact-role round with k 3 (the agent `accord-scout`), one scored row (`prompt` `<t>/b.md`,
`prepared: 0`, `judge` the critic at `JUDGE`); judge runs, each dispatched as `accord-critic` with `<t>/b-judge.md` in
its prompt and no message sent to it: `bench <name> <tag> judge 1` answering `wrong facts: 2`, `judge 2` answering `wrong facts: 4`, and `judge 3` whose tool input names
`C:/Users/x/.claude/projects/C--Work-accord/s.jsonl` answering `wrong facts: 0`: `pendingJudges` counts 1 and 2,
lists judge 3 as not counted (`read the transcript folders`) and gives one `dispatch` row tagged `<tag> judge 4`
(the next number, so no description is used twice);
`judgeSection` prints `- <tag>: wrong facts 2, 4 (spread 2)`. With k 0 nothing is listed. `checkRound` refuses
judges 1 for `accord-critic` with `judges must be 0 for accord-critic: a named round has no reference run to judge a
finding against`.

Implementation: `touchesTranscripts` is true when any tool input, `\` turned to `/` and lower-cased, holds
`/.claude/projects/`. A judge counts when `runProblem(row, run, { judge: true, read })` is null, it got no
`SendMessage`, `parseVerdict(kind, lastText, 0)` reads (kind `fact` for fact roles, `must` for the executor and
planner) and it does not touch the transcripts; judge runs match on `judgeDescribe(tag, name) + ' ' + j` dispatched
at or after `max(prepared, judgeBriefAt)`; `dispatch` holds rows `<tag> judge <j>` for the next `k - counted`
numbers after the highest `j` seen, with the judge's agent, model and effort and the row's judge brief as prompt.
Arm rows of a round with judges get `judge: { agent: 'accord-reviewer' for the executor else 'accord-critic',
...JUDGE }`. In `scoreRound`, for each scored row with fewer counted judges
than `judges`, write `<bench>/briefs/<name>/<tag>-judge.md` with `writeJudgeBrief` and `judgeBrief(kind, args)`
(fact: the worktree's ticket path, the worktree, the base and the cached `reply`; executor: a review package written
to `<bench>/files/<name>/<tag>/result.md` as :1073-1076; planner: the worktree's plan path), cache the judged list in
`state.judges`, and print the missing judge rows in the dispatch table. `armReport` gains `## Judges`: per row its
counted values and spread (highest minus lowest), then each judge not counted with its reason, or `None: the round
asks no judge.`

Must not change: round 1's judges and `parseVerdict`; Task 7's scoring.
