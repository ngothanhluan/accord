---
baseline: b5678b55109cb1b8958aed77a3176cb337327459
plan_hash: "fnv1a64:ec8cff4c1770af3b"
---

Review mode `outcome`: one branch, no slices. Report case ids follow the shape the earlier plans use:
`<file>#<name>` with each whitespace run in the test name turned into `-`. Every new test is a top-level
`it(...)` (never inside a `describe`), its name starts with `ac-n` or `risk:<kind>`, and it holds no `@` and no
comma. A skill or template edit is followed, in order, by `npm run gen` (rewrites
`packages/core/src/generated/*.ts`), `npm run build` (CLI tests read `packages/core/dist`), and
`node packages/cli/dist/cli.js skills sync`. This repository's `accord/config.yml` enables `claude` only, so sync
writes under `.claude/skills/` alone; the tests cover every runtime through the render.

## Task 1: Wiring: the writing rule ships in every rendered ask.md and every stage points to it for reports
covers: @ac-1, D-01, D-02, D-03, D-07
files: packages/core/skills/shared/ask.md, packages/core/skills/accord/SKILL.md, packages/core/skills/intent/SKILL.md, packages/core/skills/approach/SKILL.md, packages/core/skills/plan/SKILL.md, packages/core/skills/build/SKILL.md, packages/core/skills/review/SKILL.md, packages/core/skills/verify/SKILL.md, packages/core/skills/debug/SKILL.md, packages/core/src/generated/skills.ts, packages/core/test/stage-skills.test.ts, .claude/skills/accord/ask.md, .claude/skills/accord-intent/ask.md, .claude/skills/accord-approach/ask.md, .claude/skills/accord-plan/ask.md, .claude/skills/accord-build/ask.md, .claude/skills/accord-review/ask.md, .claude/skills/accord-verify/ask.md, .claude/skills/accord-debug/ask.md, .claude/skills/accord/SKILL.md, .claude/skills/accord-intent/SKILL.md, .claude/skills/accord-approach/SKILL.md, .claude/skills/accord-plan/SKILL.md, .claude/skills/accord-build/SKILL.md, .claude/skills/accord-review/SKILL.md, .claude/skills/accord-verify/SKILL.md, .claude/skills/accord-debug/SKILL.md
verify: packages/core/test/stage-skills.test.ts#ac-1-every-rendered-ask.md-holds-the-writing-rule-for-the-owner-and-keeps-its-old-lines (@ac-1)

Test first, in `packages/core/test/stage-skills.test.ts`, after the existing `ac-3 the shared ask rule asks for
plain words and drops the old sentence` case:
`it('ac-1 every rendered ask.md holds the writing rule for the owner and keeps its old lines')`.
- Build `all` exactly as the neighbouring `ac-1`/`ac-2`/`ac-3` cases do (the `config` with
  `runtimes: ['claude', 'codex', 'cursor', 'copilot']`), assert `skillDirs(all)` equals
  `['.agents/skills', '.claude/skills']` and `[...STAGES]` equals the eight stages, then map
  `skillTargets(all)` by path.
- `RULE` is the eight literals of the scenario: `every text written for the owner`, `in any language`,
  `at most 25 words`, `separated by spaces`, `one idea`, `active voice`, `one word for one concept`,
  `no idioms`.
- `OLD` is the 16 non-blank lines of `.claude/skills/accord-verify/ask.md` at the baseline other than its line 1
  marker, copied as string literals in file order (from `# Asking the owner` to `carries a short gloss.`).
- For every `dir` of `skillDirs(all)` and every stage of `STAGES`, read `<dir>/<installedName(stage)>/ask.md`.
  The flattened text (`.replace(/[ \t]*\n[ \t]*/g, ' ')`, as the existing cases do) must hold each `RULE`
  literal. The raw text split on `\n` must hold each `OLD` line as a whole, equal line, each found after the
  previous one (an in-order subsequence). Collect failures as `path + ' lacks ' + item` and assert the list is
  empty.

