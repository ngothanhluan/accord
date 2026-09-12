---
phase: 02-core-model-and-loading
verified: 2026-09-06T08:16:27Z
status: human_needed
score: 48/50 must-haves verified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "A machine without `git` raises `UsageError` (plan 02-07 truth 5, the ENOENT half)"
    test: "On a shell where `git` is not on PATH (or with PATH emptied for the process), run `node -e \"import('./packages/cli/src/load/fs.js')\"`-equivalent through vitest or a Phase 5 spawn test and call `loadFromFs(<any dir>)`."
    expected: "Throws `UsageError` with message `git is required but was not found on PATH` and `exitCode` 2; no shell is involved."
    why_human: "The test suite cannot remove git from PATH without an injectable environment; only the not-a-repository branch of the same `catch` is exercised (SUMMARY 02-07 coverage item D6, human_judgment: true)."
coincidental_reliance_items:
  - truth: "A directory that is not a git repository raises `UsageError` (plan 02-07 truth 5)"
    reason: undeclared-precondition
    harden: "The test `a directory that is not a repository is a UsageError` assumes `os.tmpdir()` is outside any git work tree (comment in load.test.ts line 119). Declare it by creating the temp dir under a path proven repo-free, or init a bare marker and assert on it, so a CI runner whose temp dir sits inside a checkout cannot turn the test green for the wrong reason."
human_verification:
  - test: "After the owner commits and pushes to `main`, open the GitHub Actions run named `ci` and check the two Ubuntu legs (ubuntu-latest/22, ubuntu-latest/24) alongside the two Windows legs."
    expected: "All four legs green; in particular `packages/core/test/snapshot.test.ts` (five fixture goldens), `packages/core/test/write.test.ts` (three Markdown goldens), and `packages/cli/test/load.test.ts` (parity with `valid-build.snapshot.json` from a real `git ls-files` tree) pass on Ubuntu with the committed goldens unchanged (ROADMAP criterion 4, D-54)."
    why_human: "No commit or push is allowed by AI in this repo. The Windows leg is proven locally (npm run check exit 0, 13 files / 195 tests; verifier probes below); the Ubuntu half of criterion 4 cannot run on this machine."
  - test: "On a shell where `git` is not on PATH, call `loadFromFs(<any dir>)` (Phase 5 spawn test, or vitest with an emptied PATH)."
    expected: "`UsageError`, message `git is required but was not found on PATH`, `exitCode` 2."
    why_human: "ENOENT branch of `gitTree` in packages/cli/src/load/fs.ts is present but no test exercises it (see behavior_unverified_items)."
  - test: "Decide how to resolve the MVP-mode record: ROADMAP.md marks Phase 2 `Mode: mvp` (and Phases 3 to 9), but the goal is not in User Story form (`gsd_run query user-story.validate` returns valid: false with three errors)."
    expected: "Either record a User Story goal via `/gsd-mvp-phase 2`, or clear `Mode:` on the infrastructure phases. This report verified against the five ROADMAP success criteria, the non-MVP procedure, as the team lead directed. Same open item as Phase 1 human item 4."
    why_human: "Owner decides which record stands; the verifier does not edit ROADMAP.md."
---

# Phase 2: Core Model and Loading Verification Report

**Phase Goal:** Core turns any repository snapshot into typed tickets, verification records, and scenarios with correct line numbers, whatever the line endings, BOM, or operating system.
**Verified:** 2026-09-06T08:16:27Z
**Status:** human_needed
**Re-verification:** No — initial verification

