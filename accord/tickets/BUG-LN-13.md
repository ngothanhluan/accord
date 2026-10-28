---
id: "BUG-LN-13"                            # equals the file name: tickets/<id>.md
title: "A ticket whose pull request has not merged leaves the dashboard as done"
type: "bug" # story | bug
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Written by `gate ready`; never edit by hand.
# ac_hash:
---

## Understood
Queued 2026-10-28 from BUG-LN-12, not yet confirmed: a lane S ticket whose review.md ends with a verdict gets stage `done` (packages/core/src/status/stage.ts:74-75) while its next step is still "the pull request; run accord gate done (lane-s.md)" (stage.ts:64). The dashboard drops it from YOURS (`isOpen`, packages/core/src/status/dashboard.ts:39) and counts it under done (dashboard.ts:138), although `gate done` has not passed and its pull request is not merged; seen on BUG-LN-12 on 2026-10-28. `isDone` (stage.ts:103-108) reads the same stage, so a ticket whose `depends_on` names it is unblocked before the code reaches main. A lane M ticket looks to have the same gap: stage.ts:99 gives `done` once the owner's ticks are bound, with next step "nothing; run accord gate done" (stage.ts:32), before `gate done` passes or the pull request merges; to be confirmed at the start of this ticket.

## Done when
A lane S ticket at that point, and a lane M ticket too if the check confirms the same gap, stays in YOURS with its next step until its pull request merges, a ticket that depends on it stays blocked until then, and lint and the full suite pass.

## Scope
<!-- One repository path per line, never a folder: every file the change is expected to touch, tests and new files included. -->

## Intent

## Acceptance criteria

## Vetoes

## Decisions

## Corrections

## Open questions

## Approach
