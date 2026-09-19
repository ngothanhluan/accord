---
phase: 06-skills
plan: 05
subsystem: testing
tags: [skills, cli, orphan-scan, skill-authoring, requirements]

requires:
  - phase: 06-skills
    provides: "skillDirs/skillTargets, the orphan report, the ten skill definitions, and skills sync"
provides:
  - "allSkillDirs() — the full DIRS union, the set the orphan scan opens"
  - "An orphan report that covers a dropped runtime as well as a dropped role"
  - "A regression that fails if any rendered skill names a path only accord's own repository has"
  - "Two step 2s followable from the brief alone"
  - "REQUIREMENTS.md matching what Phase 6 shipped"
affects: [07-init, 08-mcp]

# Actuals (#2632) — chars/4 over the realized diff, NOT a harness token count.
actuals:
  tokens: 3000
  tasks: 3
  commits: 0

# Nothing in this plan is committed, by the project owner's standing rule in .claude/CLAUDE.md.
# `commits: 0` is therefore intentional, not an uncommitted-work defect: HEAD is unmoved and every
# change sits in the working tree for review. See `## Prepared commits (not run)`.
plan_head_before: 53e9df94051d2b1fc66f2e50c895684b74ee6b72

tech-stack:
  added: []
  patterns:
    - "Scan set and declared set are separate values: the scan opens what the table can produce, the write path composes from what the config declares"
    - "A rendered-text scan for repository-only literals, listing every offender with path and line rather than aborting on the first"

key-files:
  created: []
  modified:
    - packages/core/src/skills/targets.ts
    - packages/core/src/index.ts
    - packages/cli/src/commands/skills.ts
    - packages/core/test/skills.test.ts
    - packages/cli/test/skills-sync.test.ts
    - packages/core/skills/dev/review.md
    - packages/core/skills/shared/prototype.md
    - packages/core/src/generated/skills.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "allSkillDirs() takes no argument: it reads the DIRS literal only, so widening the scan removes the config input from path composition rather than adding one (T-06-01 holds a fortiori)"
  - "The orphan judgement is two independent questions — is the directory declared, is the role declared — so a dropped runtime and a dropped role print the same line"
  - "The repository-only-path regression collects every offender before asserting, so the RED message named all six rendered files at once instead of aborting on the first"
  - "review.md step 2's lead-in gained `<scenario name>`: the placeholder lived only in the template the reader no longer opens, and the block shape has to be learnable from the brief alone"
  - "prototype.md step 2 names three of the header's four comment lines; `Rule:` is deliberately not described because describing it restates lint.token-hardcoded (D-126)"

patterns-established:
  - "Mutation check as an acceptance criterion: narrow the scan back to the declared subset by hand, watch the test go red, restore, and quote the message"

requirements-completed: [CLI-08, SKILL-09]

coverage:
  - id: D1
    description: "An accord-* directory abandoned by dropping a runtime is named on stderr, with the removal command, nothing deleted, exit 0"
    requirement: CLI-08
    verification:
      - kind: integration
        ref: "packages/cli/test/skills-sync.test.ts#names an accord-* directory a dropped runtime left behind, the same way (D-113)"
        status: pass
      - kind: integration
        ref: "packages/cli/test/skills-sync.test.ts#leaves no accord-* directory unreported, whichever runtime is dropped"
        status: pass
    human_judgment: false
  - id: D2
    description: "A config whose declared directory set already equals the full table prints nothing on stderr"
    requirement: CLI-08
    verification:
      - kind: integration
        ref: "packages/cli/test/skills-sync.test.ts#reports nothing when the declared set is already the whole table (runtimes: [cursor])"
        status: pass
    human_judgment: false
  - id: D3
    description: "The widened scan still names only accord's own directories (D-123), on the newly-scanned directory too"
    requirement: CLI-08
    verification:
      - kind: integration
        ref: "packages/cli/test/skills-sync.test.ts#never names a directory it did not generate (D-123)"
        status: pass
    human_judgment: false
  - id: D4
    description: "allSkillDirs() is the whole DIRS union and a superset of every single-runtime roster"
    requirement: CLI-08
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#allSkillDirs is the whole table and a superset of every roster (D-113)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No rendered skill text sends its reader to a file that exists only inside accord's own repository"
    requirement: SKILL-09
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#no rendered text sends its reader to a file that exists only in this repository"
        status: pass
      - kind: other
        ref: "! grep -rq 'packages/' packages/core/skills/ && ! grep -rq 'prototype-header' packages/core/skills/"
        status: pass
    human_judgment: false
  - id: D6
    description: "A reader can write verification.md from review.md step 2 alone, and start the prototype file from prototype.md step 2 alone"
    requirement: SKILL-09
    verification:
      - kind: other
        ref: "grep of the mandated literals in both step 2s (all 11 PASS); no file named outside ./code-review.md and accord/tickets/<id>/verification.md"
        status: pass
    human_judgment: true
    rationale: "Whether a brief is followable is a judgement about prose. The greps prove the structure is named and nothing unreachable is; that the reader can act on it is the owner's read."
  - id: D7
    description: "REQUIREMENTS.md records CLI-08 as delivered in both places and names packages/core/skills/ for SKILL-09, with SKILL-04 still open"
    requirement: CLI-08
    verification:
      - kind: other
        ref: "the four Task 3 <verify> greps — CLI-08 ticked + Complete, no docs/skills anywhere, SKILL-04 still [ ] and Pending, SKILL-09 clause amended"
        status: pass
    human_judgment: false

