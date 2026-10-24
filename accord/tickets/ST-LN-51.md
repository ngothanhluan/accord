---
id: "ST-LN-51"                            # equals the file name: tickets/<id>.md
title: "The README explains clearly what accord is and how to use it"
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
ac_hash: "fnv1a64:2f35bfcd0baecaf2"
---

## Understood
<!-- One line: the change, as the request was understood. -->
Rewrite README.md so a newcomer understands what accord is and gets a usage guide: install or npx, `accord init` and what it writes, committing it for the team, the `/accord` commands and the lane and stage flow, other runtimes via `runtimes:` and `accord skills sync`, upgrading, and the version pin.

## Done when
<!-- One line: the observable result that ends the work. -->
README.md holds a usage section covering each of those steps with commands that match the 0.2.0 CLI's `--help`, every link in it resolves, and it has no Vietnamese.
