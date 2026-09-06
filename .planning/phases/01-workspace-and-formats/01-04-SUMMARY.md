---
phase: 01-workspace-and-formats
plan: 04
subsystem: formats
tags: [templates, codegen, yaml, frontmatter, vitest, tsdown, gherkin, ears]

# Dependency graph
requires:
  - phase: 01-workspace-and-formats (plan 01)
    provides: "`validate(schemaId, doc): Finding[]`, `ticket.schema.json`, `verification.schema.json`, root scripts, ESLint config that ignores `**/src/generated/**` and gives `scripts/**` node globals"
  - phase: 01-workspace-and-formats (plan 02)
    provides: "bundle purity test (`dist/index.js` has no `node:` import) that now also covers the inlined templates"
provides:
  - "Seven templates under `packages/core/templates/`: `ticket-build.md`, `ticket-maintain.md`, `epic.md`, `glossary.md`, `business-rules.md`, `prototype-header.html`, `verification.md`"
  - "`packages/core/scripts/gen-templates.mjs` and the root `gen` script; committed `packages/core/src/generated/templates.ts`"
  - "`templates` (const object keyed by file name) and `type TemplateName` exported from `@accord-dev/accord-core`; inlined into `dist/index.js` and declared in `dist/index.d.ts`"
  - "`packages/core/test/templates.test.ts`: 13 tests pinning schema validity, D-07 headings, D-04 key order, D-08 build/maintain equivalence, D-11 ownership phrases, FMT-01 folder references, no tokens, drift, LF/no-BOM"
affects: [01-05, phase-2-loaders, phase-5-cli-new-ticket, phase-6-skills, phase-8-mcp]

# Actuals (#2632) — chars/4 over the realized diff, same scale as the plan's estimate (40000).
actuals:
  tokens: 6023    # 24,093 chars: 8,132 templates + 989 script + 8,692 generated + 6,118 test + index.ts/package.json deltas
  tasks: 3
  commits: 0      # owner commits after review (no-commit policy)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-TS assets reach core through a committed generated module (`scripts/gen-*.mjs` -> `src/generated/*.ts`) guarded by a drift test; never `?raw` or a bundler loader"
    - "Frontmatter guidance is YAML `#` comments; body guidance is HTML comments; the two are never mixed"
    - "Template sample values are themselves schema-valid (`TICKET-ID`, `0000000`, `2026-01-01`); no token syntax"
    - "Test-side frontmatter split: BOM strip + CRLF->LF + `^---\\n([\\s\\S]*?)\\n---` + `yaml.parse` with core schema and the `stringNumerics` customTags filter"

key-files:
  created:
    - packages/core/templates/ticket-build.md
    - packages/core/templates/ticket-maintain.md
    - packages/core/templates/epic.md
    - packages/core/templates/glossary.md
    - packages/core/templates/business-rules.md
    - packages/core/templates/prototype-header.html
    - packages/core/templates/verification.md
    - packages/core/scripts/gen-templates.mjs
    - packages/core/src/generated/templates.ts
    - packages/core/test/templates.test.ts
  modified:
    - packages/core/src/index.ts
    - package.json

key-decisions:
  - "Guidance for the four required keys (`id`, `title`, `type`, `status`) is a trailing `#` comment on the key line, because the acceptance criterion requires those four to be the first four frontmatter lines; every other key keeps a full guidance line above it"
  - "The test's BOM helper uses `String.fromCharCode(0xfeff)` instead of the `\\uFEFF` escape from RESEARCH Code Example 9; same behaviour, avoids an escape that this session's file-write tool turned into the literal invisible character"

patterns-established:
  - "Codegen-and-commit: `npm run gen` is manual; no `prebuild`/`pretest`; the drift test is the only staleness signal"
  - "Ticket frontmatter layout: four required keys, then optional keys commented out with `#` guidance above, `# verified: []` always last"

requirements-completed: [FMT-07, FMT-01]

