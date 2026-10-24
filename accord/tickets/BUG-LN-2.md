---
id: "BUG-LN-2"                            # equals the file name: tickets/<id>.md
title: "The dashboard shows every claimed ticket at the stage its branch holds"
type: "bug" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# The epic this ticket belongs to.
# parent: "EPIC-ID"
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Optional design reference URL.
# design: "https://example.com/design/..."
# Written by `accord approve` after the owner says yes; never edit by hand.
# approved_hash:
# Written by `gate ready`; never edit by hand.
# ac_hash:
# Self-test ticks, e.g. [ac-1, ac-2]. Always the last key.
# verified: []
# The AC hash and the commit the ticks were made against.
# verified_hash:
# verified_commit:
approved_hash: "fnv1a64:8ab7a7914640665c"
ac_hash: "fnv1a64:9c911fa7ec3e52fd"
verified_hash: "fnv1a64:9c911fa7ec3e52fd"
verified_commit: "8b0f2fd69f98e3cdd221544643bcc07f54325f40"
verified: [ac-1, ac-2, ac-3, ac-4]
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
On 2026-10-16 `accord dashboard` on main showed "0 in progress" while ST-LN-5 and ST-LN-6 were claimed, because a ticket created on its claim branch is skipped wherever its file is absent; ST-LN-4 read `build 0/5` while its plan was still in critique, and ST-LN-6 read "the owner approves the ticket" with an empty Intent.
For every teammate who reads the dashboard, `accord status` or the panel to see who holds what and where it stands.
Success: on main, every claimed ticket shows with the stage its claim branch holds, `build` appears only after `plan: <id> ready`, and an unwritten intent points to the intent interview; checked by the criteria tests and by `accord dashboard` on main once this merges.
Not in scope: fetching from the network, changing which branch wins a claim, the panel's own layout.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-2

  @ac-1 @test:packages/cli/test/status.test.ts#ac-1-a-ticket-filed-only-on-its-pushed-claim-branch-shows-at-that-branch-stage-without-a-fetch
  Scenario: A ticket whose file exists only on its claim branch shows at the stage that branch holds
    Given a repository whose current branch has no file for ticket X
    And a remote-tracking branch `origin/t/X`, with no local `t/X`, whose tip holds X approved, a plan whose last commit subject is exactly `plan: X ready`, and one of its three tasks recorded in the ledger
    When `accord status --json` and `accord dashboard` run on the current branch with no network access
    Then X is listed as claimed by the author of that tip commit, at stage `build 1/3`
    And neither command fetches

  @ac-2 @test:packages/cli/test/status.test.ts#ac-2-the-claim-branch-copy-wins-over-an-older-checkout-copy
  Scenario: The claim branch's copy wins over an older copy on the current branch
    Given the current branch holds ticket X unapproved
    And the claim branch `origin/t/X` holds X approved, with a plan whose last commit subject is exactly `plan: X ready` and no task recorded
    When `accord status --json` runs on the current branch
    Then X is at stage `build 0/n`, the stage `origin/t/X` holds, not at stage `intent`

  @ac-3 @test:packages/cli/test/status.test.ts#ac-3-a-plan-reaches-build-only-after-its-ready-commit-and-while-clean
  Scenario: A plan that has not reached its ready commit is still at stage plan
    Given ticket X approved, with a plan.md holding tasks
    When the last commit that touched plan.md has the subject `plan: X round 1, 1 Must, 0 Should`, or X is read from the working tree and its plan.md is untracked or has staged or unstaged changes
    Then `accord status --json` and `accord anchor` show X at stage `plan`, not `build`
    And once the last commit that touched plan.md has the subject exactly `plan: X ready`, and plan.md has no uncommitted change when X is read from the working tree, X is at stage `build 0/n`
    And for X read from a claim branch that is not checked out, only that branch's commits decide, never the current working tree

  @ac-4 @test:packages/cli/test/dashboard.test.ts#ac-4-an-unwritten-intent-points-anchor-and-dashboard-to-the-intent-interview
  Scenario: A ticket whose intent is not written yet points to the intent interview
    Given ticket X whose `## Intent` section holds nothing but HTML comments and blank lines, or whose acceptance criteria block holds no scenario other than the template's placeholder one
    When `accord anchor` and `accord dashboard` show X
    Then its next step reads "the intent interview (accord-intent)", not `accord approve`
    And once Intent and acceptance criteria are written and X is not approved, its next step is "the owner approves the ticket (accord approve)"
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 For a claimed ticket, the dashboard and status read the ticket, its plan, ledger, review, verification and the plan's ready commit from the claim branch, even when the current branch holds an older copy — "Always from the claim branch (Recommended)"
- D-02 All three parts are in scope and none is cut: claimed tickets on other branches show, `build` only after `plan: <id> ready`, an unwritten intent points to the interview — "All 3, right (Recommended)", then "All 3 parts, no cuts (Recommended)"
- D-03 A lane ticket row at stage intent gains a `next` field in `accord status --json` and `accord dashboard --json`, and the dashboard prints it after the stage; no field is removed; spec §6 line 179 is updated to match — "Add the next field (Recommended)"
- D-04 A dependency counts as done only in the tree the command runs on, as spec §5 says: a ticket done only on its unmerged claim branch still blocks its dependents on the dashboard, while its own row shows the stage its branch holds — "Still blocked, keep spec §5 (Recommended)"
- D-05 `accord show`, the panel's ticket detail added by ST-LN-6, reads a claimed ticket the way the dashboard does: from its claim branch, with plan facts, and with blockers from the checkout — "Like the dashboard (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen: a claim view in the CLI loader, with dependency checks kept on the current tree.**
- Only `status` and `dashboard` overlay claim-branch files. `gitClaims` keeps the full refname.
- A claim is overlaid when it is not the current branch's own ticket (`ticketOfBranch(current)`) and its tip is not an ancestor of HEAD. Then:
  - one `git cat-file --batch` reads the ticket, plan, ledger, review and verification, even when the checkout has no ticket file;
  - one `git log -1 <ref>` reads the plan's last commit subject.
