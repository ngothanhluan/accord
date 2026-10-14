---
baseline: 4fca72de130ad2ce8a7d97f70c2f4698765c56c5
plan_hash: "fnv1a64:479455c5f9114fa4"
---

Review mode `outcome`: one branch, no slices. Report case ids follow the JUnit id shape in
`packages/core/src/load/junit.ts:16`: `<file>#<name>` with each whitespace run turned into `-`, case kept. Both
new tests are top-level `it(...)` cases appended to the end of `packages/core/test/stage-skills.test.ts` (after the
ASK-1 `ac-2` case at `packages/core/test/stage-skills.test.ts:79-102`), never inside the `describe` at
`packages/core/test/stage-skills.test.ts:29`. Each name starts with its criterion (`ac-n`, no leading `@`), holds
no `@` and no comma, and differs from the ASK-1 names `ac-1 the shared ask rule holds the fixed sentence beside
every stage skill` and `ac-2 every stage skill points to the shared ask rule from its intent paragraph`.

A skill edit is followed, in order, by `npm run gen` (rewrites `packages/core/src/generated/skills.ts`),
`npm run build` (CLI tests read `packages/core/dist`), and `node packages/cli/dist/cli.js skills sync`. This
repository's `accord/config.yml:13` enables `claude` only, so sync rewrites `.claude/skills/accord-intent/SKILL.md`
and `.claude/skills/accord-approach/SKILL.md` alone; the tests cover every runtime directory through the render.

Shared setup in both tests, inside each `it` (as the ASK-1 cases at `packages/core/test/stage-skills.test.ts:64-67`
do): `all = { ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig`; first assert
`skillDirs(all)` equals `['.agents/skills', '.claude/skills']` exactly, so a shrunk table cannot pass vacuously;
`everyFile = new Map(skillTargets(all).map((f) => [f.path, f.text]))`. Normalisation is
`replace(/[ \t]*\n[ \t]*/g, ' ')`: one line break and the indentation around it become one space, while a blank
line inside a sentence leaves two spaces and fails (D-04). Every offender is collected, with its path and
reason, into one list asserted equal to `[]`.

The two rendered skills stay inside the ceilings asserted at `packages/core/test/skills.test.ts:250` (120 lines)
and `packages/core/test/skills.test.ts:256` (5120 bytes); the approach skill renders near 3.6 KB today and lands
near 4.4 KB. New prose holds no capitalised gate word `Ready` or `Done`, no finding level, and no tool or runtime
name, which `packages/core/test/skills.test.ts:317`, `:327` and `:404` reject.

## Task 1: The intent stage shows Intent and the criteria verbatim and takes a yes before the architect
covers: @ac-1, D-01, D-02, D-03, D-04, D-05, D-06
files: packages/core/skills/intent/SKILL.md, packages/core/test/stage-skills.test.ts, packages/core/src/generated/skills.ts, .claude/skills/accord-intent/SKILL.md, docs/specs/2026-10-12-workflow-layer-design.md
verify: packages/core/test/stage-skills.test.ts#ac-1-the-intent-skill-shows-intent-and-the-criteria-verbatim-before-the-architect (@ac-1)

Test first: `it('ac-1 the intent skill shows intent and the criteria verbatim before the architect')`, top level.
The test must make every one of these assertions:
- the shared setup above, including `expect(skillDirs(all)).toEqual(['.agents/skills', '.claude/skills'])`;
- `SENTENCE_A` is, on one line in the test source, exactly: ``Show the owner the `## Intent` section and the
  acceptance criteria block verbatim, copied from the ticket file and never summarised, ask for an explicit yes,
  and on yes commit the ticket with the owner's answer quoted in the commit message.``
- for each `dir` of `skillDirs(all)`, the path is `dir + '/' + installedName('intent') + '/SKILL.md'`; an empty
  or missing text is an offender (`<path> missing`) and the loop continues to the next dir;
