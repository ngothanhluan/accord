---
phase: 07-scaffolding-and-example-repo
plan: 02
subsystem: infra
tags: [scaffolding, cli, skills, idempotency, version-pin, vitest]

# Dependency graph
requires:
  - phase: 07-scaffolding-and-example-repo
    plan: 01
    provides: "`initFiles` as a sorted `ScaffoldFile[]`, the compute-then-render `init` body, `guard.ts`'s `assertNoLink`, `makeEmptyRepo()`, and `init` registered ahead of `lint`"
  - phase: 06-skills
    provides: "`skillTargets`, the D-105..D-112 marker-and-hash write rule, and the `skills sync` report shape `init` now shares"
  - phase: 05-cli
    provides: "`loadFromFs`/`loadSnapshot`, `UsageError` as exit 2, `pinMessage`, the in-process `run(argv, cwd)` harness"
provides:
  - "`writeSkillFiles(root, targets)` and `SkillStatus` exported from `packages/cli/src/commands/skills.ts`: one skill write implementation, two callers (D-131)"
  - "`initFiles` returns the whole fixed-path set: config plus both product documents"
  - "`accord init` as a repository-reading command: it refuses a missing/unschematic config and a mis-pinned one at exit 2, before the first skill byte"
  - "the full CLI-01 contract pinned by test, including ROADMAP criterion 1's 'both paths' from the default roster alone"
affects: [07-03, 07-04, 07-06, 07-08, 08-mcp]

actuals:
  tokens: 5200   # chars/4 over the realized diff (~21,000 chars); the 68,000 estimate is a different scale, see F-1
  tasks: 3
  commits: 0     # commits are forbidden in this project until the owner approves the diff

tech-stack:
  added: []
  patterns:
    - "one write implementation per write contract: `writeSkillFiles` is exported from the command that owns the rule, not lifted into a shared module, so the rule and its only implementation stay in the same file as their explanation"
    - "a scaffolding command becomes repository-reading the moment it has written a config: read back through the normal loader, then apply the normal refusals"

key-files:
  created: []
  modified:
    - packages/core/src/scaffold/init.ts
    - packages/core/test/scaffold.test.ts
    - packages/cli/src/commands/skills.ts
    - packages/cli/src/commands/init.ts
    - packages/cli/test/init.test.ts
    - packages/cli/test/spawn-surface.test.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "CLI-01 is ticked: its own text — folder, config, templates, skill copies, idempotent, never overwrites, prints what it created — is delivered in full. The CI workflow and the AGENTS.md/CLAUDE.md pointer are CLI-02 and CLI-03, separate requirement rows owed to 07-03 and 07-04, so CLI-01 does not wait on them"
  - "`writeSkillFiles` stayed in `commands/skills.ts` and is exported from there rather than moved to a new module: the thirty lines of D-112 rationale live in that file's header, and a `src/skill-write.ts` with one rule and two callers would separate the rule from its only explanation"
  - "`init`'s read-back is the full `loadFromFs` + `loadSnapshot` (A-07), not a bespoke parse of `config.yml`: one config parser and one schema application for the whole CLI"
  - "07-01's D-132 case was re-pointed rather than deleted — see Deviation 1; its unparseable sentinel became the new exit-2 case, so nothing that case proved was lost"

patterns-established:
  - "Pattern 1: the expected skill half of an `init` report is derived in-test from `skillTargets(the config just written)`, never re-listed as literals — the roster is the config's to decide, so a literal list would assert the test's opinion of it"
  - "Pattern 2: a refusal case asserts `existsSync('.claude/skills') === false` as well as the exit code, because 'exit 2' alone does not say the refusal landed before the writes"

requirements-completed: [CLI-01]

