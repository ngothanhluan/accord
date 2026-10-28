---
id: "ST-LN-66"                            # equals the file name: tickets/<id>.md
title: "Cap how many test workers a run starts"
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
vitest.config.ts sets pool: 'forks' with no maxWorkers, so every run starts CPUs-1 forks (19 on a 20-thread machine), each spawning git and the CLI; two sessions running tests at once ran a 32 GB host out of memory on 2026-10-28, and the contention likely slows tests past their limit (upgrade.test.ts ac-2 took 108 s against 90 s). Read the worker count from an environment variable, defaulting to about half the CPUs.

## Done when
A test run starts at most the configured number of forks, the default is about half the CPUs, the variable overrides it, and lint and the full suite pass.

## Scope
- vitest.config.ts
- packages/cli/test/vitest-config.test.ts
