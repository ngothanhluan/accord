---
id: "BUG-LN-10"                            # equals the file name: tickets/<id>.md
title: "The accord pane in a clone reports a version mismatch after a release until the CLI is built again"
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
ac_hash: "fnv1a64:533ce28f929a8436"
---

## Understood
In a clone of accord itself, a CLI build older than its own package.json makes the pin refusal suggest an npx command that runs the same stale build.

## Done when
In that case the refusal says the build is stale and names `npm run build`; an npm-installed CLI behaves as today.

## Decisions
- D-01 Keep the ticket and take the smallest fix: when the running CLI build is older than the package.json beside it, the pin refusal says the build is stale and names `npm run build` instead of the npx command that runs the same stale build — "ok A, so that's lane S?"
- D-02 Open the pull request although `accord gate done` refused: its only error is `show-approval.test.ts` ac-1 passing its 300 s timeout under full-suite load, a slowness that predates this fix (alone it passes, base 262 s, fix 131 s); CI on GitHub runs the tests again — "Open PR without the gate"
