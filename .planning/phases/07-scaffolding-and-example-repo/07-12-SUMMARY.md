---
phase: 07-scaffolding-and-example-repo
plan: 12
subsystem: cli
tags: [init, pointer, encoding, latin1, report, refusal-ordering, vitest]

# Dependency graph
requires:
  - phase: 07-scaffolding-and-example-repo
    provides: "the `init` pointer loop and its `try`/`catch` report region as 07-09 left them; `writeSkillFiles` and its D-112 four-state contract from 06; `assertNoLink` in `packages/cli/src/guard.ts`; the `bytes()` latin1 helper and the `refuses` helper already present in `init.test.ts`"
  - phase: 06-skills
    provides: "`writeSkillFiles`, `SkillStatus`, and the marker-and-hash rule the report describes"
provides:
  - "`accord init` appends its pointer block without rewriting a byte a human wrote, for every encoding: the read and the write are one `latin1` codec pair, byte-for-byte over 0x00-0xFF, so the T-07-18 invariant stated in core is now true on the CLI side of the seam (gap 1 / GC-CR-01 closed)"
  - "`ReportRow` exported from `packages/cli/src/commands/skills.ts` — one named union for the row both commands print, replacing the same union spelled inline at the `init` end"
  - "`writeSkillFiles(root, targets, out = [])` records each status into a caller-owned array at the moment it becomes true, so an `overwrote local edits` that really happened at target one reaches the report even when target two throws (GC-WR-01)"
  - "A case pinning the refusal 07-09 hoisted, on the config-exists branch where it was hoisted, and a `refuses` helper that now asserts a run which wrote nothing also printed nothing (GC-WR-02)"
affects: [07-13, 07-14, 07-15, 08-mcp-server, 09-publish-and-dogfood]

actuals:
  tokens: 2135        # chars/4 over the realized diff of this plan's four files (8,540 chars)
  tasks: 3
  commits: 0          # uncommitted by project rule and by explicit dispatch override — see "Task Commits"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A codec used to round-trip a document accord did not write is a PAIR — same encoding on the read and the write, stated in one comment beside both, because a lossy read swapped for a lossy write is a new defect rather than a fix"
    - "A test that asserts a byte-exact property is fed a non-ASCII fixture, seeded as a `Buffer` and decoded with the same codec the assertion reads, so fixture and assertion cannot drift and the assertion cannot pass vacuously"
    - "A report the caller prints is accumulated into an array the caller owns, so a throw mid-loop cannot erase statuses that were already true"
    - "A helper shared by refusal cases asserts the negative on both channels — nothing written AND nothing printed — because a run that reported paths it never wrote would otherwise pass"

key-files:
  created: []
  modified:
    - packages/cli/src/commands/init.ts
    - packages/cli/src/commands/skills.ts
    - packages/cli/test/init.test.ts
    - packages/cli/test/skills-sync.test.ts

key-decisions:
  - "`latin1` on both sides of the pointer round-trip, not a `Buffer` read with `Buffer.concat` on the write. The Buffer route needs `pointerText` to return the suffix rather than the whole file — a core signature change, in core, to fix a defect entirely on the CLI side of the seam. `latin1` maps 0x00-0xFF onto U+0000-U+00FF in both directions with no substitution, which is why it is byte-exact for input it was never meant to describe"
  - "The decoded string is never printed, matched or parsed — `pointerText` reads it only through `includes(POINTER_START)` and `endsWith('\\n')`, both over ASCII — so no mojibake can reach a message or a log (T-07-45, accepted)"
  - "`ReportRow` is a type decision, not a parameter addition: `init`'s array is declared over a union strictly wider than `writeSkillFiles`'s row, so widening the parameter alone breaks `return out`. One exported union named in `skills.ts` is what lets the two ends connect with no cast, and it removes a duplicated inline literal rather than adding a type"
  - "The declared return type of `writeSkillFiles` is deliberately wider than anything the function can produce; the docstring says so, because the element type belongs to the report `init` prints, not to this function's own four states"
  - "`refuses`'s two narrower `existsSync` assertions became before/after comparisons instead of `toBe(false)`: the new case seeds a directory AT a skill-copy path, so `.claude/skills` legitimately exists before the run. What must hold is that the run did not change it — not that the path was absent"
  - "No production code was perturbed to demonstrate task 3's red. Its pair already exists: the greenfield case asserts four files written then refused, the new case asserts refused before the first byte, and no reorder satisfies both"

