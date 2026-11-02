---
baseline: 2bd987e53d9c77223669a3b50896993e4e0bef09
plan_hash: "fnv1a64:6b04e1cad501f51b"
---

Review mode `outcome`: one branch, no slices. Re-planned after the change of course of D-09: Task 1 is built (ledger),
Tasks 2 to 4 finish the benchmark. Every task can be finished from its own section, this preamble, the ticket and its
ledger; the executor reads the code and decides what a task leaves open.

Order and dependencies: Task 1 (built) is the wiring. Task 2, the scout scorer (@ac-2), and Task 3, the arm report
(@ac-3), depend on no task beyond Task 1 and can be built in either order. Task 4, `--round <name>`, depends on Tasks 1,
2 and 3 and proves the whole path from a printed row to the written report.

How round 2 is run once every task is done. No task runs it; it happens at verify, and its report is the evidence for
the Intent's Success line:
1. The owner gives the price factor of `haiku` and `sonnet` from that day's price list (D-08); the main session writes
   them into `prices` of round `r2-scout` in `scripts/benchmark-rounds.json`, the date into `pricesAt`, and commits.
   Until then `--plan` exits 2 naming the model with no positive price.
2. `npm run build`, then `node scripts/benchmark.mjs --round r2-scout --plan`. A session whose working folder is the
   main checkout dispatches every printed row as shown (ledger Ruling). Round 1's scout samples 1, 2, 4 and 5 give
   4 x 6 x 3 = 72 runs; sample 3 (ST-LN-33) has no merge and is left out.
3. When every run has finished: `node scripts/benchmark.mjs --round r2-scout` writes
   `docs/benchmark/round-r2-scout.md`; commit it.

Rules for every task:
- Test ids: every test is a top-level `it(...)` in packages/core/test/benchmark-arms.test.ts; its report id is that
  path from the repository root, `#`, then the `it` title with each whitespace run turned into `-`. No title holds
  `@`, a comma or an apostrophe. No line of a test file holds `process.platform`. No existing test is renamed or edited.
- Tests follow Task 1's tests in that file: scripts imported by file URL, core from `../src/index.js`, temporary
  folders removed in a `finally`, git tests given `120_000` as the third argument of `it`, the fixture builder
  `armsFixture(t)` reused; a process test that reads transcripts sets `HOME` and `USERPROFILE` to a temporary home.
- `scripts/round.mjs` stays pure: it reads no file, spawns nothing, and receives core functions such as `scoutCheck`
  as arguments. Files, git and processes live in `scripts/benchmark.mjs`. No dependency is added.
- Every git call and every test commit follows `accord/product/conventions.md` (the `gitIn` helper in
  scripts/benchmark.mjs).
- Round 1 stays as it is: its modes, output and stored state do not change, and
  packages/core/test/benchmark-round.test.ts, benchmark-samples.test.ts, benchmark-worktree.test.ts,
  benchmark-reader.test.ts, benchmark-compliance.test.ts and benchmark-fixed.test.ts stay green unchanged.
- Not touched (D-01): `packages/core/src/skills/agents.ts`, `accord/config.yml`, anything under `.claude/agents/`,
  `packages/core/agents/`, `packages/*/src/`. `scripts/benchmark-samples.json` is not edited.
- End every task with `npm run build`, `npm run lint`, `npm run typecheck`, then `npx vitest run` on
  benchmark-arms.test.ts and the six round 1 files above; on Windows set `ACCORD_BASH` to Git Bash
  (`accord/product/conventions.md`).

Definitions:
- Bench root: `mainBench(repo).bench`, beside the main checkout whichever worktree the script runs in (ledger Ruling);
  every named-round mode prints `bench root: <bench-root>` as its first stdout line.
- Round definition: an entry of `rounds` in `scripts/benchmark-rounds.json`, `{ agent, arms: [{ model, effort }], runs,
  judges, prices: { <model>: <factor> }, pricesAt, samples: [<n>] }`.
- Row: `{ tag, agent, n, ticket, model, effort, k }` with tag `<short-agent>-<n>-<model>-<effort>-<k>` (the short
  agent is the agent without `accord-`), dispatched with description `bench <name> <tag>`. `--plan` stores the rows,
  each with `worktree`, `prepared` and `prompt`, and `leftOut` in `<bench-root>/round-<name>.json`.
- Scout measures, in this order: `check` "scout check passes" (higher is better), `falseClaims` "contradicted Absent
  rows" (lower is better), `recall` "wiring recall" (higher is better).

