# Plan review: ST-LN-79

Round record: 1

## Round 1 (whole)

1. Must — Tasks 4 and 5 size the CLAUDE.md and pointer texts by reading the path the all-on probe's `instructions` attachment names, which is the probe worktree's copy (`C:/Work/accord-probe/CLAUDE.md`) or the main checkout's, never the repository file it stands for; a committed edit to the repository's CLAUDE.md is never marked stale, the report prints the old size and labels doc lines with the throwaway worktree's path, and Task 5's test passes only because its world names `<repo>/CLAUDE.md`; likewise `--fixed` has no dirty-tree refusal, so an uncommitted agent edit is sized from the working copy while the reprinted all-on probe checks out HEAD (criteria 1, build 8) — fixed
2. Should — no fingerprint covers which instruction files load: a `text:` probe exists only for a path the all-on transcript listed, so a `~/.claude/CLAUDE.md` or nested `CLAUDE.md` created after probing makes nothing stale, `--fixed` exits 0, and the file is in no row and no item line, missing ac-4's "every CLAUDE.md file and memory file" (criteria 2) — fixed
3. Should — claude.ai connectors and plugin-provided servers get one combined line that names none of them, and no task checks whether one probe per connector is possible as the approach asks; the committed report's line does not name "claude.ai Claude Docs", missing ac-4's "every connected MCP server … each with its cost"; add a spike step in Task 1 for one connector and list the connector names on the line (criteria 3) — fixed
4. Should — Task 9's `ticketShares` counts only accord-agent calls toward "subagent fixed context" while other subagents (Explore, general-purpose) raise only the denominator, and neither the table nor a note says so; the cut ticket reads an understated share; at least label the column and note it is accord agents only (criteria 4) — fixed
5. Should — no test checks the "every" in ac-4: a `render` that skips an enabled plugin whose leave-one-out difference is 0 in every row (a hooks-only plugin) passes the Task 7, 9 and 10 tests; Task 9's test should assert one items-table line per enabled plugin, listable server, doc file and set of the world, including one that reaches no row (criteria 5) — fixed
6. Should — Task 6 takes the current Claude Code version from the newest transcript line read, normally the session running the script, while probes run under Git Bash's `claude`; when the two builds differ every probe stays stale, `--fixed` never exits 0 and Task 10 stays blocked; compare against the version the probe sessions record, or print both versions when they differ (criteria 6) — fixed
7. Should — Task 3's test says `set:gsd` denies "exactly the four member names", but Task 2's world gives `gsd` three members (`gsd-a`, `gsd-b`, `gsd-r`), so the assertion as written cannot pass (build 1) — fixed
8. Should — Task 5's test steps cannot all pass in order: step 4's `fixedPending` writes new `probes.json` entries with fresh session ids and `plugin:beta@m = 2.1.0`, so after step 5 restores `2.0.0`, `plugin:beta@m` is pending too and "exactly `all-on` and the `text:doc:` ids" fails; say whether `probes.json` is restored between steps or sessions are written for reprinted probes (build 2) — fixed
9. Should — Task 7's `measure({ setup, probes, located, texts })` cannot find a probe's transcript: its probes come from `pendingProbes` without a `sessionId`, `located` is keyed by session id, and the probe state (`probes.json`, id → sessionId) is not an argument, so the executor must invent a shape Task 8 then rewrites (build 3) — fixed
10. Should — Task 2 does not state that `installed_plugins.json` holds `plugins[id]` as an array of install records (`C:\Users\Luan Ngo\.claude\plugins\installed_plugins.json:3-8`); a world written with the object form passes the test while the real read gives every version `null`, so a plugin upgrade never re-probes; state the array form and have the world write it (build 4) — fixed
11. Should — Task 3's test "each starts `cd ` and the probe worktree path" fails on Windows where the temp path holds a space and `shellLine` single-quotes it; compare against `'cd ' + shellLine([probePath])` (build 5) — fixed
12. Should — the preamble's "Nothing under … the real `~/.claude` changes" conflicts with Task 1's spike, since every `claude -p` run writes transcripts under `~/.claude/projects/` and project entries in `~/.claude.json`; an executor reading it literally reports BLOCKED; narrow the rule to settings, skills, agents, commands and CLAUDE.md files (build 6) — fixed
13. Should — the spike never checks that `tools` in `--agents` limits a stub's tools, yet every agent row's Claude Code part depends on it; if Claude Code ignores the array or wants a comma string, read-only agents' stubs carry every tool definition and `unattributed` goes negative; in run f add a second stub with `"tools":["Read"]` and pass only when its first-call input is below `stub-1`'s; the field is cited only by https://code.claude.com/docs/en/cli-reference (build 7) — fixed
14. Nice — `PROBE_FORMS.claudeVersion` is recorded in Task 1 but no task reads it (build 9) — deferred
15. Nice — Tasks 3 to 10 mark `scripts/fixed-context.mjs`, `benchmark-fixed.test.ts` and `fixed-world.ts` as `(new)` though Tasks 1 and 2 create them (build 10) — deferred

