---
id: "BUG-LN-6"                            # equals the file name: tickets/<id>.md
title: "Windows CI no longer fails on slow worktree tests"
type: "bug" # story | bug
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
---

## Understood
The worktree tests time out on slow Windows runners (`ac-5 a failed or silent fetch` spends 31 s of its 60 s budget in a fixed wait and hit 65 s in run 39784116057; `ac-5 bare accord fetches` hit 37 s of 30 s on PR #62): shorten that fixed wait and give the git-heavy worktree tests timeout headroom on Windows, changing no product code.

## Done when
The worktree tests keep every assertion, the silent-fetch test no longer waits a fixed 31 s, and both tests have a timeout with at least twice their slowest observed Windows time, with `npm test` passing.
