# Round r2-replica: ST-LN-30 on the six scout arms, from runs already made

No new model run was made for this report. On 2026-11-04 the owner chose "Don't run, use old results (Recommended)", described as "Cost 0. Report the 18 existing ST-LN-30 runs from r2-scout as the one-ticket replication. Plan 01-05 then decides finish or widen." So this report stands in for the replica round, and round `r2-replica` in scripts/benchmark-rounds.json stays defined but was never dispatched.

Why the old runs are a replica of ST-LN-30. Round r2-scout (2026-11-02) ran sample 4, the scout that ran for ST-LN-30 before the ticket was built. It ran at the ticket's real base, a5506c0a, three times on each arm, and each brief was the original scout's first message from the backed-up transcript. A new r2-replica round would have repeated those runs with the same base, brief, scout definition and arms. The re-printed r2-replica briefs equal the original with only the repository folder changed, as r2-scout's did. The scout definition in the main checkout has not changed since r2-scout ran. The 18 first runs and 9 haiku repairs below are scored by script against the ticket's merged diff (ST-LN-46 D-03): 14 files. They use the functions on this branch (`matchNamed`, `scoreScoutRun`, `afterRepair`, `armReport`).

## How the replica still differs from the original run

- Brief: only the repository folder in lines 1 to 3 (`C:\Work\accord-st-ln-30` became the bench worktree).
- Model and effort: the original scout ran on haiku at effort low, so only the haiku low arm matches it; the other five arms differ on purpose.
- Scout definition: the original ran the 869-character definition at base, which has five rules and no report form. The arms ran today's 2131-character definition. It adds full repository paths, opening every named file, the wiring checklist, the research-records rule, and a fixed `## Files` / `## Absent` / `## Facts` form (b10b5547, 2026-11-02), all after the ticket's scout ran.
- Scoring: scout check tests that fixed form, which the original brief never asked for. The brief asks for facts with locations and allows a longer answer than the definition's 30-line cap.

## Why scout check failed

Every failure kind in the "What the check printed" section of the 18 repair briefs, as the number of first replies per arm that had at least one (failure lines in brackets in the last column):

| failure kind | haiku low | haiku medium | haiku high | sonnet low | sonnet medium | sonnet high | all 18 (lines) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| citation path shortened (a suffix of a tracked file) | 3 | 3 | 3 | 3 | 3 | 3 | 18 (412) |
| `## Files` lists "none" instead of leaving it empty | 1 | 2 | 1 | 0 | 0 | 0 | 4 (4) |
| `## Files` lists a path git does not track | 2 | 1 | 1 | 2 | 3 | 1 | 10 (24) |
| `## Absent` row contradicted by a match | 2 | 3 | 3 | 1 | 3 | 2 | 14 (91) |
| `## Absent` row malformed | 0 | 0 | 1 | 1 | 0 | 1 | 3 (7) |

Every reply shortened at least one citation path (a bare file name such as `worktree.ts` instead of its full path from the repository root), and that alone fails the check. Across all 72 r2-scout replies on the four samples the same holds: 72 of 72 shortened a path, and 59 of 72 had a contradicted `## Absent` row.

## Per run

Scout check per run (1 passes, 0 fails), runs 1 / 2 / 3:

| arm | scout check |
| --- | --- |
| haiku low | 0 / 0 / 0 |
| haiku medium | 0 / 0 / 0 |
| haiku high | 0 / 0 / 0 |
| sonnet low | 0 / 0 / 0 |
| sonnet medium | 0 / 0 / 0 |
| sonnet high | 0 / 0 / 0 |

Wiring recall per run, runs 1 / 2 / 3:

| arm | wiring recall |
| --- | --- |
| haiku low | 0.357 / 0.429 / 0.286 |
| haiku medium | 0.286 / 0.357 / 0.286 |
| haiku high | 0.357 / 0.429 / 0.5 |
| sonnet low | 0.357 / 0.5 / 0.286 |
| sonnet medium | 0.5 / 0.429 / 0.5 |
| sonnet high | 0.643 / 0.643 / 0.357 |

## Reading the winner lines

The winner lines below come from the script's fixed rule: the cheapest arm whose mean on every measure lies within the best arm's range. No arm passed scout check in any run, so every arm ties on that measure and the rule leans on cost. A winner here is not evidence that the arm writes a report that passes. On wiring recall alone, sonnet high has the highest mean (0.548) and haiku low costs about one thirteenth as much per run (222216 against 2951117).

## Cost

