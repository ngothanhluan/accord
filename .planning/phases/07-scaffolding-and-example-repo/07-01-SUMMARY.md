---
phase: 07-scaffolding-and-example-repo
plan: 01
subsystem: infra
tags: [scaffolding, cli, commander, yaml, idempotency, vitest]

# Dependency graph
requires:
  - phase: 06-skills
    provides: "the D-107 core-decides/cli-writes split, `skillTargets`'s fixed-table path rule, the `assertNoLink` write guard, and the compute-then-render report shape"
  - phase: 05-cli
    provides: "the commander spine, `repoRoot`, `UsageError` as exit 2, the in-process `run(argv, cwd)` test harness"
provides:
  - "`initFiles(pkg)` in core: the pure plan of what `accord init` writes, sorted, host-independent"
  - "`ScaffoldFile` on the core public API, deliberately separate from `SkillFile`"
  - "`accord init` registered before `lint`, the one command that runs without an `accord/` folder"
  - "`packages/cli/src/guard.ts`: `assertNoLink` shared by every accord write path"
  - "`makeEmptyRepo()` test helper: a sandbox with no fixture, the starting state `init` is defined against"
affects: [07-02, 07-03, 07-04, 08-mcp]

actuals:
  tokens: 6800   # chars/4 over the realized diff (~27,000 chars); the 62,000 estimate is a different scale
  tasks: 3
  commits: 0     # commits are forbidden in this project until the owner approves the diff

tech-stack:
  added: []
  patterns:
    - "scaffold planner: core returns `{path,text}[]` from source literals; the CLI is the only thing that writes"
    - "D-130 skip-if-exists: `lstatSync(..., { throwIfNoEntry: false }) === undefined` decides, and an existing file is never read"

key-files:
  created:
    - packages/core/src/scaffold/init.ts
    - packages/cli/src/commands/init.ts
    - packages/cli/src/guard.ts
    - packages/cli/test/init.test.ts
    - packages/core/test/scaffold.test.ts
  modified:
    - packages/core/src/index.ts
    - packages/cli/src/run.ts
    - packages/cli/src/commands/skills.ts
    - packages/cli/test/helpers/repo.ts
    - packages/cli/test/skill-commands.test.ts

key-decisions:
  - "`init` builds its own context from `repoRoot(opts.cwd)` rather than `preflight` — `accordFiles` throws `no accord/ folder in <root>` before the pin is consulted, and `init` is the command that creates that folder"
  - "`assertNoLink` moved out of `commands/skills.ts` into `src/guard.ts` and is imported by both write paths; `scannable` stayed in `skills.ts` because it answers a different question and disposes of a link differently"
  - "`ScaffoldFile` is its own interface rather than a reuse of `SkillFile` (A-03): the two are structurally identical but carry opposite write contracts, and one doc comment would have become false"
  - "`initFiles` takes `{ name, version }` although only `version` is read today (A-02), so plan 03's workflow pin adds a list entry rather than changing a signature every caller reads"
  - "The generated `config.yml` carries a comment per key; the wording is Claude's discretion per 07-CONTEXT.md, and it names `Figma`, `github-issues` and the four runtime values — all of which are already accord's own schema vocabulary or already shipped in the ticket templates"

patterns-established:
  - "Pattern 1: a command that must run in a repository accord has not touched yet takes `Omit<CommandContext, 'snapshot'>` and resolves its own root"
  - "Pattern 2: the generated config's text is a module-level function returning a template literal, interpolating only the version — no YAML serialiser, no object model"

requirements-completed: []  # CLI-01 spans 07-01..07-04; `init` writes one of five artifacts so far

