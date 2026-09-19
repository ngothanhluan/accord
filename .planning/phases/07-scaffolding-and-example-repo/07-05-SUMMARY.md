---
phase: 07-scaffolding-and-example-repo
plan: 05
subsystem: skills
tags: [skills, guard, prose, skill-04, d-148, carry-over, vitest]
status: complete

# Dependency graph
requires:
  - phase: 07-scaffolding-and-example-repo
    plan: 01
    provides: "the rebuilt `dist/cli.js` this plan's `skills sync` runs, and the `run.ts`/`index.ts` edits it bundles"
  - phase: 06-skills
    provides: "the definitions under `packages/core/skills/`, `renderSkill`/`skillTargets`/`bodyOf`, `gen-skills.mjs`, and the `skills.test.ts` describe this plan extends"
  - phase: 04-gates
    provides: "`READY_RULES`, `DONE_RULES`, `READY_PROMOTE` — the live tables the new guard computes its banned set from"
  - phase: 03-lint
    provides: "`RULES` — the third live table in the same set"
provides:
  - "`no rendered text restates a rule the CLI enforces (SKILL-04, D-148)` in `packages/core/test/skills.test.ts`: four bans over every rendered skill body, with the rule-id set computed from the live tables so a rule added later is covered with no test edit"
  - "four skill definitions that name the command and stop: `ba/SKILL.md`, `ba/story.md`, `dev/SKILL.md`, `dev/debug.md`"
  - "SKILL-04 closed and attributed to the phase that fixed it; WINDOWS.md entry 6 resolved"
affects: [07-06, 07-08, 09-publish]

actuals:
  tokens: 30000  # chars/4 over the twelve changed files (120,116 chars); the 64,000 estimate is a different scale
  tasks: 3
  commits: 0     # commits are forbidden in this project until the owner approves the diff
  plan_head_before: 53e9df9

tech-stack:
  added: []
  patterns:
    - "a content guard computes its banned set from the engine's own tables rather than from literals, so the guard cannot drift from the thing it guards"
    - "a prose ban whose unit is the paragraph, not the line and not the section: it is the smallest block in which 'names the command and then enumerates what it blocks on' is one readable claim"
    - "the offence and the legitimate use of the same words are separated by proximity, not by vocabulary — a condition alone is fine, a condition beside the command that reads it is not"

key-files:
  created: []
  modified:
    - packages/core/test/skills.test.ts
    - packages/core/skills/ba/SKILL.md
    - packages/core/skills/ba/story.md
    - packages/core/skills/dev/SKILL.md
    - packages/core/skills/dev/debug.md
    - packages/core/src/generated/skills.ts
    - .claude/skills/accord-ba/SKILL.md
    - .claude/skills/accord-ba/story.md
    - .claude/skills/accord-dev/SKILL.md
    - .claude/skills/accord-dev/debug.md
    - .planning/REQUIREMENTS.md
    - .planning/WINDOWS.md

key-decisions:
  - "Owner decision 2026-09-17, option A': SKILL-04's fix stands and `status: draft` survives in `ba/SKILL.md` as its own command-free paragraph. A' executes the 2026-09-16 verdict while keeping the part of SKILL-05 that is not a restated gate rule. See Decision 1"
  - "ROADMAP Phase 6 criterion 4 left unamended: it reads true as a statement about what the BA workflow does, and this plan changed only what the text says, not what the workflow does. See Decision 2"
  - "`error` is deliberately absent from the finding-level ban while `warning` is banned (A-16): every occurrence of `error` in the definitions is about the reader's own software, never about an accord finding level"
  - "the verdict ban is body-scoped, so a `description:` frontmatter line may still say `Ready` (A-17) — that sentence is how a runtime decides whether to load the skill at all, and a code span there would not read as prose"

patterns-established:
  - "Pattern 1: a guard that must fail before the fix has its RED output pasted verbatim into the summary. With commits forbidden here there is no RED commit to point at, so the summary is the only place the evidence can live — and 'the test passes' without it cannot be told apart from 'the test matches nothing'"
  - "Pattern 2: when a new guard collides with an existing requirement-traced case, the collision is a checkpoint, not a test edit. The case at `skills.test.ts:565` encoded a requirement marked Complete; narrowing it was the owner's call"

requirements-completed: [SKILL-04]
---

# Phase 7 Plan 5: SKILL-04 — the never-restates half Summary

