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
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-20

  @ac-1
  Scenario: <observable outcome>
    Given ...
    When ...
    Then ...
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Split with ST-LN-7: this ticket owns cleaning up a ticket's branch once its pull request has merged (delete the merged local branch with `git branch -d` and prune stale remote-tracking refs with `git fetch --prune`); ST-LN-7 keeps removing the ticket's worktree; this ticket depends on ST-LN-7, since a branch checked out in a worktree cannot be deleted — "Ticket mới: dọn branch; ST-LN-7: worktree (Recommended)" (2026-10-18)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [ ] Scope from ST-LN-18 (2026-10-18). After PR #31 merged, GitHub deleted `t/ST-LN-18` on the remote (`delete_branch_on_merge: true`), but the local branch and the stale `origin/t/ST-LN-18` ref stayed until removed by hand; no skill, lint or gate asks for it. The owner asked: "vậy có ticket nào hoặc rule nào check là phải luôn clean up branch sau khi merge ko?", then, since ST-LN-7 is running in another session: "LN-7 đang làm ở session khác rồi, nếu vậy gom vào LN-19 dc ko?" (the CLI assigned ST-LN-20). To settle at intent: which step runs the cleanup (after `gate done`, on `/accord`, or a CLI command), how it learns the pull request merged, and that it never deletes an unmerged branch (`ids.md`: "Never delete a claim branch to drop a ticket").
- [ ] Found on 2026-10-18, deleting the merged `backlog/st-ln-14-runs-2026-10-18` (PR #39): `git branch -d` refused it as "not fully merged" because its upstream had been deleted on the remote and pruned, so git judged it against the current HEAD (`t/ST-LN-20`), not `origin/main`; it went only with `git branch -D` after `git merge-base --is-ancestor <branch> origin/main` passed. D-01's `git branch -d` therefore fails in the very case this ticket targets (remote branch deleted on merge, cleanup run from another branch). To settle at intent: judge merged with `merge-base --is-ancestor` against the fetched remote main, as ST-LN-7's `worktree clean` does, then delete with `-D`; or run `git branch -d` from a checkout of main; or another rule. The owner asked for this to be added: "thêm issue vào ST-LN-20 luôn đi".

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
