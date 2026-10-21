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
approved_hash: "fnv1a64:9df3b6a1c936e862"
ac_hash: "fnv1a64:d4d4ce671ded68e3"
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

  @ac-1 @test:packages/core/test/agents.test.ts#ac-1-the-executor-is-told-how-verify-ids-match-what-it-must-not-touch-and-to-read-the-conventions
  Scenario: The executor is told how verify ids match, what it must not touch, and to read the conventions
    Given `accord skills sync` has rendered the executor agent
    When the rendered executor instructions are read
    Then they say a `verify:` id must equal, character for character, the id accord builds from the JUnit report: the testcase's classname, then `#`, then its name (which already carries every enclosing describe title), where the whole classname and the whole name are each trimmed and each run of whitespace in them becomes `-`; or that name alone when the classname attribute is missing or is the empty string before trimming
    And they say the executor reads the JUnit report and finds each verify id in it before reporting done
    And they say the executor never runs `accord task-done` and never creates, changes, deletes or renames any file under the repository's top-level `accord/` folder (an `accord/` folder inside a test fixture or an example is not it)
    And they say the executor reads `accord/product/` and follows `accord/product/conventions.md`, and the rendered planner instructions say the planner reads `accord/product/`
    And the accord rules every session receives at its start say that every commit, by the main session or any agent, follows `accord/product/conventions.md` when that file exists

  @ac-2 @test:packages/cli/test/lane-commands.test.ts#ac-2-every-brief-ends-with-the-repository-conventions
  Scenario: Every brief ends with the repository's conventions
    Given `accord init` has written `accord/product/conventions.md` from its template
    And the file's text has been replaced with "- Never add a commit trailer."
    When `accord brief <id> <n>` runs for a planned task
    Then its output is the brief it prints today (which ends in exactly one newline), then the characters `\n---\n\n`, then the file's text byte for byte, with nothing after it
    And when the file is absent, or holds nothing but whitespace and byte order marks, the output is exactly the brief it prints today, with no `---` line added

  @ac-3 @test:packages/cli/test/trailers.test.ts#ac-3-task-done-refuses-a-task-whose-commit-carries-a-forbidden-line-when-the-repository-forbids-trailers
  Scenario: task-done refuses a task whose commit carries a forbidden line (D-07) when the repository forbids trailers
    Given `config.yml` sets `commits.trailers: forbid`
    And a commit reached from HEAD by first parents that is neither on the default branch (origin/HEAD's target, else origin/main, else origin/master) nor reachable from the commit the ledger records for the highest recorded task below n has the body "Adds the parser.\nCo-Authored-By: Bot <bot@example.com>", with no blank line before the Co-Authored-By line
    When `accord task-done <id> <n>` runs
    Then it exits 1, prints that commit's 12-character sha and that line with its leading and trailing whitespace removed, and records nothing in the ledger
    And it refuses in the same way for every other forbidden line D-07 defines, a "Generated with" line among them
    And when `commits.trailers` is absent or `allow`, the same task is recorded
    And when the check is on and none of origin/HEAD, origin/main and origin/master exists, it exits 2 and says to run `git fetch origin`

  @ac-4 @test:packages/cli/test/gate.test.ts#ac-4-gate-done-refuses-a-ticket-branch-holding-any-forbidden-line-when-the-repository-forbids-trailers
  Scenario: gate done refuses a ticket branch holding any forbidden line when the repository forbids trailers
    Given `config.yml` sets `commits.trailers: forbid`
    And `accord gate done <id>` checks the commits reached from HEAD by first parents, as run in the ticket's worktree
    And one of those commits that is not on the default branch (origin/HEAD's target, else origin/main, else origin/master, never the local main) has the line "🤖 Generated with [Claude Code](https://claude.com/claude-code)" in its body
    When `accord gate done <id>` runs
    Then it exits 1 and prints that commit's 12-character sha and that line with its leading and trailing whitespace removed
    And when no commit on the branch has a forbidden line as D-07 defines it, this check passes
    And a commit reached only through the second parent of a merge on the ticket branch is not checked
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
- D-07 Replaces D-03 and narrows D-06 to the body: a forbidden line is any line of the commit body (every line after the subject) that, after leading whitespace, starts with a token of one or more ASCII letters, digits or hyphens that ends in `-by:` (Co-Authored-By, Signed-off-by, Reviewed-by, Acked-by), or that contains "Generated with"; letter case is ignored in both tests, accord reads the body itself and never git's trailer parser, so the result does not depend on the git version or git config, and the subject is never checked — "A" (answering, after the critic showed git's parser misses a Co-Authored-By line sharing a paragraph with prose and flags bodies such as `build: …` and `Owner: "có"`: `-by:` lines anywhere plus "Generated with" in the body vs git's parser plus any Co-Authored-By line vs only Co-Authored-By plus "Generated with")
- D-08 `gate done`'s check that the ticks and the review were made against the gated code treats a later change to `accord/product/conventions.md` like a change to the ticket's own records, so the promotion commit of D-05 does not fail `gate.tick-stale-commit` or `gate.stale-review` in CI — "1.a" (answering, after the plan critic showed the promotion commit lands after the ticks: accept conventions.md as a record vs move the promotion commit before the ticks and change ac-5)
- D-09 The accord-build skill's task-done step gains a route for a commit-trailer refusal: the main session rewords a commit it made itself, re-dispatches the executor with the reasons for a commit the executor made, and on exit 2 runs `git fetch origin`, then runs task-done again — "2.a" (answering, after the plan critic showed build has no route for it: add the route vs leave it to the session)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: a pure core rule over raw commit bodies, read by one `git log` in the cli. A core function takes a message, drops the subject, and returns each body line D-07 forbids. A cli loader runs `git -c log.showSignature=false log --no-show-signature --first-parent --format=%H%x00%B%x01 HEAD ^DEFAULT_REF ^TASK_SHA` (TASK_SHA: the ledger commit of the highest recorded task below n, task-done only) with a 64 MiB buffer; the default ref reuses `gitDefaultRef` (origin/HEAD, else origin/main, else origin/master) and its absence is exit 2. task-done adds offenders to its refusal reasons before any tag or ledger write; gate done gets them through a new core rule `gate.commit-trailer`, so `--json` carries the finding (D-87).
Rejected: git's own trailer parser through `%(trailers)` (misses a Co-Authored-By line sharing a paragraph with prose, flags `build: …` and `Owner: "…"` bodies, and reads trailer.* config; D-07 replaced it); a core re-implementation of git's trailer rules (drifts from git and no criterion needs it); the check in the cli only (breaks D-87 and drops the finding from `--json`).
Affected: agents/executor.md and planner.md, skills/verify/SKILL.md, skills/build/SKILL.md (D-09), templates/ruleset.md and a new templates/conventions.md, scaffold/init.ts, cli brief.ts, task-done.ts, gate.ts and load/fs.ts, core gate/done.ts (the new rule, and conventions.md as an own record per D-08) and rules.ts, config.schema.json and the config type, generated maps and rendered copies; then, by the main session, this repository's accord/config.yml (`commits: { trailers: forbid }`) and accord/product/conventions.md.
Risks, kept from the critic:
- Should: a repository that turns forbid on while ticket branches are open has their older offending commits refused by gate done, and the only fix is rewriting that branch's history; this ticket's own branch has none today (its approval commit was reworded before push).
- Should: the verify commit is made after gate done passes, so no local check sees it; only CI does, after the push. The ruleset line and conventions.md are what prevent it.
- Nice: a CRLF conventions.md prints byte for byte, CRLF included, because brief reads it from disk (ac-2 says byte for byte).
Tests: ac-1 and ac-5 in core, by rendering the executor, planner, ruleset and verify skill and checking each rule's key phrases; ac-2 a cli brief case (present, absent, whitespace-only); ac-3 a cli task-done case in a temp repo with `refs/remotes/origin/main` made by update-ref (forbid refuses, allow records, no origin ref exits 2); ac-4 a cli gate case (the robot line refuses, a clean branch passes, a second-parent commit is skipped, no origin ref exits 2). The core detector's letter-case and leading-whitespace cases carry `risk:parsing`.
