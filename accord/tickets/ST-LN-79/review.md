## Round 1

Should 1 [patch]: the report shows an MCP server that never connected in the all-on probe (aws-mcp failed, plugin:context7:context7 needed authentication) with `-` cells and no note, which reads as "removing it saves nothing" — docs/benchmark/fixed-context.md:71, scripts/fixed-context.mjs `render`, scripts/benchmark.mjs `fixedReport` — fixed in 1b74963a (report regenerated in d9af84f8)
Nice 2 [patch]: the ticket share for subagents counts accord agents only, narrower than "the subagents' fixed context" reads — scripts/fixed-context.mjs:523 — deferred
Nice 3 [patch]: `readJsonFile`'s "does not parse" label calls `standsFor` with empty roots, so on POSIX it drops the leading `/` and prints the user name — scripts/benchmark.mjs:1243 — deferred
Nice 4 [patch]: `fixedReport` reads every transcript before `fixedPending`, so a refusal or a pending-probe exit still waits for the full read — scripts/benchmark.mjs `fixedReport` — deferred
Nice 5 [patch]: `PROBE_FORMS` keeps keys nothing needs and a test restates its key list — scripts/fixed-context.mjs:23-28 — deferred
Nice 6 [patch]: a test title still names per-item probes that Task 14 removed — packages/core/test/benchmark-fixed.test.ts:492 — deferred
Nice 7 [patch]: a risk test repeats the totals and late-block assertions ac-1 makes, with a helper that mirrors the formula — packages/core/test/benchmark-fixed.test.ts:692-833 — deferred

## Round 2

Nice 1 [patch]: the not-measured line names plugin:context7:context7, which has no row in the setup-items table, while the plugin's own `context7@claude-plugins-official` row shows `-` under a line saying each row is what removing the item saves — scripts/fixed-context.mjs:573 — deferred

verdict: converged
