# Critic loops on approach and plan: what finds real defects cheaply

Date: 2026-11-02. Repository at `2266d21f` (origin/main) for the records counted; ST-LN-46 read on branch `t/ST-LN-46` at `94e8ac7d`. Feeds ST-LN-91, ST-LN-92, ST-LN-46, ST-LN-56, ST-LN-57, ST-LN-71, ST-LN-80 and any ticket that changes `accord-critic`, `accord-approach` or `accord-plan`.

This is evidence, not a contract. Only a ticket's Intent, acceptance criteria, Vetoes, Decisions and Corrections bind any stage; nothing here may be cited as a requirement.

## Question

The owner finds the critic loops on the approach and on the plan expensive, slow and low in yield. What is best practice for LLM critic or reviewer loops on design and plan documents, so they find real defects at low token and time cost, and what should accord change?

Every number is marked: measured (counted by script from git records or transcripts), estimated (a judgement over records), or source (a cited publication, with its date, verified by fetching unless marked unverified).

## 1. Accord's records: where findings appear, by round

Method (measured): every `approach-review.md`, `plan-review.md` and `review.md` on origin/main at `2266d21f` (100 records, 1,022 findings) parsed by script; a round is a `## Round <n>` heading, counted per cycle (after each `## Closed`). Raw rows and the script stayed in the session scratchpad (`bk46/data/findings.json`, `bk46/scripts/count.mjs`).

Plan critique (`plan-review.md`, 36 tickets, 45 cycles):

| Round | Rounds run | Must | Should | Nice | Must + Should per round |
|---|---:|---:|---:|---:|---:|
| 1 | 47 | 34 | 187 | 121 | 4.7 |
| 2 | 45 | 6 | 57 | 30 | 1.4 |
| 3 | 27 | 1 | 27 | 17 | 1.0 |
| 4 | 18 | 1 | 8 | 15 | 0.5 |
| 5 and later | 21 | 2 | 16 | 10 | 0.9 |

- 34 of 44 plan Musts (77%) and 187 of 295 Shoulds (63%) come in round 1 (measured).
- Of 45 cycles, 20 have a round-1 Must; only 3 have a Must that appears for the first time after round 1 (ST-LN-14, ST-LN-17, ST-LN-55) (measured). Of the 10 late Musts, at least 3 come from text a fix or a merge of main added (ST-LN-44 rounds 5 and 9, ST-LN-48 round 2) (estimated, by reading the finding).
- The 2026-10-25 record classified the 129 round-3+ findings: 64% caused by an earlier round's fix, 22% present since the start and reported late, 8% the same claim resurfacing; of the 20 round-3+ plan Shoulds, 14 fix-induced, 8 judged real, 11 unclear (measured there, `2026-10-25-review-convergence.findings.jsonl`).

Code review (`review.md`, 63 cycles): round 1 gives 1.4 Must + Should per round, round 2 0.6, round 3 0.4, round 4 0.25; rounds 5+ rise to 1.2 only because ST-LN-14's debug episodes added code mid-review (measured). Nice findings outnumber Must + Should 2:1 in review (estimated from counts: 319 Nice against 162 Must + Should).

Approach critique: only ST-LN-81 has an `approach-review.md` on main (round 1: 1 Must, 5 Should; round 2: 2 Should; round 3: 1 Nice). Before ST-LN-80 the approach findings sat in the ticket and ledger; the 2026-10-30 study counted 117 Must and 392 Should over 38 tickets, of which 112 Musts changed the approach (estimated there).

## 2. Accord's transcripts: cost per critic run and per finding

Method (measured): every `accord-critic`, `accord-planner` and `accord-architect` subagent transcript under `C:/Users/Luan Ngo/.claude/projects/C--Work-accord*/` (2026-10-13 to 2026-11-02; 449 critic runs with a recognised mode, all `claude-opus-5-5`); usage read per API message as `scripts/benchmark.mjs` `parseRun` does (max per message id). Mode and lens are read from the dispatch prompt; a run is "later" when its prompt names `plan-review.md` or `approach-review.md`, or its mode is `diff`. Findings are counted from the critic's own hand-back (numbered `Must`/`Should`/`Nice` lines), before the main session merged duplicates, so lens counts overlap. "Weighted" uses the 2026-10-30 study's weights: fresh ×1, cache-write ×1.25, cache-read ×0.1, output ×5, model prices ignored. "Peak" is the largest single-turn context, which matches the figure the Agent tool reports (ST-LN-46 build lens: 184,746).

