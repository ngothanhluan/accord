---
phase: 03-lint
plan: 04
subsystem: templates
tags: [templates, verification-notes, test-tag, generated-module, goldens, vitest]

# Dependency graph
requires:
  - phase: 03-lint
    provides: "03-02: `lint.note-orphan` and `lint.notes-not-last` read the `## Verification notes` section; `lint.heading-missing` never requires it (D-71)"
  - phase: 01-foundation
    provides: "`templates/*.md`, `scripts/gen-templates.mjs`, the heading pin and drift test in `templates.test.ts`, the write golden derived from `ticket-build.md`"
provides:
  - "`ticket-build.md` and `ticket-maintain.md` end with an empty `## Verification notes` section holding one guidance comment (D-70)"
  - "The `## Acceptance criteria` comment in both story templates teaches the `@test:<id>` tag for non-`@ui` scenarios (D-69)"
  - "`src/generated/templates.ts` regenerated; the heading pin in `templates.test.ts` is six headings for build and maintain; `ticket-build.verified-empty.md` regenerated"
affects: [03-05, 03-06, 04-gates, 05-cli, 06-skills]

# Actuals (#2632) — chars/4 over the realized diff: 19,176 chars across the five files (the generated module diffs as two whole lines)
actuals:
  tokens: 4800
  tasks: 1
  commits: 0
plan_head_before: f4cc8cc920ef165e7f71bed0dd023550f2c74a38

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A template section is `## Heading` then one `<!-- Role. guidance -->` comment; a section a later role fills in ships empty apart from that comment"
    - "Template changes are three edits in lockstep: the file under `templates/`, `npm run gen`, and the scoped write golden (`npm test -- --project core write -u -t \"appended to the build template\"`)"

key-files:
  created: []
  modified:
    - packages/core/templates/ticket-build.md
    - packages/core/templates/ticket-maintain.md
    - packages/core/src/generated/templates.ts
    - packages/core/test/templates.test.ts
    - packages/core/test/__golden__/ticket-build.verified-empty.md

key-decisions:
  - "Story and bug templates gain the empty `## Verification notes` section and the `@test:` sentence; `epic.md` gains neither (Claude's Discretion, RESEARCH recommendation adopted)"
  - "The notes comment names `tickets/<id>/verification.md` as where evidence with a result lives, so the two files are not confused (D-70 wording as the plan proposed)"
  - "The `@test:` sentence says 'the test report' and 'classname#name'; no runner is named"

patterns-established:
  - "Scoped golden regeneration uses the vitest test title, not the golden file name: `-t \"appended to the build template\"` for `ticket-build.verified-empty.md`"

requirements-completed: [FMT-09, FMT-10]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Both story templates end with `## Verification notes` as the last `##` section, containing only one HTML guidance comment naming `### @ac-n` blocks; `epic.md` unchanged"
    requirement: FMT-10
    verification:
      - kind: unit
        ref: "packages/core/test/templates.test.ts#headings are in D-07 order"
        status: pass
      - kind: other
        ref: "grep -c '^## Verification notes$' on ticket-build.md, ticket-maintain.md -> 1, 1; on epic.md -> 0; tail -n 2 shows the heading then one `<!-- ... -->` line"
        status: pass
    human_judgment: false
  - id: D2
    description: "The `## Acceptance criteria` comment in both story templates mentions the `@test:<id>` tag for scenarios that are not `@ui`"
    requirement: FMT-09
    verification:
      - kind: other
        ref: "grep -c '@test:<id>' on ticket-build.md, ticket-maintain.md -> 1, 1"
        status: pass
      - kind: unit
        ref: "packages/core/test/templates.test.ts#build and maintain differ only inside body HTML comments"
        status: pass
    human_judgment: false
  - id: D3
    description: "Generated module and write golden match the templates; frontmatter block byte-identical before and after"
    requirement: FMT-10
    verification:
      - kind: unit
        ref: "packages/core/test/templates.test.ts#generated module matches templates/ (drift)"
        status: pass
      - kind: unit
        ref: "packages/core/test/write.test.ts#verified: [] is appended to the build template and every comment line survives"
        status: pass
      - kind: other
        ref: "git diff -U0 packages/core/templates/ shows only body-comment lines and the appended section; no frontmatter line"
        status: pass
    human_judgment: false
  - id: D4
    description: "A ticket written from the new template lints with no `lint.notes-not-last` and no `lint.note-orphan`"
    requirement: FMT-10
    verification:
      - kind: integration
        ref: "node script over dist/index.js: loadSnapshot + lintSnapshot on each template with id NEW-1 and status open -> findings are 4x lint.sentinel and lint.test-tag-missing on the sample scenario line, lint.plan-empty on the Plan heading; no notes rule fires"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-09-14
status: complete
---

# Phase 3 Plan 04: Verification notes and @test: guidance in the story templates Summary

