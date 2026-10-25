---
id: "ST-LN-52"                            # equals the file name: tickets/<id>.md
title: "A review finding is fixed everywhere the same claim or pattern appears"
type: "story" # story | bug
status: dropped                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "S" # S: one small change, worked from this ticket alone
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
<!-- One line: the change, as the request was understood. -->
lane-s.md step 4 and accord-review tell the fixer, for every finding, to search for every other place the same claim or pattern appears and fix them all, and to list those places in review.md; the next reviewer checks the whole class is gone. Why: ST-LN-51 took 5 review rounds (findings 5, 3, 4, 3, 2); the "nothing needs installing" claim was reported in rounds 3, 4 and 5 because each fix touched only the flagged spot.

## Done when
<!-- One line: the observable result that ends the work. -->
Both skills say so in all four runtimes' rendered copies, and `accord skills sync` shows no drift.

## Dropped
Merged into ST-LN-56, which carries its notes (owner, 2026-10-25, after the main session proposed a five-ticket plan for review convergence: "ok, agreed").