- split the text into numbered steps with `text.split(/^(?=\d+\. )/m)` and keep only the chunks matching
  `/^\d+\. /` (the preamble before step 1 is dropped); normalise each kept chunk with the normalisation above;
- `sentence` = indexes of steps whose normalised text contains `SENTENCE_A`; `auditor` = indexes of steps
  containing the literal string ``Dispatch `accord-auditor` `` (step 8 today); `next` = indexes of
  steps matching ``/^\d+\. Next: `accord-approach`/``;
- each of the three lists must have exactly one entry, else an offender `<path> <name> found <n> steps`;
- then `auditor[0] < sentence[0]` and `sentence[0] < next[0]`, else an offender `<path> out of order`. Strict
  order means sentence A's step is neither the auditor step nor the Next step: a step of its own (D-05);
- `expect(bad).toEqual([])`.
It fails today: no rendered intent skill holds `SENTENCE_A`.

Interface, in `packages/core/skills/intent/SKILL.md`:
- step 8 (`packages/core/skills/intent/SKILL.md:53-56`, audit then commit) stays word for word.
- A new step 9 is inserted before the current step 9, wrapped at about 80 columns with three-space continuation
  indent and no blank line inside it:
  ``9. **The owner's yes.** Show the owner the `## Intent` section and the acceptance criteria block verbatim,
  copied from the ticket file and never summarised, ask for an explicit yes, and on yes commit the ticket with
  the owner's answer quoted in the commit message. That commit holds `accord/tickets/<id>.md`, with the ledger
  if it changed, and uses `--allow-empty` when nothing changed. On a no, write the owner's words under
  `## Corrections` first, rewrite the sections they touch, take a changed criterion back to step 8, and show
  the text again.``
  Step 9 does not name `accord-auditor` and runs no accord command.
- ``9. Next: `accord-approach`.`` (`packages/core/skills/intent/SKILL.md:58`) becomes ``10. Next: `accord-approach`.``
  with its text unchanged.

Interface, in `docs/specs/2026-10-12-workflow-layer-design.md`: the Interview list
(`docs/specs/2026-10-12-workflow-layer-design.md:111-126`) gains, after item 7:
`8. **The owner's yes.** The agent shows `## Intent` and the acceptance criteria block verbatim, copied from the
ticket file and never summarised, and takes an explicit yes before `accord-architect` runs. The yes is recorded by
quoting the owner's answer in the ticket's commit message, with no new field or gate; a no is written under
`## Corrections` and the text is shown again.` Wrap to the file's existing width and three-space indent.

Then run `npm run gen`, `npm run build`, and `node packages/cli/dist/cli.js skills sync`, which rewrites
`.claude/skills/accord-intent/SKILL.md`. Then run the core suite: the new case, the `intent` row of
`stage skills name what the spec requires` (`packages/core/test/stage-skills.test.ts:18`), the drift case
`generated module matches skills/ (drift)` (`packages/core/test/skills.test.ts:153`) and every
`render output invariants` case must pass.

Must not change: steps 1 to 8 and the Rules of the intent skill, so every phrase of the `intent` row at
`packages/core/test/stage-skills.test.ts:18` (including ``commit `accord/tickets/<id>.md` ``) and the
`Anything touching intent` block the ASK-1 `ac-2` case reads stay; the `loads:` line; every other skill; the ASK-1
cases and the `ac-4` case; the spec's `### Keeping intent binding`, so what `approved_hash` covers is unchanged.

## Task 2: The approach yes shows Approach verbatim instead of a brief
covers: @ac-2, D-01, D-02, D-07
files: packages/core/skills/approach/SKILL.md, packages/core/test/stage-skills.test.ts, packages/core/src/generated/skills.ts, .claude/skills/accord-approach/SKILL.md, docs/specs/2026-10-12-workflow-layer-design.md
verify: packages/core/test/stage-skills.test.ts#ac-2-the-approach-skill-shows-approach-verbatim-instead-of-a-brief (@ac-2)

