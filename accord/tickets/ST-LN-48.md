---
id: "ST-LN-48"                            # equals the file name: tickets/<id>.md
title: "Remove all Vietnamese from tracked files before 0.2.0"
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
The repository is public, and the Vietnamese in its tracked files (owner quotes in ticket records, test fixtures, a doc) was never meant for its readers.
For readers of the public repository, before the 0.2.0 release: main holds no Vietnamese, and a repository test keeps it out from now on.
Success: the new test passes on main, every ticket keeps the stage it had, and tests that covered non-English text still cover it in another language.
Not done: git history is not rewritten; `accord lint` gains no rule, so accord users are not affected.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-48

  @ac-1
  Scenario: No tracked file holds a Vietnamese-only letter
    Given the files `git ls-files` lists in the working tree of the cleaned branch, read whole, skipping only a file that holds a NUL byte anywhere
    When the repository test suite runs
    Then the check, reading each file's text in Unicode NFC form, finds in none of them a Vietnamese-only letter: a with breve (U+0102, U+0103), d with stroke (U+0110, U+0111), o with horn (U+01A0, U+01A1), u with horn (U+01AF, U+01B0), or any letter from U+1EA0 to U+1EF9

  @ac-2
  Scenario: The check fails when Vietnamese comes back
    Given a temporary git repository with a committed file holding a d with stroke (U+0111) on its third line
    When the check runs on that repository
    Then it fails and names the file by its path relative to the repository root, and line 3

  @ac-3
  Scenario: Every ticket keeps its stage after the translation
    Given the `stage` that `accord status --json --all` reports, on the main commit this ticket's branch was made from, for each ticket other than ST-LN-48
    When the ticket records are translated and their hashes recomputed
    Then `accord status --json --all` on the cleaned branch reports the same `stage` for each of those tickets

  @ac-4
  Scenario: Non-English coverage moves to another language
    Given the tests that used Vietnamese for these five traits: a Gherkin dialect whose Feature and Scenario keywords hold non-ASCII letters, a word whose marked letter stays marked through the reference matcher's normalising, so it never equals the word spelt with the bare letter, a title of single-code-point capitals with a diacritic cut by code point, a ticket id holding a non-ASCII letter, and EARS keywords inside non-ASCII prose
    When the cleanup is done
    Then each of those tests keeps its trait with text in another language, which may differ from test to test, and the whole suite passes

  @ac-5
  Scenario: The conventions carry the English quote rule
    Given accord/product/conventions.md after the cleanup
    When an agent reads it
    Then exactly one of its rule lines says that owner quotes in Decisions, Corrections and approval commit messages are written as a faithful English translation
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->
- "git history is not rewritten"

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Clean the files on main only; git history is not rewritten — "clean the files on main only, git history is not rewritten"
- D-02 From now on owner quotes (Decisions, Corrections, approval commit messages) are recorded as a faithful English translation, as a rule in accord/product/conventions.md — "from now on owner quotes (Decisions, Corrections, approval commit messages) are recorded as a faithful English translation, added as a rule in accord/product/conventions.md"
- D-03 Tests that use Vietnamese for non-English coverage move to another language — "Tests that use Vietnamese for non-English coverage move to another language"
- D-04 The work has four parts: clean every tracked file on main, move Vietnamese test coverage to another language, add the English-quote rule, and a check that fails on Vietnamese-only letters — "ok"
- D-05 Translated ticket records get their hashes recomputed to match the translation, so done tickets stay done; the original approvals stay in git history — "A"
- D-06 The check is a test of this repository only, reading the files git tracks, run by `npm test` and CI; `accord lint` gains no rule and accord users are not affected — "A"
- D-07 docs/plans/aidlc-vs-accord.html is translated into English and kept where it is — "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: translate in place with the existing tools, line for line so line numbers in tests and goldens stay put, and prove @ac-3 against a pinned baseline. It meets every criterion with tools already in the repository and works in CI's shallow checkout.
- Finding the lines: read each file the check or a wider search lists (the check's set, a/e/i/o/u/y with grave or acute, circumflex vowels, the `vi` dialect's step keywords) and translate every Vietnamese line in it, accented or not; gherkin-shapes RULE.md is named. The plan lists every file to open.
- Non-English coverage moves to French: the five traits (dialect `fr`; `où` against `ou`; a capital E with acute cut by code point; an id holding it; EARS lines written with accented letters beside the keywords, each asserted to hold a letter above U+007F), plus tracker.test.ts:191, panel.test.ts:497-501, hash.test.ts:65-70 and the valid-build LOGIN-1 fixture that ears.test.ts copies. Other prose goes to English.
- Hashes: `accord approve` re-hashes only tickets whose approved_hash matched at d5db8c3; plan_hash likewise; fixture ac_hash/verified_hash are recomputed with core's acHash (STALE stays stale), plus CLEAN_HASH and gate.test.ts:395. Goldens come from `vitest -u`; the diff review asserts no `line` or `rule` value changed.
- The check is a local function in a new packages/cli/test/no-vietnamese.test.ts on the existing repo helpers: @ac-1 runs `git ls-files -z` at the root and skips a listed path that is missing on disk; @ac-2 commits a file in a temporary repository.
- @ac-3: a stage map is computed with core over d5db8c3's files; the test compares it with core's stage on the working tree for tickets whose five records match fingerprints taken on the cleaned branch after the last `accord approve`. `accord approve`, the fingerprints and a one-off `accord status --json --all` diff of base against branch (the criterion's exact wording, catching git-only facts like a plan.md commit subject) all run last, at the verified commit.
- One rule line in accord/product/conventions.md (@ac-5); renamed test ids are replaced in place in accord/tests-baseline.txt; docs/plans/aidlc-vs-accord.html is translated in place.
Rejected: running the real `accord status` on both commits inside the test — needs a full-depth CI checkout and finds the translation commit by its subject, which is fragile; the one-off status diff gives the same proof.
Affected: about 75 ticket records, about 110 fixtures, about 40 goldens, about 18 test files, 2 source comments, conventions.md, tests-baseline.txt, the HTML doc, one new test file.
Risks: (Should) the accord pull-request check goes red, expected: the PR changes code, so `gate done` runs on each changed ticket file and old done tickets fail `gate.tick-stale-commit` and `gate.stale-review`, drafts fail too; main has no branch protection, so it does not block the merge, and the PR body names these rules. (Should) a quote edited after `accord approve` or a touched plan.md of a ticket with open tasks moves a stage; the last-step order and the status diff catch it. A translation can drift from the owner's meaning; review checks each quote.
Tests: @ac-1, @ac-2 in no-vietnamese.test.ts (cli, real git); @ac-3 in a core-level stage test plus the status diff as verify evidence; @ac-4 by the French trait tests and the full suite; @ac-5 by a convention test reading conventions.md.
