---
phase: 05-cli-commands
plan: 03
subsystem: cli
tags: [gate, ac_hash, write, exit-codes, json, sandbox-tests, commander]

# Dependency graph
requires:
  - phase: 04-gates
    provides: "`gateReady` / `gateDone` and the `GateResult` shape (D-86, D-87) — the verdict the CLI prints and adds nothing to"
  - phase: 02-core-model-and-loading
    provides: "`setFrontmatterKey` with its D-44/D-45 quoting and comment round-trip — the only write primitive this plan uses"
  - phase: 05-cli-commands
    provides: "05-01's `runCli` spine: commander with `exitOverride`, the shared `preflight` (root -> snapshot -> pin), `UsageError` as the exit-2 channel, `colourFindings`, and the `makeRepo`/`run` sandbox harness"
provides:
  - "`accord gate ready <id>` and `accord gate done <id>`, with `--json` printing the GateResult verbatim (D-98)"
  - "The `ac_hash` write — the one mutation accord makes to a file a human owns (D-86, D-96) — with its rerun no-op and its exit-2 failure path (D-97)"
  - "`commitAll(repo)` in the CLI test helper: the sandbox needs a real HEAD before any Done gate can reach a pass verdict (D-78)"
affects: [05-04, 05-05, 06-skills, 07-scaffolding]

# Actuals (#2632) — same estimateTokens scale (chars/4 over the realized diff).
actuals:
  tokens: 3300
  tasks: 3
  commits: 0
  plan_head_before: 97a7977174efa56e1d98594355d15a46af50a8b9

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Print the result to stdout before attempting the side effect, so a failed side effect is reported after the true verdict rather than instead of it (D-97)"
    - "Write only when the produced text differs from the text on disk — the compare, not a flag, is what makes a rerun a no-op on mtime"
    - "A filesystem path for a CLI argument is looked up in the loader's own record (`snapshot.tickets[id].file`), never concatenated from the argument"
    - "A host-capability case (read-only mode) is gated by a runtime probe, never by a `process.platform` string"

key-files:
  created:
    - packages/cli/src/commands/gate.ts
    - packages/cli/test/gate.test.ts
  modified:
    - packages/cli/src/run.ts
    - packages/cli/test/helpers/repo.ts

key-decisions:
  - "The two subcommands are registered from one `for (const which of ['ready','done'])` loop over a single `gate` command group, so neither can acquire an option or a preflight the other lacks"
  - "The write notice reads `wrote ac_hash <hash> to <repo-relative posix path>` and goes to stderr; it does not distinguish a first write from an overwrite of a different recorded hash"
  - "`writeFileSync` receives exactly what `setFrontmatterKey` returned — the CLI adds no newline handling of its own, so core's FMT-08 normalisation is the single place line endings are decided"
  - "The test helper gained `commitAll(repo)` rather than the test file spawning git itself, keeping the sandbox guard the only path to a git invocation"

patterns-established:
  - "Byte-level write assertion: read the file with the `latin1` encoding before and after, and assert that deleting the single added line restores the original exactly — a quoting or comment round-trip regression in `setFrontmatterKey` fails here, not only in core's own tests"
  - "`bindToHead(repo, id)`: commit the sandbox, then rewrite the fixture's placeholder sha to the real HEAD, because Done's rules read `git.commit` and a fixture sha can never exist in a fresh repository"

requirements-completed: []

