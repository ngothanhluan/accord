---
id: "ASK-1"                            # equals the file name: tickets/<id>.md
title: "Every question to the owner stands alone"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
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
A question accord puts to the owner often arrives without context: the dialog shows only the question and its
options, so the owner cannot tell what is being decided (dogfood item 36). For the owner, at every stage that
asks. Done when the eight stage skills that ask the owner each load one shared rule, `ask.md`, holding a fixed
sentence, and point to it. Not: agents, whose questions the main session restates; the ruleset hook block;
rewording other skill text; the skill byte cap.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ASK-1

  @ac-1
  Scenario: the shared rule holds the fixed sentence beside every stage skill that asks the owner
    Given the files `accord skills sync` writes for a config that enables every runtime, in every target directory
    When a reader opens the ask.md beside the SKILL.md of each of accord, intent, approach, plan, build, review, verify, and debug
    Then each ask.md holds the sentence "Every question to the owner stands alone, because the owner may see only the question and its options: it says in one or two plain sentences what is being decided and why now, with an example; each option says what happens if it is chosen; the recommended option comes first; every id such as ac-2 or D-03 carries a short gloss." verbatim, a line break counting as one space

  @ac-2
  Scenario: every stage skill that asks the owner points to the shared rule
    Given the files `accord skills sync` writes for a config that enables every runtime, in every target directory
    When a reader opens the SKILL.md of each of accord, intent, approach, plan, build, review, verify, and debug
    Then it holds exactly one paragraph beginning "Anything touching intent", and that paragraph holds "stops the run and asks the owner" and the literal text `./ask.md`, a line break counting as one space
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->
(none)

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Three parts: one fixed rule sentence (what is decided and why now, with an example; each option's consequence; internal ids glossed); every stage skill that asks the owner carries it; a test checks it verbatim on the render. Agents are out: an executor or architect hands its question to the main session, which asks the owner — "Đúng 3 phần (Recommended)"
- D-02 The sentence, in English, naming no runtime's question tool: "Every question to the owner stands alone, because the owner may see only the question and its options: it says in one or two plain sentences what is being decided and why now, with an example; each option says what happens if it is chosen; the recommended option comes first; every id such as ac-2 or D-03 carries a short gloss." — "Bản đầy đủ (Recommended)"
- D-03 The sentence lives in one shared file, `packages/core/skills/shared/ask.md`, loaded by the eight skills through `loads:`; each SKILL.md only points to `./ask.md`, because copying the sentence eight times would push the plan and `/accord` skills past the 5120-byte cap (`packages/core/test/skills.test.ts:189`), and the ruleset block reaches only one runtime — "File chung + dòng trỏ (Recommended)"
- D-04 The smallest version is all three parts — "Cả ba phần (Recommended)"
- D-05 (audit) "Verbatim" means the same words and punctuation, a line break counting as one space, so the long sentence wraps like all other skill prose — "Đồng ý cả 4 (Recommended)"
- D-06 (audit) "Every target directory" means every directory `accord skills sync` writes for a config that enables every runtime — "Đồng ý cả 4 (Recommended)"
- D-07 (audit) ac-2 checks the literal text `./ask.md`, as `./prototype.md` is referenced today, inside the one shared rules paragraph beginning "Anything touching intent"; other sentences holding "asks the owner", such as `packages/core/skills/review/SKILL.md:54`, are not checked — "Đồng ý cả 4 (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
