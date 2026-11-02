Round record: 1

## Round 1 (whole)
1. Must — the round definition has no per-model price factor and the cost is tokens only, against D-08 and ac-3; sonnet can be named cheaper than haiku — fixed
2. Must — gathering reuses `snapshotSample`, which writes nothing when a replay check fails (ticket missing at base, drifted read, absolute path outside the bench root) and never copies the transcript itself, so the runs ac-5 must save are lost at retention — fixed
3. Must — false claims count only `## Absent` rows, so an arm that writes "only"/"none" claims in prose and logs no row scores clean; count prose claims too by a deterministic word match, reported per arm — fixed
4. Must — data-deletion failure scenarios missing: a refused gather loses the only copy; `--clean` during a named round deletes bench worktrees and branches before scoring (its only guard is that round-1.md exists); a lane scout never tied to its ticket expires — fixed
5. Should — recall against the whole merged diff does not match round 1 scout briefs that ask questions, so every arm ties; score recall only on samples whose brief asks for the change's files, and intersect the truth with files tracked at the sample's base — fixed
6. Should — `--gather <id>` has no rule tying a lane scout (run on main before the id exists) to its ticket — fixed
7. Should — the approach does not state D-06 (pass-mean range) and D-07 (no winner when best arms differ) — fixed
8. Should — ac-1's other-agent round cannot be planned: runPlan, holds, better and byDefault need a `current` arm the definition does not have — fixed
9. Nice — score scout check on blobs at the sample commit (as `commitFacts` does) rather than worktree files after setup — deferred

## Round 2 (diff)
1. Must — the brief filter matches none of the 5 round 1 scout briefs and intent-stage briefs ask questions, so every sample must be a gathered lane scout; a lane scout's base has no ticket file, the replay check does not notice, and the reused brief step (scripts/benchmark.mjs:956, outside any try) throws, aborting the plan or leaving the round with almost no samples — fixed
2. Should — the prose-claim rule searches every backticked token on an "only" line across the whole repository, so true claims about common identifiers count as false and arms that cite more prose score worse — fixed
3. Nice — the `--clean` guard never clears for a round whose agent has no scorer, so `--force` becomes the only way past and drops the protection for a scout round in progress — deferred
4. Nice (defer to plan) — gathered entries lack `root`, `main`, `elsewhere`, `files`, `pairs` that `sampleDrift`, `rootReads` and the brief step read, and the snapshot layout differs from what `runPlan` loads — deferred

## Round 3 (diff)
1. Should — a prose claim's allowed hits are only the files its line names, so a true "only"/"no other" claim whose line cites the caller but not the definition counts as false (`rewriteBrief` is defined in scripts/round.mjs:164), and a root file such as README.md gives folder `.`, a search wider than the claim — fixed

## Round 4 (diff)
1. Should — allowed hits are now every tracked file the reply names anywhere, so a prose claim a search contradicts is not counted when the contradicting file appears elsewhere in the reply (`rewriteBrief` "only used in scripts/round.mjs" while scripts/benchmark.mjs, cited for another fact, calls it), against ac-2, and arms that name more files get fewer false claims counted; fix to consider: allowed hits = files the line names plus each file the reply cites at a line matching the subject at the sample's commit — fixed
2. Nice (defer to plan) — cutting only `:\d+` misses citation ranges and lists (`:164-170`, `:164,170`, packages/core/src/scout/report.ts:33-34), which brings 3.1 back — deferred

## Round 5 (diff)
1. Should — a cited file becomes an allowed hit in full once any one cited line matches the subject, even a use cited for another fact, so a contradicting file is hidden in the clause's own counter-example: a reply citing `scripts/benchmark.mjs:956-990` (runPlan's brief step, lines 981 and 986 call `rewriteBrief`) and claiming "`rewriteBrief` is only called in `scripts/round.mjs`" counts 0 false claims though benchmark.mjs also uses it at 14, 594 and 597; wider ranges hide more, against ac-2; fix to consider: a cited file is allowed only when every line of it matching the pattern at the sample's commit is among the reply's cited lines for that file (round.mjs:164 stays allowed, so 3.1 holds) — open
