# Review: BUG-LN-13

## Round 1

Nice 1 [patch]: the risk:regression skills test only checks that two skill files contain a literal sentence, so it restates the text rather than guarding a behaviour — packages/core/test/stage-skills.test.ts:915-919 — deferred
Nice 2 [patch]: doneRef writes a third copy of the `rev-parse --verify -q` resolver that gitDefaultRef and the helper near fs.ts:297 already hold — packages/cli/src/load/fs.ts:661-668 — deferred