coverage:
  - id: D1
    description: "`gate ready` and `gate done` print through `renderText` and exit 0 on pass, 1 on fail"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/cli/test/gate.test.ts#gate ready on a passing ticket exits 0 and writes the renderText body"
        status: pass
      - kind: unit
        ref: "packages/cli/test/gate.test.ts#gate ready on a failing ticket exits 1"
        status: pass
      - kind: unit
        ref: "packages/cli/test/gate.test.ts#gate done on a failing ticket exits 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Under `--json` stdout carries the GateResult with no envelope and nothing else (D-98)"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/cli/test/gate.test.ts#gate ready --json writes the GateResult verbatim with gate: ready (D-98)"
        status: pass
      - kind: unit
        ref: "packages/cli/test/gate.test.ts#gate done --json writes a document whose gate value is done"
        status: pass
    human_judgment: false
  - id: D3
    description: "A passing `gate ready` writes `ac_hash` into the ticket file and names it on stderr (D-96)"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/cli/test/gate.test.ts#a pass verdict writes the hash into the ticket and names it on stderr"
        status: pass
    human_judgment: false
  - id: D4
    description: "A second consecutive run leaves the file byte-identical and does not touch its mtime (D-96)"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/cli/test/gate.test.ts#a second consecutive run leaves the bytes and the mtime untouched"
        status: pass
    human_judgment: false
  - id: D5
    description: "A fail verdict, both `gate done` verdicts, and a pass verdict with no `acHash` all leave the file untouched"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/cli/test/gate.test.ts#a fail verdict leaves the ticket file untouched"
        status: pass
      - kind: unit
        ref: "packages/cli/test/gate.test.ts#gate done leaves the ticket file untouched on a pass verdict"
        status: pass
      - kind: unit
        ref: "packages/cli/test/gate.test.ts#gate done leaves the ticket file untouched on a fail verdict"
        status: pass
      - kind: unit
        ref: "packages/cli/test/gate.test.ts#a pass verdict whose acHash is undefined writes nothing"
        status: pass
    human_judgment: false
  - id: D6
    description: "A write failure prints the result first, reports the failure on stderr, and exits 2 (D-97)"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/cli/test/gate.test.ts#an unwritable ticket still reports the verdict on stdout, the failure on stderr, and exits 2"
        status: pass
    human_judgment: false
  - id: D7
    description: "A bad argument is a usage error, not a verdict: `gate ready` with no id exits 2"
    requirement: CLI-05
    verification:
      - kind: unit
        ref: "packages/cli/test/gate.test.ts#gate ready with no id exits 2 with commander’s missing-argument message"
        status: pass
    human_judgment: false
  - id: D8
    description: "No flag, option, or environment variable enables or suppresses the write (D-96)"
    requirement: CLI-05
    verification:
      - kind: integration
        ref: "packages/cli/src/commands/gate.ts declares `{ json?: boolean }` and nothing else; run.ts registers `--json` as the only option on either subcommand"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-09-15
status: complete
---

# Phase 5 Plan 3: `gate ready` and `gate done` end to end Summary

**Both gates are reachable from a terminal for the first time, printing the core verdict through the shared renderer with the 0/1 exit contract, and a passing Ready now performs the one write the whole project makes — `ac_hash` into the ticket file — with a rerun that touches nothing and a failure that exits 2 after the true verdict is already on stdout.**

## Performance

- **Duration:** 10 min
- **Tasks:** 3 of 3
- **Files created:** 2
- **Files modified:** 2

## Accomplishments

- `packages/cli/src/commands/gate.ts` — 50 lines. Calls `gateReady` / `gateDone` and nothing else; no rule table, no filter, no level change. Prints `colourFindings(renderText(result), stdout)`, or `JSON.stringify(result, null, 2)` under `--json`, so all three commands share one printer and the JSON is the core object verbatim (D-98).
- The write happens **after** the stdout write, in source order, and only when all three of `which === 'ready'`, `verdict === 'pass'`, and `acHash !== undefined` hold. The target is `join(ctx.root, ctx.snapshot.tickets[id].file)` — the loader's own record for a ticket that exists. The raw `<id>` argument appears in no path expression, so a crafted id is a key lookup that misses rather than a traversal (T-05-07).
- The write is guarded by `next !== text`, which is what makes a second consecutive `gate ready` leave both the bytes and the mtime alone. A successful write prints one line to **stderr**, so a `--json` consumer's stdout stays a single clean document (T-05-09, T-05-10).
- A read or write failure is wrapped in `UsageError` and thrown; `runCli`'s existing map turns that into stderr plus exit 2. The verdict is never converted to `fail`, and the command never exits 0 with a warning (D-97).
- `packages/cli/src/run.ts` — a `gate` command group with `ready <id>` and `done <id>` registered from one loop, each carrying `--json` and nothing else, both routed through the same `preflight` the lint action uses. The pin check is not conditional on the subcommand (D-95).
- `packages/cli/test/gate.test.ts` — 14 tests, one per line of the two behavior blocks, each in its own `mkdtemp` sandbox. The write assertions are byte-level (`latin1` reads before and after), the rerun asserts `statSync().mtimeMs` equality, and the failure case asserts stdout, stderr, and the exit code in the same run.

