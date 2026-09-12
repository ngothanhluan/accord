---
phase: 02-core-model-and-loading
plan: 02
subsystem: core-loader
tags: [yaml, ajv, frontmatter, config, golden, vitest]

requires:
  - phase: 02-core-model-and-loading
    provides: "02-01 loadFrontmatter, parseYamlMap, schemaFindings (D-33 line rule), loadConfig, readFixture/variants, per-fixture describe loop"
provides:
  - "frontmatter-errors fixture (config + 9 tickets) and golden: every D-32 failure class and the PITFALLS §8 typing boundary set pinned with exact lines"
  - "no-config, bad-config, config-syntax fixtures and goldens: the D-31 config boundary with file and line on every finding"
  - "frontmatter.test.ts: 18 assertions over (file, rule, line, pointer), plus splitFrontmatter and normaliseText unit tests"
affects: [02-03, 02-04, 02-05, 02-06, 02-07, phase-3-lint, phase-5-cli-exit-codes]

actuals:
  tokens: 4300
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Error fixtures: one folder per failure family, expected lines written in the plan before the golden exists, `-u` always scoped with -t \"fixture <name>\""
    - "Tests assert findings by (file, rule, line, pointer) with a `has` helper and pin the per-file count so an extra finding fails"

key-files:
  created:
    - packages/core/test/frontmatter.test.ts
    - packages/core/test/__golden__/frontmatter-errors.snapshot.json
    - packages/core/test/__golden__/no-config.snapshot.json
    - packages/core/test/__golden__/bad-config.snapshot.json
    - packages/core/test/__golden__/config-syntax.snapshot.json
    - packages/core/test/fixtures/frontmatter-errors/ (config.yml + 9 tickets)
    - packages/core/test/fixtures/no-config/accord/tickets/ONLY.md
    - packages/core/test/fixtures/bad-config/ (config.yml + T.md)
    - packages/core/test/fixtures/config-syntax/ (config.yml + T.md)
  modified: []

key-decisions:
  - "No loader code changed: yaml.ts, frontmatter.ts, and config.ts from 02-01 already produce every line the plan tables expect"
  - "config-syntax golden pins line 2 for `accord: [` (what yaml reports: the flow sequence is closed by end of input), not the plan's guessed line 1"
  - "Unterminated frontmatter is `load.frontmatter-missing` at line 1 with the whole text as body (flagged assumption, now pinned)"

patterns-established:
  - "Per-file finding count + `has(file, rule, line, pointer)` membership: exact set without depending on finding order"

requirements-completed: [CORE-02, CORE-06, FMT-08]

coverage:
  - id: D1
    description: "Broken ticket frontmatter (missing, unterminated, syntax, non-map, empty, schema) keeps a ticket entry, drops the frontmatter, and reports the D-33 line"
    requirement: CORE-06
    verification:
      - kind: unit
        ref: "packages/core/test/frontmatter.test.ts#ticket frontmatter errors (D-32, D-33)"
        status: pass
    human_judgment: false
  - id: D2
    description: "007, 0x1F, 0123, 1e3, 2026-01-01 stay strings; `confirmed: no` stays a string and is a schema.type finding at its line"
    requirement: CORE-02
    verification:
      - kind: unit
        ref: "packages/core/test/frontmatter.test.ts#TYPING: 007, 0x1F, 0123, 1e3, and 2026-01-01 stay strings (CORE-02, PITFALLS §8)"
        status: pass
      - kind: unit
        ref: "packages/core/test/frontmatter.test.ts#SCHEMA: five schema findings at the key or value line; no partial frontmatter; body survives (D-35)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Zero-byte ticket and zero-byte config.yml are findings at line 1; BOM+CRLF yields identical findings to LF; lone CR is left alone"
    requirement: FMT-08
    verification:
      - kind: unit
        ref: "packages/core/test/frontmatter.test.ts#EMPTY: a zero-byte file is load.frontmatter-missing at line 1 with empty sections (FMT-08 empty edge)"
        status: pass
      - kind: unit
        ref: "packages/core/test/frontmatter.test.ts#empty: a zero-byte config.yml is load.yaml-not-map at line 1 (FMT-08 empty edge)"
        status: pass
      - kind: unit
        ref: "packages/core/test/frontmatter.test.ts#BOM+CRLF input produces the same findings as LF and is never reported (D-38)"
        status: pass
    human_judgment: false
  - id: D4
    description: "config.yml missing, invalid, or unparsable leaves snapshot.config undefined and reports findings that name accord/config.yml and the file line"
    requirement: CORE-06
    verification:
      - kind: unit
        ref: "packages/core/test/frontmatter.test.ts#config.yml (D-31)"
        status: pass
      - kind: unit
        ref: "packages/core/test/snapshot.test.ts#fixture bad-config > matches the golden"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-09-06
status: complete
---

# Phase 2 Plan 02: Frontmatter and config.yml Error Findings Summary

**Every D-31/D-32/D-33 failure class and the full PITFALLS §8 YAML typing boundary set is pinned by fixture goldens and exact (file, rule, line, pointer) assertions; the 02-01 loader produced every expected line without a code change.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-06T07:38:00Z
- **Completed:** 2026-09-06T07:43:00Z
- **Tasks:** 2
- **Files modified:** 22 created (staged, uncommitted), 0 source files changed

## Accomplishments

- `frontmatter-errors` fixture: nine tickets covering no block, unterminated block, duplicate key, sequence document, empty block, five schema rules in one file, the typing boundary set, id/file-name mismatch, and a zero-byte file. Golden and tests pin the line of every finding.
- `no-config`, `bad-config`, `config-syntax` fixtures: `snapshot.config` is `undefined` in all three; the bad-config golden adds `file` and `line` to the six findings the Phase 1 `config.invalid.json` golden already listed.
- `frontmatter.test.ts` (18 tests) also pins `splitFrontmatter.bodyOffset`, leading-BOM-only stripping, CRLF-only normalisation, and D-38 parity between LF and BOM+CRLF input.

