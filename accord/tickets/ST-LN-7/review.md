## Round 1

Should 1 [patch]: the ac-1 test cannot tell `origin/main` from the local `main`, so a ticket branch cut from the wrong commit passes — packages/cli/test/worktree.test.ts:27 — fixed in 1b243f7
Should 2 [patch]: the fetch in `worktree clean` and the push in `new ticket --worktree` replace the user's own `core.sshCommand`, dropping a per-repository key — packages/cli/src/commands/worktree.ts:238 — fixed in 1b243f7
Should 3 [patch]: one failure inside `worktree clean` (a stale holds.lock, a holds file that is not an object, a throwing `git status`) exits 2 and the bare `/accord` stops before the dashboard; rated Nice by two reviewers, raised to Should by a Ruling over the Veto — packages/cli/src/commands/worktree.ts:107 — fixed in 1b243f7
Nice 4 [patch]: prune and the same-session rule are each tested at two layers, and one assertion pins that a re-entered hold keeps its old `taken` — packages/cli/test/worktree.test.ts:158 — deferred
Nice 5 [patch]: two `risk:regression` tests restate content (this repository's setup list, about 17 skill phrases) rather than guard a behaviour — packages/cli/test/worktree.test.ts:473 — deferred
Nice 6 [patch]: worktree.md carries a new `people` entry into the worktree with four hand-run steps, the most fragile part of the skill text — packages/core/skills/accord/worktree.md:1 — deferred
Nice 7 [patch]: `ids.md` replaces a user's own `core.sshCommand` the same way, outside this ticket — packages/core/skills/accord/ids.md:12 — deferred
