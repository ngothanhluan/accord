---
phase: 05-cli-commands
verified: 2026-09-15T07:17:33Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".claude/CLAUDE.md"
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/05-cli-commands/05-01-PLAN.md"
  - ".planning/phases/05-cli-commands/05-01-SUMMARY.md"
  - ".planning/phases/05-cli-commands/05-02-PLAN.md"
  - ".planning/phases/05-cli-commands/05-02-SUMMARY.md"
  - ".planning/phases/05-cli-commands/05-03-PLAN.md"
  - ".planning/phases/05-cli-commands/05-03-SUMMARY.md"
  - ".planning/phases/05-cli-commands/05-04-PLAN.md"
  - ".planning/phases/05-cli-commands/05-04-SUMMARY.md"
  - ".planning/phases/05-cli-commands/05-05-PLAN.md"
  - ".planning/phases/05-cli-commands/05-05-SUMMARY.md"
  - ".planning/phases/05-cli-commands/05-06-PLAN.md"
  - ".planning/phases/05-cli-commands/05-06-SUMMARY.md"
  - ".planning/phases/05-cli-commands/05-CONTEXT.md"
  - "packages/cli/src/commands/gate.ts"
  - "packages/cli/src/commands/lint.ts"
  - "packages/cli/src/commands/new-ticket.ts"
  - "packages/cli/src/commands/status.ts"
  - "packages/cli/src/index.ts"
  - "packages/cli/src/pin.ts"
  - "packages/cli/src/render/color.ts"
  - "packages/cli/src/render/table.ts"
  - "packages/cli/src/root.ts"
  - "packages/cli/src/run.ts"
  - "packages/cli/src/tracker/github-issues.ts"
  - "packages/cli/test/status.test.ts"
  - "packages/core/src/index.ts"
  - "packages/core/src/status/rows.ts"
covered_digest: "v1:sha256:5409e2945094eb697916a899d1fd1d2deeb3c6be01502b55ed11ac6b722530a0"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  scope: "criterion 2 only, at the orchestrator's request; passed items given a regression check via the full suite"
  gaps_closed:
    - "`accord status` prints an ASCII table — no box drawing and no character above code point 127"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "A spawn test of the built binary passes on Ubuntu CI (ROADMAP criterion 4, first clause)"
    test: >-
      Push the branch and read the `check` job for `ubuntu-latest` on Node 22 and 24; confirm
      packages/cli/test/bin.test.ts (`runs under process.execPath and lists the lint command`)
      passes there.
    expected: "Green on all four matrix legs; the same 708 tests that pass locally on Windows."
    why_human: >-
      The `ubuntu-latest` leg cannot be observed from this Windows host and the phase is
      deliberately uncommitted, so no CI run exists yet. The matrix is declared correctly in
      .github/workflows/ci.yml (os [ubuntu-latest, windows-latest] x node [22, 24], fail-fast
      false) and the whole suite passes on this Windows host; only the Ubuntu observation is
      outstanding. The second clause of criterion 4 — the CLI never spawns npm, npx, or a .cmd —
      is fully verified and needs no CI.
