# Harness architecture: what to merge, route, add or leave out

Date: 2026-10-30. Repository at `086d768`. Feeds ST-LN-14, ST-LN-22, ST-LN-43, ST-LN-46, ST-LN-56, ST-LN-57, ST-LN-68, ST-LN-71 and the tickets queued from section 4.

This is evidence, not a contract. Only a ticket's Intent, acceptance criteria, Vetoes, Decisions and Corrections bind any stage; nothing here may be cited as a requirement.

## Question

The owner, 2026-10-30, in order:

1. "The critic mechanism repeats in the architect and the planner. Why not gather it in one place? No need for the architect any more. This cuts token use and is faster."
2. Whether accord should have an intent classifier that routes a request (brainstorm, feature, debug, …) to a skill, model and effort; whether to adopt graphify for large codebases; whether to bring in a memory plugin as GSD does; whether accord needs a test auditor, since AI-written tests are numerous and slow development; what can be learned from the oh-my-claudecode interview and the superpowers brainstorming skill.
3. Whether the single scout is enough, whether it is performative, and whether a routing layer should set the number of scouts, their model and effort. "I want to build accord into a strong harness."
4. Priority, restated: "token prices will rise a lot, so we must keep quality good at the lowest cost: quality > cost > speed", with parallel runs kept because they add no tokens and finish the working day sooner, and a cheaper model or lower effort accepted once a benchmark proves it holds quality.

Every number below is marked: measured (counted from transcripts, git or test reports), estimated (a judgement over records), or source (a cited publication).

## Method

Thirteen agents in one session, each in a fresh context:

| Id | Question | Data |
|---|---|---|
| Q1 | What did the approach critic catch, and would the plan critic have caught it? | 38 lane M tickets, 67 approach-mode critic runs, ticket and ledger text, plan-review.md, git |
| Q2 | How often did the owner change the approach at approval, and why was it re-approved? | 38 tickets, every `approved_hash` change in `git log --all`, main-session transcripts |
| Q3 | Token and time cost per stage | 1,560 accord subagent runs from 2026-10-13 to 2026-10-30, 40 complete lane M tickets; benchmark replays excluded |
| Q4 | How other frameworks treat design versus task planning | spec-kit, Kiro, OpenSpec, BMAD, GSD 1.19, Claude Code, Cursor, Codex, Cline, Copilot Workspace, Aider, MetaGPT; papers |
| R1 | oh-my-claudecode interview and superpowers brainstorming against accord-intent | omc 5.6.2 and 5.7.21, superpowers 7.0.0 and 7.0.1 prompt files |
| R2 | Intent classification and model/effort routing | accord routing code, omc and GSD routing, RouteLLM, FrugalGPT and router robustness papers |
| R3 | graphify and code indexes | graphify repository, Aider, Serena, Cursor, papers; read share over 1,303 accord runs |
| R4 | Memory plugins | GSD MemPalace, Claude Code auto memory, claude-mem, Codex, Copilot, Cursor, mem0, Letta; papers |
| R5 | Test growth, cost and value | 101 test files, 1,742 JUnit cases, git history, CI runs, a 30-test random sample (mulberry32 seed 20261030) |
| R6 | Scout accuracy and scaling | 62 real scout runs, merged diffs of 46 tickets, 873 citations checked by script, 20 claims checked by hand |
| R7 | Does a strong harness let a cheaper model do the work? | SWE-bench Verified and Terminal-Bench 2.0 leaderboards, Agentless, CodeMonkeys, R2E-Gym, Aider, Anthropic posts |

Raw rows and scripts stayed in the session scratchpad and are not kept; the counts below are what they produced.

## 1. Approach stage: architect, approach critic and the owner's approval

### Cost (measured, Q3)

Median per lane M ticket (n=40):

