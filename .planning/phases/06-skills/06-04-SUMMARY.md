---
phase: 06-skills
plan: 04
subsystem: skills
tags: [skill-content, ears, gherkin, fresh-context, templates, vitest]

# Dependency graph
requires:
  - phase: 06-skills
    plan: 01
    provides: "`renderSkill`/`skillTargets`/`contentHash`, `gen-skills.mjs`, the committed generated module, `accord skills sync`, and the eleven whole-render-output invariants every definition added later inherits"
  - phase: 06-skills
    plan: 02
    provides: "`dev/review.md` — the fresh-context brief shape `ba/ready.md` is the third instance of; `accord/config.yml` declaring `roles: [ba, dev]`, which is what makes `accord-ba/` appear the moment the definition exists"
  - phase: 05-cli-commands
    provides: "`accord new ticket <id> --type epic` (D-104), the command the `build`-profile setup branch invokes"
  - phase: 04-gates
    provides: "`READY_PROMOTE` at `gate/rules.ts:98` — the three findings Ready promotes to errors, which is the mechanism behind the SKILL-05 stop the BA workflow states"
provides:
  - "the `ba` role definition and the three files it loads (`setup.md`, `story.md`, `ready.md`), completing SKILL-01's three definitions"
  - "the D-118 profile branch: a `build` profile with an empty `product/` reads `./setup.md`, everything else reads `./story.md`"
  - "the D-125 readiness review brief — the third instance of the phase's one fresh-context shape"
  - "the D-116 rejected-alternatives convention, taught by the BA workflow and by one guidance line in `packages/core/templates/business-rules.md`"
  - "the ROADMAP criterion 6 negative, asserted over the WHOLE render output: no rendered file names a resume artifact"
  - "the SKILL-01 count assertion — exactly three roles render a `SKILL.md`, and their directories are `accord-ba`, `accord-designer`, `accord-dev`"
  - "this repository carrying all nine files its `roles:` declares under `.claude/skills/`"
affects: [07-init]

actuals:
  tokens: 9200
  tasks: 3
  commits: 0
  plan_head_before: "n/a (nothing committed; see Task Commits)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a negative scan matches the ARTIFACT form of a forbidden noun, never the bare noun, so true prose is never the thing that has to bend"
    - "guard-the-guard for a negative scan is two-sided: scanned-file-count > 0 AND one fixture string per matcher shape that must still match"
    - "a role's `loads:` list carries a file no `SKILL.md` references, because a bundled reference reached only from another reference still needs the entry to render at all"

key-files:
  created:
    - packages/core/skills/ba/SKILL.md
    - packages/core/skills/ba/setup.md
    - packages/core/skills/ba/story.md
    - packages/core/skills/ba/ready.md
    - .claude/skills/accord-ba/SKILL.md
    - .claude/skills/accord-ba/setup.md
    - .claude/skills/accord-ba/story.md
    - .claude/skills/accord-ba/ready.md
  modified:
    - packages/core/templates/business-rules.md
    - packages/core/src/generated/skills.ts
    - packages/core/src/generated/templates.ts
    - packages/core/test/skills.test.ts
    - packages/core/test/templates.test.ts

key-decisions:
  - "The criterion-6 matcher is two shapes and no more: the bare noun `handoff`, and `session` immediately followed by an artifact word or by `.md`. The bare `session` noun is deliberately allowed — it is how D-109's runtime-neutral phrasing says what a fresh context is, and how `debug.md` says the ticket is the session."
  - "`stepBlock(match)` became `stepBlock(body, match)` rather than gaining a second copy for the BA body. One helper, two callers."
  - "The `skillTargets` skip branch is now exercised by a cast (`roles: ['qa']`) because all three roles in the enum are authored. The alternative — deleting the assertion — would have left the branch untested the moment it stopped being reachable from a valid roster."
  - "`accord-ba/SKILL.md` renders to 42 lines, not near the 120 ceiling, because D-114 pushed the substance into three bundled references. The ceiling was never the constraint the plan expected it to be."
  - "The `build`-profile setup branch teaches the D-116 convention with a worked example (a rounding rule and the rounding rule it beat), because a convention nothing validates is only as strong as the example beside it."

