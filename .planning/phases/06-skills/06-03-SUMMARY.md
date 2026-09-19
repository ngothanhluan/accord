---
phase: 06-skills
plan: 03
subsystem: skills
tags: [commander, vitest, guards, cross-platform, orphan-report, version-pin]

# Dependency graph
requires:
  - phase: 06-skills
    plan: 01
    provides: "`skillTargets`/`renderSkill`/`contentHash`/`markerHash`/`withoutMarker`, `accord skills sync` and its four-state compare-then-write body, the sandbox sync test file"
  - phase: 06-skills
    plan: 02
    provides: "the `dev` definition and its four bundled files — the first render output with enough command mentions for the SKILL-08 scan to be non-vacuous"
  - phase: 05-cli-commands
    provides: "`runCli`, `preflight` (root -> snapshot -> pin, D-95), `UsageError`/exit 2, `spawn-surface.test.ts`'s printed-path loop, the `makeRepo`/`run` sandbox helpers"
provides:
  - "`buildProgram(opts, setCode)` exported from `packages/cli/src/run.ts` — the commander tree as an object a test can walk"
  - "the SKILL-08 / D-110 command scanner: no rendered file may name an `accord` command the CLI does not register, and a command added later is covered without editing the test"
  - "`skillDirs(config)` on the core public API — the declared target directories, independent of what renders"
  - "the D-113 orphan report on stderr, D-123-scoped to `accord-*`, deleting nothing and changing no exit code"
  - "`updated`, `overwrote local edits` (twice: hash differing, hash absent), the D-121 pin refusal, and the no-config refusal, each proved against a real sandbox"
  - "`skills sync` inside the Windows printed-path invariant, plus an ASCII invariant over its own output"
affects: [06-04, 07-init]

actuals:
  tokens: 10800
  tasks: 3
  commits: 0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a guard reads the production object it guards (`buildProgram`), never a literal restatement of it"
    - "a command mention is only a command when it is inside code formatting; prose naming the product is prose"
    - "an invariant that quotes user content (lint, gate) cannot be asserted as ASCII; one that prints only accord's own text can"

key-files:
  created:
    - packages/cli/test/skill-commands.test.ts
  modified:
    - packages/cli/src/run.ts
    - packages/cli/src/commands/skills.ts
    - packages/cli/test/skills-sync.test.ts
    - packages/cli/test/spawn-surface.test.ts
    - packages/core/src/skills/targets.ts
    - packages/core/src/index.ts

key-decisions:
  - "The scanner reads command mentions from inline code spans and fenced blocks only. `shared/prototype.md:30` says \"the header accord ships\" in a heading — English, not a command — and every real invocation in every definition is already inside backticks, because that is how a command is written in Markdown."
  - "A commander node with subcommands is not a command path of its own. `accord gate` runs nothing and prints help, so a skill naming it is naming something the reader cannot run. Leaf-ness is `child.commands.length === 0`, not a read of commander's private `_actionHandler`."
  - "An orphan is an `accord-<name>` directory whose `<name>` is not in `roles:` — the declaration D-113 names — not one absent from the render output. A declared role whose workflow has not been authored yet (`ba`, today) is a role waiting for its definition, not an orphan. This is 06-01 finding 4 answered."
  - "`skillDirs(config)` was added to core rather than deriving the target directories from `skillTargets()` paths: a roster whose every role is unauthored renders nothing and must still be able to report a directory a previous roster left behind."
  - "The removal command in the orphan line is `rm -rf <path>`. Flagged below — it is a POSIX idiom on a project whose author develops on Windows."
  - "The ASCII invariant lives in `skills-sync.test.ts`, not in `spawn-surface.test.ts`'s shared loop, because `lint` and `gate` quote ticket text and are only as ASCII as the repository they read. See deviation 1."
  - "No reverse assertion (\"every registered command appears in some rendered file\"). The plan forbids it and gives the reason: it is false by construction for `skills sync`, and for `new ticket`/`status` until 06-04 lands in this same wave."

requirements-completed: [SKILL-08]