coverage:
  - id: D1
    description: "`accord init` in a repository with no accord/ folder writes accord/config.yml, prints `created accord/config.yml`, and exits 0"
    requirement: CLI-01
    verification:
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#runs in a repository with no accord/ folder, writes the config, and exits 0"
        status: pass
      - kind: e2e
        ref: "node packages/cli/dist/cli.js init in a throwaway `git init -q` directory"
        status: pass
    human_judgment: false
  - id: D2
    description: "A second run reports every path skipped, exits 0, and leaves the bytes identical (D-130, D-133)"
    requirement: CLI-01
    verification:
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#reports every path skipped and leaves the bytes identical (D-130)"
        status: pass
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#leaves a hand-written config.yml untouched and reports it skipped (D-132)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An interrupted or concurrently-run init is safe to re-run: a deleted path is re-created byte-identically, everything present is skipped"
    requirement: CLI-01
    verification:
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#re-creates a deleted path byte-identically and skips the rest"
        status: pass
    human_judgment: false
  - id: D4
    description: "The written config validates against config.schema.json and pins the running CLI's own version (D-135)"
    requirement: CLI-01
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#validates against config.schema.json with no finding"
        status: pass
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#pins the running CLI version, exactly (D-135)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The scaffold planner is pure, deterministic, sorted in code-point order, and emits only repo-relative forward-slash paths (D-51, T-07-01)"
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#no backslash in any path or any emitted line (D-51)"
        status: pass
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#every path is repo-relative: no root, no drive letter, no .. segment"
        status: pass
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#is deterministic: the same argument returns the same list"
        status: pass
      - kind: other
        ref: "npm run lint (eslint no-restricted-imports over packages/core/src/**/*.ts)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The generated config declares runtimes: [claude, codex] and design.tokens: \"\", so a fresh repository resolves both skill directories and reports no lint.tokens-missing warning (D-134 as amended 2026-09-17)"
    requirement: CLI-01
    verification:
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#declares both runtimes and an empty design.tokens (D-134 as amended)"
        status: pass
      - kind: e2e
        ref: "accord lint in the throwaway repo immediately after init: `0 errors, 0 warnings`"
        status: pass
    human_judgment: false
  - id: D7
    description: "`init` is registered before `lint` and never reaches the loader refusal every other command reaches first"
    verification:
      - kind: e2e
        ref: "node packages/cli/dist/cli.js --help lists init first"
        status: pass
      - kind: unit
        ref: "packages/cli/test/skill-commands.test.ts#reads the real paths off the commander tree the CLI runs"
        status: pass
    human_judgment: false
  - id: D8
    description: "No path init writes can be a symlink or a Windows junction: every component is walked before the first byte, by the same function skills sync calls (T-07-02)"
    verification:
      - kind: unit
        ref: "packages/cli/test/skills-sync.test.ts (the existing link and junction cases, now exercising src/guard.ts)"
        status: pass
    human_judgment: true
    rationale: "The link cases prove `assertNoLink` still works after the move, but no case drives a link at `accord/config.yml` specifically, and the POSIX symlink leg has never run (WINDOWS.md entries 7 and 8)."

duration: 15min
completed: 2026-09-17
status: complete
---

# Phase 7 Plan 01: `accord init` tracer Summary

**`accord init` carries one artifact — `accord/config.yml` — end to end: a pure core planner decides the path and the text, the CLI writes it behind a link guard, commander registers it ahead of `lint`, and a second run reports it skipped without reading a byte of it.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-17T14:11Z (approx)
- **Completed:** 2026-09-17T14:26Z
- **Tasks:** 3 of 3
- **Files created/modified:** 10 (5 created, 5 modified)

## Accomplishments

- **The command-registration seam is proven, which is the one thing this tracer existed to de-risk.** `init` builds its own context from `repoRoot(opts.cwd)` and never calls `preflight`, so it runs in a repository with no `accord/` folder instead of dying on `accordFiles`' `no accord/ folder in <root>`. Verified in a real throwaway `git init -q` directory, not only in a test.
- **`initFiles` is a pure core planner with no Node built-in anywhere in it** — path composed as a literal, sorted with a local code-point comparator, same output on every call and every host. The eslint purity guard over `packages/core/src/**/*.ts` is clean with no exemption added.
- **D-130 is implemented as an absence, not a check.** There is no code path in `init` that calls `writeFileSync` on a path `lstatSync` found, so an existing file is never read, never diffed, and cannot be clobbered. The D-132 case proves it against a hand-written sentinel that is not even valid YAML.
- **A fresh repository reports zero lint findings on its first minute.** `tokens: ""` (A-01, D-134 as amended) short-circuits the token rule, so the papercut this repository carries as WINDOWS.md entry 3 is not inherited by anyone who runs `init`.
- **One link guard, not two.** `assertNoLink` moved to `packages/cli/src/guard.ts` and is imported by both `skills sync` and `init`; the existing junction and symlink cases in `skills-sync.test.ts` still pass against the moved function.

## Task Commits

