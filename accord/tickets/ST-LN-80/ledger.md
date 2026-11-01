# Ledger

## Tasks
- task 1 done 816fb0d1e522
- task 2 done 47368331e1ef
- task 3 done 8a80ccc0076d
- task 4 done 5056d5615f06
- task 5 done f995368497ff
- task 6 done a89ac64a6952

## Rulings
- Ruling: a config that still sets `models.architect` loads, and lint warns that the key has no effect, rather than refusing it — config.schema.json has `additionalProperties: false`, so dropping the key would break every repository that set it — cost if wrong: a dead key lingers until a later release removes it
- Ruling: `accord skills sync` removes an `accord-architect.md` it rendered earlier — a stale agent file would still be dispatchable after the upgrade — cost if wrong: one more cleanup ticket
- Ruling: the planner's direction pass returns the Approach draft and writes no file; the main session writes `## Approach` — the planner may not edit the ticket (planner.md) — cost if wrong: one more hand-off step in the approach skill
- Ruling: the approach critique takes the same cap, stop from round 3 and owner-Ruling allowance as plan critique (round/next.ts ROUND_CAP) — D-02 asks for the same cap and stop as review — cost if wrong: a cap that is too loose or too tight for short Approach text, tuned later
- Ruling: ST-LN-71 is dropped by its own `drop:` pull request after this ticket's intent is approved — D-02 folds it in, and a drop is its own branch by convention — cost if wrong: ST-LN-71 shows on the dashboard until then
- Ruling: measuring tokens and plan rounds before and after is left to ST-LN-46 and is not part of done — D-05 sets done as the five criteria — cost if wrong: the saving is unproven until ST-LN-46 runs
- Ruling: the auditor's splits are settled in the criteria text — ac-1 means no rendered agent file and no dispatch, so a line saying the architect was removed may stay; ac-2 three failure scenarios in total, returned in the report; ac-3 only `fixed:` and `withdrawn:` are labels and the critic gets the diff since the previous round, as plan diff mode does; ac-4 the same cap and stop rule as `--plan`; ac-5 both plan and diff mode, by a general instruction to check every Decision and Correction — each reading follows D-01 to D-04 or what plan critique does today — cost if wrong: a criterion reworded at the owner's approval
- Ruling: the ticket names its research records in the Intent text, not under a `research:` key — the pinned CLI 0.3.0 predates ST-LN-13 and its lint refuses the key (schema.additionalProperties), which would block gate ready and CI — cost if wrong: the key is added once the pin includes ST-LN-13
- Ruling: approach option 1 (reuse the plan-critique machinery) chosen; critic round 1 found 0 Must, 6 Should, 1 Nice — critic Shoulds 1 to 5, its Nice 7 and its three removal scenarios are answered in ## Approach; Should 6 (no gate reads approach-review.md) is kept as a risk, because D-01 keeps gate ready and gate plan unchanged — cost if wrong: an approach loop run past its cap goes unrecorded
- Ruling: a defer-to-plan finding is always rated Nice — ac-3 says it is never a Must, and a Should would still stop the loop at round 3 — cost if wrong: a detail the critic thinks matters gets less weight at approach and is caught at plan
- Ruling: before round 1 `## Approach` holds only the chosen option's name, what it does and the impact list; reasons, rejected options, risks and tests are added after critique — keeps the critic independent of the author's reasoning while ac-3 still has a diff to give it — cost if wrong: the critic sees less context in round 1
- Ruling: `accord upgrade` removes the retired architect file too, and a removed retired path is exempt from the scope gates — otherwise the deletion lands on whatever branch next runs sync and fails gate.out-of-scope there (critic scenario A) — cost if wrong: one extra exemption path in the scope gate
- Ruling: tasks run `npm run gen` and `npm run build` but never `skills sync` here; nothing under `.claude/` or `.agents/` changes — the approved Approach says this repository's renders follow the pin — cost if wrong: this repository's `.claude` copies stay stale until the pin moves
- Ruling: no existing test is renamed; tests whose titles name the architect, and the "deletes nothing" sync test, keep their titles and change only their bodies with a one-line comment — their ids are in accord/tests-baseline.txt or are @test tags of done tickets, and gate.test-untraced fails a renamed one at done — cost if wrong: a few titles still mention the architect
- Ruling: config.schema.json is not edited — its pattern already accepts `architect` — cost if wrong: none expected
- Ruling: at an approach stop, choosing another option goes through the allowance Ruling instead of `## Closed` — recordProblems refuses `## Closed` while a stop holds — cost if wrong: one more cycle-numbering rule in approach/critique.md
- Ruling: Continue resumes the approach stage at step 3 when `## Approach` holds only the draft, and at step 5 when it has a `- Rejected:` line — otherwise a resumed session would skip the critique D-01 requires — cost if wrong: about 55 bytes added to accord/SKILL.md
- Ruling: a `defer to plan` finding goes to the ledger under `## Deferred`, as plan critique does with a Nice — cost if wrong: deferred findings are not handed to the planner automatically
- Ruling: retired files are removed whatever `runtimes:` says — a retired agent should not linger after the runtime list changes — cost if wrong: an intact copy disappears even where `claude` is no longer declared
- Ruling: D-06 is checked inside the body of an existing baseline test, and the lint warning only by the end-to-end ac-1 test — a separate test would repeat ac-1 at another layer — cost if wrong: a lint-rule regression shows only in the CLI test
- Ruling: one shared check, `isIntactRender(text)`, exported from core and used by fs.ts (Task 4), skills.ts and upgrade.ts (Task 5) — merge-base check, sync and upgrade cannot disagree on "intact" — cost if wrong: one more core export
- Ruling: the scope exemption lives in Task 4 on the host side (fs.ts gitBranchFact), not in core scope.ts — finding 1.2 needs the merge-base content — cost if wrong: Task 4 grows by one host file and one test
- Ruling: the five accord-architect benchmark samples stay in the round-1 list; only the settings read and the matrix skip a retired agent — removing them breaks the 45-sample checks — cost if wrong: the round-1 list still names a retired agent
- Ruling: no test for an rmSync failure in removeRetired — a permission failure cannot be reproduced on both systems (Windows clears read-only; Linux test runs are root) — cost if wrong: the catch path is checked by review only
- Ruling: Task 3's `files:` keeps `(new)` on approach-fold.test.ts, because gate plan reads `(new)` against the baseline; finding 1.5 is answered by Task 3's prose, which says to add to the file Task 2 created — cost if wrong: an executor reads `(new)` and rewrites the file, caught by the ac-5 test vanishing
- Ruling: the approach ladder goes in a ledger Ruling, not in approach-review.md — the critic never reads the ledger, so it never sees the rejected options, and a prose line in the record could parse as a finding — cost if wrong: the session reads a second file on resume
- Ruling: the closed option's name goes in the `## Closed` heading — the existing `/^closed\b/` match accepts it with no parser change — cost if wrong: a stricter heading check later must allow the suffix
- Ruling: the owner allows 2 more plan critique rounds after round 3 of cycle 1 — "A" — two more agent rounds spent on fix-induced findings
- Ruling: the ticket title is rewritten to match D-01 (it still said one critique loop and one owner approval) — the title is outside the approved hash and gate ready still passes — cost if wrong: none beyond a dashboard label
- Ruling: after round 4 the main session changed sentence M in Task 3 from "every later fix commit" (gate plan read "later" as a deferral) to "any fix commit to that path", as the round-4 critic noted fixFileUnexplained ignores timing — a wording fix with no critique round of its own — cost if wrong: one sentence of critique.md reworded at review
- Ruling: the step-7 baseline test run is CI's green run on the base commit 9f5085f4 (Linux and Windows), not a local tests.full — the branch changes nothing outside accord/ since that commit, and the owner prefers CI over a 30-minute local full run — cost if wrong: a host-only failure at the baseline shows up first at build
- Ruling: `planStopOf` takes an optional third `kind` argument, default `'plan'` (task 1) — next.ts needs it to pass 'approach' on, and the exported call in gate/rounds.ts is unchanged — cost if wrong: none, since the existing plan outputs are byte-identical
- Ruling: agents.test.ts keeps the title "renders the architect and the critic read-only on their spec routes", with a comment above it saying why; its body now asserts the critic's frontmatter and that no accord-architect.md is rendered (task 2) — a rename would fail gate.test-untraced at done — cost if wrong: one test title still names the architect
- Ruling: stage-skills.test.ts keeps the REQUIRED `approach` row, with a one-line comment above it saying why its body changed (task 3) — the plan keeps test titles and changes only bodies — cost if wrong: none, it is a comment
- Ruling: approach/critique.md sets out the record format, the ladder, the count and the rounds under their own `##` headings (task 3) — the plan fixes the order of content, not the headings — cost if wrong: a reword; no test reads the headings
- Ruling: the workflow-layer spec's §7 steps 1-4 and its critic line are worded to match Tasks 2 and 3 as built (task 4) — the plan fixed their content only in outline — cost if wrong: a doc-only edit
- Ruling: the skills-sync.test.ts comment sits directly above the existing "A roster change is the whole point" comment inside the `it` body (task 5) — the plan's line number had drifted — cost if wrong: none, a comment only
- Ruling: upgrade takes `retired` as `RETIRED_FILES.filter(p => isIntactRender(files[p] ?? ''))`, so a missing path counts like an edited one and is never removed (task 5) — an empty string carries no marker — cost if wrong: none
- Ruling: accord/research/2026-11-01-architect-fold-review.md line 56 now quotes the owner's choice in English only (review 1.1) — the repository is English-only and no-vietnamese.test.ts fails on the Vietnamese quote; the Intent cites this record as its evidence and the meaning is unchanged — cost if wrong: none, a wording-only change
- Ruling: the deletion of packages/core/agents/architect.md landed in the re-approval commit f8e2a8d9, not in task 2's commit 47368331, because task 2's executor had staged it with `git rm` while the main session committed the ticket; the pushed history is kept, and the main session no longer commits while an executor runs (review 2.4) — rewriting pushed history costs more than the misattribution — cost if wrong: `git revert f8e2a8d9` alone would restore architect.md without its generated entry
- Ruling: approach/critique.md step 3 (the ruled-out commit) also carries the ledger if it changed, not only step 5 (review 2.1 fix) — step 2 can write `## Deferred` or the ladder Ruling before that commit — cost if wrong: one extra phrase in the skill text