All evidence was taken from the staged working tree at HEAD `48e56d7` (nothing committed, per the owner's rule; `git diff --cached` holds the 101-file phase diff, `package.json` and `package-lock.json` unchanged). SUMMARY.md claims were treated as hypotheses and checked against files, the built bundle, and command output.

## Independent command results

`npm run check` run once by the verifier (log in the verifier scratchpad):

```
tsdown: core dist/index.js + dist/index.d.ts; cli dist/cli.js 0.43 kB
eslint .                         -> no output
tsc core, core test, cli         -> no output
vitest run v5.0.0
 Test Files  13 passed (13)
      Tests  195 passed (195)
EXIT=0
```

Verifier probe script over the built `packages/core/dist/index.js` (not the test suite), Windows 11, Node 24.14:

```
P1  stableJson(loadSnapshot(valid-build)) === committed valid-build.snapshot.json      true
P2  same fixture as BOM + CRLF text under keys like .\accord\tickets\EPIC-1.md == LF    true
P3  ticket that is only BOM+CRLF -> one load.frontmatter-missing at line 1
P4  tracker {"shortcut":"1234","jira":"1e3"}; verification reviewed_on "2026-09-01"     (strings)
P5  setFrontmatterKey on BOM+CRLF input: no CR, no BOM, byte-equal to LF-input output;
    removed lines ["  - ac-1"], added ["  - \"ac-1\"","  - \"ac-2\""]; all three comments kept
P6  loadSnapshot over the written text: 0 errors, verified ["ac-1","ac-2"], scenario lines 38, 43
P7  second identical write is byte-idempotent                                          true
P8  ac_hash inserted before `verified:`; padded `id: X   # c1`, blank line, block comment untouched
P9  verified: [] appended last; reload has 0 errors
P10 `## Acceptance criteria` and `- WHEN fake` inside a plain fence: not a section, not a
    requirement; Scenario Outline with 3 example rows = 1 ScenarioRef (keyword Scenario Outline)
```

Byte checks: all 68 files under `packages/core/test/fixtures/` and `packages/core/test/__golden__/` contain no CR byte and no BOM (node buffer scan); `git ls-files --eol` reports `i/lf w/lf` for fixtures and goldens; the seven templates and `src/generated/templates.ts` are CR-free and BOM-free. `.gitattributes` is three lines (`* text=auto eol=lf`, two binary rules); the CRLF-fixture override is gone.

Purity and spawn rules: `grep -rn "node:" packages/core/src` (excluding generated) prints nothing; `dist/index.js` imports `yaml`, `@cucumber/gherkin`, and `ajv/dist/2020` as externals and no built-in; `packages/cli/src/load/fs.ts` contains no `npx`, `npm`, `.cmd`, `.bat`, or `shell: true`; the only child process is `execFileSync('git', [...literal argv])`.

## Goal Achievement

### Observable Truths

Roadmap success criteria (the contract):

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| SC1 | Loading a fixture ticket yields frontmatter where values like `1e3`, `007`, and dates stay strings, and comments survive a tick write round-trip | ✓ VERIFIED | `frontmatter-errors.snapshot.json` TYPING: `title "007"`, tracker `{date "2026-01-01", exp "1e3", hex "0x1F", oct "0123"}` all strings; `valid-build.snapshot.json` `jira "1e3"`, `reviewed_on "2026-09-01"`. `stringNumerics` filter in `load/yaml.ts` line 7, `schema: 'core'` line 20. Tick write: `diff LOGIN-1.md LOGIN-1.verified.md` is one hunk (`- ac-1` → two quoted tags); `diff` against `LOGIN-1.ac_hash.md` is one inserted line; probes P5 to P9. |
| SC2 | Each scenario from a fenced `gherkin` block reports its Markdown line, carries its `@ac-n` tag, and a Scenario Outline counts as one scenario | ✓ VERIFIED | `valid-build` golden: scenarios at lines 37 and 42 (the `Scenario:` lines of LOGIN-1.md), `acTag` `ac-1`/`ac-2`. `gherkin-shapes` golden: OUTLINE is one ref, keyword `Scenario Outline`, line 13, steps end with `Examples: \| a \| \| 1 \| \| 2 \|`; VI Outline (`Khung kịch bản`) also one ref at line 22. Remap `fence.open + p - prepended` in `load/gherkin.ts` line 80. Probe P10. |
| SC3 | EARS lines under `## Requirements` are extracted one per line, and text inside fenced blocks is never mistaken for a section or a requirement | ✓ VERIFIED | `body-edges` golden FENCE: sections `Requirements/7, Acceptance criteria/23, Plan/32` (the `## Acceptance criteria` at line 13 inside `~~~` is absent); requirements exactly `WHEN one..five` at lines 16 to 20 with `-`, `*`, `+`, `1.` markers stripped; commented `WHEN` at line 10 absent; `@ac-9` fence under `## Plan` yields no scenario. UNTERMINATED: one section, no finding. `scan()` fence state machine `load/sections.ts` lines 33 to 75; `requirementLines` lines 136 to 142. Probe P10. |
| SC4 | The same fixture saved as LF, CRLF, and BOM+CRLF produces byte-identical snapshot goldens on Ubuntu and Windows CI, including a fixture with Windows-style paths | ? UNCERTAIN (Windows half VERIFIED) | Windows: `snapshot.test.ts` asserts `crlf`, `bomCrlf`, `mixed`, and `backslash` (`.\` prefix, `\` separators) variants equal LF for all six fixtures and that no `\\` reaches the JSON; `cli/test/load.test.ts` reproduces the golden from a real Windows working tree via `git ls-files`; probe P2 repeats it through dist. Ubuntu: needs the owner's push (human item 1). CI matrix unchanged from Phase 1 (`ubuntu-latest`, `windows-latest` × Node 22, 24) and runs `npm test` over both vitest projects. |
| SC5 | Every file core emits is LF and UTF-8 without BOM | ✓ VERIFIED | `setFrontmatterKey` builds from `splitFrontmatter` (BOM stripped, CRLF → LF) and joins with `\n`; `write.test.ts` asserts no `\r` and BOM+CRLF input equals LF-input output; three Markdown goldens are CR-free, BOM-free; probe P5. Templates (Phase 1 emitter) re-checked CR-free, BOM-free. |

Plan 02-01 truths (tracer):

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `loadSnapshot({ files, tree })` is pure, synchronous, returns `config/tickets/verifications/tree/errors`, never throws on valid-build | ✓ VERIFIED | `load/snapshot.ts` lines 62 to 106: no async, no I/O, every parser returns findings; `errors: []` in the golden; determinism test passes. |
| 2 | LOGIN-1 tracker `{ shortcut: '1234', jira: '1e3' }`, verification `commit '1234567'`, `reviewed_on '2026-09-01'` as strings | ✓ VERIFIED | Golden values; `snapshot.test.ts` lines 79 to 90; probe P4. |
| 3 | Two scenarios at lines 37 and 42, `acTag` ac-1/ac-2, keyword `Scenario`, steps begin with the Background step | ✓ VERIFIED | Golden and `snapshot.test.ts` lines 97 to 110; `walk()` prepends background (`gherkin.ts` line 53). |
| 4 | LOGIN-1 requirements at lines 25, 26 with `- ` stripped; EPIC-1 one plain line at 12 | ✓ VERIFIED | Golden; `snapshot.test.ts` lines 112 to 120. |
| 5 | LF, CRLF, BOM+CRLF, mixed, backslash-key JSON byte-identical; golden has no backslash path | ✓ VERIFIED | `snapshot.test.ts` lines 27 to 38 for every fixture; golden `\\` count is 0 (its one `\n` escape is the evidence newline); probe P2. |
| 6 | No input mutation; two calls identical | ✓ VERIFIED | `snapshot.test.ts` lines 40 to 46 (`structuredClone` before/after). |
| 7 | EPIC-1 `ui` is `false` with no `ui` key; zero scenarios, no error | ✓ VERIFIED | `snapshot.ts` line 28 (`ui: fm.value.ui ?? false`); golden; test line 92. |
| 8 | `tree` sorted forward-slash list; `product/glossary.md` yields neither ticket nor error | ✓ VERIFIED | Golden `tree` of 8 paths; only `TICKET`/`VERIFICATION` regexes classify (`snapshot.ts` lines 18, 19). |
| 9 | `Finding` is `{ file, line?, rule, reason, pointer? }`; `validate()` returns `SchemaFinding[]`; Phase 1 goldens carry `pointer` | ✓ VERIFIED | `model/finding.ts`; `ajv.ts` line 34 `pointer: e.instancePath`; `grep '"path":'` on the four goldens is 0. |
| 10 | Core exports `loadSnapshot` and the model types; `dist/index.d.ts` export lines mention neither `@cucumber` nor `yaml` | ✓ VERIFIED | `grep '^export' dist/index.d.ts` lists `loadSnapshot`, `setFrontmatterKey`, `validate`, `schemaIds`, `templates`, and the 16 type names; no parser type; `bundle.test.ts` lines 51 to 64. |

Plan 02-02 truths (frontmatter and config errors):

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Nine broken tickets keep an entry keyed by stem, `frontmatter` absent, body parsed; no partial object | ✓ VERIFIED | Golden ticket ids `EMPTY, EMPTYFM, MISMATCH, NOFM, NOTMAP, SCHEMA, SYNTAX, TYPING, UNTERMINATED`; only MISMATCH and TYPING have `frontmatter`; `frontmatter.ts` line 57 (`value` only with zero findings). |
| 2 | D-33 lines: missing → 1; syntax → yaml line + 1; non-map/empty → 2; unknown key → key line; enum/type/pattern → value line; root required → 2 | ✓ VERIFIED | SCHEMA golden: `schema.required` 2 `''`, `additionalProperties` 5, `enum` 3 `/type`, `type` 7 `/assumptions/0/confirmed`, `pattern` 9 `/verified/0`; `frontmatter.test.ts` tests 37 to 71; `yaml.ts` lines 83 to 102 implement the three-way rule. |
| 3 | `id` differing from file name kept verbatim, no finding | ✓ VERIFIED | MISMATCH has `frontmatter`; no `load.*` finding for it in the golden; test line 94. |
| 4 | `007`, `0x1F`, `0123`, `1e3`, `2026-01-01` load as strings; `no` stays `'no'` and is a `schema.type` finding | ✓ VERIFIED | TYPING golden values above; SCHEMA `schema.type` at `/assumptions/0/confirmed` line 7; test line 83. |
| 5 | Zero-byte ticket → `load.frontmatter-missing` line 1, empty sections; empty `config.yml` → `load.yaml-not-map` line 1 | ✓ VERIFIED | `EMPTY.md` is 0 bytes (`i/none`); tests lines 99 and 163. |
| 6 | Missing config → `config` undefined + `load.config-missing`; invalid → every finding names `accord/config.yml`, pointer, file line | ✓ VERIFIED | `no-config`, `bad-config`, `config-syntax` goldens; `config.ts` offset 0; tests lines 134 to 160. |

Plan 02-03 truths (body edges):

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Heading or EARS line inside a fence (backtick or tilde, terminated or not) is never a section or requirement | ✓ VERIFIED | FENCE and UNTERMINATED golden values above; `sections.test.ts` lines 28 to 80. |
| 2 | `## Acceptance Criteria ##`, `##   requirements`, `## INTENT` match D-07 | ✓ VERIFIED | `headingKey` line 13; heading regex strips trailing `#` (line 68); CASE fixture test line 165. |
| 3 | Second `## Requirements` → `load.heading-duplicate` at second line; first used | ✓ VERIFIED | body-edges golden: one error `DUP.md` line 13; `duplicateHeadings` lines 78 to 100. |
| 4 | EARS = non-blank lines after comment/fence removal, one marker stripped, `###` excluded | ✓ VERIFIED | FENCE requirements; `requirementLines`; tests lines 101 to 118. |
| 5 | `gherkin` fence under `## Plan` contributes nothing | ✓ VERIFIED | FENCE scenarios `[["ac-1",28]]` only; `snapshot.ts` lines 38 to 49 bound fences to the AC section. |
| 6 | No `## Requirements` → `requirements: []`, no finding | ✓ VERIFIED | NOREQ in golden; test line 208. |

Plan 02-04 truths (Gherkin shapes):

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Outline with two rows is one ref, keyword `Scenario Outline`, steps end with one `Examples:` string | ✓ VERIFIED | OUTLINE golden steps `["Given <a>","Examples: \| a \| \| 1 \| \| 2 \|"]`; `gherkin.ts` lines 34 to 37, 40. |
| 2 | `# language: vi` → English keyword values, Vietnamese step keywords, Markdown line kept | ✓ VERIFIED | VI golden lines 17, 22; `gherkin.test.ts` lines 108 to 134. |
| 3 | Feature and Rule Backgrounds prepended; Rule name absent from scenarios | ✓ VERIFIED | RULE golden 3 steps; `walk()` lines 49 to 58. |
| 4 | Parse error → `load.gherkin-parse` at the Markdown line; frontmatter kept; scenarios empty | ✓ VERIFIED | Golden errors: PARSE-ERROR line 15, BADLANG line 10; catch block lines 88 to 99. |
| 5 | Untagged kept without `acTag`; first `@ac-n` wins; feature tag never a scenario tag; duplicate `@ac-1` kept, no finding | ✓ VERIFIED | TAGS golden: `[no acTag]`, `ac-1` of `@ac-1 @ac-2 @smoke`, `ac-3`, `ac-1`; no `@feature-tag`; errors list has no TAGS entry. |
| 6 | Two fences concatenate in order; fence without `Feature:` gets one prepended, lines still map | ✓ VERIFIED | MULTI golden lines 13, 19; `prepended` offset lines 69 to 80; test line 85. |
| 7 | No fence, or Feature-only fence → `[]`, no finding | ✓ VERIFIED | EMPTY-AC, MULTI third fence; `if (!feature) return []` line 86. |
| 8 | Same fence twice identical; fresh parser per call, no module state | ✓ VERIFIED | `new Parser(...)` inside `extractScenarios` line 82, counter `n` local; test line 155. |

Plan 02-05 truths (verification records):

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | One `EvidenceBlock` per `## @ac-n <name>`; missing/invalid `Result:` → `load.result-invalid` at block or Result line, `result` absent; evidence comment-stripped, trimmed, may be empty | ✓ VERIFIED | verification-edges golden errors `result-invalid` 16 and 22; `verification.ts` lines 29 to 49; `verification.test.ts` lines 20 to 47. |
| 2 | Orphan record → `load.verification-orphan`; broken-ticket owner is not an orphan | ✓ VERIFIED | Golden: ORPHAN finding with no line; C has `load.frontmatter-missing` and no orphan finding; `snapshot.ts` lines 96 to 103. |
| 3 | `notes.txt`, `<id>/plan.md`, `assets/<id>/prototype.html` → no entry, no finding | ✓ VERIFIED | All three in golden `tree`; tickets `A,B,C`, verifications `A,B,C,ORPHAN`; six errors, none for them. |
| 4 | Invalid record frontmatter keeps blocks, `frontmatter` absent, schema finding at the line | ✓ VERIFIED | B: `schema.pattern` `/commit` line 3; test line 58. |
| 5 | Duplicated `## @ac-1` → `load.heading-duplicate` at second heading; first kept | ✓ VERIFIED | Golden `heading-duplicate` line 31 for A; `tagOf` identity line 8. |

Plan 02-06 truths (write primitive):

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Only the requested key changes; comments, other keys, body survive byte-for-byte | ✓ VERIFIED | `diff` of the three goldens against their sources is one hunk each; splice at `[key.range[0], value.range[2])` lines 47 to 63; probes P5, P8. |
| 2 | `verified` block list, double-quoted tags, `[]` when empty, stays last; new key before `verified` | ✓ VERIFIED | Goldens; `write.test.ts` lines 30 to 63; probes P8, P9. |
| 3 | Strings double-quoted, booleans plain | ✓ VERIFIED | `Scalar.QUOTE_DOUBLE` lines 30 to 33; test line 65 (`ui: false`). |
| 4 | Output LF, no BOM, identical for BOM+CRLF input; non-leading U+FEFF preserved | ✓ VERIFIED | Tests lines 100 to 114; probe P5. |
| 5 | Round trip through `loadSnapshot` equal except the key; idempotent | ✓ VERIFIED | Test lines 86 to 119; probes P6, P7. |
| 6 | `setFrontmatterKey` exported; d.ts leaks no yaml type | ✓ VERIFIED | `dist/index.d.ts` export line; `bundle.test.ts` line 56. |

Plan 02-07 truths (CLI filesystem loader):

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `tree` from `git ls-files --cached --others --exclude-standard -z`, posix, sorted; `files` = `accord/**` plus the contained tokens file | ✓ VERIFIED | `fs.ts` lines 19 to 34, 37 to 49, 62 to 69; `load.test.ts` lines 46 to 72 pins both lists. |
| 2 | CLI snapshot equals the core golden text with `toBe`, no trimming | ✓ VERIFIED | `load.test.ts` line 50; passed in the verifier's run on Windows. |
| 3 | No backslash in any key on Windows | ✓ VERIFIED | `split(sep).join('/')` at both call sites; test lines 74 to 83 passed on Windows 11. |
| 4 | Gitignored file absent from `tree`; `.gitignore` present | ✓ VERIFIED | Test lines 85 to 96. |
| 5 | Not a repo, or no `git`, raises `UsageError`; git by bare name, literal argv, no shell | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Not-a-repo and no-`accord/` branches tested (lines 118 to 156, exit code 2 asserted). The ENOENT branch (`fs.ts` line 29) is present, wired, and unexercised by any test; SUMMARY 02-07 D6 marks it human. Routed to human verification. |

**Score:** 48/50 truths verified (1 present, behavior-unverified: 02-07 truth 5; 1 uncertain: SC4 Ubuntu leg)

### Deferred Items

None from this phase. The Phase 1 deferred item (CORE-01 first clause, "pure core over an immutable `RepoSnapshot`") is now closed: `RepoSnapshot` exists in `packages/core/src/model/snapshot.ts`, `loadSnapshot` consumes only `SnapshotInput`, and both purity layers still hold (lint clean, `node:` grep 0, bundle test).

### Required Artifacts

`gsd_run query verify.artifacts` on all seven plans: 20/20 passed (5 + 3 + 2 + 2 + 2 + 4 + 2). Level 2 to 4 by the verifier:

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/core/src/model/finding.ts` | D-52 `Finding`, `SchemaFinding` | ✓ VERIFIED | 16 lines, `pointer?: string`, `file: string`; consumed by ajv.ts, every loader, index.ts. |
| `packages/core/src/model/snapshot.ts` | 11 model interfaces, no Map/Set | ✓ VERIFIED | 89 lines, 11 `export interface`, `Map<` count 0; exported from index.ts, used by load/*. |
| `packages/core/src/validate/ajv.ts` | returns `SchemaFinding[]` with `param` | ✓ VERIFIED | Lines 22 to 40; still the only ajv importer. |
| `packages/core/src/load/yaml.ts` | `parseYamlMap`, `schemaFindings`, `stringNumerics` | ✓ VERIFIED | 103 lines; `LineCounter`, `isScalar` rule; imported by frontmatter.ts, config.ts. |
| `packages/core/src/load/frontmatter.ts` | `normaliseText`, `splitFrontmatter`, `loadFrontmatter` | ✓ VERIFIED | 59 lines; imported by config.ts, snapshot.ts, verification.ts, write/frontmatter.ts. |
| `packages/core/src/load/config.ts` | `loadConfig` | ✓ VERIFIED | 15 lines; called from snapshot.ts line 70. |
| `packages/core/src/load/sections.ts` | `scan`, `headingKey`, `d07Key`, `requirementLines`, `stripHtmlComments`, `duplicateHeadings` | ✓ VERIFIED | 142 lines; imported by snapshot.ts and verification.ts. |
| `packages/core/src/load/gherkin.ts` | `extractScenarios` | ✓ VERIFIED | 101 lines; real `Parser`/`AstBuilder`/`GherkinClassicTokenMatcher`; called from snapshot.ts line 45. |
| `packages/core/src/load/verification.ts` | `parseVerification` | ✓ VERIFIED | 67 lines; called from snapshot.ts line 89. |
| `packages/core/src/load/snapshot.ts` | `loadSnapshot` | ✓ VERIFIED | 106 lines; exported from index.ts; used by CLI loader and tests. |
| `packages/core/src/write/frontmatter.ts` | `setFrontmatterKey` | ✓ VERIFIED | 65 lines; exported; reuses `splitFrontmatter`/`stringNumerics`. |
| `packages/core/src/index.ts` | D-55 surface | ✓ VERIFIED | 22 lines; no `load/*` internals exported. |
| `packages/cli/src/load/fs.ts` | `loadFromFs`, `UsageError` | ✓ VERIFIED | 69 lines; imports `loadSnapshot` from `@accord-dev/accord-core`; used by `cli/test/load.test.ts` (Phase 5 wires it into commander). |
| `packages/core/test/helpers/fixture.ts` | `readFixture`, `variants`, `stableJson` | ✓ VERIFIED | 67 lines; `mixed` variant converts even-indexed terminators only; `backslash` rewrites keys and tree. |
| `packages/core/test/snapshot.test.ts` | per-fixture `describe('fixture <name>')` loop + pinned values | ✓ VERIFIED | 143 lines; discovers 6 fixtures with `accord/`; reads in `beforeAll`. |
| `packages/core/test/{frontmatter,sections,gherkin,verification,write}.test.ts` | edge tests | ✓ VERIFIED | 168 / 214 / 254 / 109 / 125 lines; 18 + 22 + 22 + 12 + 11 tests; no `.skip`, `.only`, `.todo`. |
| `packages/cli/test/load.test.ts` | temp-repo parity tests | ✓ VERIFIED | 157 lines, 7 tests; only `git` spawned, by `execFileSync('git', ['init', '-q'])`. |
| `packages/core/test/__golden__/*.snapshot.json` (6) | whole-snapshot goldens | ✓ VERIFIED | LF, no BOM, no `\\`; regenerated by the verifier's run without mismatch. |
| `packages/core/test/__golden__/{LOGIN-1.verified,LOGIN-1.ac_hash,ticket-build.verified-empty}.md` | full-text write goldens | ✓ VERIFIED | Each differs from its source by exactly one hunk (diff output above). |
| `packages/core/test/fixtures/{valid-build,frontmatter-errors,no-config,bad-config,config-syntax,body-edges,gherkin-shapes,verification-edges}/` | LF-only fixture repos | ✓ VERIFIED | 53 files, all LF, no BOM (`EMPTY.md` intentionally 0 bytes). |
| `.gitattributes` | three lines, CRLF override removed | ✓ VERIFIED | `cat -A` shows three LF-terminated lines. |

### Key Link Verification

`gsd_run query verify.key-links` on all seven plans: 12/13 verified. The one miss is a pattern-location artefact, resolved by hand:

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `load/snapshot.ts` | `validate/index.ts` | D-20 seam, never `./ajv.js` | WIRED (transitive) | `snapshot.ts` does not import `validate` directly; `load/frontmatter.ts` line 3 and `load/config.ts` line 4 import `from '../validate/index.js'`, and `snapshot.ts` calls both. `grep -rn 'ajv.js' packages/core/src/load packages/core/src/write` prints nothing. |
| `load/gherkin.ts` | `@cucumber/gherkin` | Parser, AstBuilder, matcher, dialects, `CompositeParserException` | WIRED | Line 2 import; all five names used. |
| `test/snapshot.test.ts` | `__golden__/valid-build.snapshot.json` | `toMatchFileSnapshot` | WIRED | Line 49; passes. |
| `src/index.ts` | `load/snapshot.ts` | `export { loadSnapshot }` | WIRED | Line 16; present in `dist/index.d.ts`. |
| `load/yaml.ts` | `yaml` | `parseDocument` + `LineCounter` | WIRED | Lines 2, 19, 20, 81. |
| `load/frontmatter.ts` | `validate/index.ts` | `validate` then `schemaFindings(file, doc, lines, 1, found)` | WIRED | Lines 55, 56. |
| `load/snapshot.ts` | `load/sections.ts` | `scan`, `requirementLines`, `duplicateHeadings` | WIRED | Line 14 import; lines 30 to 34 use. |
| `load/snapshot.ts` | `load/verification.ts` | `parseVerification` | WIRED | Lines 15, 89. |
| `write/frontmatter.ts` | `load/frontmatter.ts` | `splitFrontmatter`, `stringNumerics` reused | WIRED | Line 7; `normaliseText` runs inside `splitFrontmatter`. |
| `test/write.test.ts` | `src/index.ts` | `setFrontmatterKey`, `loadSnapshot` | WIRED | Line 3. |
| `cli/src/load/fs.ts` | `@accord-dev/accord-core` | `loadSnapshot` for the tokens pass | WIRED | Lines 6, 7, 66. |
| `cli/test/load.test.ts` | core golden | `readFileSync` + `toBe` | WIRED | Lines 12 to 14, 50. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `loadSnapshot` | `tickets[id].frontmatter` | `parseDocument(...).toJS()` gated by `validate()` | Yes (goldens, probe P4) | ✓ FLOWING |
| `loadSnapshot` | `tickets[id].scenarios` | `@cucumber/gherkin` AST walk with line remap | Yes (lines 37/42, Outline, vi) | ✓ FLOWING |
| `loadSnapshot` | `tickets[id].requirements` | `scan()` sections → `requirementLines` | Yes (FENCE golden) | ✓ FLOWING |
| `loadSnapshot` | `verifications[id].blocks` | `scan()` → tag headings → Result/Evidence regexes | Yes (verification-edges) | ✓ FLOWING |
| `loadSnapshot` | `errors` | every parser's findings, D-33 line mapping | Yes (six goldens with exact lines) | ✓ FLOWING |
| `setFrontmatterKey` | returned text | original YAML spliced with one yaml-serialised pair | Yes (goldens, probes P5 to P9) | ✓ FLOWING |
| `loadFromFs` | `tree`, `files` | `git ls-files -z`, `readdirSync` | Yes (parity with the golden from a real repo) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full check sequence | `npm run check` (run once) | exit 0; 13 files, 195 tests | ✓ PASS |
| Built bundle reproduces the golden | probe P1 | `true` | ✓ PASS |
| BOM + CRLF + Windows keys identical | probe P2 | `true` | ✓ PASS |
| Tick write from BOM+CRLF: LF, no BOM, comments kept, one hunk | probes P5 to P7 | as listed | ✓ PASS |
| Insert before `verified` with padded comments and a blank line | probe P8 | key placed, other bytes intact | ✓ PASS |
| Fenced fake heading ignored; Outline is one scenario | probe P10 | as listed | ✓ PASS |
| Fixtures and goldens LF, no BOM | node buffer scan | 68 files, 0 offenders | ✓ PASS |
| Core purity | `grep -rn "node:" packages/core/src`; eslint in `npm run check` | 0 hits; clean | ✓ PASS |
| CLI spawn rules | grep on `fs.ts` | no `npx`/`npm`/`.cmd`/`shell: true` | ✓ PASS |
| Manifests untouched | `git diff --cached --quiet -- package.json package-lock.json packages/*/package.json` | unchanged | ✓ PASS |
| No commit made | `git log -1` | `48e56d7` | ✓ PASS |
| Ubuntu CI legs | GitHub Actions | not runnable before push | ? SKIP (human) |
| `git` absent → `UsageError` | needs PATH without git | not exercised | ? SKIP (human) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist and no plan declares probe scripts. Step 7c: not applicable.

### Requirements Coverage

Plan frontmatter declares: 02-01 [CORE-02, CORE-03, CORE-06, FMT-04, FMT-05, FMT-08]; 02-02 [CORE-02, CORE-06, FMT-08]; 02-03 [FMT-05, FMT-04, CORE-06]; 02-04 [FMT-04, CORE-03, CORE-06]; 02-05 [CORE-06]; 02-06 [CORE-02, FMT-08]; 02-07 [CORE-06, FMT-08]. ROADMAP Phase 2 lists the same six IDs; REQUIREMENTS.md maps exactly these six to Phase 2 (traceability rows 136 to 146, all "Complete", checkboxes ticked). No orphaned requirement.

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| FMT-04 | 02-01, 02-03, 02-04 | Gherkin in a fenced `gherkin` block; `@ac-n` tag per scenario; Outline counts as one | ✓ SATISFIED | SC2 evidence; uniqueness of tags is Phase 3 (D-46) and the loader keeps duplicates for it (TAGS golden). |
| FMT-05 | 02-01, 02-03 | EARS lines under `## Requirements`, one per line | ✓ SATISFIED | SC3 evidence. |
| FMT-08 | 02-01, 02-02, 02-06, 02-07 | Generated files LF/UTF-8 no BOM; readers accept CRLF and BOM | ✓ SATISFIED | SC4 (Windows) and SC5 evidence; `normaliseText`; write goldens. |
| CORE-02 | 02-01, 02-02, 02-06 | `yaml` core schema, numerics stay strings; comments round-trip on tick writes | ✓ SATISFIED | SC1 evidence. |
| CORE-03 | 02-01, 02-04 | Gherkin blocks extracted with line numbers remapped to the Markdown file | ✓ SATISFIED | SC2 evidence; parse-error lines 15 and 10 also remapped. |
| CORE-06 | 02-01 to 02-05, 02-07 | Fixture repos and goldens cover pass, fail, CRLF, BOM, Windows path cases | ✓ SATISFIED (Windows) / ? NEEDS HUMAN (Ubuntu) | Eight fixtures, nine goldens; CRLF/BOM/mixed/backslash variants in memory (D-53); Windows path case proven by the CLI test on this machine. Ubuntu leg is human item 1. |
| CORE-01 (Phase 1, clause deferred here) | — | Pure core over an immutable `RepoSnapshot` | ✓ SATISFIED | `RepoSnapshot` exists; purity layers unchanged and green. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `.planning/ROADMAP.md` | 59 | `Mode: mvp` on a phase whose goal is not a User Story (`user-story.validate` → 3 errors) | ℹ️ Info | Record inconsistency only; carried from Phase 1 human item 4. Verification used the roadmap success criteria as directed. |
| `packages/cli/test/load.test.ts` | 119 | Test relies on `os.tmpdir()` being outside a git work tree (comment acknowledges it) | ℹ️ Info (advisory) | Listed under `coincidental_reliance_items`; the production code is correct regardless. |
| `packages/cli/src/load/fs.ts` | 29 | ENOENT branch has no test | ⚠️ Warning | Present and wired; behaviour unverified; human item 2. |

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or `PLACEHOLDER` markers in any file this phase created or modified. No `test.skip`, `.only`, or `.todo`. No `console.log` in core or CLI source. No `level` or pass/fail verdict inside `packages/core/src/load/**` or `write/**` (loader records, Phase 3 judges).

### Prohibitions

All 21 prohibitions across the seven plans are `status: resolved`. Judgment-tier (12): no `git commit/push/tag` (HEAD still `48e56d7`); loader never coerces or repairs values (TYPING golden, `schema.type` for `no`); loader never judges (no `level` in load/*); scanner has no CommonMark dependency (manifests unchanged); scenarios never regex-parsed (`Parser` is the only path); loader never checks evidence content or compares tag sets (verification.ts has no `tree` or scenario access); `setFrontmatterKey` never touches other keys (one-hunk diffs). Test-tier (9): core purity (eslint + bundle test), BOM/CRLF never findings (`frontmatter.test.ts` line 106), loader never invents a tag (TAGS golden), stray files silent (verification-edges), core never emits CRLF/BOM (write tests + probe P5), CLI never spawns npm/npx/.cmd (grep + `execFileSync('git')`), tokens path containment (`load.test.ts` line 98). Each test-tier item has wired enforcement; none is flagged.

### Human Verification Required

#### 1. Ubuntu legs of the CI matrix (ROADMAP criterion 4)

**Test:** After the owner commits and pushes to `main`, open the Actions run named `ci` and check ubuntu-latest/22 and ubuntu-latest/24 next to the two Windows legs.
**Expected:** All four green; the six snapshot goldens, three Markdown goldens, and the CLI parity test pass on Ubuntu with the committed goldens unchanged.
**Why human:** No AI commit or push in this repo; only the Windows half of "byte-identical on Ubuntu and Windows CI" can be proven here.

#### 2. `git` absent from PATH

**Test:** Call `loadFromFs(<dir>)` with `git` removed from PATH (Phase 5 spawn test or vitest with a stripped `PATH`).
**Expected:** `UsageError`, message `git is required but was not found on PATH`, `exitCode` 2.
**Why human:** The ENOENT branch in `packages/cli/src/load/fs.ts` is present but unexercised by the suite.

#### 3. MVP-mode record

**Test:** Decide whether Phase 2 (and Phases 3 to 9) keep `Mode: mvp` with non-story goals.
**Expected:** Either a User Story goal via `/gsd-mvp-phase 2`, or the mode cleared.
**Why human:** Same open item as Phase 1 human item 4; the verifier does not edit ROADMAP.md.

### Open findings collected from the seven summaries

Surfaced here so the owner sees them in one place before committing. None blocks the phase goal; each is a documented assumption pinned by a test or golden and reversible with a small change.

- 02-01: `Result:` value is trimmed (`pass ` accepted); root `schema.required` points at the first YAML line; `##` with no text is not a heading.
- 02-02: `load.yaml-syntax` for a one-line `accord: [` lands on line 2 (past end of file, what yaml reports); yaml's message embeds its own YAML-relative "line N" and ends in a colon; `load.yaml-not-map` reason says "frontmatter" even for `config.yml`; `schema.if` wrapper still emitted alongside `schema.required` at `/tracker`; unterminated frontmatter is reported as `load.frontmatter-missing` with the YAML lines becoming body.
- 02-03: a bare `-` with nothing after it is kept as a requirement with text `-`; comment stripping leaves the surrounding whitespace (`a  b`).
- 02-04: `sections[].lines[]` store raw body text, so `Rule: Thanh toán` appears in section lines (not in `scenarios`); parse-error reason is the parser's full "expected: ..." list; the `vi` Outline's examples marker in `steps` is the English `Examples:` (keeps `ac_hash` dialect-independent).
- 02-05: a `Result:` line after `Evidence:` counts as the result and also stays in the evidence text; a second `Result:` in one block is silently ignored; findings are in file order then discovery order (duplicate-heading before result-invalid).
- 02-06: `verified: []` on the template lands after the `# verified: []` guidance comment; a rewritten key's trailing comment loses its alignment padding; a blank line before the closing `---` stays above an appended key (not pinned by a test).
- 02-07: `files` reads every regular file under `accord/` even when gitignored (only `tree` honours ignore rules); symlinks under `accord/` are skipped; git ENOENT untested (human item 2); the not-a-repo test assumes the temp dir is outside a work tree; the untracked `02-0*-PLAN.md`, `02-CONTEXT.md`, `02-DISCUSSION-LOG.md`, `02-PATTERNS.md` are not staged.
- All plans after 02-01: `requirements.mark-complete` flipped the six checkboxes at the tracer, before the error-path plans ran; the owner may prefer wave-end flipping.

### Gaps Summary

No gaps. Every artifact exists, is substantive, and is wired; the built bundle reproduces the committed golden byte for byte and stays byte-identical under BOM, CRLF, mixed endings, and Windows-style keys; the tick write changes exactly one key and emits LF without BOM from any input; `npm run check` exits 0 with 195 tests on Windows. The Phase 1 deferred `RepoSnapshot` clause of CORE-01 is closed. The status is `human_needed` rather than `passed` for three items: the Ubuntu half of criterion 4 cannot run before the owner pushes, the CLI loader's no-git branch is present but untested, and the `Mode: mvp` record conflict carried from Phase 1 is the owner's call.

---

_Verified: 2026-09-06T08:16:27Z_
_Verifier: Claude (gsd-verifier)_
