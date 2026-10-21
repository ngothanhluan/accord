# Ledger

## Rulings
- Ruling: the debugger is left out of round 1 — no past debugger run exists to sample (0 of 742 runs, 2026-10-12 to 2026-10-21) — its effort stays unmeasured until a later round
- Ruling: commit 0496cf0 is reachable from no branch since it was rewritten as 1c4dcff (ST-LN-7 ledger), so the approach must find it through the transcript or the object store; ac-4 keeps it as the owner's known case — a reader of branch history alone misses it
- Ruling: the two audits' splits were settled in the criteria's wording, not asked one by one (owner: questions short and few), each by the reading closest to the intent: the round's own setting is what a turn is checked against, a fresh pinned judge per run, the whole suite for an executor, matching Musts by issue not wording, general rules naming no known case, round 6 as past the cap — the owner approves the final text verbatim — a reading the owner did not mean reaches the plan
- Ruling: commit 0496cf0 is pinned by the local ref `refs/keep/ST-LN-14-0496cf0` (made 2026-10-21) — it is unreachable, and git gc may delete it once the two-week prune window passes, while ac-4 needs it — a stray local ref; delete it with `git update-ref -d` after the ticket is done
- Ruling: the script itself runs the whole suite and `accord gate plan` in each run's worktree — a deterministic check is no model call, and a result the session reports would be recall — each executor worktree needs its own setup, so the round takes longer
- Ruling: output tokens come from `usage.output_tokens` once per message id; the 4-characters estimate stays only as a labelled fallback — benchmark.mjs:40 says the transcript may keep the usage from the stream's start, so the planner checks one real run first — the output column could be undercounted
- Ruling: a "turn" is one `message.id`, and each field takes the first non-empty value on its lines — one model message spans several transcript lines — the count of flagged turns could differ from a per-line count
- Ruling: output tokens are the largest `usage.output_tokens` per message id; when the 4-characters estimate is larger, the estimate is used and the cell is marked `~` — the count grows across one message's lines (37 then 119 in agent-ac2ea8c2c64fff9ae.jsonl:72-73) and a one-line handback records 24 — output could be over- or under-stated where the estimate is used
- Ruling: the writing agents, one worktree per run, are the executor, the planner and the verifier — accord-verifier.md:13 writes verification.md — more worktrees and longer setup
- Ruling: judges are `accord-reviewer` for executor runs and `accord-critic` for every other run, all pinned to opus at high; the current-effort run of a finding role is not judged, being the reference — a different pin would shift every verdict
- Ruling: a `--round 1 --judge` step follows the runs — a judge needs the run's output, so judges cannot be printed up front — one more dispatch step for the session
- Ruling: `--plan` refuses to run until `--compliance` has written `<bench root>/compliance.md`, and the round report appends that section — compliance-first enforced by the tool, not by memory — none
- Ruling: today's `node scripts/benchmark.mjs [folders]` report stays unchanged as `legacyReport` — nothing asked to change it — it keeps the old first-effort and last-model reading
- Ruling: refs are pinned to shas only in the dispatch prompt and through each sample's explicit `pairs`; named files only get the root and the pairs rewritten — rewriting `main` in plan prose would change the sample — a ref left unpinned inside a named file is not caught
- Ruling: tier-up finds a review round's fix executor by matching a sha its transcript shows against `fixed in <sha>` in review.md — a general rule — a fix whose commit sha is never shown is missed
- Ruling: a "second assignment" is a `SendMessage` sent after the executor handed back `DONE`; one after `BLOCKED` or `NEEDS_CONTEXT`, or before any handback, is a clarifying reply — a mid-run reassignment is not counted
- Ruling: brief-quote compares the brief against the ticket as committed in the newest commit, by author time at or before the dispatch, on `t/<id>`, `origin/t/<id>` or the default branch — rewritten history keeps author times — it may pick the wrong copy when two commits share a second
- Ruling: test-first counts only edits made through `Edit`, `Write`, `MultiEdit` and `NotebookEdit`; a source file is a `.ts` or `.js`-family file that is not a test — edits made through `Bash` are not seen
- Ruling: verify-id lists every task-done refusal whose verify id is not in the report, and adds the enclosing describe when the test file at that time shows one, found by indentation — a test file formatted differently is not detected
- Ruling: committed transcript fixtures keep only the fields the rules read, with every owner prompt, email address and path under the user's home replaced by placeholders — the repository is public (MIT) — a rule that needs the removed text fails its fixture test and shows up at build
- Ruling: `launchedWithDefaults` is not used — the probe runs carried `effort` overrides and still recorded `launchedWithDefaults: true` — none
- Ruling: the verifier's hold check stays judge-ruled, not computed from the two verification.md files — a direct check would change Task 4's `runMatrix` judge assignment and the Task 4 and Task 7 tests; the judge brief asks exactly ac-2's verifier question — an extra judge run per verifier row, and a judge can misread a mark a direct comparison would not
- Ruling: D-04's "so the result also shows whether executor effort should follow the risk kind" is read as part of the Decision, so the report names each not-held sample's kind — it is the stated purpose of keeping the executor's plain and risk mix — one more report section if the owner meant only the sample mix

## Deferred
- plan-review 1.15: the approach says `--plan` rewrites only the brief's working-tree header lines; Task 5 rewrites the root everywhere outside the ticket
- plan-review 1.16: the round-cap rule counts any Ruling matching `round cap` as permission, so `Ruling: the round cap stays at five` hides a round 6 breach
- plan-review 1.17: Task 3's test says `branchCommits(repo)` holds both commits while its setup makes three
- plan-review 1.18: Tasks 3, 5, 7, 8 and 9 mark files `(new)` that Task 2 or Task 4 already creates
- plan-review 1.19: Task 1 expects `run.reads` with `ts`, but its `m4` lines carry no timestamp
- plan-review 1.20: Task 8 expects `suggest(...)` to equal `{ current, suggested, heldAll }` while the interface also computes `lower`
- plan-review 1.21: Task 7's test calls `judgeBrief('must', ...)` with neither `package` nor `plan`
