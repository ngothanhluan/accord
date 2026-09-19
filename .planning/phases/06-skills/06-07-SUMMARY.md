---
phase: 06-skills
plan: 07
subsystem: cli
tags: [skills-sync, symlink, junction, lstat, orphan-scan, ascii-invariant, tdd]

# Dependency graph
requires:
  - phase: 06-skills
    provides: "`orphans()` and its `allSkillDirs()` scan set (06-05); `assertNoLink` and the write pre-pass (06-03)"
provides:
  - "`scannable()` — a per-component `lstat` walk that stops the orphan scan at a symlink or junction, the read side of T-06-03"
  - "an orphan report that cannot name, count, or aim an `rm -rf` at a directory outside the repository"
  - "a printed-output invariant (D-51) narrowed to the segments accord composes, with the filesystem-supplied entry name proven to print verbatim"
affects: [07-init, 08-mcp]

# Actuals (#2632) — chars/4 over the realized diff, not a harness token count.
# NOTE: the plan's `estimate.tokens: 55000` is a work-cost estimate, not a diff-size one; the two are
# not on the same scale, so the ratio below is not a calibration signal. Flagged rather than inflated.
actuals:
  tokens: 1596
  tasks: 2
  commits: 0
plan_head_before: 53e9df94051d2b1fc66f2e50c895684b74ee6b72

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two component walks, one per question: `assertNoLink` asks may accord WRITE here (a link is exit 2), `scannable` asks may accord LOOK here (a link is a skip)"
    - "An output invariant is asserted over the segments the program composes, and the segments read off the user's disk are removed from the line before the scan"

key-files:
  created: []
  modified:
    - packages/cli/src/commands/skills.ts
    - packages/cli/test/skills-sync.test.ts

key-decisions:
  - "A link on the way to a scan directory is skipped silently — no stderr line, no exit-code change — because D-113 forbids the orphan report from changing the exit code and D-123 forbids reporting a directory accord did not generate"
  - "`scannable` is kept separate from `assertNoLink` rather than merged: same walk, different question, different disposition; the doc comment says so to stop a later reader merging them"
  - "The D-51 invariant now asserts the whole line on stdout and, on stderr, only what remains after every `accord-*` entry name the sandbox holds is removed — the names are read back with `readdirSync`, never written as literals"
  - "The non-ASCII case compares against the name as `readdirSync` returns it, never the `'accord-caf\\u00e9'` literal used to create it, so no claim is made about host filesystem normalisation"

patterns-established:
  - "Tracer + TDD on a security guard: the RED is the exploit output itself, recorded verbatim, and the fix is judged by it going away"
  - "A narrowing test is paired with a widening test, so the guard cannot pass by disabling the thing it guards"

requirements-completed: [CLI-08]

coverage:
  - id: D1
    description: "A symlink or Windows junction at an undeclared target directory stops the orphan scan: nothing outside the repository is read, named, or aimed at, and the run still exits 0 (G-1 / NF-01)"
    requirement: CLI-08
    verification:
      - kind: unit
        ref: "packages/cli/test/skills-sync.test.ts#reads nothing through a link at an undeclared target directory, and still exits 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The guard narrows the scan by exactly the linked directory: a real orphan under a declared directory is still named on stderr in the same run (D-113 survives the fix)"
    requirement: CLI-08
    verification:
      - kind: unit
        ref: "packages/cli/test/skills-sync.test.ts#narrows the scan by the linked directory and nothing else"
        status: pass
    human_judgment: false
  - id: D3
    description: "The D-51 printed-output invariant covers the accord-composed segments — status word, DIRS-rooted prefix, advisory text — and no longer claims ownership of a name read off the user's disk"
    requirement: CLI-08
    verification:
      - kind: unit
        ref: "packages/cli/test/skills-sync.test.ts#prints no backslash and nothing outside ASCII on any host (D-51, PITFALLS section 12)"
        status: pass
    human_judgment: false
  - id: D4
    description: "An `accord-*` directory name outside ASCII reaches stderr intact, because that name is what the reader needs in order to remove the directory (NF-02)"
    requirement: CLI-08
    verification:
      - kind: unit
        ref: "packages/cli/test/skills-sync.test.ts#prints an accord-* name from the disk verbatim, above U+007F and all (NF-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The guard behaves identically on the POSIX CI leg, where `symlinkSync(..., 'junction')` creates a symlink rather than a junction"
    verification: []
    human_judgment: true
    rationale: "Every run in this plan was on Windows. Nothing is committed, so CI never ran either leg. `lstatSync().isDirectory()` is false for a POSIX symlink and for a Windows junction alike, so one code path is expected to cover both — expected, not observed. Recorded as WINDOWS ledger entry 7."

