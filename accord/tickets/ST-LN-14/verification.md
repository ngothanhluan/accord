---
ticket: "ST-LN-14"
commit: "85aba758026cf9ec88c14418b12ed72d7e222a38"
reviewed_on: "2026-10-23"
---

## @ac-1 Every agent's samples run at its current effort and one step either side

Result: pass

Evidence: Exists: packages/core/test/benchmark-round.test.ts:28 holds the named test; scripts/round.mjs (effort scale, run matrix, per-turn check) and scripts/benchmark.mjs exist and are non-trivial (438 and 1146 lines). The junit report node_modules/.cache/accord/junit.xml (tests=1503, failures=0) lists that test as run and passing. Wired: the test imports the pure module and the report path in docs/benchmark/round-1.md is produced by scripts/benchmark.mjs. Data flows: docs/benchmark/round-1.md, a real round, shows 5 runs per row at current, one lower and one higher (executor low/medium/high, critic medium/high/xhigh, auditor low/medium/high), and the scout (current low) at low and medium only. It has 9 agents with no debugger, which a ledger Ruling records. It has a "Model and effort per turn" section reading "Turns that differ from the dispatched setting: 0", so zero is stated. Not independently re-run: the real dispatch, since the round needs the owner's machine and transcripts.

## @ac-2 A run holds only when it is no worse than the current effort on the same sample

Result: pass

Evidence: Exists: packages/core/test/benchmark-round.test.ts:147 is the test. The hold rules are in scripts/round.mjs, covering Musts per role, auditor two-way reads, verifier fail/blocked, planner gate plan, and architect/scout wrong facts. The test checks mustsOf for auditor and verifier (lines 187-188) and the judgeBrief wording (209-213). Wired and data flows: docs/benchmark/round-1.md "Runs by agent and effort" carries real runs-held counts that differ by agent (planner 3/4/3, scout 0/1). "Samples that held at every effort by default" is stated for current runs with no Must, per D-08, and executor holds rest on a suite re-run listed under "Holds that rest on a re-run". Not checked: the pinned-judge model and effort per run, beyond the test. I did not read the judge dispatch records.

## @ac-3 The report suggests an effort for each agent and changes none

Result: pass

Evidence: Exists: packages/core/test/benchmark-round.test.ts:233. docs/benchmark/round-1.md has one row per agent and effort with runs, runs held, median min, and separate input, cache read, cache write and output columns (lines 7-34). The "Suggested effort" table (lines 38-48) follows the rule: executor, reviewer, final-reviewer and verifier drop one step where all 5 held, and planner, architect and scout keep the current effort where nothing held on all 5. "Higher effort did better" (lines 60-63) names critic and auditor samples with a Must count. Data flows: the numbers come from real runs. No change to agent definitions: `git diff main...HEAD --stat -- .claude/agents packages/core/agents packages/core/src` printed nothing.

## @ac-4 The compliance check finds the four known breaches

Result: pass

Evidence: Exists: packages/core/test/benchmark-compliance.test.ts:11 runs scripts/compliance.mjs on fixture transcripts extracted from the real ST-LN-7 and BUG-LN-3 runs (packages/core/test/fixtures/benchmark/projects/...). Substantive: it asserts one line for each of tier-up (BUG-LN-3 review round 4, sonnet where opus is asked for), trailer (ST-LN-7 task 1, commit 0496cf0), test-first (ST-LN-7 task 4) and verify-id (ST-LN-7 task 2, "inside describe("), each with the transcript file or commit named. It also asserts that scripts/compliance.mjs contains no ticket id, sha or agent id (general rules), and that the fixtures hold no home path or email. Data flows: docs/benchmark/round-1.md lines 154, 180, 220 and 249 show the same four lines from the real transcripts. For ST-LN-7 task 4 I checked the fixture agent-ae0a4407a746836a7.jsonl: its Edit calls are to packages/cli/src/commands/worktree.ts and no test file is edited through Edit or Write, so the breach reading holds. The test passed in junit.xml.

## @ac-5 The compliance check scores every run against the other rules

Result: pass

Evidence: Exists: packages/core/test/benchmark-compliance.test.ts:70 (junit.xml: passed, 12.6 s, real temporary git repository). scripts/compliance.mjs:5 defines RULES = tier-up, trailer, test-first, verify-id, round-cap, reassigned, brief-quote. Round-cap fires at n >= 6 without an allowing Ruling (scripts/compliance.mjs:103). Data flows: docs/benchmark/round-1.md "Compliance" prints a count for all 7 rules (12, 44, 31, 33, 2, 2, 2) and a section per rule. Zero counts are covered by printing every RULES row. Not independently checked: whether each brief-quote or reassigned line is a true positive. I spot-checked only that they name ticket, task and transcript file.