A guard that fails when a rendered skill restates a rule the CLI enforces, derived from the live
`RULES`/`READY_RULES`/`DONE_RULES` tables, plus the prose edits across four definitions that make it
green — closing the Phase 6 carry-over D-148 and WINDOWS.md entry 6.

## What was built

**Task 1 — the guard.** One case added to the existing `render output invariants` describe in
`packages/core/test/skills.test.ts`, named
`no rendered text restates a rule the CLI enforces (SKILL-04, D-148)`, plus two imports following
`gate.test.ts:9-10`. Four bans over `bodyOf(text)` of every file in `skillTargets(config())`:

| Ban | What it catches | Source of its set |
|-----|-----------------|-------------------|
| rule id | any `lint.*` / `gate.*` id appearing in a body | computed from `RULES`, `READY_RULES`, `DONE_RULES` — never literals |
| finding level | `warning` / `warnings`, whole word, case-insensitive | source literal; `error` deliberately excluded (A-16) |
| gate verdict | whole-word capitalised `Ready` / `Done` | source literal |
| command adjacency | a paragraph matching `COMMAND` that also contains `## Open questions`, `assumptions:`, `status: draft` or `TODO` | source literal — the `READY_PROMOTE` subjects |

Guard-the-guard asserts a non-empty render and at least one command mention across the whole scan
before the offender assertion, so a render that stopped producing text cannot pass vacuously.
Offenders are collected across every file and sorted path → line → text with the code-point
comparator, never `localeCompare`.

**Task 2 — the prose.** Eight sites across four definitions, each fixed the same way: name the
command, delete the claim about what the command checks.

**Task 3 — the tracking artifacts.** SKILL-04's traceability row re-attributed; WINDOWS.md entry 6
marked fixed through the tool.

## RED evidence — captured before any definition was edited

`npx vitest run --project core packages/core/test/skills.test.ts -t "restates a rule"`, run against
the definitions exactly as Phase 6 left them. Commits are forbidden in this project, so there is no
RED commit; this is the evidence, verbatim.

```
 RUN  v5.0.0 C:/Work/accord

 ❯ |core| test/skills.test.ts (42 tests | 1 failed | 41 skipped) 15ms
   ❯ render output invariants (15)
     × no rendered text restates a rule the CLI enforces (SKILL-04, D-148) 14ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |core| test/skills.test.ts > render output invariants > no rendered text restates a rule the CLI enforces (SKILL-04, D-148)
AssertionError: expected [ …(26) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   ".agents/skills/accord-ba/SKILL.md:18: command beside ## Open questions: 3. The ticket stays `status: draft` until `accord gate ready <id>` passes. Work",
+   ".agents/skills/accord-ba/SKILL.md:18: command beside TODO: 3. The ticket stays `status: draft` until `accord gate ready <id>` passes. Work",
+   ".agents/skills/accord-ba/SKILL.md:18: command beside assumptions:: 3. The ticket stays `status: draft` until `accord gate ready <id>` passes. Work",
+   ".agents/skills/accord-ba/SKILL.md:18: command beside status: draft: 3. The ticket stays `status: draft` until `accord gate ready <id>` passes. Work",
+   ".agents/skills/accord-ba/SKILL.md:24: gate verdict: after Ready has a consequence `accord gate done <id>` reports; let it",
+   ".agents/skills/accord-ba/story.md:57: gate verdict: ticket short of Ready until they are answered, which is the point of writing",
+   ".agents/skills/accord-ba/story.md:75: finding level: read the warnings it prints that the gate does not block on — vague wording in",
+   ".agents/skills/accord-ba/story.md:78: gate verdict: Once Ready passes, the acceptance criteria are recorded as they stand.",
+   ".agents/skills/accord-dev/SKILL.md:9: gate verdict: 1. Run `accord gate ready <id>`. Do not start on a ticket that is not Ready.",
+   ".agents/skills/accord-dev/SKILL.md:45: command beside ## Open questions: 6. If a gap appears — something the ticket does not answer — write the question",
+   ".agents/skills/accord-dev/debug.md:21: gate verdict: makes the reproduction and the regression test the same artifact. Ready still",
+   ".agents/skills/accord-dev/debug.md:69: gate verdict: scenario's test, tagged `@test:<id>` — the same test the Done gate will",
+   ".agents/skills/accord-dev/debug.md:104: gate verdict: | Test after confirming the fix | Untested fixes do not stick, and the Done gate will ask for the test anyway |",
+   ".claude/skills/accord-ba/SKILL.md:18: command beside ## Open questions: 3. The ticket stays `status: draft` until `accord gate ready <id>` passes. Work",
+   ".claude/skills/accord-ba/SKILL.md:18: command beside TODO: 3. The ticket stays `status: draft` until `accord gate ready <id>` passes. Work",
+   ".claude/skills/accord-ba/SKILL.md:18: command beside assumptions:: 3. The ticket stays `status: draft` until `accord gate ready <id>` passes. Work",
+   ".claude/skills/accord-ba/SKILL.md:18: command beside status: draft: 3. The ticket stays `status: draft` until `accord gate ready <id>` passes. Work",
+   ".claude/skills/accord-ba/SKILL.md:24: gate verdict: after Ready has a consequence `accord gate done <id>` reports; let it",
+   ".claude/skills/accord-ba/story.md:57: gate verdict: ticket short of Ready until they are answered, which is the point of writing",
+   ".claude/skills/accord-ba/story.md:75: finding level: read the warnings it prints that the gate does not block on — vague wording in",
+   ".claude/skills/accord-ba/story.md:78: gate verdict: Once Ready passes, the acceptance criteria are recorded as they stand.",
+   ".claude/skills/accord-dev/SKILL.md:9: gate verdict: 1. Run `accord gate ready <id>`. Do not start on a ticket that is not Ready.",
+   ".claude/skills/accord-dev/SKILL.md:45: command beside ## Open questions: 6. If a gap appears — something the ticket does not answer — write the question",
+   ".claude/skills/accord-dev/debug.md:21: gate verdict: makes the reproduction and the regression test the same artifact. Ready still",
+   ".claude/skills/accord-dev/debug.md:69: gate verdict: scenario's test, tagged `@test:<id>` — the same test the Done gate will",
+   ".claude/skills/accord-dev/debug.md:104: gate verdict: | Test after confirming the fix | Untested fixes do not stick, and the Done gate will ask for the test anyway |",
+ ]

 ❯ test/skills.test.ts:415:68

 Test Files  1 failed (1)
      Tests  1 failed | 41 skipped (42)
```

