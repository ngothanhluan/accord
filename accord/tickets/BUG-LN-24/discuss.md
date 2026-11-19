# Discuss: BUG-LN-24

## Gray areas
- behaviour and output — the wording of both refusals: write the way out into the reason itself ("plan.md changed since its plan_hash was recorded: show the owner the diff of plan.md; if the owner made the change, accord-plan reviews it; otherwise restore plan.md with the owner's yes" and "plan.md has no plan_hash: the plan stage has not finished; go back to accord-plan"), keeping "plan.md changed" for build step 7, with no ticket id; or only point to "accord-build step 7" — D-04
- scope edges — whether the build and plan skills, and the old records that quote the message (docs/plans, accord/research, BUG-LN-23), change too — D-05
- measurement rules — what "appear nowhere" checks: a case-sensitive absence of "accord gate plan" in the joined reasons, or also of a bare "gate plan" — D-06
- test strategy — which test proves each criterion: ac-1 and ac-2 as two core tests replacing "taskVerdict plan hash" in packages/core/test/task.test.ts, ac-3 as the existing CLI test in packages/cli/test/lane-commands.test.ts renamed with an ac-3 id; or new CLI tests for each — D-07
