# Ledger

## Rulings
- Ruling: Pick up's `claim: <id>` commit is made by `accord worktree open` right after `git worktree add` and before `setup`; the skill pushes it — a fresh branch whose tip equals a commit on `origin/main` would be judged merged by `worktree clean` and credited by `gitClaims` to that commit's author — cost if wrong: a failed setup leaves a claim commit on a branch not yet pushed.
- Ruling: `accord worktree open` prints a distinct first line when the session must stop and another when it took the hold, so the skill never decides by spotting a path in the text — critic finding 16 — cost if wrong: one line of output changes.
- Ruling: fetch `origin` with `credential.interactive=never`, `ssh -o BatchMode=yes` and `GIT_TERMINAL_PROMPT=0`, and judge against `origin/HEAD`'s target, else `origin/main`, else `origin/master`, reusing load/fs.ts:447-454 — the lookup `gitPeopleOnRefs` already uses — cost if wrong: a team whose main remote is not `origin` gets no cleanup, and loses nothing.
- Ruling: a holder is live while a process with its pid and its recorded start time is in the OS process table; `process.kill(pid, 0)` alone is not used — pids are reused — cost if wrong: a reused pid keeps a dead hold until that process ends.
- Ruling: `worktree clean` names a kept worktree only when its ticket merged (dirty, held, or the one it runs in), never an unmerged one — ac-5 and D-11 — cost if wrong: none.
- Ruling: `setup` output is captured and shown only on failure (the command and the end of its stderr) — a clean `npm ci` floods the chat — cost if wrong: a slow setup looks idle.
- Ruling: the sibling path is built from the main worktree's folder (the first entry of `git worktree list`), never the current one's — no `accord-st-9-st-10` names — cost if wrong: none known.
