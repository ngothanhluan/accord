---
id: "ST-LN-61"                            # equals the file name: tickets/<id>.md
title: "The dashboard shows every open ticket, with no row cap"
type: "story" # story | bug
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
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
ac_hash: "fnv1a64:fdacc4cbce3cb6ad"
---

## Understood
Remove the row caps of every dashboard section (TEAM, READY, UP NEXT, EPICS), so no "+N more" line is printed; done, archived and dropped tickets stay hidden as today.

## Done when
`accord dashboard` on a repository with more than 20 backlog tickets lists every one of them under UP NEXT and prints no "+N more" line.

## Corrections

- "I don't think this is a lane M ticket" (owner, 2026-10-25, when lane M was proposed; translated from Vietnamese)
