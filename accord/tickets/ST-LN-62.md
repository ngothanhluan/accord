---
id: "ST-LN-62"                            # equals the file name: tickets/<id>.md
title: "A lane S ticket stays within the scope its scout recorded and away from sensitive areas, or the gate makes it lane M"
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
approved_hash: "fnv1a64:7c8347032bd991a1"
ac_hash: "fnv1a64:dda6a1f755e46410"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: today a lane is proposed from the request's words alone, so a loose reading lets work that needs lane M skip the interview, approval and verify as lane S.
For whom: the owner and every teammate who relies on lane S being safe to skip those stages.
Success: every lane is proposed from a scout's facts about the code, and gate done fails a lane S ticket that left the files its scout recorded, touched a listed sensitive area, or added a sign of a new interface.
Not: no file count at gate done, and its only line count is the 3-line bound on a file declared wording-only; no scan that proposes the sensitive list at onboarding (a later ticket); no CODEOWNERS.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-62

  @ac-1
  Scenario: A lane is proposed from the scout's facts, and a lane S ticket records its scope
    Given a new request typed as /accord <request>, however small it looks
    When the accord skill proposes a lane
    Then it has first dispatched the accord-scout agent on the code, and the proposal states the scout's facts for each lift condition: the files the change is expected to touch, any listed sensitive area among them, and whether the request has one reading or one question settles it
    And the lift conditions say that a reading one question settles stays lane S
    And the proposal is lane M when the expected files, not counting test files and the copies accord itself generates, number more than 5 or span more than 3 code areas, a code area being a file's folder cut to its first four path segments
    And a lane S ticket lists the expected files under a ## Scope section of its ticket file, one repository path per line and never a folder, before any change is made

  @ac-2 @test:packages/core/test/scope.test.ts#ac-2-gate-done-fails-a-lane-S-ticket-that-touched-a-file-outside-its-recorded-scope
  Scenario: gate done fails a lane S ticket that touched a file outside its recorded scope
    Given a lane S ticket whose ## Scope lists packages/core/src/status/dashboard.ts
    And its branch, compared with its merge base on the default branch, also changes packages/core/src/gate/rules.ts in a way that survives ignoring whitespace, blank lines and line endings
    When accord gate done runs for that ticket
    Then it fails with a finding that names packages/core/src/gate/rules.ts and says the ticket must be lifted to lane M
    And accord/tickets/<id>.md, files under accord/tickets/<id>/, the files accord skills sync writes, and the paths config.yml lists under generated never cause that finding

  @ac-3 @test:packages/core/test/scope.test.ts#ac-3-a-wording-only-file-outside-the-scope-passes-only-when-declared-and-confirmed
  Scenario: A wording-only file outside the scope passes only when declared and confirmed
    Given a lane S ticket whose branch changes README.md, outside its scope, in at most 3 lines counted as the larger of lines added and lines removed, and the file is neither new nor deleted
    And the ticket's ledger has the line "Wording-only: README.md — <reason>"
    When accord gate done runs and the last ## Round of review.md has the line "Confirmed wording-only: README.md"
    Then README.md causes no finding
    But when that confirmation line is missing, or README.md is new, deleted, or changed in more than 3 lines, it fails as in @ac-2

  @ac-4
  Scenario: gate done fails a lane S ticket that touched a listed sensitive area
    Given accord/config.yml lists packages/cli/src/run.ts under sensitive: interface, an entry ending in / matching every path below that folder
    And a lane S ticket's branch changes packages/cli/src/run.ts in a way that survives ignoring whitespace, even when the file is in its scope or declared wording-only
    When accord gate done runs for that ticket
    Then it fails with a finding that names the area and the path and says the ticket must be lifted to lane M

  @ac-5
  Scenario: A sign of a new interface outside the list needs the list updated or a reviewer's reason
    Given a ticket's branch, in a path no sensitive entry matches, adds one of these signs: a new file under a folder named schemas or named *.schema.json; a new key in the exports or bin map of a package.json; an added line that calls .command( or .option(
    When accord gate done runs for that ticket
    Then a lane S ticket fails and must be lifted to lane M
    And a ticket in any other lane fails unless the branch adds a sensitive entry matching that path or the last ## Round of review.md has the line "Not an interface: <path> — <reason>"
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->
- "I do not want to rely on the number of files" (at gate done; see D-06)

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 This ticket also adds a research step before a lane is proposed: a scout reads the code and reports facts for each lift condition, the lane is chosen from those facts, and the gate done check stays as the safety net — "A"
- D-02 (Since D-04, this applies to a file outside the declared scope.) A wording-only file is left out of the count only when the session declares it with a reason and the lane S reviewer confirms it; the machine never leaves out a new or deleted file, or one with more than a few changed lines; whitespace-only changes are left out on their own — "ok 1"
- D-03 The scout runs before the lane is proposed for every new request, however small it looks — "A"
- D-04 No file count. This ticket does: (1) a scope contract — the scout records the files a lane S ticket expects to touch, and gate done fails when the diff touches a file outside them; (2) a list of sensitive areas (public interface, auth, money, data deletion) in config.yml, written by hand for this repository, and gate done fails a lane S ticket that touches one; (3) a check on each ticket's diff for signs of a new interface outside that list, which needs the list updated or the reviewer's reason. The onboarding scan that proposes the list is a later ticket — "A"
- D-05 All three parts of D-04 are needed for the ticket to count as done — "all 3"
- D-06 Size still matters when the lane is proposed, once: a request goes to lane M when the scope the scout records has more than 5 hand-written files or spans more than 3 code areas; test files are not counted in either; generated and rendered copies are not counted; gate done counts nothing and only holds the ticket to the recorded scope. The veto on counting files applies to gate done — "A but do not count tests."
- D-07 gate done keeps the 3-line bound of @ac-3 on a file declared wording-only; it is the only line count at gate done and counts no files — "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-25: "I meant: before deciding whether a ticket is S or M, why is there no research phase?"
- 2026-10-25: "I do not want to rely on the number of files; is there another way? Propose 2-3 solutions."

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] With no file count, does the size of the expected change still lift a request to lane M when the lane is proposed, and by what rule? Settled by D-06.

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: one branch-diff fact, loaded by the CLI at gate done for every ticket with `lane:`, judged by pure core rules: outside `## Scope` (lane S, with the declared and confirmed wording-only exception), sensitive paths (lane S), interface signs (every lane). `## Scope` is read from the commit that first recorded `ac_hash`, so widening it and re-running gate ready changes nothing; a lane S ticket with no or empty Scope fails. `generated:` is read from the merge-base config, `sensitive:` from base ∪ HEAD; a missing default ref, a failed git call, or a diff that lacks the ticket's own file fails the gate. review-package lists the interface signs and out-of-scope files so the reviewer sees them before gate done.
Rejected: checks without pinning Scope (the agent could widen the recorded scope quietly); Scope pinned only by the lane S hash (re-running gate ready re-pins it, critic Must 1); a size check on Scope at gate ready (no criterion asks for it).
Affected: accord skill (new reference file in `loads:` for scout-first, the 5-file/3-area rule, and Scope including tests and new files, also on the moved-to-S path and the `stop:` handoff); lane-s.md; intent skill's lift-condition count; reviewer agent and review record text for the three fixed lines; ticket-lane-s template; config schema (`sensitive`, `generated`); snapshot model and loader; gate rules and a new gate/scope.ts; cli gate.ts and load/fs.ts; review-package; this repository's config `sensitive:` and `generated:` lists, drafted at plan and shown to the owner before build; README lift sentence and generated copies.
Risks (critic): Must 1 pinning and Must 2 absent Scope are fixed as above; Must 3, the reviewer and ledger lines, is wired through the reviewer, lane-s.md and record.md text. Should: the call sign skips Markdown and the exempt paths; whitespace uses `-b --ignore-blank-lines --ignore-cr-at-eol`, never `-w`, since `-w` hides `--out <file>` → `--out<file>`; `--no-renames`, so a rename or a mode-only change counts; a sync-written path is exempt only when its text equals the fresh render; the merge base comes from `defaultRefOf`, and a stacked pull request into a non-default branch is judged against the default branch. Every lane M gate done now needs a merge base: a repository with no origin and no local main or master fails Done.
Tests: @ac-1 skill text tests in core (stage-skills); @ac-2 to @ac-5 core rule tests over a hand-built fact, plus one CLI test on a real git fixture proving the whitespace flags and the merge base on Windows and Linux.
