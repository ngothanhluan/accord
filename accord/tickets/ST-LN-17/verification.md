---
ticket: "ST-LN-17"
commit: "aafbf8df9d8c5391b91da44e77d20be09557d440"
reviewed_on: "2026-10-30"
---

## @ac-1 The round record gives the round, the cap and the fix executor's model

Result: pass

Evidence: Exists: packages/core/test/round-next.test.ts:29 (ac-1 test) and packages/core/src/round/next.ts (nextRound, fixModel). Substantive: fixModel (next.ts:137-152) reads fix_round_tier_up (default 4), tiers up from the configured executor model, and `raised` also checks every cycle for rounds >= tier, so the tier stays raised after a return from verify; the cap restarts per cycle (nextRound uses the last cycle, next.ts:194-236). Wired: `accord round <id>` is registered at packages/cli/src/run.ts:179 and calls round() in packages/cli/src/commands/round.ts:10-18, which calls nextRound and prints roundText. Data flows: the snapshot's rounds come from the loaded review.md. The test builds a review.md of rounds 1-3 and gets `Round: 4 of 5 / Fix executor model: opus`; after round 4 and a Return from verify it gets round 1 of 5, cycle 2, model opus. I ran `npx vitest run` on round-next, round-gate and pre-tool-use: 3 files, 11 tests passed. CI run 41048953536 on 607abce passed the full suite, per the caller's note (not re-checked by me).

## @ac-2 A round record accord cannot read, or a round past the cap, gets no next round

Result: pass

Evidence: Exists: packages/core/test/round-next.test.ts:40. Substantive: nextRound returns refused when recordProblems is non-empty (next.ts:191-192) and a stop when the cap is reached without an allowance (next.ts:247). The allowance Ruling is parsed by the strict ALLOWANCE regex (next.ts:27-41), and `allowed` admits exactly rounds after+1 to after+n (next.ts:64-67). Wired: roundText yields "refused: ..." or "stop: ...", and round.ts:17 returns 1 for any non-next answer. Data flows: the test runs for both T-1 (lane M) and S-1 (lane S). An unreadable severity gives refused with no model. Five rounds gives a stop with no model. An allowance of 2 gives round 6 and round 7, and round 8 is refused with "the cap of 7 rounds". The test passed in my run (11/11).

## @ac-3 A review that stops converging stops for the owner

Result: pass

Evidence: Exists: packages/core/test/round-gate.test.ts:38. Substantive: cycleState.stopAt (next.ts:51-63) fires from round 3 only for a round with a Should or a Must. roundText prints "stop: report to owner", the findings, the Approach, and the accepted-by-owner and allowance instructions (next.ts:256-275). The gate rule reviewRounds in packages/core/src/gate/rounds.ts:12-77 fails Done with a message requiring verdict: accepted-by-owner "<sentence>" or a converged verdict after an allowed no-findings round. Wired: REVIEW_ROUNDS is in both the lane M and lane S Done rule tables (packages/core/src/gate/rules.ts:162, 205, 222). Data flows: the rules read work.rounds from the snapshot loaded from review.md. The tests passed in my run. The risk:complex-branching test in round-next.test.ts also exercises the stop text.

## @ac-4 The plan critique loop has the same cap and stop

Result: pass

Evidence: Exists: packages/core/test/round-gate.test.ts:74. Substantive: nextRound(..., 'plan') uses planStopOf (next.ts:72-80) for the stop from round 3 or a last round with findings at the cap, and counts rounds after the last "## Closed". It refuses on lane S. roundText prints the same stop text with plan critique wording. gate.plan-rounds (rules.ts:155, rounds.ts:60-70) fails the plan gate until accepted-by-owner or a no-findings round. Wired: `accord round <id> --plan` (run.ts:179-183, round.ts:12-17) and the plan gate table. Data flows: plan-review.md is loaded into work.planRounds. The test passed in my run.

## @ac-5 In Claude Code a fix executor on the wrong model is refused

Result: pass

Evidence: Exists: packages/cli/test/pre-tool-use.test.ts:40. Substantive: checkFixDispatch (packages/core/src/round/dispatch.ts:10-37) returns a refusal naming the round and the model to pass when the dispatched model's family differs from the computed one, or when none is given and the configured model differs. It allows the matching model. preToolUse in packages/cli/src/commands/hook.ts:188-218 emits permissionDecision deny and fails open on error. Wired: packages/core/src/scaffold/hooks.ts:18 registers a PreToolUse hook with matcher Agent|Task running `hook pre-tool-use`, and the CLI dispatches that event to preToolUse. Data flows: the hook reads the hook-input JSON from stdin, finds the active ticket, and uses the real snapshot's review.md through fixModel. The test passed in my run. Not observed: a live Claude Code session. The repository's own settings.json entry lands only with the pin PR, per the ticket's Approach.