duration: 10 min
completed: 2026-09-16
status: complete
---

# Phase 6 Plan 5: Gap closure Summary

**The orphan scan now opens every directory the table can produce, so a dropped runtime reports like a dropped role; both step 2s are followable without a file the reader does not have; and REQUIREMENTS.md says what shipped.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-16T05:13:47Z
- **Completed:** 2026-09-16T05:24:10Z
- **Tasks:** 3 of 3
- **Files modified:** 9 source files, plus the two regenerated copies under `.claude/skills/accord-dev/`

## Accomplishments

- `allSkillDirs()` promotes the scan set to the full `DIRS` union, and `orphans()` judges directory and role independently — so dropping `codex` reports `.agents/skills/accord-ba`, `-designer` and `-dev` on stderr, deletes nothing, and exits 0.
- Three new orphan cases plus a widened D-123 case: a dropped runtime, an equal-sets no-op, and an invariant that leaves no `accord-*` directory unreported whichever runtime is dropped.
- A rendered-text regression that names every file sending its reader to a repository-only path, with the line — it caught all six copies before the prose was touched.
- `accord-dev/review.md` step 2 describes verification.md's three frontmatter keys and its block shape inline; `shared/prototype.md` step 2 describes the artifact and names three format slots, handing the rules to `accord lint`.
- CLI-08 ticked and `Complete`; SKILL-09's trailing clause names `packages/core/skills/`; SKILL-04 deliberately untouched.

## Task Commits

**None — by design.** The project owner's standing rule in `.claude/CLAUDE.md` forbids committing before review, and the orchestrator restated it for this plan. `HEAD` is still `53e9df9`, unmoved. See `## Prepared commits (not run)`.

## Prepared commits (not run)

What each task's atomic commit would have said, had committing been permitted:

1. `fix(06-05): scan every directory the DIRS table can produce, not the declared subset`
2. `fix(06-05): make both step 2s followable from the brief alone, and add the regression`
3. `docs(06-05): record CLI-08 as delivered and name the directory the definitions live in`

Plan metadata: `docs(06-05): complete the Phase 6 gap-closure plan`

## Files Created/Modified

- `packages/core/src/skills/targets.ts` — added `allSkillDirs()`, the deduped `cmp`-sorted union of every array in `DIRS`, with a doc comment stating it is the scan set and `skillDirs(config)` remains the write set.
- `packages/core/src/index.ts` — one line: `allSkillDirs` joins the named re-export from `./skills/targets.js`.
- `packages/cli/src/commands/skills.ts` — `orphans()` iterates `allSkillDirs()` and holds `declaredDirs`/`declaredRoles` as two separate sets; the D-113/D-123 doc comment states the promoted set. Prefix filter, `throwIfNoEntry` guard, string path composition, `found.sort()` and the printed line are all unchanged.
- `packages/core/test/skills.test.ts` — the `allSkillDirs` union + superset case, and the repository-only-path scan; the `names exactly one accord/-rooted path` comment lost its template-source clause.
- `packages/cli/test/skills-sync.test.ts` — three new orphan cases, an `orphanDirs()` line-parser, and a widened D-123 case that plants its decoy under both directories.
- `packages/core/skills/dev/review.md` — step 2 rewritten (below).
- `packages/core/skills/shared/prototype.md` — step 2 rewritten (below).
- `packages/core/src/generated/skills.ts` — regenerated by `npm run gen`; never hand-edited. Its `dev/review.md` and `shared/prototype.md` string values are the only content that moved.
- `.planning/REQUIREMENTS.md` — three lines (below).
- `.claude/skills/accord-dev/review.md`, `.claude/skills/accord-dev/prototype.md` — rewritten by `accord skills sync`, generated output, not edit targets.

