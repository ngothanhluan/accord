---
id: "BUG-LN-16"                            # equals the file name: tickets/<id>.md
title: "A comment that reports a failure on a lane S ticket's pull request is fixed at the lane S steps, not through accord-debug"
type: "bug" # story | bug
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "S" # S: one small change, worked from this ticket alone
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-60"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Written by `gate ready`; never edit by hand.
# ac_hash:
---

## Understood
Queued 2026-10-29 from ST-LN-60 review round 5, Should 1, not yet confirmed: step 5 of packages/core/skills/accord/comments.md (lines 36-38 on t/ST-LN-60) sends every comment that holds and reports a failure through `./failure.md` from its step 1 and `accord-debug`, while packages/core/skills/shared/failure.md lines 17-18 say a lane S ticket never reaches verify, so a failure in its work continues at the lane S steps; step 5 sends such a comment through `accord-debug` only in lane M, and in lane S it is fixed as the lane S steps say (packages/core/skills/accord/lane-s.md: a bug gets a failing test first, then the fix and another review round).

## Done when
comments.md step 5 routes a comment reporting a failure through `accord-debug` in lane M only and to the lane S steps in lane S, failure.md is unchanged, the assertion on step 5 in packages/core/test/stage-skills.test.ts (line 1046 on t/ST-LN-60) checks the lane split, `accord skills sync` leaves no drift, and lint and the full suite pass.

## Scope
<!-- One repository path per line, never a folder: every file the change is expected to touch, tests and new files included. -->
packages/core/skills/accord/comments.md
packages/core/test/stage-skills.test.ts
packages/core/src/generated/skills.ts
.claude/skills/accord/comments.md
