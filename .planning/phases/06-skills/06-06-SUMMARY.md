---
phase: 06-skills
plan: 06
subsystem: testing
tags: [skills, verification, requirements, plan-review, lint-rules]

requires:
  - phase: 06-skills
    provides: "the ten skill definitions, the rendered copies under .claude/skills/, the wrong-plan fixture, and plan 06-05's amended step 2s"
provides:
  - "A recorded before/after `## Plan` from one fresh-context run of the dev skill's plan-review brief"
  - "Eleven recorded rule-mention lines, one per rendered skill file"
  - "A recorded SKILL-04 verdict that Task 3 acts on"
affects: [07-init, 08-mcp]

actuals:
  tokens: 6000
  tasks: 3
  commits: 0

# Nothing in this plan is committed, by the project owner's standing rule in .claude/CLAUDE.md.
# `commits: 0` is intentional, not an uncommitted-work defect: HEAD is unmoved and every change
# sits in the working tree for review. See `## Prepared commits (not run)`.
plan_head_before: 53e9df94051d2b1fc66f2e50c895684b74ee6b72

tech-stack:
  added: []
  patterns:
    - "A fresh review context opened as a headless CLI session in an unrelated working directory, handed text and no filesystem tools, so the prohibition on giving it source files is enforced by the environment rather than by instruction"

key-files:
  created:
    - .planning/phases/06-skills/06-06-SUMMARY.md
  modified: []

key-decisions:
  - "The fresh context for Task 1 was a headless `claude -p` session run from the scratchpad directory with every file and search tool disallowed — it could not have read the repository even had it tried"
  - "Task 1 reads as a pass with one recorded caveat: the review dissolved the ordering defect by re-slicing rather than reordering, which is the shape step 3 of the skill asks for but not the literal shape the plan's second PASS clause names"
  - "Task 2 reads as a fail: two files carry sentences that name a gate command and also enumerate what it blocks on, which is the boundary case the plan says to record as `restates`"
  - "SKILL-04 is NOT ticked. Task 3 ran on its no-tick branch, which is what a recorded `fail` selects — the branch is a designed outcome of the task, not a blocked one"
  - "Owner ruling: Task 1 is a PASS, and the plan's two PASS clauses are mutually exclusive as written — meeting clause 1 dissolves clause 2's subject. Recorded as a defect in the plan's wording, not a shortfall in the review"
  - "Owner ruling: the `restates` verdict is upheld on all three sentences; the plan's own adjacency tie-breaker is decisive and the recorded counter-argument argues for a different tie-breaker rather than showing this one was misapplied"
  - "Owner ruling: the prose fix is deferred to Phase 7 as a documented carried-forward finding; no 06-07 gap plan is written and the three sentences are not rewritten here"

patterns-established:
  - "Judgement-gated requirement ticks record the counter-argument alongside the verdict, so the owner can overturn a borderline `restates` without re-reading eleven files"

requirements-completed: []

coverage:
  - id: D1
    description: "The wrong-plan fixture run once through the dev skill's plan-review brief in a fresh context, with the `## Plan` recorded before and after"
    requirement: "SKILL-12 (structural half already verified in CI)"
    verification: []
    human_judgment: true
    rationale: "The subject is model behaviour. The project's `No API keys` constraint forbids running a model inside the test suite, and D-115 accepts the split: CI proves the structure, a human proves the behaviour, once."
  - id: D2
    description: "All eleven rendered skill files read against the Ready/Done tables and the lint RULES table, one recorded line per file"
    requirement: SKILL-04
    verification: []
    human_judgment: true
    rationale: "06-VALIDATION.md designates this Manual-Only: the property is whether a sentence restates a gate row rather than pointing at the command, which is a judgement about intent. A keyword matcher would flag a skill for naming `## Open questions` at all."
  - id: D3
    description: "SKILL-04's checkbox and traceability row left untouched, consistent with the recorded verdict"
    requirement: SKILL-04
    verification:
      - kind: other
        ref: "grep -c '^- \\[ \\] \\*\\*SKILL-04\\*\\*' .planning/REQUIREMENTS.md"
        status: pass
    human_judgment: false

duration: 26 min
completed: 2026-09-16
status: complete
---

# Phase 06 Plan 06: Two human verifications and the SKILL-04 verdict Summary