coverage:
  - id: D1
    description: "No rendered file — `SKILL.md` or bundled reference — names an `accord` command the CLI does not register, for the full roster and for the roster this repository declares"
    requirement: SKILL-08
    verification:
      - kind: unit
        ref: "packages/cli/test/skill-commands.test.ts#names no command the CLI does not register"
        status: pass
      - kind: other
        ref: "mutation: `accord gate readdy` in dev/SKILL.md — both rendered copies reported by path and line"
        status: pass
    human_judgment: false
  - id: D2
    description: "The real command paths are read off the same commander tree `runCli` parses with, so a command added later cannot escape the scan"
    requirement: SKILL-08
    verification:
      - kind: unit
        ref: "packages/cli/test/skill-commands.test.ts#reads the real paths off the commander tree the CLI runs"
        status: pass
      - kind: other
        ref: "mutation: rename `skills` in buildProgram — the path-set equality fails naming `skills sync`"
        status: pass
    human_judgment: false
  - id: D3
    description: "A namespace with no action of its own (`gate`, `new`, `skills`) is not a valid path; only a full registered path passes"
    requirement: SKILL-08
    verification:
      - kind: unit
        ref: "packages/cli/test/skill-commands.test.ts#treats a namespace with no action of its own as not a command"
        status: pass
    human_judgment: false
  - id: D4
    description: "The scan is not vacuous: at least one file scanned and at least one command mention found, asserted per roster"
    requirement: SKILL-08
    verification:
      - kind: unit
        ref: "packages/cli/test/skill-commands.test.ts#has files to scan / found at least one command mention"
        status: pass
    human_judgment: false
  - id: D5
    description: "An intact copy behind the definition reports `updated` and is rewritten to the fresh render; every other file still reads `unchanged`"
    requirement: CLI-08
    verification:
      - kind: integration
        ref: "packages/cli/test/skills-sync.test.ts#rewrites an intact copy that is behind the definition, and calls it updated"
        status: pass
    human_judgment: false
  - id: D6
    description: "A hand-edited copy — marker hash differing, or marker absent — reports `overwrote local edits`, is rewritten, and the run still exits 0"
    requirement: CLI-08
    verification:
      - kind: integration
        ref: "packages/cli/test/skills-sync.test.ts#overwrites an appended line and an untouched marker / no marker line at all"
        status: pass
    human_judgment: false
  - id: D7
    description: "An `accord-*` directory no longer declared by `roles:` is named on stderr with the command to remove it, is not deleted, is not named on stdout, and does not change the exit code"
    requirement: CLI-08
    verification:
      - kind: integration
        ref: "packages/cli/test/skills-sync.test.ts#names an undeclared accord-* directory on stderr, deletes nothing, and still exits 0"
        status: pass
      - kind: other
        ref: "mutation: silence the orphan report — the case fails on an empty stderr"
        status: pass
    human_judgment: false
  - id: D8
    description: "A directory that is not `accord-*` is never read about, counted, or named (D-123); a roster with no orphans prints an empty stderr"
    verification:
      - kind: integration
        ref: "packages/cli/test/skills-sync.test.ts#never names a directory it did not generate (D-123)"
        status: pass
      - kind: integration
        ref: "packages/cli/test/skills-sync.test.ts#reports nothing when every accord-* directory is still declared"
        status: pass
    human_judgment: false
  - id: D9
    description: "A config pinned to another version exits 2 naming both versions, and the sorted listing of both target directories is identical before and after; a repository with no `accord/` folder exits 2 and writes nothing"
    requirement: CLI-08
    verification:
      - kind: integration
        ref: "packages/cli/test/skills-sync.test.ts#exits 2 on a pin mismatch and writes nothing at all (D-121, D-95)"
        status: pass
      - kind: integration
        ref: "packages/cli/test/skills-sync.test.ts#exits 2 in a repository with no accord/ folder and writes nothing"
        status: pass
    human_judgment: false
  - id: D10
    description: "`skills sync` is inside the printed-path backslash loop with a guard string the command genuinely prints against `valid-build`, and every byte of its own stdout and stderr is ASCII"
    requirement: CLI-08
    verification:
      - kind: integration
        ref: "packages/cli/test/spawn-surface.test.ts#accord skills sync prints no backslash on any host"
        status: pass
      - kind: integration
        ref: "packages/cli/test/skills-sync.test.ts#prints no backslash and nothing outside ASCII on any host"
        status: pass
    human_judgment: false

