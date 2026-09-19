---
phase: 07-scaffolding-and-example-repo
plan: 15
subsystem: scaffolding
tags: [scaffold, config-yml, vitest, anchoring, wording]

requires:
  - phase: 07-scaffolding-and-example-repo
    provides: "07-10's commented `tests:` block (owner ruling WR-01); 07-14's edits to `packages/core/test/scaffold.test.ts` (the `test/helpers/denied.js` import), preserved untouched by this plan"
provides:
  - "A generated `config.yml` whose `tests:` instruction names BOTH halves of the edit: remove the `\"# \"` (hash and space), and point `report:` at the file the team's own runner writes"
  - "An A-33 assertion anchored on its own key line on BOTH sides — `lines.indexOf('# tests:')` and `exLines.indexOf('tests:')` — with no numeric-literal slice anywhere in it"
  - "A content guard on the extracted pair, so a future instruction one line longer or shorter fails naming the offset rather than the claim"
affects: [09-publish, phase-9-dogfood, any-future-edit-to-the-CONFIG-literal]

actuals:
  tokens: 21400
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Anchor both sides of a cross-file quotation assertion on their own key line, never one side on a numeric slice — the side pinned by an integer is the side that silently compares the wrong lines"
    - "Pair a positional slice with a content assertion on its first element, so a shifted block fails naming the offset instead of failing on the claim"

key-files:
  created: []
  modified:
    - packages/core/src/scaffold/init.ts
    - packages/core/test/scaffold.test.ts

key-decisions:
  - "The instruction's wording is the plan's verbatim two lines. Nothing was invented: `\"# \"` stays quoted so hash and space read as one thing to delete, and the second line says \"the path your own test runner writes its report to\" rather than naming a format or a tool — which is also why no sample path accord can pick would have been right."
  - "The sample value stays `#   report: reports/junit.xml` (A-51). Owner ruling WR-01 settled the block's shape; changing the sample would re-open a decision this run is told not to re-open."
  - "`examples/build/accord/config.yml` was not edited. Proven by content hash, not by `git status` — `examples/` is untracked, so a status check there can never be empty."

patterns-established:
  - "Demonstrate a fragile assertion before fixing it: task 1's reword was allowed to turn the A-33 case red, and that red is recorded verbatim here. An assertion that stayed green while the block it reads moved would be an assertion that is not reading the block."

requirements-completed: [CLI-02, INTG-02]

coverage:
  - id: D1
    description: "The generated `config.yml` names both halves of the `tests:` edit — the `\"# \"` including the space, and pointing `report:` at the team's own report file"
    requirement: CLI-02
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#is one anchored uncomment away from a config carrying tests.report (WR-01) — still green, so the reword disturbed neither key line"
        status: pass
      - kind: manual_procedural
        ref: "throwaway sandbox: `init`, then the literal edit in two stages — first half only gives `0 errors, 1 warnings`; both halves give `0 errors, 0 warnings` (transcript below)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Following the instruction literally reaches a repository that lints clean once the team's report exists, and whose generated CI job's `gate done` can pass"
    requirement: CLI-02
    verification:
      - kind: manual_procedural
        ref: "sandbox stage C — `tests.report: test-results/junit.xml` with that file present, `accord lint` exits 0 with `0 errors, 0 warnings` and no `lint.report-missing`"
        status: pass
    human_judgment: false
  - id: D3
    description: "The A-33 assertion anchors both sides on their own `tests:` key line, so a line inserted or deleted above the block in either file cannot make it compare unrelated lines"
    requirement: INTG-02
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#copies the example's two tests: comment lines word for word (A-33) — `lines.indexOf('# tests:')` and `exLines.indexOf('tests:')`, both guarded, no numeric slice"
        status: pass
    human_judgment: false
  - id: D4
    description: "That assertion goes red when the block it reads moves, and names the offset rather than the claim"
    requirement: INTG-02
    verification:
      - kind: manual_procedural
        ref: "task 1's intentional RED (block moved by one line, recorded verbatim below), plus a probe that inserted a third instruction line and produced `the extracted pair does not start at the copied comment block`"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-19
status: complete
---

# Phase 7 Plan 15: The Instruction Names Both Halves of the Edit Summary

**The generated `config.yml`'s `tests:` instruction now names the `"# "` including its space and tells a team to point `report:` at their own runner's file, and the assertion that binds those comment lines to the example is anchored on a key line on both sides — seen red when the reword moved the block, and green after.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-19T09:05Z
- **Tasks:** 2 of 2
- **Files modified:** 2

## Accomplishments

- `packages/core/src/scaffold/init.ts` — one instruction line became two. `# Uncomment the two lines below before the first ticket carrying an @test: scenario.` is gone; in its place:

  ```
  # Before the first ticket carrying an @test: scenario, remove the "# " from the two lines below and
  # change report: to the path your own test runner writes its report to.
  ```

  The two copied comment lines above are byte-identical to `examples/build/accord/config.yml` lines 29–30, and the sample value line is still `#   report: reports/junit.xml` with two spaces of indentation inside the comment.

