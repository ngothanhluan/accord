# Plan review: BUG-LN-14

## Round 1 (whole)

Critics: criteria (No findings), build, security.

1. Should — The probe never tests the case D-06 exists for: a window started in the main checkout that moved into a ticket's worktree with EnterWorktree, then ran /clear (or /resume). Task 3 decides the kept hold from the hook input's `cwd` only, and the Part A probe starts `claude` directly in the worktree, so no check compares the clear record's `cwd` with the folder the new conversation's Bash runs in; if `cwd` reports the launch folder, ST-9's hold is dropped and two sessions edit one ticket (failure scenario B). Fix: add a probe step where the owner starts `claude` in the main checkout, moves into a sibling worktree with EnterWorktree, types /clear, and runs a Bash line printing `process.cwd()`, the session id and `CLAUDE_PID`; pass when the clear record's `cwd` and the printed folder share one git top, else BLOCKED to the architect. — fixed
2. Should — Task 1 Part A cannot finish when the probe hook writes nothing: the "first dispatch when `out.jsonl` does not exist" rule re-runs step 1, which copies the probe's own settings over `settings.local.json.orig`, so cleanup restores the probe hook for good, pointing at a deleted `probe.mjs`; `.claude/settings.local.json` is not git-ignored, so the `git status` check fails with no way out; nothing returns BLOCKED when `out.jsonl` stays absent; and the "third dispatch" limit has no persisted counter. Fix: detect the first dispatch by `probe.mjs` not existing, never overwrite an existing `.orig`, add a branch for "the owner answered and `out.jsonl` is missing", and persist an attempt count in `node_modules/.cache/accord-probe/`. — fixed
3. Nice — The release reads the process table and takes the holds lock on every /clear and /resume even when no hold carries this window's `CLAUDE_PID`; a lock-free look with `readHoldsFile` first would skip both. — deferred

## Round 2 (diff)

fixed: 1.1, 1.2

1. Nice — Step 7 runs `git -C C:/Work/accord status --porcelain`, which refreshes the index and can take `.git/index.lock` while another session commits in the main checkout; `git --no-optional-locks` avoids it. — deferred

## Closed
Converged at round 2: 0 Must open, 0 Should open, 2 Nice deferred.
