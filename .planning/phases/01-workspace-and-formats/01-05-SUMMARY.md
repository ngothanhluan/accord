---
phase: 01-workspace-and-formats
plan: 05
subsystem: docs
tags: [readme, design-doc, requirements, roadmap, vitest, convention-test, folder-convention]

# Dependency graph
requires:
  - phase: 01-workspace-and-formats (plans 01, 03, 04)
    provides: "The schemas (`ticket`, `verification`, `config`) and the seven templates whose vocabulary (`epic | story | bug`, `verified`, `ba | dev | designer`, `tickets/<id>/verification.md`, fixed root `accord/`) the documents now describe"
provides:
  - "README.md and docs/design.md §2–§5 describe the fixed root `accord/`, the ticket types, the three roster roles, the fresh-context review, and the `verified` three-set match"
  - "REQUIREMENTS.md FMT-01, FMT-02, FMT-06, FMT-07, OPS-01, SKILL-01, SKILL-06, SKILL-07, GATE-02, GATE-05, LINT-05 carry the CONTEXT.md 'Requirement text updates'"
  - "PROJECT.md Constraints, Active bullets, Key Decisions, and Out of Scope use the Phase 1 vocabulary; ROADMAP.md Phase 1 goal and criterion 5 plus the rename in Phases 3, 4, 6, 9; `.claude/CLAUDE.md` Tech stack line"
  - "`packages/core/test/convention.test.ts`: 5 grep tests over README.md and design.md §2–§5 that go red on the old layout or vocabulary"
affects: [phase-2-loaders, phase-6-skills, phase-8-mcp, phase-9-publish]

# Actuals (#2632) — chars/4 over the realized diff, same scale as the plan's estimate (38000).
actuals:
  tokens: 3500    # 14,012 chars: 5,285 tracked-file diff lines + 3,053 test file + 5,674 edited lines in REQUIREMENTS/ROADMAP/PROJECT
  tasks: 3
  commits: 0      # owner commits after review (no-commit policy)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Documentation truths are pinned by grep tests in `npm test`; retired names are built by string concatenation in the test so the test file itself never carries them"
    - "Section slicing by heading prefix with a length guard, so a heading rename cannot make a slice test vacuously pass"

key-files:
  created:
    - packages/core/test/convention.test.ts
  modified:
    - README.md
    - docs/design.md
    - .planning/REQUIREMENTS.md
    - .planning/PROJECT.md
    - .planning/ROADMAP.md
    - .claude/CLAUDE.md

key-decisions:
  - "Two PROJECT.md vocabulary fixes beyond the plan's list (`design source` dropped from the config bullet per D-15; `orphaned QA tick` became `orphaned \\`verified\\` tick` per D-03) so no retired vocabulary remains in PROJECT.md"
  - "`Last updated` lines in REQUIREMENTS.md and PROJECT.md carry the real date 2026-09-06, not the 2026-09-05 the plan text spelled out"

patterns-established:
  - "Convention test: README.md and design.md §2 are read from the repo root via `new URL('../../../', import.meta.url)`; sections are sliced between `## N.` headings"

requirements-completed: [FMT-01, OPS-01, FMT-02, FMT-06, FMT-07]