**The wrong-plan fixture came back re-sliced and correctly ordered from a fresh context; the eleven-file rule-mention read found two files that enumerate what a gate blocks on, so SKILL-04 stays open.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-09-16T05:11:00Z
- **Completed:** 2026-09-16T05:37:12Z
- **Tasks:** 3 of 3
- **Files modified:** 0 (Task 3 took its no-tick branch; `.planning/REQUIREMENTS.md` is byte-unchanged)

## Status: complete — both checkpoints ruled on by the owner

Both checkpoint tasks carry `gate="blocking-human"`. Their evidence was recorded below and the plan
halted there. The owner has since been presented with that evidence, together with the executor's
own caveats, and has ruled on all three open questions. Task 3 then ran on the branch the ruling
selects. The rulings are recorded in full under **Checkpoint outcomes** immediately after each
task's evidence.

---

## Task 1 — The wrong-plan fixture through the plan review

### What the fresh context was given, and what it was not

It was given exactly two things, in one prompt, as text:

1. the five lines of `accord-dev/SKILL.md` step 4 ("Read no code" / "Edit only `## Plan`" / the
   wrong layer / the wrong order / an approach the acceptance criteria will not survive), plus the
   sentence that follows them ("Whether every scenario is covered is `accord lint`'s question, not
   this one's");
2. the fixture's `## Intent`, `## Acceptance criteria`, and `## Plan` sections.

It was **not** given the skill body, the ticket's frontmatter, `## Requirements`,
`## Open questions`, `## Verification notes`, the HTML comment that names the two designed defects,
or any source file.

The fresh context was a headless `claude -p` session launched from the session scratchpad directory
— not from the repository — with `--disallowed-tools "Read,Write,Edit,Bash,Glob,Grep,Task,WebFetch,WebSearch,NotebookEdit,Skill"`.
It had no filesystem access and no repository context, so the prohibition was enforced by the
environment rather than only by instruction. It was handed text, not a path, and it wrote nothing.

### BEFORE — the fixture's `## Plan`, verbatim

```
## Plan
- Wire the export control to the endpoint and show the empty-list message @ac-1 @ac-2
- Add the row serialiser that turns a ticket into a CSV line
- Add the export endpoint that gathers the listed tickets and calls the serialiser
```

### AFTER — what the fresh context returned, verbatim

```
No file tools here, so the revised section is below — paste it in place of `## Plan`.

## Plan
- Export a listed set of tickets to a CSV file, end to end: export control → gather the listed tickets → header row plus one row per ticket → file downloads @ac-1
- Empty list: the export control reports there is nothing to export and no download starts @ac-2

Three problems with the original:

**Wrong order.** Step 1 wires the control "to the endpoint", but the endpoint is step 3 and the serialiser it calls is step 2. The plan runs backwards down its own dependency chain — step 1 cannot be built, let alone demonstrated, until both steps below it exist.

**Wrong layer.** Steps 2 and 3 are layers (serialiser, endpoint), not slices. No scenario is visible through either one, which is why both are untagged and all the tags pile onto a step that can't deliver them alone. Nothing in the plan is demonstrable until all three land — that's a single step wearing three hats.

**Approach @ac-2 may not survive.** "No file arrives" means the empty check has to happen before the download is initiated, not as an empty-bodied response from the same endpoint that serves the file. If the control is a plain link/form post to a download endpoint, a browser will take whatever comes back as a file and the criterion fails. Slicing @ac-2 as its own step forces that decision to be made rather than inherited.
```

### Which defects the returned plan fixed

**Wrong layer — fixed.** The BEFORE has one step carrying `@ac-1 @ac-2` and two carrying no tag.
The AFTER has two steps, `@ac-1` on the first and `@ac-2` on the second — one tag per step, each
step a slice a scenario can be watched working through ("file downloads", "no download starts").
The review named the defect in its own words without being told to look for it in this plan:
"Steps 2 and 3 are layers (serialiser, endpoint), not slices."

**Wrong order — named explicitly, and eliminated rather than reordered.** The review named it
first: "Step 1 wires the control 'to the endpoint', but the endpoint is step 3 and the serialiser
it calls is step 2. The plan runs backwards down its own dependency chain." No step in the returned
plan is placed before the step whose output it needs — the dependency chain is spelled out inside
the first slice in order ("export control → gather the listed tickets → header row plus one row per
ticket → file downloads").

### Task 1 verdict: pass, with one caveat recorded for the owner

The first PASS clause is met literally. The second clause reads "the endpoint step and the
serialiser step come back ahead of the step that consumes their output" — and the returned plan has
no separate endpoint or serialiser step to come back ahead of anything, because the review folded
both into the slice that demonstrates `@ac-1`. The ordering defect is gone; it was dissolved by
re-slicing, not repaired by reordering.

That is the shape `accord-dev/SKILL.md` step 3 actually asks for ("One step per `@ac-n` by default"),
so I read it as a pass. It is not the literal wording of the plan's second clause, and the owner
may read it the other way. **This caveat is flagged rather than decided.**

The review also volunteered a third finding — that `@ac-2`'s "no file arrives" may not survive an
approach where the empty case shares the download endpoint. That is the fifth brief line ("an
approach the acceptance criteria will not survive") firing unprompted. The fixture was not built to
carry that defect and nothing grades it; it is recorded as observed, not as a criterion met.

### Fixture integrity

- Before the run: `bc5139f867319f08aeb7856797debaff0fc9ae566558be7fbc05dc7e9bd9c653`, 1917 bytes.
- After the run: `bc5139f867319f08aeb7856797debaff0fc9ae566558be7fbc05dc7e9bd9c653`.

Byte-unchanged. The fresh context returned text and did not write back into the file — it said so
itself ("No file tools here"). The fixture was not edited, regenerated, or re-tagged.

### Checkpoint outcome — owner ruling on Task 1: PASS

The owner was shown the before/after plans and the re-slice-versus-reorder caveat above, and ruled
Task 1 a **pass**.

The ground: the review eliminated the ordering defect by re-slicing into vertical slices rather
than by reordering three technical steps, and that satisfies the criterion. The owner further ruled
that **the plan's two PASS clauses are mutually exclusive as written**. Clause 1 requires that "the
three technical-layer steps come back as vertical slices carrying their own `@ac-n` tags"; clause 2
requires that "the endpoint and serialiser steps come back ahead of the step that consumes their
output". Meeting clause 1 dissolves clause 2's subject by construction — once the endpoint and
serialiser steps have been folded into vertical slices, there are no separate endpoint and
serialiser steps left for clause 2 to order. A returned plan cannot satisfy both.

This is recorded as **a finding against the plan's wording, not a shortfall in the review**. It is
carried forward below for whoever next writes a verification clause of this shape.

---

## Task 2 — The eleven rendered files read for restated rules

### Preconditions confirmed before reading

`node packages/cli/dist/cli.js skills sync` printed `unchanged` on all nine rendered paths before
the read, so plan 06-05 Task 2's amended step 2s are the text that was judged. The same command
printed `unchanged` on all nine again after the read, and the sha256 of every rendered file is
identical before and after. No rendered file was edited during this task.

### References read

- `docs/design.md` section 5, the Ready table (six rows) and the Done layers (Machine / Fresh
  context / Human).
- `packages/core/src/lint/rules.ts` lines 47-79, the thirty-id `RULES` table with each rule's level.
- `packages/core/src/gate/rules.ts:98` —
  `READY_PROMOTE = ['lint.sentinel', 'lint.open-question', 'lint.assumption-unconfirmed']`, the
  three warnings the Ready gate promotes to blocking. Read because two of the record lines below
  turn on exactly which conditions block Ready.

### The eleven record lines

1. **`accord-ba/SKILL.md` — restates.** Step 1 ("Run `accord gate ready <id>` … What the gate
   prints is the list of what is still missing") and step 4 ("Editing them after Ready has a
   consequence `accord gate done <id>` reports; let it report it") both point at the command and
   stop, and are passes on their own. Step 3 is not: *"The ticket stays `status: draft` until
   `accord gate ready <id>` passes. Work stops while an unchecked `## Open questions` item, an
   unconfirmed `assumptions:` entry, or a TODO marker remains."* The second sentence names the
   command's three blocking conditions — the exact membership of `READY_PROMOTE`
   (`lint.open-question`, `lint.assumption-unconfirmed`, `lint.sentinel`) and the Ready table's
   "Unchecked `## Open questions` items or unconfirmed `assumptions:` entries block Ready" row,
   plus one condition that row does not carry. Naming and restating touch here.
2. **`accord-ba/setup.md` — no rule mention.** Names no gate command and no lint rule. The two
   sentences that touch enforcement — "Nothing validates the line and no gate reads it; it is a
   convention" and "An epic is never gated" — state that no rule applies rather than reproducing
   one. Counts as a pass.
3. **`accord-ba/story.md` — restates.** Section 6's *"Then run `accord lint` and read the warnings
   it prints that the gate does not block on — vague wording in particular, which is a judgement it
   hands back to you rather than a rule"* names `accord lint` and then supplies the rule's id in
   all but name: `lint.vague-wording`, its subject, and its `level: 'warning'` non-blocking status.
   Section 4's *"Both hold the ticket short of Ready until they are answered"* reproduces the same
   Ready row as line 1. Section 6's later sentence ("Changing them afterwards has a consequence
   `accord gate done <id>` reports") is a clean pass, as is section 3's Gherkin tagging, which is
   the format convention and not a rule statement.
4. **`accord-ba/ready.md` — pass.** *"Whether a scenario is present at all is
   `accord gate ready <id>`'s question and it prints its own reasons."* Names the command, marks it
   out of scope for the review context, and hands it the reasons. Section 3's "`## Open questions`,
   and nowhere else" is the folder convention, not a rule.
5. **`accord-dev/SKILL.md` — pass.** Step 1 defers to the gate's own reasons ("Each reason it
   prints belongs to the stage that owns it"); step 3 says "Run `accord lint` and fix what it
   reports about the plan" and stops; step 4's closing sentence is a scope marker ("Whether every
   scenario is covered is `accord lint`'s question, not this one's"); step 6's "run
   `accord gate ready <id>` again. It fails on the spot" states the consequence without reproducing
   any row's contents; step 9 is a bare `accord gate done <id>`.
6. **`accord-dev/debug.md` — no rule mention.** A debugging technique end to end. Its two
   gate-adjacent sentences are workflow facts, not rule contents: "Ready still blocks until at least
   one scenario exists" is the design.md row it is telling you to satisfy before reading code, and
   "the same test the Done gate will require" names the requirement without reproducing the Machine
   layer's conditions. Recorded here as a pass; the first of those two is the closest call in the
   file and is noted for the owner rather than hidden.
7. **`accord-dev/review.md` — pass.** Read AFTER plan 06-05 Task 2's amendment (`skills sync`
   reported `unchanged`, and the source `packages/core/skills/dev/review.md` carries the amended
   step 2 with the `<scenario name>` placeholder). Section 5 is the model sentence for this whole
   criterion: *"Say that the review is written, and that `accord gate done <id>` is the developer's
   to run. Do not run it yourself and do not restate what it checks; it prints its own reasons."*
   Section 2 names the `Result:` / `Evidence:` slots and the `commit:` frontmatter key — format
   slots the artifact carries, the same class as `## @ac-n`, not the Done gate's conditions.
