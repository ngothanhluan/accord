---
id: "BUG-LN-12"                            # equals the file name: tickets/<id>.md
title: "Short title in business language"
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
<!-- One line: the change, as the request was understood. -->

## Done when
<!-- One line: the observable result that ends the work. -->

## Scope
<!-- One repository path per line, never a folder: every file the change is expected to touch, tests and new files included. -->