coverage:
  - id: D1
    description: "README.md documents the fixed root, `product/`, `tickets/<id>.md`, `tickets/<id>/verification.md`, `assets/<id>/`, `parent:` grouping, and a `tracker:` map example, with no per-epic folder"
    requirement: FMT-01
    verification:
      - kind: unit
        ref: "packages/core/test/convention.test.ts#README documents the folder convention"
        status: pass
    human_judgment: false
  - id: D2
    description: "design.md §2 states the root is always `accord/` and not configurable, lists the ticket types and frontmatter keys, the body headings, and `tickets/<id>/verification.md`; no legacy folder or `overridable`"
    requirement: FMT-01
    verification:
      - kind: unit
        ref: "packages/core/test/convention.test.ts#design.md §2 documents the fixed root and the ticket types"
        status: pass
    human_judgment: false
  - id: D3
    description: "README and design.md name `verified` as the developer tick key and `review.md` / `fresh agent context` as the only writer of verification.md; no retired tick key in README or §2–§5; §4 has no Lead bullet"
    requirement: FMT-01
    verification:
      - kind: unit
        ref: "packages/core/test/convention.test.ts#documentation names the developer tick key and the fresh-context review"
        status: pass
      - kind: unit
        ref: "packages/core/test/convention.test.ts#no retired vocabulary in README or design §2–§5"
        status: pass
    human_judgment: false
  - id: D4
    description: "REQUIREMENTS.md, PROJECT.md, ROADMAP.md, and `.claude/CLAUDE.md` carry the CONTEXT.md text updates (three workspaces, fixed root, `verified`, `epic | story | bug`, three roles, seven templates, dev-run fresh-context review) and no `qa.ticks`"
    requirement: OPS-01
    verification:
      - kind: other
        ref: "Task 1 <verify> grep chain (exit 0) and the per-criterion grep counts recorded under Verification Output"
        status: pass
    human_judgment: false
  - id: D5
    description: "README.md and design.md §2–§5 read correctly as prose for a BA, designer, developer, and QA (tree renders on GitHub; role paragraphs are coherent)"
    verification: []
    human_judgment: true
    rationale: "Wording and rendering are judgment; the tests pin phrases, not readability. The plan's own <verification> lists a manual read-through at end of phase."

# Metrics
duration: 5min
completed: 2026-09-06
status: complete
---

# Phase 1 Plan 05: Documentation and Requirement-Text Updates Summary

**README.md, docs/design.md §2–§5, REQUIREMENTS.md, PROJECT.md, ROADMAP.md, and the CLAUDE.md constraint line now describe the contract the Phase 1 schemas and templates enforce (fixed root `accord/`, `epic | story | bug`, `verified` as the developer's last frontmatter key, roster `ba | dev | designer`, the dev skill's fresh-context `review.md` step as the sole writer of `tickets/<id>/verification.md`, three npm workspaces), and a 5-test grep suite in `npm test` keeps the two public documents from regressing; `npm run check` is green on Windows with 64 tests.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-06T02:24:25Z
- **Completed:** 2026-09-06T02:29:03Z
- **Tasks:** 3
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- REQUIREMENTS.md: eleven requirement texts replaced per the CONTEXT.md table (FMT-01, FMT-02, FMT-06, FMT-07, OPS-01, SKILL-01, SKILL-06, SKILL-07, GATE-02, GATE-05, LINT-05); the Traceability table and every other line untouched; a second `Last updated` line appended.
- PROJECT.md: Tech stack constraint, the folder and config bullets, the three Done-gate bullets, the role-workflow list (reviewer bullet folded into dev), four Key Decisions rows, the Out of Scope per-epic-folder row, and the trailing date.
- ROADMAP.md: Phase 1 goal ("three-workspace monorepo") and criterion 5 ("fixed root `accord/`"); `qa.ticks` renamed in Phase 3 criterion 4 and Phase 4 criterion 2; Phase 6 criteria 1 and 4 and Phase 9 criterion 3 reworded to three definitions, the dev skill's review step, and the developer's `verified` ticks. All nine `### Phase N:` headers and the Phase 1 Plans list unchanged.
- `.claude/CLAUDE.md`: the one Tech stack line now matches PROJECT.md.
- README.md: folder bullet with the full tree and a `tracker: { shortcut: "1234" }` example, fixed headings, the two gates with the fresh-context review and `verified`, four runtimes and three roles, QA in the first paragraph and the roles bullet, and "Not a server" replaced by "Not a database" with the stateless MCP server.
- docs/design.md: §2 fixed root sentence, the RESEARCH tree, one-file-type paragraph, the D-04 frontmatter list, the D-07 body headings; §3 `epic ticket` wording and `status: archived`; §4 roster sentence, Lead folded into BA, QA outside the repo, the reviewer paragraph, Codex added; §5 Ready table last row and the Done paragraph with the three-set match and the AC hash. Sections 1, 6, 7, 8, 9 untouched.
- `convention.test.ts`: 5 tests (the four the plan asked for plus a non-empty-slice guard). Proven red by appending a legacy-folder line to README.md (1 failed, 4 passed) and green after removing it.

## Task Commits

Per the repository owner's rule, nothing was committed. All changes are in the working tree for review.