**Both story templates now end with an empty `## Verification notes` section whose guidance comment names the `### @ac-n` blocks, and their Acceptance criteria comment tells the developer to add one `@test:<id>` tag to every non-`@ui` scenario after Ready; the generated module, the six-heading pin, and the write golden follow.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-14T05:09:10Z (approximate; spawned after the 03-03 close at 05:09:04Z)
- **Completed:** 2026-09-14T05:12:31Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- `ticket-build.md` and `ticket-maintain.md`: one sentence appended inside the `## Acceptance criteria` comment (D-69) and a `## Verification notes` section appended after `## Plan` with one comment (D-70). The sentence and the comment are byte-identical in both files; the frontmatter blocks are untouched; both files stay LF with no BOM. `epic.md` is unchanged.
- `npm run gen` regenerated `src/generated/templates.ts`; the drift test passes; `## Verification notes` appears twice in the module.
- `templates.test.ts` "headings are in D-07 order" pins six headings for build and maintain; epic stays three.
- `ticket-build.verified-empty.md` regenerated scoped to its one test; `git status` under `__golden__` shows no other Phase 1 or Phase 2 golden touched by this plan.
- The plan's gate (`npm run gen && npm test -- --project core templates && npm test -- --project core write && npm run typecheck`) passes; `npm run build`, `npm test` (16 files, 281 tests), and `npm run lint` are green on Windows.
- Proven, not only read: a ticket built from each template lints through `dist/index.js` with no `lint.notes-not-last` and no `lint.note-orphan`. The findings it does raise (sentinels and `lint.test-tag-missing` on the sample `<observable outcome>` scenario, `lint.plan-empty`) are the template's placeholders and predate this plan.

## Task Commits

Per the owner's rule, nothing was committed or staged; every change sits in the working tree for review.

1. **Task 1: `## Verification notes` section and `@test:` guidance in the story templates** - `uncommitted` (feat)

**Plan metadata:** `uncommitted` (docs)

## Files Created/Modified

- `packages/core/templates/ticket-build.md` - `@test:<id>` sentence in the AC comment; `## Verification notes` section last
- `packages/core/templates/ticket-maintain.md` - same two changes, identical text
- `packages/core/src/generated/templates.ts` - regenerated by `npm run gen`
- `packages/core/test/templates.test.ts` - `story` headings array gains `'## Verification notes'`
- `packages/core/test/__golden__/ticket-build.verified-empty.md` - regenerated from the new template

## Decisions Made

- Adopted the plan's `flagged_assumptions` as written: story and bug templates gain both additions, `epic.md` gains neither; the comment says "the test report" and "classname#name" and names no runner; the notes comment points at `tickets/<id>/verification.md` for evidence with a result.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0 auto-fixed
**Impact on plan:** None.

## Issues Encountered

- **The plan's golden-regeneration filter matched nothing.** `npm test -- --project core write -u -t "verified-empty"` skipped all 11 tests because `-t` filters on the test title, and the title is `verified: [] is appended to the build template and every comment line survives`; `verified-empty` is only in the golden file name. Reran with `-t "appended to the build template"`: 1 snapshot updated, and `git status` confirms only `ticket-build.verified-empty.md` changed. No plan file was edited; the working filter is recorded under patterns-established.

## Prohibitions (must_haves) — verification

| Statement | Result |
|---|---|
| No `git commit`, `git push`, `git tag`; no attribution trailer | Verified: HEAD is still `f4cc8cc920ef165e7f71bed0dd023550f2c74a38`; `git diff --cached` is empty |
| No template text names another tool, plugin, harness, test runner, or planning system | Verified by reading the two added lines: "the test report", "classname#name", `tickets/<id>/verification.md` only |
| Frontmatter block byte-identical before and after; only body comments and the appended section change | Verified: `git diff -U0 packages/core/templates/` lists 2 removed and 12 added lines, all inside body comments or the new section; the build-and-maintain test asserts the two frontmatter blocks are equal and comment-free |

## Open questions for the owner

None blocking. The wording of both comments is the plan's proposal, adopted verbatim; the plan marks it "edit freely". One observation, not a question: a brand-new ticket from the template warns `lint.test-tag-missing` on its sample scenario because the placeholder scenario has no `@ui` or `@test:` tag. That is the D-69 rule from 03-01 doing its job on placeholder text and was true before this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 03-05 and 03-06 can rely on every new ticket carrying the notes section last and empty; the `lint-hygiene` `CLEAN.md` fixture and the template now agree on the section shape.
- Phase 6 (skills) can point the developer workflow at the `@test:` sentence and the notes comment as the in-ticket guidance.
- Wave 2 of Phase 3 (03-02, 03-03, 03-04) is green together: `npm test` 281 tests, `npm run build`, `npm run lint`, `npm run typecheck` all exit 0.

## Self-Check: PASSED

- Modified files verified on disk with the expected content: `## Verification notes` once in each story template and 0 times in `epic.md`; `@test:<id>` once in each story template; `'## Verification notes'` in `templates.test.ts`; `## Verification notes` twice in `src/generated/templates.ts` and once in `ticket-build.verified-empty.md`.
- No files created by this plan.
- Commit-hash check skipped by owner rule (nothing committed by design); `git log -1` equals `plan_head_before`.

---
*Phase: 03-lint*
*Completed: 2026-09-14*