requirements-completed: [SKILL-01, SKILL-05]

coverage:
  - id: D1
    description: "`ba/SKILL.md` renders into `accord-ba/` alongside `setup.md`, `story.md`, and `ready.md`, each reachable by a `./<name>` relative path from `SKILL.md` or from `story.md`"
    requirement: SKILL-01
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#renders as a role with its three bundled files reachable by relative path (SKILL-01, D-108)"
        status: pass
      - kind: unit
        ref: "packages/core/test/skills.test.ts#every relative reference resolves inside the same render, for more than one roster (D-110)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The rendered `accord-ba/SKILL.md` branches on `config.profile` at its first step after the gate call; `build` with an empty `product/` points at `./setup.md`, everything else at `./story.md`"
    requirement: SKILL-01
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#branches on config.profile at its first step after the gate (D-118)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The rendered BA text keeps the ticket `draft` and names all three Ready blockers — an unchecked `## Open questions` item, an unconfirmed `assumptions:` entry, and a TODO marker — each asserted independently"
    requirement: SKILL-05
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#keeps the ticket draft and names all three Ready blockers (SKILL-05, ROADMAP criterion 4)"
        status: pass
    human_judgment: false
  - id: D4
    description: "`ready.md` describes a review that runs in a fresh context, reads no code, writes only into `## Open questions`, and names no runtime product"
    requirement: SKILL-05
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#the readiness review is a fresh context with a narrow read and a narrower write (D-125)"
        status: pass
    human_judgment: false
  - id: D5
    description: "`setup.md` names `product/glossary.md`, `product/business-rules.md`, `accord new ticket --type epic`, and the `Rejected:` convention, so the BA workflow carries project and epic setup"
    requirement: SKILL-05
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#the setup branch carries project and epic setup (ROADMAP criterion 6)"
        status: pass
    human_judgment: false
  - id: D6
    description: "`packages/core/templates/business-rules.md` carries one guidance line teaching the `Rejected: <option> — <reason>` convention, and the generated templates module moves with it"
    verification:
      - kind: unit
        ref: "packages/core/test/templates.test.ts#ownership guidance is present"
        status: pass
      - kind: unit
        ref: "packages/core/test/templates.test.ts#generated module matches templates/ (drift)"
        status: pass
    human_judgment: false
  - id: D7
    description: "No file anywhere in the render output — three `SKILL.md` files and eight bundled references — names a resume artifact; the matcher is proved able to go red on one fixture per shape"
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#no rendered file names a resume artifact"
        status: pass
      - kind: unit
        ref: "packages/core/test/skills.test.ts#has files to scan, and a matcher that can still go red"
        status: pass
      - kind: other
        ref: "mutation: `A handoff note lives here.` in setup.md, and `Resume from the session file.` in ba/SKILL.md — each reported at both rendered copies by path and line"
        status: pass
    human_judgment: false
  - id: D8
    description: "Exactly three roles render a `SKILL.md`, and their parent directories sorted are `accord-ba`, `accord-designer`, `accord-dev`"
    requirement: SKILL-01
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#exactly three roles render a SKILL.md (SKILL-01)"
        status: pass
    human_judgment: false
  - id: D9
    description: "With all three roles defined, `accord skills sync` in this repository writes `accord-ba/` alongside `accord-dev/`, and a second run reports `unchanged` for every file in both"
    requirement: CLI-08
    verification:
      - kind: other
        ref: "`node packages/cli/dist/cli.js skills sync` in C:/Work/accord: 4 `created` + 5 `unchanged`, then 9 `unchanged`; a third run left md5 and mtime of all four `accord-ba/` files unchanged"
        status: pass
    human_judgment: false
  - id: D10
    description: "No BA text restates a rule the CLI enforces: the skill names the gate and lint commands and lets them print their own reasons"
    requirement: SKILL-04
    verification: []
    human_judgment: true
    rationale: "Not automatable as stated — whether a sentence restates an enforced rule rather than pointing at the command that reports it is a judgement about intent, not a string match. 06-VALIDATION.md carries it as a Manual-Only row for the whole phase. See finding 1 for the one place the line is close."

