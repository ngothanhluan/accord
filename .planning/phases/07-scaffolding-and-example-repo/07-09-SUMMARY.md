---
phase: 07-scaffolding-and-example-repo
plan: 09
subsystem: cli
tags: [accord-init, version-pin, idempotency, scaffolding, vitest]

# Dependency graph
requires:
  - phase: 07-scaffolding-and-example-repo
    provides: "`accord init` (07-01, 07-02), the shared `assertNoLink` write guard (07-01), the emitted CI workflow (07-03), the AGENTS.md/CLAUDE.md pointer (07-04)"
  - phase: 06-skills
    provides: "`writeSkillFiles` and the `skillTargets` roster it writes (D-131)"
provides:
  - "`accord init` takes every refusal a repository can make BEFORE its first write whenever `accord/config.yml` is already on disk — a repository pinned to another release now receives no byte"
  - "A single `refusals()` local in `init.ts` holding all three refusals (config-unreadable, pin mismatch, skill-target link), with two call sites and no third"
  - "A report printed on the throw path, through the same renderer the success path uses, so the one remaining partial-run path (greenfield skill-target guard) is auditable instead of silent"
  - "`listAll(repo)` in `init.test.ts` and a `refuses` helper that asserts whole-tree before/after equality rather than two `existsSync` calls"
affects: [08-mcp-server, 09-publish-and-dogfood]

actuals:
  tokens: 8272        # chars/4 over the two files actually changed (33,087 chars)
  tasks: 2
  commits: 0          # uncommitted by project rule — see "Task Commits" below

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One refusal function, two call sites: an ordering invariant is held by a single callable, not by three adjacent checks"
    - "Whole-tree before/after equality as the regression oracle for a 'wrote nothing' claim, in place of per-directory existence checks"
    - "A report renderer named as a local so the throw path and the success path cannot print different reports"

key-files:
  created: []
  modified:
    - packages/cli/src/commands/init.ts
    - packages/cli/test/init.test.ts

key-decisions:
  - "`refusals()` returns the guarded `SkillFile[]` rather than the loaded snapshot — the plan said snapshot; returning the targets it already had to compute for its own `assertNoLink` pre-pass avoids both a second `skillTargets` call and a non-null assertion on `snapshot.config` after the guard"
  - "The pre-write call site is gated on `lstatSync('accord/config.yml')`, not on the `accord/` folder — `accordFiles` needs the folder and a config inside it implies one, so a pre-existing config is exactly the condition under which the load resolves before the first byte"
  - "The final `ctx.stdout.write(rendered())` sits OUTSIDE the try, so a throw cannot make the success path print twice; catch-and-rethrow was kept over a `finally` because the plan's acceptance criterion names both call sites"
  - "`guard.ts` was not edited (A-31). The `nothing was written` clause is false on exactly one path and true for `skills sync`, which shares the message; the residual is recorded as a finding and a ledger entry rather than fixed here"

patterns-established:
  - "Pattern: a containment claim over an uncommitted tree is proven by a before/after content-hash snapshot taken at plan start, never by `git status` — Phases 6 and 7 are entirely uncommitted, so the index is not a picture of the tree the plan started from"

requirements-completed: [CLI-01]

coverage:
  - id: D1
    description: "A repository whose `accord/config.yml` pins another version receives no byte from `accord init`; it exits 2 naming both versions and its whole-tree listing is identical before and after"
    requirement: "CLI-01"
    verification:
      - kind: unit
        ref: "packages/cli/test/init.test.ts#refuses a repository pinned to another version, before any skill write (D-95, T-07-08)"
        status: pass
      - kind: manual_procedural
        ref: "node packages/cli/dist/cli.js init in a sandbox pinned to 0.0.1 — before/after `find | sha256sum` diff exit 0 (transcript below)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A repository whose `accord/config.yml` cannot be parsed exits 2 naming `run accord lint`, and its whole-tree listing is identical before and after"
    requirement: "CLI-01"
    verification:
      - kind: unit
        ref: "packages/cli/test/init.test.ts#refuses a config that is not valid YAML, naming lint (the skills sync precedent)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The greenfield contract is unchanged line for line — 28 `created` paths, exit 0, in `initFiles` then `skillTargets` then `POINTER_FILES` order (A-32)"
    requirement: "CLI-01"
    verification:
      - kind: unit
        ref: "packages/cli/test/init.test.ts#runs in a repository with no accord/ folder, writes the whole contract, and exits 0 (whole-stdout `toBe`, unmodified)"
        status: pass
      - kind: manual_procedural
        ref: "node packages/cli/dist/cli.js init in an empty git sandbox — 28 created lines, exit 0, empty stderr"
        status: pass
    human_judgment: false
  - id: D4
    description: "The one refusal that still lands after a write — the greenfield skill-target `assertNoLink` pre-pass — prints the four `created` scaffold lines on stdout before the error propagates, and still exits 2"
    requirement: "CLI-01"
    verification:
      - kind: unit
        ref: "packages/cli/test/init.test.ts#prints what it wrote before the skill-target guard refuses (D-133)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The reordered `init.ts` reads as one thing that happens in one place, not three checks that happen to be adjacent (plan verification item 4)"
    verification: []
    human_judgment: true
    rationale: "A prose-quality judgment about whether the single `refusals()` local actually reads as one invariant; no test can assert it"

