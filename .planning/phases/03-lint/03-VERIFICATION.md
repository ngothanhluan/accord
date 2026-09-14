---
phase: 03-lint
verified: 2026-09-14T06:29:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/phases/03-lint/03-01-PLAN.md
  - .planning/phases/03-lint/03-01-SUMMARY.md
  - .planning/phases/03-lint/03-02-PLAN.md
  - .planning/phases/03-lint/03-02-SUMMARY.md
  - .planning/phases/03-lint/03-03-PLAN.md
  - .planning/phases/03-lint/03-03-SUMMARY.md
  - .planning/phases/03-lint/03-04-PLAN.md
  - .planning/phases/03-lint/03-04-SUMMARY.md
  - .planning/phases/03-lint/03-05-PLAN.md
  - .planning/phases/03-lint/03-05-SUMMARY.md
  - .planning/phases/03-lint/03-06-PLAN.md
  - .planning/phases/03-lint/03-06-SUMMARY.md
  - .planning/phases/03-lint/03-CONTEXT.md
  - packages/cli/src/load/fs.ts
  - packages/core/schemas/config.schema.json
  - packages/core/src/generated/templates.ts
  - packages/core/src/index.ts
  - packages/core/src/lint/ears.ts
  - packages/core/src/lint/gherkin.ts
  - packages/core/src/lint/index.ts
  - packages/core/src/lint/render.ts
  - packages/core/src/lint/rules.ts
  - packages/core/src/lint/ticket.ts
  - packages/core/src/lint/tokens.ts
  - packages/core/src/load/config.ts
  - packages/core/src/load/frontmatter.ts
  - packages/core/src/load/gherkin.ts
  - packages/core/src/load/junit.ts
  - packages/core/src/load/sections.ts
  - packages/core/src/load/snapshot.ts
  - packages/core/src/load/verification.ts
  - packages/core/src/load/yaml.ts
  - packages/core/src/model/finding.ts
  - packages/core/src/model/snapshot.ts
  - packages/core/templates/ticket-build.md
  - packages/core/templates/ticket-maintain.md
covered_digest: "v1:sha256:138bf0fb69ab9622a7059258921e9d92bd5887fca5c190f6409e4bcd6fa1aea0"
behavior_unverified: 0
overrides_applied: 0
human_verification: []  # all three resolved in 03-UAT.md on 2026-09-14; see Post-UAT Amendment
---

# Phase 3: Lint Verification Report

**Phase Goal:** `lint` over a snapshot returns every format, EARS, Gherkin, token, tick, hygiene, and size finding with file, line, rule id, and reason, rendered as text or JSON from one result object.
**Verified:** 2026-09-14T05:46:31Z (initial); amended 2026-09-14T06:29:00Z
**Status:** passed
**Re-verification:** Amended after UAT 03 — see Post-UAT Amendment

All Phase 3 work is uncommitted in the working tree on `main` at `f4cc8cc` by the owner's rule; this report verified the files on disk. No git write command was run.

## How this was verified

