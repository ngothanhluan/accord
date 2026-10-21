---
id: "ST-LN-14"                            # equals the file name: tickets/<id>.md
title: "Benchmark which model and effort each agent role needs"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# The epic this ticket belongs to.
# parent: "EPIC-ID"
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Optional design reference URL.
# design: "https://example.com/design/..."
# Written by `accord approve` after the owner says yes; never edit by hand.
# approved_hash:
# Written by `gate ready`; never edit by hand.
# ac_hash:
# Self-test ticks, e.g. [ac-1, ac-2]. Always the last key.
# verified: []
# The AC hash and the commit the ticks were made against.
# verified_hash:
# verified_commit:
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
- Why: each accord agent's model and effort was set by judgement, not measurement, and the main session once forgot a process rule (BUG-LN-3 review round 4's fix executor on sonnet, not opus); the owner wants both measured by a script, not left to recall.
- For whom: the owner, who decides each agent's default model and effort (the `.claude/agents/accord-*.md` frontmatter) from the report.
- Success: one round 1 report: every agent's same 5 past samples run on its current model at its current effort, one step lower and one step higher, with runs held, tokens and time per effort and a suggested effort; plus a compliance section that finds the four known breaches.
- Not: no agent's model or effort changed, no model swap and no tuning past round 1 (later tickets), no advisor measurement, no debugger (no past run to sample), nothing shipped in the npm package.
- When: the compliance read runs before 2026-11-11, when the 30-day transcript retention drops the first dogfood runs.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-14

  @ac-1
  Scenario: Every agent's samples run at its current effort and one step either side
    Given 9 accord agents, every one but the debugger, each with 5 past samples
    And at least two of the executor's 5 samples are plain tasks and at least two are tasks whose verify line names a risk:<kind>
    When round 1 runs
    Then each sample is run on the agent's current model at its current effort, one step lower and one step higher, on the scale low, medium, high, xhigh, max
    And the scout, already at low, runs at low and medium only
    And the report flags each turn whose answering model (message.model), requested model (requestedModel) or effort (perTurnEffort), read from the run's transcript, differs from the setting the round dispatched it with, and says zero when none does

  @ac-2
  Scenario: A run holds only when it is no worse than the current effort on the same sample
    Given a round 1 run and the current-effort run on the same sample
    When the report judges the run
    Then an executor run holds when the whole test suite passes on its result and the judge reports no more Must findings than on the current-effort run
    And a critic, reviewer, final-reviewer, auditor or verifier run holds when, for every Must the current-effort run reported on that sample, the judge rules that the run reported the same issue, whatever its wording
    And a planner run holds when accord gate plan passes and the judge reports no more Must findings than on the current-effort plan
    And an architect or scout run holds when the judge finds no wrong fact in it
    And the judge is a fresh reviewer or critic agent for each run, pinned to the same model and effort for every run of the round

  @ac-3
  Scenario: The report suggests an effort for each agent and changes none
    Given the round 1 runs, each judged held or not
    When the report is written
    Then it has one row per agent and effort with runs, runs held, median minutes, and median input, cache read, cache write and output tokens as separate columns
    And for each agent it suggests the lowest effort tried that held on all 5 samples, and the current effort when the lower one did not
    And it names every sample where the higher effort did better than the current effort: a finding role reported a Must the current run missed, or the judge found fewer Must findings in an executor's or planner's result
    And no agent definition under .claude/agents or packages/core changes

  @ac-4
  Scenario: The compliance check finds the four known breaches
    Given the transcripts and git history of BUG-LN-3 and ST-LN-7
    When the benchmark script runs its general compliance rules, which name no ticket, task or commit
    Then its compliance section lists BUG-LN-3 review round 4's fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus
    And it lists ST-LN-7 Task 1's commit 0496cf0 carrying a Co-Authored-By trailer
    And it lists ST-LN-7 Task 4's executor making its first edit to a source file before its first edit to a test file
    And it lists ST-LN-7 Task 2's accord task-done refusal, found in the transcript, over a verify test placed inside a describe
    And each line names the ticket, the task, and the transcript file or commit it was found in

  @ac-5
  Scenario: The compliance check scores every run against the other rules
    Given every accord agent run in the transcripts, every commit on main or a t/* branch, and every commit an executor run made according to its transcript
    When the benchmark script runs
    Then it lists each review that reached round 6 with no Ruling line in the ticket's ledger that allows going past the round cap
    And each executor run that received a second task or fix assignment instead of a fresh agent; a clarifying reply does not count
    And each brief quoting ticket text that does not appear unchanged in the ticket file as committed on the ticket's branch when the brief was dispatched
    And each commit message with a Co-Authored-By or Generated with line
    And it prints a count for every rule of this scenario and of @ac-4, zero included
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The benchmark runs chosen past samples at different settings; the existing transcripts alone cannot answer it (160 of 161 executor runs were sonnet at medium) — "tôi tưởng là chúng ta đưa lấy một vài mẫu. sau đó cho chạy từng model và effort khác nhau thì mới ra benchmark dc chứ?"
- D-02 Round 1 keeps each agent's current model and tries one effort step lower and one higher; tuning goes further only once a setting holds — "bạn cho ra 1 table đi. agent nào dc suggest model nào? rồi degrade effort 1 bậc, upgrade effort một bậc.  sau đó khi chạy mà vẫn ổn thì mới tunning tiếp"
- D-03 Advisor calls are not measured — "ko cần advisor nữa."
- D-04 The executor keeps its low step, with its 5 samples mixing plain tasks and risk:<kind> tasks, so the result also shows whether executor effort should follow the risk kind — "ok vậy làm đi"
- D-05 Done is round 1, its report with a suggested effort per agent, and the compliance check finding the four known breaches; later tuning rounds are other tickets; this ticket changes no agent's model or effort, the owner decides from the report — "A"
- D-06 The benchmark also scores process compliance from transcripts and git — "làm sao để ko thể nào quên chuyện này? tôi nghĩ phần benchmark phải đánh giá thật kỹ mới dc."
- D-07 Model and effort are read for each turn, not once per run: each `"type":"assistant"` line of `<session>/subagents/agent-<id>.jsonl` carries `message.model`, `requestedModel`, `effort` and `perTurnEffort`, and `agent-<id>.meta.json` names `agentType` and the dispatch `description` (checked 2026-10-18; scripts/benchmark.mjs:31-35 keeps only the first effort and the last model) — "vậy làm sao để strictly biết dc model đang chạy cho từng agent là gì? effort bao nhiêu?"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-21: "ko cần advisor nữa. giải thích cụ thể cách bạn sẽ đo như thế nào đi?"
- 2026-10-21: "tôi tưởng là chúng ta đưa lấy một vài mẫu. sau đó cho chạy từng model và effort khác nhau thì mới ra benchmark dc chứ? ý của bạn tôi ko rõ lắm"
- 2026-10-21: "bạn cho ra 1 table đi. agent nào dc suggest model nào? rồi degrade effort 1 bậc, upgrade effort một bậc.  sau đó khi chạy mà vẫn ổn thì mới tunning tiếp"

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
- Chosen: the benchmark script prepares every run itself. A committed sample list (9 agents × 5 samples: transcript file and agent id, ticket, task, base commit, the sample's main as a SHA, and every file the prompt names) feeds `node scripts/benchmark.mjs --round 1 --plan`, which checks the executor mix (D-04), copies or rebuilds each named file, rewrites only the brief's working-tree header lines and every ref to a SHA (the ticket text stays byte-identical, checked), creates one worktree per writing run on its own `bench/<tag>` branch and one shared per sample for read-only agents, runs the setup commands, confirms the suite is green at the base commit, and prints each dispatch: tag, agent, model, effort, brief file, and the pinned judge. The session only dispatches what it prints. The default run matches finished runs by tag, exits 2 naming every tag with zero or more than one run, runs the whole suite or `accord gate plan` itself in each executor or planner worktree, reads each judge's verdict, and writes the report.
- Why: every effort must get the identical sample, and hand-copying about 130 briefs before the transcripts expire is the recall failure the Intent names.
- Rejected: the session writes each brief and worktree by hand from a printed list — cheaper, but a mistyped tag or brief changes the sample unnoticed.
- Logic lives in pure modules beside the runner, the house pattern of `scripts/plan-review.mjs`: `scripts/round.mjs` (effort scale, run matrix, per-turn model and effort check of ac-1, hold rules, suggestion, table) and `scripts/compliance.mjs` (the ac-4 and ac-5 rules); `scripts/benchmark.mjs` reads every assistant line's `message.model`, `requestedModel`, `perTurnEffort` and the usage fields once per message id, follows `meta.toolUseId` into the parent session for the dispatch input and later `SendMessage` calls, and reads `git` across main, `t/*` and the commits an executor's transcript shows.
- A brief comes from its scratchpad file when that file predates the dispatch, otherwise from `accord brief` at the base commit, checked against the executor's Read result with line prefixes stripped.
- Compliance reads transcript folders passed explicitly and excludes the round's own tagged runs; it is run first, before the round adds commits.
- Affected: `scripts/` (benchmark.mjs, two new modules, the sample list), `packages/core/test/` (one test per criterion), and a report under `docs/benchmark/`; nothing under `.claude/agents` or `packages/core/agents` changes, nothing ships.
- Checked 2026-10-21: the Agent tool's `effort` overrides an accord agent's frontmatter effort, and sonnet runs at xhigh (probe runs: `perTurnEffort` medium for the scout, xhigh for the verifier; `meta.json` records `effort`).
- Risk, kept from the critic: the judge's verdict is free text, so hold rests on parsing it; a round that every effort passes, or none, is reported as such rather than suggesting an effort never measured.
- Risk, a real worktree removed: `--plan` records a path only after `git worktree add` succeeds and writes a marker in that worktree's own git dir; cleanup removes only marked worktrees. Undo: `git worktree add <path> t/<id>` and the setup commands; uncommitted work there is lost, which the marker rule exists to prevent.
- Risk, an executor escaping into a live checkout: a leftover path makes it commit on `main` or a `t/*` branch in `C:/Work/accord`. Undo: `git reflog`, `git reset --keep <branch>@{n}` when nobody committed since, `git branch -D` on a branch it made.
- Risk, a partial removal on Windows (a process still holding `node_modules`): stale `.git/worktrees` entries and folders. Undo: stop the node processes, `git worktree remove --force` on marked paths, `git worktree prune`, delete the folders.
- Tests: each criterion is one vitest test in `packages/core/test/` on the pure modules with synthetic transcript lines and a temporary git repository; ac-4 uses lines extracted from the real ST-LN-7 and BUG-LN-3 transcripts, since CI cannot read `~/.claude`. The real round on the owner's machine is the verify evidence for ac-1 to ac-3.
