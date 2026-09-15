---
gsd_state_version: "1.0"
milestone: v0.1
current_phase: 6
current_phase_name: Skills
status: planning
stopped_at: Phase 05 complete, ready to plan Phase 6
last_updated: "2026-09-15T07:19:10.296Z"
last_activity: 2026-09-15
last_activity_desc: Phase 05 complete, transitioned to Phase 6
state_head: 97a7977174efa56e1d98594355d15a46af50a8b9
progress:
  total_phases: 9
  completed_phases: 3
  total_plans: 28
  completed_plans: 28
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-14)

**Core value:** An agent cannot start a story without captured intent and acceptance criteria, and cannot finish one without independent verification against them.
**Current focus:** Phase 05 — CLI Commands

## Current Position

Phase: 6 — Skills
Plan: Not started
Status: Ready to plan
Last activity: 2026-09-15 — Phase 05 complete, transitioned to Phase 6

Progress: [███░░░░░░░] 3/9 phases (33%)

## Performance Metrics

**Velocity:**

- Total plans completed: 28
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |
| 02 | 7 | - | - |
| 3 | 6 | - | - |
| 04 | 4 | - | - |
| 05 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 6 min | 3 tasks | 28 files |
| Phase 01 P02 | 2 min | 2 tasks | 4 files |
| Phase 01 P03 | 2 min | 2 tasks | 4 files |
| Phase 01 P04 | 5 min | 3 tasks | 12 files |
| Phase 01 P05 | 5 min | 3 tasks | 7 files |
| Phase 02 P01 | 9min | 3 tasks | 29 files |
| Phase 02 P02 | 5min | 2 tasks | 22 files |
| Phase 02 P03 | 8min | 2 tasks | 10 files |
| Phase 02 P04 | 6min | 2 tasks | 12 files |
| Phase 02 P05 | 6min | 2 tasks | 14 files |
| Phase 02 P07 | 6 min | 2 tasks | 2 files |
| Phase 02 P06 | 8min | 2 tasks | 7 files |
| Phase 03 P01 | 9 min | 2 tasks | 36 files |
| Phase 03 P02 | 6min | 2 tasks | 22 files |
| Phase 03 P03 | 4 min | 2 tasks | 13 files |
| Phase 03 P04 | 5 min | 1 tasks | 5 files |
| Phase 03 P05 | 7 min | 2 tasks | 28 files |
| Phase 03 P06 | 5 min | 2 tasks | 24 files |
| Phase 05 P01 | 25 min | 3 tasks | 12 files |
| Phase 05 P02 | 12 min | 2 tasks | 8 files |
| Phase 05 P05 | 14 min | 2 tasks | 4 files |
| Phase 05 P06 | 9 min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 01 UAT]: README.md and docs/design.md name no other tools or harnesses; positioning is stated without comparisons (owner decision, 2026-09-06)
- [Phase 01 UAT]: `Mode: mvp` cleared on Phase 1 only; infrastructure phases carry no User Story. Later phases keep their Mode line and are reassessed when planned
- [Phase 01 UAT]: `workflow.api_coverage_gate` disabled; accord integrates no model API, and the gate false-positived on the word "api" in planning text
- [Phase 01 security]: 17 threats closed at L1 grep depth; two accepted risks (placeholder schema `$id` until Phase 9; README carries no employer detail)
- [Phase 02 UAT]: `Mode: mvp` cleared on Phase 2 as well (infrastructure phase, no User Story), matching the Phase 1 decision; Ubuntu CI legs and the git-absent `UsageError` both proven (2026-09-13)
- [Phase 02 security]: 24 threats closed at L1 grep depth; seven accepted risks, all low, deferring size and id-case checks to Phase 3 lint and trusting the developer's PATH
- [Phase 02 validation]: 14 tasks all green; `purity.test.ts` hit its 5 s timeout once under a cold cache in a full parallel run and passed in isolation — a Phase 1 test flake, noted, not changed