patterns-established:
  - "Pattern: an out-of-scope-tree guard is a `git hash-object` baseline captured BEFORE the first edit into a gitignored `*.log`, compared afterwards with `git diff --no-index --quiet` — the only check that can see an edit inside a tree git has no committed version of"
  - "Pattern: the RED for a signature change is a typecheck error, not a failing assertion, and the honest record is the compiler's own message"

requirements-completed: [CLI-01, CLI-03]

coverage:
  - id: D1
    description: "A windows-1252 `AGENTS.md` receives the pointer block appended and keeps every original byte; `init` prints `appended AGENTS.md` and exits 0"
    requirement: "CLI-03"
    verification:
      - kind: unit
        ref: "packages/cli/test/init.test.ts#keeps the bytes of a non-UTF-8 file it appends to — observed RED against the unmodified init.ts, then green"
        status: pass
      - kind: manual_procedural
        ref: "sandbox hex transcript through the built `packages/cli/dist/cli.js`: orig 636166e9209620646173680a, after 636166e9209620646173680a0a3c212d2d206163, byte-exact prefix preserved: true, EXIT=0 (verbatim below)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A genuine multi-byte UTF-8 `CLAUDE.md` survives the same round-trip byte for byte — one lossy codec was not traded for another"
    requirement: "CLI-03"
    verification:
      - kind: unit
        ref: "packages/cli/test/init.test.ts#keeps the bytes of a multi-byte UTF-8 file it appends to"
        status: pass
    human_judgment: false
  - id: D3
    description: "A status `writeSkillFiles` had already made true appears in the report `init` prints, even when a later target throws"
    requirement: "CLI-01"
    verification:
      - kind: unit
        ref: "packages/cli/test/skills-sync.test.ts#records a copy it wrote before a later target throws — direct call, second target occupied by a directory, EISDIR"
        status: pass
      - kind: integration
        ref: "packages/cli/test/init.test.ts#prints what it wrote before the skill-target guard refuses (D-133) — unedited, still green with the shared array"
        status: pass
    human_judgment: false
  - id: D4
    description: "On a repository that already has a `config.yml`, a skill-copy target that is not a regular file refuses before the first byte: the whole-tree listing is identical before and after, and stdout is empty"
    requirement: "CLI-01"
    verification:
      - kind: unit
        ref: "packages/cli/test/init.test.ts#refuses a skill-copy target that is not a regular file, before any write — exit 2, `is not a regular file`, listAll equality, stdout `''`"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nothing under `packages/core` changed: `packages/core/src/scaffold/pointer.ts` hashes to its pre-edit baseline"
    requirement: "CLI-03"
    verification:
      - kind: other
        ref: "git hash-object → 702be517a71a9c76e2b23196132a72efe6f42579 before the first edit and after the last; `git diff --no-index --quiet 07-12-pointer-before.log 07-12-pointer-after.log` exits 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "The greenfield report is byte-identical to before this plan and the full suite is green"
    requirement: "CLI-01"
    verification:
      - kind: unit
        ref: "packages/cli/test/init.test.ts#runs in a repository with no accord/ folder, writes the whole contract, and exits 0 — whole-stdout `toBe`, unedited"
        status: pass
      - kind: other
        ref: "npm run check → build, lint, typecheck all exit 0; vitest run 36 files / 887 tests passed"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-09-19
status: complete
---

# Phase 07 Plan 12: The pointer append keeps every byte Summary