**No commits were made.** This project forbids `git commit` until the owner has reviewed the diff (global CLAUDE.md critical rule, restated as a hard override in the execution brief). All work is in the working tree, uncommitted, alongside the pre-existing uncommitted Phase 6 work.

Per-task completion, tracked here instead of in git history:

1. **Task 1 (tracer): end-to-end `accord init` writing one file** — complete. `npm run build && npm run lint && npm run typecheck` clean; `node packages/cli/dist/cli.js init --help` exits 0 and contains `skipping`.
2. **Task 2 (tdd): the CLI sandbox test** — complete. `packages/cli/test/init.test.ts`, 8 cases, all passing.
3. **Task 3: the core purity and determinism test** — complete. `packages/core/test/scaffold.test.ts`, 9 cases, all passing.

## Files Created/Modified

- `packages/core/src/scaffold/init.ts` (new) — `ScaffoldFile` and `initFiles({name, version})`; the `config.yml` text as a module-level function returning a template literal, with one explanatory comment per key.
- `packages/core/src/index.ts` — exports `initFiles` and `ScaffoldFile`, with the comment explaining why `ScaffoldFile` is not `SkillFile`.
- `packages/cli/src/guard.ts` (new) — `assertNoLink(root, path)`, moved verbatim out of `commands/skills.ts` and exported.
- `packages/cli/src/commands/init.ts` (new) — `InitContext`, `init(ctx)`: pre-pass guard, compute-then-render loop, one status line per path, exit 0.
- `packages/cli/src/run.ts` — the `.command('init')` block immediately before `lint`, with the comment naming why `preflight` is wrong here.
- `packages/cli/src/commands/skills.ts` — `assertNoLink` deleted, imported from `../guard.js`; `scannable`'s doc comment repointed at the new location.
- `packages/cli/test/helpers/repo.ts` — `makeEmptyRepo()` beside `makeRepo`; the existing `makeRepo` signature is unchanged.
- `packages/cli/test/init.test.ts` (new) — 8 cases across the first run, the second run, the interrupted re-run, and D-132.
- `packages/core/test/scaffold.test.ts` (new) — 9 cases: guard-the-guard, backslash, relative-path, determinism, ordering, schema validity, version carry-through, D-134 defaults.
- `packages/cli/test/skill-commands.test.ts` — one literal command list widened with `init` (see Deviation 2).

## Decisions Made

- **The `pkg` import path in `commands/init.ts` is `'../../package.json'`, not `'../package.json'`.** See Deviation 1.
- **The `config.yml` comment wording** (Claude's discretion per 07-CONTEXT.md): one comment per key, each naming what to put there rather than restating the schema. It names `Figma` (already in the shipped ticket templates, asserted by `new-ticket.test.ts`), `github-issues` (a schema enum value), and the four runtime names (schema enum values, and the target-directory mapping is the one fact a reader needs to edit the key). No planning system, harness or plugin is named.
- **`design.tokens` reads "While it is empty the hardcoded-value check is skipped"** — the comment states the consequence of leaving it, which is what makes the empty default self-explaining rather than looking unfinished.
- **The D-132 test's sentinel is written after an explicit `mkdirSync(accord/)`.** An empty sandbox has no `accord/` folder, so "write a sentinel config.yml by hand" needs the folder created first; this is test mechanics, not a behaviour choice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's `pkg` import specifier does not resolve from `commands/`**

- **Found during:** Task 1
- **Issue:** The action says to import `pkg` with `import pkg from '../package.json' with { type: 'json' };` "exactly as `run.ts:9` and `pin.ts:6` do". Those two files live in `packages/cli/src/`, so `'../package.json'` is the CLI manifest for them. `commands/init.ts` is one directory deeper, where the same specifier resolves to `packages/cli/src/package.json`, which does not exist.
- **Fix:** Used `'../../package.json'`. The object and the import attribute are otherwise identical to the cited precedents.
- **Files modified:** `packages/cli/src/commands/init.ts`
- **Verification:** `npm run typecheck` clean; `packages/cli/test/init.test.ts#pins the running CLI version, exactly (D-135)` passes, which is the case that would fail if the wrong manifest were read.

**2. [Rule 3 - Blocking] A literal command inventory in `skill-commands.test.ts` went stale the moment `init` was registered**

- **Found during:** Task 3 (full `npm test`)
- **Issue:** `07-PATTERNS.md` states that adding a command "automatically widens that allowlist — no test edit needed". That is true of the SKILL-08 scan, which reads `REAL` off the commander tree, but `skill-commands.test.ts:91` additionally pins `REAL` against a literal array as a guard-the-guard. Registering `init` turned it red: expected 6 paths, received 7.
- **Fix:** Added `'init'` to the expected array, in sorted position. Nothing else in the file changed; the assertion still fails if a command silently disappears, which is what it is for.
- **Files modified:** `packages/cli/test/skill-commands.test.ts`
- **Verification:** `npm test` — 34 files, 811 passed, 0 failed.

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking).
**Impact on plan:** Both are one-line corrections to plan/pattern text that was slightly wrong about the existing code. No behaviour changed, no scope added.