| Stage | Share of all input | Share of fresh + cache-write input | Share of output | Share of agent minutes |
|---|---:|---:|---:|---:|
| Architect + approach critic | 11.0% | 11.3% | 18.5% | 10.7% |
| Planner + plan and diff critics | 41.1% | 35.4% | 58.6% | 33.2% |

Cost-weighted (fresh ×1, cache-write ×1.25, cache-read ×0.1, output ×5; model prices ignored): 13.2% against 45.2% (estimated). The approach stage is usually one architect run and one or two critic runs; the plan stage a median of three planner runs and four critic runs. The main session's own approach window (Skill call to the first `accord approve`) had a median of 17 API calls and 22 active minutes over 31 windows; removing the architect does not remove it.

### What the owner's approval changed (measured, Q2)

- First approach approval, 38 tickets: 35 plain yes, 2 a clarifying question then yes with no text change, 1 correction (ST-LN-6, which became D-09 and ac-4), 0 picks of another option.
- Before the approval question, about 25 tickets put critic findings to the owner, who mostly took the recommended option; in 4 the owner overrode or corrected (ST-LN-26, ST-LN-31, ST-LN-25, ST-LN-21) (estimated).
- Re-approvals: 26 in 17 tickets. Cause: plan stage 15 (13 tickets), build 2, review 5, verify 4, owner change at approach 0. Five of the 26 came from outside the ticket (main moved, another ticket merged, a release).

### What the approach critic caught (Q1)

- Findings across 38 tickets: 117 Must, 392 Should, about 230 Nice, 1 to 6 rounds per ticket (counted by pattern, ± a few).
- Outcome of the 117 Musts (estimated): 2 ruled the chosen option out (BUG-LN-13, ST-LN-21), 112 changed the chosen approach's content, often through a new owner Decision, 3 were kept as risks. About 18 tickets gained owner Decisions during approach critique.
- Would the plan critic have caught the 94 Musts that changed something and have a plan to compare against (estimated, by finding type, not replayed): yes 43, unclear 48, no 3. Most of the unclear ones break a Decision; the plan-mode checklist (`packages/core/agents/critic.md`, mode `plan`) names Vetoes, criteria scope, the Approach and the Intent, not Decisions, and about 10% of plan-review findings cite a Decision (measured).
- In 6 tickets the plan critic raised again an issue the approach stage had fixed or accepted (ST-LN-26, ST-LN-7, ST-LN-17, ST-LN-25, ST-LN-20, ST-LN-14).
- The method favours the approach critic: an issue fixed at approach cannot appear at plan.
- The architect's Option 1 was chosen in 23 tickets and a later option in 15. Plan.md cites files the architect named and the intent ticket did not in 37 of 38 tickets, which is weak evidence because the intent ticket rarely names files and the planner reads the code itself.

### Elsewhere (source, Q4)

- No framework found runs a separate adversarial critic on the design before task planning. spec-kit, Kiro, BMAD and MetaGPT keep a separate design artifact; GSD, Claude Code plan mode, Cursor, Codex and Cline fold design into one plan with one approval; OpenSpec writes design.md only when the change is cross-cutting, adds a dependency, carries security, performance or migration complexity, or is ambiguous.
- Every framework that keeps a design step scales it by size or risk (BMAD, OpenSpec, Kiro Quick Spec).
- MetaGPT's role ablation (arXiv 2308.00352, Table 3): executability 4.0 with product manager, architect and project manager; 2.0 without the architect; the architect added about 11% cost. 2023, small benchmark, no human gate.
- SpecBench (arXiv 2605.30314): agents reviewing real RFC design proposals found at most 44.4% of the flaws experts raised.
- Anthropic's Claude Code guidance: a fresh reviewer helps because it has not seen the reasoning, but a reviewer "will always find something", and fixing every finding adds layers.
- Not found: any ablation of separate design critique plus approval against one planner and one critique loop, or any measured cost of catching a wrong direction early versus late in agent workflows.

### Reading