# Metrics
duration: 13 min
completed: 2026-09-16
status: complete
---

# Phase 6 Plan 3: The Guards Summary

**The commander tree is now an object rather than a closure, so the SKILL-08 scanner reads the six real command paths off the same registry `runCli` parses with — and a misspelled `accord gate readdy` in any rendered file, `SKILL.md` or bundled reference, fails CI by path and line; alongside it the three sync states the tracer never reached, an orphan report that names a stale directory and refuses to delete it, and a pin refusal proved to write nothing at all.**

## Performance

- **Duration:** 13 min
- **Tasks:** 3
- **Files:** 1 created, 6 modified

## Accomplishments

- **A skill can no longer name a command that does not exist, and a command added in Phase 7 cannot escape the scan.** `buildProgram(opts, setCode)` is exported from `run.ts` and the test walks it; the path set is `['gate done', 'gate ready', 'lint', 'new ticket', 'skills sync', 'status']` and the namespaces `gate`, `new`, `skills` are absent from it — the distinction RESEARCH.md Pitfall 2 says a flat regex over `.command('...')` literals cannot make.
- **Both negative checks were performed by hand, as the plan's `<verification>` requires.** A guard nobody has seen fail is a guard nobody has tested: `accord gate readdy` in `dev/SKILL.md` produced `.agents/skills/accord-dev/SKILL.md:15: accord gate readdy` and `.claude/...:15: ...` as a sorted two-element offender array; renaming `skills` in `buildProgram` failed the path-set equality naming `skills sync`. Both reverted, both re-verified green.
- **D-112's four states are now all exercised against real sandboxes.** `updated` needed a file built deliberately — text edited *and* the marker re-hashed over it, the only state a newer definition produces — and the test says so in a comment, because a reader would otherwise assume it fell out of an ordinary edit.
- **The orphan report is scoped exactly as D-123 says and no wider.** It reads `accord-*` directory names, reports `accord-*` directory names, and a directory called `some-other-tool` sitting beside them appears in neither stream. It goes to stderr, like `status`'s advisory, and the exit code stays 0.
- **The pin refusal is asserted as "wrote nothing", not merely "exited 2".** A sorted listing of both target directories before and after is compared; it passes by construction because `preflight` runs first, which is precisely why asserting it is worth the six lines — the construction is what a later refactor would break.

## Task Commits

**Nothing was committed.** The standing project rule leaves work in the working tree for
review, and this run's brief restated the prohibition as absolute. Per-task commits, the
SUMMARY commit, and the tracking-file commit were all deliberately skipped.

- **Task 1: A skill cannot name a command the CLI does not have** — `none (uncommitted per project policy)`
- **Task 2: The three sync states, the orphan report, and the pin refusal** — `none (uncommitted per project policy)`
- **Task 3: `skills sync` joins the Windows printed-path invariant** — `none (uncommitted per project policy)`

**Plan metadata:** `none (uncommitted per project policy)`

`commits: 0` is measured, not narrated: no commit was made, so there is nothing to count.
The full change set is visible with `git status --short` and `git diff`.

## Files Created/Modified

**CLI source**

- `packages/cli/src/run.ts` — `buildProgram(opts, setCode)` extracted and exported; the five action closures now call `setCode(...)` instead of assigning a captured `let`. `runCli`'s signature, its `try`/`catch`, and every exit-code path are unchanged, and `packages/cli/src/index.ts` was not touched.
- `packages/cli/src/commands/skills.ts` — `orphans(root, config)` plus one stderr line per orphan, written after the write loop so a directory this run created is already on disk when it is judged.

**Core**

- `packages/core/src/skills/targets.ts` — `skillDirs(config)` extracted from `skillTargets`'s first line and exported (see deviation 2).
- `packages/core/src/index.ts` — one export added.

**Tests**

- `packages/cli/test/skill-commands.test.ts` — new; 8 cases (the path set, the namespace exclusion, and a guard-the-guard pair plus the offender array per roster).
- `packages/cli/test/skills-sync.test.ts` — 8 new cases: `updated`, two `overwrote local edits` shapes, three orphan cases, and two refusals. The existing backslash case was widened to cover ASCII and stderr.
- `packages/cli/test/spawn-surface.test.ts` — one row: `{ name: 'skills sync', argv: ['skills', 'sync'], guard: '.claude/skills/accord-dev/SKILL.md' }`.