## Evidence

### Task 1 — mutation check

Restoring `skillDirs(config)` as the loop set by hand, rebuilding and re-running
`npx vitest run --project cli skills-sync` produced:

```
FAIL  |cli| test/skills-sync.test.ts > accord skills sync — the orphan report (D-113, D-123) >
      names an accord-* directory a dropped runtime left behind, the same way (D-113)
AssertionError: expected [] to deeply equal [ '.agents/skills/accord-ba', …(2) ]

- Expected
+ Received

- [
-   ".agents/skills/accord-ba",
-   ".agents/skills/accord-designer",
-   ".agents/skills/accord-dev",
- ]
+ []
```

The invariant case failed on the same three directories, from the other side
(`expected [ '.agents/skills/accord-ba', …(2) ] to deeply equal []`). The source file was
restored and byte-compared against a pre-mutation copy (`RESTORED: identical to pre-mutation`),
rebuilt, and all 22 cases pass again.

### Task 2 — the regression, RED before the prose edit

```
FAIL  |core| test/skills.test.ts > render output invariants >
      no rendered text sends its reader to a file that exists only in this repository
AssertionError: expected [ …(6) ] to deeply equal []

+ [
+   ".agents/skills/accord-designer/prototype.md:30: `prototype-header.html` is the starting point: a single HTML file with a",
+   ".agents/skills/accord-dev/prototype.md:30: `prototype-header.html` is the starting point: a single HTML file with a",
+   ".agents/skills/accord-dev/review.md:27: `packages/core/templates/verification.md`. One `## @ac-n` block per scenario, in",
+   ".claude/skills/accord-designer/prototype.md:30: `prototype-header.html` is the starting point: a single HTML file with a",
+   ".claude/skills/accord-dev/prototype.md:30: `prototype-header.html` is the starting point: a single HTML file with a",
+   ".claude/skills/accord-dev/review.md:27: `packages/core/templates/verification.md`. One `## @ac-n` block per scenario, in"
+ ]
```

### `review.md` step 2 — before and after

Before:

```markdown
## 2. Write `accord/tickets/<id>/verification.md`

Start from the template the package ships at
`packages/core/templates/verification.md`. One `## @ac-n` block per scenario, in
tag order, each carrying:
```

After:

```markdown
## 2. Write `accord/tickets/<id>/verification.md`

The frontmatter carries `ticket:`, `commit:`, and `reviewed_on:`.
One `## @ac-n <scenario name>` block per scenario, in tag order, each carrying:
```

The two `Result:` / `Evidence:` bullets and the closing "Set `commit:` in the frontmatter to the
commit you reviewed." are byte-unchanged. The lead-in is the one existing sentence that gained
text: `<scenario name>` lived only in `templates/verification.md` line 8, the file the reader no
longer opens, and the block shape has to be learnable from the brief alone.

### `prototype.md` step 2 — before and after

Before:

```markdown
## 2. Start from the header accord ships

`prototype-header.html` is the starting point: a single HTML file with a
comment block at the top and an empty body. Fill in the comment block and
build the page underneath it. One file, no build step, no assets directory —
a reviewer opens it in a browser and it works.
```

After:

```markdown
## 2. Start from a single HTML file

One HTML file: a comment block at the top, an empty body. The comment block
names the ticket, a `Derived from:` line for what step 1 found, and the owner.
Build the page underneath it. `accord lint` reports anything the header is
missing. One file, no build step, no assets directory —
a reviewer opens it in a browser and it works.
```

Three of the header's four comment lines are named; `Rule:` is not, because describing it
restates `lint.token-hardcoded` (D-126). `packages/core/templates/prototype-header.html` keeps
its own `Rule:` line and is byte-unchanged, as is `templates/verification.md` — both confirmed
by an empty `git status --porcelain` on tracked files.

### The three changed lines of REQUIREMENTS.md

```diff
@@ line 67
-- [ ] **CLI-08**: `skills sync` regenerates skill copies with a generated marker and content hash
++ [x] **CLI-08**: `skills sync` regenerates skill copies with a generated marker and content hash

