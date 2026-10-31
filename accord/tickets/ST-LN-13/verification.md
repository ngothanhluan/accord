---
ticket: "ST-LN-13"
commit: "619d1922038a8cc37495b0cf5850c95de92dc388"
reviewed_on: "2026-10-31"
---

## @ac-1 lint refuses a ticket whose research reference is not a dated record

Result: pass

Evidence: Exists: `packages/core/test/research.test.ts:33` holds the test; rule `lint.research-reference` is registered at `packages/core/src/lint/rules.ts:59`. Substantive: `packages/core/src/lint/research.ts` emits an error at `/research/<i>` for four faults: path outside `accord/research/`, file missing, no `Date:`, no `Repository at <sha>`. The reason text names the path. The ticket schema accepts a `research` string array (`packages/core/schemas/ticket.schema.json:39`). Wired: the loader passes listed records into the snapshot (`packages/core/src/load/snapshot.ts:142`, `packages/cli/src/load/fs.ts:1443-1454`). The test asserts `gateReady` returns `fail` with that rule. Data flows: the test builds four snapshots, one per example row. Each yields exactly one error with file `accord/tickets/T-1.md`, pointer `/research/0`, and a reason containing the reference. A valid record yields no finding and `gateReady` returns `pass`. `vitest run` over the four touched test files: 88 passed. The full suite reported by the caller: 1763 passed, 0 failed.

## @ac-2 a ticket that names dated records passes lint and its anchor lists them

Result: pass

Evidence: Exists: `packages/core/test/anchor.test.ts:110`. Substantive: `packages/core/src/status/anchor.ts:39-41` pushes `## Research` followed by the paths as written, in key order. Wired: `anchorText` is the anchor entry point, called by the CLI `anchor` command. Data flows: the test lists two records (B then A) in the key. It asserts no `lint.research-reference` finding and no finding on either record file. It asserts the anchor tail equals `## Research`, B, A, in key order, between Corrections and Rulings. A companion risk test shows a ticket without the key, or with an empty key, prints no section. The test file passed in the run above. `node packages/cli/dist/cli.js lint` on this worktree showed no research finding.

## @ac-3 the deciding agents read a ticket's research records and the others do not

Result: pass

Evidence: Exists: `packages/core/test/agents.test.ts:250`. Substantive: the test renders `agentTargets` for all four runtimes and checks the ten agent files. The scout, architect, critic and planner texts must contain the sentence "Read every record the ticket's frontmatter `research:` key lists...". Every other agent file must not match `/research/i`. Wired: `agentTargets` is the same renderer `accord skills sync` uses. Data flows: the assertion runs on the rendered text, so the source edits reach the output. The test passed. Caveat the Approach already states: this proves rendered text, not agent behaviour at run time.

## @ac-4 the intent interview moves evidence it replaces into a record

Result: pass

Evidence: Exists: `packages/core/test/stage-skills.test.ts:1088`. Substantive: `packages/core/skills/intent/research.md` says, at step 6 before rewriting a queued Intent, to first move every replaced line verbatim into a new `accord/research/` record with `Date: <YYYY-MM-DD>` and `Repository at <sha>` in its first five lines, and to list it under `research:`. It adds "Never delete such a line." Wired: `packages/core/skills/intent/SKILL.md:6` loads `intent/research.md`, and lines 20 and 49 point to it from steps 2 and 6. Data flows: the test renders the skill for all four runtimes, two role sets, and both `.claude/skills` and `.agents/skills`. It checks the pointers and exact sentences, and validates the fenced template header with `recordHeaderFaults`: it faults before filling in and is clean after. The test passed.
