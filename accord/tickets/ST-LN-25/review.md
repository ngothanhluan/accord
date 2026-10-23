# Review

## Round 1

Should 1 [patch]: the clean deleted a branch whose only change after its verified commit was an unmerged edit to the ticket's own records (an owner Correction, a ledger line), with no `kept` line, because `safeTip` exempted the ticket's record files — packages/cli/src/commands/worktree.ts:722 — fixed in c58fdc0
Should 2 [patch]: SKILL.md runs the session check before every action, so `/accord upgrade` can be stopped in a session working a ticket; worktree.md's `behind:` bullet omits the hold and missing-variables reasons; the READMEs' clean sentence omits lane S's `new ticket --lane S --worktree` — packages/core/skills/accord/SKILL.md:9 — fixed in c58fdc0
Should 3 [patch]: worktree.md ends the `merged:` bullet with the fragment "so for a line starting `push of`", which gives no instruction for an unpushed merge commit — packages/core/skills/accord/worktree.md:31 — fixed in c58fdc0
Nice 1 [patch]: `upgrade` does not check the workflow pin moved; a pin that drifted from config.yml is written back unchanged — packages/cli/src/commands/upgrade.ts:64 — deferred
Nice 2 [patch]: `gitIn`, `NOTHING` and the temporary-index commit sequence copy drop.ts — packages/cli/src/commands/upgrade.ts:17 — deferred
Nice 3 [patch]: the `risk:regression the accord skill routes upgrade …` test asserts prose substrings — packages/core/test/stage-skills.test.ts:741 — deferred
Nice 4 [patch]: `worktrees(ctx.root, ctx.stdout);` in `worktreeClean` discards its result with no comment — packages/cli/src/commands/worktree.ts:675 — deferred

## Round 2

Should 1 [patch]: Continue read the stage from the local branch and merged main into it even when `origin/<branch>` held commits it lacked (a teammate's verify), so the push was refused and the skill's `push of` bullet gave no next step — packages/cli/src/commands/worktree.ts:506 — fixed in 9a82167
Nice 1 [patch]: the `behind:` line still says "merge them with git merge origin/main" when Continue chose not to merge, at verify and done too — packages/cli/src/commands/worktree.ts:505 — deferred
Nice 2 [patch]: in a main-checkout session `continueMerge` takes the hold before the merge, so a conflict or a `checkPin` refusal leaves that session holding a ticket it never entered — packages/cli/src/commands/worktree.ts:513 — deferred
Nice 3 [patch]: `cleanDone` counts a ticket done only at stage `done`, so a laneless (0.1.0 contract) ticket is never cleaned and no line says so — packages/cli/src/commands/worktree.ts:771 — deferred
Nice 4 [patch]: Pick up, Continue and `new ticket --worktree` run `git remote prune origin` and the leased origin deletes with no time limit after the 30-second fetch — packages/cli/src/commands/worktree.ts:578 — deferred

## Round 3

No findings

verdict: converged
