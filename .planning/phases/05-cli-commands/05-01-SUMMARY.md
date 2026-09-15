---
phase: 05-cli-commands
plan: 01
subsystem: cli
tags: [commander, cli, exit-codes, styleText, version-pin, git, vitest]

# Dependency graph
requires:
  - phase: 02-core-model-and-loading
    provides: "`loadFromFs(root)`, `UsageError` with `exitCode = 2`, and the `git ls-files` spawn shape copied by `repoRoot`"
  - phase: 03-lint
    provides: "`lintSnapshot`, `LintResult`, and the colour-free `renderText` the CLI wraps but never re-implements (D-56, D-58, D-60)"
provides:
  - "`runCli(argv, {cwd, stdout, stderr, env})` — the commander spine, one shared `preflight`, and the 0/1/2 exit map every later command in this phase reuses"
  - "`repoRoot(cwd)` — `git rev-parse --show-toplevel`, so every command works from any subdirectory (D-103)"
  - "`pinMessage(pinned, running)` — the pure, exact-string version pin, reusable by the Phase 8 host (D-94)"
  - "`accord lint [--json]` end to end: text through `renderText` + `styleText`, JSON as the bare `LintResult` (D-98)"
  - "`colourFindings(text, stream)` — the one place colour is applied in the CLI"
  - "`makeRepo` / `cleanup` / `run` — the sandbox git repository and in-process CLI harness every later CLI test builds on"
  - "A positive spawn allowlist over `packages/cli/src` and the no-backslash output invariant, both enforced by a test (CLI-07)"
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 06-skills, 07-scaffolding, 08-mcp]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff).
actuals:
  tokens: 6311
  tasks: 3
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One `preflight` per command: resolve the git root, load the snapshot, check the pin — the pipeline every later command in this phase reuses unchanged"
    - "Exit mapping lives entirely in `runCli`'s catch; a command body returns 0 or 1 and never touches `process`"
    - "Guards written as positive allowlists over files enumerated from disk, so a new source file is covered the moment it is added"

key-files:
  created:
    - packages/cli/src/run.ts
    - packages/cli/src/root.ts
    - packages/cli/src/pin.ts
    - packages/cli/src/commands/lint.ts
    - packages/cli/src/render/color.ts
    - packages/cli/test/helpers/repo.ts
    - packages/cli/test/cli.test.ts
    - packages/cli/test/pin.test.ts
    - packages/cli/test/spawn-surface.test.ts
  modified:
    - packages/cli/src/index.ts
    - packages/cli/test/bin.test.ts
    - .claude/CLAUDE.md

key-decisions:
  - "A commander refusal that is not `--version` or `--help` returns exit 2, not commander's own exit 1, because exit 1 is reserved for a lint or gate verdict (STACK Decision 1). The plan text said `its exitCode or 2`; see Findings"
  - "The pin is checked only when `snapshot.config` is defined, so a missing or schema-invalid `config.yml` reports its schema findings through lint (exit 1) instead of a pin error (exit 2)"
  - "`colourFindings` styles only the `error`/`warning` token that follows the `file[:line]: ` prefix and passes the target stream to `styleText`, so Node's own `validateStream` decides whether an escape is emitted"
  - "`index.ts` assigns `process.exitCode` via top-level await and never calls `process.exit`, so a pending stdout write cannot be truncated"
  - "The in-process `run(argv, cwd)` harness lives beside `makeRepo` in `test/helpers/repo.ts` rather than being copied into three test files"
  - "Only CLI-06 is ticked in REQUIREMENTS.md; CLI-05 and CLI-07 span later plans in this phase and would be false to close on `lint` alone"

patterns-established:
  - "Command shape: `(ctx: CommandContext, options) => number`. The command calls one pure core function, writes to `ctx.stdout`, and returns an exit code; every impure concern is already resolved by `preflight`"
  - "Spawn allowlist test: read every `.ts` under `src`, blank whole-line comments so line numbers survive, balance the parentheses of each spawn call, and assert the first argument is a string literal from a two-name set"
  - "Guard the guard: a test that asserts an absence (`no backslash`, `no ANSI`) first asserts the output actually contains the thing being checked, so it cannot pass vacuously"

