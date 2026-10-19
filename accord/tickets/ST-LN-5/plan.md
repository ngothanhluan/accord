---
baseline: fa318ea52704b580ede4518225f9deec1a98ac96
plan_hash: "fnv1a64:421a6c96ed83f5ef"
---

Review mode `outcome`: one branch, no slices. Report case ids follow the JUnit id shape in
`packages/core/src/load/junit.ts:16`: `<file>#<name>` with each whitespace run turned into `-`. Every test below
is a top-level `it(...)` case in `packages/core/test/stage-skills.test.ts`, never inside the `describe` at
`packages/core/test/stage-skills.test.ts:29`. Each name starts with its criterion (`ac-n`, no leading `@`) and
holds no `@` and no comma.

Shared shape of every test in this plan, copied from the existing case at
`packages/core/test/stage-skills.test.ts:62-77`:
- `const all = { ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig;`
- guards first: `expect(skillDirs(all)).toEqual(['.agents/skills', '.claude/skills'])` and
  `expect([...STAGES]).toEqual(['accord', 'intent', 'approach', 'plan', 'build', 'review', 'verify', 'debug'])`,
  so a shrunk table cannot pass vacuously;
- `const everyFile = new Map(skillTargets(all).map((f) => [f.path, f.text]));`
- a file's text is `everyFile.get(path) ?? ''`, read as the ticket says with
  `.replace(/[ \t]*\n[ \t]*/g, ' ')` (one line break and the spaces or tabs around it become one space);
- every offending path, with a short reason, is pushed into one `bad` list and the test ends with
  `expect(bad).toEqual([])`, so a failure names all offenders at once.
For an `ask.md` the path is `dir + '/' + installedName(stage) + '/ask.md'` for every `dir` of `skillDirs(all)`
and every `stage` of `STAGES` (sixteen files). A negative check lowercases the text only after the line-break
replacement, because both old phrases are wrapped across two lines today.

A skill edit is followed, in order, by `npm run gen` (rewrites `packages/core/src/generated/skills.ts`),
`npm run build`, and `node packages/cli/dist/cli.js skills sync`, all run from `C:/Work/accord-ln5`, never with
another checkout's build. `accord/config.yml:13` enables `claude` only, so sync writes under `.claude/skills/`
alone; the tests cover every runtime through the in-memory render. Then run `npx vitest run packages/core`.

## Task 1: Wiring: the shared ask rule holds the three new rules beside every stage skill
covers: @ac-1, @ac-2, @ac-3, D-01, D-02, D-03, D-04, D-05, D-08
files: packages/core/skills/shared/ask.md, packages/core/test/stage-skills.test.ts, packages/core/src/generated/skills.ts, .claude/skills/accord/ask.md, .claude/skills/accord-intent/ask.md, .claude/skills/accord-approach/ask.md, .claude/skills/accord-plan/ask.md, .claude/skills/accord-build/ask.md, .claude/skills/accord-review/ask.md, .claude/skills/accord-verify/ask.md, .claude/skills/accord-debug/ask.md
verify: packages/core/test/stage-skills.test.ts#ac-1-the-shared-ask-rule-holds-the-fixed-sentence-beside-every-stage-skill (@ac-1), packages/core/test/stage-skills.test.ts#ac-2-the-shared-ask-rule-says-when-to-ask-multiple-choice-and-when-to-ask-an-open-question (@ac-2), packages/core/test/stage-skills.test.ts#ac-3-the-shared-ask-rule-asks-for-plain-words-and-drops-the-old-sentence (@ac-3)

Tests first, all failing on today's text.

1. Repoint the existing case `it('ac-1 the shared ask rule holds the fixed sentence beside every stage skill')`
   at `packages/core/test/stage-skills.test.ts:62-77`. Its name stays exactly as it is, so ASK-1's `@test` tag
   still resolves. Directly above the `it(` line add the one-line comment
   `// Proves ST-LN-5 ac-1; the sentence ASK-1 ac-1 quotes is superseded by ST-LN-5 D-06.`
   Replace the one `SENTENCE` constant with two, each on one source line, copied from the ticket's ac-1:
   - `CONTEXT`: `A question that needs context to be understood is asked in plain chat, never in a question dialog, because the dialog hides the chat written before it: a few plain sentences of context, then the question, then lettered options, each saying what happens if it is chosen, the recommended one first, with one sentence on why it is recommended.`
   - `DIALOG`: `A question dialog is used only when the question and its options are understood on their own in one line, such as 'Commit now?'.`
   Write the constants in double-quoted or template strings so the single quotes around `Commit now?` stay
   literal. A path goes to `bad` when its normalised text lacks either constant. Every other line of the case
   (guards, loop, normalisation, final assertion) stays as it is.
2. New case directly after it: `it('ac-2 the shared ask rule says when to ask multiple choice and when to ask an open question')`.
   Over the sixteen `ask.md` files, a path goes to `bad` when its normalised text lacks, verbatim (one source
   line, in a double-quoted string so the apostrophe in `owner's` stays literal):
   `Ask multiple choice when you can list two to four exclusive options, each with a consequence drawn from the code or the ticket; ask an open question, with no options, when the answer is in the owner's head, such as why, for whom, what success looks like, or what hurts today; offer a short menu only when the owner is stuck on an open question.`
