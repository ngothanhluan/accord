---
phase: 07-scaffolding-and-example-repo
plan: 07
subsystem: infra
tags: [ci, github-actions, shell, testing, mutation-testing, cross-platform]

# Dependency graph
requires:
  - phase: 07-scaffolding-and-example-repo
    plan: 03
    provides: "`workflowYml(pkgName, version)` and the `.github/workflows/accord.yml` entry of `initFiles` — the script this plan executes"
  - phase: 07-scaffolding-and-example-repo
    plan: 04
    provides: "the `src/` edits this plan's `npm run build` consumes, so the full-suite verify is not read over a half-written sibling"
  - phase: 07-scaffolding-and-example-repo
    plan: 06
    provides: "`examples/build` — the repository the two real-CLI cases read, and the only one in the tree that lints clean under the real binary"
  - phase: 07-scaffolding-and-example-repo
    plan: 01
    provides: "`makeEmptyRepo()`, `commitAll()`, `cleanup()` in `packages/cli/test/helpers/repo.ts`"
provides:
  - "`packages/cli/test/workflow-script.test.ts`: the emitted `run:` body EXECUTED under bash against six diff shapes, plus two mutation probes and two real-CLI runs"
  - "executed evidence for D-138 (no-ticket branch), A-09 (`--diff-filter=d`), the `[^/]+` level bound and A-10 (the `code` accumulator, both directions)"
  - "the first run of the shipped script driving the REAL built CLI rather than a stub — 07-03's F-3 gap closed"
affects: [07-08, 09-publish]

actuals:
  tokens: 3774   # chars/4 over 15,096 chars of realized diff (one new 309-line test file); see F-5
  tasks: 2
  commits: 0     # commits are forbidden in this project until the owner approves the diff
  plan_head_before: 53e9df94051d2b1fc66f2e50c895684b74ee6b72

tech-stack:
  added: []
  patterns:
    - "a shipped shell script is tested by lifting it out of the artifact that carries it and running it verbatim; interception happens in the ENVIRONMENT (a stub first on `PATH`), never by editing the text"
    - "a stub that forwards (`shift 2; exec node \"$ACCORD_CLI\" \"$@\"`) buys the real binary's argv and exit codes without buying the network"
    - "a mutation probe's `expect(mutated).not.toBe(original)` guard is NOT sufficient when the script documents its own flags in comments — `String.replace` takes the first match, and a mutated comment changes the text while changing nothing (F-1)"

key-files:
  created:
    - packages/cli/test/workflow-script.test.ts
  modified:
    - .planning/WINDOWS.md   # entry 13, plus the repair of 07-06's entry 12 (Deviation 4)
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "The suite is NOT platform-gated. It is gated on bash RESOLVING (`process.env.ACCORD_BASH ?? 'bash'`, probed once at module level), and a guard case sitting OUTSIDE the skipped describes fails on a POSIX host where the probe failed. It ran in full on this Windows host under Git/Cygwin bash 5.3.15 — the author's own machine executes the script rather than skipping past it (A-25, T-07-35)"
  - "`packages/cli/test/helpers/repo.ts` was NOT modified. The plan allowed adding a bare guarded `git(repo)` accessor; no case needs one, because `commitAll` returns the sha and `git add -A` stages a deletion, so the file-level changes are made with `node:fs` and every git invocation still goes through the existing helper"
  - "Two cases beyond the plan drive the real built CLI through a forwarding stub, because 07-03's F-3 named exactly that gap: a stub proves the shell logic, not that the real binary takes the arguments the script gives it. `accord lint` is confirmed to exit 0 on a clean repository and `accord gate done SIGNUP-1` to exit 1 on a failing one, both reaching the accumulator as the script assumes"
  - "Both describes carry `{ timeout: 60_000 }`. Each case spawns git twice and bash once; under a full parallel `npm test` on Windows the first case overran vitest's 5 s default. A generous budget over a flaky case, which is the kind someone eventually deletes"

requirements-completed: []   # CLI-02 was ticked by 07-03; this plan strengthens it, it does not close a new one

