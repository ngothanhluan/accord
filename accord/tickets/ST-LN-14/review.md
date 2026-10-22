# Review: ST-LN-14

## Round 1

Must 1 [patch]: brief-quote compared a brief with the session branch's ticket when the dispatch description named none — scripts/benchmark.mjs:279, scripts/compliance.mjs:114-124 — fixed in 68c1743
Should 2 [patch]: the own-ticket exclusion kept the uppercase id against a lowercased path — scripts/compliance.mjs:118 — fixed in 68c1743
Should 3 [patch]: quoteProblem flagged an unchanged excerpt of the ticket — scripts/compliance.mjs:130-146 — fixed in 68c1743
Should 4 [patch]: test-first worded "source before test" when no test edit was seen at all — scripts/compliance.mjs:84-86 — fixed in 68c1743
Should 5 [patch]: the tier-up line named no task — scripts/compliance.mjs:50 — fixed in 68c1743
Should 6 [patch]: commit shas from Bash missed `git -c … commit` and took older shas from `git log` lines — scripts/benchmark.mjs:227-228 — fixed in 68c1743
Should 7 [patch]: `--plan` recorded a worktree before its setup, so a re-run skipped a failed setup — scripts/benchmark.mjs:581-595 — fixed in f882e4e
Should 8 [patch]: a gate or suite environment failure (exit 2, spawn failure) was scored as not held — scripts/benchmark.mjs:725-726 — fixed in f882e4e
Should 9 [patch]: a sample whose reference held no Must got null instead of holding by default — scripts/round.mjs:211-232 — fixed in f882e4e
Should 10 [patch]: runs and judges were matched by description only, with no agent type or brief check — scripts/round.mjs:261-283, scripts/benchmark.mjs:675-721 — fixed in f882e4e
Should 11 [patch]: stopOnEscape stopped the round for any sha a live ref contains, with no time window — scripts/benchmark.mjs:796-801 — fixed in f882e4e
Should 12 [patch]: the ac-1 test depended on today's frontmatter and restated the formula — packages/core/test/benchmark-round.test.ts:44-60 — fixed in f882e4e
Nice 13 [patch]: `--clean` guards only on the report file existing — scripts/benchmark.mjs:520 — deferred
Nice 14 [patch]: the bench root follows the cwd, so a subfolder run puts it inside the working tree — scripts/benchmark.mjs:337 — deferred
Nice 15 [patch]: `live` is recorded once at the first `--plan` — scripts/benchmark.mjs:575 — deferred
Nice 16 [patch]: a failed suite or gate with an unreadable verdict is held null, not false — scripts/round.mjs:224-229 — deferred
Nice 17 [patch]: a missing compliance.md is written as a bare "None." — scripts/benchmark.mjs:734 — deferred
Nice 18 [patch]: matchRuns does not read `meta.finished` — scripts/round.mjs:261-283 — deferred
Nice 19 [patch]: default transcript folders follow the cwd and the no-match error gives no hint — scripts/benchmark.mjs:18-20, 663 — deferred
Nice 20 [patch]: `generated with` is matched unanchored — scripts/compliance.mjs:65 — deferred
Nice 21 [patch]: the reader test's `/advisor/i` assertion restates D-03 — packages/core/test/benchmark-reader.test.ts:72 — deferred
Nice 22 [patch]: `stripReadPrefixes` is exported but never called — scripts/round.mjs:179-183 — deferred
Nice 23 [patch]: a duplicate run for one tag exits 2 with no hint — scripts/benchmark.mjs:676-677 — deferred
Nice 24 [patch]: `suggest` keeps the current effort when only a higher effort held — scripts/round.mjs:300-301 — deferred
Nice 25 [patch]: a stale "Imports nothing" comment — scripts/round.mjs:2 — deferred

## Round 2

Should 1 [patch]: quoteProblem still flagged a quoted excerpt followed by the brief's own text — scripts/compliance.mjs — fixed in 600a819
Nice 2 [patch]: brief-quote takes the ticket from the first Read of any ticket file ahead of the one the brief names — scripts/compliance.mjs — deferred
Nice 3 [patch]: an environment-failed current run does not void its sample, and an invalid judge plus invalid run is listed twice — scripts/benchmark.mjs runRound — deferred

## Round 3

Must 1 [patch]: two of the 45 samples (verifier 2, scout 1) were this ticket's effort-override probe runs, so those agents were measured on 4 real samples — scripts/benchmark-samples.json:522, :643 — fixed in 137de03
Should 2 [patch]: `--plan` ran no setup for a base whose config predates the `setup:` key (reviewer 4, reviewer 5) — scripts/benchmark.mjs:582 — fixed in 137de03

