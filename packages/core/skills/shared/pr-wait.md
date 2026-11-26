---
kind: reference
---

# Waiting on the pull request

This follows the finish report of `./finish.md` when its verdict line names an open pull request. With no pull request open, skip this file and end the turn. The background run and `ExitWorktree` are tools of the host; where one is missing, use the fallback its step names.

Nothing here edits the ticket to record a merge: the merge is read from the pull request, the dashboard's waiting row shows it while it is open, and `/accord continue <id>` makes up a wait that was cut short.

On a sliced ticket this file runs at the last slice, as `./slices.md` says: the command follows the lowest slice pull request still open and ends `merged` only when the last slice has merged.

## Start

1. Read the limit with `accord config get pr.wait_minutes`; `unset` means 120.
2. Run `accord pr wait <id>` with the Bash tool in the background (`run_in_background`), with `timeout` set to the limit plus one minute, in milliseconds, and at most 7200000 (120 minutes). Run one wait at a time: when a wait of this session is still running, start no second one. The command cuts its own limit to 118 minutes at most, so its last line is printed before the host stops a run at 120. Then end the turn; the command wakes this session when it ends.

## When the command ends

Read its last stdout line, and the word after `pr-wait: `. A run whose last line is none of the lines below, or that printed nothing, was stopped by the harness: read it as `limit`.

- `pr-wait: merged #<n>`: leave this worktree with `ExitWorktree`, action `keep`. Then, from the main checkout, run `accord worktree clean --after-merge <id>` and show its lines as they are. It removes the ticket's worktree, its local branch and its origin branch, each under its guards, and refuses (exit 2) while this session still stands in that worktree: on that refusal, remove nothing and do the fallback. When `ExitWorktree` is missing or refuses, print one line, `<id> merged: its folder and branch go at the next session start in another folder`, and end the turn. Never remove the folder by hand.
- `pr-wait: closed #<n>`: print one line, `<id>: PR #<n> was closed without a merge`, and stop.
- `pr-wait: feedback #<n>: ...`: the line holds counts and logins, no comment text. Note `git rev-parse HEAD`, then load `/accord-resolve-pr` for pull request <n>. Its replies wait for the owner's yes (`review.post` is `draft`). When it ends with a new commit pushed, start the next wait as in Start. When it ends with no new commit (replies held as drafts, comments judged not to hold, a question to the owner), stop and tell the owner in one line what waits for them: the same comments, and a change request that stands until the reviewer approves, would end the next wait at once. Start no more than three waits in one session after a feedback line: at the fourth, stop and report instead.
- `pr-wait: ci-failed #<n>: <names>`: a failed check on this pull request is a failure after verify; follow `./failure.md` from its step 1 with those check names. The finish report that comes after its fix starts the next wait.
- `pr-wait: limit #<n> after <m> minutes (<f> polls failed)`: print one reminder line and end the turn: `<id>: PR #<n> is still open after <age>; type /accord continue <id> to pick it up again`, with `<age>` read from `gh pr view <n> --json createdAt`, and `<n>` taken from the finish report when the run printed no line. When `<f>` is 3 or more, add that the wait could not read the pull request that often, that a merge or a comment may have gone unseen, and to check `gh auth status` and `gh --version`. Start no new wait.
- `pr-wait: unavailable: ...` and `pr-wait: no pull request for <branch>`: the wait never started, so nothing watches the pull request: `gh` is missing, not logged in or too old to read the pull request, or no pull request has the ticket's branch. Show that line, add that the merge is made up at the next session start, and end the turn. An `unavailable` line that says `polls in a row failed` ends a wait that had started because `gh` stopped answering (logged out, token revoked, offline): show it the same way, with `gh auth status` and `gh --version` to check. The exception is a line that names a branch `slice/<id>/<n>`: the wait had started, the slices below it have merged, and slice <n> has no pull request, so open it with `accord pr <id> --slice <n>` as `./slices.md` says, then start the wait again as in Start.
