---
phase: 02-core-model-and-loading
plan: 06
subsystem: core-writer
tags: [yaml, frontmatter, write, golden, vitest]

requires:
  - phase: 02-core-model-and-loading
    provides: "02-01 splitFrontmatter, normaliseText, stringNumerics (load/frontmatter.ts); loadSnapshot; valid-build fixture; 02-02 pinned the loader unchanged"
provides:
  - "`setFrontmatterKey(text, key, value)` (D-43): one key changes, every other byte of frontmatter and body survives"
  - "D-44/D-45 serialisation: block list of double-quoted tags, `verified: []` when empty, plain booleans, `verified` last, new keys inserted before `verified`"
  - "FMT-08 on the write path: LF, no BOM, BOM+CRLF input yields the same text as LF input"
  - "Three full-text Markdown goldens and a loadSnapshot round trip; `setFrontmatterKey` and `FrontmatterValue` in the built bundle (D-55)"
affects: [phase-4-gates, phase-5-cli, phase-8-mcp]

actuals:
  tokens: 4000
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Locate with parseDocument, serialise only the new pair, splice into the original YAML text: the untouched keys are never re-serialised"
    - "Markdown goldens via toMatchFileSnapshot on whole-file text; assertions on frontmatterLines() and fromIntent() slices"

key-files:
  created:
    - packages/core/src/write/frontmatter.ts
    - packages/core/test/write.test.ts
    - packages/core/test/__golden__/LOGIN-1.verified.md
    - packages/core/test/__golden__/LOGIN-1.ac_hash.md
    - packages/core/test/__golden__/ticket-build.verified-empty.md
  modified:
    - packages/core/src/index.ts
    - packages/core/test/bundle.test.ts

key-decisions:
  - "The write splices a freshly serialised pair into the original YAML text instead of returning doc.toString(); doc.toString() collapses the alignment padding before trailing comments and moves the template's trailing guidance comment, which would break the plan's own byte-for-byte assertions"
  - "A new key with no existing `verified` is appended as the last line of the block, after any trailing comment; the template's `# verified: []` guidance stays above the real key"

patterns-established:
  - "Pair span = [key.range[0], value.range[2]): trailing comment and newline inside, following comment lines belong to the next key (yaml 2.9, verified by probe)"

requirements-completed: [CORE-02, FMT-08]

coverage:
  - id: D1
    description: "A tick write, an ac_hash insert, and an empty verified list each change exactly one key; comments, other keys, and the body survive byte-for-byte"
    requirement: CORE-02
    verification:
      - kind: unit
        ref: "packages/core/test/write.test.ts#setFrontmatterKey (D-43, D-44, D-45)"
        status: pass
    human_judgment: false
  - id: D2
    description: "loadSnapshot over the written text equals the original except for the changed key; scenarios shift by exactly the added line"
    requirement: CORE-02
    verification:
      - kind: unit
        ref: "packages/core/test/write.test.ts#loadSnapshot over the written text differs from the original only in the changed key"
        status: pass
    human_judgment: false
  - id: D3
    description: "BOM+CRLF input yields LF, BOM-free text identical to the LF output; a non-leading U+FEFF is preserved as content; writes are idempotent"
    requirement: FMT-08
    verification:
      - kind: unit
        ref: "packages/core/test/write.test.ts#round trip, encoding, and idempotence (CORE-02, FMT-08, D-38)"
        status: pass
    human_judgment: false
  - id: D4
    description: "dist/index.d.ts declares setFrontmatterKey and FrontmatterValue without a yaml type on any export line"
    verification:
      - kind: unit
        ref: "packages/core/test/bundle.test.ts#declarations expose the seam"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-06
status: complete
---

# Phase 2 Plan 06: Frontmatter Write Primitive Summary

**`setFrontmatterKey` rewrites exactly one frontmatter key by splicing a yaml-serialised pair into the original text, so alignment, comments, quoting, and the body survive byte-for-byte; `verified` is a block list of double-quoted tags and stays last, output is LF without BOM for any input encoding.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-06T08:03:00Z
- **Completed:** 2026-09-06T08:11:00Z
- **Tasks:** 2
- **Files modified:** 7 (staged, uncommitted)

## Accomplishments

- `packages/core/src/write/frontmatter.ts`: parses the block with `parseDocument` (same `core` schema and `stringNumerics` as the loader) to validate it and locate the key, serialises only the new pair with `Scalar.QUOTE_DOUBLE` and `seq.flow` for the empty list, and splices it into the original YAML text at the key's range, before `verified`, or at the end of the block. Throws `setFrontmatterKey: ...` on no block, invalid YAML, or a non-map document.
- Three Markdown goldens: `verified` set to two tags on LOGIN-1, `ac_hash` inserted before `verified`, `verified: []` appended to the build template. Assertions cover the padded `id` comment line, the comment line above `tracker`, the unquoted Vietnamese title, the body from `## Intent` onward, the comment-line set of the template, and the YAML injection case from T-02-17.
- Round trip through `loadSnapshot` (frontmatter equal except the key, scenarios shifted by one line, no errors), BOM+CRLF parity, non-leading U+FEFF preserved, idempotence, and a one-line diff when the current value is rewritten.
- `setFrontmatterKey` and `FrontmatterValue` exported from the barrel and asserted in the built `dist/index.d.ts`.

## Prepared Commits

Nothing was committed. Every file is staged; the owner reviews and commits.

