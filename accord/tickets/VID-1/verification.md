---
ticket: "VID-1"
commit: "debd399c21bc61470da80c103405282c4999ebc0"
reviewed_on: "2026-10-14"
---

## @ac-1 gate plan fails on a verify id whose test name holds an at sign

Result: pass

Evidence: Exists: verifyAt in packages/core/src/gate/plan.ts flags any parsed verify id containing @; test in packages/cli/test/lane-commands.test.ts. Substantive: it emits a reason naming the id. Wired: packages/core/src/gate/rules.ts lists gate.plan-verify-at in PLAN_RULES (error, build and maintain), and packages/core/src/gate/index.ts runs PLAN_RULES for gate plan. Data flows: the CLI test runs `gate plan T-1` on a real temp repo with plan text substituted, and asserts exit 1 and the id in the output. I reran it with vitest and it passed.

## @ac-2 gate plan fails on a verify id whose path holds an at sign

Result: pass

Evidence: The same verifyAt rule checks the whole id, path included. The CLI test in packages/cli/test/lane-commands.test.ts uses packages/@scope/x.test.ts#writes and asserts exit 1 and the id in the output. Reran: passed.

## @ac-3 gate plan fails on a comma inside a verify id

Result: pass

Evidence: verifyComma in packages/core/src/gate/plan.ts re-reads the raw verify line through fieldLines (packages/core/src/load/work.ts, the parser's own fence and field rule), splits on whitespace, and names each chunk matching /\S,\S/ as written. It is registered in PLAN_RULES as an error. The CLI test asserts exit 1 and that the output holds src/x.test.ts#refuses-x,-exit-2 whole. Reran: passed.

## @ac-4 a marker and a comma between ids are accepted

Result: pass

Evidence: The test in packages/core/test/lane-plan.test.ts uses `src/x.test.ts#writes (@ac-1), src/y.test.ts#risk:data-loss-quotes` and asserts no gate.plan-verify-at and no gate.plan-verify-comma findings and no errors at all. The marker is stripped before the parsed ids reach verifyAt. A separating comma followed by a space does not match /\S,\S/. The same test checks the no-space variant is flagged. Reran: passed.

## @ac-5 the planner and the executor say a test name holds no at sign and no comma

Result: pass

Evidence: The sentence "A test name never holds `@` or a comma." is in packages/core/agents/planner.md and packages/core/agents/executor.md, in packages/core/src/generated/agents.ts, and in the rendered .claude/agents/accord-planner.md and .claude/agents/accord-executor.md (grep count 1 in each). The test in packages/core/test/agents.test.ts renders agentTargets for both roles and asserts the sentence verbatim. Reran: passed.
