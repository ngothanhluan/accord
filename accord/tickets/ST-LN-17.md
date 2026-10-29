---
id: "ST-LN-17"                            # equals the file name: tickets/<id>.md
title: "The CLI counts every review and plan-critique round, so a session cannot miss the tier-up, the cap, or a loop that stops converging"
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
Review and plan-critique rounds are counted only in the session's memory, so the fix executor's tier-up, the round cap and the stop on a loop that does not converge are missed: benchmark round 1 found 6 tier-up misses and 2 reviews past the cap, ST-LN-51 ran 5 review rounds unstopped, and BUG-LN-3 ran 4 rounds while its Approach held an option in reserve that nobody raised.
For the owner, and for every session that runs review or plan critique, in Claude Code, Cursor and Codex alike.
Success: accord computes the round, the cap and the fix executor's model from round records written as each round ends, refuses past the cap or on a record it cannot read, and stops for the owner from round 3 when a loop does not converge; the benchmark finds no tier-up miss and no cap breach on tickets reviewed after this ships.
Non-goals: how reviewers find, word or rank findings (ST-LN-56, ST-LN-57); per-risk finding tags (D-02); a hook for Cursor or Codex.
Evidence: `accord/research/2026-10-25-review-convergence.md` and the queued text in git history (not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-17

  @ac-1
  Scenario: The round record gives the round, the cap and the fix executor's model
    Given a lane M ticket whose review.md records rounds 1 to 3, each written as its round ended, with round 3 reporting only Nice findings and fewer findings than round 2
    And the executor's configured model is sonnet and escalation.fix_round_tier_up is 4
    When the session asks accord for the next review round
    Then accord prints round 4, the cap of 5 rounds and opus as the model of the executor that fixes round 4's findings
    And once review.md marks a return from verify after round 4, the next round prints as round 1 of 5 with opus still the fix executor's model, because a tier once raised stays raised for the ticket

  @ac-2
  Scenario: A round record accord cannot read, or a round past the cap, gets no next round
    Given a review.md with any round record holding a finding whose severity accord cannot read, or holding five rounds since the last return from verify with no owner Ruling in the ledger allowing more
    When the session asks accord for the next review round, in lane M or lane S
    Then accord exits non-zero, names the reason, and prints no model for a fix executor
    And an owner Ruling allowing a stated number of more rounds lets exactly that many more run before the same refusal

  @ac-3
  Scenario: A review that stops converging stops for the owner
    Given a lane M or lane S review.md that records round 3 or a later round, counted from the last return from verify
    And that round reports a Should or a Must, or reports no fewer findings of any severity than the round before
    When the session asks accord for the next review round
    Then accord prints "stop: report to owner" with that round's findings and the ticket's Approach section, asking whether to change course
    And no next round is given, and accord gate done fails until review.md ends with the line verdict: accepted-by-owner followed by the owner's sentence in quotes, or a later round reports no findings and review.md ends with verdict: converged

  @ac-4
  Scenario: The plan critique loop has the same cap and stop
    Given a plan-review.md whose rounds after the last "## Closed" record round 3 or later still reporting a Should or a Must, or no fewer findings than the round before, or record five rounds
    When the session asks accord for the next plan critique round
    Then accord prints the same stop as review does, "stop: report to owner" with that round's findings and the Approach section, and gives no next round
    And accord gate plan fails until plan-review.md ends with the line verdict: accepted-by-owner followed by the owner's sentence in quotes, or a later round reports no findings

  @ac-5
  Scenario: In Claude Code a fix executor on the wrong model is refused
    Given a lane M ticket at the review stage whose review.md records round 4, for which accord computes opus as the fix executor's model
    When the session dispatches the executor agent in Claude Code with model sonnet, or with no model
    Then the dispatch is refused with a message naming round 4 and the model to pass
    And the same dispatch with model opus goes through
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 After each return from verify the round cap counts again from the first round after it, while the fix executor's model tier, once raised, stays raised — "A" (2026-10-29, to: cap restarts after verify, tier-up does not)
- D-02 The change-of-course prompt joins the stop from round 3: the stop report names the options the Approach rejected or held in reserve and asks whether to change course; findings carry no per-risk tag — "A" (2026-10-29, after the BUG-LN-3 rounds showed tagged findings would ask later, at round 5, than the round 4 stop)
- D-03 In Claude Code a PreToolUse hook refuses a fix executor dispatched on a model other than the one the CLI computes for the round, on top of the CLI printing it; Cursor and Codex rely on the printed model and the benchmark — "A" (2026-10-29; overrides the 2026-10-17 choice of no tool-specific hook)
- D-04 All seven parts ship in this one ticket: round records written per round, the round command, the stop from round 3 with gate done blocked, the change-of-course prompt, the plan critique cap, the Claude Code hook, and the D-01 count rule — "A" (2026-10-29, asked for the smallest version that still counts as done)
- D-05 The review skill writes each round to review.md as it happens; the CLI reads it and prints the round, the cap and the model to dispatch the fix executor with, refusing past the cap — "Create ticket: CLI computes it (Recommended)" (2026-10-17, after "how do we make it impossible to forget this?")
- D-06 Past a round threshold the CLI says to ask the owner about a change of course — "ok, the proposal is valid" (2026-10-17)
- D-07 From round 3, when a Should or worse is still found or the count does not fall, accord prints "stop: report to owner", and gate done fails until review.md ends with verdict: accepted-by-owner or the owner allows more rounds; lane S and lane M alike, and the plan critique loop too — "ok, agreed" (2026-10-25, merged from ST-LN-53)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-29, on how far the change-of-course prompt goes: "don't worry about changing the ticket format, what matters is judging which option is most effective"

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
