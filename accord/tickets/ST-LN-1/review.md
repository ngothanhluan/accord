## Round 1

Nice 1 [intent-gap]: holder order for two pushed `t/<id>` refs on different remotes changes even with no `branch` key; the owner kept the new order — packages/cli/src/load/fs.ts `gitClaims` — deferred
Nice 2 [plan-gap]: `config.yml` written by `init` does not document `branch` — packages/core/src/scaffold/init.ts — deferred
Nice 3 [patch]: stale comment on claims naming only `t/<id>` — packages/core/src/model/snapshot.ts:12 — deferred
Nice 4 [patch]: `branchTemplateOf(config.body)` computed twice on one line — packages/cli/src/load/fs.ts `gitDefaultBranch` — deferred
Nice 5 [patch]: whitespace slips: a lost blank line, a long header comment, three test files without a final newline — packages/cli/src/load/fs.ts, packages/cli/src/commands/anchor.ts:3, tests — deferred
Nice 6 [plan-gap]: a schema risk test overlaps ac-3, kept because it names the failed rule — packages/core/test/schemas.test.ts — deferred

## Round 2

No findings

verdict: converged