- [Roadmap]: Three research conflicts settled in REQUIREMENTS.md before Phase 1: tick key is the `@ac-n` tag (FMT-04); tracker field is a map keyed by adapter (FMT-03); author-mismatch check is supplied by the CLI host and reported as skipped by MCP (GATE-05)
- [Roadmap]: OPS-01 and OPS-02 sit in Phase 1 so the Windows CI job exists from the first commit
- [Roadmap]: `skills sync` (CLI-08) lives with the Skills phase, not the CLI phase, so the rendered copies can be verified where the renderer is built
- [Roadmap]: Phases 7 and 8 both depend only on Phase 6 and may run in parallel
- [Phase 01]: Kept the draft ajv/* ESLint seam pattern: a probe importing ajv/dist/2020.js was flagged, so the ajv/** fallback was not needed
- [Phase 01]: No vitest reporter change for the |core|/|cli| prefix criterion; default reporter collapses passing files outside a TTY, verbose reporter shows them
- [Phase 01]: d.ts leak check inspects only export lines: tsdown region comment names src/validate/ajv.d.ts but exports nothing from ajv
- [Phase 01]: Kept ajv's schema.if duplicate finding at /tracker in the config golden; whether Phase 3 lint suppresses it is left to the owner
- [Phase 1]: Guidance for the four required ticket keys is a trailing # comment on the key line so id/title/type/status stay the first four frontmatter lines; other keys keep a full guidance line above
- [Phase 1]: Templates reach core only through the committed generated module (npm run gen, manual, no prebuild/pretest); the drift test is the staleness signal
- [Phase 01]: Convention test pins README.md and design.md §2–§5 by grep; retired names built by string concatenation so the test file never carries them — Documentation truths must fail npm test when they regress, without the test itself matching a repo-wide grep for the legacy folder
- [Phase 01]: Two extra PROJECT.md vocabulary fixes beyond the plan list (design source dropped per D-15; orphaned QA tick became orphaned verified tick per D-03) — No retired vocabulary may remain in PROJECT.md; both were single-phrase corrections inside the plan objective
- [Phase 02]: stringNumerics defined in load/yaml.ts and re-exported from load/frontmatter.ts to avoid an import cycle
- [Phase 02]: Fence carries a close line so requirementLines can exclude fenced ranges; scan() drops the phantom line after a trailing newline
- [Phase 02]: 02-02: config-syntax golden pins the line yaml reports (2 for a one-line unterminated flow sequence); no loader code changed
- [Phase 02]: requirementLines strips the list marker before the blank filter so a whitespace-only bullet is not a requirement (D-41)
- [Phase 02]: 02-04: steps format frozen by test (keyword text, doc strings as triple-quoted, tables as pipe cells, Examples: as one string, whitespace collapsed); gherkin.ts unchanged
- [Phase 02]: 02-05: no loader change needed; Result: values case-sensitive lowercase; Result: after Evidence: counts as result and stays in evidence text
- [Phase 02]: 02-07: tokens file read after a first loadSnapshot pass over accord/** so the CLI reuses core's config parsing; design.tokens contained to the root via relative/isAbsolute (T-02-20)
- [Phase 02]: 02-06: setFrontmatterKey splices a yaml-serialised pair into the original YAML text instead of doc.toString(), so padding before trailing comments and the template's guidance block survive byte-for-byte
- [Phase 03]: 03-01: RepoSnapshot.files keeps the tokens file only when config is schema-valid and the normalised key is in the input; an invalid config.yml yields files: {}
- [Phase 03]: 03-01: RULES is typed readonly Rule[] per the plan interfaces block, not as const; the golden loop cross-checks every lint.* id and level against the table at runtime
- [Phase 03]: 03-01: loader findings are typed LoadFinding (no level) and lint stamps error at the merge step, so snapshot goldens changed only by the new files key
- [Phase 03]: Oversize lint reasons name the D-07 display heading, not the raw heading text
- [Phase 03]: lint.sentinel scans every ## section of the body per D-73, not only the five D-07 sections
- [Phase 03]: 03-03: snapshot.tests is {} plus load.report-invalid for a garbage report and absent only when the report key is missing, so lint can tell no-report from empty-report (D-72, A3)
- [Phase 03]: 03-03: scanJUnit stays off the barrel; the loader is its only production caller
- [Phase 03]: 03-04: story and bug templates end with an empty ## Verification notes section and teach the @test:<id> tag in the AC comment; epic.md gains neither
- [Phase 03]: ACTAGS fixture plan line carries @ac-1 only: planTagsDiffer counts a scenario's first @ac-n, so listing @ac-2 would raise lint.plan-tags-differ against the plan's no-plan-finding intent
- [Phase 03]: test-id-unknown reason echoes config.tests.report verbatim and the classname#name shape; exact key lookup in snapshot.tests, no basename or case fallback
- [Phase 03]: 03-06: scanPrototype sorts by line then reason with code-point comparison; the line-16 class findings come out bg-[#fff], hover:bg-[...], p-[13px]
- [Phase 03]: 03-06: tokensMissing echoes config.design.tokens as written (like reportMissing), not the normalised key; the allowlist check is skipped when the file is absent or design.tokens is empty
- [Phase 03]: 03-06: valid-build gains accord/assets/LOGIN-1/prototype.html (before accord/config.yml in every code-point-sorted pin) and a two-token tokens.css; LOGIN-1.md untouched
- [Phase 03 UAT]: `Mode: mvp` cleared on Phase 3 as well, following the Phase 1 and 2 precedent; Phases 4-9 still carry the line and are reassessed when planned
- [Phase 03 UAT]: D-60 text shape kept as-is (`file:line: level rule reason`, literal plural). Measured: VS Code terminal link detection resolves the `path:line` prefix, but the stock `$gcc` / `$tsc` problem matchers do not match it — a CI consumer needs its own matcher. Accepted knowingly
- [Phase 03 UAT]: The two prototype-chain `in` lookups were fixed in Phase 3 rather than deferred to Phase 4, because GATE-08 reads `snapshot.tests` directly. `Object.hasOwn` in `load/junit.ts:41` and `lint/gherkin.ts:85`, plus two regression tests; suite 388 -> 390
- [Phase 03 security]: 16 threats closed at L1 grep depth; three accepted risks (hand-written passing report is Phase 4 gate scope; sentinels inside HTML comments are unlinted by D-73; the engine itself runs no regex). The UAT fix strengthened the T-03-09 and T-03-10 mitigations

- [Phase 05]: 05-01: a commander refusal that is not `--version`/`--help` maps to exit 2, not commander's own exit 1, so a mistyped command cannot be read as a lint failure (STACK Decision 1). The plan text said "its exitCode or 2" — flagged for an owner ruling in 05-01-SUMMARY
- [Phase 05]: 05-01: the version pin is checked only when `snapshot.config` is defined, so a missing or schema-invalid config.yml exits 1 with its schema findings rather than 2 with a pin error
- [Phase 05]: 05-01: bare `accord` with no arguments prints help to stderr and exits 2 (commander's own default reaching the usage-error branch); unspecified by the plan, flagged
- [Phase 05]: 05-01: the in-process `run(argv, cwd)` harness lives in test/helpers/repo.ts beside makeRepo rather than being copied into three test files
- [Phase 05]: 05-01: only CLI-06 ticked; CLI-05 and CLI-07 span plans 05-02..05-06 and would be false to close on `lint` alone
- [Phase 05]: 05-02: `statusRows` lives in core, not the CLI, so Phase 8's MCP host gets it from the barrel with no second implementation; `scoped` stays private
- [Phase 05]: 05-02: `ready` reads `stale` when `ac_hash` is recorded but the ticket now has no `@ac-n` scenario at all — unspecified by D-91, flagged for an owner ruling in 05-02-SUMMARY
- [Phase 05]: 05-02: parentless tickets (epics and orphans) sort before every grouped child via `parent ?? ''`; D-92 fixes the axis but not this tie-break, flagged
- [Phase 05]: 05-02: the archived case is spread onto a `valid-build` SnapshotInput in the test rather than added to the shared fixture, so no Phase 1-4 golden moved
- [Phase 05]: 05-02: CLI-05 stays unticked; it closes when `accord status` prints, which is 05-04
- [Phase 05]: 05-05: the ticket id regex is a literal in new-ticket.ts rather than read from ticket.schema.json, so the one guard between argv and a filesystem write is visible at its call site
- [Phase 05]: 05-05: an unknown `--type` is commander's own `Option().choices()` refusal mapped to exit 2, not a hand-rolled check inside newTicket
- [Phase 05]: 05-05: `type:` is written double-quoted because D-45 quotes every string core writes, so a scaffolded ticket differs from a hand-copied template by one pair of quotes; the round-trip test proves it parses — flagged for an owner ruling in 05-05-SUMMARY
- [Phase 05]: 05-05: `accord/tickets/` is created when absent and a partially-written file is not cleaned up on a write failure; both unspecified by the plan, flagged
- [Phase 05]: 05-05: CLI-04 and CLI-07 both ticked — CLI-07 closes now that `new ticket` (write and refusal branches) is in the printed-path backslash loop

### Pending Todos

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260914-dd3 | Record four gate decisions from the AI-DLC comparison into design.md and ROADMAP.md | 2026-09-14 | uncommitted | [260914-dd3-record-four-gate-decisions-from-the-ai-d](./quick/260914-dd3-record-four-gate-decisions-from-the-ai-d/) |

### Blockers/Concerns

- [Phase 8]: MCP server design is unresearched: hosting (Workers vs Node host and whether `ajv` runs there), OAuth flavour, commit-without-clone API, folder fetch per gate call within rate limits
- [Phase 9]: Employer tracker is Shortcut; decide during planning whether adapter `none` is enough for the first real ticket

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-15T05:05:00.000Z
Stopped at: Phase 05 complete, ready to plan Phase 6
Resume file: .planning/phases/05-cli-commands/05-06-PLAN.md

- [Phase 05]: 05-06: the tracker adapter is reached only from `status` on the text path — under `--json` no request is issued at all, because D-98 makes stdout the core array verbatim and enrichment is a rendering concern