coverage:
  - id: D1
    description: "Seven template files exist; `ticket-build.md`, `ticket-maintain.md`, `epic.md` frontmatter validates against `ticket.schema.json` with the expected `type`/`status`; `verification.md` validates against `verification.schema.json`; `glossary.md` and `business-rules.md` have no frontmatter"
    requirement: FMT-07
    verification:
      - kind: unit
        ref: "packages/core/test/templates.test.ts#frontmatter validates against its schema"
        status: pass
      - kind: unit
        ref: "packages/core/test/templates.test.ts#glossary.md and business-rules.md have no frontmatter"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-07 headings in order (epic without AC and Plan); D-04 keys in order with `verified` last; build and maintain byte-identical frontmatter and identical bodies outside HTML comments; D-11 ownership phrases present; no `{{` tokens and `id` is `TICKET-ID`"
    requirement: FMT-07
    verification:
      - kind: unit
        ref: "packages/core/test/templates.test.ts#template structure"
        status: pass
    human_judgment: false
  - id: D3
    description: "No template mentions the legacy per-epic folder; ticket templates reference `tickets/<id>.md`, `tickets/<id>/verification.md`, `product/glossary.md`, `product/business-rules.md`; maintain references `assets/<id>/prototype.html`; prototype header opens with a comment and contains `Derived from:` and `<!doctype html>`"
    requirement: FMT-01
    verification:
      - kind: unit
        ref: "packages/core/test/templates.test.ts#templates reflect the folder convention (FMT-01)"
        status: pass
    human_judgment: false
  - id: D4
    description: "`templates` and `TemplateName` are exported from core; the committed generated module equals the on-disk templates after BOM/CRLF normalisation and `npm run gen` is idempotent; the drift test was proven red on a one-byte edit and green after revert"
    requirement: FMT-07
    verification:
      - kind: unit
        ref: "packages/core/test/templates.test.ts#generated module matches templates/ (drift)"
        status: pass
      - kind: other
        ref: "npm run gen twice -> sha1 89357b8207ee both times; red run printed 'glossary.md drifted: run npm run gen'"
        status: pass
    human_judgment: false
  - id: D5
    description: "Core bundle stays pure with templates inlined: `dist/index.js` contains `## Acceptance criteria` and zero `node:` specifiers; `dist/index.d.ts` declares `templates` and `TemplateName`"
    verification:
      - kind: unit
        ref: "packages/core/test/bundle.test.ts#built core bundle"
        status: pass
      - kind: other
        ref: "grep -c 'node:' packages/core/dist/index.js -> 0; grep TemplateName packages/core/dist/index.d.ts -> present"
        status: pass
    human_judgment: false
  - id: D6
    description: "Wording of the guidance comments and the two sample glossary/business-rule entries reads correctly for a BA, designer, and developer"
    verification: []
    human_judgment: true
    rationale: "Wording is Claude's discretion per CONTEXT.md; tests pin only the D-11 phrases, headings, and key order. The owner should read the seven files once."

# Metrics
duration: 5min
completed: 2026-09-06
status: complete
---

# Phase 1 Plan 04: Templates and Generated Module Summary

**Seven human-readable templates (two profile-specific ticket templates with byte-identical frontmatter, an epic template without AC or Plan, two frontmatter-free product files, a prototype header, and a verification record) now validate against the Phase 1 schemas and reach `@accord-dev/accord-core` as the `templates` export through a committed generated module guarded by a drift test; `npm run check` is green on Windows with 59 tests.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-06T02:15:03Z
- **Completed:** 2026-09-06T02:20:34Z
- **Tasks:** 3
- **Files modified:** 12 (10 created, 2 modified)

## Accomplishments

