# Ledger

## Rulings

- Ruling: cleaning up ST-LN-33 with the new mechanism is follow-up work after this ticket is done, not one of its criteria — the owner confirmed the four parts without it — cost if wrong: ST-LN-33 lingers until someone runs the cleanup.
- Ruling: `worktree clean` reads a ticket as dropped from its file on the same reference it already uses for "merged" (origin's default ref, else origin/main) — one reference for both rules — cost if wrong: a drop merged only into a local main is not cleaned until it is pushed.
- Ruling: the pull request `accord drop` prints waits for the owner like other ticket work; the repository's auto-merge convention for backlog pull requests is not extended to it — that convention covers only queuing drafts — cost if wrong: one more owner merge per drop.
- Ruling: the drop branch is `drop/<id>` — neither the `t/{id}` nor the `{id}` branch template can match it, so clean never takes it for a ticket branch — cost if wrong: a rename.
- Ruling: `accord drop` makes no local drop branch; it pushes the commit by sha to `refs/heads/drop/<id>` without force, and on a failed push prints the retry command with the sha — nothing is left locally for clean — cost if wrong: a retry needs the printed sha.
- Ruling: the claim branch's tip is the local branch when it exists, else origin's — unpushed committed edits live on the local branch — cost if wrong: an older text is dropped.
- Ruling: when both `--reason` and a `## Dropped` section exist, `--reason` replaces that section's body; a new section goes before `## Verification notes` when present (lint.notes-not-last), else at the end — cost if wrong: one reworded section.
- Ruling: `accord drop` fetches origin first; a failed fetch, or a ticket already dropped on origin/main, exits 2 — cost if wrong: one refusal.
- Ruling: a dropped ticket whose origin branch has commits the local branch lacks, or has diverged from it, is kept with `kept t/<id>: origin/t/<id> has commits not here` — D-03 deletes only when nothing is lost, and D-07 names only the local-ahead line — cost if wrong: one line's wording.
- Ruling: replaces the "local branch first" Ruling above: `accord drop` reads the claim tip that descends from the other of the local and origin branches, and refuses with exit 2 when they diverged — a stale local branch must not beat a newer reason pushed by a teammate (approach critique 11) — cost if wrong: one refusal the owner settles by pulling.
- Ruling: clean deletes the origin branch first, under the lease, and the local branch and worktree only after that succeeds or when origin has none — a push between fetch and delete then loses nothing (approach critique 4) — cost if wrong: none found.
- Ruling: replaces the order in the Ruling above: clean removes the worktree first and stops if that fails, then deletes the origin branch under the lease, then the local branch only when that succeeded or origin had none — git refuses to delete a branch checked out in a worktree, and a failed remove after the origin delete would strand the only copy (approach critique round 2, findings 1 and 3) — cost if wrong: none found; a failed lease still leaves the local branch.
- Ruling: when clean's fetch failed, it deletes nothing for dropped tickets and prints one kept line — stale refs could show a revived ticket as dropped and still pass the lease (round 2, finding 2) — cost if wrong: one clean that waits for a working fetch.
- Ruling: `accord drop` lints the default ref's tickets plus the new file at error level and refuses on any finding — the drop pull request would otherwise fail main's lint (approach critique 9) — cost if wrong: a drop refused for a finding the owner must fix first.
- Ruling: clean's dropped path skips a branch whose tip is already on the default ref — merged tickets keep today's exact behaviour — cost if wrong: the origin branch of a dropped ticket that was also merged stays, as merged branches do today.
- Ruling: the drop record's status is written through `setFrontmatterKey`, so it reads `status: "dropped"` — the D-45 quoting rule, and the CI `is_dropped` grep accepts quotes — cost if wrong: one changed byte style.
- Ruling: line endings are restored as CRLF when the input contains any `\r\n` — exact for files that use CRLF throughout — cost if wrong: a file that mixes LF and CRLF comes back entirely CRLF.
- Ruling: `--reason` is trimmed, and an empty or multi-line reason exits 2 naming `--reason` — this keeps a reason from injecting a `## ` heading — cost if wrong: one refusal.
- Ruling: the fixed new output lines are `deleted origin/<b> (was <sha>)`, `kept <b>: origin/<b> has commits not here`, `kept dropped tickets: fetch from origin failed`, `kept origin/<b>: git push failed: …` and `kept <b>: its origin branch was not deleted` — cost if wrong: line wording.
- Ruling: new tests make commits only through `commitMsg` and `mergeMsg` (`-F` with `--cleanup=verbatim`) and do not use the existing `-m` helpers — conventions.md — cost if wrong: longer test setup.
- Ruling: plan-review round 1 findings 2 and 3 rest on git behaviour verified locally on git 2.56.0.windows.1, not only on git-scm.com: `git update-ref -d refs/heads/t/X <old>` exits 1 with "cannot lock ref … is at <new> but expected <old>" and keeps the branch when it moved; a worktree mid `rebase -i` shows `detached` with no `branch` line in `worktree list --porcelain`, and `<its git dir>/rebase-merge/head-name` reads `refs/heads/t/X` — cost if wrong: an older git behaves differently and the guard test fails on CI.
- Ruling: clean's dropped path deletes the local branch with `git update-ref -d refs/heads/<b> <L>` after re-reading `L` once the guards pass, and prints `kept <b>: git update-ref failed: <first line>` when git refuses — a commit made during clean must not be lost — cost if wrong: one line's wording.
- Ruling: clean keeps a dropped ticket's branch that any worktree with no branch is rebasing, according to `rebase-merge/head-name` or `rebase-apply/head-name`, and prints `kept <b>: being rebased in <path>` — such a worktree has no `branch` line, so the other guards miss it (verified on git 2.56.0: `rebase --force-rebase --exec false HEAD~1` leaves the worktree detached with `rebase-merge/head-name` naming the branch, and pre-push runs on a delete push) — cost if wrong: one clean waits for the rebase to finish.
- Ruling: ids.md step 1 writes the push as `git push -u origin <claim branch>` — `<branch>` already means the printed drop branch in the same step — cost if wrong: a placeholder rename.
- Ruling: the baseline full run at d5586db failed one case, `hook.test.ts > risk:security the prompt expansion hook blocks every accord text but the dashboard and continue of the worked ticket`, a 30 s timeout under full-suite load (passes alone in 8 s; the hook slowdown noted after ST-LN-26). The owner chose to fix it first in its own ticket — "Sửa trước rồi mới build" — so build starts only after that fix is on main, merged into t/ST-LN-34, and a fresh full run is clean — cost if wrong: ST-LN-34 waits one ticket.
- Ruling: build starts at 84d8623, the merge of origin/main (PR #57, the hook fix) into t/ST-LN-34; the fresh full run there passed, 69 files, 1390 passed, 3 skipped — the condition in the Ruling above is met — cost if wrong: none found.
- Ruling: task 1's drop.ts already wraps fetch and push failures in a UsageError (first stderr line), though Task 2 was meant to add that — a raw git error would have been a stack trace — cost if wrong: Task 2 may change the wording.
- Ruling: task 3's `removeWorktree` returns failed only when the worktree is still listed afterwards; a "removed in part" result counts as gone, so clean goes on to delete the branches — a half-removed folder must not block them, and the printed line already tells the owner to delete the rest by hand — cost if wrong: a branch is deleted while a leftover folder remains.
- Ruling: task 3's test helpers (claimWorktree, dropOnRemote, has) and a small dropAndMerge helper sit at the end of worktree.test.ts, as the plan says; dropAndMerge lets ac-3 and ac-4 share their setup — cost if wrong: none.
- Ruling: task 4's rebase check (`rebaseBranch`) runs before any guard, so a branch held by a stopped rebase is kept with "kept <b>: being rebased in <path>" — as the brief says — cost if wrong: a rebase in a worktree whose git dir cannot be read throws and falls into the existing "could not be judged" line, so the branch is kept.

## Deferred

- Nice (plan round 1.5): drop.test.ts need not import `loadSnapshot`; drop the import if unused.
- Nice (plan round 1.6): test sha helpers should return trimmed output.
- Nice (plan round 1.7): pin `removeWorktree`'s `failed` for partial removal and where `isAncestor` and `firstLine` live.
- Nice (plan round 2.2): the D-05 worktree lookup in `accord drop` should skip a prunable worktree, or prune first.
- Nice (plan round 3.1): condition ids.md step 1's close-this-session sentence on the session running in the ticket's worktree.
- Nice (review round 1.2): clean's `git update-ref -d` leaves the deleted branch's `branch.<b>.remote` and `branch.<b>.merge` config entries; run `git config --remove-section branch.<b>` after the delete, tolerating failure — packages/cli/src/commands/worktree.ts:712.
- Nice (review round 1.3): a one-line `--reason` that is `# Intent` or a fence passes lint and lands in the last section (`## ` duplicates are caught by `load.heading-duplicate`); reject a reason starting with `#`, a fence or `<!--` — packages/cli/src/commands/drop.ts:34.

## Tasks
- task 1 done 6d8598562879
- task 2 done 19cb51433a29
- task 3 done eb4104065ad8
- task 4 done bbebb3268c78
- task 5 done 34274e936158
- task 6 done e1fc4960d4d7