coverage:
  - id: D1
    description: "The emitted `run:` body is executed under bash, not inspected — the branch, the filter, the loop and the exit-code accumulator all run"
    requirement: CLI-02
    verification:
      - kind: e2e
        ref: "packages/cli/test/workflow-script.test.ts — 11 cases, all executing the lifted script"
        status: pass
    human_judgment: false
  - id: D2
    description: "Docs-only diff: exits with whatever `lint` returned, prints the one line naming why there is nothing to gate, and makes no gate invocation (D-138)"
    requirement: CLI-02
    verification:
      - kind: e2e
        ref: "workflow-script.test.ts#docs-only diff: says why there is nothing to gate, exits with lint's code, gates nothing (D-138)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ticket-adding diff: one `gate done <id>` invocation with the id taken from the file name, and no nothing-to-gate line (D-137)"
    requirement: CLI-02
    verification:
      - kind: e2e
        ref: "workflow-script.test.ts#ticket-adding diff: gates that ticket by the id in its file name (D-137)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ticket-deleting diff: NO gate invocation for the removed ticket (A-09)"
    requirement: CLI-02
    verification:
      - kind: e2e
        ref: "workflow-script.test.ts#ticket-deleting diff: does not gate the ticket the pull request removes (A-09)"
        status: pass
      - kind: e2e
        ref: "workflow-script.test.ts#mutation probe — with `--diff-filter=d` removed from the git line, `gate done OLD-1` IS recorded"
        status: pass
    human_judgment: false
  - id: D5
    description: "A nested path under `accord/tickets/<id>/` is not gated — the `[^/]+` level bound executed"
    requirement: CLI-02
    verification:
      - kind: e2e
        ref: "workflow-script.test.ts#nested-path diff: accord/tickets/<id>/verification.md is not a ticket ([^/]+)"
        status: pass
      - kind: e2e
        ref: "workflow-script.test.ts#mutation probe — with `[^/]+` widened to `.+`, a second invocation IS recorded"
        status: pass
    human_judgment: false
  - id: D6
    description: "A failing gate sets the exit code to 1 while `lint` still ran first, and a failing `lint` does not prevent the gates from running (A-10)"
    requirement: CLI-02
    verification:
      - kind: e2e
        ref: "workflow-script.test.ts#a failing gate exits 1 and lint still ran first (A-10)"
        status: pass
      - kind: e2e
        ref: "workflow-script.test.ts#a failing lint exits 1 and the gates still ran (A-10, the other direction)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The script under test is lifted from `initFiles(...)`'s workflow entry; there is no second copy of the script anywhere"
    requirement: CLI-02
    verification:
      - kind: unit
        ref: "workflow-script.test.ts#scriptOf — `initFiles` -> `parse` -> the ONE step carrying `run`, asserted `toBe(1)`; the file carries no multi-line shell literal"
        status: pass
    human_judgment: false
  - id: D8
    description: "The real built CLI takes the arguments the script gives it and returns the exit codes the script assumes (07-03 F-3)"
    requirement: CLI-02
    verification:
      - kind: e2e
        ref: "workflow-script.test.ts#docs-only diff, real accord lint: the job goes green and reports why it gated nothing"
        status: pass
      - kind: e2e
        ref: "workflow-script.test.ts#ticket-touching diff, real accord gate done: the id is one the binary knows, its failure is the job's"
        status: pass
    human_judgment: false
  - id: D9
    description: "Nothing reaches the network and no git command runs outside a temporary sandbox (T-07-31, T-07-34)"
    requirement: CLI-02
    verification:
      - kind: other
        ref: "`grep execFileSync('git'` over the test file returns nothing; every invocation is recorded in the per-case log and asserted by count"
        status: pass
      - kind: other
        ref: "plan verification item 3 (re-run with the network disconnected) NOT performed — see F-3"
        status: partial
    human_judgment: true
    rationale: "The invocation-count assertion is indirect evidence of no network use; an actual disconnected run was not attempted."

duration: 28min
completed: 2026-09-18
status: complete
---

# Phase 7 Plan 07: the emitted workflow script, executed Summary

**The `run:` body a user's repository receives is no longer a string the tests grep — it is lifted out of the emitted YAML and RUN under bash against six diff shapes, with two mutation probes proving the outcomes are caused by the script's own flags and two cases driving the real built CLI instead of a stub.**

## Performance

- **Duration:** ~28 min
- **Tasks:** 2 of 2
- **Files:** 1 created, 0 modified

## The line that had never been seen

