# Fixed context per call

Transcripts: 53340 calls from 2026-10-12 to 2026-10-31, read from 40 transcript folder(s).
Probes: the all-on probe of 2026-10-31 under Claude Code 2.1.316.
The main session row is measured under claude -p, with its probe prompt sized and taken out.
Every part but Claude Code is sized from its text's characters at a characters-per-token ratio calibrated on each model (claude-opus-5-5: 2.90, claude-sonnet-5-5: 2.90 characters a token), so those sizes carry that estimate, about ±10%; unattributed absorbs the difference.
accord-auditor: 2 of its 208 calls ran on claude-sonnet-5-5; they are counted at the size measured on claude-opus-5-5.
accord-executor: 33 of its 9578 calls ran on claude-opus-5-5; they are counted at the size measured on claude-sonnet-5-5.
accord-reviewer: 234 of its 3577 calls ran on claude-opus-5-5; they are counted at the size measured on claude-sonnet-5-5.
accord-scout: 479 of its 719 calls ran on claude-haiku-5-5; they are counted at the size measured on claude-sonnet-5-5.
A claude.ai connector can change its instructions on the server, which no fingerprint sees; its figure holds for the probe date.
A plugin's own MCP servers count under MCP servers; its skills and agents count under plugins.
An MCP server's instructions block that the main session loads is counted in every accord agent row's fixed context and MCP servers part: Claude Code adds it to a subagent after the subagent's first call, so it is added to the fixed context measured from that first call, and each subagent's first call, which does not carry it, is weighed without it.
MCP server aws-mcp failed to connect (-32603) in the all-on probe, so its cost per call is not measured; a - in its cells means that, not that removing it saves nothing.
MCP server plugin:context7:context7 needed authentication in the all-on probe, so its cost per call is not measured; a - in its cells means that, not that removing it saves nothing.
Local-scope MCP servers and .claude/settings.local.json are not measured: the probe worktree loads neither.
Cursor, Codex and Copilot calls were not measured.

## Fixed context per call, raw tokens

| row | model | calls | fixed | accord | Claude Code | plugins | MCP servers | CLAUDE.md and memory | own skills, agents and commands | unattributed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| main session (claude -p) | claude-opus-5-5 | 16656 | 53927 | 2291 | 22659 | 2754 | 747 | 9387 | 8353 | 7736 |
| accord-architect | claude-opus-5-5 | 1941 | 18464 | 1342 | 3598 | 0 | 653 | 9387 | 0 | 3484 |
| accord-auditor | claude-opus-5-5 | 208 | 16565 | 1013 | 2045 | 0 | 653 | 9387 | 0 | 3467 |
| accord-critic | claude-opus-5-5 | 10346 | 19323 | 2186 | 3598 | 0 | 653 | 9387 | 0 | 3499 |
| accord-debugger | claude-opus-5-5 | 350 | 20461 | 1777 | 5520 | 0 | 653 | 9387 | 0 | 3124 |
| accord-executor | claude-sonnet-5-5 | 9578 | 40125 | 2883 | 14824 | 768 | 747 | 9387 | 4987 | 6529 |
| accord-final-reviewer | claude-opus-5-5 | 1876 | 20747 | 2305 | 5284 | 0 | 653 | 9387 | 0 | 3118 |
| accord-planner | claude-opus-5-5 | 4221 | 20217 | 2519 | 4182 | 0 | 653 | 9387 | 0 | 3476 |
| accord-reviewer | claude-sonnet-5-5 | 3577 | 20750 | 2305 | 5290 | 0 | 653 | 9387 | 0 | 3115 |
| accord-scout | claude-sonnet-5-5 | 719 | 18132 | 1026 | 3602 | 0 | 653 | 9387 | 0 | 3464 |
| accord-verifier | claude-sonnet-5-5 | 691 | 20585 | 1498 | 5874 | 0 | 653 | 9387 | 0 | 3173 |

## Fixed context per call, cost-weighted tokens