26 offenders: 13 distinct sites, each reported once per target directory. Line numbers are relative
to the body, which is what the scan reads.

## The eight sites and what replaced them

| # | Site | Ban | Was | Now |
|---|------|-----|-----|-----|
| 1 | `ba/SKILL.md` step 3 | command adjacency ×4 | "The ticket stays `status: draft` until `accord gate ready <id>` passes. Work stops while an unchecked `## Open questions` item, an unconfirmed `assumptions:` entry, or a TODO marker remains…" | two paragraphs: the command with no condition, then "A ticket you are still writing stays `status: draft`. Setting it is yours." |
| 2 | `ba/SKILL.md` step 4 | gate verdict | "Editing them after Ready has a consequence…" | "Editing them after `accord gate ready <id>` has passed has a consequence…" |
| 3 | `ba/story.md` §4 | gate verdict | "Both hold the ticket short of Ready until they are answered, which is the point of writing them down…" | "Writing them down rather than resolving them in your head is the point." No command added — the paragraph legitimately names both promoted conditions |
| 4 | `ba/story.md` §6 | finding level | "read the warnings it prints that the gate does not block on — vague wording in particular…" | "read what it reports." |
| 5 | `ba/story.md` §6 | gate verdict | "Once Ready passes…" | "Once `accord gate ready <id>` passes…" |
| 6 | `dev/SKILL.md` step 1 | gate verdict | "Do not start on a ticket that is not Ready." | "Do not start until it passes." |
| 7 | `dev/SKILL.md` step 6 | command adjacency | "write the question into `## Open questions`, stop, and run `accord gate ready <id>` again. It fails on the spot, which is the point." | the condition and the command split into two paragraphs, and the claim dropped |
| 8 | `dev/debug.md` ×3 | gate verdict | "Ready still blocks until at least one scenario exists"; "the same test the Done gate will require"; "the Done gate will ask for the test anyway" | each names `accord gate ready <id>` or `accord gate done <id>` and makes no claim about what it checks |

Site 7 was **not** in the plan's expected set — see Finding 2.

## Decisions Made

### Decision 1 — owner chose option A' over A and B (2026-09-17)