## Decisions Made

- **A command mention is one inside code formatting.** The scanner reads inline code spans and fenced-block lines, not prose. This was forced by a real case, not chosen in the abstract: `shared/prototype.md:30` is the heading "## 2. Start from the header accord ships", where "accord ships" is English. The alternatives were an allowlist of prose words following `accord` (a list that rots) or flagging the heading (rewriting correct prose to satisfy a scanner). Every genuine invocation in all six definitions is already inside backticks.
- **`valid-build` was not extended for Task 3's guard.** The fixture rosters `[ba, dev]` and every runtime, and `dev` has had a definition since 06-02, so `.claude/skills/accord-dev/SKILL.md` is genuinely printed. The plan offered extending the fixture as the fallback; it was not needed.
- **An orphan is judged against `roles:`, not against the render output.** D-113's words are "no longer declared by `roles:` and `runtimes:`". Judging against the render output would report `accord-ba/` as an orphan today — `ba` is declared in every valid config but has no definition until 06-04 lands in this same wave — which is the opposite of what the decision says, and would have gone red for a reason belonging to another plan.
- **`buildProgram` threads the exit code as `setCode` rather than returning it.** Commander actions do not return a value to the parser, so the mutable cell has to leave the function somehow; a callback keeps `runCli`'s `let code = 0` exactly where it was and leaves every other line of the function untouched.

## Deviations from Plan

### Documented deviations from the plan text

**1. `spawn-surface.test.ts` has no ASCII assertion to join, and cannot have one**

- **Found during:** Task 3
- **Issue:** The plan's `read_first` describes `spawn-surface.test.ts:103-122` as "the per-stream backslash **and ASCII** assertions", and Task 3's acceptance criteria and the plan's must-have truths both require an ASCII assertion over `skills sync`'s output. The file carries only the backslash assertion. Adding ASCII to the shared loop was attempted and went red on three existing rows: `accord/tickets/LOGIN-1.md:37: error gate.test-tag-missing scenario "Đăng nhập thành công" carries no @test:<id> tag...` — `lint` and both `gate` commands quote Gherkin scenario titles from the repository they read, so their output is only as ASCII as the user's tickets. A repository-wide ASCII invariant is false by design.
- **Resolution:** The `skills sync` row was added to `COMMANDS` as the plan specifies, so the backslash invariant covers the new command automatically. The ASCII assertion was put where it is true and load-bearing — `skills-sync.test.ts`'s existing backslash case, widened to check both streams for a backslash and for anything outside `\x20-\x7e`, over a run that has an orphan so stderr is non-empty. Every byte `sync` prints is accord's own (a status word, a posix path, the orphan advisory), which is exactly the property D-51 and PITFALLS §12 want asserted, and the reason the marker and status lines use a hyphen rather than a dash.
- **Rejected:** an `ascii?: boolean` opt-in field on the `COMMANDS` rows — a config flag for one row, which is what CLAUDE.md's simplicity rule names.
- **Files modified:** `packages/cli/test/spawn-surface.test.ts` (one row added, nothing else), `packages/cli/test/skills-sync.test.ts`.

**2. The plan's `files_modified` list does not include `packages/core`, and two core files changed**

- **Found during:** Task 2
- **Issue:** The plan scopes itself to `packages/cli` ("All of it lives in `packages/cli`, because the command registry is only reachable from there") and the wave note says 06-03 touches only `packages/cli` while 06-04 touches only `packages/core`. But the orphan scan needs the *declared* target directories, and the runtime-to-directory table is a private constant in `packages/core/src/skills/targets.ts`.
- **Resolution:** `skillDirs(config)` extracted from the first line of `skillTargets` and exported (9 lines including its comment, plus one line in `index.ts`). Deriving the directories from `skillTargets()`'s output paths instead would have needed no core change, but is wrong: a roster whose every role is unauthored renders nothing and would then scan nothing, so an orphan left by a previous roster would go unreported in exactly the repository that most needs to hear about it.
- **Collision risk with 06-04:** low but real — 06-04 also edits `packages/core/src/index.ts` and `packages/core/skills/`. The two edits are one line each in different export blocks.
- **Files modified:** `packages/core/src/skills/targets.ts`, `packages/core/src/index.ts`.

