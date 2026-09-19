---
phase: 06-skills
plan: 08
subsystem: skills
tags: [review-brief, prototype-brief, verification-parser, gate-done, evidence-unresolved, render-invariant, tdd]

# Dependency graph
requires:
  - phase: 06-skills
    provides: "the inline step 2 prose 06-05 wrote in place of two unreachable references; the `render output invariants` describe and its `output` / `bodyOf` / `COMMAND` helpers (06-01..06-05)"
provides:
  - "a `review.md` step 2 that SHOWS the two-line shape `parseVerification` anchors on, at the left margin, instead of describing it behind bullets"
  - "a render-output invariant that keeps the `Result:` / `Evidence:` labels out from behind a list marker in every brief, present and future"
  - "a `prototype.md` that names the command and lets the command print its own reasons — no sentence left stating what `accord lint` reads, covers, checks, or reports"
  - "a command-placement invariant over the rendered prototype brief (position, not content)"
  - "the empty-evidence and bulleted-label behaviour of `gate done` pinned by test rather than assumed in a report"
affects: [07-init, 08-mcp]

# Actuals (#2632) — chars/4 over the realized diff, not a harness token count.
# The plan's `estimate.tokens: 70000` is a work-cost estimate, not a diff-size one; the two are not on
# the same scale, so the ratio below is not a calibration signal. Flagged rather than reconciled.
actuals:
  tokens: 1518
  tasks: 3
  commits: 0
plan_head_before: 53e9df94051d2b1fc66f2e50c895684b74ee6b72

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A brief that must teach a machine-readable shape SHOWS it in a fenced block at the left margin and then says the labels are not list items — describing a format in prose is how column-0 anchoring was lost"
    - "A positional invariant (no command named before the step that runs it) is automatable; a content invariant (the prose states nothing about what a command covers) is a recorded manual read, because a pattern cannot tell which noun a quantifier modifies"
    - "A behaviour discovered to be correct during an audit is pinned by a test, never repaired by a production edit"

key-files:
  created: []
  modified:
    - packages/core/skills/dev/review.md
    - packages/core/skills/shared/prototype.md
    - packages/core/test/skills.test.ts
    - packages/core/test/gate.test.ts
  regenerated:
    - packages/core/src/generated/skills.ts
  synced:
    - .claude/skills/accord-dev/review.md
    - .claude/skills/accord-dev/prototype.md

key-decisions:
  - "`packages/core/src/gate/done.ts` was NOT changed, and no rule was added to `DONE_RULES`, although the dispatch authorised it: `evidenceUnresolved` already fails an empty evidence block at level `error` on both profiles. Measured against the fixture, not argued. A second error finding on a defect that already has one would move every `gate done` golden for no behaviour change"
  - "review.md step 2 shows the block WITHOUT the `## @ac-n <scenario name>` heading line: the lead-in sentence above it already carries that placeholder (06-05 decision), so repeating it inside the block would duplicate the one thing 06-05 deliberately moved into the brief"
  - "The evidence placeholder is `<what you ran or inspected, and what you saw>`, an angle-bracket placeholder mirroring `templates/verification.md`, rather than a worked example with a real path — a second concrete path would have risked the exactly-one-`accord/`-rooted-path invariant and taught nothing extra"
  - "All three prototype.md sentences were DELETED rather than narrowed. A narrowed restatement would have been accurate and would still breach 06-05's own prohibition; claiming nothing is a strict subset of claiming only what the rule reports"
  - "No mechanical assertion was added for the content half of the prototype fix. The candidate pattern returns five hits on the authored skills, three of which are legitimate D-128 text that must keep passing; separating them needs semantics, and an allowlist would make the guard mean nothing"

patterns-established:
  - "Test-first on a prose defect: the assertion is written against the rendered output and watched go RED naming the offending file and line, before a byte of prose moves"
  - "A guard that can only pass is proven able to fail: the step 4 heading was removed, the module regenerated, and the case observed red, before the heading was restored"

requirements-completed: [SKILL-06, SKILL-09]

