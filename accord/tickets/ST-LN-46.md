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
    Then each arm shows, per measure, its mean and the lowest-to-highest range of its pass means, a pass being its k-th run over every sample, and its mean cost per run, tokens weighted fresh input 1, cache read 0.1, cache write 1.25 and output 5, times the price factor of its model in the round definition
    And the report names the arm with the lowest mean cost per run whose mean on each of the three measures lies within the pass-mean range of the arm that is best on that measure (highest for scout check passes and recall, lowest for false claims, the cheapest of equally best arms; a pass counts only with a run on every sample), or the best arm when one arm is best on all three and no cheaper one ties, or no winner and the best arm of each measure when the measures have different best arms and no arm ties all three

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
- D-06 The range D-02 compares against is the lowest-to-highest of an arm's pass means, a pass being its k-th run over every sample, not the range of single runs — "as recommended" (2026-11-02, translated; option b of the range question, chosen over a, single runs, under which one failed scout check gives every arm the range 0 to 1)
- D-07 When the three measures have different best arms and no arm ties all three, the report names no winner and lists the best arm of each measure for the owner to choose — "as recommended" (2026-11-02, translated; option a of the no-single-best question, chosen over b, a fixed order of measures)
- D-08 An arm's cost is its weighted tokens times its model's price factor, set in the round definition from the price list current when the round runs — "as recommended" (2026-11-02, translated; option a of the model-price question, chosen over b, tokens only)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
- Option: Named arm rounds on the round-1 harness.
- Round definitions: data in a new `scripts/benchmark-rounds.json`, each `{ agent, arms: [{model, effort}], runs, judges, prices: {<model>: <factor>}, pricesAt, samples }`; `prices` from the price list current when the round runs, `pricesAt` its date (D-08). `--plan` exits 2 on a model with no positive price, an effort outside `EFFORTS`, or a name not matching `r[a-z0-9-]+` or equal to `r1`. A row is sample × arm × run k, tag `<agent>-<n>-<model>-<effort>-<k>`, description `bench <name> <tag>`. Rows carry no `current`: the named path reuses only the `runPlan` steps that read no `current` (worktree, overlay, verifier report, brief); `holds`, `better`, `byDefault`, `suggest` and the base-suite step stay round-1 only. One scorer per agent, only `accord-scout` here; a round for an agent with no scorer still plans and prints its table, and `--round <name>` exits 2 naming the missing scorer. Each named round has its own state `<bench>/round-<name>.json`, report `docs/benchmark/round-<name>.md` and worktrees.
- Bench root: every named-round mode, `--gather` and the named-round guard of `--clean` use `benchRoot` of the main checkout (the folder of `git rev-parse --path-format=absolute --git-common-dir`, as `--fixed` resolves it), never `../accord-bench` of the checkout they run in; each mode prints that absolute bench root on its first line.
- `--round <name> --plan`: matches transcripts, scores each matched run with no score and caches it in the state keyed by tag and transcript; a scored row is never listed again nor replaced by a worktree rebuild. Each sample's worktree, overlay and brief steps run under one try: a sample failing any step is left out with its reason printed and kept in the state, and the plan goes on; it exits 2 only when no sample is left. It then prints only rows with no matched run, plus judge rows for matched runs with fewer judges than the round asks.
- Brief step: moved out of `runPlan` into a function taking the ticket text; round 1 passes the text it reads today; a named round reads it with `showAt` and passes `''` when the ticket does not exist at the sample's base (a lane scout); `rewriteBrief` accepts `''` (no id, whole text rewritten).
- Samples: a scout round takes every scout sample whose ticket has a merge — round 1's samples 1, 2, 4 and 5 (sample 3, ST-LN-33, has no merge) plus every gathered scout sample; the report names each sample left out and why. Recall is scored on every sample, whatever its brief asks. Truth per sample: the union over each first-parent merge into the default branch whose subject names `t/<id>` of the files it modified or deleted (`--no-renames --diff-filter=MD`, merge base to branch tip), kept only where tracked at the sample's base (D-03).
- Scout scoring at the sample's commit: scout check = core `scoutCheck` on the reply with the sample worktree's tracked files, passing the sample's ticket as `--ticket` does, and no ticket when the ticket did not exist at its base (a lane scout). False claims = distinct `## Absent` rows whose re-run search hits outside their allowed hits, plus contradicted prose claims: a reply line matching `\b(only|none|no other|not found)\b` (case-insensitive) outside fences, the Absent table and a `Skipped:` line, checked only when it states its own scope — exactly one backticked non-path token (its subject) and at least one backticked path or folder tracked at the sample's commit once any `:<line>` suffix is cut; it becomes an Absent row checked by the same `scoutCheck`, pattern the escaped subject bounded by `(?<![A-Za-z0-9_$])` and `(?![A-Za-z0-9_$])`, folders the folders the line names plus the folder of each file it names that is not at the repository root (a root file such as `README.md` adds no folder, so a line naming only root files has no folder), allowed hits the tracked files the line names once any `:<line>` suffix is cut, plus each tracked file the reply cites anywhere at a line (`citations` of `parseScoutReport`, packages/core/src/scout/report.ts:122; a single line, every line of an `<a>-<b>` range and each item of a comma list, read from the citation's text after its path, since `numbers` holds only a range's two ends) where one cited line of that file at the sample's commit matches the pattern, so a definition cited on another line (as `scripts/round.mjs:164` for `rewriteBrief`) is not a contradiction, while a file the reply names or cites only for another fact stays searched (as scripts/benchmark.mjs, which calls `rewriteBrief`); a subject already in an Absent row's claim or pattern is not counted twice; prose claims with no subject, more than one, or no folder are counted and shown per arm beside the measure, not in it. Recall = share of truth paths the reply names in full.
- `--round <name>` report: per arm and measure, the mean and the lowest-to-highest range of pass means, a pass being run k over every sample and counting only when complete (D-06); per arm, mean cost per run = (fresh input + 0.1 cache read + 1.25 cache write + 5 output) × the model's price factor (D-08); best = highest for scout check and recall, lowest for false claims, cheapest among equally best; winner = cheapest arm whose mean on all three lies inside the best arm's range on each (D-02); when the best arms differ and none ties all three, no winner and the best arm of each measure (D-07).
- `--gather <id> [<transcript>...]`: exits 2 when the ticket's file on the default branch has an empty `verified_hash` or its branch has no merge; reads the main checkout's transcript folders. Runs of the ticket: every `accord-*` run whose description or branch names the id, leaving out `bench ` runs and probes; every `accord-scout` run naming no ticket when the same main-session transcript later commits `scout: <id> report` and the run ended before that commit and after the session's previous `scout:` commit; every transcript named on the command line. Copies each new run byte for byte, before any check, to `<bench>/samples/gathered/<id>/<agent>-<run id>/` (`transcript.jsonl`, `meta.json`, `prompt.md`, `reads.json` with every read's text) and prints the absolute folder; then appends to a new `scripts/benchmark-gathered.json` the truth, a base (the last commit on the run's branch before the dispatch, from merged history), `ticketAtBase`, n numbered after the agent's round-1 samples, and `replay: {ok, problems}` from `sampleDrift` and `rewriteBrief`. A ticket missing at base is a replay problem except for a scout run tied by the `scout: <id> report` rule, which records `ticketAtBase: false`. A sample failing replay is kept and rounds leave it out by name. A re-run skips a transcript tail already listed and never overwrites a file. It prints untied `accord-scout` runs that ended in the 24 hours before the ticket's claim commit, for the owner to name.
- Round 1 fixes: minutes end at the last hand-back; each run shows how many other round runs overlapped it; k judges per run with their spread; a judge whose tool calls touch the transcript folders is not counted; cached scores, so finished runs are never re-run.
- `--clean`: refuses while any `<bench>/round-<name>.json` of the main checkout's bench root holds a row with no cached score (`--force` overrides as today); prints `<branch> <tip sha>` before each `branch -D`.
- Failure handling (data deletion): (1) gather's copies not where a round reads them (refused, interrupted, or run from a non-sibling checkout) — raw copies are written before any check and the entry after; the bench root is the main checkout's and gather prints the folder it wrote; a round lists a gathered entry with no snapshot folder as left out, "no snapshot under <bench>"; undone by re-running `--gather <id>`, moving a folder written elsewhere into `<main bench>/samples/gathered/<id>/`, or reverting `scripts/benchmark-gathered.json`; no mode deletes under `<bench>/samples/`. (2) `--clean` mid-round — refused while a named round has unscored rows, and scored rows are never replaced; undone by `--round <name> --plan` rebuilding worktrees, a deleted branch restored with `git branch <name> <sha>` from the printed line, unscored runs re-dispatched after a `--force` clean. (3) a lane scout never tied to its ticket — not undoable once the transcript expires; before that `--gather` lists untied scout runs near the claim for the owner to name, and the gathering task runs on the needed tickets before about 2026-11-11.
- Round 1's list, modes and report stay unchanged. `benchmark.mjs` loads `packages/core/dist/index.js` and passes `scoutCheck` to a pure scorer.
- Impact, changed: scripts/round.mjs:27-29 (`tagOf`, `describe`, `judgeDescribe`), :91-100 (`runMatrix`), :305-330 (`matchRuns`, :317), :390-425 (`report`), :208-214 and :230-244 (`dispatchTable`, `parseVerdict`); scripts/benchmark.mjs:220-312 (`parseRun`, minutes :305, hand-backs :281-284), :808-835 (`cleanWorktrees`, `runClean`, guard :809, `branch -D` :819), :1134-1166 (`main`, usage :1161), :872-997 (`runPlan`, :896; brief step :952-990 moved into a function, ticket read :956), :1016-1026 (`loadRound`, :1019), :1169-1174 (`writeReport`), :1203-1224 (`stopOnEscape`, :1204).
- Impact, kept round-1 only: scripts/round.mjs:246-257 (`holds`), :339-375 (`suggest`, `better`, `byDefault`); scripts/benchmark.mjs:927-935 (base-suite step).
- Impact, reused unchanged: scripts/benchmark.mjs:18-22, :1149-1150 (main checkout from `--git-common-dir`), :24, :314, :419 (`benchRoot`, called with the main checkout), :449, :464, :497-498 (`showAt`, `existsAt`), :504-534, :767, :936-951; scripts/round.mjs:164-170 and :199 (`rewriteBrief`, accepts an empty ticket), :333 (`median`); scripts/fixed-context.mjs:529; scripts/compliance.mjs:37; packages/core/src/index.ts:53-54; packages/core/src/scout/check.ts:85-101 (`ownFiles`, no ticket for a lane scout), :132, :160-184; packages/core/src/scout/report.ts:75, :117-123 (`citations`); packages/cli/src/run.ts:83-86. Read only: .claude/agents/accord-scout.md:17-18; packages/core/skills/shared/scout.md:15, :28, :34; packages/core/skills/accord/lane.md:7-8; scripts/benchmark-samples.json:710-767; accord/research/2026-10-30-harness-architecture.md:122-123.
- Impact, new or data: scripts/benchmark-rounds.json, scripts/benchmark-gathered.json, docs/benchmark/round-r2-scout.md (written by the hand-run round at verify).
- Impact, tests: stay green unchanged packages/core/test/benchmark-round.test.ts:28, :239-295; packages/core/test/benchmark-samples.test.ts:96-106; packages/core/test/benchmark-worktree.test.ts:45-59, :185, :730 (the refused `cleanWorktrees` result keeps its shape); new packages/core/test/benchmark-arms.test.ts, packages/core/test/benchmark-gather.test.ts.
- Not touched (D-01): packages/core/src/skills/agents.ts:15, accord/config.yml:32, .claude/agents/accord-scout.md.
