# Ledger

## Tasks

## Rulings

- Ruling: the per-owner split is measured on the setup present when the report runs, and the transcripts supply only the call counts and how each call was billed — a Claude Code transcript holds no system prompt (an executor transcript, 139 lines, has no system entry; its first line is the brief) — cost if wrong: a setup changed since the transcripts were written moves the split, which the report shows by naming the setup it measured.
- Ruling: fixed context excludes the task prompt and the conversation so far, the auditor's reading A of ac-1 — the task prompt differs per call and is the caller's, not a fixed cost — cost if wrong: the cut ticket misses the brief's size, which a later ticket can measure.
- Ruling: accord's pointer block in CLAUDE.md counts as accord, and user-level CLAUDE.md and memory count with the owner's own CLAUDE.md files; text no owner explains goes to an `unattributed` remainder rather than being forced into one — the owners' parts must add up (ac-1) — cost if wrong: a large remainder makes the split less useful, which the report shows.
- Ruling: cost-weighting uses each call's billed mix from the transcripts, and the ticket share is two shares of the whole ticket's cost — the auditor's readings A of ac-2 — cost if wrong: a flat assumed weight would differ by the cache-hit rate.
- Ruling: the report lists every plugin, MCP server, CLAUDE.md and memory file of the owner's setup with its cost per call, and makes no keep-or-cut judgement — D-01 leaves the owner's setup to the owner — cost if wrong: the owner must read a longer list.
- Ruling: after the second audit, ac-1 measures both a row's fixed context and its parts on the current setup (the second auditor's reading B), so unattributed cannot go negative from a setup that grew since the transcripts — one source for total and parts — cost if wrong: the total no longer reflects the setup the transcripts ran under, which the report states.
- Ruling: fixed context is charged by position, cache reads first, then cache writes, then fresh input — it is the prompt's prefix, so a blended rate would overstate it — cost if wrong: a few percent on calls whose prefix was not cached.
- Ruling: a ticket's calls are those whose transcript lines record its branch or worktree — every transcript line carries `cwd` and `gitBranch` (checked: an ST-LN-34 executor run records `C:\Work\accord-st-ln-34` and `t/ST-LN-34`) — cost if wrong: a main-session turn about a ticket run from another folder is missed.
- Ruling: the per-item list (every enabled plugin, connected MCP server, CLAUDE.md and memory file) is printed by the script as well as held by the report, and disabled plugins are left out because they cost nothing per call — repeatability (ac-3) — cost if wrong: a slightly larger script.
- Ruling: the audit ran twice, not once as accord-intent step 8 says — the first audit's readings were resolved by rewording four criteria, and quality > cost asked for a check of the rewrite — cost if wrong: one auditor run.

## Deferred