coverage:
  - id: D1
    description: "A reviewer who copies the shape `review.md` step 2 shows writes a `verification.md` that parses: `Result:` yields `pass` with no `load.result-invalid`, and `Evidence:` yields the reviewer's own text (G-2 / NF-03, SKILL-06)"
    requirement: SKILL-06
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#the review brief shows both verification labels at the start of a line"
        status: pass
      - kind: unit
        ref: "packages/core/test/gate.test.ts#LIST MARKER: the shape the review brief used to teach fails Done rather than passing quietly"
        status: pass
    human_judgment: false
  - id: D2
    description: "No rendered skill text anywhere in the render output shows the `Result:` or `Evidence:` label behind a line-leading list marker"
    requirement: SKILL-06
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#no rendered line carries the `Result:` or `Evidence:` label behind a list marker"
        status: pass
    human_judgment: false
  - id: D3
    description: "An evidence block whose evidence text is empty does not pass `accord gate done`: one `gate.evidence-unresolved` at level `error` per block, verdict `fail` (SKILL-09 `empty` probe)"
    requirement: SKILL-09
    verification:
      - kind: unit
        ref: "packages/core/test/gate.test.ts#EMPTY EVIDENCE: a block whose `Evidence:` label has no text after it fails (GATE-04, D-83)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The rendered `prototype.md` names no accord command before the step that tells the reader to run one (G-3 / NF-04, SKILL-09)"
    requirement: SKILL-09
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#the prototype brief names no accord command before its step 4 heading"
        status: pass
    human_judgment: false
  - id: D5
    description: "The rendered `prototype.md` states nothing about what `accord lint` reads, covers, checks, or reports about a prototype — the content half of G-3"
    requirement: SKILL-09
    human_judgment: true
    rationale: "No pattern can separate a legitimate D-128 naming from a restatement without the semantics of which noun a quantifier modifies; the read was performed end to end and every command-naming sentence is quoted below for the owner to check"
  - id: D6
    description: "Both rendered copies of `prototype.md` — under `accord-designer/` and `accord-dev/` — are byte-identical (SKILL-09 `adjacency` probe)"
    requirement: SKILL-09
    verification:
      - kind: unit
        ref: "packages/core/test/skills.test.ts#the two prototype.md copies are byte-identical, non-empty, and at two different paths"
        status: pass
    human_judgment: false

duration: 12 min
completed: 2026-09-17
status: complete
---

# Phase 06 Plan 08: Fidelity of the two rendered step 2s Summary

The review brief now shows the column-0 shape `parseVerification` anchors on instead of
bulleting it, the prototype brief no longer promises a lint check the rule table does not
perform, and the empty-evidence behaviour of `gate done` is pinned by test rather than
assumed — with `gate/done.ts` deliberately untouched, because it was already correct.

**Duration:** 12 min · **Tasks:** 3/3 · **Files changed:** 4 authored + 1 regenerated + 2 synced
**Nothing committed.** The working tree is left dirty for the owner to review.

---

## Accomplishments

1. **`review.md` step 2 shows the shape instead of describing it** — a fenced block with
   both labels at the left margin, presented the way `code-review.md` presents its own
   example, plus one sentence saying the labels are not list items. Both pieces of guidance
   the bullets carried survive as prose.
2. **A render-output invariant keeps the bullet from coming back** — over the whole render
   output, not over a named role, so any brief a later phase adds inherits it.
3. **`prototype.md` lost three sentences and gained nothing** — the lint-coverage claim in
   step 2, and the scope claim and exit condition that opened and closed step 4's first
   paragraph. The survivor is the instruction.
4. **A command-placement invariant over the rendered prototype brief** — position only,
   with both guards proven able to go red.
5. **Two gate cases pin real behaviour** — an empty evidence block, and the shape the old
   brief taught. Neither required a fixture, a golden, or a production edit.

---

## Task 1 — `review.md` step 2 (tracer, TDD)

### RED evidence, recorded verbatim

The assertion was written and run BEFORE any prose moved. Both new cases failed:

```
 FAIL  |core| test/skills.test.ts > render output invariants > no rendered line carries the `Result:` or `Evidence:` label behind a list marker
AssertionError: expected [ …(4) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   ".agents/skills/accord-dev/review.md:29: - `Result:` — `pass`, `fail`, or `blocked`. A scenario you could not check is",
+   ".agents/skills/accord-dev/review.md:31: - `Evidence:` — what you ran or inspected and what you saw. Name the command,",
+   ".claude/skills/accord-dev/review.md:29: - `Result:` — `pass`, `fail`, or `blocked`. A scenario you could not check is",
+   ".claude/skills/accord-dev/review.md:31: - `Evidence:` — what you ran or inspected and what you saw. Name the command,",
+ ]
```

