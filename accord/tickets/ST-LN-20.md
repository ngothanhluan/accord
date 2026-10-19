---
id: "ST-LN-20"                            # equals the file name: tickets/<id>.md
title: "A merged ticket's branch is cleaned up after its pull request merges"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-7"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# The epic this ticket belongs to.
# parent: "EPIC-ID"
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Optional design reference URL.
# design: "https://example.com/design/..."
# Written by `accord approve` after the owner says yes; never edit by hand.
# approved_hash:
# Written by `gate ready`; never edit by hand.
# ac_hash:
# Self-test ticks, e.g. [ac-1, ac-2]. Always the last key.
# verified: []
# The AC hash and the commit the ticks were made against.
# verified_hash:
# verified_commit:
approved_hash: "fnv1a64:e989d10e6c186ff2"
ac_hash: "fnv1a64:13a33402714f6dc5"
verified_hash: "fnv1a64:13a33402714f6dc5"
verified_commit: "db88484560e7caf3ec1a0d4ab3a8c58acdce1ee5"
verified:
  - "ac-1"
  - "ac-2"
  - "ac-3"
  - "ac-4"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: after a ticket's pull request merges, its local branch and the stale `origin/t/<id>` ref stay behind and must be found and deleted by hand; `git branch -d` even refuses the merged branch once its upstream is gone.