requirements-completed: [CLI-06]

coverage:
  - id: D1
    description: "`accord lint` runs end to end from a repository root and from any subdirectory, in text and in JSON, with the 0/1/2 exit contract"
    requirement: CLI-05
    verification:
      - kind: integration
        ref: "packages/cli/test/cli.test.ts#exits 0 and writes the renderText body for a repository with no error finding"
        status: pass
      - kind: integration
        ref: "packages/cli/test/cli.test.ts#exits 1 when the lint result carries an error finding (D-56)"
        status: pass
      - kind: integration
        ref: "packages/cli/test/cli.test.ts#is byte-identical from a subdirectory of the repository (D-103)"
        status: pass
      - kind: integration
        ref: "packages/cli/test/cli.test.ts#exits 2 outside a git repository"
        status: pass
      - kind: integration
        ref: "packages/cli/test/cli.test.ts#exits 2 in a git repository with no accord/ folder, with the loader message"
        status: pass
    human_judgment: false
  - id: D2
    description: "`--json` writes the core `LintResult` verbatim with no envelope, so `.findings` is read with no unwrapping (D-98)"
    requirement: CLI-05
    verification:
      - kind: integration
        ref: "packages/cli/test/cli.test.ts#--json writes the LintResult verbatim, with no wrapper key (D-98)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A version mismatch stops every repository-reading command with exit 2 and a message naming both versions and the fix, with no bypass; `--version` still works under the same mismatch"
    requirement: CLI-06
    verification:
      - kind: unit
        ref: "packages/cli/test/pin.test.ts#names the pinned version, the running version, and the fix command"
        status: pass
      - kind: unit
        ref: "packages/cli/test/pin.test.ts#compares exact strings, never semver (D-94)"
        status: pass
      - kind: integration
        ref: "packages/cli/test/pin.test.ts#stops lint with exit 2 and writes nothing to stdout"
        status: pass
      - kind: integration
        ref: "packages/cli/test/pin.test.ts#still answers --version under a mismatch (D-95)"
        status: pass
      - kind: integration
        ref: "packages/cli/test/pin.test.ts#reports schema findings rather than a pin error when config.yml fails the schema"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every spawn site under `packages/cli/src` names `git` or `gh` as a string literal and passes no shell option, and no printed path carries a backslash"
    requirement: CLI-07
    verification:
      - kind: unit
        ref: "packages/cli/test/spawn-surface.test.ts#spawns only git and gh, named as a string literal (T-05-01)"
        status: pass
      - kind: unit
        ref: "packages/cli/test/spawn-surface.test.ts#passes no shell option to any spawn site"
        status: pass
      - kind: integration
        ref: "packages/cli/test/spawn-surface.test.ts#contain no backslash on any host (D-51, PITFALLS section 12)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The built `dist/cli.js` keeps its shebang and runs under `process.execPath` with no shell and no package-manager spawn"
    requirement: CLI-07
    verification:
      - kind: e2e
        ref: "packages/cli/test/bin.test.ts#starts with a shebang"
        status: pass
      - kind: e2e
        ref: "packages/cli/test/bin.test.ts#runs under process.execPath and lists the lint command"
        status: pass
      - kind: e2e
        ref: "packages/cli/test/bin.test.ts#--version prints the version"
        status: pass
    human_judgment: false
  - id: D6
    description: "`.claude/CLAUDE.md` STACK Decision 6's Version pin row now states D-94's hard refusal instead of the profile-dependent warning it contradicted"
    verification:
      - kind: other
        ref: "grep -c 'D-94' .claude/CLAUDE.md -> 1; grep -c 'warn (build profile)' -> 0"
        status: pass
    human_judgment: true
    rationale: "Whether the rewritten row reads correctly and cites the right decisions is an editorial judgement the owner makes; the grep only proves the old clause is gone."