The owner's separate approval at approach rarely changed anything at the moment of approval, and the plan stage forced most re-approvals. The approach critic, though, did real work: most of its Musts changed the approach, and about half of those might not be caught at plan as the plan checklist stands, chiefly Decision breaks. Removing the architect and the approach critic saves at most about 11% of a ticket's tokens, less once the planner absorbs the impact analysis. Folding approach into plan is supportable only if the plan critique checks every Decision and the owner's direction questions still come before the planner writes the full plan.

## 2. Where the tokens go (measured, Q3 and R3)

- Code reading (Read of code, Grep, Glob, and shell cat, grep and git diff) is about 15.5% of billed input across 1,303 runs; search alone, what a code graph would replace, is 3.2%.
- About 52% of input is not attributable to transcript content: fixed context sent with every call, roughly 47k tokens per call. accord's own documents (skills, tickets) are about 17%. Neither figure is split by owner (accord, Claude Code, plugins, MCP servers) yet; both are raw-token shares, not cost-weighted.
- Cache reads are about 95% of all input and cost about a tenth of fresh input; fresh + cache-write shares are the better guide to cost.

## 3. Findings by topic

### Intent routing (R2)

- accord already routes: the lane step is a model-judged classifier with listed lift conditions and an owner override (`skills/accord/lane.md`); stage to skill is deterministic through `accord anchor`; model and effort per role are fixed defaults in `src/skills/agents.ts` with `models:` overrides; the fix-executor tier-up is a CLI cascade (`round/next.ts`).
- Routing left to the model failed in practice: 12 dispatches asked for sonnet where the tier-up rule asked for opus, before ST-LN-17 moved the rule into the CLI (docs/benchmark/round-1.md).
- Gap: questions, brainstorms and research have no route; "any other text starts a New request", so they get a scout and a lane proposal.
- Routers in the literature save cost on chat benchmarks (RouteLLM: 85% on MT Bench at 95% of GPT-4 quality) but misroute out of distribution; no result covers multi-step agentic coding. oh-my-claudecode's routing is keyword and score heuristics in code, Claude Code only, with an unmeasured "30-50%" claim.

### Code graph (R3)

- graphify (Graphify-Labs/graphify) builds a tree-sitter call and import graph, needs Python 3.10+ and uv or pipx, hooks into each host differently, and its only published code result is n=6 questions on one repository.
- Anthropic chose just-in-time agentic search over indexes, citing stale indexes. Indexes help weak models and multi-hop localization most (a small-model study: accuracy doubled at 8B, +4 to 5 points at 32B); a language-server study measured 6 to 118% more tokens on localization.
- The 2026-10-25 record already decided "Not adopted: graphify or a code knowledge graph"; nothing found reverses it.

### Memory (R4)

- No memory system found reaches every teammate and all four tools: Claude Code auto memory is machine-local and not loaded into subagents; claude-mem, Codex memories and oh-my-claudecode's are local; Copilot Memory is Copilot-only; mem0 needs an API key by default. GSD ships MemPalace off by default, with git-tracked `.planning/` as the source of truth; Cursor removed Memories in favour of versioned rules.
- Evidence of gain is weak: context files gave no general gain and cost over 20% more (arXiv 2602.11988); in 11 of 12 pairings memory systems did not beat no memory, while injecting verified past experience gave +1.1 to 4.5 points (arXiv 2609.23570).
- The owner's machine-local memory for this repository held one contradiction, one orphaned fact, and one rule that overrides a shipped skill (merging main into a ticket branch that is behind), so other tools and teammates behave differently. About 15 of its 46 facts are lasting rules that belong in the repository.

### Tests (R5, measured)