- `packages/core/test/scaffold.test.ts` — the A-33 case's body is re-anchored. `example.split('\n').slice(28, 30)` is gone; the example side is now `exLines.slice(exKey - 2, exKey)` off `exLines.indexOf('tests:')`, guarded with `no "tests:" line in the example config`. The generated side reads `lines.slice(key - 4, key - 2)` for the two-line instruction, and its first element is asserted to contain `Where the test report lands`.

## Task 1 RED — the evidence for GC-WR-04

After the reword, before any test edit (`npm run build && npx vitest run --project core scaffold`, exit 1):

```
 FAIL  |core| test/scaffold.test.ts > initFiles — the config it plans > copies the example's two tests: comment lines word for word (A-33)
AssertionError: expected [ …(2) ] to deeply equal [ …(2) ]

- Expected
+ Received

  [
-   "# Where the test report lands. `accord gate done` reads it to check that the test behind each",
    "# @test: tag really passed; without it there is no Done.",
+   "# Before the first ticket carrying an @test: scenario, remove the \"# \" from the two lines below and",
  ]

 ❯ test/scaffold.test.ts:144:43

 Test Files  1 failed (1)
      Tests  1 failed | 35 passed (36)
```

Written out, the two arrays the old assertion compared:

| | element 0 | element 1 |
|---|---|---|
| **Received** (`lines.slice(key - 3, key - 1)`) | `# @test: tag really passed; without it there is no Done.` | `# Before the first ticket carrying an @test: scenario, remove the "# " from the two lines below and` |
| **Expected** (`example.split('\n').slice(28, 30)`) | ``# Where the test report lands. `accord gate done` reads it to check that the test behind each`` | `# @test: tag really passed; without it there is no Done.` |

The received window had slid down by exactly one line: element 1 of Expected became element 0 of Received. The comparison was off by the length of the instruction, which is the fragility GC-WR-04 names. This is a valid intentional RED: exactly the target case failed, on the assertion for the planned behaviour, with the other 35 cases in the same file green — including `is one anchored uncomment away from a config carrying tests.report (WR-01)`, which proves the reword left the two key lines alone.

## Task 2 GREEN, and the guard guarded

After re-anchoring (`npm run build && npx vitest run --project core scaffold`):

```
 Test Files  1 passed (1)
      Tests  36 passed (36)
```

The content guard was then proven to bind, not just to sit there. A third instruction line (`# PROBE LINE.`) was temporarily inserted into the `CONFIG` literal and the suite re-run:

```
 FAIL  |core| test/scaffold.test.ts > initFiles — the config it plans > copies the example's two tests: comment lines word for word (A-33)
AssertionError: the extracted pair does not start at the copied comment block: expected '# @test: tag really passed; without i…' to contain 'Where the test report lands'

Expected: "Where the test report lands"
Received: "# @test: tag really passed; without it there is no Done."

 ❯ test/scaffold.test.ts:151:88
```

The failure names the **offset** — "the extracted pair does not start at the copied comment block" — rather than claiming the copied text drifted from the example. That is the difference between the fixed assertion and the one it replaced. The probe line was removed and the bundle rebuilt immediately.

## The example was not edited — proven by hash

```
$ git hash-object examples/build/accord/config.yml > 07-15-example-before.log
$ cat 07-15-example-before.log
4163c64594f0ba3d86ab9b23a21c2f414de88bbf

  … task 2's edits …

$ git hash-object examples/build/accord/config.yml > 07-15-example-after.log
$ git diff --no-index --quiet 07-15-example-before.log 07-15-example-after.log
$ echo $?
0
```

Identical content hash before and after. A `git status --porcelain` check could not have served this purpose: `examples/` is untracked, so it prints a line for that file whether or not anyone edits it. Both `.log` files are covered by `.gitignore:3` (`*.log`) and are left in the repository root as the evidence artifacts the plan asked for.

## Verification step 2 — the sandbox transcript

A throwaway repository outside the working tree, driven through the built CLI by absolute path (`node …/packages/cli/dist/cli.js`), following the new instruction literally and in stages.

**A. `init`, block still commented** — 31 paths created; the shipped stanza reads:

```
# Where the test report lands. `accord gate done` reads it to check that the test behind each
# @test: tag really passed; without it there is no Done.
# Before the first ticket carrying an @test: scenario, remove the "# " from the two lines below and
# change report: to the path your own test runner writes its report to.
# tests:
#   report: reports/junit.xml

$ accord lint
0 errors, 0 warnings          (exit 0)
```

**B. First half only** — `"# "` removed from the two lines, accord's sample path left in place. This is what the OLD instruction produced, and it is what the new second line exists to prevent:

```
$ accord lint
accord/config.yml: warning lint.report-missing tests.report "reports/junit.xml" is not in the snapshot
0 errors, 1 warnings
```

**C. Both halves** — a report written where the team's runner would write it (`test-results/junit.xml`), and `report:` pointed at it:

