# Ledger

## Tasks

## Rulings
- Ruling: a config that still sets `models.architect` loads, and lint warns that the key has no effect, rather than refusing it — config.schema.json has `additionalProperties: false`, so dropping the key would break every repository that set it — cost if wrong: a dead key lingers until a later release removes it
- Ruling: `accord skills sync` removes an `accord-architect.md` it rendered earlier — a stale agent file would still be dispatchable after the upgrade — cost if wrong: one more cleanup ticket
- Ruling: the planner's direction pass returns the Approach draft and writes no file; the main session writes `## Approach` — the planner may not edit the ticket (planner.md) — cost if wrong: one more hand-off step in the approach skill
- Ruling: the approach critique takes the same cap, stop from round 3 and owner-Ruling allowance as plan critique (round/next.ts ROUND_CAP) — D-02 asks for the same cap and stop as review — cost if wrong: a cap that is too loose or too tight for short Approach text, tuned later
- Ruling: ST-LN-71 is dropped by its own `drop:` pull request after this ticket's intent is approved — D-02 folds it in, and a drop is its own branch by convention — cost if wrong: ST-LN-71 shows on the dashboard until then
- Ruling: measuring tokens and plan rounds before and after is left to ST-LN-46 and is not part of done — D-05 sets done as the five criteria — cost if wrong: the saving is unproven until ST-LN-46 runs
- Ruling: the auditor's splits are settled in the criteria text — ac-1 means no rendered agent file and no dispatch, so a line saying the architect was removed may stay; ac-2 three failure scenarios in total, returned in the report; ac-3 only `fixed:` and `withdrawn:` are labels and the critic gets the diff since the previous round, as plan diff mode does; ac-4 the same cap and stop rule as `--plan`; ac-5 both plan and diff mode, by a general instruction to check every Decision and Correction — each reading follows D-01 to D-04 or what plan critique does today — cost if wrong: a criterion reworded at the owner's approval
- Ruling: the ticket names its research records in the Intent text, not under a `research:` key — the pinned CLI 0.3.0 predates ST-LN-13 and its lint refuses the key (schema.additionalProperties), which would block gate ready and CI — cost if wrong: the key is added once the pin includes ST-LN-13