## Round 4

Nice 1 [patch]: moving the entry line left two blank lines in a row after main() — scripts/benchmark.mjs:813-814 — deferred

## Round 5

No findings

## Round 6

Should 1 [patch]: a failing test and an unhandled error in one run could read green after the narrow re-run, and an unhandled error alone skipped the full re-run — scripts/benchmark.mjs runSuite — fixed in be5dd72
Should 2 [patch]: the narrow re-run path and its JUnit parsing had no test — packages/core/test/benchmark-worktree.test.ts — fixed in be5dd72
Should 3 [patch]: a hold that rests on a re-run left no trace in the round report — scripts/benchmark.mjs runRound, scripts/round.mjs report — fixed in be5dd72
Nice 4 [patch]: the in-process runSuite test repeats the two process-level tests — packages/core/test/benchmark-worktree.test.ts — deferred

## Round 7

Should 1 [patch]: at scoring, a failing file the run itself added or changed was re-run alone, so a test of the run's own that times out only under load counted as held — scripts/benchmark.mjs runSuite, runRound — fixed in e4cb482
Should 2 [patch]: "Holds that rest on a re-run" listed re-run results that did not hold — scripts/round.mjs report — fixed in e4cb482

## Round 8

Must 1 [patch]: `checkFileBases` was defined but never called, so `--samples` and `--plan` let a stale review-package file base through — scripts/benchmark.mjs runSamples, runPlan — fixed in 60ac048
Must 2 [patch]: `packageDrift` compared the whole package text, so it refused reviewer 3, whose rebuild at a rewritten base differs in header and commit hashes by design — scripts/benchmark.mjs packageDrift — fixed in 60ac048
Should 3 [patch]: the test running `checkFileBases` over the committed sample list needs commits a depth-1 CI checkout lacks — packages/core/test/benchmark-samples.test.ts — fixed in 60ac048
Nice 4 [patch]: `checkFileBases` reads every git failure as "not an ancestor" with no reason — scripts/benchmark.mjs checkFileBases — deferred

## Round 9

Nice 1 [patch]: `packageChunks` throws on a diff header git quotes, such as a path with a space or non-ASCII character — scripts/benchmark.mjs packageChunks — deferred


## Round 10

Must 1 [patch]: `--samples` exited 2 on the real list (executor 1 and final-reviewer 1 transcripts moved to the C--Work-accord folder), so no root-reads.json was written and `--plan` could never pass — scripts/benchmark.mjs runSamples, runPlan, runOf — fixed in 58f0b26
Should 2 [patch]: a rebuild could delete a writer branch holding the run's commits when the worktree folder was gone or HEAD was back at base — scripts/benchmark.mjs removeWorktree — fixed in 58f0b26
Should 3 [patch]: the new `parseRun` parsing (start, total, whole, cat, wrote, cut) had no test — scripts/benchmark.mjs parseRun, packages/core/test/benchmark-reader.test.ts — fixed in 58f0b26
Should 4 [patch]: no process-level test of the `--samples` flow (backfill, stop on drift, missing run, `--plan` without root-reads.json) — packages/core/test/benchmark-worktree.test.ts, benchmark-samples.test.ts — fixed in 58f0b26
Nice 5 [patch]: the read check covers only Read and a one-file `cat`, not Grep or other shell reads — scripts/benchmark.mjs parseRun — deferred
Nice 6 [patch]: a read one line short counts as whole, so an overlay can lack its last line — scripts/benchmark.mjs parseRun, scripts/round.mjs — deferred
Nice 7 [patch]: a failed `cat` (no such file, or output cut at the cap) is taken as file content — scripts/benchmark.mjs parseRun — deferred
Nice 8 [patch]: a whole read of a file ending in a blank line always counts as drift — scripts/round.mjs readDiffers — deferred
Nice 9 [patch]: a rebuild is not safe against uncommitted work or Windows locks, and its failure prints the wrong hint — scripts/benchmark.mjs removeWorktree — deferred
Nice 10 [patch]: `cat` with a relative or `/c/...` path is never under root and is not compared — scripts/benchmark.mjs parseRun — deferred
Nice 11 [patch]: `specs`/`sig` in `runPlan` is dead code — scripts/benchmark.mjs runPlan — deferred
Nice 12 [patch]: one assertion passes only because `git()` trims " M a.txt" — packages/core/test/benchmark-worktree.test.ts — deferred

