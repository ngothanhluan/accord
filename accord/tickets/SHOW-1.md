---
id: "SHOW-1"                            # equals the file name: tickets/<id>.md
title: "The owner approves the ticket's text, not a summary"
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
The owner approves Intent and the acceptance criteria through a summary the orchestrator writes, while
`accord approve` hashes the file, so the text locked may not be the text approved (dogfood item 38). For the
owner. Done when the intent stage shows Intent and the criteria verbatim and takes a yes before the
architect, the approach yes shows Approach verbatim, and the spec's interview says so. Not: a new hash,
field, or gate for the intent yes; any change to what `approved_hash` covers.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: SHOW-1

  @ac-1
  Scenario: the intent stage shows Intent and the criteria verbatim and takes a yes before the architect
    Given the files `accord skills sync` writes for a config that enables every runtime, in every target directory
    When a reader opens each rendered `accord-intent/SKILL.md`
    Then it holds the sentence "Show the owner the `## Intent` section and the acceptance criteria block verbatim, copied from the ticket file and never summarised, ask for an explicit yes, and on yes commit the ticket with the owner's answer quoted in the commit message." verbatim, a line break and the indentation around it counting as one space
    And that sentence sits in a numbered step of its own, after the numbered step that dispatches `accord-auditor` and before the numbered step that names `accord-approach` as next

  @ac-2
  Scenario: the approach yes shows Approach verbatim instead of a brief
    Given the files `accord skills sync` writes for a config that enables every runtime, in every target directory
    When a reader opens each rendered `accord-approach/SKILL.md`
    Then it holds the sentence "Show the owner the `## Approach` section verbatim, copied from the ticket file and never summarised, together with any section changed since the owner's yes at the intent stage, and ask for an explicit yes." verbatim, a line break and the indentation around it counting as one space
    And it does not hold "Show the owner the brief"
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->
(none)

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Four parts: the intent skill gains a step after the audit that shows `## Intent` and the criteria block verbatim and takes a yes, a no becoming a Correction; the approach yes shows `## Approach` verbatim instead of a brief, plus any section changed since the intent yes, and `approved_hash` is unchanged; the intent yes is recorded by quoting the owner's answer in the commit message, with no new field or gate; a test checks the two sentences verbatim on the render, and the spec's interview is updated — "Đúng 4 phần (Recommended)"
- D-02 The two sentences. In the intent skill: "Show the owner the `## Intent` section and the acceptance criteria block verbatim, copied from the ticket file and never summarised, ask for an explicit yes, and on yes commit the ticket with the owner's answer quoted in the commit message." In the approach skill, replacing "Show the owner the brief and ask for an explicit yes.": "Show the owner the `## Approach` section verbatim, copied from the ticket file and never summarised, together with any section changed since the owner's yes at the intent stage, and ask for an explicit yes." The sentence saying the yes also approves the other sections as written stays — "Bản đề xuất (Recommended)"
- D-03 The smallest version is all four parts, the spec update included — "Cả 4 phần (Recommended)"
- D-04 (audit) A line break and the indentation around it count as one space; a blank line inside a sentence fails, as ASK-1 D-05 — "Đồng ý cả 4 (Recommended)"
- D-05 (audit) Sentence A sits in a numbered step of its own, after the one step that dispatches `accord-auditor` (step 8 today) and before the step "Next: `accord-approach`"; the criteria read the rendered `accord-intent/SKILL.md` and `accord-approach/SKILL.md` — "Đồng ý cả 4 (Recommended)"
- D-06 (audit) The ac-1 scenario says "before the architect", as the Intent does — "Đồng ý cả 4 (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