coverage:
  - id: D1
    description: "`accord init` in an empty repository writes the config and both product documents and prints one `created` line per path"
    requirement: CLI-01
    verification:
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#runs in a repository with no accord/ folder, writes the whole contract, and exits 0"
        status: pass
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#plans exactly the config and the two product documents"
        status: pass
      - kind: e2e
        ref: "node packages/cli/dist/cli.js init in a throwaway `git init -q` directory: 25 created lines, exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The same run writes the skill copies the freshly-written config declares, in BOTH runtime paths, through the function `skills sync` uses (D-131, D-134 as amended, ROADMAP criterion 1)"
    requirement: CLI-01
    verification:
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#puts all three role directories under BOTH runtime paths (D-134 as amended)"
        status: pass
      - kind: e2e
        ref: "throwaway repo: `created .claude/skills/accord-ba/SKILL.md` and `created .agents/skills/accord-ba/SKILL.md` in one run, no config edit"
        status: pass
      - kind: other
        ref: "packages/cli/src/commands/init.ts calls writeSkillFiles; no second write loop exists (grep)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A second `accord init` prints `skipped` for all three scaffold paths and `unchanged` for every skill copy, exits 0, and leaves the target directories holding exactly what the first run put there"
    requirement: CLI-01
    verification:
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#reports every scaffold path skipped and every skill copy unchanged (D-130, D-112)"
        status: pass
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#leaves the target directories holding exactly what the first run put there"
        status: pass
    human_judgment: false
  - id: D4
    description: "A config pinning another version refuses at exit 2 naming both versions, having written no skill byte (D-95, A-06, T-07-08)"
    requirement: CLI-01
    verification:
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#refuses a repository pinned to another version, before any skill write (D-95, T-07-08)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A config that is missing or fails its schema refuses at exit 2 naming `run accord lint`, matching the `skills sync` precedent"
    requirement: CLI-01
    verification:
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#refuses a config that is not valid YAML, naming lint (the skills sync precedent)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A freshly initialised repository reports no `accord lint` error and no `lint.tokens-missing` warning"
    requirement: CLI-01
    verification:
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#leaves a repository that accord lint reports clean, with no tokens warning"
        status: pass
      - kind: e2e
        ref: "throwaway repo: `accord lint` prints `0 errors, 0 warnings`, exit 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every path `accord init` prints is forward-slash on every host, over a report that now carries 22 skill-copy paths as well as 3 scaffold paths (D-51)"
    verification:
      - kind: e2e
        ref: "packages/cli/test/spawn-surface.test.ts#accord init prints no backslash on any host (D-51, PITFALLS section 12)"
        status: pass
      - kind: e2e
        ref: "packages/cli/test/init.test.ts#prints no backslash on either stream, on any host (D-51)"
        status: pass
      - kind: unit
        ref: "packages/core/test/scaffold.test.ts#no backslash in any path or any emitted line (D-51)"
        status: pass
    human_judgment: true
    rationale: "Windows-observed only. The assertion exists precisely to fail on the host the author does not have, and the POSIX leg has never run because nothing is committed (WINDOWS.md entry 9)."
  - id: D8
    description: "The D-130 skip rule and the D-131 marker rule stay separate and are never merged — the extraction changed no behaviour"
    requirement: CLI-01
    verification:
      - kind: e2e
        ref: "packages/cli/test/skills-sync.test.ts (the whole suite, unchanged — no case edited, added, or skipped)"
        status: pass
      - kind: other
        ref: "`init` pushes `writeSkillFiles` results into the same list as its own created/skipped results; the two statuses never mix at a single path"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-17
status: complete
---

# Phase 7 Plan 02: the full CLI-01 write set Summary

**`accord init` now puts the whole contract in place in one command — `config.yml`, both product documents, and twenty-two skill files across `.claude/skills` and `.agents/skills` — by delegating the skill half to the same `writeSkillFiles` that `skills sync` calls, and it refuses at exit 2 before the first skill byte when the config it reads back is unschematic or pinned elsewhere.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 3 of 3
- **Files modified:** 7 (0 created)

## Accomplishments

- **One command, twenty-five paths, both runtime directories.** Verified in a real throwaway `git init -q` directory, not only in a test: the first run prints 25 `created` lines including `.claude/skills/accord-ba/SKILL.md` and `.agents/skills/accord-ba/SKILL.md`; the second prints 3 `skipped` and 22 `unchanged`; `accord lint` then reports `0 errors, 0 warnings`. ROADMAP criterion 1's "skill copies in both paths" is literally true of a fresh `init` with no config edit first.
- **One skill-write implementation, not two (D-131).** `writeSkillFiles(root, targets)` was lifted out of `skills()` verbatim — no status renamed, no ordering changed, no write added or removed — and `skills sync`'s whole suite passes unchanged, which is the evidence that the extraction is a move rather than a rewrite. A duplicate loop in `init` would have let the marker-and-hash rule drift between the two commands, which is exactly what D-131 forbids.
- **`init` became repository-reading the moment it has a config, and behaves like every other such command.** The read-back is the normal `loadFromFs` + `loadSnapshot` (A-07), the missing-config sentence is the same string `skills.ts` throws, and the pin check is `pinMessage` — so there is no second config parser, no second refusal wording, and no second pin rule to keep in step.
- **The refusal is proven to land before the first skill byte.** Both exit-2 cases assert `existsSync('.claude/skills')` and `existsSync('.agents/skills')` are `false` afterwards. "Exit 2" on its own would have passed over a CLI that wrote half the copies and then refused, which is the failure T-07-08 describes.
- **The report grew without a second rendering path.** One widened result list (`'created' | 'skipped' | SkillStatus`) feeds the single `ctx.stdout.write` the tracer already had, so a `--json` mode added later still cannot disagree with the text.

