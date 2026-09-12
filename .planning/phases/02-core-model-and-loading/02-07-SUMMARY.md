---
phase: 02-core-model-and-loading
plan: 07
subsystem: cli-loader
tags: [git, ls-files, child_process, readdir, snapshot, parity, windows]

requires:
  - phase: 02-core-model-and-loading
    provides: "02-01 loadSnapshot(input), SnapshotInput type, valid-build fixture and its golden"
provides:
  - "`loadFromFs(root)` in packages/cli/src/load/fs.ts: SnapshotInput from a real repository (D-51, D-30, D-29)"
  - "`UsageError` with `exitCode = 2` for no git, not a repository, no accord/ folder (CLI-07 exit code 2 in Phase 5)"
  - "Temp-repo tests proving byte parity with the core golden, .gitignore handling, posix keys, tokens-path containment (T-02-20), usage errors"
affects: [02-06, phase-3-lint, phase-4-gates, phase-5-cli, phase-8-mcp]

actuals:
  tokens: 2085
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Only child process in the CLI: `git` by bare name with a literal argv and no shell option"
    - "Snapshot keys are always `relative(root, abs).split(sep).join('/')`; no path.join result is ever stored"
    - "Temp repos: mkdtemp + cpSync fixture + `git init -q`, cleaned with rmSync maxRetries 5"

key-files:
  created:
    - packages/cli/src/load/fs.ts
    - packages/cli/test/load.test.ts
  modified: []

key-decisions:
  - "The tokens file is read after a first loadSnapshot pass over accord/** alone; the pass costs one extra parse and avoids a config reader outside core"
  - "Containment of design.tokens uses relative(root, resolve(root, rel)): empty, `..`-prefixed, or absolute results are skipped silently (T-02-20)"
  - "git errors other than ENOENT all become one UsageError carrying git's trimmed stderr; the CLI does not classify git's exit codes"

patterns-established:
  - "CLI tests read core fixtures and goldens by URL relative to import.meta.url and re-implement stableJson inline; no cross-package test import"

requirements-completed: [CORE-06, FMT-08]

coverage:
  - id: D1
    description: "loadFromFs over a git-initialised copy of valid-build reproduces the core golden byte for byte and yields exactly accord/** plus the tokens file in `files` and the eight golden paths in `tree`"
    requirement: CORE-06
    verification:
      - kind: unit
        ref: "packages/cli/test/load.test.ts#loadFromFs > matches the core golden exactly"
        status: pass
    human_judgment: false
  - id: D2
    description: "No backslash in any files key or tree entry (asserted on Windows, the author's machine)"
    requirement: FMT-08
    verification:
      - kind: unit
        ref: "packages/cli/test/load.test.ts#loadFromFs > keys never contain a backslash"
        status: pass
    human_judgment: false
  - id: D3
    description: "tree honours .gitignore: an ignored file is absent, the .gitignore itself is present"
    requirement: CORE-06
    verification:
      - kind: unit
        ref: "packages/cli/test/load.test.ts#loadFromFs > respects .gitignore"
        status: pass
    human_judgment: false
  - id: D4
    description: "A design.tokens path that resolves outside the root is never read (T-02-20)"
    verification:
      - kind: unit
        ref: "packages/cli/test/load.test.ts#loadFromFs > skips a tokens path outside the repository"
        status: pass
    human_judgment: false
  - id: D5
    description: "Not a repository and missing accord/ folder raise UsageError with exitCode 2 and a message naming the cause"
    verification:
      - kind: unit
        ref: "packages/cli/test/load.test.ts#loadFromFs > a directory that is not a repository is a UsageError"
        status: pass
      - kind: unit
        ref: "packages/cli/test/load.test.ts#loadFromFs > missing accord folder is a UsageError"
        status: pass
      - kind: unit
        ref: "packages/cli/test/load.test.ts#loadFromFs > exposes exit code 2 on UsageError"
        status: pass
    human_judgment: false
  - id: D6
    description: "git absent from PATH (ENOENT) raises UsageError 'git is required but was not found on PATH'"
    verification: []
    human_judgment: true
    rationale: "The suite cannot remove git from PATH without an injectable environment; the branch is covered by code reading only, as the plan's flagged assumption states. Phase 5 spawn test is the place to exercise it."

duration: 6min
completed: 2026-09-06
status: complete
---

# Phase 2 Plan 07: CLI Filesystem Loader Summary

**`loadFromFs(root)` builds the D-28 snapshot from a real working tree: `tree` from `git ls-files --cached --others --exclude-standard -z`, `files` from `accord/**` plus the contained tokens file, and the result is byte-identical to the core golden.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-06T07:57:00Z
- **Completed:** 2026-09-06T08:03:00Z
- **Tasks:** 2
- **Files modified:** 2 (both new, staged, uncommitted)

## Accomplishments

- `packages/cli/src/load/fs.ts`: `UsageError` (`exitCode = 2`, `name = 'UsageError'`), `gitTree` (spawn by bare name, literal argv, stdio piped, ENOENT and other failures typed), `accordFiles` (recursive readdir, regular files only, posix keys), `tokensPath` (backslash and `./` normalised, containment via `relative`/`isAbsolute`, existence and file checks), `loadFromFs`.
- `packages/cli/test/load.test.ts`: 7 tests over mkdtemp repositories; the parity test compares `stableJson(loadSnapshot(loadFromFs(tmp)))` with the golden file text using `toBe` and no trimming, and it passed on the first run.
- `npm run check` exits 0: 12 test files, 184 tests, 0 failures. `git log -1` is still `48e56d7`.

## Prepared Commits

Nothing was committed. Both files are staged; the owner reviews and commits.

