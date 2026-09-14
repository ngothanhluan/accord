---
phase: 03-lint
plan: 06
subsystem: core-lint
tags: [lint, tokens, prototype, allowlist, derived-from, goldens, vitest]

# Dependency graph
requires:
  - phase: 03-lint
    provides: "03-01: `RULES` row shape, `Draft`, `RepoSnapshot.files` with normalised prototype and tokens text, `PROTOTYPE` and `normaliseKey` exported from `load/snapshot.ts`; 03-05: `lint-missing-files` fixture and golden"
  - phase: 02-core-model-and-loading
    provides: "`snapshot.tree` (sorted forward-slash paths) for the D-67 existence check; `config.design.tokens`"
provides:
  - "`tokenNames`, `offending`, `scanPrototype`, `derivedFrom` in `lint/tokens.ts`: the research probe ported as pure functions, no `node:` import, no CSS or HTML parser"
  - "Three `Rule['check']` functions: `tokenHardcoded` (D-66, D-68), `tokensMissing` (D-67), `prototypeDerivation` (D-67); `RULES` has 30 rows, all three new rows `warning`"
  - "Fixtures `lint-tokens` (eight research findings, no ticket file) and `lint-no-tokens` (four header shapes) with lint and snapshot goldens"
  - "`valid-build` extended with `accord/assets/LOGIN-1/prototype.html` and a two-token `tokens.css`; tree, file-list, and `snapshot.files` pins updated"
affects: [04-gates, 05-cli, 06-skills]

# Actuals (#2632) — chars/4 over the realized diff: 28,634 chars of new files + 1,196 chars added across the three
# regenerated goldens + ~5,000 chars of edits (rules.ts rows and import, lint.test.ts describes, three pins, tokens.css)
actuals:
  tokens: 8700
  tasks: 2
  commits: 0
plan_head_before: f4cc8cc920ef165e7f71bed0dd023550f2c74a38

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Offset-to-line scanner: blank comments and scripts with spaces (newlines kept), match on the blanked body, map each offending token's offset to a line through a binary search over line starts"
    - "Class scanning is one anchored regex per whitespace-delimited token, never an unanchored regex over the document (Pitfall 10)"
    - "A rule that depends on a configured file reads `config.design.tokens` through `normaliseKey` and checks `key in snapshot.files`; absent means the sibling `*-missing` rule reports it once and the consumer returns `[]`"

key-files:
  created:
    - packages/core/src/lint/tokens.ts
    - packages/core/test/tokens.test.ts
    - packages/core/test/fixtures/lint-tokens/accord/config.yml
    - packages/core/test/fixtures/lint-tokens/accord/assets/PROTO-1/prototype.html
    - packages/core/test/fixtures/lint-tokens/src/tokens.css
    - packages/core/test/fixtures/lint-no-tokens/accord/config.yml
    - packages/core/test/fixtures/lint-no-tokens/accord/assets/A/prototype.html
    - packages/core/test/fixtures/lint-no-tokens/accord/assets/B/prototype.html
    - packages/core/test/fixtures/lint-no-tokens/accord/assets/C/prototype.html
    - packages/core/test/fixtures/lint-no-tokens/accord/assets/D/prototype.html
    - packages/core/test/fixtures/lint-no-tokens/src/base.css
    - packages/core/test/fixtures/valid-build/accord/assets/LOGIN-1/prototype.html
    - packages/core/test/__golden__/lint-tokens.lint.json
    - packages/core/test/__golden__/lint-tokens.snapshot.json
    - packages/core/test/__golden__/lint-no-tokens.lint.json
    - packages/core/test/__golden__/lint-no-tokens.snapshot.json
  modified:
    - packages/core/src/lint/rules.ts
    - packages/core/test/lint.test.ts
    - packages/core/test/snapshot.test.ts
    - packages/cli/test/load.test.ts
    - packages/core/test/fixtures/valid-build/src/styles/tokens.css
    - packages/core/test/__golden__/lint-missing-files.lint.json
    - packages/core/test/__golden__/valid-build.snapshot.json
    - packages/core/test/__golden__/verification-edges.lint.json