## Task Commits

**Nothing was committed — project policy (CLAUDE.md: leave changes uncommitted for owner review).** `HEAD` is still `97a7977`.

1. **Task 1: gate ready and gate done end to end — verdict, printer, exit code** — uncommitted (project policy)
2. **Task 2: the ac_hash write — the one write a gate performs** — uncommitted (project policy)
3. **Task 3: sandbox tests for both verdicts and all three write outcomes** — uncommitted (project policy)

**Plan metadata:** uncommitted (project policy)

## Files Created/Modified

- `packages/cli/src/commands/gate.ts` — the `gate(ctx, which, id, options)` body and the single `setFrontmatterKey` write path (new)
- `packages/cli/test/gate.test.ts` — 14 sandbox cases across two describes (new)
- `packages/cli/src/run.ts` — the `gate` command group and its two subcommands (modified, +14 lines)
- `packages/cli/test/helpers/repo.ts` — `commitAll(repo)` added beside `makeRepo`/`cleanup`/`run` (modified, +17 lines)

## Verification

Run from `C:/Work/accord`, all four green:

| Command | Result |
|---------|--------|
| `npm run build` | pass — `dist/cli.js` 9.38 kB, shebang preserved |
| `npm run lint` | pass — no output |
| `npm run typecheck` | pass — core, core test, cli |
| `npm test` | **26 files / 646 tests passed**, 0 failed, 0 skipped |

Baseline entering this plan was 25 files / 632 tests. The delta is exactly `gate.test.ts` (+1 file, +14 tests); no pre-existing test changed state and no pre-existing failure was observed. The read-only case ran rather than skipping on this host (Windows honours the attribute), so 14 of 14 executed.

The plan's second automated check, `test -z "$(git status --porcelain packages/core/test/fixtures)"`, **cannot pass in this working tree and was not used as written**: the Phase 4 gate fixtures are still untracked under the project's no-commit policy, so `git status` lists four `??` directories regardless of what any test does. The intent behind it was verified directly instead — `packages/core/test/fixtures/gate-ready/accord/tickets/CLEAN.md` contains no `ac_hash` line and `gate-done/accord/tickets/PASS.md` still records the placeholder `verified_commit: "1234567"`, so no test wrote into the shared fixture directory.

Behavioural verification of the write, observed in the test run rather than asserted by inspection: `gate ready CLEAN` on a fresh sandbox changes `CLEAN.md` on disk, deleting the one added `ac_hash:` line restores the original file byte-for-byte, and the second run reports exit 0 with an empty stderr and an unchanged `mtimeMs`.

## Decisions Made

1. **One registration loop for the two subcommands.** `for (const which of ['ready','done'] as const)` over a single `gate` group. Two hand-written blocks would let one subcommand acquire an option or a different preflight without the other; the loop makes that impossible rather than merely unlikely.
2. **The notice does not distinguish a first write from an overwrite.** It reads `wrote ac_hash <hash> to <path>` in both cases. See Findings — the plan fixes the write condition (`next !== text`) but not the wording, and "updated" versus "wrote" is a product voice decision, not an implementation one.
3. **The CLI does no line-ending handling.** `writeFileSync` receives exactly the string `setFrontmatterKey` returned. Core already normalises to LF and strips a BOM (D-38 / FMT-08); putting a second opinion about newlines in the CLI would give the project two places where that is decided. See Findings.
4. **`commitAll` lives in the test helper, not in the test file.** The plan requires the helper's guard to stay the only path to a git invocation in `gate.test.ts`, so the new git call went behind the same guard rather than beside it.

## Deviations from Plan

**1. [Rule 3 — blocking] `packages/cli/test/helpers/repo.ts` gained `commitAll(repo)`, which the plan did not list.**