# Metrics
duration: 9 min
completed: 2026-09-16
status: complete
---

# Phase 6 Plan 4: The `ba` Slice Summary

**The third and last role ships as four files — a 42-line definition whose second step branches on `config.profile`, the week-zero branch that carries glossary, business rules and epic tickets, the per-story branch with a worked example for each of the six EARS shapes, and the readiness review that asks the one question a gate cannot — and ROADMAP criterion 6's "no session or handoff file anywhere" stops being a claim and becomes a scan over all eleven rendered files.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-16T10:29:00Z
- **Completed:** 2026-09-16T10:38:00Z
- **Tasks:** 3
- **Files:** 8 created, 5 modified

## Accomplishments

- **SKILL-01 is complete and counted.** Three definitions exist, and a test now asserts exactly three and names the three directories, so adding or losing a role goes red rather than silently changing what a user receives.
- **The D-118 branch is real, not described.** Step 2 of the rendered `accord-ba/SKILL.md` reads the profile and sends the reader to one of two files; a test pins `config.profile`, `build`, `./setup.md` and `./story.md` inside that one step, so a branch that loses a target fails.
- **The phase now ships three instances of one fresh-context shape.** `ba/ready.md`, `dev/review.md`, and the dev workflow's inline plan-review brief all read: you did not write this, here is the narrow list you read, here is the one question, here is the one place you write, hand it back. `ready.md` was written against `review.md` rather than from scratch.
- **Criterion 6's word is "anywhere", and the scan is now anywhere.** It iterates `skillTargets()` — eleven rendered files across two target directories — and matches the artifact form of the two forbidden nouns, never the bare noun. Both shapes were mutation-proved.
- **This repository carries the full roster it declares.** `.claude/skills/` holds nine files across `accord-ba/` and `accord-dev/`; the second sync reports `unchanged` on all nine and the third writes no bytes and moves no mtime.
- **`npm run check` went from 770 to 779 tests, all green.**

## Task Commits

**Nothing was committed.** The project's standing rule (global CLAUDE.md) is that work is
left in the working tree for review, and the team lead's brief for this run restated the
prohibition as absolute. Per-task commits, the SUMMARY commit, and the tracking-file commit
were all deliberately skipped.

- **Task 1: The BA definition and its `build`-profile setup branch** — `none (uncommitted per project policy)`
- **Task 2: The per-story branch and the readiness review** — `none (uncommitted per project policy)`
- **Task 3: The template convention, the SKILL-05 assertions, and the full roster synced** — `none (uncommitted per project policy)`

**Plan metadata:** `none (uncommitted per project policy)`

`commits: 0` is measured, not narrated: `git log` carries no commit for this plan because
none was made. The full change set is visible with `git status --short` and `git diff`.

## Files Created/Modified

**Source prose**

- `packages/core/skills/ba/SKILL.md` — `kind: role`, `name: accord-ba`, `loads: [ba/setup.md, ba/story.md, ba/ready.md]`; five steps, opening on `accord gate ready <id>`, branching at step 2
- `packages/core/skills/ba/setup.md` — `kind: reference`; the `build`-profile week-zero branch: glossary, business rules with the D-116 convention and a worked example, one epic ticket per epic
- `packages/core/skills/ba/story.md` — `kind: reference`; intent, six worked EARS shapes, tagged Gherkin, open questions and assumptions, the readiness review, then the gate
- `packages/core/skills/ba/ready.md` — `kind: reference`; the readiness review brief, written as the third instance of `review.md`'s shape

**Template**

- `packages/core/templates/business-rules.md` — one guidance line inside the existing comment, teaching `Rejected: <option> — <reason>`

**Generated output**