key-decisions:
  - "`scanPrototype` sorts by line then reason with code-point comparison, so the three line-16 class findings come out `bg-[#fff]`, `hover:bg-[...]`, `p-[13px]`; the plan's prose listed them in a different order but asked for that sort"
  - "`accord/assets/LOGIN-1/prototype.html` sits before `accord/config.yml` in every pinned list because the tree is code-point sorted; the plan's 'insert after config.yml' would have failed the pin"
  - "`tokensMissing` echoes `config.design.tokens` as written (like `reportMissing`), not the normalised key"
  - "Fixture `A` in `lint-no-tokens` is the shipped header byte-for-byte, `TICKET-ID` included; prototypes are not sentinel-linted"

patterns-established:
  - "Token-rule reasons are `<prop>: <why> <token>` or `class <name>: <why> <token>`, with `; tokens are read from config.design.tokens only` appended to every unknown-token reason (owner resolution of RESEARCH Open Question 6)"
  - "Golden deltas proven with a pre-task copy in the scratchpad (03-05 pattern): three regenerated goldens diffed, `valid-build.lint.json` and the seven must-not-change lint goldens byte-identical"

requirements-completed: [LINT-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "`tokenNames` extracts every `--name` at any nesting (`:root`, `@theme`, `@theme inline`, attribute blocks) after comment removal, skipping wildcards and `initial`; the research sample yields exactly four names"
    requirement: LINT-04
    verification:
      - kind: unit
        ref: "packages/core/test/tokens.test.ts#tokenNames (D-66)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`offending` and `scanPrototype`: literal colours on colour properties, literal lengths on spacing properties, unknown `var()` names, across `<style>`, both `style=` quote styles, arbitrary-value classes with variants and opacity, and `[prop:value]` classes; comments and scripts blanked; exemptions case-insensitive; the research prototype yields exactly its eight findings at their lines; a 1 MB input scans in linear time"
    requirement: LINT-04
    verification:
      - kind: unit
        ref: "packages/core/test/tokens.test.ts#offending (D-66) (18 tests)"
        status: pass
      - kind: unit
        ref: "packages/core/test/tokens.test.ts#scanPrototype (D-66, D-68) (3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "`lint.token-hardcoded` is a warning on every prototype in `snapshot.files` with a line, ticket file or not; never an error"
    requirement: LINT-04
    verification:
      - kind: unit
        ref: "packages/core/test/lint.test.ts#fixture lint-tokens: pinned lint values"
        status: pass
      - kind: unit
        ref: "packages/core/test/__golden__/lint-tokens.lint.json (8 warnings, errors 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "`lint.tokens-missing` at `/design/tokens` when the configured tokens file is absent, its reason naming `config.design.tokens` as the only source, and the allowlist check skipped"
    requirement: LINT-04
    verification:
      - kind: unit
        ref: "packages/core/test/lint.test.ts#fixture lint-missing-files: pinned lint values > a configured tokens file absent from the snapshot warns at /design/tokens"
        status: pass
    human_judgment: false
  - id: D5
    description: "`lint.prototype-derivation` without a tokens file: no `Derived from:` line (line 1), placeholder or empty list (that line), a path not in `snapshot.tree` (that line, naming the path); an existing path is silent and hard-coded colours are not checked"
    requirement: LINT-04
    verification:
      - kind: unit
        ref: "packages/core/test/tokens.test.ts#derivedFrom (D-67, A4) (4 tests)"
        status: pass
      - kind: unit
        ref: "packages/core/test/lint.test.ts#fixture lint-no-tokens: pinned lint values"
        status: pass
      - kind: unit
        ref: "packages/core/test/lint.test.ts#fixture verification-edges: pinned lint values"
        status: pass
    human_judgment: false
  - id: D6
    description: "`valid-build` carries a token-clean prototype with a header and lints with no token or derivation finding; its snapshot golden, tree pin, CLI file-list pin, and `snapshot.files` pin include the prototype; `RULES` has 30 rows and the built bundle still imports no Node built-in"
    requirement: LINT-04
    verification:
      - kind: unit
        ref: "packages/core/test/lint.test.ts#fixture valid-build: pinned lint values (files pin and no-token-finding test)"
        status: pass
      - kind: integration
        ref: "npm run build && npm run lint && npm run typecheck && npm test (18 files, 388 tests); grep -c node: packages/core/dist/index.js -> 0"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-09-14
status: complete
---

# Phase 3 Plan 06: Token rule (LINT-04) and the `valid-build` prototype Summary

**A prototype's hard-coded colour or spacing now warns at the exact line (`<style>`, `style=` attributes, arbitrary-value utility classes) against the names declared in the configured tokens file, a missing tokens file is reported once on `config.yml`, and a prototype without a tokens file must name existing source files in its `Derived from:` header; `RULES` reaches 30 rows, all three new rows warning-only.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-14T05:30:42Z
- **Completed:** 2026-09-14T05:35:47Z
- **Tasks:** 2
- **Files modified:** 24 (16 created, 8 modified)

## Accomplishments

- `lint/tokens.ts` ports the RESEARCH.md verified `tokenNames`, `offending`, and `scanPrototype` with the BOM/CRLF replace removed (the loader normalises), a line-then-reason sort added, the `; tokens are read from config.design.tokens only` suffix on every unknown-token reason, and `[prop:value]` arbitrary-property classes scanned as declarations (A10). Constants: the A5 property lists, the utility prefix sets, the six locked exemptions, and the 148 CSS Color Level 4 named colours. `derivedFrom` reads the first comment's `Derived from:` list up to the next `Key:` line, drops `<...>` placeholders, and normalises separators through `normaliseKey`.
- `tokens.test.ts` pins the research probe: the four-name tokens sample, 18 `offending` rows, the eight-finding prototype as an explicit line-numbered literal, the A10 class, a 1 MB linear-time bound, and four header shapes (26 tests).
- Three rules: `tokenHardcoded` returns `[]` without a tokens key or with the key absent, else scans every `PROTOTYPE` key in `snapshot.files`; `tokensMissing` reports once at `/design/tokens`; `prototypeDerivation` runs only when `design.tokens` is empty. `PROTOTYPE` and `normaliseKey` are imported, not re-declared.
- Fixture `lint-tokens` (no ticket file, D-68): exactly eight `lint.token-hardcoded` warnings at lines 10, 11, 12, 16, 16, 16, 17, 18, `errors: 0`. Fixture `lint-no-tokens`: `A` (shipped header verbatim) at line 3 "lists no path", `C` at line 3 naming `src/nope.css`, `D` at line 1 "no Derived from: line", `B` silent with a `color: #fff` proving the allowlist check is skipped.
- `lint-missing-files.lint.json` gains `lint.tokens-missing` beside `lint.report-missing`; `verification-edges.lint.json` gains one `lint.prototype-derivation` at line 1 of `accord/assets/A/prototype.html`; `valid-build.snapshot.json` gains the prototype in `files` and `tree` and the two-token `tokens.css` text; `valid-build.lint.json` is byte-identical to its pre-task copy, as are the seven other existing lint goldens.
- `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` (18 files, 388 tests) green on Windows; `dist/index.js` has no `node:` import.

## Task Commits

Per the owner's rule, nothing was committed or staged; every change sits in the working tree for review.

1. **Task 1: Token extraction, value classification, prototype scanner, header parser** - `uncommitted` (feat)
2. **Task 2: The three token rules, fixtures, the `valid-build` prototype, goldens and pins** - `uncommitted` (feat)

**Plan metadata:** `uncommitted` (docs)

## Files Created/Modified

Created:
- `packages/core/src/lint/tokens.ts` - four exported functions, three rule checks, module-private constants
- `packages/core/test/tokens.test.ts` - 26 tests over the research probe
- `packages/core/test/fixtures/lint-tokens/{accord/config.yml,src/tokens.css,accord/assets/PROTO-1/prototype.html}` - the Test 1 sample and the Test 3 prototype with `var(--spacing)` in place of `var(--space-2)`
- `packages/core/test/fixtures/lint-no-tokens/{accord/config.yml,src/base.css,accord/assets/{A,B,C,D}/prototype.html}` - four header shapes under empty `design.tokens`
- `packages/core/test/fixtures/valid-build/accord/assets/LOGIN-1/prototype.html` - shipped header with `LOGIN-1` and `Derived from: src/styles/tokens.css`, token-only styles and classes
- `packages/core/test/__golden__/{lint-tokens,lint-no-tokens}.{lint,snapshot}.json`

Modified:
- `packages/core/src/lint/rules.ts` - three rows appended, one import
- `packages/core/test/lint.test.ts` - `valid-build` files pin updated plus a no-token-finding test; pinned describes for `lint-tokens`, `lint-no-tokens`, `verification-edges`; a `tokens-missing` test in the `lint-missing-files` describe
- `packages/core/test/snapshot.test.ts`, `packages/cli/test/load.test.ts` - `accord/assets/LOGIN-1/prototype.html` in the tree and file-list pins
- `packages/core/test/fixtures/valid-build/src/styles/tokens.css` - `:root { --color-primary: #0055ff; --space-2: 0.5rem; }`
- Three goldens regenerated with the deltas listed above

## Decisions Made

- The line-16 class findings are emitted in code-point reason order (`bg-[#fff]`, `hover:bg-[...]`, `p-[13px]`); the plan's prose listed `p-[13px]` second but specified "sorted by line then reason", and the engine's own sort produces the same order in the golden.
- `accord/assets/LOGIN-1/prototype.html` is inserted before `accord/config.yml` in the three pinned lists (code-point order), not after as the plan's wording said.
- `tokensMissing` echoes the raw config value, mirroring `reportMissing` from 03-05.
- `A` in `lint-no-tokens` keeps the shipped header byte-for-byte (`TICKET-ID` included); `lint.sentinel` runs over tickets only, so it stays silent.

## Deviations from Plan

None - plan executed as written. The two wording mismatches above (sort order of the line-16 findings, insertion position in the pins) were resolved in favour of the plan's own stated rule (code-point sort) and are recorded as decisions, not code deviations.

## Issues Encountered

- **Golden deltas cannot be read from `git diff`** for the `.lint.json` goldens (still untracked since 03-01). As in 03-05, all 30 goldens were copied to the scratchpad before Task 2; the three regenerated ones were diffed against those copies and the rest compared with `cmp`. `valid-build.lint.json` did not change.
- A heredoc through the Bash tool failed to parse on the first attempt at writing `tokens.test.ts` (shell quoting, not a project issue); the file was written with the Write tool, which the session hooks did not block.

## TDD Note (Task 1, `tdd="true"`)

`tokens.test.ts` was written first and run: the file failed to collect (`../src/lint/tokens.js` missing). After `tokens.ts` was written, all 26 tests passed on the first GREEN run; no refactor step was needed. `workflow.tdd_mode` is `false` and the owner rule forbids commits, so no RED/GREEN commit pair exists.

## Prohibitions (must_haves) — verification

| Statement | Result |
|---|---|
| No `git commit`, `git push`, `git tag`; no attribution trailer | Verified: HEAD is still `f4cc8cc920ef165e7f71bed0dd023550f2c74a38`; `git diff --cached` is empty |
| No CSS, HTML, or utility-class library; `tokens.ts` uses `String`, `RegExp`, `Set`, arrays; imports nothing from `node:` | Verified: `grep -c "node:" tokens.ts` prints 0; imports are `../load/snapshot.js`, `../model/snapshot.js`, `./rules.js` only; `git diff --stat -- package-lock.json` is empty |
| `lint.token-hardcoded` is never an error | Verified: the row is `warning`; `grep -c "level: '" tokens.ts` prints 0; `lint-tokens.lint.json` has `errors: 0` |
| `tokens.ts` never normalises BOM or CRLF and never imports `load/frontmatter.ts` | Verified: `grep -c frontmatter tokens.ts` prints 0; no `\r` or BOM handling in the file; the five encoding variants of `lint-tokens` and `lint-no-tokens` lint identically |
| No shipped reason names a CSS framework or another tool | Verified by review: reasons are `hard-coded colour`, `hard-coded spacing`, `unknown token`, `class <name>`, `tokens are read from config.design.tokens only`, and the three derivation sentences; the fixture `@theme` blocks are the plan's own sample |
| `LOGIN-1.md` in `valid-build` not edited | Verified: `git diff --stat -- .../LOGIN-1.md` is empty; `LOGIN-1.*.md` goldens unchanged |

## Open questions for the owner

None blocking. Heuristic readings the plan left implicit, chosen as its tests imply:

1. **Line attribution for a gradient with a blanked `var()`.** `scanPrototype` locates a token with `d[0].indexOf(token)`; for `linear-gradient(#fff, var(--color-primary))` the reported token is the gradient text with the `var()` blanked, so `indexOf` returns -1 and the offset lands one character before the declaration. On a declaration starting at column 0 that is the previous line. Ported verbatim from the verified research code; no fixture exercises it. Alternative: clamp the offset at the declaration start.
2. **A colour literal on a spacing property** (`padding: red`) is reported as `hard-coded colour`, because the research `offending` tests `isColor` before the property kind. Harmless and arguably true; alternative: only colour properties report colours.
3. **Arbitrary-property classes** `[prop:value]` treat `_` as a space, the same as arbitrary values; the plan's A10 said only "as a declaration".
4. **`50%` on a spacing property is flagged** while `100%` is exempt, and `2px` is flagged while `1px` is exempt: the locked D-66 starting set, applied literally.

The plan's `flagged_assumptions` table (A4, A5, A6, A10, the Open Question 6 resolution, the skipped allowlist without tokens, `var()` with a literal fallback accepted when the name is known, and the `valid-build` reference keeping its three existing warnings) stands as written.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 is complete: 30 lint rules, sixteen lint goldens, `npm run check` green on Windows with nothing committed; the owner reviews the working tree for plans 03-01 to 03-06 together.
- Phase 4 gates can read `lint.token-hardcoded` as a warning that never blocks (GATE-12 deferred) and reuse `snapshot.tree` membership for GATE-04 exactly as `prototypeDerivation` does.
- Phase 6 skill text can quote the `Derived from:` sentences and the `tokens are read from config.design.tokens only` clause verbatim.

## Self-Check: PASSED

- Created files verified on disk: `src/lint/tokens.ts`, `test/tokens.test.ts`, `fixtures/lint-tokens/{accord/config.yml,src/tokens.css,accord/assets/PROTO-1/prototype.html}`, `fixtures/lint-no-tokens/{accord/config.yml,src/base.css,accord/assets/{A,B,C,D}/prototype.html}`, `fixtures/valid-build/accord/assets/LOGIN-1/prototype.html`, four `__golden__/{lint-tokens,lint-no-tokens}.{lint,snapshot}.json` (all FOUND).
- Modified files verified by grep: 30 `id: 'lint.` rows and the `./tokens.js` import in `rules.ts`; `fixture lint-tokens: pinned lint values` in `lint.test.ts`; `accord/assets/LOGIN-1/prototype.html` in `snapshot.test.ts` and `cli/test/load.test.ts`; `--space-2` in `valid-build/src/styles/tokens.css`; `/design/tokens` in `lint-missing-files.lint.json`; `lint.prototype-derivation` in `verification-edges.lint.json`.
- Commit-hash check skipped by owner rule (nothing committed by design); `git log -1` equals `plan_head_before`.

---
*Phase: 03-lint*
*Completed: 2026-09-14*