@@ line 79 (trailing clause only)
--  ... each finding naming a concrete failure scenario). Drafts live in `docs/skills/`
++  ... each finding naming a concrete failure scenario). The definitions live in `packages/core/skills/`

@@ line 186
-| CLI-08 | Phase 6 | Pending |
+| CLI-08 | Phase 6 | Complete |
```

Exactly three lines differ from a copy taken before the edit (`diff` reported 6 changed lines,
i.e. three `<`/`>` pairs). SKILL-04 is still `- [ ]` on line 74 and `Pending` on line 190.

## Verification run

Every command below was executed; these are the results seen, not expectations.

| Check | Result |
|---|---|
| `npm run gen` | `generated 7 templates` / `generated 10 skills` |
| `npm run check` (build + lint + typecheck + full suite) | **32 files, 786 tests, all passed** — 781 before, 5 added |
| `npx vitest run --project core skills` | 38 passed |
| `npx vitest run --project cli skills-sync` | 22 passed |
| `! grep -rq 'packages/' packages/core/skills/` | PASS (exit 0) |
| `! grep -rq 'prototype-header' packages/core/skills/` | PASS (exit 0) |
| `node packages/cli/dist/cli.js skills sync` ×2 | run 1: two `updated` lines for this repo's own copies, the rest `unchanged`; run 2: 0 lines not beginning `unchanged `, stderr empty, exit 0 both runs |
| `grep -rn 'node:fs\|node:path\|node:child_process' packages/core/src/` | one hit, a pre-existing *comment* in `targets.ts:31` explaining the ban — no import added |
| `git status --porcelain` / `git rev-parse --short HEAD` | changes in the working tree; HEAD still `53e9df9` |

## must_haves — how each was satisfied

**Truths**

1. *Dropped runtime names every `accord-*` directory under the abandoned directory, deletes nothing, exits 0* — `orphans()` iterates `allSkillDirs()`; the dropped-runtime case asserts the exact ordered list, unchanged bytes on all three `SKILL.md` files, `remove it with:` present, exit 0.
2. *A single-runtime config reports every directory under the other target directory and nothing under the declared one* — the invariant case, run for `[claude]` and `[codex]` in turn; the set difference is empty both ways.
3. *Declared set equal to the full union prints nothing* — the `runtimes: [cursor]` case asserts `err` is `''`.
4. *Orphan lines sorted by directory path* — `found.sort()` is unchanged and the dropped-runtime case compares an exact ordered array (`accord-ba`, `accord-designer`, `accord-dev`), not per-line `toContain`.
5. *No rendered skill text names a repository-only file* — the new scan is green over all 22 rendered files, and two grep guards cover the source definitions.
6. *`review.md` step 2 is self-sufficient* — the three frontmatter keys, the `## @ac-n <scenario name>` block shape, and both value lines are inline; the only files it names are `./code-review.md` and `accord/tickets/<id>/verification.md`.
7. *`prototype.md` step 2 is self-sufficient* — one HTML file, comment block, empty body, three named slots, `accord lint` for the rest; no other file named.
8. *REQUIREMENTS.md records CLI-08 in both places and SKILL-09 names the real directory* — all four Task 3 `<verify>` greps pass.

**Prohibitions**

1. *`sync` must not read, count, report on, or delete a directory it did not generate* — the `accord-` prefix filter is untouched and now proven on `.agents/skills` too (decoy planted under both, `codex` dropped, named on neither stream, still on disk). `grep -nE 'rmSync|unlinkSync|rmdirSync'` over the command finds nothing; the widened scan adds one shallow `readdirSync` and no write destination.
2. *The new prose must not restate what `lint`/`gate` check (D-126)* — step 2 names the `Derived from:` slot and hands everything else to `accord lint`. A grep over the new step 2 for `hard-cod|colour|color|spacing|missing or empty|not in the repository|outside the repo` returns nothing.
3. *The new prose must not depend on a file or command this phase does not ship* — `review.md` step 2 names no file at all beyond its own output; `prototype.md` step 2 names `accord lint`, which shipped in Phase 3/5.
4. *No checkbox ticked ahead of its evidence* — SKILL-04 is untouched and verified still open by its own `<verify>` grep.

## Decisions Made