| row | model | calls | fixed | accord | Claude Code | plugins | MCP servers | CLAUDE.md and memory | own skills, agents and commands | unattributed | largest owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| main session (claude -p) | claude-opus-5-5 | 16656 | 5898.8 | 250.6 | 2478.5 | 301.2 | 81.7 | 1026.8 | 913.7 | 846.2 | Claude Code |
| accord-architect | claude-opus-5-5 | 1941 | 2584.5 | 187.8 | 503.6 | 0.0 | 91.4 | 1313.9 | 0.0 | 487.7 | CLAUDE.md and memory |
| accord-auditor | claude-opus-5-5 | 208 | 9348.0 | 571.7 | 1154.0 | 0.0 | 368.5 | 5297.3 | 0.0 | 1956.5 | CLAUDE.md and memory |
| accord-critic | claude-opus-5-5 | 10346 | 2719.6 | 307.7 | 506.4 | 0.0 | 91.9 | 1321.2 | 0.0 | 492.5 | CLAUDE.md and memory |
| accord-debugger | claude-opus-5-5 | 350 | 3048.1 | 264.7 | 822.3 | 0.0 | 97.3 | 1398.4 | 0.0 | 465.4 | CLAUDE.md and memory |
| accord-executor | claude-sonnet-5-5 | 9578 | 5650.1 | 406.0 | 2087.4 | 108.1 | 105.2 | 1321.8 | 702.2 | 919.4 | Claude Code |
| accord-final-reviewer | claude-opus-5-5 | 1876 | 3008.0 | 334.2 | 766.1 | 0.0 | 94.7 | 1361.0 | 0.0 | 452.1 | CLAUDE.md and memory |
| accord-planner | claude-opus-5-5 | 4221 | 3070.6 | 382.6 | 635.2 | 0.0 | 99.2 | 1425.7 | 0.0 | 527.9 | CLAUDE.md and memory |
| accord-reviewer | claude-sonnet-5-5 | 3577 | 3588.1 | 398.6 | 914.8 | 0.0 | 112.9 | 1623.2 | 0.0 | 538.7 | CLAUDE.md and memory |
| accord-scout | claude-sonnet-5-5 | 719 | 3871.0 | 219.0 | 769.0 | 0.0 | 139.4 | 2004.1 | 0.0 | 739.5 | CLAUDE.md and memory |
| accord-verifier | claude-sonnet-5-5 | 691 | 5059.5 | 368.2 | 1443.8 | 0.0 | 160.5 | 2307.2 | 0.0 | 779.9 | CLAUDE.md and memory |

Weights: fresh input 1, cache read 0.1, cache write 1.25. 1079 calls had less input than the fixed context now measured; the excess was not charged.

## Setup items, tokens per call (raw / cost-weighted)