```
 FAIL  |core| test/skills.test.ts > render output invariants > the review brief shows both verification labels at the start of a line
AssertionError: no line begins with the Result label: expected false to be true // Object.is equality
```

FOUR offenders — two authored lines times two rendered copies — exactly as the plan
predicted. The count is not asserted; the array being empty is.

### Before

```markdown
The frontmatter carries `ticket:`, `commit:`, and `reviewed_on:`.
One `## @ac-n <scenario name>` block per scenario, in tag order, each carrying:

- `Result:` — `pass`, `fail`, or `blocked`. A scenario you could not check is
  `blocked`, never `pass`.
- `Evidence:` — what you ran or inspected and what you saw. Name the command,
  the path, or the output. "Looks correct" is not evidence.

Set `commit:` in the frontmatter to the commit you reviewed.
```

### After

````markdown
The frontmatter carries `ticket:`, `commit:`, and `reviewed_on:`.
One `## @ac-n <scenario name>` block per scenario, in tag order, each carrying
two lines that look exactly like this:

```markdown
Result: pass

Evidence: <what you ran or inspected, and what you saw>
```

Each label begins the line it is on — it is not a list item, and nothing is
indented in front of it.

`Result:` is `pass`, `fail`, or `blocked`. A scenario you could not check is
`blocked`, never `pass`. `Evidence:` names the command, the path, or the
output. "Looks correct" is not evidence.

Set `commit:` in the frontmatter to the commit you reviewed.
````

### Constraints held

| Constraint | Check | Result |
|---|---|---|
| Step 2 names no accord command | `grep -E "accord (gate ready\|gate done\|new ticket\|skills sync\|lint\|status)"` over lines 26-45 | no match |
| No `packages/` path, no backslash | grep over the same range | no match |
| Exactly one `accord/`-rooted path across both briefs | existing case, `skills.test.ts` | pass |
| `pass` / `fail` / `blocked`, "blocked never pass", "Looks correct is not evidence" retained | read | all three present |
| Generated module regenerated, not hand-edited | `npm run gen`; drift case | pass |

---

## Task 2 — `prototype.md` stops promising a check the rule table does not perform

### RED evidence, recorded verbatim

The command-placement case was added and run before the deletions:

```
 FAIL  |core| test/skills.test.ts > render output invariants > the prototype brief names no accord command before its step 4 heading
AssertionError: expected [ 'accord lint' ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "accord lint",
+ ]
```

The offender is the step 2 sentence being deleted.

### The guard was proven able to go red

The plan requires this and it was done, not assumed. The step 4 heading was removed from
the authored file, `npm run gen` re-run, and the case observed failing on its own guard:

```
AssertionError: no step 4 heading was found: expected -1 to be greater than -1
```

The heading was then restored, the module regenerated, and the suite returned to green.

### Deletion 1 — step 2, the fourth of five sentences

**Before**

```markdown
One HTML file: a comment block at the top, an empty body. The comment block
names the ticket, a `Derived from:` line for what step 1 found, and the owner.
Build the page underneath it. `accord lint` reports anything the header is
missing. One file, no build step, no assets directory —
a reviewer opens it in a browser and it works.
```

**After**

```markdown
One HTML file: a comment block at the top, an empty body. The comment block
names the ticket, a `Derived from:` line for what step 1 found, and the owner.
Build the page underneath it. One file, no build step, no assets directory —
a reviewer opens it in a browser and it works.
```

**Deleted:** `` `accord lint` reports anything the header is missing. ``
The three-field header instruction before it and the one-file sentence after it are
unchanged word for word; only the line wrapping of the surviving text moved.

### Deletions 2 and 3 — step 4's first paragraph

**Before** (three sentences: a scope claim, an instruction, an exit condition)

```markdown
`accord lint` reads every prototype in the repository and reports what is
wrong with each one, at the line. Do not work from memory of the rules — run
it, read the reasons, and fix what it names. Repeat until it reports nothing
about your file.
```

**After** (one sentence: the instruction)

```markdown
Do not work from memory of the rules — run it, read the reasons, and fix what
it names.
```

**Deleted, opening:** `` `accord lint` reads every prototype in the repository and reports what is wrong with each one, at the line. ``
**Deleted, closing:** `Repeat until it reports nothing about your file.`