3. New case directly after that: `it('ac-3 the shared ask rule asks for plain words and drops the old sentence')`.
   Over the sixteen `ask.md` files, a path goes to `bad` (with the reason `lacks plain words` or
   `holds the old sentence`) when its normalised text lacks, verbatim:
   `Explain in plain words for an owner who reads no code: a file path or a symbol is only a pointer, never the explanation, and every id such as ac-2 or D-03 carries a short gloss.`
   or when `normalised.toLowerCase()` contains `may see only the question and its options`.

Interface: `packages/core/skills/shared/ask.md` keeps lines 1-6 (frontmatter `kind: reference`, a blank line,
`# Asking the owner`, a blank line). The paragraph at lines 7-11 is deleted and replaced by three paragraphs,
separated by one blank line, each wrapped at about 80 columns at spaces only, with no blank line inside a
sentence:
- paragraph 1: the `CONTEXT` sentence, then the `DIALOG` sentence (D-03, D-02, D-08);
- paragraph 2: the ac-2 sentence (D-01);
- paragraph 3: the ac-3 sentence (D-05, D-06's plain-words rule).
Nothing else goes in the file. The text names no runtime product, no `packages/` path, no `./` reference, no
finding level, and no capitalised `Ready` or `Done`, which the `render output invariants` cases in
`packages/core/test/skills.test.ts:203-449` reject.

Then run `npm run gen`, `npm run build`, and `node packages/cli/dist/cli.js skills sync`, which rewrites the eight
`.claude/skills/*/ask.md` copies listed above and reports every `SKILL.md` unchanged. Then the three cases above,
`generated module matches skills/ (drift)` (`packages/core/test/skills.test.ts:152`), every
`render output invariants` case, and every other case in `packages/core/test/stage-skills.test.ts` must pass.

Must not change: the frontmatter and heading of `ask.md`; every `SKILL.md` source and render, including each
`loads: [... shared/ask.md]` line and each Rules line ``Read `./ask.md` before any question to the owner.``; the
case `ac-2 every stage skill points to the shared ask rule from its intent paragraph`
(`packages/core/test/stage-skills.test.ts:79-102`) and every other existing case in that file; `accord/tickets/ASK-1.md`
is not edited (D-04 and D-06 accept that its ac-1 text still quotes the old sentence).

## Task 2: The intent skill takes the kind of question from the shared ask rule
covers: @ac-4, D-06, D-07
files: packages/core/skills/intent/SKILL.md, packages/core/test/stage-skills.test.ts, packages/core/src/generated/skills.ts, .claude/skills/accord-intent/SKILL.md
verify: packages/core/test/stage-skills.test.ts#ac-4-the-intent-skill-takes-the-kind-of-question-from-the-shared-ask-rule (@ac-4)

Test first, failing on today's text: new case directly after Task 1's ac-3 case,
`it('ac-4 the intent skill takes the kind of question from the shared ask rule')`.
- Keep the two guards of the shared shape. For every `dir` of `skillDirs(all)`, read
  `dir + '/' + installedName('intent') + '/SKILL.md'` from `everyFile`; an empty text goes to `bad` as `missing`.
- Split into numbered steps as the existing case at `packages/core/test/stage-skills.test.ts:115` does:
  `text.split(/^(?=\d+\. )/m).filter((c) => /^\d+\. /.test(c))`, each chunk normalised with the line-break
  replacement, then `.replace(/\*\*/g, '')`, because step 5 opens in bold (`**One question per message**`).
  Each chunk then runs from its number to the next numbered step.
- The chunks matching `/^\d+\. One question per message/` must number exactly one (otherwise
  `found <n> steps` goes to `bad`), and that chunk must contain `./ask.md` (otherwise `lacks ./ask.md`).
- The whole text, normalised and then lowercased, must not contain `multiple choice where possible` (otherwise
  `still asks multiple choice where possible`). Today's text wraps that phrase as `Multiple` / `choice where
  possible`, so the check fails only after the replacement, which is why it normalises first.

Interface: in `packages/core/skills/intent/SKILL.md`, step 5 at lines 35-37 becomes exactly these two lines:

```
5. **One question per message**, aimed at the dimension with the highest
   score; which kind of question to ask, and how, follows `./ask.md`.
```

The clause "the recommended option first with its reason" goes with the old text: an open question has no options
(D-01), and `ask.md` already puts the recommended option first with one sentence on why (D-08).

Then run `npm run gen`, `npm run build`, and `node packages/cli/dist/cli.js skills sync`, which rewrites
`.claude/skills/accord-intent/SKILL.md` and reports every `ask.md` unchanged. Then the new case, the drift case
(`packages/core/test/skills.test.ts:152`), `every relative reference resolves inside the same render, for more
than one roster (D-110)` (`:261`, the new `./ask.md` must resolve), the line and byte limits (`:249`, `:255`), the
row `intent names every required phrase` (`packages/core/test/stage-skills.test.ts:18`, `:29-37`), and
`ac-1 the intent skill shows intent and the criteria verbatim before the architect` (`:104-128`) must pass.

Must not change: every other line of `packages/core/skills/intent/SKILL.md`, including steps 1-4 and 6-10, the
Rules bullet that ends ``Read `./ask.md` before any question to the owner.``, and every phrase in the `intent`
row at `packages/core/test/stage-skills.test.ts:18`; `packages/core/skills/shared/ask.md` and the cases Task 1
wrote; every other stage skill.