| item | owner | main session (claude -p) | accord-architect | accord-auditor | accord-critic | accord-debugger | accord-executor | accord-final-reviewer | accord-planner | accord-reviewer | accord-scout | accord-verifier |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| agent definition | accord | - | 532 / 74.5 | 203 / 114.6 | 1376 / 193.7 | 967 / 144.1 | 1369 / 192.8 | 1495 / 216.8 | 1709 / 259.6 | 1495 / 258.5 | 216 / 46.1 | 688 / 169.1 |
| agent listing entries | accord | 777 / 85.0 | - | - | - | - | - | - | - | - | - | - |
| pointer block CLAUDE.md | accord | 106 / 11.6 | 106 / 14.8 | 106 / 59.8 | 106 / 14.9 | 106 / 15.8 | 106 / 14.9 | 106 / 15.4 | 106 / 16.1 | 106 / 18.3 | 106 / 22.6 | 106 / 26.1 |
| rules block | accord | 704 / 77.0 | 704 / 98.5 | 704 / 397.3 | 704 / 99.1 | 704 / 104.9 | 704 / 99.1 | 704 / 102.1 | 704 / 106.9 | 704 / 121.7 | 704 / 150.3 | 704 / 173.0 |
| skill listing entries | accord | 704 / 77.0 | - | - | - | - | 704 / 99.1 | - | - | - | - | - |
| accord-panel@accord (accord's own) | plugins | - | - | - | - | - | - | - | - | - | - | - |
| claude-hud@claude-hud | plugins | 70 / 7.7 | - | - | - | - | 70 / 9.9 | - | - | - | - | - |
| claude-security@claude-plugins-official | plugins | 1006 / 110.0 | - | - | - | - | - | - | - | - | - | - |
| context7@claude-plugins-official | plugins | - | - | - | - | - | - | - | - | - | - | - |
| creative-writing-skills@cw | plugins | 758 / 82.9 | - | - | - | - | 74 / 10.4 | - | - | - | - | - |
| csharp-lsp@claude-plugins-official | plugins | - | - | - | - | - | - | - | - | - | - | - |
| humanizer@humanizer | plugins | 126 / 13.8 | - | - | - | - | 126 / 17.7 | - | - | - | - | - |
| impeccable@impeccable | plugins | 613 / 67.1 | - | - | - | - | 317 / 44.6 | - | - | - | - | - |
| pixijs-skills@pixijs-skills | plugins | - | - | - | - | - | - | - | - | - | - | - |
| typescript-lsp@claude-plugins-official | plugins | - | - | - | - | - | - | - | - | - | - | - |
| ui-ux-pro-max@ui-ux-pro-max-skill | plugins | 181 / 19.8 | - | - | - | - | 181 / 25.5 | - | - | - | - | - |
| aws-mcp | MCP servers | - | - | - | - | - | - | - | - | - | - | - |
| claude.ai Claude Docs (claude.ai connector) | MCP servers | 747 / 81.7 | 653 / 91.4 | 653 / 368.5 | 653 / 91.9 | 653 / 97.3 | 747 / 105.2 | 653 / 94.7 | 653 / 99.2 | 653 / 112.9 | 653 / 139.4 | 653 / 160.5 |
| .claude/CLAUDE.md | CLAUDE.md and memory | 6709 / 733.9 | 6709 / 939.1 | 6709 / 3786.0 | 6709 / 944.2 | 6709 / 999.5 | 6709 / 944.7 | 6709 / 972.7 | 6709 / 1019.0 | 6709 / 1160.1 | 6709 / 1432.3 | 6709 / 1649.0 |
| CLAUDE.md | CLAUDE.md and memory | 116 / 12.7 | 116 / 16.2 | 116 / 65.5 | 116 / 16.3 | 116 / 17.3 | 116 / 16.3 | 116 / 16.8 | 116 / 17.6 | 116 / 20.1 | 116 / 24.8 | 116 / 28.5 |
| ~/.claude/projects/C--Work-accord/memory/MEMORY.md | CLAUDE.md and memory | 2562 / 280.2 | 2562 / 358.6 | 2562 / 1445.8 | 2562 / 360.6 | 2562 / 381.7 | 2562 / 360.8 | 2562 / 371.5 | 2562 / 389.1 | 2562 / 443.0 | 2562 / 547.0 | 2562 / 629.7 |
| ~/.claude/projects/C--Work-accord/memory/accord-targets-teams.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/auto-merge-backlog-prs.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/backlog-pr-admin-merge.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/brief-test-command-ticket.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/bug-ln-12-waits-st-ln-44.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/bug-ln-14-clear-hold.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/bug-ln-4-waits-st-ln-44.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/chat-language-vietnamese.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/ci-over-local-full.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/comments-ticket.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/commit-email-hotmail.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/concise-owner-views.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/dashboard-panel.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/done-ticket-regate.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/dropped-ticket-cleanup.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/epic-project-structure-discussion.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/finish-report-ticket.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/fixed-context-ticket.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/harness-architecture-study.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/held-anchor-stale.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/lane-assess-literal.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/lane-s-ticket.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/late-round-findings-measure.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/linux-test-runs.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/memory-aware-forks.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/merge-before-verify-ticket.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/merge-main-on-behind.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/no-coauthor-trailer.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/no-overlap-detection.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/parallel-sessions-worktree.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/phase-2-1-dogfood-tickets.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/plugins-removed.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/post-verify-failure-ticket.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/process-rules-enforced.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/public-repo-english-only.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/quality-speed-cost.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/question-context.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/release-timing.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/researcher-ticket.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/review-rounds-report.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/risk-routed-executor.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/sentence-rule-dropped.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/simple-owner-questions.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/slow-tests-cut.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/st-ln-57-waits-st-ln-17.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/test-run-lock.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/ticket-done-report.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/ui-skill-roles.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/upgrade-notice-ticket.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/worker-cap-ticket.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| ~/.claude/projects/C--Work-accord/memory/worktree-cleanup-ticket.md | CLAUDE.md and memory | - | - | - | - | - | - | - | - | - | - | - |
| set amazon (1 members) | own skills, agents and commands | 358 / 39.2 | - | - | - | - | 358 / 50.4 | - | - | - | - | - |
| set aws (20 members) | own skills, agents and commands | 3662 / 400.6 | - | - | - | - | 3662 / 515.7 | - | - | - | - | - |
| set gsd (123 members) | own skills, agents and commands | 4300 / 470.4 | - | - | - | - | 934 / 131.5 | - | - | - | - | - |
| set launch (1 members) | own skills, agents and commands | - | - | - | - | - | - | - | - | - | - | - |
| set path (1 members) | own skills, agents and commands | - | - | - | - | - | - | - | - | - | - | - |
| set playwright (1 members) | own skills, agents and commands | 33 / 3.6 | - | - | - | - | 33 / 4.6 | - | - | - | - | - |
| set setting (1 members) | own skills, agents and commands | - | - | - | - | - | - | - | - | - | - | - |
| set signing (1 members) | own skills, agents and commands | - | - | - | - | - | - | - | - | - | - | - |

What the owner could cut: each line above is the cost per call that removing the item saves in that row.

## Lane M tickets, share of the ticket's cost

| ticket | claim | calls | main fixed context | accord subagents fixed context |
| --- | --- | --- | --- | --- |
| BUG-LN-1 | 2026-10-15 | 312 | 10.4% | 16.2% |
| BUG-LN-11 | 2026-10-26 | 847 | 9.7% | 14.2% |
| BUG-LN-13 | 2026-10-28 | 953 | 8.2% | 13.1% |
| BUG-LN-14 | 2026-10-28 | 672 | 11.0% | 14.8% |
| BUG-LN-2 | 2026-10-16 | 995 | 9.2% | 16.8% |
| BUG-LN-3 | 2026-10-17 | 477 | 11.8% | 18.8% |
| BUG-LN-4 | 2026-10-24 | 923 | 12.4% | 13.2% |
| BUG-LN-8 | 2026-10-24 | 444 | 13.5% | 11.0% |
| ST-LN-13 | 2026-10-29 | 1644 | 8.0% | 14.5% |
| ST-LN-14 | 2026-10-21 | 2918 | 6.8% | 15.9% |
| ST-LN-17 | 2026-10-29 | 1670 | 6.1% | 12.9% |
| ST-LN-18 | 2026-10-17 | 279 | 15.8% | 12.3% |
| ST-LN-2 | 2026-10-15 | 492 | 7.3% | 13.9% |
| ST-LN-20 | 2026-10-17 | 2610 | 12.3% | 13.9% |
| ST-LN-25 | 2026-10-19 | 1158 | 8.3% | 13.8% |
| ST-LN-26 | 2026-10-19 | 1190 | 10.0% | 14.4% |
| ST-LN-27 | 2026-10-19 | 835 | 10.6% | 11.7% |
| ST-LN-3 | 2026-10-15 | 1054 | 9.4% | 13.3% |
| ST-LN-30 | 2026-10-20 | 781 | 11.0% | 18.5% |
| ST-LN-31 | 2026-10-21 | 1415 | 4.8% | 13.0% |
| ST-LN-34 | 2026-10-21 | 794 | 11.6% | 14.5% |
| ST-LN-4 | 2026-10-15 | 716 | 11.8% | 13.0% |
| ST-LN-44 | 2026-10-25 | 3550 | 6.5% | 11.7% |
| ST-LN-48 | 2026-10-23 | 1584 | 9.5% | 10.5% |
| ST-LN-5 | 2026-10-15 | 15 | 21.9% | 17.1% |
| ST-LN-55 | 2026-10-30 | 1809 | 5.9% | 14.0% |
| ST-LN-58 | 2026-10-27 | 895 | 8.1% | 12.8% |
| ST-LN-62 | 2026-10-25 | 1278 | 8.2% | 12.8% |
| ST-LN-63 | 2026-10-29 | 1936 | 6.5% | 14.8% |
| ST-LN-64 | 2026-10-29 | 554 | 11.7% | 18.1% |
| ST-LN-73 | 2026-10-30 | 402 | 12.5% | 13.7% |
| ST-LN-8 | 2026-10-20 | 689 | 11.0% | 12.7% |

Weights: fresh input 1, cache read 0.1, cache write 1.25, output 5. Output tokens are estimated at 4 characters a token, since transcripts keep the usage from the stream's start.
The subagent share counts accord agents only; other subagents (such as Explore or general-purpose) count in the ticket's whole cost, and their fixed context is not measured.
