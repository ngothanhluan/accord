## Files
- `scripts/round.mjs` — arms, matrix, judge brief, hold rule, report, `scripts/round.mjs:91`
- `scripts/benchmark.mjs` — flags, transcript reading, bench root, report writer, `scripts/benchmark.mjs:1161`
- `scripts/benchmark-samples.json` — scout samples, `scripts/benchmark-samples.json:710`
- `scripts/fixed-context.mjs` — only existing cost weighting, `scripts/fixed-context.mjs:465`
- `packages/cli/src/commands/scout.ts` — `accord scout check`, `packages/cli/src/commands/scout.ts:12`
- `packages/core/src/scout/check.ts` — checks, `packages/core/src/scout/check.ts:127`
- `packages/cli/src/run.ts` — registers scout check, `packages/cli/src/run.ts:237`
- `docs/benchmark/round-1.md` — round result, `docs/benchmark/round-1.md:7`

## Absent
| Claim | Pattern | Folders | Allowed hits |
|---|---|---|---|
| no retention/30-day/cleanupPeriod snapshot logic in scripts or docs (search logged; only unrelated template text and its generated copies match) | `retention\|30-day\|30 day\|cleanupPeriod` | `scripts/`, `packages/`, `docs/` | `packages/core/templates/business-rules.md`, `packages/core/src/generated/templates.ts`, `packages/core/dist/index.js`, `packages/core/dist/index.d.ts`, `packages/cli/dist/cli.js` |
| no other use of commitFacts or gitTreeAt in the CLI | `commitFacts\|gitTreeAt` | `packages/cli/src` | `packages/cli/src/commands/scout.ts`, `packages/cli/src/load/fs.ts` |
| no expected answer or true file list in sample entries | `expected\|answer\|trueFiles\|truth` | `scripts/benchmark-samples.json` | none |

The old "no model column" row is dropped: `model` matches many lines, so the search does not hold. It stays as a fact below.