Actual weighted cost of this report: 0. No model was run. The estimates the owner saw before choosing were about 9.0M weighted tokens for one new run per arm with the haiku repairs, and about 27.1M for three runs per arm (prices haiku 1, sonnet 20, from 2026-11-02). The runs reported here were paid for in round r2-scout; their cost per run is in the tables below.

## Round r2-replica (r2-scout runs on ST-LN-30) benchmark: accord-scout

Samples 4; 3 runs per arm and sample. Cost per run is weighted tokens (fresh input 1, cache read 0.1, cache write 1.25, output 5) times the model's price factor from 2026-11-02. Suggestions only: this report changes no agent definition.

### Arms

| model | effort | runs | scout check passes: mean (range of pass means) | contradicted Absent rows: mean (range of pass means) | wiring recall: mean (range of pass means) | mean cost per run |
| --- | --- | ---: | --- | --- | --- | ---: |
| haiku | low | 3 | 0 (0 to 0) | 1.333 (0 to 3) | 0.357 (0.286 to 0.429) | 222216 |
| haiku | medium | 3 | 0 (0 to 0) | 3 (1 to 5) | 0.31 (0.286 to 0.357) | 308847 |
| haiku | high | 3 | 0 (0 to 0) | 3 (1 to 5) | 0.429 (0.357 to 0.5) | 580140 |
| sonnet | low | 3 | 0 (0 to 0) | 0.667 (0 to 2) | 0.381 (0.286 to 0.5) | 1908194 |
| sonnet | medium | 3 | 0 (0 to 0) | 1.333 (1 to 2) | 0.476 (0.429 to 0.5) | 2211355 |
| sonnet | high | 3 | 0 (0 to 0) | 1.667 (0 to 4) | 0.548 (0.357 to 0.643) | 2951117 |

### Best arm per measure

- scout check passes (highest is best): haiku low
- contradicted Absent rows (lowest is best): sonnet low
- wiring recall (highest is best): sonnet high

### Winner

Winner: haiku low, the cheapest arm whose mean on every measure lies within the pass-mean range of the best arm on that measure.

### Samples left out

None.

### Rows with no counted run

None.

## Round r2-replica (r2-scout runs on ST-LN-30) after one repair benchmark: accord-scout

Samples 4; 3 runs per arm and sample. Cost per run is weighted tokens (fresh input 1, cache read 0.1, cache write 1.25, output 5) times the model's price factor from 2026-11-02. Suggestions only: this report changes no agent definition.

### Arms

| model | effort | runs | scout check passes: mean (range of pass means) | contradicted Absent rows: mean (range of pass means) | wiring recall: mean (range of pass means) | mean cost per run |
| --- | --- | ---: | --- | --- | --- | ---: |
| haiku | low | 3 | 0 (0 to 0) | 0.667 (0 to 2) | 0.405 (0.357 to 0.429) | 368262 |
| haiku | medium | 3 | 0 (0 to 0) | 0 (0 to 0) | 0.357 (0.357 to 0.357) | 522756 |
| haiku | high | 3 | 0 (0 to 0) | 4 (3 to 5) | 0.476 (0.357 to 0.571) | 1066977 |
| sonnet | low | 0 | - | - | - | - |
| sonnet | medium | 0 | - | - | - | - |
| sonnet | high | 0 | - | - | - | - |

### Best arm per measure

- scout check passes (highest is best): haiku low
- contradicted Absent rows (lowest is best): haiku medium
- wiring recall (highest is best): haiku high

### Winner

Winner: haiku medium, the cheapest arm whose mean on every measure lies within the pass-mean range of the best arm on that measure.

### Samples left out

None.

### Rows with no counted run

- scout-4-sonnet-low-1-fix: its first reply fails scout check and has no counted repair run
- scout-4-sonnet-low-2-fix: its first reply fails scout check and has no counted repair run
- scout-4-sonnet-low-3-fix: its first reply fails scout check and has no counted repair run
- scout-4-sonnet-medium-1-fix: its first reply fails scout check and has no counted repair run
- scout-4-sonnet-medium-2-fix: its first reply fails scout check and has no counted repair run
- scout-4-sonnet-medium-3-fix: its first reply fails scout check and has no counted repair run
- scout-4-sonnet-high-1-fix: its first reply fails scout check and has no counted repair run
- scout-4-sonnet-high-2-fix: its first reply fails scout check and has no counted repair run
- scout-4-sonnet-high-3-fix: its first reply fails scout check and has no counted repair run
