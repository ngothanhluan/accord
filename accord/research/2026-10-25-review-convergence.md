# Review convergence: why review and critique loops run many rounds

Date: 2026-10-25. Repository at `2176236`. Feeds ST-LN-17, ST-LN-56, ST-LN-57 and ST-LN-55.

This is evidence, not a contract. Only a ticket's Intent, acceptance criteria, Vetoes, Decisions and Corrections bind any stage; nothing here may be cited as a requirement.

## Question

Review and plan-critique loops often run past round 3 (ST-LN-14 review: 18 rounds; ST-LN-7 plan critique: 8). Why, and what would make them converge without cutting a check?

## 1. Measure of accord's own history

Method: every `review.md` and `plan-review.md` with three or more rounds (23 records) was read by three agents; each finding raised in round 3 or later (129) was classified against its ticket. Row data: `2026-10-25-review-convergence.findings.jsonl`, one finding per line, plus per-round severity counts.

| Origin of a round-3+ finding | Count |
|---|---:|
| Caused by an earlier round's fix (27 of them by ST-LN-14 debug episodes adding code mid-review) | 83 (64%) |
| Present since the build, reported late | 29 |
| Same claim or pattern resurfacing | 10 |
| Unknown | 7 |

- Severity: 7 Must, 50 Should, 72 Nice. Nice findings are deferred and start no round.
- 5 of the 7 late Musts came from code added during review (debug fixes, a merge of main, post-verify rework); none was a defect missed earlier.
- Fixes chain: ST-LN-26 plan-review 3.2 led to 4.1, 5.1 and 6.1; ST-LN-31 and ST-LN-27 carry one claim through rounds 1, 2 and 3, each fix covering one more spot.
- A rule "a Should rests on a ticket line or an in-scope failing case, else Nice" would demote 18 of 50 late Shoulds (13 in ST-LN-14; 7 are "missing test" findings). None was judged a real defect, but 3 are data-loss edge cases (ST-LN-14 review 10.2 and 11.1, ST-LN-7 plan-review 3.1), so such a rule needs a data-loss and security exception.
- Benchmark round 1 (`docs/benchmark/round-1.md`) found the fix executor left on sonnet 11 times where `escalation.fix_round_tier_up` asked for opus, and two reviews past the round cap; the session counted rounds from memory.
- Model and effort: every measured ticket ran the same configuration, so this data cannot separate their effect. In round 1 the executor held 5 of 5 samples at low, medium and high (first builds, not fixes); the planner held 3, 4 and 3 at low, medium and high.

Limits: classification is model judgement from the records, nothing was re-run; 46 findings are "real: unclear"; ST-LN-14 alone is 56 of the 129.

## 2. Literature

From a verified web study (claims kept only on a 2-of-3 adversarial vote).

