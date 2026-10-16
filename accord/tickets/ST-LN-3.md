---
id: "ST-LN-3"                            # equals the file name: tickets/<id>.md
title: "A Claude Code panel shows the /accord dashboard and acts on a ticket"
type: "story" # story | bug. An epic uses its own template
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "M" # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
depends_on: ["ST-LN-2"]
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
approved_hash: "fnv1a64:b1f3dad59571dfbe"
ac_hash: "fnv1a64:a0ef240a1ed8e982"
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->
For whoever works on an accord repository in the Claude Code terminal: a pane beside the transcript shows the /accord dashboard and acts on a ticket without typing a command.
Success: the pane shows what `accord dashboard --json` prints, finds a ticket by id or title, and one press submits Continue, Pick up or a new request to the session.
The pane ranks, gates and decides nothing: the CLI builds the dashboard, the /accord skill carries out the action.
Not in this ticket: Claude Code Desktop, Cursor, Codex, Copilot or the VS Code chat panel; a public marketplace; reading an older CLI's JSON; a timer refresh.

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-3

  @ac-1 @test:packages/core/test/panel.test.ts#ac-1-the-pane-shows-the-dashboard-json-on-open-and-after-each-turn
  Scenario: The pane shows the dashboard as the CLI prints it, on open and after each turn
    Given a repository where `accord dashboard --json` puts ST-1 under yours and ST-2 under ready, with ready.more equal to 3
    When the pane opens
    Then it shows ST-1 in a YOURS section, ST-2 in a READY section followed by "+3 more", and the summary counts as the JSON gives them, counting nothing itself
    And when the dashboard JSON changes and a turn completes, the pane shows the new JSON

  @ac-2 @test:packages/core/test/panel.test.ts#ac-2-search-narrows-the-rows-and-each-button-runs-its-accord-command
  Scenario: Search narrows the rows and each button submits its /accord command
    Given the pane shows ST-1 titled "Login form" under YOURS and ST-2 titled "Export" under READY
    When the owner types "login" in the search box
    Then only ST-1 is shown, as "login" appears in its title ignoring case, and pressing New request starts a turn with "/accord login"
    And with the box empty New request cannot be pressed, Continue on ST-1 starts a turn with "/accord continue ST-1", and Pick up on ST-2 starts a turn with "/accord pick-up ST-2"

  @ac-3 @test:packages/core/test/panel.test.ts#ac-3-a-failing-cli-shows-its-message-instead-of-a-dashboard
  Scenario: A failing CLI shows its message instead of a dashboard
    Given `accord dashboard --json` exits 2 with "set git config user.email" on stderr
    When the pane opens
    Then the pane shows only that message: no section, no search box and no button

  @ac-4 @test:packages/core/test/stage-skills.test.ts#ac-4-the-accord-skill-picks-up-then-continues-a-named-ticket-and-treats-any-other-text-as-a-new-request
  Scenario: The /accord skill acts on a named ticket
    Given ST-2 is a ready ticket, no ticket has the id "the refactor", and an action applies only when the whole text after it is exactly one ticket id
    When the owner enters "/accord pick-up ST-2", then "/accord continue ST-2", then "/accord continue the refactor"
    Then the first picks up ST-2, the second continues the ST-2 it claimed, and the third starts a new request whose text is "continue the refactor", each without showing the dashboard first

  @ac-5 @test:packages/cli/test/skills-sync.test.ts#ac-5-skills-sync-installs-and-enables-the-panel-for-claude-code-only
  Scenario: skills sync installs and enables the panel for Claude Code only
    Given a repository whose config.yml declares runtimes [claude] and another that declares [codex]
    When `accord skills sync` runs in each
    Then the first holds the panel as a Claude Code plugin directory with .claude-plugin/plugin.json, its files carrying the marker "generated by accord skills sync" as the skills do, and its .claude/settings.json enables that plugin
    And the second holds neither the plugin directory nor the setting
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Six parts: a pane showing the dashboard sections from `accord dashboard --json` with no logic of its own; a search box filtering rows by id or title; selecting a ticket and pressing Continue, Pick up or New request submits the /accord command into the session; the /accord skill accepts an action with an id; packaging and install for a team; the pane refreshes after each turn — "Đủ 6 phần (Recommended)"
- D-02 `accord init` and `accord skills sync` write the mod into the repository and enable it in the project settings when `runtimes` holds claude, the same version as the CLI — "ok option 1, nhưng có thể nào support cách cài như custom plugin cho claude code ko?"
- D-03 No public marketplace and no shape-version field in the dashboard JSON; the mod is written by skills sync from the same package as the CLI, and stays a valid Claude Code plugin directory — "đừng lo phiên bản cũ. vì cái này chỉ có mình tôi xài thôi."
- D-04 The panel exists only in Claude Code, an accepted exception to the constraint that skill workflows behave identically in every runtime; it holds no logic or gate and reads only the CLI JSON — "C" (brainstorm, 2026-10-14)
- D-05 A YOURS row has Continue, which submits `/accord continue <id>`; a READY or UP NEXT row has Pick up, which submits `/accord pick-up <id>`; TEAM and EPICS rows have no button; New request submits `/accord` followed by the search box text and is disabled while the box is empty — "Dùng chữ trong ô tìm (Recommended)"
- D-06 The smallest done version is all six parts; the pane reads the dashboard when it opens and after each turn, with no timer — "Đủ 6 phần, refresh khi mở và sau mỗi lượt (Recommended)"
- D-07 Search keeps a row when the box text appears anywhere in its id or title, ignoring case — "Chứa chuỗi, không phân biệt hoa thường (Recommended)"
- D-08 When the CLI fails, its message replaces the whole pane: no search box, no button — "Chỉ hiện thông báo (Recommended)"
- D-09 The pane is for the Claude Code terminal only; Desktop is left out, since the mods API documents running a command as CLI only and nothing here proves Desktop — "Thu hẹp về terminal (Recommended)"
- D-10 ac-4 is one sequence: pick-up claims ST-2 before continue continues it; `continue` on a ticket nobody has claimed says so and offers Pick up, and never claims it — "Sửa câu chữ thành chuỗi (Recommended)"
- D-11 Each section draws as a table: a dim header row `ID  STAGE  TITLE`, then one line per ticket with a bold id, its stage, its title cut to the width left, and its button; a dim second line under a row, only when it has one, holds `blocked by <ids>` (red) and, outside YOURS, who holds it; a blank line before each section heading. The cut applies to the table only; the full title belongs to a ticket detail view, which is ST-LN-6 — "Bảng gọn + dòng phụ (Recommended)", "ko áp dụng cho bảng. khi xem details thì phải details chứ"
- D-12 Colour by stage: section headings bold cyan; the stage cell intent blue, plan cyan, build yellow, review magenta, verify and ready green, any other stage uncoloured; blocked-by red; header row, who, `none`, `+N more` and the summary line dim — "Màu theo stage (Recommended)"

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->
- 2026-10-15, on the proposed `schema` field and the public marketplace: "đừng lo phiên bản cũ. vì cái này chỉ có mình tôi xài thôi."
- 2026-10-16, at verify, on the real pane: "tôi thấy có vài chỗ chưa ổn. nhất là bố cục, format của panel, khá khó đọc. nên thêm chút màu sắc để phân biệt. chia column dạng table cho dễ nhìn dc ko? brainstorm chỗ này đi"

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
**Chosen:** a pure view module plus a thin mod, both plain ESM in `packages/core/panel/`, embedded by a new gen script and written by a new core `pluginTargets` (claude in `runtimes` only) as a directory marketplace `.claude/accord-panel/` holding the plugin `accord-panel`; one settings plan over one parse of `.claude/settings.json` merges the existing hooks and `extraKnownMarketplaces.accord` plus `enabledPlugins["accord-panel@accord"]`, in skills sync and both init paths. Render splices the package spec `@accord-dev/accord@` plus the package's own version into the mod, which the pin check makes equal to the pin, so the pane reads nothing but the CLI output (D-04). `view.js` turns the CLI result and the trimmed search text into sections, keyed buttons and `$.command.run` args, or a message (stderr without npm's own lines; "accord exited N" when empty; "Loading…" before the first result). `register.js` opens the pane at an interactive session start (the host places it), registers `/accord-panel` to reopen and refresh it, runs the CLI only while the pane is open and never for a subagent's turn, one run in flight, and a press calls `$.command.run({ command: "accord", args })`. The /accord skill gains `continue <id>` and `pick-up <id>`, ids only, anything else a New request. Verified by running on 2026-10-15: a plugin declared only in a trusted repository's settings loads, and `$.command.run` runs a skill as a slash command.
**Rejected:** `$.prompt.submit` (Claude reads the text; `command.run` is deterministic); reading the pin from config.yml (breaks D-04); the view module tested alone (the refresh and the press would have no @test); `claude plugin test` in CI (installs Claude Code in CI, and gate done reads only the JUnit report); a public marketplace and a JSON shape version (D-03).
**Affected:** packages/core/panel/ (new), packages/core/scripts/ (new gen script; root `gen`), core skills/render.ts (marker in `//` and JSON `description` forms), a new core plugin-targets module and a settings merge beside scaffold/hooks.ts, core index.ts exports, cli commands/skills.ts (targets, link check, settings plan, refusal text, orphans naming the two keys) and init.ts, packages/core/skills/accord/SKILL.md, and in this repository the generated `.claude/accord-panel/` and `.claude/settings.json`.
**Risks:** (1) the pane drawing, typing and a press are proved only on a fake host; the real pane is checked by the owner at verify, with `claude plugin validate --strict`; (2) a worktree loads the plugin from the main checkout (Claude Code resolves a relative marketplace path there): a main checkout older than the panel gives no pane, one with another pin shows the pin message; (3) other repositories get a working pane only after a release with `dashboard` (npm 0.1.0 has none); (4) search sees only the rows the dashboard returns (READY 20, TEAM 10); (5) the search box follows the documented rule that a drawn Input holds its `value` until the next draw, so every draw passes the stored text; how the real host handles fast typing is checked by the owner at verify; (6) an existing `extraKnownMarketplaces.accord` with another source is refused by hand, never overwritten.
**Tests:** vitest throughout, so gate done finds each @test: ac-1..ac-3 drive the real `register.js` through a fake `$` whose events and element props follow claude-code.d.ts and which redraws only on `invalidate`; ac-4 is a text test on the rendered /accord skill, as stage-skills does, since no model runs in a test; ac-5 is a skills-sync test on the written files, the spliced package spec and the merged settings, for runtimes [claude] and [codex].

**Change note (2026-10-16, at verify):** the owner saw the real pane and found it hard to read (Corrections, 2026-10-16): each row was one run-on string that wrapped, the title pushed the stage onto the next line, YOURS repeated the owner's own email, and sections ran together uncoloured. D-11 and D-12 settle the table and colours. Tasks 1 to 7 and both review fixes still hold. Only `view.js` (cells with their style, given the pane width `e.props.bodyColumns`) and `register.js` (a `Box` row of fixed-width cells, `Text` `color`, `bold`, `dimColor`, `wrap: "truncate"` for the title) change, with the generated copies; search, buttons, the failure message and refresh stay. A `risk:` test on the fake host checks column widths, stage colours, the red blocked-by line and the truncated title; ac-1 to ac-5 keep their wording. No emoji in cells, since a two-cell glyph shifts the columns.