| Critic run | Runs | Must | Should | Runs with no Must/Should | Weighted Mtok | Weighted k per Must+Should | Weighted k per Must | Median peak | Median minutes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Plan round 1, lens `criteria` | 36 | 22 | 70 | 1 | 19.7 | 214 | 895 | 119k | 6.7 |
| Plan round 1, lens `security` | 20 | 9 | 52 | 0 | 9.4 | 154 | 1,044 | 105k | 6.3 |
| Plan round 1, no lens (1–3 tasks) | 50 | 14 | 53 | 14 | 22.4 | 334 | 1,600 | 123k | 6.6 |
| Plan round 1, lens `build` | 36 | 5 | 85 | 9 | 41.8 | 464 | 8,360 | 185k | 10.4 |
| Plan later, whole re-read after a Must | 35 | 6 | 81 | 4 | 35.7 | 410 | 5,950 | — | — |
| Plan later, `diff` | 75 | 2 | 31 | 49 | 12.9 | 391 | 6,450 | 58k | 2.1 |
| Approach, first read (architect era included) | 95 | 151 | 501 | 0 | 40.2 | 62 | 266 | 93k | 5.4 |
| Approach, later rounds (approach-review era) | 12 | 11 | 56 | 1 | 4.9 | 73 | 445 | — | — |

- Plan critics spent 144 M weighted tokens in total: round 1 93 M (65%), later rounds 49 M (35%). Later rounds found 8 Musts against round 1's 50 (raw, overlapping) (measured).
- The `build` lens is the single largest critic cost (45% of round-1 plan critic spend, median 51 turns, twice the tokens of `criteria`) and finds a Must in 2 of 30 multi-lens round-1 sets; `criteria` finds one in 14, `security` in 4 (measured; a Must found by two lenses counts for both).
- A `diff` round finds no Must and no Should in 49 of 75 runs (measured). The whole re-read after a Must costs about three times the `diff` rounds and finds most of the later-round Shoulds (81 of 112); whether those were present in round 1 or caused by the fix was not classified (not measured).
- Approach critique costs about 62k weighted tokens per Must or Should, against 150–460k for plan critique: the same defect is 2.5–7 times cheaper to find on the short approach than on the plan (measured per finding; whether the defects are comparable is estimated).
- Planner fix runs: 108 runs, median 194k weighted, 2.6 minutes; planner writing runs (direction, plan, re-plan): 82 runs, median 748k, 9.3 minutes (measured; classified by the dispatch description).

## 3. The ST-LN-46 case

Measured from `approach-review.md`, `plan-review.md`, the ledger, `git log t/ST-LN-46` and the session's transcripts; the real / fix-induced / heuristic labels are estimated.

| Step | Weighted k (peak) | Minutes | Found | Reading |
|---|---:|---:|---|---|
| Planner direction | 1,062 (190k) | 26.3 | — | — |
| Approach round 1 critic | 468 (122k) | 5.4 | 4 Must, 4 Should, 1 Nice | all real, all fixed |
| Planner revise | 445 (130k) | 5.6 | | |
| Approach round 2 critic | 474 (112k) | 5.7 | 1 Must, 1 Should | 2.1 real, caused by the fix for 1.5; 2.2 caused by the fix for 1.3 (the prose-claim rule) |
| Planner revise | 324 (99k) | 4.8 | | |
| Approach rounds 3–5 critics | 180 + 119 + 118 | 5.9 | 1 Should each | one chain: each fix of the prose-claim "allowed hits" rule gave the next counterexample; 5.1 accepted by the owner and sent to the plan |
| Planner fixes 3.1, 4.1 | 104 + 96 | 2.8 | | |
| Planner writes plan.md | 1,816 (307k, 146k output) | 24.4 | — | the direction report was not saved, so the planner re-derived it |
| Plan round 1: criteria, build, security | 550 + 852 + 582 (163k, 185k, 158k) | 7.9 / 9.8 / 8.4 in parallel | 1 Must, 14 Should, 7 Nice after merging | Must 1.1 (criteria) real; data-loss Shoulds 1.6–1.9, 1.12 (security) real on their face; fixture contradictions 1.5, 1.11, 1.13 real; 1.3 and 1.5 continue the prose-claim heuristic |

