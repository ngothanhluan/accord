# Plan review

## Round 1 (whole)

1. Must — The Intent's one-clean success needs t/X pushed and its worktree clean, but no step puts it there: stage commits after the claim stay local, and Task 6's new ids.md step 1 never says to commit and push the claim branch before `accord drop`, so clean keeps the usual drop with "kept t/X: 1 commits not on origin" or "uncommitted work" — open
2. Should — clean's dropped path reads the local tip once and deletes with `git branch -D`, so a commit made in the worktree between that read and the delete is lost and the printed sha is wrong; re-read the tip after the guards and delete with `git update-ref -d refs/heads/<b> <L>`, keeping the branch when git refuses — open
3. Should — a worktree with a detached HEAD mid-rebase of t/X has no `branch` line in `worktree list --porcelain`, so the uncommitted-work and live-session guards are skipped for it; keep the branch when such a worktree's `rebase-merge/head-name` or `rebase-apply/head-name` names it, or run the guards by id — open
4. Should — the BOM is written as an invisible U+FEFF literal in plan.md (lines 114, 140, 156); an executor retyping it gets `''`, silently stripping the BOM while the CRLF test still passes; write `'﻿'` — open
5. Nice — Task 1 imports `loadSnapshot` in drop.test.ts but no test uses it (unused-var lint error) — deferred
6. Nice — `remoteDrop` and `commitMsg` helpers are not said to `.trim()` their sha — deferred
7. Nice — `removeWorktree`'s `failed` for the partial-removal case, and the home of `isAncestor` and `firstLine`, are left to the executor — deferred
