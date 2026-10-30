---
id: "ST-LN-13"                            # equals the file name: tickets/<id>.md
title: "Research behind a ticket is kept in the repository with its sources, and an agent researches outside libraries before the approach"
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
Knowledge made before or beside a ticket (a discussion, a measure, a study) lives in one session or in free text that stages skip: in ST-LN-60's interview the main session and the scout both missed a record its Intent named.
Research is recorded in `accord/research/<date>-<topic>.md` with its date and the commit it was made at; a ticket names its records under a `research:` key; lint refuses a missing or undated record; `accord anchor` prints the list; the scout, architect, critic and planner read the records.
For everyone who works a ticket, on any machine or runtime. Success: a ticket's research reaches every deciding agent from the key alone, and evidence an intent interview replaces is moved into a record, never deleted.
Not here: the researcher agent (its own ticket, D-01) and any change to how many scouts run or how their questions are split (D-02). Research is evidence, never a contract: the executor, reviewers and verifier do not read it.
- Research: `accord/research/2026-10-30-research-records.md`, `accord/research/2026-10-30-scout-coverage.md` (evidence, not a contract).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-13

  @ac-1
  Scenario Outline: lint refuses a ticket whose research reference is not a dated record
    Given a ticket whose frontmatter key `research:` lists the repository path <reference>
    When the owner runs `accord lint`
    Then lint reports an error that names the ticket and that path
    And `accord gate ready` on that ticket fails

    Examples:
      | reference                                                                                          |
      | of a file under `accord/research/` that does not exist                                             |
      | of a record under `accord/research/` whose first five lines hold no `Date: <YYYY-MM-DD>`            |
      | of a record under `accord/research/` whose first five lines hold no `Repository at <sha>`   |
      | outside `accord/research/`                                                                         |

  @ac-2
  Scenario: a ticket that names dated records passes lint and its anchor lists them
    Given a ticket whose `research:` key lists two records under `accord/research/`, each with `Date: <YYYY-MM-DD>` and `Repository at <sha>` in its first five lines
    When the owner runs `accord lint` and then `accord anchor` on that ticket
    Then lint reports no finding about the ticket's research
    And the anchor prints both paths as the key lists them

  @ac-3
  Scenario: the deciding agents read a ticket's research records and the others do not
    Given the agent definitions that `accord skills sync` renders
    When their instructions are read
    Then the scout, architect, critic and planner are told to read every record the ticket's `research:` key lists
    And no other agent's definition holds an instruction to read them

  @ac-4
  Scenario: the intent interview moves evidence it replaces into a record
    Given the intent interview skill that `accord skills sync` renders
    When it rewrites a ticket's queued Intent
    Then it is told first to move every line of evidence it replaces, verbatim, into a new record under `accord/research/` with `Date: <YYYY-MM-DD>` and `Repository at <sha>` in its first five lines
    And to list that record under the ticket's `research:` key

```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 This ticket covers where research is recorded, how a ticket names it, and which stages read it; the `accord-researcher` agent (what it searches, how many run) moves to its own ticket that depends on this one — "ok, as proposed" (2026-10-30)
- D-02 Whether the scout needs more runs or splitting is measured first, from recent session transcripts, into a research record; no scout change before that — "ok, as proposed" (2026-10-30)
- D-03 `accord anchor` prints a ticket's research references; the scout, architect, critic and planner read the records; the executor, reviewers and verifier do not, because research is evidence, not a contract — "A" (2026-10-30)
- D-04 The unclaimed draft tickets that name a research record in free text (ST-LN-10, 43, 55, 56, 59, 69, 70) move to the new key in this ticket; claimed or done tickets (ST-LN-17, 57, 58) are not touched — "A" (2026-10-30)
- D-05 Lint fails a ticket when a research reference names a missing file, or a record whose first lines lack its date and the commit it was made at — "A" (2026-10-30)
- D-06 The smallest done includes the rule that the intent interview moves evidence it replaces in a queued Intent into a research record instead of deleting it — "A" (2026-10-30)
- D-07 The scout's definition gains the instruction to read research records (@ac-3); D-02 rules out only changes to how many scouts run or how their questions are split — "A" (2026-10-30)
- D-08 In every lane, a research record the ticket lists under `research:` counts as one of the ticket's own files: the lane S proposal, the move to lane S and the lane S `gate done` scope check accept it — "A" (2026-10-30)
- D-09 D-08's lane S exemption covers only a listed record the branch adds; a change to a record that already exists on the default branch stays outside a lane S scope — "A" (2026-10-30)
- D-10 D-04's migration of the seven drafts leaves this ticket: it lands as an accord-only backlog pull request after the release that ships the `research:` key and the pin bump, because CI runs `gate done` on every ticket a pull request with code touches — "A" (2026-10-30)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: a lint rule over research text carried in the snapshot, the lightest option that meets every criterion; it follows `lint.depends-unknown`.
- Schema and lint: the key is optional: a ticket without it gets no finding, its anchor no section, and no record is made unless there is research or replaced evidence. The ticket schema accepts a `research` string array (no path pattern, so a bad path is a lint finding that names it). One error rule `lint.research-reference`, on the ticket at `/research/<i>`: outside `accord/research/`, missing, or no `Date:` / `Repository at <sha>` (backticks allowed) in the first five lines. The loader keeps only listed records, normalised.
- Readers: `accord anchor` prints `## Research` when the key is set; one sentence in the scout, architect, critic and planner (read every listed record; it holds at its commit, check claims against code); `intent/research.md`, pointed to from steps 2 and 6 and from the lane S move, has the main session read the records first and move replaced evidence into a committed, listed record.
- Other refs: `loadRefInput` (drop, upgrade) and the claim view read listed records; `accord drop` carries a record the default branch lacks and refuses on a same-named different one. A listed record the branch adds counts as the ticket's own file in the lane S proposal, the lane S move, the lane S scope and lane M undeclared files (D-08, D-09).
- Rejected: a typed research index in the snapshot (no criterion reads it); `accord new research` (new write path; lint already catches a bad header); migrating the drafts here (CI gates them in a code PR, D-10).
- Affected: packages/core schema, model, load, lint, anchor, gate/scope.ts, gate/work.ts; packages/cli load/fs.ts, commands/drop.ts; four agent sources, intent SKILL.md plus research.md, accord/ids.md; generated and synced copies; docs/specs/2026-10-12-workflow-layer-design.md.
- Risks (critic, three rounds; all Must findings fixed as Rulings): `drop` is a data-deletion path and now writes records. A CLI built before this merge, or the global 0.3.0, reads any ticket using the key as having no frontmatter until rebuild or release. Agents render for Claude Code only, so other runtimes get the list in the anchor alone. ac-3 and ac-4 test rendered text, not what an agent does at run time.
- Tests: ac-1 and ac-2 lint and gate in core over a fixture snapshot, ac-2's anchor in the anchor test; ac-3 over every rendered agent target; ac-4 over the rendered intent skill. Risk tests: drop carry and refuse, `loadRefInput`, claim view, lane S scope.