- `.claude/skills/accord-ba/{SKILL.md,setup.md,story.md,ready.md}` — written by `accord skills sync`, four files, each with a marker and hash
- `packages/core/src/generated/skills.ts` — 6 skills became 10
- `packages/core/src/generated/templates.ts` — moved by the template line

**Tests**

- `packages/core/test/skills.test.ts` — one new `describe('ba workflow structure')` (7 cases) and one new `describe` for the criterion-6 negative (2 cases); `stepBlock` parameterised; one 06-01 case's premise updated; one 06-02 regex repaired (deviations 1 and 2)
- `packages/core/test/templates.test.ts` — the D-116 assertion added beside the two ownership assertions already in `it('ownership guidance is present')`

## Decisions Made

- **The criterion-6 matcher matches the artifact, never the noun.** Shape 1 is the bare noun `handoff`, because no sentence in any of the eleven files uses it and every occurrence would therefore be an artifact reference. Shape 2 is `session` only when an artifact word (`file`, `artifact`, `document`, `doc`, `note`, `log`, `state`, each with an optional `s`) or `.md` follows within one space or hyphen. The bare `session` noun stays legal: `dev/SKILL.md` and `debug.md` use it for "otherwise a new session" and "the ticket is the session", which is the runtime-neutral phrasing D-109 requires once no runtime product may be named. The plan is explicit that the literals bend and the prose does not; no sentence was reworded to satisfy the scan.
- **`stepBlock` was parameterised rather than copied.** It closed over `devBody`; it now takes the body. Two call sites updated, no second helper.
- **The `skillTargets` skip branch is kept covered by a cast.** With `ba`, `dev` and `designer` all authored, no valid roster exercises `Object.hasOwn(skills, key) === false` any more. `roles: ['qa'] as unknown as AccordConfig['roles']` keeps the branch under test, which is what lets a fourth role enter the enum before its workflow is written. Deleting the assertion was the alternative, and it would have made a live branch untested.
- **`setup.md` teaches D-116 with a worked example, not a rule.** The convention has no schema and no gate behind it, so a bare instruction would be the weakest possible form. The example is a rounding rule and the rounding rule it beat, which is also the sample rule already in the template.
- **`story.md` gives exactly one worked EARS line per shape and stops.** Each was checked against `packages/core/src/lint/ears.ts`'s classifier by hand: ubiquitous, `WHILE` state-driven, `WHEN` event-driven, `IF`/`THEN` unwanted-behaviour, `WHERE` optional-feature, and a `WHILE` + `WHEN` complex line.
- **The rendered `accord-ba/SKILL.md` is 42 lines.** The plan expected `ba` to be the role that pressed against the 120-line ceiling. It is the shortest of the three, because D-114 put the substance in the three bundled references. Line counts: `accord-ba` 42, `accord-designer` 44, `accord-dev` 73.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 06-01's "`ba` renders nothing" assertion became false, as this plan intended**

- **Found during:** Task 2 verification
- **Issue:** `packages/core/test/skills.test.ts:69` asserted `paths.filter((p) => p.includes('accord-ba'))` equals `[]`, with the comment "`ba` has no definition yet". Landing `ba/SKILL.md` is what this plan does, so the case failed with the eight expected `accord-ba/` paths.
- **Fix:** Replaced the negative with a positive `toContain('.claude/skills/accord-ba/SKILL.md')`, and kept the skip branch under test with a deliberately invalid roster (`roles: ['qa']`) that renders nothing. The replacement is strictly stronger: it proves both the presence of the authored role and the tolerance of an unauthored one, where the old form proved only the second.
- **Files modified:** `packages/core/test/skills.test.ts`
- **Verification:** `npm test -- --project core skills` — 36/36 pass.
- **Committed in:** not committed (project policy)

This is a test whose premise this plan deliberately changed, not production code bent to make
a test pass.

**2. [Rule 1 - Bug] 06-02's "names no runtime product" guard could never fire**

