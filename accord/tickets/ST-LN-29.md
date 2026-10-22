---
id: "ST-LN-29"                            # equals the file name: tickets/<id>.md
title: "An idea that comes up mid-session is queued as a draft ticket without leaving the session"
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
Queued 2026-10-19, not approved; the intent interview replaces this:
- Raised during ST-LN-27. Owner: "khi làm việc với một accord session, và bất thình lình có ý tưởng hoặc idea, hoặc note giống vầy. chúng ta cần 1 skill để queue nó vào. bên gsd-core thì có notes, todo... để pickup later. bên accord tôi nghĩ cứ tạo một ticket là dc." Today queuing is done by hand: a `backlog/<topic>-<date>` branch off `origin/main`, `accord new ticket`, a note in `## Intent`, a pull request (ST-LN-27, ST-LN-28). Owner: "những pr dạng add ticket thì auto merge đi".
- Proposal to confirm at intent: a skill of its own name, such as `/accord-queue <idea>`, never `/accord add` (today `/accord add …` is a New request), so ST-LN-27's prompt-expansion hook, which matches only `/accord`, does not block it in a ticket session; it writes the draft on a backlog branch off `origin/main` without touching the session's ticket branch, opens the pull request, and merges it when config.yml says so. Queuing is not working a ticket, but ST-LN-27 D-09 refuses `accord new ticket` in a ticket session, so the CLI path needs an exception the owner approves.
- Also to settle: look for a similar ticket first and offer to fold the idea in; an idea about the ticket being worked goes to that ticket's ledger, not a new ticket; overlap with ST-LN-16 (queued tickets on the dashboard), BUG-LN-3 (a backlog pull request passes the accord check), ST-LN-22 (`--title`) and ST-LN-12 (deferred items become draft tickets at verify).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-29

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

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
