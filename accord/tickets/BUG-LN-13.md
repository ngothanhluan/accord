---
id: "BUG-LN-13"                            # equals the file name: tickets/<id>.md
title: "A ticket whose pull request has not merged leaves the dashboard as done"
type: "bug" # story | bug
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Written by `gate ready`; never edit by hand.
# ac_hash:
approved_hash: "fnv1a64:03f689fa6b541fef"
ac_hash: "fnv1a64:2a3877559ca3500a"
verified_hash: "fnv1a64:2a3877559ca3500a"
verified_commit: "125dc0424977f6853d76ba98444a36eea7f37ff3"
verified: [ac-1, ac-2, ac-3, ac-4]
---

## Understood
Queued 2026-10-28 from BUG-LN-12, not yet confirmed: a lane S ticket whose review.md ends with a verdict gets stage `done` (packages/core/src/status/stage.ts:74-75) while its next step is still "the pull request; run accord gate done (lane-s.md)" (stage.ts:64). The dashboard drops it from YOURS (`isOpen`, packages/core/src/status/dashboard.ts:39) and counts it under done (dashboard.ts:138), although `gate done` has not passed and its pull request is not merged; seen on BUG-LN-12 on 2026-10-28. `isDone` (stage.ts:103-108) reads the same stage, so a ticket whose `depends_on` names it is unblocked before the code reaches main. A lane M ticket looks to have the same gap: stage.ts:99 gives `done` once the owner's ticks are bound, with next step "nothing; run accord gate done" (stage.ts:32), before `gate done` passes or the pull request merges; to be confirmed at the start of this ticket.

## Done when
A lane S ticket at that point, and a lane M ticket too if the check confirms the same gap, stays in YOURS with its next step until its pull request merges, a ticket that depends on it stays blocked until then, and lint and the full suite pass.

## Scope
<!-- One repository path per line, never a folder: every file the change is expected to touch, tests and new files included. -->

## Intent
Why: the dashboard counts a ticket as done once its records say so on its claim branch, so a ticket whose pull request is still open leaves YOURS and a ticket that depends on it is unblocked before the code reaches the default branch; seen on BUG-LN-12 on 2026-10-28.
For whom: everyone who reads `accord dashboard` or starts a ticket that depends on another.
Success: a lane S or lane M ticket whose done records are not yet on the default branch stays in YOURS with its next step and keeps its dependants blocked; once merged, it leaves YOURS and counts as done.
Not: no change to the shape of `accord status --json` or its `stage` values, no tracker or GitHub lookup, and `accord worktree clean` keeps cleaning what it cleans today.

## Acceptance criteria
```gherkin
Feature: BUG-LN-13

  @ac-1 @test:packages/cli/test/done-on-default.test.ts#ac-1-a-lane-S-ticket-reviewed-only-on-its-claim-branch-stays-in-yours-with-its-next-step
  Scenario: A lane S ticket with a review verdict that is not yet on the default branch stays in YOURS
    Given a claimed lane S ticket whose review.md ends with a verdict on its claim branch
    And the ticket's records as they stand on the default branch do not give stage done
    When the owner runs accord dashboard on the default branch
    Then the ticket is listed in YOURS with the next step "the pull request; run accord gate done (lane-s.md)"
    And the count line does not count it as done

  @ac-2 @test:packages/cli/test/done-on-default.test.ts#ac-2-a-ticked-lane-M-ticket-on-its-claim-branch-stays-in-yours-with-the-pull-request-as-its-next-step
  Scenario: A ticked lane M ticket that is not yet on the default branch stays in YOURS
    Given a claimed lane M ticket whose ticks are bound on its claim branch
    And the ticket's records as they stand on the default branch do not give stage done
    When the owner runs accord dashboard on the default branch
    Then the ticket is listed in YOURS with the next step "the pull request; run accord gate done"
    And the count line does not count it as done

  @ac-3 @test:packages/cli/test/done-on-default.test.ts#ac-3-a-dependant-stays-blocked-in-the-dashboard-and-gate-ready-until-its-prerequisite-is-done-on-the-default-branch
  Scenario: A dependant stays blocked until the ticket's done records reach the default branch
    Given ticket B names ticket A as a prerequisite, and A's records give stage done only on its claim branch
    When the owner runs accord dashboard and accord gate ready B
    Then the dashboard shows B as blocked by A and accord gate ready B fails naming A
    And once A's records on the default branch give stage done, A leaves YOURS, counts as done, B is no longer shown as blocked, and accord gate ready B no longer fails on A

  @ac-4 @test:packages/cli/test/done-on-default.test.ts#ac-4-status-json-keeps-the-row-keys-and-stage-done-of-a-ticket-done-only-on-its-claim-branch
  Scenario: accord status --json keeps its shape
    Given a ticket that is done on its claim branch but not on the default branch
    When the owner runs accord status --json
    Then the ticket's row has the same keys as before this change and its stage is done
```