The opening sentence is not merely imprecise, it is false in this repository:
`accord/config.yml:11` sets `tokens: docs/tokens.css`, and `prototypeDerivation`
(`packages/core/src/lint/tokens.ts:210`) returns an empty array outright whenever a tokens
key resolves from config — whether or not the file exists (WINDOWS entry 3 records that it
does not). A designer working here would get a clean lint on a header missing all three
fields while the sentence told them the command had reported what was wrong with it.

The paragraph after it ("A finding you disagree with is a question, not a licence…") and
all five step headings are byte-identical to before.

### The manual read — performed end to end

The rendered `.claude/skills/accord-dev/prototype.md` was read in full, all 51 lines. Every
sentence in it that names an accord command, quoted so the owner can check the judgement
rather than take it:

| Line | Sentence | Judgement |
|---|---|---|
| 40 | ``## 4. Run `accord lint` and fix what it reports`` | Heading. Names the command and instructs the reader. It does not say which prototypes are read, which fields are checked, or what is reported about any of them. The plan holds the headings unchanged; flagged here because "and fix what it reports" is the closest thing left to a coverage claim, and the owner may want it as a bare `` ## 4. Run `accord lint` `` |
| 50-51 | ``  `accord gate ready <id>` is the only thing that says whether the ticket now has what it was missing.`` | D-128 shape: names the command as the authority without restating any rule it applies. Unchanged by this plan |

Line 1 is the generation marker (`<!-- generated by accord skills sync … -->`), which is
machine text, stripped by `bodyOf` and not prose of the brief. `accord/config.yml` (line 15)
and `accord/assets/<id>/prototype.html` (lines 7, 37) are paths, not commands.

**Conclusion of the read:** no sentence anywhere in the rendered file states what
`accord lint` reads, covers, checks, or reports about a prototype.

### `accord skills sync` — the nine status lines

`npm run gen && npm run build && node packages/cli/dist/cli.js skills sync`, exit 0:

```
unchanged .claude/skills/accord-ba/SKILL.md
unchanged .claude/skills/accord-ba/ready.md
unchanged .claude/skills/accord-ba/setup.md
unchanged .claude/skills/accord-ba/story.md
unchanged .claude/skills/accord-dev/SKILL.md
unchanged .claude/skills/accord-dev/code-review.md
unchanged .claude/skills/accord-dev/debug.md
updated .claude/skills/accord-dev/prototype.md
updated .claude/skills/accord-dev/review.md
```

Exactly the two `updated` lines the plan requires, and seven `unchanged`. The two rewritten
files are sync output, not edit targets — they appear in the diff on purpose, so this
repository stops dogfooding the briefs this plan repairs.

This repository declares `roles: [ba, dev]`, so it holds no `accord-designer/` directory on
disk. The `accord-designer/` copy of `prototype.md` exists only in the render output, where
it was confirmed byte-identical to the `accord-dev/` copy:

```
.claude/skills/accord-designer/prototype.md
.claude/skills/accord-dev/prototype.md
byte-identical: true | length 2066
```

`packages/core/src/lint/tokens.ts` and `packages/core/src/lint/rules.ts` are untouched
(`git status --porcelain packages/core/src/lint` is empty).

---

## Task 3 — what `gate done` already does

Both cases passed on their first run. That is the expected outcome and not a TDD miss: this
task pins behaviour that already holds, and a production edit to make a test go from red to
green here would have been exactly the thing the project's rule against auto-fixing during
an audit forbids.

### Measured `gateDone` verdicts over the `gate-done` PASS ticket

Run against the shipped fixture with `PASS/verification.md` replaced in memory:

| `verification.md` shape | verdict | findings |
|---|---|---|
| as shipped, labels at column 0 | `pass` | none |
| both labels behind a list marker | **`fail`** | 2x `gate.evidence-unresolved` (error), 2x `load.result-invalid` (error) |
| `Result:` at column 0, `Evidence:` behind a list marker | **`fail`** | 2x `gate.evidence-unresolved` (error) |
| `Evidence:` at column 0 with no text after it | **`fail`** | 2x `gate.evidence-unresolved` (error) |

Rows 2 and 4 are the two shapes now pinned by test. Rows 1 and 3 were measured for the
record and are not asserted by this plan.

