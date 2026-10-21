---
id: "ST-LN-34"                            # equals the file name: tickets/<id>.md
title: "Clean up a dropped ticket's worktree and branches"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
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
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
A ticket dropped before it merged leaves its worktree and its local and remote branches behind forever, and its drop reason lives only on that branch.
For everyone who drops a ticket: `accord drop <id>` puts the ticket file with its reason on main without the branch's code, and `accord worktree clean` then deletes the worktree and both branches.
Success: after the drop's pull request merges, one `accord worktree clean` leaves no worktree or branch of that ticket, and no commit that exists only locally is lost.
Not in scope: deleting the ticket file or carrying `accord/tickets/<id>/` to main, opening or merging the pull request, cleaning ST-LN-33 itself.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-34

  @ac-1
  Scenario: Dropping a ticket puts only its ticket file on a branch from main
    Given ticket X is claimed on branch t/X, which holds code commits and the only copy of X's ticket file
    When the owner runs `accord drop X --reason "no longer needed"`
    Then a new branch made from origin/main is pushed whose only change against origin/main is accord/tickets/X.md
    And that file has status dropped, a "## Dropped" section reading "no longer needed", and every other section as it is in the tip commit of t/X
    And the command prints the lines "branch: drop/X", "base: main" and "title: drop: X"

  @ac-2
  Scenario: Dropping without a reason is refused
    Given ticket X's file on t/X has no "## Dropped" section
    When the owner runs `accord drop X` without --reason
    Then it exits 2 with a message naming --reason
    And no branch is created, committed or pushed

  @ac-3
  Scenario: Clean deletes a dropped ticket's worktree and both branches
    Given main on origin, as clean fetches it, holds ticket X's file with status dropped
    And X's worktree has no uncommitted work and t/X has the same tip locally and on origin
    When the owner runs `accord worktree clean`
    Then X's worktree, the local branch t/X and the branch t/X on origin are deleted
    And each deletion is printed

  @ac-4
  Scenario: Clean keeps a dropped ticket whose branch has commits not on origin
    Given origin/main holds ticket X's file with status dropped
    And the local branch t/X has a commit that t/X on origin does not have
    When the owner runs `accord worktree clean`
    Then X's worktree, the local branch t/X and t/X on origin all remain
    And a printed line reads "kept t/X: 1 commits not on origin"

  @ac-5
  Scenario: The accord skills drop a ticket with the command
    Given the rendered accord skills
    When an agent reads the step of ids.md that drops a ticket before making one of the other type
    Then that step says to run `accord drop <id>` and no longer says to set the status and merge by hand
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Option A: the dropped ticket's file and its `## Dropped` reason stay on main; only its worktree and branches are deleted — "D-01 đã chọn A: giữ file ticket và lý do trên main, chỉ xoá worktree và nhánh."
- D-02 A new command `accord drop <id>` lands the drop record on main without code: it branches from `origin/main`, writes `status: dropped` and the reason into the ticket file, commits, pushes, and prints the pull request to open — "A"
- D-03 `worktree clean` deletes a dropped ticket's worktree and branches only when nothing beyond what is on the remote is lost: the local and remote tips are equal, or only one exists; the remote branch is deleted only if it is still at the commit just fetched; otherwise it keeps them and prints why; the existing guards (uncommitted work, a session holding it, this session's worktree) stay — "A"
- D-04 The drop record is the ticket file only, taken from its latest version on the claim branch, with `status: dropped`; the reason comes from `--reason "<reason>"`, or from the `## Dropped` section already in that file, when it has one; the `accord/tickets/<id>/` folder is not carried to main — "A"
- D-05 `accord drop` reads the ticket file from the tip commit of the claim branch, and refuses with exit 2 when the ticket's worktree has uncommitted changes to that file — "A"
- D-06 `accord drop` names the pull request to open in host-neutral lines, `branch: <branch>`, `base: main` and `title: drop: <id>`; the skill opens it with `gh` when there is one, otherwise the owner does — "A"
- D-07 When clean keeps a dropped ticket for commits not on origin, it prints one line with their count, `kept t/<id>: <n> commits not on origin`, like the other kept lines — "A"
- D-08 Only step 1 of `ids.md`, the one place that teaches dropping, changes to call `accord drop <id>`; `/accord` gains no drop action — "A"
- D-09 Narrows D-03's "only one exists": a dropped ticket's branch that exists only locally is deleted only when every commit on it is on some origin branch; otherwise clean keeps it with the D-07 line — "A"
- D-10 Extends D-05: when the ticket has no claim branch, `accord drop` reads the ticket file from origin/main instead, and does everything else the same — "A"
- D-11 Extends D-08: the sentence in `ids.md` that says to "commit step 1" in a session working the dropped ticket changes to "run step 1"; nothing else in it changes — "A"
- D-12 The `drop/<id>` branch on origin is left to the host's delete-on-merge, like merged ticket branches today; clean does not delete it — "A"
- D-13 Narrows D-09: a local-only branch whose tip equals the commit its origin branch pointed at just before this same clean pruned it counts as on origin and is deleted — "theo đề xuất"
- D-14 D-11 stands: step 1 still runs in the session that works the dropped ticket; a worktree whose pin predates `accord drop` gets the usual pin refusal and its fix — "theo đề xuất"
- D-15 Where D-02, D-06 and D-10 say main, `accord drop` uses origin's default branch, the same ref clean reads, and prints its short name in the `base:` line — "theo đề xuất"
- D-16 Picking up a ticket (`accord worktree open <id>`) is refused when the default branch on origin holds it as dropped; the message says to make a new ticket instead — "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- "tôi nhớ có ticket giảm nhiễu khi xong phần intent mà? đâu cần show lên hết. chỉ cần intent và phần nói đơn giản giống như trên để hiểu rõ những gì cần làm là dc."
- "tôi thấy có một vấn đề khi AI/accord respond thường hay gắn task như D-10, D-11, tôi đâu biết những thứ đó là gì? tôi làm trên terminal mà? làm sao để user đọc hiểu ngữ cảnh. chứ ko phải chỉ nêu task là dc. vì user có hiểu đâu"

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: plumbing commit plus lease delete. `accord drop` (new `packages/cli/src/commands/drop.ts`, registered in `run.ts` behind the pin preflight) fetches, refuses on an uncommitted ticket file (D-05), on an existing `drop/<id>` on origin (naming `git push origin --delete drop/<id>` as the way out), or on local and origin claim tips that diverged; reads the file with `git show` from the claim tip that descends from the other (local, origin, else the default ref per D-10/D-15); refuses without a reason (ac-2); sets `status: dropped` and writes `## Dropped` with a new core section writer that keeps BOM and CRLF byte for byte; lints the default ref's tickets and config, read from that git tree by a new loader in `packages/cli/src/load/fs.ts`, plus the new file, at error level and refuses on any finding; then builds the commit with no checkout (`hash-object`, a temporary `GIT_INDEX_FILE`, `read-tree`, `update-index`, `write-tree`, `commit-tree`), pushes it by sha to `drop/<id>` without force, and prints `branch:`, `base:`, `title:`.
`accord worktree clean` reads every candidate's status on the fetched default ref in one `git cat-file --batch`. When the fetch failed it deletes nothing that is dropped and prints one kept line. For a dropped ticket it keeps everything when a worktree guard keeps the worktree or the branch is checked out elsewhere; otherwise it removes the worktree first (git refuses to delete a branch checked out in a worktree) and stops there if that fails, then deletes the origin branch with `--force-with-lease` at the fetched sha (verified: git rejects a stale lease on delete), then the local branch only when that succeeded or origin had none; it applies D-03, D-07, D-09, D-13 and prints `deleted <ref> (was <sha>)` for each. Fetch and push go through the no-prompt helper, exported from `worktree.ts`; every `git show` follows the showSignature/maxBuffer convention.
Pick up (`accord worktree open <id>`, `worktree.ts:403`) also reads the ticket's status on the default ref and refuses a dropped one, naming a new ticket as the way (D-16), so clean never deletes a revived claim.
Skill: `ids.md` step 1 says to run `accord drop <id> --reason "<reason>"` with the owner's reason and open the pull request from the printed lines with `gh`, or ask the owner to; the "commit step 1" sentence becomes "run step 1" (D-11); re-render with `npm run gen`, build, `skills sync`.
Rejected: a temporary detached worktree for the drop commit — a full checkout per drop and a stray worktree on a crash, for commit hooks no criterion asks for.
Affected: `packages/cli/src/run.ts`, `commands/drop.ts` (new), `commands/worktree.ts`, `load/fs.ts`, a core section writer under `packages/core/src/write/`, `packages/core/skills/accord/ids.md` and its renders, `skill-commands.test.ts`'s command list.
Risks kept: (1) a repository that dropped tickets the old way and kept their branches loses them on its first clean after upgrading — undone with `git push origin <sha>:refs/heads/t/<id>` from the printed sha; (2) commits pushed to t/<id> from elsewhere after the drop merged are deleted by whoever cleans next — undone the same way, or with the host's "Restore branch", before gc; (3) ignored files inside the worktree (`.env.local`, local data) go with `git worktree remove`, as for merged worktrees today — no undo but backups; (4) the drop commit skips commit hooks.
Tests: ac-1, ac-2 and the D-05, existing-`drop/<id>`, diverged-tip, lint-refusal and CRLF risks in `packages/cli/test/drop.test.ts` against a bare-remote clone; ac-3, ac-4 and the stale-lease, failed-fetch, worktree-remove-fails, remote-only, origin-ahead, guard-kept, second-clone (D-13) and pick-up-refused (D-16) risks in `packages/cli/test/worktree.test.ts`; the section writer in a core unit test; ac-5 in `packages/core/test/stage-skills.test.ts`.
