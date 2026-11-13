# Workflow metrics at st-ln-91-plan-format

Commit: b057d1359285fe26770d5332c71d68f990adf1d3 (2026-11-13)

## Method

- Records: every `accord/tickets/<id>/approach-review.md`, `plan-review.md` and `review.md` in the commit, read from git, not from the working tree.
- Counting rule of the 2026-11-02 study (`accord/research/2026-11-02-critic-loop-practice.md` §1): a record splits into cycles at each `## Closed` line (approach, plan) or `## Return from verify` line (review); a finding is a line that starts with Must, Should or Nice (after an optional list marker or number), `repeats` findings and Nice included, and it counts in the round of the `## Round <n>` heading above it, `n` read from the heading. Rounds run at r is the number of cycles whose highest round is r or more; the 5+ row sums r = 5 up to the highest round and holds the findings of rounds 5 and later. Must + Should per round is (Must + Should) / rounds run.
- Lines inside fenced code blocks (``` or ~~~) are left out, as accord's own record parser does.
- At 2266d21f this rule gives every row of the study's plan table exactly, though it counts 47 plan cycles where the study's text says 45. Its review counts there (65 cycles, 487 findings) differ from the study's 63 cycles and 481 findings, because the study's review regex was not kept; the rule is not tuned toward those figures.

## Approach

Records: 1
Cycles: 1

| Round | Rounds run | Must | Should | Nice | Must + Should per round |
|---|---:|---:|---:|---:|---:|
| 1 | 1 | 1 | 5 | 1 | 6.0 |
| 2 | 1 | 0 | 2 | 1 | 2.0 |
| 3 | 1 | 0 | 0 | 1 | 0.0 |
| 4 | 0 | 0 | 0 | 0 | 0.0 |
| 5+ | 0 | 0 | 0 | 0 | 0.0 |

## Plan

Records: 36
Cycles: 47

| Round | Rounds run | Must | Should | Nice | Must + Should per round |
|---|---:|---:|---:|---:|---:|
| 1 | 47 | 34 | 187 | 121 | 4.7 |
| 2 | 45 | 6 | 57 | 30 | 1.4 |
| 3 | 27 | 1 | 27 | 17 | 1.0 |
| 4 | 18 | 1 | 8 | 15 | 0.5 |
| 5+ | 21 | 2 | 16 | 10 | 0.9 |

## Review

Records: 63
Cycles: 65

| Round | Rounds run | Must | Should | Nice | Must + Should per round |
|---|---:|---:|---:|---:|---:|
| 1 | 65 | 2 | 86 | 191 | 1.4 |
| 2 | 57 | 1 | 35 | 61 | 0.6 |
| 3 | 26 | 1 | 10 | 19 | 0.4 |
| 4 | 12 | 1 | 3 | 16 | 0.3 |
| 5+ | 21 | 4 | 23 | 34 | 1.3 |

## Plan format (ST-LN-91 D-09)

Task length cap: 120 non-blank lines; refuses 12 of 322 tasks in 11 of 49 plans

Each plan is read by core's own loadSnapshot; a task is measured with core's own `taskLength` (non-blank lines under its heading as `accord brief` prints them: comment lines and fenced lines counted) against `TASK_LINE_CAP`. The fence and after: counts are the findings of core's own `gatePlan` with every ticket at the pin the format rules read, so this report and the gate cannot disagree. Only lane tickets other than S with a plan are counted.

Plans with a fenced block other than interfaces: 26 of 49
Tasks with a fenced block other than interfaces: 67 of 322
Plans with a task lacking after:: 49 of 49

Task length in non-blank lines (nearest rank):

| p50 | p90 | p95 | max |
|---:|---:|---:|---:|
| 47 | 102 | 119 | 202 |

Plan files in the commit: 49

## Critic and planner runs

- Runs of `accord-critic`, `accord-planner` and `accord-architect` in the Claude Code project folders of this repository and its worktrees, read as `scripts/benchmark.mjs` reads them (usage the max per message id). A run counts when it started at or before the commit's time and its ticket has a file under `accord/tickets/<id>/` in the commit; a run described `bench …` is a benchmark arm and is left out.
- Weighted tokens: fresh x1, cache-write x1.25, cache-read x0.1, output x5, rounded per run. Peak: the largest single-message context. Minutes: active time, a gap over 10 minutes not counted. Medians of an even count are the mean of the two middle runs.

Transcripts: not measured

| Run class | Runs | Weighted Mtok | Median weighted k | Median peak k | Median minutes |
|---|---:|---:|---:|---:|---:|
| critic and planner runs | not measured | not measured | not measured | not measured | not measured |