ROADMAP criterion 2's second half is "reports a job result on docs-only and no-ticket diffs". This is that result, the exact stdout of the docs-only run, verbatim:

```
no ticket file changed in this pull request - nothing to gate
```

Exit code 0. One invocation recorded: `--yes @accord-dev/accord@0.1.0 lint`.

## Accomplishments

- **Eleven cases, all executing the shipped script.** `initFiles({name, version})` → the `.github/workflows/accord.yml` entry → `parse` → the single step carrying a `run` key (asserted `toBe(1)`, so a future split into two `run:` steps fails loudly rather than silently testing half the script). The text is written to `script.sh` in the sandbox and run as a file, never through `bash -c` — the script's own quoting is part of what is under test. The test file contains no shell literal of its own.
- **The script runs VERBATIM; interception is environmental.** A `#!/bin/sh` stub named `npx`, first on `PATH`, appends `"$*"` to a log and chooses its exit code from an environment variable naming the last argument to fail on. No substitution, no line deletion, no network. `PATH` is built into the `env` object handed to `execFileSync`; `process.env` is never mutated, so a parallel test file cannot inherit the stub (T-07-32).
- **`BASE` travels the way the runner supplies it.** Passed through the environment, exactly as the emitted `env:` mapping does — T-07-11's mitigation exercised rather than described.
- **Both accumulator directions are now facts.** A failing gate: exit 1, with the `lint` invocation recorded first. A failing lint: exit 1, with the `gate done SIGNUP-1` invocation still recorded. That is what A-10 bought by choosing `set -uo pipefail` over `set -e`, and it had never run.
- **The two mutation probes make the suite falsifiable.** Removing `--diff-filter=d` from the git line turns the deletion case from one invocation into two, the second `gate done OLD-1`. Widening `[^/]+` to `.+` turns the nested-path case from one into two. Both mutations are string replacements on the lifted text, never written back to `workflow.ts`, and each asserts the replacement changed the string before the variant runs.
- **07-03's F-3 gap is closed.** Two cases swap the recording stub for a forwarding one (`shift 2; exec node "$ACCORD_CLI" "$@"`), so the real `dist/cli.js` runs. Observed, on the shipped `examples/build`: `accord lint` prints `0 errors, 0 warnings` and exits 0, the script then prints the nothing-to-gate line and the job goes green end to end; and with the ticket in the diff, `accord gate done SIGNUP-1` runs for real, reports `gate.tick-stale-commit` and `gate.stale-review` against the example's placeholder tick sha, exits 1, and the script exits 1 with lint still clean beside it. No `gate.ticket-unknown` — the id derived from the file name is an id the binary knows.

## Task Completion

**No commits were made.** This project forbids `git commit` until the owner has reviewed the diff (global CLAUDE.md critical rule, restated as a hard override in the execution brief). HEAD is still `53e9df9`. Sandbox repositories under `fs.mkdtemp` do of course commit — the script reads a diff, so it needs real commits — and every one of those calls is `cwd`-scoped through the existing `gitIn` guard, which throws if the target is not under `tmpdir()`. Per-task completion, tracked here instead of in git history:

1. **Task 1 — lift the script out of the emitted workflow and run it against the diff shapes** — complete. Ten cases: the guard case, six diff/failure shapes, and the three real-CLI cases (one of which is the built-binary guard). All eight of Task 1's acceptance criteria hold, including the one that matters most: the bash-resolution guard case sits OUTSIDE both `describe.skipIf(noBash)` blocks (T-07-35).
2. **Task 2 — the mutation probe** — complete. One case, two mutations, each asserting it changed the text and then asserting the recorded invocation count flips. `packages/core/src/scaffold/workflow.ts` is byte-identical to what 07-03 left.

## Files Modified

- `packages/cli/test/workflow-script.test.ts` *(new, 15,096 bytes, 309 lines)* — the whole plan. Module header records the three properties that make the assertions mean what they say; `scriptOf`, `write`, `sandbox` and `runScript` are the only local helpers.

Nothing else under any package. `packages/cli/test/helpers/repo.ts` was left alone (see Deviation 1), and no file under any `src/` was touched by this plan. The three `.planning/` files are tracking updates: `WINDOWS.md` (entry 13 plus the repair in Deviation 4), `STATE.md` and `ROADMAP.md`.

## The platform-gating decision, stated loudly

