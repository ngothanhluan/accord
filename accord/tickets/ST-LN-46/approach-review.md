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
1. Must — the brief filter matches none of the 5 round 1 scout briefs and intent-stage briefs ask questions, so every sample must be a gathered lane scout; a lane scout's base has no ticket file, the replay check does not notice, and the reused brief step (scripts/benchmark.mjs:956, outside any try) throws, aborting the plan or leaving the round with almost no samples — open
2. Should — the prose-claim rule searches every backticked token on an "only" line across the whole repository, so true claims about common identifiers count as false and arms that cite more prose score worse — open
3. Nice — the `--clean` guard never clears for a round whose agent has no scorer, so `--force` becomes the only way past and drops the protection for a scout round in progress — deferred
4. Nice (defer to plan) — gathered entries lack `root`, `main`, `elsewhere`, `files`, `pairs` that `sampleDrift`, `rootReads` and the brief step read, and the snapshot layout differs from what `runPlan` loads — deferred
