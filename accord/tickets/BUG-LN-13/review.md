# Review: BUG-LN-13

## Round 1

Nice 1 [patch]: the risk:regression skills test only checks that two skill files contain a literal sentence, so it restates the text rather than guarding a behaviour — packages/core/test/stage-skills.test.ts:915-919 — deferred
Nice 2 [patch]: doneRef writes a third copy of the `rev-parse --verify -q` resolver that gitDefaultRef and the helper near fs.ts:297 already hold — packages/cli/src/load/fs.ts:661-668 — deferred

## Round 2 (final review)

Should 1 [plan-gap]: a lane M dependant that `gate ready` refused after `accord approve` reaches stage plan on `/accord continue`, because progressOf moves an approved ticket with no tasks to plan without `ac_hash` and nothing on the plan or build path runs Ready, so it is planned and built while its prerequisite is unmerged — packages/core/src/status/stage.ts:88-89, packages/core/skills/approach/SKILL.md:60-64 — open
Nice 2 [patch]: the `r2` block of the core risk test re-tests what the ac-3 test covers end to end — packages/core/test/done-on-default.test.ts:65-72 — deferred

## Round 3 (Task 7 re-plan, base c221ac6)

No findings

## Round 4 (final review)

Nice 1 [patch]: the `gate.depends-unmerged` reason always says "run git fetch", which cannot help in a clone without origin, where the ref read is local main or no ref resolves — packages/core/src/gate/ready.ts:136-140 — deferred

verdict: converged