## Prepared Commits

Nothing was committed. Every file is staged; the owner reviews and commits.

1. `test(02-02): pin frontmatter error lines and YAML typing boundaries (D-32, D-33, D-34, D-38)`
   - packages/core/test/frontmatter.test.ts, packages/core/test/__golden__/frontmatter-errors.snapshot.json, packages/core/test/fixtures/frontmatter-errors/accord/config.yml, packages/core/test/fixtures/frontmatter-errors/accord/tickets/{NOFM,UNTERMINATED,SYNTAX,NOTMAP,EMPTYFM,SCHEMA,TYPING,MISMATCH,EMPTY}.md
2. `test(02-02): pin config.yml missing, invalid, and unparsable findings (D-31)`
   - packages/core/test/frontmatter.test.ts, packages/core/test/__golden__/{no-config,bad-config,config-syntax}.snapshot.json, packages/core/test/fixtures/no-config/accord/tickets/ONLY.md, packages/core/test/fixtures/bad-config/accord/{config.yml,tickets/T.md}, packages/core/test/fixtures/config-syntax/accord/{config.yml,tickets/T.md}
3. `docs(02-02): complete frontmatter and config error findings plan`
   - .planning/phases/02-core-model-and-loading/02-02-SUMMARY.md, .planning/STATE.md, .planning/ROADMAP.md, .planning/REQUIREMENTS.md

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Broken and typing-edge ticket frontmatter | uncommitted (owner review pending) | see Prepared Commit 1 |
| 2 | config.yml missing, invalid, unparsable | uncommitted (owner review pending) | see Prepared Commit 2 |

## Verification

- `npm run check` (build, lint, typecheck, vitest) exits 0: 8 test files, 109 tests, 0 failures.
- `npm test -- --project core frontmatter`: 18 passed. Scoped snapshot run over the five fixtures: 27 passed.
- `git hash-object packages/core/test/__golden__/valid-build.snapshot.json` is `855db6c7` before and after; `-u` was only ever run with a `-t "fixture ..."` filter.
- `git log -1` is still `48e56d7`. `grep -c '"frontmatter"'` on the frontmatter-errors golden prints 2 (TYPING, MISMATCH).
- Every plan acceptance criterion holds except the config-syntax line, which is 2 rather than the plan's guessed 1 (see Findings 1).

## Decisions Made

- No change to `load/yaml.ts`, `load/frontmatter.ts`, or `load/config.ts`. The plan allowed edits only where an expected line was not produced; every line in both tables was produced on the first golden run, so the plan's `files_modified` entries for those three files are untouched.
- config-syntax pins line 2, the line yaml reports (D-33 rule), over the plan's expected 1.

## Deviations from Plan

None. Plan executed as written; no auto-fixes, no dependency changes, `package-lock.json` unchanged.

## Findings / Decisions for Owner

1. **Syntax finding past end of file.** For a one-line `accord: [`, yaml reports the error at line 2 (end of input closes the unterminated flow sequence), so the finding's `line` is 2 in a one-line file. Pinned as the plan and D-33 direct ("the line yaml reports"). Alternative: clamp `line` to the file's line count in `parseYamlMap` so an editor jump lands on a real line. One-line change plus golden update if you prefer that.
2. **yaml's message embeds its own position.** `load.yaml-syntax` reasons are the first line of yaml's message, for example `Map keys must be unique at line 3, column 1:` while the finding's `line` is 4 (file line). The embedded "line 3" is YAML-relative and the text ends in a colon. Alternative: strip the ` at line N, column M:` suffix in `parseYamlMap`. Not changed; the plan scoped code edits to line mapping.
3. **`load.yaml-not-map` reason wording.** The reason reads "frontmatter must be a YAML mapping" even for `config.yml` (the empty-config test). Cosmetic; a file-aware reason would be a two-line change in `parseYamlMap`.
4. **`schema.if` wrapper kept** on `/tracker` at line 3, as Phase 1 kept it and the plan's flagged assumption states. Phase 3 decides whether to suppress it. The bad-config golden pins six findings including it.
5. **Unterminated frontmatter** is reported as `load.frontmatter-missing` at line 1, and the YAML lines then appear as body text (the `## Intent` on line 4 is found as a section). Pinned per the flagged assumption; a distinct `load.frontmatter-unterminated` rule remains the alternative.
6. **Requirements checkboxes.** CORE-02, CORE-06, FMT-08 were already marked complete by 02-01; this plan's `requirements.mark-complete` is a no-op re-run. Same note as 02-01 Finding 3.

## Known Stubs

None.

## Threat Flags

None. T-02-06 (implicit typing) is now pinned by TYPING and SCHEMA; T-02-SC holds: no package added.

## Issues Encountered

None.

## Next Phase Readiness

- 02-06 (`setFrontmatterKey`) can build on `load/frontmatter.ts` unchanged since 02-01.
- 02-03, 02-04, 02-05, 02-07 add their fixtures with scoped `-u`; the discovery loop already picks up the four new folders, so the wave-end `npm test -- --project core` includes them.

## Self-Check: PASSED

- Created files exist: `frontmatter.test.ts`, the four `*.snapshot.json` goldens, and all 17 fixture files are present and staged (`git diff --cached --name-only`).
- Commits: none by design (owner commits); `git log -1` unchanged at `48e56d7`.

---
*Phase: 02-core-model-and-loading*
*Completed: 2026-09-06*
