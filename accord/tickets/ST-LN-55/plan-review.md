# Plan review

## Round 1 (whole)

1. Must — a nested repository (its own `.git`) inside an ignored disposable folder such as `dist/` passes passGuards, and `git worktree remove` deletes it with any unpushed commit; keep the worktree when a disposable `!!` folder holds a `.git` entry at any depth (lstat walk, never following links), with a risk test — fixed
2. Should — sweepForgotten/cleanForgotten never check whether the recorded path itself is a link or junction, so the walk follows it and unlinks links and empty folders in the target; lstat the root first and never walk through it, with a test — fixed
3. Should — Task 8's budget check between cleanDropped's origin delete push and its local `update-ref -d` can leave a local branch that every later clean keeps with a wrong "not on origin" reason; check the budget once before the removal and treat push plus local delete as one step — fixed
4. Should — the hook clean now runs `git worktree prune` at every session start, which deletes the admin folder of a worktree whose folder is only missing for the moment (unmounted drive), losing a detached HEAD; on the hook path, do not prune entries whose folder is missing, name them on a kept line instead — fixed
5. Should — `git status` cannot see edits in files marked skip-worktree or assume-unchanged, so clean removes them as if committed; keep such a worktree when a flagged file on disk differs from the index (`git ls-files -v`) — fixed
6. Should — Task 1's `sessionClean` calls `repoRoot(input.cwd)` outside its `try`; a hook input cwd that is gone or not a repository makes the hook exit 2 and the session loses its rules; move it inside and print `clean failed …` — fixed
7. Should — a recorded worktree on its own branch whose ticket is dropped while the branch tip is an ancestor of origin's default ref is judged by neither cleanDone nor cleanDropped, and cleanRecorded stays silent, against D-07's "printing the ones it cannot"; print a kept line or remove it — fixed
8. Should — Task 7's `readList` before the "no sibling found" check adds a `git worktree list` read to every clean and breaks the git-count `expectFewer` bounds for `worktree open` and `new ticket --worktree`; reuse the list already read — fixed
9. Should — Task 3's rewritten POSIX test expects `kept <sibling>: sub/f.txt`, but git stops at its first failed entry in readdir order, so on Linux CI the line may name `.git` or `.gitignore`; assert on a line that does not depend on readdir order — fixed
10. Should — Tasks 4 and 7 revisit in the same run a folder `removeWorktree` already left kept, printing a second kept line (the POSIX test's 3 lines become 4); skip any path already judged in this run — fixed
11. Should — on POSIX git unlinks symlinks itself, so ac-1's first worktree passes at the baseline and no test exercises the "delete leftover links, then print removed" path after a successful remove; add a case that fails without sweepRemoved on every OS — fixed

## Round 2 (whole)

1. Should — Task 1's `sessionClean` reads the clean's output from a PassThrough with one `read()`, which returns only the readable buffer; past 64 KiB (e.g. ~750 pruned-ref lines) later `removed`/`kept` lines are lost; collect writes in a string through a minimal writable — fixed

## Round 3 (diff)

No findings (one Nice, deferred to the ledger)

## Closed 2026-10-30: round 3 reported no Must and no Should; gate plan passed

## Round 4 (whole)

Re-plan after origin/main split worktree.test.ts; three critics, lenses criteria, build, security; first round of this re-plan.

1. Must — the non-hook clean (bare `accord worktree clean`, and the cleans in `worktree open` and `new ticket --worktree`) still runs `git worktree prune` in `worktrees()` (worktree.ts:67-75), dropping the only ref to a detached worktree's commit whose folder is missing; the Intent forbids removing a commit reachable from nothing else, and `/accord` is a clean moment (D-07, D-11); fix: before prune, keep any prunable entry with no branch whose HEAD is not on the default ref, not merged and not a branch tip, skip the prune and print a kept line naming the sha; add a `risk:data-loss` test — fixed
2. Should — no test sets a custom `disposable:` list in config.yml, so an executor reading `DEFAULT_DISPOSABLE` directly passes every verify line (D-08); fix: a case with `disposable: [node_modules, dist, coverage]` removed, and `disposable: [node_modules]` keeping an ignored `dist/x` — fixed
3. Should — the record (D-07) is tested only at the fresh-claim creation site (worktree.ts:438); the existing-branch site (worktree.ts:412) and `newTicketWorktree` (worktree.ts:1078) have no test; fix: extend Task 4's test or add a `risk:regression` test asserting both are recorded — fixed
4. Should — Task 6's flagged-file guard reads the index line with `ls-files -s -z -- <path>`, a plain pathspec (conventions.md:9 requires `:(literal)`); `a?.txt` beside `a1.txt` compares against the wrong entry and can remove an edit; fix: `':(literal)' + path` — fixed
5. Nice — Task 6 widens the window between the ignored-file status read and `git worktree remove`; run the status step last in `passGuards` — deferred
6. Nice — Task 5's branch-tip rule counts a stale `refs/remotes/origin/*` after a failed fetch and has no test; pass only `refs/heads` when the fetch failed, add a tip-of-local-branch case — deferred
7. Nice — Task 7's test calls `mkdirSync(c.sibling('ST-11') + '/a')` and `('ST-99')` without `{ recursive: true }` — deferred

## Round 5 (whole)

fixed: 4.1, 4.2, 4.3, 4.4

1. Should — Task 5's no-prune rule breaks `worktree open` of a ticket whose own folder was deleted by hand while another missing folder holds a detached HEAD on no branch: `worktreeOpen` drops prunable entries (plan.md:585-588, worktree.ts:388), line 412 runs `git worktree add <sibling> t/ST-X` on a path git still has registered, and git's error suggests `prune`, which would lose that commit; proposed fix: `git worktree add --force` when the only entry holding the branch is the ticket's own missing sibling (cited only by https://git-scm.com/docs/git-worktree#Documentation/git-worktree.txt---force), otherwise refuse with a line naming the held folder and not suggesting prune; add a `risk:data-loss` test — open
2. Nice — one clean can print `kept` then `pruned` for the same folder, as the prune decision in `worktrees()` is taken per read, before and after the fetch; decide once per clean — deferred
