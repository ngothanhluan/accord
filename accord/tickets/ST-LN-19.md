---
id: "ST-LN-19"                            # equals the file name: tickets/<id>.md
title: "The owner approves a compact view of the ticket that drops no fact"
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
approved_hash: "fnv1a64:2e923ae8f0f4336c"
ac_hash: "fnv1a64:73a26aac1865b09b"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
Why: at the intent and approach yes the owner reads the ticket pasted verbatim (SHOW-1), and the criteria repeat one long Given or When in scenario after scenario, so the owner finds it hard to read (Open questions).
For whom: the owner, at every intent and approach yes.
Success: the owner reads a shorter view that drops no fact, proven by rebuilding every scenario of every real ticket from it (D-02), laid out with headings, bold, and line breaks, and coloured in a terminal (D-08).
Done when: `accord show <id> --approval` prints that view and both the intent and the approach skills show it (D-07).
Not: changing what `accord approve` hashes, the text or JSON of `accord show` without the flag, the verify report, compacting any prose section.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-19

  @ac-1 @test:packages/cli/test/show-approval.test.ts#ac-1-every-scenario-of-every-real-ticket-is-rebuilt-exactly-from-the-approval-view
  Scenario: every scenario of every real ticket can be rebuilt exactly from the view
    Given every ticket file in the repository's accord/tickets folder that holds a gherkin block under Acceptance criteria
    When `accord show <id> --approval` runs for each of them
    Then each scenario rebuilt from the output's criteria part, read with the markup the view adds removed (its `## `, `**`, and `- ` and the id list on each shared line, while backticks inside a step stay), as the shared lines that name it in the order printed followed by the lines printed under its own id, has the same @ac-n tag, the same title, and the same steps with the same keywords, in the same order, as the scenario parsed from the file
    And no scenario rebuilt from the output has a step that the scenario in the file does not have
    And every shared line is a step that comes, in each scenario it names, before that scenario's first Then and after only other shared lines, so it is a Given, a When, or an And or But that continues one

  @ac-2 @test:packages/cli/test/show-approval.test.ts#ac-2-a-step-several-scenarios-repeat-is-printed-once-naming-them
  Scenario: a step that several scenarios repeat is printed once, naming them
    Given a ticket whose four scenarios, ac-1 to ac-4, share the same first Given, and whose ac-1, ac-2, and ac-3 share the same When while ac-4 has a different When
    When `accord show <id> --approval` runs
    Then the shared Given appears exactly once in the output, on one line that also holds the ids ac-1, ac-2, ac-3, and ac-4
    And the shared When appears exactly once, on one line that also holds the ids ac-1, ac-2, and ac-3 and not ac-4
    And each scenario's title, and every step from its first Then to its last step, appear in full, word for word, under that scenario's id, read with the markup the view adds removed as in @ac-1

  @ac-3 @test:packages/cli/test/show-approval.test.ts#ac-3-the-approval-view-prints-the-six-approved-sections-and-nothing-else
  Scenario: the view prints the six approved sections and nothing else
    Given a lane M ticket with an Intent, criteria, Vetoes, and Decisions, and with Corrections and Approach sections that hold no line other than a template comment
    When `accord show <id> --approval` runs
    Then it prints the headings "## Intent", "## Acceptance criteria", "## Vetoes", "## Decisions", "## Corrections", and "## Approach", in that order, each as a line of its own, with that section under it
    And every non-comment line of the Intent, Vetoes, Decisions, Corrections, and Approach sections in the file appears in full, word for word and in order, under its heading, and the empty Corrections and Approach each read `none`
    And the output holds no line that begins, after any spaces, with one of the labels `Stage:`, `Lane:`, `Tasks:`, `Branch:`, `Holder:`, `Blocked by:`, `State:`, `Test:`, `Test result:`, `Ticked:`, or `Verification:` that `accord show <id>` prints, and no scenario's `@test:` tag
    And `accord show <id>` and `accord show <id> --json` still pass every test written for them before this ticket, unchanged

  @ac-4
  Scenario: the intent and approach skills show the view at the owner's yes
    Given the files `accord skills sync` writes for a config that enables every runtime, in every target directory, each read with every line break and the spaces or tabs around it as one space
    When a reader opens the SKILL.md of the intent skill and of the approach skill
    Then the numbered list item that begins "**The owner's yes", up to the next numbered list item or the next heading, whichever comes first, holds the literal texts `accord show <id> --approval`, "unchanged", and "not inside a code block"
    And the same step holds the literal texts "horizontal rule", "In plain words", and "one line per scenario that begins with its ac-n"
    And the same step does not hold the text "from the ticket file" in any letter case

  @ac-5
  Scenario: the view is laid out for a person to read, and coloured in a terminal
    Given the ticket of @ac-2
    When `accord show <id> --approval` runs with colour off, because NO_COLOR is set or the output is not a terminal
    Then each scenario begins with a bold line that holds its ac-n and its title, each step, shared or not, sits on its own Markdown list line, and a blank line separates one scenario from the next
    And each line of the Intent, Vetoes, Decisions, Corrections, and Approach sections that is not a Markdown list line is followed by a blank line, so that a Markdown reader shows it on a line of its own
    And the output holds no terminal colour codes
    And when it runs with colour on, because FORCE_COLOR is set to 1, the section headings, every ac-n id in the criteria part, and the step keywords Given, When, Then, And, and But are coloured, and the output with its colour codes removed equals the output with colour off
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->
(none)

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 The request has four parts: the CLI prints a deterministic compact view (a Given or When shared by scenarios printed once, each scenario keeping its title and its Then/And lines verbatim); the agent adds one plain-language line under each scenario; the full file stays what `accord approve` hashes; the intent and approach skills show that view instead of the raw file — "A"
- D-02 "Drops no fact" means each scenario can be rebuilt exactly from the view: title, `@ac-n` tag, every step in order, and which scenarios each shared line belongs to (each shared line names them, e.g. "(ac-1, ac-2, ac-3)"); the test runs over every real ticket in the repository, not only fixtures — "A"
- D-03 Only the acceptance criteria are compacted; Intent, Vetoes, Decisions, Corrections, and Approach are printed verbatim by the same command, so the agent copies the CLI output and retypes no section — "A"
- D-04 The view is `accord show <id> --approval`: Intent verbatim, criteria compacted, then Vetoes, Decisions, Corrections, and Approach verbatim, with no stage or test fields; `accord show <id>` without the flag and `--json` stay as they are — "A"
- D-05 `--approval` always prints all six sections, at the intent yes and the approach yes alike; an empty section prints "none" — "A"
- D-06 The skills paste the `--approval` output unchanged inside one code block; the agent's plain-language lines come after the block, one per scenario, each opening with its `ac-n` and a label that marks it as the agent's explanation (the owner's example: "Giải thích:") — "A"
- D-07 The smallest version that counts as done is the whole of it: the `--approval` flag, both the intent and the approach skills switched to it, and the D-02 rebuild test over every real ticket — "A"
- D-08 D-06 replaced after the intent yes (Corrections, 2026-10-18): `--approval` prints Markdown (a heading per section, each scenario under a bold line with its id and title, each step on its own list line, the shared steps once with their ids) and colours headings, ids, and step keywords when the output is a terminal that allows colour; the skills paste that output as Markdown, not in a code block, and the agent's lines follow a horizontal rule under a heading "In plain words" — "A"
- D-09 The view prints every title, step, and prose line exactly as the file holds it, with no escape and no added backtick; text that a Markdown reader could hide, such as `<id>` outside backticks, is accepted as a risk, since Claude Code is where the owner reads — "A"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-18, at the intent yes, after approving the Intent and the four criteria: "A đồng ý. nhưng khi print ra cho user đọc. hơi khó đọc. cần format lại cho dễ đọc. break line, bolding, header, color cho human đọc mà"
- 2026-10-18, at the second intent yes: "sao intent ko break line ra? ví dụ Success, Done, cần skill copy-writing ko vậy?"

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->
- [x] Raised at the ST-LN-5 intent yes (2026-10-18). After approving the verbatim Intent and criteria the owner said: "ok A. nhưng tôi thấy đưa hết nguyên file lên thế này rất khó đọc cho user. có cách nào tóm tắt mà vẫn ko thiếu dữ kiện ko? vẫn đầy đủ ý chính ấy". SHOW-1 made the intent and approach yes show the ticket verbatim, never summarised, because a summary the orchestrator writes can drop or soften a clause while `accord approve` hashes the file; SHOW-1 D-07 widened the approach yes to every approved section. Most of the bulk is repetition: in ST-LN-5 all four scenarios repeat one long Given and three repeat one When. Proposal to confirm at intent: `accord show` prints a deterministic compact view (a Given or When shared by the scenarios printed once, each scenario reduced to its title and its Then/And lines, verbatim), the agent adds one plain-language line under each scenario, the full file stays what `accord approve` hashes, and the intent and approach skills show that view instead of the raw file. Owner, on making this its own ticket rather than part of ST-LN-5: "A".

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: dialect-aware split, refined by the critic. A new pure core `approvalView(ticket)` (packages/core/src/status/approval.ts, exported) builds the Markdown; the CLI adds `accord show <id> --approval` and colours it; both skills switch to it. Lightest option that keeps D-01 true for every Gherkin language the loader accepts.

- View: six `## ` headings in the order and names `accord approve` hashes (APPROVED_SECTIONS); empty prints `none`; prose lines verbatim with a blank line after each non-list line; criteria open with the shared lines `- <step> (ac-1, ac-2)` and a blank line, then per scenario `**ac-n title**`, its own `- ` steps, a blank line. Nothing is escaped (D-09).
- Shared lines: a prefix trie over each scenario's steps before its first Then, exact string match, Background included; a node reached by two or more uniquely tagged scenarios is shared, printed depth-first. The first Then comes from the Gherkin parser's own keyword types, read per fence by a helper in load/gherkin.ts, so a `# language:` fence and several fences work; `*`, And, and But take the type of the step before them.
- CLI: `--approval` conflicts with `--json` (exit 2), reads the checkout snapshot like `accord approve`, needs an existing ticket but no lane (README-1 has criteria, no lane), refuses with exit 1 when the ticket's file has a load finding (a gherkin parse error would show `none` and be approved), splits on line breaks before the existing control-character `clean`, then colours headings, ac-n ids, and step keywords with styleText; colour off is the same text.
- Skills: intent step 9 and approach step 5 run the view, paste it unchanged as Markdown not in a code block, then a horizontal rule, a heading "In plain words", one line per scenario; they drop "copied from the ticket file" and the approach line that shows the criteria verbatim again; if the command fails, stop and tell the owner.

Rejected: English-only "Then " split (breaks D-01 for a `# language:` ticket); a first-Then index on the exported snapshot (changes the hub-facing model and 14 goldens for nothing a criterion needs); backslash escapes (broke ac-1 and D-51, and the owner chose D-09).
Affected: packages/core/src/status/approval.ts, load/gherkin.ts, index.ts; packages/cli/src/run.ts, commands/show.ts, commands/lane-args.ts, render/color.ts; packages/core/skills/intent and approach SKILL.md, src/generated/skills.ts, .claude/skills copies; packages/core/test/stage-skills.test.ts; docs/design.md, docs/specs/2026-10-12-workflow-layer-design.md.
Risks: SHOW-1 ac-1 and ac-2 (the yes shows the file verbatim) become false; their two tests are trimmed to what still holds and ST-LN-19 ac-4 proves the new step. The published 0.1.0 has no `--approval`, so a session running it fails at the yes until release. A `<id>`-like text may be hidden by a Markdown reader (D-09). The approach skill must stay under 5120 bytes. FORCE_COLOR=1 in an agent's shell would paste colour codes.
Tests: ac-1, ac-2, ac-3, ac-5 in packages/cli/test/show-approval.test.ts, in process (ac-1 over every real ticket, non-zero count); ac-4 in packages/core/test/stage-skills.test.ts on the synced files; risk tests for a `# language: vi` fence, `*` steps, a parse error, control characters, a lane-less ticket.
