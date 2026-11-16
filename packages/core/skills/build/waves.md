---
kind: reference
---

# Building in waves

Step 2 of `./SKILL.md` builds the tasks without a ledger line in waves, as this file says. Run every command here in
this worktree, the ticket's own, unless a step names another folder.

1. **Waves.** Run `accord waves <id>` and take its first wave. Split it, in task order, into batches of at most the
   number its `Parallel:` line prints. When it prints `Parallel: 1`, or the wave holds one task, open no task worktree:
   build its tasks in this worktree in order, one at a time, as step 2 of `./SKILL.md` says, then go to step 8. Steps 2
   to 7 apply only to a batch of two or more tasks, and to every task with a `Task <n> worktree:` line, whatever the wave
   size or `Parallel:`: its brief names that folder, so it goes through steps 2 to 7 and is merged and cleaned.

2. **Open.** For each task of the batch, run `accord worktree task open <id> <n>`, then `accord brief <id> <n>` into a
   brief file outside the working tree. When `accord worktree task open` exits 2 saying the ticket was claimed before
   0.6.0, open no other task worktree: build every task left in this worktree one at a time, as step 2 of `./SKILL.md`
   says. Its briefs name no `Work dir:` and no `Report file:`, as before.

3. **Dispatch.** Dispatch a fresh `accord-executor` for each task of the batch, with its brief path only: the brief
   carries the rule to work only in its `Work dir:` and the report its `Report file:` asks for. Dispatch them in one
   message where your tool runs subagents in parallel, else one after another; either way they write the same records.
   Never pass chat history.

4. **Record.** When every executor of the batch has returned, take each task that reported `DONE` or
   `DONE_WITH_CONCERNS`, in task order: run `accord worktree task merge <id> <n>`. After `merged:`, run the test command
   its brief printed here, in this worktree, then `accord task-done <id> <n>` and the ledger commit as step 3 of
   `./SKILL.md` says, then `accord worktree task clean <id> <n>`. Then take the next task. A merge that stops on a
   conflict goes to step 5.

5. **Conflict.** A merge that prints `conflict:` leaves its rebase stopped in the folder that line names. When every line
   under it is `generated:`, the merge prints `regenerate:` with the command for `build.regenerate`, once the owner
   allowed it with `accord trust`: run exactly that command in that folder, run
   `git -C <that folder> add -- <each path>`, and run the merge again; never run `build.regenerate` from
   `accord/config.yml` yourself. Otherwise (no
   `regenerate:` line, or a `hand-written:` line), dispatch a fresh `accord-executor` with the brief plus the conflict
   lines, to resolve them in that folder and stage them with `git add`, with no commit; then run the merge again; show
   the owner a `regenerate refused:` line in your next message, without waiting. Either way the test command after
   `merged:` re-runs the task's tests, and you never stop for the owner over a conflict.

6. **Blocked.** A task that returned `BLOCKED` or `NEEDS_CONTEXT`, or that `accord task-done` refuses, does not stop the
   others of its wave: they are merged and recorded. Handle a block as step 4 of `./SKILL.md` says and a refusal as its
   step 3 says, which may load `accord-debug`. The fresh executor gets the brief again, which still names the same task
   worktree; once it reports, merge and record the task as step 4 here says. A stop on a refused write is step 7's.

7. **Permission.** `BLOCKED: permission <path>` from a task worktree means your tool refused a write there. After the
   wave's other tasks are recorded, take each such task in task order: run `accord worktree task merge <id> <n>` first,
   which brings every commit its executor made there into this branch (with none, this branch does not move; a
   conflict takes step 5's route), then `accord worktree task clean <id> <n>`, then `accord brief <id> <n>` again into
   its brief file. No task worktree is left, so its `Work dir:` and `Report file:` are this worktree's. Dispatch a fresh
   `accord-executor` with it plus the blocked report, one at a time, and record the task as step 3 of `./SKILL.md` says.
   Keep that order; the clean never comes before the merge, because clean refuses a branch holding commits this branch
   lacks, and a brief run before it names the same folder. When that merge or clean still refuses (tracked changes left there, or a conflict
   whose executor is refused there too), handle the task as step 4 of `./SKILL.md` says: ask the owner to allow writes
   in that folder, never to resolve the conflict, with nothing removed. A `BLOCKED: permission` from a brief whose
   `Work dir:` is this worktree, or that has no `Work dir:` line (a ticket claimed before 0.6.0, built here as before),
   has no other folder to go to: handle it as step 4 of `./SKILL.md` says.

8. **Next wave.** The next wave starts only when `accord waves <id>` lists no task of this wave; then go back to step 1.
   A `Task <n> worktree:` line ending `(recorded: clean it)` names a task already recorded: run
   `accord worktree task clean <id> <n>` for it. After a compaction, run `accord waves <id>`: for each other
   `Task <n> worktree:` line whose brief's `Report file:` exists, merge and record that task as step 4 says; dispatch
   the others again.