# Metrics
duration: 25 min
completed: 2026-09-15
status: complete
---

# Phase 5 Plan 01: The CLI Spine on `accord lint` Summary

**One command proves the whole pipeline: `git rev-parse` root resolution, `loadFromFs`, the version pin, a pure core call, a printer, and an exit code — so the remaining four commands in this phase are additive rather than architectural.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 of 3
- **Files created:** 9
- **Files modified:** 3

## Accomplishments

- **The spine (`packages/cli/src/run.ts`).** `runCli(argv, {cwd, stdout, stderr, env})` builds a commander program with `.exitOverride()` and `.configureOutput({writeOut, writeErr})` bound to the injected streams, so nothing reaches `process.stdout` or `process.stderr` from a test. One private `preflight(opts)` runs `repoRoot` -> `loadFromFs` -> `loadSnapshot` -> the pin check and returns the `CommandContext`; every command action calls it exactly once. `--version` and `--help` are answered by commander before any action runs, so D-95's exemption holds by construction rather than by remembering.
- **Root resolution (`packages/cli/src/root.ts`, D-103).** `git rev-parse --show-toplevel` with the `gitTree` spawn shape copied verbatim — `git` by name, a literal argument array, `stdio: ['ignore','pipe','pipe']`, no shell option — and the same git-not-on-PATH sentence, so the two sites cannot drift. Output is trimmed and posix-normalised. Proven by a test asserting that `lint` run from `<repo>/src` produces byte-identical stdout to `lint` run from the repository root.
- **The printer (`packages/cli/src/render/color.ts`, D-60).** `colourFindings` takes finished `renderText` output and styles only the level token that follows the `file[:line]: ` prefix, via `styleText(..., { stream })`. Core's renderer is called, never re-implemented; the summary line never matches the prefix pattern, so it stays uncoloured. Because Node's own `validateStream` decides, a `PassThrough` or a redirected pipe gets no escape sequence for free — asserted directly (T-05-03).
- **The command (`packages/cli/src/commands/lint.ts`).** One `lintSnapshot` call. `--json` writes `JSON.stringify(result, null, 2)` plus a newline and nothing else — the bare `LintResult`, no envelope, no wrapper key, so `jq '.findings[]'` needs no unwrapping (D-98). Returns 1 when `result.errors > 0`, else 0 (D-56).
- **The version pin (`packages/cli/src/pin.ts`, D-94).** `pinMessage(pinned, running)` is `===` on two strings — no semver library, no range, no tolerance, no case folding — returning `config.yml pins accord <pinned>, running <running> - run: npx --yes <name>@<pinned>`. `running` is a parameter, not a read of `pkg.version`, so the Phase 8 host reuses it unchanged and a test can drive a mismatch without rewriting `package.json`. There is no flag and no environment variable that skips it.
- **The CLI-07 guards (`packages/cli/test/spawn-surface.test.ts`).** A positive allowlist over every `.ts` file under `packages/cli/src`, enumerated from disk: each spawn call's parentheses are balanced and its first argument must be a string literal drawn from `{git, gh}`, and no spawn site may carry a `shell` key. The failure message names the offending file and line. A second case drives real `runCli` stdout and asserts no `\` appears.
- **The entry (`packages/cli/src/index.ts`).** Line 1 is still exactly `#!/usr/bin/env node`; the placeholder that printed the schema ids is gone. The body assigns the resolved exit code to `process.exitCode` and never calls `process.exit`, so a pending stdout write cannot be truncated.
- **Green.** `npm run build && npm run lint && npm run typecheck && npm test` all exit 0. **24 test files, 613 tests, all passing** — up from the 21 files / 592 tests baseline, with 21 new cases and no pre-existing test changed in meaning.

## Task Commits