```
$ tail -2 accord/config.yml
tests:
  report: test-results/junit.xml

$ accord lint
0 errors, 0 warnings          (exit 0)
```

No `lint.report-missing`. The previous round recorded `0 errors, 1 warnings` at this point, because the old instruction stopped before the step that clears it. Naming that step is the whole of GC-WR-03.

**D. The ambiguity half** — deleting only the `#` from `# tests:`, leaving ` tests:`:

```
$ accord lint
accord/config.yml:28: error load.yaml-syntax All mapping items must start at the same column at line 28, column 1:
1 errors, 0 warnings

$ accord skills sync
accord/config.yml is missing or failed its schema; run accord lint          (exit 2)
```

Both diagnostics fire, which is why the first instruction line quotes `"# "` as one thing to delete. (See finding 2 — which of the two messages a user meets depends on the command.)

## Verification step 3 — reading the stanza as a team would

Four comment lines then the key: two saying what the key is for, two saying what to do. The second pair names an edit that is complete — remove `"# "` from these two lines, and change `report:` to your own path — and nothing in it needs a second source to act on. Stage C is the proof that acting on it literally lands on `0 errors, 0 warnings`.

## Full verification

`npm run gen` (exit 0, no new drift in `packages/core/src/generated/`), then `npm run check` (build + lint + typecheck + test), exit 0:

```
 Test Files  36 passed (36)
      Tests  888 passed (888)
```

Identical to the dispatch baseline of **36 files / 888 tests**. This plan rewrote one case's body and added no case, so an unchanged count is the expected result — a changed count here would have meant a case was lost.

## Deviations from Plan

None. The plan executed as written: the reword first, the RED recorded, the assertion re-anchored second.

One tooling note, not a repository issue: heredoc-delivered Node scripts written through the Bash tool had their `\\n` sequences collapsed to real newlines, which briefly wrote a literal line break into two `split()` calls in `scaffold.test.ts`. Caught immediately by reading the file back, and repaired by building the backslash with `String.fromCharCode(92)`. The same class of escape loss that 07-14 recorded for its ad-hoc scans; worth a future executor's attention when editing source through that path.

## Findings for the owner

**1. Not committed, by instruction.** `actuals.commits: 0` is deliberate. The dispatch suspended this executor's commit protocol under the standing rule in `.claude/CLAUDE.md`, and the uncommitted phase 6/7 work is still awaiting review. HEAD is unchanged at `53e9df9`. Both edited files are untracked (`??`), having been created by earlier uncommitted plans in this phase.

**2. The plan's claim about the hash-only edit is true for config-reading commands, but `lint` answers differently — recorded rather than assumed.** The plan and `07-REVIEW.md` §GC-WR-03 both say that after deleting only the `#`, "every command answers `accord/config.yml is missing or failed its schema; run accord lint`." Measured: `accord skills sync` does exactly that and exits 2, but `accord lint` itself reports `accord/config.yml:28: error load.yaml-syntax …` and exits 0 with `1 errors`, and `accord status` in a repository with no tickets prints `no tickets to show in accord/tickets/` and exits 0 without reading the config at all. Every path is loud or harmless, so the instruction's quoting of `"# "` is justified either way and nothing here changes the fix. Raising it only so the review's wording is not carried forward as measured fact when it is a generalisation.

**3. `packages/core/src/model/snapshot.ts:42` still carries a denied name in a line comment.** Raised by 07-13 and 07-14, deliberately not actioned by any plan in this run, and not touched here either. Awaiting the owner's ruling.

**4. Two evidence files left in the repository root.** `07-15-example-before.log` and `07-15-example-after.log`, created by the plan's own verify commands. Both are gitignored (`*.log`) so they do not appear in `git status`. Delete them whenever; they are the before/after hashes quoted above.

## Issues Encountered

None in the repository.

## Next Phase Readiness

- GC-WR-03 and GC-WR-04 — the last two warnings of `07-REVIEW.md`'s gap-closure pass — are closed. The gap-closure run for phase 07 has no open warnings left.
- No lint rule and no gate rule moved (07-CONTEXT scope fence held), and the commented-block shape settled by ruling WR-01 is untouched.
- The `CONFIG` literal now has a test that fails by naming the offset when the instruction's length changes, so the next plan to touch that block gets a diagnosis rather than a puzzle.

## Self-Check: PASSED

Commit verification replaced per the dispatch's override — each key-file must exist on disk AND appear in `git status --short`:

| File | On disk | In `git status --short` |
|---|---|---|
| `packages/core/src/scaffold/init.ts` | yes | `?? packages/core/src/scaffold/init.ts` |
| `packages/core/test/scaffold.test.ts` | yes | `?? packages/core/test/scaffold.test.ts` |

`.planning/phases/07-scaffolding-and-example-repo/07-15-SUMMARY.md` exists. Nothing was committed: `git rev-parse HEAD` is `53e9df94051d2b1fc66f2e50c895684b74ee6b72`, unchanged from dispatch.

---
*Phase: 07-scaffolding-and-example-repo*
*Completed: 2026-09-19*