**3. The `git status --porcelain` verify command cannot be green under the no-commit policy**

- **Found during:** Task 2 verification
- **Issue:** `test -z "$(git status --porcelain .claude/skills .agents/skills packages/core/test/fixtures)"` assumes 06-01's and 06-02's new files are committed. Nothing in this phase is.
- **Resolution:** Run and read against its stated intent — "a sync test wrote into the real repository or mutated a shared fixture instead of its sandbox copy". The output is exactly 06-02's own four entries (`D` on the two deleted hand-written skills, `??` on `accord-dev/` and on the `wrong-plan/` fixture) and **nothing else**, before and after the full CLI suite. No sandbox leaked, and no tracked fixture was modified.
- **Files modified:** none.

**4. Task 2's `<action>` says to keep the orphan list "in the same structured result the status lines come from"**

- **Found during:** Task 2
- **Issue:** `results` is a `{ status, path }[]`; the orphans are a `string[]`. Wrapping both in a single object would add a type with one producer and one consumer.
- **Resolution:** Both are computed before either is rendered, and both are rendered at one place at the end of the function — which is the property the instruction protects ("a later `--json` cannot disagree with the text"). The wrapper object was not added. If `--json` ever lands it will serialise both from the same two locals at the same point.
- **Files modified:** none.

---

**Total deviations:** 0 auto-fixed + 4 documented plan/policy conflicts resolved without weakening a guard.
**Impact on plan:** None on scope. Every artifact the plan names exists; the ASCII invariant moved file, and core gained one nine-line exported function.

## Verification Run

Every command below was run on Windows 11 (win32, Node 24) in `C:/Work/accord`.

| Command | Result |
|---|---|
| `npm run build && npm run lint && npm run typecheck && npm test -- --project cli` | pass — 11 files, 128 tests |
| `npm test -- --project cli skill-commands` | pass — 8/8 |
| `npm test -- --project cli skills-sync` | pass — 17/17 (was 9) |
| `npm test -- --project cli spawn-surface` | pass — 10/10 (was 9) |
| `npm run check` | pass — **32 files, 770 tests, 0 failures** (was 31 files, 753 tests) |
| `node packages/cli/dist/cli.js skills sync` in this repository | 5 x `unchanged`, empty stderr, exit 0 — no orphan, because `accord-dev` is declared and 06-02 already removed the two hand-written directories |
| `git status --porcelain .claude/skills .agents/skills packages/core/test/fixtures` | 06-02's four entries only; unchanged across the whole suite run (deviation 3) |

### Mutation checks (proving the guards are load-bearing)

Each mutation was applied, the suite re-run, and the file restored and rebuilt.

| Mutation | Expected | Observed |
|---|---|---|
| `accord gate ready` -> `accord gate readdy` in `dev/SKILL.md:16`, regenerated and rebuilt | the offender array names both rendered copies with path and line | fails — `+ ".agents/skills/accord-dev/SKILL.md:15: accord gate readdy"`, `+ ".claude/skills/accord-dev/SKILL.md:15: accord gate readdy"` |
| rename `skills` in `buildProgram` | the path-set equality fails | fails — `- "skills sync"` |
| replace the orphan scan's result with an empty list | the orphan case fails | fails — `.claude/skills/accord-designer: expected '' to contain '.claude/skills/accord-designer'` |

The first mutation only fails **after `npm run build`**: `packages/cli/test/` imports
`@accord-dev/accord-core`, which resolves through the package `exports` map to
`packages/core/dist/`. A regenerated `skills.ts` alone changes nothing the CLI tests can see —
worth recording, because the first attempt at this check passed and looked like a broken guard.

## Issues Encountered

One, and it was a test-authoring bug rather than a production one: the first `updated` case
built its marker as `MARKER_HEAD + 'fnv1a64:' + contentHash(...)`, but `contentHash` already
returns the `fnv1a64:` prefix, so the doubled prefix did not match the marker regex and the file
read as having no marker at all — reported, correctly, as `overwrote local edits`. Fixed in the
test; no production code was touched.

## Findings / decisions needing owner confirmation