human_verification: []
owner_dispositions:
  - item: "A spawn test of the built binary passes on Ubuntu CI (ROADMAP criterion 4, first clause)"
    ruling: "Accepted as a deferred confirmation, not a blocker. Phase closed 2026-09-15."
    rationale: >-
      The clause this phase controls — the CLI spawns only `git` and `gh`, never a package manager and
      never through a shell — is verified non-vacuously and needs no CI. What remains is an observation
      of a host the author does not have, and it cannot be made before the first push because the phase
      is deliberately uncommitted. Holding the phase open would block on a signal only a commit can
      produce, while the commit itself waits on owner review.
      The two Linux-specific risks were examined directly rather than assumed. `readdir` ordering
      cannot leak past the loader boundary: `packages/cli/src/load/fs.ts:43` builds its record in disk
      order, but `packages/core/src/load/snapshot.ts:68` re-sorts every file key on entry into core.
      A case-sensitive filesystem would only matter for two ticket files differing by case, which no
      fixture creates. And the one test with real cross-platform teeth — the D-51 backslash scan at
      spawn-surface.test.ts:103 — can only fail on Windows, which is the host it passed on; on Linux
      that assertion is vacuous. Windows is the harder host here, not the easier one.
    confirm_at: "First push. Read the `check` job's ubuntu-latest legs on Node 22 and 24; expect the same 708 tests green."
    on_failure: "Reopen phase 05 — a red Ubuntu leg would be a CLI defect, not a planning gap."
  - item: "Decide whether 05-04-SUMMARY.md finding 2 should be rewritten"
    ruling: "Resolved — finding 2 was rewritten 2026-09-15."
    rationale: >-
      The owner ruled that a non-ASCII ticket id should be refused early and loudly at lint time rather
      than mangled at render time. Implementing that ruling showed it was already the shipped behaviour:
      `ticket.schema.json` constrains `id` and `parent` to `^[A-Za-z0-9][A-Za-z0-9._-]*$`, so a
      non-ASCII file stem is a `schema.pattern` error when the frontmatter id tracks it and a
      `lint.id-mismatch` error when it does not. A `lint.id-non-ascii` rule was written and then deleted
      as redundant. Finding 2 now records the ruling, that no rule was added, and that the renderer's
      printable-ASCII sanitiser remains defence in depth for the id column — which is read from the file
      stem and so bypasses frontmatter validation entirely.
    still_open: >-
      A tracker *value* is `{ type: string, minLength: 1 }` with no pattern, so a non-ASCII tracker id
      is schema-valid and reaches the sanitiser. Constraining it would contradict
      `packages/core/test/schemas.test.ts:207`, which deliberately pins a non-ASCII tracker value as
      valid. Raised to the owner and left unchanged — a separate decision from the id ruling, and out
      of scope for this phase.
---

# Phase 5: CLI Commands Verification Report

**Phase Goal:** A developer or CI runs lint, gates, status, and new ticket from a terminal on Windows or POSIX, with JSON output, version pinning, and optional tracker enrichment.
**Verified:** 2026-09-15T13:32:00Z
**Status:** passed — amended 2026-09-15 from `human_needed`; both human-verification items are discharged under Owner Dispositions in the frontmatter, one resolved and one accepted as a deferred confirmation at first push.
**Re-verification:** Yes — after gap closure, scoped to criterion 2 (initial run: gaps_found, 3/5)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `accord new ticket <id>` creates a ticket from the active profile's template with `@ac-1` tag scaffolding and refuses to overwrite an existing ticket | ✓ VERIFIED | Ran the built binary against a temp git sandbox: `new ticket SPOT-1` printed `accord/tickets/SPOT-1.md`, exit 0. The created file carries `id: "SPOT-1"` (line 2), `type: "story"` with its guidance comment intact (line 4), `Feature: SPOT-1` (line 42), and **`@ac-1` at line 44**. Second run: `accord/tickets/SPOT-1.md already exists - nothing was written`, exit 2, file untouched. `new ticket ../evil` refused with exit 2 and no file written. Template source confirmed: `@ac-1` is in `packages/core/templates/ticket-build.md` and appears 3x in the generated `templates.ts` — nothing is synthesised. 17 tests in new-ticket.test.ts cover both profiles, all three types, the refusal, and id rejection. |
| 2 | `accord lint`, `gate ready <id>`, `gate done <id>`, `status` print an ASCII table or reasons; `--json` prints the same result object; exit codes follow 0/1/2 | ✓ VERIFIED (gap closed) | **Verified:** all four commands ran against the built binary. `lint` printed 9 `file:line: level rule reason` lines plus `0 errors, 9 warnings`, exit 0; exit 1 on an error finding (cli.test.ts:33). `gate ready LOGIN-1` printed the renderText body and exit 0; `gate done LOGIN-1 --json` printed the bare `GateResult` (`{"gate":"done","ticket":"LOGIN-1","verdict":"fail",...}`) and exit 1. `status` printed the padEnd table; `status --json` printed a bare `StatusRow[]`. `--json` carries the core object with no envelope in all three (D-98). Exit 2 confirmed for bad args, no git repo, no `accord/` folder, and the pin. **The ASCII clause is now enforced by the renderer** — both original reproductions replayed clean against a rebuilt binary; see Re-verification. |
| 3 | Running against a `config.yml` pinned to a different accord version exits 2 with a message naming both versions | ✓ VERIFIED | Set the sandbox pin to `0.9.9`. All five repository-reading commands (`lint`, `status`, `gate ready`, `gate done`, `new ticket`) wrote to **stderr**: `config.yml pins accord 0.9.9, running 0.1.0 - run: npx --yes @accord-dev/accord@0.9.9` — both versions named, plus the fix command — and exited **2** with empty stdout. `new ticket` wrote no file under the mismatch. `--version` (printed `0.1.0`) and `--help` both exited 0, honouring the D-95 exemption. |
| 4 | A spawn test of the built binary passes on Ubuntu and Windows CI, and the CLI never spawns `npm`, `npx`, or any `.cmd` | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | **Second clause fully verified.** Only three spawn sites exist in `packages/cli/src` (`load/fs.ts:3`, `root.ts:6`, `tracker/github-issues.ts:6`), all `execFileSync` with a literal `'git'` or `'gh'` and no `shell:` option. No `exec`/`execSync` anywhere. **The guard is non-vacuous** — replayed the spawn-surface scan against a copy of `src` with an injected `execFileSync('npx', …)` and `spawnSync('npm.cmd', …, { shell: true })`: the allowlist flagged both sites and the shell check flagged one, while the real `src` yields 4 sites and 0 offenders. **First clause:** the whole suite (29 files, 707 tests) passes on this Windows host, including bin.test.ts spawning `dist/cli.js` under `process.execPath`. The Ubuntu leg is declared in ci.yml but unobservable here — see Human Verification. |
| 5 | With tracker `github-issues` configured, `status` shows issue title, state, and labels using a token from `gh auth token` or `GITHUB_TOKEN`, and every gate returns the same result with or without the token | ✓ VERIFIED | `status.ts:39-42` builds the cell as `#<n> <state> <title> <labels>`; tracker.test.ts:286 asserts `#7 open Log in ui,auth` end to end through `runCli`. Token order is `GITHUB_TOKEN` then `gh auth token` (`github-issues.ts:35-47`), with ENOENT swallowed as "no token" — all three paths tested (lines 86, 96, 117). **The independence guard is non-vacuous:** tracker.test.ts:435 asserts `expect(calls).toEqual([])` — a gate reached the network zero times — which would go red the instant a gate consulted the adapter. Degradation (404, rate limit, offline, malformed body, hang) all leave exit 0 with one stderr line. |

