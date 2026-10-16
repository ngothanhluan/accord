---
id: "ST-LN-4"                            # equals the file name: tickets/<id>.md
title: "A Should finding no longer forces another critic or review round"
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
approved_hash: "fnv1a64:2a0d59c3649e7077"
ac_hash: "fnv1a64:ce34eac8ca6c466c"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Plan critique takes 4 to 8 rounds (IDS-1 8, ST-LN-3 8); 21 of 29 past plan rounds ran on Should findings alone, yet 20 of 43 Should findings were real defects, so the cost is the re-reading, not the fixing.
For whoever runs a lane M ticket: a Should is still fixed, but a round with no Must ends in a cheap read of the fix diff, a Nice is never fixed in the plan, and the planner catches what the critic would before the first read.
Success: in the next three lane M tickets after this ships, each has at most three plan rounds and at most one critic read of the whole plan after the first, counted with `scripts/benchmark.mjs`; this measure never blocks merging.
Not in scope: the approach-stage critic, round caps, any CLI code that counts severities, two critics in parallel (deferred in the ledger).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-4

  @ac-1
  Scenario: After a plan round with only Should findings the next critic reads only the fix diff
    Given the accord-plan skill as `accord skills sync` renders it
    When a critic round reports at least one Should and no Must
    Then the skill has the planner fix every Should
    And the next round's critic is dispatched with `git diff` of `plan.md` from that round's commit, not the whole plan
    And after a round that reports a Must, the next round's critic reads the whole plan
    And the loop ends only on a round with no Must and no Should, within the existing three-round cap
    And no Nice finding is passed to the planner

  @ac-2
  Scenario: A review round with only Should findings converges without a re-review
    Given the accord-review skill as `accord skills sync` renders it
    When a review round, or the final review, reports at least one Should and no Must
    Then every Should is fixed and the `tests.affected` command over the files the fix touched passes
    And no reviewer is dispatched again for that fix
    And converged means no Must is open and every Should is fixed with that command passing

  @ac-3
  Scenario: Must, Should and Nice are defined by what happens if the finding is left
    Given the critic and reviewer agents as `accord skills sync` renders them
    Then each holds these three sentences word for word:
      """
      Must: left as is, the Intent does not hold, a criterion is not reached, or a Veto, Decision or Correction is broken.
      Should: left as is, a defect ships or an executor is blocked, which a later stage would catch at a higher cost.
      Nice: no defect, only a clearer or smaller way.
      """

  @ac-4
  Scenario: The planner checks its plan against the critic's checklist before handing it over
    Given the planner and critic agents as `accord skills sync` renders them
    Then the planner's agent file holds every check of the critic's plan mode, word for word
    And the planner is told to run those checks on its plan before it replies

  @ac-5
  Scenario: An API a finding relies on carries a citation
    Given the critic and planner agents as `accord skills sync` renders them
    Then the critic cites where any host or library API its finding or proposed fix relies on is defined: a file and line in the repository, or the URL of the document outside it
    And the planner applies a fix the critic proposes only when reading the cited place confirms that API
    And a fix with no citation, an unreadable citation, or a citation that does not confirm the API is reported as unverified, not applied
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 A Should is still fixed; after a plan round with only Should findings the critic reads only the fix diff, never the whole plan again; the plan never fixes a Nice; in review a Should fix is checked by the affected tests, without a re-review; Must, Should and Nice are defined by their consequence — "option 1" (to: "Đọc lại gọn hơn (Recommended)", after the history review of 43 critic Should findings, 2026-10-16)
- D-02 Before handing over a plan, the planner checks it against the same checklist the critic uses — "Planner tự soát checklist (Recommended)"
- D-03 The critic relies on a host or library API only with a file:line citation, and the planner checks a fix the critic proposes against the code before applying it — "API phải có trích dẫn (Recommended)"
- D-04 No agent gains a web tool: a critic-proposed fix whose API is cited only by a URL outside the repository goes to the owner at once, who applies or drops it — "Không thêm WebFetch, hỏi anh (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] The owner asked (2026-10-15) what Must, Should and Nice mean when every Must and Should gets fixed anyway: "cái critic chia làm must, should, nice, nhưng lần nào tôi thấy must và should cũng đều phải xử lý, vậy phân ra có ý nghĩa gì?" Proposal to confirm at intent: only a Must blocks convergence and starts another critic or review round; a Should is fixed in the same round without a re-read, or declined with a Ruling. It touches accord-plan, accord-approach and accord-review; the measured catch rate of Should findings in past tickets is unknown. Answered 2026-10-16 by the history review: a Should stays fixed; see D-01 to D-03.

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen: Option 1, amended over two critic rounds — skill and agent text, one test per criterion, no product code.**
- **Plan loop** (`packages/core/skills/plan/SKILL.md`): the main session keeps every critic finding in `accord/tickets/<id>/plan-review.md`, one `## Round <n> (whole|diff)` per round, each finding with its state: `open`, `fixed`, `unverified: <reason>`, or `owner: "<words>"`, committed with the round. The planner gets every open Must and Should, never a Nice (a Nice goes to the ledger's `## Deferred`), and replies per finding: fixed, or unverified with the reason. After a round with no Must the critic gets a `git diff` of `plan.md` from the round commit, written to a file outside the tree, plus `plan-review.md`; after a Must it reads the whole plan. The loop ends when no Must or Should in `plan-review.md` is open or unverified, within the three-round cap. Resume reads `plan-review.md` and round subjects since the last `plan: <id> ready` only.
- **D-04**: a fix whose API is cited only by a URL goes to the owner at once; the answer is written as `owner: "<words>"`, and an owner's "apply" is the confirmation the planner needs.
- **Critic** (`packages/core/agents/critic.md`): the three severity sentences word for word; the citation rule for API-reliant findings only; a diff mode kept outside the plan-mode check list: check each open finding against the diff, report fixed ones as `fixed: <n>, ...` (not a numbered line), check that the hunks break nothing they touch, and open `plan.md` only at tasks the hunks change or that cite them.
- **Planner** (`packages/core/agents/planner.md`): the critic's six plan-mode checks word for word, run before replying; an API-reliant fix applied only when the cited place or the owner confirms it.
- **Review** (`packages/core/skills/review/SKILL.md`, `record.md`): a round or final review with only Should findings is fixed and checked by `tests.affected`, or by `tests.full` when that is not configured or finds no test file; no re-review. The reviewer, and the final reviewer rendered from it, gains the three severity sentences.
- **Docs**: `docs/specs/2026-10-12-workflow-layer-design.md` §7 plan loop, severity line and review loop updated to match.
- **Rejected**: Option 2, one shared checklist included at render time — new render code and a change to every agent's marker hash, for nothing the ac-4 test does not already guard. Option 3, WebFetch for critic and planner — ruled out by D-04. Findings kept only in the round commit body or the conversation — the second critique showed it loses an unverified Must after a whole-plan round, and the owner's answer.
- **Risks**: the amendments answer the second critique's two Musts (an unverified fix lost after a Must round; an owner "apply" the planner could not carry out) and its Shoulds, but no critic has read this amended text; the plan critic reads it next. The rendered planner and critic must stay within the 60-line body cap. The Intent's success measure is counted by hand: a whole-plan read is round 1 and every round after one with a Must.
- **Tests**: ac-1 and ac-2 in `packages/core/test/stage-skills.test.ts` over the rendered plan and review skills; ac-3, ac-4 and ac-5 in `packages/core/test/agents.test.ts` over the rendered agents, the ac-4 test asserting it extracted six critic checks before matching them in the planner. Regenerate with `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`, never the npx 0.1.0 CLI.