**The suite is not platform-gated, and it ran in full on Windows.**

- Gating is on `bash` *resolving*, not on `process.platform`. `BASH` is `process.env.ACCORD_BASH ?? 'bash'`, probed once at module level with `bash -c 'exit 0'`; a failed probe sets `noBash` and the two executing describes are `describe.skipIf(noBash)`.
- The guard case — `is a multi-line script lifted from the emitted document, and bash resolved` — sits OUTSIDE both describes and asserts `noBash === false` whenever `process.platform !== 'win32'`. So the `ubuntu-latest` CI leg can never report green having executed nothing (T-07-35). On Windows, a host without Git Bash skips the execution and the guard still checks that a script was lifted.
- On this host the probe resolved `GNU bash 5.3.15(1)-release (x86_64-pc-cygwin)` and all eleven cases executed. The rejected alternative — `skipIf(process.platform === 'win32')` — would mean the author who wrote the script never runs it locally, which is the same failure this plan exists to fix, one level up (A-25).
- `ACCORD_BASH` is the calibration knob for the one environmental case that would otherwise fail for the wrong reason: a Windows `PATH` that resolves `bash` to the WSL shim, which sees a different filesystem.

A WINDOWS.md entry is still recorded, for the narrower reason that applies to every suite in this phase: the POSIX leg has never run, because nothing is committed and CI has not seen this file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking, resolved by not doing it] The plan's conditional `git(repo)` helper addition was unnecessary**

- **Found during:** Task 1
- **Issue:** The plan declares `packages/cli/test/helpers/repo.ts` in `files_modified` and instructs "if the helper does not already export a bare `git(repo)` accessor, add one". It does not export one — `gitIn` is module-private.
- **Fix:** None needed, and none made. Every sandbox mutation this suite needs is a file write or a file deletion, both done with `node:fs`, and `commitAll` already stages deletions (`git add -A`) and returns the sha the script needs as `BASE`. Adding an export no case would call is the abstraction the project's simplicity rule forbids.
- **Files modified:** none.
- **Verification:** `grep "execFileSync('git'" packages/cli/test/workflow-script.test.ts` returns nothing; the suite is green.

**2. [Rule 3 — Blocking] Two cases beyond the plan's list, driving the real CLI**

- **Found during:** Task 1
- **Issue:** The plan's A-24 settles on a stub for all cases. 07-03's own F-3 records that a stub proves the shell logic and not the binary's contract, and the execution brief names that gap as this plan's deliverable.
- **Fix:** A `forward` mode on the stub, used by two cases over a copy of `examples/build`. It is not a substitution: the script text is still byte-identical, the interception is still `PATH`-level, and the registry is still never reached.
- **Files modified:** `packages/cli/test/workflow-script.test.ts` only.
- **Verification:** both cases pass, and the assertions name what the real binary did (`0 errors, 0 warnings`, exit 1, no `gate.ticket-unknown`).

**3. [Rule 3 — Blocking] `{ timeout: 60_000 }` on both executing describes**

- **Found during:** the full-suite verify
- **Issue:** Each case spawns git twice (`commitAll` × 2) and bash once. In isolation the file runs in ~8 s; under a full parallel `npm test` on Windows the first case exceeded vitest's 5 s default and failed as a timeout. The same shape as the `purity.test.ts` flake already recorded in STATE.md.
- **Fix:** A 60 s budget on both describes.
- **Verification:** `npm test` — 36 files, 872 tests, 872 passed.

**4. [Rule 3 — Blocking] `.planning/WINDOWS.md` was internally inconsistent and refused every append**

- **Found during:** state updates
- **Issue:** 07-06's entry 12 exists in the ledger's JSON block but never reached the Markdown table or the frontmatter counts, so `gsd-tools windows append` refused with `Ledger counts disagree with entries: frontmatter open/waived/fixed/total=10/0/1/11 but entries yield 11/0/1/12`. No new entry could be recorded until it was reconciled.
- **Fix:** Entry 12's table row written from its own JSON record, this plan's entry added as 13 to both the table and the JSON, counts updated to 12 open / 0 waived / 1 fixed / 13 total. `gsd-tools windows status` reads the file cleanly afterwards.
- **Files modified:** `.planning/WINDOWS.md`.
- **Verification:** `node gsd-tools.cjs windows status` returns the full ledger with no error.

