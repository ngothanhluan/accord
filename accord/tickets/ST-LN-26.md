---
id: "ST-LN-26"                            # equals the file name: tickets/<id>.md
title: "A failure found after verify is routed to a fix and verified again"
type: "story" # story | bug. An epic uses its own template
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
approved_hash: "fnv1a64:be20a7d835f71b2d"
ac_hash: "fnv1a64:2213e74d7ac9137e"
verified_hash: "fnv1a64:2213e74d7ac9137e"
verified_commit: "0c2c7f34978265692e48fe866a20199c63853c50"
verified: [ac-1, ac-2, ac-3, ac-4, ac-5]
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: ST-LN-20's PR #42 went red on ubuntu after verify passed on Windows: the POSIX-only half of a test returned early on Windows and counted as passed, nothing in accord read CI, and the main session judged the cause itself and fixed it with only a Ruling; `accord-debug` is reached only from build.
For whom: anyone working a lane M ticket whose work fails after verify, in CI or on another operating system.
Success: every failure found after verify reaches a root cause through `accord-debug`, its fix is reviewed and verified again before the ticket shows done, the owner sees the pull request's CI result before ticking, and the owner's report names every test the verify run skipped.
Not this ticket: a failure found after the ticket's pull request is merged (that is a new bug ticket); an automatic check in `accord lint` for tests that return early on an operating system (D-05); CI that is not GitHub Actions on a GitHub pull request (reported as not checked).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-26

  @ac-1 @test:packages/core/test/stage-skills.test.ts#ac-1-a-failure-reported-after-verify-goes-to-the-debug-stage-before-any-fix
  Scenario: A failure someone reports after verify goes to debug before any fix
    Given ticket X has reached verify or done and its pull request is not merged
    And a session works X after "/accord continue X"
    When the owner reports a failure in X's work, with or without the failing command and its output
    Then the session opens a debug episode for X and a fresh debugger writes the root cause with evidence before any fix is made
    And the debugger finds the failing command and its output itself when the report does not give them
    And the session itself neither judges the cause nor dispatches a fix outside the debug stage

  @ac-2 @test:packages/core/test/stage-skills.test.ts#ac-2-verify-starts-ci-before-the-suite-and-shows-the-owners-report-only-after-every-check-finished
  Scenario: Verify runs the pull request's CI alongside its own checks and reports it before the owner's tick
    Given X's repository has a GitHub remote and gh is logged in and can reach the repository's pull requests
    When verify for ticket X starts
    Then X's branch is pushed and a draft pull request for it is opened when none is open, before the full test run and the verifier, and it is not merged; a pull request already open is left as it is
    And the owner's report is shown only after every check on the pushed commit has finished, other than the check the accord workflow runs, and it gives each check's result; when the push changed nothing, the results already on that commit are used
    And verify neither waits for the accord workflow's check nor sends it to debug, and after the owner's tick it runs "accord lint" and "accord gate done" locally for every ticket the pull request touches in its place
    And when any check failed, once all have finished, the owner gets one line naming the failed checks and the failure goes to a debug episode as in @ac-1 instead of to the owner's report
    And a check that was cancelled or skipped, no check appearing on the pushed commit within ten minutes, or a check still running thirty minutes after it appeared, is reported as CI not checked, by name where there is one, and goes to no debug episode
    And after the owner's tick is committed and those local checks pass, it is pushed and the pull request is marked ready for review, without waiting for CI again
    And when there is no GitHub remote, or gh is not logged in or cannot reach the repository, the owner's report says CI was not checked and why

  @ac-3 @test:packages/core/test/lane-status.test.ts#ac-3-a-change-after-verify-takes-the-ticket-back-from-done-until-it-is-verified-again
  Scenario: A change after verify takes the ticket back from done until it is verified again
    Given ticket X was verified at commit C
    When a commit after C changes a file outside X's ticket file, X's ticket folder and `accord/product/conventions.md`
    Then the stage is never done until X is verified again at a commit that holds that change
    And after a fix of a failure found after verify, the stage is review until a review round of the changes made after C is recorded in review.md, then verify
    And after a merge from the main branch that holds no other change, the stage is verify

  @ac-4 @test:packages/cli/test/lane-commands.test.ts#ac-4-tests-skipped-prints-every-case-the-report-records-as-skipped-with-the-operating-system
  Scenario: The owner's report names the tests the verify run skipped
    Given the full test run during verify had tests that the test runner reports as skipped
    When the owner's report is shown
    Then it lists every one of them by name under what was not checked, with the operating system the run was on

  @ac-5 @test:packages/core/test/stage-skills.test.ts#ac-5-an-assertion-that-runs-only-on-some-operating-systems-sits-in-a-test-the-runner-skips
  Scenario: An assertion that runs only on some operating systems sits in a test the runner skips
    Given an assertion that should run only on some operating systems
    When an executor writes it or a reviewer reviews a change that holds it
    Then the executor puts it in a test of its own that is skipped through the test runner's own skip on the other operating systems, never behind an early return or a branch on the operating system inside a test
    And a reviewer reports an early return or a branch on the operating system that leaves an assertion unrun as a finding
    And no test in this repository leaves an assertion unrun on an operating system except through the test runner's own skip
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 A failure found after verify enters accord two ways: a person brings it to a session working the ticket, and verify itself watches the pull request's CI when GitHub is available; without GitHub the CI part is reported as not checked — "A"
- D-02 Every failure found after verify goes through `accord-debug`: a fresh debugger finds the root cause before an executor fixes it; the main session never judges the cause itself — "A"
- D-03 The fix of a failure found after verify gets its own review round on its diff, under review's existing rules, and then the whole ticket is verified again — "A"
- D-04 The ticket has four parts: route a failure found after verify, require verifying again with the stage never showing done on stale ticks, name the tests the verify run skipped, and make operating-system-only tests real skips — "xác nhận"
- D-05 The smallest version that counts as done: parts one to three in full; part four is a written rule for executors and reviewers, a reviewer finding for a test that returns early on the operating system, and this repository's early returns turned into real skips; no automatic check in `accord lint` — "A"
- D-06 Verify pushes the branch and opens the pull request when none is open, waits for every check to finish, and only then gives the owner's report; merging still waits for the owner — "A"
- D-07 The auditor's six readings, as the owner accepted them: any failure report opens debug and the debugger fetches the command and output itself; verify waits for the push's checks to appear before waiting for them to finish; only a failed check goes to debug, a cancelled or skipped one is reported as not checked; any commit outside the ticket's own records takes the ticket back from done, a fix through review then verify, a merge from main through verify only; skipped means what the test runner reports as skipped; every assertion that runs only on some operating systems sits in its own test skipped by the runner, early return and if/else alike — "đồng ý"
- D-08 One CI wait only: verify pushes and opens a draft pull request at its start, so CI runs while the full suite and the verifier run; the check that runs `accord gate done` for the ticket is left out, since the local `accord gate done` on the same commit replaces it; after the tick, verify pushes and marks the pull request ready without waiting again — "A"
- D-09 The auditor's readings of the one-wait @ac-2, as the owner accepted them: only checks on the pushed commit count; a push that changes nothing reuses that commit's results; the accord workflow's check is not waited for, and verify runs lint and gate done locally for every ticket the pull request touches in its place; a failed check gives the owner one line and goes to debug once all checks finished; a check still running after thirty minutes is reported as not checked; gh must be logged in and reach the repository; an open pull request is left as it is — "đồng ý"
- D-10 After the merge of ST-LN-8, `accord/product/conventions.md` counts with X's ticket file and folder in @ac-3, as it does for `accord gate done`, so a rule the owner promotes at verify step 6 never takes X back from done — "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-21, on the proposed approach option "two CI rounds: wait before the tick, push the tick and wait again": "tại sao phải 2 lượt chờ nhỉ? tiêu chí fast đâu? brainstorm và propose lại solution đi"

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: a branch-tip git fact for the stage, one new command `accord tests skipped`, and the rest as skill and agent text. Stage (@ac-3): packages/cli/src/load/fs.ts supplies, per ticket whose verified commit is not on the default ref (origin's, else the local default branch), the commits after it on the ticket's own tip (HEAD on its branch, its claim ref otherwise, as loadClaimView does) via one `git -c core.quotePath=false log -z --topo-order --reverse --format=%H%x00%P --name-only --no-renames --remerge-diff`, retrying without `--remerge-diff` on git < 2.36 (merges then count as changes) and never exiting 2 on a git error. packages/core/src/status/stage.ts reuses gate/done.ts's exported onlyOwnRecords: done needs no hand-made commit after verified_commit; the commit in verification.md, when later, decides review (a hand-made commit after it with no later review.md commit whose last line is a valid verdict) or verify (merges only). `accord anchor` prints the review base P, the commit before the first hand-made change, and review-package excludes the default ref, so a merge from main never enters the fix's review.
Debug (@ac-1): accord skill Continue, and New request when the text reports a failure in a ticket at verify or done, go to accord-debug; debug steps 1 and 9 re-run `accord anchor` after the fix; the debugger fetches the failing command and output itself (`gh run view <id> --log-failed` for CI). For a failure only CI's operating system shows, the red evidence is the CI log and the green is CI at the next verify; the episode stays the same episode and keeps its failed-fix count until CI is green. The fix review round is capped at five rounds counted from the first round after verify.
CI (@ac-2, D-08, D-09): verify step 2 pushes and runs `gh pr create --draft --fill` when no pull request is open, then the local full suite and the verifier run while CI runs; the session reads `gh run list --commit <sha>` until runs appear (ten minutes), then watches them (thirty minutes), skipping the workflow `accord init` writes. After the tick: local `accord lint` and `gate done` for every ticket in `git diff --name-only <default>...HEAD`, commit, push, `gh pr ready`, no wait. A rejected push or gh not logged in is reported as CI not checked with git's or gh's message.
Skipped (@ac-4): `accord tests skipped` beside tests-baseline.ts prints every skipped id from the parsed junit report (refusing one older than HEAD) and process.platform; verify runs it right after the full suite, before the verifier can overwrite the report. Vitest 5 junit was checked to name every skip kind (skip, skipIf, todo, describe.skipIf children).
@ac-5: a rule line in packages/core/agents/executor.md and a finding line in reviewer.md; packages/cli/test/worktree.test.ts:428, workflow-script.test.ts:279 and publish-workflow.test.ts:124 become runner skips in tests of their own.
Rejected: two CI waits (the owner's correction: the second waited on a known result); `accord ci <id>` wrapping gh in the CLI (about 150 lines and gh output as a CLI dependency for nothing a criterion needs); reading skipped tests from XML by hand (cannot guarantee "every"); opening the pull request after the verifier (the owner waits the whole CI time).
Affected: packages/cli/src/load/fs.ts, commands/anchor.ts, review-package.ts, a new commands/tests-skipped.ts and its registration and help; packages/core/src/model/snapshot.ts, load/snapshot.ts, status/stage.ts, gate/done.ts (export); packages/core/skills/accord, debug, review, verify SKILL.md; agents/debugger.md, executor.md, reviewer.md; generated copies via `accord skills sync`; docs/specs/2026-10-12-workflow-layer-design.md.
Risks kept: (Should) the CI wait and routing are skill text, not code, so they rest on the model following verify; the phrase tests pin the text only. (Should) a fork whose origin/main is stale treats an upstream merge as a change, so a merge-only update gets a review round. (Should) the ten- and thirty-minute limits are not measured against this repository's CI. (Nice) one extra git process per ticket whose verified commit is off the default ref, on every status, dashboard and anchor, until its branch is deleted.
Tests: ac-3 core stage cases in packages/core/test/lane-status.test.ts plus one temp-repo test of the git fact (fix, merge-only, records-only, out-of-order dates, no remote); ac-4 a CLI test of `accord tests skipped` on a junit fixture; ac-1 and ac-2 skill phrase tests in packages/core/test/stage-skills.test.ts and a hand check at verify (this ticket's own verify opens its pull request and waits); ac-5 the agent text phrase test and a grep test that no test file returns early on process.platform.