- 1,742 cases: 185 named by a `@test:` tag (238 scenarios), 438 `risk:`, 802 untagged, all of them in `accord/tests-baseline.txt` from before the test policy.
- 1,098 cases (63%) take 6 s in total; 214 cases of 5 s or more take 75% of the time; CLI tests are 39% of cases and 94% of the time. CI: Linux 80 to 119 s, Windows 790 to 941 s.
- `risk:` tests grow about four times faster than criterion tests, about 2.4 per criterion test (ST-LN-14: 57 for 5 criteria); 40% of risk-test lines were last written by a review, round or fix commit, since the executor brief asks for a test per fixed finding.
- Random sample of 30: 24 guard a real risk, 4 duplicate another test (`worktree.test.ts:282`, `show.test.ts:174`, `lint.test.ts:127`, `lint.test.ts:171`), 1 restates the implementation, none only asserts on mocks.
- Cutting by coverage alone lost about 12.5 to 48% of fault detection in published studies; Google runs mutation testing only on changed lines in review; StrykerJS's Vitest runner does not fit the CLI tests (forks, a lock, git).

### Interview (R1)

- oh-my-claudecode's deep interview has no conditional critic rule; the variation comes from routing in code: a short request with no anchor (file, symbol, criterion, test command) is sent to a planning flow with a critic, a detailed one goes direct, and auth, migration, destructive, personal-data or public-API requests add a pre-mortem.
- accord-intent already has most mechanisms of both (looking before asking, a 0.2 ambiguity threshold, one question at the weakest dimension, the criteria audit, lightest-first options, an independent critic).
- Mechanisms accord lacks, none measured: the owner picking an option before the critic runs (today the critic first reviews the architect's recommendation, at a median 4.4 opus minutes); a completeness pass for what a planner would still have to guess (the auditor only looks for two readings of existing criteria); blocking versus non-blocking open questions; a "why this question, what the answer changes" line; a round cap on the interview. superpowers measured that a subagent review loop gave identical quality scores at about 25 extra minutes.

### Scout (R6)

- 62 real runs, haiku then sonnet, effort low; median 1.2 minutes, 24 tool calls, 300k input; about 1% of subagent tokens. 45 of 63 reports exceed the 30-line cap.
- Recall of the files the merged diff changed: 0.94 for tickets touching 5 or fewer existing files, 0.60 above 5; haiku and sonnet equal (0.65, 0.66). About 49 of 125 missed files are wiring: `index.ts` exports, CLI registration, README text restating a rule. All 5 merged lane S tickets with a Scope match their diff exactly.
- Errors are of meaning, not location: 2 of 873 cited lines fall outside the file, but false "only", "none" and completeness claims dominate (16 of 28 errors in benchmark round 1; 3 of 20 hand-checked claims).
- 62 of 63 reports hedge ("not opened"); the main session or the architect then re-reads: the architect re-opened 65% of the scout's files, and 35% of architect reads were such repeats. The scout's report is never saved.
- About 10 of 19 tickets created since ST-LN-62 show no lane scout (a lower bound on compliance).
- Anthropic's multi-agent research: one agent and 3 to 10 tool calls for simple fact-finding; multi-agent used about 15× the tokens; "most coding tasks involve fewer truly parallelizable tasks than research". Parallel area-split scouts found more files at about 45× the tokens (arXiv 2606.11976). No one publishes a deterministic rule for scout count or model.

### Cheaper models under a strong harness (R7)

- Scaffold matters for a fixed model: GPT-4o 23.2 to 38.8 on SWE-bench Verified across scaffolds; Opus 4.6 58.0 to 76.4 on Terminal-Bench 2.0; median worst-to-best harness spread 13.6 points across 20 models.
- A cheaper model in a strong harness can beat a dearer one in a weak harness (Sonnet 4 with tools 72.4 against Opus 4 bash-only 67.6), but in the same harness the dearer model still leads (Opus 4 with tools 73.2), and on hard tasks the tier gap holds (Haiku 4.5's best 37.6 against Opus 4.6's worst 58.0).
- Savings are smaller than price ratios: bash-only, Opus 4.5 76.8 at $0.75 per task, Sonnet 4.5 71.4 at $0.66, Haiku 4.5 66.6 at $0.33; Haiku took 66 calls per task against 33.
- Verification is the largest lever in every ablation (Agentless reproduction tests 25.7 to 32.0; CodeMonkeys selection 45.8 to 57.4; R2E-Gym 34.4 to 51.0).
- Lower effort before a lower tier for judgement roles: Opus 4.5 at medium matched Sonnet 4.5's best SWE-bench score with 76% fewer output tokens.
- Per role (inference): safest to downgrade are the executor working from a precise brief that a test checks, and read-only localization, benchmarked on recall; least safe are planning, critique and review, whose misses are silent. accord's round 1 agrees for the executor (5 of 5 at every effort) and warns for the scout at low effort.

## 4. Recommendations

Ranked by cost saved at no loss of quality, under quality > cost > speed. Parallel runs stay.

1. **Measure and cut the fixed per-call context.** Split the ~47k tokens per call by owner (accord session rules and skill listings, Claude Code, plugins, MCP instructions) and remove what subagents do not need. Largest share of input; not yet measured cost-weighted.
2. **Make plan critique converge.** The plan stage is the largest stage (about 41% of a ticket). Continue ST-LN-56 and ST-LN-57, add Decisions to the plan-mode checklist, and prefer diff rounds over whole re-reads.
3. **Fold the architect into one approach-and-plan stage only with compensations**, as one lane M ticket: the plan critique checks every Decision; the owner's direction questions (option choice, policy) are asked before the full plan is written; the owner picks the option before any critic runs; one approval after critique. Expected saving up to about 11% of a ticket; ST-LN-71 and ST-LN-13 change with it.
4. **Keep the scout and save its work.** Fix its prompt (a wiring checklist; every "only" or "none" claim names the pattern and folders searched; open any file the caller names; hold the line cap), let the CLI compute the lift conditions from its file list, and save the report in the ticket so the next agent reads it instead of searching again. No per-request scout routing now.
5. **Test cost, not test count.** A CLI report of the tests a ticket adds and their seconds; a test lens at review for duplicates, hollow titles and wrong layer; a fix extends an existing test rather than adding one; verify may take CI's Linux full run (as ST-LN-17 did on the owner's word). Continue ST-LN-43 and ST-LN-75.
6. **Model and effort by benchmark.** Extend ST-LN-46 to the executor at sonnet or haiku per risk kind, the scout scored on negative-claim errors and wiring recall, and judgement roles at lower effort before a lower tier. The CLI prints the routed agent from ticket fields only where a benchmark shows quality holds.
7. **Intent routing for skills only.** A few rows before the lane step send a question, brainstorm or research request to its own path instead of a ticket; default to a change request when unsure. No model-judged model or effort choice.
8. **No memory plugin.** Capture a lasting rule the owner states into `accord/product/conventions.md`, a `Rejected:` line or a backlog ticket, on a yes; continue ST-LN-68, ST-LN-22, ST-LN-28. Keep conventions minimal, since always-loaded context costs on every call.
9. **No code graph.** Leave indexes to the host tool; benchmark one on a large repository before naming it in docs.

## 5. Open questions

- Is a test's cost counted in local Windows seconds or CI Linux seconds?
- Do the 76 benchmark and dev-script tests count toward the product suite?
- Should the 32 criterion tests that only check skill or agent text stay?
- What share of the fixed per-call context is accord's own, cost-weighted?

## Limits

- One owner, about 40 lane M tickets, 2026-10-13 to 2026-10-30; no transcripts before 2026-10-13.
- Counterfactuals (would the plan critic catch it; would a single approval see it) are judgements, not replays.
- Token shares are raw unless marked cost-weighted; minutes add parallel runs and are not wall time.
- External results are mostly on SWE-bench and Terminal-Bench, not on a staged workflow like accord's; leaderboard harness gains do not transfer reliably.