## Round 11

Should 1 [patch]: `--rerun` kept only the branch tip, so a commit on a detached HEAD was lost — scripts/benchmark.mjs rerunWorktree — fixed in 750bbe1
Should 2 [patch]: no test reached the `--plan --rerun` wiring in `runPlan` — scripts/benchmark.mjs runPlan — fixed in 750bbe1
Nice 3 [patch]: the moved-transcript process test hardcodes `0 written, 45 kept` — packages/core/test/benchmark-worktree.test.ts — deferred
Nice 4 [patch]: `--plan --rerun a b` (space-separated) reruns only `a` and ignores `b` silently — scripts/benchmark.mjs — deferred

## Round 12

Should 1 [patch]: two `--rerun` data-loss paths (tip plus detached HEAD, unreadable HEAD) had no test that fails on a wrong implementation — packages/core/test/benchmark-worktree.test.ts — fixed in 434373d
Nice 2 [patch]: the `--plan --rerun` wiring test cannot tell rerun-before-prepare from rerun-after-prepare — packages/core/test/benchmark-worktree.test.ts — deferred
Nice 3 [patch]: `--rerun` checks `git status --porcelain`, which omits ignored files — scripts/benchmark.mjs rerunWorktree — deferred
Nice 4 [patch]: a `--rerun a,b` refusal on `b` comes after `a` was rebuilt, with the wrong hint — scripts/benchmark.mjs runPlan — deferred
Nice 5 [patch]: `rerunWorktree` skips its checks when the record has no branch (unreachable today) — scripts/benchmark.mjs rerunWorktree — deferred

## Round 13

Should 1 [patch]: the `tests.report` step sat outside any try block, so a verifier base without `tests.report` crashed with exit 1 instead of exit 2 — scripts/benchmark.mjs runPlan — fixed in 68c0cb2
Should 2 [patch]: no test failed if the report step re-ran `tests.full` in every verifier worktree instead of copying — packages/core/test/benchmark-worktree.test.ts — fixed in 68c0cb2
Nice 3 [patch]: a failed verifier rebuild said "(setup is repeated on the next --plan run)", wrong for a refusal — scripts/benchmark.mjs runPlan — fixed in 68c0cb2

## Round 14

Should 1 [patch]: the `onlyLinks` refusal branch had no test, so a folder holding a regular file could be deleted with all tests green — scripts/benchmark.mjs removeLeftover — fixed in 9cab86a
Should 2 [patch]: the rebuild hint was one generic string, steering a plain setup failure to `--clean` or `--rerun` — scripts/benchmark.mjs planHint — fixed in 9cab86a
Nice 3 [patch]: a link-only folder with no registration and no record makes `--plan` refuse and `--clean` never sees it — scripts/benchmark.mjs — deferred
Nice 4 [patch]: when `cleanWorktrees`' leftover check throws after git unregistered the worktree, its branch stays — scripts/benchmark.mjs cleanWorktrees — deferred
Nice 5 [patch]: a test name says a re-run does not stop `--plan` while its status 2 comes from the fixture lacking `tests.report` — packages/core/test/benchmark-worktree.test.ts — deferred

## Round 15

Should 1 [patch]: `judgeBriefAt` was lost on the next `--plan`, so a superseded judge counted again — scripts/benchmark.mjs runPlan, scripts/round.mjs matchRuns — fixed in d8b4a9c
Should 2 [patch]: the round report gave times with no measurement notes, though hung runs and machine load inflated some — scripts/round.mjs report, docs/benchmark/round-1.md — fixed in d8b4a9c
Should 3 [patch]: the round-cap rule took an unrelated Ruling as permission, so ST-LN-14 itself was not listed — scripts/compliance.mjs — fixed in d8b4a9c
Should 4 [patch]: docs/benchmark/round-1.md is undeclared with no Ruling naming it — accord/tickets/ST-LN-14/ledger.md — fixed in 9ca6ed3
Nice 5 [patch]: the suggestion table gives final-reviewer medium and verifier low from samples that held only by default — docs/benchmark/round-1.md — deferred
Nice 6 [patch]: two Rulings were in the ledger twice — accord/tickets/ST-LN-14/ledger.md — fixed in 9ca6ed3
Nice 7 [patch]: two tests overlap on the link-only leftover removal — packages/core/test/benchmark-worktree.test.ts — deferred
Nice 8 [patch]: `--rerun` refuses over a tracked test report the run's own suite rewrote — scripts/benchmark.mjs rerunWorktree — deferred
