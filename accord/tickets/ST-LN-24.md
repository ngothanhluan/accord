---
id: "ST-LN-24"                            # equals the file name: tickets/<id>.md
title: "Two tickets in flight that will edit the same file are flagged before they collide"
type: "story" # story | bug. An epic uses its own template
status: dropped                            # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
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
Feature: ST-LN-24

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
- D-01 Split from ST-LN-7: detecting that two tickets worked in parallel will edit the same files is its own lane M ticket, depending on ST-LN-7; blocking between tickets already exists through `depends_on` and `blockedBy` — "New ticket waits on ST-LN-7 (Recommended)" (2026-10-18, asked in the ST-LN-7 intent session)
- D-02 The files a ticket will edit are its plan.md `files:` lines plus the files its claim branch already changes against the main branch, leaving out its own files under `accord/tickets/` — "A" (2026-10-21, asked: plan plus branch diff, plan only, or branch diff only)
- D-03 At plan, `accord gate plan` still passes but prints a warning naming each other ticket in flight and the files they share; the plan stage then stops and asks the owner to add `depends_on`, change the plan to avoid the file, or go on, and records the answer as a Decision — "A" (2026-10-21, asked: stop and ask, a Ruling without asking, or dashboard only)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] Scope from ST-LN-7 intent (2026-10-18). The owner asked, choosing the CLI-enforced Continue guard: "and do we detect which ticket blocks which ticket, or that they do not overlap each other when worked in parallel?" Blocking exists: `depends_on` yields `blockedBy` (packages/core/src/status/rows.ts:89) and a blocked ticket is kept out of READY (rows.ts:113). Overlap is detected nowhere. Sources at hand: each plan task's `files` line in plan.md, and the diff of each `t/*` branch against the main branch. Proposal to confirm at intent: warn when two open tickets' plans or branch diffs touch the same file, at plan and on the dashboard.

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->

## Dropped
Not needed (owner, 2026-10-21). In the intent interview the main session found that accord has no real-time view of other people's work: it reads only pushed and fetched branches, and the skills push a ticket branch only at claim, so a teammate's plan and code stay invisible until the pull request. Asked whether to push after plan and after each task, the owner answered: "I think it is really not very necessary. because each person has a different time frame. and pushing a pr at 1 task still does not make sure those files are the ones edited, added or deleted across the whole PR, right? that is why git branch and merge came about". Conflicts are settled at merge, and `gate done` already fails a review made stale by conflict resolution. The remaining risk, two pull requests that merge cleanly but break together, belongs to the repository setting that requires a branch to be up to date before merging, not to accord. Asked to drop the ticket: "ok drop it".
