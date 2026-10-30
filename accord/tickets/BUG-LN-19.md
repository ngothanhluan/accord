---
id: "BUG-LN-19"                            # equals the file name: tickets/<id>.md
title: "Three cli tests fail on main in a node:24 Docker container while CI's ubuntu runner passes them"
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
Queued 2026-10-30, not yet worked: on ST-LN-75 the owner asked for the tests to run in Linux to be fast, and the full suite run in a `node:24` Docker container (Debian, git 2.39.5, run as root, a fresh `git clone` of the branch, `npm ci`, `npm run build`, `npx vitest run`) failed three tests that CI's ubuntu-latest jobs pass; the same three fail the same way on main at 8db06d1 in that container, so ST-LN-75 did not cause them. They are packages/cli/test/after-verify.test.ts "risk:complex-branching a merge from origin main after verify is a commit after verify with no files" (AssertionError: expected { …(3) } to deeply equal { …(3) }), packages/cli/test/after-verify.test.ts "risk:complex-branching with no origin the local main is the default branch and a renamed main is not" (expected [ 'accord/tickets/ST-9.md' ] to deeply equal []), and packages/cli/test/status.test.ts "ac-1 a ticket filed only on its pushed claim branch shows at that branch stage without a fetch" (expected 2 to be +0). Setting `init.defaultBranch main` did not change the result. Find the root cause first (the git version, running as root, the clone's remote setup, or a real defect in the command under a git or environment the tests do not pin) and fix whichever side is wrong: the command when a supported git or environment gives a wrong answer, or the test when it depends on something it does not set up. Why: a Linux container is the quick local run the owner wants, and a run that fails on main cannot judge a ticket; `gate done` refuses a report with failed tests, so on ST-LN-75 the container's report could not be used for the gate. Not here: CI changes, the container setup itself beyond what the root cause needs.

## Done when
In the same `node:24` container the three tests pass on the fix's branch, with the root cause named in the ticket, and the full suite passes there and in CI.

## Decisions

## Corrections

## Scope
<!-- One repository path per line, never a folder: every file the change is expected to touch, tests and new files included. -->
packages/cli/test/after-verify.test.ts
packages/cli/test/status.test.ts