**Two encoding arguments turn the one `init` write that touches a document accord did not author into a byte-for-byte round-trip, and the two test-oracle holes that let that ship — a report erased by a mid-loop throw, and a hoisted refusal with no case on the branch it moved to — are closed in the same two files.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-19T01:22Z (approx — first read)
- **Completed:** 2026-09-19T01:39Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- **Gap 1 is closed at the seam it lives on.** `packages/cli/src/commands/init.ts` now reads with `readFileSync(file, 'latin1')` and writes with `writeFileSync(file, text, 'latin1')`. Those are two arguments on two lines; the rest of the edit is one comment naming `latin1` as a byte-for-byte codec over `0x00`-`0xFF` and stating that the read and the write are a pair. Nothing in `packages/core/src/scaffold/pointer.ts` changed, and the hash proves it.
- **The vacuous assertion is no longer vacuous.** `init.test.ts` had a case asserting the original bytes are an exact prefix of the result — fed ASCII, so it passed under any codec that round-trips ASCII. Two cases now feed it what it was written for: twelve windows-1252 bytes, and a genuine multi-byte UTF-8 document. Both seed from a `Buffer` rather than a string, so the fixture cannot be re-encoded on the way in.
- **A partial skill-copy run is reportable.** `writeSkillFiles` takes a caller-owned `ReportRow[]` and pushes into it at all three sites. `init` passes the array it already owns instead of spreading the return value, so a status recorded mid-loop reaches the `catch`'s report by construction rather than by a second push someone has to remember. `skills()` is untouched — it still reads the return value, and the default `= []` is why.
- **The refusal whose position moved has a case on the branch it moved to.** A repository with a hand-written `config.yml` pinned to the running version, and a directory occupying `.claude/skills/accord-ba/SKILL.md`: exit 2, `is not a regular file`, whole-tree listing identical, stdout empty. Its pair — the greenfield case that asserts four files written *then* refused — is unedited, and no reorder satisfies both.

## The RED for task 1 (the reproduction)

`npm test -- --project cli init`, against the unmodified `init.ts`:

```
 FAIL  |cli| test/init.test.ts > accord init — the AGENTS.md and CLAUDE.md pointer (CLI-03) > keeps the bytes of a non-UTF-8 file it appends to
AssertionError: expected false to be true // Object.is equality
 ❯ test/init.test.ts:408:40
    407|     const after = bytes(at(repo, AGENTS));
    408|     expect(after.startsWith(original)).toBe(true);

 Test Files  1 failed (1)
      Tests  1 failed | 28 passed (29)
```

Exactly one test failed, on the assertion for the planned behaviour. The **received string**, read off the same run through the built binary so the value itself is on the record:

```
received (latin1, first 20 chars): "cafï¿½ ï¿½ dash\n\n<!-"
```

`ï¿½` is the latin1 rendering of `EF BF BD` — the U+FFFD replacement character the `utf8` decode substituted for `E9`, and again for `96`, then wrote back over the original.

## The hex transcript (verification step 2)

A throwaway `git init` sandbox, `AGENTS.md` seeded from the twelve bytes, run through `packages/cli/dist/cli.js init`, hex read with `readFileSync(path).toString('hex')` — node, not a POSIX hex-dump tool, because node is the one runtime this project guarantees on both platforms.

**Before the fix** (identical to the transcript `07-VERIFICATION.md` carried, reproduced on this host):

```
orig : 636166e9209620646173680a
init : appended AGENTS.md   EXIT=0
after: 636166efbfbd20efbfbd20646173680a0a3c212d
byte-exact prefix preserved: false
```

**After the fix**, same sandbox procedure, rebuilt binary:

```
orig : 636166e9209620646173680a
init : appended AGENTS.md   EXIT=0
after: 636166e9209620646173680a0a3c212d2d206163
byte-exact prefix preserved: true
```

All twelve bytes intact. What follows them is `0a 3c 21 2d 2d 20 61 63` — the one separator newline `pointerText` adds to a file already ending in `\n`, then `<!-- ac`, the start of the block.

## The RED for task 2 (a typecheck error, which is the honest shape)

`npm run typecheck`, with the new case written and the signature not yet changed:

```
packages/cli/test/skills-sync.test.ts(14,15): error TS2305: Module '"../src/commands/skills.js"' has no exported member 'ReportRow'.
packages/cli/test/skills-sync.test.ts(483,57): error TS2554: Expected 2 arguments, but got 3.
```

