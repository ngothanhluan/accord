Round record: 1

## Round 1 (whole)
1. Must — the round definition has no per-model price factor and the cost is tokens only, against D-08 and ac-3; sonnet can be named cheaper than haiku — open
2. Must — gathering reuses `snapshotSample`, which writes nothing when a replay check fails (ticket missing at base, drifted read, absolute path outside the bench root) and never copies the transcript itself, so the runs ac-5 must save are lost at retention — open
3. Must — false claims count only `## Absent` rows, so an arm that writes "only"/"none" claims in prose and logs no row scores clean; count prose claims too by a deterministic word match, reported per arm — open
4. Must — data-deletion failure scenarios missing: a refused gather loses the only copy; `--clean` during a named round deletes bench worktrees and branches before scoring (its only guard is that round-1.md exists); a lane scout never tied to its ticket expires — open
5. Should — recall against the whole merged diff does not match round 1 scout briefs that ask questions, so every arm ties; score recall only on samples whose brief asks for the change's files, and intersect the truth with files tracked at the sample's base — open
6. Should — `--gather <id>` has no rule tying a lane scout (run on main before the id exists) to its ticket — open
7. Should — the approach does not state D-06 (pass-mean range) and D-07 (no winner when best arms differ) — open
8. Should — ac-1's other-agent round cannot be planned: runPlan, holds, better and byDefault need a `current` arm the definition does not have — open
9. Nice — score scout check on blobs at the sample commit (as `commitFacts` does) rather than worktree files after setup — deferred
