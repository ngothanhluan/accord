# Review: ST-LN-44

## Round 1

Should 1 patch: ac-1 reads the frozen after-junit.xml, so the late keeps make it green by construction — packages/core/test/st-ln-44.test.ts — not patched: a test cannot read the report of the run it is part of; plan main-session step 3 runs the rule 3 tool on verify's report (ledger Ruling, review round 1 S1)
Should 2 patch: the 29 late keeps carry no reason, and tableProblems does not demand one — accord/tickets/ST-LN-44/table.md, packages/core/test/helpers/st-ln-44.ts — fixed in 5eb834d and 72193ae
Should 3 patch: sandbox-guard's one-clone and maintenance tests restate the helper — packages/cli/test/sandbox-guard.test.ts — not patched: plan Tasks 3 and 4 name these tests as the guard of otherClone and makeTemplate (ledger Ruling, review round 1 S3 and S4)
Should 4 patch: the one-clone test reads git's config key order — packages/cli/test/sandbox-guard.test.ts — not patched: Ruling 65 accepts the key-order risk, whose failure is loud (ledger Ruling, review round 1 S3 and S4)
Nice 5 patch: review round 1 N1 to N14 and its note — see ledger — deferred

## Round 2

Nice 1 patch: worktree.test.ts still hard-codes `accord: "0.3.0"` while its siblings derive it from PIN, and #68's versions stay literal — packages/cli/test/worktree.test.ts:2237, packages/cli/test/hook.test.ts:235 — deferred
Nice 2 patch: ac-3 and ac-1 read only pre-merge runs, so main's two renamed dashboard tests are checked only by plan step 6's merged run — packages/core/test/fixtures/st-ln-44/after-junit.xml — deferred

## Round 3

Nice 1 patch: copyClone of an inline template leaves the template's folders in the temp directory — packages/cli/test/sandbox-guard.test.ts:82, :100 — deferred

verdict: converged