- **Found during:** Task 3, while writing the same guard for `ready.md`
- **Issue:** `packages/core/test/skills.test.ts:340` built its matcher as `new RegExp('\b' + p + '\b', 'i')`. In a JavaScript string literal `'\b'` is U+0008 BACKSPACE, not the regex word-boundary escape — the pattern was therefore `<BS>Cursor<BS>`, which no rendered text can contain. The assertion `expect(named).toEqual([])` passed unconditionally. The correct form, `'\\b'`, is what the deny-list scan at line 276 already uses.
- **Fix:** Both occurrences corrected to `'\\b'` — the pre-existing one at line 340 and the new one in the `ready.md` case. With the escape repaired the assertion still passes, so the underlying property (`dev/SKILL.md`'s code-review step and `ba/ready.md` name no runtime product) is true; it simply was not being checked before.
- **Files modified:** `packages/core/test/skills.test.ts`
- **Verification:** `npm test -- --project core skills` — 36/36 pass with the repaired escapes.
- **Committed in:** not committed (project policy)
- **Note:** this is a defect in a test guard, not in production code, so the "no auto-fixing production code during audits" rule does not apply. It is also recorded as finding 2 below, because a guard that cannot go red is exactly the failure this plan's own guard-the-guard pairs exist to prevent, and it suggests looking for the same typo elsewhere.

### Documented deviations from the plan text

**3. Task 1's `<verify>` cannot be green at the end of Task 1**

- **Found during:** Task 1
- **Issue:** Task 1 authors `ba/SKILL.md` with `loads: [ba/setup.md, ba/story.md, ba/ready.md]` but creates only two of the three loaded files; `story.md` and `ready.md` are Task 2's. `skillTargets()` renders every entry in `loads:`, so `npm test -- --project core skills` is red between the end of Task 1 and the middle of Task 2. The plan's own `flagged_assumptions` predicts exactly this ("splitting them across waves would leave a dangling reference and a red suite at a wave boundary") but places the boundary between two tasks rather than two waves.
- **Resolution:** Task 1's non-suite checks (`npm run gen`, `npm run lint`, `npm run typecheck`) were run and passed at the end of Task 1; the suite verify was run once all four BA files existed, which is the first moment it can mean anything. No assertion was weakened and no file was stubbed.
- **Files modified:** none

**4. The three `git status --porcelain` verify commands cannot be green under the no-commit policy**

- **Found during:** Tasks 1, 2 and 3 verification
- **Issue:** `test -z "$(git status --porcelain packages/core/src/generated)"` and `test -z "$(git status --porcelain .claude/skills packages/core/src/generated)"` both assume this plan's own new files are already committed. Nothing was committed.
- **Resolution:** Each was run and read against its stated intent, which is "`npm run gen` was run and its output was not hand-edited". `packages/core/src/generated/skills.ts` is `??` because it is new; `templates.ts` is ` M` because this plan's template line moved it. `npm run gen` run a second time leaves both byte-identical (md5 `6f3df904…` and `88502aa1…` before and after), which is the drift the command exists to catch. `.claude/skills` shows only `??` for the two generated directories and ` D` for 06-02's two intended deletions — no modified tracked file, which is the mutation the command exists to catch.
- **Files modified:** none

**5. `git ls-files .claude/skills` returns nothing, not nine paths**

- **Found during:** Task 3
- **Issue:** The acceptance criterion `git ls-files .claude/skills returns exactly nine paths` assumes a committed tree.
- **Resolution:** Evaluated as a working-tree check: `find .claude/skills -type f` returns exactly nine paths — four under `accord-ba/` and five under `accord-dev/` — and nothing else. Recorded rather than weakened.
- **Files modified:** none

**6. "exactly three entries are named `SKILL.md`" is false for the two-runtime roster**

- **Found during:** Task 3
- **Issue:** Task 3's acceptance criterion says exactly three entries across the render output are named `SKILL.md`. The test's `config()` declares `runtimes: ['claude', 'codex']`, so three definitions produce six `SKILL.md` entries with three repeated parent directory names. Read literally the criterion is unsatisfiable; read as intended it is about the number of role definitions.
- **Resolution:** The assertion runs over `skillTargets(config({ runtimes: ['claude'] }))`, where "exactly three" is a count over the whole render output rather than over a slice of it, and then asserts the three directory names. The one-runtime scoping is stated in a comment at the assertion.
- **Files modified:** none

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug) + 4 documented plan/policy conflicts resolved without changing a deliverable.
**Impact on plan:** None on scope. Every artifact the plan names exists.

