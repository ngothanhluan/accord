# Plan review: ST-LN-7

## Round 1 (whole)
Three critics, lenses `criteria`, `build`, `security`, on plan commit e4cce9b. After the round the owner narrowed hold support to Claude Code (D-17) and widened Continue (D-18).
1. Must — Continue from the main checkout cannot reach a ticket whose file exists only on its branch, as after @ac-6: `/accord continue ST-9` in `C:/Work/accord` becomes a New request and starts a second ticket — open, owner: "Nhận cả id có branch t/<id> (Khuyên)"
2. Must — `worktree clean` judges uncommitted work with plain `git status --porcelain`, which follows `status.showUntrackedFiles=no`, so a file never added to git is deleted by `git worktree remove`; use `--untracked-files=normal --ignore-submodules=none` and cover it in the data-loss test — open
3. Must — one probe capture per tool cannot tell two Cursor or VS Code windows apart, so two windows count as one session — owner: "tạm thời chỉ support cho claude thôi"
4. Should — Continue runs `worktree open`, whose no-branch path claims the ticket, so Continue on an unclaimed or merged-and-pruned ticket adds a worktree, commits `claim:` and runs setup; no "never claims" case is tested — open
5. Should — `worktree.md` (Task 8) both forbids editing the worktree on `stop:` and tells the agent to commit the `people` edit there, and its `git restore accord/config.yml` in the main checkout drops the owner's other uncommitted edits to that file — open
6. Should — the Claude Code capture is committed without the owner reading it; the env filter is a denylist that misses names such as `*_JWT` or a URL with credentials, and `~` replaces the home folder only in command lines, not env values — open
7. Should — a process table that reads but shows only part of the system (a sandbox's own PID namespace) makes a live holder look dead, so a second session takes its hold — open
8. Should — `ps -o lstart` prints local time, so the recorded start depends on each caller's `TZ` and a live holder reads as dead; set `TZ=UTC` with `LC_ALL=C` — open
9. Should — on Windows `git worktree remove` can delete part of the tree, fail, and still unregister the worktree; "kept with git's message" is then false and the holds entry is orphaned — open
10. Should — the ac-5 test expects `removed …st-9` first, but `git worktree list` sorts by path and gives st-10, st-11, st-12, st-9 — open
11. Should — Task 5's fake process table takes `CLAUDE.names[0]`, undefined when the Claude Code entry is matched by command line — open
12. Should — Tasks 4 and 6 need a second clone of the remote with local `user.email`, `user.name`, `commit.gpgsign false`, removed by `cleanupAll`; `makeClone` gives none and neither task lists the helper file — open
13. Should — the recovery push command in Task 7 and in `worktree.md` leaves the path unquoted, so a path with a space (`C:/Users/Luan Ngo/...`) breaks `git -C` — open
14. Nice — the main checkout has no setup done-marker, so Continue there reruns the whole setup in the owner's checkout — deferred
15. Nice — the holds lock is not held across the hold check and `git worktree remove` in `clean` — deferred
16. Nice — the setup-source Ruling's reason does not hold for an existing ticket branch pushed by a teammate — deferred
17. Nice — the lock's `finally` must end before `prepare`, or a killed setup leaves `holds.lock` behind — deferred
18. Nice — `loadConfig(file, text)` takes the text, not a URL — deferred
