# Workflow metrics at v0.4.0

Commit: 1e31a7013b28aa13780ba9cfce977b9d3d754f99 (2026-11-02)

## Method

- Records: every `accord/tickets/<id>/approach-review.md`, `plan-review.md` and `review.md` in the commit, read from git, not from the working tree.
- Counting rule of the 2026-11-02 study (`accord/research/2026-11-02-critic-loop-practice.md` §1): a record splits into cycles at each `## Closed` line (approach, plan) or `## Return from verify` line (review); a finding is a line that starts with Must, Should or Nice (after an optional list marker or number), `repeats` findings and Nice included, and it counts in the round of the `## Round <n>` heading above it, `n` read from the heading. Rounds run at r is the number of cycles whose highest round is r or more; the 5+ row sums r = 5 up to the highest round and holds the findings of rounds 5 and later. Must + Should per round is (Must + Should) / rounds run.
- Lines inside fenced code blocks (``` or ~~~) are left out, as accord's own record parser does.
- At 2266d21f this rule gives every row of the study's plan table exactly, though it counts 47 plan cycles where the study's text says 45. Its review counts there (65 cycles, 487 findings) differ from the study's 63 cycles and 481 findings, because the study's review regex was not kept; the rule is not tuned toward those figures.

## Approach

Records: 0
Cycles: 0

| Round | Rounds run | Must | Should | Nice | Must + Should per round |
|---|---:|---:|---:|---:|---:|
| 1 | 0 | 0 | 0 | 0 | 0.0 |
| 2 | 0 | 0 | 0 | 0 | 0.0 |
| 3 | 0 | 0 | 0 | 0 | 0.0 |
| 4 | 0 | 0 | 0 | 0 | 0.0 |
| 5+ | 0 | 0 | 0 | 0 | 0.0 |

## Plan

Records: 35
Cycles: 46

| Round | Rounds run | Must | Should | Nice | Must + Should per round |
|---|---:|---:|---:|---:|---:|
| 1 | 46 | 33 | 183 | 119 | 4.7 |
| 2 | 44 | 6 | 56 | 30 | 1.4 |
| 3 | 26 | 1 | 27 | 16 | 1.1 |
| 4 | 18 | 1 | 8 | 15 | 0.5 |
| 5+ | 21 | 2 | 16 | 10 | 0.9 |

## Review

Records: 62
Cycles: 64

| Round | Rounds run | Must | Should | Nice | Must + Should per round |
|---|---:|---:|---:|---:|---:|
| 1 | 64 | 2 | 86 | 187 | 1.4 |
| 2 | 56 | 1 | 34 | 58 | 0.6 |
| 3 | 26 | 1 | 10 | 19 | 0.4 |
| 4 | 12 | 1 | 3 | 16 | 0.3 |
| 5+ | 21 | 4 | 23 | 34 | 1.3 |

## Critic and planner runs

- Runs of `accord-critic`, `accord-planner` and `accord-architect` in the Claude Code project folders of this repository and its worktrees, read as `scripts/benchmark.mjs` reads them (usage the max per message id). A run counts when it started at or before the commit's time and its ticket has a file under `accord/tickets/<id>/` in the commit; a run described `bench …` is a benchmark arm and is left out.
- Weighted tokens: fresh x1, cache-write x1.25, cache-read x0.1, output x5, rounded per run. Peak: the largest single-message context. Minutes: active time, a gap over 10 minutes not counted. Medians of an even count are the mean of the two middle runs.

Transcripts: 43 folders, 534 runs counted

| Run class | Runs | Weighted Mtok | Median weighted k | Median peak k | Median minutes |
|---|---:|---:|---:|---:|---:|
| critic: plan round 1, lens criteria | 33 | 18.4 | 511 | 113 | 6.8 |
| critic: plan round 1, lens build | 33 | 39.3 | 1118 | 181 | 11.2 |
| critic: plan round 1, lens security | 19 | 8.9 | 383 | 96 | 5.8 |
| critic: plan round 1, no lens | 50 | 22.7 | 390 | 95 | 5.3 |
| critic: plan later, whole | 32 | 31.3 | 831 | 163 | 9.9 |
| critic: plan later, diff | 64 | 12.4 | 170 | 61 | 2.5 |
| critic: approach, first | 86 | 36.0 | 350 | 86 | 5.1 |
| critic: approach, later | 6 | 3.7 | 626 | 121 | 9.4 |
| planner: writing | 124 | 111.8 | 483 | 114 | 6.0 |
| planner: fix | 87 | 29.7 | 209 | 75 | 2.9 |
