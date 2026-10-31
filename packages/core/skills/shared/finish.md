---
kind: reference
---

# Reporting a finished ticket

The last message of a finished ticket has three parts, in this order, and nothing else.

1. One verdict line: `✅ <id> DONE — PR #<n> ready, waiting for your merge: <url>`, with `<n>` and `<url>` from
   `gh pr list --head <branch> --state open --json number,url`; a merged pull request is not open. When no pull request is open, because `gh` is missing or the owner
   is to open it: `✅ <id> DONE — branch <branch> pushed, open its pull request`. Never merge the pull request
   and never write that it is merged: merging waits for the owner.
2. At most four status lines: the facts the owner needs about this finish, such as the tests, CI, the review's
   verdict, and what was skipped or not checked. The closing lines on what was skipped go here, within this limit.
3. `Next:`, then one to three suggestions. Run `accord dashboard` now and read its last line: each suggestion,
   one per line, is an action it names, written as its command: `[Continue <id>]` as `/accord continue <id>`,
   `[Pick up <id>]` as `/accord pick-up <id>`, `[New request]` as `/accord <request>`. Leave out an action on the
   ticket just finished. The first ends with `(recommended)`. Never suggest an action the dashboard does not print.

After this message, end the turn. Never wait for the merge, and never remove the ticket's worktree or branches by
hand: once the owner merges the pull request, the next session start, resume or /clear, or the next `/accord`,
removes them.
