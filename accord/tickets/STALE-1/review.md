## Round 1

Should 1 [patch]: `risk:drift` is not one of the spec's risk kinds and the test only checks wording in the installed copy — packages/cli/test/skills-sync.test.ts:594 — open
Nice 2 [patch]: `commitAll` is a one-line wrapper around `commitAllAt` — packages/cli/test/helpers/repo.ts:70 — deferred

## Round 2

Nice 1 [patch]: the `gitFacts` doc comment still says nothing beyond the author identity is read — packages/cli/src/load/fs.ts:63 — deferred
Nice 2 [patch]: the unit of `now` (unix seconds) on the exported `statusRows` is not documented — packages/core/src/status/rows.ts:49 — deferred

verdict: accepted-by-owner "Keep it, record an exception"
