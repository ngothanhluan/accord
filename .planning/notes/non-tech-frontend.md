---
title: Non-tech frontend — why a remote MCP server, not a web app or a hub
date: 2026-09-05
context: gsd-explore session during v0.1 initialization
---

## Question

If git is the single source of truth, does accord need a server at all? And how does a
non-technical BA take part without git, markdown, or knowing what to write?

## Conclusions

1. **No server holds truth.** Every host (CLI, CI, MCP, any future UI) is a git client
   over the same pure core. The old "hub" idea is dropped as a separate product.
2. **Feature and ticket are the same thing**: a unit of work, like a Shortcut story. Grouping
   is a `parent:` field, not a second folder.
3. **Non-tech burden has three layers**: (a) touching git, (b) knowing the formats,
   (c) knowing what to write (the interview). The interview is the heavy one.
4. **No API keys anywhere.** Team members hold Claude, ChatGPT/Codex, or Copilot
   subscriptions. A subscription is not an API key, so a self-built chat UI cannot use it.
   Therefore the model must always run inside the user's own AI tool.
5. **So: push accord into their tool.** A stateless remote MCP server (GitHub OAuth, writes
   files through the GitHub API, exposes list/get/save/lint/gate tools and per-role prompts)
   makes claude.ai / ChatGPT the non-tech frontend and Claude Code / Cursor / Codex the dev
   frontend, over one core.

## Options considered

| Option | Removes git | Removes formats | Interview quality | Cost | Why not |
|---|---|---|---|---|---|
| A. Agent on their machine is the UI | after setup | yes | best | none | non-tech must install an AI tool and clone |
| B. Tracker (Shortcut) is the UI | yes | mostly | slow, async via comments | medium | interview loop takes hours per turn |
| C. Own static web app with chat | yes | yes | good | large | needs API keys; rejected by the no-key constraint |
| C'. Remote MCP server (chosen) | yes | yes | good, real time | medium | none blocking; verify client support per plan |

Optional later: a read-only static dashboard over the GitHub API. No LLM in it.

## Unverified at time of writing

Which individual plans of claude.ai, ChatGPT, Copilot, and Codex support remote MCP with
OAuth, and whether prompts (not only tools) are surfaced. Research running; see
`.planning/research/questions.md`.
