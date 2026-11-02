---
id: "BUG-LN-20"                            # equals the file name: tickets/<id>.md
title: "Every repository-reading command exits 2 once git ls-files lists more than 1 MiB of paths"
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
Queued 2026-11-02, not yet worked: `gitTree` in packages/cli/src/load/fs.ts:19-34 runs `git ls-files --cached --others --exclude-standard -z` with no `maxBuffer`, so Node's 1 MiB default fails the call once its output passes 1 MiB (roughly 15k+ files), and the catch reports it as "not a git repository (or git failed)", so every repository-reading command (lint, gate, status, dashboard, scout check) exits 2 on a large repository. The line is confirmed, the failure not reproduced. The fix is the 64 MiB `maxBuffer` the other git calls in that file pass, `gitTracked` for the same `git ls-files` (fs.ts:44) included, as accord/product/conventions.md requires for git output. Source: ST-LN-81 ledger, Deferred approach-review 3.1; owner, 2026-11-02 (translated): "Ok, split gitTree out".

## Done when
A repository whose `git ls-files --cached --others --exclude-standard -z` output passes 1 MiB loads, and a repository-reading command on it no longer exits 2, proven by a test that fails before the fix.

## Decisions

## Corrections

## Scope
<!-- One repository path per line, never a folder: every file the change is expected to touch, tests and new files included. -->
packages/cli/src/load/fs.ts
packages/cli/test/load.test.ts
