---
id: "ST-LN-58"                            # equals the file name: tickets/<id>.md
title: "Every file a skill relies on is linked from that skill's own SKILL.md, and a test keeps it so"
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
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: an agent may read only part of a file it reached through another reference file, so a step two or three levels below SKILL.md can be missed (Anthropic's skill authoring guide; evidence in `accord/research/2026-10-25-plugin-audit.md`).
For whom: every agent that runs an accord skill, in every runtime accord renders skills for.
Success: every reference file in a rendered skill folder is named in that folder's own SKILL.md, with when to read it, and a test fails the day a skill gains a file its SKILL.md does not name.
Today five are missing: `finish.md` in `accord`; `worktree.md` and `ids.md` in `accord-debug` and in `accord-verify`.
Not: removing the links between reference files, changing what any step says, or raising the SKILL.md size cap.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-58

  @ac-1
  Scenario: Every reference file of a rendered skill is named in its own SKILL.md
    Given the skill folders accord renders for the full roster of roles, and again for the roster of roles ba and dev
    When every file of each folder is listed
    Then every file other than SKILL.md appears as ./ followed by its file name somewhere in that folder's SKILL.md
    And this holds for finish.md in accord, and for worktree.md and ids.md in accord-debug and in accord-verify

  @ac-2
  Scenario: The check fails on a skill folder that holds a file its SKILL.md does not name
    Given a skill folder made for the test, holding a SKILL.md and one other file whose name, after ./, the SKILL.md does not contain
    When the check that proves ac-1 runs on that folder
    Then the check fails and its message names that folder and that file

  @ac-3
  Scenario: Each new mention says when to read the file
    Given the five sentences this ticket adds, one for each missing file in each of the three skills
    When each is read on its own
    Then the sentence itself names the step or the condition at which to read the file
    And every SKILL.md stays within 5120 bytes and 120 lines
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The ticket has two parts: each SKILL.md names every reference file its steps can reach, saying when to read it (five missing today), and a test fails when a skill folder holds a file its SKILL.md does not name; links between reference files stay as they are — "ok, correct" (owner, 2026-10-28, to these two parts)
- D-02 The smallest version that counts as done is both parts, the five mentions and the test — "A" (owner, 2026-10-28, choosing this against the mentions without the test and against the test alone)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