1. **Task 1: Planning artifacts — REQUIREMENTS.md, PROJECT.md, ROADMAP.md, CLAUDE.md constraint line** - (uncommitted — awaiting owner review)
2. **Task 2: README.md and docs/design.md §2–§5** - (uncommitted — awaiting owner review)
3. **Task 3: Convention test over README.md and design.md §2** - (uncommitted — awaiting owner review)

**Plan metadata:** (uncommitted — awaiting owner review)

## Files Created/Modified

- `packages/core/test/convention.test.ts` - reads README.md and docs/design.md from the repo root, slices §2, §4, §2–§5 by heading, asserts the convention phrases and the absence of the legacy folder, the retired tick key, `overridable`, and a Lead bullet
- `README.md` - vocabulary and shape correction of "What it is" and "What it is not"; Status and License lines unchanged
- `docs/design.md` - §2 folder convention, §3 profiles, §4 roles and ownership, §5 gates
- `.planning/REQUIREMENTS.md` - eleven requirement lines and one appended date line
- `.planning/PROJECT.md` - constraints, Active bullets, Key Decisions, Out of Scope, date line
- `.planning/ROADMAP.md` - Phase 1 goal and criterion 5; renames in Phases 3, 4, 6, 9
- `.claude/CLAUDE.md` - Tech stack constraint line

## Verification Output

- Task 1 `<verify>` grep chain: `TASK1 VERIFY: PASS`. Counts: REQUIREMENTS `fixed root \`accord/\`` 1, `\`verified\`` 4, type enum 1, roster phrase 1, templates phrase 1, `review.md` reference 1, `qa.ticks` 0, `design source` 0; PROJECT `\`core\` / \`cli\` / \`mcp\`` 1, fixed root 1, `\`verified\`` 3, `3 roles` 1, `qa.ticks` 0, `skills\` / \`mcp\`` 0; ROADMAP `three-workspace monorepo` 1, `qa.ticks` 0, `Six definitions` 0, nine `### Phase N:` headers at lines 28–174, Phase 1 Plans list intact.
- Task 2 `<verify>` grep chain: `TASK2 VERIFY: PASS`. README: all nine required phrases present, `features/` 0, `Not a server` 0. design.md §2: six required phrases present; `features/`, `overridable`, `owner`, `tracker_ids` all 0. §3: `one epic ticket per epic` 1, `status: archived` 1; `feature file` in §2–§5 0. §4: roster phrases, `review.md`, `fresh agent context` present; `Lead**` 0. §5: `verified: [ac-1`, `same set`, `recorded at Ready` present; `QA ticks each scenario` 0. `git diff -U0 docs/design.md` hunks span old lines 26–88 only (§2 through the §5 Done paragraph).
- Task 3: `npm test -- --project core convention --reporter=verbose` -> 5 passed, 0 failed (181 ms). Red run with `legacy: features/x.md` appended to README.md: `× README documents the folder convention`, 1 failed, 4 passed; README restored (`features/` count 0); green run 5 passed. All eight acceptance literals present in the test file. `npm run typecheck` exit 0; `npm run lint` exit 0.
- `npm run check`: exit 0; 6 test files, 64 tests passed (59 from plans 01-01..01-04 + 5 new).
- `git log -1 --format=%H` before and after every task: `0d512c4ea602816ff1cda1c5ffd31ca719ac1a0a` (no commit).

## Decisions Made

