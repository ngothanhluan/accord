---
phase: 07-scaffolding-and-example-repo
plan: 10
subsystem: cli
tags: [accord-init, config-yml, tests-report, gate-done, scaffolding, vitest]

# Dependency graph
requires:
  - phase: 07-scaffolding-and-example-repo
    provides: "`CONFIG(version)` and `initFiles` (07-01); the two shipped examples and their `readDir`-based suite (07-06, 07-08); the `deniedNames` scan over `initFiles` output (07-04); the reordered `accord init` command (07-09)"
provides:
  - "The `config.yml` `accord init` writes now carries a commented-out `tests:` block, so a team meets the test-report key while reading the file rather than when CI goes red (owner ruling on WR-01)"
  - "An assertion that the block is exactly one anchored uncomment away from a schema-valid config carrying a non-empty `tests.report`, and a second that the shipped form parses with no `tests` key at all"
  - "A machine-held binding between the generated block's two comment lines and `examples/build/accord/config.yml` lines 29-30, read from the example tree at test time — truth 5 goes red when either surface is reworded alone"
affects: [08-mcp-server, 09-publish-and-dogfood]

actuals:
  tokens: 6433        # chars/4 over the two files actually changed (25,732 chars)
  tasks: 2
  commits: 0          # uncommitted by project rule — see "Task Commits" below

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A commented-out optional key is shipped with the edit that turns it on asserted by performing the edit in a test, never by describing it in prose"
    - "An anchored line substitution (`/^# (tests:| {2}report: .+)$/gm`) plus a changed-the-text guard, in place of a blanket `# ` strip that would uncomment the guidance prose and prove nothing"
    - "Cross-surface prose equality held by reading the other surface at test time through `readDir`, rather than restating its words as a literal in the test"

key-files:
  created: []
  modified:
    - packages/core/src/scaffold/init.ts
    - packages/core/test/scaffold.test.ts

key-decisions:
  - "The instruction line is one line, not two: `# Uncomment the two lines below before the first ticket carrying an @test: scenario.` It names both `@test:` and the act of uncommenting, and sits between the two copied lines (what the key is) and the key pair (the thing to edit) — the order a reader needs them in"
  - "The block is appended last, after `runtimes:`, because that is where both examples carry it — the generated file and the examples now stay comparable top to bottom, and the generated block lands on lines 29-33 against the examples' 29-32"
  - "No golden. The claim is the two parse results, which is narrower than a pinned config file and does not train a maintainer to regenerate rather than read"
  - "The `# ` prefix and nothing else: `#   report: reports/junit.xml` carries the YAML two-space indent AFTER the prefix, so removing exactly `# ` from the two key lines yields valid YAML at the right nesting. Proven by doing it, not by inspection"
  - "A-34 upheld: the header line 'Every key below is required' was left alone. The tension is real and is recorded as a finding for an owner ruling rather than resolved here — rewording the header is a decision about the whole document"

patterns-established:
  - "Pattern: the honest way to ship an optional key a tool must not synthesise is commented, with the uncomment condition stated on its own line, and with a test that performs the uncomment and validates the result"

requirements-completed: [CLI-01, CLI-02, INTG-02]

coverage:
  - id: D1
    description: "The generated `config.yml` carries a commented-out `tests:` block: two comment lines copied from the examples, one line stating the uncomment condition, and the `tests:`/`report:` pair each prefixed `# `"
    requirement: "CLI-01"
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#copies the example's two tests: comment lines word for word (A-33)"
        status: pass
      - kind: manual_procedural
        ref: "node packages/cli/dist/cli.js init in a fresh `git init` sandbox — generated accord/config.yml read top to bottom, block rendered at lines 29-33 (transcript below)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Uncommenting the block — removing the leading `# ` from exactly the two key lines — yields a config that validates against `config.schema.json` with zero findings and a non-empty `tests.report` string"
    requirement: "CLI-01"
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#is one anchored uncomment away from a config carrying tests.report (WR-01)"
        status: pass
      - kind: manual_procedural
        ref: "sandbox: two `sed` substitutions, then `accord lint` → 0 errors; then `accord gate done SIGNUP-1` → `gate.tests-unconfigured` gone (transcript below)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The block is inert until a human turns it on — the shipped text parses to an object with no `tests` property, so no default path can make the Done machine layer pass without a report a team produced (T-07-41)"
    requirement: "CLI-01"
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#ships that block commented, so no tests key parses (T-07-41)"
        status: pass
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#validates against config.schema.json with no finding"
        status: pass
    human_judgment: false
  - id: D4
    description: "The generated file's only consumer chain did not regress: CLI-02's emitted-script suite and INTG-02's examples suite report the same case counts as 07-07 and 07-08 recorded"
    requirement: "CLI-02"
    verification:
      - kind: unit
        ref: "npx vitest run --project cli workflow-script — 11 passed (11)"
        status: pass
      - kind: integration
        ref: "npx vitest run --project core examples — 12 passed (12)"
        status: pass
    human_judgment: false
  - id: D5
    description: "`examples/**` and `packages/core/test/fixtures/**` are absent from the diff, proven by content hash rather than by `git status` over an uncommitted tree"
    requirement: "INTG-02"
    verification:
      - kind: other
        ref: "find examples packages/core/test/fixtures -type f | sort | xargs sha256sum | diff -u /tmp/07-10-untouched-before.txt - → exit 0 (150 files)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The generated `tests:` block reads as an instruction to a person meeting accord for the first time, not as dead text"
    verification:
      - kind: manual_procedural
        ref: "sandbox `accord init`, config.yml read top to bottom (rendered block quoted verbatim below)"
        status: pass
    human_judgment: true
    rationale: "Whether five lines of prose land as an instruction is a reading judgment. The machine layer can prove the bytes and the uncomment; it cannot prove the sentence is clear to someone who has met neither `@test:` nor accord."