# Metrics
duration: 10 min
completed: 2026-09-17
status: complete
---

# Phase 06 Plan 07: Close the orphan scan's link-following read path Summary

**`orphans()` now walks every component of a scan directory with `lstat` before opening it, so a junction at an undeclared target directory can no longer route accord's orphan report — and its `rm -rf` advisory — out of the repository; the D-51 output invariant is narrowed to the text accord composes, with the user's own directory name proven to print verbatim.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-17T03:51:57Z
- **Completed:** 2026-09-17T04:02:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **G-1 (NF-01) closed.** `scannable(root, dir)` replaces the single link-following stat call in `orphans()`. It splits `dir` on `/` and requires `lstatSync(..., { throwIfNoEntry: false })?.isDirectory() === true` for every prefix — the same walk `assertNoLink` performs over the write set, applied for the first time to the scan set 06-05 widened past it.
- **The disposition differs from the write set on purpose.** A link in the write set is a refusal (exit 2, nothing written). A link in the scan set is a `continue`: no stderr line, no exit-code change. D-113 fixes that the orphan report must not change the exit code, and D-123 forbids reporting a directory accord did not generate — announcing the link would have traded one breach for a smaller one.
- **NF-02 advisory closed by narrowing, not by suppressing.** The D-51 case asserts the whole line on stdout and, on stderr, only what survives removing every `accord-*` entry name the sandbox actually holds. A new case proves the excluded segment is meant to print: a directory named `accord-café` is named on stderr exactly as `readdirSync` returns it.
- **The fix is 9 lines of logic and one changed line.** No new dependency, no new file, no change to `assertNoLink` or the write pre-pass.

## Task Commits

**Nothing was committed.** The project owner's CLAUDE.md carries a standing rule — never `git commit` or `git push` until they explicitly approve — and this plan's own `<success_criteria>` agrees: "Nothing is committed; the working tree is left dirty for the owner to review." Both files sit untracked/modified in the working tree alongside the rest of the uncommitted Phase 6 work.

| Task | Name | State | Files |
| ---- | ---- | ----- | ----- |
| 1 | A link at an undeclared target directory stops the scan instead of routing it | done, uncommitted | `packages/cli/src/commands/skills.ts`, `packages/cli/test/skills-sync.test.ts` |
| 2 | Narrow the printed-output invariant to the text accord composes | done, uncommitted | `packages/cli/test/skills-sync.test.ts` |

`actuals.commits: 0` is therefore expected, not a partial state. `plan_head_before` records the HEAD the working tree sits on: `53e9df9`.

## Files Created/Modified

- `packages/cli/src/commands/skills.ts` — added `scannable()` between `orphans()` and `assertNoLink()`; replaced one line inside `orphans()`; dropped `statSync` from the `node:fs` import.
- `packages/cli/test/skills-sync.test.ts` — added the `entryNames()` helper, the `linkOutside()` fixture and two link cases, amended the D-51 case, and added the NF-02 case. 24 → 25 cases in the file.

## Task 1 — the RED observation (plan `<verification>` item 3)

The two cases were written first and run against the unguarded `orphans()`. Both failed. Verbatim, from `npm test -- --project cli skills-sync`:

