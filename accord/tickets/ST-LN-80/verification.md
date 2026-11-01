---
ticket: "ST-LN-80"
commit: "b03ab0baae4b0609f96e525b7a1887588fc65176"
reviewed_on: "2026-11-01"
---

## @ac-1 No agent named accord-architect is rendered or dispatched, and an old config still loads

Result: pass

Evidence: Exists: packages/cli/test/retired-agent.test.ts:41 (ac-1), packages/core/src/skills/agents.ts:28 (RETIRED_FILES), packages/cli/src/commands/skills.ts:156-171 (removeRetired), packages/core/src/lint/config.ts (modelRetired). packages/core/agents has no architect.md; grep of packages/core/src/generated finds no "accord-architect". Substantive: removeRetired deletes only a regular file with an intact marker (isIntactRender) under a non-linked folder (scannable); the lint rule emits a warning with pointer /models/architect that names models.planner. Wired: skills.ts:250 calls removeRetired in sync; lint.model-retired is registered in packages/core/src/lint/rules.ts:97 for build and maintain; packages/cli/src/commands/upgrade.ts:59,116 also removes it. Data flows: the test writes an intact old render and a config with models.architect, runs `skills sync` and `lint --json` through run(), and asserts "removed .claude/agents/accord-architect.md", the file gone, no rendered file mentioning accord-architect, and one lint.model-retired warning. I re-ran the file: 3 passed, including the risk tests (edited copy kept as orphan, linked folder untouched). Note: this repository's own .claude/agents/accord-architect.md and .claude/skills/accord-approach/SKILL.md still exist; the ticket's Approach says they follow the pin and are not touched.

## @ac-2 The planner's direction pass returns an Approach draft and writes no file

Result: pass

Evidence: Exists: packages/core/test/approach-fold.test.ts:58 (ac-2). Substantive: packages/core/agents/planner.md holds the `direction` mode paragraph (writes no file, neither plan.md nor the ticket; impact list with path:line; two or three options, lightest first; three failure scenarios in total with how each is undone when the ticket touches auth, money, migration or data deletion; the reply is the draft the main session writes). The step 2 text of packages/core/skills/approach/SKILL.md dispatches accord-planner in direction mode and has the main session write ## Approach. Wired: generated/agents.ts and generated/skills.ts are current (re-running gen-agents.mjs and gen-skills.mjs left `git status` clean), and the test reads agentTargets and skillTargets output. Data flows: the instruction text reaches the rendered accord-planner.md and the accord-approach skill; the test asserts the phrases in the rendered text and that the skill never mentions accord-architect. Passes on re-run. The behaviour is an instruction to an agent, so the evidence is the rendered text, not a live dispatch.

## @ac-3 Approach critique defers detail to the plan and re-reads only what changed

Result: pass

Evidence: Exists: packages/core/test/approach-fold.test.ts:70 (ac-3). Substantive: packages/core/agents/critic.md approach mode marks implementation detail `defer to plan` and Nice, never a Must or Should; from round 2 it gets the git diff of the ticket and approach-review.md, raises new findings only on the changed lines, and lists `fixed:` and `withdrawn:`. packages/core/skills/approach/critique.md holds the round-2 diff dispatch, the fixed/withdrawn marking and the deferred ledger path. Wired: SKILL.md points to ./critique.md and `accord round <id> --approach`; generated files match the sources (regeneration produced no diff). Data flows: the skill writes the diff file and passes its path plus approach-review.md to the critic, per the rendered text the test asserts. Passes on re-run. Evidence is rendered instruction text, the layer that observes an instruction to an agent.

## @ac-4 The CLI counts approach critique rounds and stops them at the cap

Result: pass

Evidence: Exists: packages/cli/test/round-approach.test.ts:12 (ac-4). Substantive: packages/cli/src/commands/round.ts:10-22 handles `--approach` (usage error with --plan, and on lane S) and calls nextRound with 'approach'; packages/core/src/round/next.ts:33-34 maps approach to "approach critique" and approach-review.md and reuses planStopOf (next.ts:78). Wired: packages/cli/src/run.ts:180-183 registers the --approach option. Data flows: the test runs the CLI against fixtures: no file gives "Round: 1 of 5 / Cycle: 1"; two recorded rounds give "Round: 3 of 5"; a round 3 with a Should prints "stop: report to owner" with the same first two lines as --plan on identical content; five rounds print "the cap of 5 rounds in cycle 1 is reached" for both flags; lane S and --plan with --approach exit 2. Passes on re-run.

## @ac-5 Plan critique checks every Decision and Correction

Result: pass

Evidence: Exists: packages/core/test/approach-fold.test.ts:15 (ac-5). Substantive: packages/core/agents/critic.md has a seventh `plan` mode check and a diff-mode check on changed hunks: "check every Decision and every Correction of the ticket ... a Must that names the Decision's `D-nn` or quotes the Correction"; the `criteria` lens now runs "the first, second, third, fifth and seventh checks". The planner self-checks the same (packages/core/agents/planner.md, last check). Wired: rendered into accord-critic.md and accord-planner.md through agentTargets from the in-sync generated file. Data flows: the test reads the rendered critic and asserts the exact lines in both modes and the lens text. Passes on re-run. The criterion itself is about the instruction text ("because the plan-mode and diff-mode instructions of the critic tell it to check"), so no live critic run is needed.
