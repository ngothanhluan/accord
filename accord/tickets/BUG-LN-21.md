---
id: "BUG-LN-21"                            # equals the file name: tickets/<id>.md
title: "A deferred risk finding passes the review record when the checks are skipped"
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
Queued 2026-11-11, not yet worked: `deferredOf` in packages/core/src/round/evidence.ts:67-83 has a `free` path for when the checks are skipped (D-10: HEAD on the default branch, or the ticket already done there). On that path it adds every `deferred` finding that has its ledger line and never looks at `f.risk`, so a Must or Should marked `risk: data-loss` or `risk: security` and written `deferred` is let through. On every pinned path `verdictsOf` in grounds.ts refuses it. The text in packages/core/agents/reviewer.md:45 and packages/core/skills/review/record.md:48 says a `risk:` finding is never deferred, which the code does not hold on this path. The pull request's own gate has already run the full checks on the ticket branch, so the practical exposure is small. The line is confirmed by reading, the failure not reproduced. The fix is to add `&& f.risk === undefined` to the free path. Source: GSD phase 2 verification WR-03 and SECURITY residual 1; owner, 2026-11-11 (translated): "Ok, put it in the backlog to handle later".

## Done when
When the checks are skipped, a review record with a Must or Should finding marked `risk: security` or `risk: data-loss`, written `deferred` with its ledger line, is refused, and the same finding with no `risk:` mark still passes, proven by a test that fails before the fix.

## Decisions

## Corrections

## Scope
<!-- One repository path per line, never a folder: every file the change is expected to touch, tests and new files included. -->
packages/core/src/round/evidence.ts
packages/cli/test/round-grounds.test.ts