Produce:
- Append to `packages/core/skills/shared/ask.md`, after the paragraph ending `carries a short gloss.`, one blank
  line and this paragraph, wrapped near 79 columns like the rest of the file:
  `Write short, plain sentences in every text written for the owner in chat, in any language. That covers
  questions, the In plain words lines at a yes, reports, open findings when review stops, and the closing
  skipped and risk lines. A sentence holds one idea and at most 25 words, counting the tokens separated by
  spaces. Use the active voice, one word for one concept, and no idioms. Ticket content such as EARS or
  Gherkin, repository files, and CLI output keep their own form.`
  Each of its sentences is itself under 25 words.
- In each of the eight stage `SKILL.md` sources, change the one line
  `  Read \`./ask.md\` before any question to the owner.` to
  `  Read \`./ask.md\` before any question or report to the owner.` It stays one line in the same bullet.
- Run `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`, which rewrite
  `packages/core/src/generated/skills.ts` and the 16 rendered files under `.claude/skills/`.

Must not change: the three existing paragraphs of `ask.md`, word for word and line for line (the existing ASK-1
and ST-LN-5 cases at `packages/core/test/stage-skills.test.ts:63-114` keep passing); the pointer stays inside
the `Anything touching intent` bullet so `ac-2 every stage skill points to the shared ask rule from its intent
paragraph` keeps passing; every rendered `SKILL.md` stays within `MAX_SKILL_BYTES` (5120) and
`MAX_SKILL_LINES` (120) in `packages/core/test/skills.test.ts`. The pointer edit adds 10 bytes; when a
`SKILL.md` crosses 5120 bytes, stop and report BLOCKED, never shorten other skill text.

## Task 2: The session rules carry the sentence limit
covers: @ac-2, D-05
files: packages/core/templates/ruleset.md, packages/core/src/generated/templates.ts, packages/core/test/session.test.ts
verify: packages/core/test/session.test.ts#ac-2-the-session-rules-filled-with-the-cli-invocation-carry-the-sentence-limit (@ac-2)

Test first, in `packages/core/test/session.test.ts`, top level after the `rulesetText` describe:
`it('ac-2 the session rules filled with the cli invocation carry the sentence limit')`.
- Read `packages/cli/package.json` with `readFileSync(new URL('../../cli/package.json', import.meta.url), 'utf8')`
  and `JSON.parse`; the invocation is `` `npx --yes ${name}@${version}` `` (Ruling: the hook injects that
  invocation, `packages/cli/src/commands/hook.ts:17`).
- `const text = rulesetText(invocation)`. Assert it holds `at most 25 words`; `Buffer.byteLength(text)` is below
  2048; and it still holds every text its tests checked before this ticket: the invocation itself, no `{{`,
  `never writes the ledger unless its own instructions say so`, `these lines go inside that report`, starts
  with `# accord rules\n`, and holds `` Run accord as `npx --yes @accord-dev/accord@ `` (the
  `packages/cli/test/hook.test.ts:16-19` checks).

Produce: in `packages/core/templates/ruleset.md`, after rule 7 (its last line `   its limits.`), the line
`8. Write text for the owner in sentences of at most 25 words, as ask.md says.` Then `npm run gen` (rewrites
`packages/core/src/generated/templates.ts`) and `npm run build`.

Must not change: rules 1 to 7, the heading, the opening line, and the `Run accord as \`{{invocation}}\`` line,
word for word; the existing `rulesetText` and `sessionLine` cases and `packages/cli/test/hook.test.ts` keep
passing.

## Task 3: A side-effect-free counter of owner-facing sentences
covers: @ac-3, D-04, D-07
files: scripts/sentences.mjs (new), packages/core/test/sentences.test.ts (new)
verify: packages/core/test/sentences.test.ts#ac-3-the-sentence-counter-counts-only-the-owner-facing-sentences-of-a-main-session (@ac-3), packages/core/test/sentences.test.ts#risk:parsing-a-Vietnamese-sentence-counts-the-words-whose-letters-are-outside-ASCII