## Task Completion

**No commits were made.** This project forbids `git commit` until the owner has reviewed the diff (global CLAUDE.md critical rule, restated as a hard override in the execution brief). All work is in the working tree, uncommitted, alongside the pre-existing Phase 6 and 07-01 work. HEAD is still `53e9df9`.

Per-task completion, tracked here instead of in git history:

1. **Task 1: the two product templates join the scaffold list** — complete. `packages/core/test/scaffold.test.ts` now 12 cases, all passing; lint and typecheck clean.
2. **Task 2: skill copies through the one function `skills sync` already uses** — complete. `npm run build && npm run lint && npm run typecheck` clean; the `skills-sync` suite passes untouched.
3. **Task 3: pin the full CLI-01 contract, add `init` to the printed-path loop, tick CLI-01** — complete. `packages/cli/test/init.test.ts` now 14 cases, all passing; `spawn-surface` 11 cases; CLI-01 ticked.

## Files Modified

- `packages/core/src/scaffold/init.ts` — imports `templates` from the generated record; `initFiles` returns `accord/config.yml`, `accord/product/business-rules.md`, `accord/product/glossary.md`, with a comment naming the five `TICKET-ID`-carrying templates left out and why.
- `packages/core/test/scaffold.test.ts` — the path list case widened to the three-element `toEqual`; a new describe asserting each product entry is byte-identical to its `templates` value, plus a case asserting no planned file carries a `TICKET-ID` placeholder.
- `packages/cli/src/commands/skills.ts` — `writeSkillFiles` and `SkillStatus` exported; `skills()` keeps the config refusal, the `assertNoLink` pre-pass, the orphan scan, and the stderr advisory, and calls `writeSkillFiles` for its middle.
- `packages/cli/src/commands/init.ts` — after the scaffold loop: read-back, config refusal, pin refusal, `skillTargets`, the link pre-pass over every skill target, then `writeSkillFiles`; results pushed into the one widened list. No orphan scan (D-113). No spawn of any kind.
- `packages/cli/test/init.test.ts` — 8 cases to 14: the full first-run report, the both-paths roster case, the product-template case, the lint-clean case, the second-run report, the listing-identical case, the re-pointed D-132 case, and two exit-2 refusals.
- `packages/cli/test/spawn-surface.test.ts` — one `COMMANDS` row: `{ name: 'init', argv: ['init'], guard: 'accord/config.yml' }`.
- `.planning/REQUIREMENTS.md` — CLI-01 `- [ ]` to `- [x]`, traceability row `Pending` to `Complete`. Nothing else in that file changed by this plan.

## Decisions Made

- **CLI-01 is ticked now, not after 07-04.** 07-01 deliberately left it open because `init` wrote one of five artifacts. Read against CLI-01's own text — "scaffolds folder, config, templates, and skill copies; idempotent; never overwrites edited files; prints what it created" — every clause is now delivered and asserted. The two remaining `init` artifacts are the CI workflow and the `AGENTS.md`/`CLAUDE.md` pointer, and those are CLI-02 and CLI-03: their own requirement rows, still `Pending`, owed to 07-03 and 07-04. Ticking CLI-01 therefore claims nothing 07-03 and 07-04 have not yet delivered.
- **`writeSkillFiles` is exported from `commands/skills.ts` rather than moved to a new module.** The plan said "in the same file", and the reason is worth recording: that file's header carries the thirty-line D-112 account of why four statuses exist and why `overwrote local edits` is the point. A `src/skill-write.ts` holding the loop alone would put the rule one file away from its explanation, for one caller's benefit.
- **The expected skill half of every report assertion is computed from `skillTargets(the config on disk)`, not listed as literals.** Twenty-two literal paths in a test file would have to be edited every time a role gains a bundled reference, and would assert the test's opinion of the roster rather than the command's. The scaffold half stays literal precisely because it is fixed — a fourth entry appearing there is a decision, and the test should fail on it.
- **The `HAND_WRITTEN(pin)` sentinel is one literal with the pin as a parameter**, serving both the accepted D-132 case and the refused mis-pinned one, so the two cases cannot drift into testing different documents.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] 07-01's D-132 case asserted a behaviour this plan's own A-06 supersedes**

