---
id: "ST-LN-67"                            # equals the file name: tickets/<id>.md
title: "Only one test run per machine at a time"
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
ac_hash: "fnv1a64:76f062d045c93c34"
---

## Understood
Every vitest run in this repository, tests.full and tests.affected from any worktree or clone, first takes one machine-wide lock: a second run prints one line saying it waits for another run and starts when the first ends, and a lock whose run crashed or was killed is taken over, on Windows and POSIX, with no wait in CI where a run is alone.

## Done when
Two runs started together never overlap, a stale lock is taken over, and lint and the full suite pass.

## Scope
<!-- One repository path per line, never a folder: every file the change is expected to touch, tests and new files included. -->
- vitest.config.ts
- test/lock.ts
- packages/cli/test/test-lock.test.ts
- packages/cli/test/vitest-config.test.ts
