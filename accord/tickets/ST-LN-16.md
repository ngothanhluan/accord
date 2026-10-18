---
id: "ST-LN-16"                            # equals the file name: tickets/<id>.md
title: "The dashboard shows tickets a teammate has pushed without a manual git fetch, and tickets queued on a branch that is not a claim"
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
Queued 2026-10-17, not approved; the intent interview replaces this:
- Found while BUG-LN-3 was in review. `accord dashboard` reads the working tree, claim branches (`t/<id>` or the branch template) local and already fetched, and the default branch. It never fetches (packages/cli/src/load/fs.ts:552). A teammate's fresh claim stays invisible until `git fetch`, and tickets queued on a non-claim branch, such as PR #28's `backlog/queue-2026-10-17`, do not show at all.
- Owner asked: "cập nhật real time ticket của dashboard cho toàn bộ nhánh ko nhỉ? kể cả nhánh của team trên remote?", then "tạo ticket riêng đi. để discuss sau." Open: whether the dashboard may touch the network (today it is offline and deterministic), and which branches beyond claims count.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-16

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

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [ ] The dashboard shows another ticket's stage as it stands on that ticket's branch, found 2026-10-18 during the ST-LN-7 intent. The dashboard reads each ticket's file, ledger, and plan from the checkout it runs in; from another ticket's branch it reads only the claimer and the last activity (packages/cli/src/load/fs.ts:117-140). Seen the same minute: from `C:/Work/accord` (branch t/ST-LN-20) ST-LN-7 showed "intent, next: the intent interview" with 1 criterion, while its worktree `C:/Work/accord-ln7` showed "next: the owner approves the ticket" with 5. Committed and pushed progress on a ticket's branch stays invisible to every other session until it merges; the panel draws from the same `dashboard --json`. This predates worktrees and grows with tickets run in parallel (ST-LN-7). The owner asked: "ý là có 2 worktree đang làm việc, thì cái dashboard của một accord session thứ 3 ko cập nhật dc status của 2 session kia hả/", then chose a separate ticket, "ok 1. xem có gộp dc vào ticket nào khác ko". Proposal to confirm at intent: the dashboard reads each claimed ticket's records from the tip of its claim branch. Added 2026-10-18 during the ST-LN-7 approach: the owner proposed one shared state file updated with every ticket's status ("sao ko có một global state file để cập nhật status cung cho toàn bộ ticket? cách này ổn ko?"); ST-LN-7 keeps that file for session holds only (`.git/accord/holds`, its D-14), because a status copy goes stale the moment a session commits without writing it. Instead, for a ticket checked out in a local worktree (`git worktree list`), the dashboard reads the ticket file, ledger, and plan straight from that worktree, uncommitted work included; for a claimed ticket with no local worktree it falls back to the tip of its claim branch. The owner agreed to record this: "thêm ý dashboard đọc thẳng đi".

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
