---
id: "ST-LN-38"                            # equals the file name: tickets/<id>.md
title: "A reviewer running another vendor's model reviews the work, with a fallback when it cannot run"
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
Queued 2026-10-22, not approved; the intent interview replaces this:
- Audit item 5: "Thêm một reviewer dùng model của hãng khác (GPT/Gemini), có model dự phòng. Bạn đã thấy Copilot GPT bắt được bug mà Claude bỏ sót." Owner, 2026-10-22, to the proposal in chat: "ok queue hết di".
- Within "No API keys": the main session runs a CLI the member is already signed into on a subscription (for example `codex exec`, `copilot -p`, `gemini -p`); the accord CLI itself never calls a model.
- Proposal to confirm at intent: `config.yml` lists external reviewers in order; review uses the first that runs, with the same ticket, package, ledger and lens as `accord-reviewer`, and its findings go through the same classify step; when none runs, `review.md` records "external review not run: <reason>", never silently.
- Research first (ST-LN-13's researcher, if it has landed): each CLI's non-interactive mode, passing files, output shape, sandbox and network (Codex), exit codes, time; and whether requesting GitHub's Copilot review on the pull request is lighter, given ticket pull requests open only at verify (`ci.md` Start step 4), so its findings would arrive after verify.
- To settle at intent: which rounds it runs in (every round, or the final review only), and its cost and time.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-38

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
