# Plan review

## Round 1 (whole)

1. Must — Squash and rebase merges are never cleaned: verify commits the tick (and ci.md may add debug.md) after `verified_commit`, so a real branch tip never equals it and, after a squash, is never on main; every clean prints `kept … commits after its verified commit` forever, against the critic-8 Ruling and the Intent. `doneOnRemote` records the branch tip as `verified_commit`, a state verify never produces, so Tasks 3–5's tests hide it. Count a tip safe when every path changed after the verified commit has the same content on main (or only the ticket's own record files changed), and make the fixture commit the tick on the branch as verify does (Tasks 3, 4, 5) — fixed
2. Should — `cleanDone` drops `cleanDropped`'s guard for a worktree in the middle of a rebase (worktree.ts:694, 738-744): its HEAD is detached, no worktree matches the branch, `passGuards` is skipped, and the local and origin branches are deleted under the rebase, stranding its commits on a detached HEAD. Run the `rebasing` check before the local step and print `kept <b>: being rebased in <path>` (Tasks 3, 4) — fixed
3. Should — Continue outside Claude Code (no `claudeEnv`) merges, runs setup and pushes with no hold check, though a live Claude Code session may hold the ticket (ledger: "only after the hold is taken"; approach S2). Read the holds as `passGuards` does (worktree.ts:568-600); with a live hold print `behind:` and do not merge (Task 2) — fixed
4. Should — `/accord upgrade` takes the `npx --yes` command from the latest matching line anywhere in the conversation, so text from a file, PR body or web page the agent read can make it run another package. Take the command only from the first line of a fresh `accord dashboard` run (the 24 h cache makes it free), and check the package is the one the session rules line names (Task 8) — fixed
5. Should — Task 5's `risk:complex-branching pick up and continue never clean the ticket they open` cannot pass: Task 2 reads the stage from `refs/heads/t/ST-9`, where `doneOnRemote` left ST-9 at `intent`, so Continue merges and prints `merged: 2 commits …`. Commit the done records on the branch before `doneOnRemote`, as verify does (Task 5) — fixed
6. Should — Task 2 breaks `ac-4 in claude code a session that works a ticket refuses other tickets and new tickets and changes nothing` (worktree.test.ts:1006, :1052-1057): ST-9 is at `intent` and 1 behind, so Continue merges instead of printing `behind:` + held. Add it to Task 2's changed-test list with its new expectation or a stage that keeps it unmerged (Task 2) — fixed
7. Should — Task 3 breaks `risk:complex-branching a session whose hold was cleaned or taken over still works its ticket when resumed in the main checkout` (worktree.test.ts:1228, :1242-1248): a merged but not done ticket is now kept, so `removed <sib>` and the dropped hold fail. Add it to the tests switched to `doneOnRemote` (Task 3) — fixed
8. Should — Task 8's `./upgrade.md` reference in accord/worktree.md is rendered into accord-verify and accord-debug, which do not load `accord/upgrade.md`, so `every relative reference resolves inside the same render` (skills.test.ts:261-278) fails; the verify and debug `loads:` and their rendered copies are missing from `files:` (Task 8) — fixed
9. Should — Task 8's test asserts `` `gh pr create --head <branch> --base <base>` `` with a closing backtick after `<base>`, but the text it dictates is one longer code span, so the substring never occurs (Task 8) — fixed
10. Nice — worktree.md's `behind:` reasons omit "a Claude Code session missing its variables" (Task 8) — deferred
11. Nice — the README sentence on which commands clean omits lane S's `new ticket --lane S --worktree` (Task 8) — deferred
12. Nice — hook.test.ts has no `lines` helper; Task 1's tests use one (Task 1) — deferred
13. Nice — `hooksPlanFor`'s description moves the claude check after `assertNoLink`; keep it first in `planHooks` so a codex-only sync with a `.claude` junction still passes (Task 6) — deferred
14. Nice — `loadConfig(next)` should be `loadConfig('accord/config.yml', next)` (Task 6) — deferred
15. Nice — "Before `- Any other exit 2`" matches two bullets in accord/worktree.md (:50 and :77); name the :50 one (Task 8) — deferred

## Round 2 (whole)

1. Should — After a Continue merge whose setup fails, the old setup marker (`accord-setup-done`, written only on success at worktree.ts:101-107) stays, so the next Continue (n=0) and `enterOrStop`/`hold` skip `prepare` and enter the merge commit with pre-merge dependencies, while worktree.md says setup ran again. Remove the marker before `prepare(path)` in step 8 (Task 2) — fixed
2. Should — A lane S ticket done on main records no `verified_commit` (lane-s.md:53-59), so after a squash or rebase merge only rule 1 can pass: its branches are never removed and every `/accord` prints `kept t/ST-20: it has commits after its verified commit`, naming a commit that does not exist, in every clone. When `vc` is undefined run rule 3 against `git merge-base <T> <ref>`, or keep lane S silently (Tasks 3, 4) — fixed
3. Should — Task 8's dictated upgrade.md text puts "Run accord as `npx …`" in one code span; skill-commands.test.ts's `SPAN`/`MENTION` (:53, :61) read the command `as`, so 'names no command the CLI does not register' (:117-119) fails. Dictate the phrase as prose with only the npx part in code, as templates/ruleset.md:26 does (Task 8) — fixed
4. Nice — SKILL.md:9 runs the session check before every action while upgrade.md says none runs first; add "except `/accord upgrade`" (Task 8) — deferred
5. Nice — `risk:complex-branching pick up and continue never clean the ticket they open` runs only Continue; add a Pick up run or drop "pick up" from the title and `verify:` id (Task 5) — deferred
6. Nice — Task 8's `behind:` bullet omits the live Claude Code hold as a reason Continue did not merge (Task 8) — deferred

## Round 3 (diff)

1. Should — Rule 4 compares the whole lane S branch, from its fork point, against main as it is now, so a squash-merged lane S branch is kept forever once main also changes a file the branch changed (a later ticket touching `src/a.ts`, or GitHub squashing a branch that was behind), and every clone prints a false `kept … it has changes not on origin/main` on each `/accord`. Fix: judge rule 4 with `git merge-tree --write-tree <ref> <T>` (git >= 2.38, https://git-scm.com/docs/git-merge-tree), safe when it exits 0 and its tree equals `<ref>^{tree}`; or keep such a branch with no line (Tasks 3, 4) — fixed

## Round 4 (diff)

1. Should — Option A still keeps a squash-merged lane S branch forever when main later edits a file the branch added (add/add) or the same lines it changed: `merge-tree` exits 1, and every `/accord` in that clone prints the false `kept t/A: it has changes not on origin/main`; the round-3 Ruling names only old git as its cost. Add this case to that Ruling's cost, optionally a true kept line for exit 1 (`kept <b>: merging it into <def> conflicts`) with a test for the conflict path; never `-X ours` (Tasks 3, 4) — open
