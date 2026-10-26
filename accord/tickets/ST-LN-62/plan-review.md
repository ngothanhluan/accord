# Plan review: ST-LN-62

## Round 1 (whole)

1. Must — `.claude/settings.json` is always flagged although `accord skills sync` writes it (skills.ts:82,134-142,222; hook commands carry the version), contradicting the last line of @ac-2; exempt it when its HEAD text equals the hook merge applied to its merge-base text — fixed
2. Must — the `verify:` ids of Tasks 1, 3, 6 and 7 are lower case `lane-s` while the test titles hold `lane S`; junit ids keep case (load/junit.ts:16), so `accord task-done` never records those tasks — fixed
3. Should — Tasks 1 and 4 add git spawns to cli/load/fs.ts but do not run packages/cli/test/spawn-surface.test.ts, whose scan (lines 90-94) flags a bare quoted `'log'`; add it to both tasks' test runs and say the step label is never the literal `'log'` — fixed
4. Should — `.github/workflows/accord.yml:127-145` runs gate done on every lane S ticket a pull request touches; a later pull request that edits an already-done lane S ticket file (for example ST-LN-61.md, whose `ac_hash` predates `## Scope`) then fails, as does a lane S ticket in flight at upgrade; the plan must say how such tickets are handled — fixed
5. Should — Task 4's `+++ b/<path>` parse keeps git's trailing tab for a path with a space (recalled from git diff.c, not cited), so an added `.command(`/`.option(` call there is never recorded; parse the path as git writes it or take paths from the `-z` listing — fixed
6. Nice — `gitFilesAt` throws `UsageError` on a failed `git cat-file`, so a failure can exit 2 instead of `{ error }` — deferred

## Round 2 (whole)

1. Should — the declaration regexes take the path as `(\S+)` and the sensitive entry pattern rejects spaces, so a lane M interface sign on a spaced path (Task 4's own `src/a b.ts`) has no way out and `Wording-only:` on a spaced path is dropped; capture the path up to ` — ` (`(.+)` for `Confirmed`), strip one pair of backticks, and test a spaced path in Task 2 — fixed
2. Should — lane.md step 1 (Task 6) asks accord-scout for the reading judgement and the settling question, which scout.md:10-11 forbids it to report, so the session states its own guess and @ac-1 does not hold in practice; ask the scout only for `path:line` facts (the locations a different reading would change, or "not found") and have the session form the question from them — fixed

## Round 3 (diff)

No findings

## Closed

Converged at round 3; baseline suite 1528 passed, 3 skipped, 0 failed.

## Round 4 (whole)

1. Should — Task 9 also loosens lane S: a lane S ticket whose ready commit and an out-of-scope change land on the default branch, then continues on its own branch, passes once the branch diff is not empty, while the old ticket-file trigger failed it; the Change note's case is lane M only — open
2. Nice — the new reason says "HEAD is at or behind the default branch", false when HEAD is ahead only by empty commits such as the claim commit; "HEAD adds no change over the merge base" holds in every empty-diff state — open
3. Nice — the kept Task 1 test title still says a diff without the ticket file fails closed; a comment in the test body should say Task 9 changed that — open
4. Nice — packages/core/src/gate/rules.ts:159's comment still says a diff without the ticket file fails closed, and Task 9's files line forbids rules.ts — open