**Score:** 5/5 truths verified (1 of them — criterion 4's Ubuntu leg — present and behavior-unverified pending CI; see Human Verification)

> Criterion 4 is counted verified for the clause this phase controls (the CLI spawns only `git` and `gh`, proven non-vacuously). Its Ubuntu-CI clause is an observation, not an implementation gap, and is tracked as the sole human-verification item.

### Plan Must-Have Truths (supporting detail)

| Plan | Truth | Status | Evidence |
|------|-------|--------|----------|
| 05-01 | `lint` works from any subdirectory (D-103) | ✓ VERIFIED | Ran `status` from `sub/deep/` in the sandbox — full repository table. `repoRoot` uses `git rev-parse --show-toplevel` and normalises to forward slashes (root.ts:26). cli.test.ts:47 pins byte-identity from a subdirectory. |
| 05-01 | No printed path contains a backslash on any host | ✓ VERIFIED | spawn-surface.test.ts:103 drives six real command invocations through `runCli` and scans both streams, each with a `guard` assertion so an output with no path in it cannot pass for free. Passing on this Windows host. |
| 05-01 | No flag or env var lets a fail verdict or mismatch produce exit 0 (prohibition, judgment) | ✓ VERIFIED | No bypass exists in the source: `preflight` (run.ts:39-50) is unconditional for every action, and no `--force`/`--no-verify`/env read appears. Exit derives solely from `result.errors > 0` / `result.verdict === 'fail'`. |
| 05-02 | `statusRows` sorts in outline order (owner ruling, overriding the plan's `parent ?? ''`) | ✓ VERIFIED | `rows.ts:63` is `cmp(a.parent ?? a.id, b.parent ?? b.id) \|\| cmp(a.id, b.id)`. Pinned by a purpose-built test (core status.test.ts:150) that adds a parentless `ZZZ-9` and asserts `['EPIC-1','LOGIN-1','ZZZ-9']` — the one case that separates the two sort rules, as its own comment at line 145 states. |
| 05-02 | `statusRows` never calls `gateReady`/`gateDone`; one lint for the repo (D-91) | ✓ VERIFIED | rows.ts imports only `lintSnapshot`, `scoped`, `acHash`. One `lintSnapshot(snapshot)` at line 39, outside the map. |
| 05-03 | A second consecutive `gate ready` leaves the file byte-identical and does not touch mtime (D-96) | ✓ VERIFIED (behavioral) | Ran the named test alone: `a second consecutive run leaves the bytes and the mtime untouched` — 1 passed. Backed by the `next !== text` guard at gate.ts:44. |
| 05-03 | The `ac_hash` write restores the ticket's own CRLF endings and BOM (orchestrator change 2) | ✓ VERIFIED (behavioral) | Ran the named test alone: `restores the ticket's own CRLF endings, so the write stays a one-line diff` — 1 passed. gate.ts:37-40 captures BOM and CRLF before `setFrontmatterKey` and restores both. A second test covers the BOM case (gate.test.ts:171). |
| 05-03 | The stderr notice distinguishes `wrote` from `updated` (orchestrator change 3) | ✓ VERIFIED | gate.ts:50-55 branches on the ticket's prior `ac_hash`. Observed live: `wrote ac_hash fnv1a64:6111813f5832f177 to accord/tickets/LOGIN-1.md`. The replacement branch is pinned by gate.test.ts:185. |
| 05-03 | Pass verdict + failed write ⇒ result printed first, then the failure, exit 2 (D-97) | ✓ VERIFIED | gate.test.ts:262 chmods the ticket to `0o444` and asserts exit 2, guarded by a host-capability probe (lines 30-45) so it skips rather than passes falsely where read-only is not honoured. |
| 05-04 | Table is byte-identical regardless of terminal width | ✓ VERIFIED | table.ts reads no terminal dimension; widths derive only from cell content (line 84). A committed text golden pins the output. |
| 05-04 | No cell contains a backslash, newline, CR, or escape — one row is always one line | ✓ VERIFIED | `sanitise` maps every non-printable, C0 controls and DEL included, to a space (table.ts:67-76). status.test.ts:82 asserts line count equals `rows.length + 3`. |
| 05-04 | Table contains only ASCII — no box drawing, nothing above code point 127 | ✓ VERIFIED | `sanitise` now maps everything outside `0x20..0x7e` to a space (table.ts:67-69), mirroring the tracker adapter. Pinned by `status.test.ts:193`, proven to discriminate by reverting the predicate. |
| 05-05 | The command fills in nothing a human should author (prohibition, judgment) | ✓ VERIFIED | new-ticket.ts:42 performs exactly two operations: `replaceAll('TICKET-ID', id)` and `setFrontmatterKey(…, 'type', …)`. Inspected the created SPOT-1.md — Intent, Requirements, scenario name and steps all remain template placeholder text (`<observable outcome>`, `Given ...`), which `lint` then flags as 6 sentinel/plan warnings. Pinned by new-ticket.test.ts:69. |
| 05-06 | Every request is bounded by a timeout (orchestrator change 4) | ✓ VERIFIED | `AbortSignal.timeout(5000)` at github-issues.ts:98. The test (tracker.test.ts:176) asserts the signal is an `AbortSignal` **and not already aborted** — removing the option makes `seen[0]` undefined and the assertion fails, so it is non-vacuous. |
| 05-06 | The token appears in no byte written to stdout or stderr and in no file (prohibition, test) | ✓ VERIFIED | Two tests: the unit warning check (tracker.test.ts:202) and the end-to-end stream check (line 387), both asserting on a partial substring as well as the whole token. The token travels only in an `authorization` header, never in the URL. |
| 05-06 | Rendering is identical regardless of response completion order (D-101) | ✓ VERIFIED | tracker.test.ts:363 runs `status` twice, the second time with `#9` resolving 14 ms before `#7`, and asserts both streams byte-identical. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/cli/src/run.ts` | `runCli` + preflight + 0/1/2 exit map | ✓ VERIFIED | 136 lines. Exports `runCli`, `RunOptions`, `CommandContext`. Registers all five commands. Imported by `index.ts` and every test helper. |
| `packages/cli/src/root.ts` | `repoRoot` via git rev-parse | ✓ VERIFIED | 27 lines; called at run.ts:40. |
| `packages/cli/src/pin.ts` | `pinMessage(pinned, running)` | ✓ VERIFIED | 17 lines; called at run.ts:46. Exact string compare, no semver. |
| `packages/cli/src/commands/lint.ts` | lint body | ✓ VERIFIED | 15 lines; calls core `renderText`, never re-implements it. |
| `packages/cli/src/commands/gate.ts` | gate bodies + the single ac_hash write | ✓ VERIFIED | 66 lines; contains `setFrontmatterKey` as the plan required. |
| `packages/cli/src/commands/new-ticket.ts` | id validation, template selection, refusal | ✓ VERIFIED | 53 lines; contains `setFrontmatterKey`; reads `templates[name]`, never the filesystem. |
| `packages/cli/src/commands/status.ts` | archived filter, hidden count, JSON passthrough | ✓ VERIFIED | 80 lines; calls `statusRows`, `renderRows`, `fetchIssues`. |
| `packages/cli/src/render/color.ts` | styleText wrapping | ✓ VERIFIED | 21 lines; `styleText(..., { stream })` so Node's own `validateStream` honours NO_COLOR/isTTY. |
| `packages/cli/src/render/table.ts` | pure ASCII padEnd table | ✓ VERIFIED | 90 lines; contains `padEnd`, wired, and the ASCII clause it documents is now enforced by `isPrintable`/`sanitise`. |
| `packages/cli/src/tracker/github-issues.ts` | read-only adapter | ✓ VERIFIED | 124 lines; exports `IssueFacts`, `fetchIssues`. GET only; no write verb anywhere. |
| `packages/core/src/status/rows.ts` | `StatusRow`, `statusRows` | ✓ VERIFIED | 64 lines; contains `export function statusRows`; re-exported on the public barrel (`core/src/index.ts:23-24`). |
| `packages/cli/test/helpers/repo.ts` | sandbox repo builder | ✓ VERIFIED | 71 lines; carries a guard that throws if git would run outside a tmpdir. |
| `.claude/CLAUDE.md` STACK Decision 6 "Version pin" row | corrected per D-94 | ✓ VERIFIED | Line 99 now reads "A mismatch is a hard refusal on every repository-reading command … exit 2 … no bypass flag … only `--version` and `--help` are exempt", and records PITFALLS §11's parenthetical as superseded. The pre-phase "warn (build profile) or fail (maintain)" text is gone. |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `run.ts` | `root.ts` | `repoRoot(opts.cwd)` at run.ts:40 | ✓ WIRED |
| `run.ts` | `pin.ts` | `pinMessage(snapshot.config.accord, pkg.version)` at run.ts:46, thrown as `UsageError` | ✓ WIRED |
| `commands/lint.ts` | core `lint/render.ts` | `renderText(result)` at lint.ts:11 | ✓ WIRED |
| `commands/gate.ts` | core `gate/index.ts` | `gateReady`/`gateDone` at gate.ts:20 | ✓ WIRED |
| `commands/gate.ts` | core `write/frontmatter.ts` | `setFrontmatterKey(text,'ac_hash',…)` at gate.ts:39 | ✓ WIRED |
| `run.ts` | `commands/gate.ts` | gate group registers `ready` and `done`, run.ts:77-86 | ✓ WIRED |
| `core/status/rows.ts` | `core/gate/hash.ts` | `acHash(ticket.scenarios)` at rows.ts:44 | ✓ WIRED |
| `core/status/rows.ts` | `core/gate/index.ts` | `scoped(findings, ticket.id)` at rows.ts:43 | ✓ WIRED |
| `core/index.ts` | `core/status/rows.ts` | `export { statusRows } from './status/rows.js'` line 23 | ✓ WIRED |
| `commands/status.ts` | `core/status/rows.ts` | `statusRows(ctx.snapshot)` at status.ts:48 | ✓ WIRED |
| `commands/status.ts` | `render/table.ts` | `renderRows(visible, cells)` at status.ts:71 | ✓ WIRED |
| `run.ts` | `commands/status.ts` | registration at run.ts:108-117, `parseAsync` awaits the async action | ✓ WIRED |
| `commands/new-ticket.ts` | `core/generated/templates.ts` | `templates[name]` at new-ticket.ts:42 — no disk read of `templates/*.md` | ✓ WIRED |
| `run.ts` | `commands/new-ticket.ts` | `new` group registers `ticket <id>`, run.ts:94-106 | ✓ WIRED |
| `commands/status.ts` | `tracker/github-issues.ts` | `fetchIssues(tracker.repo, …, ctx.env)` at status.ts:33 | ✓ WIRED |
| `tracker/github-issues.ts` | `run.ts` | `env: NodeJS.ProcessEnv` threaded from `RunOptions` through `CommandContext` — the adapter has no ambient env access | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces real data | Status |
|----------|------|--------|--------------------|--------|
| `status` table rows | `StatusRow[]` | `statusRows(snapshot)` ← `loadSnapshot(loadFromFs(root))` ← `git ls-files` + real file reads | Yes — live run showed 3 real tickets with real lint counts (`0/3`, `0/6`) | ✓ FLOWING |
| `status` tracker column | `IssueFacts` | real `fetch` to `api.github.com/repos/{repo}/issues/{n}`, injectable for tests only (`fetchImpl` defaults to global `fetch`) | Yes — default path is the real network | ✓ FLOWING |
| `lint` findings | `LintResult` | `lintSnapshot(ctx.snapshot)` | Yes — 9 real findings with real line numbers | ✓ FLOWING |
| gate verdict | `GateResult` | `gateReady`/`gateDone(ctx.snapshot, id)` | Yes — real `fail` verdict with a pointer into config.yml | ✓ FLOWING |
| `new ticket` body | template text | `templates[name]` (generated module, not a stub) | Yes — 56-line ticket written with `@ac-1` intact | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite on Windows | `npm test` | 29 files, 707 tests passed, exit 0 | ✓ PASS |
| Lint clean | `npm run lint` | exit 0 | ✓ PASS |
| Typecheck clean | `npm run typecheck` | exit 0 | ✓ PASS |
| Ticket creation + `@ac-1` | `node dist/cli.js new ticket SPOT-1` | wrote file, `@ac-1` at line 44, exit 0 | ✓ PASS |
| Overwrite refusal | re-run of the above | `already exists - nothing was written`, exit 2 | ✓ PASS |
| Path-traversal id refusal | `new ticket ../evil` | refused, exit 2, no file | ✓ PASS |
| Version pin, five commands | pin set to `0.9.9` | stderr names both versions + fix, exit 2 each, stdout empty | ✓ PASS |
| Pin exemptions | `--version`, `--help` under mismatch | `0.1.0` / help, both exit 0 | ✓ PASS |
| Subdirectory run (D-103) | `status` from `sub/deep/` | full repository table | ✓ PASS |
| `--json` bare object | `lint --json`, `status --json`, `gate done --json` | `.findings` / bare array / bare `GateResult`, no wrapper | ✓ PASS |
| Gate exit 1 | `gate done LOGIN-1` on a fail verdict | exit 1 | ✓ PASS |
| ac_hash write notice | `gate ready LOGIN-1` | `wrote ac_hash fnv1a64:…` on stderr | ✓ PASS |
| mtime no-op invariant | `vitest run -t "a second consecutive run leaves the bytes and the mtime untouched"` | 1 passed | ✓ PASS |
| CRLF restore invariant | `vitest run -t "restores the ticket's own CRLF endings…"` | 1 passed | ✓ PASS |
| Spawn allowlist non-vacuity | replay of the scan against `src` + an injected `execFileSync('npx',…)` / `spawnSync('npm.cmd',…,{shell:true})` | real src: 4 sites, 0 offenders; injected: both flagged, shell flagged | ✓ PASS |
| **Table ASCII invariant** (re-verified) | same probe replayed against the rebuilt binary: `status` on a schema-valid ticket with `tracker: { shortcut: "Đăng—█" }` | cell rendered `shortcut: ng`; **0** code points above 127; U+2588 absent; row still present | ✓ PASS |
| Table ASCII, id vector (re-verified) | same probe replayed: `status` with a ticket file stem `Đăng-1.md` | `id` column rendered `ng-1`; **0** code points above 127 | ✓ PASS |
| Table ASCII, the new test's own sandbox | `status` on `UNI-1` (`shortcut: "Đăng—█💩"`) plus a ticket with file stem `Đ█-1` | 0 non-ASCII; no surrogate pair survives; all 6 table lines exactly 86 chars; `UNI-1` row rendered | ✓ PASS |
| Non-vacuity of the new test | reverted `table.ts:68` to `!(cp <= 0x1f \|\| cp === 0x7f)`, ran `vitest run packages/cli/test/status.test.ts` | **1 failed, 11 passed** — exactly `renders no character above code point 127`; source restored, sha256 verified byte-identical | ✓ PASS |
| Full suite after restore | `npm test` | 29 files, 708 tests passed, exit 0 | ✓ PASS |
| Lint / typecheck / build after restore | `npm run lint`, `typecheck`, `build` | all exit 0 | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` exist in this repository and no plan or summary declares a probe. Step 7c: SKIPPED (no probes declared or discoverable).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CLI-04 | 05-05 | `new ticket <id>` from the profile's template with tag scaffolding | ✓ SATISFIED | Criterion 1 above; `--type epic\|story\|bug` selects `epic.md` or `ticket-<profile>.md` from `config.profile` (new-ticket.ts:37-38), both profiles covered by tests. |
| CLI-05 | 05-01, 05-02, 05-03, 05-04, 05-06 | `lint`, `gate ready`, `gate done`, `status` with `--json` | ✓ SATISFIED | All four commands and `--json` verified; the `status` table's ASCII invariant is now enforced by the renderer and pinned by a discriminating test. |
| CLI-06 | 05-01 | CLI refuses to run when its version differs from the pin | ✓ SATISFIED | Criterion 3 above. |
| CLI-07 | 05-01, 05-04 | Runs on Windows and POSIX; never spawns `npm`, `npx`, or any `.cmd` | ✓ SATISFIED (POSIX leg pending CI) | The no-spawn half is fully verified and guarded non-vacuously. The POSIX half awaits the Ubuntu CI observation — an observation, not an implementation gap. |
| INTG-01 | 05-06 | `github-issues` adapter read-only over REST `fetch`, token from `gh auth token` or `GITHUB_TOKEN`; gates never consult it | ✓ SATISFIED | Criterion 5 above. |

**Orphaned requirements:** none. The union of `requirements:` across the six plans (CLI-04, CLI-05, CLI-06, CLI-07, INTG-01) is exactly the set REQUIREMENTS.md maps to Phase 5 — no ID is claimed that is not mapped, and none is mapped that no plan claimed.

**Note on the tick state:** REQUIREMENTS.md marks all five as `[x]` / `Complete` (lines 63-66, 94, 182-185, 204). CLI-05's tick has now caught up with its evidence. CLI-07's still runs slightly ahead of the Ubuntu observation — a state-file matter for the phase-completion step, not a code gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, "not yet implemented", or "coming soon" in any Phase 5 source or test file | ℹ️ Info | The one `PLACEHOLDER` hit is `const PLACEHOLDER = 'TICKET-ID'` in new-ticket.ts:16 — a named constant for the template token, not a stub. |
| `packages/cli/test/tracker.test.ts` | 430 | The deep-equality half of the token-invariance assertion is weak on its own | ℹ️ Info | `fakeFetch` returns the same body regardless of the `authorization` header, so a gate that *did* consult the tracker would still compare equal with and without the token. What makes the guard real is `expect(calls).toEqual([])` at line 435. The test is sound; the equality assertion alone is not the thing doing the work. |
| `packages/cli/test/spawn-surface.test.ts` | 18 | `SPAWN` covers `execFileSync\|execFile\|spawnSync\|spawn` but not `execSync` | ℹ️ Info | `child_process.execSync` runs through a shell by definition and would slip past the allowlist. Nothing in the tree uses it today (verified by grep), so this is a coverage limit of the guard, not a live defect. Bare `exec` is reasonably excluded — `\bexec\s*\(` would false-positive on `RegExp.prototype.exec`, which color.ts:15 uses; `execSync` has no such collision. |

### Human Verification Required

#### 1. Ubuntu CI leg of the spawn test

**Test:** Push the branch and read the `check` job matrix in `.github/workflows/ci.yml` for `ubuntu-latest` on Node 22 and 24.
**Expected:** Green on all four legs — the same 29 files / 707 tests that pass locally on Windows, including `packages/cli/test/bin.test.ts` spawning `dist/cli.js` under `process.execPath`.
**Why human:** The Ubuntu leg cannot be observed from this Windows host, and the phase is deliberately uncommitted so no CI run exists. The matrix is declared correctly (`os: [ubuntu-latest, windows-latest]`, `node: [22, 24]`, `fail-fast: false`, running build → lint → typecheck → test); only the observation is outstanding. This resolves itself on the first push and needs no code change.

### Re-verification: criterion 2 gap closure

The gap is closed. I replayed the orchestrator's evidence rather than accepting it, and it holds.

**The fix is right and minimal.** `packages/cli/src/render/table.ts:67-69` now reads `cp >= 0x20 && cp <= 0x7e`, the same predicate `ascii()` uses in `src/tracker/github-issues.ts:19` — the asymmetry that caused the gap is gone, and the comment above it records why a control-only scan left half the rule unenforced. `isControl` → `isPrintable` with the sense inverted at the call site is the clearer reading of the two.

**Both of my original reproductions now come back clean**, run against a binary I rebuilt myself (the `dist/` on disk predated the fix):

- The schema-valid ticket carrying `tracker: { shortcut: "Đăng—█" }` — still 0 lint errors — renders `shortcut: ng`. Zero code points above 127, U+2588 absent, row still rendered.
- The `Đăng-1.md` file stem renders `ng-1`. Zero code points above 127.

**The new test discriminates.** I reverted `table.ts:68` to the old control-only predicate and ran the status file: **1 failed, 11 passed**, and the one failure was exactly `renders no character above code point 127, whatever the ticket carries`. Source restored and confirmed byte-identical by sha256. (The orchestrator reported 12 others passing; the file holds 12 tests total, so the split is 1 + 11. Immaterial to the result.)

**On the deleted width assertion — the instinct to drop it was correct, and for a stronger reason than "it did not discriminate."** `sanitise` runs before `fit` at table.ts:83, and after `sanitise` no code point above `0x7e` can survive, so no surrogate pair ever reaches `padEnd` or `fit`. `.length` therefore equals the rendered column count by construction. A width assertion is not merely non-discriminating, it is unfalsifiable while the ASCII predicate stands — and if that predicate regressed, the ASCII assertion would fail first. Confirmed live: with `Đăng—█💩` in the sandbox, all six table lines are exactly 86 characters and no surrogate pair remains in the output. Worth knowing that the `sanitise`-before-`fit` ordering is load-bearing: `fit` slices at `budget - 3`, which would split a surrogate pair if one could reach it. That ordering is currently implicit.

**One consequence to be aware of, not a defect.** A non-ASCII id degrades to an unrecognisable stub in the table (`Đăng-1` → `ng-1`), because non-printables become spaces which `.trim()` then removes at the edges. That is the right trade against emitting box drawing, such a ticket already carries a lint error, and `--json` still carries the true id verbatim. But it does resolve the open question the executor raised in **05-04-SUMMARY.md finding 2**, which says *"stripping or escaping non-ASCII ids was rejected as mangling the user's own data"* and asks the owner to rule. The code now does the opposite of what that paragraph records, so the finding is stale and contradicts its own file. Worth correcting — it is a decision record.

**Correction to my initial report.** I wrote that the gap was "the kind a SUMMARY hides rather than states." That was wrong and unfair to the executor: 05-04-SUMMARY.md finding 2 stated the behaviour plainly and asked for an owner decision. What the summary got wrong was narrower — truth D4's table recorded the ASCII claim as verified on three refs that could not have tested it, while the findings section of the same document said the claim was a property of the data, not the renderer. The two halves disagreed; the miss was the disagreement, not concealment.

### Remaining item

One outstanding item, and it needs no code: the **Ubuntu CI leg**. I agree with the orchestrator's reading — it is `human_needed` context, not a gap. The matrix is declared correctly, the Windows leg passes here in full, and the observation resolves on first push.

On **CLI-05 and CLI-07 ticked `Complete` in REQUIREMENTS.md**: CLI-05 is now genuinely complete, so that tick has caught up with its evidence. CLI-07's tick still runs slightly ahead of the Ubuntu observation. I agree this is a state-file question for the phase-completion step rather than a code gap — recorded here only so it is not lost between the two steps.
---

_Verified: 2026-09-15T13:20:00Z_
_Verifier: Claude (gsd-verifier)_
