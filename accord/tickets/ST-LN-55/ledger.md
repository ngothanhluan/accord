# Ledger

## Rulings

- Ruling: ac-1 covers a worktree git still lists when clean runs (clean removes it, then deletes what is left); a folder git has already forgotten is ac-3's case — the audit read "after git removes it" both ways, and the bug seen on 2026-10-30 is the first case — cost if wrong: orphans found only through the record, which ac-3 tests.
- Ruling: a "real file" is any entry that is neither a link nor a folder, whatever its name or whether git ignores it — the simplest test that never deletes data (D-04) — cost if wrong: a folder holding only tool output is kept and named instead of deleted.
- Ruling: a ticket is done when its file on origin's default branch says so, as clean already decides today; git ancestry alone does not make a ticket done — keeps one meaning of done across accord — cost if wrong: a merged ticket whose file was not marked done is not cleaned.
- Ruling: clean deletes the ticket's origin branch itself, as it already does with a leased push, rather than relying on the host deleting it at merge — hosts differ on that setting — cost if wrong: none beyond one push.
- Ruling: "a session starts" means a session-start event of an agent tool that runs accord's session-start hook: startup, resume and /clear, not compaction; in a tool without that hook, `/accord` with no argument is the moment — compaction happens mid-work, and a clean there would fetch for nothing — cost if wrong: a Cursor, Codex or Copilot user without the hook keeps leftovers until their next `/accord`.
- Ruling: a session start in any folder of the repository, the main checkout or any worktree, runs the clean; clean never removes the worktree that session runs in — today's guard stays — cost if wrong: none.
- Ruling: a non-ticket branch counts as merged only when it has a commit of its own and that commit is on the default branch; a branch just created with no commit of its own is kept — it is likely work about to start — cost if wrong: an empty branch stays until someone deletes it.
- Ruling: for ac-4 the worktree's location is not a condition; a merged non-ticket branch's worktree is removed wherever it is, and a merged branch with no worktree loses only its branches — ".claude/worktrees/" was the case seen, not a limit — cost if wrong: none.
- Ruling: in ac-5 "run folder" means the folder a run worktree leaves on disk after git removes it, not the benchmark's data folder (`accord-bench`), which is never touched; D-04 applies to run folders too — a run folder with a real file is kept and named — cost if wrong: none, data is kept.

- Ruling: "done" in every criterion means accord reads the ticket as done on origin's default branch after a fetch, as clean already decides with the ticket's stage on that ref; no frontmatter field is named — the audit found `status` has no done value — cost if wrong: none, it is today's meaning.
- Ruling: ac-1's file it may not delete is an ignored file outside the D-08/D-12 list, found before `git worktree remove`, so that worktree stays listed and untouched; a file left after git's own partial failure is the approach's kept line, not a criterion of its own — the second audit read "still exist" both ways — cost if wrong: the partial-failure case is tested only as a risk test.
- Ruling: ac-2's session starts outside both worktrees; a session started inside a worktree keeps it as the worktree it runs in, today's guard — the second audit read "any worktree" both ways — cost if wrong: none.
- Ruling: the D-08/D-12 list is a top-level `disposable:` key in config.yml, a list of names — the owner decided the list, not its key — cost if wrong: a rename before release.
- Ruling: critique round 4's five Musts are fixed inside the chosen option, not by switching options; none breaks a Decision — each narrows what clean removes or bounds its time — cost if wrong: a fifth critique would have found more; review catches them.
- Ruling: a worktree with initialised submodules is a known limit, kept and named, never forced — `--force` would bypass the uncommitted-work check — cost if wrong: such repositories keep cleaning by hand.
- Ruling: the record is `<id>\t<path>` lines in `<git-common-dir>/accord/worktrees`, written under the holds lock; a failed write prints a `note` line and the command goes on — no command fails over bookkeeping — cost if wrong: a format change before release.
- Ruling: the hook cleans on startup, and on `session-resume` only when its source is resume or clear — follows the Ruling on compaction — cost if wrong: one fetch per compaction.
- Ruling: the hook clean budget is 300 s (`cleanBudgetMs` in `fetch-limit.ts`); the clean lock is stale when its pid no longer runs or it is older than one hour — the budget sits well below the 600 s timeout — cost if wrong: a slow last removal, or leftovers wait one hour.
- Ruling: the ignored check uses `git status --ignored=matching`, so `sub/.DS_Store` is judged by its own name — plain `--ignored` shows only `sub/`, and ac-1 would fail — cost if wrong: worktrees kept that could be cleaned.
- Ruling: the `removed … in part` line becomes `kept <folder>: <file>`, and the existing POSIX test's line checks follow — the Approach says `removed` means the folder is gone — cost if wrong: git's failure text is no longer shown.
- Ruling: clean keeps a listed worktree that holds another listed worktree — the "ancestor of these" Should applied to `git worktree remove` — cost if wrong: none, data is kept.
- Ruling: the record and sibling sweeps clean dropped tickets only after a good fetch, as `cleanDropped` does — cost if wrong: a dropped leftover waits one fetch.
- Ruling: `disposable` names are one path segment: no `/`, no `\`, not `.` or `..` — cost if wrong: a schema change.
- Ruling: `finish.md` gains an instruction to the agent (never wait for the merge, never remove by hand), not a status line — cost if wrong: the owner is not told in the finish message.

## Deferred

- Plan round 1 Nice: a relative path in a record line is resolved against cwd; skip non-absolute lines and fence descendants of the main checkout — deferred
- Plan round 1 Nice: two cleans that both see the same stale lock pid can both take it over; re-check pid and mtime before removing, release only an own lock — deferred
- Plan round 1 Nice: `disposable` is read from the config.yml of whatever checkout the session starts in; read it from origin's default ref — deferred
- Plan round 1 Nice: ac-2's test starts sessions only in the main checkout; add one start in a linked worktree — deferred
- Plan round 1 Nice: Task 1's hooks test needs a cast on `mergeHooks(...).hooks` to typecheck — deferred
- Plan round 1 Nice: Task 5's `guardHolds(ctx, s)` has no path parameter for its kept line — deferred
- Plan round 1 Nice: `readRecorded`, `dropRecorded` and `withLock` each spawn `rev-parse --git-common-dir` again — deferred
- Plan round 1 Nice: `git remote prune origin` on the hook path has no timeout — deferred