- **Found during:** Task 2 (the first `npm test` after `init` gained its read-back)
- **Issue:** `init.test.ts#leaves a hand-written config.yml untouched and reports it skipped (D-132)` wrote the sentinel `written by hand, not by accord\n` and asserted exit 0, on the stated grounds that "the sentinel need not be valid YAML: D-130 never reads the file it skips". That was true while `init` wrote one file. A-06 in this plan makes an unreadable config exit 2 — so under 07-02 that exact sentinel is the refusal case, and the case turned red (`expected 2 to be +0`).
- **Fix:** Re-pointed the case at a valid hand-written config modelled on this repository's own (`profile: maintain`, `roles: [ba, dev]`, `runtimes: [claude]`, pinned to the running version), which is the actual D-132 proving case. It now asserts the config is byte-identical afterwards, that the report's first line is `skipped accord/config.yml`, that `.agents/skills` does **not** exist (the human's `[claude]` roster is honoured over the defaults `init` would have written), and that `.claude/skills/accord-ba/SKILL.md` does. The unparseable sentinel moved into the new `refuses a config that is not valid YAML` case, so nothing the original case proved was lost.
- **Files modified:** `packages/cli/test/init.test.ts`
- **Verification:** 14 cases pass; the D-132 case now also proves the D-132/D-131 interaction (a human's roster steers the skill half) that the original could not reach.

**2. [Rule 3 — Blocking] Three 07-01 report assertions were written as whole-report equality against a one-line report**

- **Found during:** Task 2
- **Issue:** `expect(out).toBe('created accord/config.yml\n')` and its two siblings are deliberately whole-report assertions (07-01's comment: "`toBe` on the whole report, never `toContain`"). Correct then; stale the moment the report grew from 1 line to 25.
- **Fix:** Kept the whole-report discipline and widened the expectation rather than loosening it to `toContain`: scaffold lines as literals, skill lines derived from `skillTargets`. The deleted-path case now deletes `accord/product/glossary.md` instead of the config, because deleting the config makes the run a no-config run rather than a partial-scaffold one — which is a different contract and now has its own case.
- **Files modified:** `packages/cli/test/init.test.ts`
- **Verification:** `npm test` — 34 files, 821 passed, 0 failed.

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking, both in test code only).
**Impact on plan:** No production behaviour differs from what the plan specified. Both are 07-01 test expectations that this plan's own decisions supersede; the plan anticipated the second ("extend `init.test.ts` with the seven behaviours above") but not the first.

## Findings

**F-1 — the `actuals.tokens` figure and the plan's `estimate.tokens` are again not on the same scale.** The realized diff is ~21,000 characters, so ~5,200 tokens on the `chars/4` scale the SUMMARY contract specifies, against an estimate of 68,000. This is the same ~10x gap 07-01 recorded as its F-1, now observed twice in the same phase, which makes it a property of the estimator rather than a one-off. Recorded honestly rather than rounded toward the estimate.

**F-2 — CLI-01's "never overwrites edited files" is literally true of the scaffold half and deliberately false of the skill half.** `init` now writes skill copies through `writeSkillFiles`, which can report `overwrote local edits` on a copy a human edited. That is D-112's stated contract and D-131's explicit choice — the skill copies are rendered output that must track their definition, the report says so on the line it overwrites, and git is a hard precondition — but a reader taking CLI-01's clause at face value would not expect it. Recorded because the requirement text and the behaviour are reconciled only by reading D-130 and D-131 together, and the requirement row now says `Complete`. No change proposed; raising it so the owner can decide whether CLI-01's wording should carry the distinction.

**F-3 — `init` at `accord/config.yml` still has no link case of its own** (07-01's F-3, unchanged). `assertNoLink` is now exercised over 22 skill paths as well as 3 scaffold paths on every `init` run, and the existing `skills-sync.test.ts` junction and symlink cases still cover the function — but nothing drives a link at a path `init` writes. Carried forward.

**F-4 — plan verification item 4 cannot be checked literally in this working tree** (07-01's F-2, unchanged). `git status --porcelain packages/core/src/generated packages/core/skills` is non-empty: `templates.ts` modified, `skills.ts` and `packages/core/skills/` untracked, all from Phase 6's uncommitted work and all present before this plan started. The claim the item makes — *this plan regenerates nothing* — holds: no generator was run and no generated file was touched by this plan.

## Known Stubs

None. Every entry `initFiles` returns is real shipped text, and every path in the report corresponds to a file that was actually written or actually found.

## Threat Flags

None. This plan adds no network endpoint, no auth path, and no new file-access pattern: it writes to paths composed from source literals in `scaffold/init.ts` and `targets.ts`, both already covered by T-07-01 and T-06-01, and it adds a refusal (the pin check) rather than a surface.

## Issues Encountered

None beyond the two deviations. The extraction of `writeSkillFiles` was byte-for-byte and the `skills-sync` suite went green on the first run, which was the thing most likely to break.

## Verification Results

Run from the repository root, Windows, Node 24:

| Check | Result |
|---|---|
| `npm run build` | clean (`dist/cli.js` 27.97 kB, gzip 9.91 kB) |
| `npm run lint` | clean, exit 0 |
| `npm run typecheck` | clean, exit 0 (core, core tests, cli) |
| `npm test` | **34 files, 821 tests, 821 passed, 0 failed** (07-01 baseline was 34 files / 811 tests; +10 cases, no new file) |
| `packages/cli/test/init.test.ts` alone | 14 passed |
| `packages/core/test/scaffold.test.ts` alone | 12 passed |
| `packages/cli/test/spawn-surface.test.ts` alone | 11 passed |
| `git init -q` + `accord init` in a throwaway directory | 25 `created` lines including `.claude/skills/accord-ba/SKILL.md` and `.agents/skills/accord-ba/SKILL.md`, exit 0 |
| second `accord init` in the same directory | 3 `skipped` + 22 `unchanged`, exit 0 |
| `accord lint` in that directory | `0 errors, 0 warnings`, exit 0 |
| `git status --porcelain packages/core/src/generated packages/core/skills` | non-empty — pre-existing Phase 6 work only, see F-4 |
| `git rev-parse HEAD` | `53e9df9…` — unchanged, no commit made |

## Self-Check: PASSED

All seven modified files exist on disk and carry the described change; `packages/cli/src/commands/init.ts` imports `writeSkillFiles`, `skillTargets`, `loadFromFs`, `loadSnapshot` and `pinMessage` and contains no second write loop and no spawn call; `.planning/REQUIREMENTS.md` line 60 begins `- [x] **CLI-01**` and line 179 reads `| CLI-01 | Phase 7 | Complete |`. No commit hashes to verify — commits are forbidden in this project until the owner approves the diff, so the whole plan is in the working tree.

## User Setup Required

None. No external service, no new dependency, no environment variable.

## Next Phase Readiness

- **07-03 (CLI-02, the workflow) and 07-04 (CLI-03, the pointer) both extend the same list.** A new fixed-path artifact is an entry in `initFiles`; it inherits the link guard, the skip rule, the report, the backslash assertion and the three-element `toEqual` (which will need widening by one, deliberately) the moment it lands. `initFiles` already takes `name`, so 07-03's `<name>@<version>` workflow pin needs no signature change.
- **The scaffold path list case is the intended tripwire.** `packages/core/test/scaffold.test.ts#plans exactly the config and the two product documents` fails on any new entry. That is the point: 07-03 and 07-04 should each edit it once, consciously.
- **The skill half is now settled and should not be reopened.** Anything that needs to change about how a skill copy is written belongs in `writeSkillFiles`, which both commands call.
- **Open, carried into the phase:** WINDOWS.md entry 6 (SKILL-04, owed to 07-05, which has not yet run despite being wave 2), entry 7 (the POSIX link leg), entries 8 and 9 (this phase's cases are Windows-observed only), and F-2 above (CLI-01's wording versus D-131's overwrite contract).

---
*Phase: 07-scaffolding-and-example-repo*
*Completed: 2026-09-17*