8. **`accord-dev/code-review.md` — pass.** Mentions no gate or lint command at all, and its one
   sentence on the subject is the criterion stated from the other side: under "What is not a
   finding" it lists *"Restating a rule the CLI already enforces."* "Who runs it" states that the
   separation is procedural and "nothing in the CLI enforces it", which is the opposite of
   reproducing an enforced rule.
9. **`accord-dev/prototype.md` — pass.** Read AFTER plan 06-05 Task 2's amendment. Step 2's
   `Derived from:` sentence is a pass by the owner's settled ruling — it says only that the comment
   block names the ticket, a `Derived from:` line for what step 1 found, and the owner, then hands
   the reader "`accord lint` reports anything the header is missing". Neither disqualifying clause
   is present: it does not say what happens when the slot is absent, empty, or points outside the
   repository (`lint.prototype-derivation`'s three reasons), and it does not mention hard-coded
   colour or spacing values at all (`lint.token-hardcoded`, the rule behind the `Rule:` line the
   template keeps). Step 4 is the strongest defer in the set: "Do not work from memory of the rules
   — run it, read the reasons, and fix what it names."
10. **`accord-designer/SKILL.md` — pass.** Read from `packages/core/skills/designer/SKILL.md`,
    because this repository's `accord/config.yml` declares `roles: [ba, dev]` and
    `.claude/skills/accord-designer/` is never written here. The read is faithful: `render.ts:2`
    records `kind` and `loads` as authoring keys that must never ship, and `render.ts:85` renders a
    `kind: role` definition as spec frontmatter plus the marker plus the source body — so the
    rendered body is this source body and nothing else. Step 1 defers completely ("read the reasons
    it prints. Those reasons are the whole brief for this stage"); step 4 says "Run
    `accord gate ready <id>` again. The reason you came here for is gone, or the work is not
    finished" without naming which reason.
11. **`accord-designer/prototype.md` — pass.** Not read separately. It is asserted byte-identical
    to line 9's file by `packages/core/test/skills.test.ts:419-429`
    (`expect(copies[0].text).toBe(copies[1].text)` over
    `.claude/skills/accord-designer/prototype.md` and `.claude/skills/accord-dev/prototype.md`), so
    it carries line 9's verdict. **Note:** the plan cites this assertion as `skills.test.ts:389`;
    plan 06-05's edits to that file moved it to 419. The assertion itself is intact and was read at
    its current location.

SKILL-04 verdict: fail

### What holds SKILL-04 open

Two lines read `restates`, both in the BA skill, both the same shape: a sentence that names a gate
command and then enumerates what the command blocks on. The offending sentences, verbatim:

- `accord-ba/SKILL.md` step 3 — "Work stops while an unchecked `## Open questions` item, an
  unconfirmed `assumptions:` entry, or a TODO marker remains."
- `accord-ba/story.md` section 4 — "Both hold the ticket short of Ready until they are answered,
  which is the point of writing them down rather than resolving them in your head."
- `accord-ba/story.md` section 6 — "Then run `accord lint` and read the warnings it prints that the
  gate does not block on — vague wording in particular, which is a judgement it hands back to you
  rather than a rule."

Per the plan, the fix is a prose change, which is a separate and explicitly-justified step the owner
decides on. Nothing was changed while reading.

### The counter-argument, recorded rather than suppressed

All three sentences are accurate today, and each ends by handing adjudication back to the command
("Run the gate and read its reasons rather than deciding for yourself which of the three still
stand"). A reader could fairly call them scope statements — "these three are the BA stage's to
resolve" — rather than rule restatements, in the same family as naming `## Open questions`. The
plan's tie-breaker is what decided it: *"Naming and restating touch here — when they touch, record
`restates`."* If the owner reads the tie-breaker the other way, all eleven lines read `pass`, the
verdict line flips, and Task 3 ticks SKILL-04. That is the owner's call, not this executor's.

### Checkpoint outcome — owner ruling on Task 2: UPHELD, `SKILL-04 verdict: fail` stands

The owner was shown the three quoted sentences and the counter-argument above, and **upheld
`restates` on all three**.

The ground: the plan's own adjacency probe is decisive — naming the command *and* paraphrasing what
it checks is a restatement. Sentence 1 enumerates `READY_PROMOTE`'s exact three members. Sentence 3
supplies `lint.vague-wording`'s subject and its non-blocking level. The counter-argument recorded
above is acknowledged but does not carry: it argues for a *different* tie-breaker rather than
showing that this tie-breaker was misapplied.

**`SKILL-04 verdict: fail` stands. SKILL-04 stays open.**

### Checkpoint outcome — owner ruling on the prose fix: LEFT OPEN, handed to Phase 7

The owner does **not** want the three sentences rewritten now, and does **not** want a 06-07 gap
plan written. The three sentences are recorded as a documented, carried-forward finding (below).

The ground: the fix blocks no numbered ROADMAP criterion and no Phase 7 work, and the owner's
standing audit rule applies — findings are documented before they are fixed, and the fix is a
separate, explicitly-justified decision, which they have chosen to defer. Rewriting the prose while
recording the finding would be exactly the auto-fix-during-an-audit that rule forbids.

---

## Task 3 — Executed on its no-tick branch

Task 3's precondition is satisfied: the SUMMARY carries exactly one line matching
`^SKILL-04 verdict: (pass|fail)$`, and it reads `fail`. That selects the second of the task's two
branches, which is `change nothing in .planning/REQUIREMENTS.md`. A `fail` here is the correct
outcome of the check, not a blocked task, and the branch is a designed part of the task rather than
a failure to perform it.

**SKILL-04 remains open as a consequence of Task 2's eleven-line record, performed 2026-09-16**,
which carries two `restates` lines — `accord-ba/SKILL.md` step 3 and `accord-ba/story.md` sections 4
and 6 — upheld by the owner on the same date.

`.planning/REQUIREMENTS.md` is byte-unchanged by this plan. Verified by reading the four lines back
directly rather than by a whole-file diff, since the file already carries uncommitted changes from
earlier Phase 6 work and from plan 06-05:

| Line | Content | Expected |
|------|---------|----------|
| 74 | `- [ ] **SKILL-04**: Every skill begins with a lint or gate call and never restates a rule the CLI enforces` | unticked — matches the `fail` verdict |
| 190 | `\| SKILL-04 \| Phase 6 \| Pending \|` | Pending — matches the `fail` verdict |
| 67 | `- [x] **CLI-08**: ...` | ticked, exactly as plan 06-05 left it |
| 186 | `\| CLI-08 \| Phase 6 \| Complete \|` | Complete, exactly as plan 06-05 left it |

The file's sha256 is `df0201396b296856e0621ba45807a1bba87cccaf04d66a04996330a2c1361d90`, unchanged
across this plan. No requirement checkbox and no traceability row was touched, in any file, for any
reason. The SKILL-04 traceability row appears exactly once.

---

## Carried-forward findings

Five items leave Phase 6 documented and unfixed. None blocks a numbered ROADMAP criterion; none
blocks Phase 7. They are recorded here because this SUMMARY is where the next reader will look, and
because the owner's standing rule is that a finding is documented before it is fixed.

### CF-1 — The three restating sentences (the open work behind SKILL-04)

This is the whole of what holds SKILL-04 open. The fix is a prose change the owner has deferred to
Phase 7. The sentences, verbatim, with their file and section:

| # | File | Section | Sentence | What it reproduces |
|---|------|---------|----------|--------------------|
| 1 | `.claude/skills/accord-ba/SKILL.md` (source: `packages/core/skills/ba/SKILL.md`) | step 3 | "Work stops while an unchecked `## Open questions` item, an unconfirmed `assumptions:` entry, or a TODO marker remains." | the exact membership of `READY_PROMOTE` (`gate/rules.ts:98`) — `lint.open-question`, `lint.assumption-unconfirmed`, `lint.sentinel` — plus the `docs/design.md` §5 Ready row, which carries only two of the three |
| 2 | `.claude/skills/accord-ba/story.md` (source: `packages/core/skills/ba/story.md`) | section 4 | "Both hold the ticket short of Ready until they are answered, which is the point of writing them down rather than resolving them in your head." | the same `docs/design.md` §5 Ready row as #1 |
| 3 | `.claude/skills/accord-ba/story.md` (source: `packages/core/skills/ba/story.md`) | section 6 | "Then run `accord lint` and read the warnings it prints that the gate does not block on — vague wording in particular, which is a judgement it hands back to you rather than a rule." | `lint.vague-wording` in all but name: its subject and its `level: 'warning'` non-blocking status |

All three are edits to `packages/core/skills/ba/*` followed by `npm run gen` and
`accord skills sync`, never to the rendered copies. The shape of the fix in each case is to stop the
sentence at the command and let it print its own reasons — the model is
`accord-dev/review.md` section 5: *"Do not run it yourself and do not restate what it checks; it
prints its own reasons."*

Also recorded as **entry 6 in `.planning/WINDOWS.md`**, so it survives this phase's close and is
visible at `/gsd-ship`.

### CF-2 — The plan's two PASS clauses are mutually exclusive as written

A wording defect in `06-06-PLAN.md` Task 1's `how-to-verify`, for whoever next writes a verification
clause of this shape. The two clauses are:

1. "the three technical-layer steps come back as vertical slices, each carrying its own `@ac-n` tag,
   rather than one step holding both tags and two holding none";
2. "the endpoint step and the serialiser step come back ahead of the step that consumes their
   output".

Clause 2 presupposes that separate endpoint and serialiser steps survive in the returned plan.
Clause 1 requires that they do not. Satisfying clause 1 dissolves clause 2's subject, so no returned
plan can satisfy both, and the plan states them conjunctively ("differs from the BEFORE in **both**
of these ways"). The same `must_haves.truths` entry carries the same conjunction.

The lesson generalises: when a criterion names a defect *and* a specific repair, the repair can be
made unreachable by a better repair. The clause should describe the property that must hold of the
result (no step precedes the step whose output it needs) rather than the transformation that was
expected to produce it (these two steps move ahead of that one).

### CF-3 — Two stacked doc comments in `packages/core/src/skills/targets.ts` (from plan 06-05)

The doc comment at `targets.ts:27-35` — "Every file this configuration installs, sorted by path…",
which goes on to mention `node:path` being banned and the function's purity — describes
`skillTargets`, but sits directly above `skillDirs`'s own doc comment at `:36-40`. `skillDirs` is
therefore double-commented and `skillTargets` at `:59` carries none.

A comment-only relocation. It predates plan 06-05, which added `allSkillDirs()` *below* `skillDirs`
precisely to leave the stack untouched. No behaviour is affected.

### CF-4 — `prototype.md`'s new heading removed the case that forced SKILL-08's code-span rule (from plan 06-05)

Phase 06-03 restricted the SKILL-08 command scanner to code spans and fenced blocks because
`packages/core/skills/shared/prototype.md:30` read "## 2. Start from the header accord ships" —
English prose whose word sequence a bare-word scanner would have read as a command. Plan 06-05
rewrote that heading; it now reads **"## 2. Start from a single HTML file"** (verified on disk at
line 30).

The scanner is unaffected and stays correct. It is now simply **stricter than the surviving evidence
requires** — the one prose case that forced the restriction no longer exists in the corpus. No
change was made, and none is proposed: loosening the scanner to bare words would re-open the class
of false positive it was narrowed to avoid, and the narrowing costs nothing.

### CF-5 — `06-06-PLAN.md` cites a stale line number for the byte-identity assertion

The plan cites the `prototype.md` byte-identity assertion at `packages/core/test/skills.test.ts:389`
(twice: in Task 2's `read_first` and in its `how-to-verify` line 11). Plan 06-05's edits to that file
moved it. The assertion now lives at `skills.test.ts:428-429`:

```
expect(copies[0].text.length).toBeGreaterThan(0);
expect(copies[0].text).toBe(copies[1].text);
```

**The assertion is intact and passing; only the citation is stale.** Line 389 is now inside an
unrelated `describe` block about the two review briefs. Record line 11 above names the current
location. Nothing was changed.

---

## Prepared commits (not run)

Per `.claude/CLAUDE.md`, nothing was committed. HEAD is still
`53e9df94051d2b1fc66f2e50c895684b74ee6b72`. The commits that would have been made:

- `docs(06-06): record the wrong-plan fixture's before and after plan from a fresh-context review`
- `docs(06-06): record the eleven-file rule-mention read and the SKILL-04 verdict`
- `docs(06-06): close 06-06 on the no-tick branch with the owner's rulings and the carried-forward findings`

Task 3 has no prepared commit of its own — it made no edit to `.planning/REQUIREMENTS.md`, which is
what its branch specifies. The third message above covers this SUMMARY, `.planning/STATE.md`,
`.planning/ROADMAP.md`, and `.planning/WINDOWS.md`.

Nothing was run: no `git commit`, no `git push`, no `git stash`, no `git reset`, no
`git checkout --`. HEAD is `53e9df94051d2b1fc66f2e50c895684b74ee6b72`, unmoved since before this
plan started.

## Decisions Made

- The fresh context was opened as a headless `claude -p` session from the scratchpad directory with
  every file and search tool disallowed, so "not given any source file" is enforced by the sandbox
  rather than asserted.
- Task 1 reads as a pass with the re-slice-versus-reorder caveat recorded rather than resolved.
  **Owner ruling: pass**, and the caveat is reclassified as a defect in the plan's wording (CF-2).
- Task 2 reads as a fail on the plan's own tie-breaker for the touching case, with the
  counter-argument recorded so the owner can overturn it without re-reading eleven files.
  **Owner ruling: upheld** — the counter-argument argues for a different tie-breaker rather than
  showing this one was misapplied.
- **Owner ruling: the prose fix is deferred to Phase 7** as a documented carried-forward finding
  (CF-1). No 06-07 gap plan is written and the three sentences are not rewritten.
- SKILL-04 stays open. No checkbox and no traceability row was touched.

## Deviations from Plan

**1. [Rule 1 — stale reference] `skills.test.ts:389` is now `skills.test.ts:419-429`**
- **Found during:** Task 2, record line 11
- **Issue:** The plan cites the prototype byte-identity assertion at `packages/core/test/skills.test.ts:389`. Plan 06-05's edits to that file moved it; line 389 is now inside an unrelated `describe` block.
- **Fix:** None applied to any file. The record line names the assertion's current location and states that the plan's cited line is stale.
- **Files modified:** none
- **Verification:** `sed -n '419,430p' packages/core/test/skills.test.ts` shows `expect(copies[0].text).toBe(copies[1].text)` over the two `prototype.md` paths.
- **Committed in:** nothing committed

**2. [Rule 3 — missing input] `docs/design.md` section 5's Ready table does not carry the third promoted rule**
- **Found during:** Task 2, record line 1
- **Issue:** The Ready table lists unchecked `## Open questions` and unconfirmed `assumptions:` as blocking, but `packages/core/src/gate/rules.ts:98` promotes three warnings, `lint.sentinel` included. Judging record line 1 required the code, not just the design document.
- **Fix:** Read `packages/core/src/gate/rules.ts:98` as a third reference and recorded it under "References read". No document was changed.
- **Files modified:** none
- **Verification:** `grep -n READY_PROMOTE packages/core/src/gate/rules.ts`
- **Committed in:** nothing committed

---

**Total deviations:** 2 (1 stale reference, 1 missing reference input). Neither changed a file.
**Impact on plan:** None on the outcome. Both are recorded so the next reader does not re-derive them.

## Issues Encountered

None. Both checkpoints reached with their evidence complete; execution halted at the second awaiting
the owner's judgement, which is the designed behaviour of a `gate="blocking-human"` task. The owner
has since ruled on both and Task 3 ran on the branch the ruling selects.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 6 is closed at 6 of 6 plans.** Both `gate="blocking-human"` checkpoints have been ruled on
  and Task 3 has run.
- **SKILL-04 stays open**, correctly and deliberately. It is Phase 6's only unclosed requirement,
  and the whole of what holds it open is CF-1 — three sentences in two BA skill source files.
- **Phase 7 is unblocked.** CF-1 blocks no numbered ROADMAP criterion and nothing Phase 7 builds;
  the owner has handed the prose fix to Phase 7 as a documented finding, not as a prerequisite.
- ROADMAP criterion 7 is now verified on both halves — structural in CI, behavioural once by hand.
  ROADMAP criterion 3 is verified on clauses 1 and 3 in CI and read across all eleven files by hand
  for clause 2, which is the clause that failed.
- Nothing is committed. HEAD is `53e9df94051d2b1fc66f2e50c895684b74ee6b72`.

## Self-Check: PASSED

- `.planning/phases/06-skills/06-06-SUMMARY.md` exists on disk.
- `grep -c '^SKILL-04 verdict: ' 06-06-SUMMARY.md` → `1`, reading `SKILL-04 verdict: fail`. The
  ruling prose above quotes the string inside a bolded sentence, which does not match the anchored
  pattern, so the count is still exactly one.
- Task 1 evidence verified present on disk, not reconstructed: `### BEFORE` and `### AFTER` headings
  both carry a fenced `## Plan`.
- Task 2 evidence verified present on disk, not reconstructed: eleven numbered record lines in the
  plan's listed order.
- `sha256sum packages/core/test/fixtures/wrong-plan/accord/tickets/TCK-1.md` →
  `bc5139f867319f08aeb7856797debaff0fc9ae566558be7fbc05dc7e9bd9c653`, unchanged from before Task 1.
  The fixture was not edited, regenerated, or re-tagged.
- `node packages/cli/dist/cli.js skills sync` → `unchanged` on all nine rendered paths.
- `sha256sum .planning/REQUIREMENTS.md` → `df0201396b296856e0621ba45807a1bba87cccaf04d66a04996330a2c1361d90`,
  byte-unchanged. `:74` still `- [ ] **SKILL-04**`; `:190` still `| SKILL-04 | Phase 6 | Pending |`;
  `:67` still `- [x] **CLI-08**`; `:186` still `| CLI-08 | Phase 6 | Complete |`.
  `grep -c '^| SKILL-04 | Phase 6 | '` → `1`.
- Plan-level `<verify>` for Task 3, all four commands, re-run and passing on the `fail` branch.
- `npm test` → 32 files, 786 tests, all passing, exit 0.
- `git rev-parse HEAD` → `53e9df94051d2b1fc66f2e50c895684b74ee6b72`. No commit, push, stash, reset,
  or checkout was run.

CF-1 is now recorded in `.planning/WINDOWS.md` as entry 6. The previous pass deferred the ledger
entry because the verdict was a `gate="blocking-human"` checkpoint awaiting the owner's judgement,
and writing it early would have been the same premature claim the plan forbids for the SKILL-04
tick. The owner has upheld the verdict, so it belongs there now, where `/gsd-ship` will see it.

---
*Phase: 06-skills*
*Completed: 2026-09-16*