## Round 2 (whole)

1. Should — Task 3 builds each probe command as `claude -p --session-id <id> ...PROBE_FORMS.extraArgs [--settings f] [--mcp-config f] [--strict-mcp-config] <prompt>`; if Task 1 records a variadic flag such as `--allowedTools Agent` (the plan's own example; https://code.claude.com/docs/en/cli-reference shows `--allowedTools` taking a space-separated list), the all-on probe, which has none of the bracketed flags, puts its prompt right after that list, which swallows it as a tool name, so `-p` gets no prompt, no agent is dispatched and `--fixed` reprints `all-on` as missing forever; Task 3's test runs with the real `PROBE_FORMS` and cannot see it; put the prompt directly after `-p` (the documented `claude -p "query"` form) or end the options with a single-valued flag, and add a test with `extraArgs: ['--allowedTools', 'Agent']` — fixed
2. Should — any change to auto-memory's `MEMORY.md` makes `all-on` stale, and the main session writes ticket-stage lines there as it works; an update between the last clean `--fixed` and Task 10 makes Task 10's `--fixed` exit 1 and report BLOCKED, forcing another all-on probe that dispatches every accord agent; the plan neither stops memory writes in that gap nor lets Task 10 reuse the report that run wrote — fixed
3. Nice — Task 10's test-first step cannot fail first: the main session's `--fixed` run leaves `docs/benchmark/fixed-context.md` in the worktree before Task 10 is dispatched, so the ac-4 test passes at once and the executor finds a dirty file it did not create — deferred

## Round 3 (diff)

No findings

## Closed
Converged at round 3: 0 Must open, 0 Should open, 3 Nice deferred.

## Round 1 (whole)

Re-plan after Task 1: set probes move skills and commands out of reach with `skillOverrides`.

1. Should — no step checks that a `set:` probe took its members out of the listing, though `skillOverrides` is undocumented and `firstCall` already returns `skillListing` and `agentListing`; a Claude Code update that ignores the key leaves the `set:gsd` probe listing all 88 `gsd-` skills, the skills' cost lands in `unattributed`, and the report can name the wrong largest owner with a near-zero gsd line; treat a `set:` probe whose main or agent first call still lists a member as failed and have `--fixed` refuse naming the set and the probe version (criteria 1) — fixed
2. Should — local-scope MCP servers (`~/.claude.json` `projects[<main checkout>].mcpServers`) and the ignored `.claude/settings.local.json` that `readSetup` reads do not load in the probe worktree, which is another path and carries no ignored file; a local server gets a cost in every row though the all-on probe never loaded it, `other connected servers` can go negative, and a plugin turned off locally loads in all-on but is in no item line; drop both from `readSetup` and say so in the report, or have the probe commands carry them (criteria 2) — fixed
3. Should — the preamble prints paths under home as `~/<rest>`, but `shellLine` quotes any argument with `~`, and Git Bash does not expand a quoted tilde; with the repository under home, `cd '~/src/accord-probe'` and `--settings '~/…'` fail; say that paths inside a printed command stay absolute, or emit `~/` unquoted (build 1) — fixed
4. Nice — Task 1's step 2e and its `PROBE_FORMS` paragraph still describe `Skill(<name>)` deny rules and no `skillOverride`; a rerun of the spike from that text reports BLOCKED or rewrites the forms without `skillOverride` (build 2) — deferred
5. Nice — the connector-probe path in Tasks 4, 7 and 9 is never taken now that `PROBE_FORMS.connector` is `null`, and Task 7's test does not say to pass a forms override to get its connector probe; name the override or drop the branch (criteria 3, build 3) — deferred

## Round 2 (diff)

1. Nice — the preamble says the `cwd` and `command` stored in `probes.json` pass through `shellLine`, but Task 3's test asserts the stored `cwd` equals `probeDir` unquoted; an executor that quotes `cwd` fails that test on a path with a space; say only `command` goes through `shellLine` — deferred

## Closed
Converged at round 2: 0 Must open, 0 Should open, 3 Nice deferred.

## Round 1 (whole)

Re-plan after Task 9: size each part from its text with a ratio per model.

1. Should — Task 11 decides which rows an MCP server's instructions block reaches only from attachments before each row's first call, but Claude Code adds that block to a subagent after its first call (accord-critic runs in this session carry `mcp_instructions_delta` for claude.ai Claude Docs at lines 28 and 36, after the first assistant line 17, with tools `Read, Grep, Glob`); the connector's block is charged to the main row alone, every agent row leaves out about 600 tokens real calls carry, and Task 9's "cost per call that removing the item saves" is false for that line (criteria 1) — open
2. Should — Task 12 adds steps 9 and 10 to the Task 5 test after steps 7 and 8, which never undo their changes (step 7 commits a `CLAUDE.md` edit, step 8 leaves an uncommitted agent edit); step 9's `fixedPending` sees `setupDirty` and returns exit 2 with no pending ids, and step 7's content change moves the new docs hash; run steps 9 and 10 before step 7, or have steps 7 and 8 undo their changes (build 1) — fixed
3. Nice — Task 9's "each line above is the cost per call that removing the item saves" overstates a plugin's line once its MCP server is its own line; reword in Task 15 (criteria 2) — deferred
4. Nice — Task 13 changes step 2 of the Task 5 test to "no id starts with `text:`" without saying to drop the step-2 assertions that require `text:` ids and the `text_doc_…md` file (build 2) — deferred
5. Nice — Task 13's test texts carry no `label`, and it does not say whether an `mcp:<n>` item's name comes from the text's label or the item id (build 3) — deferred
6. Nice — Task 14's new test asserts `<bench>/fixed` does not exist after the refused `fixedProbe`, though earlier calls in the test created it and the task never removes it (build 4) — deferred
7. Nice — the settings and MCP config files the earlier real `--fixed --probe` wrote under `C:/Work/accord-bench/fixed/` stay on disk after Task 14; no step removes them (build 5) — deferred

## Round 2 (diff)

1. Should — the fix for 1.1 charges the main's MCP instructions block to each agent row's MCP servers part, but Task 13 keeps an agent row's `total` as its first-call input, which by the fix's own premise does not hold the block; the agent row's MCP cell rises by the block's size, `fixed` stays, `unattributed` falls by the same amount (about 600 tokens, negative when the true remainder is smaller), and Task 9's `ticketShares` still leaves the block out; add `size(block, r)` to the `total` of an agent row whose own first call does not hold the block, and say in Task 15's line that it is counted in the agent's fixed context — open
