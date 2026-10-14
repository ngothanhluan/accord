---
baseline: f0bf44c6586bc3ef774cd97c989af21da333332d
plan_hash: "fnv1a64:c04336fc4db9d315"
---

Review mode `outcome`: one branch, no slices. Report case ids follow the JUnit id shape in
`packages/core/src/load/junit.ts`: `<file>#<name>` with each whitespace run turned into `-`. Both new tests are
top-level `it(...)` cases in `packages/core/test/stage-skills.test.ts`, placed after the `ac-4` case at
`packages/core/test/stage-skills.test.ts:39`, never inside the `describe` at
`packages/core/test/stage-skills.test.ts:29`. Each name starts with its criterion (`ac-n`, no leading `@`) and
holds no `@` and no comma. A skill edit is followed, in order, by `npm run gen` (rewrites
`packages/core/src/generated/skills.ts`), `npm run build` (CLI tests read `packages/core/dist`), and
`node packages/cli/dist/cli.js skills sync`. This repository's `accord/config.yml:13` enables `claude` only, so
sync writes under `.claude/skills/` alone; the tests cover every runtime through the render.

Shared test setup, written by Task 1 and reused by Task 2, at module level in
`packages/core/test/stage-skills.test.ts`:
- `allRuntimes: AccordConfig`, the existing `config` at `packages/core/test/stage-skills.test.ts:7-14` with
  `runtimes: ['claude', 'codex', 'cursor', 'copilot']` (every key of `DIRS` at
  `packages/core/src/skills/targets.ts:17-22`).
- `everyFile = skillTargets(allRuntimes)` and `everyDir = skillDirs(allRuntimes)`; import `skillDirs` and
  `STAGES` (`packages/core/src/skills/targets.ts:41`, `:60`) from `../src/index.js`, which exports both
  (`packages/core/src/index.ts:55`). The eight stages of the ticket are exactly `STAGES`.
- Each test first asserts `everyDir` equals `['.agents/skills', '.claude/skills']` and `STAGES` has length 8, so a
  shrunk table cannot pass vacuously (D-06).

## Task 1: Wiring: the shared ask rule ships beside every stage skill
covers: @ac-1, D-02, D-03, D-05, D-06
files: packages/core/skills/shared/ask.md (new), packages/core/skills/accord/SKILL.md, packages/core/skills/intent/SKILL.md, packages/core/skills/approach/SKILL.md, packages/core/skills/plan/SKILL.md, packages/core/skills/build/SKILL.md, packages/core/skills/review/SKILL.md, packages/core/skills/verify/SKILL.md, packages/core/skills/debug/SKILL.md, packages/core/test/stage-skills.test.ts, packages/core/src/generated/skills.ts, .claude/skills/accord/ask.md (new), .claude/skills/accord-intent/ask.md (new), .claude/skills/accord-approach/ask.md (new), .claude/skills/accord-plan/ask.md (new), .claude/skills/accord-build/ask.md (new), .claude/skills/accord-review/ask.md (new), .claude/skills/accord-verify/ask.md (new), .claude/skills/accord-debug/ask.md (new)
verify: packages/core/test/stage-skills.test.ts#ac-1-the-shared-ask-rule-holds-the-fixed-sentence-beside-every-stage-skill (@ac-1)

Test first: `it('ac-1 the shared ask rule holds the fixed sentence beside every stage skill')`.
- `SENTENCE` is the D-02 sentence exactly as the ticket writes it: `Every question to the owner stands alone,
  because the owner may see only the question and its options: it says in one or two plain sentences what is
  being decided and why now, with an example; each option says what happens if it is chosen; the recommended
  option comes first; every id such as ac-2 or D-03 carries a short gloss.` (one line in the test source).
- For every `dir` of `everyDir` and every `stage` of `STAGES`, the path is
  `dir + '/' + installedName(stage) + '/ask.md'`; its text is read from `everyFile` (`?? ''`).
- Normalise with `text.replace(/[ \t]*\n[ \t]*/g, ' ')`: one line break and the indentation around it become one
  space, while a blank line inside the sentence leaves two spaces and fails (D-05).
- Collect every path whose text is empty or whose normalised text does not contain `SENTENCE` into one list and
  assert it equals `[]`, so a failure names all sixteen offenders at once. It fails today: no `ask.md` renders.

Interface:
- `packages/core/skills/shared/ask.md` (new), shaped like `packages/core/skills/shared/prototype.md:1-5`:
  frontmatter `kind: reference`, a heading `# Asking the owner`, then `SENTENCE` as one paragraph wrapped at
  about 80 columns with no blank line inside it. Nothing else. It names no tool, no runtime product, no
  `packages/` path, no finding level and no gate state word, which the `render output invariants` cases at
  `packages/core/test/skills.test.ts:289`, `:317`, `:327` and `:404` reject.
- Each of the eight stage `SKILL.md` files loads it (D-03):
  - `packages/core/skills/plan/SKILL.md:6` becomes `loads: [plan/baseline.md, shared/ask.md]`;
  - `packages/core/skills/review/SKILL.md:6` becomes `loads: [review/record.md, shared/ask.md]`;
  - accord, intent, approach, build, verify and debug gain the line `loads: [shared/ask.md]` directly after
    `kind: skill`, as `packages/core/skills/designer/SKILL.md:6` declares `loads: [shared/prototype.md]`.
  The render drops `loads:` (`packages/core/src/skills/render.ts:2`), so every rendered `SKILL.md` stays byte for
  byte as it is; `skillTargets` (`packages/core/src/skills/targets.ts:77`) emits `ask.md` beside each one.

