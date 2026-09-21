---
gsd_state_version: "1.0"
milestone: v0.1
current_phase: 09
current_phase_name: Publish and Dogfood
status: executing
stopped_at: "Phase 09 Wave 3 done — 0.1.0 published over OIDC with provenance; Wave 4 (09-07) next; bootstrap token still NOT revoked"
last_updated: "2026-09-21T09:15:00.000Z"
last_activity: 2026-09-21
last_activity_desc: "Phase 09 Wave 3 — @accord-dev/accord@0.1.0 published from Actions over OIDC, no token, SLSA provenance attested, npx-installable on a bare runner; ROADMAP criterion 1 met"
state_head: 2a5040af51e33ee7cfe7db5c5a56024326ff8959
progress:
  total_phases: 9
  completed_phases: 2
  total_plans: 62
  completed_plans: 56
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-17)

**Core value:** An agent cannot start a story without captured intent and acceptance criteria, and cannot finish one without independent verification against them.
**Current focus:** Phase 09 — Publish and Dogfood

## Current Position

Phase: 09 (Publish and Dogfood) — EXECUTING
Plan: 5 of 11
Status: Ready to execute
Last activity: 2026-09-21 — Phase 09 execution started

Progress: [████████░░] 7 of 8 live phases (88%) — 9 numbers, Phase 8 removed (D-117)

## Performance Metrics

**Velocity:**