# Metrics
duration: 13 min
completed: 2026-09-18
status: complete
---

# Phase 7 Plan 09: Every refusal before the first byte Summary

**`accord init` now takes all three of its refusals — unreadable config, wrong pin, occupied skill path — inside one `refusals()` local called before the scaffold write loop whenever `accord/config.yml` already exists, so a repository pinned to another release receives no byte; and the one remaining post-write refusal prints what it wrote through the same renderer the success path uses.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-18T12:00:40Z
- **Completed:** 2026-09-18T12:13:41Z
- **Tasks:** 2 (both `tdd="true"`; Task 1 was the phase's tracer)
- **Files modified:** 2 source/test files, plus `.planning/WINDOWS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` and this summary

## Accomplishments

- **Gap 1 closed.** `packages/cli/src/commands/init.ts` hoists the `config === undefined` throw, the `pinMessage` throw and the `skillTargets` + `assertNoLink` pre-pass into one `refusals()` local, called before the scaffold write loop when `lstatSync('accord/config.yml')` reports the file already on disk, and after the loop (once, reusing the first result) when it does not. A repository pinned elsewhere now receives nothing: no `.github/workflows/accord.yml`, no `accord/product/*.md`, no pointer files. D-135's two-pin equality survives the command, not only `initFiles`.
- **The regression is held by a tree equality, not an existence check.** `refuses` in `packages/cli/test/init.test.ts` now captures `listAll(repo)` — every repo-relative path except `.git`, sorted, forward-slash — before the run and asserts equality after it, with the message `init wrote before it refused`. The old helper asserted only that `.claude/skills` and `.agents/skills` were absent, which is precisely why the gap shipped green.
- **The one unhoistable refusal is auditable.** On a greenfield run the roster is decided by the `config.yml` the run is about to write, so the skill-target guard cannot precede the scaffold loop (A-30). That region is now wrapped in a `try`; the `catch` writes `rendered()` to stdout and rethrows the original error untouched, so `run.ts` still maps the `UsageError` to exit 2 and the four written paths are named.
- **The greenfield contract did not move.** The whole-stdout `toBe` assertion at `init.test.ts:92-94` still passes unmodified — same 28 lines, same order — and the real binary still prints 28 `created` lines and exits 0 in a fresh sandbox.

## Task Commits

**uncommitted (project CLAUDE.md: owner reviews the diff before any commit)**

No `git commit`, `git add`, `git stash` or any other mutating git command was run. The working tree carries the change, unstaged, alongside the rest of the uncommitted Phases 6 and 7.

Files this plan changed, in place of commit SHAs:

1. **Task 1 (tracer): every refusal a repository can make, before the first byte** — `packages/cli/test/init.test.ts` (new `listAll`, widened `refuses`), `packages/cli/src/commands/init.ts` (the `refusals()` local, the pre-write call site, the `guarded ?? refusals()` fallback, the falsified "safe now and only now" comment replaced).
2. **Task 2: a partial run is printed, not silent** — `packages/cli/test/init.test.ts` (new `accord init — a refusal that lands after a write` describe), `packages/cli/src/commands/init.ts` (the named `rendered()` local, the `try`/`catch` around the write region, the success write moved outside the try).

Plan metadata (also uncommitted): this summary, `.planning/WINDOWS.md` entries 15 and 16, `.planning/STATE.md`, `.planning/ROADMAP.md`.

## Files Created/Modified

- `packages/cli/src/commands/init.ts` — the reorder and the report-on-throw. Net shape: two pre-passes (scaffold paths, pointer files) → `refusals()` defined → `guarded` taken when a config already exists → `results` + `rendered()` → `try { scaffold loop; skill copies; pointer loop } catch { print, rethrow }` → print, return 0.
- `packages/cli/test/init.test.ts` — `listAll(repo)` helper; `refuses` widened to a whole-tree before/after equality while keeping its two `existsSync` assertions; one new case in a new `accord init — a refusal that lands after a write` describe.
- `.planning/WINDOWS.md` — entries 15 (the A-31 `guard.ts` wording residual) and 16 (the unrun POSIX leg for the new and widened cases).

## Decisions Made

1. **`refusals()` returns `SkillFile[]`, not the snapshot.** The plan specified "the loaded snapshot as its return value". The function must compute `skillTargets(snapshot.config)` anyway — that list is what its own `assertNoLink` pre-pass walks — so returning the snapshot would have forced either a second `skillTargets` call at the write site or a non-null assertion on `snapshot.config` after the guard had already proven it defined. Returning the targets threads one value and keeps `skillTargets` reached from the snapshot on disk (D-131) inside the function. Recorded as a deviation below.
2. **The pre-write gate is `lstatSync` on `accord/config.yml`, per the plan's key_links.** The `accord/` folder alone is not enough to know the load will resolve usefully, and `assertNoLink` over `files` has already refused a `config.yml` that is not a regular file, so by the time the gate runs the only two states are "regular file" and "absent".
3. **Catch-and-rethrow rather than `finally`.** A `finally { ctx.stdout.write(rendered()); }` would have been one line shorter and would have made "printed exactly once, on both paths" structural instead of an agreement between two call sites. It was rejected because the plan's acceptance criterion names the renderer as "referenced from both the catch and the success write", and because a `finally` swallows the distinction between the two paths at the exact place a reader is trying to see it.
4. **`guard.ts` untouched (A-31, A-32 honoured).** Verified by content hash, not by the index — the file is untracked, so `git diff` on it is empty whether or not it was edited.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's hand-verification sandbox needs `git init` after all**

- **Found during:** plan `<verification>` item 2
- **Issue:** The plan says of the throwaway sandbox "no `git init` needed". It is needed. `refusals()` → `loadFromFs` → `gitTree` runs `git ls-files` first and throws `not a git repository (or git failed)` before `accordFiles` is ever reached, so without a repository the run exits 2 on the wrong refusal. The tree-equality claim would still have held, but the transcript would not have shown the pin message the gap is about.
- **Fix:** `git init -q` in both sandboxes. Nothing in source changed.
- **Verification:** the transcript below shows the `config.yml pins accord 0.0.1, running 0.1.0` message, which is the refusal the gap names.
- **Committed in:** n/a — uncommitted.

**2. [Rule 1 - Plan/code mismatch] `refusals()` returns the guarded targets, not the snapshot**

- **Found during:** Task 1
- **Issue:** The plan's stated return value (the snapshot) forces either a duplicate `skillTargets` call or a redundant narrowing of `snapshot.config` at the call site.
- **Fix:** return `SkillFile[]`. Every constraint the plan attached to this survives: one function, two call sites, `skillTargets` reached from the snapshot the function loaded, refusal strings verbatim.
- **Verification:** `npm run typecheck` clean; all 27 `init` cases and the whole 879-test suite pass; `pinMessage` has exactly one call site and `run accord lint` exactly one occurrence in `init.ts`.
- **Committed in:** n/a — uncommitted.

---

**Total deviations:** 2 (1 blocking, 1 plan/code mismatch). Neither widened scope: `files_modified` is exactly the two files the plan named, and `packages/core` is byte-identical to its plan-start baseline.
**Impact on plan:** none on the delivered behaviour. Both are recorded because the plan text, not the code, was wrong.

## Verification

All four run from `C:/Work/accord`, after the edits, in this order.

```
npm run build      → exit 0
npm run lint       → exit 0 (eslint, no output)
npm run typecheck  → exit 0 (core, core tests, cli)
npx vitest run     → 36 test files, 879 tests, all passing
```

Baseline handed over by the orchestrator was 36 files / 878 tests. The delta is exactly the one case
this plan adds; the two widened `refuses` cases were already counted.

Per-task gates:

- `npx vitest run --project cli init` — 27 passed (was 26 before Task 2's case).
- `npx vitest run --project cli` — 13 files, 183 passed, including `skills-sync` (shares `assertNoLink`) and `spawn-surface` (scans `init.ts`, and drives `init` on the D-132 branch of the `valid-build` fixture).

Containment guard, against the baseline taken before the first edit:

```
$ find packages/core -type f -not -path '*/node_modules/*' -not -path '*/dist/*' \
    | sort | xargs sha256sum | diff -u /tmp/07-09-core-before.txt -
(no output, exit 0)          # 299 files, nothing under packages/core changed

$ git hash-object packages/cli/src/guard.ts | diff -u /tmp/07-09-guard-before.txt -
(no output, exit 0)          # dd530029a0411f4ca6c9f7909fc06b1709624d0f, A-31 honoured
```

### RED evidence

Both tasks went RED before their implementation, for the stated reason:

- **Task 1.** With `refuses` widened and `init.ts` untouched, both refusal cases failed with
  `AssertionError: init wrote before it refused: expected [ Array(8) ] to deeply equal [ 'accord', 'accord/config.yml' ]`,
  the diff naming `.github`, `.github/workflows`, `.github/workflows/accord.yml`, `accord/product`,
  `accord/product/business-rules.md`, `accord/product/glossary.md` — the reproduction from
  07-VERIFICATION.md, now as a test failure. 2 failed | 24 passed.
- **Task 2.** With the new case and no `try`/`catch`, it failed with `expected [] to deeply equal [ …(4) ]` —
  received stdout empty, which is the `fails_when` the plan named. 1 failed | 26 passed.

### Sandbox transcript — the pinned-elsewhere repository

The exact reproduction 07-VERIFICATION.md carried, re-run against the built binary after the fix. Sandbox
under the session scratchpad; `git status` is the wrong oracle there too, since a hand-written
`accord/config.yml` is untracked from the moment it is written, so the oracle is a content hash of the tree.

```
$ git init -q
$ cat accord/config.yml
# written by hand, not by accord
accord: "0.0.1"
profile: maintain
tracker:
  adapter: none
design:
  tokens: ""
roles: [ba, dev]
runtimes: [claude]

===== BEFORE TREE =====
$ find . -type f -not -path './.git/*' | sort | xargs sha256sum
0a84f2f2670346e16d2eeb1c3eeb2c6775bd339c6abf3dabb8a7ec7577196aa9 *./accord/config.yml

===== RUN =====
$ node /c/Work/accord/packages/cli/dist/cli.js init
exit 2
stdout: ""
stderr: config.yml pins accord 0.0.1, running 0.1.0 - run: npx --yes @accord-dev/accord@0.0.1

===== AFTER TREE =====
$ find . -type f -not -path './.git/*' | sort | xargs sha256sum
0a84f2f2670346e16d2eeb1c3eeb2c6775bd339c6abf3dabb8a7ec7577196aa9 *./accord/config.yml

===== DIFF =====
$ diff -u before.txt after.txt
(no output, exit 0)   → IDENTICAL

===== EVERY ENTRY, DIRECTORIES INCLUDED =====
$ find . -not -path './.git*' -not -name . | sort
./accord
./accord/config.yml
```

The last listing is the one that answers the empty-directory question a `-type f` walk cannot: no `.github/`,
no `.github/workflows/`, no `accord/product/` was created and then left behind. Compare
07-VERIFICATION.md's record of the same run before the fix: three files on disk and an empty stdout.

### Sandbox transcript — greenfield, unchanged

```
$ git init -q && node /c/Work/accord/packages/cli/dist/cli.js init
exit 0
28 created lines, stderr empty

created .github/workflows/accord.yml
created accord/config.yml
created accord/product/business-rules.md
created accord/product/glossary.md
created .agents/skills/accord-ba/SKILL.md
created .agents/skills/accord-ba/ready.md
created .agents/skills/accord-ba/setup.md
created .agents/skills/accord-ba/story.md
created .agents/skills/accord-designer/SKILL.md
created .agents/skills/accord-designer/prototype.md
created .agents/skills/accord-dev/SKILL.md
created .agents/skills/accord-dev/code-review.md
created .agents/skills/accord-dev/debug.md
created .agents/skills/accord-dev/prototype.md
created .agents/skills/accord-dev/review.md
created .claude/skills/accord-ba/SKILL.md
created .claude/skills/accord-ba/ready.md
created .claude/skills/accord-ba/setup.md
created .claude/skills/accord-ba/story.md
created .claude/skills/accord-designer/SKILL.md
created .claude/skills/accord-designer/prototype.md
created .claude/skills/accord-dev/SKILL.md
created .claude/skills/accord-dev/code-review.md
created .claude/skills/accord-dev/debug.md
created .claude/skills/accord-dev/prototype.md
created .claude/skills/accord-dev/review.md
created AGENTS.md
created CLAUDE.md
```

28 lines, exit 0 — identical to what 07-VERIFICATION.md observed before this plan.

## Findings

### F-1 (A-31) — `guard.ts`'s `nothing was written` clause is false on one path

**File:** `packages/cli/src/guard.ts:33` (the string is assembled across lines 29-34; `- nothing was written`
is on line 33).

On the greenfield run that Task 2's case drives, stderr says
`.claude/skills/accord-ba/SKILL.md is not a regular file - nothing was written` while stdout, on the same
run, truthfully lists four scaffold paths that **were** written. Both statements come out of the same
command, and one of them is wrong.

This is a wording problem, not an ordering one: the ordering cannot be fixed on this path, because the
skill roster is decided by the `config.yml` the run is about to write (A-30). The message lives in
`guard.ts` and is shared with `skills sync`, where it is true — `sync` writes nothing before its pre-pass —
so narrowing it is a change to a second command's output and outside this gap's scope. A-31 rules the file
untouched, and the content hash above proves it was.

**Worth a ticket.** Two candidate fixes, neither taken here: scope the clause to the guard's own write set
(`- no skill copy was written`), or drop the clause and let the report on stdout be the only claim about what
reached disk. Recorded as `.planning/WINDOWS.md` entry 15.

### F-2 — the plan's "exactly one occurrence of `pinMessage`" is a claim about call sites

`init.ts` holds two textual occurrences of `pinMessage`: the import on line 16 and the call on line 60. That
was also true before this plan. The criterion is satisfied on the reading it must mean — one call site, so
one place the pin can be checked — and is false on a literal `grep -c`. Noted so a later reader does not
take a count of 2 for a regression.

### F-3 — the POSIX leg of everything this plan touched is unrun

Same shape as WINDOWS.md entries 8, 9, 11 and 13. The 27 `init` cases, including the widened `refuses` and
the new after-a-write case, ran on this Windows host only; nothing is committed, so CI has not seen them.
`listAll` walks with `readdirSync(..., { recursive: true })` and splits on `path.sep`, so a separator
difference would surface here before anywhere else. Recorded as `.planning/WINDOWS.md` entry 16.

## Known Stubs

None. Nothing in this plan returns a hardcoded empty value, and no test was skipped or left unrun beyond the
platform residual in F-3.

## Threat Flags

None. This plan adds no network endpoint, no auth path and no schema change; it narrows an existing write
surface. The three threats the plan registered as `mitigate`/`accept` are disposed as planned:

| Threat | Disposition | Where |
|--------|-------------|-------|
| T-07-37 (scaffold loop ahead of the pin check) | mitigated | the `refusals()` pre-write call site; held by `refuses`'s tree equality |
| T-07-38 (a refusal that leaves files and reports nothing) | mitigated | the `catch` + `rendered()`; held by the after-a-write case |
| T-07-39 (a link at a skill-copy path on a greenfield run) | accepted, as planned | `assertNoLink` still refuses it; the run is now reported (F-1 is its residual) |

## Issues Encountered

None beyond the two deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Gap 1 of 07-VERIFICATION.md is closed and its reproduction inverted into a regression.
- Gaps 2 (`tests:` block in the generated `config.yml`, owner-ruled to a commented block) and 3 (the
  `deniedNames` scan widened over `packages/core/templates/`) remain, owed to 07-10 and 07-11. Neither
  touches `init.ts`'s ordering; 07-10 changes what `initFiles` emits, which this plan's greenfield
  whole-stdout `toBe` will notice if the scaffold list grows.
- Nothing is committed. The owner reviews the diff first.

## Self-Check: PASSED

- `packages/cli/src/commands/init.ts` — present, contains `refusals`, one `pinMessage` call, one
  `run accord lint`, one `rendered` local referenced from the catch and the success write.
- `packages/cli/test/init.test.ts` — present, contains `listAll`, the widened `refuses`, and the
  after-a-write case.
- `packages/cli/src/guard.ts` — content hash matches the plan-start baseline.
- `packages/core/**` — 299 files, hashes match the plan-start baseline.
- `npm run build`, `npm run lint`, `npm run typecheck`, `npx vitest run` — all exit 0; 879/879 tests pass.
- Commits: none, by design. `git log` is unchanged; the change is in the working tree.

---
*Phase: 07-scaffolding-and-example-repo*
*Completed: 2026-09-18*