# Metrics
duration: 14 min
completed: 2026-09-18
status: complete
---

# Phase 7 Plan 10: The commented `tests:` block in the generated config Summary

**`accord init` now writes a commented-out `tests: / report: reports/junit.xml` pair under the examples' own two comment lines plus one line naming the uncomment condition — and a test performs that uncomment and validates the result, so the block is a working key rather than decoration.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-18T19:21:00Z
- **Completed:** 2026-09-18T19:35:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **Gap 2 / WR-01 closed in the shape the owner ruled.** `CONFIG(version)` in `packages/core/src/scaffold/init.ts` gained five lines after `runtimes:`. A reader of the file `accord init` just wrote now meets `tests.report`, learns it is optional until their first `@test:` scenario, and is told the one edit that turns it on.
- **The uncomment is asserted by performing it.** The new case strips `# ` from exactly the two key lines with an anchored substitution, guards that the text actually changed, then parses and runs the real validator: `validate('config', …)` is `[]` and `tests.report` is a non-empty string. A blanket `# ` strip was deliberately not used — it would uncomment the guidance prose above the key and prove nothing.
- **Truth 5 is machine-held, not eyeballed.** A second case reads `examples/build/accord/config.yml` through `readDir` and asserts the generated block's two copied comment lines equal that file's lines 29 and 30, located by stepping back three from the generated `# tests:` line rather than at a fixed offset. No line of the example's prose appears as a literal in `scaffold.test.ts` — restating it would have made the third copy IN-03 already counts two of.
- **Both consumer suites unmoved.** CLI-02's emitted-script suite: **11 passed**, the count 07-07 recorded. INTG-02's examples suite: **12 passed**, the count 07-08 recorded.

## The rendered block, verbatim

From a throwaway `git init` sandbox, `node packages/cli/dist/cli.js init`, lines 27-33 of the generated `accord/config.yml`:

```yaml
runtimes: [claude, codex]

# Where the test report lands. `accord gate done` reads it to check that the test behind each
# @test: tag really passed; without it there is no Done.
# Uncomment the two lines below before the first ticket carrying an @test: scenario.
# tests:
#   report: reports/junit.xml
```

Lines 29 and 30 are byte-identical to `examples/build/accord/config.yml` lines 29 and 30, and land at the same line numbers. The whole-file diff against that example is exactly this block and nothing else:

```diff
@@ -28,5 +28,6 @@
 # Where the test report lands. `accord gate done` reads it to check that the test behind each
 # @test: tag really passed; without it there is no Done.
-tests:
-  report: reports/junit.xml
+# Uncomment the two lines below before the first ticket carrying an @test: scenario.
+# tests:
+#   report: reports/junit.xml
```