- **Found during:** Task 3, on the first run of the two `gate done` pass-verdict cases.
- **Issue:** `makeRepo` does `git init` and nothing else, so a sandbox has an unborn HEAD. `gitFacts` returns `undefined` for a repository with no commit, and `gate.commit-missing` is an error on both profiles — so **every** `gate done` in a sandbox fails, and the pass verdict, which is the branch that actually proves Done performs no write, was unreachable. Two tests failed with exit 1 where 0 was expected.
- **Fix:** `commitAll(repo)` commits the sandbox behind the existing `gitIn` guard and returns the HEAD sha, with identity and signing supplied per invocation (`-c user.email=… -c user.name=… -c commit.gpgsign=false`, plus `--no-verify`) so the host's global git config cannot change the result. `gate.test.ts` then calls a local `bindToHead(repo, id)` that commits and rewrites the fixture's placeholder sha `1234567` to the real HEAD in both `PASS.md` and `PASS/verification.md`, because `gate.tick-stale-commit` compares the recorded sha to the live one.
- **Scope:** purely additive. `makeRepo`, `cleanup`, and `run` are untouched, so no 05-01 or 05-02 test changed behaviour — confirmed by the full suite staying green with the same counts plus this file's 14.
- **Commit:** uncommitted (project policy)

No production code was changed to make a new test pass.

## Findings / assumptions needing a decision

The plan specifies the write condition and the failure path precisely; these are the readings it does not fix. None should be treated as settled by the fact that a test now pins it.

1. **`gate ready` rewrites a CRLF ticket as LF and drops a BOM.** `setFrontmatterKey` returns `'---\n' + next + '\n---\n' + body` after `splitFrontmatter` has stripped the BOM and normalised CRLF (D-38, FMT-08), so a Windows-authored ticket saved with CRLF comes back LF-only the first time a Ready passes. This is core's documented behaviour and the CLI deliberately adds no second opinion, but it means the one mutation accord makes to a human's file can rewrite every line of it, which will read as a whole-file diff in review. **Owner decision wanted:** is silent LF normalisation acceptable for the `ac_hash` write, or should the CLI restore the original line endings and BOM after `setFrontmatterKey` so the diff is one line?

2. **An `ac_hash` already present with a different value is silently overwritten, and the notice says "wrote".** The plan's condition is `next !== text`, which is satisfied both when the key is absent and when it records a stale hash. Overwriting is the defensible reading — a passing Ready is exactly the event that should re-record the hash, and refusing would make a ticket whose criteria changed permanently ungateable. **Owner decision wanted:** should the notice distinguish the two (`updated ac_hash <old> -> <new>`), given that replacing a recorded hash silently un-stales a ticket that `status` was flagging?

3. **A write failure exits 2 even under `--json`, after a complete JSON document is already on stdout.** This is D-97 applied literally and is what the test asserts. The consequence worth naming: a CI script doing `accord gate ready X --json > result.json` gets a valid, parseable `verdict: pass` document **and** a non-zero exit. **Owner decision wanted:** confirm that a consumer reading the file and ignoring the exit code is an acceptable failure mode, or whether the JSON should be suppressed when the write fails (which would contradict D-97's "the verdict is true and must be reported").

4. **An unknown id produces a `fail` verdict and exit 1, not exit 2.** `gate.ticket-unknown` is an error row on both tables, so a typo'd ticket id is reported as a gate failure rather than a usage error. That is core's decision, inherited unchanged, and it is arguably right (the id came from the repository's vocabulary, not from the CLI's grammar) — but it means `accord gate ready LOGIN-2` and `accord gate ready LOGN-2` are distinguishable only by reading the reason. Recorded, not changed.

5. **A ticket id cannot collide.** `snapshot.tickets` is keyed by file stem and one stem is one file, so the "two tickets share an id" case the brief asked about cannot arise through the loader. No code was written for it.

6. **In a repository with no commit at all, `gate done` can never pass.** Not a defect — `gate.commit-missing` (D-78) is exactly the intended behaviour — but it is worth recording, because it is the reason this plan's test helper needed to grow a commit step, and Phase 7's example repository will hit the same wall if `init` is demonstrated in a fresh, uncommitted directory.

## Self-Check: PASSED

- `packages/cli/src/commands/gate.ts` — FOUND
- `packages/cli/test/gate.test.ts` — FOUND
- `packages/cli/src/run.ts` registers `gate` with `ready <id>` and `done <id>` — FOUND
- `packages/cli/test/helpers/repo.ts` exports `commitAll` — FOUND
- Commits — none, by project policy; `git rev-parse --short HEAD` returns `97a7977`, unchanged from plan start