---

**Total deviations:** 4, all Rule 3. None touches production source; `git status --porcelain` names no file under any `src/` from this plan.

## Findings

**F-1 — the plan's mutation-probe guard is not sufficient for a script that documents its own flags, and this was caught by a RED rather than by the guard.** The plan prescribes `assert the replacement actually changed the string before running it — a replace that matched nothing would make the probe pass for the wrong reason`. The emitted script names both `--diff-filter=d` and `[^/]+` in its own explanatory comments, which sit *above* the lines that use them, and `String.prototype.replace` with a string pattern replaces the FIRST match. The first draft's `replace(' --diff-filter=d', '')` therefore mutated the comment: the guard passed (the string did change), the behaviour did not change, and the probe failed on its outcome assertion instead. Resolution: each pattern now carries enough of the command around it to be unique to the command line (`'--name-only --diff-filter=d '`, and the whole quoted grep pattern). **Recorded as a finding and not only as a fix, because the guard the plan specifies would have let a silently-inert probe through in a script whose comments did not sit above the code** — the failure mode Task 2 exists to rule out, reached by a different route than the one anticipated.

**F-2 — `$'` in a `String.replace` replacement string is a substitution pattern, and the grep pattern ends with it.** The second probe's replacement literal is `'^accord/tickets/.+[.]md$'`. In a string replacement, `$'` means "the portion of the string following the match", so JavaScript spliced the rest of the script into the middle of the grep argument and bash reported `unexpected EOF while looking for matching '`. Resolution: a function replacer (`() => "..."`), which takes no substitution patterns. Worth recording because any future test mutating this script will hit it — every regex in the script is anchored with `$`, so every replacement built from one carries `$'` or `$"`.

**F-3 — plan verification item 3 (re-run with the network disconnected) was NOT performed.** The claim "nothing reaches the network" rests on two pieces of indirect evidence instead: the stub shadows `npx` on `PATH` and every case asserts an exact invocation count, so a case where the real `npx` ran would show an unrecorded invocation (and would take an order of magnitude longer than the observed 8 s for the whole file). That is strong but it is not the stated check. Recorded rather than quietly treated as done; the owner can run it in one command if they want the direct evidence.

**F-4 — a real PASSING `gate done` through the real binary is not reachable from this suite, and the green half is proven only by the docs-only case.** `examples/build` carries the synthetic short sha `1234567` in its tick fields (A-21, 07-06), and no git repository can be made to have that as HEAD. So the real-CLI ticket case necessarily exercises a FAILING gate. What that does prove is exactly what 07-03's F-3 asked for — the argv shape the script builds is accepted, the id derived from the file name is recognised, the non-zero exit reaches the accumulator. What remains unproven end to end with the real binary is a `gate done` that returns 0 inside the script. 07-08 owns the examples CI job; if it wants that evidence it will need a sandbox whose tick shas are rewritten to the sandbox's own HEAD, which is the inverse of what 07-06's suite does in memory.

**F-5 — the `actuals.tokens` vs `estimate.tokens` scale gap, now four times in this phase.** 15,096 characters of realized diff, so ~3,774 tokens on the `chars/4` scale the SUMMARY contract specifies, against an estimate of 40,000 — a ~10.6x gap, in line with 07-01's and 07-02's ~10x and narrower than 07-03's ~22x. Recorded honestly rather than rounded toward the estimate.

**F-6 — this suite is the first thing in the repository that needs `bash`, and `npm test` now fails differently on a Windows host without Git Bash.** It does not fail: it skips the two describes and passes the guard case. That is the intended behaviour and it is stated in the code, but it means a contributor on a bare Windows box gets a green `npm test` over nine unrun cases with no warning louder than the vitest skip marker. The POSIX guard makes CI honest; nothing makes a local Windows run loud. Flagged rather than fixed — the alternative (failing on a host without bash) would make `npm test` fail for a reason unrelated to a contributor's change.

## Known Stubs

The `npx` stub is a throwaway shell file written into a temporary sandbox per case, not a repository artifact. It is the mechanism under A-24, not a placeholder: two of the eleven cases run the real binary through it. No stub in this plan stands in for unwritten production code.

## Threat Flags

