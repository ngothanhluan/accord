# Review: ST-LN-8

## Round 1

Nice 1 [patch]: the `commitMessage` test helper is copied into two CLI test files instead of packages/cli/test/helpers/repo.ts — packages/cli/test/gate.test.ts, packages/cli/test/trailers.test.ts — deferred
Nice 2 [patch]: under forbid, task-done loads branch commits before its verify reasons print, so a missing origin ref exits 2 and hides a failing verify case until `git fetch origin` — packages/cli/src/commands/task-done.ts — deferred

## Round 2

Should 1 [patch]: executors are barred from the top-level `accord/` folder but the planner is not told, so it can still put an `accord/` path on a task's `files:` line and the executor returns BLOCKED — packages/core/agents/planner.md:12 — fixed in f8b863b
Nice 2 [patch]: the commit loader splits git's output on `\x01`, so a body holding that control character hides every line after it — packages/cli/src/load/fs.ts — deferred
Nice 3 [patch]: the `risk:security` core gate test re-asserts what ac-4 and ac-3's allow case cover — packages/core/test/gate.test.ts — deferred
Nice 4 [patch]: docs/design.md §9 "Hooks" lists seven ruleset items while templates/ruleset.md has rule 8 — docs/design.md — deferred

verdict: converged
