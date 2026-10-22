---
id: "ST-LN-36"                            # equals the file name: tickets/<id>.md
title: "A security reviewer runs whenever the change touches a risky path, and checks it against a written list"
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
- Owner asked, 2026-10-22: "security agent đã ổn chưa? và điều kiện để trigger security agent đã ok chưa?". Owner, 2026-10-22, to the proposal in chat: "ok queue hết di".
- Today lens `security` is one line, with no checklist (`.claude/agents/accord-reviewer.md`, `accord-final-reviewer.md:28`): "the auth, money, migration, and data deletion paths the diff touches".
- The trigger (accord-review step 3, accord-plan `critique.md:28`) is the main session's own reading of "auth, money, migration, or data deletion"; nothing records that it was weighed. Accord's own riskiest code (spawning git, writing hook settings, path checks such as `assertNoLink`, `.github/workflows/`) triggers neither. The lane rule in `/accord` lists "auth, money, or data deletion" without migration.
- Proposal to confirm at intent: `accord review-package` prints `## Security triggers`, the changed files and lines matching patterns with defaults overridable in `config.yml` (process spawn, file writes, paths built from input, workflow files, dependency manifests, auth and secret names); a non-empty section makes the security reviewer, and the plan's security critic, mandatory. The lens gets a checklist: injection, path traversal and links, secrets, untrusted input, CI permissions, new dependencies, hook commands, authorisation. The lane rule gets migration.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-36

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
