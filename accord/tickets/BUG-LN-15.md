---
id: "BUG-LN-15"                            # equals the file name: tickets/<id>.md
title: "Upgrade writes its files with one git call, so the local test suite stops timing out"
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
ac_hash: "fnv1a64:59b4a08553ea7085"
---

## Understood
accord upgrade stores every file it writes with one batched git call instead of one git hash-object process per file (packages/cli/src/commands/upgrade.ts:92-94), so the git processes it starts no longer grow with the number of files.

## Done when
upgrade starts a fixed number of git processes however many files it writes, the ac-2 test "upgrade replaces only the lint and gate step" in packages/cli/test/upgrade.test.ts is unchanged with its three cases, and a local Windows full run passes with no timeout.

## Scope
packages/cli/src/commands/upgrade.ts
packages/cli/test/upgrade.test.ts
