Round record: 2

## Round 1 head 930e4883f1ef056dae2079d8539c298e9d78d1d0

Security: no pattern matched
Nice 1 [patch]: the render getter `config === undefined ? [] : renderedFiles(config)` is written out in gate, round and review-package (and scout); one helper beside `renderedFiles` would give one definition — packages/cli/src/commands/gate.ts:69 — deferred
Nice 2 [patch]: the ac-4 test also asserts the Removed line, the id collision and the unchanged checklist, which belong to no criterion and repeat an existing assertion — packages/core/test/security.test.ts:581 — deferred
Nice 3 [patch]: the ac-3 test's in-process `withSecurityFacts` with the real render repeats the `gate done --json` assertion one layer lower — packages/cli/test/security-gate.test.ts:253 — deferred