- Every stage-deriving command gives each plan.md a fact: last commit subject plus clean flag. The working tree uses `git --no-optional-locks status --porcelain -z -uall -- accord/tickets`.
- A plan.md that was never committed is not ready. A host that supplies no facts keeps today's stage.
- `progressOf` holds `plan` until the subject is exactly `plan: <id> ready` and the plan is clean.
- The next-step text moves into core's stage module. It reads the intent interview when Intent is empty or missing, or when no scenario other than the placeholder exists (zero counts).
- StatusRow gains `next` at stage intent (D-03).
- `statusRows` and `dashboard` take the plain snapshot as an optional trailing parameter, used only for `isDone` (D-04).
- Every new git call sets `GIT_NO_LAZY_FETCH=1`.

**Rejected:**
- Overlay everywhere: dependencies would count as done on unmerged branches, against spec §5 and D-04.
- Overlay in pure core: no criterion needs it.

**Affected:**
- CLI: `load/fs.ts` and `load/snapshot.ts`, the status and dashboard commands.
- Core: `model/snapshot.ts`, `status/stage.ts`, `status/anchor.ts`, `status/rows.ts`, `render/dashboard.ts`.
- The `/accord` skill's id check: an id listed with a `branch` counts.
- Spec §5 lines 148-150 and §6 line 179.
- Tests that commit a plan with no ready commit (`test/helpers/repo.ts`, `lane-commands.test.ts`, `lane-flow.test.ts`, `status.test.ts`).

**Risks:** the critic found no Must. All ten Should findings are folded in above.
- In a blobless clone the overlay reads nothing and reports nothing (Nice).
- The summary's done count and an epic's `d/t done` can differ under D-04 (Nice).
- In-flight tickets with no `plan: <id> ready` commit show `plan` after the merge.
- Lint counts on an overlaid row come from the checkout.

**Tests:**
- AC-1, AC-2: CLI tests in `status.test.ts` and `dashboard.test.ts`, with refs made by `git update-ref refs/remotes/origin/t/X`.
- AC-3: a core stage test, plus CLI tests for untracked, staged and unstaged plans, and a claim ref against a dirty tree.
- AC-4: a core next-step test, plus one CLI check each for `anchor` and `dashboard`.

**Change note (2026-10-17), after ST-LN-6 merged `accord show` into main.**
- What changed: `show` derives a stage, a branch and a holder through `ticketDetail` → `statusRows`, but loads only the checkout. On main, a ticket that exists only on its claim branch shows on the dashboard but fails in `show`, and a row reading `plan` opens as `build` in the panel.
- Tasks 1-4 still hold unchanged.
- New approach for `show` (D-05):
  - it loads through the claim view, like `status` and `dashboard`, so it gets the overlay and plan facts;
  - `ticketDetail` gains the plain snapshot as an optional trailing parameter, the same shape as `statusRows` and `dashboard`, so blockers come from the checkout (D-04).
- Affected: `packages/cli/src/commands/show.ts`, its preflight mode in `run.ts`, `packages/core/src/status/show.ts`, `packages/cli/test/show.test.ts`.