- **Two extra PROJECT.md vocabulary fixes.** The plan's PROJECT.md list did not include the config bullet's "design source" (dropped by D-15) or the CLI lint bullet's "orphaned QA tick" (the tick is the developer's per D-03). Both are single-phrase corrections inside the plan's stated objective (no retired vocabulary in PROJECT.md), so they were made and are listed under Deviations.
- **Real dates on the `Last updated` lines.** The plan text spelled `2026-09-05` for both REQUIREMENTS.md and PROJECT.md; the edits happened on 2026-09-06, so the lines say 2026-09-06 with the plan's parenthetical wording unchanged.
- **A fifth test as a heading guard.** The plan asked that an empty §2 slice fail loudly; that check is its own named test (`slices of design.md are non-empty`) covering §2, §4, and §2–§5 rather than an assertion buried in test 2, so a heading rename fails with a clear name.
- **Section slicing by line prefix, not regex over the whole file.** `section(text, from, to)` finds the first line starting with `## 2.` and the next line starting with `## 3.`; no `sed`-style range regex is needed and the README/design line endings are normalised to LF first.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Retired vocabulary left in two PROJECT.md bullets the plan did not list**
- **Found during:** Task 1 (PROJECT.md edits)
- **Issue:** The Active config bullet still said "design source" (dropped by D-15) and the CLI lint bullet said "orphaned QA tick warning" (D-03 makes the tick the developer's). Leaving them would contradict the FMT-06 and LINT-05 texts edited in the same task.
- **Fix:** Removed "design source, " from the config bullet; "orphaned QA tick warning" -> "orphaned `verified` tick warning".
- **Files modified:** .planning/PROJECT.md
- **Verification:** `grep -c 'design source' .planning/PROJECT.md` -> 0; `grep -c 'QA tick' .planning/PROJECT.md` -> 0
- **Committed in:** (uncommitted — awaiting owner review)

---

**Total deviations:** 1 auto-fixed (1 missing critical, documentation consistency)
**Impact on plan:** Two phrases in one planning file; no scope change. Everything else executed as written.

## Findings / open decisions

- **ROADMAP.md Phase 4 criterion 4 still says "implementation, evidence, and tick by one author warn".** GATE-05 now compares implementation and evidence only (a developer ticking their own work is expected). The plan said not to touch any ROADMAP line beyond its list, so this line was left; it should be reworded when Phase 4 is discussed, or now if the owner prefers.
- **ROADMAP.md Phase 1 criterion 5 still contains the literal legacy folder name** ("no `features/`"). It is an exclusion, like the REQUIREMENTS Out of Scope row, so it is not wrong; the convention test does not scan ROADMAP.md.
- **REQUIREMENTS.md and PROJECT.md `Last updated` date.** The plan text said 2026-09-05; the files say 2026-09-06 (the actual date). If the owner wants the planning date instead, it is a one-token edit in each file.
- **README.md "Not a database" bullet** is a factual correction beyond the CONTEXT table (PROJECT.md decision "Remote MCP server is the non-tech frontend"), as the plan itself flagged. The README still says "Status: design phase. Nothing is published yet.", which remains true.
- **§2 `status` parenthetical punctuation.** The plan's wording used an em-dash inside the parentheses ("document lifecycle only — work status stays in the tracker"); the file uses a semicolon. Meaning unchanged.
- **PROJECT.md diff stat against HEAD (95+/22-) is larger than this plan's edits** because the file was already modified in the working tree by the owner's earlier explore session before Phase 1 execution began. This plan touched fourteen lines of it.
- **Flagged assumption carried from the plan:** the FMT-01 loader rule (`tickets/<id>/` as appendices, `assets/<id>/` designer-owned) is documented and template-pinned in Phase 1 but only becomes tested behaviour with the Phase 2 loader.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 is complete: all five plans have summaries. FMT-01, FMT-02, FMT-06, FMT-07, and OPS-01 (shared with plans 01-01, 01-03, 01-04) are marked complete now that the last declaring plan is done.
- Phase 2 loaders can key on the documented tree (`tickets/<id>.md`, `tickets/<id>/verification.md`, `assets/<id>/`) and the D-07 headings exactly as README.md and design.md §2 now state them; any drift in those documents fails `npm test`.
- Owner review items before commit: the seven files above, the two ROADMAP findings, and the `Last updated` dates.

---
*Phase: 01-workspace-and-formats*
*Completed: 2026-09-06*

## Self-Check: PASSED

All seven plan files and the SUMMARY exist on disk (`[ -f ]` FOUND for each); `npm run check` exit 0 (6 files, 64 tests); HEAD still `0d512c4` (no commit made). Tracking: STATE.md advanced to plan 5/5 with status `verifying` (the `state.update-progress` bar was skipped by gsd-tools because the phase scope is unscoped, so the Progress line still reads 0%); ROADMAP.md Phase 1 row 5/5 and 01-05 checked; FMT-01, FMT-02, FMT-06, FMT-07, OPS-01 marked complete in REQUIREMENTS.md (checkbox and traceability).
