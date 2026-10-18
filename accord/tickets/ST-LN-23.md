---
id: "ST-LN-23"                            # equals the file name: tickets/<id>.md
title: "A @ui criterion the verifier cannot check is checked by the owner, and verify records that check"
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
Queued 2026-10-18, not approved; the intent interview replaces this:
- Found during ST-LN-21: the verifier has no real host, so it records every @ui criterion as `Result: blocked`; `gate done` then refuses with gate.result-not-pass and gate.evidence-unresolved, and accord-verify step 5 says a blocked criterion is shown to the owner and never ticked past, but says nothing about how the owner's own check turns it into a pass. In ST-LN-21 the main session improvised: it re-dispatched the verifier with the owner's report of the check and the owner's words, and the verifier rewrote only the @ac-4 block citing the files the check exercised. Owner, on this finding: "còn 2 việc phát sinh thì mở một ticket xử lý, hoặc xem có ticket nào dc thì gộp vào luôn"; the worktree half of the finding went to ST-LN-7.
- Proposal to confirm at intent: the owner report's try-this steps are the @ui check, and the approve question asks whether each @ui criterion held; on an approve, a verifier records each such criterion as pass from the owner's words and the files the check exercised, so the step is written down rather than improvised. Checked against existing tickets: ST-LN-12 (deferred items at verify) and ST-LN-11 (full suite at verify) touch the same stage but not this case.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-23

  @ac-1
  Scenario: <observable outcome>
    Given ...
    When ...
    Then ...
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
