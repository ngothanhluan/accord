Round record: 2

## Round 1 head 631de4aa371b1987082280976ccc01fd5fd9e213

Nice 1 [patch]: a citation written `./src/a.ts:3` fails as untracked while the same path in `## Files` passes, since `listEntries` strips `./` and the citation reader does not — packages/core/src/scout/report.ts:34 — deferred
Nice 2 [patch]: the `## New files` rules (a tracked path fails, new files count toward the lane numbers) have no test — packages/core/src/scout/check.ts:136 — deferred
Nice 3 [patch]: every Absent row re-reads all its searched files with no cache across rows, about 100 git spawns for 10 root rows on 1,000 files — packages/core/src/scout/check.ts:177 — deferred
Nice 4 [patch]: a scout that wraps its reply in the prompt's example fence gets "the report has no ## Files section" for an otherwise correct report — packages/core/agents/scout.md — deferred