- **The scan set and the declared set are two values, not one.** `orphans()` holds `declaredDirs` (from `skillDirs(config)`) and `declaredRoles` separately and pushes when *either* is undeclared. `skillTargets()` still composes from `skillDirs(config)` and is byte-unchanged — the write path was never the defect.
- **`allSkillDirs()` takes no argument.** Widening the scan *removes* the config input from this path rather than adding one, so T-06-01 ("the table is fixed in source and never read from config") is strengthened. The core test pins the return to the exact two-element literal, which goes red if a config value ever reaches it.
- **The regression collects offenders instead of aborting on the first.** The plan predicted a RED on `accord-dev/review.md`; because `output` is path-sorted, a first-failure assertion would have reported `.agents/skills/accord-designer/prototype.md` instead. Collecting every offender reported all six at once with path and line, which is both the stronger message and the honest one.
- **`review.md`'s lead-in gained `<scenario name>`.** Intentional, and the only existing sentence in step 2 whose text changed.
- **`prototype.md` names three of four comment lines.** `Rule:` is left undescribed on purpose (D-126); the template keeps it.

## Deviations from Plan

None — plan executed exactly as written. No deviation rule fired: no bug, no missing critical function, no blocker, and no architectural question arose.

## Issues Encountered

- **The CLI test suite resolves `@accord-dev/accord-core` through the built `dist`.** Adding `allSkillDirs()` to core source alone left 16 `skills-sync` cases failing with exit 2 (the import threw) until `npm run build` ran. Resolved by building; worth knowing that a core export added mid-task needs a build before CLI tests mean anything.
- **`diff` exits 1 when files differ**, which short-circuited an `&&` chain during the Task 3 line-count check. Re-run as separate commands; not a defect in the work.
- **STATE.md's "Plan: N of 6" counter was stale.** `state.advance-plan` incremented it from `1 of 6`
  to `2 of 6`, though five summaries (06-01..06-05) are on disk — earlier plans in this phase
  evidently did not advance it. `state.update-progress` declined to recompute ("phase scope is
  unscoped, not complete"). Corrected by hand to `Plan: 6 of 6` with the next plan named, so a
  resume reads the truth. The frontmatter `completed_plans` counter (32 → 33) was already correct.

## Observations (out of scope, not fixed)

Two things noticed while reading, both pre-existing and neither caused by this plan's changes. Recorded rather than fixed, per the scope boundary.

1. **`packages/core/src/skills/targets.ts` has two stacked doc comments above `skillDirs()`.** The first (lines 27-35, "Every file this configuration installs…", mentioning `node:path` and purity) describes `skillTargets`, but sits above `skillDirs`'s own comment, so `skillTargets` at line 45 has none. A comment-only relocation; it predates this plan and `allSkillDirs()` was added *below* `skillDirs` to leave it untouched.
2. **The new `prototype.md` heading removes the case that forced SKILL-08's code-span rule.** 06-03 restricted the command scanner to code spans and fenced blocks because `prototype.md:30` read "## 2. Start from the header accord ships" — English, not a command. That heading is now "## 2. Start from a single HTML file". The scanner is unaffected and stays correct; it is simply stricter than the surviving evidence requires. No change made.

## Known Stubs

None. No hardcoded empty value, placeholder, TODO, or unwired component was introduced; no test was skipped; every `<verify>` command in the plan was run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three 06-VERIFICATION.md gaps are closed. The two `behavior_unverified` items remain: ROADMAP criterion 7's manual half (the wrong-plan fixture read) and criterion 3's second clause (the eleven-file rule read, which is SKILL-04). Both are plan 06-06's, and SKILL-04 is deliberately still open here.
- **Nothing was committed.** No `git commit`, `push`, `stash`, `reset`, or `checkout --` was run at any point. `HEAD` is `53e9df9`, exactly where it was at plan start; every change in this plan — and everything plans 06-01 through 06-04 produced — sits in the working tree for the owner to review.

## Self-Check: PASSED

- All ten files named in `key-files.modified` (plus this SUMMARY) exist on disk.
- Commit check: `git log --oneline --all | grep -c "06-05"` returns `0`. That is the expected
  result here, not a failure — this plan commits nothing by the owner's standing rule, and the
  commit messages it would have used are recorded under `## Prepared commits (not run)`.
- Every plan-level `<verification>` command and every task `<verify>` command was run; results are
  in `## Verification run`.

---
*Phase: 06-skills*
*Completed: 2026-09-16*
