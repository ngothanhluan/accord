# Review

## Round 1

Nice 1 [patch]: the @ac-1 test's conditional `expected === fresh` assertion cannot fail (already deferred as plan round 1.4) — packages/cli/test/upgrade.test.ts:449 — deferred
Nice 2 [patch]: a workflow that is invalid YAML is classed as `shape`, so its warning names block list items and anchors, not the cause — packages/core/src/scaffold/repin.ts:31 — deferred

## Round 2

Nice 1 [patch]: prose still says upgrade only moves pins (READMEs, upgrade.ts header, repin.ts header, the upgrade skill's pull request body) — README.md:35 — deferred
Nice 2 [patch]: upgrade.test.ts repeats setup that `upgradeOf` already does, and a local `init09` shadows the module-level one — packages/cli/test/upgrade.test.ts:151 — deferred

verdict: converged
