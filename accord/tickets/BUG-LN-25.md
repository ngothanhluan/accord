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
approved_hash: "fnv1a64:24c89796a42dec2b"
ac_hash: "fnv1a64:f2cef17806d9e61c"
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

  @ac-1 @test:packages/cli/test/security-gate.test.ts#ac-1-gate-done-scans-a-hand-edited-accord-panel-copy-on-real-git-(BUG-LN-25)
  Scenario: A hand-edited accord copy is scanned
    Given a repository whose accord copies were written by `accord skills sync`
    When a change adds a line matching a default content pattern to `.claude/accord-panel/plugin/hooks/register.js`
    Then the security triggers of that change name `.claude/accord-panel/plugin/hooks/register.js` and that pattern

  @ac-2 @test:packages/core/test/security.test.ts#ac-2-a-file-accord-does-not-write-in-a-copy-folder-is-scanned-(BUG-LN-25)
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
- D-06 the CLI decides which copies are exempt: it reads the head text of each changed path that `renderedFiles(config)` holds and keeps those equal to the rendered text; core gets the exact exempt paths and the folder-prefix skip goes; the marker hash is never trusted — "A" (owner, 2026-11-19, taking the planner's recommendation at discuss)
- D-07 a copy's text is read at each package's own head (the round's head for gate done, accord round and review-package --round) — "A" (owner, 2026-11-19, taking the planner's recommendation at discuss)
- D-08 all five call sites (gate done, accord round, review-package, review-package --round, diff-package) pass the exempt paths, so the triggers a reviewer sees match the ones gate done enforces — "A" (owner, 2026-11-19, taking the planner's recommendation at discuss)
- D-09 a copy changed by a round made with an older accord is scanned (fail closed), with no fall-back to the marker check — "A" (owner, 2026-11-19, taking the planner's recommendation at discuss)
- D-10 a failure to read the copy texts becomes an error fact, so the gate refuses — "A" (owner, 2026-11-19, taking the planner's recommendation at discuss)
- D-11 a change that deletes a copy that is not on the retired list has its removed lines scanned — "A" (owner, 2026-11-19, taking the planner's recommendation at discuss)
- D-12 `agent-config` can be removed with a `Removed:` line like every default except `security-config` — "A" (owner, 2026-11-19, taking the planner's recommendation at discuss)
- D-13 no new checklist item: the existing `hook-commands` item covers agent configuration — "A" (owner, 2026-11-19, taking the planner's recommendation at discuss)
- D-14 a team pattern already named `agent-config` follows the existing collision rule: a lint problem, and the default still applies — "A" (owner, 2026-11-19, taking the planner's recommendation at discuss)
- D-15 the exemption option on the exported `securityTriggers` and `matchedHunks` is optional, and nothing is exempt when it is absent — "A" (owner, 2026-11-19, taking the planner's recommendation at discuss)
- D-16 the gate path gets the rendered files from the existing `renderedFiles(config)`, passed in by its callers, so there is one definition of what sync writes — "A" (owner, 2026-11-19, taking the planner's recommendation at discuss)
- D-17 "the text it writes" means equal after `normaliseText`, so line endings do not count — "A" (owner, 2026-11-19, taking the planner's recommendation at discuss)
- D-18 ac-1 and ac-3 are proven on real git in `packages/cli/test/security-gate.test.ts`, ac-2 and ac-4 in core; the ac-3 fixture holds a team line pattern that matches the rewritten copies, so the test fails without the exemption — "A" (owner, 2026-11-19, taking the planner's recommendation at discuss)

## Corrections

## Open questions

## Approach
- Chosen: Option 1, the exact-path exempt list read per package with the existing reader — it meets every criterion and Decision with the least new code. Core's `contentSkipped` drops the four-folder prefix list and skips a path only when it is in a new optional `exempt` list on `securityTriggers` and `matchedHunks` (nothing exempt when absent; Markdown, test files and `generated:` stay skipped). One CLI helper beside `factsFor` reads the changed paths that `renderedFiles(config)` holds at that package's own head with `gitFilesAt` and returns those whose text after `normaliseText` equals the render, starting no git process when no rendered path changed; all five call sites pass that list. The template gains `- agent-config: path .claude/settings.json, .mcp.json — agent configuration that can start commands`, then `npm run gen` regenerates `packages/core/src/generated/templates.ts`.
- Rejected: Batched copy read (gate done reads every round's copy texts in one batch) — it saves at most one git process per round, serves no criterion, and its second pass adds a way to read a path at the wrong round's head (D-07).
- Affected, core: `packages/core/src/security/match.ts:175` (`OWN_COPIES` goes), `:214-216`, `:219-223`, `:240`, `:276-278`, `:293`; `packages/core/templates/security.md:7-13`; `packages/core/src/generated/templates.ts` (regenerated); `packages/core/src/index.ts` unchanged.
- Affected, CLI: `packages/cli/src/load/security-facts.ts:67-89` and `:97-103`; `packages/cli/src/commands/gate.ts:67`; `packages/cli/src/commands/round.ts:42`; `packages/cli/src/commands/review-package.ts:27-46` with callers `:80`, `:237`, `:240`; `packages/cli/src/commands/diff-package.ts:57`; `packages/cli/src/commands/branch-fact.ts:10-12` and `packages/cli/src/load/fs.ts:1548-1557` reused unchanged.
- Affected, tests: `packages/core/test/security.test.ts:188-198` (the skip assertion is the bug), `:8`, `:55`, `:258-259`, `:301`; `packages/cli/test/security-gate.test.ts` (new tests, and `withSecurityFacts` calls at `:153`, `:160`); `packages/core/test/templates.test.ts:130-136` (drift guard).
- Risks: no Must or Should finding is open (critic round 1: two Nices, deferred to the plan). A ticket in flight whose earlier round changed a copy with an older accord, or touched `.claude/settings.json`, now needs a security review at gate done (intended, D-02, D-09). One extra `cat-file` per package that touches a rendered copy.
- Tests: ac-1 (hand-edited `register.js` raises a trigger) and ac-3 (copies freshly written by sync raise none; the fixture holds a team line pattern that matches the rewritten copy, so the test fails without the exemption) on real git in `packages/cli/test/security-gate.test.ts`; ac-2 (a new `.claude/skills/accord/helper.js` is scanned) and ac-4 (`agent-config` from a team `security.md` without it, on add, edit and delete of `.claude/settings.json` and `sub/.mcp.json`, and not `sub/.claude/settings.json`) in `packages/core/test/security.test.ts`.
- Tasks: 1, the failing ac-1 reproduction plus the core option and prefix removal (ac-2); 2, the CLI helper and the five call sites (ac-3); 3, the template line and regeneration (ac-4).
