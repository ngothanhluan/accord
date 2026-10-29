# Ledger: ST-LN-63

## Rulings
- Ruling: count git processes with a `vi.mock('node:child_process')` wrapper, not GIT_TRACE2 — it counts only accord's own spawns, which is what the change controls (D-09) — the counts will not match the Intent's trace numbers
- Ruling: the shared walk's positives are every claim tip plus every start, so whether it runs never depends on which tickets need it (planner, round 1) — two extra git processes per load in a repository with claims but no entries
- Ruling: Part 2 item tests are `risk:` tests, each testing a real risk of its item plus its own count assertion (planner, round 1) — the reviewer finds a risk kind loose
- Ruling: pick-up and `new ticket --worktree` reuse clean's last worktree list only when clean removed no worktree after reading it (planner, round 1) — a worktree added at the same moment makes `worktree add` fail with a git error; nothing is lost
- Ruling: the light load adds 2 git processes when there is no origin or the fetch fails (planner, round 1) — that path is slightly slower

## Deferred
- plan-review 1.10 Nice — clean's merged set answers R later than today on a ref that may have moved; skip the set for R or re-read it when the ref changed
- plan-review 1.11 Nice — Task 13: core scaffold.test.ts must not read packages/cli/package.json; use a literal shaped like `PKG`
- plan-review 1.12 Nice — Task 6: its verify title names a hook case the test lacks
- plan-review 1.13 Nice — Task 1: `normalise` should name the forward-slash `realpathSync.native` form
- plan-review 1.14 Nice — Task 3: the `rev-parse --verify -q refs/heads/...` assertion also matches `defaultRefOf`'s local fallback before Task 7
