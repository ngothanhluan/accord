---
id: "BUG-LN-11"                            # equals the file name: tickets/<id>.md
title: "Ticket progress made in one worktree does not show on the dashboard in other worktrees or other clones"
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
approved_hash: "fnv1a64:b9ce02d7aac4fc45"
ac_hash: "fnv1a64:32b9f9a291b8b1e5"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
For the owner running several sessions in parallel worktrees, and for teammates on other machines: plan, build and review commit on the claim branch but never push it (only claim and verify push), and the dashboard reads another worktree's ticket from the pushed branch, so ST-LN-44 showed build 0/37 everywhere except its own worktree, which showed 18/37.
Success: once a stage changes before build (intent approved, approach approved, plan through its gate) or a build task is recorded, the claim branch on origin holds it, so `accord dashboard` run in any other worktree or clone that has fetched shows the same stage and task count as the ticket's own worktree.
A failed push never stops the work; it is reported, and the next successful push carries every commit made since.
Not in scope: pushing after each review round (D-04), changing which ref the dashboard reads or who it shows as holder (D-02), a central state file (D-01), uncommitted changes in another worktree, and refreshing the panel on another session's commit (D-03).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: BUG-LN-11

  @ac-1 @test:packages/cli/test/worktree-push.test.ts#ac-1-a-recorded-task-pushed-with-accord-worktree-push-shows-the-same-task-count-in-another-clone
  Scenario: A recorded build task reaches origin
    Given a lane M ticket at build whose claim branch is pushed
    When a build task is recorded with accord task-done
    Then before the next task starts, the claim branch on origin holds every commit of that task, its ledger line included
    And accord dashboard in a second clone that has fetched shows the same task count as the ticket's own worktree

  @ac-2 @test:packages/cli/test/worktree-push.test.ts#ac-2-each-stage-change-before-build-pushed-with-accord-worktree-push-shows-the-same-stage-in-another-clone
  Scenario: Each stage change before build reaches origin
    Given a lane M ticket whose claim branch is pushed
    When its intent is approved, then its approach is approved, then its plan passes accord gate plan
    Then after each of those three steps, before the next stage starts, the step's own change is committed and the claim branch on origin holds every commit made so far
    And accord dashboard in a second clone that has fetched shows the same stage as the ticket's own worktree

  @ac-3 @test:packages/cli/test/worktree-push.test.ts#ac-3-a-failed-push-exits-0-with-the-failure-line-and-the-git-message-and-the-next-push-carries-every-commit
  Scenario: A failed push does not stop the work
    Given a lane M ticket whose push fails for any reason, an unreachable remote or a rejected push alike
    When a build task is recorded, or a stage change of @ac-2 is made
    Then the task or the stage change stays recorded locally as today, and the stage goes on to its next step without stopping or asking the owner
    And a line is printed saying the push failed and the commits stay local until the next push, followed by git's own message
    And when the next push of this ticket succeeds, origin holds every commit made since
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Git refs stay the only shared state; no central state file is added — owner, after asking whether a central state file was needed and hearing it was not: "ok, create it" (translated from Vietnamese)
- D-02 Fix the root cause by pushing the claim branch while the ticket is worked, instead of making the dashboard read an unpushed local branch; the pushed-over-local rule of ST-LN-1 and BUG-LN-2 is unchanged — owner, choosing that direction: "stop, don't create a new ticket, rewrite this ticket and do it now" (translated from Vietnamese)
- D-03 The panel refreshing on another session's commit is out of scope; it waits until ST-LN-63 makes the dashboard faster, and ST-LN-3 D-06 (no timer) stands — same answer as D-02
- D-04 The claim branch is pushed at each stage change before build (intent approved, approach approved, plan through accord gate plan) and after each recorded build task; review rounds push nothing new — owner first dropped the plan and review push ("Drop ac-2, it isn't really needed."), then chose "B" when asked whether each stage should push (translated from Vietnamese)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-26 (translated from Vietnamese): "Stop, don't create a new ticket; rewrite this ticket and do it now." — the scope moved from changing which ref the dashboard reads plus a panel refresh, to pushing the claim branch during plan, build and review.
- 2026-10-26 (translated from Vietnamese): "Drop ac-2, it isn't really needed." — the push after the plan commit and after each review round is removed; only a recorded build task pushes.
- 2026-10-26 (translated from Vietnamese): asked "does each stage push?", then chose "B" (push at each stage change: intent approved, approach approved, plan through its gate, plus each build task) — the stage changes before build are pushed too; review rounds still are not.

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: one push command called by the stage skills (architect option 2). New `accord worktree push <id>` pushes `refs/heads/<branch>:refs/heads/<branch>` (branch from the ticket's claim branch, so it works from any worktree) through `gitNoPrompt` with no time limit (plan round 2.2, owner: a limit would also kill a slow pre-push hook, and gitNoPrompt already turns every prompt off), so it never waits on a credential or SSH prompt. Success prints `pushed: <branch>`; failure prints `push of <branch> failed; its commits stay local until the next push`, then git's full stderr, and exits 0. No origin remote counts as a failure.
A commit already on origin that build step 3 rewords for a forbidden line is pushed with `--force-with-lease` naming the branch (plan round 2.1, owner), written in accord/worktree.md beside the go-on rule for a failed push; without it every later push is rejected and the lag returns.
The skill sources run it right after their commit: intent step 9 (owner's-yes commit), approach step 5 (after approve, gate ready and the ticket commit), plan step 8 (`plan: <id> ready`, re-plan path included), build step 3 (after the ticket and ledger commit, before the next dispatch) and build step 6 (a re-approved approach in build). Review is untouched (D-04).
Rejected: option 1, skill text with a raw `git push` — it can stall on a credential prompt and its failure line is the agent's prose, against @ac-3. Option 3, commit and push inside task-done and approve — both commands only write today (the skills commit after them), so it reorders build step 3 and approach step 5 and still needs option 2's command for the plan; no criterion needs it. A Claude Code hook that pushes after each commit — breaks the Compatibility constraint.
Affected: packages/cli/src/commands/worktree.ts (one function beside continueMerge), packages/cli/src/run.ts (registration), packages/core/skills/{intent,approach,plan,build}/SKILL.md, packages/core/skills/accord/worktree.md, generated skills.ts and the rendered copies (gen, build, skills sync), packages/cli/test/skill-commands.test.ts:92 (command list), a new test file for the command, packages/core/test/stage-skills.test.ts.
Risks kept from the critic: (Should) the push still rests on the main session following the skill clause; a compacted session that skips it brings the ST-LN-44 lag back until the next stage's push, and no test sees the push happen at the right moment. A tool-enforced variant (`accord brief` and `accord anchor` push when the branch is ahead) was not chosen: it gives two read commands a network side effect at every stage start, including review and debug, beyond D-04. (Nice) after a teammate pushes to the same claim branch, every later push is rejected and prints the same line until verify; git's hint may lead the agent to pull. (Nice) plan SKILL.md is at 5044 of 5120 bytes, so its clause must stay under about 70 bytes.
Tests: @ac-1, @ac-2 and @ac-3 at the CLI layer with in-process runCli in a makeClone sandbox (bare origin plus otherClone): @ac-1 task-done, commit, push, then the other clone's dashboard --json task count equals the own worktree's; @ac-2 the intent-yes commit, approve plus commit and the `plan: <id> ready` commit each followed by a push, other clone's stage matches after each; @ac-3 a missing origin path and a rejected (behind) push each exit 0 with the line and git's message, then after repair the next push leaves origin at the local tip. A remote that hangs now keeps the push waiting; that risk is accepted with the limit gone. risk:regression: each of the five skill steps names `accord worktree push <id>` after its commit.
