# Scout trust: architecture and model choice

Date: 2026-11-02. Repository at `aacc3c3a`. Feeds ST-LN-81 and ST-LN-46.

This is evidence, not a contract. Only a ticket's Intent, acceptance criteria, Vetoes, Decisions and Corrections bind any stage.

## Queued Intent of ST-LN-81, moved verbatim

Queued 2026-10-30, not approved; the intent interview replaces this:
- Source: accord/research/2026-10-30-harness-architecture.md section 3, Scout. Owner, 2026-10-30: "Today the scout runs as just one agent. Is it missing things? Is it performative? Does it need a routing layer that decides how many scouts, which model and effort?" (translated).
- Measured: recall of changed files 0.94 for tickets touching 5 or fewer existing files, 0.60 above 5; about 49 of 125 missed files are wiring (index.ts exports, CLI registration, README text restating a rule); errors are false "only" / "none" / completeness claims, not wrong locations (2 of 873 cited lines bad); 62 of 63 reports hedge "not opened"; the architect re-opened 65% of the scout's files; 45 of 63 reports exceed the 30-line cap; about 10 of 19 recent tickets show no lane scout. The scout is about 1% of subagent tokens.
- Queued intent: the scout prompt carries a wiring checklist, every "only" or "none" claim names the pattern and folders searched, and a file the caller names is opened; the CLI computes the lane lift conditions (file count, code areas, sensitive matches) from the scout's file list with the gate/scope.ts rules; the report is saved under accord/tickets/<id>/ with its commit and the next agent reads it.
- Not here: a routing layer for scout count, model or effort (no evidence it pays; model and effort go to ST-LN-46).
- Open for the interview: whether lint checks that a saved report's citations still resolve; how the dashboard or gate shows a skipped scout.

## Method

One workflow, 9 agents (Opus): an internal-evidence reader (research records, `scripts/round.mjs`, `scripts/benchmark-samples.json`, `docs/benchmark/`), an external web sweep, three independent designs (tool-first, cheap scout plus verification, one strong checked scout), one adversarial critic per design, one synthesis. The main session checked the key citations.

## Findings

- Model: the 0.65 against 0.66 recall tie was on claude-haiku-5-5 and claude-sonnet-5-5, both effort low (`docs/benchmark/2026-10-16.md:17`, `docs/benchmark/fixed-context.md:10`); it is observational, since the model changed on 2026-10-23 with the tickets. The only controlled numbers are Haiku: low held 0 of 5 samples, medium 1 of 5, at 1.2 against 1.9 minutes, 24 against 36 tool calls, about 377k against 1079k cache read (`docs/benchmark/round-1.md:33-34`). Sonnet and any high effort were never benchmarked for the scout. The shipped default is haiku low (`packages/core/src/skills/agents.ts:15`); this repository runs sonnet low (`accord/config.yml`).
- External: search agents of every size declare a search complete too early (https://arxiv.org/abs/2602.07549); sample union raised localization recall 5.7 points over 4 samples on mostly single-file tasks (https://arxiv.org/html/2407.01489v2); multi-file recall work: https://arxiv.org/abs/2606.11976. No head-to-head of Haiku 5.5 and Sonnet 5.5 on code localization was found.
- Order: the lane scout runs before the ticket exists (`packages/core/skills/accord/SKILL.md:62,71`), so a check must work on a plain file, and the report is saved into the ticket only after `accord new ticket`. Two of the three designs failed on this.
- ST-LN-80 D-03 keeps the planner's own impact search; a saved report can only be its starting list.
- Benchmark gaps: `scripts/round.mjs:91-100` has no model axis; the 5 scout samples hold no true file list (`scripts/benchmark-samples.json:711-767`); no lane-classification samples; error kinds were never split by model.

## Designs compared

1. One checked scout (critic score 5, no fatal): fixed reply form (files, wiring checklist, absent table with pattern, folders and allowed hits per "only"/"none" claim); `accord scout check <file>` checks citations, re-runs each logged search, computes the lane numbers; report saved as `accord/tickets/<id>/scout.md`; a missing report fails a gate unless a visible skipped line names a reason. A too-narrow search still passes, so the report says "search logged", never "proven absent".
2. Tool-built wiring candidates the scout must judge (critic score 4.5, fatal on order and on reversing ST-LN-80 D-03 as drafted): only after a no-model replay shows a recall gain over 5 files.
3. Two Haiku scouts unioned plus a Sonnet refuter (critic score 4, fatal on order and on marking a re-run negative claim as checked): benchmark arm only.

Recommendation: design 1 now; model and effort by ST-LN-46 round 2, choosing Haiku only where it ties Sonnet on wiring recall and false absence claims.
