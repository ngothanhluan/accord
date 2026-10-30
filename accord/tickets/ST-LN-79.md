---
id: "ST-LN-79"                            # equals the file name: tickets/<id>.md
title: "The fixed context every call carries is measured by owner, cost-weighted, for the main session and each accord agent"
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
Why: about 52% of subagent input is fixed context sent with every call (about 47k raw tokens per call over 1,303 runs, accord/research/2026-10-30-harness-architecture.md section 2), and nobody knows whose it is or what it costs; the owner's order is "quality > cost > speed" (translated).
For whom: the owner, and the cut ticket that depends on this one (D-05), which must choose per agent what to cut.
What: `scripts/benchmark.mjs` prints the fixed context per call for the main session and for each accord agent, split by owner (accord, Claude Code, plugins, MCP servers, the owner's CLAUDE.md files and memory, the owner's own skills and agents), raw and cost-weighted, and its share of a lane M ticket's cost; a committed report holds a real run's figures and the cuts the owner could make in their own setup.
Success: the report names, per agent and for the main session, the largest cost-weighted owner, and re-running the script on the same transcripts prints the same figures.
Not here: cutting anything in accord or in the owner's setup (the cut ticket, D-05); shipping the measurement to users; measuring Cursor, Codex or Copilot calls; the plan-critique loop (ST-LN-56, ST-LN-57).

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; `accord task-done` writes it from the plan's `(@ac-n)` marker, not by hand; it is outside the AC hash. -->
```gherkin
Feature: ST-LN-79

  @ac-1
  Scenario: The fixed context of the main session and of each accord agent is split by owner
    Given Claude Code transcripts of a main session and of runs of accord agents
    And the setup on this machine when the report runs: its plugins, MCP servers, CLAUDE.md files, memory and accord install
    When the owner runs the fixed-context report of the benchmark script
    Then it prints one row for the main session and one row for each accord agent that ran, each with the number of calls the transcripts hold for it
    And the fixed context of a row is the part of a call's input that is the same on every call of that row, without the task prompt and without the conversation so far
    And the size of each row's fixed context and of each of its parts is measured on the setup as it is when the report runs, and the transcripts supply only the number of calls and how each call was billed
    And each row splits that fixed context into accord (its agent definitions, rules block, skill listing entries and the pointer block in CLAUDE.md), Claude Code, plugins, MCP servers, the owner's CLAUDE.md files and memory (repository and user level, without accord's pointer block), the owner's own skills, agents and commands (user and project level, not accord's and not a plugin's), and a remainder named unattributed
    And unattributed is the row's fixed context less the named parts, so the parts in a row add up to that row's fixed context

  @ac-2
  Scenario: Every figure is given raw and cost-weighted
    Given the same transcripts and setup
    When the fixed-context report is printed
    Then each figure is given in raw tokens and in cost-weighted tokens, where a fresh input token weighs 1, a cache read 0.1 and a cache write 1.25, and the fixed context, which sits at the front of every call's input, is charged first against that call's cache reads, then its cache writes, then its fresh input, as the transcripts record them
    And for each lane M ticket that reached done and whose claim commit falls inside the transcripts' date range, it gives two shares of that ticket's whole cost, where the ticket's calls are those whose transcript lines record the ticket's branch or worktree and each output token weighs 5: the main session's fixed context, and the subagents' fixed context

  @ac-3
  Scenario: The same transcripts give the same figures
    Given the fixed-context report was printed once
    When the owner prints it again on the same transcripts and the same setup
    Then every figure is the same

  @ac-4
  Scenario: The committed report holds a real run and the cuts the owner could make
    Given the script was run over the owner's own transcripts
    When its report is committed under docs/benchmark
    Then it holds that run's figures with the date range they cover and the number of calls in each row
    And the script also prints, and the report holds, every enabled plugin, every connected MCP server, every CLAUDE.md file and memory file, and every set of the owner's own skills, agents and commands (grouped by name prefix, such as gsd or aws) of the owner's own setup, each with its cost-weighted cost per call in each row it reaches, so the owner can choose what to cut
    And it says that Cursor, Codex and Copilot calls were not measured
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->
- D-01 Scope is three parts: measure the fixed per-call context split by owner (accord, Claude Code, plugins, MCP servers, the repository's CLAUDE.md) and cost-weighted; cut from each accord agent what it never uses without dropping a rule it follows; prove the cut does not change behaviour. The report lists what the owner could cut in their own setup (plugins, MCP servers, this repository's CLAUDE.md), but this ticket changes none of it. — "A" (option A of the scope question, 2026-10-30)
- D-02 The measurement is delivered as an extension of `scripts/benchmark.mjs` (a developer script, not shipped) that prints the fixed per-call context by owner, cost-weighted, plus a committed report with the figures before and after the cut. — "A" (option A of the delivery question, 2026-10-30)
- D-03 A cut is proven by replaying the round 1 benchmark samples for every accord agent it changes, before and after the cut, at the agent's current model and effort, and comparing the runs the judge holds; an agent that holds fewer runs after the cut keeps its old definition. A test also checks that each agent still carries every rule and every tool its body names. — "A" (option A of the proof question, 2026-10-30)
- D-04 Replaces the sample set of D-03: round 1 cannot see a cut make an agent worse (17 of its samples hold by default because the first run found no Must; scout, architect and planner miss already at their current effort; one run per sample), so the cut waits for ST-LN-46's round 2 samples (known or seeded Musts, judged more than once) and is proven on them. — "C" (option C of the question "is this test still accurate?", 2026-10-30)
- D-05 Split: this ticket keeps only the measurement (D-02) and starts now; the cut and its proof (D-03, D-04) move to a new ticket that depends on ST-LN-79 and ST-LN-46, queued in a backlog pull request. — "A" (option A of the split question, 2026-10-30)
- D-06 The measurement covers both the accord subagents and the main session, each split by owner. — "A" (option A of the question "which calls are measured?", 2026-10-30)
- D-07 The report is per agent: for the main session and each accord agent, the fixed context per call by owner, raw and cost-weighted; its share of a lane M ticket's cost; and what the owner could cut in their own setup with its saving; re-running the script gives the table again. The figures after a cut belong to the cut ticket (D-05). — "A" (option A of the question "how detailed is the report?", 2026-10-30)
- D-08 The owner's own skills, agents and commands (user and project level, not accord's and not a plugin's) are a seventh owner in ac-1, and ac-4 lists each set (gsd, aws, …) with its cost per call; a spike showed 115 user-level skills (88 gsd, 20 aws) and 35 user-level agents, which no other owner covers. — "A" (option A of the question "add this owner?", 2026-10-30)

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
Chosen: owner-run probe sessions, leave-one-out per item, with a direct Claude Code baseline and appended-text sizing. `scripts/benchmark.mjs --fixed --probe` writes settings and MCP config files and prints `claude -p` commands (`--settings <file>`, never inline JSON) that the owner runs from a throwaway probe worktree on branch `probe/fixed-context`; each probe dispatches every accord agent with a one-line "reply ok, use no tool" brief, and `--fixed` reads only each run's first call. Sizes come from each row's current model (the agent's frontmatter model; the main session's model at probe time) and every text is sized on that model; transcript calls on an older model of the same row count with the current size, and the report says so. Probes: all on; one probe per enabled plugin with only that plugin set `false` in `enabledPlugins`; an MCP reference with every listable server in `--mcp-config` under `--strict-mcp-config`, then one probe per server with only that server left out, so each server's cost is measured against that reference, and claude.ai connectors plus plugin-provided servers are priced together as all-on less the reference (each connector its own ac-4 line when one probe per connector is possible, else one line for all); one per set of the owner's own skills, agents and commands (by name prefix) moved out of reach; and a Claude Code baseline run from an empty folder outside any repository with no setting sources and `--strict-mcp-config`, with one stub agent passed with `--agents` for each distinct pair of tool list and model the accord agents use, so each row's Claude Code part carries exactly its own tool definitions. Text-backed parts (accord's agent body, the rules block printed by `accord hook subagent-start`, accord's skill and agent listing entries, the pointer block; each CLAUDE.md with the pointer block taken out, and each memory file that loads) are sized by appending the text with `--append-system-prompt-file` to the baseline and reading the input delta, so no characters-per-token ratio is used. A text is charged only to rows it reaches, read from the all-on probe (a row without the Skill tool gets no skill listing; memory charges only the files that load). Unattributed is the all-on total less every named part, so it holds interaction effects such as MCP tool search deferral. Real transcripts supply only call counts, per-call billing and `cwd`/`gitBranch`; probe runs (branch `probe/fixed-context`, marker brief) are excluded from every count and from the existing round tools. Each measured item stores its own fingerprint: the Claude Code version for every item; a text's hash; a plugin's installed version; an MCP server's config entry; a skill set's member names and file hashes; an accord agent's whole file, frontmatter included. A changed text needs its own append probe and the all-on probe again, so the row total moves with it; a changed version, plugin, server or set needs that item's probe and the all-on probe; the script prints exactly those commands instead of a table. The script calls no model.
Rejected: one cumulative ladder of group switches (cannot give each plugin's or server's own cost, which ac-4 needs); the script spawning `claude` per item (breaks the script's no-model-call rule and spawns a `.cmd` shim on Windows); Claude Code's `/context` for the main row (no subagent rows, categories do not match ac-1).
Spike, 2026-10-30, main session `-p`, haiku: all on 54,547 input tokens (14 plugins, 3 MCP servers, 74 agents, 211 skills); every plugin `false` 51,918 (3 built-in plugins stay); plus `--strict-mcp-config` 50,089 with no MCP server left, claude.ai connector included; user settings off instead 37,658, which also removes 115 user-level skills (88 gsd, 20 aws) and 35 user-level agents (D-08); `--bare` refuses a subscription login ("Not logged in"), so it is not used.
Affected: `scripts/benchmark.mjs` (new `--fixed` mode, per-call usage kept, main-session reader, probe file writer and matcher, per-item fingerprints, position weighting, ticket share, own report file), new `packages/core/test/benchmark-fixed.test.ts`, new report under `docs/benchmark/`.
Risks: (Must, kept) a remote claude.ai connector changes its instructions server-side, which no fingerprint sees; the report states the probe date and this limit. (Must, kept) transcripts store stream-start `output_tokens`, so ticket shares use the existing 4-characters-a-token output estimate and say so. (Should) the switches are spiked on the main session only; the plan's first task runs them on one dispatched agent before any code, and how a set of user-level skills is moved out of reach without touching `~/.claude` is settled there. (Should) a probe agent may keep working past its first call; the probe worktree is throwaway and `-p` denies unapproved edits. (Should) `-p` and interactive main sessions may differ, and the probe prompt sits in the main row's first call; the main row is labelled as measured under `-p` and the prompt is sized and taken out. (Should) leave-one-out figures need not add up to a group's effect; unattributed holds the difference. (Nice) accord-panel counts under plugins, named as accord's own. (Nice, for the plan) the baseline's transcript lies outside the repository's transcript folders; a size measured today can exceed an old call's whole input, which position weighting clamps; MCP config files carry server secrets and are written outside the worktree; which texts reach a row comes from the agent's frontmatter and removal probes, not from usage. Probe count is about 2 + plugins + MCP servers + skill sets + texts, each dispatching 10 agents once; the owner runs it again only for what changed.
Tests: ac-1 to ac-3 in `benchmark-fixed.test.ts` on jsonl and probe fixtures (script layer, no model); ac-4 by a test that the committed report holds the date range, per-row call counts, the per-item list and the not-measured line.
