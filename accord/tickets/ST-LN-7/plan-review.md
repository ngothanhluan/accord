# Plan review: ST-LN-7

## Round 1 (whole)
Three critics, lenses `criteria`, `build`, `security`, on plan commit e4cce9b. After the round the owner narrowed hold support to Claude Code (D-17) and widened Continue (D-18).
1. Must — Continue from the main checkout cannot reach a ticket whose file exists only on its branch, as after @ac-6: `/accord continue ST-9` in `C:/Work/accord` becomes a New request and starts a second ticket — fixed, owner: "Nhận cả id có branch t/<id> (Khuyên)"
2. Must — `worktree clean` judges uncommitted work with plain `git status --porcelain`, which follows `status.showUntrackedFiles=no`, so a file never added to git is deleted by `git worktree remove`; use `--untracked-files=normal --ignore-submodules=none` and cover it in the data-loss test — fixed
3. Must — one probe capture per tool cannot tell two Cursor or VS Code windows apart, so two windows count as one session — owner: "tạm thời chỉ support cho claude thôi"
4. Should — Continue runs `worktree open`, whose no-branch path claims the ticket, so Continue on an unclaimed or merged-and-pruned ticket adds a worktree, commits `claim:` and runs setup; no "never claims" case is tested — fixed
5. Should — `worktree.md` (Task 8) both forbids editing the worktree on `stop:` and tells the agent to commit the `people` edit there, and its `git restore accord/config.yml` in the main checkout drops the owner's other uncommitted edits to that file — fixed
6. Should — the Claude Code capture is committed without the owner reading it; the env filter is a denylist that misses names such as `*_JWT` or a URL with credentials, and `~` replaces the home folder only in command lines, not env values — withdrawn
7. Should — a process table that reads but shows only part of the system (a sandbox's own PID namespace) makes a live holder look dead, so a second session takes its hold — fixed
8. Should — `ps -o lstart` prints local time, so the recorded start depends on each caller's `TZ` and a live holder reads as dead; set `TZ=UTC` with `LC_ALL=C` — fixed
9. Should — on Windows `git worktree remove` can delete part of the tree, fail, and still unregister the worktree; "kept with git's message" is then false and the holds entry is orphaned — fixed
10. Should — the ac-5 test expects `removed …st-9` first, but `git worktree list` sorts by path and gives st-10, st-11, st-12, st-9 — fixed
11. Should — Task 5's fake process table takes `CLAUDE.names[0]`, undefined when the Claude Code entry is matched by command line — fixed
12. Should — Tasks 4 and 6 need a second clone of the remote with local `user.email`, `user.name`, `commit.gpgsign false`, removed by `cleanupAll`; `makeClone` gives none and neither task lists the helper file — fixed
13. Should — the recovery push command in Task 7 and in `worktree.md` leaves the path unquoted, so a path with a space (`C:/Users/Luan Ngo/...`) breaks `git -C` — fixed
14. Nice — the main checkout has no setup done-marker, so Continue there reruns the whole setup in the owner's checkout — deferred
15. Nice — the holds lock is not held across the hold check and `git worktree remove` in `clean` — deferred
16. Nice — the setup-source Ruling's reason does not hold for an existing ticket branch pushed by a teammate — deferred
17. Nice — the lock's `finally` must end before `prepare`, or a killed setup leaves `holds.lock` behind — deferred
18. Nice — `loadConfig(file, text)` takes the text, not a URL — deferred

## Round 2 (whole)
One critic, no lens, on plan commit 328f4b8. fixed: 1.1, 1.2, 1.4, 1.5, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13; withdrawn: 1.6 (the probe is dropped after D-17).
1. Should — the claim path checks the ticket file only in the current checkout, then builds the worktree from `origin/main`, which may lack it (a ticket committed only on another ticket's branch): the claim is pushed and `accord anchor` then finds no ticket; check `git cat-file -e <default ref>:accord/tickets/<id>.md` before `git worktree add` and refuse — open
2. Should — a `prunable` worktree (folder deleted by hand) still lists its branch: Continue prints a path that does not exist and git blocks re-adding the branch, and `clean` spawns `git status` in a missing cwd (ENOENT); parse `prunable` and treat the entry as absent — open
3. Should — `packages/core/skills/accord/ids.md:14` still says `accord new ticket --type <story|bug> --lane <lane>` with no `--worktree`, so a lane M ticket following ids.md lands in the main checkout against @ac-6; add ids.md to Task 7 and its test — open
4. Should — the rendered `accord` SKILL.md is near 4,900 bytes against a 5,120 limit; Task 7 adds about 700, and what may move to `worktree.md` is about 450, so the task ends BLOCKED; measure now and name the passage that moves or the shorter wording — open
5. Should — after Task 6's failed push the skill has no path or `/accord continue <id>` line to show; after a push by hand the skill should run `accord worktree open <id> --continue`, whose case 1 prints them — open
