---
id: "BUG-LN-12"                            # equals the file name: tickets/<id>.md
title: "Publish smoke check waits long enough for npm"
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
ac_hash: "fnv1a64:b1a588cdc71a4501"
---

## Understood
The publish workflow's smoke job gives up after 3 minutes (12 tries x 15 s) while npm can take longer to serve a new version; raise its wait in .github/workflows/publish.yml to about 10 minutes.

## Done when
The smoke job in .github/workflows/publish.yml retries for about 10 minutes before failing, and its comment and messages state the new budget.

## Scope
- .github/workflows/publish.yml