**None.** This project forbids commits (user global CLAUDE.md critical rule; project memory `accord-solo-no-prs`, and the executing agent's own explicit instruction). Every file from this plan is left uncommitted in the working tree for the author to review alongside the uncommitted Phase 4 work already there. `git rev-parse HEAD` is `97a7977174efa56e1d98594355d15a46af50a8b9`, unchanged from before this plan started, and nothing was staged. `commits: 0` in the frontmatter is a correct reading of a deliberate no-commit policy, not an uncommitted-work warning.

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | `accord lint` end to end — commander spine, root resolution, printer, exit codes | uncommitted (project policy) | `src/root.ts`, `src/run.ts`, `src/render/color.ts`, `src/commands/lint.ts`, `src/index.ts`, `test/helpers/repo.ts`, `test/cli.test.ts`, `test/bin.test.ts` |
| 2 | The version pin — exact-string refusal, exit 2, and the stack-doc correction | uncommitted (project policy) | `src/pin.ts`, `src/run.ts`, `test/pin.test.ts`, `.claude/CLAUDE.md` |
| 3 | CLI-07 guards — spawn allowlist and the no-backslash path invariant | uncommitted (project policy) | `test/spawn-surface.test.ts` |

## Files Created/Modified

**CLI source**
- `packages/cli/src/run.ts` (new, 89 lines) — `RunOptions`, `CommandContext`, `preflight`, `runCli`, the `lint` command registration, and the whole exit map.
- `packages/cli/src/root.ts` (new, 27 lines) — `repoRoot(cwd)`.
- `packages/cli/src/pin.ts` (new, 17 lines) — `pinMessage(pinned, running)`.
- `packages/cli/src/commands/lint.ts` (new, 15 lines) — `lint(ctx, options)`.
- `packages/cli/src/render/color.ts` (new, 21 lines) — `colourFindings(text, stream)`.
- `packages/cli/src/index.ts` (rewritten, 12 lines) — shebang, `runCli`, `process.exitCode`.

**CLI tests**
- `packages/cli/test/helpers/repo.ts` (new, 49 lines) — `makeRepo(fixture)`, `cleanup(dir)`, `run(argv, cwd)`. The `gitIn` guard is copied verbatim from `test/load.test.ts`: it throws unless the target is a throwaway sandbox under the OS temp directory, so a forgotten `cwd` cannot run git against the author's working tree inside a green test run.
- `packages/cli/test/cli.test.ts` (new, 10 cases) — every line of Task 1's behavior block plus the three argument-handling cases.
- `packages/cli/test/pin.test.ts` (new, 7 cases) — all four `pinMessage` cases and all three `runCli` cases from Task 2's behavior block.
- `packages/cli/test/spawn-surface.test.ts` (new, 4 cases) — the allowlist, the no-shell rule, a non-vacuity check, and the no-backslash invariant.
- `packages/cli/test/bin.test.ts` (modified) — the `is built` and shebang cases are unchanged; the placeholder output test is now `--help` under `process.execPath` asserting the output names `lint`, and the existing `--version` case stays.

**Documentation**
- `.claude/CLAUDE.md` — STACK Decision 6's "Version pin" row rewritten to D-94: a hard refusal on every repository-reading command, exit 2, both versions and the fix command named, exact string equality, no bypass flag and no environment variable, `--version` and `--help` exempt. The row cites D-94 and D-95 and records that PITFALLS section 11's "(or warns, per profile)" parenthetical is superseded. Nothing else in that table changed.

## Verification

Run from `C:/Work/accord`, all four green:

```
npm run build      -> exit 0 (core dts + dist/cli.js 8.03 kB)
npm run lint       -> exit 0 (eslint, no output)
npm run typecheck  -> exit 0 (three tsc projects)
npm test           -> 24 test files, 613 tests, all passed
```

Baseline before this plan was 21 files / 592 tests. Delta: +3 files, +21 tests (10 `cli.test.ts`, 7 `pin.test.ts`, 4 `spawn-surface.test.ts`). `bin.test.ts` keeps its 4 cases with one rewritten. No pre-existing test failed at any point, and none was weakened.

Acceptance-criteria greps:

```
head -1 packages/cli/src/index.ts     -> #!/usr/bin/env node
grep -c schemaIds packages/cli/src/index.ts  -> 0
grep -c 'D-94' .claude/CLAUDE.md      -> 1
grep -c 'Version pin' .claude/CLAUDE.md -> 1
grep -c 'warn (build profile)' .claude/CLAUDE.md -> 0
```

The built binary was also smoke-tested by hand, outside vitest: `node packages/cli/dist/cli.js lint` in the accord repository prints `no accord/ folder in C:/Work/accord` and exits 2 (forward slashes on Windows); the same binary in a sandbox copy of `valid-build` exits 0 with three warnings; and `lint --json` from that sandbox's `src/` subdirectory emits a top-level `findings` array.

### The allowlist guard was proven to fail

An assertion that only ever passes is not a guard. A throwaway `packages/cli/src/__probe.ts` containing `spawnSync(bin, ['install'], { shell: true })` and `spawnSync('npx', ['--yes','x'])` was added, the suite run, and the probe deleted. Both assertions failed as intended and named the offender:

```
x spawns only git and gh, named as a string literal (T-05-01)
  + "__probe.ts:3: bin, ['install'], { shell: true }"
  + "__probe.ts:4: 'npx', ['--yes', 'x']"
x passes no shell option to any spawn site
  + "__probe.ts:3"
```

So the allowlist catches a variable first argument, a non-allowlisted literal, and a `shell` option, and reports file and line. The probe file is gone; `git status` shows no trace of it.

## Deviations from Plan

### 1. [Rule 1 - Contract conflict] A bad argument exits 2, not commander's 1

- **Found during:** Task 1, writing the exit map in `runCli`.
- **Issue:** The plan's action text says "any other `CommanderError` returns its `exitCode` or 2". Commander sets `exitCode = 1` on every error path (`commander.unknownCommand`, `commander.unknownOption`, `commander.missingArgument`, and the rest), so that rule yields exit 1 for a mistyped command. STACK Decision 1 — cited by this phase's own CONTEXT as canonical — puts "bad args" at exit 2 and reserves exit 1 for "Gate FAIL or lint errors". A CI script that branches on 1 would read `accord lnit` as "lint found errors".
- **Fix:** `commander.version` and `commander.helpDisplayed` return 0; every other `CommanderError` returns 2. The comment in `run.ts` records why.
- **Files modified:** `packages/cli/src/run.ts`; asserted by `cli.test.ts#exits 2 on an unknown command`.
- **Commit:** uncommitted (project policy).
- **Needs a ruling:** see Findings 1 below.

### 2. [Rule 3 - Blocking] `pin.ts` was written during Task 1, not Task 2

- **Found during:** Task 1.
- **Issue:** Task 1's action instructs `preflight` to call `pinMessage` ("Task 2 supplies `pinMessage`; call it here"), but Task 1's verify runs `npm run build` and `npm run typecheck`, which cannot pass while the module is missing.
- **Fix:** `packages/cli/src/pin.ts` was created with Task 1 so every task boundary is independently green. Task 2 then added `pin.test.ts` and the `.claude/CLAUDE.md` correction. No content differs from what Task 2 specifies. Since nothing is committed, the ordering is cosmetic.
- **Files modified:** `packages/cli/src/pin.ts`, `packages/cli/src/run.ts`.
- **Commit:** uncommitted (project policy).

### 3. [Rule 2 - Reuse over duplication] `run()` lives in the shared test helper

- **Found during:** Task 1.
- **Issue:** The plan's artifact list names `makeRepo` and `cleanup` as the helper's exports. The in-process `runCli` harness (PassThrough streams, explicit `cwd`, synchronous `read()`) is needed identically by `cli.test.ts`, `pin.test.ts`, and `spawn-surface.test.ts`.
- **Fix:** `run(argv, cwd)` is exported from `packages/cli/test/helpers/repo.ts` beside `makeRepo`, rather than copied three times. One extra export, three fewer copies.
- **Files modified:** `packages/cli/test/helpers/repo.ts`.
- **Commit:** uncommitted (project policy).

### 4. [Scope] Only CLI-06 was ticked in REQUIREMENTS.md

- **Found during:** state update.
- **Issue:** The plan frontmatter lists `requirements: [CLI-05, CLI-06, CLI-07]`, and the executor protocol marks all of them complete. CLI-05 is "`lint`, `gate ready <id>`, `gate done <id>`, `status` with `--json`" — this plan delivers one of four. CLI-07 covers the whole command surface on both operating systems. Plans 05-02, 05-03, 05-04, and 05-06 carry the same ids.
- **Fix:** `CLI-06` ticked in both the checklist and the traceability table; `CLI-05` and `CLI-07` left `Pending` for the plan that actually closes them. `requirements-completed` in this SUMMARY's frontmatter reflects that.
- **Files modified:** `.planning/REQUIREMENTS.md`.
- **Commit:** uncommitted (project policy).

## Findings / assumptions needing a decision

**1. Exit code for a bad argument (needs a ruling; implemented as 2).** See Deviation 1. `accord nope`, `accord --nosuch`, and bare `accord` all return 2 today, with commander's message on stderr. The alternative — passing commander's own 1 through, as the plan's literal wording says — collapses "you typed the command wrong" into the same code as "lint found errors". I took exit 2 because STACK Decision 1 names "bad args" under exit 2 explicitly, and because the CLI's whole value is that a machine can branch on its exit code. If you want commander's 1 instead, it is a one-line change in `run.ts`'s catch plus one assertion in `cli.test.ts`. **This is the only decision in this plan I would not want to leave implicit.**

**2. Bare `accord` with no arguments prints help to stderr and exits 2.** That is commander's own default for a program with subcommands and no action handler (`help({ error: true })`), reaching my exit map as a non-help CommanderError. Neither the plan nor 05-CONTEXT specifies it. The alternative reading — bare `accord` is a request for help, so print to stdout and exit 0 — is also defensible and would need `program.addHelpCommand`-style wiring or an explicit no-args branch. Not built; flagging it.

**3. The three plan-flagged `unclassified` assumptions were all implemented as the plan assumed, and all three now have tests.** `--json` is a per-command boolean flag (not global) whose body is `JSON.stringify(result, null, 2)` plus a newline (CLI-05); the pin is checked only when `snapshot.config` is defined, so a schema-invalid `config.yml` exits 1 with its findings rather than 2 (CLI-06); and CLI-07 is enforced as a positive allowlist over the spawn sites. Nothing here needs a decision unless you disagree with one of those three readings.

**4. `repoRoot` cannot distinguish "git is missing" from "cwd does not exist".** Both surface as `ENOENT` from `execFileSync`, so a non-existent `cwd` would be reported as "git is required but was not found on PATH". `packages/cli/src/load/fs.ts` has had the same behaviour since Phase 2 and the plan asks for that shape verbatim, so it was not changed. In practice `cwd` comes from `process.cwd()`, which always exists. Noted, not fixed.

## Threat surface

No new surface beyond the plan's `<threat_model>`. T-05-01 (spawn) and T-05-03 (colour/escape leakage) are now covered by assertions rather than by convention; T-05-02 (pin bypass) is covered by `pin.test.ts` plus the absence of any flag or environment variable that reaches the check. T-05-04 remains accepted: `execFileSync` inherits no timeout, so a hung `git` blocks the CLI. This plan adds no dependency (T-05-SC).

## Known Stubs

None. Every symbol this plan introduces is fully implemented and exercised by a test. `RunOptions.env` is declared and threaded into `CommandContext` but is not yet read by any command — that is deliberate per the plan, so adding the tracker adapter in 05-06 does not reopen `run.ts`.

## Self-Check: PASSED

All 13 files this plan claims exist on disk. No commits were made: `git rev-parse HEAD` is
`97a7977174efa56e1d98594355d15a46af50a8b9`, the value it held when the plan started, and
`git diff --cached --quiet` exits 0, so nothing is staged either. The throwaway `__probe.ts`
used to prove the allowlist fails is gone from the working tree.

Commit hashes are not verified because none exist by design — see **Task Commits** above.
