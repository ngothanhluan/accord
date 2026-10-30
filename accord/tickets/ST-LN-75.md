---
id: "ST-LN-75"                            # equals the file name: tickets/<id>.md
title: "worktree.test.ts runs as one 11-15 minute file, so every test run that includes it waits on it alone"
type: "story" # story | bug
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "S" # S: one small change, worked from this ticket alone
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Written by `gate ready`; never edit by hand.
# ac_hash:
ac_hash: "fnv1a64:b2795977f4f073ee"
---

## Understood
Queued 2026-10-30, not yet worked: split packages/cli/test/worktree.test.ts (132 top-level tests, no describe blocks, 12 templates built once in beforeAll, about 20 helper groups through the file) into several files vitest runs in parallel, grouped by command (open and claim, clean, merge and continue-merge, Claude Code session holds and clear), with the shared setup and helpers moved into packages/cli/test/helpers/worktree.ts; no test is removed, weakened or renamed, and the 29 `@test:packages/cli/test/worktree.test.ts#...` tag lines in the 7 done tickets are rewritten to the new file paths, since an id is the JUnit `classname#name` (packages/core/src/load/junit.ts:40) and `accord lint` checks every tag against the report (packages/core/src/lint/gherkin.ts:77-88). Why: vitest runs a file in one worker, so this file's time is a floor for every run that includes it: 676 s of a 1806 s `tests.full` at 7bcd659, 912 s of 1297 s and 704 s of 708 s in ST-LN-13's `vitest related` runs at fc814b1 and caf498a (2026-10-30), and a skill-text change pulls it in through packages/core/src/generated/skills.ts. Plans, ledgers, reviews, verifications and JUnit copies under accord/tickets/<id>/ that name the old path are history and stay as they are. Not here: cutting any test's work (ST-LN-63 part 4, BUG-LN-17, ST-LN-74), the worker count, splitting lane-commands.test.ts or workflow-script.test.ts.

## Done when
In a `tests.full` run the cli test files that replace worktree.test.ts hold the same 132 tests (1 skipped) under the same names, none of them takes more than about a third of worktree.test.ts's current time (about 225 s against 676 s at 7bcd659), every rewritten `@test:` id resolves and passes in the fresh report, and `accord lint` and the full suite pass.

## Decisions
- D-01 Lane S with the 7 ticket files' tags rewritten, over keeping the tagged tests in worktree.test.ts — "still B but lane S, the complexity is not high. 7 files but not complex. lane M is overkill" (owner, 2026-10-30, translated)

## Corrections
- 2026-10-30, after the local `tests.full` run was started: "I think it takes too much time. use CI" (owner, translated). The local run was stopped; CI's full suite on the pull request replaces `tests.full`, and the per-file times of `## Done when` are read from CI's `npm test` log.

## Scope
<!-- One repository path per line, never a folder: every file the change is expected to touch, tests and new files included. -->
packages/cli/test/worktree.test.ts
packages/cli/test/worktree-open.test.ts
packages/cli/test/worktree-clean.test.ts
packages/cli/test/worktree-merge.test.ts
packages/cli/test/worktree-session.test.ts
packages/cli/test/helpers/worktree.ts
accord/tickets/BUG-LN-14.md
accord/tickets/ST-LN-7.md
accord/tickets/ST-LN-20.md
accord/tickets/ST-LN-25.md
accord/tickets/ST-LN-27.md
accord/tickets/ST-LN-30.md
accord/tickets/ST-LN-34.md