## Facts
- `EFFORTS = low,medium,high,xhigh,max`, `scripts/round.mjs:5`. `steps(effort)` gives the current effort and one either side, `scripts/round.mjs:22`. `runMatrix` makes one row per sample per step, with model and effort from `settings[agent]`, `scripts/round.mjs:91`. There is no model axis.
- `agentSettings` reads model and effort from the frontmatter of `.claude/agents/<agent>.md`, `scripts/benchmark.mjs:410`. `JUDGE = { model: 'opus', effort: 'high' }`, `scripts/round.mjs:20`. `turnFlags` flags turns whose model or effort differ from the dispatched setting, `scripts/round.mjs:104`.
- The script does not launch arm runs. `--round 1 --plan` prints the dispatch table for the coordinating session, `scripts/round.mjs:208` and `scripts/benchmark.mjs:994`. Descriptions are `bench r1 <agent>-<n>-<effort>`, `scripts/round.mjs:27`.
- The only `claude -p` spawn is the fixed-context probe, `scripts/benchmark.mjs:1393`.
- `--plan` saves rows and worktrees to `<bench>/round-1.json`, `scripts/benchmark.mjs:896`. `matchRuns` matches transcripts to rows by description, `scripts/round.mjs:305`. `--rerun` takes writer rows only (executor, planner, verifier), `scripts/round.mjs:19`. The plan lists every row, so nothing skips arms already run, and I found no score cache.
- `checkSamples` hard-codes round 1 and 5 samples for each of the nine agents, `scripts/round.mjs:34`. `tagOf` and `describe` hard-code "r1", `scripts/round.mjs:27`.
- Usage line with the flags `--compliance`, `--round 1` (`--samples`, `--plan`, `--rerun`, `--judge`), `--clean`, `--fixed`: `scripts/benchmark.mjs:1161`. With no flag it prints the legacy report, `scripts/benchmark.mjs:1164`.
- `readSessions` reads `~/.claude/projects` transcripts and subagent files, `scripts/benchmark.mjs:314`. `parseRun` collects turns, reads, edits and commits, `scripts/benchmark.mjs:220`. `runSamples` falls back to another project folder with the same session tail, `scripts/benchmark.mjs:635`.
- Bench root is `<repo>/../accord-bench`, `scripts/benchmark.mjs:419`. `snapshotSample` writes `<bench>/samples/<agent>-<n>/sample.json` and `root-reads.json`, `scripts/benchmark.mjs:545`. It never overwrites a snapshot, `scripts/benchmark.mjs:550`. It rewrites the brief to bench paths, `scripts/benchmark.mjs:586`. Its comment says that once the transcripts expire it is the only copy, and it covers only the round-1 listed samples (`--samples`, `scripts/benchmark.mjs:635`).
- Usage is `{input, cacheRead, cacheWrite, output}`. Output is the larger of the recorded value and chars/4, marked `~`, `scripts/benchmark.mjs:290` and `scripts/round.mjs:396`. Minutes are active time with gaps over 10 min capped, `scripts/benchmark.mjs:305`. The report shows median min, input, cache read, cache write and output, `scripts/round.mjs:411`. round.mjs has no cost weighting.
- Cost weighting (fresh input 1, cache read 0.1, cache write 1.25) exists only in `scripts/fixed-context.mjs:465`. Output is added at 5, `scripts/fixed-context.mjs:529`. The round report does not use it.
- Scout samples are `accord-scout` n=1..5 at `scripts/benchmark-samples.json:710`. Tickets: ST-LN-26, ST-LN-31, ST-LN-33, ST-LN-30, ST-LN-8. Entry keys are `agent, n, transcript, ticket, base, main, root, elsewhere, files, pairs`, `scripts/benchmark-samples.json:710`. The prompt is not in the file; `--samples` stores it in `<bench>/samples/scout-<n>/sample.json`. Top level `"round": 1`, `scripts/benchmark-samples.json:2`.
- The scout role is `fact`, `scripts/round.mjs:15`. The judge is `accord-critic`, opus, high, `scripts/round.mjs:97`. The `judgeBrief` fact kind says to check every fact against the code at commit `<base>` and to answer `wrong facts: <n>`, `scripts/round.mjs:292`. `held` means `wrongFacts === 0`, `scripts/round.mjs:256`. `parseVerdict('fact')` reads the last `wrong facts: N` line, `scripts/round.mjs:234`. Duplicate judge runs are flagged, `scripts/round.mjs:324`.
- Round-1 results: scout low held 0/5 and medium 1/5, `docs/benchmark/round-1.md:33`. Haiku was the only model, `docs/benchmark/round-1.md:48`. Judges count differently, `docs/benchmark/round-1.md:304`. Judges read transcripts beyond their brief, `docs/benchmark/round-1.md:305`. The "2 to 5 wrong facts per run" figure is in the ticket, not in round-1.md.
- `accord scout check <file> [--ticket <id>]` is registered at `packages/cli/src/run.ts:237`. An unreadable file or unknown ticket throws UsageError (exit 2), `packages/cli/src/commands/scout.ts:74` and `:80`, `:77`, `:85`.
- Checks are in `packages/core/src/scout/check.ts:127`: missing `## Files` (`:132`), untracked or already-tracked entries (`:134`), citations (`:142`), absent rows (`:160`), lane numbers (`:110`, `:188`). The report and the ticket's own files are excluded, `packages/core/src/scout/check.ts:85`.
- Output format is `packages/cli/src/commands/scout.ts:12`. Exit is 0 with no failures and 1 with failures, `packages/cli/src/commands/scout.ts:89`.
- `scoutCheckCommand` always uses `workingFacts`, `packages/cli/src/commands/scout.ts:87`. `commitFacts(root, commit)` is at `packages/cli/src/commands/scout.ts:93` and is called only from `scoutRefusal`, `packages/cli/src/commands/scout.ts:132`. `run.ts` passes only `--ticket`, `packages/cli/src/run.ts:239`. Config and the rendered-path list still come from the working tree, `packages/cli/src/commands/scout.ts:48`.
- `gitTreeAt` is defined at `packages/cli/src/load/fs.ts:1257`.
- `writeReport` always writes `docs/benchmark/round-1.md`, `scripts/benchmark.mjs:1169`. The folder holds `2026-10-16.md`, `fixed-context.md`, `round-1.md`.
- There is no model column in the results table: its header is `agent | effort | runs | runs held | median min | median input | median cache read | median cache write | median output`, `docs/benchmark/round-1.md:7`, generated at `scripts/round.mjs:411`. Model appears only in the suggested-effort table, `docs/benchmark/round-1.md:38`, generated at `scripts/round.mjs:413`.

Skipped: `scripts/benchmark.mjs` 1190-1542, `loadRound`, `runPlan` setup, and `scripts/fixed-context.mjs` beyond the weighting lines; the two `research:` records. I did not count the 45-sample total in the JSON (9 agents x 5, from `checkSamples`, `scripts/round.mjs:39`). The corrected reply has not been re-run through `accord scout check`; I re-verified the three Absent patterns by search only.
