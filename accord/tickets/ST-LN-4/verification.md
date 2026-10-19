---
ticket: "ST-LN-4"
commit: "31a6397109f3510dd99074e7d5bf613eacc4bd8b"
reviewed_on: "2026-10-16"
---

## @ac-1 The plan's first critique is sized by the plan, and a round with only Should findings is followed by a read of the fix diff

Result: pass

Evidence: Exists: packages/core/skills/plan/critique.md:1-76 holds the sizing (1-3 tasks one critic; 4+ lenses criteria and build; security lens, at most three), merge and de-duplicate, whole vs diff rule, finding states, convergence and Nice-to-ledger rule. Test `ac-1 the first plan critique...` is at packages/core/test/stage-skills.test.ts:185. Substantive: the text states the whole-after-Must (including earlier open or unverified Must) and diff-after-other rules; the planner gets only open or unverified Must and Should, never a Nice; the three-round cap and stop-and-tell-owner are in packages/core/skills/plan/SKILL.md step 6. Wired: SKILL.md `loads:` lists plan/critique.md and step 5 points to it; .claude/skills/accord-plan/critique.md exists after sync. packages/core/agents/critic.md has the diff mode, lenses, fixed and withdrawn lines. Data flows: the rendered text (agentTargets/skillTargets) is what the test asserts on. `npx vitest run` passes 61 files, 1252 tests.

## @ac-2 A review round with only Should findings converges without a re-review

Result: pass

Evidence: packages/core/skills/review/SKILL.md step 4 runs `tests.affected`, or `tests.full` when not configured or no test file; re-reviews only after a Must; no reviewer is dispatched again for a Should-only round. Step 5 defines converged as no Must open and every Should fixed with that command passing. Step 7 covers the final review the same way. packages/core/skills/review/record.md names "that command" in the verdict. Test at packages/core/test/stage-skills.test.ts:234 passes; the review skill is rendered to .claude/skills/accord-review/.

## @ac-3 Must, Should and Nice are defined by what happens if the finding is left

Result: pass

Evidence: `grep -c "Nice: no defect" .claude/agents/accord-*.md` shows 1 each in accord-critic.md, accord-reviewer.md and accord-final-reviewer.md. The three sentences are in packages/core/agents/critic.md and packages/core/agents/reviewer.md; final-reviewer is rendered from reviewer. The test at packages/core/test/agents.test.ts:128 checks the three sentences word for word on the rendered output of all three, and passes.

## @ac-4 The planner checks its plan against the critic's checklist before handing it over

Result: pass

Evidence: packages/core/agents/planner.md ends with "Before you reply, run these checks of the critic's plan mode on your plan and fix what fails:" followed by the six checks, identical to the six `- Check` lines under "Mode `plan`:" in packages/core/agents/critic.md. The test at packages/core/test/agents.test.ts:142 extracts exactly six critic checks and asserts each appears in the planner after that intro; it passes on the rendered agents.

## @ac-5 An API a finding relies on carries a citation

Result: pass

Evidence: packages/core/agents/critic.md Findings section requires a `path:line` citation (node_modules included) or a URL for any API a finding or fix relies on. packages/core/agents/planner.md applies such a fix only when the cited place confirms it, reports `unverified: <reason>` otherwise, and applies a URL-only fix only with the owner's words. packages/core/skills/plan/critique.md step 3 sends URL-only fixes to the owner at once, with the apply or drop states. The test at packages/core/test/agents.test.ts:160 passes. The critic and planner tool lists remain without a web tool.