The plan's Task 2 instruction for `ba/SKILL.md` step 3 ("Name no condition") made a pre-existing,
requirement-traced case fail: `keeps the ticket draft and names all three Ready blockers (SKILL-05,
ROADMAP criterion 4)` at `skills.test.ts:565` asserted, over `ba/SKILL.md`'s body only, that it
contains `draft`, `## Open questions`, `unconfirmed …assumptions:` and `TODO marker` — the four
strings the replacement deletes. ROADMAP Phase 6 criteria 3 and 4 contradict each other on this
file: criterion 4 requires the enumeration criterion 3 forbids.

Three options were put to the owner. **A** — SKILL-04 wins, narrow the case. **B** — restore the
sentence as a command-free paragraph, no test edits. **C** — revert step 3, leave SKILL-04 open.
The owner chose **A'**, a variant of A:

- `status: draft` **stays** in `ba/SKILL.md`, in its own paragraph that names no command. It is the
  ticket status the BA is responsible for setting — SKILL-05's subject — not an enumeration of the
  three Ready blockers, which is what D-148 ruled was the offence.
- The `TODO marker` assertion is **dropped**: it is nothing but `lint.sentinel`'s subject, and no
  wording of it in a skill body satisfies SKILL-04.
- The `## Open questions` and `assumptions:` assertions are **re-pointed at `story.md` §4**, where
  they survive — that paragraph names both without a command beside it, which is the shape the new
  guard permits.
- SKILL-05's requirement text in REQUIREMENTS.md is unchanged.

One-line reason, as the owner gave it: *A' executes the 2026-09-16 verdict while keeping the part of
SKILL-05 that is not a restated gate rule.*

The case was renamed to `keeps the ticket draft and teaches where an undecided thing is recorded
(SKILL-05)` and carries a comment explaining why `TODO marker` is absent and why two assertions now
point at `story.md`, referencing SKILL-04, D-148 and this decision.

### Decision 2 — ROADMAP Phase 6 criterion 4 left unamended

Per the owner's instruction, criterion 4 was to be adjusted only if its wording became literally
false. It reads: *"The BA skill keeps the ticket `draft` and stops before Ready while open questions,
unconfirmed assumptions, or TODO markers remain…"*

It is a statement about what the BA workflow **does**, not about what its text **says**. Both clauses
still hold: `ba/SKILL.md` step 3 keeps the ticket `draft`, and it still stops a ticket before the
gate passes — `accord gate ready` blocks on exactly those three subjects through `READY_PROMOTE`.
This plan changed what the skill prints, not what the workflow does. Left alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `.planning/WINDOWS.md` counts disagreed with its entries**

- **Found during:** Task 3
- **Issue:** `gsd-tools windows fixed 6` refused with
  `Ledger counts disagree with entries: frontmatter open/waived/fixed/total=8/0/0/8 but entries yield 9/0/0/9`.
  Entry 9 (recorded by plan 07-02) existed in the trailing JSON block but had no table row, and the
  frontmatter counts had not been raised to match.
- **Fix:** added the missing table row for entry 9 verbatim from its JSON object, and corrected
  `open_count` 8 → 9 and `total_count` 8 → 9. The tool then ran clean and set entry 6 to `fixed` in
  all three regions.
- **Files modified:** `.planning/WINDOWS.md`
- **Commit:** none — commits are forbidden in this project until the owner approves the diff

**2. [Plan expectation] `dev/SKILL.md` step 6 was not in the plan's expected edit set**

The plan's Task 2 named one site in `dev/SKILL.md` (step 1). The RED list named a second: step 6,
where `## Open questions` sat in the same paragraph as `accord gate ready <id>` plus the claim "It
fails on the spot, which is the point." The plan directs that an unlisted site be fixed the same way
("name the command, delete the claim about what the command checks"), which is what was done. Every
site the plan expected was named by the RED list; none was missing.

### Checkpoints

One `checkpoint:decision` was raised and answered — Decision 1 above. No authentication gates.

## Findings

- **F-1 — SKILL-04 and SKILL-05 are in genuine tension on `ba/SKILL.md`.** Resolved for now by
  Decision 1, but the tension is structural, not a one-off: any future criterion phrased as "the
  skill names X" where X is a rule subject will collide with SKILL-04 the same way. Worth stating
  once in REQUIREMENTS.md that SKILL-04 constrains how every other skill requirement may be phrased.