Test first: `it('ac-2 the approach skill shows approach verbatim instead of a brief')`, top level. The test must
make every one of these assertions:
- the shared setup above, including `expect(skillDirs(all)).toEqual(['.agents/skills', '.claude/skills'])`;
- `SENTENCE_B` is, on one line in the test source, exactly: ``Show the owner the `## Approach` section verbatim,
  copied from the ticket file and never summarised, together with any section changed since the owner's yes at
  the intent stage, and ask for an explicit yes.``
- for each `dir` of `skillDirs(all)`, the path is `dir + '/' + installedName('approach') + '/SKILL.md'`; an
  empty or missing text is an offender (`<path> missing`) and the loop continues;
- normalise the whole text with the normalisation above; it must contain `SENTENCE_B`, else offender
  `<path> lacks sentence B`;
- the normalised text must not contain `Show the owner the brief`, else offender `<path> still shows the brief`
  (checked on the normalised text so a line break between those words cannot hide it);
- `expect(bad).toEqual([])`.
It fails today: `packages/core/skills/approach/SKILL.md:51` reads "Show the owner the brief".

Interface, in `packages/core/skills/approach/SKILL.md`, step 5 (`packages/core/skills/approach/SKILL.md:51-60`)
becomes, wrapped at about 80 columns with three-space indent and no blank line inside the step:
``5. **The owner's yes.** Show the owner the `## Approach` section verbatim, copied from the ticket file and never
summarised, together with any section changed since the owner's yes at the intent stage, and ask for an explicit
yes. Treat every approved section as changed: show Intent, the criteria, Vetoes, Decisions, and Corrections
verbatim too. The question names the text above it and `accord/tickets/<id>.md`. Say that the yes also approves
the ticket's Intent, acceptance criteria, Vetoes, Decisions, and Corrections as written: the approval covers them
all. On yes, run `accord approve <id>`, then `accord gate ready <id>` and work from what it prints. Then commit
the ticket, with `approved_hash:` and `ac_hash:` in it. If the owner picks another option, go back to step 3 with
that option, rewrite `## Approach`, and ask again. On any other no, write the owner's words under
`## Corrections` first, empty `## Approach` below its heading, go back to `accord-intent` step 8, and restart
this stage at step 2.``
followed by the guard, still inside step 5 and replacing `packages/core/skills/approach/SKILL.md:59-60`:
``` `accord approve` runs only on a yes to the sections as shown. Never run `accord approve` without the owner's
yes in this conversation. ```
The sentence "Say that the yes also approves ... covers them all." stays as written (D-02).

Interface, in `docs/specs/2026-10-12-workflow-layer-design.md`, §7 Approach item 4
(`docs/specs/2026-10-12-workflow-layer-design.md:221-226`) gains one clause before "Approval runs
`accord approve`": `The owner's yes is asked on `## Approach` and every other approved section, each shown
verbatim from the ticket file and never summarised.` Wrap to the file's existing width and indent.

Then run `npm run gen`, `npm run build`, and `node packages/cli/dist/cli.js skills sync`, which rewrites
`.claude/skills/accord-approach/SKILL.md`. Then run the core suite: both new cases, the `approach` row of
`stage skills name what the spec requires` (`packages/core/test/stage-skills.test.ts:19`), the drift case at
`packages/core/test/skills.test.ts:153`, `every SKILL.md is at most MAX_SKILL_BYTES bytes (spec §2)`
(`packages/core/test/skills.test.ts:256`), and every `render output invariants` case must pass. If the byte
ceiling is exceeded, shorten only the new sentences other than sentence B, never existing text.

Must not change: steps 1 to 4, step 6 and the Rules of the approach skill; every phrase of the `approach` row at
`packages/core/test/stage-skills.test.ts:19`, including `back to step 3`, `Decisions, and Corrections as written`,
``Commit `accord/tickets/<id>.md` `` and `approved_hash:`; the `Anything touching intent` block; what
`accord approve` hashes; Task 1's intent skill and its test.