## Task 1: Wiring: a round definition prints one row per sample, arm and run from the main checkout's bench root
covers: @ac-1, D-01, D-05
files: scripts/round.mjs, scripts/benchmark.mjs, scripts/benchmark-rounds.json (new), packages/core/test/benchmark-arms.test.ts (new)
verify: packages/core/test/benchmark-arms.test.ts#ac-1-a-round-plan-lists-every-sample-three-times-for-each-model-and-effort-arm-and-a-round-for-another-agent-is-planned-the-same-way (@ac-1), packages/core/test/benchmark-arms.test.ts#risk:parsing-a-round-definition-with-a-bad-name-or-agent-or-arm-or-price-or-run-count-or-sample-list-is-refused, packages/core/test/benchmark-arms.test.ts#risk:complex-branching-a-named-plan-run-from-a-linked-worktree-uses-the-main-checkout-bench-root-and-leaves-out-a-sample-that-fails-a-step

Built at commit 9632d753 (ledger). Produced, in round.mjs: `checkRound(name, def)` (problem strings), `armTag(agent,
n, model, effort, k)`, `armMatrix(def, samples)`, and a second parameter `name = 'r1'` on `describe(tag, name)`,
`judgeDescribe(tag, name)` and `dispatchTable(rows, name)`. In benchmark.mjs: `mainBench(repo)` → `{ main, bench }`,
`writeBrief(...)`, `verifierReport(...)`, `runNamedPlan(repo, name)` and the route `--round <name> --plan`. The data
file `scripts/benchmark-rounds.json` with round `r2-scout`: agent `accord-scout`, arms haiku then sonnet at low,
medium and high, `runs: 3` (D-05), `judges: 0`, `prices: {}`, `pricesAt: ""`, `samples: [1, 2, 3, 4, 5]`.

Behaviour: `--round <name> --plan` prints the bench root line; exits 2 on a missing or refused definition, a state
file that does not parse (left as it is), or no sample left; leaves out a sample failing any step with `left out:
<agent> <n>: <reason>` on stdout; builds the worktrees and briefs per row; saves the state of the Definitions; prints
the dispatch table. The tests: ac-1 on the committed definition and an executor definition; risk:parsing on every
refusal of `checkRound`; risk:complex-branching as a process test on `armsFixture(t)` from a linked worktree.

Must not change: everything round 1 prints and stores; `tagOf`; `rewriteBrief`.

## Task 2: A scout run is scored by script on scout check, contradicted Absent rows and recall
covers: @ac-2, D-03
files: scripts/round.mjs, scripts/benchmark.mjs, packages/core/test/benchmark-arms.test.ts (new)
verify: packages/core/test/benchmark-arms.test.ts#ac-2-a-scout-run-is-scored-by-script-on-scout-check-and-contradicted-absent-rows-and-recall-against-the-merged-diff-and-scoring-again-gives-the-same-row (@ac-2)

Depends on: Task 1 only. Produces, for Task 4:
- benchmark.mjs `truthOf(repo, ticket, base)`: the sample's true file list (D-03, ledger Ruling): the files modified
  or deleted by each first-parent merge into the default branch whose subject names `t/<ticket>` with the id ending there (`t/ST-LN-8` never matches `t/ST-LN-81`), merge base to
  branch tip, renames off, kept where tracked at `base`, sorted; null when the ticket has no such merge.
- round.mjs `scoreScout(reply, { tracked, read, ticket, truth }, { scoutCheck })` → `{ check, falseClaims, recall }`:
  `check` is 1 when core `scoutCheck` reports no failure for the reply on those facts, else 0 (ledger Ruling: the
  same function and facts as `accord scout check --ticket`, no ticket for a lane scout); `falseClaims` is the number
  of distinct `## Absent` rows whose re-run search hits outside their allowed hits, as `scoutCheck` reports them
  (packages/core/src/scout/check.ts:183); `recall` is the share of `truth` paths the reply names as a full
  repository path. No prose claims, no judges.
- benchmark.mjs `scoreScoutRun(dir, { reply, ticket, base, truth }, core)`: the facts are the sample worktree's
  tracked files and their text on disk (ledger Ruling); it returns `{ problem }` instead of a score when `dir` is not
  at `base`.

Test first (ac-2, git): a temp repo whose branch `t/T-1`, merged into `main` with subject `Merge branch 't/T-1'`,
changes files that exist at base B and adds one; a worktree at B; a scout reply naming some changed files in full,
with one Absent row its search confirms and one a file at B contradicts. `truthOf` gives the changed files that
existed at B, without the added one, and not the files of a second merged branch `t/T-10`; `scoreScoutRun` gives `check` 0, `falseClaims` 1 and the expected `recall`; a
reply without the contradicted row gives `check` 1; scoring the same run again gives an equal result.