- `ticket-build.md` and `ticket-maintain.md` share one frontmatter block (four active required keys, `ui: false`, six commented optional keys, `# verified: []` last) and identical bodies; they differ only inside body HTML comments (Figma link for build, `assets/<id>/prototype.html` derived from existing styles for maintain).
- `epic.md` has `type: epic`, drops `ac_hash` and `verified`, and carries only `## Intent`, `## Requirements`, `## Open questions`.
- Every BA-owned section says "never name tables, endpoints, libraries, or screens"; `## Plan` says "Developer fills this in. BA leaves it empty." and points evidence to `tickets/<id>/verification.md` written by the fresh review context.
- `verification.md` has the D-09 shape (`ticket`, `commit`, `reviewed_on`, no `reviewer`; one `## @ac-1 <scenario name>` block with `Result:` and `Evidence:`).
- `prototype-header.html` opens with the design.md §5 derivation comment, then `<!doctype html>` and an empty document.
- `gen-templates.mjs` (RESEARCH Code Example 9, outside `src/`) emits `src/generated/templates.ts`; `npm run gen` prints `generated 7 templates` and is byte-idempotent.
- `templates` and `TemplateName` are exported; `dist/index.js` inlines the templates with zero `node:` imports; `dist/index.d.ts` declares both.
- `templates.test.ts` adds 13 tests; all pass on the first run. The drift test was proven: a trailing space on `glossary.md` produced `glossary.md drifted: run npm run gen`; after revert the file's sha1 matched the original and the suite was green.

## Task Commits

Per the repository owner's rule, nothing was committed. All changes are in the working tree for review.

1. **Task 1: The seven templates** - (uncommitted — awaiting owner review)
2. **Task 2: Codegen script, committed generated module, `templates` export, root `gen` script** - (uncommitted — awaiting owner review)
3. **Task 3: Template tests — schema validation, structure, folder convention, drift** - (uncommitted — awaiting owner review)

**Plan metadata:** (uncommitted — awaiting owner review)

## Files Created/Modified

- `packages/core/templates/ticket-build.md` - build-profile story/bug template; Figma wording in the Intent note
- `packages/core/templates/ticket-maintain.md` - maintain-profile twin; prototype wording, "a bug fix still needs at least one scenario"
- `packages/core/templates/epic.md` - `type: epic`, nine keys, three headings; ordering of child stories is prose in v0.1
- `packages/core/templates/glossary.md` - `# Glossary`, guidance comment, two sample `- **Term** — meaning` entries
- `packages/core/templates/business-rules.md` - `# Business rules`, guidance comment, two sample rules
- `packages/core/templates/prototype-header.html` - derivation comment block, then a minimal empty HTML document titled `TICKET-ID prototype`
- `packages/core/templates/verification.md` - D-09 frontmatter and one sample scenario block
- `packages/core/scripts/gen-templates.mjs` - reads `templates/*.{md,html}` sorted, strips BOM, CRLF->LF, writes the generated module
- `packages/core/src/generated/templates.ts` - generated, committed; seven keys in sorted order, `as const`, `TemplateName`
- `packages/core/src/index.ts` - appended the `templates` value export and `TemplateName` type export (now five export lines)
- `package.json` - added `"gen": "node packages/core/scripts/gen-templates.mjs"`; no `prebuild`/`pretest`
- `packages/core/test/templates.test.ts` - 13 tests in three describe blocks

## Verification Output

- Task 1 `<verify>` chain (file count, headings, `type: epic`, `reviewed_on`, no `{{`, no legacy folder, D-08 node check): exit 0. Key counts 11 / 11 / 9. `file` reports ASCII/UTF-8 text with no CRLF terminators; node counts 0 CR bytes and no BOM in all seven files.
- Task 2: `npm run gen` -> `generated 7 templates`; sha1 `89357b8207ee...` before and after a second run. `npm run build && npm run typecheck && npm run lint` exit 0. `grep -c 'node:' packages/core/dist/index.js` -> 0; `## Acceptance criteria` present in the bundle; `TemplateName` present in `index.d.ts`; `?raw` count in `src` 0; `loader` count in `tsdown.config.ts` 0.
- Task 3: `npm test -- --project core templates` -> 13 passed, 0 failed (1.88 s). Red run with the appended space: `FAIL |core| test/templates.test.ts > generated module > generated module matches templates/ (drift)` / `AssertionError: glossary.md drifted: run npm run gen`; 1 failed, 12 passed. Green run after revert: 13 passed. All nine acceptance literals present in the test file.
- `npm run check`: exit 0; 5 test files, 59 tests passed.
- `git log -1 --format=%H` before and after: `0d512c4ea602816ff1cda1c5ffd31ca719ac1a0a` (no commit).

