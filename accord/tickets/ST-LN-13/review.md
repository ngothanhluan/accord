Round record: 1

## Round 1

Should 1 [patch]: `worktree clean` keeps a dropped claim branch only for a listed `.md` research record, so a listed non-Markdown record only that branch holds is deleted with it; `accord drop` refused such an entry with a misleading "not a file" reason — packages/cli/src/commands/worktree.ts:909, packages/cli/src/commands/drop.ts:82 — fixed in 57618a0e
Should 2 [patch]: two `risk:data-loss` tests assert whole skill sentences, so a re-wrap of the skill text fails them — packages/core/test/stage-skills.test.ts:712, packages/core/test/stage-skills.test.ts:1132 — fixed in 57618a0e
Nice 3 [patch]: `worktree clean` deletes a dropped branch without a `kept` line when the ticket at its tip fails to parse — packages/cli/src/commands/worktree.ts:909 — deferred
Nice 4 [patch]: `accord drop` refuses as "differs from the copy on main" when main edited a listed record after the claim and the branch never changed it — packages/cli/src/commands/drop.ts:98 — deferred
Nice 5 [patch]: the backslash parsing test bundles four behaviours under one name — packages/core/test/research.test.ts:74 — deferred
Nice 6 [patch]: the `priority?` line lost its space before `//`, an unrelated edit — packages/core/src/model/snapshot.ts:102 — deferred
Nice 7 [patch]: `lint.research-reference` sits between the `depends-*` rules — packages/core/src/lint/rules.ts:59 — deferred

## Round 2

Nice 1 [patch]: the workflow spec still says clean keeps a branch only for a listed `.md` record and omits drop's non-`.md` refusal, which round 1 changed — docs/specs/2026-10-12-workflow-layer-design.md:80 — deferred
Nice 2 [patch]: the record template's `git rev-parse --short HEAD` follows `core.abbrev`, which can print fewer than the 7 hex digits lint requires — packages/core/skills/intent/research.md:22 — deferred

verdict: converged

## Return from verify f4a8bb79a675509a6b365c29af4a66150b6ffa06

## Round 1

Nice 1 [patch]: the regenerated `.claude/skills` copies listed under `## Undeclared files` were not named in the merge Ruling — accord/tickets/ST-LN-13/ledger.md:62 — fixed in 61b07826
Nice 2 [patch]: the research overlay spawns one `git cat-file --batch` per claimed ticket that adds an unseen record — packages/cli/src/load/fs.ts:1133 — deferred

## Round 2

Should 1 [patch]: `review.md` has no `Round record: 1` line, so main's `gate.review-rounds` (ST-LN-17) fails `accord gate done` after the merge — accord/tickets/ST-LN-13/review.md:1 — open