## Findings

**F-1 — the `actuals.tokens` figure and the plan's `estimate.tokens` are not on the same scale.** The realized diff is ~27,000 characters, which is ~6,800 tokens on the `chars/4` scale the SUMMARY contract specifies. The plan's `estimate: 62000` is roughly 9x that. Recorded honestly rather than rounded toward the estimate; if the estimator is measuring context consumed rather than diff size, the two numbers should not be compared at all, and the estimator's scale is worth settling before it calibrates anything.

**F-2 — plan verification item 4 cannot be checked literally in this working tree.** It asks that `git status --porcelain packages/core/src/generated` be empty. It is not: `templates.ts` is modified and `skills.ts` is untracked, both from Phase 6's uncommitted work, which was already present when this plan started. The claim the item is making — *this plan regenerates nothing* — holds: no generator was run and neither generated file was touched.

**F-3 — `init` at `accord/config.yml` has no link case of its own.** `assertNoLink` is proven by the existing `skills-sync.test.ts` junction and symlink cases, which still pass against the moved function, but nothing drives a link at the path `init` actually writes. A later plan in this phase (more artifacts, more directories) is the natural place for one. Recorded as coverage D8 with `human_judgment: true` rather than claimed as covered.

## Known Stubs

None. `initFiles` returns one real entry; nothing in this plan returns a placeholder or an empty value that reaches output.

## Issues Encountered

None beyond the two deviations. The tracer's end-to-end check in a real throwaway repository worked on the first run: `created accord/config.yml`, then `skipped accord/config.yml`, then `accord lint` reporting `0 errors, 0 warnings`.

## Verification Results

Run from the repository root, Windows, Node 24:

| Check | Result |
|---|---|
| `npm run build` | clean (core 141.61 kB, cli 26.98 kB) |
| `npm run lint` | clean, exit 0 |
| `npm run typecheck` | clean, exit 0 (core, core tests, cli) |
| `npm test` | **34 files, 811 tests, 811 passed, 0 failed** (baseline was 32 files / 794 tests; +2 files, +17 cases) |
| `node packages/cli/dist/cli.js --help` | lists `init` first, before `lint` |
| `git init -q` + `accord init` in a throwaway directory | `created accord/config.yml`; second run `skipped accord/config.yml`; `accord lint` then reports `0 errors, 0 warnings` |
| `git status --porcelain packages/core/src/generated` | non-empty — pre-existing Phase 6 work only, see F-2 |

## Self-Check: PASSED

All five created files exist on disk; all five modified files carry the described change. No commit hashes to verify — commits are forbidden in this project until the owner approves the diff, so the whole plan is in the working tree.

## User Setup Required

None. No external service, no new dependency, no environment variable.

## Next Phase Readiness

- **07-02, 07-03, 07-04 expand along this spine.** Each is a matter of adding entries to the list `initFiles` returns; the write loop, the report, the link guard and both test files already iterate the whole list rather than a named path, so a new entry inherits every gate the moment it lands.
- **`initFiles` already accepts `name`,** so plan 03's `npx --yes <name>@<version>` workflow line needs no signature change.
- **D-131 is untouched.** When `init` puts skill copies in place it must call the `skills sync` path rather than route them through `initFiles` — the two write contracts are opposite and the `ScaffoldFile`/`SkillFile` split in the barrel is what keeps that visible.
- **Open, carried into the phase:** WINDOWS.md entry 8 (this plan's cases are Windows-observed only), entry 6 (SKILL-04, owed to 07-05), entry 7 (the POSIX link leg).

---
*Phase: 07-scaffolding-and-example-repo*
*Completed: 2026-09-17*
