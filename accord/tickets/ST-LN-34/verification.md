---
ticket: "ST-LN-34"
commit: "619a2399a4712a943f8ae248a4408b4f40e1f337"
reviewed_on: "2026-10-22"
---

## @ac-1 Dropping a ticket puts only its ticket file on a branch from main

Result: pass

Evidence: Exists: packages/cli/src/commands/drop.ts:30-110 and the test packages/cli/test/drop.test.ts:45 (ac-1). Substantive: drop.ts reads the ticket file with git show from the claim tip (:70), sets the status and the reason with markDropped (:73), builds the commit without a checkout (hash-object, read-tree, update-index, write-tree, commit-tree, :93-97) with the base as its only parent, and pushes it by sha to drop/<id> (:102). Wired: packages/cli/src/run.ts:209-213 registers `drop <id>` with --reason behind the pin preflight. Data flows: the test drops a real claimed branch against a bare remote. It asserts the drop commit's only parent is main, `diff --name-only main D` is only accord/tickets/ST-10.md, the blob equals the claim-tip file with status dropped plus "## Dropped / no longer needed", and stdout is exactly `branch: drop/ST-10\nbase: main\ntitle: drop: ST-10`. junit.xml (node_modules/.cache/accord/junit.xml:96) shows it passing, with 0 failures in the report.

## @ac-2 Dropping without a reason is refused

Result: pass

Evidence: Exists: packages/cli/test/drop.test.ts:65. Substantive: drop.ts:33-34 rejects a blank or multi-line reason, and :77 throws a UsageError naming --reason when the file has no "## Dropped" section. Every refusal comes before any commit-tree or push, which start at :89. Wired: UsageError gives exit 2 through run.ts:209-213. Data flows: the test runs the CLI with no --reason, a blank reason and a multi-line reason. Each exits 2 with stderr containing "--reason". The remote refs, local drop/* refs, HEAD and the worktree status are unchanged. junit.xml:98 shows it passing.

## @ac-3 Clean deletes a dropped ticket's worktree and both branches

Result: pass

Evidence: Exists: packages/cli/test/worktree.test.ts:1383. Substantive: the clean code in packages/cli/src/commands/worktree.ts reads dropped status from the fetched default ref and removes the worktree, then deletes the origin branch with a lease, then the local branch. The test goes through the real `accord drop` and merges the drop branch on another clone before cleaning. Wired: run.ts:219 describes `worktree clean` with the dropped handling and calls the same command. Data flows: the output equals [`removed <worktree>`, `deleted origin/t/ST-10 (was S)`, `deleted t/ST-10 (was S)`]. The worktree directory is gone, and t/ST-10 is absent both locally and on the remote. junit.xml:957 shows it passing.

## @ac-4 Clean keeps a dropped ticket whose branch has commits not on origin

Result: pass

Evidence: Exists: packages/cli/test/worktree.test.ts:1396. Substantive: the test adds an unpushed commit L in the worktree, drops the ticket and merges the drop, then cleans. Wired: it runs the same `worktree clean` command as ac-3. Data flows: the printed output is exactly `kept t/ST-10: 1 commits not on origin`. The worktree still exists, the local t/ST-10 is still at L, and origin's t/ST-10 is still at S. junit.xml:959 shows it passing. The risk tests at junit.xml:961-975 (diverged, failed fetch, stale lease, second clone) also pass.

## @ac-5 The accord skills drop a ticket with the command

Result: pass

Evidence: Exists: packages/core/test/stage-skills.test.ts:646. Substantive: packages/core/skills/accord/ids.md:36-45 step 1 says to push the claim branch and then run `accord drop <id> --reason "<reason>"`. It describes the branch:/base:/title: lines and the `gh pr create` call, and it no longer says to set the status by hand. ids.md:58 reads "run step 1" instead of "commit step 1". Wired: the test reads the rendered .claude/skills/accord/ids.md and checks the accord-debug and accord-verify copies are identical. It also checks that SKILL.md gains no drop action (D-08). Data flows: the test asserts the exact phrases, the order of push before drop, and that "Set `status: dropped`" and "commit step 1" are absent. junit.xml shows the full suite with 0 failures.
