---
id: "BUG-LN-25"                            # equals the file name: tickets/<id>.md
title: "Security gate scans agent-loaded files that are not unmodified accord copies"
type: "bug" # story | bug. An epic uses its own template
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
related:
  - "ST-LN-36"
ruleset: "0.8.0"
---

## Intent
Why: the security gate skips its content patterns for every file under `.claude/skills/`, `.agents/skills/`, `.claude/agents/` and `.claude/accord-panel/`, so code added or hand-edited there, code an agent loads and runs, reaches done with "no pattern matched" (Phase 5 review CR-01); and agent configuration that can start commands, `.claude/settings.json` and `.mcp.json`, has no default pattern (WR-02).
For whom: every team that relies on accord's security gate, whoever the author of the change is.
Success: a file in those folders is scanned like any other file unless it is exactly a copy `accord skills sync` writes with the text it writes; unmodified copies stay silent; any change to `.claude/settings.json` or `.mcp.json` calls the security reviewer.
Non-goals: configuration files of other runtimes (`.cursor/`, `.vscode/`); leaving out accord's own hook edits in `.claude/settings.json`; the other Phase 5 review findings (WR-01, WR-03, WR-04, IN-01, IN-02 stay in backlog 999.21).
Expected size: 3 tasks

## Acceptance criteria
```gherkin
Feature: BUG-LN-25

  @ac-1
  Scenario: A hand-edited accord copy is scanned
    Given a repository whose accord copies were written by `accord skills sync`
    When a change adds a line matching a default content pattern to `.claude/accord-panel/plugin/hooks/register.js`
    Then the security triggers of that change name `.claude/accord-panel/plugin/hooks/register.js` and that pattern

  @ac-2
  Scenario: A file accord does not write in a copy folder is scanned
    Given a repository whose accord copies were written by `accord skills sync`
    When a change adds a new file `.claude/skills/accord/helper.js` holding a line that matches a default content pattern
    Then the security triggers of that change name `.claude/skills/accord/helper.js` and that pattern

  @ac-3
  Scenario: Copies freshly written by skills sync raise no trigger
    Given a repository whose accord copies are older than the running accord's
    When a change holds only the files `accord skills sync` rewrote under `.claude/skills/`, `.agents/skills/`, `.claude/agents/` and `.claude/accord-panel/`, with the text it wrote
    Then the security facts of `accord gate done` for that change list no trigger

  @ac-4
  Scenario: A change to agent configuration calls the security reviewer
    Given a repository with its own `accord/product/security.md` that does not mention agent configuration
    When a change adds, edits or deletes `.claude/settings.json` at the repository root, or a `.mcp.json` at any depth
    Then the security triggers of that change name that path under the default pattern `agent-config`
```

## Vetoes

## Decisions
- D-01 The ticket holds three parts: scan the copy folders except unmodified accord copies at the exact paths `accord skills sync` writes; a default path pattern for `.claude/settings.json` and `.mcp.json`; no trigger from copies `skills sync` just wrote — "A" (owner, 2026-11-19, choosing this against adding other runtimes' config files and against dropping a part)
- D-02 Every change to `.claude/settings.json` or `.mcp.json` is a trigger, accord's own hook edits included — "A" (owner, 2026-11-19, choosing this against leaving out the hook entries accord writes)
- D-03 There is no smaller version: all three parts are done in this ticket — "A" (owner, 2026-11-19, choosing this against deferring the agent-config pattern to the backlog)
- D-04 The plan is expected to take 3 tasks, one per part — "A" (owner, 2026-11-19, choosing this against 2 tasks)
- D-05 The criteria read as follows after the audit: ac-3's "no trigger" covers the copies under the four copy folders only, and a sync edit to `.claude/settings.json` still raises `agent-config` as D-02 says; ac-4's pattern fires on adding, editing or deleting the file, matches `.claude/settings.json` at the repository root only and `.mcp.json` at any depth — "A" (owner, 2026-11-19, to these readings)

## Corrections

## Open questions

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