Must not change: Task 1 behaviour.

## Task 3: The arm report shows each arm's means, pass ranges and cost, and names the winner or none
covers: @ac-3, D-02, D-06, D-07, D-08
files: scripts/round.mjs, packages/core/test/benchmark-arms.test.ts (new)
verify: packages/core/test/benchmark-arms.test.ts#ac-3-the-report-shows-pass-mean-ranges-and-weighted-cost-per-arm-and-names-the-cheapest-arm-that-ties-the-best-one-or-no-winner (@ac-3)

Depends on: Task 1 only. Produces round.mjs `armReport({ name, def, measures, records, leftOut, notCounted })` →
Markdown, where a record is `{ tag, n, model, effort, k, usage: { input, cacheRead, cacheWrite, output }, values }`
(`values` keyed by measure, as Task 2 gives them), `leftOut` the samples left out with their reasons and
`notCounted` the rows with no counted run with the reason. The report holds:
- per arm, per measure, the mean over its scored runs and the lowest-to-highest range of its pass means, a pass being
  its k-th run over every sample and counting only when it has a run on every sample (D-06); its mean cost per run,
  (fresh input + 0.1 cache read + 1.25 cache write + 5 output) times its model's factor in `def.prices` (D-08); the
  price date `pricesAt`;
- the best arm per measure: highest mean, or lowest where lower is better, the cheapest of equally best arms (ledger
  Rulings: means within 1e-9 are equal; an arm with no complete pass is never best or winner);
- the winner: the arm with the lowest mean cost per run whose mean on each measure lies within the pass-mean range of
  that measure's best arm (D-02), which is the best arm itself when it is best on all three and no cheaper arm ties;
  else no winner, with the best arm of each measure (D-07);
- the samples left out and the rows with no counted run, each with its reason.

Test first (ac-3, pure): three arms at two prices, two samples, two runs, with values chosen so that one case names a
cheaper arm that ties the best one, one names the arm best on all three, and one names no winner and lists the best
arm per measure; one arm's cost per run is checked against the formula, and an arm missing one run of a pass has that
pass left out of its range.

Must not change: round 1's `report`, `suggest`, `better`, `byDefault` and `holds`.

## Task 4: `--round <name>` matches each row's run by its tag, scores it and writes the round report
covers: @ac-2, @ac-3, D-04, D-09
files: scripts/round.mjs, scripts/benchmark.mjs, packages/core/test/benchmark-arms.test.ts (new)
verify: packages/core/test/benchmark-arms.test.ts#risk:complex-branching-round-name-scores-each-run-matched-by-its-tag-and-writes-the-round-report

Depends on: Tasks 1, 2 and 3. Behaviour:
- `--round <name> --plan` also leaves out a sample whose `truthOf` is null (`no merge of t/<ticket>`) or empty (`no
  file its merged diff changed existed at base`), so no row is dispatched that cannot be scored.
- `--round <name>` prints the bench root line; exits 2 when the round has no saved rows (`run --round <name> --plan
  first`), when its agent has no scorer (naming it; only `accord-scout` has one, ledger Ruling), or when
  `packages/core/dist/index.js` is missing (asking for `npm run build`).
- It reads the runs from the main checkout's transcript folders and matches each saved row to its run by the
  description `bench <name> <tag>` (round 1's `matchRuns` builds `r1` descriptions, so it needs the round name): a run
  under another agent or with another prompt, or dispatched before its worktree was prepared, does not count; of the
  runs that do, the earliest dispatched counts (ledger Ruling), whatever the transcript file order; and a run whose
  turns did not run on the row's model and effort (round 1's `turnFlags`) does not count, with that reason. Each counted run is scored with Task 2 on the row's worktree and the sample's
  truth; a run whose scoring returns a problem does not count.
- It writes `docs/benchmark/round-<name>.md` under the repository it runs in with Task 3's report and prints that
  path. It keeps no state of its own: every run is matched and scored again on each call. Round 1's report path stays.

Test first (risk:complex-branching, process, on `armsFixture(t)`): a round with one arm, one run and two samples, one
of whose tickets has no merge; `--plan` leaves that sample out and prints the other's row; a session in the temporary
home dispatches that row as printed, with a reply naming the sample's changed file, and two more runs of the same
description, one under another agent and dispatched first, and one with another effort; `--round <name>` exits 0 and the written report names the arm as winner, shows its
recall as 1, and lists the left-out sample and the two runs that do not count, each with its reason.

Must not change: Tasks 1 to 3 behaviour; round 1's `--round 1` and its `docs/benchmark/round-1.md`.
