# Ledger

## Rulings
- Ruling: the verify report's "try this" steps include the D-06 comparison — the same read-only request in a fresh session on main and on the ticket branch, each session's <session>.jsonl copied into its own empty folder, then the branch's benchmark with those two folders — and the owner approves only after it — D-06 is not a criterion, so this Ruling and `accord anchor` are what bring it to verify — cost if wrong: high, the owner approves without the comparison D-06 asks for
- Ruling: a session's branch is its first record that carries a gitBranch, as readRun does — the first records of a main transcript carry none — cost if wrong: low, a session that changes worktree shows its first branch
- Ruling: a word holds a letter or digit by the Unicode classes \p{L} and \p{N} — Vietnamese letters such as "ở" are not ASCII — cost if wrong: medium, Vietnamese sentences would be undercounted
- Ruling: the @ac-2 test fills the rules with the cli package's own name and version — the hook injects that invocation — cost if wrong: low, the byte limit would be measured on a string the hook never sends
- Ruling: the benchmark prints its report when a folder holds main sessions but no subagent run — reading main sessions makes that case real — cost if wrong: low, the script would throw on such a folder
- Ruling: the pointer line gains only " or report" — the smallest edit; the rendered accord SKILL.md is 5106 of its 5120 bytes before it — cost if wrong: low, the yes lines and findings reach ask.md only through "report" and rule 8
- Ruling: an approval view with no closing `---` is skipped to the end of its text block — the scenario leaves this case open — cost if wrong: low, a stray "## Intent" heading hides the rest of that block from the count
- Ruling: the D-06 comparison runs the benchmark once with two folder arguments, each holding one copied comparison session — one report the owner reads side by side — cost if wrong: medium, the owner needs two runs to compare
- Ruling: the plan round 2 commit holds the planner's round 1 and round 2 fixes together, and the round 3 diff was rebuilt from the round 1 commit plus the round 1 diff — the round 2 record commit failed before the planner ran; a later commit put plan.md back to its round 1 state so that `plan: ST-LN-33 ready` carries the 2.1 fix, as the stage check needs — cost if wrong: low, git log shows two extra plan commits
- Ruling: the @ac-1 test strips the line-1 marker and compares the 16 old lines as an in-order subsequence of the raw lines — the brief's exact method (task 1 executor) — cost if wrong: none named
- Ruling: the @ac-2 test takes the invocation from packages/cli/package.json, and hook.ts builds the same string (task 2 executor) — cost if wrong: none named
- Ruling: task 3 accepted although its executor wrote scripts/sentences.mjs before running the test, and showed red only by moving the module away — the test was written from the plan's fixture, which fixes every expected value — cost if wrong: medium, the red run proves only that the module is needed, so review must judge whether the test can fail on a wrong counter
- Ruling: task 4 ran no wider suite and no real transcript folder, since the brief names only its two tests (task 4 executor); the main session then ran the benchmark on this worktree's real transcripts, exit 0, one row for this session — cost if wrong: an existing benchmark use could break unseen
- Ruling: the review fix adds "Plain words: ac-1 means this." (5 words) after `---` in the @ac-3 fixture (review fix executor) — cost if wrong: only the test's expected arrays change
- Ruling: the full suite after build had 3 timeouts (status ac-3, workflow-script risk:parsing, worktree risk:complex-branching) while a reviewer ran a second full suite at the same time; the three files re-run alone passed 92 of 92 — load, not this change, which touches none of them — cost if wrong: a real slowdown is missed until verify's full run
- Ruling: the D-06 "with" session ran as `claude -p` in this worktree (transcript ef0e9015, rule 8 present), the "without" session interactively on main (f09c3786); a second no-rule session on t/ST-LN-30 (d83de167) shows the run-to-run spread — the owner's two tries opened in the ST-LN-30 worktree and lacked rule 8 — cost if wrong: medium, headless and interactive replies may differ for reasons other than the rule

## Deferred
- Plan round 1.3 (Nice): Task 4 says "Date.parse(o.timestamp) is a number"; the intended test is not NaN, as readRun does at scripts/benchmark.mjs:50 — deferred
- Review round 2.2 (Nice): the @ac-2 test repeats the older rulesetText checks, which still measure `@x/accord@1.2.3`; the old describe block could go — packages/core/test/session.test.ts:11-22
- Review round 2.3 (Nice): docs/design.md:201 lists only seven session rules; rule 8 is missing
- Final review risk, no finding (follows @ac-3's wording): pasted ticket text without a "## Intent" heading (a "- D-01 …" line of 91 words, a quoted "> **Risks …**" passage of 81) and a bold option ending ".**" are counted as long sentences, which raises the long share on real data; changing it changes @ac-3

## Tasks
- task 1 done 12ef32f018d6
- task 2 done 4bc423810bd7
- task 3 done 818f906ba8d2
- task 4 done b1424588d8c7