1. `feat(02-06): setFrontmatterKey write primitive with Markdown goldens (D-43, D-44, D-45, FMT-08)`
   - packages/core/src/write/frontmatter.ts, packages/core/src/index.ts, packages/core/test/write.test.ts, packages/core/test/__golden__/LOGIN-1.verified.md, packages/core/test/__golden__/LOGIN-1.ac_hash.md, packages/core/test/__golden__/ticket-build.verified-empty.md
2. `test(02-06): round trip, encoding, idempotence, and the bundle export of setFrontmatterKey`
   - packages/core/test/write.test.ts, packages/core/test/bundle.test.ts
3. `docs(02-06): complete frontmatter write primitive plan`
   - .planning/phases/02-core-model-and-loading/02-06-SUMMARY.md, .planning/STATE.md, .planning/ROADMAP.md

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | setFrontmatterKey, one key changes | uncommitted (owner review pending) | see Prepared Commit 1 |
| 2 | Round trip, encoding, idempotence, bundle export | uncommitted (owner review pending) | see Prepared Commit 2 |

## Verification

- `npm run check` (build, lint, typecheck, vitest) exits 0: 13 test files, 195 tests, 0 failures (baseline was 12 files, 184 tests; this plan adds 11).
- Every Task 1 acceptance grep holds: the body from `## Intent` diffs empty against the fixture; `ac_hash: "deadbeef"` is line 15 and line 16 is `verified:`; `^verified: \[\]` counts 1 in the template golden; no `\r` and no BOM in any golden; `export { setFrontmatterKey }` once in index.ts; no `node:` under `src/write`.
- Task 2: `setFrontmatterKey` appears in `dist/index.d.ts`, no export line mentions `yaml`; write.test.ts contains `bomCrlf`, `loadSnapshot(`, and `0xfeff`.
- `git hash-object` of `valid-build.snapshot.json` is `855db6c7` before and after. `git log -1` is still `48e56d7`.

## Decisions Made

- **Splice instead of `doc.toString()` (see Deviations).** `parseDocument` still does the validation and locating the plan asks for; only the changed pair is serialised by `yaml`.
- A new key is inserted at the end of the pair before `verified` (not at `verified`'s key offset), so a comment line above `verified` stays attached to `verified`, matching where `doc.toString()` would have put it.
- When `verified` is absent, the new key is appended after the last line of the block, including after a trailing comment. `verified: []` therefore lands after the template's `# verified: []` guidance line rather than before it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's `doc.toString()` output could not satisfy the plan's own byte-for-byte assertions**
- **Found during:** Task 1, first probe on the valid-build fixture
- **Issue:** Re-serialising the whole document turns `id: LOGIN-1                       # equals the file name` into `id: LOGIN-1 # equals the file name` (the padding before a trailing comment is not kept in yaml's AST). That fails the Task 1 assertion that the line is unchanged, the Task 2 assertion that rewriting `verified: [ac-1]` changes exactly one line, and must-have truth 1. It also moves the template's trailing guidance block after `verified: []` with an added blank line, and would re-indent or collapse blank lines a BA wrote.
- **Fix:** Keep `parseDocument` for validation and to read `key.range[0]` / `value.range[2]`; build the new pair in a fresh `Document` and `toString` only that; splice it into the original YAML text. The rest of the block is never re-serialised.
- **Files modified:** packages/core/src/write/frontmatter.ts
- **Commit:** uncommitted (owner review pending)

No dependency added; `package.json` and `package-lock.json` unchanged.

## Findings / Decisions for Owner

1. **Placement of `verified: []` in the template golden.** The plan expected yaml's placement (real key first, guidance comment after it as a document comment). With the splice the key is the last line of the block and the `# verified: []` guidance stays above it. Both satisfy "verified is the last key"; if you prefer the guidance line to disappear when the key is written, that is a Phase 5 `new ticket` template decision, as the plan's flagged assumption already notes.
2. **Trailing comment on a rewritten key loses its padding.** Only the changed key is re-serialised, so `ui: true      # note` becomes `ui: false # note`. The plan accepts this for the changed key; every other line is byte-identical.
3. **Blank line before the closing `---`.** If a block ends with a blank line and `verified` is absent, the appended key follows that blank line (the blank line is kept where the author left it). Not pinned by a test; say if you want the key to sit directly under the last content line instead.
4. **Requirements checkboxes.** CORE-02 and FMT-08 were already marked complete by 02-01; this plan's mark-complete is a no-op re-run, same as 02-02 Finding 6.

## Known Stubs

None.

## Threat Flags

None. T-02-17 (YAML injection) is pinned by the `x: y\nz # c` test; T-02-18 by the goldens and the comment-set assertion; T-02-19 by the double-quote assertions; T-02-SC holds: no package added.

## Issues Encountered

- Node 24 cannot run the source directly because of the `.js` import specifiers, so the yaml range probe ran as a throwaway vitest file (deleted afterwards).

## Next Phase Readiness

- Phase 4 (`ac_hash`), Phase 5 and 8 (`verified`, `status`) call `setFrontmatterKey(text, key, value)` from `@accord-dev/accord-core`; the signature and the D-44/D-45 output format are now pinned by goldens.
- This was the last plan of Phase 2; the phase is ready for verification.

## Self-Check: PASSED

- Created files exist: `packages/core/src/write/frontmatter.ts`, `packages/core/test/write.test.ts`, and the three goldens under `packages/core/test/__golden__/` are present and staged.
- Commits: none by design (owner commits); `git log -1` unchanged at `48e56d7`.

---
*Phase: 02-core-model-and-loading*
*Completed: 2026-09-06*
