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
approved_hash: "fnv1a64:290d283e8428f557"
ac_hash: "fnv1a64:3165fac58c742bdf"
verified_hash: "fnv1a64:3165fac58c742bdf"
verified_commit: "753bd08b659c510c07f4c579d644464048d7ca9e"
verified:
  - "ac-1"
  - "ac-2"
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

  @ac-1 @test:packages/core/test/stage-skills.test.ts#ac-1-the-shared-ask-rule-holds-the-fixed-sentence-beside-every-stage-skill
  Scenario: the shared rule holds the fixed sentence beside every stage skill that asks the owner
    Given the files `accord skills sync` writes for a config that enables every runtime, in every target directory
    When a reader opens the ask.md beside the SKILL.md of each of accord, intent, approach, plan, build, review, verify, and debug
    Then each ask.md holds the sentence "Every question to the owner stands alone, because the owner may see only the question and its options: it says in one or two plain sentences what is being decided and why now, with an example; each option says what happens if it is chosen; the recommended option comes first; every id such as ac-2 or D-03 carries a short gloss." verbatim, a line break counting as one space

  @ac-2 @test:packages/core/test/stage-skills.test.ts#ac-2-every-stage-skill-points-to-the-shared-ask-rule-from-its-intent-paragraph
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
- D-01 Three parts: one fixed rule sentence (what is decided and why now, with an example; each option's consequence; internal ids glossed); every stage skill that asks the owner carries it; a test checks it verbatim on the render. Agents are out: an executor or architect hands its question to the main session, which asks the owner — "Exactly 3 parts (Recommended)"
- D-02 The sentence, in English, naming no runtime's question tool: "Every question to the owner stands alone, because the owner may see only the question and its options: it says in one or two plain sentences what is being decided and why now, with an example; each option says what happens if it is chosen; the recommended option comes first; every id such as ac-2 or D-03 carries a short gloss." — "The full version (Recommended)"
- D-03 The sentence lives in one shared file, `packages/core/skills/shared/ask.md`, loaded by the eight skills through `loads:`; each SKILL.md only points to `./ask.md`, because copying the sentence eight times would push the plan and `/accord` skills past the 5120-byte cap (`packages/core/test/skills.test.ts:189`), and the ruleset block reaches only one runtime — "Shared file + pointer line (Recommended)"
- D-04 The smallest version is all three parts — "All three parts (Recommended)"
- D-05 (audit) "Verbatim" means the same words and punctuation, a line break counting as one space, so the long sentence wraps like all other skill prose — "Agree to all 4 (Recommended)"
- D-06 (audit) "Every target directory" means every directory `accord skills sync` writes for a config that enables every runtime — "Agree to all 4 (Recommended)"
- D-07 (audit) ac-2 checks the literal text `./ask.md`, as `./prototype.md` is referenced today, inside the one shared rules paragraph beginning "Anything touching intent"; other sentences holding "asks the owner", such as `packages/core/skills/review/SKILL.md:54`, are not checked — "Agree to all 4 (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen: `loads:` plus one pointer sentence for every question.** A new `packages/core/skills/shared/ask.md`,
`kind: reference` and shaped like `packages/core/skills/plan/baseline.md`, holds the D-02 sentence, wrapped. The
eight stage skills add `shared/ask.md` to `loads:` (plan and review extend their lists); the render drops
`loads:`, so it costs no bytes. Each Rules bullet beginning "Anything touching intent" ends with the sentence
"Read `./ask.md` before any question to the owner.", rewrapped; the rest of the bullet is unchanged.
**Rejected:** folding the pointer into "asks the owner, first reading `./ask.md`" (critic Must: it fires only for
intent questions, so the approach yes and the verify approve would stay bare); loading `ask.md` in code for
every stage (against D-03, and it hides the load).
**Affected:** `packages/core/skills/shared/ask.md` (new); the eight `packages/core/skills/*/SKILL.md`;
`packages/core/test/stage-skills.test.ts`; `packages/core/src/generated/skills.ts`; the eight
`.claude/skills/accord*/SKILL.md` and the eight new `ask.md` beside them, in the order `npm run gen`,
`npm run build`, `node packages/cli/dist/cli.js skills sync`. The plan's `files:` lines name all of them.
**Risks (critic):** Should, fixed in the tests: ac-2 counts every paragraph or list item that begins "Anything
touching intent" once a leading `- ` or indentation is stripped, not only column-0 bullets. Nice: ac-1 turns a
line break and the indentation around it into one space but fails on a blank line inside the sentence (D-05).
Nice: the rendered plan skill reaches about 5099 of 5120 bytes; its next addition goes into a loaded reference
(`docs/plans/2026-10-12-phase-2-dogfood.md:218-219`), and two branches that each add to it can pass alone and
fail together on main.
**Tests:** ac-1 and ac-2 as top-level tests in `packages/core/test/stage-skills.test.ts`, over a config that
enables every runtime, looping the eight stage names times every target directory, a missing or empty file
failing. The caps and the relative-reference check in `packages/core/test/skills.test.ts` cover size and `./ask.md`.