- Critique without an external, checkable signal (tests, tools, a concrete failing case) does not reliably improve output and can make it worse; reported gains came from oracle labels or tools. High confidence. [Huang et al., ICLR 2024](https://arxiv.org/abs/2310.01798); [Kamoi et al., TACL 2024](https://arxiv.org/abs/2406.01297); [CRITIC, ICLR 2024](https://arxiv.org/abs/2305.11738).
- Most of the gain comes in rounds 2 to 4, token cost grows about linearly, and a stopping rule beats a fixed count. High. [CRITIC](https://arxiv.org/abs/2305.11738); [Feedback Friction](https://arxiv.org/html/2506.11930v2); [Optimal Stopping](https://arxiv.org/pdf/2608.10729).
- Errors that persist after feedback are mostly the model resisting it (62.8–100%); repeating the finding rarely helps, escalation does. Medium, one preprint. [Feedback Friction](https://arxiv.org/html/2506.11930v2).
- LLM code reviewers reject correct code, more so when asked for an explanation plus a fix (GPT-4o on HumanEval: 26.2% yes/no, 58.5% with explanation, 73.2% with explanation and fix); 14.1% of false rejections rest on a requirement the spec does not hold. Running the reviewer's failing case against tests cut false rejections by about two thirds. Medium, one preprint. [Jin and Chen, 2026](https://arxiv.org/html/2603.00539v1).
- Judges lose accuracy when several rubric items share one call. Medium. [RuVerBench](https://arxiv.org/pdf/2606.29920).
- Code knowledge graphs: the one measured system used about 10x fewer tokens but scored 83% against 92% for plain file exploration; graphify itself has no independent evaluation, and a graph goes stale after each fix. Low. [Codebase-Memory](https://arxiv.org/abs/2603.27277).

Caveat: most evidence is from QA, math or function-level benchmarks, several sources are single 2025–2026 preprints, and applying them to repository review is an analogy.

## 3. GSD study

GSD 1.18.0 (open-gsd/gsd-core, successor of gsd-build/get-shit-done) was read in full where it touches review, state and enforcement. Paths are relative to its `gsd-core/` folder; its agents sit beside it in `agents/`.

What it does:
- **Finding as property, fix as example.** A plan-checker issue carries a binding `required_property` and evidence; `fix_hint` is "one example route"; a finding that can only be stated as a preferred edit is dropped (`agents/gsd-plan-checker.md` 920–940). Added after planners applied hints literally, each attempt costing a round (open-gsd #3771). A fix that would break a locked decision returns `REVISION_CONFLICT`, which costs no round and is capped separately.
- **Revision rules.** "Do NOT introduce new issues while fixing", keep everything not flagged, "You must reduce the count or the loop will terminate" (`references/revision-loop.md` 95–100). The planner revises as a "surgeon, not architect".
- **Caps and stall.** Planner and checker loop: 3; convergence: `--max-cycles`, default 3; code-review fix `--auto`: 3. At the cap the user chooses to proceed or stop; open conflicts cannot be accepted. A count that does not fall warns (convergence) or escalates (revision loop).
- **Counts from the round, not the file.** Convergence parses a `CYCLE_SUMMARY: current_high=N current_actionable=M` line from the reviewer's reply and stops on a missing or malformed line; it never recounts REVIEWS.md, whose history would inflate it (`workflows/plan-review-convergence.md` 386–411). Blocking state sits in a writer-owned delimited slot that fails closed when unparsable.
- **Evidence gate on re-checks.** A new blocker on a re-verification pass that is neither carried forward nor on a file changed since the last pass blocks only with a failing test or a reproducing command (`references/verifier-evidence-gate.md`, #3304: a re-check turned four unevidenced observations into blockers and reverted finished work).
- **Scope.** The executor fixes only issues "directly caused by the current task's changes"; anything else goes to `deferred-items.md` (`agents/gsd-executor.md` 258–262). Code review is incremental since the last review commit and excludes commits that are not the phase's own. Reviewers never flag style or performance; advisory drift checks never block, because "an advisory check becomes an endless replan loop".
- **Single-reviewer claims checked.** A HIGH from one reviewer that claims something exists or is missing must be confirmed against the source or by another reviewer (#2398: four reviewer instances hit "roughly 25% to 56%").
- **State by CLI.** STATE.md fields are written through `gsd_run state` verbs; progress counts are derived from files, never typed by the model; subagents never write state.
- **Hooks that block.** `gsd-agent-isolation-guard` refuses an executor dispatch without worktree isolation; its header: "A prose backstop cannot fix a prose defect". `gsd-write-guard` exists because an agent read an advisory and "reason[ed] past it" (#973).
- **Less re-reading.** The planner embeds interface excerpts and a per-task `read_first` list; a codebase map is stamped with the commit it was made at and checked for drift.
- **Cleanup.** Each worktree is recorded when its agent returns and removed at the end of the wave, failing closed.
- **Decisions not re-argued.** CONTEXT.md numbers locked decisions (D-01), a "Claude's Discretion" area reviewers may not flag, and deferred ideas; a gate blocks a plan that drops a decision.

Where GSD falls short:
- Its round counters are prose: `cycle = 0` lives in the workflow text and no CLI verb stores a round; only the `CYCLE_SUMMARY` parse is code. Stall in convergence only warns.
- Open #5125: a replan rewrote 30 plans for 4 findings; "every line rewritten in a plan nobody asked to change is new text for the next review … the loop feeds itself". This is accord's 64%.
- Open #5182 (stall check matches its own prompt), #4617 (no unattended exit at the cap), #5019, #5506, #5527 (the fix loop leaves the tree dirty).
- The code fixer checks syntax only and runs no tests between fixes.

Not to copy: 40–50 KB agent prompts with about 27 references each (accord renders to four runtimes under byte budgets); the executor adding auth or rate limits a spec does not ask for (against "a spec's silence is not permission"); haiku verifiers in the budget profile.

## 4. What was decided

- 2026-10-25, PR #87: the executor runs sonnet at high effort (`accord/config.yml`).
- 2026-10-25, PR #92, owner: "ok, agreed" to the plan:
  - ST-LN-17 (with ST-LN-53): the CLI counts review and plan-critique rounds, sets the fix model and the cap, and stops a loop whose open count does not fall.
  - ST-LN-56 (with ST-LN-52): a finding names the property and its evidence; the fix makes it hold everywhere, fixes only what the change caused, and is reverted on a red test.
  - ST-LN-57: review checks a pinned scope; a late finding blocks only with evidence, except data loss and security.
  - ST-LN-55: worktrees are recorded and their removal checked.
- Not adopted: graphify or a code knowledge graph.

## 5. Open questions

- A hook refusing a fix executor on the wrong model conflicts with the 2026-10-17 choice of no tool-specific hook (ST-LN-17).
- The cap: GSD uses 3 and the literature points to 2–4; accord's own data does not yet say which.
- Whether model or effort changes fix quality: proposed for benchmark round 2 (ST-LN-46), the same findings fixed by sonnet high and by opus, counting the findings each fix opens.
- Resuming one critic across rounds would save re-reading, but costs independence and may not behave the same in Cursor, Codex and Copilot.
