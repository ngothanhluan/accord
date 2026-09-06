---
title: Spike — prove the core runs on the MCP host and commits through the GitHub API
date: 2026-09-05
priority: high
after_phase: 4
---

Time-boxed spike (half a day) before Phase 5, so Phase 8 unknowns are known early.

1. Bundle `core` (yaml, @cucumber/gherkin, the schema validator) for the candidate serverless host and run `gate ready` on a fixture snapshot there. Known risk: `ajv` compiles with `new Function`; try ajv standalone precompile, fall back to `@cfworker/json-schema`.
2. From the same host, commit two files in one commit through the GitHub API as a signed-in user (compare REST contents vs GraphQL `createCommitOnBranch`). Confirm the commit author is the user, not a bot.
3. Fetch a whole `accord/` folder by tree or tarball API and time it.

Output: a note in `.planning/notes/` with what ran, what failed, and the hosting choice. Feeds Phase 8 research.
