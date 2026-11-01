---
id: "ST-LN-80"                            # equals the file name: tickets/<id>.md
title: "One approach-and-plan stage replaces the architect, with one critique loop that also checks every Decision and one owner approval"
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
- Why: the architect repeats what the planner does (the owner picked another option than its first in 0 of 38 tickets), while the approach critic catches direction errors cheaply on ~15 lines, and plan critique misses broken Decisions. Evidence: accord/research/2026-11-01-architect-fold-review.md.
- For: whoever runs a lane M ticket, one person or a team where the BA approves direction before a developer plans.
- What: drop accord-architect; the planner drafts `## Approach` in a direction pass; the approach critic stays, defers implementation detail to the plan, re-reads only amended text, and stops at a cap the CLI counts; plan critique checks every Decision and Correction.
- Success: no lane M stage dispatches accord-architect; `accord round <id> --approach` gives the approach critique the same cap and stop as plan critique; ST-LN-46 later measures tokens and plan rounds before and after (not part of done).
- Non-goals: no change to when the owner approves, to gate ready, gate plan, stage order or `approved_hash`; no model change for any agent; lane S untouched; ST-LN-81's scout report is not used.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-80

  @ac-1
  Scenario: No agent named accord-architect is rendered or dispatched, and an old config still loads
    Given a repository whose accord/config.yml sets models.architect and whose .claude/agents holds an accord-architect.md that accord rendered
    When the owner runs accord skills sync and then accord lint
    Then no agent file named accord-architect.md is rendered and no skill step dispatches accord-architect, the old accord-architect.md is gone, and lint accepts models.architect with a warning that it no longer has an effect

  @ac-2
  Scenario: The planner's direction pass returns an Approach draft and writes no file
    Given a lane M ticket whose intent the owner approved and which has no ## Approach yet
    When accord-approach dispatches the planner in its direction mode
    Then the planner returns in its report an impact list naming file and line, two or three options with the lightest that works first, and, when the ticket touches auth, money, migration or data deletion, three failure scenarios in total with how to undo each; it writes neither plan.md nor the ticket, and the main session writes ## Approach from the report

  @ac-3
  Scenario: Approach critique defers detail to the plan and re-reads only what changed
    Given an approach critique round that raised a finding on implementation detail the planner decides, and an Approach amended after that round
    When the critic runs the next round in approach mode
    Then the detail finding is marked defer to plan and is never a Must, the critic is given only the diff of ## Approach since the previous round and approach-review.md, it raises new findings only on the changed lines, and it lists earlier findings the change fixes on a fixed: line and those that no longer hold on a withdrawn: line, as diff mode does for plan-review.md

  @ac-4
  Scenario: The CLI counts approach critique rounds and stops them at the cap
    Given accord/tickets/<id>/approach-review.md records approach critique rounds
    When the owner runs accord round <id> --approach
    Then it prints the next round and the same cap that accord round <id> --plan uses, and it applies the same stop rule --plan applies to plan-review.md, printing stop: report to owner at the stop or the cap

  @ac-5
  Scenario: Plan critique checks every Decision and Correction
    Given a ticket with Decisions and Corrections and a plan.md whose tasks contradict one Decision
    When the critic runs in plan mode on the whole plan, and in diff mode on a hunk that adds the contradiction
    Then each mode reports a Must naming that Decision's D-nn, because the plan-mode and diff-mode instructions of the critic tell it to check every Decision and every Correction of the ticket
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Drop the accord-architect agent; the planner drafts `## Approach` in a short direction pass; a capped approach-mode critic still critiques that draft on every lane M ticket; the owner approves before the full plan, as today, with no change to gate ready, gate plan, stage order or `approved_hash`; plan critique additionally checks every Decision and Correction — "option A đi." (translated: "go with option A", choosing that option over routing the critic to risky tickets only, or dropping it and approving once after critique)
- D-02 ST-LN-71 folds into this ticket and is dropped: in approach critique a finding on implementation detail is deferred to the plan and is never a Must; from round 2 the critic reads only the amended text and lists `fixed:` and `withdrawn:`; approach critique takes the same round cap and stop as review — "A" (choosing to fold all of ST-LN-71 in, over keeping it as the next ticket or folding only the cap)
- D-03 The planner writes the impact analysis itself in its direction pass; this ticket does not wait on ST-LN-81 — "A" (choosing the planner over the saved scout report of ST-LN-81)
- D-04 The CLI enforces the approach critique's round cap: each round is recorded in a new `accord/tickets/<id>/approach-review.md`, and `accord round <id> --approach` counts it as `--plan` counts plan-review.md, a new public CLI flag — "A" (choosing CLI enforcement over a cap stated only in the skill)
- D-05 The smallest version that counts as done is all five criteria — "A" (choosing all five over only ac-1, ac-2 and ac-5)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
- Chosen: reuse the plan-critique machinery. `approach-review.md` takes the plan-review.md format and `## Closed` cycles; `accord round <id> --approach` reuses the plan stop rule and ROUND_CAP, with its own `approach critique` allowance and its own stop and refusal text, so an owner's extra plan rounds never extend the approach loop. `--approach` with `--plan`, or on lane S, exits 2. No gate reads the record (D-01 keeps gate ready and gate plan as they are).
- Agents: architect.md goes and its rules move into a planner `direction` mode that returns the draft and writes no file. The critic's approach mode marks implementation detail `defer to plan` and always rates it Nice, so it never stops the loop. From round 2, even after a Must, it gets the ticket path, the `## Approach` diff since the previous round and approach-review.md, and lists `fixed:` and `withdrawn:`. Plan mode and diff mode gain a check of every Decision and every Correction, in lens `criteria`, and the planner self-checks the same.
- Approach skill: step 2 dispatches the planner in direction mode. Before round 1 the main session writes into `## Approach` only the chosen option's name, what it does and the impact list, so the critic never sees the reasons or the rejected options. After critique it adds the rejected options, the risks and the test strategy. Choosing another option, or the owner's no, appends `## Closed` to approach-review.md before the next round.
- Removal: `skills sync` and `accord upgrade` both remove a listed retired file, `.claude/agents/accord-architect.md`, only when its marker hash is intact, never through a link (the orphan scan's link check). Sync reports it as a new `removed` state. A removed retired path is exempt from the scope gates like a synced copy, so the deletion never fails a ticket branch. An edited copy stays and is reported as an orphan. README, sync's messages and the "deletes nothing" test are reworded for this one exception to D-113 ("sync never deletes").
- Config: `models.architect` still validates; a lint warning in both profiles says it has no effect and that `models.planner` now applies.
- Rejected: a read-only second render of the planner for the direction pass — ac-2 says the planner, and a new agent name would need the owner. A gate rule for the approach cap — D-01 and the Non-goals keep gate ready unchanged.
- Affected: core agents (architect, planner, critic), skills approach (+ new critique.md) and plan/critique.md, round/next.ts, load/snapshot.ts, model/snapshot.ts, skills/agents.ts, config schema, lint, cli round, skills and upgrade commands, scope exemption, docs/design.md, the workflow-layer spec, README; generated agents and skills are regenerated. This repository's own `.claude` renders follow the pin and are not touched.
- Risks, Should findings first:
  - The approach cap holds only when the session runs `accord round <id> --approach`. No gate, approve or lint reads approach-review.md, so a skipped call or a sixth round goes unrecorded (critic 6, kept by D-01).
  - The direction pass runs at the planner's opus/medium where the architect ran opus/high: a drop in effort for this work, though no agent's model changes (critic 7).
  - The planner body nears the 60-line agent cap, with about 6 lines spare.
  - Removal failure scenarios and how each is undone:
    - The deletion lands on an unrelated branch: guarded by the removal in upgrade and the scope exemption; undo with `git restore --source=<base> .claude/agents/accord-architect.md`.
    - The deletion follows a link into another repository: guarded by the link check; undo by re-running that repository's pinned `skills sync`.
    - A silent deletion: guarded by the `removed` report line; undo with `git checkout -- .claude/agents/accord-architect.md`.
- Tests: ac-1 and ac-4 at the CLI in a temp repository (sync then lint; `round --approach` against approach-review.md fixtures). ac-2, ac-3 and ac-5 on the rendered agent and skill text, the layer that observes an instruction to an agent.