## Verification Run

Every command below was run on Windows 11 (win32, Node 24) in `C:/Work/accord`.

| Command | Result |
|---|---|
| `npm run gen` | pass — `generated 7 templates`, `generated 10 skills`; run twice, both generated modules md5-identical |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `npm test -- --project core skills` | pass — 36/36 (was 27) |
| `npm test -- --project core templates` | pass — 13/13 |
| `npm run check` (`build && lint && typecheck && test`) | pass — **32 files, 779 tests, 0 failures** (was 770) |
| `node packages/cli/dist/cli.js skills sync` (1st) | 4 x `created` (`accord-ba/`) + 5 x `unchanged` (`accord-dev/`), exit 0 |
| `node packages/cli/dist/cli.js skills sync` (2nd) | 9 x `unchanged`, exit 0 |
| `node packages/cli/dist/cli.js skills sync` (3rd) | md5 and mtime of all four `accord-ba/` files unchanged — no write |
| `node packages/cli/dist/cli.js lint` | exit 0 — one warning, the standing `lint.tokens-missing` from 06-02 |
| `find .claude/skills -type f` | nine paths: 4 under `accord-ba/`, 5 under `accord-dev/` |

### Rendered line counts (D-129 ceiling: 120)

| Role | Lines |
|---|---|
| `accord-ba/SKILL.md` | 42 |
| `accord-designer/SKILL.md` | 44 |
| `accord-dev/SKILL.md` | 73 |

### Mutation checks (proving the new assertions are load-bearing)

Each mutation was applied, `npm run gen` re-run, the suite re-run, and the file restored.

| Mutation | Expected | Observed |
|---|---|---|
| Append `A handoff note lives here.` to `ba/setup.md` | the criterion-6 scan reports it | fails — offenders `[".agents/skills/accord-ba/setup.md:53", ".claude/skills/accord-ba/setup.md:53"]` |
| Append `Resume from the session file.` to `ba/SKILL.md` | the criterion-6 scan reports it | fails — offenders at `accord-ba/SKILL.md:43` in both directories |
| (pre-existing) `'\b'` in the runtime-product matcher | the guard cannot go red | confirmed by inspection; repaired, see deviation 2 |

### Editorial verification (plan `<verification>` item 3)

The three rendered `SKILL.md` files plus `ba/ready.md` and `dev/review.md` were read end to end
once. The three fresh-context reviews — BA readiness, dev plan review, dev code review — carry
the same four beats in the same order: *you did not write this and that is why you are here* →
*read exactly this list and nothing else* → *the one question a gate cannot ask* → *write in
exactly one place and hand it back*. `ready.md` was written against `review.md` rather than
from scratch, which is why they read as instances rather than inventions.

## Issues Encountered