## Vetoes

## Decisions
- D-01 A ticket counts as done for the dashboard and for its dependants only once its done records are on the default branch (origin's, as `accord worktree clean` reads it), which holds for merge, squash and rebase alike — "A" (owner, 2026-10-28, choosing this over the claim tip being an ancestor of the default branch, and over asking GitHub)
- D-02 The shape of `accord status --json` stays as it is: `stage` is still `done`; only the dashboard and the dependency check compare with the default branch — "A" (owner, 2026-10-28, choosing this over a new `merged` field or a new stage value)
- D-03 The smallest version that counts as done is all four criteria — "ok" (owner, 2026-10-28)
- D-04 The default branch "holds" a ticket's done records when its stage, computed again from the records as they stand there, is done, the same test `accord worktree clean` uses — "as recommended" (owner, 2026-10-28, choosing this over comparing review.md's content)
- D-05 A lane M ticket that is done but not yet on the default branch shows the next step "the pull request; run accord gate done", like lane S, in place of "nothing; run accord gate done" — "as recommended" (owner, 2026-10-28)
- D-06 Blocked covers `accord gate ready` too: it refuses a ticket whose prerequisite is done only on its claim branch, not only the dashboard display — "as recommended" (owner, 2026-10-28)

## Corrections

## Open questions

## Approach
Chosen: one default-branch notion of done wherever a prerequisite or a finished ticket is judged. A CLI resolver picks origin's default ref (origin/HEAD, else origin/main or master); only a clone without `origin` falls back to local main or master; when nothing resolves, today's checkout reading stays. `snapshotAt` reads that ref for the view's ids plus every `depends_on` entry into a new snapshot field used only by the done readers (`isDone` for blockedBy in rows.ts, the dashboard's lift, epic counts, withoutLane, the new Ready rule); `plain` stays the checkout, so `show --approval` and `accord approve` still read the text the owner sees. `dashboard`, `status`, `show` and `next` (moved to the claims preflight) all judge against it; `blockedBy` values in `status --json` change, its keys do not (D-02). The dashboard counts a row as done exactly when it is done on that ref; a claimed row done only on its branch stays in YOURS/TEAM with `nextStep(ticket, 'done')`, never offered as Pick up. `NEXT.done` reads "the pull request; run accord gate done" (D-05). A new READY rule fails each prerequisite not done on the ref, with a reason naming it and the ref and saying to wait for its merge and `git fetch`, never to edit depends_on; a prerequisite lint already reports (dropped, unknown) is left to lint's reason. lane-s.md and approach/SKILL.md say the same. Spec §5 (lines 145-150) and the comments at rows.ts:51, show.ts:33, run.ts:48 say "the default branch". `accord worktree clean` and the hook are untouched.
Rejected: the dashboard and gate ready only — `next` and `show` would still let B start while A is unmerged (critic Must against D-01); the checkout with no new read — A's own worktree shows A done (D-01); claim tip ancestry — fails squash and rebase merges (D-01); GitHub — Independence.
Affected: packages/core/src/status (dashboard.ts, rows.ts, stage.ts, show.ts), packages/core/src/gate (rules.ts, ready.ts), packages/core/src/model/snapshot.ts, packages/cli/src/run.ts, packages/cli/src/load/fs.ts, packages/cli/src/commands (dashboard.ts, gate.ts, next.ts, show.ts, status.ts), the two skills, the spec.
Risks: (Must, fixed above) replacing `plain` would have bound approval to text the owner never saw. The dashboard reads the ref without fetching: after a GitHub merge A stays in YOURS until a fetch (the `/accord` dashboard runs `worktree clean`, which fetches first). A partial clone may lack the merged ticket blob after a fetch, so gate ready keeps refusing until main is checked out. While A is open no dependant passes gate ready, so B gets no `ac_hash`; ST-LN-2's test that gate ready passes with undone prerequisites (cli dashboard.test.ts:146-157) changes. Each dashboard, status, show and next run spends 2-7 extra git spawns. The session-start line still counts in-progress from the checkout.
Tests: ac-1, ac-2, ac-3 in cli tests on a fixture repo with a claim branch and a default branch (dashboard rows, count line, `gate ready` output); ac-4 in the cli `status --json` key test; the resolver and the Ready rule's dropped/unknown skip get risk tests in core and cli.