Interface produced, in `scripts/sentences.mjs`, side-effect free like `scripts/plan-review.mjs` (no imports, no
top-level work):
- `export function ownerSentences(records)`: `records` is the array of parsed JSON objects of one transcript.
  Returns `{ text, words, long }[]` in transcript order, where `words` is the word count and `long` is
  `words > 25`.
- Only a record with `type === 'assistant'` whose `message.content` is an array is read, and in it only items
  with `type === 'text'`. User records, `thinking` items, and `tool_use` items are never read.
- Each text item is split on `\n` and read line by line with two skip states. A line whose `trimStart()`
  starts with three backticks or `~~~` toggles the fence; fence lines and lines inside a fence are skipped. A
  line whose `trim()` is `## Intent` starts the approval view; it and every line up to and including the next
  line whose `trim()` is `---` are skipped; with no such line the view runs to the end of that text item. A
  line whose first character that is not a space or tab is `|` is skipped.
- A kept line is split into sentences with `/(?<=[.?!])\s+/`, so a sentence ends at `.`, `?`, or `!` followed
  by whitespace, and at the line end. A word is a token of `split(/\s+/)` that matches `/[\p{L}\p{N}]/u`
  (Ruling: Unicode letters and digits, for Vietnamese). A sentence with zero words is dropped; `text` is the
  sentence trimmed.

Test first, `packages/core/test/sentences.test.ts`, importing the module the way
`packages/core/test/plan-review-count.test.ts:4-6` does, cast to
`{ ownerSentences: (r: unknown[]) => { text: string; words: number; long: boolean }[] }`. A helper
`w(n, tag)` returns `n` distinct words `tag1 … tagn` joined by spaces.
- `it('ac-3 the sentence counter counts only the owner-facing sentences of a main session')`. Records: a user
  record whose `message.content` is `w(30,'u') + '.'`; one assistant record whose `message.content` holds, in
  order, a `thinking` item `w(30,'t') + '.'`, a `tool_use` item with `input: { command: w(30,'c') + '.' }`, and
  one `text` item whose lines are: `w(12,'a') + ' — ** ' + w(13,'b') + '. ' + w(26,'d') + '.'` (a 25-word
  sentence holding `—` and `**`, then a 26-word sentence on the same line); `- check the build` (list line, no
  full stop, 3 words); a fence line, `w(40,'f')`, a fence line; `'  | ' + w(30,'p') + ' |'`;
  `'first | ' + w(9,'e') + '.'` (10 words); `## Intent`, `w(40,'i') + '.'`, `---`. Assert
  `words` equals `[25, 26, 3, 10]` and `long` equals `[false, true, false, false]`.
- `it('risk:parsing a Vietnamese sentence counts the words whose letters are outside ASCII')`: one assistant
  text item `Tôi đã sửa lỗi ở đây.` gives one sentence of 6 words.

## Task 4: The benchmark reports sentence length per main session
covers: @ac-4, D-02, D-05, D-06, D-07
files: scripts/benchmark.mjs, packages/core/test/benchmark.test.ts (new)
verify: packages/core/test/benchmark.test.ts#ac-4-the-benchmark-report-shows-the-sentence-lengths-of-each-main-session (@ac-4), packages/core/test/benchmark.test.ts#risk:complex-branching-the-benchmark-prints-its-report-for-a-folder-with-main-sessions-and-no-subagent-run

Consumes `ownerSentences` from Task 3 (`import { ownerSentences } from './sentences.mjs';`).

Produce, in `scripts/benchmark.mjs`:
- Move the line parse at `scripts/benchmark.mjs:27` into `const records = (file) => …` (same expression) and
  call it from `readRun` and from the main-session read.