(The `profile` and `design.tokens` differences the plan's verification step 4 anticipated do not appear against the **build** example — its values are already the generated defaults. They appear against the maintain example only.)

## The residual, stated plainly

**It is still true after this change.** A repository created by `accord init` still fails `gate.tests-unconfigured` on its first ticket carrying an `@test:` scenario, until a human uncomments the two lines and points them at a real report. The commented block leaves the key absent, which is the point — the owner chose discoverability over a synthesised default, and T-07-41 is why: an active `tests.report` pointing at a path accord itself creates would let the Done machine layer pass without a team ever producing a report.

Reproduced end to end, in a sandbox copy of `examples/build` with only its `config.yml` swapped for the generated one and a real commit made:

```
--- gate done with the generated (commented) config ---
accord/config.yml: error gate.tests-unconfigured no test report is declared, so the machine layer
  cannot run and Done cannot pass; set tests.report
...
3 errors, 3 warnings   (exit 1)

--- same repo, the two lines uncommented ---
(no gate.tests-unconfigured; no reference-unknown warnings)
2 errors, 1 warnings   (exit 1)
```

The two errors that survive the uncomment are sandbox artifacts, not this plan's: the example pins the literal short sha `1234567` (`gate.tick-stale-commit`, `gate.stale-review`), and a real `git init` commit has a different one. `gate.tests-unconfigured` is present in the first run and gone in the second — which is the whole claim. Two `gate.reference-unknown` warnings also clear, because with `tests.report` set the machine layer resolves the evidence references.

What this plan made true is what the objective said it would: the edit is **discoverable** (it is in the file the team reads on minute one), it is **exactly one edit** (two lines, one anchored substitution), and **performing it produces a valid config** (asserted, not assumed).

## Task Commits

**uncommitted (project CLAUDE.md: owner reviews the diff before any commit).** No `git commit`, no staging, no branch, no push. The changed files:

1. **Task 1: The commented `tests:` block in the generated config** — `packages/core/src/scaffold/init.ts` (would be `feat(07-10)`)
2. **Task 2: Prove the block is a working key** — `packages/core/test/scaffold.test.ts` (would be `test(07-10)`, written RED before Task 1)

**Plan metadata:** this SUMMARY, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` — also uncommitted.

## Files Created/Modified

- `packages/core/src/scaffold/init.ts` — five lines appended to the `CONFIG(version)` template after `runtimes:`. Nothing else in the file moved.
- `packages/core/test/scaffold.test.ts` — three cases added to the `initFiles — the config it plans` describe, plus one import (`readDir` from `./helpers/fixture.js`).

## TDD Record

Task 2 carries `tdd="true"` and was written first, against the pre-Task-1 `init.ts`:

- **RED:** `2 failed | 34 passed (36)`. The failures named the right thing — `the uncomment step changed nothing` (the anchored substitution matched no line) and `no "# tests:" line in the generated config: expected -1 to be greater than 2`. Not a syntax error, not a vacuous pass.
- **GREEN:** after the Task 1 edit, `36 passed (36)`, no test changed.
- The third case (`ships that block commented, so no tests key parses`) passed in both states by design — it is the guard that must stay green, and staying green across the edit is what proves the commented form really is inert.

## Decisions Made

Recorded in the frontmatter `key-decisions`. The one worth restating: the instruction line is **one** line, placed below the two copied lines and above the key pair, so a reader gets "what the key is" before "when to turn it on".

## Deviations from Plan

None — plan executed exactly as written. One acceptance-criterion-adjacent adjustment was forced by the project's own lint and is recorded under Issues.

## Issues Encountered

**1. `no-regex-spaces` on the first draft of the anchored substitution.** The plan's shape called for matching `# ` followed by the `report:` line's two-space indent, which the obvious regex writes as two literal spaces. `eslint` rejects it (`Spaces are hard to count. Use {2}`). Rewritten as `/^# (tests:| {2}report: .+)$/gm` — same match, explicit count. Caught by `npm run lint` at exit 1 before the chain was called green; not a behaviour change.

**2. The Bash heredoc on this host collapses `\\` to `\`.** The first insertion script wrote `split('\n')` into the test file as a literal newline inside a string, producing an unterminated-string parse error. Recorded here because it will bite the next executor on this machine: when writing TypeScript through a heredoc on this host, escape sequences need one more level of escaping than the shell contract implies, or the edit should go through the editing tool instead. Fixed and verified; no trace in the final file.

## Findings

**F-1 (A-34, conditional — the executor judges the tension real, and it needs an owner ruling).**
The generated file's first line reads *"Every key below is required; edit the values, keep the keys."* Line 32 is now a key that is not required and is not a key until someone edits it. Reading the finished file top to bottom, the contradiction registers: the header makes a promise about the whole document, and the last stanza is an exception to it whose only marker is its own instruction line. A-34 correctly forbade rewording the header inside this plan — that is a decision about the document, not about this block. Recording it as A-34 directs. The cheapest resolution is probably a two-word qualification in the header (*"Every key below except the last is required"* reads badly; *"The keys below are required unless a comment says otherwise"* reads better), but that is the owner's call, not this plan's.

**F-2 (new — the plan's verification step 3 explicitly asked for this to be raised).**
Step 3 said *"uncomment the two key lines by hand and run `accord lint`. It must still report 0 errors — `gate.report-missing` belongs to `gate done`, not to lint, and a warning there would be a finding worth raising."* It reports 0 errors, as required. It also reports one warning:

```
accord/config.yml: warning lint.report-missing tests.report "reports/junit.xml" is not in the snapshot
0 errors, 1 warnings
```

So a team that follows the instruction the new block gives them — uncomment before your first `@test:` ticket — acquires a standing `accord lint` warning from the moment they do it until their test runner first writes `reports/junit.xml`. This is the same class of papercut the D-134 amendment removed for `design.tokens` (and that WINDOWS.md entry 3 already carries against this repository). It is a **warning**, not an error, and it only appears after a deliberate human act, so it does not block anything and it is not a regression of anything this plan changed — the block ships commented and lint on a fresh `init` repo is still **0 errors, 0 warnings**. Raising it because the plan asked, and because the fix is a lint-rule decision that `07-CONTEXT.md` puts out of scope for this phase: either `lint.report-missing` should be silent when the named report is a path the team has not generated yet, or the instruction line should tell the reader to expect the warning. Owner's call.

**F-3 (new, pre-existing and out of this plan's scope — recorded because it can hide a real failure).**
`npx vitest run` was run four times over this plan. Three runs were green at 882/882. One run reported `3 failed | 879 passed`, all three in spawn-based CLI suites and all three the same shape: `Error: Test timed out in 5000ms` (named: `test/tracker.test.ts > the gates are blind to the tracker (D-99) > returns deeply equal results with a token and with the environment scrubbed`). No assertion failed; nothing in this plan touches a spawn path, a tracker, or an environment variable. This is host flakiness — process spawn on Windows under antivirus/disk pressure against a 5 s default timeout — and it is pre-existing. It matters because a timeout failure is indistinguishable at a glance from a real one, and a future executor who sees it once and re-runs to green will learn to re-run rather than read. The fix would be a per-suite timeout raise on the spawn suites; not attempted here (scope boundary: not caused by this task's changes).

## Verification Results

Full chain from the repository root, after the last edit:

| Command | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npx vitest run` | **36 test files, 882 passed (882)**, exit 0 — three of four runs (see F-3) |
| `npx vitest run --project core scaffold` | 36 passed (36) |
| `npx vitest run --project cli workflow-script` | **11 passed (11)** — CLI-02, the count 07-07 recorded |
| `npx vitest run --project core examples` | **12 passed (12)** — INTG-02, the count 07-08 recorded |
| `find examples packages/core/test/fixtures -type f \| sort \| xargs sha256sum \| diff -u /tmp/07-10-untouched-before.txt -` | exit 0 over 150 files — A-35 held |

Baseline for this dispatch was 36 files / 879 tests. The delta is +3, which is the three cases this plan added; no existing case changed.

Manual sandbox checks (plan `<verification>` steps 2-4), all in the session scratchpad, none touching the repository:

- `accord init` in a fresh `git init` → exit 0, **28 `created` lines**, config read top to bottom (block quoted above).
- `accord lint` on that fresh repo → **0 errors, 0 warnings**, exit 0. The `init` report is unchanged line for line from 07-09's.
- Two `sed` substitutions to uncomment → `accord lint` → **0 errors**, 1 warning (F-2 above).
- `diff` against `examples/build/accord/config.yml` → the three-line block delta and nothing else.
- No trailing whitespace on any generated line (`grep -nE ' +$'` → none); the file still ends with `0a`.

## Self-Check: PASSED

- `packages/core/src/scaffold/init.ts` — exists, contains `# tests:` and `#   report: reports/junit.xml` in `CONFIG`.
- `packages/core/test/scaffold.test.ts` — exists, contains all three new cases; `packages/core/test/__golden__/` gained no file.
- Commits: **none, by design.** The project's `CLAUDE.md` forbids committing without the owner's explicit approval, and this plan's own `<output>` block repeats the instruction. `git status` still shows both files as uncommitted working-tree changes. The usual "≥1 commit matching `{phase}-{plan}`" check is therefore not applicable and is recorded as deliberately skipped rather than silently passed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Gap 2 / WR-01 is closed in the shape the owner ruled, with its residual stated rather than hidden. Two gaps from `07-VERIFICATION.md` remain outside this plan: gap 1 (the D-132 partial-run report) was closed by 07-09, and gap 3 (F-2, the design tool named in three shipped ticket templates) has an owner ruling recorded in the verification frontmatter and no plan yet.

Two findings above want an owner ruling before Phase 9 walks this path on a real repository: F-1 (the header line's promise vs. the commented key) and F-2 (the `lint.report-missing` warning a team acquires by following the new instruction). A third, F-3, is a pre-existing host flake in the spawn-based CLI suites. None blocks anything. F-1 and F-2 are `.planning/WINDOWS.md` entries 17 and 18.

---
*Phase: 07-scaffolding-and-example-repo*
*Completed: 2026-09-18*
