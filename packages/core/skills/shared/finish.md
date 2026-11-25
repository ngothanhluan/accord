---
kind: reference
---

# Reporting a finished ticket

The last message of a finished ticket has three parts, in this order, and nothing else.

1. One verdict line: `✅ <id> DONE — PR #<n> ready, waiting for your merge: <url>`, with `<n>` and `<url>` from
   `gh pr list --head <branch> --state open --json number,url`, where `<branch>` is the ticket's branch as `git branch --show-current` prints it in its worktree, which a `branch` template
   with `{type}` or `{slug}` makes differ from the id; a merged pull request is not open. When no pull request is open, because `gh` is missing or the owner
   is to open it: `✅ <id> DONE — branch <branch> pushed, open its pull request`. Never merge the pull request
   and never write that it is merged: merging waits for the owner.
2. At most four status lines: the facts the owner needs about this finish, such as the tests, CI, the accord check's verdict
   on the tick commit when verify gave one, the review's verdict, and what was skipped or not checked. The closing lines on what was skipped go here, within this limit.
3. `Next:`, then one to three suggestions. Run `accord dashboard` now and read its last line: each suggestion,
   one per line, is a command it names inside one bracket: `/accord continue <id>`,
   `/accord pick-up <id>` or `/accord <request>`. Leave out an action on the
   ticket just finished. The first ends with `(recommended)`. Never suggest an action the dashboard does not print.

After this message, follow `./pr-wait.md` in place of ending the turn; with no pull request open, end the turn.
Never remove the ticket's worktree or branches by hand: `./pr-wait.md` cleans them after the merge, and otherwise,
once the owner merges the pull request, the next session start, resume or /clear, or the next `/accord`,
removes them. A /clear in this finishing session keeps its worktree (`kept <path>: this session's worktree`): the
folder goes only after this session has ended, at a session started in another folder, so tell the owner to close
this session once the pull request is merged.