TS2554 is the third argument not being accepted, named exactly as the plan predicted. After the signature change, `npm run typecheck` exits 0 with none of TS2554, TS2345 or TS2322 — the three states the plan named as the ones this task had to leave behind.

## Task Commits

`uncommitted (project CLAUDE.md: owner reviews the diff before any commit; the dispatch for this plan suspended the commit protocol explicitly)`

Files left changed and unstaged in the working tree:

1. **Task 1: The append keeps every byte, whatever encoding the human used** — `packages/cli/src/commands/init.ts`, `packages/cli/test/init.test.ts`
2. **Task 2: A skill copy that was written is reported, even when the next one throws** — `packages/cli/src/commands/skills.ts`, `packages/cli/src/commands/init.ts`, `packages/cli/test/skills-sync.test.ts`
3. **Task 3: The refusal whose position moved gets the test it never had** — `packages/cli/test/init.test.ts`

**Plan metadata:** uncommitted — this file, `.planning/STATE.md`, `.planning/ROADMAP.md`

`commits: 0` in the frontmatter is the measured truth and the intended one: no `git add`, `git commit`, `git push`, `git stash`, `git checkout`, `git reset`, `git restore` or `git clean` was run at any point in this plan.

## Files Created/Modified

- `packages/cli/src/commands/init.ts` — the pointer loop's read is `latin1`; its write is `writeFileSync(file, text, 'latin1')` under a five-line comment naming the codec and the pair. `results` is declared `ReportRow[]`; the `import type` at the top takes `ReportRow` instead of `SkillStatus`; the `writeSkillFiles` call passes `results` as a third argument instead of spreading its return value. The scaffold write loop above is untouched — it writes new files from core's own text and never reads an existing one.
- `packages/cli/src/commands/skills.ts` — `export type ReportRow = { status: SkillStatus | 'skipped' | 'appended'; path: string }` beside the existing `SkillStatus`; `writeSkillFiles(root, targets, out: ReportRow[] = []): ReportRow[]`; the local `results` deleted and all three pushes moved to `out`; `return out`. Two sentences added to the docstring — what the caller-owned array buys, and that the declared return type is wider than the function can produce.
- `packages/cli/test/init.test.ts` — two new pointer cases (+32 lines); the `refuses` helper asserts stdout is `''` and compares the two skill directories against their own before-state; one new case in `a config it cannot act on` (+21 lines). 27 cases → 30.
- `packages/cli/test/skills-sync.test.ts` — `writeSkillFiles` and `type ReportRow` imported from `../src/commands/skills.js`; one new describe holding `records a copy it wrote before a later target throws`. 25 cases → 26.

## Verification numbers

| Command | Result |
|---|---|
| `npm run build` | exit 0 — `dist/cli.js 29.93 kB` |
| `npm run lint` | exit 0, no output |
| `npm run typecheck` | exit 0 (core, core tests, cli) |
| `npx vitest run` | **36 files / 887 tests passed**, 0 failed |
| `npm test -- --project cli` | 13 files / 188 tests passed |
| `npm test -- --project cli init` | 30 passed (27 before this plan — three more cases) |
| `npm test -- --project cli skills-sync` | 26 passed (25 before this plan) |
| `git hash-object packages/core/src/scaffold/pointer.ts` | `702be517…` before the first edit and after the last; `git diff --no-index --quiet` exits 0 |

Baseline for comparison, taken on this exact tree before the plan ran: 36 files / 883 tests. Four new cases, four more tests, nothing else moved.

## Acceptance criteria, checked

- `init.ts` contains `readFileSync(file, 'latin1')` and `writeFileSync(file, text, 'latin1')`; no `'utf8'` string literal appears anywhere inside the `POINTER_FILES` loop (the only occurrence of the word is inside the comment explaining what the old codec did).
- `init.test.ts` holds `keeps the bytes of a non-UTF-8 file it appends to`, seeding from a `Buffer` and asserting `bytes(...).startsWith(original)`, plus the multi-byte UTF-8 sibling.
- `skills.ts` exports `ReportRow`; `writeSkillFiles` reads `(root: string, targets: SkillFile[], out: ReportRow[] = []): ReportRow[]` with no local results array.
- `init.ts` declares `results` as `ReportRow[]` and passes it as the third argument. No `as`, `!` or `satisfies` at the call site — grepped, none.
- `refuses` asserts `toBe('')` against stdout and still returns `{ code, err }`; neither pre-existing case in that describe was edited.
- The greenfield case in `a refusal that lands after a write` is unedited and still asserts exactly the four `created` scaffold lines.
- Task 3 edited one file, `packages/cli/test/init.test.ts`, and no production source.