- Rounds 3–5 cost about 0.62 M weighted tokens and about 9 agent minutes plus two owner allowances, for three Shoulds that argued one heuristic's edge cases; the owner accepted the last one open (measured cost, estimated reading).
- The heuristic did not settle at plan either: plan 1.3 (substring match) and 1.5 (the `1,3` citation span) are the same rule's edge cases (estimated).
- The single most expensive run of the ticket was the plan writer (1.82 M weighted, nearly the 1.98 M of the three plan critics together), partly because the direction report of step 2 was not kept on disk (measured cost; the cause is the caller's reading).

## 4. Outside evidence

From a web study by one fresh agent, 2026-11-02. "Verified" means the page or PDF was fetched and the claim read there; anything else is marked unverified. Most sources measure QA, maths, planning puzzles, code generation or code review, not design or plan documents.

### 4.1 Critique without an external check is weak, and its gain is in the stop signal

- Without external feedback, self-correction lowered accuracy: GPT-4 on GSM8K went 95.5 → 91.5 → 89.0 over two rounds, and on HotpotQA 49.0 → 49.0 → 43.0. With oracle labels saying when to stop, it rose instead. [Huang et al., ICLR 2024, arXiv 2310.01798, 2023-10-03](https://arxiv.org/html/2310.01798v2), verified.
- No prior work shows prompted LLMs successfully self-correcting from their own feedback, except on tasks suited to it; it works with reliable external feedback. [Kamoi et al., TACL 2024, 2024-06-03](https://arxiv.org/abs/2406.01297), verified.
- GPT-4 self-critique on planning lowered accuracy in 3 of 4 domains (Graph Coloring 16% → 2%); a sound external verifier gave 38%, and 87% on Blocksworld. As a verifier GPT-4 had false-negative rates of 95.8–97.1%. Binary, first-error and all-error critiques scored about the same; the gain came from the verifier, not from what the critique said. [Stechly, Valmeekam and Kambhampati, 2024-02-12](https://arxiv.org/html/2402.08115v2), verified.
- Critique grounded in a tool (search, an interpreter) corrects reliably. [CRITIC, ICLR 2024, 2023-05-19](https://arxiv.org/abs/2305.11738), verified.
- Reflexion beat its baseline on HumanEval but fell below it on MBPP, because its self-written tests passed wrong code 16.3% of the time. [Shinn et al., NeurIPS 2023](https://arxiv.org/html/2303.11366v4), verified.

### 4.2 Critics nitpick and hallucinate, more so when asked for more

- CriticGPT: "longer critiques are … more likely to include hallucinations and nitpicks"; absolute rates stay "quite high". Its deployment picks among 28 sampled critiques with a length term that trades bugs caught against spurious claims, defaulting to about 4 highlighted issues; a human plus the model hallucinated less than the model alone. [McAleese et al., OpenAI, 2024-06-28](https://arxiv.org/html/2407.00215v1), verified.
- LLM code reviewers rejected correct code far more often when asked for an explanation and a fix (GPT-4o on HumanEval: 26.2% direct, 73.2% with explanation and fix). Keeping a finding only when its proposed fix changes a test result cut that to 23.2% (Claude 4.5 Sonnet: 46.0% → 8.7%). [Jin and Chen, 2026-02-28](https://arxiv.org/html/2603.00539v1), verified.
- Claude Code's guidance: "A reviewer that's asked to find problems will always find *something*. If you fix every finding, you end up with extra abstraction layers and tests for cases that can't happen"; ask it to "report gaps that affect correctness and skip style". A fresh-context reviewer "isn't swayed by the reasoning that produced the code". [code.claude.com best practices, live page, undated](https://code.claude.com/docs/en/best-practices), verified.
- Sycophancy: challenged with "are you sure?", Claude 1.3 wrongly conceded on about 98% of questions, GPT-4 on about 42%. A planner pushing back on a critic, or a critic re-reading a planner's justification, is exposed to this. [Sharma et al., Anthropic, 2023-10-20](https://arxiv.org/html/2310.13548v4), verified.
- Judges show position bias (GPT-4 consistent after a swap 65% of the time), verbosity bias and self-preference (about 10% for GPT-4). [Zheng et al., MT-Bench, 2023-06-09](https://arxiv.org/html/2306.05685v4); [Panickssery et al., 2024-04-15](https://arxiv.org/abs/2404.13076), verified.
- Verification is a top failure class in multi-agent systems (21.3% of failures over 1,600+ traces): verifiers "often only perform superficial checks"; a check against the high-level task objective added +15.6% absolute success. [Cemri et al., MAST, 2025-03-17](https://arxiv.org/html/2503.13657v2), verified.

### 4.3 Gains concentrate in the first round; later rounds can regress

- Self-Refine, code optimisation: 22.0 → 27.0 → 27.9 → 28.8, so +5.0 in round 1 and +0.9 after; the authors note "diminishing returns". Specific feedback beats generic. [Madaan et al., 2023-03-30](https://arxiv.org/html/2303.17651v2), verified.
- At matched cost, self-repair gains are "often modest … sometimes not present at all"; feedback quality is the bottleneck (Code Llama repair rate 9.1% alone, 39.3% with GPT-4 feedback); more fresh samples beat more repair rounds (10×1: 1.05× baseline; 2×10: 0.97×). [Olausson et al., ICLR 2024](https://arxiv.org/html/2306.09896v5), verified.
- Iterative "improvement" of code raised critical vulnerabilities by 37.6% after five rounds; the authors advise human validation between iterations. [Shukla et al., 2025-05-19](https://arxiv.org/abs/2506.11022), abstract verified, small study.
- No paper or vendor guidance was found on diff-only against whole re-review, or on a stopping rule for design-document critique; practitioner skill files disagree (unverified, not authoritative).

### 4.4 Ensembles, debate and checklists

- Multi-agent debate does not reliably beat self-consistency at equal compute (GSM8K at 9 responses: debate 83.0, self-consistency 88.2) [Huang et al.](https://arxiv.org/html/2310.01798v2), verified; [Zhang et al., "Stop Overvaluing Multi-Agent Debate", 2025-02-12](https://arxiv.org/abs/2502.08788), abstract verified; mixing different models helps there. [Smit et al., ICML 2024](https://proceedings.mlr.press/v235/smit24a.html), unverified.
- Anthropic's multi-agent research system uses about 15× the tokens of chat and suits breadth-first work, not tasks with tightly shared context such as most coding; for judging, one call with a rubric was more consistent than several judges. [Anthropic, 2025-06-13](https://www.anthropic.com/engineering/multi-agent-research-system), verified.
- Inspections: checklist reviewers found no more defects than ad hoc ones, while scenario readers, each aimed at one class of defect, found more of their class and no fewer of others. [Porter, Votta and Basili, IEEE TSE 1995](https://www.cs.umd.edu/~aporter/html/scenarios.html), unverified. LLM-generated checklists raise judge agreement with humans (46.4% → 52.2%) [TICK, 2024-10-04](https://arxiv.org/abs/2410.03608), verified; [CheckEval, 2024-03-27](https://arxiv.org/abs/2403.18771), verified.

### 4.5 Production review bots: precision first, silence allowed

- Claude Code's `/code-review` plugin: parallel agents, a 0–100 confidence per issue, anything below 80 dropped; issues that existed before the change, "pedantic nitpicks" and linter-catchable issues excluded. [README via a mirror](https://huggingface.co/SaylorTwift/claude-code/blob/main/plugins/code-review/README.md), verified only on the mirror; the official path now returns 404.
- GitHub Copilot code review: "silence is better than noise"; 29% of reviews post nothing; a stronger model gave +6% positive feedback for +16% latency. [GitHub blog, 2026-03-05](https://github.blog/ai-and-ml/github-copilot/60-million-copilot-code-reviews-and-counting/), verified.
- Google: comment-resolution suggestions tuned to 50% precision and shown only above a confidence threshold [2023-05-23](https://research.google/blog/resolving-code-review-comments-with-ml/); AutoCommenter usefulness rose from about 54% to over 80% only by suppressing noisy rules, with per-rule thresholds [2024-05-22](https://arxiv.org/html/2405.13565), verified.
- Uber uReview: generators feed a separate grader with per-category thresholds, deduplication and suppression of low-value categories; 75% rated useful [2025-08-12](https://www.uber.com/en-GB/blog/ureview/), verified. ByteDance BitsAI-CR: candidate generation then a verifying filter, 75.0% precision [2025-01-25](https://arxiv.org/abs/2501.15134), verified.

### 4.6 Human review yield

- Review at most 200–400 lines at a time, under 60–90 minutes; detection falls sharply above about 500 lines per hour. [SmartBear on a Cisco study, undated vendor page](https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/), verified as stated, vendor source.
- Only 14% of 570 classified review comments at Microsoft concerned defects; finding defects needs the deepest understanding of the change. [Bacchelli and Bird, ICSE 2013](http://web.eecs.umich.edu/~weimerw/2018-481/readings/codereview.pdf), verified. Larger changes get a lower share of useful comments. [Bosu et al., MSR 2015](https://www.microsoft.com/en-us/research/publication/characteristics-of-useful-code-reviews-an-empirical-study-at-microsoft/), abstract verified.

### 4.7 Harness guidance on cost and models

- Evaluator-optimizer fits "when we have clear evaluation criteria, and when iterative refinement provides measurable value"; add complexity "only when it demonstrably improves outcomes". [Anthropic, Building effective agents, 2024-12-19](https://www.anthropic.com/engineering/building-effective-agents), verified.
- Context rot: recall falls as the window fills; aim for "the smallest set of high-signal tokens". [Anthropic, 2025-09-29](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), verified.
- Build with the most capable model first, then swap in smaller ones where results hold. [OpenAI, A practical guide to building agents, about 2025-04](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf), text verified, date unverified. Larger models write more helpful critiques [Saunders et al., 2022-06-12](https://arxiv.org/abs/2206.05802); only the largest of 13 judges aligned reasonably with humans [Thakur et al., 2024-06-18](https://arxiv.org/abs/2406.12624), verified. No primary source was found showing a cheaper critic holding defect recall on design documents.

## 5. Limits

- Not measured: whether each round-1 or round-2 finding was real. Only the 2026-10-25 record classified findings, and only those of round 3 and later; sections 1 to 3 count findings, not defects. No finding was replayed against the built code to see whether it would have shipped.
- Not measured: which lens raised each finding after the main session merged duplicates. Records on main carry no lens tag (ST-LN-46 is the first that does), so lens counts come from each critic's own hand-back and overlap.
- Not measured: the main session's own tokens and minutes per round (recording, committing, `accord round`, owner questions), nor the owner's time. These are real costs of every extra round and are left out of every per-finding figure.
- Not measured: whether the whole re-read after a Must finds defects present in round 1 (round 1 under-read) or defects the fix made.
- Approach figures mix the architect era (before ST-LN-80, where approach critique ran on the architect's draft) with the approach-review era; only 12 later-round approach runs are in the newer form.
- All critic runs were opus at high effort, so this data says nothing about a cheaper model or a lower effort; ST-LN-46's planned critic arm (`r9-crit`) is the place to measure it.
- Token counts are weighted, not priced; "peak" is the largest single-turn context. Transcripts older than about 30 days are gone, so runs before 2026-10-13 are not in section 2.
- Outside evidence is mostly from QA, maths, code-generation and code-review benchmarks, not from review of design or plan documents; applying it here is an analogy.

## Recommendations

Ranked by expected gain per cost. None cuts a data-loss or security check. "Owner" marks a change that needs the owner's decision; "tool" marks one the CLI can enforce.

1. **Make rounds after round 1 verify fixes, not hunt.** From round 2, a critic checks (a) that each open finding is fixed, (b) that the changed hunks break no criterion, Veto, Decision or Correction, and (c) data loss and security on those hunks. A new Should on text no fix touched is not raised there; it goes to `## Deferred` with its failing case for review to check against the built code. Evidence: 77% of plan Musts and 63% of Shoulds are found in round 1, only 3 of 45 cycles produced a first Must later (section 1); 64% of round-3+ findings are fix-induced (2026-10-25); the gain sits in round 1 and later rounds can regress (4.3); GSD's evidence gate on re-checks. The ST-LN-56/57 direction already points here. Owner (changes what a critic may block on); tool: `accord round` can refuse a later-round finding that cites no hunk unless it is tagged data-loss or security.

2. **Handle a heuristic rule by measuring it, not by arguing over it.** When a finding is a counterexample to a rule whose rightness is empirical (a matcher, a threshold, a classifier such as ST-LN-46's "only" claims), the critic marks it `heuristic`. At the second `heuristic` finding on the same rule, the loop stops for that rule: the plan names a small labelled set of cases and a test that measures the rule's error on it, and the owner accepts the measured error once, as a Decision. Evidence: ST-LN-46 approach rounds 3 to 5 (about 0.62 M weighted tokens, three Shoulds, one chain, still open at plan 1.3 and 1.5; section 3); critique without an external check does not converge and the verifier carries the gain (4.1). Owner; tool: count `heuristic` findings per named rule in `accord round`.

3. **Keep the approach critique, and move checks there.** Approach critique costs about 62k weighted tokens per Must or Should against 150–460k on the plan (section 2), and about half its Musts (Decision breaks) might not be caught at plan (2026-10-30). Do not merge it into plan critique. Instead, the approach round 1 brief adds the data-loss and undo scenarios and the Decision check now done again by plan lenses, and the plan critic gets settled approach findings as "do not re-raise". Owner (stage design, touches ST-LN-80's result).

4. **Rescope or cheapen the `build` lens; keep `criteria` and `security` as they are.** `build` is 45% of round-1 plan critic spend, has the most turns, and leads to a Must in 2 of 30 sets, against 14 for `criteria` and 4 for `security` (section 2). Its Shoulds (fixture contradictions, mismatched signatures, a task needing another task's text) are real but a failing-first test catches many at build, at the price of one executor retry. Options for the owner: (a) limit `build` to the interfaces between tasks and the fixtures, with no code reading beyond the files a task names; (b) run it on sonnet at high, once ST-LN-46's critic arm shows its recall holds (4.7: test smaller models only against a measured baseline); (c) drop it for plans under a size the data supports. Owner; measure first through ST-LN-46 `r9-crit`.

5. **Require a precision gate in the critic prompt.** Each Must or Should states the property violated, the ticket line it rests on (`ac-n`, Veto, `D-nn`, Correction) or the data-loss or security path, and a failing case; a finding with no ticket line and no such path is a Nice (the 2026-10-25 data had this rule demote 18 of 50 late Shoulds). Add an explicit "do not critique" list: wording and names; file, test or task layout; anything the plan or a Ruling delegates; cases outside the criteria; hypothetical future use; anything settled in an earlier round or at approach. Cap the report to the strongest findings (CriticGPT's default of about 4 highlights; Claude Code's confidence ≥ 80 with "skip style"), allowing more only for Musts and data-loss items; "No findings" is a good answer (Copilot posts nothing in 29% of reviews). Evidence: 4.2, 4.5. Prompt change; tool can check that each Must or Should line carries a ticket reference or a `data-loss`/`security` tag.

6. **Stop the planner widening the change.** The fix brief says: change only the lines a finding needs, keep every other line byte for byte, and report the hunks it touched; the main session refuses a fix whose diff touches tasks no finding names without a Ruling. Evidence: 64% fix-induced, GSD #5125 ("the loop feeds itself"), 4.3. Tool: the CLI can list hunks outside the named tasks.

7. **Save the planner's direction report.** Write it to `accord/tickets/<id>/direction.md` (or a scratch file the ledger names), and give its path to the plan writer. ST-LN-46's plan writer ran 1.82 M weighted tokens and 24 minutes, nearly the three plan critics together (section 3). Cheap; no owner decision unless it adds a tracked file.

8. **Make the whole re-read after a Must narrower.** It is 73% of later-round plan critic spend (35.7 of 48.6 M weighted) and finds 81 Shoulds that nobody classified (section 2). Proposal: after a Must, re-read whole only the tasks the fix changed or that cite them plus the Intent check; otherwise use `diff`. First classify a sample of those 81 (present since round 1 or fix-induced) to know what this would lose. Measure, then owner.

9. **Lower the stop to round 2 for Should-only chains.** `accord round` already stops from round 3. With recommendations 1 and 2 in place, a round-2 report that holds only Shoulds, all on hunks of the previous fix, could go straight to the owner with "accept or one more round". Evidence: round 3 yields 1.0 Must + Should per round against 4.7 in round 1, mostly fix-induced. Owner; tool (one constant in `accord round`).

10. **Do not add debate or more parallel critics.** Debate does not beat cheaper ensembling at equal compute and multi-agent setups cost many times more tokens (4.4). If diversity is wanted, a different model on one lens is the cheaper variant to benchmark. No change.

Not recommended: resuming one critic across rounds to save reading (independence and sycophancy risk, 4.2; behaviour across runtimes unknown); cutting the `security` lens or the data-loss scenarios to save tokens (they found 9 Musts and many data-loss Shoulds at the lowest cost per finding of the plan lenses).
