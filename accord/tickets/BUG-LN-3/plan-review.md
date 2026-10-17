# Plan review

## Round 1 (whole)
1. Should — Tasks 1 to 3 never say the stub tests read the built core: `workflow-script.test.ts:24` imports `initFiles` from `@accord-dev/accord-core`, which resolves to `dist/index.js`, so an edit to `workflowYml` reaches no test until `npm run build`; an executor running Task 1's new case unbuilt sees the baseline failure and edits blind. Fix: each of Tasks 1 to 3 says to build core before running any case in the file (lens build) — fixed
2. Should — Task 1 defines an unsettled read as an `ls-tree`/`git show` failure or no closing `---`, but not a file whose first line is not `---`; the Approach counts "a version present but no `---` block found" as approved, and the existing `mutation probe` case's nested `accord/tickets/SIGNUP-1/verification.md` (`v`, no frontmatter) needs it: read as no keys, it is skipped and `calls.length` is 1, not 2. Fix: a missing opening or closing line returns 2, naming the probe as the case that relies on it (lenses build and criteria) — fixed
3. Should — Task 2 cases 4 and 5 give SIGNUP-1 `approved_hash` and `status: dropped` with no valid `## Dropped`, and expect no `gate done`; by the criteria's definition comment and D-02 that ticket is approved and not dropped, so @ac-3 requires the gate. Fix: drop the `approved_hash` line from cases 4 and 5; case 3 keeps it for "approved or not" (lens criteria) — fixed
4. Should — The CR states Task 2 case 1 and Task 3's `risk:parsing` case 1 build are stripped on commit wherever `core.autocrlf=true` (the Git for Windows and `windows-latest` default), since `commitAll` (`packages/cli/test/helpers/repo.ts:71-77`) runs `git add -A` and the sandbox has no `.gitattributes`; a dropped regex without CR absorption passes on Windows and fails only on ubuntu. Fix: those cases write `.gitattributes` with `* -text` into the sandbox before committing (lens criteria) — fixed
5. Nice — Rule line 14 cites a test "finds no denied name in the config, the workflow, or the pointer block" that does not exist in the tree (lens build) — deferred
6. Nice — Task 4 does not say whether Task 3's `risk:parsing` cases join the shared @ac-4 case array (lens build) — deferred
7. Nice — `risk:parsing` case 3 (approved, 2 MB, expect gated) passes even with the forbidden `git show | awk` pipeline, since 141 reads as unsettled and gates; a large unapproved draft expecting "not gated" would catch it (lens criteria) — deferred

## Round 2 (diff)
fixed: 1.1, 1.2, 1.3, 1.4
No findings

## Closed