## Decisions Made

Recorded in the frontmatter `key-decisions` and added to `.planning/STATE.md`. The two that shape later work: the pointer round-trip is a **codec pair** and must stay one, and `ReportRow` is now the single name for the report row both commands print — a third caller should take the array rather than the return value.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] `refuses`'s two `existsSync(...).toBe(false)` assertions could not survive the case the plan asked for**

- **Found during:** Task 3
- **Issue:** The plan's new case seeds a directory AT `.claude/skills/accord-ba/SKILL.md`, which makes `.claude/skills` exist *before* the run. The helper asserted `existsSync('.claude/skills') === false` unconditionally, so the case the plan specified could not pass through the helper the plan told it to use.
- **Fix:** Those two lines now capture each directory's existence before the run and assert it unchanged after, in a one-line loop that keeps the per-directory failure message. The property they were written for — "this run created no skill directory" — is preserved and generalised; the whole-tree `listAll` equality beside them was already the stronger statement.
- **Why it is not a weakening:** the two pre-existing cases start from a sandbox where both directories are absent, so `existed` is `false` for both and the assertion is identical to what it was. Neither case was edited.
- **Files modified:** `packages/cli/test/init.test.ts`
- **Commit:** none — uncommitted per the dispatch override

### Not a deviation, but worth recording

`packages/cli/test/bin.test.ts > runs under process.execPath and lists the lint command` hit its 5 s timeout once, in a full-suite run, while thirteen forked workers competed for a real `execFileSync` spawn. It passed in isolation in 449 ms immediately afterwards and passed in every subsequent full run, including the final `npm run check`. Nothing was changed for it. This is the same class of flake Phase 2 recorded for `purity.test.ts`.

## Findings this plan did not anticipate

None. Both REDs landed exactly where the plan predicted — the U+FFFD substitution in the received string, and TS2554 on the third argument — and the two rejected alternatives the plan named (the `Buffer.concat` route, the generic/sink parameter) stayed rejected on the reasons given.

## Issues Encountered

None blocking. The `07-12-pointer-before.log` and `07-12-pointer-after.log` baselines are still in the repository root; they are matched by `.gitignore:3` (`*.log`) so they will never be committed, and they are safe to delete once the owner has reviewed this plan.

## User Setup Required

None.

## Next Phase Readiness

Gap 1 of `07-VERIFICATION.md` — the only `failed`, blocker-class gap — is closed, with a test case and a reproducible hex transcript behind it. GC-WR-01 and GC-WR-02 are closed in the same two files. Plans 07-13, 07-14 and 07-15 are unblocked and touch different trees (`packages/core/templates/`, the denied-name scan and the published bundle, the generated `config.yml` instruction), so nothing here constrains them.

The remaining open item on this surface is the one the owner still has to rule on: `packages/cli/dist/cli.js` names a tracker product through a surviving JSDoc block comment (gap 2, `.planning/WINDOWS.md` entry 19), which 07-14 is written for.

## Self-Check: PASSED

Every file named under `key-files` exists on disk and appears in `git status --short`:

```
?? packages/cli/src/commands/init.ts
?? packages/cli/src/commands/skills.ts
?? packages/cli/test/init.test.ts
?? packages/cli/test/skills-sync.test.ts
```

They report as `??` rather than ` M` because phases 6 and 7 are entirely uncommitted — `init.ts` and `skills.ts` were themselves created by earlier plans in this phase and have never been committed. The commit check prescribed by `<self_check>` step 2 was replaced by this on-disk + `git status` check, per the dispatch override that suspended the commit protocol for this plan.
