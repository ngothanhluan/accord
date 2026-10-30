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
