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