1. `feat(02-07): CLI filesystem loader over git ls-files with typed usage errors (D-51)`
   - packages/cli/src/load/fs.ts
2. `test(02-07): temp-repo parity with the core golden, .gitignore, posix keys, tokens containment, usage errors`
   - packages/cli/test/load.test.ts
3. `docs(02-07): complete CLI filesystem loader plan`
   - .planning/phases/02-core-model-and-loading/02-07-SUMMARY.md, .planning/STATE.md, .planning/ROADMAP.md, .planning/REQUIREMENTS.md

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | `loadFromFs`: git tree, accord files, tokens file, forward slashes, usage errors | uncommitted (owner review pending) | packages/cli/src/load/fs.ts |
| 2 | Temp-repo tests: parity, ignore handling, backslash-free keys, usage errors | uncommitted (owner review pending) | packages/cli/test/load.test.ts |

**Plan metadata:** uncommitted (owner review pending)

## Files Created/Modified

- `packages/cli/src/load/fs.ts` - D-51 loader and `UsageError`; the only child process in the CLI is `git` by name.
- `packages/cli/test/load.test.ts` - seven temp-repository tests; reads the core fixture and golden by URL, no cross-package import.

## Verification

| Check | Result |
|-------|--------|
| `npm run build && npm run typecheck && npm run lint` | exit 0 |
| Forbidden-spawn grep on fs.ts (`npx`, `npm`, `.cmd`, `shell: true`) | no match |
| Task 1 acceptance greps (`execFileSync('git'`, `'--exclude-standard'`, `class UsageError`, `exitCode = 2`, `startsWith('..')`, `isAbsolute`, `split(sep).join('/')` x2) | 1, 1, 1, 1, 1, 2, 2 |
| `git diff --quiet -- packages/cli/src/index.ts packages/cli/package.json package-lock.json` | exit 0 (unchanged) |
| `npm test -- --project cli load` | 7 passed, 0 failed |
| `npm test -- --project cli` | 11 passed, 0 failed |
| `npm run check` (wave-end check, all projects) | 184 passed, 0 failed |
| `git log -1 --format=%H` | `48e56d7`, unchanged |

## Decisions Made

- The first `loadSnapshot` pass runs over `accord/**` alone to read `config.design.tokens`; the tokens file is then added to the same `files` record. This reuses core's config parsing rather than reading YAML in the CLI.
- `git` failures other than ENOENT collapse into one `UsageError` whose message is `not a git repository (or git failed): <root>` followed by git's trimmed stderr. The CLI does not inspect git's exit code.
- An extra seventh test pins `exitCode === 2` and `name === 'UsageError'` on the thrown error, since Phase 5 maps the exit code from that field.

## Deviations from Plan

**1. [Acceptance criterion] `split(sep).join('/')` count.** The first draft factored the posix conversion into a one-line helper, which left a single literal occurrence; the plan requires at least two. The helper was inlined at both call sites (also one fewer function). No behaviour change.

**Total deviations:** 1 (acceptance-grep alignment). **Impact:** none.

## Findings / Decisions for Owner

1. **Golden parity held with no trimming.** The golden ends with `}` and no trailing newline, matching `stableJson` output verbatim; `git ls-files --eol` reports `i/lf w/lf`. Nothing was normalised on either side.
2. **`files` ignores `.gitignore` by design (D-51 literal).** Every regular file under `accord/` is read even when gitignored; only `tree` honours ignore rules. A gitignored ticket therefore loads but is absent from `tree`. Alternative: filter `files` by `tree`. Not tested either way; noted as the plan's flagged assumption.
3. **Symlinks under `accord/` are skipped** (`Dirent.isFile()` is false for symlinks). A symlinked ticket is not loaded. Same as the core fixture reader.
4. **git ENOENT branch is untested** (plan flagged assumption). Coverage entry D6 is marked `human_judgment: true`. Phase 5's spawn test on a runner where git is guaranteed is the place to exercise it, or an injectable `execFile` if you want it unit-tested.
5. **Not-a-repository test assumes the temp directory is outside any git work tree.** On this machine `os.tmpdir()` is `C:\Users\LuanNgo\AppData\Local\Temp`, which is not inside a work tree; the test passed. A comment in the test records the assumption.
6. **Requirements checkboxes.** CORE-06 and FMT-08 were already marked complete by 02-01; this plan's `requirements.mark-complete` is a no-op re-run, as 02-02 to 02-05 also noted.
7. **Untracked planning files.** `02-0[1-7]-PLAN.md`, `02-CONTEXT.md`, `02-DISCUSSION-LOG.md`, `02-PATTERNS.md` are untracked and predate this plan; they were not staged here. Stage them when you commit the phase if you want them in history.

## Known Stubs

None. Both files implement their D-nn contract in full.

## Threat Flags

None beyond the plan's register. T-02-20 (tokens path containment) and T-02-21 (literal argv, no shell) are implemented and the first is tested. T-02-SC holds: no package added; `packages/cli/package.json` and `package-lock.json` are unchanged.

## Issues Encountered

None. Build, typecheck, lint, and all 184 tests passed on the first full run.

## Next Phase Readiness

- 02-06 (Wave 3, `setFrontmatterKey`) is unblocked; it does not touch the CLI package.
- Phase 5 wires `loadFromFs` into commander and maps `UsageError.exitCode` to the process exit code.
- The Windows CI job is where the backslash and `rmSync` assertions matter most; they passed locally on Windows 11.

## Self-Check: PASSED

- Created files exist: `packages/cli/src/load/fs.ts`, `packages/cli/test/load.test.ts` (both staged, `git status` shows `A`).
- Commits: none by design (owner commits); `git log -1` unchanged at `48e56d7`.

---
*Phase: 02-core-model-and-loading*
*Completed: 2026-09-06*