None. This plan adds no production source, no dependency, no network call and no new file-access pattern in accord itself. The register's five threats (T-07-31 through T-07-35) are each mitigated as the plan specifies, and T-07-35's mitigation — the guard case outside the skipped describes — is the one that is checked by the suite itself.

## Issues Encountered

An environment variable set to a value containing a NUL byte (a sentinel chosen so no invocation's last argument could ever equal it) makes `execFileSync` fail before the shell starts, with a thrown error carrying no `status` — so every case reported an exit code of `-1` and no output. NUL is not representable in a process environment on either platform. The sentinel is now ordinary text.

## Verification Results

Run from the repository root, Windows 11, Node 24, GNU bash 5.3.15 (cygwin):

| Check | Result |
|---|---|
| `npm run build` | clean |
| `npm run lint` | clean, exit 0 |
| `npm run typecheck` | clean, exit 0 (core, core tests, cli) |
| `npm test` | **36 files, 872 tests, 872 passed, 0 failed** (baseline was 35 files / 861 tests; +1 file, +11 cases) |
| `npx vitest run --project cli workflow-script` | 11 passed, 0 skipped, ~8.5 s |
| cases skipped on this host | none |
| docs-only run, stdout | `no ticket file changed in this pull request - nothing to gate`, exit 0, 1 invocation |
| ticket-adding run | exit 0, 2 invocations, second `--yes @accord-dev/accord@0.1.0 gate done SIGNUP-1` |
| ticket-deleting run | exit 0, 1 invocation (A-09) |
| nested-path run | exit 0, 1 invocation (`[^/]+`) |
| failing gate | exit 1, 2 invocations recorded (A-10) |
| failing lint | exit 1, 2 invocations recorded, gate still ran (A-10) |
| probe: `--diff-filter=d` removed | 2 invocations, second `gate done OLD-1` — the flag is the cause |
| probe: `[^/]+` widened to `.+` | 2 invocations — the bound is the cause |
| real CLI, docs-only | `0 errors, 0 warnings`, nothing-to-gate line, exit 0 |
| real CLI, ticket in diff | real `gate done SIGNUP-1`, exit 1, no `gate.ticket-unknown`, lint clean |
| `grep "execFileSync('git'" workflow-script.test.ts` | no match — every git call goes through the guarded helper |
| `git status --porcelain` under any `src/` | nothing from this plan |
| `git rev-parse --short HEAD` | `53e9df9` — unchanged, no commit made |
| network disconnected re-run | **not performed** (F-3) |

Plan verification item 4 (`git status --porcelain packages/core/src packages/cli/src` is empty) is unreachable in this working tree — Phase 6 and plans 07-01..07-06 are uncommitted by design. The narrower claim it encodes holds and was checked instead: **this plan touched no file under any `src/`**, and `packages/core/src/scaffold/workflow.ts` is byte-identical to what 07-03 left. Same handling as 07-03 F-4, 07-04 and 07-06.

## Self-Check: PASSED

`packages/cli/test/workflow-script.test.ts` exists (309 lines) and its suite reports 11 passed / 0 skipped on this host. The guard case is at file scope in a describe of its own, above both `describe.skipIf(noBash)` blocks. The full suite is green at 872/872 — no claim in this document is made over a red test. The two findings about the mutation probe (F-1, F-2) describe RED states that were seen and resolved, not states that are still red. No commit hashes to verify: commits are forbidden in this project until the owner approves the diff, so the whole plan is in the working tree.

## User Setup Required

None on a POSIX host. On Windows, the two executing describes need a `bash` on `PATH` — Git for Windows supplies one. If `PATH` resolves `bash` to the WSL shim, set `ACCORD_BASH` to the Git Bash executable; otherwise the cases fail for an environmental reason rather than a real one.

## Next Phase Readiness

- **07-08 inherits a runnable script, not a readable one.** The examples CI job it adds will run the two commands against examples that have tickets; the branch it never reaches is now covered here.
- **Open for 07-08 or the owner:** F-3 (the disconnected-network run), F-4 (a real *passing* `gate done` inside the script is not reachable without rewriting the example's synthetic tick sha), F-6 (a bare Windows box skips nine cases quietly).
- **Carried, unchanged:** WINDOWS.md entries 8, 9, 10 and 11, plus the new entry for this suite's unrun POSIX leg.

---
*Phase: 07-scaffolding-and-example-repo*
*Completed: 2026-09-18*