| Check | Command | Result |
| ----- | ------- | ------ |
| Full test suite (once) | `npx vitest run` | 18 files, 388 tests passed, exit 0 |
| Build | `npm run build` | exit 0 |
| ESLint incl. core purity guard | `npm run lint` | exit 0 |
| Typecheck (core, core tests, cli) | `npm run typecheck` | exit 0 |
| Direct probes | `node probe.mjs` importing `packages/core/dist/index.js`, walking each fixture into a `SnapshotInput`, printing every finding | Output quoted per criterion below |
| Bundle purity | `grep -c "node:" packages/core/dist/index.js` | 0 |
| Public surface | `Object.keys(import(dist))` | `lintSnapshot loadSnapshot renderText schemaIds setFrontmatterKey templates validate` |
| GSD artifact / key-link checks | `verify.artifacts` and `verify.key-links` on all six plans | 19/19 artifacts, 15/15 links |
| Git state | `git log -1`, `git diff --cached --stat`, `git status` on package files | HEAD `f4cc8cc`, nothing staged, `package.json` / `package-lock.json` / `epic.md` untouched |

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | A ticket with a schema violation produces a finding naming the JSON path and the line in the file | ✓ VERIFIED | `frontmatter-errors` probe: `SCHEMA.md:2 error schema.required [] …title`, `:3 schema.enum [/type]`, `:5 schema.additionalProperties []`, `:7 schema.type [/assumptions/0/confirmed]`, `:9 schema.pattern [/verified/0]`; zero schema findings lack pointer or line; `schema.if` dropped (D-58). Test `schema.required surfaces with its pointer and line; schema.if never does` in `lint.test.ts:185`. |
| 2 | Each of the six EARS templates classifies without a warning, and a line that matches none of them warns with its line number | ✓ VERIFIED | In-memory ticket with ubiquitous, WHEN, WHILE, IF…THEN, WHERE, and WHILE+WHEN lines yielded no `lint.ears-unclassified`; `the system should…` warned at line 16 (`verb must be 'shall'`), a keyword-less line at 17. `lint-ears` fixture: ten diagnoses at lines 21 to 30, `errors: 0`. `valid-build` Vietnamese-content lines classify (count 0). `ears.test.ts` 22 tests pass. |
| 3 | A Gherkin parse error, a missing or duplicate `@ac-n` tag, an empty step, and a code-touching ticket with zero scenarios each produce a finding with its own rule id | ✓ VERIFIED | `gherkin-shapes`: `load.gherkin-parse` (BADLANG:10, PARSE-ERROR:15), `lint.ac-tag-missing` (TAGS:13), `lint.ac-tag-multiple` (TAGS:17), `lint.ac-tag-duplicate` (TAGS:25), `lint.no-scenarios` (BADLANG:7, EMPTY-AC:7, PARSE-ERROR:7). `lint-gherkin`: `lint.step-empty` (STEPS:19 keyword-only, STEPS:23 no steps), `lint.no-scenarios` (NOSCEN:14). Six distinct ids, all `error`. |
| 4 | A `prototype.html` using a colour or spacing value outside the token file warns and never errors, and a `verified` entry naming a tag with no scenario warns | ✓ VERIFIED | `lint-tokens`: eight `lint.token-hardcoded` at PROTO-1 lines 10, 11, 12, 16, 16, 16, 17, 18 across `<style>`, `style=`, and utility classes; `errors: 0`, levels `['warning']`; row in `rules.ts` is `warning`. `lint-hygiene`: `HYGIENE.md warning lint.tick-orphan [/verified/1] verified names "ac-9" but no scenario carries @ac-9`. |
| 5 | TODO sentinels, unchecked open questions, unconfirmed assumptions, and oversize intent, EARS, or scenario counts are reported, and the same result object renders to text and to JSON with identical content | ✓ VERIFIED | `lint-hygiene`: `lint.sentinel` (TODO, FIXME, TBD, TICKET-ID, `<observable outcome>`, `When ...` step), `lint.open-question` at 34, `lint.assumption-unconfirmed [/assumptions/0/confirmed]`, `lint.intent-oversize` (SIZE:8, EPIC:8), `lint.requirements-oversize` (SIZE:18), `lint.scenarios-oversize` (SIZE:36). Probe parsed every `renderText` line back with `/^(.+?)(?::(\d+))?: (error|warning) (\S+) (.*)$/` and matched file, line, level, rule, reason of the JSON findings in order: `true`; summary `3 errors, 23 warnings` equals the JSON counts; two calls give byte-identical JSON. Tests `render.test.ts:36` and `lint.test.ts:71`, `:84`. |
| 6 | A ticket whose `## Plan` steps carry a tag set different from its scenario tag set warns and names the tags missing from each side; equal sets produce no finding, and an empty `## Plan` on a ticket with scenarios warns rather than errors | ✓ VERIFIED | `HYGIENE.md:38 warning lint.plan-tags-differ plan lacks nothing; scenarios lack @ac-2` (both sides named); `HYGIENE.md:40 warning lint.plan-step-untagged`; `PLAN-EMPTY.md:26 warning lint.plan-empty` (level `warning`); `CLEAN.md` (equal sets) yields 0 findings. `ticket.ts:151` `missing()` sorts ascending by n. |
| 7 | Vague wording in `## Requirements`, `## Acceptance criteria`, or an answered `## Open questions` item warns with its line number and never errors | ✓ VERIFIED | `lint-hygiene`: `lint.vague-wording` at 19 (TBD), 20 (maybe), 28 (probably), 35 (depends). In-memory ticket: requirement line 10 (`depends`), AC line 12 (`Somewhere between`, case-insensitive), answered item 14 (`maybe`); the unanswered `- [ ]` item at 15 is not scanned; levels `['warning']`. `TBD` on a requirement line reports under both `lint.sentinel` and `lint.vague-wording` per the owner's 2026-09-14 resolution. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### PLAN must_haves (per plan, condensed)