For whom: anyone, solo or on a team, who runs tickets through accord and merges them with a merge commit.
Success: the next bare `/accord` after a merge deletes every merged ticket branch in the clone and prunes the stale remote-tracking refs, naming each branch it deletes or keeps, and never loses a commit that is not on the remote main branch.
Not this ticket: squash or rebase merges, whose branches are never judged merged and stay (D-03); deleting a local branch not named by the ticket branch template; deleting branches on the remote; removing worktrees (ST-LN-7).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-20

  @ac-1 @test:packages/cli/test/worktree.test.ts#ac-1-bare-accord-deletes-merged-ticket-branches-with-or-without-a-worktree-and-names-the-checked-out-one-it-keeps
  Scenario: /accord with no argument deletes merged ticket branches, with or without a worktree, and names what it keeps
    Given the remote main branch contains the tips of the local branches "t/ST-9", "t/ST-10" and "t/ST-12", and not the tip of the local branch "t/ST-11"
    And "t/ST-9" has no worktree, "t/ST-10" is checked out in the worktree "C:/Work/accord-st-10", which "/accord" removes as merged, and "t/ST-12" is checked out in "C:/Work/accord", the checkout the session runs in
    When "/accord" with no argument runs in a session rooted at "C:/Work/accord"
    Then the local branches "t/ST-9" and "t/ST-10" are deleted, each named as deleted
    And "t/ST-12" is kept, named with the reason that it is checked out in "C:/Work/accord"
    And "t/ST-11" is kept and not named

  @ac-2 @test:packages/cli/test/worktree.test.ts#ac-2-a-merged-branch-whose-remote-branch-is-gone-is-deleted-from-another-ticket-branch-with-a-stale-local-main
  Scenario: A merged branch whose remote branch was deleted on merge is deleted from whatever branch the session stands on
    Given the pull request of "t/ST-9" merged with a merge commit and the remote deleted the branch "t/ST-9"
    And the local branch "t/ST-9" tracks "origin/t/ST-9", has no worktree, and "C:/Work/accord" has the branch "t/ST-20" checked out, which does not contain the tip of "t/ST-9"
    And the local branch "main" has not been updated since before the merge, so it does not contain the tip of "t/ST-9" either
    When "/accord" with no argument runs in a session rooted at "C:/Work/accord"
    Then the local branch "t/ST-9" is deleted and named as deleted

  @ac-3 @test:packages/cli/test/worktree.test.ts#ac-3-a-ticket-branch-with-a-commit-not-on-the-remote-main-is-kept-and-not-named
  Scenario: A local commit that is not on the remote main branch keeps its branch
    Given the remote main branch contains the merged tip of "t/ST-9", and the local branch "t/ST-9" has one more commit made after the merge, with no worktree
    When "/accord" with no argument runs in a session rooted at "C:/Work/accord"
    Then the local branch "t/ST-9" and its extra commit are kept, and the branch is not named

  @ac-4 @test:packages/cli/test/worktree.test.ts#ac-4-stale-remote-refs-are-pruned-after-a-good-fetch-and-a-failed-fetch-prunes-nothing
  Scenario: Stale remote-tracking refs are pruned, and a failed fetch prunes nothing
    Given the remote deleted the branches "t/ST-9" and "backlog/notes", and the clone still has the refs "origin/t/ST-9" and "origin/backlog/notes"
    When "/accord" with no argument runs in a session rooted at "C:/Work/accord" and the fetch from the remote succeeds
    Then "git branch -r" lists neither "origin/t/ST-9" nor "origin/backlog/notes", since every remote-tracking ref of the remote whose branch is gone is pruned, whether or not it is named by the ticket branch template
    And when the fetch fails instead, the failure is said in one line, no ref is pruned, and branches are judged against the remote main branch as the clone last fetched it
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Split with ST-LN-7: this ticket owns cleaning up a ticket's branch once its pull request has merged (delete the merged local branch with `git branch -d` and prune stale remote-tracking refs with `git fetch --prune`); ST-LN-7 keeps removing the ticket's worktree; this ticket depends on ST-LN-7, since a branch checked out in a worktree cannot be deleted — "Ticket mới: dọn branch; ST-LN-7: worktree (Recommended)" (2026-10-18)
- D-02 The cleanup runs in `accord worktree clean`, the step bare `/accord` already runs, and walks every local branch named by the ticket branch template, with or without a worktree, not only the branch of a worktree removed in the same run; a branch checked out anywhere is kept and named with the reason — "A" (2026-10-19)
- D-03 A ticket branch is judged merged only when its local tip is an ancestor of the remote main branch just fetched, as ST-LN-7 judges worktrees; there is no second signal, so with squash or rebase merges a branch is never deleted, and a merged branch is then deleted with `git branch -D`, since `-d` judges against the branch checked out or a pruned upstream — "A" (2026-10-19)
- D-04 The audit's two double readings, settled as recommended: @ac-2 is proved by its outcome, with the local `main` also missing the merged tip, never by recording the git calls; @ac-4 prunes with a plain `git fetch --prune`, so every stale remote-tracking ref of the remote goes, ticket or not, while a local branch not named by the ticket branch template is never deleted — "theo đề xuất" (2026-10-19)
- D-05 Plan review round 1, applied: the fetch is `git fetch --no-prune origin`, so a `fetch.prune` setting cannot prune before a transfer that then fails; and each remote-tracking ref the prune removes is named with its full sha, `pruned <ref> (was <sha>)`, since it can be the last copy of an unmerged branch deleted on the remote; the two Nice findings are fixed as well — "làm hết đi" (2026-10-19)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] (answered by D-02, D-03) Scope from ST-LN-18 (2026-10-18). After PR #31 merged, GitHub deleted `t/ST-LN-18` on the remote (`delete_branch_on_merge: true`), but the local branch and the stale `origin/t/ST-LN-18` ref stayed until removed by hand; no skill, lint or gate asks for it. The owner asked: "vậy có ticket nào hoặc rule nào check là phải luôn clean up branch sau khi merge ko?", then, since ST-LN-7 is running in another session: "LN-7 đang làm ở session khác rồi, nếu vậy gom vào LN-19 dc ko?" (the CLI assigned ST-LN-20). To settle at intent: which step runs the cleanup (after `gate done`, on `/accord`, or a CLI command), how it learns the pull request merged, and that it never deletes an unmerged branch (`ids.md`: "Never delete a claim branch to drop a ticket").
- [x] (answered by D-03) Found on 2026-10-18, deleting the merged `backlog/st-ln-14-runs-2026-10-18` (PR #39): `git branch -d` refused it as "not fully merged" because its upstream had been deleted on the remote and pruned, so git judged it against the current HEAD (`t/ST-LN-20`), not `origin/main`; it went only with `git branch -D` after `git merge-base --is-ancestor <branch> origin/main` passed. D-01's `git branch -d` therefore fails in the very case this ticket targets (remote branch deleted on merge, cleanup run from another branch). To settle at intent: judge merged with `merge-base --is-ancestor` against the fetched remote main, as ST-LN-7's `worktree clean` does, then delete with `-D`; or run `git branch -d` from a checkout of main; or another rule. The owner asked for this to be added: "thêm issue vào ST-LN-20 luôn đi".

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen:** a branch pass inside `accord worktree clean` (packages/cli/src/commands/worktree.ts `worktreeClean`), the step bare `/accord` already runs (D-02). It now fetches whenever an `origin` remote exists, not only when a ticket worktree exists: `git fetch --no-prune origin` first, the flag overriding a `fetch.prune` or `remote.origin.prune` setting (checked with git 2.56), then `git remote prune origin` only once that fetch succeeded, because git prunes before it downloads and a fetch that dies mid-transfer would already have pruned (@ac-4, critic 2, plan review 1.1). Each remote-tracking ref the prune removes is named `pruned <ref> (was <sha>)` with the full sha, read from `git for-each-ref refs/remotes/origin` before and after the prune, since such a ref can hold the last copy of an unmerged branch deleted on the remote (D-05). After the worktree loop it lists the worktrees again, reads `git for-each-ref refs/heads` by full ref name and sha (a tag of the same name cannot shorten it, critic 4), and takes every branch the ticket branch template matches, whether or not that ticket's file is in this checkout (@ac-2, critic 1). A branch whose tip passes `git merge-base --is-ancestor <sha> <ref>`, the ref being the fetched remote main from `gitDefaultRef`, never the local `main` or HEAD (D-03, @ac-2), is either kept and named `kept <branch>: checked out in <path>` when any worktree, the main one included, has it checked out (@ac-1), or deleted with `git branch -D` and named `deleted <branch> (was <sha>)` with the full 40-character sha (D-03). An unmerged branch, or one with a commit not on the remote main, is skipped without a line (@ac-1, @ac-3); an error on one branch prints `kept <branch>: could not be judged: <git's message>` and goes on. The description of `worktree clean` in packages/cli/src/run.ts says it now deletes merged ticket branches and prunes stale remote refs.
**Rejected:** compare-and-delete with `git update-ref -d refs/heads/<b> <sha>` (closes a race only a writer outside the branch's worktree can hit, and departs from D-03's `git branch -D`); a separate `accord branch clean` command with its own skill step (breaks D-02).
**Affected:** packages/cli/src/commands/worktree.ts (`worktreeClean`), packages/cli/src/run.ts (description), packages/cli/test/worktree.test.ts (four new tests and the expected output of nine existing ones: the extra branch lines, the fetch now run with no ticket worktree, and the pruned-folder test whose branch now sits at `origin/main`). No skill text changes: the dashboard step already shows the clean lines verbatim. No change to README, schema, or core.
**Risks:** (1) Should, kept: the dashboard reads claims from branch refs and stages from the session's checkout, so in a checkout older than the merge a merged ticket, once its local branch is deleted and its remote ref pruned, shows as unclaimed and could be picked up again; the remote branch is already gone today when GitHub deletes it on merge, so only the leftover local branch kept the claim visible, and showing other tickets as they stand on the remote is ST-LN-16. (2) Should, kept: every bare `/accord` with an `origin` remote now fetches; offline it prints the fetch-failure line each time. (3) Could, kept: a worktree mid-rebase or mid-bisect lists as detached, so its merged branch is kept with git's refusal as the reason, not its folder. (4) Could, kept: a branch someone made by hand at a commit already on main, with no commit of its own, is deleted; nothing is lost.
**Failure scenarios (data deletion) and how each is undone:** (A) a merged branch someone still meant to use is deleted: `git branch <name> <sha>` with the sha from the `deleted` line (the commit is on the remote main), then `git branch -u origin/<name>` if the remote branch still exists; its reflog is not restored. (B) the prune removes `origin/<b>` for a branch deleted on the remote without being merged, the clone's last copy of its commits: `git branch <b> <sha>` with the sha from the `pruned` line, before `git gc` expires unreachable commits (two weeks by default); a prune that fails part-way has removed only names the remote no longer lists, each named the same way. (C) the remote main the clone last fetched was later force-pushed, or `origin/HEAD` names a branch that is not where work merges, so a tip is judged merged wrongly: `git branch <name> <sha>` from the printed line, or the sha from `git reflog origin/main`, both before `git gc` expires unreachable commits (two weeks by default).
**Tests:** @ac-1 to @ac-4 each by one test in packages/cli/test/worktree.test.ts at the CLI command layer, against a real bare remote and clone, with no mock for git; @ac-2 with the root on another ticket branch and a local `main` left behind (D-04); @ac-4 with a ticket ref and a non-ticket ref pruned, and an unreachable remote that prunes nothing.