- Main sessions: for each folder in `dirs`, every top-level file ending `.jsonl` is one main session. For each,
  from its records: `start` is the UTC date (`toISOString().slice(0, 10)`) of the first record whose
  `Date.parse(o.timestamp)` is a number, or `?` when none; `branch` is the first record's non-empty
  `gitBranch` (Ruling: as `readRun` does), or `?`; `sentences` is `ownerSentences(records)`.
- Guard the header at `scripts/benchmark.mjs:121-123`: with zero subagent runs print
  `0 subagent runs (0 accord agents), read from <n> transcript folder(s).` with no date range (today
  `Math.min()` of nothing makes `toISOString` throw).
- Last section, after the findings note: `## Sentence length in owner-facing text`, a blank line, the line
  `Sentences of the assistant's chat text in each main session, outside code fences, tables, and pasted approval views; a sentence of more than 25 words is long.`,
  a blank line, then with the existing `row()` helper the header
  `start (UTC) | branch | sentences | over 25 words | % over 25 | longest (words)`, the alignment row
  `--- | --- | ---: | ---: | ---: | ---:`, and one row per main session sorted by `start`:
  `| 2026-10-19 | main | 2 | 1 | 50% | 30 |` (percent `Math.round(100 * long / count)`, `0%` and longest `0`
  when the session has no sentence). Then a blank line, `Longest sentences:`, and the three longest sentences
  across all main sessions, longest first, each as `- <n> words: "<text>"`.
- Update the usage comment on line 2 to say it also reads main-session transcripts.

Test first, `packages/core/test/benchmark.test.ts`. Helper: write a temp folder (`mkdtempSync`), run
`execFileSync(process.execPath, [<repo>/scripts/benchmark.mjs, folder], { cwd: <repo>, encoding: 'utf8' })` where
`<repo>` is `fileURLToPath(new URL('../../../', import.meta.url))`, remove the folder in `finally`, timeout 60000
on each `it`. The section is the output from `## Sentence length in owner-facing text` to its end.
- `it('ac-4 the benchmark report shows the sentence lengths of each main session')`. Folder: `a.jsonl` with a
  first record `{ type: 'summary' }` (no timestamp, no branch), then
  `{ type: 'user', timestamp: '2026-10-19T23:59:00.000Z', gitBranch: 'main', message: { content: 'hi' } }`, then
  an assistant text item holding a 30-word sentence and the line `Done.`; `b.jsonl` with records on
  `gitBranch: 't/ST-LN-33'`, first timestamp `2026-10-20T08:00:00.000Z`, and an assistant text item with a
  40-word sentence, a 28-word sentence holding the word `pass`, and a 5-word sentence; one subagent run
  `a/subagents/agent-1.jsonl` plus `agent-1.meta.json` (`{ "agentType": "accord-critic", "description": "critic
  ST-LN-33" }`) whose timestamped assistant text holds a 50-word sentence. Assert the section holds
  `| 2026-10-19 | main | 2 | 1 | 50% | 30 |` and `| 2026-10-20 | t/ST-LN-33 | 3 | 2 | 67% | 40 |` and no other
  table row after the alignment row; the `Longest sentences:` lines are `- 40 words: "…"`, `- 30 words: "…"`,
  `- 28 words: "…"` in that order with the fixture texts, and the 50-word sentence is absent; with the lines
  starting `- ` and holding `words: "` removed, the section does not match `/\b(pass|fail)\b/i`.
- `it('risk:complex-branching the benchmark prints its report for a folder with main sessions and no subagent run')`:
  a folder with only `a.jsonl` as above; the run exits 0 and its output holds `0 subagent runs` and the row
  `| 2026-10-19 | main | 2 | 1 | 50% | 30 |`.

Must not change: `readRun`'s result for a subagent run, every existing section and its rows, the default folder
choice with no argument, and taking several folder arguments in one run, which the D-06 comparison at verify
uses (Ruling 1 in the ledger: the main-branch and ticket-branch transcript folders in one run, told apart by
the branch column).
