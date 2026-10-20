---
id: "ST-LN-8"                            # equals the file name: tickets/<id>.md
title: "The executor brief carries the repository conventions, and the executor stays out of accord/ and adds no commit trailer"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
priority: high
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
Why: in dogfooding, executors added Co-Authored-By trailers against this repository's rule, ran `accord task-done` themselves, and reported verify cases passed that matched no JUnit name (findings 33, 34; BUG-LN-2); the main session repaired each by hand.
For whom: every team running accord; executors receive the repository's written conventions in every brief, and a repository that forbids trailers has the tools refuse them.
Success: on the next ticket built in this repository, `git log` of its branch shows no Co-Authored-By line.
Non-goals: no accord-wide trailer ban, no git hook, no lint rule for conventions.md, no new command.
Merged from ST-LN-9 (owner, 2026-10-18: "ok gộp đi").

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-8

  @ac-1
  Scenario: The executor is told how verify ids match, what it must not touch, and to read the conventions
    Given `accord skills sync` has rendered the executor agent
    When the rendered executor instructions are read
    Then they say a `verify:` id must equal, character for character, the id accord builds from the JUnit report: the testcase's classname, then `#`, then its name (which already carries every enclosing describe title), where the whole classname and the whole name are each trimmed and each run of whitespace in them becomes `-`; or that name alone when the classname is empty
    And they say the executor reads the JUnit report and finds each verify id in it before reporting done
    And they say the executor never runs `accord task-done` and never edits any file under `accord/`
    And they say the executor reads `accord/product/` and follows `accord/product/conventions.md`, and the rendered planner instructions say the planner reads `accord/product/`

  @ac-2
  Scenario: Every brief ends with the repository's conventions
    Given `accord init` has written `accord/product/conventions.md` from its template
    And the file's text has been replaced with "- Never add a commit trailer."
    When `accord brief <id> <n>` runs for a planned task
    Then its output is the brief it prints today, then a blank line, a line `---` and a blank line, then the file's text byte for byte
    And when the file is absent, or holds only whitespace, the output is exactly the brief it prints today, with no `---` line added

  @ac-3
  Scenario: task-done refuses a task whose commit carries a trailer when the repository forbids trailers
    Given `config.yml` sets `commits.trailers: forbid`
    And a commit after the commit the ledger records for task n-1 (for task 1, after the point where the ticket branch left the default branch, which is origin/HEAD's target, else origin/main or origin/master) ends with the paragraph "Co-Authored-By: Bot <bot@example.com>"
    When `accord task-done <id> <n>` runs
    Then it exits 1, prints that commit's 12-character sha and that line, and records nothing in the ledger
    And when `commits.trailers` is absent or `allow`, the same task is recorded
    And when the check is on and none of origin/HEAD, origin/main and origin/master exists, it exits 2 and says to run `git fetch origin`

  @ac-4
  Scenario: gate done refuses a ticket branch holding any trailer when the repository forbids trailers
    Given `config.yml` sets `commits.trailers: forbid`
    And one commit on the ticket branch that is not on the default branch (origin/HEAD's target, else origin/main or origin/master, never the local main) has the line "🤖 Generated with [Claude Code](https://claude.com/claude-code)" in its body
    When `accord gate done <id>` runs
    Then it exits 1 and prints that commit's 12-character sha and that line
    And when no commit on the branch has a git trailer or a line containing "Generated with", in any letter case, this check passes
    And when the check is on and none of origin/HEAD, origin/main and origin/master exists, it exits 2 and says to run `git fetch origin`

  @ac-5
  Scenario: Verify offers to promote a Ruling or Correction into the conventions
    Given `accord skills sync` has rendered the accord-verify skill
    When its steps are read
    Then one step has the main session read the ticket's Rulings and Corrections, ask the owner about each one it judges to hold across tickets, and on a yes write it as a rule line in `accord/product/conventions.md`, committed with `verification.md`
    And the step writes nothing to `conventions.md` without the owner's yes
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 No commit trailer is a per-repository convention, written in `accord/product/conventions.md`, not an accord rule for every repository; every agent that commits follows the conventions; the trailer check is turned on by a `config.yml` key, off by default, and this repository turns it on — "A" (answering: per-repository convention vs accord-wide rule vs ban in instructions with a per-repository check)
- D-02 When the check is on, `accord task-done` refuses a task whose commits carry a trailer, and `accord gate done` refuses when any commit on the ticket branch carries one — "A" (answering: task-done and gate done vs a commit-msg git hook vs a separate command skills call before push)
- D-03 A trailer is any line git reads as a trailer in a commit message's last paragraph, plus a "Generated with" line anywhere in the message — "A" (answering: every git trailer plus "Generated with" vs only Co-Authored-By and "Generated with" vs a configured pattern list)
- D-04 `accord/product/conventions.md` is free text like its siblings: `accord init` writes it from a short template (one rule per line, `Rejected:` lines for what was tried and refused), lint does not check it, and `accord brief` appends it verbatim, printing nothing for it when the file is absent — "A" (answering: like glossary and business-rules vs a fixed shape lint checks vs not scaffolded until verify first promotes a rule)
- D-05 Promotion is a step in the accord-verify skill with no new command: the main session reads the ticket's Rulings and Corrections, asks the owner about each one it judges to hold across tickets, and on a yes writes it as a rule line in `conventions.md`, committed with `verification.md` — "A" (answering: a skill step vs a new `accord promote <id>` command)
- D-06 A "Generated with" line is any line of the commit message that contains "Generated with" anywhere in it — "A" (answering: contains anywhere vs starts with vs starts with after leading non-letters)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