- **F-2 — the rule-id ban matches nothing today.** No definition contains a literal `lint.*` or
  `gate.*` id. It is pure future-proofing, which is exactly why it is computed from the live tables
  rather than asserted against a snapshot: the day someone pastes an id into a skill, it fires with
  no test edit.
- **F-3 — editorial judgement, recorded rather than silently decided.** Two rewrites name a command
  while stopping short of stating what it checks: `debug.md` "…`accord gate done <id>` is what
  reports on it" and the table row "…`accord gate done <id>` runs either way". Both read as naming
  the command rather than paraphrasing the rule, but the line between the two is editorial and a
  stricter house style would drop the second clause entirely.
- **F-4 — `skills sync` wrote only `.claude/skills/` in this repository.** This repo's
  `accord/config.yml` declares a single runtime, so `.agents/skills/` copies are not produced here.
  Pre-existing and unrelated; it does not weaken the guard, which scans `skillTargets(config())` from
  the test's own two-runtime config — which is why every offender in the RED list appeared twice.
- **F-5 — offender line numbers are body-relative, not file-relative.** The scan runs on
  `bodyOf(text)`, so a reported line does not index the rendered file. The trimmed offending line is
  included in every entry, which is what makes an offender findable. Not worth an offset calculation.

## Known Stubs

None.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern and no schema change.
T-07-23 and T-07-25 from the plan's register are the work itself and are mitigated: the guard derives
its rule-id set from the live tables, its RED output is recorded above, and the two tracking
artifacts no longer disagree.

## Verification

All run from the repository root after the final edit.

| Step | Command | Result |
|------|---------|--------|
| 1 | `npm run gen` | `generated 7 templates`, `generated 10 skills` — `packages/core/src/generated/skills.ts` rebuilt by the script, never hand-edited |
| 2 | `npm run build` | `dist/cli.js 27.97 kB`, `Build complete` |
| 3 | `npm run typecheck` | clean, no output |
| 4 | `npm run lint` | clean, no output |
| 5 | `node packages/cli/dist/cli.js skills sync` (1st) | `updated .claude/skills/accord-ba/SKILL.md`, 8 × `unchanged` |
| 6 | `node packages/cli/dist/cli.js skills sync` (2nd) | all 9 paths `unchanged` — the copies settled |
| 7 | `npx vitest run` | **34 test files passed, 822 tests passed, 0 failed** (821 before this plan, +1 new case) |

Acceptance greps:

- `grep -n 'Ready\|Done'` across the four edited definitions returns **one** line:
  `packages/core/skills/dev/SKILL.md:3:description:` — exempt per A-17.
- `.planning/REQUIREMENTS.md` contains `| SKILL-04 | Phase 6, Phase 7 | Complete |` (1 match) and no
  longer contains `| SKILL-04 | Phase 6 | Complete |` (0 matches). Line 74 still reads
  `- [x] **SKILL-04**`.
- `.planning/WINDOWS.md` entry 6 is `fixed` with `resolved_at: 2026-09-18T02:56:51.054Z` in both the
  table row and the JSON object; frontmatter is `open_count: 8`, `fixed_count: 1`, `total_count: 9`.
  No other entry changed status.
- The first `accord` command named in each `SKILL.md` body is still `accord gate ready` — asserted by
  the pre-existing `every SKILL.md opens on the gate` case, which passes.

Manual read (verification item 4): the four edited definitions were read end to end. Each still reads
as a workflow. The one place a reader loses information is `ba/story.md` §6, which no longer singles
out vague wording as the judgement `accord lint` hands back — that is the intended loss, and the
command's own output carries it.

## Commits

**None.** This project forbids `git commit` until the owner approves the diff. `HEAD` is `53e9df9`,
unchanged from the start of this plan. All twelve changed files are uncommitted in the working tree.

## Self-Check: PASSED

- `packages/core/test/skills.test.ts` contains
  `no rendered text restates a rule the CLI enforces (SKILL-04, D-148)` — present, passing.
- All four edited definitions, the regenerated module and the four rendered copies exist on disk and
  differ from their pre-edit state.
- `npx vitest run`: 822 passed, 0 failed. `npm run typecheck` and `npm run lint` clean.
- `git rev-parse --short HEAD` → `53e9df9`, as required.
- No commit hashes to verify: none were created, by design.
