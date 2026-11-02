---
id: "ST-LN-46"                            # equals the file name: tickets/<id>.md
title: "Benchmark round 2 chooses the scout's model and effort from six arms, on a harness the executor and planner benchmarks reuse"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-14", "ST-LN-81"]
research: ["accord/research/2026-11-02-benchmark-per-agent.md", "accord/research/2026-11-02-scout-trust.md", "accord/research/2026-11-02-scout-benchmark.md"]
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
Why: the scout's model and effort were never measured beyond haiku at low and medium (round 1 held 0 of 5 and 1 of 5 on wrong facts alone); the shipped default is haiku low, this repository runs sonnet low unmeasured, and the scout's real faults are false "only"/"none" claims and missed wiring files, which round 1 did not score.
For: the owner choosing the scout's default from evidence (quality > cost > speed), and ST-LN-89 (executor) and ST-LN-90 (planner), which run on the harness built here.
Success: a committed round 2 report runs six arms (haiku and sonnet at low, medium and high) on the same samples, scores each run by script on scout check, false "only"/"none" claims and wiring recall against the files the ticket's merged diff changed, shows cost-weighted figures, and names the cheapest arm that ties the best one within the spread of repeated runs.
The harness takes the model as an arm, reuses runs already made, and a hand-run step gathers a done ticket's runs as samples with snapshots; transcripts a sample needs are snapshotted before about 2026-11-11.
Not here: changing the scout's default or this repository's config (D-01); the executor, planner and other roles; routing per request; a shipped skill for gathering samples.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-46

  @ac-1
  Scenario: A round plan lists every sample for every model and effort arm
    Given a round for accord-scout whose arms are the models haiku and sonnet, each at the efforts low, medium and high, with three runs per arm
    When the round plan is printed
    Then every sample appears three times for each of the six arms, each row naming that arm's model and effort
    And a round for another agent, with its own list of model and effort arms, is planned the same way without a change to the script

  @ac-2
  Scenario: Each scout run is scored by script on the three measures
    Given a finished scout run on a sample whose ticket's merged diff changed a known set of files that existed before it
    When the round is scored
    Then the run's row shows whether its reply passes accord scout check, how many of its "only" or "none" claims a search of the repository at the sample's commit contradicts, and the share of that set of files whose full repository path its reply names
    And scoring the same run again gives the same row

  @ac-3
  Scenario: The report names the cheapest arm that ties the best one
    Given every arm has scored runs on every sample
    When the round report is written
    Then each arm shows, per measure, its mean and the lowest-to-highest range over its runs, and its mean cost per run weighted fresh input 1, cache read 0.1, cache write 1.25 and output 5
    And the report names the arm with the lowest mean cost per run whose mean on each of the three measures lies within the range of the arm that is best on that measure, or the best arm when no cheaper one does

  @ac-4
  Scenario: Runs already made are not run again
    Given a round where some rows already have a matched run, scored or not
    When the round plan is printed again
    Then only the rows with no matched run are listed to dispatch, a matched run that is not scored yet is scored without being run again, and the report counts every scored run

  @ac-5
  Scenario: A done ticket's runs become snapshotted samples
    Given a ticket that reached done, whose accord agent runs are still in the transcripts
    When the gathering step runs with that ticket's id
    Then each accord agent run of that ticket is added as a sample with the files its merged diff changed that existed before it, and its transcript, its prompt and the files it read are snapshotted under the bench root
    And running the step again for the same ticket adds and overwrites nothing
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The ticket holds six parts: the six scout arms; the new scoring (scout check, false "only"/"none" claims, wiring recall against a true file list per sample); the shared harness (model axis, cost-weighted report, reuse of earlier results, each run judged more than once); a hand-run step that gathers a done ticket's runs as samples and snapshots them; the round 1 measurement fixes; and the snapshot of needed transcripts before about 2026-11-11. Changing the scout's shipped default or this repository's config from the result is not part of it — "A" (2026-11-02, option a of the parts question: keep all six; options b, split out the gathering step, and c, also change the scout's default here, not chosen)
- D-02 A cheaper arm keeps quality when it ties the best arm on all three measures (scout check passes, false "only"/"none" claims, wiring recall) within the spread that repeated runs of the same sample show; the cheapest arm that ties wins; no fixed threshold — "A" (2026-11-02, option a of the quality-bar question; b, a fixed threshold, and c, both, not chosen)
- D-03 A sample's true file list is the existing files its ticket's merged diff changed, computed by the script with no hand edit, the same measure as the 0.94 / 0.60 recall in accord/research/2026-10-30-harness-architecture.md — "A" (2026-11-02, option a of the true-list question; b, the diff edited by hand, and c, the union of every arm's files edited by hand, not chosen)
- D-04 The smallest version that counts as done is all six parts of D-01 — "A" (2026-11-02, option a of the smallest-version question; b, the scout benchmark, harness and snapshot only, with gathering and the round 1 fixes deferred, not chosen)
- D-05 Each arm runs every sample three times, and the range D-02 compares against is the range of those runs — "A" (2026-11-02, option a of the runs question: three runs, as the spec's matrix sets; b, five runs, and c, one run, not chosen)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
- Option: Named arm rounds on the round-1 harness.
- What it does: round definitions become data in a new `scripts/benchmark-rounds.json` (`{ agent, arms: [{model, effort}], runs, judges, samples }`); rows are sample × arm × run k; each named round has its own state `<bench>/round-<name>.json`, report `docs/benchmark/round-<name>.md`, descriptions `bench <name> <tag>` and worktrees. `--round <name> --plan` first matches transcripts and scores any matched run not yet scored (scores kept in the state file), then prints only rows with no matched run, plus judge rows for matched runs short of judges. The scout is scored by script at the sample's commit: core `scoutCheck` on the reply over the sample worktree's tracked files, with `--ticket` semantics; false claims = distinct `## Absent` rows whose re-run search hits outside their allowed hits; recall = share of truth paths the reply names in full, the truth being the files the ticket's merges into the default branch changed (modified or deleted, no renames). `--round <name>` writes per arm and measure the mean and range, the mean weighted cost (1 / 0.1 / 1.25 / 5), and the cheapest arm that ties the best. `--gather <id>` appends a done ticket's accord agent runs to a new `scripts/benchmark-gathered.json` with truth and replay fields, snapshots transcript, prompt, reads and replay files under `<bench>/samples/`, and skips a transcript already listed. Round 1 fixes: minutes end at the last hand-back; each run shows how many other round runs overlapped it; k judges per run with their spread; a judge whose tool calls touch the transcript folders is not counted; scores cached so finished runs are never re-run. Round 1's list, modes and report stay as they are.
- Impact, changed: scripts/round.mjs:27-29 (`tagOf`, `describe`, `judgeDescribe` hard-code r1); scripts/round.mjs:91-100 (`runMatrix`, no model axis); scripts/round.mjs:305-330 (`matchRuns`, matches on the r1 description at :317); scripts/round.mjs:390-425 (`report`, "Round 1", raw medians); scripts/round.mjs:208-214 and :230-244 (`dispatchTable`, `parseVerdict`, reused for k judges); scripts/benchmark.mjs:220-312 (`parseRun`, minutes at :305, hand-back times at :281-284); scripts/benchmark.mjs:1134-1166 (`main`, usage :1161: `--round <name> [--plan]`, `--gather <id>`); scripts/benchmark.mjs:872-997 (`runPlan`, :896), :1016-1026 (`loadRound`, :1019), :1169-1174 (`writeReport`), :1203-1224 (`stopOnEscape`, :1204), which name round-1 files directly.
- Impact, reused unchanged: scripts/benchmark.mjs:545-606 (`snapshotSample`, never overwrites, :550), :314 (`readSessions`), :449 (`defaultRef`), :464 (`branchCommits`), :1502-1518 (`doneTickets`), :767 (`prepareWorktree`); scripts/fixed-context.mjs:529 (the inline whole-cost formula, mirrored); scripts/compliance.mjs:37 (leaves out descriptions starting `bench r`); packages/core/src/index.ts:53-54 (`parseScoutReport`, `scoutCheck`); packages/core/src/scout/check.ts:162,183 (absent-claim failure text); packages/cli/src/commands/scout.ts:87; packages/cli/src/run.ts:83-86 (version pin refuses the current CLI in a worktree at an old base).
- Impact, new or data: scripts/benchmark-rounds.json, scripts/benchmark-gathered.json, docs/benchmark/round-r2-scout.md (written by the hand-run round at verify); scripts/benchmark-samples.json read, not changed (scout sample 3, ST-LN-33, was dropped and has no merged diff).
- Impact, tests: packages/core/test/benchmark-round.test.ts:28 and :239-295, packages/core/test/benchmark-samples.test.ts:96-106, packages/core/test/benchmark-worktree.test.ts:185,730 stay green unchanged; new packages/core/test/benchmark-arms.test.ts and packages/core/test/benchmark-gather.test.ts.
- Not touched (D-01): packages/core/src/skills/agents.ts:15, accord/config.yml:32, .claude/agents/accord-scout.md.