- Total plans completed: 40
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
| 06 | 8 | - | - |

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
| Phase 06 P01 | 15 min | 3 tasks | 12 files |
| Phase 06 P02 | 12 min | 3 tasks | 21 files |
| Phase 06 P03 | 13 min | 3 tasks | 7 files |
| Phase 06 P04 | 9 min | 3 tasks | 13 files |
| Phase 06 P05 | 10 min | 3 tasks | 9 files |
| Phase 06 P06 | 26 min | 3 tasks | 0 files |
| Phase 06 P07 | 10 min | 2 tasks | 2 files |
| Phase 06 P08 | 12 min | 3 tasks | 4 files |
| Phase 07 P01 | 15 min | 3 tasks | 10 files |
| Phase 07 P02 | 18 min | 3 tasks | 7 files |
| Phase 07 P05 | 63m | 3 tasks | 12 files |
| Phase 07 P03 | 22min | 3 tasks | 5 files |
| Phase 07 P06 | 24min | 2 tasks | 10 files |
| Phase 07 P07 | 28min | 2 tasks | 1 files |
| Phase 07 P08 | 18min | 3 tasks | 13 files |
| Phase 07 P09 | 13 min | 2 tasks | 2 files |
| Phase 07 P10 | 14 min | 2 tasks | 2 files |
| Phase 07 P11 | 13 | 2 tasks | 7 files |
| Phase 07 P12 | 13 min | 3 tasks | 4 files |
| Phase 07 P13 | 9m | 2 tasks | 6 files |
| Phase 07 P14 | 25min | 3 tasks | 8 files |
| Phase 07 P15 | 20min | 2 tasks | 2 files |
| Phase 09 P01 | 12min | 3 tasks | 7 files |
| Phase 09 P02 | 4min | 2 tasks | 2 files |
| Phase 09 P03 | 9min | 2 tasks | 4 files |

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
- [Phase 06]: [Phase 06]: 06-02: "describes writing `verified`" is asserted as an imperative verb immediately before the key, not a substring, so code-review.md's third-person "before ticking `verified`" does not count it and the body still graduates verbatim
- [Phase 06]: [Phase 06]: 06-02: the review brief names the ticket as "the ticket", never as an accord/-rooted path, which is what keeps the write-boundary set equality at exactly one element with no write-verb heuristic
- [Phase 06]: [Phase 06]: 06-02: this repository's own accord/config.yml sets design.tokens to a path that does not exist, so accord lint carries one standing lint.tokens-missing warning — honest over silent; flagged for an owner ruling in 06-02-SUMMARY
- [Phase 06]: [Phase 06]: 06-02: the SKILL-09 adjacency edge was not re-asserted — 06-01 already asserts one SKILL.md per role directory over the whole render output; a second copy would be the drift this phase removes
- [Phase 06]: 06-03: the SKILL-08 scanner reads command mentions from code spans and fenced blocks only, because shared/prototype.md's heading 'the header accord ships' is English rather than a command
- [Phase 06]: 06-03: an orphan is an accord-<name> directory whose name is not in roles:, not one absent from the render output - so a declared role awaiting its definition (ba, until 06-04) is not reported
- [Phase 06]: 06-03: the ASCII invariant lives in skills-sync.test.ts, not spawn-surface's shared loop - lint and gate quote ticket text and are only as ASCII as the repository they read
- [Phase 06]: 06-03: skillDirs(config) exported from core so the orphan scan knows the declared target directories even when no role renders; flagged for an owner ruling in 06-03-SUMMARY
- [Phase 06]: D-118 branch shipped: accord-ba/SKILL.md step 2 reads config.profile and routes to ./setup.md (build, empty product/) or ./story.md
- [Phase 06]: ROADMAP criterion 6 asserted as a whole-render-output scan matching the artifact form only (bare 'handoff'; 'session' + artifact word or .md), never the bare noun
- [Phase 06]: D-116 resolved as a convention: Rejected: <option> - <reason> taught by ba/setup.md plus one guidance line in templates/business-rules.md; no schema change
- [Phase 06]: 06-05: allSkillDirs() takes no argument - the orphan scan reads only the DIRS literal, so widening the scan removes the config input from path composition rather than adding one (T-06-01 strengthened)
- [Phase 06]: 06-05: orphans() holds the scan set and the declared set as two values - a directory is an orphan when either its runtime or its role is no longer declared, so a dropped runtime prints the same line as a dropped role
- [Phase 06]: 06-05: the repository-only-path regression collects every offender before asserting, so the RED named all six rendered files with path and line rather than aborting on the first
- [Phase 06]: 06-05: review.md step 2 lead-in gained the <scenario name> placeholder - it lived only in the template the reader no longer opens, and the block shape must be learnable from the brief alone
- [Phase 06]: 06-05: prototype.md step 2 names three of the header comment block four lines; Rule: is deliberately not described because describing it restates lint.token-hardcoded (D-126)
- [Phase 06]: 06-06: owner ruled Task 1 a pass and reclassified the caveat as a plan-wording defect - the two PASS clauses are mutually exclusive as written, because meeting clause 1 (re-slice into vertical slices) dissolves clause 2's subject (separate endpoint/serialiser steps to reorder)
- [Phase 06]: 06-06: owner upheld restates on all three sentences - naming the command AND paraphrasing what it checks is the plan's own adjacency tie-breaker; SKILL-04 verdict fail stands and SKILL-04 stays open
- [Phase 06]: 06-06: the prose fix for the three restating sentences is deferred to Phase 7 as a documented carried-forward finding, not a 06-07 gap plan - it blocks no numbered criterion and findings are documented before they are fixed
- [Phase 06]: 06-07: a link on the way to a scan directory is skipped silently - no stderr line, no exit-code change - because D-113 forbids the orphan report from changing the exit code and D-123 forbids reporting a directory accord did not generate
- [Phase 06]: 06-07: scannable() is kept separate from assertNoLink rather than merged - the same component walk answers two different questions (may accord WRITE here vs may accord LOOK here) and disposes of a link differently
- [Phase 06]: 06-07: the D-51 printed-output invariant now asserts the whole line on stdout and, on stderr, only what survives removing every accord-* entry name the sandbox holds - the name is the user's and printing it verbatim is the point (NF-02)
- [Phase 07]: 07-01: `init` builds its own context from repoRoot(opts.cwd) rather than preflight - accordFiles throws 'no accord/ folder' before the pin is consulted, and init is the command that creates that folder
- [Phase 07]: 07-01: assertNoLink moved to packages/cli/src/guard.ts and is imported by both write paths; scannable stayed in skills.ts because the same walk answers a different question and disposes of a link differently
- [Phase 07]: 07-01: ScaffoldFile is kept separate from SkillFile (A-03) - structurally identical, opposite write contracts (skip-if-exists vs re-render against a marker), so one doc comment would have become false
- [Phase 07]: 07-01: the plan's pkg import specifier '../package.json' does not resolve from src/commands/; used '../../package.json' - flagged as a deviation, the D-135 test is what would have caught a wrong manifest
- [Phase 07]: 07-01: skill-commands.test.ts pins the registered command list as a literal, so registering init needed a one-line test edit - 07-PATTERNS.md's 'no test edit needed' holds for the SKILL-08 allowlist only
- [Phase 07]: 07-01: CLI-01 stays unticked - it spans 07-01..07-04 and init writes one of five artifacts so far, following the 05-02 precedent for CLI-05
- [Phase 07]: 07-02: CLI-01 is ticked - its own text (folder, config, templates, skill copies, idempotent, never overwrites, prints what it created) is delivered in full; the CI workflow and the AGENTS.md pointer are CLI-02 and CLI-03, separate requirements owed to 07-03 and 07-04
- [Phase 07]: 07-02: writeSkillFiles extracted from commands/skills.ts and called by both init and skills sync (D-131), so the marker-and-hash rule has one implementation and cannot mean two things
- [Phase 07]: 07-02: init reads the repository back through loadFromFs + loadSnapshot after its own scaffold writes (A-07), which makes it repository-reading - so a missing/unschematic config and a mis-pinned config are both exit 2, before the first skill byte (A-06, T-07-08)
- [Phase 07]: 07-02: 07-01's D-132 case used a deliberately unparseable sentinel config; under A-06 that path is now exit 2, so the case was re-pointed at a valid hand-written config and the unparseable text became the new refusal case
- [Phase 07]: 07-06: the example's `ac_hash` and `verified_hash` were read off the gate's own report rather than authored — the ticket was written with a PENDING sentinel, the gate answered with one `schema.pattern` finding and the computed `acHash`, and writing that value in turned both verdicts to pass. That two-run loop is what the example demonstrates
- [Phase 07]: 07-06: no golden file for the examples cases — a golden pins the exact finding list and would have to be regenerated every time the example prose is improved, training whoever maintains it to regenerate rather than read
- [Phase 07]: 07-06: `readDir(root: URL)` holds the fixture walk and `readFixture(name)` is one line over it, so the fixtures and the D-145 examples share one key-normalisation rule
- [Phase 07]: 07-07: the workflow-script suite is gated on `bash` RESOLVING, never on `process.platform`; the bash-resolution guard case sits outside both skipped describes so the POSIX CI leg cannot report green having executed nothing (A-25, T-07-35)
- [Phase 07]: 07-07: two cases beyond the plan drive the real built CLI through a forwarding `npx` stub (`shift 2; exec node "$ACCORD_CLI" "$@"`), closing 07-03's F-3 — the script text stays byte-identical and the registry is still never reached
- [Phase 07]: 07-07: `packages/cli/test/helpers/repo.ts` was left unmodified; the plan's conditional bare `git(repo)` accessor is unnecessary because `commitAll` returns the sha and `git add -A` stages deletions
- [Phase 07]: 07-08: the maintain example's two scenarios are one `@ui` and one `@test:`-tagged, so the human layer and the machine layer both run over it; an all-`@ui` ticket would have passed Done with no test report at all, which is passing by avoiding what the example demonstrates (T-07-36)
- [Phase 07]: 07-08: `examples/maintain` is the ONLY configuration in this repository where `design.tokens` names a file that is in the snapshot, so `lint.token-hardcoded` actually executes there; three probes confirm it fires on a hard-coded colour and on an undeclared `var()` name, and goes silent when `design.tokens` is emptied
- [Phase 07]: 07-08: the `examples` CI job enumerates `examples/*/` and names neither example (A-29), and rewrites the placeholder tick sha to the sandbox's own HEAD with two key-anchored `sed` expressions rather than a blanket substitution
- [Phase 07]: 07-08: `examples/maintain/accord/tickets/EXPORT-1.md` carries no `design:` key at all — on the maintain profile the prototype is what Ready requires, so the question F-2 is open about never arose
- [Phase 07]: SKILL-04 closed by option A': the never-restates fix stands and `status: draft` survives in ba/SKILL.md as its own command-free paragraph (owner, 2026-09-17)
- [Phase 07]: 07-09: init takes all three refusals (config-unreadable, pin mismatch, skill-target link) in one refusals() local called before the scaffold write loop whenever accord/config.yml already exists, so a repository pinned to another release receives no byte; the greenfield roster cannot be hoisted, so that path prints its report from the catch and rethrows unchanged
- [Phase 07]: 07-09: refusals() returns the guarded SkillFile[] rather than the loaded snapshot the plan named - it must compute skillTargets for its own assertNoLink pre-pass anyway, so returning the snapshot would force a second skillTargets call or a redundant narrowing of snapshot.config
- [Phase 07]: 07-09: a containment claim over an uncommitted tree is proven by a before/after content-hash snapshot taken at plan start, never by git status - guard.ts is untracked, so git diff on it is empty whether or not it was edited
- [Phase 07]: 07-10: accord init emits the tests: block COMMENTED, with one line naming the uncomment condition - the key is met while reading the file, and accord never synthesises a team's test-reporting setup (D-104, T-07-41). The residual is accepted: a fresh repo still fails gate.tests-unconfigured on its first @test: ticket until a human uncomments it
- [Phase 07]: 07-11: the shipped templates' design example URL is https://example.com/design/... — the IANA reserved domain, https:// so ticket.schema.json's design pattern still matches, identical on all three templates
- [Phase 07]: 07-11: the CLAUDE.md naming constraint gains no exception — the deniedNames scan grew a fifth caller over the generated templates record and no allowlist, per the owner's F-2 ruling
- [Phase 07]: 07-11: dist is a shipped text surface no deniedNames caller covers — all five scan build inputs, none the output; one JSDoc line (cli/src/render/table.ts:24) still names a tracker product in published bytes (WINDOWS 19)
- [Phase 07]: 07-12: the AGENTS.md/CLAUDE.md pointer append reads and writes with latin1 as one codec pair - byte-for-byte over 0x00-0xFF, so a windows-1252 file survives init unchanged (gap 1 / GC-CR-01); core's pointer.ts is untouched
- [Phase 07]: 07-12: writeSkillFiles takes a caller-owned ReportRow[] accumulator (third param, default []), so a copy written before a later target throws still reaches the report init prints (GC-WR-01, D-112)
- [Phase 07]: GAP-2c/GAP-2c-EXT: the shipped ticket templates and README teach github-issues as the tracker example key — a key config.yml's adapter enum actually names — so no product name is taught and DENIED needs no carve-out
- [Phase 07]: [Phase 07-14]: GAP-2d settled — packages/core/dist/index.js:1259 is a decided NON-breach (the CSS function name inside the tokens lint rule's own gradient regex, naming no product). Three routes rejected: tightening the scan (does not clear it, and loses hyphenated names in prose), rewording the lint rule (loosens a working rule to satisfy a scan), allowlisting (forbidden by GAP-2a). Scan stays scoped to the CLI bundle; the tokens rule is unmodified.
- [Phase 07]: [Phase 07-14]: the denied-name list lives at the repository root (test/helpers/denied.ts), imported downwards by both packages' test trees; no re-export shim at the old path, because a shim is the second copy the list moved to avoid. The move needed no tsconfig, eslint or vitest edit.
- [Phase 07]: [Phase 07-14]: the deniedNames scan now reads the build's OUTPUT (packages/cli/dist/cli.js), not only its inputs. Its ceiling is stated in the test's own comment: no test can prove dist matches src, so freshness comes from npm run build preceding npm test in both CI jobs.
- [Phase 07]: 07-15: the generated config.yml's tests: instruction names both halves of the edit — remove the "# " (hash and space), and point report: at the file the team's own runner writes; the sample reports/junit.xml is unchanged (WR-01 not re-opened)
- [Phase 07]: 07-15: the A-33 assertion is anchored on its own key line on both sides (lines.indexOf('# tests:') / exLines.indexOf('tests:')) with a content guard on the extracted pair, so a reworded instruction fails naming the offset rather than the claim
- [Phase 09]: 09-03: repo-relative links in the generated npm README (docs/design.md) are copied verbatim and 404 on npmjs.com — ruling deferred to the 09-08 dogfood ticket per the plan
- [Phase 09]: Task 1 checkpoint answered proceed: core private (D-150), core to devDependencies (D-164), deps.alwaysBundle spelling

### Pending Todos

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260914-dd3 | Record four gate decisions from the AI-DLC comparison into design.md and ROADMAP.md | 2026-09-14 | uncommitted | [260914-dd3-record-four-gate-decisions-from-the-ai-d](./quick/260914-dd3-record-four-gate-decisions-from-the-ai-d/) |

### Blockers/Concerns

- [Phase 7]: SKILL-04 is open by owner decision — three sentences in `ba/SKILL.md` and `ba/story.md` restate a rule the CLI enforces. Accepted as a verification override on Phase 6 (06-VERIFICATION.md `overrides`), tracked as WINDOWS.md entry 6, prose fix owed here
- [Phase 7]: The POSIX leg of the `skills sync` link guard has never run — every 06-07 run and its verification were on Windows, and nothing is committed, so CI has not seen it (WINDOWS.md entry 7)
- [Phase 7]: 07-06 F-1 — the D-147 layer-1 claim is proven one direction short: the examples suite is shown to go red when the example data moves, but the rule-side perturbation (tightening `isSha`) was denied by the sandbox and not retried. WINDOWS.md entry 12; owner call
- [Phase 7]: `.planning/PROJECT.md` was last evolved after Phase 3; the Phase 4, 5 and 6 transitions never ran `evolve_project`, so its Requirements and Key Decisions lag three phases. Phase 6's share is now recorded; 4 and 5 are not
- [Phase 7]: 07-07 F-3 — plan verification item 3 (re-run with the network disconnected) was not performed; the no-network claim rests on the exact-invocation-count assertions and the 8 s runtime. WINDOWS-adjacent, owner call
- [Phase 7]: 07-07 F-4 is CLOSED by 07-08's CI job: rewriting the placeholder tick sha to the sandbox's own HEAD makes a real *passing* `gate done` reachable through the real CLI, and the script exits 0 for both examples
- [Phase 7]: 07-08 — the `examples` CI job has never run in CI (ubuntu-latest only, nothing committed). Its script body was executed by hand on this Windows host and exited 0 for both examples; WINDOWS.md entry 14
- [Phase 7]: 07-08 F-2 remains open and unruled: the shipped ticket templates still name a design tool in example URLs. `examples/maintain` carries no such name and the templates were not edited
- [Phase 7]: 07-07 F-6 — on a Windows host without Git Bash, `npm test` is green over nine unrun cases with no signal louder than the vitest skip marker; the POSIX guard makes CI honest, nothing makes a local Windows run loud
- [Phase 7]: `.planning/WINDOWS.md` had 07-06's entry 12 in its JSON block but not in its table or counts, which made every further `windows append` refuse; repaired in 07-07 along with the new entry 13
- [Phase 8]: CLOSED 2026-09-19 — Phase 8 removed under D-117, so the unresearched MCP design (hosting, OAuth flavour, commit-without-clone API, rate limits) is no longer a risk. Questions preserved in `.planning/research/questions.md` if the team-contract aim returns
- [Phase 9]: Employer tracker is Shortcut; decide during planning whether adapter `` is enough for the first real ticket
- [Phase 7]: 07-09 F-1 (A-31) - guard.ts:33 says 'nothing was written' on the one refusal path that legitimately writes first (greenfield skill-target pre-pass). The message is shared with skills sync, where it is true, so rewording it is out of the gap scope. WINDOWS.md entry 15; needs a ticket
- [Phase 7]: 07-10 F-1 (A-34) - the generated config.yml header says 'Every key below is required' and the file now ends with a commented-out optional tests: block. A-34 forbade rewording the header inside the plan; needs an owner ruling. WINDOWS.md entry 17
- [Phase 7]: 07-10 F-2 - following the new block's instruction (uncomment before your first @test: ticket) yields a standing 'accord lint' warning lint.report-missing until the test runner first writes reports/junit.xml. Warning only, after a deliberate act; fresh init lint is still 0/0. Fix is a lint-rule decision, out of scope for phase 7. WINDOWS.md entry 18
- FINDING F-1: packages/cli/test/bin.test.ts 'names no other tool' is RED on one false positive - 'linear-gradient' in packages/core/src/lint/tokens.ts:97 trips the Lin+ear entry in test/helpers/denied.ts now that core is bundled. Needs author decision between options A/B/C in 09-01-SUMMARY.md.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-21T05:30:00.000Z
Stopped at: Completed 09-03-PLAN.md (nothing committed — author approval pending)
Resume file: None

- [Phase 05]: 05-06: the tracker adapter is reached only from `status` on the text path — under `--json` no request is issued at all, because D-98 makes stdout the core array verbatim and enrichment is a rendering concern