1. **The removal command in the orphan line is `rm -rf`, which is not a command on a stock
   Windows shell.** The line reads
   `orphan .claude/skills/accord-designer - no longer declared; accord never deletes - remove it with: rm -rf .claude/skills/accord-designer`.
   D-113 requires "the command to remove it" and the message must be byte-identical on every host
   (ASCII, forward slashes, no host branch), so one idiom had to be picked. `rm -rf` works in Git
   Bash and WSL — which is how this author works on Windows — and in every POSIX shell.
   Alternatives, none taken: `git rm -r` (identical on both OSes and handles tracked files, but
   fails on an untracked directory, which an orphan often is), or dropping the command for a bare
   "delete this directory", which stops satisfying D-113's wording. **Owner's call.**

2. **The SKILL-08 scanner reads code formatting, so a command written in bare prose is invisible
   to it.** If a future workflow says *"run accord gate ready before you start"* without
   backticks, a typo in it would not be caught. The alternative — scanning prose too — flags
   `prototype.md`'s "the header accord ships" today and would flag any future sentence using the
   product name before a verb. The convention (commands are in backticks) is already universal
   across all six definitions and is the one a Markdown reader expects; a test asserting the
   convention itself was considered and rejected as a second guard for a first-guard problem.
   Recorded so the choice is visible rather than discovered.

3. **`skillDirs` is a public core export with one consumer.** It exists because the orphan scan
   must know the declared directories even when nothing renders (see deviation 2). If the owner
   would rather core not grow an export for the CLI's benefit, the alternative is moving the
   runtime-to-directory table into the CLI — which would then be two tables, and the drift this
   phase exists to remove.

4. **Probe row CLI-08 remains UNRESOLVED**, carried forward unchanged from 06-01 and restated in
   this plan's own `flagged_assumptions`: the CLI-08 truths were authored from D-112, D-113 and
   D-121 directly rather than from a probe category. This plan owned the remaining CLI-08
   behaviour and all of it is now tested, but the probe row itself is still unclassified.

5. **06-01 finding 4 is now answered, and the answer is "no signal".** A role declared in
   `roles:` with no authored definition renders nothing and is *not* reported — deliberately, so
   that `accord-ba` is not called an orphan while 06-04 is still in flight. The consequence is
   that "this role has no definition yet" and "this role's definition went missing" remain
   indistinguishable at runtime. Once all three definitions exist, a role declared but not
   rendered can only mean a bug, and reporting it would be free. Out of scope here because it
   would go red today for 06-04's reason.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **06-04 inherits the SKILL-08 scan with no test edit.** The moment `ba/SKILL.md` and its
  bundled files land, both rosters in `skill-commands.test.ts` scan them; every command they name
  must be one of the six real paths. `new ticket` and `status`, which no definition names today,
  are the two most likely to appear there — and both are registered, so they pass.
- **Phase 7's `init` gets the orphan scan and `skillDirs` for free** if it calls `skills()`, and
  the pin ordering it is built against is asserted as "writes nothing on a mismatch", not merely
  "exits 2".
- **One verification item is outstanding for the phase, not for this plan:** the Ubuntu CI leg.
  Nothing is committed, so CI has not run; every result above is the Windows leg.
- **Nothing is committed.** `git status --short` shows the full change set for review.

## Self-Check: PASSED

- `packages/cli/test/skill-commands.test.ts` exists on disk; all six files under
  `key-files.modified` exist and carry this plan's changes (`git diff` for the three tracked ones,
  direct read for the three that 06-01/06-02 created and left untracked).
- `git log --oneline --all --grep="06-03"` returns nothing, which is the **expected** result under
  the standing no-commit rule. `commits: 0` is the measured value; no ledger was written because
  no commit exists to count.
- Every `<acceptance_criteria>` item from all three tasks was re-run. The one that cannot be
  literally satisfied under the no-commit policy is deviation 3, with its substitute check and
  result; the one the plan mis-describes is deviation 1, with the assertion relocated rather than
  dropped.
- Plan-level `<verification>`: `npm run check` green (770 tests), and both hand-verified negative
  checks performed, recorded in the mutation table, and reverted.

---
*Phase: 06-skills*
*Completed: 2026-09-16*
