---
id: "ST-LN-22"                            # equals the file name: tickets/<id>.md
title: "A new request is checked against existing tickets, and the related ones' decisions reach the scout and the critic"
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
Queued 2026-10-18, not approved; the intent interview replaces this:
- Found during ST-LN-21: `/accord <request>` proposes a lane and creates a ticket at once; nothing reads the existing tickets, open, done, or dropped, so a request that repeats a queued ticket or work already done becomes a new ticket unless someone happens to remember. Checks so far were by hand (the owner asking which tickets could be merged on 2026-10-18; a scout question added to ST-LN-21 by choice).
- Owner asked: "so how do we know we are not doing work that repeats?", then chose "Question 2. A" (queue a ticket now, intent later). Proposal to confirm at intent: before the lane, the CLI prints candidate tickets matched by title and Intent, so the step cannot be skipped by recall; the agent asks the owner to continue an existing ticket, merge into it, or create a new one linked to it. Also covers the panel's New request button, which submits `/accord <text>`.
- Added 2026-10-18 at the owner's "A": the same search also finds the related tickets, and their Decisions and Vetoes go to the scout at intent and to the critic at approach, which today checks only the current ticket's. Why: the code shows what the system does, not why or what the owner forbade; a finished ticket's Decisions are read by no later step, so a new ticket can break one unnoticed (rewriting ask.md in ST-LN-5 nearly dropped "the recommended option carries its reason" until the owner caught it, now D-08). Not needed at build or review, or for lane S. Rules that hold project-wide go to the conventions file ST-LN-8 adds.
- Added 2026-10-19 at the owner's request ("add --title to accord new ticket. choose some ticket and add to it, no need to create a new ticket"): `accord new ticket` takes `--title <text>` and writes it into the ticket's `title:`, and New request passes a short business-language title made from the request. Why: until the intent stage every new ticket carries the template's "Short title in business language", so two tickets created in a row (ST-LN-25 and ST-LN-26 on 2026-10-19) showed the same title on the dashboard.
- Added 2026-10-27 at the owner's request ("check the backlog; if it is not there, add it, or see whether a related ticket exists, adding to it is fine too"): the search also starts from the code, not only from the request text. The owner asked: "later, when a ticket changes some function, how is accord aware of why it was implemented this way back then and not another way?" Proposal to confirm at intent: a CLI command, for example `accord why <file>[:<lines>]`, follows `git log -L` on those lines to their commits, takes the ticket ids from the commit subjects, and prints each ticket's Decisions, Vetoes, `Rejected:` lines and ledger Rulings; the approach's impact analysis runs it on the files the ticket touches and lists the result under History, and the critic checks the approach against it; an approach that overturns an earlier Decision says "supersedes <id> D-xx" with the reason and needs the owner's yes. Why: commit subjects already carry the ticket id and finished tickets are kept, so the chain code → commit → ticket exists, but no step follows it.
- Added 2026-10-27, same request: a repository that adopted accord late has no ticket ids in its older commits. The owner asked: "if earlier projects did not use accord and install it later, how do we find the ticket id? how should this be handled?" Proposal to confirm at intent: the command falls back, in order, to tracker ids in the commit matched by patterns in `config.yml` (printed, never fetched, so adapter `none` stays fully usable), the PR number of a merge commit, then the commit subject and body marked "no recorded decision". A reason an agent infers from the code is labelled as inference and never written to Decisions. Missing reasons are filled only where code is touched, never by a bulk backfill: the approach adds an Open question "why does <code> do X?", and the answer goes into the new ticket's Decisions, where the command finds it next time. Size: with the duplicate check, this may exceed one lane M ticket; the intent interview decides whether to split.
- Added 2026-10-27 at the owner's "merge it" (to "merge into ST-LN-22 or a separate lane S ticket"), after the owner asked: "why are conventions injected only into the executor?" Today `accord brief` appends `accord/product/conventions.md` only to executor briefs; the planner and the reviewer are told to read `accord/product/` in their instructions, which depends on recall, and the architect, the critic, the scout, the debugger and the verifier are not told at all (the auditor reads only the ticket by design). Proposal to confirm at intent: the architect and the critic receive `conventions.md` and `business-rules.md` by a CLI-built input, as the executor does, not by an instruction to read; the critic reports an option that repeats a `Rejected:` line from either file as a Must. Why: the `Rejected:` lines exist so the next reader does not re-propose the option that lost, yet the two agents that propose and challenge options never see them, so a repeat surfaces only at plan or review, rounds later.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-22

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
- D-01 Finding the related tickets and passing their Decisions and Vetoes to the scout and the critic is part of this ticket, not a separate one, since one search serves both the duplicate check and the related decisions — "A" (2026-10-18, to "Merge into ST-LN-22")

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