```
 ❯ |cli| test/skills-sync.test.ts (24 tests | 2 failed) 5508ms
   ❯ accord skills sync — what it refuses (5)
     × reads nothing through a link at an undeclared target directory, and still exits 0 177ms
     × narrows the scan by the linked directory and nothing else 391ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |cli| test/skills-sync.test.ts > accord skills sync — what it refuses > reads nothing through a link at an undeclared target directory, and still exits 0
AssertionError: expected 'created .claude/skills/accord-ba/SKIL…' not to contain 'accord-victim'

- Expected
+ Received

- accord-victim
+ created .claude/skills/accord-ba/SKILL.md
+ created .claude/skills/accord-ba/ready.md
+ created .claude/skills/accord-ba/setup.md
+ created .claude/skills/accord-ba/story.md
+ created .claude/skills/accord-designer/SKILL.md
+ created .claude/skills/accord-designer/prototype.md
+ created .claude/skills/accord-dev/SKILL.md
+ created .claude/skills/accord-dev/code-review.md
+ created .claude/skills/accord-dev/debug.md
+ created .claude/skills/accord-dev/prototype.md
+ created .claude/skills/accord-dev/review.md
+ orphan .agents/skills/accord-victim - no longer declared; accord never deletes - remove it with: rm -rf .agents/skills/accord-victim
+

 ❯ test/skills-sync.test.ts:411:27

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  |cli| test/skills-sync.test.ts > accord skills sync — what it refuses > narrows the scan by the linked directory and nothing else
AssertionError: expected [ Array(2) ] to deeply equal [ '.claude/skills/accord-designer' ]

- Expected
+ Received

  [
+   ".agents/skills/accord-victim",
    ".claude/skills/accord-designer",
  ]

 ❯ test/skills-sync.test.ts:425:29

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


 Test Files  1 failed (1)
      Tests  2 failed | 22 passed (24)
```

This is G-1 reproduced by the test rather than by hand: `accord-victim` lives entirely outside the sandbox repository, in a second `mkdtemp` directory reached through a junction at `.agents/skills`.

## The exact line replaced in `orphans()`