## Decisions Made

- **Trailing comments on the four required keys.** The plan asks for guidance as full `#` lines above each key and, in the same task, for `id:`, `title:`, `type:`, `status:` to be the first four lines after `---`. Both cannot hold if those keys have guidance. I put their guidance as a trailing `# ...` comment on the key line and kept full lines above every other key. Task 3 test 5 and the `sed | grep -c` criterion both pass (11 / 11 / 9).
- **BOM helper without the `\uFEFF` escape.** The file-write tool in this session turned `\uFEFF` into the literal invisible character (caught in the generator, patched via char codes). The test builds the BOM with `String.fromCharCode(0xfeff)` so the source stays visibly correct; the generator keeps the `\uFEFF` escape from Code Example 9.

## Deviations from Plan

None - plan executed exactly as written. The two items above are wording/formatting choices inside the plan's stated discretion, not changes to scope or behaviour.

## Findings / open decisions

- **Lowercase `figma` criterion.** The acceptance grep is case-sensitive; the build Intent note says "Figma link". The criterion is satisfied by the frontmatter line `# design: "https://www.figma.com/..."`, which is identical in both ticket templates. If the owner wants the body note itself to carry the lowercase word, that is a one-word edit inside an HTML comment.
- **Epic Intent profile note.** The plan specifies the profile note for build and maintain but not for epic. I wrote a neutral line ("An epic is never gated; `design:` may hold the epic-level design link for its child stories"). Alternative: omit the note entirely.
- **Sample entries in `glossary.md` and `business-rules.md`.** Generic placeholder wording ("Sample term", "amounts are rounded to two decimal places, half away from zero", "a request older than 30 days is treated as expired"). The rounding and 30-day values are illustrative only and are not project business rules; the owner may prefer entries drawn from the employer's domain, or entries that are visibly placeholders in another way.
- **Angle-bracket placeholders in body text.** `<scenario name>`, `<observable outcome>`, `<trigger>`, `<response>`, `<what was run or inspected...>` and `<list the stylesheets...>` are used in bodies and HTML comments as human-readable placeholders. They are outside frontmatter values, so the token prohibition does not apply, and no test rejects them. Phase 5 `new ticket` does not replace them.
- **Trailing-comment layout (see Decisions).** If the owner prefers full-line guidance everywhere, the acceptance criterion "first four lines are the keys" must be relaxed to "first four keys are ..." and test 5 already tolerates either layout.

## Issues Encountered

- The file-write tool emitted the `\uFEFF` escape as a literal U+FEFF character in `gen-templates.mjs`; patched by replacing the character with the escape text via char codes, verified with `grep -n FEFF`. Same root cause is why the test uses `String.fromCharCode`.
- Git Bash in this session did not expand `$'\r'`, so the acceptance command `grep -c $'\r' <file>` counted every line. Verified LF with node (`(text.match(/\r/g) || []).length` -> 0) and `file` (no "CRLF line terminators") instead; the LF/no-BOM test in `templates.test.ts` pins it going forward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FMT-07 is complete and pinned by tests. FMT-01 is declared by this plan; if 01-05 also declares it (doc updates), it flips complete when 01-05 finishes.
- Phase 2's fence-aware scanner can key on the five D-07 heading strings exactly as written in the templates; Phase 5 `new ticket` should set `id`/`title` by key with `yaml` `parseDocument().setIn`, never by token replacement (the sample values are schema-valid on purpose).
- Any template edit without `npm run gen` fails `npm test` with `run npm run gen`.
- Ready for 01-05.

---
*Phase: 01-workspace-and-formats*
*Completed: 2026-09-06*

## Self-Check: PASSED

All 10 source/test files and the SUMMARY exist on disk; `npm run check` exit 0 (5 files, 59 tests); `npm run gen` idempotent (sha1 89357b8207ee); HEAD still `0d512c4` (no commit made).