Then run `npm run gen`, `npm run build`, and `node packages/cli/dist/cli.js skills sync`, which writes the eight
new `.claude/skills/*/ask.md` files and reports every `SKILL.md` unchanged. Then run the core suite: the new
case, `generated module matches skills/ (drift)` (`packages/core/test/skills.test.ts:153`), and every
`render output invariants` case must pass.

Must not change: the prose of every `SKILL.md`; `packages/core/skills/plan/baseline.md`,
`packages/core/skills/review/record.md` and `packages/core/skills/shared/prototype.md`; the designer skill and
its render; every row of `stage skills name what the spec requires`
(`packages/core/test/stage-skills.test.ts:29-37`) and the `ac-4` case, which keep reading the claude-only
`files`.

## Task 2: Every stage skill points to the shared ask rule
covers: @ac-2, D-01, D-03, D-04, D-07
files: packages/core/skills/accord/SKILL.md, packages/core/skills/intent/SKILL.md, packages/core/skills/approach/SKILL.md, packages/core/skills/plan/SKILL.md, packages/core/skills/build/SKILL.md, packages/core/skills/review/SKILL.md, packages/core/skills/verify/SKILL.md, packages/core/skills/debug/SKILL.md, packages/core/test/stage-skills.test.ts, packages/core/src/generated/skills.ts, .claude/skills/accord/SKILL.md, .claude/skills/accord-intent/SKILL.md, .claude/skills/accord-approach/SKILL.md, .claude/skills/accord-plan/SKILL.md, .claude/skills/accord-build/SKILL.md, .claude/skills/accord-review/SKILL.md, .claude/skills/accord-verify/SKILL.md, .claude/skills/accord-debug/SKILL.md
verify: packages/core/test/stage-skills.test.ts#ac-2-every-stage-skill-points-to-the-shared-ask-rule-from-its-intent-paragraph (@ac-2)

Test first: `it('ac-2 every stage skill points to the shared ask rule from its intent paragraph')`.
- For every `dir` of `everyDir` and every `stage` of `STAGES`, read
  `dir + '/' + installedName(stage) + '/SKILL.md'` from `everyFile` (`?? ''`); an empty text is an offender.
- Split the text into blocks: a blank line ends a block; a line matching `/^\s*(?:[-*+]|\d+\.)\s/` starts a new
  one; any other non-blank line continues the current block. Each block is its lines trimmed and joined with one
  space (a line break counting as one space), then a leading `- `, `* `, `+ ` or `n. ` marker is removed. This
  counts an indented or nested item the same as a column-0 bullet (the critic's Should in the Approach).
- The blocks beginning `Anything touching intent` must number exactly one, and that block must contain
  `stops the run and asks the owner` and `./ask.md` (D-07). Other sentences holding "asks the owner", such as
  `packages/core/skills/review/SKILL.md:54`, are not read.
- Collect each failing path with its reason (`missing`, `found <n> blocks`, or the absent phrase) into one list
  and assert it equals `[]`. It fails today: no skill names `./ask.md`.

Interface: in each of the eight source files, the Rules bullet beginning `Anything touching intent` gains, as a
new last continuation line indented two spaces, the sentence ``Read `./ask.md` before any question to the
owner.``; every existing line of the bullet stays as it is. The bullets are
`packages/core/skills/accord/SKILL.md:107-109`, `packages/core/skills/intent/SKILL.md:65-68`,
`packages/core/skills/approach/SKILL.md:69-72`, `packages/core/skills/plan/SKILL.md:90-93`,
`packages/core/skills/build/SKILL.md:85-88`, `packages/core/skills/review/SKILL.md:87-90`,
`packages/core/skills/verify/SKILL.md:67-70` and `packages/core/skills/debug/SKILL.md:87-90`. The pointer stands
as its own sentence, so it covers every question, the approach yes and the verify approve included (D-01), not
only intent questions.

Then run `npm run gen`, `npm run build`, and `node packages/cli/dist/cli.js skills sync`, which rewrites the
eight `.claude/skills/*/SKILL.md` copies and reports the `ask.md` files unchanged. Then run the core suite:
`every SKILL.md is at most MAX_SKILL_BYTES bytes (spec §2)` (`packages/core/test/skills.test.ts:256`; the
rendered plan skill lands near 5099 of 5120 bytes), `every SKILL.md is at most MAX_SKILL_LINES lines (D-129)`
(`:250`), `every relative reference resolves inside the same render, for more than one roster (D-110)` (`:262`,
which needs Task 1's `ask.md` beside every stage), the drift case at `:153`, both new cases, and every row of
`stage skills name what the spec requires` must pass. If the plan skill exceeds 5120 bytes, shorten only the new
line, never existing text.

Must not change: every other line of the eight skills, including every phrase the `REQUIRED` rows at
`packages/core/test/stage-skills.test.ts:16-25` assert; the `ask.md` files and the `loads:` lines Task 1 wrote;
the designer skill; the ruleset block `skills sync` writes into `CLAUDE.md` (D-03 keeps the rule out of it).
