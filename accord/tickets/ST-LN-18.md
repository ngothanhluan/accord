---
id: "ST-LN-18"                            # equals the file name: tickets/<id>.md
title: "The dashboard always lists the tickets left to pick up"
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
approved_hash: "fnv1a64:bc159646183ba8ef"
ac_hash: "fnv1a64:df63e2879d1a8482"
verified_hash: "fnv1a64:df63e2879d1a8482"
verified_commit: "29796f9406aedc2811600878a93a8b5860a14775"
verified:
  - "ac-1"
  - "ac-2"
  - "ac-3"
  - "ac-4"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
While the viewer holds a ticket, the dashboard hides UP NEXT, so backlog and blocked tickets are only a number and nobody can tell which ticket to pick up next.
For whoever opens /accord or the panel while work is in progress: the tickets left to pick up are listed by id and title on every run.
Success: with tickets in progress, `accord dashboard`, its `--json` and the panel list UP NEXT, ranked and capped at 20 without the READY tickets, and the action line offers [Pick up <id>] whenever a ticket can be picked up.
Not in this ticket: listing done tickets; changing the rank, the caps or the summary counts; tickets a teammate pushed that are not fetched (ST-LN-16).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-18

  @ac-1 @test:packages/cli/test/dashboard.test.ts#ac-1-up-next-lists-the-backlog-and-the-blocked-tickets-while-the-viewer-holds-work
  Scenario: UP NEXT lists the backlog and the blocked tickets while the viewer holds work
    Given git `user.email` is "an@example.com", who holds a claim on ST-AN-9, which is in intent
    And ST-AN-1 and ST-AN-2, both `status: draft` and in intent, are unclaimed, and ST-AN-2 has `depends_on: [ST-AN-1]`
    When `accord dashboard --json` and `accord dashboard` run
    Then the JSON's `yours` rows are ST-AN-9, and the rows of `upNext` are ST-AN-1 then ST-AN-2 and nothing else, with ST-AN-2 blocked by ST-AN-1
    And the text prints an UP NEXT section holding "ST-AN-1" and "ST-AN-2", and its last line offers "[Continue ST-AN-9]", then "[Pick up ST-AN-1]", then "[New request]"

  @ac-2 @test:packages/cli/test/dashboard.test.ts#ac-2-up-next-leaves-out-the-ready-tickets-and-caps-the-rest-at-20
  Scenario: UP NEXT leaves out the READY tickets and caps the rest at 20
    Given git `user.email` is "an@example.com", who holds a claim on ST-AN-9, which is in intent
    And ST-AN-50, unclaimed, passes `gate ready` with no task done, and 22 other unclaimed tickets, each `status: draft` and in intent, have no `depends_on`
    When `accord dashboard --json` and `accord dashboard` run
    Then the JSON's `ready` rows are ST-AN-50, `upNext` has 20 rows and `more` 2, and ST-AN-50 is not among the `upNext` rows
    And the text prints "+2 more" under UP NEXT, and its last line offers "[Pick up ST-AN-50]"

  @ac-3 @test:packages/cli/test/dashboard.test.ts#ac-3-up-next-is-present-when-nothing-is-left-to-pick-up
  Scenario: UP NEXT is present when nothing is left to pick up
    Given git `user.email` is "an@example.com", who holds a claim on ST-AN-9, and every other ticket is done
    When `accord dashboard --json` and `accord dashboard` run
    Then the JSON's `upNext` is `{ "rows": [], "more": 0 }`
    And the text prints the UP NEXT heading with "none" under it, and its last line offers no "[Pick up"

  @ac-4 @test:packages/core/test/panel.test.ts#ac-4-the-panel-shows-up-next-while-the-viewer-holds-work
  Scenario: The panel shows UP NEXT while the viewer holds work
    Given the panel reads a dashboard whose `yours` has one row, ST-AN-9, and whose `upNext` has the rows ST-AN-1 and ST-AN-2
    When the panel renders it
    Then it shows the UP NEXT heading with ST-AN-1 and ST-AN-2 under it, below the YOURS section that holds ST-AN-9
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Three parts: (A) UP NEXT, the unclaimed open tickets, backlog and blocked alike, always appears on the dashboard, also while the viewer holds tickets in progress, replacing ST-LN-2 D-04; (B) the Claude Code panel shows the same, since it reads the same JSON; (C) the action line offers [Pick up <id>] whenever a ticket can be picked up: the first READY ticket, otherwise the first unblocked UP NEXT ticket — "Đúng, đủ A+B+C (Recommended)"
- D-02 UP NEXT keeps its cap: at most 20 rows in rank order (effective priority, unblocked before blocked, then id) and `+N more` for the rest; the full list stays `accord status` — "Giữ tối đa 20 + '+N more' (Recommended)"
- D-03 A ticket appears in one section only: UP NEXT leaves out the tickets READY lists, so it holds the unclaimed open tickets that are not ready (backlog and blocked), and its cap and `+N more` count only those — "UP NEXT bỏ ticket đã có ở READY (Recommended)"
- D-04 `upNext` is always present in `accord dashboard --json`, `{ "rows": [], "more": 0 }` when it has no row, as `epics` is; this ends the one exception in ST-LN-2 D-08 — "Luôn có, giống `epics` (Recommended)"
- D-05 The smallest version that counts as done is all of D-01 to D-04: the text, the panel and the JSON — "Đủ D-01..D-04 (Recommended)"
- D-06 (audit) "Open" in D-01 and D-03 means a lane ticket that is not done, archived or dropped, `status: draft` included, as the dashboard reads it today — "Chưa xong, kể cả draft (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-17, after `/accord` showed only YOURS (ST-LN-5, ST-LN-7) and the count line "11 backlog, 1 blocked" while UP NEXT stayed hidden under ST-LN-2 D-04 (UP NEXT appears only when the viewer has nothing in progress and READY is empty): "làm sao tôi biết là ticket nào để pickup? sai idea rồi, phải hiện lên hết trên dashboard chứ"

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen: core always emits `upNext`, the text always prints it, the panel is untouched.** `dashboard()` builds `upNext` on every run from the unclaimed open tickets minus every ready ticket (all of `nextRows`, not only the 20 READY shows), capped at 20 with `more` and `suggest`; the exported `Dashboard` type makes `upNext` required (D-04); the gate at `dashboard.ts:144` and its second return go, and the key order stays yours, team, ready, upNext, epics. `renderDashboard` always prints the UP NEXT block, `none` when empty; the action line already reads `ready.rows[0] ?? upNext.suggest` whatever YOURS holds, so D-01(C) needs no other code. The panel already renders UP NEXT whenever the key is present (`view.js:90`), so D-01(B) is reached through the CLI change alone.
**Rejected:** the same plus the panel requiring `upNext` (`view.js:41`, regenerated `generated/panel.ts` and the synced copy) — no criterion or constraint asks for it, and it adds hash-checked generated files that can drift.
**Affected:** `packages/core/src/status/dashboard.ts`, `packages/cli/src/render/dashboard.ts`, `packages/cli/test/dashboard.test.ts`, `packages/core/test/panel.test.ts`, `docs/design.md:161`, and one pointer line in `accord/tickets/ST-LN-2/ledger.md`. `accord/tickets/ST-LN-2.md` is not edited: its AC hash would change and drop it out of done. Its @ac-3 test keeps its name, so `gate.test-untraced` still finds it, and loses only the assertions that `upNext` is absent once the viewer holds a claim; the risk-test assertion at `dashboard.test.ts:239` flips; two `Dashboard` literals in tests gain `upNext`.
**Risks (critic, no Must):**
- Should: [Pick up] now shows while you sit on a claim branch, and the Pick up step does not say which branch to start from, so a new claim branch made from `t/ST-AN-9` carries its unmerged commits. This already happens for READY picks; ST-LN-7 (a worktree per ticket) is where it is fixed, not here.
- Nice: `suggest` comes from the uncapped list, so when the 20 rows shown are all blocked the action line can name an unblocked ticket past the cap (kept, ledger Ruling).
- Nice: ST-LN-2's text still describes the old D-04; the pointer in its ledger sends a reader here.
- Nice: the @ac-4 panel test passes before any change, since the panel already does this; it guards against regression rather than going red first.
**Tests:** @ac-1, @ac-2, @ac-3 in `packages/cli/test/dashboard.test.ts`, in memory through `dashboard()` and `renderDashboard()`, the layer ST-LN-2 used (the `--json` wiring and key order are already covered); @ac-4 in `packages/core/test/panel.test.ts` on the existing host harness.