## Deferred
- plan 1.8 Nice: Task 5's "Must not change the orphan report" contradicts its rewording of skills.ts:236 — deferred
- plan 1.9 Nice: `accord upgrade` does not say it removed the retired file — deferred
- plan 1.10 Nice: workflow-layer spec line 592 still says "architect in lane P" — deferred
- plan 2.2 Nice: the planner's final reply instruction still names plan.md in direction mode — deferred
- plan 2.3 Nice: Task 3 does not say each phrase of the stage-skills approach row stays on one line — deferred
- plan 3.3 Nice: an option the owner turned down at step 5 is still "not yet ruled out" under rule H — deferred
- review 1.2 Nice: writeSkillFiles still computes the intact-render check inline instead of calling isIntactRender (skills.ts:72) — deferred
- review 1.3 Nice: the intact old architect render builder is copied into three test files — deferred
- review 1.4 Nice: the risk:complex-branching test in approach-fold.test.ts pins nine whole skill sentences word for word — deferred
- review 1.5 Nice: missing space before `=` in next.ts:91 and scripts/round.mjs:19 — deferred
- review 2.2 Nice: after an accepted stop, approach/critique.md sends a refusal to step 4 while SKILL.md step 5 appends `## Closed` — deferred
- review 2.3 Nice: the critic's revision bullet still says "the plan" in approach mode (critic.md:14) — deferred
- review 2.4 Nice: the architect.md source deletion rode in the approval commit f8e2a8d9 — deferred, history kept; see the Ruling
