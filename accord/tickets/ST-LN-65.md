---
id: "ST-LN-65"                            # equals the file name: tickets/<id>.md
title: "Delete the one-time ST-LN-44 tests once that ticket has merged"
type: "story" # story | bug
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "S" # S: one small change, worked from this ticket alone
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-44"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Written by `gate ready`; never edit by hand.
# ac_hash:
---

## Understood
Queued 2026-10-27 from ST-LN-44's final review, not yet confirmed: ST-LN-44's ac-2 and ac-4 tests (packages/core/test/st-ln-44.test.ts, its helper packages/core/test/helpers/st-ln-44.ts and packages/core/test/fixtures/st-ln-44/) read the live text of 22 CLI test files and every ticket's scenarios, so once ST-LN-44 is done an unrelated ticket that only tidies one of those tests (for example dropping `const ok = okIn;` in hook.test.ts) turns them red on main. ST-LN-44's plan says they are deleted once that ticket is done, and nothing does it yet.

## Done when
After ST-LN-44 has merged, its one-time test file, helper and fixtures folder are gone, ST-LN-44's four `@test:` tags are handled as accord's rules allow for a done ticket (to be settled at the start of this ticket), and lint and the full suite pass.

## Decisions
- D-01 Queue a lane S ticket that deletes the ST-LN-44 test files after ST-LN-44 merges, rather than keeping them as a lasting guard — "Queue a deletion ticket" (owner, 2026-10-27, choosing this against keeping them for good)
