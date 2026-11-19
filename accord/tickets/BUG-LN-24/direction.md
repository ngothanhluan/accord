# Direction: BUG-LN-24

## Impact list

Started from `accord/tickets/BUG-LN-24/scout.md`, then searched `packages/` for `taskVerdict`, `run accord gate plan`, `no plan_hash` and `changed after accord gate plan`, and `packages/core/skills/` for `plan_hash|gate plan`.

Changes:
- `packages/core/src/gate/task.ts:19` — the no-hash reason `plan.md has no plan_hash:; run accord gate plan ${id}`; becomes D-04's second sentence, with no ticket id.
- `packages/core/src/gate/task.ts:20` — the changed-plan reason `plan.md changed after accord gate plan last passed; run accord gate plan ${id} again`; becomes D-04's first sentence, with no ticket id. The check order (no plan, no hash, hash mismatch, then task) stays as it is.
- `packages/core/test/task.test.ts:63-74` — the `taskVerdict plan hash` block asserts both old sentences exactly (`:67`, `:71`); D-07 replaces it with two tests, one per criterion (`@ac-1`, `@ac-2`).
- `packages/cli/test/lane-commands.test.ts:863` — the test name "until gate plan runs again"; D-07 renames it with an `ac-3` id.
- `packages/cli/test/lane-commands.test.ts:878` — asserts the substring `plan.md changed after accord gate plan last passed`, which the new sentence breaks; it must assert the new sentence's start instead. Lines `:876-877` (exit 1 on the stale plan) and `:879-885` (gate plan again, then exit 0 and `- task 1 done`) are the `@ac-3` path and stay.

Reached, unchanged:
- `packages/cli/src/commands/task-done.ts:114` — the only caller of `taskVerdict`; `:128-132` prints each reason under `task <n> of <id> is not done:` and returns 1. This is what makes a `fail` verdict exit 1 in `@ac-1` and `@ac-2`.
- `packages/core/src/index.ts:113` — exports `taskVerdict`; the signature does not change (sensitive path, `accord/config.yml:52`, not touched).
- `test/helpers/lane.ts` — `PLAN`, `CONFIG`, `laneTicket`, `junit` used by the core tests; consumed as is.
- `packages/core/skills/build/SKILL.md:48-53` — step 7 fires "when `accord task-done` says `plan.md` changed"; D-04's first sentence keeps the words `plan.md changed`, so the skill still matches. Unchanged under D-05.
- `packages/core/skills/plan/SKILL.md:52-55` — the plan stage that runs `accord gate plan`; unchanged under D-05.
- Records that quote the old sentences, unchanged under D-05: `docs/plans/2026-10-12-phase-2-skills.md:681`, `accord/tickets/BUG-LN-23.md:34`, `accord/research/2026-11-14-rule-enforcement.md:158`, `accord/research/2026-11-14-rule-enforcement.md:220`.

No config entry, schema, generated skill copy or golden file holds either sentence: the search over `packages/` found them only in `task.ts` and the two test files.

## Options

### Option 1: Rewrite the two sentences in place — Recommended
Replace the two string literals at `packages/core/src/gate/task.ts:19-20` with D-04's sentences, word for word, with no ticket id. Replace the `taskVerdict plan hash` block with two core tests: each asserts the verdict is `fail`, its one reason equals the D-04 sentence, and the joined reasons do not contain `accord gate plan` (case-sensitive, D-06). Rename the CLI test at `lane-commands.test.ts:863` with an `ac-3` id and change its `:878` substring to the new sentence's start.
- Rung: minimum change to existing code; no new file, export or dependency.
- Cost: two literals, one test block, one test name and one assertion; about 25 lines.
- Risk: low. The only consumer prints reasons verbatim; build step 7 still matches `plan.md changed`. The plan skill's `SKILL.md:55` still tells the plan stage to run the gate, which is the stage allowed to.
- Serves: `@ac-1`, `@ac-2`, `@ac-3`, D-01, D-02, D-03, D-04, D-05, D-06, D-07.

### Option 2: Option 1, with `@ac-1` and `@ac-2` proved through `accord task-done`
The same two-literal change, but the two criteria are proved by CLI tests in `packages/cli/test/lane-commands.test.ts` that build a git repo, run `accord task-done T-1 1` in process and read the exit code and printed reason, instead of core tests.
- Climbs for: the "it exits 1" clause of `@ac-1` and `@ac-2`, observed at the command rather than as a `fail` verdict.
- Cost: two more git-repo CLI tests (the neighbouring tests need a 30 s timeout), against two millisecond core tests.
- Risk: contradicts D-07, which puts `@ac-1` and `@ac-2` in core tests; and the exit-1 wiring it would add proof for is unchanged code (`task-done.ts:132`), already exercised by `lane-commands.test.ts:877`.
- Serves: `@ac-1`, `@ac-2`, `@ac-3`, D-01 to D-06; not D-07.

Recommended: Option 1 — it is the lightest change that meets every criterion and follows D-07; Option 2 only moves proof of unchanged exit-code wiring into slower tests.

## Failure scenarios
Not required: the ticket touches no auth, money, migration or data deletion.