**One difference from the plan's table, reported not smoothed.** The plan recorded row 1 as
`pass` with "one `gate.author-skipped` warning"; the measurement above returns `pass` with
no finding at all. The difference is in the measurement harness, not in the gate: this run
supplied a reviewer author for every `verification.md` in the fixture (which is what
`gate.test.ts`'s own `GIT` record does), so `gate.author-skipped` had nothing to fire on.
The verdict and all three `fail` rows match the plan exactly.

### Cases added

`packages/core/test/gate.test.ts`, in the `gate done: the Human layer` describe, using a
local `patchedReview` helper of the same shape as the Machine layer's `patched`:

- `EMPTY EVIDENCE: a block whose `Evidence:` label has no text after it fails (GATE-04, D-83)`
  — asserts verdict `fail`, one `gate.evidence-unresolved` at `error` per block, and that
  the unpatched `PASS` ticket still reaches `pass` in the same case, so the failure is
  attributable to the edit rather than to the fixture.
- `LIST MARKER: the shape the review brief used to teach fails Done rather than passing quietly`
  — asserts verdict `fail` with both `load.result-invalid` and `gate.evidence-unresolved` at
  `error` per block.

No fixture file was added, no golden moved:

```
$ git status --porcelain packages/core/test/fixtures packages/core/test/__golden__
?? packages/core/test/__golden__/wrong-plan.lint.json
?? packages/core/test/__golden__/wrong-plan.snapshot.json
?? packages/core/test/fixtures/wrong-plan/
```

The three entries are the pre-existing Phase 6 ones, unchanged.

`packages/core/src/gate/done.ts`, `refs.ts` and `rules.ts` are byte-identical
(`git status --porcelain packages/core/src/gate` is empty).

---

## Verification

| # | Check | Result |
|---|---|---|
| 1 | `npm run gen && npx vitest run packages/core/test/skills.test.ts` | 41 passed (was 38), drift case green |
| 2 | `npx vitest run packages/core/test/gate.test.ts` | 121 passed (was 119) |
| 3 | `npm run build && npm run lint && npm run typecheck && npm test` | **32 test files, 794 tests, all passed**; lint and typecheck silent |
| 3a | `node packages/cli/dist/cli.js skills sync` | exit 0, 2 `updated`, 7 `unchanged` |
| 4 | RED observations recorded | both, verbatim, above |
| 5 | `git status --porcelain packages/core/test/fixtures packages/core/test/__golden__` unchanged across Task 3 | 3 pre-existing entries, unchanged |

Test count moved 789 → 794: three cases in `skills.test.ts`, two in `gate.test.ts`.

---

## Deviations from Plan

None — plan executed exactly as written. The one authorised change the plan told the
executor NOT to make (`packages/core/src/gate/done.ts`) was not made.

**Total deviations:** 0. **Impact:** none.

---

## Findings for the owner

### F-1 — `gate done` was found correct; the authorised Phase 4 edit was deliberately not made

Carried forward from the plan's `<finding_before_execution>` and re-measured during
execution. 06-VERIFICATION.md stated that `gate done` "passes with the reviewer's work
silently dropped" and the dispatch authorised widening this plan into Phase 4 code to add an
emptiness check. That premise does not hold.

The Done gate's Human layer does not live in `done.ts`. `evidenceUnresolved`
(`packages/core/src/gate/refs.ts:146`) is registered in `DONE_RULES`
(`packages/core/src/gate/rules.ts:81`) at level `error` on both the `build` and `maintain`
profiles, and is absent from `MAINTAIN_DOWNGRADE`, so neither profile softens it. Empty
evidence cites nothing, so it fails. Its own doc comment already said so.

**Measured, not argued:** an empty evidence block yields verdict `fail` with one
`gate.evidence-unresolved` at `error` per block (table above). `gate done` is not silent on
any of the three broken shapes. The reviewer's work is dropped by the PARSER — which is
real, and is what Task 1 fixes — but the gate refuses loudly, with a named rule at error
level.

So no rule was added and `done.ts` was not edited. Adding one would put a second error
finding on a defect that already has one, move every `gate done` golden, and enlarge the
`DONE_RULES` table for no behaviour change.

**Owner decision available:** if a distinct rule for empty evidence is still wanted for its
own sake — a clearer reason string than "cites no file, test, or command that exists" —
that is a separate, additive change to `DONE_RULES` and can be planned on its own. It is not
needed to close G-2.

### F-2 — the narrowed sentence, if it is wanted after all

The dispatch proposed restating the `prototype.md` claim precisely (the derivation line only,
and only when no tokens file is configured). That sentence would be accurate and would still
breach the prohibition 06-05 wrote for itself: naming the command and paraphrasing what it
checks is the adjacency the owner already upheld against the BA skill on 2026-09-16
(WINDOWS entry 6). Claiming nothing is a strict subset of claiming only what the rule
reports, so deletion satisfies the stated intent by the shortest route. **If the narrowed
sentence is wanted, it is a one-line addition to step 2.**

### F-3 — `## 4. Run `accord lint` and fix what it reports` still says the command reports something

The plan holds the five step headings unchanged and the heading is the antecedent the
surviving sentence's "run it" depends on, so it was not touched. Flagged because it is the
closest thing left in the file to a coverage claim: "and fix what it reports" asserts that
the command reports *something* the reader should fix, without saying what. A stricter
reading of 06-05's prohibition would trim it to `` ## 4. Run `accord lint` ``. **Owner's
call; not changed here.**

### F-4 — the editor diagnostic on `skills.test.ts:122` is stale, not real

The orchestrator flagged an editor report of `Property 'at' does not exist on type
'string[]' … try changing the 'lib' compiler option to 'es2022' or later`. Checked rather
than assumed: `tsconfig.base.json` sets `"target": "es2022"`, TypeScript infers `lib` from
`target`, and `packages/core/tsconfig.test.json` has `"include": ["src", "test", …]`, so
the file is covered by `npm run typecheck` — which ran silent on all three projects.
`Array.prototype.at` is ES2022 and is available. **No change made; no `lib` widened.**

### F-5 — `skills.test.ts` has no line number stability for downstream references

Adding three cases inside the `render output invariants` describe shifted every case below
it by 26 then 21 lines, so plan-text references such as "`skills.test.ts:406`" and
"`skills.test.ts:419`" no longer name those cases. The cases themselves are unchanged and
pass; only the line numbers moved. Future plans should cite case names rather than line
numbers in this file. Noted, not acted on.

---

## Known Stubs

None. No hardcoded empty value, placeholder string, or unwired component was introduced.

---

## Threat Flags

None. No file changed here introduces a network endpoint, an auth path, a file-access
pattern, or a schema change at a trust boundary. The only production-adjacent artifact
touched is `packages/core/src/generated/skills.ts`, which was produced by `npm run gen`
rather than hand-edited (T-06-08-04 mitigated as planned).

---

## Authentication Gates

None encountered.

---

## Self-Check: PASSED

| Claim | Check | Result |
|---|---|---|
| `packages/core/skills/dev/review.md` step 2 rewritten | read back, lines 26-45 | FOUND |
| `packages/core/skills/shared/prototype.md` three sentences gone | read back, 51 lines | FOUND |
| `packages/core/test/skills.test.ts` three new cases | suite 38 → 41 | FOUND |
| `packages/core/test/gate.test.ts` two new cases | suite 119 → 121 | FOUND |
| `packages/core/src/generated/skills.ts` regenerated | drift case passes | FOUND |
| `.claude/skills/accord-dev/{review,prototype}.md` re-rendered | `skills sync` reported `updated` on both | FOUND |
| `packages/core/src/gate/done.ts` unchanged | `git status --porcelain packages/core/src/gate` empty | CONFIRMED |
| `packages/core/src/lint/{tokens,rules}.ts` unchanged | `git status --porcelain packages/core/src/lint` empty | CONFIRMED |
| Whole repo green | 32 files, 794 tests | PASS |
| Nothing committed | `git log -1` still `53e9df9`; changes unstaged/untracked | CONFIRMED |

Commits: **0**, by instruction — the project owner's standing rule is that nothing is
committed until they approve, and this plan's own success criteria say the working tree is
left dirty for review. `plan_head_before` is recorded above so the count is measurable
against the same instrument once the owner does commit.

---

## Next

G-2 (NF-03) and G-3 (NF-04) are closed. G-0 / SKILL-04 remains open by design — the three
restating sentences in the BA skill were adjudicated by the owner on 2026-09-16 and
deferred to Phase 7 (06-06-SUMMARY CF-1, WINDOWS entry 6, status `open`). SKILL-04 stays
unticked, which is the accurate state of the requirement.

Phase 06 has all eight plans summarised. Ready for `/gsd-verify-work 06`.