One, and it cost a detour: `cat >> file <<'EOF'` through this session's shell collapsed `\\`
to `\` inside single-quoted JavaScript string literals, which silently turned
`new RegExp('\\b' + ...)` into `new RegExp('\b' + ...)`. It was caught immediately because
the new guard-the-guard fixture failed — which is the whole argument for writing that fixture.
The three affected lines were repaired with the editor rather than the shell. Worth knowing
for any later plan that appends TypeScript through a heredoc.

## Findings / decisions needing owner confirmation

1. **Step 3 of the BA skill is the closest this phase comes to the SKILL-04 line.** It names
   all three Ready blockers — an unchecked `## Open questions` item, an unconfirmed
   `assumptions:` entry, a TODO marker — which is a list of what `accord gate ready` checks.
   The plan required it (ROADMAP criterion 4's first clause, and Task 3's independent
   assertions), and the sentence immediately after points at the command
   (*"Run the gate and read its reasons rather than deciding for yourself which of the three
   still stand"*). This is the same tension 06-02 recorded at its step 8. If the owner reads it
   as a restatement, the fix is to drop the three-item list and say "work stops while the gate
   still has hygiene reasons to print" — but that weakens criterion 4 to a phrase no test can
   pin, which is why it was not done here.

2. **A `'\b'`-for-`'\\b'` typo in a test guard survived a full plan and a green suite.** Fixed
   here (deviation 2), but worth one grep before the phase closes: the same shape can hide in
   any `new RegExp('...' + x + '...')` in this repository. `packages/core/test/skills.test.ts`
   is now clean; the other test files were not audited for it, because that is outside this
   plan's scope boundary.

3. **`accord-designer/` is absent from this repository's `.claude/skills/`, and that is
   correct.** `accord/config.yml` declares `roles: [ba, dev]`, and 06-01's roster-filtering
   assertion already proves the behaviour. The author will see two skill directories, not
   three. Widening `roles:` here is a one-line edit if the owner wants the designer workflow
   loadable in this repository too; the same is true of `runtimes:`, which 06-02 already
   flagged.

4. **`ba` did not press against the 120-line ceiling — nothing has.** 06-01 flagged the ceiling
   as unexercised at 44 lines and named `ba` and `dev` as the roles that would test it. The
   final numbers are 42, 44 and 73. D-129's number is therefore still unvalidated by anything
   real, and 120 remains a number the planner proposed rather than one the content argued for.
   No action needed; recorded so it is not mistaken for a tested bound.

5. **The unconfirmed-assumption assertion matches the phrase, not the mechanism.** It requires
   the rendered body to say "unconfirmed" within 40 characters of `` `assumptions:` ``. A
   rewrite that said the same thing in more words would go red for a wording change rather than
   a substance change. The looser alternative — matching `assumptions:` alone — would have let
   the *unconfirmed* qualifier drop, which is the half of criterion 4 that carries the meaning.
   Flagged as the weaker of the seven BA assertions.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 6's content work is done.** All three definitions and all eight bundled references
  exist, render, and are pinned. Phase 7's `init` can call `skillTargets` + the same write path
  and will produce the full three-role layout for a repository whose `roles:` names all three.
- **Two phase-level verification items remain outstanding,** both by design and both belonging
  to `/gsd-verify-work` rather than to any plan: the D-115 part 2 manual run of the wrong-plan
  fixture through the plan-review brief (06-02 finding 4), and the SKILL-04 manual read of all
  eleven rendered files against `docs/design.md` §5 (06-VALIDATION.md Manual-Only row 3).
- **The Ubuntu CI leg has still never run** for any of the four plans in this phase, because
  nothing has been committed. The second-sync `unchanged` behaviour is proved on Windows only.
- **Nothing is committed.** `git status --short` shows the full change set for review.

## Self-Check: PASSED

- All 8 files listed under `key-files.created` exist on disk (`[ -f ]` per path); all 5 under
  `modified` exist and carry the changes described.
- `git log --oneline --all --grep="06-04"` returns nothing, which is the **expected** result
  under the standing no-commit rule. The frontmatter records `commits: 0` as the measured
  value; no `rev-list` was run against a ledger because no commit exists to count.
- Every `<acceptance_criteria>` item from all three tasks was re-run. The four that cannot be
  literally satisfied under the no-commit policy, under the plan's own task ordering, or under
  the two-runtime test config are recorded as deviations 3-6, each with its substitute check
  and result.
- Plan-level `<verification>`: `npm run check` green (779 tests); `skills sync` run three times
  from the repository root with the second reporting `unchanged` on all nine lines and the
  third proved to write no bytes; the editorial read of the three `SKILL.md` files plus the two
  review briefs was performed and is recorded above.

---
*Phase: 06-skills*
*Completed: 2026-09-16*
