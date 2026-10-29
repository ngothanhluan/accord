---
id: "ST-LN-60"                            # equals the file name: tickets/<id>.md
title: "A teammate's review comments on a ticket's pull request are checked and routed like review findings"
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
- Why: no accord skill says what to do with review comments on a ticket's pull request, so an agent asked to handle them may change code without checking the comment, against a Veto, Decision or Correction, outside review and verify, or post replies the owner never saw; accord targets teams where the reviewer is another person.
- For whom: the owner and teammates on a ticket whose pull request is open and not merged (lane M from verify, lane S from its step 6), for a comment by anyone, the owner included (D-05).
- Success: asked to handle the comments (D-03), the agent follows one written path: check each against the code, ask about unclear ones first, send conflicts to the owner, fix the rest as review findings through the path `failure.md` gives, and post the drafted thread replies only on the owner's yes (D-04).
- Not this: no CLI gate or command reads the pull request (D-01); comments are never read unasked (D-03); no GitHub account is mapped to the owner (D-05).
- Research: `accord/research/2026-10-25-plugin-audit.md`, gap 6, from superpowers 7.0.0 `receiving-code-review` (evidence, not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-60

  @ac-1
  Scenario: Every comment is checked against the code before anything is fixed
    Given a ticket whose pull request is open and not merged
    When someone asks the agent to handle that pull request's comments
    Then the rendered skills tell the agent to take each review thread, each top-level comment and each review's summary as one comment, a reply inside a thread being part of that thread, by a person whoever it is, the owner included
    And to check each comment against the code and mark it holds, does not hold, or unclear before fixing any comment

  @ac-2
  Scenario: Unclear comments are asked about before any comment is fixed
    Given at least one comment is marked unclear
    When the agent has checked every comment
    Then the rendered skills tell the agent to draft a question for each unclear comment's thread first, show those drafts to the owner and post them only after the owner's yes
    And to fix no comment until every unclear comment is answered, in its thread by its author or in the chat by the owner

  @ac-3
  Scenario: A comment against a Veto, Decision or Correction stops the handling and goes to the owner
    Given a comment asks for something a Veto, Decision or Correction of the ticket forbids or settles otherwise
    When the agent has checked every comment
    Then the rendered skills tell the agent to stop handling every comment and ask the owner about that one, naming the Veto, Decision or Correction
    And to fix no comment until the owner answers

  @ac-4
  Scenario: The comments that hold are fixed as one review round's findings and the fix is reviewed and verified again
    Given comments that hold and conflict with no Veto, Decision or Correction
    When the agent fixes them
    Then the rendered skills tell the agent to classify each patch, plan-gap or intent-gap and handle them as `accord-review` handles one round's findings, the patch ones fixed together through a fresh executor
    And to take that fix through the path `failure.md` gives a failure reported after verify: one new review round and then verify again for lane M, the lane S steps for lane S

  @ac-5
  Scenario: Replies are posted to their threads only after the owner's yes
    Given every comment is fixed, declined or answered
    When the agent answers them
    Then the rendered skills tell the agent to draft one reply per comment: the commit that fixed it, the reason it was not changed, or the answer it took
    And to show every draft to the owner together, apply the owner's changes to any of them, and post them to their threads only after the owner's yes
    And to post no reply, comment or review to the pull request before that yes, while the fix commits are pushed as the stage skills already push them
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Instructions only: the change is skill wording plus the tests that check it; no new CLI gate reads the pull request — "A" (2026-10-29, to: A, instructions only; B, instructions plus a CLI gate; C, defer)
- D-02 The two research gaps with no ticket (worktree.md's output handling moved into the CLI; a skill wording change run against a benchmark baseline) are queued as their own tickets, not folded into this one — "A" (2026-10-29, to: A, split into three tickets; B, fold all three in; C, fold only the baseline rule in)
- D-03 The agent reads a pull request's comments only when someone asks it to (names the comments or pastes a link), never on its own at every Continue — "A" (2026-10-29, to: A, on request; B, checked at every Continue of a ticket with a pull request)
- D-04 The agent drafts the reply for each comment's thread and shows the drafts to the owner; it posts them only after the owner's yes — "A" (2026-10-29, to: A, the agent drafts, the owner approves, then the agent posts; B, the agent posts on its own; C, the agent only drafts and the owner posts)
- D-05 A comment from the owner takes the same steps as a teammate's; it is written under `## Corrections` only when it changes the intent or a criterion and the owner confirms it, and nothing tells the owner's GitHub account apart — "A" (2026-10-29, to: A, the same steps, a Correction only on the owner's confirmation; B, every owner comment is a Correction, which needs the owner's GitHub account in config)
- D-06 The smallest version that counts as done holds all five parts: check each comment against the code; ask about unclear ones before fixing any; send a conflict with a Veto, Decision or Correction to the owner; fix the rest as review findings and review and verify the fix again as `failure.md` says; draft a reply for every thread, posted on the owner's yes — "yes" (2026-10-29, to: the five parts as the smallest version, with the reply to a comment that does not hold offered as the one part that could be cut)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