Before (two lines — the comment went with it, because `scannable`'s own doc comment now carries the "a first run has neither directory" case):

```ts
    // A first run has neither directory; `throwIfNoEntry` keeps that off the error path.
    if (!statSync(abs, { throwIfNoEntry: false })?.isDirectory()) continue;
```

After:

```ts
    if (!scannable(root, dir)) continue;
```

The `abs` binding above it is kept for the `readdirSync` below it. `statSync` no longer appears anywhere in the file — neither as a call nor as a token in a comment (`grep -n '\bstatSync\b' packages/cli/src/commands/skills.ts` → no match; `lstatSync` does not match that pattern).

The guard itself:

```ts
function scannable(root: string, dir: string): boolean {
  const parts = dir.split('/');
  for (let i = 0; i < parts.length; i++) {
    const found = lstatSync(join(root, ...parts.slice(0, i + 1)), { throwIfNoEntry: false });
    if (found?.isDirectory() !== true) return false;
  }
  return true;
}
```

## The link case's stderr, before and after

| | stderr | exit | stdout |
|---|---|---|---|
| **Before the guard** | `orphan .agents/skills/accord-victim - no longer declared; accord never deletes - remove it with: rm -rf .agents/skills/accord-victim\n` | 0 | 11 `created .claude/skills/...` lines |
| **After the guard** | `""` (empty) | 0 | 11 `created .claude/skills/...` lines |

The "after" row was measured, not inferred: a throwaway test reproduced the link case, appended `code=0`, `stderr=""` and `stdout_lines=11` to a temp file, and was deleted immediately afterwards. The stdout half is unchanged in both rows, which is the point — the write path never touched `.agents/**` (it is undeclared under `runtimes: [claude]`), and the guard changes only what the scan opens.

The path printed in the "before" row is the sharp end of it: `.agents/skills/accord-victim` is a repository-relative path aimed, through the junction, at a directory the repository does not contain. A reader pasting that `rm -rf` would delete something outside their own repository.

## Verification

| Plan verification item | Result |
|---|---|
| 1. `npm test -- --project cli skills-sync` | **PASS** — `Test Files 1 passed (1)`, `Tests 25 passed (25)` |
| 2. `npm run build && npm run lint && npm run typecheck && npm test` | **PASS** — build clean (`dist/cli.js 25.63 kB`), eslint silent, tsc silent, `Test Files 32 passed (32)`, `Tests 789 passed (789)` (threshold was ≥ 32 files) |
| 3. RED recorded for Task 1 | **PASS** — both cases failed against the unguarded `orphans()`; output quoted verbatim above |

Task acceptance criteria, each checked:

- `scannable` exists and calls `lstatSync` once per component of `dir` — yes.
- `statSync` absent from `packages/cli/src/commands/skills.ts` — yes (grep, no match). The first draft of the doc comment used the word in prose; it was reworded to keep the criterion literally true.
- `orphans()` reaches `readdirSync` only after `scannable(root, dir)` returned true — yes.
- `assertNoLink` and the write pre-pass at `skills.ts:95` unchanged — yes. (The file is untracked, so `git diff` shows nothing; the claim rests on the edits made, which touched only the import line, the one line inside `orphans()`, and the newly inserted function.)
- Reverting **only** the production change fails Task 1's cases and leaves Task 2's passing — **measured**, not assumed. With `scannable(root, dir)` swapped back for the link-following stat: `Tests 2 failed | 23 passed (25)`, the two failures being exactly Task 1's cases. Restored immediately afterwards.
- The amended D-51 case removes the entry names using `readdirSync` against the sandbox, not literals — yes (`entryNames()`).
- The NF-02 case plants a name above U+007F and compares against the value read back from disk — yes.
- Nothing moved into `packages/cli/test/spawn-surface.test.ts` — yes, untouched by this plan (it carries an unrelated pre-existing modification from an earlier Phase 6 plan). WINDOWS ledger entry 4 still describes the case accurately.

## Decisions Made

1. **`scannable` sits between `orphans()` and `assertNoLink`, not above `orphans()`.** The first placement split `orphans()` from its own D-113/D-123 doc comment, which would have silently re-attached that documentation to the new function. Moving it below puts the two component walks adjacent, which is where the "deliberately not merged" comment does the most good.
2. **The doc comment says "stat call", not the identifier.** Task 1's acceptance criterion is written as "the token `statSync` does not appear in the file". Prose mentioning it would satisfy the intent and fail the letter; the criterion was honoured as written.
3. **`linkOutside(repo)` is a shared four-line fixture, not duplicated setup.** Both link cases need the same second `mkdtemp`, the same `accord-victim/`, and the same junction; the second case exists only to stop the first passing by a scan that was switched off.

## Deviations from Plan

None — plan executed exactly as written. The two placement/wording adjustments above are decisions taken inside the plan's own instructions ("Say so in `scannable`'s doc comment"; "the token `statSync` does not appear"), not departures from them.

## Findings

**F-1 — the POSIX leg of the new link cases is unrun.** Everything in this plan ran on Windows. Nothing is committed, so CI has never run either leg of the Phase 6 work (the same condition WINDOWS entry 1 records for 06-01). `symlinkSync(target, path, 'junction')` ignores its third argument on POSIX and creates a symlink there, and `lstatSync().isDirectory()` is false for a POSIX symlink exactly as it is for a Windows junction — so one code path is *expected* to cover both legs. Expected, not observed. Recorded as WINDOWS ledger entry 7 and as coverage deliverable D5 (`human_judgment: true`).

**F-2 — `actuals.tokens` and the plan's `estimate.tokens` are not on the same scale.** The plan estimated 55000; the realized diff is 6385 characters, which is 1596 on the chars/4 `estimateTokens` scale the actuals contract specifies. The estimate reads as a work-cost figure (context read plus output), not a diff-size figure. The measured number is recorded unrounded rather than adjusted to look closer; the ratio should not be treated as a calibration signal until the two scales are reconciled.

**F-3 — the `edge_coverage` flag from the plan is still open.** The plan flagged that it treats "the scan set is the whole `DIRS` table and every member of it must be proven real before it is opened" as the CLI-08 edge worth closing, and that a different reading of the CLI-08 probe row would be unaddressed here. Nothing in execution resolved that; it remains the owner's call.

## Issues Encountered

None. Both tasks executed first time; the only rework was the two self-imposed corrections in "Decisions Made" (comment placement and comment wording), both caught before the task closed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- G-1 (NF-01) and the NF-02 advisory from `06-VERIFICATION.md` are both closed in the working tree. G-0, G-2 and G-3 are untouched by this plan.
- `.planning/phases/06-skills/06-08-PLAN.md` is the remaining plan in the phase (it claims SKILL-06 and SKILL-09 rows). Nothing in this plan's output blocks it: the two files touched here are not in 06-08's write set.
- **Blocker for the owner, not for the next plan:** the whole of Phase 6 is uncommitted by design. Until it is committed, no CI leg has run any of it, which is what keeps F-1 and WINDOWS entry 1 open.

## Self-Check: PASSED

- `packages/cli/src/commands/skills.ts` — present, contains `scannable`, contains no `statSync`.
- `packages/cli/test/skills-sync.test.ts` — present, 25 cases, all passing.
- `.planning/phases/06-skills/06-07-SUMMARY.md` — this file.
- Commits: none, by explicit owner policy and by this plan's own success criteria. `git status --short` shows both source files uncommitted.

---
*Phase: 06-skills*
*Completed: 2026-09-17*
