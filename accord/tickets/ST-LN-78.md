---
id: "ST-LN-78"                            # equals the file name: tickets/<id>.md
title: "Task test runs on Windows go through a Linux container"
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
---

## Understood
In this repository only, `tests.affected` runs vitest through a new script that, on Windows with Docker available, runs it in a Linux container over the worktree and writes the JUnit report to the host path `accord task-done` reads, and otherwise runs vitest on the host as before; `tests.full`, CI and the accord CLI and schema are unchanged.

## Done when
On the owner's Windows machine the `tests.affected` command from `accord/config.yml` runs the whole suite in a container in about a minute and a half with no failing test and a fresh `node_modules/.cache/accord/junit.xml` on the host, and with `ACCORD_TEST_LINUX=0` it runs on the host as before.

## Scope
- accord/config.yml
- scripts/test-linux.mjs
- packages/core/test/test-linux.test.ts
