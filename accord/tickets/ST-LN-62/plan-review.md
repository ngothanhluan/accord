# Plan review: ST-LN-62

## Round 1 (whole)

1. Must — `.claude/settings.json` is always flagged although `accord skills sync` writes it (skills.ts:82,134-142,222; hook commands carry the version), contradicting the last line of @ac-2; exempt it when its HEAD text equals the hook merge applied to its merge-base text — open
2. Must — the `verify:` ids of Tasks 1, 3, 6 and 7 are lower case `lane-s` while the test titles hold `lane S`; junit ids keep case (load/junit.ts:16), so `accord task-done` never records those tasks — open
3. Should — Tasks 1 and 4 add git spawns to cli/load/fs.ts but do not run packages/cli/test/spawn-surface.test.ts, whose scan (lines 90-94) flags a bare quoted `'log'`; add it to both tasks' test runs and say the step label is never the literal `'log'` — open
4. Should — `.github/workflows/accord.yml:127-145` runs gate done on every lane S ticket a pull request touches; a later pull request that edits an already-done lane S ticket file (for example ST-LN-61.md, whose `ac_hash` predates `## Scope`) then fails, as does a lane S ticket in flight at upgrade; the plan must say how such tickets are handled — open
5. Should — Task 4's `+++ b/<path>` parse keeps git's trailing tab for a path with a space (recalled from git diff.c, not cited), so an added `.command(`/`.option(` call there is never recorded; parse the path as git writes it or take paths from the `-z` listing — open
6. Nice — `gitFilesAt` throws `UsageError` on a failed `git cat-file`, so a failure can exit 2 instead of `{ error }` — deferred