| Plan | Truths | Status | Evidence |
| ---- | ------ | ------ | -------- |
| 03-01 | `{ findings, errors, warnings }` shape; loader findings stamped `error`, `schema.if` dropped; `lint.id-mismatch` at `/id`; `RULES` one table, levels only in `rules.ts`; code-point sort with line-less first; duplicates kept; empty result renders `0 errors, 0 warnings\n`; purity; text line shape; `files` holds prototypes + tokens only | ✓ VERIFIED | `lint/index.ts` lines 13-32; `grep "level: '"` outside `rules.ts` hits only the D-58 loader stamp at `index.ts:26`; `render.test.ts` 7 tests and `lint.test.ts:46-121` pass; `MISMATCH` probe not repeated here but golden `frontmatter-errors.lint.json` and test `lint.test.ts:171` pin it |
| 03-02 | `lint.heading-missing` per D-71 by type; sentinels incl. placeholders and `...` steps; open questions; assumptions; ticks; vague wording; three oversize limits; plan-tag rules; note-orphan / notes-not-last; `tracker-empty`; CLEAN yields zero | ✓ VERIFIED | Probe output above: `HEADINGS.md` three `lint.heading-missing` errors with no line; `NOTES.md:26 lint.notes-not-last`, `:30 lint.note-orphan`; `HYGIENE.md lint.tracker-empty [/tracker]`; CLEAN 0. Backstop truth (duplicate `### @ac-1` block not linted) left to GATE-10 as declared. |
| 03-03 | `tests.report` schema key (`{}`, `''`, extra key rejected; 6 required, 7 properties); `snapshot.tests` absent vs `{}`; `scanJUnit` id shape, worst-status merge, CDATA/comment blanking, entities; `load.report-invalid`; CLI containment | ✓ VERIFIED | Schema: `required 6`, properties `accord,profile,tracker,design,roles,runtimes,tests`, `tests` is `additionalProperties:false, required:[report], minLength:1`. `lint-report` probe: `snapshot.tests` has the three `test/auth.spec.ts#auth->-…` ids with passed/failed/skipped. `junit.test.ts` 9 tests and `cli/test/load.test.ts` containment tests pass. `fs.ts:52-71` `containedPath` loop over tokens and report. |
| 03-04 | Story templates end with `## Verification notes` + guidance; `@test:<id>` sentence in AC comment; `epic.md` unchanged; generated module matches; new ticket lints without notes findings | ✓ VERIFIED | `grep -c "Verification notes"`: build 1, maintain 1, epic 0, generated 2; `@test:<id>` at build:36, maintain:37; `epic.md` untouched in `git status`; `templates.test.ts` drift and heading pins pass. |
| 03-05 | Six EARS positives, ten diagnoses; LINT-03 ids as errors; `test-tag-duplicate` error, `test-tag-on-ui` warning, `test-tag-missing` silent on `@ui`; `test-id-unknown` only with a report, exact lookup; `report-missing` at `/tests/report` | ✓ VERIFIED | Probe: `lint-gherkin` TESTTAGS rows `test-tag-duplicate`, `test-tag-on-ui`, `test-tag-missing` each 1; `lint-report`: `REPORT.md:29 warning lint.test-id-unknown @test:nope#missing not found in reports/junit.xml; ids are classname#name with spaces as '-'`; `lint-missing-files`: `lint.report-missing [/tests/report]`. `grep -cF '\b' ears.ts` = 0. |
| 03-06 | `tokenNames` incl. `@theme`; `scanPrototype` across three surfaces at the offending line, eight research findings; comments/scripts blanked; exemptions; `tokens-missing` at `/design/tokens` with skip; `prototype-derivation` three shapes; `valid-build` prototype token-clean | ✓ VERIFIED | Probe: eight `lint-tokens` findings listed under truth 4; `lint-no-tokens`: A:3 "lists no path", C:3 `src/nope.css` not in repository, D:1 no `Derived from:` line, B silent; `lint-missing-files`: `lint.tokens-missing [/design/tokens] … so the token rule is skipped`; `valid-build` shows no `lint.token-hardcoded`. `tokens.test.ts` 26 tests pass. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/core/src/lint/index.ts` | `lintSnapshot`, `LintResult` | ✓ VERIFIED | 33 lines, merges loader + table findings, code-point sort, counts; exported from barrel |
| `packages/core/src/lint/rules.ts` | `RULES` table | ✓ VERIFIED | 30 rows `{ id, level, profiles, check }`, every row on both profiles; 8 errors, 22 warnings |
| `packages/core/src/lint/render.ts` | `renderText` | ✓ VERIFIED | D-60 line shape, literal-plural summary |
| `packages/core/src/lint/ticket.ts` | 16 checks over `Ticket` | ✓ VERIFIED | reads `sections`/`requirements`/`scenarios` via `headingKey`, `stripHtmlComments`, `LIST_MARKER`; no level literal |
| `packages/core/src/lint/gherkin.ts` | 10 scenario/report checks | ✓ VERIFIED | `perScenario` helper; `AC_TAG` reused from loader; `normaliseKey` reused |
| `packages/core/src/lint/ears.ts` | `classifyEars`, `earsUnclassified` | ✓ VERIFIED | whitespace tokens, no `\b`, ten fixed diagnoses |
| `packages/core/src/lint/tokens.ts` | `tokenNames`, `offending`, `scanPrototype`, `derivedFrom`, three checks | ✓ VERIFIED | String/RegExp/Set only; imports `normaliseKey`, `PROTOTYPE` from the loader |
| `packages/core/src/load/junit.ts` | `scanJUnit`, `TestStatus` | ✓ VERIFIED | no imports, single forward pass, worst-status merge |
| `packages/core/schemas/config.schema.json` | optional `tests.report` | ✓ VERIFIED | see 03-03 row |
| `packages/core/templates/ticket-build.md`, `ticket-maintain.md`, `src/generated/templates.ts` | notes section + `@test:` guidance | ✓ VERIFIED | see 03-04 row |
| `packages/cli/src/load/fs.ts` | reads `tests.report` with containment | ✓ VERIFIED | `containedPath` over `[design.tokens, tests?.report]` |
| Tests: `lint.test.ts`, `render.test.ts`, `ears.test.ts`, `junit.test.ts`, `tokens.test.ts` | golden loop + pinned behaviours | ✓ VERIFIED | all in the 388 passing; `lint.test.ts` 400+ lines |
| Goldens: 16 `*.lint.json`, 8 new `*.snapshot.json` | one per fixture, five encoding variants identical | ✓ VERIFIED | `lint.test.ts:46` encoding test and `:54` golden test pass per fixture |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `lint/index.ts` | `lint/rules.ts` | `RULES.filter(profile).flatMap(check)` stamping `rule`/`level` | WIRED | `index.ts:27-28` |
| `load/snapshot.ts` | `model/snapshot.ts` | `files` filled from prototype keys, tokens, report | WIRED | `snapshot.ts:82-101` |
| `src/index.ts` | `lint/index.ts`, `lint/render.ts` | barrel exports | WIRED | `index.ts:18-20`; dist exposes both |
| `lint/ticket.ts` | `load/sections.ts` | `headingKey`, `stripHtmlComments`, `LIST_MARKER` | WIRED | `ticket.ts:2` |
| `load/snapshot.ts` | `load/junit.ts` | `tests = scanJUnit(...)` | WIRED | `snapshot.ts:92` |
| `cli/load/fs.ts` | core `loadSnapshot` | `containedPath(root, config.tests?.report)` | WIRED | `fs.ts:67-71` |
| `lint/gherkin.ts` | `load/gherkin.ts` | `AC_TAG` export reuse | WIRED | `gherkin.ts:4`, loader line 16 |
| `lint/rules.ts` | `lint/ears.ts`, `lint/tokens.ts`, `lint/gherkin.ts`, `lint/ticket.ts` | imported check functions in rows | WIRED | `rules.ts:5-35` |
| `templates/*.md` | `src/generated/templates.ts` | `npm run gen` | WIRED | drift test passes; `Verification notes` twice in the module |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `lintSnapshot` | `findings` | `snapshot.errors` + every `RULES[i].check(snapshot)` | Yes: probes list 26 findings on `lint-hygiene`, 8 on `lint-tokens` | ✓ FLOWING |
| `renderText` | `result.findings` | `LintResult` from `lintSnapshot` | Yes: 26 lines + summary, round-trips | ✓ FLOWING |
| `tokenHardcoded` | `known` | `tokenNames(snapshot.files[design.tokens])` | Yes: `var(--nope)` flagged, `var(--spacing)` accepted | ✓ FLOWING |
| `testIdUnknown` | `tests` | `scanJUnit(snapshot.files[tests.report])` | Yes: three ids parsed, `nope#missing` flagged | ✓ FLOWING |
| CLI `loadFromFs` | `files[report]` | `readFileSync` of the contained path | Yes: `cli/test/load.test.ts` "reads tests.report into files" passes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Six EARS templates silent, two non-matches warn with line | in-memory ticket through `dist` | only lines 16 and 17 warned | ✓ PASS |
| Text and JSON identical | parse-back regex over `renderText` of `lint-hygiene` | `true`, summary `3 errors, 23 warnings` | ✓ PASS |
| Deterministic | two `lintSnapshot` calls, `JSON.stringify` compare | identical | ✓ PASS |
| Token rule never errors | `lint-tokens` levels | `['warning']`, `errors: 0` | ✓ PASS |
| Vague wording never errors, skips unanswered items | in-memory ticket | 3 warnings, `- [ ]` line not flagged | ✓ PASS |
| Purity of the bundle | `grep -c node: dist/index.js` | 0 | ✓ PASS |
| Sort / mutation invariant | named test `is sorted, deterministic, and leaves the snapshot untouched` (`lint.test.ts:84`) in the one full run | pass | ✓ PASS |
| Edge: prototype-chain id | `@test:toString` with report present | no `lint.test-id-unknown` (should warn) | ✗ FAIL (see Anti-Patterns; no criterion covers it) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist and no plan declares one. The probes above were run ad hoc from the scratchpad against `packages/core/dist`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| CORE-04 | 03-01 | Rules are data (id, level, profile); build/maintain matrix is one table | ✓ SATISFIED | `rules.ts` 30 rows; test `every row applies to both profiles, ids are unique…` |
| CORE-05 | 03-01 | Every finding carries file, line, rule id, reason; one result renders to text and JSON | ✓ SATISFIED | truth 5; `Finding` type; round-trip probe |
| LINT-01 | 03-01 | Schema errors with path and line | ✓ SATISFIED | truth 1 |
| LINT-02 | 03-05 | EARS classifier, unclassifiable lines warn | ✓ SATISFIED | truth 2 |
| LINT-03 | 03-05 | parse error, missing/duplicate `@ac-n`, empty step, at least one scenario | ✓ SATISFIED | truth 3 |
| LINT-04 | 03-06 | Prototype token rule, warning-only | ✓ SATISFIED | truth 4 |
| LINT-05 | 03-02 | Orphaned tick warning | ✓ SATISFIED | truth 4 (`lint.tick-orphan`) |
| LINT-06 | 03-02 | Sentinel, unchecked open question, unconfirmed assumption | ✓ SATISFIED | truth 5 |
| LINT-07 | 03-02 | Size warnings 5 / 15 / 5 | ✓ SATISFIED | truth 5; limits exclusive per Claude's Discretion |
| LINT-08 | 03-02 | Plan tag set vs scenario tag set, naming each side | ✓ SATISFIED | truth 6 |
| FMT-09 | 03-01, 03-04, 03-05 | `@test:<id>` on non-`@ui` scenarios | ✓ SATISFIED | `test-tag-missing`/`-duplicate`/`-on-ui`; template guidance |
| FMT-10 | 03-02, 03-04 | `## Verification notes` last, `### @ac-n` blocks | ✓ SATISFIED | `notes-not-last`, `note-orphan`; templates end with the section |
| FMT-11 | 03-03, 03-05 | `config.tests.report`, host adds the file, core line-scans it | ✓ SATISFIED | schema key, `fs.ts`, `scanJUnit`, `snapshot.tests`, `report-missing`, `test-id-unknown` |

All 13 ROADMAP requirement IDs appear in at least one plan's `requirements` field. REQUIREMENTS.md maps no additional ID to Phase 3; no orphaned requirement.

### CONTEXT.md decisions honoured

D-56 (`level`, warnings never errors), D-57 (one table, both profiles), D-58 (one list, loader stamped error, sort), D-59 (`lint.<kebab>`), D-60 (text shape, colour-free), D-61 to D-64 (EARS: case-insensitive, `the system shall`, English keywords, one fixed diagnosis), D-65 (`files` limited to prototypes, tokens, report), D-66 (allowlist, six exemptions, warning), D-67 (`tokens-missing` on config, `prototype-derivation` with tree check), D-68 (every prototype, ticket-independent: `lint-tokens` has no ticket), D-69 (`@test:` rules), D-70 (notes rules), D-71 (headings by type, notes never required), D-72 (schema, scanner, two report rules), D-73 (sentinels incl. placeholders and `...`, comments excluded), D-74 (plan items, three rules, epics skipped). All confirmed by the probes and source reads above.

### Prohibitions (all six plans)

Every plan lists prohibitions with `status: flagged, verification: unverified`; treated as judgment-tier and resolved here with deterministic evidence rather than SUMMARY claims.

| Prohibition | Evidence | Result |
| ----------- | -------- | ------ |
| No commit, push, tag; no attribution trailer | HEAD `f4cc8cc` unchanged; `git diff --cached` empty | resolved |
| Nothing under `src/lint/` imports `node:`, `ajv`, `yaml`; no re-validation | `grep node:` under `core/src` outside `load/`/`scaffold/`: 0; ESLint purity guard exit 0; `dist/index.js` 0 `node:`; lint imports are relative only | resolved |
| No package added; lockfile untouched | `git status` on `package.json`, `package-lock.json`, workspace `package.json`: clean | resolved |
| Level literals only in `rules.ts` | only other hit is the D-58 loader stamp `index.ts:26` (`level: 'error'` on `load.*`/`schema.*`, not a `lint.*` rule) | resolved |
| No other tool named in shipped source/templates/schema | grep for runner and framework names over `lint/*.ts`, `junit.ts`, templates, schema: only pre-existing Phase 1 `figma.com` lines in templates (Figma is the named design integration in PROJECT constraints, unchanged by this phase) | resolved |
| No XML/CSS/HTML library; scanner never guesses ids | `junit.ts` has no import; `tokens.ts` imports loader/model only; lookup is `id in tests` after `norm` (see Anti-Patterns for the prototype-chain caveat) | resolved |
| CLI never reads outside root, never spawns npm/npx | `containedPath` guard `fs.ts:52-60`; only `execFileSync('git', …)` | resolved |
| Frontmatter of story templates byte-identical; `epic.md` and `LOGIN-1.md` untouched | `git status` shows `epic.md` clean; `templates.test.ts` frontmatter equality passes; `LOGIN-1.*.md` write goldens unchanged | resolved |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `packages/core/src/lint/gherkin.ts` | 85 | `!(id in tests)` on a plain-object `Record` consults `Object.prototype`; `@test:toString`, `@test:constructor`, `@test:hasOwnProperty` are treated as known ids | ⚠️ Warning | Reproduced with the `lint-report` fixture: no `lint.test-id-unknown` for `@test:toString`. Phase 4 GATE-08 will join the same ids. Fix: `Object.hasOwn(tests, id)`. |
| `packages/core/src/load/junit.ts` | 41 | `!(id in out)` and `RANK[out[id]]` on a plain object; a case named `constructor` with no classname is never stored | ⚠️ Warning | Same root cause; `Object.create(null)` for `out` or `Object.hasOwn`. |
| `packages/core/src/lint/ticket.ts` | 23, 29 | `TODO|TBD|FIXME`, `TBD` inside regex literals | ℹ️ Info | These are the sentinel and vague-wording detectors themselves, not debt markers. Not a blocker. |

No `TBD`/`FIXME`/`XXX` debt marker exists in any modified file outside those two detector regexes.

### Notes from the SUMMARY "Open questions for the owner" sections

Surfaced for the owner; none contradicts a locked decision.

1. 03-02: oversize reasons use the D-07 display heading (`## Intent`) rather than the raw heading text; sentinels scan every `##` section, not only the five D-07 ones (D-73 "anywhere in the body").
2. 03-03: an invalid report's text is still kept in `snapshot.files`; `<testsuites/>` with no cases gives `tests: {}` and no loader finding, so every `@test:` id then reads as unknown.
3. 03-05: `planTagsDiffer` counts only a scenario's first `@ac-n` (D-74), so a scenario tagged `@ac-1 @ac-2` can raise both `lint.ac-tag-multiple` and `lint.plan-tags-differ`; `test-id-unknown` echoes the raw config path; `lint.no-scenarios` fires regardless of `status` (owner's "lint everything" answer).
4. 03-06: gradient line attribution can land one line early when the `var()` is blanked; `padding: red` reports as hard-coded colour; `50%` and `2px` are flagged while `100%` and `1px` are exempt (the literal D-66 starting set).
5. 03-04: a brand-new ticket from the template warns `lint.test-tag-missing` on its placeholder scenario, which is D-69 working on placeholder text.

### Human Verification Required

#### 1. MVP-mode record on Phase 3

**Test:** ROADMAP.md marks Phase 3 `Mode: mvp` but the goal is not a User Story (`user-story.validate` returns `false`). Same open item as Phases 1 and 2.
**Expected:** Either record a User Story goal with `/gsd-mvp-phase 3` or clear `Mode:` on the infrastructure phases. This report used the seven ROADMAP criteria and the non-MVP procedure, as the team lead directed.
**Why human:** Roadmap metadata decision.

#### 2. Text rendering reads well to a BA and clicks through in an editor

**Test:** Render one lint run as text (for example over the `lint-hygiene` fixture: 26 finding lines plus `3 errors, 23 warnings`) and read it as a BA would, and paste one line into an editor problem matcher.
**Expected:** The `file:line: level rule reason` shape and the reason wording are clear; the literal-plural summary is acceptable. D-60 marks this shape costly to reverse once CI logs parse it.
**Why human:** Readability is judgment; identity with JSON is already proven.

#### 3. Harden the two prototype-chain `in` lookups before Phase 4, or defer

**Test:** Tag a scenario `@test:toString` in a fixture with a report and lint it; add a `<testcase name="constructor">` with no classname to a report and inspect `snapshot.tests`.
**Expected:** Owner decides whether the two one-line fixes (`Object.hasOwn` / `Object.create(null)`) land now with one test, or are noted for Phase 4 where `snapshot.tests` feeds GATE-08. No ROADMAP criterion fails either way.
**Why human:** Scope decision under the no-auto-fix rule; the defect is outside every success criterion.

### Gaps Summary

No gaps. All seven ROADMAP success criteria and all six plans' must-haves are present, substantive, wired, and behaviourally exercised by the 388-test suite and by direct probes over the built bundle. The only defect found is a prototype-chain lookup edge in two `in` checks, recorded as a warning and routed to the owner rather than a gap because no criterion covers it and the owner's rules forbid auto-fixing. Status is `human_needed` solely for the three items above.

---

_Verified: 2026-09-14T05:46:31Z_
_Verifier: Claude (gsd-verifier)_

---

## Post-UAT Amendment — 2026-09-14T06:29:00Z

The initial report closed at `human_needed` with three owner decisions outstanding.
All three were resolved during `/gsd-verify-work 3` (see `03-UAT.md`, 3/3 pass, 0 gaps):

| # | Item | Owner decision | Effect on this report |
|---|------|----------------|-----------------------|
| 1 | MVP-mode record | Follow the Phase 1/2 precedent | `**Mode:** mvp` removed from Phase 3 in ROADMAP.md. The seven-criteria non-MVP procedure this report used is now the recorded one. No criterion re-verified. |
| 2 | Text rendering | Accept as-is | Rendered live over `lint-hygiene`: 26 finding lines plus `3 errors, 23 warnings`, matching this report. D-60 shape unchanged. Measured additionally: VS Code terminal link detection resolves the `path:line` prefix, but the stock `$gcc` / `$tsc` problem matchers do not match `file:line: level rule reason` (both require a column and a colon after the level) — a CI consumer needs its own matcher. Accepted knowingly. |
| 3 | Prototype-chain `in` lookups | Fix in Phase 3, not Phase 4 | Two one-line source edits — this is the only change to `covered_files` since the initial run, and the reason `covered_digest` was refreshed. |

### Delta re-verification (item 3)

Changed covered files:

| File | Before | After |
|------|--------|-------|
| `packages/core/src/load/junit.ts:41` | `if (!(id in out) \|\| ...)` | `if (!Object.hasOwn(out, id) \|\| ...)` |
| `packages/core/src/lint/gherkin.ts:85` | `.filter((id) => !(id in tests))` | `.filter((id) => !Object.hasOwn(tests, id))` |

Defect reproduced before the edit: `scanJUnit` over three testcases named
`constructor`, `toString`, `real one` returned only `['real-one']` — two of three
silently dropped, because `out = {}` inherits `Object.prototype`. The same
inheritance made `lint.test-id-unknown` stay silent for `@test:toString`, which is
a direct bypass of T-03-09's stated control.

Evidence after the edit:

| Check | Command | Result |
|-------|---------|--------|
| Regression tests added | `junit.test.ts` "keeps testcases named after Object.prototype members"; `lint.test.ts` "an unknown @test id named after an Object.prototype member still warns" | both pass |
| Full suite | `npm test` | 18 files, **390 passed** (was 388 + 2 new) |
| Lint | `npm run lint` | clean |
| Types | `npm run typecheck` | clean |
| Build + probe | `npm run build`, then `scanJUnit` over the rebuilt bundle | `['constructor','toString','real-one']` — all three ids present |

No ROADMAP success criterion and no plan must-have changed behaviour: the two
edits only narrow a lookup from the prototype chain to own properties. The
`lint-report` golden still pins `@test:nope#missing` as the sole unknown id, so
the existing pinned values are unaffected.

Security: `03-SECURITY.md` records this as a strengthening of the T-03-09 and
T-03-10 mitigations; `threats_open: 0`.

**Amended status:** passed.
