---
id: "ST-LN-7"                            # equals the file name: tickets/<id>.md
title: "Picking up or continuing a ticket gives it its own worktree, so tickets run in parallel"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
priority: high
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
Feature: ST-LN-7

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
- D-01 Split with ST-LN-20: deleting a merged ticket's local branch (`git branch -d`) and pruning stale remote-tracking refs (`git fetch --prune`) move to ST-LN-20 "A merged ticket's branch is cleaned up after its pull request merges", which depends on this ticket; this ticket keeps removing the worktree (`git worktree remove`) and the dashboard naming worktrees whose ticket is done, so the third Open question below narrows to those — "Ticket mới: dọn branch; ST-LN-7: worktree (Recommended)" (2026-10-18, asked in the ST-LN-18 session)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [ ] Scope from ST-LN-6 intent (2026-10-16). The owner asked: "sao khi bắt đầu làm ticket chúng ta ko tạo worktree riêng, checkout branch riêng nhỉ?" Today `/accord` Pick up creates the claim branch and Continue switches to it in the current checkout, so a second ticket run in parallel switches the branch under the first session; ST-LN-6 ran in a worktree made by hand (`C:/Work/accord-sev`), which had no `accord` bin installed. Proposal to confirm at intent: Pick up and Continue use plain `git worktree add` (so Cursor, Codex and Copilot behave as Claude Code does) and prepare the new worktree's dependencies. Owner, on adding this ticket: "ok thêm ticket cho việc handle worktree di. code song song cũng là ưu tiên".
- [ ] Guard for Continue when tickets run in parallel, added 2026-10-16. The owner asked, looking at the panel's Continue button: "khi làm nhiều ticket song song, thì bấm vào continue thì chuyện gì happen? có nên có gate chặn ở đây ko?" Today the panel submits `/accord continue <id>` into the session that owns the panel, and the skill's `git switch` either fails because the branch is checked out in another worktree (the skill says nothing about that case, so an agent may `cd` there and two sessions then edit one worktree), carries uncommitted work of another ticket across, or cuts into a stage still running. Proposal to confirm at intent: Continue finds the worktree holding the ticket's branch (`git worktree list`) and works there, or adds one; one session per worktree, held by a lock the CLI checks, so a second Continue exits 2 naming the holder; a session mid-way through another ticket asks before switching. Owner chose to put this here: "Thêm vào ST-LN-7 (Khuyên)".
- [ ] Removing the worktree when the ticket is done, added 2026-10-17. After BUG-LN-3 merged, the hand-made worktrees `C:/Work/accord-backlog` and `C:/Work/accord-sev` (ST-LN-6, merged days earlier) were still on disk and had to be found and removed by hand. The owner: "ok clean up. tôi nghĩ nên thêm rule này vào accord workflow phải ko?" Proposal to confirm at intent: once the ticket's pull request has merged, the workflow removes its worktree (plain `git worktree remove`, refusing when it holds uncommitted work) and deletes the merged local branch with `git branch -d`; the dashboard can name worktrees whose ticket is done.
- [ ] What a prepared worktree means, found 2026-10-18 during ST-LN-21. Two failures in the hand-made worktree `C:/Work/accord-search`: (1) `npm ci` ran before `npm run build`, so no `node_modules/.bin/accord` was linked (the workspace's own bin points at `packages/cli/dist/cli.js`, missing at install time); in this repository `npx --yes @accord-dev/accord@0.1.0` resolves to the workspace package, so the SessionStart hooks and the panel failed with "'accord' is not recognized" until `npm rebuild @accord-dev/accord --ignore-scripts` after the build; (2) a plain `claude` started in the worktree drew the panel from `C:/Work/accord/.claude/accord-panel`, because the user-level marketplace `accord` in `~/.claude/plugins/known_marketplaces.json` points at the main checkout and wins over the worktree's relative `extraKnownMarketplaces` path, so the owner's hand check of ac-4 first saw the old panel; the branch's panel loaded only with `claude --plugin-dir <worktree>/.claude/accord-panel/plugin --settings <file setting accord-panel@accord to false>`. Proposal to confirm at intent: preparing a worktree runs the repository's own setup in an order that links its bins (a setup command named in config, since only this repository depends on itself), and the try-this steps for a ticket that changes the panel say how to load the branch's panel. Owner, on these two findings: "còn 2 việc phát sinh thì mở một ticket xử lý, hoặc xem có ticket nào dc thì gộp vào luôn".

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
